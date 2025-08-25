import { Router, Request, Response, NextFunction } from 'express';
import { UploadController } from '../controllers/upload.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { rateLimiter } from '../middleware/rate-limit.middleware';
import { errorHandler } from '../middleware/error.middleware';
import { correlationId } from '../middleware/correlation.middleware';
import { audit } from '../middleware/audit.middleware';
import { configManager } from '../config';
import Joi from 'joi';
import * as winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const router = Router();
const uploadController = new UploadController();

// Validation schemas with enterprise-grade validation
const uploadSchema = Joi.object({
  storeId: Joi.string().min(1).max(255).required().messages({
    'string.empty': 'Store ID is required',
    'any.required': 'Store ID must be provided',
    'string.max': 'Store ID cannot exceed 255 characters'
  }),
  priority: Joi.number().integer().min(1).max(10).default(5).messages({
    'number.base': 'Priority must be a number',
    'number.min': 'Priority must be at least 1',
    'number.max': 'Priority cannot exceed 10'
  }),
  metadata: Joi.object().optional(),
  tags: Joi.array().items(Joi.string()).max(10).optional(),
  expiresAt: Joi.date().greater('now').optional()
});

const documentIdSchema = Joi.object({
  documentId: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
    'string.guid': 'Document ID must be a valid UUID',
    'any.required': 'Document ID is required'
  })
});

const storeIdSchema = Joi.object({
  storeId: Joi.string().min(1).max(255).required().messages({
    'string.empty': 'Store ID is required',
    'any.required': 'Store ID must be provided',
    'string.max': 'Store ID cannot exceed 255 characters'
  })
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'priority', 'processingStatus').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'cancelled').optional()
});

// Security and monitoring middleware
router.use(correlationId);
router.use(audit);

// Upload single document with enterprise error handling
router.post(
  '/upload',
  authenticate,
  rateLimiter({ 
    max: configManager.config.security.rateLimits.upload.max, 
    windowMs: configManager.config.security.rateLimits.upload.windowMs 
  }),
  uploadController.uploadSingle,
  validateRequest(uploadSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await uploadController.uploadDocument(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Upload multiple documents with enhanced validation
router.post(
  '/upload/batch',
  authenticate,
  rateLimiter({ 
    max: Math.floor(configManager.config.security.rateLimits.upload.max / 2), 
    windowMs: configManager.config.security.rateLimits.upload.windowMs 
  }),
  uploadController.uploadMultiple,
  validateRequest(Joi.object({
    uploads: Joi.array().items(uploadSchema).min(1).max(10).required(),
    batchMetadata: Joi.object().optional()
  }), 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await uploadController.uploadMultipleDocuments(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Get document status with detailed response
router.get(
  '/documents/:documentId/status',
  authenticate,
  validateRequest(documentIdSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await uploadController.getDocumentStatus(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Get documents by store with pagination and filtering
router.get(
  '/stores/:storeId/documents',
  authenticate,
  validateRequest(storeIdSchema, 'params'),
  validateRequest(paginationSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await uploadController.getStoreDocuments(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Delete document with proper authorization and audit
router.delete(
  '/documents/:documentId',
  authenticate,
  authorize(['admin', 'store_manager']),
  validateRequest(documentIdSchema, 'params'),
  validateRequest(Joi.object({
    reason: Joi.string().min(10).max(500).required().messages({
      'string.min': 'Deletion reason must be at least 10 characters',
      'string.max': 'Deletion reason cannot exceed 500 characters',
      'any.required': 'Deletion reason is required for audit purposes'
    }),
    force: Joi.boolean().default(false)
  }), 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await uploadController.deleteDocument(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Get upload statistics with time-based filtering
router.get(
  '/stats',
  authenticate,
  validateRequest(Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().greater(Joi.ref('startDate')).optional(),
    storeId: Joi.string().optional(),
    groupBy: Joi.string().valid('day', 'week', 'month').default('day')
  }), 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await uploadController.getUploadStats(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Health check endpoint
router.get(
  '/health',
  async (req: Request, res: Response) => {
    try {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'document-processor-upload'
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Health check failed' });
    }
  }
);

// Get processing metrics
router.get(
  '/metrics',
  authenticate,
  authorize(['admin', 'analyst']),
  validateRequest(Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().greater(Joi.ref('startDate')).optional(),
    storeId: Joi.string().optional()
  }), 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await uploadController.getProcessingMetrics(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Apply global error handling
router.use(errorHandler);

// Graceful shutdown handler
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down upload routes gracefully');
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down upload routes gracefully');
});

export default router;