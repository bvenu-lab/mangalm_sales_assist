import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Check } from 'typeorm';
import { DocumentUpload } from './document-upload.entity';

export interface ExtractedField {
  name: string;
  value: any;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  ocrEngine?: string;
  extractionMethod?: string;
}

export interface ConfidenceScores {
  overall: number;
  fields: {
    [key: string]: number;
  };
  factors?: {
    ocrConfidence: number;
    patternMatch: number;
    dataValidation: number;
    contextualScore: number;
  };
}

export interface ExtractedOrderData {
  storeName?: string;
  storeId?: string;
  orderNumber?: string;
  orderDate?: Date | string;
  deliveryDate?: Date | string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  items: Array<{
    productId?: string;
    productName: string;
    sku?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    unit?: string;
    notes?: string;
  }>;
  subtotal?: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
  rawText?: string;
  extractedFields?: ExtractedField[];
}

@Entity('extracted_orders')
@Index('idx_extracted_orders_review_status', ['reviewed', 'approved'])
@Index('idx_extracted_orders_processing_queue', ['convertedToOrder', 'createdAt'])
export class ExtractedOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => DocumentUpload)
  @JoinColumn({ name: 'document_id' })
  document!: DocumentUpload;

  @Column({ name: 'store_id', type: 'varchar', length: 255, nullable: true })
  @Index('idx_extracted_orders_store_id')
  storeId?: string;

  @Column({ name: 'extracted_data', type: 'jsonb' })
  extractedData!: ExtractedOrderData;

  @Column({ name: 'confidence_scores', type: 'jsonb' })
  confidenceScores!: ConfidenceScores;

  @Column({ name: 'manual_corrections', type: 'jsonb', nullable: true })
  manualCorrections?: any;

  @Column({ name: 'validation_errors', type: 'jsonb', nullable: true })
  validationErrors?: Array<{
    field: string;
    error: string;
    severity: 'error' | 'warning' | 'info';
  }>;

  @Column({ name: 'converted_to_order', type: 'boolean', default: false })
  convertedToOrder!: boolean;

  @Column({ name: 'order_id', type: 'varchar', length: 255, nullable: true })
  @Index('idx_extracted_orders_order_id')
  orderId?: string;

  @Column({ name: 'document_type', type: 'varchar', length: 50, nullable: true })
  documentType?: string;

  @Column({ name: 'quality_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  qualityScore?: number;

  @Column({ name: 'ocr_engine_used', type: 'varchar', length: 50, nullable: true })
  ocrEngineUsed?: string;

  @Column({ name: 'preprocessing_applied', type: 'jsonb', nullable: true })
  preprocessingApplied?: string[];

  @Column({ name: 'extraction_accuracy', type: 'decimal', precision: 3, scale: 2, nullable: true })
  extractionAccuracy?: number;

  @Column({ name: 'reviewed', type: 'boolean', default: false })
  reviewed!: boolean;

  @Column({ name: 'reviewed_by', type: 'varchar', length: 255, nullable: true })
  reviewedBy?: string;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'approved', type: 'boolean', default: false })
  approved!: boolean;

  @Column({ name: 'approved_by', type: 'varchar', length: 255, nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}