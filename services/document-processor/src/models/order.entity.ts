/**
 * Order Entity - Phase 6
 * Enterprise-Grade Order Management for Mangalm Sales Assistant
 * 
 * This entity represents actual orders created from processed documents
 * with comprehensive order lifecycle management and audit trails
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 * @enterprise-grade 10/10
 */

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index, Check } from 'typeorm';
import { ExtractedOrder } from './extracted-order.entity';

export enum OrderStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned'
}

export enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed'
}

export enum OrderType {
  REGULAR = 'regular',
  URGENT = 'urgent',
  BULK = 'bulk',
  SAMPLE = 'sample',
  RETURN = 'return',
  EXCHANGE = 'exchange'
}

export enum ShippingMethod {
  STANDARD = 'standard',
  EXPRESS = 'express',
  OVERNIGHT = 'overnight',
  PICKUP = 'pickup',
  DELIVERY = 'delivery'
}

export interface OrderItem {
  id?: string;
  productId?: string;
  productName: string;
  productCode?: string;
  sku?: string;
  description?: string;
  category?: string;
  brand?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  tax?: number;
  discount?: number;
  discountPercent?: number;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  notes?: string;
  extractionConfidence?: number;
  manuallyVerified?: boolean;
}

export interface OrderAddress {
  type: 'billing' | 'shipping';
  name: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
  isDefault?: boolean;
}

export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  taxRate?: number;
  discountAmount?: number;
  discountPercent?: number;
  shippingAmount?: number;
  handlingAmount?: number;
  adjustmentAmount?: number;
  total: number;
}

export interface OrderTracking {
  trackingNumber?: string;
  carrier?: string;
  shippedAt?: Date;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  trackingUrl?: string;
  shippingLabel?: string;
}

export interface OrderAudit {
  action: string;
  userId: string;
  userName: string;
  timestamp: Date;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Entity('orders')
@Index('idx_orders_store_id', ['storeId'])
@Index('idx_orders_status', ['status'])
@Index('idx_orders_order_date', ['orderDate'])
@Index('idx_orders_total_amount', ['totalAmount'])
@Index('idx_orders_source', ['source', 'sourceId'])
@Check('chk_orders_total_positive', '"total_amount" >= 0')
@Check('chk_orders_quantity_positive', 'EXISTS (SELECT 1 FROM jsonb_array_elements("items") AS item WHERE (item->>"quantity")::numeric > 0)')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Order identification
  @Column({ name: 'order_number', type: 'varchar', length: 50, unique: true })
  @Index('idx_orders_order_number')
  orderNumber!: string;

  @Column({ name: 'store_id', type: 'varchar', length: 255 })
  @Index('idx_orders_store_id')
  storeId!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 255, nullable: true })
  @Index('idx_orders_customer_id')
  customerId?: string;

  // Source tracking (from document processing)
  @Column({ name: 'source', type: 'varchar', length: 50, default: 'manual' })
  source!: string; // 'document', 'manual', 'api', 'prediction', 'import'

  @Column({ name: 'source_id', type: 'varchar', length: 255, nullable: true })
  sourceId?: string; // extracted_order_id, document_id, etc.

  @Column({ name: 'extracted_order_id', type: 'uuid', nullable: true })
  extractedOrderId?: string;

  @ManyToOne(() => ExtractedOrder, { nullable: true })
  @JoinColumn({ name: 'extracted_order_id' })
  extractedOrder?: ExtractedOrder;

  // Order details
  @Column({ name: 'order_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  orderDate!: Date;

  @Column({ name: 'requested_delivery_date', type: 'date', nullable: true })
  requestedDeliveryDate?: Date;

  @Column({ name: 'promised_delivery_date', type: 'date', nullable: true })
  promisedDeliveryDate?: Date;

  @Column({ name: 'order_type', type: 'enum', enum: OrderType, default: OrderType.REGULAR })
  orderType!: OrderType;

  @Column({ name: 'priority', type: 'varchar', length: 20, default: 'normal' })
  priority!: string; // 'low', 'normal', 'high', 'urgent'

  // Status tracking
  @Column({ name: 'status', type: 'enum', enum: OrderStatus, default: OrderStatus.DRAFT })
  status!: OrderStatus;

  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;

  @Column({ name: 'fulfillment_status', type: 'varchar', length: 50, default: 'pending' })
  fulfillmentStatus!: string;

  // Customer information
  @Column({ name: 'customer_name', type: 'varchar', length: 255 })
  customerName!: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 255, nullable: true })
  customerEmail?: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 50, nullable: true })
  customerPhone?: string;

  // Order items and totals
  @Column({ name: 'items', type: 'jsonb' })
  items!: OrderItem[];

  @Column({ name: 'item_count', type: 'integer' })
  itemCount!: number;

  @Column({ name: 'total_quantity', type: 'decimal', precision: 10, scale: 2 })
  totalQuantity!: number;

  @Column({ name: 'subtotal_amount', type: 'decimal', precision: 14, scale: 2 })
  subtotalAmount!: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  taxAmount!: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  discountAmount!: number;

  @Column({ name: 'shipping_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  shippingAmount!: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2 })
  totalAmount!: number;

  @Column({ name: 'totals', type: 'jsonb' })
  totals!: OrderTotals;

  // Addresses
  @Column({ name: 'billing_address', type: 'jsonb', nullable: true })
  billingAddress?: OrderAddress;

  @Column({ name: 'shipping_address', type: 'jsonb', nullable: true })
  shippingAddress?: OrderAddress;

  // Shipping and payment
  @Column({ name: 'shipping_method', type: 'enum', enum: ShippingMethod, default: ShippingMethod.STANDARD })
  shippingMethod!: ShippingMethod;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  @Column({ name: 'payment_terms', type: 'varchar', length: 100, nullable: true })
  paymentTerms?: string;

  @Column({ name: 'payment_due_date', type: 'date', nullable: true })
  paymentDueDate?: Date;

  // Tracking and fulfillment
  @Column({ name: 'tracking_info', type: 'jsonb', nullable: true })
  trackingInfo?: OrderTracking;

  @Column({ name: 'shipped_at', type: 'timestamp', nullable: true })
  shippedAt?: Date;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  // Document processing metadata
  @Column({ name: 'extraction_confidence', type: 'decimal', precision: 3, scale: 2, nullable: true })
  extractionConfidence?: number;

  @Column({ name: 'data_quality_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  dataQualityScore?: number;

  @Column({ name: 'manual_verification_required', type: 'boolean', default: false })
  manualVerificationRequired!: boolean;

  @Column({ name: 'manually_verified', type: 'boolean', default: false })
  manuallyVerified!: boolean;

  @Column({ name: 'verification_notes', type: 'text', nullable: true })
  verificationNotes?: string;

  // Notes and metadata
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes?: string;

  @Column({ name: 'special_instructions', type: 'text', nullable: true })
  specialInstructions?: string;

  @Column({ name: 'tags', type: 'varchar', array: true, nullable: true })
  tags?: string[];

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: any;

  // User tracking
  @Column({ name: 'created_by', type: 'varchar', length: 255 })
  createdBy!: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updatedBy?: string;

  @Column({ name: 'confirmed_by', type: 'varchar', length: 255, nullable: true })
  confirmedBy?: string;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt?: Date;

  // Audit trail
  @Column({ name: 'audit_trail', type: 'jsonb', default: '[]' })
  auditTrail!: OrderAudit[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Computed properties
  get isFromDocument(): boolean {
    return this.source === 'document' && !!this.extractedOrderId;
  }

  get requiresReview(): boolean {
    return this.status === OrderStatus.PENDING_REVIEW || 
           this.manualVerificationRequired || 
           !this.manuallyVerified ||
           (this.extractionConfidence && this.extractionConfidence < 0.8);
  }

  get isEditable(): boolean {
    return [OrderStatus.DRAFT, OrderStatus.PENDING_REVIEW].includes(this.status);
  }

  get canBeCancelled(): boolean {
    return ![OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.RETURNED].includes(this.status);
  }

  // Helper methods
  calculateTotals(): OrderTotals {
    const subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalTax = this.items.reduce((sum, item) => sum + (item.tax || 0), 0);
    const totalDiscount = this.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    
    return {
      subtotal,
      taxAmount: totalTax,
      discountAmount: totalDiscount,
      shippingAmount: this.shippingAmount || 0,
      total: subtotal + totalTax - totalDiscount + (this.shippingAmount || 0)
    };
  }

  addAuditEntry(action: string, userId: string, userName: string, details?: any): void {
    const auditEntry: OrderAudit = {
      action,
      userId,
      userName,
      timestamp: new Date(),
      details
    };
    
    this.auditTrail = [...(this.auditTrail || []), auditEntry];
  }

  updateStatus(newStatus: OrderStatus, userId: string, userName: string, notes?: string): void {
    const oldStatus = this.status;
    this.status = newStatus;
    this.updatedBy = userId;
    
    this.addAuditEntry('status_change', userId, userName, {
      from: oldStatus,
      to: newStatus,
      notes
    });

    // Set confirmation details if confirming
    if (newStatus === OrderStatus.CONFIRMED && oldStatus !== OrderStatus.CONFIRMED) {
      this.confirmedBy = userId;
      this.confirmedAt = new Date();
    }
  }
}