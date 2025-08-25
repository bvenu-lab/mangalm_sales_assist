import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { config } from '../config';
import { AppDataSource } from '../database/connection';
import { DocumentUpload, ProcessingStatus, DocumentType } from '../models/document-upload.entity';
import { Repository } from 'typeorm';
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

export interface UploadedFile {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
}

export interface UploadOptions {
  storeId?: string;
  userId?: string;
  priority?: number;
  metadata?: any;
}

export class UploadService {
  private documentRepository: Repository<DocumentUpload>;

  constructor() {
    this.documentRepository = AppDataSource.getRepository(DocumentUpload);
  }

  async uploadDocument(file: UploadedFile, options: UploadOptions = {}): Promise<DocumentUpload> {
    try {
      // Validate file
      await this.validateFile(file);

      // Validate store if provided
      if (options.storeId) {
        await this.validateStore(options.storeId, options.userId);
      }

      // Generate unique filename
      const fileExt = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${fileExt}`;
      
      // Determine document type
      const documentType = this.determineDocumentType(file.mimetype);
      
      // Create upload directory if it doesn't exist
      await this.ensureUploadDirectory();
      
      // Save file to disk
      const filePath = path.join(config.upload.uploadDir, uniqueFilename);
      
      if (file.buffer) {
        await fs.writeFile(filePath, file.buffer);
      } else if (file.path) {
        await fs.copyFile(file.path, filePath);
      } else {
        throw new Error('No file data available');
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(filePath);

      // Check for duplicate uploads
      const existingDocument = await this.documentRepository.findOne({
        where: { checksum, deletedAt: null }
      });

      if (existingDocument) {
        logger.info(`Duplicate document detected: ${existingDocument.id}`);
        // Remove the duplicate file
        await fs.unlink(filePath);
        return existingDocument;
      }

      // Create database record
      const document = this.documentRepository.create({
        fileName: uniqueFilename,
        originalName: file.originalname,
        fileType: file.mimetype,
        documentType,
        fileSize: file.size,
        filePath,
        mimeType: file.mimetype,
        processingStatus: ProcessingStatus.PENDING,
        storeId: options.storeId,
        createdBy: options.userId,
        priority: options.priority || 5,
        metadata: options.metadata,
        checksum,
        retryCount: 0
      });

      await this.documentRepository.save(document);
      
      logger.info(`Document uploaded successfully: ${document.id}`);
      return document;
    } catch (error) {
      logger.error('Error uploading document:', error);
      throw error;
    }
  }

  async uploadMultiple(files: UploadedFile[], options: UploadOptions = {}): Promise<DocumentUpload[]> {
    const documents: DocumentUpload[] = [];
    
    for (const file of files) {
      try {
        const document = await this.uploadDocument(file, options);
        documents.push(document);
      } catch (error) {
        logger.error(`Error uploading file ${file.originalname}:`, error);
        // Continue with other files even if one fails
      }
    }
    
    return documents;
  }

  async getDocumentById(id: string): Promise<DocumentUpload | null> {
    return this.documentRepository.findOne({
      where: { id, deletedAt: null }
    });
  }

  async getDocumentsByStore(storeId: string): Promise<DocumentUpload[]> {
    return this.documentRepository.find({
      where: { storeId, deletedAt: null },
      order: { createdAt: 'DESC' }
    });
  }

  async updateProcessingStatus(
    documentId: string, 
    status: ProcessingStatus, 
    errorMessage?: string,
    errorDetails?: any
  ): Promise<void> {
    const updates: Partial<DocumentUpload> = {
      processingStatus: status
    };

    if (status === ProcessingStatus.PROCESSING) {
      updates.processingStartedAt = new Date();
    } else if (status === ProcessingStatus.COMPLETED || status === ProcessingStatus.FAILED) {
      updates.processingCompletedAt = new Date();
      
      const document = await this.getDocumentById(documentId);
      if (document && document.processingStartedAt) {
        updates.processingTimeMs = Date.now() - document.processingStartedAt.getTime();
      }
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
      updates.errorDetails = errorDetails;
    }

    await this.documentRepository.update(documentId, updates);
  }

  async deleteDocument(id: string): Promise<void> {
    const document = await this.getDocumentById(id);
    if (!document) {
      throw new Error('Document not found');
    }

    // Soft delete
    await this.documentRepository.update(id, {
      deletedAt: new Date()
    });

    // Delete physical file after a delay (for recovery purposes)
    setTimeout(async () => {
      try {
        await fs.unlink(document.filePath);
        logger.info(`Physical file deleted: ${document.filePath}`);
      } catch (error) {
        logger.error(`Error deleting physical file: ${document.filePath}`, error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  async getProcessingQueue(limit: number = 10): Promise<DocumentUpload[]> {
    return this.documentRepository.find({
      where: { 
        processingStatus: ProcessingStatus.PENDING,
        deletedAt: null 
      },
      order: { 
        priority: 'DESC',
        createdAt: 'ASC' 
      },
      take: limit
    });
  }

  async incrementRetryCount(documentId: string): Promise<void> {
    const document = await this.getDocumentById(documentId);
    if (document) {
      await this.documentRepository.update(documentId, {
        retryCount: document.retryCount + 1
      });
    }
  }

  private async validateFile(file: UploadedFile): Promise<void> {
    // Check file size
    if (file.size > config.upload.maxFileSize) {
      throw new Error(`File size exceeds maximum limit of ${config.upload.maxFileSize} bytes`);
    }

    // Check file type
    if (!config.upload.allowedFileTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    // Additional validation for specific file types
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp'];
    
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`File extension ${ext} is not allowed`);
    }
  }

  private async validateStore(storeId: string, userId?: string): Promise<void> {
    // In a real implementation, this would check:
    // 1. Store exists in database
    // 2. Store is active/not deleted
    // 3. User has permission to upload to this store
    
    // For now, basic validation
    if (!storeId || storeId.trim() === '') {
      throw new Error('Store ID is required for document upload');
    }

    // Check if store ID is a valid format (assuming numeric or UUID)
    const isValidStoreId = /^[0-9a-f-]+$/i.test(storeId);
    if (!isValidStoreId) {
      throw new Error('Invalid store ID format');
    }

    // TODO: Add actual database check when store repository is available
    // const store = await this.storeRepository.findOne({ where: { id: storeId } });
    // if (!store) {
    //   throw new Error(`Store with ID ${storeId} not found`);
    // }
    // if (!store.active) {
    //   throw new Error(`Store ${store.name} is not active`);
    // }

    logger.info(`Store ${storeId} validated for document upload`);
  }

  private determineDocumentType(mimetype: string): DocumentType {
    if (mimetype === 'application/pdf') {
      return DocumentType.PDF;
    } else if (mimetype.startsWith('image/')) {
      return DocumentType.IMAGE;
    } else {
      return DocumentType.SCAN;
    }
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(config.upload.uploadDir);
    } catch {
      await fs.mkdir(config.upload.uploadDir, { recursive: true });
    }

    try {
      await fs.access(config.upload.tempDir);
    } catch {
      await fs.mkdir(config.upload.tempDir, { recursive: true });
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  async getDocumentStats(): Promise<any> {
    const total = await this.documentRepository.count({ where: { deletedAt: null } });
    const pending = await this.documentRepository.count({ 
      where: { processingStatus: ProcessingStatus.PENDING, deletedAt: null } 
    });
    const processing = await this.documentRepository.count({ 
      where: { processingStatus: ProcessingStatus.PROCESSING, deletedAt: null } 
    });
    const completed = await this.documentRepository.count({ 
      where: { processingStatus: ProcessingStatus.COMPLETED, deletedAt: null } 
    });
    const failed = await this.documentRepository.count({ 
      where: { processingStatus: ProcessingStatus.FAILED, deletedAt: null } 
    });

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      successRate: total > 0 ? (completed / total * 100).toFixed(2) : 0
    };
  }
}