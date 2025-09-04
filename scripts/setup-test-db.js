/**
 * Setup Test Database
 * Creates and initializes the test database for running tests
 */

const { Client } = require('pg');
const path = require('path');
const fs = require('fs').promises;

async function setupTestDatabase(dbName = 'mangalm_test') {
  // Connect to default postgres database
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    
    // Check if database exists
    const checkDb = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`
    );
    
    if (checkDb.rows.length === 0) {
      console.log(`Creating database ${dbName}...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database ${dbName} created successfully`);
    } else {
      console.log(`Database ${dbName} already exists`);
    }
    
    await client.end();
    
    // Connect to database to create schema
    const testClient = new Client({
      host: 'localhost',
      port: 5432,
      database: dbName,
      user: 'postgres',
      password: 'postgres'
    });
    
    await testClient.connect();
    console.log(`Connected to ${dbName} database`);
    
    // Create schemas
    console.log('Creating schemas...');
    await testClient.query('CREATE SCHEMA IF NOT EXISTS bulk_upload');
    await testClient.query('CREATE SCHEMA IF NOT EXISTS audit');
    
    // Create tables
    console.log('Creating tables...');
    
    // Main invoice_items table
    await testClient.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
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
    
    // Add hash column if it doesn't exist (for existing databases)
    try {
      await testClient.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS hash VARCHAR(64)`);
    } catch (error) {
      // Column might already exist, ignore error
    }
    
    try {
      await testClient.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    } catch (error) {
      // Column might already exist, ignore error
    }
    
    try {
      await testClient.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    } catch (error) {
      // Column might already exist, ignore error
    }
    
    // Bulk upload tables
    await testClient.query(`
      CREATE TABLE IF NOT EXISTS bulk_upload.upload_jobs (
        id UUID PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
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
    
    await testClient.query(`
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
    
    await testClient.query(`
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
    
    await testClient.query(`
      CREATE TABLE IF NOT EXISTS bulk_upload.deduplication (
        hash VARCHAR(64) PRIMARY KEY,
        upload_id UUID,
        row_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Audit tables
    await testClient.query(`
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
    try {
      await testClient.query('CREATE INDEX IF NOT EXISTS idx_invoice_items_hash ON invoice_items(hash)');
    } catch (error) {
      console.log('Note: Could not create hash index (column may not exist)');
    }
    
    await testClient.query('CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_no ON invoice_items(invoice_no)');
    await testClient.query('CREATE INDEX IF NOT EXISTS idx_invoice_items_date ON invoice_items(invoice_date)');
    await testClient.query('CREATE INDEX IF NOT EXISTS idx_upload_jobs_status ON bulk_upload.upload_jobs(status)');
    await testClient.query('CREATE INDEX IF NOT EXISTS idx_upload_chunks_upload_id ON bulk_upload.upload_chunks(upload_id)');
    await testClient.query('CREATE INDEX IF NOT EXISTS idx_processing_errors_upload_id ON bulk_upload.processing_errors(upload_id)');
    
    console.log(`Database ${dbName} setup complete!`);
    await testClient.end();
    
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const dbName = process.argv[2] || 'mangalm_test';
  setupTestDatabase(dbName)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = setupTestDatabase;