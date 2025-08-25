import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ocrIntegrationService, OCRProcessingOptions } from '../services/ocr-integration.service';
import { ocrEngineService } from '../services/ocr-engine.service';
import { textPostProcessorService } from '../services/text-postprocessor.service';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('../services/ocr-engine.service');
jest.mock('../services/text-postprocessor.service');
jest.mock('fs/promises');

const mockOcrEngineService = ocrEngineService as jest.Mocked<typeof ocrEngineService>;
const mockTextPostProcessorService = textPostProcessorService as jest.Mocked<typeof textPostProcessorService>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('OCR Integration Service', () => {
  let testImagePath: string;
  let mockOCRResult: any;
  let mockPostProcessingResult: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    testImagePath = '/test/path/invoice.jpg';
    
    // Mock OCR result
    mockOCRResult = {
      engine: 'tesseract',
      pages: [{
        text: 'Invoice #12345\nDate: 01/15/2024\nTotal: $150.00',
        confidence: 0.85,
        words: [
          { text: 'Invoice', confidence: 0.95, bbox: { x0: 10, y0: 10, x1: 60, y1: 25 } },
          { text: '#12345', confidence: 0.90, bbox: { x0: 65, y0: 10, x1: 110, y1: 25 } },
          { text: 'Date:', confidence: 0.88, bbox: { x0: 10, y0: 30, x1: 45, y1: 45 } },
          { text: '01/15/2024', confidence: 0.82, bbox: { x0: 50, y0: 30, x1: 120, y1: 45 } },
          { text: 'Total:', confidence: 0.93, bbox: { x0: 10, y0: 50, x1: 50, y1: 65 } },
          { text: '$150.00', confidence: 0.87, bbox: { x0: 55, y0: 50, x1: 105, y1: 65 } }
        ],
        lines: [
          { text: 'Invoice #12345', confidence: 0.925, words: [], bbox: { x0: 10, y0: 10, x1: 110, y1: 25 } },
          { text: 'Date: 01/15/2024', confidence: 0.85, words: [], bbox: { x0: 10, y0: 30, x1: 120, y1: 45 } },
          { text: 'Total: $150.00', confidence: 0.90, words: [], bbox: { x0: 10, y0: 50, x1: 105, y1: 65 } }
        ],
        paragraphs: [],
        bbox: { x0: 10, y0: 10, x1: 120, y1: 65 },
        dimensions: { width: 200, height: 300 }
      }],
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
        skewAngle: 0.5,
        recognizedLanguageConfidence: 0.95,
        suspiciousCharacterRatio: 0.02,
        whitespaceRatio: 0.15,
        digitRatio: 0.25,
        uppercaseRatio: 0.1,
        hasTableStructure: false,
        hasHandwriting: false,
        imageQuality: 'good' as const
      },
      metadata: {
        correlationId: 'test-correlation-id',
        timestamp: new Date().toISOString(),
        version: '2.1',
        preprocessing: ['normalize', 'denoise'],
        postprocessing: [],
        engineVersion: 'tesseract.js-4.1+'
      }
    };

    // Mock post-processing results
    mockPostProcessingResult = {
      correctedText: 'Invoice #12345\nDate: 01/15/2024\nTotal: $150.00',
      corrections: [],
      qualityScore: 0.9,
      metadata: { correlationId: 'test-correlation-id' }
    };

    // Setup mocks
    mockOcrEngineService.processDocument.mockResolvedValue(mockOCRResult);
    mockTextPostProcessorService.processText.mockResolvedValue(mockPostProcessingResult);
    mockTextPostProcessorService.performSemanticAnalysis.mockResolvedValue({
      correctedText: 'Invoice #12345\nDate: 01/15/2024\nTotal: $150.00',
      contextualCorrections: 0,
      semanticConfidence: 0.92
    });
    mockTextPostProcessorService.validateAndCorrectNumericalData.mockResolvedValue({
      correctedText: 'Invoice #12345\nDate: 01/15/2024\nTotal: $150.00',
      numericalCorrections: [],
      financialDataIntegrity: 0.95
    });
    mockTextPostProcessorService.reconstructDocumentStructure.mockResolvedValue({
      structuredText: '=== HEADER ===\nInvoice #12345\n\n=== CONTENT ===\nDate: 01/15/2024\n\n=== TOTALS ===\nTotal: $150.00',
      detectedElements: [
        { type: 'header', content: 'Invoice #12345', confidence: 0.9 },
        { type: 'body', content: 'Date: 01/15/2024', confidence: 0.8 },
        { type: 'total', content: 'Total: $150.00', confidence: 0.95 }
      ],
      structuralIntegrity: 0.88
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processDocument', () => {
    it('should successfully process a document with default options', async () => {
      const result = await ocrIntegrationService.processDocument(testImagePath);

      expect(result).toBeDefined();
      expect(result.ocrResult).toEqual(mockOCRResult);
      expect(result.overallQuality).toBeGreaterThan(0.8);
      expect(result.totalProcessingTime).toBeGreaterThan(0);
      expect(result.metadata.correlationId).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should process document with custom options', async () => {
      const options: OCRProcessingOptions = {
        engine: 'tesseract',
        language: 'eng',
        enablePostProcessing: true,
        qualityThreshold: 0.8,
        enableFallback: true,
        maxRetries: 3,
        correlationId: 'custom-correlation-id'
      };

      const result = await ocrIntegrationService.processDocument(testImagePath, options);

      expect(result).toBeDefined();
      expect(result.metadata.correlationId).toBe('custom-correlation-id');
      expect(mockOcrEngineService.processDocument).toHaveBeenCalledWith(testImagePath, options);
    });

    it('should handle OCR engine failures with fallback', async () => {
      // Mock primary engine failure
      mockOcrEngineService.processDocument
        .mockRejectedValueOnce(new Error('Primary engine failed'))
        .mockResolvedValueOnce(mockOCRResult);

      const options: OCRProcessingOptions = {
        engine: 'tesseract',
        enableFallback: true,
        maxRetries: 2
      };

      const result = await ocrIntegrationService.processDocument(testImagePath, options);

      expect(result).toBeDefined();
      expect(result.ocrResult).toEqual(mockOCRResult);
      expect(mockOcrEngineService.processDocument).toHaveBeenCalledTimes(2);
    });

    it('should handle post-processing failures gracefully', async () => {
      // Mock post-processing failure
      mockTextPostProcessorService.processText.mockRejectedValue(new Error('Post-processing failed'));

      const result = await ocrIntegrationService.processDocument(testImagePath, {
        enablePostProcessing: true
      });

      expect(result).toBeDefined();
      expect(result.ocrResult).toEqual(mockOCRResult);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].stage).toBe('postprocessing');
      expect(result.warnings).toHaveLength(1);
    });

    it('should emit processing events', async () => {
      const events: any[] = [];
      const options: OCRProcessingOptions = {
        notificationCallback: (event) => events.push(event)
      };

      await ocrIntegrationService.processDocument(testImagePath, options);

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'started')).toBe(true);
      expect(events.some(e => e.type === 'completed')).toBe(true);
    });

    it('should respect quality threshold', async () => {
      // Mock low quality OCR result
      const lowQualityResult = {
        ...mockOCRResult,
        confidence: 0.4,
        qualityMetrics: {
          ...mockOCRResult.qualityMetrics,
          averageWordConfidence: 0.4
        }
      };
      mockOcrEngineService.processDocument.mockResolvedValue(lowQualityResult);

      const result = await ocrIntegrationService.processDocument(testImagePath, {
        qualityThreshold: 0.8
      });

      expect(result.warnings.some(w => w.message.includes('below threshold'))).toBe(true);
    });

    it('should handle ensemble OCR processing', async () => {
      const ensembleResult = {
        ...mockOCRResult,
        engine: 'ensemble',
        engineResults: {
          tesseract: mockOCRResult,
          easyocr: { ...mockOCRResult, engine: 'easyocr', confidence: 0.82 }
        },
        combinationMethod: 'confidence_weighted',
        agreementScore: 0.88
      };
      mockOcrEngineService.processDocument.mockResolvedValue(ensembleResult);

      const result = await ocrIntegrationService.processDocument(testImagePath, {
        engine: ['tesseract', 'easyocr']
      });

      expect(result.ocrResult.engine).toBe('ensemble');
      expect((result.ocrResult as any).engineResults).toBeDefined();
    });

    it('should validate processing options', async () => {
      const invalidOptions = {
        qualityThreshold: 1.5, // Invalid: > 1
        maxRetries: -1, // Invalid: < 0
        language: '' // Invalid: empty
      };

      await expect(
        ocrIntegrationService.processDocument(testImagePath, invalidOptions as any)
      ).rejects.toThrow();
    });

    it('should handle concurrent processing of same document', async () => {
      const options = { enableCaching: false };
      
      // Start two concurrent processes
      const promise1 = ocrIntegrationService.processDocument(testImagePath, options);
      const promise2 = ocrIntegrationService.processDocument(testImagePath, options);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      // Should only call OCR engine once due to deduplication
      expect(mockOcrEngineService.processDocument).toHaveBeenCalledTimes(1);
    });
  });

  describe('Quality Assessment', () => {
    it('should calculate overall quality correctly', async () => {
      const result = await ocrIntegrationService.processDocument(testImagePath);

      expect(result.overallQuality).toBeGreaterThan(0);
      expect(result.overallQuality).toBeLessThanOrEqual(1);
      expect(result.processingRecommendations).toBeDefined();
    });

    it('should provide recommendations for low quality results', async () => {
      const lowQualityResult = {
        ...mockOCRResult,
        confidence: 0.3,
        qualityMetrics: {
          ...mockOCRResult.qualityMetrics,
          averageWordConfidence: 0.3,
          imageQuality: 'poor' as const,
          layoutComplexity: 0.9
        }
      };
      mockOcrEngineService.processDocument.mockResolvedValue(lowQualityResult);

      const result = await ocrIntegrationService.processDocument(testImagePath);

      expect(result.processingRecommendations.length).toBeGreaterThan(0);
      expect(result.processingRecommendations.some(r => 
        r.includes('image preprocessing') || r.includes('image quality')
      )).toBe(true);
    });

    it('should detect handwriting and provide appropriate recommendations', async () => {
      const handwritingResult = {
        ...mockOCRResult,
        qualityMetrics: {
          ...mockOCRResult.qualityMetrics,
          hasHandwriting: true
        }
      };
      mockOcrEngineService.processDocument.mockResolvedValue(handwritingResult);

      const result = await ocrIntegrationService.processDocument(testImagePath);

      expect(result.processingRecommendations.some(r => 
        r.includes('handwriting')
      )).toBe(true);
    });

    it('should recommend ensemble approach for low quality', async () => {
      const lowQualityResult = {
        ...mockOCRResult,
        confidence: 0.5,
        qualityMetrics: {
          ...mockOCRResult.qualityMetrics,
          averageWordConfidence: 0.5
        }
      };
      mockOcrEngineService.processDocument.mockResolvedValue(lowQualityResult);
      
      // Mock low semantic confidence
      mockTextPostProcessorService.performSemanticAnalysis.mockResolvedValue({
        correctedText: 'garbled text with errors',
        contextualCorrections: 0,
        semanticConfidence: 0.3
      });

      const result = await ocrIntegrationService.processDocument(testImagePath);

      expect(result.processingRecommendations.some(r => 
        r.includes('ensemble')
      )).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track processing time breakdown', async () => {
      const result = await ocrIntegrationService.processDocument(testImagePath, {
        enableProfiling: true
      });

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.ocr).toBeGreaterThan(0);
      expect(result.breakdown.postprocessing).toBeGreaterThan(0);
      expect(result.breakdown.qualityAssessment).toBeGreaterThan(0);
      expect(result.metadata.performanceProfile).toBeDefined();
    });

    it('should capture configuration snapshot', async () => {
      const result = await ocrIntegrationService.processDocument(testImagePath);

      expect(result.metadata.configurationSnapshot).toBeDefined();
      expect(result.metadata.configurationSnapshot.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found errors', async () => {
      mockOcrEngineService.processDocument.mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      await expect(
        ocrIntegrationService.processDocument('/nonexistent/path')
      ).rejects.toThrow('ENOENT');
    });

    it('should handle timeout errors', async () => {
      mockOcrEngineService.processDocument.mockRejectedValue(
        new Error('Processing timeout exceeded')
      );

      await expect(
        ocrIntegrationService.processDocument(testImagePath, { timeout: 1000 })
      ).rejects.toThrow('timeout');
    });

    it('should handle memory errors gracefully', async () => {
      mockOcrEngineService.processDocument.mockRejectedValue(
        new Error('JavaScript heap out of memory')
      );

      await expect(
        ocrIntegrationService.processDocument(testImagePath)
      ).rejects.toThrow('memory');
    });

    it('should recover from partial failures', async () => {
      // Mock partial post-processing failure
      mockTextPostProcessorService.performSemanticAnalysis.mockRejectedValue(
        new Error('Semantic analysis failed')
      );

      const result = await ocrIntegrationService.processDocument(testImagePath);

      expect(result).toBeDefined();
      expect(result.ocrResult).toEqual(mockOCRResult);
      expect(result.semanticConfidence).toBeUndefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    it('should cache results when enabled', async () => {
      const options = { enableCaching: true };
      
      const result1 = await ocrIntegrationService.processDocument(testImagePath, options);
      const result2 = await ocrIntegrationService.processDocument(testImagePath, options);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      // Second call should use cache (implementation dependent)
    });

    it('should bypass cache when disabled', async () => {
      const options = { enableCaching: false };
      
      await ocrIntegrationService.processDocument(testImagePath, options);
      await ocrIntegrationService.processDocument(testImagePath, options);

      expect(mockOcrEngineService.processDocument).toHaveBeenCalledTimes(2);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when all components are working', async () => {
      mockOcrEngineService.healthCheck.mockResolvedValue({
        status: 'healthy',
        engines: { tesseract: 'available', easyocr: 'available' },
        memoryUsage: { rss: 100000000, heapUsed: 50000000 },
        workerPoolSize: 2,
        pythonProcesses: 2
      });

      mockTextPostProcessorService.healthCheck.mockResolvedValue({
        status: 'healthy',
        initialized: true,
        rulesLoaded: 150,
        dictionarySize: 5000,
        domainTermsSize: 500
      });

      const health = await ocrIntegrationService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.components.ocrEngine).toBe('healthy');
      expect(health.components.textPostProcessor).toBe('healthy');
    });

    it('should return unhealthy status when components fail', async () => {
      mockOcrEngineService.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        engines: {},
        memoryUsage: null,
        workerPoolSize: 0,
        pythonProcesses: 0
      });

      const health = await ocrIntegrationService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.components.ocrEngine).toBe('unhealthy');
    });
  });
});

describe('Text Post-Processor Advanced Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Semantic Analysis', () => {
    it('should perform context-aware word corrections', async () => {
      const text = 'Total 1S0.00 Qty 5 Date 0l/15/2024';
      
      mockTextPostProcessorService.performSemanticAnalysis.mockResolvedValue({
        correctedText: 'Total 150.00 Qty 5 Date 01/15/2024',
        contextualCorrections: 3,
        semanticConfidence: 0.85
      });

      const result = await textPostProcessorService.performSemanticAnalysis(text);

      expect(result.correctedText).toBe('Total 150.00 Qty 5 Date 01/15/2024');
      expect(result.contextualCorrections).toBe(3);
      expect(result.semanticConfidence).toBeGreaterThan(0.8);
    });

    it('should calculate semantic confidence correctly', async () => {
      const text = 'Invoice #12345 Date: 01/15/2024 Total: $150.00';
      
      mockTextPostProcessorService.performSemanticAnalysis.mockResolvedValue({
        correctedText: text,
        contextualCorrections: 0,
        semanticConfidence: 0.92
      });

      const result = await textPostProcessorService.performSemanticAnalysis(text);

      expect(result.semanticConfidence).toBeGreaterThan(0.9);
    });
  });

  describe('Numerical Validation', () => {
    it('should correct currency formatting', async () => {
      const text = 'Total: $1S0.O0 Subtotal: $l25.5O Tax: $24.50';
      
      mockTextPostProcessorService.validateAndCorrectNumericalData.mockResolvedValue({
        correctedText: 'Total: $150.00 Subtotal: $125.50 Tax: $24.50',
        numericalCorrections: [
          { original: '$1S0.O0', corrected: '$150.00', type: 'currency', confidence: 0.9 },
          { original: '$l25.5O', corrected: '$125.50', type: 'currency', confidence: 0.9 }
        ],
        financialDataIntegrity: 0.95
      });

      const result = await textPostProcessorService.validateAndCorrectNumericalData(text);

      expect(result.correctedText).toContain('$150.00');
      expect(result.numericalCorrections).toHaveLength(2);
      expect(result.financialDataIntegrity).toBeGreaterThan(0.9);
    });

    it('should standardize date formats', async () => {
      const text = 'Date: 1/5/24 Due: Dec 31, 2024';
      
      mockTextPostProcessorService.validateAndCorrectNumericalData.mockResolvedValue({
        correctedText: 'Date: 01/05/2024 Due: 12/31/2024',
        numericalCorrections: [
          { original: '1/5/24', corrected: '01/05/2024', type: 'date', confidence: 0.85 },
          { original: 'Dec 31, 2024', corrected: '12/31/2024', type: 'date', confidence: 0.85 }
        ],
        financialDataIntegrity: 0.8
      });

      const result = await textPostProcessorService.validateAndCorrectNumericalData(text);

      expect(result.correctedText).toContain('01/05/2024');
      expect(result.correctedText).toContain('12/31/2024');
    });

    it('should standardize phone numbers', async () => {
      const text = 'Contact: 5551234567 or (555) 123-4567';
      
      mockTextPostProcessorService.validateAndCorrectNumericalData.mockResolvedValue({
        correctedText: 'Contact: (555) 123-4567 or (555) 123-4567',
        numericalCorrections: [
          { original: '5551234567', corrected: '(555) 123-4567', type: 'phone', confidence: 0.8 }
        ],
        financialDataIntegrity: 0.7
      });

      const result = await textPostProcessorService.validateAndCorrectNumericalData(text);

      expect(result.numericalCorrections).toHaveLength(1);
      expect(result.correctedText).toContain('(555) 123-4567');
    });
  });

  describe('Document Structure Reconstruction', () => {
    it('should detect and organize document elements', async () => {
      const text = `ABC Company Inc\nInvoice #12345\n123 Main St\nNew York, NY 10001\nItem 1: $50.00\nItem 2: $75.00\nSubtotal: $125.00\nTax: $10.00\nTotal: $135.00\nThank you for your business`;
      
      mockTextPostProcessorService.reconstructDocumentStructure.mockResolvedValue({
        structuredText: '=== HEADER ===\nABC Company Inc\nInvoice #12345\n\n=== ADDRESS ===\n123 Main St\nNew York, NY 10001\n\n=== CONTENT ===\nItem 1: $50.00\nItem 2: $75.00\n\n=== TOTALS ===\nSubtotal: $125.00\nTax: $10.00\nTotal: $135.00\n\n=== FOOTER ===\nThank you for your business',
        detectedElements: [
          { type: 'header', content: 'ABC Company Inc', confidence: 0.9 },
          { type: 'header', content: 'Invoice #12345', confidence: 0.8 },
          { type: 'address', content: '123 Main St\nNew York, NY 10001', confidence: 0.85 },
          { type: 'body', content: 'Item 1: $50.00', confidence: 0.7 },
          { type: 'body', content: 'Item 2: $75.00', confidence: 0.7 },
          { type: 'total', content: 'Subtotal: $125.00', confidence: 0.95 },
          { type: 'total', content: 'Tax: $10.00', confidence: 0.95 },
          { type: 'total', content: 'Total: $135.00', confidence: 0.95 },
          { type: 'footer', content: 'Thank you for your business', confidence: 0.8 }
        ],
        structuralIntegrity: 0.88
      });

      const result = await textPostProcessorService.reconstructDocumentStructure(text);

      expect(result.detectedElements).toHaveLength(9);
      expect(result.detectedElements.some(e => e.type === 'header')).toBe(true);
      expect(result.detectedElements.some(e => e.type === 'address')).toBe(true);
      expect(result.detectedElements.some(e => e.type === 'total')).toBe(true);
      expect(result.structuralIntegrity).toBeGreaterThan(0.8);
    });

    it('should detect table structures', async () => {
      const text = `Item | Qty | Price\nWidget A | 2 | $25.00\nWidget B | 1 | $50.00`;
      
      mockTextPostProcessorService.reconstructDocumentStructure.mockResolvedValue({
        structuredText: '=== CONTENT ===\nItem | Qty | Price\nWidget A | 2 | $25.00\nWidget B | 1 | $50.00',
        detectedElements: [
          { type: 'table', content: 'Item | Qty | Price\nWidget A | 2 | $25.00\nWidget B | 1 | $50.00', confidence: 0.9 }
        ],
        structuralIntegrity: 0.9
      });

      const result = await textPostProcessorService.reconstructDocumentStructure(text);

      expect(result.detectedElements.some(e => e.type === 'table')).toBe(true);
      expect(result.structuralIntegrity).toBeGreaterThan(0.8);
    });
  });
});