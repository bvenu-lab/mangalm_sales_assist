-- Fix the missing tables by creating them with correct references
\c mangalm_sales;

-- Create upload_chunks table with correct reference type
CREATE TABLE IF NOT EXISTS bulk_upload.upload_chunks (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER REFERENCES bulk_upload.upload_jobs(id) ON DELETE CASCADE,
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

-- Create processing_errors table with correct reference type
CREATE TABLE IF NOT EXISTS bulk_upload.processing_errors (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER REFERENCES bulk_upload.upload_jobs(id) ON DELETE CASCADE,
    chunk_id INTEGER,
    row_number INTEGER,
    error_type VARCHAR(50),
    error_code VARCHAR(50),
    error_message TEXT,
    raw_data JSONB,
    stack_trace TEXT,
    retryable BOOLEAN DEFAULT false,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_upload_chunks_upload ON bulk_upload.upload_chunks(upload_id);
CREATE INDEX IF NOT EXISTS idx_upload_chunks_status ON bulk_upload.upload_chunks(status);
CREATE INDEX IF NOT EXISTS idx_processing_errors_upload ON bulk_upload.processing_errors(upload_id);
CREATE INDEX IF NOT EXISTS idx_processing_errors_type ON bulk_upload.processing_errors(error_type);

-- Verify all tables exist
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema IN ('bulk_upload', 'audit') 
ORDER BY 1,2;