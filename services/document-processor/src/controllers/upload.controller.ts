import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { UploadService } from '../services/upload.service';
import { ProcessingQueue } from '../services/processing-queue.service';
import * as winston from 'winston';

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

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/bmp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  }
});

export class UploadController {
  private uploadService: UploadService;
  private processingQueue: ProcessingQueue;

  constructor() {
    this.uploadService = new UploadService();
    this.processingQueue = new ProcessingQueue();
  }

  // Multer middleware for single file upload
  uploadSingle = upload.single('file');

  // Multer middleware for multiple file upload
  uploadMultiple = upload.array('files', 10);

  // Upload single document
  async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file provided'
        });
        return;
      }

      const { storeId, priority, metadata } = req.body;
      const userId = (req as any).user?.id;

      const document = await this.uploadService.uploadDocument(
        {
          filename: req.file.filename || req.file.originalname,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          buffer: req.file.buffer
        },
        {
          storeId,
          userId,
          priority: priority ? parseInt(priority) : undefined,
          metadata: metadata ? JSON.parse(metadata) : undefined
        }
      );

      // Add to processing queue
      await this.processingQueue.addDocument(document.id, {
        priority: document.priority
      });

      res.status(201).json({
        success: true,
        data: {
          documentId: document.id,
          fileName: document.fileName,
          originalName: document.originalName,
          fileSize: document.fileSize,
          status: document.processingStatus,
          uploadedAt: document.createdAt
        },
        message: 'Document uploaded successfully and queued for processing'
      });
    } catch (error: any) {
      logger.error('Error uploading document:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload document'
      });
    }
  }

  // Upload multiple documents
  async uploadMultipleDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No files provided'
        });
        return;
      }

      const { storeId, priority, metadata } = req.body;
      const userId = (req as any).user?.id;

      const uploadedFiles = files.map(file => ({
        filename: file.filename || file.originalname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer
      }));

      const documents = await this.uploadService.uploadMultiple(
        uploadedFiles,
        {
          storeId,
          userId,
          priority: priority ? parseInt(priority) : undefined,
          metadata: metadata ? JSON.parse(metadata) : undefined
        }
      );

      // Add all documents to processing queue
      for (const document of documents) {
        await this.processingQueue.addDocument(document.id, {
          priority: document.priority
        });
      }

      res.status(201).json({
        success: true,
        data: {
          documents: documents.map(doc => ({
            documentId: doc.id,
            fileName: doc.fileName,
            originalName: doc.originalName,
            fileSize: doc.fileSize,
            status: doc.processingStatus,
            uploadedAt: doc.createdAt
          })),
          totalUploaded: documents.length
        },
        message: `${documents.length} documents uploaded successfully and queued for processing`
      });
    } catch (error: any) {
      logger.error('Error uploading multiple documents:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload documents'
      });
    }
  }

  // Get document status
  async getDocumentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const document = await this.uploadService.getDocumentById(documentId);
      
      if (!document) {
        res.status(404).json({
          success: false,
          error: 'Document not found'
        });
        return;
      }

      // Get queue position if pending
      let queuePosition = null;
      if (document.processingStatus === 'pending') {
        queuePosition = await this.processingQueue.getQueuePosition(documentId);
      }

      res.json({
        success: true,
        data: {
          documentId: document.id,
          fileName: document.originalName,
          status: document.processingStatus,
          uploadedAt: document.createdAt,
          processingStartedAt: document.processingStartedAt,
          processingCompletedAt: document.processingCompletedAt,
          processingTimeMs: document.processingTimeMs,
          queuePosition,
          errorMessage: document.errorMessage,
          retryCount: document.retryCount
        }
      });
    } catch (error: any) {
      logger.error('Error getting document status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get document status'
      });
    }
  }

  // Get documents by store
  async getStoreDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;

      const documents = await this.uploadService.getDocumentsByStore(storeId);

      res.json({
        success: true,
        data: {
          documents: documents.map(doc => ({
            documentId: doc.id,
            fileName: doc.originalName,
            fileSize: doc.fileSize,
            status: doc.processingStatus,
            uploadedAt: doc.createdAt,
            processingCompletedAt: doc.processingCompletedAt
          })),
          total: documents.length
        }
      });
    } catch (error: any) {
      logger.error('Error getting store documents:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get store documents'
      });
    }
  }

  // Delete document
  async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      await this.uploadService.deleteDocument(documentId);

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error: any) {
      logger.error('Error deleting document:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete document'
      });
    }
  }

  // Get upload statistics
  async getUploadStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.uploadService.getDocumentStats();
      const queueStats = await this.processingQueue.getQueueStats();

      res.json({
        success: true,
        data: {
          documents: stats,
          queue: queueStats
        }
      });
    } catch (error: any) {
      logger.error('Error getting upload stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get upload statistics'
      });
    }
  }
}