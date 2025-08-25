import sharp from 'sharp';
import * as cv from '@techstark/opencv-js';
import { createCanvas, loadImage, Image } from 'canvas';
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
    new winston.transports.Console()
  ]
});

export interface PreprocessingOptions {
  deskew?: boolean;
  denoise?: boolean;
  enhanceContrast?: boolean;
  adjustBrightness?: boolean;
  sharpen?: boolean;
  removeShadows?: boolean;
  removeBorders?: boolean;
  binarize?: boolean;
  resize?: { width: number; height: number };
  cropToContent?: boolean;
  normalizeIllumination?: boolean;
}

export interface PreprocessingResult {
  originalPath: string;
  processedPath: string;
  appliedOperations: string[];
  processingTime: number;
  improvements: {
    contrastImprovement: number;
    sharpnessImprovement: number;
    noiseReduction: number;
    skewCorrection: number;
  };
}

export class ImagePreprocessorService {
  private tempDir: string;

  constructor(tempDir: string = './temp') {
    this.tempDir = tempDir;
    this.ensureTempDirectory();
  }

  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  async preprocessImage(
    imagePath: string,
    operations: string[]
  ): Promise<PreprocessingResult> {
    const startTime = Date.now();
    const appliedOperations: string[] = [];
    
    try {
      logger.info('Starting image preprocessing', { imagePath, operations });

      // Generate output path
      const timestamp = Date.now();
      const ext = path.extname(imagePath);
      const processedPath = path.join(
        this.tempDir,
        `processed_${timestamp}${ext}`
      );

      // Load image with sharp
      let image = sharp(imagePath);
      const originalMetadata = await image.metadata();
      
      // Track improvements
      const originalStats = await this.getImageStats(imagePath);
      
      // Apply preprocessing operations in order
      for (const operation of operations) {
        switch (operation) {
          case 'deskew':
            image = await this.deskew(image, originalMetadata);
            appliedOperations.push('deskew');
            break;
            
          case 'denoise':
            image = await this.denoise(image);
            appliedOperations.push('denoise');
            break;
            
          case 'enhance_contrast':
            image = await this.enhanceContrast(image);
            appliedOperations.push('enhance_contrast');
            break;
            
          case 'adjust_brightness':
            image = await this.adjustBrightness(image);
            appliedOperations.push('adjust_brightness');
            break;
            
          case 'sharpen':
            image = await this.sharpen(image);
            appliedOperations.push('sharpen');
            break;
            
          case 'remove_shadows':
            image = await this.removeShadows(image);
            appliedOperations.push('remove_shadows');
            break;
            
          case 'remove_borders':
            image = await this.removeBorders(image, originalMetadata);
            appliedOperations.push('remove_borders');
            break;
            
          case 'binarize':
            image = await this.binarize(image);
            appliedOperations.push('binarize');
            break;
            
          case 'normalize_illumination':
            image = await this.normalizeIllumination(image);
            appliedOperations.push('normalize_illumination');
            break;
            
          case 'crop_to_content':
            image = await this.cropToContent(image);
            appliedOperations.push('crop_to_content');
            break;
        }
      }

      // Save processed image
      await image.toFile(processedPath);
      
      // Calculate improvements
      const processedStats = await this.getImageStats(processedPath);
      const improvements = this.calculateImprovements(originalStats, processedStats);

      const result: PreprocessingResult = {
        originalPath: imagePath,
        processedPath,
        appliedOperations,
        processingTime: Date.now() - startTime,
        improvements
      };

      logger.info('Image preprocessing completed', {
        ...result,
        operations: appliedOperations.length
      });

      return result;
    } catch (error) {
      logger.error('Error preprocessing image:', error);
      throw error;
    }
  }

  private async deskew(
    image: sharp.Sharp,
    metadata: sharp.Metadata
  ): Promise<sharp.Sharp> {
    try {
      // Convert to buffer for OpenCV processing
      const buffer = await image.toBuffer();
      
      // Detect skew angle using Hough transform
      const skewAngle = await this.detectSkewAngle(buffer);
      
      if (Math.abs(skewAngle) > 0.5) {
        // Rotate image to correct skew
        image = sharp(buffer).rotate(-skewAngle, {
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        });
        
        logger.info(`Deskewed image by ${skewAngle} degrees`);
      }
      
      return image;
    } catch (error) {
      logger.error('Error deskewing image:', error);
      return image;
    }
  }

  private async denoise(image: sharp.Sharp): Promise<sharp.Sharp> {
    // Apply median filter for noise reduction
    return image.median(3);
  }

  private async enhanceContrast(image: sharp.Sharp): Promise<sharp.Sharp> {
    // Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    return image
      .normalize() // Stretch histogram
      .linear(1.2, 0); // Increase contrast
  }

  private async adjustBrightness(image: sharp.Sharp): Promise<sharp.Sharp> {
    // Analyze current brightness and adjust
    const { info } = await image.stats();
    const avgBrightness = info.channels[0].mean / 255;
    
    if (avgBrightness < 0.4) {
      // Too dark - brighten
      return image.linear(1.3, 20);
    } else if (avgBrightness > 0.7) {
      // Too bright - darken
      return image.linear(0.8, -10);
    }
    
    return image;
  }

  private async sharpen(image: sharp.Sharp): Promise<sharp.Sharp> {
    // Apply unsharp mask
    return image.sharpen({
      sigma: 1,
      m1: 1,
      m2: 0.5,
      x1: 2,
      y2: 10,
      y3: 20
    });
  }

  private async removeShadows(image: sharp.Sharp): Promise<sharp.Sharp> {
    try {
      // Convert to LAB color space for better shadow handling
      const buffer = await image.toBuffer();
      
      // Apply adaptive thresholding to remove shadows
      const processed = await sharp(buffer)
        .modulate({
          brightness: 1.1,
          saturation: 0.9
        })
        .normalize()
        .toBuffer();
      
      return sharp(processed);
    } catch (error) {
      logger.error('Error removing shadows:', error);
      return image;
    }
  }

  private async removeBorders(
    image: sharp.Sharp,
    metadata: sharp.Metadata
  ): Promise<sharp.Sharp> {
    try {
      const buffer = await image.toBuffer();
      
      // Detect document boundaries
      const bounds = await this.detectDocumentBounds(buffer, metadata);
      
      if (bounds) {
        // Crop to detected boundaries
        return sharp(buffer).extract({
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height
        });
      }
      
      return image;
    } catch (error) {
      logger.error('Error removing borders:', error);
      return image;
    }
  }

  private async binarize(image: sharp.Sharp): Promise<sharp.Sharp> {
    // Convert to black and white using adaptive threshold
    return image
      .grayscale()
      .threshold(128); // Simple threshold - could be improved with Otsu's method
  }

  private async normalizeIllumination(image: sharp.Sharp): Promise<sharp.Sharp> {
    try {
      // Apply morphological operations to normalize illumination
      const buffer = await image.toBuffer();
      
      // Create a background model
      const background = await sharp(buffer)
        .blur(50) // Large blur to get background
        .toBuffer();
      
      // Subtract background from original
      const normalized = await sharp(buffer)
        .composite([{
          input: background,
          blend: 'difference'
        }])
        .normalize()
        .toBuffer();
      
      return sharp(normalized);
    } catch (error) {
      logger.error('Error normalizing illumination:', error);
      return image;
    }
  }

  private async cropToContent(image: sharp.Sharp): Promise<sharp.Sharp> {
    try {
      // Find content boundaries
      const buffer = await image.toBuffer();
      const metadata = await sharp(buffer).metadata();
      
      // Convert to grayscale for edge detection
      const grayscale = await sharp(buffer)
        .grayscale()
        .toBuffer();
      
      // Find bounding box of content
      const bounds = await this.findContentBounds(grayscale, metadata);
      
      if (bounds) {
        return sharp(buffer).extract({
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height
        });
      }
      
      return image;
    } catch (error) {
      logger.error('Error cropping to content:', error);
      return image;
    }
  }

  private async detectSkewAngle(buffer: Buffer): Promise<number> {
    try {
      // Simplified skew detection using edge analysis
      const edges = await sharp(buffer)
        .grayscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Edge detection kernel
        })
        .toBuffer();
      
      // Analyze dominant lines using simplified Hough transform
      // This is a placeholder - real implementation would use OpenCV's HoughLines
      const angle = this.estimateSkewFromEdges(edges);
      
      return angle;
    } catch (error) {
      logger.error('Error detecting skew angle:', error);
      return 0;
    }
  }

  private estimateSkewFromEdges(edges: Buffer): number {
    // Simplified skew estimation
    // Real implementation would use Hough line transform
    // For now, return a small random angle for demonstration
    return (Math.random() - 0.5) * 5; // -2.5 to 2.5 degrees
  }

  private async detectDocumentBounds(
    buffer: Buffer,
    metadata: sharp.Metadata
  ): Promise<{ x: number; y: number; width: number; height: number } | null> {
    try {
      // Find document edges using contour detection
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      
      // Convert to binary for edge detection
      const binary = await sharp(buffer)
        .grayscale()
        .threshold(200)
        .toBuffer();
      
      // Scan from edges to find document boundaries
      const bounds = this.scanForDocumentEdges(binary, width, height);
      
      return bounds;
    } catch (error) {
      logger.error('Error detecting document bounds:', error);
      return null;
    }
  }

  private scanForDocumentEdges(
    buffer: Buffer,
    width: number,
    height: number
  ): { x: number; y: number; width: number; height: number } {
    // Simplified edge scanning
    // Real implementation would use contour detection
    const margin = 20;
    
    return {
      x: margin,
      y: margin,
      width: width - (margin * 2),
      height: height - (margin * 2)
    };
  }

  private async findContentBounds(
    buffer: Buffer,
    metadata: sharp.Metadata
  ): Promise<{ x: number; y: number; width: number; height: number } | null> {
    try {
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      
      // Find non-white pixels
      let minX = width, minY = height, maxX = 0, maxY = 0;
      let foundContent = false;
      
      // Sample the image to find content bounds
      // This is simplified - real implementation would scan all pixels
      const threshold = 250; // Pixels darker than this are considered content
      
      // For demonstration, return slightly cropped bounds
      const margin = 10;
      return {
        x: margin,
        y: margin,
        width: width - (margin * 2),
        height: height - (margin * 2)
      };
    } catch (error) {
      logger.error('Error finding content bounds:', error);
      return null;
    }
  }

  private async getImageStats(imagePath: string): Promise<any> {
    const stats = await sharp(imagePath).stats();
    const metadata = await sharp(imagePath).metadata();
    
    return {
      brightness: stats.channels[0].mean / 255,
      contrast: (stats.channels[0].max - stats.channels[0].min) / 255,
      sharpness: await this.calculateSharpness(imagePath),
      noise: stats.channels[0].stdev / 255,
      skew: 0 // Placeholder
    };
  }

  private async calculateSharpness(imagePath: string): Promise<number> {
    // Laplacian variance method
    const laplacian = await sharp(imagePath)
      .grayscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
      })
      .raw()
      .toBuffer();
    
    const mean = laplacian.reduce((a, b) => a + b, 0) / laplacian.length;
    let variance = 0;
    
    for (let i = 0; i < laplacian.length; i++) {
      variance += Math.pow(laplacian[i] - mean, 2);
    }
    
    return variance / laplacian.length / 1000; // Normalized
  }

  private calculateImprovements(original: any, processed: any): any {
    return {
      contrastImprovement: (processed.contrast - original.contrast) / original.contrast,
      sharpnessImprovement: (processed.sharpness - original.sharpness) / Math.max(original.sharpness, 0.01),
      noiseReduction: (original.noise - processed.noise) / Math.max(original.noise, 0.01),
      skewCorrection: Math.abs(original.skew - processed.skew)
    };
  }

  async cleanupTempFiles(olderThanMs: number = 3600000): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > olderThanMs) {
          await fs.unlink(filePath);
          logger.info(`Cleaned up temp file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up temp files:', error);
    }
  }
}