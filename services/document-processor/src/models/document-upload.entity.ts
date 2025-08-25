import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index, Check } from 'typeorm';

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum DocumentType {
  PDF = 'pdf',
  IMAGE = 'image',
  SCAN = 'scan'
}

@Entity('document_uploads')
@Index('idx_document_uploads_priority_queue', ['priority', 'createdAt'], {
  where: "processing_status = 'pending' AND deleted_at IS NULL"
})
@Index('idx_document_uploads_active', ['storeId', 'processingStatus'], {
  where: "deleted_at IS NULL"
})
export class DocumentUpload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'store_id', type: 'varchar', length: 255, nullable: true })
  @Index('idx_document_uploads_store_id')
  storeId?: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'file_type', type: 'varchar', length: 50 })
  fileType!: string;

  @Column({ name: 'document_type', type: 'enum', enum: DocumentType })
  documentType!: DocumentType;

  @Column({ name: 'file_size', type: 'integer' })
  fileSize!: number;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ 
    name: 'processing_status', 
    type: 'enum', 
    enum: ProcessingStatus,
    default: ProcessingStatus.PENDING 
  })
  @Index('idx_document_uploads_status')
  processingStatus!: ProcessingStatus;

  @Column({ name: 'processing_started_at', type: 'timestamp', nullable: true })
  processingStartedAt?: Date;

  @Column({ name: 'processing_completed_at', type: 'timestamp', nullable: true })
  processingCompletedAt?: Date;

  @Column({ name: 'processing_time_ms', type: 'integer', nullable: true })
  processingTimeMs?: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails?: any;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  @Column({ name: 'priority', type: 'integer', default: 5 })
  @Check('priority >= 1 AND priority <= 10')
  @Index('idx_document_uploads_priority')
  priority!: number;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  @Index('idx_document_uploads_created_by')
  createdBy?: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: any;

  @Column({ name: 'checksum', type: 'varchar', length: 64, nullable: true, unique: true })
  @Index('idx_document_uploads_checksum')
  checksum?: string;

  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_document_uploads_created_at')
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date;
}