-- Enterprise Upload System Tables
-- Version 3.0.0

-- Upload status tracking table
CREATE TABLE IF NOT EXISTS upload_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id VARCHAR(255) UNIQUE NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    checksum VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    cancelled_at TIMESTAMP,
    error_details JSONB,
    validation_errors JSONB,
    metadata JSONB,
    user_id UUID,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_upload_status_upload_id ON upload_status(upload_id);
CREATE INDEX idx_upload_status_status ON upload_status(status);
CREATE INDEX idx_upload_status_user_id ON upload_status(user_id);
CREATE INDEX idx_upload_status_created_at ON upload_status(created_at DESC);

-- Upload chunks table for resumable uploads
CREATE TABLE IF NOT EXISTS upload_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id VARCHAR(255) NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_size BIGINT NOT NULL,
    chunk_hash VARCHAR(64),
    chunk_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP,
    processed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(upload_id, chunk_index)
);

CREATE INDEX idx_upload_chunks_upload_id ON upload_chunks(upload_id);

-- Audit logs table for tracking all operations
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    request_data JSONB,
    response_data JSONB,
    error_details JSONB,
    duration_ms INTEGER,
    status_code INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for audit logs
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Data validation errors table
CREATE TABLE IF NOT EXISTS validation_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id VARCHAR(255) NOT NULL,
    row_index INTEGER,
    errors JSONB,
    row_number INTEGER,
    column_name VARCHAR(255),
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    raw_value TEXT,
    suggested_value TEXT,
    severity VARCHAR(20) DEFAULT 'error',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validation_errors_upload_id ON validation_errors(upload_id);
CREATE INDEX idx_validation_errors_severity ON validation_errors(severity);

-- Processing queue table for background jobs
CREATE TABLE IF NOT EXISTS processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id VARCHAR(255) NOT NULL,
    job_type VARCHAR(100) NOT NULL,
    priority INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    payload JSONB,
    result JSONB,
    error_details JSONB,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processing_queue_upload_id ON processing_queue(upload_id);
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_priority ON processing_queue(priority DESC);
CREATE INDEX idx_processing_queue_scheduled_at ON processing_queue(scheduled_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_upload_status_updated_at BEFORE UPDATE ON upload_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_queue_updated_at BEFORE UPDATE ON processing_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE upload_status IS 'Tracks all file uploads and their processing status';
COMMENT ON TABLE upload_chunks IS 'Stores chunk information for resumable uploads';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system operations';
COMMENT ON TABLE validation_errors IS 'Detailed validation errors for uploaded data';
COMMENT ON TABLE processing_queue IS 'Background job queue for asynchronous processing';