import { ocrEngineService, OCROptions, OCRResult, EnsembleResult, OCREngine } from './ocr-engine.service';
import { textPostProcessorService, TextPostprocessingOptions } from './text-postprocessor.service';
import { configManager } from '../config';
import { monitoring } from './monitoring.service';
import { transactionService } from './transaction.service';
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
        filename: path.join(path.dirname(config.logging.file), 'ocr-integration.log'),
        maxsize: config.logging.maxFileSize,
        maxFiles: config.logging.maxFiles
      })
    ] : [])
  ]
});

export interface OCRProcessingOptions extends OCROptions {
  enablePostProcessing?: boolean;
  postProcessingOptions?: TextPostprocessingOptions;
  qualityThreshold?: number; // Minimum quality score to accept results
  enableFallback?: boolean; // Use alternative engines if primary fails
  maxRetries?: number;
  enableCaching?: boolean;
  enableProfiling?: boolean;
  notificationCallback?: (event: OCRProcessingEvent) => void;
}

export interface OCRProcessingEvent {
  type: 'started' | 'engine_selected' | 'preprocessing' | 'ocr_completed' | 'postprocessing' | 'completed' | 'error' | 'warning';
  correlationId: string;
  timestamp: string;
  data?: any;
  error?: Error;
}

export interface CompleteOCRResult {
  // Core OCR results
  ocrResult: OCRResult | EnsembleResult;
  
  // Post-processing results
  postProcessedText?: string;
  textCorrections?: number;
  semanticConfidence?: number;
  numericalCorrections?: any[];
  structuredText?: string;
  documentElements?: any[];
  
  // Quality assessment
  overallQuality: number; // 0-1 comprehensive quality score
  processingRecommendations: string[];
  
  // Performance metrics
  totalProcessingTime: number;
  breakdown: {
    preprocessing: number;
    ocr: number;
    postprocessing: number;
    qualityAssessment: number;
  };
  
  // Enterprise metadata
  metadata: {
    correlationId: string;
    processingId: string;
    timestamp: string;
    version: string;
    engineUsed: OCREngine | 'ensemble';
    configurationSnapshot: any;
    performanceProfile?: any;
  };
  
  // Error handling
  errors: Array<{
    stage: 'preprocessing' | 'ocr' | 'postprocessing' | 'quality';
    error: Error;
    severity: 'warning' | 'error' | 'critical';
    recoveryAction?: string;
  }>;
  
  warnings: Array<{
    stage: string;
    message: string;
    impact: 'low' | 'medium' | 'high';
  }>;
}

export class OCRIntegrationService extends EventEmitter {
  private static instance: OCRIntegrationService;
  private processingCache: Map<string, CompleteOCRResult> = new Map();
  private activeProcessing: Map<string, Promise<CompleteOCRResult>> = new Map();
  private performanceProfiles: Map<string, any> = new Map();

  private constructor() {
    super();
    this.initialize();
  }

  public static getInstance(): OCRIntegrationService {
    if (!OCRIntegrationService.instance) {
      OCRIntegrationService.instance = new OCRIntegrationService();
    }
    return OCRIntegrationService.instance;
  }

  private async initialize(): Promise<void> {
    logger.info('Initializing OCR Integration Service');
    
    try {
      // Set up event listeners for monitoring
      this.setupEventHandlers();
      
      // Initialize performance profiling
      this.initializePerformanceProfiling();
      
      logger.info('OCR Integration Service initialized successfully');
      monitoring.incrementCounter('ocr_integration.initialized', 1);
      
    } catch (error) {
      logger.error('Failed to initialize OCR Integration Service', { error });
      monitoring.incrementCounter('ocr_integration.initialization_failed', 1);
      throw error;
    }
  }

  /**
   * Main entry point for complete OCR processing with enterprise features
   */
  async processDocument(
    imagePath: string,
    options: OCRProcessingOptions = {}
  ): Promise<CompleteOCRResult> {
    const correlationId = options.correlationId || this.generateCorrelationId();
    const processingId = this.generateProcessingId();
    const startTime = Date.now();
    
    // Set up processing event
    const emitEvent = (event: Omit<OCRProcessingEvent, 'correlationId' | 'timestamp'>) => {
      const fullEvent: OCRProcessingEvent = {
        ...event,
        correlationId,
        timestamp: new Date().toISOString()
      };
      
      this.emit('processing_event', fullEvent);
      if (options.notificationCallback) {
        options.notificationCallback(fullEvent);
      }
    };

    try {
      logger.info('Starting comprehensive OCR processing', {
        correlationId,
        processingId,
        imagePath,
        options: this.sanitizeOptionsForLogging(options)
      });

      emitEvent({ type: 'started', data: { imagePath, options } });
      monitoring.incrementCounter('ocr_integration.processing.started', 1);

      // Check cache if enabled
      if (options.enableCaching) {
        const cached = await this.checkCache(imagePath, options, correlationId);
        if (cached) {
          logger.info('Returning cached OCR result', { correlationId });
          return cached;
        }
      }

      // Check for concurrent processing of same document
      const activeKey = this.getActiveProcessingKey(imagePath, options);
      if (this.activeProcessing.has(activeKey)) {
        logger.info('Document already being processed, waiting for completion', { correlationId });
        return await this.activeProcessing.get(activeKey)!;
      }

      // Start processing pipeline
      const processingPromise = this.executeProcessingPipeline(
        imagePath, 
        options, 
        correlationId, 
        processingId,
        emitEvent
      );
      
      this.activeProcessing.set(activeKey, processingPromise);
      
      try {
        const result = await processingPromise;
        
        // Cache result if enabled
        if (options.enableCaching) {
          await this.cacheResult(imagePath, options, result, correlationId);
        }
        
        return result;
        
      } finally {
        this.activeProcessing.delete(activeKey);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('OCR processing failed', {
        correlationId,
        processingId,
        error,
        processingTime
      });

      emitEvent({ type: 'error', error: error as Error });
      monitoring.incrementCounter('ocr_integration.processing.failed', 1);
      monitoring.recordTiming('ocr_integration.processing.failed_duration', processingTime);
      
      throw error;
    }
  }

  /**
   * Execute the complete OCR processing pipeline with enterprise error handling
   */
  private async executeProcessingPipeline(
    imagePath: string,
    options: OCRProcessingOptions,
    correlationId: string,
    processingId: string,
    emitEvent: (event: Omit<OCRProcessingEvent, 'correlationId' | 'timestamp'>) => void
  ): Promise<CompleteOCRResult> {
    const pipelineStartTime = Date.now();
    const breakdown = {
      preprocessing: 0,
      ocr: 0,
      postprocessing: 0,
      qualityAssessment: 0
    };
    
    const errors: CompleteOCRResult['errors'] = [];
    const warnings: CompleteOCRResult['warnings'] = [];
    
    let ocrResult: OCRResult | EnsembleResult;
    let postProcessedText: string | undefined;
    let textCorrections: number = 0;
    let semanticConfidence: number | undefined;
    let numericalCorrections: any[] = [];
    let structuredText: string | undefined;
    let documentElements: any[] = [];

    try {
      // Stage 1: OCR Processing with intelligent engine selection
      emitEvent({ type: 'engine_selected', data: { engine: options.engine } });
      
      const ocrStartTime = Date.now();
      try {
        ocrResult = await this.executeOCRWithRetryAndFallback(imagePath, options, correlationId);
        breakdown.ocr = Date.now() - ocrStartTime;
        
        emitEvent({ type: 'ocr_completed', data: { 
          engine: ocrResult.engine,
          confidence: ocrResult.confidence,
          textLength: ocrResult.text.length 
        }});
        
      } catch (error) {
        errors.push({
          stage: 'ocr',
          error: error as Error,
          severity: 'critical',
          recoveryAction: 'Try alternative OCR engine or adjust image preprocessing'
        });
        throw error;
      }

      // Stage 2: Post-processing (if enabled)
      if (options.enablePostProcessing !== false) {
        emitEvent({ type: 'postprocessing' });
        
        const postProcessingStartTime = Date.now();
        try {
          const postProcessingResults = await this.executePostProcessing(
            ocrResult.text, 
            options.postProcessingOptions || {},
            correlationId
          );
          
          postProcessedText = postProcessingResults.correctedText;
          textCorrections = postProcessingResults.textCorrections;
          semanticConfidence = postProcessingResults.semanticConfidence;
          numericalCorrections = postProcessingResults.numericalCorrections;
          structuredText = postProcessingResults.structuredText;
          documentElements = postProcessingResults.documentElements;
          
          breakdown.postprocessing = Date.now() - postProcessingStartTime;
          
        } catch (error) {
          errors.push({
            stage: 'postprocessing',
            error: error as Error,
            severity: 'warning',
            recoveryAction: 'Use raw OCR text without post-processing'
          });
          
          warnings.push({
            stage: 'postprocessing',
            message: 'Post-processing failed, using raw OCR text',
            impact: 'medium'
          });
        }
      }

      // Stage 3: Quality Assessment
      const qualityStartTime = Date.now();
      const qualityAssessment = await this.assessOverallQuality(
        ocrResult,
        postProcessedText,
        semanticConfidence,
        correlationId
      );
      breakdown.qualityAssessment = Date.now() - qualityStartTime;

      // Stage 4: Compile Complete Result
      const totalProcessingTime = Date.now() - pipelineStartTime;
      
      const result: CompleteOCRResult = {
        ocrResult,
        postProcessedText,
        textCorrections,
        semanticConfidence,
        numericalCorrections,
        structuredText,
        documentElements,
        overallQuality: qualityAssessment.score,
        processingRecommendations: qualityAssessment.recommendations,
        totalProcessingTime,
        breakdown,
        metadata: {
          correlationId,
          processingId,
          timestamp: new Date().toISOString(),
          version: '3.0.0',
          engineUsed: ocrResult.engine,
          configurationSnapshot: this.captureConfigurationSnapshot(),
          performanceProfile: options.enableProfiling ? 
            this.capturePerformanceProfile(breakdown) : undefined
        },
        errors,
        warnings
      };

      // Validate quality threshold
      if (options.qualityThreshold && qualityAssessment.score < options.qualityThreshold) {
        warnings.push({
          stage: 'quality',
          message: `Quality score ${qualityAssessment.score.toFixed(3)} below threshold ${options.qualityThreshold}`,
          impact: 'high'
        });
      }

      emitEvent({ type: 'completed', data: { 
        overallQuality: qualityAssessment.score,
        totalProcessingTime,
        errorsCount: errors.length,
        warningsCount: warnings.length
      }});

      logger.info('OCR processing completed successfully', {
        correlationId,
        processingId,
        totalProcessingTime,
        overallQuality: qualityAssessment.score.toFixed(3),
        errorsCount: errors.length,
        warningsCount: warnings.length
      });

      monitoring.recordTiming('ocr_integration.processing.duration', totalProcessingTime);
      monitoring.recordTiming('ocr_integration.processing.ocr_duration', breakdown.ocr);
      monitoring.recordTiming('ocr_integration.processing.postprocessing_duration', breakdown.postprocessing);
      monitoring.incrementCounter('ocr_integration.processing.completed', 1);

      return result;

    } catch (error) {
      errors.push({
        stage: 'ocr',
        error: error as Error,
        severity: 'critical'
      });
      
      throw error;
    }
  }

  /**
   * Execute OCR with retry logic and fallback engines
   */
  private async executeOCRWithRetryAndFallback(
    imagePath: string,
    options: OCRProcessingOptions,
    correlationId: string
  ): Promise<OCRResult | EnsembleResult> {
    const maxRetries = options.maxRetries || 2;
    const enableFallback = options.enableFallback !== false;
    
    let lastError: Error;
    
    // Primary engine attempt
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`OCR attempt ${attempt}/${maxRetries}`, { correlationId });
        
        const result = await ocrEngineService.processDocument(imagePath, options);
        
        logger.info(`OCR succeeded on attempt ${attempt}`, { 
          correlationId, 
          engine: result.engine,
          confidence: result.confidence 
        });
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        logger.warn(`OCR attempt ${attempt} failed`, { 
          correlationId, 
          error: lastError.message 
        });
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Fallback engine attempts if enabled
    if (enableFallback && !Array.isArray(options.engine)) {
      const fallbackEngines = this.getFallbackEngines(options.engine as OCREngine);
      
      for (const fallbackEngine of fallbackEngines) {
        try {
          logger.info(`Attempting fallback engine: ${fallbackEngine}`, { correlationId });
          
          const fallbackOptions = { ...options, engine: fallbackEngine };
          const result = await ocrEngineService.processDocument(imagePath, fallbackOptions);
          
          logger.info(`Fallback engine succeeded`, { 
            correlationId, 
            engine: result.engine,
            confidence: result.confidence 
          });
          
          return result;
          
        } catch (fallbackError) {
          logger.warn(`Fallback engine ${fallbackEngine} failed`, { 
            correlationId, 
            error: (fallbackError as Error).message 
          });
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Execute comprehensive post-processing
   */
  private async executePostProcessing(
    text: string,
    options: TextPostprocessingOptions,
    correlationId: string
  ): Promise<{
    correctedText: string;
    textCorrections: number;
    semanticConfidence: number;
    numericalCorrections: any[];
    structuredText: string;
    documentElements: any[];
  }> {
    // Basic correction
    const basicResult = await textPostProcessorService.processText(text, options, correlationId);
    
    // Semantic analysis
    const semanticResult = await textPostProcessorService.performSemanticAnalysis(
      basicResult.correctedText, 
      options, 
      correlationId
    );
    
    // Numerical validation
    const numericalResult = await textPostProcessorService.validateAndCorrectNumericalData(
      semanticResult.correctedText,
      correlationId
    );
    
    // Document structure reconstruction
    const structureResult = await textPostProcessorService.reconstructDocumentStructure(
      numericalResult.correctedText,
      undefined,
      correlationId
    );
    
    return {
      correctedText: structureResult.structuredText,
      textCorrections: basicResult.corrections.length + semanticResult.contextualCorrections,
      semanticConfidence: semanticResult.semanticConfidence,
      numericalCorrections: numericalResult.numericalCorrections,
      structuredText: structureResult.structuredText,
      documentElements: structureResult.detectedElements
    };
  }

  /**
   * Assess overall quality of OCR processing
   */
  private async assessOverallQuality(
    ocrResult: OCRResult | EnsembleResult,
    postProcessedText?: string,
    semanticConfidence?: number,
    correlationId?: string
  ): Promise<{ score: number; recommendations: string[] }> {
    const recommendations: string[] = [];
    let score = 0;
    
    // OCR quality component (50% weight)
    const ocrQuality = ocrResult.qualityMetrics.averageWordConfidence;
    score += ocrQuality * 0.5;
    
    if (ocrQuality < 0.7) {
      recommendations.push('Consider image preprocessing to improve OCR quality');
    }
    
    // Semantic quality component (25% weight)
    if (semanticConfidence !== undefined) {
      score += semanticConfidence * 0.25;
      
      if (semanticConfidence < 0.6) {
        recommendations.push('Low semantic confidence detected - review text corrections');
      }
    } else {
      recommendations.push('Enable post-processing for semantic analysis');
    }
    
    // Image quality component (15% weight)
    const imageQualityScore = this.mapImageQualityToScore(ocrResult.qualityMetrics.imageQuality);
    score += imageQualityScore * 0.15;
    
    if (imageQualityScore < 0.7) {
      recommendations.push('Improve image quality for better OCR results');
    }
    
    // Layout complexity component (10% weight)
    const layoutScore = 1 - ocrResult.qualityMetrics.layoutComplexity;
    score += layoutScore * 0.1;
    
    if (ocrResult.qualityMetrics.layoutComplexity > 0.7) {
      recommendations.push('Complex document layout detected - consider structure-aware processing');
    }
    
    // Add general recommendations
    if (score < 0.6) {
      recommendations.push('Overall quality is low - consider using ensemble OCR approach');
    }
    
    if (ocrResult.qualityMetrics.hasHandwriting) {
      recommendations.push('Handwriting detected - specialized handwriting OCR may improve results');
    }
    
    return { score: Math.min(1, score), recommendations };
  }

  // Helper methods

  private getFallbackEngines(primaryEngine: OCREngine): OCREngine[] {
    const fallbacks: { [key in OCREngine]?: OCREngine[] } = {
      [OCREngine.TESSERACT]: [OCREngine.EASYOCR, OCREngine.PADDLEOCR],
      [OCREngine.EASYOCR]: [OCREngine.TESSERACT, OCREngine.PADDLEOCR],
      [OCREngine.PADDLEOCR]: [OCREngine.TESSERACT, OCREngine.EASYOCR]
    };
    
    return fallbacks[primaryEngine] || [];
  }

  private mapImageQualityToScore(quality: string): number {
    const qualityMap = {
      'poor': 0.3,
      'fair': 0.6,
      'good': 0.8,
      'excellent': 1.0
    };
    
    return qualityMap[quality as keyof typeof qualityMap] || 0.5;
  }

  private generateCorrelationId(): string {
    return `ocr_integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateProcessingId(): string {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeOptionsForLogging(options: OCRProcessingOptions): any {
    // Remove sensitive data and large objects from logging
    const { notificationCallback, ...safeOptions } = options;
    return safeOptions;
  }

  private getActiveProcessingKey(imagePath: string, options: OCRProcessingOptions): string {
    // Create a key for tracking concurrent processing
    return `${imagePath}_${JSON.stringify(this.sanitizeOptionsForLogging(options))}`;
  }

  private async checkCache(
    imagePath: string, 
    options: OCRProcessingOptions, 
    correlationId: string
  ): Promise<CompleteOCRResult | null> {
    // Implement caching logic based on file hash and options
    // For now, return null (no cache hit)
    return null;
  }

  private async cacheResult(
    imagePath: string,
    options: OCRProcessingOptions,
    result: CompleteOCRResult,
    correlationId: string
  ): Promise<void> {
    // Implement result caching
    // For now, do nothing
  }

  private setupEventHandlers(): void {
    this.on('processing_event', (event: OCRProcessingEvent) => {
      // Log all processing events
      logger.debug('OCR processing event', event);
      
      // Record metrics based on event type
      monitoring.incrementCounter(`ocr_integration.events.${event.type}`, 1);
    });
  }

  private initializePerformanceProfiling(): void {
    // Initialize performance profiling capabilities
    logger.debug('Performance profiling initialized');
  }

  private captureConfigurationSnapshot(): any {
    return {
      timestamp: new Date().toISOString(),
      ocrEngineConfig: 'redacted', // Would include OCR engine configurations
      postProcessingConfig: 'redacted', // Would include post-processing configurations
      systemConfig: 'redacted' // Would include system-level configurations
    };
  }

  private capturePerformanceProfile(breakdown: any): any {
    return {
      breakdown,
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  /**
   * Health check for the OCR integration service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    components: {
      ocrEngine: 'healthy' | 'unhealthy';
      textPostProcessor: 'healthy' | 'unhealthy';
      caching: 'healthy' | 'unhealthy';
      monitoring: 'healthy' | 'unhealthy';
    };
    activeProcessing: number;
    cacheSize: number;
    totalProcessed: number;
  }> {
    try {
      const ocrEngineHealth = await ocrEngineService.healthCheck();
      const textProcessorHealth = await textPostProcessorService.healthCheck();
      
      const components = {
        ocrEngine: ocrEngineHealth.status,
        textPostProcessor: textProcessorHealth.status,
        caching: 'healthy' as const,
        monitoring: 'healthy' as const
      };
      
      const allHealthy = Object.values(components).every(status => status === 'healthy');
      
      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        components,
        activeProcessing: this.activeProcessing.size,
        cacheSize: this.processingCache.size,
        totalProcessed: 0 // Would track total processed documents
      };
      
    } catch (error) {
      logger.error('OCR Integration health check failed', { error });
      
      return {
        status: 'unhealthy',
        components: {
          ocrEngine: 'unhealthy',
          textPostProcessor: 'unhealthy',
          caching: 'unhealthy',
          monitoring: 'unhealthy'
        },
        activeProcessing: 0,
        cacheSize: 0,
        totalProcessed: 0
      };
    }
  }
}

// Export singleton instance
export const ocrIntegrationService = OCRIntegrationService.getInstance();