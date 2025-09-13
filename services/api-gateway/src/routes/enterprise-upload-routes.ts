/**
 * Enterprise Upload Routes with WebSocket Support
 * Production-grade upload endpoints with real-time progress
 * 
 * @version 3.0.0
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { Server as SocketServer } from 'socket.io';
import { uploadService } from '../services/enterprise-upload-service';
import { logger } from '../utils/logger';

const router = Router();

// Configure rate limiting
const uploadRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window for testing
  max: 1000, // limit each IP to 1000 uploads per windowMs (high limit for testing)
  message: 'Too many upload requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip, 
      path: req.path 
    });
    res.status(429).json({
      success: false,
      error: 'Too many upload requests, please try again later'
    });
  }
});

// Configure multer with enhanced options
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'temp-uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for enterprise
    files: 1,
    fields: 10
  },
  fileFilter: (req, file, cb) => {
    // Enhanced file validation
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      return cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
    }
    
    // Check for double extensions (security)
    const parts = file.originalname.split('.');
    if (parts.length > 2) {
      const suspiciousExtensions = parts.slice(-2);
      if (suspiciousExtensions.some(ext => ['.exe', '.js', '.sh', '.bat'].includes(`.${ext.toLowerCase()}`))) {
        return cb(new Error('Suspicious file detected'));
      }
    }
    
    cb(null, true);
  }
});

// WebSocket setup for real-time progress
export function setupWebSocket(io: SocketServer): void {
  const uploadNamespace = io.of('/upload-progress');
  
  uploadNamespace.on('connection', (socket) => {
    logger.info('WebSocket client connected for upload progress', { 
      socketId: socket.id 
    });
    
    // Subscribe to upload progress
    socket.on('subscribe', (uploadId: string) => {
      socket.join(`upload-${uploadId}`);
      logger.info('Client subscribed to upload', { 
        socketId: socket.id, 
        uploadId 
      });
    });
    
    // Unsubscribe from upload progress
    socket.on('unsubscribe', (uploadId: string) => {
      socket.leave(`upload-${uploadId}`);
    });
    
    socket.on('disconnect', () => {
      logger.info('WebSocket client disconnected', { 
        socketId: socket.id 
      });
    });
  });
  
  // Listen to upload service events
  uploadService.on('progress', (data) => {
    uploadNamespace.to(`upload-${data.uploadId}`).emit('progress', data);
  });
  
  uploadService.on('error', (data) => {
    uploadNamespace.emit('error', data);
  });
  
  uploadService.on('log', (data) => {
    if (data.level === 'error') {
      uploadNamespace.emit('error', data);
    }
  });
}

/**
 * Upload file endpoint with chunked processing
 */
router.post('/upload',
  uploadRateLimiter as any,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }
      
      logger.info('File upload initiated', {
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      });
      
      // Get user info from request (if auth is implemented)
      const userId = (req as any).user?.id;
      
      // Process upload with enterprise service
      const uploadMetadata = await uploadService.processUpload(
        req.file.path,
        req.file.originalname,
        req.file.mimetype,
        userId
      );
      
      res.json({
        success: true,
        uploadId: uploadMetadata.id,
        message: 'File uploaded and processing started',
        metadata: {
          filename: uploadMetadata.originalName,
          size: uploadMetadata.size,
          status: uploadMetadata.status,
          checksum: uploadMetadata.checksum
        }
      });
      
    } catch (error: any) {
      logger.error('Upload error', { error: error.message, stack: error.stack });
      
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({
        success: false,
        error: error.message || 'Upload failed'
      });
    }
  }
);

/**
 * Chunked upload endpoint for very large files
 */
router.post('/upload/chunk',
  // No rate limiting for chunks
  async (req: Request, res: Response) => {
    try {
      const { uploadId, chunkIndex, totalChunks, chunkData } = req.body;
      
      if (!uploadId || chunkIndex === undefined || !totalChunks || !chunkData) {
        return res.status(400).json({
          success: false,
          error: 'Missing required chunk parameters'
        });
      }
      
      // Handle chunk upload
      const chunkDir = path.join(process.cwd(), 'temp-uploads', 'chunks', uploadId);
      if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir, { recursive: true });
      }
      
      const chunkPath = path.join(chunkDir, `chunk-${chunkIndex}`);
      const buffer = Buffer.from(chunkData, 'base64');
      fs.writeFileSync(chunkPath, buffer);
      
      // Check if all chunks received
      const receivedChunks = fs.readdirSync(chunkDir).length;
      
      if (receivedChunks === totalChunks) {
        // Combine chunks
        const combinedPath = path.join(process.cwd(), 'temp-uploads', `${uploadId}-combined`);
        const writeStream = fs.createWriteStream(combinedPath);
        
        for (let i = 0; i < totalChunks; i++) {
          const chunk = fs.readFileSync(path.join(chunkDir, `chunk-${i}`));
          writeStream.write(chunk);
        }
        
        writeStream.end();
        
        // Clean up chunks
        fs.rmSync(chunkDir, { recursive: true, force: true });
        
        // Process combined file
        const metadata = await uploadService.processUpload(
          combinedPath,
          req.body.filename || 'chunked-upload.csv',
          req.body.mimeType || 'text/csv',
          (req as any).user?.id
        );
        
        res.json({
          success: true,
          complete: true,
          uploadId: metadata.id
        });
      } else {
        res.json({
          success: true,
          complete: false,
          received: receivedChunks,
          total: totalChunks
        });
      }
      
    } catch (error: any) {
      logger.error('Chunk upload error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Chunk upload failed'
      });
    }
  }
);

/**
 * Get upload progress
 */
router.get('/upload/:uploadId/progress',
  async (req: Request, res: Response) => {
    try {
      const progress = await uploadService.getUploadProgress(req.params.uploadId);
      
      if (!progress) {
        return res.status(404).json({
          success: false,
          error: 'Upload not found'
        });
      }
      
      res.json({
        success: true,
        data: progress
      });
      
    } catch (error: any) {
      logger.error('Get progress error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get progress'
      });
    }
  }
);

/**
 * Cancel upload
 */
router.post('/upload/:uploadId/cancel',
  async (req: Request, res: Response) => {
    try {
      // Implementation would cancel the upload and clean up
      const uploadId = req.params.uploadId;
      
      // Cancel all jobs for this upload
      await uploadService.cancelUpload(uploadId);
      
      res.json({
        success: true,
        message: 'Upload cancelled'
      });
      
    } catch (error: any) {
      logger.error('Cancel upload error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel upload'
      });
    }
  }
);

/**
 * Retry failed upload
 */
router.post('/upload/:uploadId/retry',
  // No rate limiting for retry
  async (req: Request, res: Response) => {
    try {
      const uploadId = req.params.uploadId;
      
      // Retry failed chunks
      await uploadService.retryUpload(uploadId);
      
      res.json({
        success: true,
        message: 'Retry initiated'
      });
      
    } catch (error: any) {
      logger.error('Retry upload error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retry upload'
      });
    }
  }
);

/**
 * Get upload history
 */
router.get('/uploads/history',
  async (req: Request, res: Response) => {
    try {
      const { limit = 20, offset = 0, status } = req.query;
      
      // Implementation would fetch upload history from database
      const history = {
        uploads: [],
        total: 0,
        limit: Number(limit),
        offset: Number(offset)
      };
      
      res.json({
        success: true,
        data: history
      });
      
    } catch (error: any) {
      logger.error('Get history error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get history'
      });
    }
  }
);

/**
 * Health check endpoint
 */
router.get('/health',
  (req: Request, res: Response) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'enterprise-upload'
    });
  }
);

export default router;