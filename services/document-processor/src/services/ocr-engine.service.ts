import Tesseract, { createWorker, createScheduler, PSM, OEM } from 'tesseract.js';
import { configManager } from '../config';
import { monitoring } from './monitoring.service';
import { transactionService } from './transaction.service';
import * as winston from 'winston';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import * as crypto from 'crypto';

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
        filename: path.join(path.dirname(config.logging.file), 'ocr-engine.log'),
        maxsize: config.logging.maxFileSize,
        maxFiles: config.logging.maxFiles
      })
    ] : [])
  ]
});

export enum OCREngine {
  TESSERACT = 'tesseract',
  EASYOCR = 'easyocr',
  PADDLEOCR = 'paddleocr',
  ENSEMBLE = 'ensemble'
}

export enum DocumentType {
  RECEIPT = 'receipt',
  INVOICE = 'invoice',
  FORM = 'form',
  HANDWRITTEN = 'handwritten',
  PRINTED = 'printed',
  MIXED = 'mixed',
  UNKNOWN = 'unknown'
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  line?: number;
  paragraph?: number;
  block?: number;
}

export interface OCRLine {
  text: string;
  confidence: number;
  words: OCRWord[];
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  angle?: number;
}

export interface OCRParagraph {
  text: string;
  confidence: number;
  lines: OCRLine[];
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface OCRPage {
  text: string;
  confidence: number;
  paragraphs: OCRParagraph[];
  lines: OCRLine[];
  words: OCRWord[];
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
}

export interface QualityMetrics {
  // Basic confidence metrics
  averageWordConfidence: number;
  averageLineConfidence: number;
  averageParagraphConfidence: number;
  
  // Text quality indicators
  textDensity: number; // Characters per unit area
  wordCount: number;
  characterCount: number;
  lineCount: number;
  
  // Layout analysis
  textRegions: number;
  layoutComplexity: number; // 0-1 score based on text distribution
  skewAngle?: number;
  
  // Content quality
  recognizedLanguageConfidence: number;
  suspiciousCharacterRatio: number; // Ratio of unusual/garbled characters
  whitespaceRatio: number;
  digitRatio: number;
  uppercaseRatio: number;
  
  // Document specific
  hasTableStructure: boolean;
  hasHandwriting: boolean;
  imageQuality: 'poor' | 'fair' | 'good' | 'excellent';
  
  // Ensemble specific (when applicable)
  engineAgreement?: number; // Agreement between different engines
  consistencyScore?: number; // Internal consistency of results
}

export interface OCRResult {
  engine: OCREngine;
  pages: OCRPage[];
  text: string;
  confidence: number;
  processingTime: number;
  language: string;
  documentType?: DocumentType;
  qualityMetrics: QualityMetrics;
  metadata: {
    correlationId: string;
    timestamp: string;
    version: string;
    preprocessing: string[];
    postprocessing: string[];
    engineVersion?: string;
    modelVersion?: string;
  };
  errors?: string[];
  warnings?: string[];
}

export interface EnsembleResult extends OCRResult {
  engineResults: {
    [key in OCREngine]?: OCRResult;
  };
  combinationMethod: 'voting' | 'confidence_weighted' | 'best_engine';
  agreementScore: number;
}

export interface ImagePreprocessingOptions {
  denoise: boolean;
  deskew: boolean;
  binarize: boolean;
  enhanceContrast: boolean;
  removeBackground: boolean;
  cropBorders: boolean;
  normalizeSize: boolean;
  sharpen: boolean;
}

export interface OCROptions {
  language: string;
  engine: OCREngine | OCREngine[];
  documentType?: DocumentType;
  preprocessing?: Partial<ImagePreprocessingOptions>;
  psm?: PSM;
  oem?: OEM;
  tesseractOptions?: any;
  confidenceThreshold?: number;
  enablePostprocessing?: boolean;
  timeout?: number;
  retryAttempts?: number;
  correlationId?: string;
}

class OCREngineService {
  private static instance: OCREngineService;
  private tesseractScheduler: any;
  private workerPool: Map<string, any> = new Map();
  private pythonProcesses: Map<string, ChildProcess> = new Map();
  private initialized: boolean = false;
  private engineCapabilities: Map<OCREngine, any> = new Map();

  private constructor() {
    this.initialize();
  }

  public static getInstance(): OCREngineService {
    if (!OCREngineService.instance) {
      OCREngineService.instance = new OCREngineService();
    }
    return OCREngineService.instance;
  }

  private async initialize(): Promise<void> {
    const correlationId = this.generateCorrelationId();
    const startTime = Date.now();

    try {
      logger.info('Initializing OCR Engine Service', { correlationId });
      monitoring.incrementCounter('ocr.initialization.started', 1);

      // Initialize Tesseract scheduler with worker pool
      await this.initializeTesseract();

      // Initialize Python bridges for EasyOCR and PaddleOCR
      await this.initializePythonEngines();

      // Test engine capabilities
      await this.testEngineCapabilities();

      this.initialized = true;
      const initTime = Date.now() - startTime;

      logger.info('OCR Engine Service initialized successfully', {
        correlationId,
        initializationTime: initTime,
        availableEngines: Array.from(this.engineCapabilities.keys())
      });

      monitoring.recordTiming('ocr.initialization.duration', initTime);
      monitoring.incrementCounter('ocr.initialization.completed', 1);

    } catch (error) {
      const initTime = Date.now() - startTime;
      logger.error('Failed to initialize OCR Engine Service', {
        error,
        correlationId,
        initializationTime: initTime
      });
      monitoring.recordTiming('ocr.initialization.failed_duration', initTime);
      monitoring.incrementCounter('ocr.initialization.failed', 1);
      throw error;
    }
  }

  private async initializeTesseract(): Promise<void> {
    try {
      // Create scheduler for managing worker pool
      this.tesseractScheduler = createScheduler();

      // Create worker pool based on CPU cores
      const workerCount = Math.min(config.processing.queueConcurrency, 4);
      const promises = [];

      for (let i = 0; i < workerCount; i++) {
        promises.push(this.createTesseractWorker(i));
      }

      await Promise.all(promises);

      this.engineCapabilities.set(OCREngine.TESSERACT, {
        languages: ['eng', 'spa', 'fra', 'deu', 'chi_sim', 'chi_tra', 'jpn', 'kor', 'ara', 'hin', 'rus'],
        supportedFormats: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'pdf'],
        features: ['text_detection', 'layout_analysis', 'confidence_scoring', 'multiple_languages'],
        maxConcurrency: workerCount
      });

      logger.info(`Initialized Tesseract with ${workerCount} workers`, {
        workerCount,
        languages: this.engineCapabilities.get(OCREngine.TESSERACT).languages
      });

    } catch (error) {
      logger.error('Failed to initialize Tesseract', { error });
      throw error;
    }
  }

  private async createTesseractWorker(workerId: number): Promise<void> {
    const worker = await createWorker(config.ocr.tesseract.lang);
    
    // Configure worker with optimal settings
    await worker.setParameters({
      tessedit_pageseg_mode: config.ocr.tesseract.psm,
      tessedit_ocr_engine_mode: config.ocr.tesseract.oem,
      tessedit_char_whitelist: '',
      preserve_interword_spaces: '1',
      tessedit_do_invert: '0'
    });

    this.tesseractScheduler.addWorker(worker);
    this.workerPool.set(`tesseract_${workerId}`, worker);

    logger.debug(`Created Tesseract worker ${workerId}`, { workerId });
  }

  private async initializePythonEngines(): Promise<void> {
    try {
      // Check if Python is available
      const pythonAvailable = await this.checkPythonAvailability();
      
      if (pythonAvailable) {
        // Initialize EasyOCR
        await this.initializeEasyOCR();
        
        // Initialize PaddleOCR  
        await this.initializePaddleOCR();
      } else {
        logger.warn('Python not available, skipping Python-based OCR engines');
      }
    } catch (error) {
      logger.warn('Failed to initialize Python engines, continuing with Tesseract only', { error });
    }
  }

  private async checkPythonAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const python = spawn('python', ['--version']);
      python.on('close', (code) => {
        resolve(code === 0);
      });
      python.on('error', () => {
        resolve(false);
      });
    });
  }

  private async initializeEasyOCR(): Promise<void> {
    try {
      // Create EasyOCR Python script
      const easyOCRScript = `
import easyocr
import json
import sys
import base64
import io
from PIL import Image
import numpy as np

def main():
    # Initialize EasyOCR reader
    reader = easyocr.Reader(['en'])
    
    while True:
        try:
            line = input()
            data = json.loads(line)
            
            if data['action'] == 'process':
                # Decode base64 image
                image_data = base64.b64decode(data['image'])
                image = Image.open(io.BytesIO(image_data))
                image_np = np.array(image)
                
                # Process with EasyOCR
                results = reader.readtext(image_np, detail=1, paragraph=True)
                
                # Format results
                ocr_results = []
                for bbox, text, confidence in results:
                    ocr_results.append({
                        'text': text,
                        'confidence': float(confidence),
                        'bbox': {
                            'x0': int(min(bbox, key=lambda x: x[0])[0]),
                            'y0': int(min(bbox, key=lambda x: x[1])[1]),
                            'x1': int(max(bbox, key=lambda x: x[0])[0]),
                            'y1': int(max(bbox, key=lambda x: x[1])[1])
                        }
                    })
                
                response = {
                    'success': True,
                    'results': ocr_results,
                    'text': ' '.join([r['text'] for r in ocr_results])
                }
                print(json.dumps(response))
                
            elif data['action'] == 'test':
                print(json.dumps({'success': True, 'engine': 'easyocr'}))
                
        except Exception as e:
            print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == '__main__':
    main()
`;

      const scriptPath = path.join(config.upload.tempDir, 'easyocr_bridge.py');
      await fs.writeFile(scriptPath, easyOCRScript);

      // Test EasyOCR availability
      const process = spawn('python', [scriptPath]);
      
      process.stdin.write(JSON.stringify({ action: 'test' }) + '\n');
      
      const testResult = await new Promise<boolean>((resolve) => {
        let response = '';
        process.stdout.on('data', (data) => {
          response += data.toString();
          try {
            const result = JSON.parse(response.trim());
            resolve(result.success === true);
          } catch {
            // Continue waiting for complete response
          }
        });
        
        setTimeout(() => resolve(false), 5000); // 5 second timeout
      });

      if (testResult) {
        this.pythonProcesses.set('easyocr', process);
        this.engineCapabilities.set(OCREngine.EASYOCR, {
          languages: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi', 'ru'],
          supportedFormats: ['jpg', 'jpeg', 'png', 'bmp', 'tiff'],
          features: ['text_detection', 'paragraph_detection', 'confidence_scoring'],
          specialties: ['receipts', 'invoices', 'forms']
        });
        
        logger.info('EasyOCR initialized successfully');
      } else {
        process.kill();
        throw new Error('EasyOCR test failed');
      }

    } catch (error) {
      logger.warn('Failed to initialize EasyOCR', { error });
    }
  }

  private async initializePaddleOCR(): Promise<void> {
    try {
      // Create PaddleOCR Python script
      const paddleOCRScript = `
import paddleocr
import json
import sys
import base64
import io
from PIL import Image
import numpy as np

def main():
    # Initialize PaddleOCR
    ocr = paddleocr.PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    
    while True:
        try:
            line = input()
            data = json.loads(line)
            
            if data['action'] == 'process':
                # Decode base64 image
                image_data = base64.b64decode(data['image'])
                image = Image.open(io.BytesIO(image_data))
                image_np = np.array(image)
                
                # Process with PaddleOCR
                results = ocr.ocr(image_np, cls=True)
                
                # Format results
                ocr_results = []
                for line in results[0]:
                    bbox = line[0]
                    text = line[1][0]
                    confidence = line[1][1]
                    
                    ocr_results.append({
                        'text': text,
                        'confidence': float(confidence),
                        'bbox': {
                            'x0': int(min(bbox, key=lambda x: x[0])[0]),
                            'y0': int(min(bbox, key=lambda x: x[1])[1]),
                            'x1': int(max(bbox, key=lambda x: x[0])[0]),
                            'y1': int(max(bbox, key=lambda x: x[1])[1])
                        }
                    })
                
                response = {
                    'success': True,
                    'results': ocr_results,
                    'text': ' '.join([r['text'] for r in ocr_results])
                }
                print(json.dumps(response))
                
            elif data['action'] == 'test':
                print(json.dumps({'success': True, 'engine': 'paddleocr'}))
                
        except Exception as e:
            print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == '__main__':
    main()
`;

      const scriptPath = path.join(config.upload.tempDir, 'paddleocr_bridge.py');
      await fs.writeFile(scriptPath, paddleOCRScript);

      // Test PaddleOCR availability
      const process = spawn('python', [scriptPath]);
      
      process.stdin.write(JSON.stringify({ action: 'test' }) + '\n');
      
      const testResult = await new Promise<boolean>((resolve) => {
        let response = '';
        process.stdout.on('data', (data) => {
          response += data.toString();
          try {
            const result = JSON.parse(response.trim());
            resolve(result.success === true);
          } catch {
            // Continue waiting for complete response
          }
        });
        
        setTimeout(() => resolve(false), 5000); // 5 second timeout
      });

      if (testResult) {
        this.pythonProcesses.set('paddleocr', process);
        this.engineCapabilities.set(OCREngine.PADDLEOCR, {
          languages: ['en', 'ch', 'ta', 'te', 'ka', 'ja', 'ko'],
          supportedFormats: ['jpg', 'jpeg', 'png', 'bmp', 'tiff'],
          features: ['text_detection', 'angle_classification', 'layout_analysis', 'multilingual'],
          specialties: ['complex_layouts', 'rotated_text', 'multilingual_documents']
        });
        
        logger.info('PaddleOCR initialized successfully');
      } else {
        process.kill();
        throw new Error('PaddleOCR test failed');
      }

    } catch (error) {
      logger.warn('Failed to initialize PaddleOCR', { error });
    }
  }

  private async testEngineCapabilities(): Promise<void> {
    logger.info('Testing OCR engine capabilities', {
      availableEngines: Array.from(this.engineCapabilities.keys())
    });
  }

  private generateCorrelationId(): string {
    return `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public async processDocument(
    imagePath: string, 
    options: OCROptions = { language: 'eng', engine: OCREngine.TESSERACT }
  ): Promise<OCRResult | EnsembleResult> {
    
    const correlationId = options.correlationId || this.generateCorrelationId();
    const startTime = Date.now();

    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info('Starting OCR processing', {
        imagePath,
        correlationId,
        engine: options.engine,
        language: options.language
      });

      monitoring.incrementCounter('ocr.processing.started', 1, [`engine:${options.engine}`]);

      // Validate file exists
      await fs.access(imagePath);

      // Preprocess image if requested
      let processedImagePath = imagePath;
      const preprocessingSteps: string[] = [];

      if (options.preprocessing) {
        processedImagePath = await this.preprocessImage(imagePath, options.preprocessing, correlationId);
        preprocessingSteps.push(...Object.keys(options.preprocessing).filter(key => 
          (options.preprocessing as any)[key] === true
        ));
      }

      // Determine processing strategy
      if (Array.isArray(options.engine) || options.engine === OCREngine.ENSEMBLE) {
        return await this.processWithEnsemble(processedImagePath, options, correlationId, preprocessingSteps);
      } else {
        return await this.processWithSingleEngine(processedImagePath, options, correlationId, preprocessingSteps);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('OCR processing failed', {
        imagePath,
        correlationId,
        error,
        processingTime
      });

      monitoring.recordTiming('ocr.processing.failed_duration', processingTime);
      monitoring.incrementCounter('ocr.processing.failed', 1, [`engine:${options.engine}`]);
      
      throw error;
    }
  }

  private async processWithSingleEngine(
    imagePath: string, 
    options: OCROptions, 
    correlationId: string,
    preprocessingSteps: string[]
  ): Promise<OCRResult> {
    
    const engine = options.engine as OCREngine;
    
    switch (engine) {
      case OCREngine.TESSERACT:
        return await this.processWithTesseract(imagePath, options, correlationId, preprocessingSteps);
      case OCREngine.EASYOCR:
        return await this.processWithEasyOCR(imagePath, options, correlationId, preprocessingSteps);
      case OCREngine.PADDLEOCR:
        return await this.processWithPaddleOCR(imagePath, options, correlationId, preprocessingSteps);
      default:
        throw new Error(`Unsupported OCR engine: ${engine}`);
    }
  }

  private async processWithEnsemble(
    imagePath: string, 
    options: OCROptions, 
    correlationId: string,
    preprocessingSteps: string[]
  ): Promise<EnsembleResult> {
    
    const engines = Array.isArray(options.engine) 
      ? options.engine 
      : [OCREngine.TESSERACT, OCREngine.EASYOCR, OCREngine.PADDLEOCR];

    const availableEngines = engines.filter(engine => 
      this.engineCapabilities.has(engine)
    );

    if (availableEngines.length === 0) {
      throw new Error('No available OCR engines for ensemble processing');
    }

    logger.info('Processing with ensemble method', {
      correlationId,
      requestedEngines: engines,
      availableEngines
    });

    // Process with each available engine in parallel
    const enginePromises = availableEngines.map(async (engine) => {
      try {
        const engineOptions = { ...options, engine };
        const result = await this.processWithSingleEngine(imagePath, engineOptions, correlationId, preprocessingSteps);
        return { engine, result };
      } catch (error) {
        logger.warn(`Engine ${engine} failed in ensemble`, { correlationId, error });
        return { engine, error };
      }
    });

    const engineResults = await Promise.allSettled(enginePromises);
    
    // Collect successful results
    const successfulResults: { [key in OCREngine]?: OCRResult } = {};
    for (const result of engineResults) {
      if (result.status === 'fulfilled' && 'result' in result.value) {
        successfulResults[result.value.engine] = result.value.result;
      }
    }

    if (Object.keys(successfulResults).length === 0) {
      throw new Error('All OCR engines failed in ensemble processing');
    }

    // Combine results using ensemble method
    return await this.combineEnsembleResults(successfulResults, options, correlationId, preprocessingSteps);
  }

  private async processWithTesseract(
    imagePath: string, 
    options: OCROptions, 
    correlationId: string,
    preprocessingSteps: string[]
  ): Promise<OCRResult> {
    
    const startTime = Date.now();

    try {
      const result = await this.tesseractScheduler.addJob('recognize', imagePath, {
        lang: options.language,
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            logger.debug('Tesseract progress', { 
              correlationId, 
              progress: m.progress 
            });
          }
        }
      });

      const processingTime = Date.now() - startTime;

      // Convert Tesseract result to our format
      const pages = this.convertTesseractToPages(result.data);
      const qualityMetrics = await this.calculateQualityMetrics(pages, imagePath, result.data.text.trim(), correlationId);
      
      const ocrResult: OCRResult = {
        engine: OCREngine.TESSERACT,
        pages,
        text: result.data.text.trim(),
        confidence: this.calculateAverageConfidence(result.data),
        processingTime,
        language: options.language,
        qualityMetrics,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString(),
          version: '2.1',
          preprocessing: preprocessingSteps,
          postprocessing: [],
          engineVersion: await this.getTesseractVersion()
        }
      };

      monitoring.recordTiming('ocr.tesseract.duration', processingTime);
      monitoring.incrementCounter('ocr.tesseract.completed', 1);

      logger.info('Tesseract processing completed', {
        correlationId,
        processingTime,
        confidence: ocrResult.confidence,
        textLength: ocrResult.text.length
      });

      return ocrResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      monitoring.recordTiming('ocr.tesseract.failed_duration', processingTime);
      monitoring.incrementCounter('ocr.tesseract.failed', 1);
      throw error;
    }
  }

  private async processWithEasyOCR(
    imagePath: string, 
    options: OCROptions, 
    correlationId: string,
    preprocessingSteps: string[]
  ): Promise<OCRResult> {
    
    const startTime = Date.now();
    const process = this.pythonProcesses.get('easyocr');
    
    if (!process) {
      throw new Error('EasyOCR engine not available');
    }

    try {
      // Convert image to base64
      const imageBuffer = await fs.readFile(imagePath);
      const imageBase64 = imageBuffer.toString('base64');

      // Send processing request
      const request = {
        action: 'process',
        image: imageBase64,
        language: options.language
      };

      process.stdin.write(JSON.stringify(request) + '\n');

      // Wait for response
      const response = await new Promise<any>((resolve, reject) => {
        let responseData = '';
        
        const timeout = setTimeout(() => {
          reject(new Error('EasyOCR processing timeout'));
        }, options.timeout || 60000);

        const dataHandler = (data: Buffer) => {
          responseData += data.toString();
          try {
            const result = JSON.parse(responseData.trim());
            clearTimeout(timeout);
            process.stdout.removeListener('data', dataHandler);
            
            if (result.success) {
              resolve(result);
            } else {
              reject(new Error(result.error || 'EasyOCR processing failed'));
            }
          } catch {
            // Continue waiting for complete response
          }
        };

        process.stdout.on('data', dataHandler);
      });

      const processingTime = Date.now() - startTime;

      // Convert EasyOCR result to our format
      const pages = this.convertEasyOCRToPages(response.results);
      const qualityMetrics = await this.calculateQualityMetrics(pages, imagePath, response.text, correlationId);
      
      const ocrResult: OCRResult = {
        engine: OCREngine.EASYOCR,
        pages,
        text: response.text,
        confidence: this.calculateEasyOCRConfidence(response.results),
        processingTime,
        language: options.language,
        qualityMetrics,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString(),
          version: '2.1',
          preprocessing: preprocessingSteps,
          postprocessing: [],
          engineVersion: 'easyocr-1.6+'
        }
      };

      monitoring.recordTiming('ocr.easyocr.duration', processingTime);
      monitoring.incrementCounter('ocr.easyocr.completed', 1);

      logger.info('EasyOCR processing completed', {
        correlationId,
        processingTime,
        confidence: ocrResult.confidence,
        textLength: ocrResult.text.length
      });

      return ocrResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      monitoring.recordTiming('ocr.easyocr.failed_duration', processingTime);
      monitoring.incrementCounter('ocr.easyocr.failed', 1);
      throw error;
    }
  }

  private async processWithPaddleOCR(
    imagePath: string, 
    options: OCROptions, 
    correlationId: string,
    preprocessingSteps: string[]
  ): Promise<OCRResult> {
    
    const startTime = Date.now();
    const process = this.pythonProcesses.get('paddleocr');
    
    if (!process) {
      throw new Error('PaddleOCR engine not available');
    }

    try {
      // Convert image to base64
      const imageBuffer = await fs.readFile(imagePath);
      const imageBase64 = imageBuffer.toString('base64');

      // Send processing request
      const request = {
        action: 'process',
        image: imageBase64,
        language: options.language
      };

      process.stdin.write(JSON.stringify(request) + '\n');

      // Wait for response
      const response = await new Promise<any>((resolve, reject) => {
        let responseData = '';
        
        const timeout = setTimeout(() => {
          reject(new Error('PaddleOCR processing timeout'));
        }, options.timeout || 60000);

        const dataHandler = (data: Buffer) => {
          responseData += data.toString();
          try {
            const result = JSON.parse(responseData.trim());
            clearTimeout(timeout);
            process.stdout.removeListener('data', dataHandler);
            
            if (result.success) {
              resolve(result);
            } else {
              reject(new Error(result.error || 'PaddleOCR processing failed'));
            }
          } catch {
            // Continue waiting for complete response
          }
        };

        process.stdout.on('data', dataHandler);
      });

      const processingTime = Date.now() - startTime;

      // Convert PaddleOCR result to our format
      const pages = this.convertPaddleOCRToPages(response.results);
      const qualityMetrics = await this.calculateQualityMetrics(pages, imagePath, response.text, correlationId);
      
      const ocrResult: OCRResult = {
        engine: OCREngine.PADDLEOCR,
        pages,
        text: response.text,
        confidence: this.calculatePaddleOCRConfidence(response.results),
        processingTime,
        language: options.language,
        qualityMetrics,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString(),
          version: '2.1',
          preprocessing: preprocessingSteps,
          postprocessing: [],
          engineVersion: 'paddleocr-2.7+'
        }
      };

      monitoring.recordTiming('ocr.paddleocr.duration', processingTime);
      monitoring.incrementCounter('ocr.paddleocr.completed', 1);

      logger.info('PaddleOCR processing completed', {
        correlationId,
        processingTime,
        confidence: ocrResult.confidence,
        textLength: ocrResult.text.length
      });

      return ocrResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      monitoring.recordTiming('ocr.paddleocr.failed_duration', processingTime);
      monitoring.incrementCounter('ocr.paddleocr.failed', 1);
      throw error;
    }
  }

  private async preprocessImage(
    imagePath: string, 
    options: Partial<ImagePreprocessingOptions>,
    correlationId: string
  ): Promise<string> {
    
    const startTime = Date.now();
    const outputPath = path.join(
      config.upload.tempDir, 
      `preprocessed_${correlationId}_${path.basename(imagePath)}`
    );

    try {
      logger.debug('Starting image preprocessing', { correlationId, options });

      let image = sharp(imagePath);

      // Get image metadata
      const metadata = await image.metadata();
      
      // Apply preprocessing steps in optimal order
      if (options.normalizeSize) {
        // Normalize to standard size while maintaining aspect ratio
        const maxDimension = 2048;
        if (metadata.width && metadata.height) {
          const scale = Math.min(maxDimension / metadata.width, maxDimension / metadata.height);
          if (scale < 1) {
            image = image.resize(
              Math.round(metadata.width * scale),
              Math.round(metadata.height * scale),
              { kernel: sharp.kernel.lanczos3 }
            );
          }
        }
      }

      if (options.cropBorders) {
        // Auto-crop borders using edge detection
        image = image.trim({ threshold: 10 });
      }

      if (options.deskew) {
        // Note: Sharp doesn't have built-in deskew, would need custom implementation
        // For now, we'll skip this or implement using another library
        logger.debug('Deskew requested but not implemented yet', { correlationId });
      }

      if (options.denoise) {
        // Apply denoising filter
        image = image.median(3);
      }

      if (options.enhanceContrast) {
        // Enhance contrast using histogram equalization
        image = image.normalize();
      }

      if (options.sharpen) {
        // Apply sharpening filter
        image = image.sharpen({ sigma: 1, m1: 0.5, m2: 2, x1: 2, y2: 10, y3: 20 });
      }

      if (options.binarize) {
        // Convert to binary (black and white)
        image = image
          .grayscale()
          .threshold(128, { greyscale: false });
      }

      if (options.removeBackground) {
        // Remove background (basic implementation)
        image = image.removeAlpha();
      }

      // Save preprocessed image
      await image.jpeg({ quality: 95 }).toFile(outputPath);

      const preprocessingTime = Date.now() - startTime;
      
      logger.debug('Image preprocessing completed', {
        correlationId,
        inputPath: imagePath,
        outputPath,
        preprocessingTime,
        appliedOptions: Object.keys(options).filter(key => (options as any)[key] === true)
      });

      monitoring.recordTiming('ocr.preprocessing.duration', preprocessingTime);
      
      return outputPath;

    } catch (error) {
      logger.error('Image preprocessing failed', { correlationId, error });
      throw error;
    }
  }

  // Helper methods for result conversion and confidence calculation
  private convertTesseractToPages(tesseractData: any): OCRPage[] {
    // Implementation to convert Tesseract result format to our standardized format
    const words: OCRWord[] = tesseractData.words?.map((word: any, index: number) => ({
      text: word.text,
      confidence: word.confidence / 100,
      bbox: {
        x0: word.bbox.x0,
        y0: word.bbox.y0,
        x1: word.bbox.x1,
        y1: word.bbox.y1
      },
      line: word.line_num,
      paragraph: word.par_num,
      block: word.block_num
    })) || [];

    const lines: OCRLine[] = this.groupWordsIntoLines(words);
    const paragraphs: OCRParagraph[] = this.groupLinesIntoParagraphs(lines);

    return [{
      text: tesseractData.text || '',
      confidence: this.calculateAverageConfidence(tesseractData),
      paragraphs,
      lines,
      words,
      bbox: {
        x0: 0,
        y0: 0,
        x1: tesseractData.width || 0,
        y1: tesseractData.height || 0
      },
      dimensions: {
        width: tesseractData.width || 0,
        height: tesseractData.height || 0
      }
    }];
  }

  private convertEasyOCRToPages(easyOCRResults: any[]): OCRPage[] {
    const words: OCRWord[] = easyOCRResults.map((result, index) => ({
      text: result.text,
      confidence: result.confidence,
      bbox: result.bbox
    }));

    const lines: OCRLine[] = this.groupWordsIntoLines(words);
    const paragraphs: OCRParagraph[] = this.groupLinesIntoParagraphs(lines);

    // Calculate page dimensions from bounding boxes
    const allX = words.flatMap(w => [w.bbox.x0, w.bbox.x1]);
    const allY = words.flatMap(w => [w.bbox.y0, w.bbox.y1]);

    return [{
      text: words.map(w => w.text).join(' '),
      confidence: words.reduce((sum, w) => sum + w.confidence, 0) / words.length,
      paragraphs,
      lines,
      words,
      bbox: {
        x0: Math.min(...allX, 0),
        y0: Math.min(...allY, 0),
        x1: Math.max(...allX, 0),
        y1: Math.max(...allY, 0)
      },
      dimensions: {
        width: Math.max(...allX, 0) - Math.min(...allX, 0),
        height: Math.max(...allY, 0) - Math.min(...allY, 0)
      }
    }];
  }

  private convertPaddleOCRToPages(paddleOCRResults: any[]): OCRPage[] {
    const words: OCRWord[] = paddleOCRResults.map((result, index) => ({
      text: result.text,
      confidence: result.confidence,
      bbox: result.bbox
    }));

    const lines: OCRLine[] = this.groupWordsIntoLines(words);
    const paragraphs: OCRParagraph[] = this.groupLinesIntoParagraphs(lines);

    // Calculate page dimensions from bounding boxes
    const allX = words.flatMap(w => [w.bbox.x0, w.bbox.x1]);
    const allY = words.flatMap(w => [w.bbox.y0, w.bbox.y1]);

    return [{
      text: words.map(w => w.text).join(' '),
      confidence: words.reduce((sum, w) => sum + w.confidence, 0) / words.length,
      paragraphs,
      lines,
      words,
      bbox: {
        x0: Math.min(...allX, 0),
        y0: Math.min(...allY, 0),
        x1: Math.max(...allX, 0),
        y1: Math.max(...allY, 0)
      },
      dimensions: {
        width: Math.max(...allX, 0) - Math.min(...allX, 0),
        height: Math.max(...allY, 0) - Math.min(...allY, 0)
      }
    }];
  }

  private groupWordsIntoLines(words: OCRWord[]): OCRLine[] {
    // Group words into lines based on vertical proximity and horizontal alignment
    const lineGroups: { [key: number]: OCRWord[] } = {};

    for (const word of words) {
      const lineKey = Math.round(word.bbox.y0 / 10) * 10; // Group by 10-pixel rows
      if (!lineGroups[lineKey]) {
        lineGroups[lineKey] = [];
      }
      lineGroups[lineKey].push(word);
    }

    return Object.entries(lineGroups).map(([lineKey, lineWords]) => {
      // Sort words by x position
      lineWords.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      
      const allX = lineWords.flatMap(w => [w.bbox.x0, w.bbox.x1]);
      const allY = lineWords.flatMap(w => [w.bbox.y0, w.bbox.y1]);

      return {
        text: lineWords.map(w => w.text).join(' '),
        confidence: lineWords.reduce((sum, w) => sum + w.confidence, 0) / lineWords.length,
        words: lineWords,
        bbox: {
          x0: Math.min(...allX),
          y0: Math.min(...allY),
          x1: Math.max(...allX),
          y1: Math.max(...allY)
        }
      };
    });
  }

  private groupLinesIntoParagraphs(lines: OCRLine[]): OCRParagraph[] {
    // Group lines into paragraphs based on vertical spacing
    const paragraphs: OCRParagraph[] = [];
    let currentParagraph: OCRLine[] = [];

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      const nextLine = lines[i + 1];

      currentParagraph.push(currentLine);

      // Check if this is the end of a paragraph (large gap to next line or end of lines)
      if (!nextLine || (nextLine.bbox.y0 - currentLine.bbox.y1) > 20) {
        const allX = currentParagraph.flatMap(l => [l.bbox.x0, l.bbox.x1]);
        const allY = currentParagraph.flatMap(l => [l.bbox.y0, l.bbox.y1]);

        paragraphs.push({
          text: currentParagraph.map(l => l.text).join(' '),
          confidence: currentParagraph.reduce((sum, l) => sum + l.confidence, 0) / currentParagraph.length,
          lines: currentParagraph,
          bbox: {
            x0: Math.min(...allX),
            y0: Math.min(...allY),
            x1: Math.max(...allX),
            y1: Math.max(...allY)
          }
        });

        currentParagraph = [];
      }
    }

    return paragraphs;
  }

  private calculateAverageConfidence(tesseractData: any): number {
    if (tesseractData.words && tesseractData.words.length > 0) {
      const sum = tesseractData.words.reduce((acc: number, word: any) => acc + word.confidence, 0);
      return (sum / tesseractData.words.length) / 100; // Convert from 0-100 to 0-1
    }
    return tesseractData.confidence ? tesseractData.confidence / 100 : 0;
  }

  private calculateEasyOCRConfidence(results: any[]): number {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, result) => acc + result.confidence, 0);
    return sum / results.length;
  }

  private calculatePaddleOCRConfidence(results: any[]): number {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, result) => acc + result.confidence, 0);
    return sum / results.length;
  }

  private async getTesseractVersion(): Promise<string> {
    try {
      // This would need to be implemented based on Tesseract.js API
      return 'tesseract.js-4.1+';
    } catch {
      return 'unknown';
    }
  }

  private async combineEnsembleResults(
    engineResults: { [key in OCREngine]?: OCRResult },
    options: OCROptions,
    correlationId: string,
    preprocessingSteps: string[]
  ): Promise<EnsembleResult> {
    
    const startTime = Date.now();

    try {
      logger.info('Combining ensemble results', {
        correlationId,
        engines: Object.keys(engineResults),
        method: 'confidence_weighted'
      });

      // Choose best engine based on confidence
      const engineEntries = Object.entries(engineResults) as [OCREngine, OCRResult][];
      const bestEngine = engineEntries.reduce((best, [engine, result]) => 
        result.confidence > best[1].confidence ? [engine, result] : best
      );

      // Calculate agreement score between engines
      const agreementScore = this.calculateAgreementScore(engineResults);

      // Create ensemble result based on best performing engine
      const ensembleResult: EnsembleResult = {
        ...bestEngine[1],
        engine: OCREngine.ENSEMBLE,
        engineResults,
        combinationMethod: 'confidence_weighted',
        agreementScore,
        metadata: {
          ...bestEngine[1].metadata,
          correlationId,
          version: '2.1',
          preprocessing: preprocessingSteps,
          postprocessing: ['ensemble_combination'],
          engineVersion: 'ensemble-2.1'
        }
      };

      const combinationTime = Date.now() - startTime;
      monitoring.recordTiming('ocr.ensemble.combination_duration', combinationTime);

      logger.info('Ensemble results combined', {
        correlationId,
        bestEngine: bestEngine[0],
        agreementScore,
        finalConfidence: ensembleResult.confidence,
        combinationTime
      });

      return ensembleResult;

    } catch (error) {
      logger.error('Failed to combine ensemble results', { correlationId, error });
      throw error;
    }
  }

  private calculateAgreementScore(engineResults: { [key in OCREngine]?: OCRResult }): number {
    const results = Object.values(engineResults).filter(r => r !== undefined) as OCRResult[];
    
    if (results.length < 2) return 1.0;

    // Simple agreement based on text similarity
    const texts = results.map(r => r.text.toLowerCase().trim());
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        totalSimilarity += this.calculateTextSimilarity(texts[i], texts[j]);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(text1.length, text2.length);
    if (maxLength === 0) return 1.0;

    const distance = this.levenshteinDistance(text1, text2);
    return 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Health check for the OCR service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    engines: { [key in OCREngine]?: boolean };
    memoryUsage: any;
    workerPoolSize: number;
    pythonProcesses: number;
  }> {
    try {
      const engineStatus: { [key in OCREngine]?: boolean } = {};
      
      // Check each engine
      for (const [engine] of this.engineCapabilities) {
        engineStatus[engine] = true; // Simplified check
      }

      return {
        status: this.initialized ? 'healthy' : 'unhealthy',
        engines: engineStatus,
        memoryUsage: process.memoryUsage(),
        workerPoolSize: this.workerPool.size,
        pythonProcesses: this.pythonProcesses.size
      };
    } catch (error) {
      logger.error('OCR health check failed', { error });
      return {
        status: 'unhealthy',
        engines: {},
        memoryUsage: null,
        workerPoolSize: 0,
        pythonProcesses: 0
      };
    }
  }

  /**
   * Clean shutdown of the OCR service
   */
  async dispose(): Promise<void> {
    const correlationId = this.generateCorrelationId();
    logger.info('Disposing OCR Engine Service', { correlationId });

    try {
      // Terminate Tesseract workers
      for (const worker of this.workerPool.values()) {
        await worker.terminate();
      }
      this.workerPool.clear();

      if (this.tesseractScheduler) {
        await this.tesseractScheduler.terminate();
      }

      // Terminate Python processes
      for (const [engine, process] of this.pythonProcesses) {
        logger.debug(`Terminating ${engine} process`, { correlationId });
        process.kill();
      }
      this.pythonProcesses.clear();

      // Clean up capabilities
      this.engineCapabilities.clear();
      this.initialized = false;

      logger.info('OCR Engine Service disposed successfully', { correlationId });
      monitoring.incrementCounter('ocr.dispose.completed', 1);

    } catch (error) {
      logger.error('Error disposing OCR Engine Service', { correlationId, error });
      monitoring.incrementCounter('ocr.dispose.failed', 1);
      throw error;
    }
  }

  /**
   * Enterprise-grade quality assessment for OCR results
   * Analyzes text quality, layout complexity, and content characteristics
   */
  private async calculateQualityMetrics(
    pages: OCRPage[], 
    imagePath: string, 
    extractedText: string, 
    correlationId: string
  ): Promise<QualityMetrics> {
    const startTime = Date.now();
    
    try {
      logger.debug('Calculating quality metrics', { correlationId, pageCount: pages.length });

      // Initialize metrics
      const allWords = pages.flatMap(page => page.words);
      const allLines = pages.flatMap(page => page.lines);
      const allParagraphs = pages.flatMap(page => page.paragraphs);

      // Basic confidence metrics
      const averageWordConfidence = allWords.length > 0 
        ? allWords.reduce((sum, word) => sum + word.confidence, 0) / allWords.length 
        : 0;
      
      const averageLineConfidence = allLines.length > 0 
        ? allLines.reduce((sum, line) => sum + line.confidence, 0) / allLines.length 
        : 0;
      
      const averageParagraphConfidence = allParagraphs.length > 0 
        ? allParagraphs.reduce((sum, para) => sum + para.confidence, 0) / allParagraphs.length 
        : 0;

      // Text quality indicators
      const wordCount = allWords.length;
      const characterCount = extractedText.length;
      const lineCount = allLines.length;

      // Calculate text density (characters per unit area)
      const imageMetadata = await this.getImageMetadata(imagePath);
      const imageArea = imageMetadata.width * imageMetadata.height;
      const textDensity = imageArea > 0 ? characterCount / imageArea : 0;

      // Layout analysis
      const textRegions = this.analyzeTextRegions(pages);
      const layoutComplexity = this.calculateLayoutComplexity(pages);
      const skewAngle = this.estimateSkewAngle(allLines);

      // Content quality analysis
      const recognizedLanguageConfidence = this.analyzeLanguageConfidence(extractedText);
      const suspiciousCharacterRatio = this.calculateSuspiciousCharacterRatio(extractedText);
      const whitespaceRatio = this.calculateWhitespaceRatio(extractedText);
      const digitRatio = this.calculateDigitRatio(extractedText);
      const uppercaseRatio = this.calculateUppercaseRatio(extractedText);

      // Document structure analysis
      const hasTableStructure = this.detectTableStructure(pages, extractedText);
      const hasHandwriting = this.detectHandwriting(allWords);

      // Image quality assessment
      const imageQuality = await this.assessImageQuality(imagePath, correlationId);

      const qualityMetrics: QualityMetrics = {
        averageWordConfidence,
        averageLineConfidence,
        averageParagraphConfidence,
        textDensity,
        wordCount,
        characterCount,
        lineCount,
        textRegions,
        layoutComplexity,
        skewAngle,
        recognizedLanguageConfidence,
        suspiciousCharacterRatio,
        whitespaceRatio,
        digitRatio,
        uppercaseRatio,
        hasTableStructure,
        hasHandwriting,
        imageQuality
      };

      const calculationTime = Date.now() - startTime;
      monitoring.recordTiming('ocr.quality_metrics.calculation_duration', calculationTime);

      logger.debug('Quality metrics calculated', {
        correlationId,
        calculationTime,
        averageWordConfidence: averageWordConfidence.toFixed(3),
        layoutComplexity: layoutComplexity.toFixed(3),
        imageQuality
      });

      return qualityMetrics;

    } catch (error) {
      const calculationTime = Date.now() - startTime;
      monitoring.recordTiming('ocr.quality_metrics.failed_duration', calculationTime);
      monitoring.incrementCounter('ocr.quality_metrics.failed', 1);
      
      logger.error('Failed to calculate quality metrics', { correlationId, error });
      
      // Return fallback metrics
      return this.getFallbackQualityMetrics(extractedText);
    }
  }

  /**
   * Analyze text regions and distribution across the page
   */
  private analyzeTextRegions(pages: OCRPage[]): number {
    let totalRegions = 0;
    
    for (const page of pages) {
      // Group words into regions based on spatial proximity
      const regions = new Set<string>();
      
      for (const word of page.words) {
        // Create region identifier based on approximate position
        const regionX = Math.floor(word.bbox.x0 / 100) * 100;
        const regionY = Math.floor(word.bbox.y0 / 100) * 100;
        regions.add(`${regionX},${regionY}`);
      }
      
      totalRegions += regions.size;
    }
    
    return totalRegions;
  }

  /**
   * Calculate layout complexity based on text distribution and alignment
   */
  private calculateLayoutComplexity(pages: OCRPage[]): number {
    let totalComplexity = 0;
    
    for (const page of pages) {
      if (page.lines.length === 0) continue;
      
      // Analyze line alignment and spacing
      const leftMargins = page.lines.map(line => line.bbox.x0);
      const rightMargins = page.lines.map(line => line.bbox.x1);
      const lineSpacings = [];
      
      for (let i = 1; i < page.lines.length; i++) {
        lineSpacings.push(page.lines[i].bbox.y0 - page.lines[i-1].bbox.y1);
      }
      
      // Calculate variance in margins and spacing
      const leftVariance = this.calculateVariance(leftMargins);
      const rightVariance = this.calculateVariance(rightMargins);
      const spacingVariance = lineSpacings.length > 0 ? this.calculateVariance(lineSpacings) : 0;
      
      // Normalize to 0-1 scale (higher variance = higher complexity)
      const pageComplexity = Math.min(1, (leftVariance + rightVariance + spacingVariance) / 10000);
      totalComplexity += pageComplexity;
    }
    
    return pages.length > 0 ? totalComplexity / pages.length : 0;
  }

  /**
   * Estimate document skew angle from line orientations
   */
  private estimateSkewAngle(lines: OCRLine[]): number | undefined {
    if (lines.length < 3) return undefined;
    
    const angles: number[] = [];
    
    for (const line of lines) {
      if (line.words.length >= 2) {
        const dx = line.bbox.x1 - line.bbox.x0;
        const dy = line.bbox.y1 - line.bbox.y0;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        angles.push(angle);
      }
    }
    
    if (angles.length === 0) return undefined;
    
    // Return median angle to avoid outliers
    angles.sort((a, b) => a - b);
    const midIndex = Math.floor(angles.length / 2);
    return angles.length % 2 === 0 
      ? (angles[midIndex - 1] + angles[midIndex]) / 2 
      : angles[midIndex];
  }

  /**
   * Analyze language confidence based on character patterns and dictionary words
   */
  private analyzeLanguageConfidence(text: string): number {
    // Simple heuristic: ratio of alphabetic to total characters
    const alphaChars = text.match(/[a-zA-Z]/g)?.length || 0;
    const totalChars = text.replace(/\s/g, '').length;
    
    if (totalChars === 0) return 0;
    
    const alphaRatio = alphaChars / totalChars;
    
    // Check for common English words (basic dictionary check)
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = text.toLowerCase().split(/\s+/);
    const commonWordCount = words.filter(word => commonWords.includes(word)).length;
    const commonWordRatio = words.length > 0 ? commonWordCount / words.length : 0;
    
    // Combine metrics (weighted average)
    return (alphaRatio * 0.7) + (commonWordRatio * 0.3);
  }

  /**
   * Calculate ratio of suspicious/garbled characters
   */
  private calculateSuspiciousCharacterRatio(text: string): number {
    // Characters that often indicate OCR errors
    const suspiciousChars = /[~`!@#$%^&*()_+={}\[\]|\\:";'<>?,./§±¶•†‡°¢£¤¥¦©®™´¨≠Æ]/g;
    const suspiciousCount = (text.match(suspiciousChars) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    return totalChars > 0 ? suspiciousCount / totalChars : 0;
  }

  /**
   * Calculate whitespace ratio
   */
  private calculateWhitespaceRatio(text: string): number {
    const whitespaceCount = (text.match(/\s/g) || []).length;
    const totalChars = text.length;
    
    return totalChars > 0 ? whitespaceCount / totalChars : 0;
  }

  /**
   * Calculate digit ratio
   */
  private calculateDigitRatio(text: string): number {
    const digitCount = (text.match(/\d/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    return totalChars > 0 ? digitCount / totalChars : 0;
  }

  /**
   * Calculate uppercase ratio
   */
  private calculateUppercaseRatio(text: string): number {
    const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
    const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
    
    return alphaCount > 0 ? uppercaseCount / alphaCount : 0;
  }

  /**
   * Detect table structure in the document
   */
  private detectTableStructure(pages: OCRPage[], text: string): boolean {
    // Look for table indicators
    const tableIndicators = [
      /\|\s*\w+\s*\|/g,  // Pipe-separated values
      /\t+/g,             // Multiple tabs
      /\s{3,}/g           // Multiple spaces (potential columns)
    ];
    
    // Check for alignment patterns
    for (const page of pages) {
      const lines = page.lines;
      if (lines.length < 3) continue;
      
      // Check for consistent column alignment
      const lineStarts = lines.map(line => line.bbox.x0);
      const uniqueStarts = [...new Set(lineStarts)];
      
      // If multiple lines start at the same positions, might be a table
      if (uniqueStarts.length >= 2 && uniqueStarts.length <= lines.length / 2) {
        return true;
      }
    }
    
    // Check text patterns
    return tableIndicators.some(pattern => pattern.test(text));
  }

  /**
   * Detect handwriting based on confidence patterns
   */
  private detectHandwriting(words: OCRWord[]): boolean {
    if (words.length === 0) return false;
    
    // Handwriting typically has lower and more variable confidence
    const confidences = words.map(word => word.confidence);
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    const variance = this.calculateVariance(confidences);
    
    // Heuristic: low average confidence + high variance suggests handwriting
    return avgConfidence < 0.6 && variance > 0.1;
  }

  /**
   * Assess image quality
   */
  private async assessImageQuality(imagePath: string, correlationId: string): Promise<'poor' | 'fair' | 'good' | 'excellent'> {
    try {
      const metadata = await this.getImageMetadata(imagePath);
      
      // Simple heuristic based on image properties
      const resolution = metadata.width * metadata.height;
      
      if (resolution < 300 * 400) return 'poor';
      if (resolution < 600 * 800) return 'fair';
      if (resolution < 1200 * 1600) return 'good';
      return 'excellent';
      
    } catch (error) {
      logger.warn('Failed to assess image quality', { correlationId, error });
      return 'fair';
    }
  }

  /**
   * Get image metadata using Sharp
   */
  private async getImageMetadata(imagePath: string): Promise<{ width: number; height: number }> {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0
    };
  }

  /**
   * Calculate variance of a numeric array
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return variance;
  }

  /**
   * Fallback quality metrics when calculation fails
   */
  private getFallbackQualityMetrics(text: string): QualityMetrics {
    return {
      averageWordConfidence: 0.5,
      averageLineConfidence: 0.5,
      averageParagraphConfidence: 0.5,
      textDensity: 0,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      characterCount: text.length,
      lineCount: text.split('\n').length,
      textRegions: 1,
      layoutComplexity: 0.5,
      recognizedLanguageConfidence: 0.5,
      suspiciousCharacterRatio: 0.1,
      whitespaceRatio: 0.2,
      digitRatio: 0.1,
      uppercaseRatio: 0.1,
      hasTableStructure: false,
      hasHandwriting: false,
      imageQuality: 'fair'
    };
  }
}

// Export singleton instance
export const ocrEngineService = OCREngineService.getInstance();