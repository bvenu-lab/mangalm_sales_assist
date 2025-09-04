/**
 * Setup Bulk Upload Tables
 * Creates tables specifically for the enterprise bulk upload system
 */

const { Client } = require('pg');

async function setupBulkUploadTables(dbName = 'mangalm_sales') {
  // Connect to database
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: dbName,
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    console.log(`Connecting to ${dbName}...`);
    await client.connect();
    
    // Create schemas
    console.log('Creating schemas...');
    await client.query('CREATE SCHEMA IF NOT EXISTS bulk_upload');
    await client.query('CREATE SCHEMA IF NOT EXISTS audit');
    
    // Create historical_invoices table for bulk upload data
    console.log('Creating historical_invoices table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS historical_invoices (
        id SERIAL PRIMARY KEY,
        invoice_no VARCHAR(50) NOT NULL,
        invoice_date DATE,
        month VARCHAR(20),
        year INTEGER,
        salesman_name VARCHAR(100),
        store_name VARCHAR(100),
        store_code VARCHAR(50),
        item_name VARCHAR(200),
        batch_no VARCHAR(50),
        quantity INTEGER,
        rate DECIMAL(10, 2),
        mrp DECIMAL(10, 2),
        discount DECIMAL(10, 2),
        amount DECIMAL(10, 2),
        company_name VARCHAR(100),
        division VARCHAR(100),
        hq VARCHAR(100),
        expiry_date DATE,
        hash VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Bulk upload tables
    console.log('Creating bulk upload tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS bulk_upload.upload_jobs (
        id UUID PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50),
        file_size_bytes BIGINT,
        file_size BIGINT,
        file_hash VARCHAR(64),
        total_rows INTEGER,
        rows_processed INTEGER DEFAULT 0,
        rows_failed INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        user_id VARCHAR(100),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        error_message TEXT,
        rows_per_second INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS bulk_upload.upload_chunks (
        id SERIAL PRIMARY KEY,
        upload_id UUID REFERENCES bulk_upload.upload_jobs(id),
        chunk_index INTEGER NOT NULL,
        start_row INTEGER NOT NULL,
        end_row INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        worker_id VARCHAR(100),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS bulk_upload.processing_errors (
        id SERIAL PRIMARY KEY,
        upload_id UUID,
        chunk_id INTEGER,
        row_number INTEGER,
        error_type VARCHAR(100),
        error_message TEXT,
        row_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS bulk_upload.deduplication (
        hash VARCHAR(64) PRIMARY KEY,
        upload_id UUID,
        row_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Audit tables
    console.log('Creating audit tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit.audit_log (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50),
        entity_id VARCHAR(100),
        action VARCHAR(50),
        user_id VARCHAR(100),
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    console.log('Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_historical_invoices_hash ON historical_invoices(hash)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_historical_invoices_invoice_no ON historical_invoices(invoice_no)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_historical_invoices_date ON historical_invoices(invoice_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_upload_jobs_status ON bulk_upload.upload_jobs(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_upload_chunks_upload_id ON bulk_upload.upload_chunks(upload_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_processing_errors_upload_id ON bulk_upload.processing_errors(upload_id)');
    
    console.log(`Bulk upload tables setup complete in ${dbName}!`);
    await client.end();
    
  } catch (error) {
    console.error('Error setting up bulk upload tables:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const dbName = process.argv[2] || 'mangalm_sales';
  setupBulkUploadTables(dbName)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = setupBulkUploadTables;