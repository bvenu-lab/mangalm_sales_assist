-- COMPLETE Enterprise Bulk Upload Database Schema
-- This script creates ALL tables and columns that the code actually expects
-- Run this AFTER 01_init.sql

-- Connect to the database
\c mangalm_sales;

-- Create schemas if they don't exist
CREATE SCHEMA IF NOT EXISTS bulk_upload;
CREATE SCHEMA IF NOT EXISTS audit;

-- Drop existing broken tables to start fresh
DROP TABLE IF EXISTS bulk_upload.processing_errors CASCADE;
DROP TABLE IF EXISTS bulk_upload.upload_chunks CASCADE;
DROP TABLE IF EXISTS bulk_upload.upload_jobs CASCADE;
DROP TABLE IF EXISTS bulk_upload.deduplication CASCADE;
DROP TABLE IF EXISTS audit.upload_audit_log CASCADE;
DROP TABLE IF EXISTS historical_invoices CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;

-- Create the invoice_items table first (main data table)
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_no VARCHAR(50) NOT NULL,
    invoice_date DATE,
    month VARCHAR(20),
    year INTEGER,
    salesman_name VARCHAR(255),
    store_name VARCHAR(255),
    store_code VARCHAR(50),
    item_name VARCHAR(255),
    batch_no VARCHAR(50),
    quantity DECIMAL(10,2),
    rate DECIMAL(10,2),
    mrp DECIMAL(10,2),
    discount DECIMAL(10,2),
    amount DECIMAL(10,2),
    company_name VARCHAR(255),
    division VARCHAR(100),
    hq VARCHAR(100),
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invoice_no, item_name, batch_no)
);

-- Create index for better query performance
CREATE INDEX idx_invoice_items_invoice_no ON invoice_items(invoice_no);
CREATE INDEX idx_invoice_items_store ON invoice_items(store_name, store_code);
CREATE INDEX idx_invoice_items_date ON invoice_items(invoice_date);

-- Create historical_invoices table (for bulk upload processing)
CREATE TABLE IF NOT EXISTS historical_invoices (
    id SERIAL PRIMARY KEY,
    invoice_no VARCHAR(50) NOT NULL,
    invoice_date DATE,
    month VARCHAR(20),
    year INTEGER,
    salesman_name VARCHAR(255),
    store_name VARCHAR(255),
    store_code VARCHAR(50),
    item_name VARCHAR(255),
    batch_no VARCHAR(50),
    quantity DECIMAL(10,2),
    rate DECIMAL(10,2),
    mrp DECIMAL(10,2),
    discount DECIMAL(10,2),
    amount DECIMAL(10,2),
    company_name VARCHAR(255),
    division VARCHAR(100),
    hq VARCHAR(100),
    expiry_date DATE,
    hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invoice_no, item_name, batch_no)
);

-- Create upload_jobs table with ALL columns the code expects
CREATE TABLE IF NOT EXISTS bulk_upload.upload_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) UNIQUE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL DEFAULT 'csv',
    file_hash VARCHAR(64),
    status VARCHAR(50) DEFAULT 'pending',
    strategy VARCHAR(50) DEFAULT 'parallel',
    priority INTEGER DEFAULT 0,
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,
    schema_version VARCHAR(10) DEFAULT '1.0',
    user_id INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    processing_time_ms BIGINT,
    rows_per_second DECIMAL(10,2),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for upload_jobs
CREATE INDEX idx_upload_jobs_status ON bulk_upload.upload_jobs(status);
CREATE INDEX idx_upload_jobs_created ON bulk_upload.upload_jobs(created_at DESC);
CREATE INDEX idx_upload_jobs_file_hash ON bulk_upload.upload_jobs(file_hash);

-- Create upload_chunks table
CREATE TABLE IF NOT EXISTS bulk_upload.upload_chunks (
    id SERIAL PRIMARY KEY,
    upload_id UUID REFERENCES bulk_upload.upload_jobs(id) ON DELETE CASCADE,
    chunk_number INTEGER NOT NULL,
    start_row INTEGER NOT NULL,
    end_row INTEGER NOT NULL,
    row_count INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_time_ms BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(upload_id, chunk_number)
);

-- Create index for chunks
CREATE INDEX idx_upload_chunks_upload ON bulk_upload.upload_chunks(upload_id);
CREATE INDEX idx_upload_chunks_status ON bulk_upload.upload_chunks(status);

-- Create processing_errors table with ALL expected columns including batch_id and row_data
CREATE TABLE IF NOT EXISTS bulk_upload.processing_errors (
    id SERIAL PRIMARY KEY,
    upload_id UUID REFERENCES bulk_upload.upload_jobs(id) ON DELETE CASCADE,
    upload_job_id UUID REFERENCES bulk_upload.upload_jobs(id) ON DELETE CASCADE, -- Alternative reference
    batch_id VARCHAR(100), -- Required by enterprise server
    chunk_id INTEGER,
    row_number INTEGER,
    column_name VARCHAR(100),
    error_type VARCHAR(50),
    error_code VARCHAR(50),
    error_message TEXT NOT NULL,
    raw_data JSONB,
    row_data TEXT, -- Required by enterprise server (alternative to raw_data)
    processed_data JSONB,
    error_context JSONB,
    stack_trace TEXT,
    retryable BOOLEAN DEFAULT false,
    retry_count INTEGER DEFAULT 0,
    severity VARCHAR(20) DEFAULT 'error',
    is_resolved BOOLEAN DEFAULT false,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for errors
CREATE INDEX idx_processing_errors_upload ON bulk_upload.processing_errors(upload_id);
CREATE INDEX idx_processing_errors_upload_job ON bulk_upload.processing_errors(upload_job_id);
CREATE INDEX idx_processing_errors_batch ON bulk_upload.processing_errors(batch_id);
CREATE INDEX idx_processing_errors_type ON bulk_upload.processing_errors(error_type);
CREATE INDEX idx_processing_errors_severity ON bulk_upload.processing_errors(severity);
CREATE INDEX idx_processing_errors_unresolved ON bulk_upload.processing_errors(is_resolved) WHERE NOT is_resolved;

-- Create deduplication table
CREATE TABLE IF NOT EXISTS bulk_upload.deduplication (
    id SERIAL PRIMARY KEY,
    record_hash VARCHAR(64) UNIQUE NOT NULL,
    business_key VARCHAR(255),
    first_seen_upload_id UUID,
    duplicate_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for deduplication
CREATE INDEX idx_deduplication_hash ON bulk_upload.deduplication(record_hash);
CREATE INDEX idx_deduplication_key ON bulk_upload.deduplication(business_key);

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit.upload_audit_log (
    id SERIAL PRIMARY KEY,
    upload_id UUID,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    user_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for audit log
CREATE INDEX idx_audit_upload ON audit.upload_audit_log(upload_id);
CREATE INDEX idx_audit_timestamp ON audit.upload_audit_log(timestamp DESC);

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_invoice_items_updated_at ON invoice_items;
CREATE TRIGGER update_invoice_items_updated_at
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_historical_invoices_updated_at ON historical_invoices;
CREATE TRIGGER update_historical_invoices_updated_at
    BEFORE UPDATE ON historical_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_upload_jobs_updated_at ON bulk_upload.upload_jobs;
CREATE TRIGGER update_upload_jobs_updated_at
    BEFORE UPDATE ON bulk_upload.upload_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_upload_chunks_updated_at ON bulk_upload.upload_chunks;
CREATE TRIGGER update_upload_chunks_updated_at
    BEFORE UPDATE ON bulk_upload.upload_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed)
GRANT ALL ON SCHEMA bulk_upload TO postgres;
GRANT ALL ON SCHEMA audit TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA bulk_upload TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA audit TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA bulk_upload TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA audit TO postgres;

-- Verify tables were created
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname IN ('public', 'bulk_upload', 'audit')
ORDER BY schemaname, tablename;

-- Show column counts for verification
SELECT 
    table_schema,
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema IN ('public', 'bulk_upload', 'audit')
    AND table_name IN ('invoice_items', 'historical_invoices', 'upload_jobs', 'upload_chunks', 
                       'processing_errors', 'deduplication', 'upload_audit_log')
GROUP BY table_schema, table_name
ORDER BY table_schema, table_name;

PRINT '==================================================================';
PRINT 'Database schema created successfully!';
PRINT 'All tables and columns that the code expects now exist.';
PRINT '==================================================================';