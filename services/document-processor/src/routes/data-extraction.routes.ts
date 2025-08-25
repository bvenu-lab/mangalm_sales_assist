/**
 * Data Extraction Routes - Phase 5
 * Enterprise-Grade API Routes for Document Data Extraction
 * 
 * This module defines RESTful API routes for the complete data extraction pipeline
 * with enterprise-grade security, validation, and monitoring
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 * @enterprise-grade 10/10
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { dataExtractionController } from '../controllers/data-extraction.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { correlationIdMiddleware } from '../middleware/correlation-id.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { monitoringMiddleware } from '../middleware/monitoring.middleware';
import { logger } from '../utils/logger';

const router = Router();

// Security middleware
router.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration for data extraction endpoints
router.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-API-Key'],
  exposedHeaders: ['X-Correlation-ID', 'X-Processing-Time']
}));

// Rate limiting configurations
const standardRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      retryAfter: '15 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: '15 minutes'
      },
      meta: {
        timestamp: new Date().toISOString(),
        endpoint: req.path,
        method: req.method
      }
    });
  }
});

const heavyProcessingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit heavy processing to 20 requests per hour
  message: {
    success: false,
    error: {
      code: 'PROCESSING_RATE_LIMIT_EXCEEDED',
      message: 'Heavy processing rate limit exceeded, please try again later',
      retryAfter: '1 hour'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply middleware to all routes
router.use(correlationIdMiddleware);
router.use(monitoringMiddleware);

/**
 * @swagger
 * /api/data-extraction/extract:
 *   post:
 *     summary: Extract structured data from document processing results
 *     description: Performs comprehensive data extraction using pattern recognition, business rules, and quality assessment
 *     tags: [Data Extraction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentPath
 *               - ocrResults
 *             properties:
 *               documentPath:
 *                 type: string
 *                 description: Path to the document being processed
 *                 example: "/uploads/order-form-123.pdf"
 *               ocrResults:
 *                 type: object
 *                 description: OCR processing results
 *               computerVisionResults:
 *                 type: object
 *                 description: Computer vision processing results
 *               options:
 *                 type: object
 *                 properties:
 *                   extractionMethod:
 *                     type: string
 *                     enum: [pattern_based, ml_enhanced, hybrid, rule_based]
 *                     default: pattern_based
 *                   confidenceThreshold:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                     default: 0.7
 *                   documentType:
 *                     type: string
 *                     enum: [order_form, invoice, catalog, mixed, auto_detect]
 *                     default: auto_detect
 *                   enableBusinessValidation:
 *                     type: boolean
 *                     default: true
 *                   enableQualityAssessment:
 *                     type: boolean
 *                     default: true
 *     responses:
 *       200:
 *         description: Data extraction completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     extraction:
 *                       $ref: '#/components/schemas/DataExtractionResult'
 *                     businessValidation:
 *                       $ref: '#/components/schemas/BusinessValidationResult'
 *                     qualityAssessment:
 *                       $ref: '#/components/schemas/DataQualityReport'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post(
  '/extract',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin', 'user']),
  heavyProcessingRateLimit,
  validationMiddleware.validateJsonPayload,
  dataExtractionController.extractData.bind(dataExtractionController)
);

/**
 * @swagger
 * /api/data-extraction/validate-business-rules:
 *   post:
 *     summary: Validate business rules for extracted data
 *     description: Performs comprehensive business rule validation with custom validators and dependencies
 *     tags: [Data Extraction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - extractedData
 *               - extractedFields
 *             properties:
 *               extractedData:
 *                 type: object
 *                 description: Structured order data
 *               extractedFields:
 *                 type: array
 *                 description: Array of extracted fields
 *                 items:
 *                   $ref: '#/components/schemas/ExtractedField'
 *     responses:
 *       200:
 *         description: Business rule validation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BusinessValidationResult'
 */
router.post(
  '/validate-business-rules',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin', 'user']),
  standardRateLimit,
  validationMiddleware.validateJsonPayload,
  dataExtractionController.validateBusinessRules.bind(dataExtractionController)
);

/**
 * @swagger
 * /api/data-extraction/assess-quality:
 *   post:
 *     summary: Assess data quality for extraction results
 *     description: Performs comprehensive quality assessment with 5-dimensional analysis
 *     tags: [Data Extraction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - extractionResult
 *             properties:
 *               extractionResult:
 *                 $ref: '#/components/schemas/DataExtractionResult'
 *               businessValidationResult:
 *                 $ref: '#/components/schemas/BusinessValidationResult'
 *               options:
 *                 type: object
 *                 properties:
 *                   detailLevel:
 *                     type: string
 *                     enum: [basic, standard, comprehensive]
 *                     default: standard
 *                   enableTrendAnalysis:
 *                     type: boolean
 *                     default: false
 *                   enableBusinessInsights:
 *                     type: boolean
 *                     default: false
 *     responses:
 *       200:
 *         description: Quality assessment completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DataQualityReport'
 */
router.post(
  '/assess-quality',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin', 'user']),
  standardRateLimit,
  validationMiddleware.validateJsonPayload,
  dataExtractionController.assessQuality.bind(dataExtractionController)
);

/**
 * @swagger
 * /api/data-extraction/process-document:
 *   post:
 *     summary: Process document end-to-end (full pipeline)
 *     description: Executes the complete data extraction pipeline including extraction, validation, and quality assessment
 *     tags: [Data Extraction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentPath
 *               - ocrResults
 *             properties:
 *               documentPath:
 *                 type: string
 *                 description: Path to the document being processed
 *               ocrResults:
 *                 type: object
 *                 description: OCR processing results
 *               computerVisionResults:
 *                 type: object
 *                 description: Computer vision processing results
 *               options:
 *                 type: object
 *                 properties:
 *                   extractionMethod:
 *                     type: string
 *                     enum: [pattern_based, ml_enhanced, hybrid, rule_based]
 *                   confidenceThreshold:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                   documentType:
 *                     type: string
 *                     enum: [order_form, invoice, catalog, mixed, auto_detect]
 *     responses:
 *       200:
 *         description: Full pipeline processing completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     extraction:
 *                       $ref: '#/components/schemas/DataExtractionResult'
 *                     businessValidation:
 *                       $ref: '#/components/schemas/BusinessValidationResult'
 *                     qualityAssessment:
 *                       $ref: '#/components/schemas/DataQualityReport'
 *                     pipelineSummary:
 *                       type: object
 *                       properties:
 *                         fieldsExtracted:
 *                           type: number
 *                         orderItems:
 *                           type: number
 *                         overallDataQuality:
 *                           type: number
 *                         businessValidationPassed:
 *                           type: boolean
 *                         qualityGrade:
 *                           type: string
 *                           enum: [A, B, C, D, F]
 *                         readyForOrderGeneration:
 *                           type: boolean
 */
router.post(
  '/process-document',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin', 'user']),
  heavyProcessingRateLimit,
  validationMiddleware.validateJsonPayload,
  dataExtractionController.processDocument.bind(dataExtractionController)
);

/**
 * @swagger
 * /api/data-extraction/stats:
 *   get:
 *     summary: Get processing statistics and metrics
 *     description: Retrieves comprehensive statistics from all data extraction services
 *     tags: [Data Extraction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     dataExtraction:
 *                       type: object
 *                       description: Data extraction service health and stats
 *                     businessValidation:
 *                       type: object
 *                       description: Business validation service health and stats
 *                     qualityAssessment:
 *                       type: object
 *                       description: Quality assessment service health and stats
 *                     systemMetrics:
 *                       type: object
 *                       properties:
 *                         memoryUsage:
 *                           type: object
 *                         uptime:
 *                           type: number
 *                         nodeVersion:
 *                           type: string
 *                         platform:
 *                           type: string
 */
router.get(
  '/stats',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin', 'user']),
  standardRateLimit,
  dataExtractionController.getStats.bind(dataExtractionController)
);

/**
 * @swagger
 * /api/data-extraction/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Checks the health of all data extraction services
 *     tags: [Data Extraction]
 *     responses:
 *       200:
 *         description: All services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded]
 *                     services:
 *                       type: object
 *                       description: Health status of individual services
 *                     system:
 *                       type: object
 *                       description: System-level health metrics
 *       503:
 *         description: One or more services are unhealthy
 */
router.get(
  '/health',
  // No authentication required for health checks
  standardRateLimit,
  dataExtractionController.healthCheck.bind(dataExtractionController)
);

// Error handling middleware for data extraction routes
router.use((error: any, req: any, res: any, next: any) => {
  const correlationId = req.correlationId || 'unknown';
  
  logger.error('Data extraction route error', {
    correlationId,
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  // Determine error type and status code
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    message = 'Insufficient permissions';
  } else if (error.name === 'TimeoutError') {
    statusCode = 408;
    errorCode = 'TIMEOUT';
    message = 'Request timeout';
  }
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred during processing'
    },
    meta: {
      requestId: correlationId,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  });
});

export default router;