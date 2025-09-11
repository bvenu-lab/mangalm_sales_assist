-- Create schema for real Mangalam invoice data
\c mangalm_sales;

-- Drop existing table to start fresh
DROP TABLE IF EXISTS mangalam_invoices CASCADE;

-- Create table for real invoice data with all columns
CREATE TABLE mangalam_invoices (
    id SERIAL PRIMARY KEY,
    -- Invoice core fields
    invoice_date DATE,
    invoice_id VARCHAR(100),
    invoice_number VARCHAR(100),
    invoice_status VARCHAR(50),
    
    -- Customer fields
    customer_name VARCHAR(500),
    customer_id VARCHAR(100),
    
    -- Dates
    due_date DATE,
    expected_payment_date DATE,
    last_payment_date DATE,
    
    -- Order info
    purchase_order VARCHAR(100),
    sales_order_number VARCHAR(100),
    
    -- Product fields
    product_id VARCHAR(100),
    item_name VARCHAR(500),
    sku VARCHAR(100),
    brand VARCHAR(200),
    category_name VARCHAR(200),
    item_desc TEXT,
    
    -- Quantities and prices
    quantity DECIMAL(15,4),
    usage_unit VARCHAR(50),
    item_price DECIMAL(15,4),
    mrp DECIMAL(15,4),
    discount DECIMAL(15,4),
    discount_amount DECIMAL(15,4),
    item_total DECIMAL(15,4),
    subtotal DECIMAL(15,4),
    total DECIMAL(15,4),
    balance DECIMAL(15,4),
    
    -- Warehouse
    warehouse_name VARCHAR(200),
    
    -- Sales person
    sales_person VARCHAR(200),
    
    -- Billing address
    billing_city VARCHAR(200),
    billing_state VARCHAR(200),
    billing_country VARCHAR(200),
    billing_code VARCHAR(50),
    
    -- Shipping address  
    shipping_city VARCHAR(200),
    shipping_state VARCHAR(200),
    shipping_country VARCHAR(200),
    shipping_code VARCHAR(50),
    
    -- Metadata
    upload_batch_id VARCHAR(100),
    row_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Create unique constraint on natural key
    UNIQUE(invoice_number, product_id, sku)
);

-- Create indexes for performance
CREATE INDEX idx_mangalam_invoice_number ON mangalam_invoices(invoice_number);
CREATE INDEX idx_mangalam_invoice_date ON mangalam_invoices(invoice_date);
CREATE INDEX idx_mangalam_customer ON mangalam_invoices(customer_name, customer_id);
CREATE INDEX idx_mangalam_product ON mangalam_invoices(item_name, sku);
CREATE INDEX idx_mangalam_batch ON mangalam_invoices(upload_batch_id);
CREATE INDEX idx_mangalam_created ON mangalam_invoices(created_at DESC);

-- Create summary view for quick analytics
CREATE OR REPLACE VIEW invoice_summary AS
SELECT 
    invoice_number,
    invoice_date,
    customer_name,
    COUNT(DISTINCT item_name) as item_count,
    SUM(quantity) as total_quantity,
    SUM(item_total) as invoice_total,
    MIN(created_at) as first_uploaded,
    MAX(updated_at) as last_updated
FROM mangalam_invoices
GROUP BY invoice_number, invoice_date, customer_name;

-- Grant permissions
GRANT ALL ON mangalam_invoices TO postgres;
GRANT ALL ON invoice_summary TO postgres;

-- Verify table creation
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'mangalam_invoices'
ORDER BY ordinal_position;