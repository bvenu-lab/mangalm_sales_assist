-- Initialize Mangalm Sales Database
-- This script sets up all required tables for the application

-- Create database if not exists
SELECT 'CREATE DATABASE mangalm_sales'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mangalm_sales')\gexec

-- Connect to the database
\c mangalm_sales;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create ENUM types
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'draft', 'pending_review', 'confirmed', 'processing', 
        'shipped', 'delivered', 'cancelled', 'returned'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    contact_person VARCHAR(255),
    region VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    category VARCHAR(100),
    brand VARCHAR(100),
    unit_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    store_id VARCHAR(255) REFERENCES stores(id),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    order_date TIMESTAMP,
    requested_delivery_date TIMESTAMP,
    items JSONB,
    item_count INTEGER DEFAULT 0,
    total_quantity INTEGER DEFAULT 0,
    subtotal_amount DECIMAL(10, 2),
    tax_amount DECIMAL(10, 2),
    total_amount DECIMAL(10, 2),
    totals JSONB,
    status order_status DEFAULT 'pending_review',
    source VARCHAR(50),
    notes TEXT,
    special_instructions TEXT,
    extraction_confidence DECIMAL(3, 2),
    data_quality_score DECIMAL(3, 2),
    manual_verification_required BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(100),
    confirmed_by VARCHAR(100),
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create historical_invoices table
CREATE TABLE IF NOT EXISTS historical_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    invoice_date DATE,
    customer_name VARCHAR(255),
    total_amount DECIMAL(10, 2),
    item_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES historical_invoices(id),
    product_name VARCHAR(255),
    quantity INTEGER,
    unit_price DECIMAL(10, 2),
    total_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create predicted_orders table
CREATE TABLE IF NOT EXISTS predicted_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    predicted_date DATE,
    confidence DECIMAL(3, 2),
    total_amount DECIMAL(10, 2),
    items JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    manual_verification_required BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create predicted_order_items table
CREATE TABLE IF NOT EXISTS predicted_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predicted_order_id UUID REFERENCES predicted_orders(id),
    product_name VARCHAR(255),
    predicted_quantity INTEGER,
    confidence_score DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create call_prioritization table
CREATE TABLE IF NOT EXISTS call_prioritization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) UNIQUE REFERENCES stores(id),
    priority_score DECIMAL(5, 2),
    last_contact_date TIMESTAMP,
    recommended_action TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create product_alerts table
CREATE TABLE IF NOT EXISTS product_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50),
    product_name VARCHAR(255),
    severity VARCHAR(20),
    alert_message TEXT,
    source_type VARCHAR(50),
    source_id UUID,
    is_resolved BOOLEAN DEFAULT FALSE,
    is_learned BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_historical_invoices_store_id ON historical_invoices(store_id);
CREATE INDEX IF NOT EXISTS idx_predicted_orders_store_id ON predicted_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_predicted_orders_date ON predicted_orders(predicted_date);
CREATE INDEX IF NOT EXISTS idx_call_prioritization_priority ON call_prioritization(priority_score DESC);

-- Schema initialization complete - no test data inserted
-- To populate with test data, run separate test data scripts

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Add success message
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
END $$;