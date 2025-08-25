import Bull from 'bull';
import { config } from '../config';
import { AppDataSource } from '../database/connection';
import { DocumentUpload, ProcessingStatus } from '../models/document-upload.entity';
import { ExtractedOrder } from '../models/extracted-order.entity';
import { DocumentClassifierService } from '../services/document-classifier.service';
import { ImagePreprocessorService } from '../services/image-preprocessor.service';
import { UploadService } from '../services/upload.service';
import * as winston from 'winston';
import path from 'path';
import fs from 'fs/promises';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/document-processor.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

interface ProcessingJob {
  documentId: string;
  priority: number;
  attempt?: number;
}

export class DocumentProcessorWorker {
  private queue: Bull.Queue<ProcessingJob>;
  private classifier: DocumentClassifierService;
  private preprocessor: ImagePreprocessorService;
  private uploadService: UploadService;
  private isProcessing: boolean = false;

  constructor() {
    this.queue = new Bull('document-processing', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
      }
    });

    this.classifier = new DocumentClassifierService();
    this.preprocessor = new ImagePreprocessorService(config.upload.tempDir);
    this.uploadService = new UploadService();

    this.setupWorker();
  }

  private setupWorker(): void {
    // Process jobs from the queue
    this.queue.process(config.processing.queueConcurrency, async (job) => {
      return this.processDocument(job.data);
    });

    // Event handlers
    this.queue.on('completed', (job, result) => {
      logger.info(`Document processing completed`, {
        documentId: job.data.documentId,
        jobId: job.id,
        result
      });
    });

    this.queue.on('failed', (job, error) => {
      logger.error(`Document processing failed`, {
        documentId: job.data.documentId,
        jobId: job.id,
        error: error.message,
        stack: error.stack
      });
    });

    this.queue.on('stalled', (job) => {
      logger.warn(`Document processing stalled`, {
        documentId: job.data.documentId,
        jobId: job.id
      });
    });

    logger.info('Document processor worker initialized', {
      concurrency: config.processing.queueConcurrency
    });
  }

  async processDocument(job: ProcessingJob): Promise<any> {
    const { documentId } = job;
    const startTime = Date.now();
    
    try {
      logger.info(`Starting document processing`, { documentId });
      
      // Get document from database
      const document = await this.uploadService.getDocumentById(documentId);
      
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      if (document.processingStatus !== ProcessingStatus.PENDING) {
        logger.warn(`Document ${documentId} is not in pending status`, {
          currentStatus: document.processingStatus
        });
        return { skipped: true, reason: 'Not in pending status' };
      }

      // Update status to processing
      await this.uploadService.updateProcessingStatus(
        documentId,
        ProcessingStatus.PROCESSING
      );

      // Step 1: Classify the document
      logger.info(`Classifying document ${documentId}`);
      const classificationResult = await this.classifier.classifyDocument(document.filePath);
      
      logger.info(`Document classified`, {
        documentId,
        class: classificationResult.documentClass,
        quality: classificationResult.quality,
        confidence: classificationResult.confidence,
        preprocessingNeeded: classificationResult.preprocessingNeeded
      });

      // Step 2: Preprocess if needed
      let processedImagePath = document.filePath;
      
      if (classificationResult.preprocessingNeeded.length > 0) {
        logger.info(`Preprocessing document ${documentId}`, {
          operations: classificationResult.preprocessingNeeded
        });
        
        const preprocessingResult = await this.preprocessor.preprocessImage(
          document.filePath,
          classificationResult.preprocessingNeeded
        );
        
        processedImagePath = preprocessingResult.processedPath;
        
        logger.info(`Document preprocessed`, {
          documentId,
          improvements: preprocessingResult.improvements,
          processingTime: preprocessingResult.processingTime
        });
      }

      // Step 3: Extract text (placeholder for Phase 3 - OCR)
      logger.info(`Text extraction for document ${documentId} - Phase 3 pending`);
      
      // For now, create a placeholder extracted order with classification results
      const extractedOrder = await this.createExtractedOrder(
        document,
        classificationResult,
        processedImagePath
      );

      // Step 4: Update document status
      await this.uploadService.updateProcessingStatus(
        documentId,
        ProcessingStatus.COMPLETED
      );

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Save processing metrics
      await this.saveProcessingMetrics(
        document,
        classificationResult,
        processingTime
      );

      logger.info(`Document processing completed`, {
        documentId,
        processingTime,
        extractedOrderId: extractedOrder.id
      });

      return {
        success: true,
        documentId,
        extractedOrderId: extractedOrder.id,
        classification: {
          documentClass: classificationResult.documentClass,
          quality: classificationResult.quality,
          confidence: classificationResult.confidence
        },
        processingTime
      };

    } catch (error: any) {
      logger.error(`Error processing document ${documentId}`, {
        error: error.message,
        stack: error.stack
      });

      // Update status to failed
      await this.uploadService.updateProcessingStatus(
        documentId,
        ProcessingStatus.FAILED,
        error.message,
        { stack: error.stack, attempt: job.attempt }
      );

      // Increment retry count
      await this.uploadService.incrementRetryCount(documentId);

      // Re-throw to let Bull handle retry logic
      throw error;
    }
  }

  private async createExtractedOrder(
    document: DocumentUpload,
    classificationResult: any,
    processedImagePath: string
  ): Promise<ExtractedOrder> {
    const extractedOrderRepo = AppDataSource.getRepository(ExtractedOrder);
    
    // Create placeholder extracted data (will be populated in Phase 3)
    const extractedData = {
      storeName: 'Pending OCR Processing',
      storeId: document.storeId,
      orderDate: new Date().toISOString(),
      items: [],
      total: 0,
      rawText: '',
      extractedFields: []
    };

    // Create confidence scores based on classification
    const confidenceScores = {
      overall: classificationResult.confidence,
      fields: {
        documentClass: 1.0,
        quality: 1.0,
        preprocessing: classificationResult.preprocessingNeeded.length > 0 ? 0.8 : 1.0
      },
      factors: {
        ocrConfidence: 0, // Will be set in Phase 3
        patternMatch: 0,
        dataValidation: 0,
        contextualScore: classificationResult.confidence
      }
    };

    const extractedOrder = extractedOrderRepo.create({
      documentId: document.id,
      storeId: document.storeId,
      extractedData,
      confidenceScores,
      documentType: classificationResult.documentClass,
      qualityScore: this.mapQualityToScore(classificationResult.quality),
      ocrEngineUsed: classificationResult.recommendedOCREngine,
      preprocessingApplied: classificationResult.preprocessingNeeded,
      extractionAccuracy: 0, // Will be calculated in Phase 3
      convertedToOrder: false,
      reviewed: false,
      approved: false
    });

    await extractedOrderRepo.save(extractedOrder);
    
    logger.info(`Created extracted order record`, {
      extractedOrderId: extractedOrder.id,
      documentId: document.id
    });

    return extractedOrder;
  }

  private mapQualityToScore(quality: string): number {
    const qualityMap: { [key: string]: number } = {
      'high': 0.9,
      'medium': 0.7,
      'low': 0.5,
      'very_low': 0.3
    };
    return qualityMap[quality] || 0.5;
  }

  private async saveProcessingMetrics(
    document: DocumentUpload,
    classificationResult: any,
    processingTime: number
  ): Promise<void> {
    try {
      // This would save to the ocr_processing_metrics table
      // For now, just log the metrics
      logger.info(`Processing metrics`, {
        documentId: document.id,
        documentType: classificationResult.documentClass,
        qualityScore: this.mapQualityToScore(classificationResult.quality),
        processingTimeMs: processingTime,
        ocrEngineUsed: classificationResult.recommendedOCREngine,
        preprocessingApplied: classificationResult.preprocessingNeeded,
        confidenceAvg: classificationResult.confidence,
        fileSizeKb: document.fileSize / 1024
      });
    } catch (error) {
      logger.error(`Error saving processing metrics`, { error });
    }
  }

  async start(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Document processor worker is already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Document processor worker started');

    // Clean up old temp files periodically
    setInterval(() => {
      this.preprocessor.cleanupTempFiles(3600000); // Clean files older than 1 hour
    }, 600000); // Every 10 minutes
  }

  async stop(): Promise<void> {
    if (!this.isProcessing) {
      logger.warn('Document processor worker is not running');
      return;
    }

    await this.queue.close();
    this.isProcessing = false;
    logger.info('Document processor worker stopped');
  }

  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Document processor worker paused');
  }

  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Document processor worker resumed');
  }

  async getQueueStats(): Promise<any> {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();
    const completed = await this.queue.getCompletedCount();
    const failed = await this.queue.getFailedCount();
    
    return {
      waiting,
      active,
      completed,
      failed,
      isProcessing: this.isProcessing
    };
  }
}