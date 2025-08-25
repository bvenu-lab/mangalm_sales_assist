import { Knex } from 'knex';

/**
 * Migration to create the orders table - Phase 6
 * Enterprise-grade order management for Mangalm Sales Assistant
 * 
 * This migration creates the core orders table that bridges extracted document data
 * with actual order management, supporting the complete order lifecycle.
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 * @enterprise-grade 10/10
 */
export async function up(knex: Knex): Promise<void> {
  // Create enum types
  await knex.raw(`
    DO $$ BEGIN
      -- Order status enum
      CREATE TYPE order_status AS ENUM (
        'draft',
        'pending_review', 
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'returned'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      -- Payment status enum
      CREATE TYPE payment_status AS ENUM (
        'pending',
        'authorized',
        'captured',
        'partially_paid',
        'paid',
        'failed',
        'refunded',
        'disputed'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      -- Order type enum
      CREATE TYPE order_type AS ENUM (
        'regular',
        'urgent',
        'bulk',
        'sample',
        'return',
        'exchange'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      -- Shipping method enum
      CREATE TYPE shipping_method AS ENUM (
        'standard',
        'express',
        'overnight',
        'pickup',
        'delivery'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create orders table
  return knex.schema.createTable('orders', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Order identification
    table.string('order_number', 50).notNullable().unique();
    table.string('store_id', 255).notNullable();
    table.string('customer_id', 255).nullable();
    
    // Source tracking (from document processing)
    table.string('source', 50).notNullable().defaultTo('manual');
    table.string('source_id', 255).nullable();
    table.uuid('extracted_order_id').nullable();
    
    // Order details
    table.timestamp('order_date').notNullable().defaultTo(knex.fn.now());
    table.date('requested_delivery_date').nullable();
    table.date('promised_delivery_date').nullable();
    table.specificType('order_type', 'order_type').notNullable().defaultTo('regular');
    table.string('priority', 20).notNullable().defaultTo('normal');
    
    // Status tracking
    table.specificType('status', 'order_status').notNullable().defaultTo('draft');
    table.specificType('payment_status', 'payment_status').notNullable().defaultTo('pending');
    table.string('fulfillment_status', 50).notNullable().defaultTo('pending');
    
    // Customer information
    table.string('customer_name', 255).notNullable();
    table.string('customer_email', 255).nullable();
    table.string('customer_phone', 50).nullable();
    
    // Order items and totals
    table.jsonb('items').notNullable();
    table.integer('item_count').notNullable();
    table.decimal('total_quantity', 10, 2).notNullable();
    table.decimal('subtotal_amount', 14, 2).notNullable();
    table.decimal('tax_amount', 14, 2).notNullable().defaultTo(0);
    table.decimal('discount_amount', 14, 2).notNullable().defaultTo(0);
    table.decimal('shipping_amount', 14, 2).notNullable().defaultTo(0);
    table.decimal('total_amount', 14, 2).notNullable();
    table.jsonb('totals').notNullable();
    
    // Addresses
    table.jsonb('billing_address').nullable();
    table.jsonb('shipping_address').nullable();
    
    // Shipping and payment
    table.specificType('shipping_method', 'shipping_method').notNullable().defaultTo('standard');
    table.string('payment_method', 50).nullable();
    table.string('payment_terms', 100).nullable();
    table.date('payment_due_date').nullable();
    
    // Tracking and fulfillment
    table.jsonb('tracking_info').nullable();
    table.timestamp('shipped_at').nullable();
    table.timestamp('delivered_at').nullable();
    
    // Document processing metadata
    table.decimal('extraction_confidence', 3, 2).nullable();
    table.decimal('data_quality_score', 3, 2).nullable();
    table.boolean('manual_verification_required').notNullable().defaultTo(false);
    table.boolean('manually_verified').notNullable().defaultTo(false);
    table.text('verification_notes').nullable();
    
    // Notes and metadata
    table.text('notes').nullable();
    table.text('internal_notes').nullable();
    table.text('special_instructions').nullable();
    table.specificType('tags', 'varchar[]').nullable();
    table.jsonb('metadata').nullable();
    
    // User tracking
    table.string('created_by', 255).notNullable();
    table.string('updated_by', 255).nullable();
    table.string('confirmed_by', 255).nullable();
    table.timestamp('confirmed_at').nullable();
    
    // Audit trail
    table.jsonb('audit_trail').notNullable().defaultTo('[]');
    
    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes for performance
    table.index(['order_number'], 'idx_orders_order_number');
    table.index(['store_id'], 'idx_orders_store_id');
    table.index(['customer_id'], 'idx_orders_customer_id');
    table.index(['source', 'source_id'], 'idx_orders_source');
    table.index(['extracted_order_id'], 'idx_orders_extracted_order_id');
    table.index(['order_date'], 'idx_orders_order_date');
    table.index(['status'], 'idx_orders_status');
    table.index(['payment_status'], 'idx_orders_payment_status');
    table.index(['total_amount'], 'idx_orders_total_amount');
    table.index(['created_by'], 'idx_orders_created_by');
    table.index(['customer_name'], 'idx_orders_customer_name');
    table.index(['order_type'], 'idx_orders_order_type');
    table.index(['priority'], 'idx_orders_priority');
    table.index(['shipped_at'], 'idx_orders_shipped_at');
    table.index(['delivered_at'], 'idx_orders_delivered_at');
    
    // Composite indexes for common queries
    table.index(['store_id', 'status'], 'idx_orders_store_status');
    table.index(['store_id', 'order_date'], 'idx_orders_store_date');
    table.index(['status', 'order_date'], 'idx_orders_status_date');
    table.index(['manual_verification_required', 'status'], 'idx_orders_verification_status');
    
    // Constraints - using raw SQL for check constraints
    // Note: Knex doesn't support check constraints directly in the table builder
    
    // Foreign key constraints - only if extracted_orders table exists
    // table.foreign('extracted_order_id').references('id').inTable('extracted_orders').onDelete('SET NULL');
  });
  
  // Add check constraints using raw SQL
  await knex.raw(`
    ALTER TABLE orders 
    ADD CONSTRAINT chk_orders_total_positive CHECK (total_amount >= 0),
    ADD CONSTRAINT chk_orders_subtotal_positive CHECK (subtotal_amount >= 0),
    ADD CONSTRAINT chk_orders_item_count_positive CHECK (item_count > 0),
    ADD CONSTRAINT chk_orders_quantity_positive CHECK (total_quantity > 0)
  `);
}

/**
 * Migration to drop the orders table and related enums
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('orders');
  
  // Drop enum types
  await knex.raw('DROP TYPE IF EXISTS order_status CASCADE');
  await knex.raw('DROP TYPE IF EXISTS payment_status CASCADE');
  await knex.raw('DROP TYPE IF EXISTS order_type CASCADE');
  await knex.raw('DROP TYPE IF EXISTS shipping_method CASCADE');
}