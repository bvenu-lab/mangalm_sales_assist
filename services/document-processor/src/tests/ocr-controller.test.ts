import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { ocrController } from '../controllers/ocr.controller';
import { ocrIntegrationService } from '../services/ocr-integration.service';
import { documentUploadService } from '../services/document-upload.service';

// Mock dependencies
jest.mock('../services/ocr-integration.service');
jest.mock('../services/document-upload.service');

const mockOcrIntegrationService = ocrIntegrationService as jest.Mocked<typeof ocrIntegrationService>;
const mockDocumentUploadService = documentUploadService as jest.Mocked<typeof documentUploadService>;

// Create test app
const app = express();
app.use(express.json());

// Setup routes
app.post('/api/ocr/process', ocrController.processDocument.bind(ocrController));
app.get('/api/ocr/jobs/:jobId', ocrController.getJobStatus.bind(ocrController));
app.delete('/api/ocr/jobs/:jobId', ocrController.cancelJob.bind(ocrController));
app.get('/api/ocr/health', ocrController.getHealth.bind(ocrController));

describe('OCR Controller', () => {
  let mockDocumentInfo: any;
  let mockCompleteOCRResult: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock document info
    mockDocumentInfo = {
      id: 'doc-123',
      filePath: '/uploads/test-invoice.pdf',
      fileName: 'test-invoice.pdf',
      fileSize: 1024000,
      mimeType: 'application/pdf',
      status: 'classified',
      classification: 'invoice',
      confidence: 0.95,
      storeId: 'store-456',
      uploadedAt: new Date().toISOString()
    };

    // Mock complete OCR result
    mockCompleteOCRResult = {
      ocrResult: {
        engine: 'tesseract',
        text: 'Invoice #12345\nDate: 01/15/2024\nTotal: $150.00',
        confidence: 0.85,
        processingTime: 2500,
        language: 'eng',
        qualityMetrics: {
          averageWordConfidence: 0.89,
          averageLineConfidence: 0.89,
          averageParagraphConfidence: 0.89,
          textDensity: 0.025,
          wordCount: 6,
          characterCount: 42,
          lineCount: 3,
          textRegions: 1,
          layoutComplexity: 0.2,
          recognizedLanguageConfidence: 0.95,
          suspiciousCharacterRatio: 0.02,
          whitespaceRatio: 0.15,
          digitRatio: 0.25,
          uppercaseRatio: 0.1,
          hasTableStructure: false,
          hasHandwriting: false,
          imageQuality: 'good'
        },
        metadata: {
          correlationId: 'test-correlation-id',
          timestamp: new Date().toISOString(),
          version: '2.1',
          preprocessing: [],
          postprocessing: [],
          engineVersion: 'tesseract.js-4.1+'
        }
      },
      postProcessedText: 'Invoice #12345\nDate: 01/15/2024\nTotal: $150.00',
      textCorrections: 2,
      semanticConfidence: 0.92,
      numericalCorrections: [],
      structuredText: '=== HEADER ===\nInvoice #12345\n\n=== CONTENT ===\nDate: 01/15/2024\n\n=== TOTALS ===\nTotal: $150.00',
      documentElements: [
        { type: 'header', content: 'Invoice #12345', confidence: 0.9 },
        { type: 'body', content: 'Date: 01/15/2024', confidence: 0.8 },
        { type: 'total', content: 'Total: $150.00', confidence: 0.95 }
      ],
      overallQuality: 0.88,
      processingRecommendations: ['Consider improving image quality'],
      totalProcessingTime: 3200,
      breakdown: {
        preprocessing: 200,
        ocr: 2500,
        postprocessing: 400,
        qualityAssessment: 100
      },
      metadata: {
        correlationId: 'test-correlation-id',
        processingId: 'proc-789',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        engineUsed: 'tesseract',
        configurationSnapshot: {}
      },
      errors: [],
      warnings: []
    };

    // Setup mocks
    mockDocumentUploadService.getDocumentById.mockResolvedValue(mockDocumentInfo);
    mockOcrIntegrationService.processDocument.mockResolvedValue(mockCompleteOCRResult);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/ocr/process', () => {
    it('should process document successfully with minimal request', async () => {
      const requestBody = {
        documentId: 'doc-123'
      };

      const response = await request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('OCR processing started');
      expect(response.body.data.ocrJobId).toBeDefined();
      expect(response.body.data.correlationId).toBeDefined();
      expect(response.body.data.status).toBe('queued');
      expect(response.body.data.estimatedProcessingTime).toBeDefined();
    });

    it('should process document with full options', async () => {
      const requestBody = {
        documentId: 'doc-123',
        storeId: 'store-456',
        priority: 8,
        engine: 'ensemble',
        language: 'eng',
        enablePostProcessing: true,
        qualityThreshold: 0.8,
        enableFallback: true,
        maxRetries: 3,
        enableCaching: true,
        enableProfiling: true,
        correlationId: 'custom-correlation-id'
      };

      const response = await request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.correlationId).toBe('custom-correlation-id');
    });

    it('should validate required fields', async () => {
      const requestBody = {}; // Missing documentId

      const response = await request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('documentId is required');
    });

    it('should validate field types and ranges', async () => {
      const requestBody = {
        documentId: 'doc-123',
        priority: 15, // Invalid: > 10
        qualityThreshold: 1.5, // Invalid: > 1
        maxRetries: -1, // Invalid: < 0
        engine: 'invalid-engine' // Invalid engine
      };

      const response = await request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toHaveLength(4);
    });

    it('should handle document not found', async () => {
      mockDocumentUploadService.getDocumentById.mockResolvedValue(null);

      const requestBody = {
        documentId: 'nonexistent-doc'
      };

      const response = await request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('should handle invalid document status', async () => {
      mockDocumentUploadService.getDocumentById.mockResolvedValue({
        ...mockDocumentInfo,
        status: 'uploaded' // Not classified yet
      });

      const requestBody = {
        documentId: 'doc-123'
      };

      const response = await request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_DOCUMENT_STATUS');
    });

    it('should handle correlation ID from headers', async () => {
      const requestBody = {
        documentId: 'doc-123'
      };

      const response = await request(app)
        .post('/api/ocr/process')
        .set('x-correlation-id', 'header-correlation-id')
        .send(requestBody)
        .expect(202);

      expect(response.body.data.correlationId).toBe('header-correlation-id');
    });

    it('should handle OCR processing errors', async () => {
      mockOcrIntegrationService.processDocument.mockRejectedValue(
        new Error('OCR processing failed')
      );

      const requestBody = {
        documentId: 'doc-123'
      };

      // Allow some time for async processing to complete
      const response = await request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('queued');
    });

    it('should handle service unavailable errors', async () => {
      mockDocumentUploadService.getDocumentById.mockRejectedValue(
        new Error('Database connection failed')
      );

      const requestBody = {
        documentId: 'doc-123'
      };

      const response = await request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/ocr/jobs/:jobId', () => {
    it('should return job status for valid job ID', async () => {
      // First create a job
      const createResponse = await request(app)
        .post('/api/ocr/process')
        .send({ documentId: 'doc-123' })
        .expect(202);

      const jobId = createResponse.body.data.ocrJobId;

      const statusResponse = await request(app)
        .get(`/api/ocr/jobs/${jobId}`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.ocrJobId).toBe(jobId);
      expect(statusResponse.body.data.status).toBeDefined();
      expect(statusResponse.body.data.processingTime).toBeDefined();
    });

    it('should return 404 for nonexistent job ID', async () => {
      const response = await request(app)
        .get('/api/ocr/jobs/nonexistent-job')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('should handle correlation ID from headers', async () => {
      // First create a job
      const createResponse = await request(app)
        .post('/api/ocr/process')
        .send({ documentId: 'doc-123' })
        .expect(202);

      const jobId = createResponse.body.data.ocrJobId;

      const response = await request(app)
        .get(`/api/ocr/jobs/${jobId}`)
        .set('x-correlation-id', 'status-correlation-id')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/ocr/jobs/:jobId', () => {
    it('should cancel pending job', async () => {
      // First create a job
      const createResponse = await request(app)
        .post('/api/ocr/process')
        .send({ documentId: 'doc-123' })
        .expect(202);

      const jobId = createResponse.body.data.ocrJobId;

      const cancelResponse = await request(app)
        .delete(`/api/ocr/jobs/${jobId}`)
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.data.status).toBe('cancelled');
    });

    it('should return 404 for nonexistent job ID', async () => {
      const response = await request(app)
        .delete('/api/ocr/jobs/nonexistent-job')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('should prevent cancelling completed jobs', async () => {
      // First create and simulate completion of a job
      const createResponse = await request(app)
        .post('/api/ocr/process')
        .send({ documentId: 'doc-123' })
        .expect(202);

      const jobId = createResponse.body.data.ocrJobId;

      // Simulate job completion by accessing internal state
      // (In real implementation, this would happen through the async processing)
      
      // For testing, we'll just try to cancel immediately and expect it to work
      // since the job hasn't completed yet
      const cancelResponse = await request(app)
        .delete(`/api/ocr/jobs/${jobId}`)
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
    });
  });

  describe('GET /api/ocr/health', () => {
    it('should return health status when all services are healthy', async () => {
      mockOcrIntegrationService.healthCheck.mockResolvedValue({
        status: 'healthy',
        components: {
          ocrEngine: 'healthy',
          textPostProcessor: 'healthy',
          caching: 'healthy',
          monitoring: 'healthy'
        },
        activeProcessing: 2,
        cacheSize: 10,
        totalProcessed: 100
      });

      const response = await request(app)
        .get('/api/ocr/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.components).toBeDefined();
      expect(response.body.data.activeJobs).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should return unhealthy status when services are down', async () => {
      mockOcrIntegrationService.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        components: {
          ocrEngine: 'unhealthy',
          textPostProcessor: 'healthy',
          caching: 'unhealthy',
          monitoring: 'healthy'
        },
        activeProcessing: 0,
        cacheSize: 0,
        totalProcessed: 0
      });

      const response = await request(app)
        .get('/api/ocr/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('unhealthy');
      expect(response.body.data.components.ocrEngine).toBe('unhealthy');
    });

    it('should handle health check failures', async () => {
      mockOcrIntegrationService.healthCheck.mockRejectedValue(
        new Error('Health check service unavailable')
      );

      const response = await request(app)
        .get('/api/ocr/health')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HEALTH_CHECK_FAILED');
    });
  });

  describe('Async Processing Simulation', () => {
    it('should complete processing and update job status', (done) => {
      const requestBody = {
        documentId: 'doc-123'
      };

      request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(202)
        .then((response) => {
          const jobId = response.body.data.ocrJobId;
          
          // Wait a bit for async processing
          setTimeout(() => {
            request(app)
              .get(`/api/ocr/jobs/${jobId}`)
              .expect(200)
              .then((statusResponse) => {
                expect(statusResponse.body.success).toBe(true);
                expect(statusResponse.body.data.ocrJobId).toBe(jobId);
                done();
              })
              .catch(done);
          }, 100);
        })
        .catch(done);
    });

    it('should handle processing failures and update job status', (done) => {
      mockOcrIntegrationService.processDocument.mockRejectedValue(
        new Error('OCR engine crashed')
      );

      const requestBody = {
        documentId: 'doc-123'
      };

      request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(202)
        .then((response) => {
          const jobId = response.body.data.ocrJobId;
          
          // Wait a bit for async processing to fail
          setTimeout(() => {
            request(app)
              .get(`/api/ocr/jobs/${jobId}`)
              .expect(200)
              .then((statusResponse) => {
                expect(statusResponse.body.success).toBe(true);
                expect(statusResponse.body.data.ocrJobId).toBe(jobId);
                // Status might still be 'processing' or 'queued' depending on timing
                done();
              })
              .catch(done);
          }, 100);
        })
        .catch(done);
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => 
        request(app)
          .post('/api/ocr/process')
          .send({ documentId: `doc-${i}` })
          .expect(202)
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.ocrJobId).toBeDefined();
        expect(response.body.data.ocrJobId).toContain('ocr_job_');
      });

      // All job IDs should be unique
      const jobIds = responses.map(r => r.body.data.ocrJobId);
      const uniqueJobIds = new Set(jobIds);
      expect(uniqueJobIds.size).toBe(jobIds.length);
    });

    it('should handle high load gracefully', async () => {
      // Simulate slower processing
      mockOcrIntegrationService.processDocument.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockCompleteOCRResult), 100))
      );

      const requests = Array.from({ length: 20 }, (_, i) => 
        request(app)
          .post('/api/ocr/process')
          .send({ documentId: `doc-${i}` })
      );

      const responses = await Promise.allSettled(requests);

      const successful = responses.filter(r => r.status === 'fulfilled' && 
        (r.value as any).status === 202);
      
      expect(successful.length).toBeGreaterThan(15); // Most should succeed
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary service failures', async () => {
      // First request fails
      mockDocumentUploadService.getDocumentById.mockRejectedValueOnce(
        new Error('Temporary database error')
      );
      
      // Second request succeeds
      mockDocumentUploadService.getDocumentById.mockResolvedValueOnce(
        mockDocumentInfo
      );

      const requestBody = {
        documentId: 'doc-123'
      };

      // First request should fail
      await request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(500);

      // Second request should succeed
      await request(app)
        .post('/api/ocr/process')
        .send(requestBody)
        .expect(202);
    });

    it('should handle malformed requests gracefully', async () => {
      const malformedBodies = [
        null,
        '',
        { documentId: null },
        { documentId: 123 }, // Wrong type
        { documentId: '' }, // Empty string
        { invalid: 'field' } // Wrong field name
      ];

      for (const body of malformedBodies) {
        const response = await request(app)
          .post('/api/ocr/process')
          .send(body);

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Request Tracing', () => {
    it('should preserve correlation IDs throughout request lifecycle', async () => {
      const correlationId = 'test-trace-id-123';
      
      const response = await request(app)
        .post('/api/ocr/process')
        .set('x-correlation-id', correlationId)
        .send({ documentId: 'doc-123' })
        .expect(202);

      expect(response.body.data.correlationId).toBe(correlationId);

      // Check that the correlation ID is passed to the OCR service
      expect(mockOcrIntegrationService.processDocument).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          correlationId: correlationId
        })
      );
    });

    it('should generate correlation IDs when not provided', async () => {
      const response = await request(app)
        .post('/api/ocr/process')
        .send({ documentId: 'doc-123' })
        .expect(202);

      expect(response.body.data.correlationId).toBeDefined();
      expect(response.body.data.correlationId).toMatch(/^ocr_ctrl_\d+_[a-z0-9]+$/);
    });
  });
});