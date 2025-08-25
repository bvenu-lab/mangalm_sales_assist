-- Migration: Create document processing tables for scan-to-order feature
-- Version: 009
-- Date: 2025-08-20
-- Description: Tables for document upload, processing, and order extraction

-- Create document_uploads table
CREATE TABLE IF NOT EXISTS document_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    document_type VARCHAR(20) CHECK (document_type IN ('pdf', 'image', 'scan')) NOT NULL,
    file_size INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_time_ms INTEGER,
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    created_by VARCHAR(255),
    metadata JSONB,
    checksum VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create extracted_orders table
CREATE TABLE IF NOT EXISTS extracted_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES document_uploads(id) ON DELETE CASCADE,
    store_id VARCHAR(255) REFERENCES stores(id) ON DELETE CASCADE,
    extracted_data JSONB NOT NULL,
    confidence_scores JSONB NOT NULL,
    manual_corrections JSONB,
    validation_errors JSONB,
    converted_to_order BOOLEAN DEFAULT FALSE,
    order_id VARCHAR(255),
    document_type VARCHAR(50),
    quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
    ocr_engine_used VARCHAR(50),
    preprocessing_applied JSONB,
    extraction_accuracy DECIMAL(3,2) CHECK (extraction_accuracy >= 0 AND extraction_accuracy <= 1),
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    approved BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ocr_processing_metrics table for analytics
CREATE TABLE IF NOT EXISTS ocr_processing_metrics (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID REFERENCES document_uploads(id) ON DELETE CASCADE,
    document_type VARCHAR(50),
    quality_score DECIMAL(3,2),
    processing_time_ms INTEGER,
    ocr_engine_used VARCHAR(50),
    preprocessing_applied JSONB,
    extraction_accuracy DECIMAL(3,2),
    field_count INTEGER,
    successful_fields INTEGER,
    failed_fields INTEGER,
    confidence_avg DECIMAL(3,2),
    confidence_min DECIMAL(3,2),
    confidence_max DECIMAL(3,2),
    file_size_kb INTEGER,
    page_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_document_uploads_store_id ON document_uploads(store_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_uploads_status ON document_uploads(processing_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_uploads_created_by ON document_uploads(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_uploads_checksum ON document_uploads(checksum) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_uploads_created_at ON document_uploads(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_uploads_priority ON document_uploads(priority DESC, created_at ASC) WHERE processing_status = 'pending' AND deleted_at IS NULL;

CREATE INDEX idx_extracted_orders_document_id ON extracted_orders(document_id);
CREATE INDEX idx_extracted_orders_store_id ON extracted_orders(store_id);
CREATE INDEX idx_extracted_orders_order_id ON extracted_orders(order_id);
CREATE INDEX idx_extracted_orders_converted ON extracted_orders(converted_to_order);
CREATE INDEX idx_extracted_orders_reviewed ON extracted_orders(reviewed, approved);
CREATE INDEX idx_extracted_orders_created_at ON extracted_orders(created_at DESC);

CREATE INDEX idx_ocr_metrics_document_id ON ocr_processing_metrics(document_id);
CREATE INDEX idx_ocr_metrics_engine ON ocr_processing_metrics(ocr_engine_used);
CREATE INDEX idx_ocr_metrics_created_at ON ocr_processing_metrics(created_at DESC);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_uploads_updated_at BEFORE UPDATE ON document_uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_extracted_orders_updated_at BEFORE UPDATE ON extracted_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE document_uploads IS 'Stores uploaded documents for OCR processing';
COMMENT ON TABLE extracted_orders IS 'Stores extracted order data from processed documents';
COMMENT ON TABLE ocr_processing_metrics IS 'Analytics and metrics for OCR processing performance';

COMMENT ON COLUMN document_uploads.processing_status IS 'Current status of document processing';
COMMENT ON COLUMN document_uploads.checksum IS 'SHA-256 hash for duplicate detection';
COMMENT ON COLUMN document_uploads.priority IS 'Processing priority (1=lowest, 10=highest)';

COMMENT ON COLUMN extracted_orders.extracted_data IS 'JSON structure containing all extracted order fields';
COMMENT ON COLUMN extracted_orders.confidence_scores IS 'Confidence scores for each extracted field';
COMMENT ON COLUMN extracted_orders.validation_errors IS 'Array of validation errors found during extraction';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON document_uploads TO mangalm;
GRANT SELECT, INSERT, UPDATE ON extracted_orders TO mangalm;
GRANT SELECT, INSERT ON ocr_processing_metrics TO mangalm;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mangalm;