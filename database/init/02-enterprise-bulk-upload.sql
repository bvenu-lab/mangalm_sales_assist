-- Enterprise Grade Bulk Upload Schema
-- PostgreSQL 15 with full ACID compliance, partitioning, and audit trails

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create schema for better organization
CREATE SCHEMA IF NOT EXISTS bulk_upload;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set default search path
SET search_path TO bulk_upload, public;

-- ==========================================
-- ENUM TYPES FOR TYPE SAFETY
-- ==========================================

CREATE TYPE upload_status AS ENUM (
    'pending',
    'validating',
    'queued',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'partially_completed'
);

CREATE TYPE file_type AS ENUM (
    'csv',
    'xlsx',
    'xls',
    'json',
    'xml'
);

CREATE TYPE processing_strategy AS ENUM (
    'stream',
    'batch',
    'parallel',
    'sequential'
);

CREATE TYPE error_severity AS ENUM (
    'warning',
    'error',
    'critical'
);

-- ==========================================
-- MAIN UPLOAD JOBS TABLE WITH PARTITIONING
-- ==========================================

CREATE TABLE IF NOT EXISTS bulk_upload.upload_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- File metadata
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    file_type file_type NOT NULL,
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for deduplication
    mime_type VARCHAR(100),
    encoding VARCHAR(50) DEFAULT 'UTF-8',
    
    -- Processing metadata
    status upload_status NOT NULL DEFAULT 'pending',
    processing_strategy processing_strategy DEFAULT 'stream',
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    
    -- Statistics
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    skip_count INTEGER DEFAULT 0,
    
    -- Performance metrics
    parse_time_ms INTEGER,
    validation_time_ms INTEGER,
    processing_time_ms INTEGER,
    total_time_ms INTEGER GENERATED ALWAYS AS (
        COALESCE(parse_time_ms, 0) + 
        COALESCE(validation_time_ms, 0) + 
        COALESCE(processing_time_ms, 0)
    ) STORED,
    rows_per_second DECIMAL(10,2) GENERATED ALWAYS AS (
        CASE 
            WHEN COALESCE(processing_time_ms, 0) > 0 
            THEN (processed_rows::DECIMAL / (processing_time_ms::DECIMAL / 1000))
            ELSE NULL
        END
    ) STORED,
    
    -- User and session info
    created_by VARCHAR(100) NOT NULL,
    created_by_ip INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    
    -- Retry handling
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    
    -- JSONB for flexibility
    configuration JSONB DEFAULT '{}',
    processing_stats JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_row_counts CHECK (
        processed_rows >= 0 AND 
        processed_rows <= total_rows AND
        success_count >= 0 AND
        success_count <= processed_rows
    ),
    CONSTRAINT valid_timestamps CHECK (
        (started_at IS NULL OR started_at >= created_at) AND
        (completed_at IS NULL OR completed_at >= started_at)
    )
) PARTITION BY RANGE (created_at);

-- Create partitions for better performance
CREATE TABLE bulk_upload.upload_jobs_2024_q4 PARTITION OF bulk_upload.upload_jobs
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');
    
CREATE TABLE bulk_upload.upload_jobs_2025_q1 PARTITION OF bulk_upload.upload_jobs
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

CREATE TABLE bulk_upload.upload_jobs_2025_q2 PARTITION OF bulk_upload.upload_jobs
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');

-- Create indexes for performance
CREATE INDEX idx_upload_jobs_status ON bulk_upload.upload_jobs(status);
CREATE INDEX idx_upload_jobs_created_by ON bulk_upload.upload_jobs(created_by);
CREATE INDEX idx_upload_jobs_created_at ON bulk_upload.upload_jobs(created_at DESC);
CREATE INDEX idx_upload_jobs_file_hash ON bulk_upload.upload_jobs(file_hash);
CREATE INDEX idx_upload_jobs_status_created ON bulk_upload.upload_jobs(status, created_at DESC);
CREATE INDEX idx_upload_jobs_metadata ON bulk_upload.upload_jobs USING gin(metadata);

-- ==========================================
-- UPLOAD CHUNKS FOR LARGE FILE PROCESSING
-- ==========================================

CREATE TABLE IF NOT EXISTS bulk_upload.upload_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_job_id UUID NOT NULL REFERENCES bulk_upload.upload_jobs(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    total_chunks INTEGER NOT NULL CHECK (total_chunks > 0),
    chunk_size INTEGER NOT NULL CHECK (chunk_size > 0),
    
    -- Chunk data
    data BYTEA,
    compressed BOOLEAN DEFAULT false,
    compression_ratio DECIMAL(5,2),
    
    -- Processing
    status upload_status DEFAULT 'pending',
    processed_rows INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure chunk uniqueness
    CONSTRAINT unique_chunk UNIQUE(upload_job_id, chunk_index),
    CONSTRAINT valid_chunk_index CHECK (chunk_index < total_chunks)
);

CREATE INDEX idx_chunks_job_id ON bulk_upload.upload_chunks(upload_job_id);
CREATE INDEX idx_chunks_status ON bulk_upload.upload_chunks(status);

-- ==========================================
-- PROCESSING ERRORS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bulk_upload.processing_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_job_id UUID NOT NULL REFERENCES bulk_upload.upload_jobs(id) ON DELETE CASCADE,
    
    -- Error location
    row_number INTEGER,
    column_name VARCHAR(100),
    chunk_id UUID REFERENCES bulk_upload.upload_chunks(id) ON DELETE CASCADE,
    
    -- Error details
    severity error_severity NOT NULL DEFAULT 'error',
    error_code VARCHAR(50),
    error_message TEXT NOT NULL,
    error_context JSONB,
    
    -- Row data that caused error
    raw_data TEXT,
    processed_data JSONB,
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT false,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Timestamp
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_errors_job_id ON bulk_upload.processing_errors(upload_job_id);
CREATE INDEX idx_errors_severity ON bulk_upload.processing_errors(severity);
CREATE INDEX idx_errors_unresolved ON bulk_upload.processing_errors(is_resolved) WHERE NOT is_resolved;

-- ==========================================
-- DEDUPLICATION TRACKING
-- ==========================================

CREATE TABLE IF NOT EXISTS bulk_upload.deduplication (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Dedup keys
    file_hash VARCHAR(64) NOT NULL,
    row_hash VARCHAR(64) NOT NULL,
    business_key VARCHAR(255), -- e.g., invoice_number + store_id
    
    -- Reference to original upload
    original_upload_job_id UUID REFERENCES bulk_upload.upload_jobs(id) ON DELETE SET NULL,
    duplicate_upload_job_id UUID REFERENCES bulk_upload.upload_jobs(id) ON DELETE CASCADE,
    
    -- Details
    duplicate_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Action taken
    action_taken VARCHAR(50), -- 'skipped', 'merged', 'replaced'
    
    CONSTRAINT unique_row_hash UNIQUE(row_hash)
);

CREATE INDEX idx_dedup_file_hash ON bulk_upload.deduplication(file_hash);
CREATE INDEX idx_dedup_business_key ON bulk_upload.deduplication(business_key);

-- ==========================================
-- AUDIT LOG TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS audit.upload_audit_log (
    id BIGSERIAL PRIMARY KEY,
    
    -- What happened
    event_type VARCHAR(100) NOT NULL,
    event_description TEXT,
    
    -- When it happened
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Who did it
    actor_id VARCHAR(100),
    actor_ip INET,
    actor_user_agent TEXT,
    
    -- What was affected
    upload_job_id UUID,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    
    -- Details
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    
    -- Performance
    execution_time_ms INTEGER
) PARTITION BY RANGE (event_timestamp);

-- Create partitions for audit log
CREATE TABLE audit.upload_audit_log_2024_12 PARTITION OF audit.upload_audit_log
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE audit.upload_audit_log_2025_01 PARTITION OF audit.upload_audit_log
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE INDEX idx_audit_timestamp ON audit.upload_audit_log(event_timestamp DESC);
CREATE INDEX idx_audit_upload_job ON audit.upload_audit_log(upload_job_id);
CREATE INDEX idx_audit_actor ON audit.upload_audit_log(actor_id);
CREATE INDEX idx_audit_event_type ON audit.upload_audit_log(event_type);

-- ==========================================
-- PROCESSING QUEUE TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bulk_upload.processing_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_job_id UUID NOT NULL REFERENCES bulk_upload.upload_jobs(id) ON DELETE CASCADE,
    
    -- Queue management
    queue_name VARCHAR(50) DEFAULT 'default',
    priority INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'waiting',
    
    -- Processing
    processor_id VARCHAR(100),
    locked_at TIMESTAMP WITH TIME ZONE,
    lock_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Retry
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_queue_job UNIQUE(upload_job_id)
);

CREATE INDEX idx_queue_status_priority ON bulk_upload.processing_queue(status, priority DESC);
CREATE INDEX idx_queue_next_retry ON bulk_upload.processing_queue(next_retry_at) WHERE status = 'retry';

-- ==========================================
-- MATERIALIZED VIEW FOR STATISTICS
-- ==========================================

CREATE MATERIALIZED VIEW bulk_upload.upload_statistics AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as total_uploads,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_uploads,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_uploads,
    AVG(file_size) as avg_file_size,
    AVG(total_rows) as avg_rows,
    AVG(rows_per_second) as avg_processing_speed,
    SUM(processed_rows) as total_rows_processed,
    AVG(total_time_ms) as avg_processing_time_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_time_ms) as median_processing_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_time_ms) as p95_processing_time_ms
FROM bulk_upload.upload_jobs
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY DATE_TRUNC('hour', created_at);

CREATE INDEX idx_statistics_hour ON bulk_upload.upload_statistics(hour DESC);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE bulk_upload.upload_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY upload_jobs_policy ON bulk_upload.upload_jobs
    FOR ALL
    USING (created_by = current_user OR current_user = 'admin');

-- ==========================================
-- FUNCTIONS AND TRIGGERS
-- ==========================================

-- Function to automatically update audit log
CREATE OR REPLACE FUNCTION audit.log_upload_changes() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit.upload_audit_log (
        event_type,
        event_description,
        actor_id,
        upload_job_id,
        entity_type,
        entity_id,
        old_values,
        new_values
    ) VALUES (
        TG_OP,
        TG_OP || ' on ' || TG_TABLE_NAME,
        current_user,
        COALESCE(NEW.id, OLD.id),
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        to_jsonb(OLD),
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to main tables
CREATE TRIGGER audit_upload_jobs 
    AFTER INSERT OR UPDATE OR DELETE ON bulk_upload.upload_jobs
    FOR EACH ROW EXECUTE FUNCTION audit.log_upload_changes();

-- Function to check for duplicates
CREATE OR REPLACE FUNCTION bulk_upload.check_duplicate(
    p_file_hash VARCHAR(64),
    p_row_hash VARCHAR(64)
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM bulk_upload.deduplication 
        WHERE file_hash = p_file_hash 
        OR row_hash = p_row_hash
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get upload statistics
CREATE OR REPLACE FUNCTION bulk_upload.get_upload_stats(
    p_job_id UUID
) RETURNS TABLE (
    total_time_seconds DECIMAL,
    rows_per_second DECIMAL,
    success_rate DECIMAL,
    error_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROUND(total_time_ms::DECIMAL / 1000, 2) as total_time_seconds,
        rows_per_second,
        ROUND((success_count::DECIMAL / NULLIF(processed_rows, 0)) * 100, 2) as success_rate,
        ROUND((error_count::DECIMAL / NULLIF(processed_rows, 0)) * 100, 2) as error_rate
    FROM bulk_upload.upload_jobs
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- GRANTS
-- ==========================================

GRANT USAGE ON SCHEMA bulk_upload TO PUBLIC;
GRANT USAGE ON SCHEMA audit TO PUBLIC;
GRANT SELECT ON ALL TABLES IN SCHEMA bulk_upload TO PUBLIC;
GRANT ALL ON ALL TABLES IN SCHEMA bulk_upload TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA bulk_upload TO postgres;

-- ==========================================
-- COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON SCHEMA bulk_upload IS 'Enterprise-grade bulk upload system with full audit trail and performance tracking';
COMMENT ON TABLE bulk_upload.upload_jobs IS 'Main table tracking all bulk upload jobs with comprehensive metadata';
COMMENT ON TABLE bulk_upload.upload_chunks IS 'Stores file chunks for parallel processing of large files';
COMMENT ON TABLE bulk_upload.processing_errors IS 'Detailed error tracking for debugging and resolution';
COMMENT ON TABLE bulk_upload.deduplication IS 'Tracks duplicate data to prevent reprocessing';
COMMENT ON TABLE audit.upload_audit_log IS 'Complete audit trail of all upload system activities';
COMMENT ON FUNCTION bulk_upload.check_duplicate IS 'Checks if a file or row has been processed before';
COMMENT ON FUNCTION bulk_upload.get_upload_stats IS 'Returns performance statistics for an upload job';