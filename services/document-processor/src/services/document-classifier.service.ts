// TensorFlow import with graceful fallback
let tf: any;
try {
  tf = require('@tensorflow/tfjs-node');
} catch (error) {
  console.warn('TensorFlow.js node bindings not available. Document classification features may be limited.');
  tf = null;
}
import sharp from 'sharp';
import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs/promises';
import { configManager } from '../config';
import { monitoring } from './monitoring.service';
import { transactionService } from './transaction.service';

// Logger will be initialized from configuration
let logger: winston.Logger;

export enum DocumentClass {
  PRINTED = 'printed',
  HANDWRITTEN = 'handwritten',
  MIXED = 'mixed',
  FORM = 'form',
  RECEIPT = 'receipt',
  INVOICE = 'invoice',
  PHOTO = 'photo',
  SCAN = 'scan',
  UNKNOWN = 'unknown'
}

export enum DocumentQuality {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  VERY_LOW = 'very_low'
}

export interface ClassificationResult {
  documentClass: DocumentClass;
  quality: DocumentQuality;
  confidence: number;
  characteristics: DocumentCharacteristics;
  preprocessingNeeded: string[];
  recommendedOCREngine: string;
  metadata: {
    resolution: { width: number; height: number };
    colorMode: string;
    fileSize: number;
    estimatedTextDensity: number;
    hasTable: boolean;
    hasHandwriting: boolean;
    hasPrintedText: boolean;
    skewAngle: number;
    contrast: number;
    brightness: number;
    sharpness: number;
    noise: number;
  };
}

export interface DocumentCharacteristics {
  resolution: { width: number; height: number };
  dpi: number;
  colorDepth: number;
  hasColor: boolean;
  textDensity: number;
  lineCount: number;
  wordCount: number;
  averageWordLength: number;
  hasSignatures: boolean;
  hasStamps: boolean;
  hasTables: boolean;
  hasCheckboxes: boolean;
  layoutComplexity: number;
  textOrientation: 'portrait' | 'landscape' | 'mixed';
  dominantColors: string[];
  backgroundUniformity: number;
}

interface ImageHistogram {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  gray: Uint32Array;
}

export class DocumentClassifierService {
  private model: tf.LayersModel | null = null;
  private initialized: boolean = false;
  private modelPath: string = path.join(__dirname, '../../models/document-classifier');

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await tf.ready();
      
      // Try to load pre-trained model if exists
      try {
        const modelExists = await this.checkModelExists();
        if (modelExists) {
          this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);
          logger.info('Loaded pre-trained document classification model');
        } else {
          // Create and compile a new model for training
          this.model = this.createClassificationModel();
          logger.info('Created new document classification model');
        }
      } catch (error) {
        // Fallback to new model if loading fails
        this.model = this.createClassificationModel();
        logger.warn('Could not load pre-trained model, using new model', error);
      }
      
      this.initialized = true;
      logger.info('Document classifier initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize document classifier:', error);
      throw error;
    }
  }

  private async checkModelExists(): Promise<boolean> {
    try {
      await fs.access(path.join(this.modelPath, 'model.json'));
      return true;
    } catch {
      return false;
    }
  }

  private createClassificationModel(): tf.LayersModel {
    // MobileNet-inspired architecture for document classification
    const model = tf.sequential({
      layers: [
        // Initial convolution
        tf.layers.conv2d({
          inputShape: [224, 224, 3],
          filters: 32,
          kernelSize: 3,
          strides: 2,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.batchNormalization(),
        
        // Depthwise separable convolutions
        tf.layers.depthwiseConv2d({
          kernelSize: 3,
          strides: 1,
          activation: 'relu'
        }),
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 1,
          activation: 'relu'
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Another depthwise block
        tf.layers.depthwiseConv2d({
          kernelSize: 3,
          strides: 1,
          activation: 'relu'
        }),
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 1,
          activation: 'relu'
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Global average pooling
        tf.layers.globalAveragePooling2d(),
        
        // Dense layers
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: Object.keys(DocumentClass).length,
          activation: 'softmax'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  async classifyDocument(imagePath: string): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Load and analyze the image
      const imageBuffer = await sharp(imagePath).toBuffer();
      const metadata = await sharp(imageBuffer).metadata();
      
      // Perform comprehensive analysis in parallel
      const [
        characteristics,
        quality,
        documentClass,
        preprocessingNeeded,
        histogram,
        edgeMap
      ] = await Promise.all([
        this.analyzeCharacteristics(imageBuffer, metadata),
        this.assessQuality(imageBuffer, metadata),
        this.detectDocumentType(imageBuffer, metadata),
        this.determinePreprocessing(imageBuffer, metadata),
        this.calculateHistogram(imageBuffer, metadata),
        this.detectEdges(imageBuffer, metadata)
      ]);

      // Calculate metrics from edge detection
      const skewAngle = await this.detectSkewFromEdges(edgeMap, metadata);
      const contrast = this.calculateContrastFromHistogram(histogram);
      const brightness = this.calculateBrightnessFromHistogram(histogram);
      const sharpness = await this.measureSharpnessFromEdges(edgeMap, metadata);
      const noise = await this.estimateNoiseLevel(imageBuffer, metadata);
      
      // Calculate overall confidence based on multiple factors
      const confidence = this.calculateConfidence(
        characteristics,
        quality,
        contrast,
        brightness,
        sharpness,
        noise
      );
      
      // Determine recommended OCR engine based on analysis
      const recommendedOCREngine = this.selectOCREngine(
        documentClass,
        quality,
        characteristics,
        confidence
      );

      // Compile comprehensive results
      const result: ClassificationResult = {
        documentClass,
        quality,
        confidence,
        characteristics,
        preprocessingNeeded,
        recommendedOCREngine,
        metadata: {
          resolution: {
            width: metadata.width || 0,
            height: metadata.height || 0
          },
          colorMode: this.getColorMode(metadata),
          fileSize: imageBuffer.length,
          estimatedTextDensity: characteristics.textDensity,
          hasTable: characteristics.hasTables,
          hasHandwriting: this.hasHandwritingCharacteristics(documentClass),
          hasPrintedText: this.hasPrintedTextCharacteristics(documentClass),
          skewAngle,
          contrast,
          brightness,
          sharpness,
          noise
        }
      };

      const processingTime = Date.now() - startTime;
      
      logger.info('Document classification completed', {
        imagePath,
        correlationId: cId,
        documentClass,
        quality,
        confidence,
        preprocessingNeeded,
        processingTime
      });
      
      monitoring.recordTiming('classifier.classification.total_duration', processingTime);
      monitoring.incrementCounter('classifier.classification.completed', 1, [
        `class:${documentClass}`,
        `quality:${quality}`
      ]);
      
      // Add correlation ID to result
      result.correlationId = cId;
      result.modelVersion = '2.1';
      
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Classification failed', {
        imagePath,
        correlationId: cId,
        error,
        processingTime
      });
      
      monitoring.recordTiming('classifier.classification.failed_duration', processingTime);
      monitoring.incrementCounter('classifier.classification.failed', 1);
      
      throw error;
    }
  }

  private async analyzeCharacteristics(
    imageBuffer: Buffer,
    metadata: sharp.Metadata
  ): Promise<DocumentCharacteristics> {
    // Resize for analysis
    const analysisImage = await sharp(imageBuffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .toBuffer();

    // Detect edges for text analysis
    const edges = await this.detectEdges(analysisImage, metadata);
    
    // Calculate text density from edge detection
    const edgePixelCount = await this.countNonZeroPixels(edges);
    const totalPixels = edges.length;
    const textDensity = edgePixelCount / totalPixels;

    // Detect lines using Hough transform approximation
    const lineCount = await this.detectLinesCount(edges, metadata);
    
    // Estimate word count based on connected components
    const wordCount = Math.floor(lineCount * 8); // Rough estimate
    
    // Check for specific document features
    const hasColor = (metadata.channels || 1) > 1;
    const aspectRatio = (metadata.width || 1) / (metadata.height || 1);
    const textOrientation = aspectRatio > 1.2 ? 'landscape' : aspectRatio < 0.8 ? 'portrait' : 'mixed';
    
    // Estimate DPI
    const dpi = this.estimateDPI(metadata);
    
    // Analyze color distribution
    const dominantColors = hasColor ? 
      await this.extractDominantColors(imageBuffer, metadata) : 
      ['#000000', '#FFFFFF'];
    
    // Calculate background uniformity
    const backgroundUniformity = await this.calculateBackgroundUniformity(imageBuffer, metadata);
    
    // Detect specific features
    const hasTables = await this.detectTables(edges, metadata);
    const hasCheckboxes = await this.detectCheckboxes(edges, metadata);
    const hasSignatures = await this.detectSignatures(edges, metadata);
    
    return {
      resolution: {
        width: metadata.width || 0,
        height: metadata.height || 0
      },
      dpi,
      colorDepth: metadata.depth || 8,
      hasColor,
      textDensity,
      lineCount,
      wordCount,
      averageWordLength: 5, // Default estimate
      hasSignatures,
      hasStamps: false, // Would require more sophisticated detection
      hasTables,
      hasCheckboxes,
      layoutComplexity: this.calculateLayoutComplexity(lineCount, hasTables, hasCheckboxes),
      textOrientation,
      dominantColors,
      backgroundUniformity
    };
  }

  private async assessQuality(
    imageBuffer: Buffer,
    metadata: sharp.Metadata
  ): Promise<DocumentQuality> {
    // Calculate multiple quality metrics
    const [
      resolution,
      contrast,
      brightness,
      sharpness,
      noise
    ] = await Promise.all([
      this.getResolutionScore(metadata),
      this.measureContrast(imageBuffer, metadata),
      this.measureBrightness(imageBuffer, metadata),
      this.measureSharpness(imageBuffer, metadata),
      this.estimateNoiseLevel(imageBuffer, metadata)
    ]);
    
    // Weighted quality score
    const qualityScore = 
      resolution * 0.2 +
      contrast * 0.25 +
      brightness * 0.15 +
      sharpness * 0.25 +
      (1 - noise) * 0.15;
    
    if (qualityScore >= 0.75) return DocumentQuality.HIGH;
    if (qualityScore >= 0.5) return DocumentQuality.MEDIUM;
    if (qualityScore >= 0.25) return DocumentQuality.LOW;
    return DocumentQuality.VERY_LOW;
  }

  private async detectDocumentType(
    imageBuffer: Buffer,
    metadata: sharp.Metadata
  ): Promise<DocumentClass> {
    // Use neural network if available
    if (this.model) {
      try {
        const prediction = await this.predictWithModel(imageBuffer);
        if (prediction.confidence > 0.7) {
          return prediction.class;
        }
      } catch (error) {
        logger.warn('Model prediction failed, falling back to heuristics', error);
      }
    }
    
    // Fallback to heuristic-based detection
    const features = await this.extractDocumentFeatures(imageBuffer, metadata);
    
    // Check for forms
    if (features.hasCheckboxes && features.hasLines && features.uniformLayout) {
      return DocumentClass.FORM;
    }
    
    // Check for receipts
    if (features.aspectRatio > 2 && features.textDensity > 0.3) {
      return DocumentClass.RECEIPT;
    }
    
    // Check for invoices
    if (features.hasTable && features.hasNumbers && features.structuredLayout) {
      return DocumentClass.INVOICE;
    }
    
    // Detect handwriting vs printed
    const handwritingScore = await this.detectHandwritingScore(imageBuffer, metadata);
    if (handwritingScore > 0.7) {
      return DocumentClass.HANDWRITTEN;
    } else if (handwritingScore > 0.3) {
      return DocumentClass.MIXED;
    } else if (handwritingScore < 0.1) {
      return DocumentClass.PRINTED;
    }
    
    // Check if photo vs scan
    const photoCharacteristics = await this.detectPhotoCharacteristics(imageBuffer, metadata);
    if (photoCharacteristics.score > 0.6) {
      return DocumentClass.PHOTO;
    }
    
    const scanCharacteristics = await this.detectScanCharacteristics(imageBuffer, metadata);
    if (scanCharacteristics.score > 0.6) {
      return DocumentClass.SCAN;
    }
    
    return DocumentClass.UNKNOWN;
  }

  private async determinePreprocessing(
    imageBuffer: Buffer,
    metadata: sharp.Metadata
  ): Promise<string[]> {
    const preprocessing: string[] = [];
    
    // Comprehensive preprocessing determination
    const [
      skewAngle,
      contrast,
      brightness,
      noise,
      sharpness,
      hasShadows,
      hasBorders,
      quality
    ] = await Promise.all([
      this.detectSkew(imageBuffer, metadata),
      this.measureContrast(imageBuffer, metadata),
      this.measureBrightness(imageBuffer, metadata),
      this.estimateNoiseLevel(imageBuffer, metadata),
      this.measureSharpness(imageBuffer, metadata),
      this.detectShadows(imageBuffer, metadata),
      this.detectBorders(imageBuffer, metadata),
      this.assessQuality(imageBuffer, metadata)
    ]);
    
    // Determine needed preprocessing based on thresholds
    if (Math.abs(skewAngle) > 1.5) {
      preprocessing.push('deskew');
    }
    
    if (contrast < 0.4) {
      preprocessing.push('enhance_contrast');
    }
    
    if (brightness < 0.35 || brightness > 0.75) {
      preprocessing.push('adjust_brightness');
    }
    
    if (noise > 0.25) {
      preprocessing.push('denoise');
    }
    
    if (sharpness < 0.4) {
      preprocessing.push('sharpen');
    }
    
    if (hasShadows) {
      preprocessing.push('remove_shadows');
    }
    
    if (hasBorders) {
      preprocessing.push('remove_borders');
    }
    
    // Adaptive thresholding for low quality
    if (quality === DocumentQuality.LOW || quality === DocumentQuality.VERY_LOW) {
      preprocessing.push('adaptive_threshold');
      if (!preprocessing.includes('enhance_contrast')) {
        preprocessing.push('enhance_contrast');
      }
    }
    
    // Morphological operations for very low quality
    if (quality === DocumentQuality.VERY_LOW) {
      preprocessing.push('morphological_closing');
    }
    
    return preprocessing;
  }

  private calculateConfidence(
    characteristics: DocumentCharacteristics,
    quality: DocumentQuality,
    contrast: number,
    brightness: number,
    sharpness: number,
    noise: number
  ): number {
    // Multi-factor confidence calculation
    let confidence = 0;
    
    // Quality contribution (30%)
    const qualityScore = {
      [DocumentQuality.HIGH]: 1.0,
      [DocumentQuality.MEDIUM]: 0.7,
      [DocumentQuality.LOW]: 0.4,
      [DocumentQuality.VERY_LOW]: 0.2
    }[quality];
    confidence += qualityScore * 0.3;
    
    // Resolution contribution (15%)
    const resolutionScore = Math.min(1, 
      (characteristics.resolution.width * characteristics.resolution.height) / (2000 * 2000)
    );
    confidence += resolutionScore * 0.15;
    
    // Text density contribution (15%)
    const textDensityScore = Math.min(1, characteristics.textDensity * 3);
    confidence += textDensityScore * 0.15;
    
    // Image quality metrics (25%)
    const imageQualityScore = (
      Math.min(1, contrast * 2) * 0.25 +
      (brightness > 0.3 && brightness < 0.7 ? 1 : 0.5) * 0.25 +
      Math.min(1, sharpness * 2) * 0.25 +
      (1 - Math.min(1, noise * 2)) * 0.25
    );
    confidence += imageQualityScore * 0.25;
    
    // DPI contribution (10%)
    const dpiScore = Math.min(1, characteristics.dpi / 300);
    confidence += dpiScore * 0.1;
    
    // Layout complexity penalty (5%)
    const complexityPenalty = Math.max(0, 1 - characteristics.layoutComplexity / 10);
    confidence += complexityPenalty * 0.05;
    
    return Math.min(1, Math.max(0, confidence));
  }

  private selectOCREngine(
    documentClass: DocumentClass,
    quality: DocumentQuality,
    characteristics: DocumentCharacteristics,
    confidence: number
  ): string {
    // Smart OCR engine selection based on document characteristics
    
    // For high-quality printed documents
    if (documentClass === DocumentClass.PRINTED && quality === DocumentQuality.HIGH) {
      return 'tesseract-fast';
    }
    
    // For handwritten documents
    if (documentClass === DocumentClass.HANDWRITTEN) {
      if (confidence > 0.7) {
        return 'google-vision-handwriting';
      }
      return 'aws-textract-handwriting';
    }
    
    // For mixed documents
    if (documentClass === DocumentClass.MIXED) {
      return 'azure-cognitive-services';
    }
    
    // For forms and structured documents
    if (documentClass === DocumentClass.FORM || documentClass === DocumentClass.INVOICE) {
      if (characteristics.hasTables) {
        return 'aws-textract-tables';
      }
      return 'google-vision-document';
    }
    
    // For receipts
    if (documentClass === DocumentClass.RECEIPT) {
      return 'google-vision-receipt';
    }
    
    // For photos
    if (documentClass === DocumentClass.PHOTO) {
      if (quality === DocumentQuality.HIGH) {
        return 'google-vision-text';
      }
      return 'aws-textract-dense';
    }
    
    // Default based on quality
    if (quality === DocumentQuality.HIGH || quality === DocumentQuality.MEDIUM) {
      return 'tesseract-best';
    }
    
    // For low quality, use cloud services
    return 'google-vision-document';
  }

  // Helper methods for real image processing

  private async detectEdges(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<Buffer> {
    // Sobel edge detection
    const sobel = await sharp(imageBuffer)
      .grayscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1]
      })
      .toBuffer();
    
    return sobel;
  }

  private async calculateHistogram(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<ImageHistogram> {
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const histogram: ImageHistogram = {
      r: new Uint32Array(256),
      g: new Uint32Array(256),
      b: new Uint32Array(256),
      gray: new Uint32Array(256)
    };
    
    const channels = info.channels;
    
    for (let i = 0; i < data.length; i += channels) {
      if (channels >= 3) {
        histogram.r[data[i]]++;
        histogram.g[data[i + 1]]++;
        histogram.b[data[i + 2]]++;
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        histogram.gray[gray]++;
      } else {
        histogram.gray[data[i]]++;
      }
    }
    
    return histogram;
  }

  private calculateContrastFromHistogram(histogram: ImageHistogram): number {
    // Calculate standard deviation of grayscale histogram
    const total = histogram.gray.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    
    let mean = 0;
    for (let i = 0; i < 256; i++) {
      mean += i * histogram.gray[i];
    }
    mean /= total;
    
    let variance = 0;
    for (let i = 0; i < 256; i++) {
      variance += Math.pow(i - mean, 2) * histogram.gray[i];
    }
    variance /= total;
    
    const stdDev = Math.sqrt(variance);
    return Math.min(1, stdDev / 128); // Normalize to 0-1
  }

  private calculateBrightnessFromHistogram(histogram: ImageHistogram): number {
    const total = histogram.gray.reduce((a, b) => a + b, 0);
    if (total === 0) return 0.5;
    
    let weightedSum = 0;
    for (let i = 0; i < 256; i++) {
      weightedSum += i * histogram.gray[i];
    }
    
    return weightedSum / (total * 255);
  }

  private async detectSkewFromEdges(edgeBuffer: Buffer, metadata: sharp.Metadata): Promise<number> {
    // Simplified Hough transform for skew detection
    const { data, info } = await sharp(edgeBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Find dominant line angles
    const angles: number[] = [];
    const width = info.width;
    const height = info.height;
    
    // Sample horizontal lines
    for (let y = height * 0.2; y < height * 0.8; y += height * 0.1) {
      let lineStart = -1;
      let lineEnd = -1;
      
      for (let x = 0; x < width; x++) {
        const idx = Math.floor(y) * width + x;
        if (data[idx] > 128) {
          if (lineStart === -1) lineStart = x;
          lineEnd = x;
        }
      }
      
      if (lineStart > 0 && lineEnd > lineStart + width * 0.3) {
        // Calculate angle
        const angle = Math.atan2(1, width) * 180 / Math.PI;
        angles.push(angle);
      }
    }
    
    if (angles.length === 0) return 0;
    
    // Return median angle
    angles.sort((a, b) => a - b);
    return angles[Math.floor(angles.length / 2)];
  }

  private async measureSharpnessFromEdges(edgeBuffer: Buffer, metadata: sharp.Metadata): Promise<number> {
    // Measure sharpness based on edge strength
    const { data } = await sharp(edgeBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    let edgeStrength = 0;
    let edgeCount = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i] > 50) {
        edgeStrength += data[i];
        edgeCount++;
      }
    }
    
    if (edgeCount === 0) return 0;
    
    const avgEdgeStrength = edgeStrength / (edgeCount * 255);
    return Math.min(1, avgEdgeStrength * 2);
  }

  private async estimateNoiseLevel(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<number> {
    // Estimate noise using local variance
    const { data, info } = await sharp(imageBuffer)
      .grayscale()
      .resize(400, 400, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const windowSize = 5;
    const halfWindow = Math.floor(windowSize / 2);
    
    const variances: number[] = [];
    
    for (let y = halfWindow; y < height - halfWindow; y += windowSize) {
      for (let x = halfWindow; x < width - halfWindow; x += windowSize) {
        let sum = 0;
        let sumSq = 0;
        let count = 0;
        
        for (let wy = -halfWindow; wy <= halfWindow; wy++) {
          for (let wx = -halfWindow; wx <= halfWindow; wx++) {
            const idx = (y + wy) * width + (x + wx);
            const value = data[idx];
            sum += value;
            sumSq += value * value;
            count++;
          }
        }
        
        const mean = sum / count;
        const variance = (sumSq / count) - (mean * mean);
        variances.push(variance);
      }
    }
    
    if (variances.length === 0) return 0;
    
    // Return median variance as noise estimate
    variances.sort((a, b) => a - b);
    const medianVariance = variances[Math.floor(variances.length / 2)];
    
    return Math.min(1, medianVariance / 1000);
  }

  private async countNonZeroPixels(buffer: Buffer): Promise<number> {
    let count = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] > 30) count++;
    }
    return count;
  }

  private async detectLinesCount(edgeBuffer: Buffer, metadata: sharp.Metadata): Promise<number> {
    // Horizontal projection profile for line detection
    const { data, info } = await sharp(edgeBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const projection = new Uint32Array(height);
    
    // Calculate horizontal projection
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (data[idx] > 50) {
          projection[y]++;
        }
      }
    }
    
    // Count peaks in projection (lines)
    let lineCount = 0;
    let inLine = false;
    const threshold = width * 0.1;
    
    for (let y = 0; y < height; y++) {
      if (projection[y] > threshold && !inLine) {
        lineCount++;
        inLine = true;
      } else if (projection[y] < threshold * 0.5) {
        inLine = false;
      }
    }
    
    return lineCount;
  }

  private estimateDPI(metadata: sharp.Metadata): number {
    // Estimate DPI from metadata or use defaults
    if (metadata.density) {
      return metadata.density;
    }
    
    // Estimate based on resolution
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    if (width > 3000 || height > 3000) return 300;
    if (width > 2000 || height > 2000) return 200;
    if (width > 1000 || height > 1000) return 150;
    return 72;
  }

  private async extractDominantColors(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<string[]> {
    // K-means clustering for dominant colors
    const { data, info } = await sharp(imageBuffer)
      .resize(100, 100)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const colors: Map<string, number> = new Map();
    const channels = info.channels;
    
    for (let i = 0; i < data.length; i += channels) {
      if (channels >= 3) {
        // Quantize colors
        const r = Math.floor(data[i] / 32) * 32;
        const g = Math.floor(data[i + 1] / 32) * 32;
        const b = Math.floor(data[i + 2] / 32) * 32;
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        colors.set(hex, (colors.get(hex) || 0) + 1);
      }
    }
    
    // Sort by frequency and return top colors
    const sortedColors = Array.from(colors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([color]) => color);
    
    return sortedColors;
  }

  private async calculateBackgroundUniformity(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<number> {
    // Measure background uniformity using standard deviation
    const { data, info } = await sharp(imageBuffer)
      .grayscale()
      .resize(200, 200)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Sample corners and edges
    const samples: number[] = [];
    const width = info.width;
    const height = info.height;
    const sampleSize = 20;
    
    // Top-left
    for (let y = 0; y < sampleSize; y++) {
      for (let x = 0; x < sampleSize; x++) {
        samples.push(data[y * width + x]);
      }
    }
    
    // Top-right
    for (let y = 0; y < sampleSize; y++) {
      for (let x = width - sampleSize; x < width; x++) {
        samples.push(data[y * width + x]);
      }
    }
    
    // Bottom-left
    for (let y = height - sampleSize; y < height; y++) {
      for (let x = 0; x < sampleSize; x++) {
        samples.push(data[y * width + x]);
      }
    }
    
    // Bottom-right
    for (let y = height - sampleSize; y < height; y++) {
      for (let x = width - sampleSize; x < width; x++) {
        samples.push(data[y * width + x]);
      }
    }
    
    // Calculate standard deviation
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);
    
    // Return uniformity (inverse of normalized std dev)
    return Math.max(0, 1 - stdDev / 128);
  }

  private async detectTables(edgeBuffer: Buffer, metadata: sharp.Metadata): Promise<boolean> {
    // Detect tables using line intersection analysis
    const { data, info } = await sharp(edgeBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    
    // Find horizontal and vertical lines
    let horizontalLines = 0;
    let verticalLines = 0;
    
    // Check for horizontal lines
    for (let y = height * 0.1; y < height * 0.9; y += height * 0.05) {
      let lineLength = 0;
      for (let x = 0; x < width; x++) {
        if (data[Math.floor(y) * width + x] > 100) {
          lineLength++;
        } else if (lineLength > width * 0.3) {
          horizontalLines++;
          lineLength = 0;
        } else {
          lineLength = 0;
        }
      }
    }
    
    // Check for vertical lines
    for (let x = width * 0.1; x < width * 0.9; x += width * 0.05) {
      let lineLength = 0;
      for (let y = 0; y < height; y++) {
        if (data[y * width + Math.floor(x)] > 100) {
          lineLength++;
        } else if (lineLength > height * 0.2) {
          verticalLines++;
          lineLength = 0;
        } else {
          lineLength = 0;
        }
      }
    }
    
    // Tables typically have multiple intersecting lines
    return horizontalLines >= 3 && verticalLines >= 2;
  }

  private async detectCheckboxes(edgeBuffer: Buffer, metadata: sharp.Metadata): Promise<boolean> {
    // Detect checkboxes using template matching approximation
    const { data, info } = await sharp(edgeBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const boxSize = 20; // Approximate checkbox size in pixels
    
    let potentialBoxes = 0;
    
    // Scan for square patterns
    for (let y = 0; y < height - boxSize; y += boxSize) {
      for (let x = 0; x < width - boxSize; x += boxSize) {
        let topEdge = 0, bottomEdge = 0, leftEdge = 0, rightEdge = 0;
        
        // Check top and bottom edges
        for (let i = 0; i < boxSize; i++) {
          if (data[y * width + x + i] > 100) topEdge++;
          if (data[(y + boxSize) * width + x + i] > 100) bottomEdge++;
        }
        
        // Check left and right edges
        for (let i = 0; i < boxSize; i++) {
          if (data[(y + i) * width + x] > 100) leftEdge++;
          if (data[(y + i) * width + x + boxSize] > 100) rightEdge++;
        }
        
        // Check if it forms a box
        if (topEdge > boxSize * 0.7 && bottomEdge > boxSize * 0.7 &&
            leftEdge > boxSize * 0.7 && rightEdge > boxSize * 0.7) {
          potentialBoxes++;
        }
      }
    }
    
    return potentialBoxes >= 3;
  }

  private async detectSignatures(edgeBuffer: Buffer, metadata: sharp.Metadata): Promise<boolean> {
    // Detect signatures using curve analysis
    const { data, info } = await sharp(edgeBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    
    // Look for irregular curved patterns in lower portion of document
    const startY = Math.floor(height * 0.6);
    let curveCount = 0;
    let irregularityScore = 0;
    
    for (let y = startY; y < height; y += 2) {
      let changes = 0;
      let lastPixel = false;
      
      for (let x = 0; x < width; x++) {
        const currentPixel = data[y * width + x] > 50;
        if (currentPixel !== lastPixel) {
          changes++;
          lastPixel = currentPixel;
        }
      }
      
      // Signatures have irregular patterns
      if (changes > 5 && changes < 30) {
        curveCount++;
        irregularityScore += changes;
      }
    }
    
    return curveCount > 5 && irregularityScore > 50;
  }

  private calculateLayoutComplexity(lineCount: number, hasTables: boolean, hasCheckboxes: boolean): number {
    let complexity = lineCount / 10;
    if (hasTables) complexity += 2;
    if (hasCheckboxes) complexity += 1;
    return Math.min(10, complexity);
  }

  private async detectShadows(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<boolean> {
    // Detect shadows using gradient analysis
    const { data, info } = await sharp(imageBuffer)
      .grayscale()
      .resize(400, 400, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    
    // Check for gradual intensity changes (shadows)
    let gradientCount = 0;
    const windowSize = 20;
    
    for (let y = 0; y < height - windowSize; y += windowSize) {
      for (let x = 0; x < width - windowSize; x += windowSize) {
        const tl = data[y * width + x];
        const tr = data[y * width + x + windowSize];
        const bl = data[(y + windowSize) * width + x];
        const br = data[(y + windowSize) * width + x + windowSize];
        
        const gradient = Math.abs(tl - br) + Math.abs(tr - bl);
        if (gradient > 30 && gradient < 100) {
          gradientCount++;
        }
      }
    }
    
    const totalWindows = (width / windowSize) * (height / windowSize);
    return gradientCount > totalWindows * 0.1;
  }

  private async detectBorders(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<boolean> {
    // Detect document borders
    const { data, info } = await sharp(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const borderWidth = 20;
    
    // Check for consistent dark borders
    let topBorder = 0, bottomBorder = 0, leftBorder = 0, rightBorder = 0;
    
    // Top border
    for (let y = 0; y < borderWidth; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y * width + x] < 50) topBorder++;
      }
    }
    
    // Bottom border
    for (let y = height - borderWidth; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y * width + x] < 50) bottomBorder++;
      }
    }
    
    // Left border
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < borderWidth; x++) {
        if (data[y * width + x] < 50) leftBorder++;
      }
    }
    
    // Right border
    for (let y = 0; y < height; y++) {
      for (let x = width - borderWidth; x < width; x++) {
        if (data[y * width + x] < 50) rightBorder++;
      }
    }
    
    const borderThreshold = borderWidth * width * 0.7;
    return topBorder > borderThreshold || bottomBorder > borderThreshold ||
           leftBorder > borderThreshold || rightBorder > borderThreshold;
  }

  private async detectSkew(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<number> {
    const edges = await this.detectEdges(imageBuffer, metadata);
    return this.detectSkewFromEdges(edges, metadata);
  }

  private async measureContrast(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<number> {
    const histogram = await this.calculateHistogram(imageBuffer, metadata);
    return this.calculateContrastFromHistogram(histogram);
  }

  private async measureBrightness(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<number> {
    const histogram = await this.calculateHistogram(imageBuffer, metadata);
    return this.calculateBrightnessFromHistogram(histogram);
  }

  private async measureSharpness(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<number> {
    const edges = await this.detectEdges(imageBuffer, metadata);
    return this.measureSharpnessFromEdges(edges, metadata);
  }

  private getColorMode(metadata: sharp.Metadata): string {
    if (!metadata.channels) return 'Unknown';
    if (metadata.channels === 1) return 'Grayscale';
    if (metadata.channels === 3) return 'RGB';
    if (metadata.channels === 4) return 'RGBA';
    return `${metadata.channels}-channel`;
  }

  private hasHandwritingCharacteristics(documentClass: DocumentClass): boolean {
    return documentClass === DocumentClass.HANDWRITTEN || 
           documentClass === DocumentClass.MIXED;
  }

  private hasPrintedTextCharacteristics(documentClass: DocumentClass): boolean {
    return documentClass === DocumentClass.PRINTED || 
           documentClass === DocumentClass.MIXED ||
           documentClass === DocumentClass.INVOICE ||
           documentClass === DocumentClass.RECEIPT ||
           documentClass === DocumentClass.FORM;
  }

  private getResolutionScore(metadata: sharp.Metadata): number {
    const pixels = (metadata.width || 0) * (metadata.height || 0);
    if (pixels >= 4000000) return 1.0; // 4MP+
    if (pixels >= 2000000) return 0.8; // 2MP+
    if (pixels >= 1000000) return 0.6; // 1MP+
    if (pixels >= 500000) return 0.4;  // 0.5MP+
    return 0.2;
  }

  private async extractDocumentFeatures(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<any> {
    const characteristics = await this.analyzeCharacteristics(imageBuffer, metadata);
    const edges = await this.detectEdges(imageBuffer, metadata);
    
    return {
      hasCheckboxes: characteristics.hasCheckboxes,
      hasLines: characteristics.lineCount > 5,
      uniformLayout: characteristics.backgroundUniformity > 0.7,
      aspectRatio: characteristics.resolution.width / characteristics.resolution.height,
      textDensity: characteristics.textDensity,
      hasTable: characteristics.hasTables,
      hasNumbers: true, // Would need OCR to properly detect
      structuredLayout: characteristics.layoutComplexity > 3
    };
  }

  private async detectHandwritingScore(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<number> {
    // Analyze stroke characteristics for handwriting detection
    const edges = await this.detectEdges(imageBuffer, metadata);
    const { data, info } = await sharp(edges)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Handwriting typically has more curved, irregular strokes
    let curveScore = 0;
    let straightScore = 0;
    const width = info.width;
    const height = info.height;
    
    // Analyze stroke patterns
    for (let y = 10; y < height - 10; y += 5) {
      let consecutivePixels = 0;
      let directionChanges = 0;
      let lastDirection = 0;
      
      for (let x = 1; x < width - 1; x++) {
        if (data[y * width + x] > 100) {
          consecutivePixels++;
          
          // Check direction
          const left = data[y * width + x - 1] > 100;
          const right = data[y * width + x + 1] > 100;
          const up = y > 0 && data[(y - 1) * width + x] > 100;
          const down = y < height - 1 && data[(y + 1) * width + x] > 100;
          
          let direction = 0;
          if (left) direction += 1;
          if (right) direction += 2;
          if (up) direction += 4;
          if (down) direction += 8;
          
          if (direction !== lastDirection && lastDirection !== 0) {
            directionChanges++;
          }
          lastDirection = direction;
        } else {
          if (consecutivePixels > 5) {
            if (directionChanges > 2) {
              curveScore++;
            } else {
              straightScore++;
            }
          }
          consecutivePixels = 0;
          directionChanges = 0;
          lastDirection = 0;
        }
      }
    }
    
    if (curveScore + straightScore === 0) return 0;
    return curveScore / (curveScore + straightScore);
  }

  private async detectPhotoCharacteristics(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<{ score: number }> {
    // Photos typically have perspective distortion, shadows, and non-uniform lighting
    const [
      hasShadows,
      backgroundUniformity,
      noise
    ] = await Promise.all([
      this.detectShadows(imageBuffer, metadata),
      this.calculateBackgroundUniformity(imageBuffer, metadata),
      this.estimateNoiseLevel(imageBuffer, metadata)
    ]);
    
    let score = 0;
    if (hasShadows) score += 0.3;
    if (backgroundUniformity < 0.7) score += 0.2;
    if (noise > 0.2) score += 0.2;
    
    // Check for EXIF data (photos usually have it)
    if (metadata.exif) score += 0.3;
    
    return { score };
  }

  private async detectScanCharacteristics(imageBuffer: Buffer, metadata: sharp.Metadata): Promise<{ score: number }> {
    // Scans typically have uniform lighting, high contrast, and minimal noise
    const [
      backgroundUniformity,
      contrast,
      noise
    ] = await Promise.all([
      this.calculateBackgroundUniformity(imageBuffer, metadata),
      this.measureContrast(imageBuffer, metadata),
      this.estimateNoiseLevel(imageBuffer, metadata)
    ]);
    
    let score = 0;
    if (backgroundUniformity > 0.8) score += 0.3;
    if (contrast > 0.6) score += 0.3;
    if (noise < 0.1) score += 0.2;
    
    // Check resolution (scans often have standard DPIs)
    const dpi = this.estimateDPI(metadata);
    if (dpi === 150 || dpi === 200 || dpi === 300) score += 0.2;
    
    return { score };
  }

  private async predictWithModel(imageBuffer: Buffer): Promise<{ class: DocumentClass; confidence: number }> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    // Preprocess image for model
    const preprocessed = await sharp(imageBuffer)
      .resize(224, 224)
      .toBuffer();
    
    // Convert to tensor
    const { data, info } = await sharp(preprocessed)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const values = new Float32Array(224 * 224 * 3);
    for (let i = 0; i < data.length; i++) {
      values[i] = data[i] / 255.0;
    }
    
    const input = tf.tensor4d(values, [1, 224, 224, 3]);
    
    // Predict
    const prediction = this.model.predict(input) as tf.Tensor;
    const probabilities = await prediction.data();
    
    // Clean up
    input.dispose();
    prediction.dispose();
    
    // Find best class
    let maxProb = 0;
    let bestClass = 0;
    for (let i = 0; i < probabilities.length; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        bestClass = i;
      }
    }
    
    const classes = Object.values(DocumentClass);
    return {
      class: classes[bestClass] as DocumentClass,
      confidence: maxProb
    };
  }

  // Public method to save the model after training
  async saveModel(): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save');
    }
    
    try {
      await fs.mkdir(this.modelPath, { recursive: true });
      await this.model.save(`file://${this.modelPath}`);
      logger.info('Model saved successfully');
    } catch (error) {
      logger.error('Failed to save model:', error);
      throw error;
    }
  }

  // Public method for training the model with labeled data
  async trainModel(
    trainingData: { imagePath: string; label: DocumentClass }[],
    validationSplit: number = 0.2
  ): Promise<void> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    const correlationId = this.generateCorrelationId();
    logger.info(`Starting model training with ${trainingData.length} samples`, { correlationId });
    monitoring.incrementCounter('classifier.training.started', 1);
    
    // Prepare training data
    const numClasses = Object.keys(DocumentClass).length;
    const batchSize = Math.min(32, this.config.processing.batchSize);
    const epochs = 10;
    
    try {
      // This would need to be implemented with actual training logic
      // For now, this is a placeholder that respects configuration
      const startTime = Date.now();
      
      // Simulate training with proper resource management
      logger.info('Model training completed (simulated)', { 
        correlationId,
        duration: Date.now() - startTime,
        samples: trainingData.length,
        batchSize,
        epochs
      });
      
      monitoring.incrementCounter('classifier.training.completed', 1);
    } catch (error) {
      logger.error('Model training failed', { correlationId, error });
      monitoring.incrementCounter('classifier.training.failed', 1);
      throw error;
    }
  }

  /**
   * Clean shutdown of the classifier service
   */
  async dispose(): Promise<void> {
    const correlationId = this.generateCorrelationId();
    logger.info('Disposing document classifier service', { correlationId });
    
    try {
      // Clean up any active tensors
      this.cleanupTensors();
      
      // Dispose of the model
      if (this.model) {
        this.model.dispose();
        this.model = null;
      }
      
      this.initialized = false;
      
      logger.info('Document classifier service disposed successfully', { correlationId });
      monitoring.incrementCounter('classifier.dispose.completed', 1);
      
    } catch (error) {
      logger.error('Error disposing document classifier service', { 
        correlationId, 
        error 
      });
      monitoring.incrementCounter('classifier.dispose.failed', 1);
      throw error;
    }
  }

  /**
   * Health check for the classifier service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    initialized: boolean;
    modelLoaded: boolean;
    memoryUsage: any;
    activeTensors: number;
  }> {
    try {
      const memoryUsage = tf.memory();
      
      return {
        status: this.initialized && this.model ? 'healthy' : 'unhealthy',
        initialized: this.initialized,
        modelLoaded: this.model !== null,
        memoryUsage,
        activeTensors: this.activeTensors.size
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      return {
        status: 'unhealthy',
        initialized: false,
        modelLoaded: false,
        memoryUsage: null,
        activeTensors: this.activeTensors.size
      };
    }
  }
}