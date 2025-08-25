-- Migration to create the orders table - Phase 6
-- Enterprise-grade order management for Mangalm Sales Assistant

-- Create enum types
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

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Order identification
  order_number VARCHAR(50) NOT NULL UNIQUE,
  store_id VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255),
  
  -- Source tracking (from document processing)
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  source_id VARCHAR(255),
  extracted_order_id UUID,
  
  -- Order details
  order_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requested_delivery_date DATE,
  promised_delivery_date DATE,
  order_type order_type NOT NULL DEFAULT 'regular',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  
  -- Status tracking
  status order_status NOT NULL DEFAULT 'draft',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  fulfillment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  
  -- Customer information
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  
  -- Order items and totals
  items JSONB NOT NULL,
  item_count INTEGER NOT NULL,
  total_quantity DECIMAL(10, 2) NOT NULL,
  subtotal_amount DECIMAL(14, 2) NOT NULL,
  tax_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  shipping_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14, 2) NOT NULL,
  totals JSONB NOT NULL,
  
  -- Addresses
  billing_address JSONB,
  shipping_address JSONB,
  
  -- Shipping and payment
  shipping_method shipping_method NOT NULL DEFAULT 'standard',
  payment_method VARCHAR(50),
  payment_terms VARCHAR(100),
  payment_due_date DATE,
  
  -- Tracking and fulfillment
  tracking_info JSONB,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  
  -- Document processing metadata
  extraction_confidence DECIMAL(3, 2),
  data_quality_score DECIMAL(3, 2),
  manual_verification_required BOOLEAN NOT NULL DEFAULT false,
  manually_verified BOOLEAN NOT NULL DEFAULT false,
  verification_notes TEXT,
  
  -- Notes and metadata
  notes TEXT,
  internal_notes TEXT,
  special_instructions TEXT,
  tags VARCHAR[],
  metadata JSONB,
  
  -- User tracking
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  confirmed_by VARCHAR(255),
  confirmed_at TIMESTAMP,
  
  -- Audit trail
  audit_trail JSONB NOT NULL DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT chk_orders_total_positive CHECK (total_amount >= 0),
  CONSTRAINT chk_orders_subtotal_positive CHECK (subtotal_amount >= 0),
  CONSTRAINT chk_orders_item_count_positive CHECK (item_count > 0),
  CONSTRAINT chk_orders_quantity_positive CHECK (total_quantity > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source, source_id);
CREATE INDEX IF NOT EXISTS idx_orders_extracted_order_id ON orders(extracted_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON orders(total_amount);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority);
CREATE INDEX IF NOT EXISTS idx_orders_shipped_at ON orders(shipped_at);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_store_date ON orders(store_id, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders(status, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_verification_status ON orders(manual_verification_required, status);

-- Add foreign key constraint if extracted_orders table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extracted_orders') THEN
    ALTER TABLE orders ADD CONSTRAINT fk_orders_extracted_order_id 
    FOREIGN KEY (extracted_order_id) REFERENCES extracted_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();