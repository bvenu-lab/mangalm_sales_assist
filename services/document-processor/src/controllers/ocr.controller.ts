import { Request, Response } from 'express';
import { ocrIntegrationService, OCRProcessingOptions, OCRProcessingEvent } from '../services/ocr-integration.service';
import { documentUploadService } from '../services/document-upload.service';
import { configManager } from '../config';
import { monitoring } from '../services/monitoring.service';
import { transactionService } from '../services/transaction.service';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

// Configure logger from enterprise configuration
const config = configManager.config;
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
        filename: path.join(path.dirname(config.logging.file), 'ocr-controller.log'),
        maxsize: config.logging.maxFileSize,
        maxFiles: config.logging.maxFiles
      })
    ] : [])
  ]
});

export interface OCRRequestBody {
  documentId: string;
  storeId?: string;
  priority?: number;
  metadata?: any;
  correlationId?: string;
  
  // OCR Processing Options
  engine?: 'tesseract' | 'easyocr' | 'paddleocr' | 'ensemble';
  language?: string;
  enablePostProcessing?: boolean;
  qualityThreshold?: number;
  enableFallback?: boolean;
  maxRetries?: number;
  enableCaching?: boolean;
  enableProfiling?: boolean;
  
  // Real-time updates
  enableWebSocketUpdates?: boolean;
  callbackUrl?: string;
}

export interface OCRResponse {
  success: boolean;
  message: string;
  data?: {
    ocrJobId: string;
    correlationId: string;
    estimatedProcessingTime?: number;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    
    // Results (when completed)
    extractedText?: string;
    structuredText?: string;
    confidence?: number;
    qualityScore?: number;
    corrections?: number;
    
    // Metadata
    processingTime?: number;
    engineUsed?: string;
    documentElements?: any[];
    errors?: any[];
    warnings?: any[];
    recommendations?: string[];
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

class OCRController {
  private activeJobs: Map<string, { 
    correlationId: string; 
    status: string; 
    startTime: number;
    documentId: string;
    res?: Response;
  }> = new Map();
  
  private eventEmitter = new EventEmitter();

  constructor() {
    this.setupEventHandlers();
  }

  /**
   * Process document with OCR - Main endpoint
   */
  async processDocument(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string || this.generateCorrelationId();
    const startTime = Date.now();
    
    try {
      // Validate request
      const validationResult = await this.validateOCRRequest(req.body, correlationId);
      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          message: 'Invalid request parameters',
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error,
            details: validationResult.details
          }
        });
        return;
      }

      const requestData = req.body as OCRRequestBody;
      logger.info('Starting OCR processing request', {
        correlationId,
        documentId: requestData.documentId,
        storeId: requestData.storeId
      });

      // Get document information
      const documentInfo = await documentUploadService.getDocumentById(
        requestData.documentId, 
        correlationId
      );
      
      if (!documentInfo) {
        res.status(404).json({
          success: false,
          message: 'Document not found',
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: `Document with ID ${requestData.documentId} not found`
          }
        });
        return;
      }

      // Check document status
      if (documentInfo.status !== 'classified') {
        res.status(400).json({
          success: false,
          message: 'Document must be classified before OCR processing',
          error: {
            code: 'INVALID_DOCUMENT_STATUS',
            message: `Document status is ${documentInfo.status}, expected 'classified'`
          }
        });
        return;
      }

      // Generate OCR job ID
      const ocrJobId = this.generateOCRJobId();
      
      // Register job
      this.activeJobs.set(ocrJobId, {
        correlationId,
        status: 'queued',
        startTime,
        documentId: requestData.documentId,
        res: requestData.enableWebSocketUpdates ? undefined : res
      });

      // Prepare OCR options
      const ocrOptions: OCRProcessingOptions = {
        correlationId,
        engine: this.mapEngineString(requestData.engine),
        language: requestData.language || 'eng',
        enablePostProcessing: requestData.enablePostProcessing !== false,
        qualityThreshold: requestData.qualityThreshold || 0.7,
        enableFallback: requestData.enableFallback !== false,
        maxRetries: requestData.maxRetries || 2,
        enableCaching: requestData.enableCaching !== false,
        enableProfiling: requestData.enableProfiling || false,
        notificationCallback: (event: OCRProcessingEvent) => {
          this.handleOCREvent(ocrJobId, event);
        }
      };

      // Start async processing
      this.processDocumentAsync(
        ocrJobId,
        documentInfo.filePath,
        ocrOptions,
        requestData,
        correlationId
      ).catch(error => {
        logger.error('Async OCR processing failed', { 
          correlationId, 
          ocrJobId, 
          error 
        });
        this.handleProcessingError(ocrJobId, error);
      });

      // Respond immediately with job information
      const response: OCRResponse = {
        success: true,
        message: 'OCR processing started',
        data: {
          ocrJobId,
          correlationId,
          estimatedProcessingTime: this.estimateProcessingTime(documentInfo),
          status: 'queued'
        }
      };

      if (!requestData.enableWebSocketUpdates) {
        res.status(202).json(response);
      }

      monitoring.incrementCounter('ocr.requests.started', 1);
      logger.info('OCR processing queued', { correlationId, ocrJobId });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('OCR request failed', {
        correlationId,
        error,
        processingTime
      });

      monitoring.incrementCounter('ocr.requests.failed', 1);
      monitoring.recordTiming('ocr.requests.failed_duration', processingTime);

      res.status(500).json({
        success: false,
        message: 'Internal server error during OCR processing',
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * Get OCR job status
   */
  async getJobStatus(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string || this.generateCorrelationId();
    const { jobId } = req.params;

    try {
      const job = this.activeJobs.get(jobId);
      
      if (!job) {
        res.status(404).json({
          success: false,
          message: 'OCR job not found',
          error: {
            code: 'JOB_NOT_FOUND',
            message: `OCR job with ID ${jobId} not found`
          }
        });
        return;
      }

      const response: OCRResponse = {
        success: true,
        message: 'Job status retrieved',
        data: {
          ocrJobId: jobId,
          correlationId: job.correlationId,
          status: job.status as any,
          processingTime: Date.now() - job.startTime
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Failed to get job status', { correlationId, jobId, error });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve job status',
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * Cancel OCR job
   */
  async cancelJob(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string || this.generateCorrelationId();
    const { jobId } = req.params;

    try {
      const job = this.activeJobs.get(jobId);
      
      if (!job) {
        res.status(404).json({
          success: false,
          message: 'OCR job not found',
          error: {
            code: 'JOB_NOT_FOUND',
            message: `OCR job with ID ${jobId} not found`
          }
        });
        return;
      }

      if (job.status === 'completed' || job.status === 'failed') {
        res.status(400).json({
          success: false,
          message: 'Cannot cancel completed or failed job',
          error: {
            code: 'INVALID_JOB_STATUS',
            message: `Job status is ${job.status}`
          }
        });
        return;
      }

      // Update job status
      job.status = 'cancelled';
      
      res.json({
        success: true,
        message: 'OCR job cancelled',
        data: {
          ocrJobId: jobId,
          status: 'cancelled'
        }
      });

      logger.info('OCR job cancelled', { correlationId, jobId });

    } catch (error) {
      logger.error('Failed to cancel job', { correlationId, jobId, error });

      res.status(500).json({
        success: false,
        message: 'Failed to cancel job',
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * Get OCR service health
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string || this.generateCorrelationId();

    try {
      const health = await ocrIntegrationService.healthCheck();
      
      res.json({
        success: true,
        message: 'OCR service health check',
        data: {
          ...health,
          activeJobs: this.activeJobs.size,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('OCR health check failed', { correlationId, error });

      res.status(500).json({
        success: false,
        message: 'OCR health check failed',
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  // Private methods

  private async processDocumentAsync(
    ocrJobId: string,
    filePath: string,
    options: OCRProcessingOptions,
    requestData: OCRRequestBody,
    correlationId: string
  ): Promise<void> {
    const job = this.activeJobs.get(ocrJobId);
    if (!job) return;

    try {
      // Update job status
      job.status = 'processing';
      
      // Process document
      const result = await ocrIntegrationService.processDocument(filePath, options);
      
      // Update job status
      job.status = 'completed';
      
      // Save OCR results to database
      await this.saveOCRResults(requestData.documentId, result, correlationId);
      
      // Prepare response
      const response: OCRResponse = {
        success: true,
        message: 'OCR processing completed',
        data: {
          ocrJobId,
          correlationId,
          status: 'completed',
          extractedText: result.postProcessedText || result.ocrResult.text,
          structuredText: result.structuredText,
          confidence: result.ocrResult.confidence,
          qualityScore: result.overallQuality,
          corrections: result.textCorrections,
          processingTime: result.totalProcessingTime,
          engineUsed: result.metadata.engineUsed,
          documentElements: result.documentElements,
          errors: result.errors,
          warnings: result.warnings,
          recommendations: result.processingRecommendations
        }
      };

      // Send response if synchronous
      if (job.res) {
        job.res.json(response);
      }

      // Emit completion event
      this.eventEmitter.emit('job_completed', { jobId: ocrJobId, result: response });
      
      logger.info('OCR processing completed successfully', {
        correlationId,
        ocrJobId,
        processingTime: result.totalProcessingTime,
        qualityScore: result.overallQuality.toFixed(3)
      });

      monitoring.incrementCounter('ocr.jobs.completed', 1);
      monitoring.recordTiming('ocr.jobs.duration', result.totalProcessingTime);

    } catch (error) {
      this.handleProcessingError(ocrJobId, error);
    }
  }

  private handleProcessingError(ocrJobId: string, error: any): void {
    const job = this.activeJobs.get(ocrJobId);
    if (!job) return;

    job.status = 'failed';

    const errorResponse: OCRResponse = {
      success: false,
      message: 'OCR processing failed',
      data: {
        ocrJobId,
        correlationId: job.correlationId,
        status: 'failed',
        processingTime: Date.now() - job.startTime
      },
      error: {
        code: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown processing error',
        details: error
      }
    };

    // Send error response if synchronous
    if (job.res) {
      job.res.status(500).json(errorResponse);
    }

    // Emit error event
    this.eventEmitter.emit('job_failed', { jobId: ocrJobId, error: errorResponse });

    logger.error('OCR processing failed', {
      correlationId: job.correlationId,
      ocrJobId,
      error
    });

    monitoring.incrementCounter('ocr.jobs.failed', 1);
  }

  private handleOCREvent(ocrJobId: string, event: OCRProcessingEvent): void {
    const job = this.activeJobs.get(ocrJobId);
    if (!job) return;

    // Log event
    logger.debug('OCR processing event', {
      ocrJobId,
      correlationId: job.correlationId,
      eventType: event.type,
      eventData: event.data
    });

    // Emit event for real-time updates
    this.eventEmitter.emit('job_event', { jobId: ocrJobId, event });
  }

  private async validateOCRRequest(
    body: any, 
    correlationId: string
  ): Promise<{ isValid: boolean; error?: string; details?: any }> {
    const errors: string[] = [];

    // Required fields
    if (!body.documentId) {
      errors.push('documentId is required');
    }

    // Optional field validation
    if (body.priority !== undefined && (typeof body.priority !== 'number' || body.priority < 1 || body.priority > 10)) {
      errors.push('priority must be a number between 1 and 10');
    }

    if (body.qualityThreshold !== undefined && (typeof body.qualityThreshold !== 'number' || body.qualityThreshold < 0 || body.qualityThreshold > 1)) {
      errors.push('qualityThreshold must be a number between 0 and 1');
    }

    if (body.maxRetries !== undefined && (typeof body.maxRetries !== 'number' || body.maxRetries < 0 || body.maxRetries > 5)) {
      errors.push('maxRetries must be a number between 0 and 5');
    }

    if (body.engine && !['tesseract', 'easyocr', 'paddleocr', 'ensemble'].includes(body.engine)) {
      errors.push('engine must be one of: tesseract, easyocr, paddleocr, ensemble');
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join(', ') : undefined,
      details: errors
    };
  }

  private async saveOCRResults(
    documentId: string, 
    result: any, 
    correlationId: string
  ): Promise<void> {
    // Save OCR results to database
    // Implementation would depend on the database schema
    logger.debug('Saving OCR results to database', { documentId, correlationId });
  }

  private setupEventHandlers(): void {
    this.eventEmitter.on('job_completed', ({ jobId, result }) => {
      logger.info('OCR job completed', { jobId });
      // Clean up completed job after some time
      setTimeout(() => this.activeJobs.delete(jobId), 300000); // 5 minutes
    });

    this.eventEmitter.on('job_failed', ({ jobId, error }) => {
      logger.error('OCR job failed', { jobId, error });
      // Clean up failed job after some time
      setTimeout(() => this.activeJobs.delete(jobId), 300000); // 5 minutes
    });
  }

  private mapEngineString(engine?: string): any {
    const engineMap = {
      'tesseract': 'tesseract',
      'easyocr': 'easyocr', 
      'paddleocr': 'paddleocr',
      'ensemble': ['tesseract', 'easyocr', 'paddleocr']
    };
    
    return engine ? engineMap[engine as keyof typeof engineMap] : 'tesseract';
  }

  private estimateProcessingTime(documentInfo: any): number {
    // Estimate based on file size, document type, etc.
    const baseTime = 5000; // 5 seconds base
    const sizeMultiplier = Math.max(1, documentInfo.fileSize / (1024 * 1024)); // Per MB
    return Math.round(baseTime * sizeMultiplier);
  }

  private generateCorrelationId(): string {
    return `ocr_ctrl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOCRJobId(): string {
    return `ocr_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const ocrController = new OCRController();