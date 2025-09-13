-- =====================================================
-- FIX SCHEMA MISMATCHES TO MAKE EVERYTHING WORK TOGETHER
-- =====================================================

-- 1. Fix orders table - add missing columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS order_number VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS delivery_date DATE,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

-- 2. Fix call_prioritization table - add missing columns
ALTER TABLE call_prioritization 
ADD COLUMN IF NOT EXISTS days_since_last_order INTEGER DEFAULT 0;

-- 3. Fix stores table - add customer_number for joining with invoices
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS customer_number VARCHAR(255);

-- Update customer_number from existing data
UPDATE stores 
SET customer_number = COALESCE(
  REGEXP_REPLACE(id, '[^0-9]', '', 'g'),
  SUBSTRING(id FROM 1 FOR 20)
)
WHERE customer_number IS NULL;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stores_customer_number ON stores(customer_number);
CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(name);
CREATE INDEX IF NOT EXISTS idx_mangalam_invoices_customer_name ON mangalam_invoices(customer_name);
CREATE INDEX IF NOT EXISTS idx_mangalam_invoices_customer_id ON mangalam_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_predicted_orders_store_id ON predicted_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_call_prioritization_store_id ON call_prioritization(store_id);

-- Schema modifications complete - no test data generated

