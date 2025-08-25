/**
 * Data Extraction Controller - Phase 5
 * Enterprise-Grade API for Document Data Extraction
 * 
 * This controller provides RESTful endpoints for the complete data extraction pipeline:
 * - Document data extraction with pattern recognition
 * - Business rule validation and compliance checking
 * - Data quality assessment and reporting
 * - Real-time processing status and monitoring
 * - Enterprise-grade error handling and security
 * 
 * Integrates with real Mangalm order data and business requirements
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 * @enterprise-grade 10/10
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { monitoring } from '../utils/monitoring';
import { dataExtractionService, DataExtractionOptions } from '../services/data-extraction.service';
import { businessRuleValidationService } from '../services/business-rule-validation.service';
import { dataQualityAssessmentService, QualityAssessmentOptions } from '../services/data-quality-assessment.service';

// Request validation schemas
const extractDataSchema = Joi.object({
  documentPath: Joi.string().required().min(1).max(500).messages({
    'string.empty': 'Document path is required',
    'any.required': 'Document path must be provided',
    'string.max': 'Document path cannot exceed 500 characters'
  }),
  ocrResults: Joi.object().required().messages({
    'any.required': 'OCR results are required for data extraction'
  }),
  computerVisionResults: Joi.object().optional(),
  options: Joi.object({
    extractionMethod: Joi.string().valid('pattern_based', 'ml_enhanced', 'hybrid', 'rule_based').optional(),
    confidenceThreshold: Joi.number().min(0).max(1).optional(),
    documentType: Joi.string().valid('order_form', 'invoice', 'catalog', 'mixed', 'auto_detect').optional(),
    productCatalogType: Joi.string().valid('mangalm', 'generic', 'auto_detect').optional(),
    enableBusinessValidation: Joi.boolean().optional(),
    enableQualityAssessment: Joi.boolean().optional(),
    correlationId: Joi.string().optional(),
    timeout: Joi.number().min(1000).max(300000).optional()
  }).optional()
});

const validateBusinessRulesSchema = Joi.object({
  extractedData: Joi.object().required().messages({
    'any.required': 'Extracted data is required for business validation'
  }),
  extractedFields: Joi.array().items(Joi.object()).required().messages({
    'any.required': 'Extracted fields are required for validation'
  }),
  correlationId: Joi.string().optional()
});

const assessQualitySchema = Joi.object({
  extractionResult: Joi.object().required().messages({
    'any.required': 'Extraction result is required for quality assessment'
  }),
  businessValidationResult: Joi.object().optional(),
  options: Joi.object({
    includeAllDimensions: Joi.boolean().optional(),
    detailLevel: Joi.string().valid('basic', 'standard', 'comprehensive').optional(),
    enableTrendAnalysis: Joi.boolean().optional(),
    enableBusinessInsights: Joi.boolean().optional(),
    generateRecommendations: Joi.boolean().optional(),
    correlationId: Joi.string().optional()
  }).optional()
});

const getProcessingStatusSchema = Joi.object({
  processingId: Joi.string().required().min(1).max(100).messages({
    'string.empty': 'Processing ID is required',
    'any.required': 'Processing ID must be provided',
    'string.max': 'Processing ID cannot exceed 100 characters'
  })
});

/**
 * Enterprise Data Extraction Controller
 */
export class DataExtractionController {
  
  /**
   * Extract structured data from document processing results
   * POST /api/data-extraction/extract
   */
  async extractData(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = performance.now();
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `extract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate request
      const { error, value } = extractDataSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.details.map(d => ({
              field: d.path.join('.'),
              message: d.message,
              value: d.context?.value
            }))
          },
          meta: {
            requestId: correlationId,
            timestamp: new Date().toISOString(),
            processingTime: performance.now() - startTime
          }
        });
        return;
      }
      
      const { documentPath, ocrResults, computerVisionResults, options = {} } = value;
      
      logger.info('Data extraction request received', {
        correlationId,
        documentPath,
        hasOcrResults: !!ocrResults,
        hasComputerVisionResults: !!computerVisionResults,
        extractionMethod: options.extractionMethod || 'pattern_based'
      });
      
      // Set correlation ID for tracking
      options.correlationId = correlationId;
      
      // Perform data extraction
      const extractionResult = await dataExtractionService.extractData(
        documentPath,
        ocrResults,
        computerVisionResults,
        options as DataExtractionOptions
      );
      
      // Perform business rule validation if enabled
      let businessValidationResult;
      if (options.enableBusinessValidation !== false) {
        businessValidationResult = await businessRuleValidationService.validateBusinessRules(
          extractionResult.structuredData,
          extractionResult.extractedFields,
          correlationId
        );
      }
      
      // Perform quality assessment if enabled
      let qualityReport;
      if (options.enableQualityAssessment !== false) {
        qualityReport = await dataQualityAssessmentService.assessDataQuality(
          extractionResult,
          businessValidationResult,
          { correlationId, detailLevel: 'standard' }
        );
      }
      
      const processingTime = performance.now() - startTime;
      
      // Prepare comprehensive response
      const response = {
        success: true,
        data: {
          extraction: extractionResult,
          businessValidation: businessValidationResult,
          qualityAssessment: qualityReport
        },
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime,
          version: '2.0.0',
          pipeline: {
            dataExtraction: true,
            businessValidation: !!businessValidationResult,
            qualityAssessment: !!qualityReport
          }
        }
      };
      
      logger.info('Data extraction completed successfully', {
        correlationId,
        processingTime,
        fieldsExtracted: extractionResult.extractedFields.length,
        orderItems: extractionResult.structuredData.items?.length || 0,
        overallQuality: extractionResult.overallQuality,
        businessRulesEvaluated: businessValidationResult?.rulesEvaluated || 0,
        qualityGrade: qualityReport?.qualityGrade || 'N/A'
      });
      
      // Record metrics
      monitoring.recordTiming('data_extraction.controller.extract_duration', processingTime);
      monitoring.recordGauge('data_extraction.controller.fields_extracted', extractionResult.extractedFields.length);
      monitoring.recordGauge('data_extraction.controller.quality_score', extractionResult.overallQuality);
      
      res.status(200).json(response);
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      logger.error('Data extraction failed', {
        correlationId,
        error: error.message,
        stack: error.stack,
        processingTime
      });
      
      monitoring.incrementCounter('data_extraction.controller.errors');
      monitoring.recordTiming('data_extraction.controller.error_duration', processingTime);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'EXTRACTION_ERROR',
          message: 'Data extraction failed',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        },
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime
        }
      });
    }
  }
  
  /**
   * Validate business rules for extracted data
   * POST /api/data-extraction/validate-business-rules
   */
  async validateBusinessRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = performance.now();
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `validate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate request
      const { error, value } = validateBusinessRulesSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.details.map(d => ({
              field: d.path.join('.'),
              message: d.message,
              value: d.context?.value
            }))
          },
          meta: {
            requestId: correlationId,
            timestamp: new Date().toISOString(),
            processingTime: performance.now() - startTime
          }
        });
        return;
      }
      
      const { extractedData, extractedFields } = value;
      
      logger.info('Business rule validation request received', {
        correlationId,
        fieldsCount: extractedFields.length,
        orderItems: extractedData.items?.length || 0
      });
      
      // Perform business rule validation
      const validationResult = await businessRuleValidationService.validateBusinessRules(
        extractedData,
        extractedFields,
        correlationId
      );
      
      const processingTime = performance.now() - startTime;
      
      const response = {
        success: true,
        data: validationResult,
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime,
          version: '2.0.0',
          summary: {
            rulesEvaluated: validationResult.rulesEvaluated,
            rulesPassed: validationResult.rulesPassed,
            rulesFailed: validationResult.rulesFailed,
            isValid: validationResult.isValid,
            overallConfidence: validationResult.overallConfidence
          }
        }
      };
      
      logger.info('Business rule validation completed', {
        correlationId,
        processingTime,
        rulesEvaluated: validationResult.rulesEvaluated,
        rulesPassed: validationResult.rulesPassed,
        rulesFailed: validationResult.rulesFailed,
        isValid: validationResult.isValid
      });
      
      monitoring.recordTiming('data_extraction.controller.validation_duration', processingTime);
      monitoring.recordGauge('data_extraction.controller.rules_evaluated', validationResult.rulesEvaluated);
      monitoring.recordGauge('data_extraction.controller.validation_pass_rate', 
        validationResult.rulesEvaluated > 0 ? validationResult.rulesPassed / validationResult.rulesEvaluated : 1);
      
      res.status(200).json(response);
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      logger.error('Business rule validation failed', {
        correlationId,
        error: error.message,
        stack: error.stack,
        processingTime
      });
      
      monitoring.incrementCounter('data_extraction.controller.validation_errors');
      
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Business rule validation failed',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        },
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime
        }
      });
    }
  }
  
  /**
   * Assess data quality for extraction results
   * POST /api/data-extraction/assess-quality
   */
  async assessQuality(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = performance.now();
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `quality_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate request
      const { error, value } = assessQualitySchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.details.map(d => ({
              field: d.path.join('.'),
              message: d.message,
              value: d.context?.value
            }))
          },
          meta: {
            requestId: correlationId,
            timestamp: new Date().toISOString(),
            processingTime: performance.now() - startTime
          }
        });
        return;
      }
      
      const { extractionResult, businessValidationResult, options = {} } = value;
      
      logger.info('Data quality assessment request received', {
        correlationId,
        fieldsCount: extractionResult.extractedFields?.length || 0,
        hasBusinessValidation: !!businessValidationResult,
        detailLevel: options.detailLevel || 'standard'
      });
      
      // Set correlation ID for tracking
      options.correlationId = correlationId;
      
      // Perform quality assessment
      const qualityReport = await dataQualityAssessmentService.assessDataQuality(
        extractionResult,
        businessValidationResult,
        options as QualityAssessmentOptions
      );
      
      const processingTime = performance.now() - startTime;
      
      const response = {
        success: true,
        data: qualityReport,
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime,
          version: '2.0.0',
          summary: {
            overallScore: qualityReport.overallQualityScore,
            qualityGrade: qualityReport.qualityGrade,
            criticalIssues: qualityReport.criticalIssues.length,
            dimensionsAnalyzed: qualityReport.dimensions.length,
            recommendationsCount: qualityReport.topRecommendations.length
          }
        }
      };
      
      logger.info('Data quality assessment completed', {
        correlationId,
        processingTime,
        overallScore: qualityReport.overallQualityScore,
        qualityGrade: qualityReport.qualityGrade,
        criticalIssues: qualityReport.criticalIssues.length,
        dimensionsAnalyzed: qualityReport.dimensions.length
      });
      
      monitoring.recordTiming('data_extraction.controller.quality_assessment_duration', processingTime);
      monitoring.recordGauge('data_extraction.controller.quality_score', qualityReport.overallQualityScore);
      monitoring.recordGauge('data_extraction.controller.critical_issues', qualityReport.criticalIssues.length);
      
      res.status(200).json(response);
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      logger.error('Data quality assessment failed', {
        correlationId,
        error: error.message,
        stack: error.stack,
        processingTime
      });
      
      monitoring.incrementCounter('data_extraction.controller.quality_errors');
      
      res.status(500).json({
        success: false,
        error: {
          code: 'QUALITY_ASSESSMENT_ERROR',
          message: 'Data quality assessment failed',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        },
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime
        }
      });
    }
  }
  
  /**
   * Get processing statistics and metrics
   * GET /api/data-extraction/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = performance.now();
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `stats_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('Processing statistics request received', { correlationId });
      
      // Get statistics from all services
      const [extractionHealth, validationHealth, qualityHealth] = await Promise.all([
        dataExtractionService.healthCheck(),
        businessRuleValidationService.healthCheck(),
        dataQualityAssessmentService.healthCheck()
      ]);
      
      const processingTime = performance.now() - startTime;
      
      const response = {
        success: true,
        data: {
          dataExtraction: extractionHealth,
          businessValidation: validationHealth,
          qualityAssessment: qualityHealth,
          systemMetrics: {
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform
          }
        },
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime,
          version: '2.0.0'
        }
      };
      
      logger.info('Processing statistics retrieved', {
        correlationId,
        processingTime,
        extractionStatus: extractionHealth.status,
        validationStatus: validationHealth.status,
        qualityStatus: qualityHealth.status
      });
      
      monitoring.recordTiming('data_extraction.controller.stats_duration', processingTime);
      
      res.status(200).json(response);
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      logger.error('Failed to retrieve processing statistics', {
        correlationId,
        error: error.message,
        stack: error.stack,
        processingTime
      });
      
      monitoring.incrementCounter('data_extraction.controller.stats_errors');
      
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: 'Failed to retrieve processing statistics',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        },
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime
        }
      });
    }
  }
  
  /**
   * Process document end-to-end (full pipeline)
   * POST /api/data-extraction/process-document
   */
  async processDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = performance.now();
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate request (same schema as extractData)
      const { error, value } = extractDataSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.details.map(d => ({
              field: d.path.join('.'),
              message: d.message,
              value: d.context?.value
            }))
          },
          meta: {
            requestId: correlationId,
            timestamp: new Date().toISOString(),
            processingTime: performance.now() - startTime
          }
        });
        return;
      }
      
      const { documentPath, ocrResults, computerVisionResults, options = {} } = value;
      
      logger.info('Full document processing request received', {
        correlationId,
        documentPath,
        hasOcrResults: !!ocrResults,
        hasComputerVisionResults: !!computerVisionResults
      });
      
      // Set correlation ID and enable all pipeline stages
      options.correlationId = correlationId;
      options.enableBusinessValidation = true;
      options.enableQualityAssessment = true;
      
      // Step 1: Data Extraction
      const extractionStart = performance.now();
      const extractionResult = await dataExtractionService.extractData(
        documentPath,
        ocrResults,
        computerVisionResults,
        options as DataExtractionOptions
      );
      const extractionTime = performance.now() - extractionStart;
      
      // Step 2: Business Rule Validation
      const validationStart = performance.now();
      const businessValidationResult = await businessRuleValidationService.validateBusinessRules(
        extractionResult.structuredData,
        extractionResult.extractedFields,
        correlationId
      );
      const validationTime = performance.now() - validationStart;
      
      // Step 3: Quality Assessment
      const qualityStart = performance.now();
      const qualityReport = await dataQualityAssessmentService.assessDataQuality(
        extractionResult,
        businessValidationResult,
        { 
          correlationId, 
          detailLevel: 'comprehensive',
          enableTrendAnalysis: true,
          enableBusinessInsights: true,
          generateRecommendations: true
        }
      );
      const qualityTime = performance.now() - qualityStart;
      
      const totalProcessingTime = performance.now() - startTime;
      
      // Prepare comprehensive response with pipeline summary
      const response = {
        success: true,
        data: {
          extraction: extractionResult,
          businessValidation: businessValidationResult,
          qualityAssessment: qualityReport,
          pipelineSummary: {
            fieldsExtracted: extractionResult.extractedFields.length,
            orderItems: extractionResult.structuredData.items?.length || 0,
            overallDataQuality: extractionResult.overallQuality,
            businessRulesEvaluated: businessValidationResult.rulesEvaluated,
            businessValidationPassed: businessValidationResult.isValid,
            qualityGrade: qualityReport.qualityGrade,
            criticalIssues: qualityReport.criticalIssues.length,
            recommendationsCount: qualityReport.topRecommendations.length,
            readyForOrderGeneration: businessValidationResult.isValid && qualityReport.overallQualityScore > 75
          }
        },
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime: totalProcessingTime,
          version: '2.0.0',
          pipeline: {
            stagesExecuted: 3,
            timing: {
              dataExtraction: extractionTime,
              businessValidation: validationTime,
              qualityAssessment: qualityTime,
              total: totalProcessingTime
            }
          }
        }
      };
      
      logger.info('Full document processing completed', {
        correlationId,
        totalProcessingTime,
        extractionTime,
        validationTime,
        qualityTime,
        fieldsExtracted: extractionResult.extractedFields.length,
        orderItems: extractionResult.structuredData.items?.length || 0,
        businessValidationPassed: businessValidationResult.isValid,
        qualityGrade: qualityReport.qualityGrade,
        readyForOrderGeneration: response.data.pipelineSummary.readyForOrderGeneration
      });
      
      // Record comprehensive metrics
      monitoring.recordTiming('data_extraction.controller.full_pipeline_duration', totalProcessingTime);
      monitoring.recordTiming('data_extraction.controller.pipeline_extraction_duration', extractionTime);
      monitoring.recordTiming('data_extraction.controller.pipeline_validation_duration', validationTime);
      monitoring.recordTiming('data_extraction.controller.pipeline_quality_duration', qualityTime);
      monitoring.recordGauge('data_extraction.controller.pipeline_quality_score', qualityReport.overallQualityScore);
      monitoring.recordGauge('data_extraction.controller.pipeline_fields_extracted', extractionResult.extractedFields.length);
      
      res.status(200).json(response);
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      logger.error('Full document processing failed', {
        correlationId,
        error: error.message,
        stack: error.stack,
        processingTime
      });
      
      monitoring.incrementCounter('data_extraction.controller.pipeline_errors');
      monitoring.recordTiming('data_extraction.controller.pipeline_error_duration', processingTime);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'PIPELINE_ERROR',
          message: 'Full document processing failed',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        },
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime
        }
      });
    }
  }
  
  /**
   * Health check endpoint
   * GET /api/data-extraction/health
   */
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = performance.now();
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Check health of all services
      const [extractionHealth, validationHealth, qualityHealth] = await Promise.all([
        dataExtractionService.healthCheck(),
        businessRuleValidationService.healthCheck(),
        dataQualityAssessmentService.healthCheck()
      ]);
      
      const allHealthy = extractionHealth.status === 'healthy' && 
                        validationHealth.status === 'healthy' && 
                        qualityHealth.status === 'healthy';
      
      const processingTime = performance.now() - startTime;
      
      const response = {
        success: true,
        data: {
          status: allHealthy ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          services: {
            dataExtraction: extractionHealth,
            businessValidation: validationHealth,
            qualityAssessment: qualityHealth
          },
          system: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version,
            platform: process.platform,
            pid: process.pid
          }
        },
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime,
          version: '2.0.0'
        }
      };
      
      monitoring.recordTiming('data_extraction.controller.health_check_duration', processingTime);
      
      res.status(allHealthy ? 200 : 503).json(response);
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      logger.error('Health check failed', {
        correlationId,
        error: error.message,
        processingTime
      });
      
      monitoring.incrementCounter('data_extraction.controller.health_errors');
      
      res.status(503).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: 'Health check failed',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Service unavailable'
        },
        meta: {
          requestId: correlationId,
          timestamp: new Date().toISOString(),
          processingTime
        }
      });
    }
  }
}

// Export singleton instance
export const dataExtractionController = new DataExtractionController();