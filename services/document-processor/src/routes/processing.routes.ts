import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { rateLimiter } from '../middleware/rate-limit.middleware';
import { errorHandler } from '../middleware/error.middleware';
import { correlationId } from '../middleware/correlation.middleware';
import { audit } from '../middleware/audit.middleware';
import { AppDataSource } from '../database/connection';
import { ExtractedOrder } from '../models/extracted-order.entity';
import { DocumentUpload } from '../models/document-upload.entity';
import { transactionService } from '../services/transaction.service';
import { monitoring } from '../services/monitoring.service';
import { configManager } from '../config';
import * as winston from 'winston';
import Joi from 'joi';

const router = Router();
const config = configManager.config;

// Configure logger from enterprise configuration
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    config.logging.enableCorrelationId 
      ? winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
          return `${timestamp} [${level}] [${correlationId || 'no-correlation'}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      : winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    ...(config.logging.enableFile ? [
      new winston.transports.File({
        filename: config.logging.file,
        maxsize: config.logging.maxFileSize,
        maxFiles: config.logging.maxFiles
      })
    ] : [])
  ]
});

// Enterprise validation schemas
const documentIdSchema = Joi.object({
  documentId: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
    'string.guid': 'Document ID must be a valid UUID',
    'any.required': 'Document ID is required'
  })
});

const storeIdSchema = Joi.object({
  storeId: Joi.string().min(1).max(255).required().messages({
    'string.empty': 'Store ID is required',
    'any.required': 'Store ID must be provided'
  })
});

const paginationSchema = Joi.object({
  status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'cancelled').optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  sortBy: Joi.string().valid('createdAt', 'processingTimeMs', 'priority').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const correctionsSchema = Joi.object({
  corrections: Joi.object().required().messages({
    'any.required': 'Corrections data is required'
  }),
  reviewNotes: Joi.string().max(1000).optional(),
  approved: Joi.boolean().default(false)
});

// Apply middleware
router.use(correlationId);
router.use(audit);
router.use(rateLimiter({ 
  max: config.security.rateLimits.classify.max, 
  windowMs: config.security.rateLimits.classify.windowMs 
}));

// Get processing results for a document with enterprise error handling
router.get(
  '/documents/:documentId/results',
  authenticate,
  validateRequest(documentIdSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const correlationId = (req as any).correlationId;
    const startTime = Date.now();
    logger.info('Fetching processing results', { documentId: req.params.documentId, correlationId });
    monitoring.incrementCounter('processing.results.requested', 1);
    
    const result = await transactionService.executeReadOnly(async (manager) => {
      const { documentId } = req.params;
      
      // Get document with proper error handling
      const documentRepo = manager.getRepository(DocumentUpload);
      const document = await documentRepo.findOne({
        where: { id: documentId, deletedAt: null }
      });
      
      if (!document) {
        const error = new Error('Document not found');
        (error as any).statusCode = 404;
        throw error;
      }
      
      // Check user authorization for this store
      const userStoreId = (req as any).user?.storeId;
      if (userStoreId && document.storeId !== userStoreId) {
        const error = new Error('Access denied: insufficient permissions for this store');
        (error as any).statusCode = 403;
        throw error;
      }
      
      // Get extracted order if exists
      const extractedOrderRepo = manager.getRepository(ExtractedOrder);
      const extractedOrder = await extractedOrderRepo.findOne({
        where: { documentId }
      });
      
      return {
        document: {
          id: document.id,
          fileName: document.originalName,
          status: document.processingStatus,
          uploadedAt: document.createdAt,
          processingStartedAt: document.processingStartedAt,
          processingCompletedAt: document.processingCompletedAt,
          processingTimeMs: document.processingTimeMs,
          errorMessage: config.logging.enableSensitiveDataMasking 
            ? this.maskSensitiveData(document.errorMessage) 
            : document.errorMessage,
          retryCount: document.retryCount,
          storeId: document.storeId,
          priority: document.priority
        },
        classification: extractedOrder ? {
          id: extractedOrder.id,
          documentClass: extractedOrder.documentType,
          quality: extractedOrder.qualityScore,
          confidence: extractedOrder.confidenceScores.overall,
          ocrEngine: extractedOrder.ocrEngineUsed,
          preprocessingApplied: extractedOrder.preprocessingApplied,
          extractionAccuracy: extractedOrder.extractionAccuracy,
          reviewed: extractedOrder.reviewed,
          approved: extractedOrder.approved
        } : null,
        extractedData: extractedOrder?.extractedData || null,
        confidenceScores: extractedOrder?.confidenceScores || null,
        validationErrors: extractedOrder?.validationErrors || null,
        metadata: {
          correlationId,
          fetchedAt: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }
      };
    });
    
    const responseTime = Date.now() - startTime;
    logger.info('Processing results fetched successfully', { 
      documentId: req.params.documentId, 
      correlationId,
      responseTime
    });
    
    monitoring.recordTiming('processing.results.fetch_duration', responseTime);
    monitoring.incrementCounter('processing.results.success', 1);
    
    res.json({
      success: true,
      data: result
    });
  })
);

// Get all processing results for a store with enhanced filtering
router.get(
  '/stores/:storeId/results',
  authenticate,
  validateRequest(storeIdSchema, 'params'),
  validateRequest(paginationSchema, 'query'),
  async (req: Request, res: Response) => {
    const correlationId = (req as any).correlationId;
    const startTime = Date.now();
    try {
      const { storeId } = req.params;
      const { status, limit = 20, offset = 0 } = req.query;
      
      // Build query
      const documentRepo = AppDataSource.getRepository(DocumentUpload);
      let query = documentRepo.createQueryBuilder('document')
        .where('document.storeId = :storeId', { storeId })
        .andWhere('document.deletedAt IS NULL');
      
      if (status) {
        query = query.andWhere('document.processingStatus = :status', { status });
      }
      
      // Get documents with pagination
      const [documents, total] = await query
        .orderBy('document.createdAt', 'DESC')
        .skip(Number(offset))
        .take(Number(limit))
        .getManyAndCount();
      
      // Get extracted orders for these documents
      const documentIds = documents.map(d => d.id);
      const extractedOrderRepo = AppDataSource.getRepository(ExtractedOrder);
      const extractedOrders = await extractedOrderRepo.find({
        where: { documentId: documentIds as any }
      });
      
      // Map extracted orders by document ID
      const extractedOrderMap = new Map(
        extractedOrders.map(eo => [eo.documentId, eo])
      );
      
      // Combine results
      const results = documents.map(doc => {
        const extractedOrder = extractedOrderMap.get(doc.id);
        return {
          document: {
            id: doc.id,
            fileName: doc.originalName,
            status: doc.processingStatus,
            uploadedAt: doc.createdAt,
            processingTimeMs: doc.processingTimeMs
          },
          classification: extractedOrder ? {
            documentClass: extractedOrder.documentType,
            quality: extractedOrder.qualityScore,
            confidence: extractedOrder.confidenceScores.overall
          } : null
        };
      });
      
      res.json({
        success: true,
        data: {
          results,
          total,
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (error: any) {
      logger.error('Error getting store processing results:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get store processing results'
      });
    }
  }
);

// Update manual corrections with proper validation and audit
router.post(
  '/documents/:documentId/corrections',
  authenticate,
  authorize(['admin', 'store_manager', 'reviewer']),
  validateRequest(documentIdSchema, 'params'),
  validateRequest(correctionsSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const correlationId = (req as any).correlationId;
    const startTime = Date.now();
    logger.info('Updating manual corrections', { documentId: req.params.documentId, correlationId });
    monitoring.incrementCounter('processing.corrections.requested', 1);
    
    const result = await transactionService.executeInTransaction(async (manager) => {
      const { documentId } = req.params;
      const { corrections, reviewNotes, approved } = req.body;
      const userId = (req as any).user?.id;
      
      const extractedOrderRepo = manager.getRepository(ExtractedOrder);
      const extractedOrder = await extractedOrderRepo.findOne({
        where: { documentId },
        lock: { mode: 'pessimistic_write' }
      });
      
      if (!extractedOrder) {
        const error = new Error('Extracted order not found');
        (error as any).statusCode = 404;
        throw error;
      }
      
      // Validate user has permission for this store
      const userStoreId = (req as any).user?.storeId;
      if (userStoreId && extractedOrder.storeId !== userStoreId) {
        const error = new Error('Access denied: insufficient permissions for this store');
        (error as any).statusCode = 403;
        throw error;
      }
      
      // Update with comprehensive audit trail
      const previousState = { ...extractedOrder };
      
      extractedOrder.manualCorrections = {
        ...extractedOrder.manualCorrections,
        ...corrections,
        lastModified: new Date().toISOString(),
        modifiedBy: userId
      };
      
      extractedOrder.reviewed = true;
      extractedOrder.reviewedBy = userId;
      extractedOrder.reviewedAt = new Date();
      
      if (approved !== undefined) {
        extractedOrder.approved = approved;
        if (approved) {
          extractedOrder.approvedBy = userId;
          extractedOrder.approvedAt = new Date();
        }
      }
      
      const savedOrder = await extractedOrderRepo.save(extractedOrder);
      
      // Log audit event
      logger.info('Manual corrections updated', {
        documentId,
        correlationId,
        userId,
        reviewNotes,
        approved,
        previousReviewed: previousState.reviewed,
        previousApproved: previousState.approved
      });
      
      return {
        id: savedOrder.id,
        reviewed: savedOrder.reviewed,
        approved: savedOrder.approved,
        reviewedAt: savedOrder.reviewedAt,
        approvedAt: savedOrder.approvedAt,
        updatedAt: savedOrder.updatedAt
      };
    });
    
    const responseTime = Date.now() - startTime;
    monitoring.recordTiming('processing.corrections.update_duration', responseTime);
    monitoring.incrementCounter('processing.corrections.success', 1);
    
    res.json({
      success: true,
      message: 'Corrections saved successfully',
      data: result,
      metadata: {
        correlationId,
        responseTime
      }
    });
  })
);

// Add enterprise utility methods
function maskSensitiveData(data: any): any {
  if (!data || typeof data !== 'string') return data;
  
  // Mask potential sensitive information like file paths, API keys, etc.
  return data
    .replace(/\/[\w\/.-]+\/(uploads|temp|private)\/[\w\/-]+/gi, '[MASKED_PATH]')
    .replace(/[a-f0-9]{32,}/gi, '[MASKED_HASH]')
    .replace(/(?:password|secret|key|token)\s*[=:]\s*[\w\d]+/gi, '[MASKED_CREDENTIAL]');
}

// Health check
router.get(
  '/health',
  async (req: Request, res: Response) => {
    try {
    const dbConnection = AppDataSource.isInitialized;
    
    res.status(dbConnection ? 200 : 503).json({
      status: dbConnection ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'document-processor-processing',
      database: dbConnection ? 'connected' : 'disconnected'
    });
  })
);

// Apply global error handler
router.use(errorHandler.globalHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down processing routes gracefully');
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down processing routes gracefully');
});

export default router;