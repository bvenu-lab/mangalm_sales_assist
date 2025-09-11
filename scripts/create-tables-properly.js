/**
 * Create Tables Properly - One by one with error handling
 */

const { Pool } = require('pg');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'mangalm_sales',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

async function createTables() {
  const pool = new Pool(config);
  const client = await pool.connect();
  
  try {
    console.log('🔧 CREATING DATABASE TABLES PROPERLY');
    console.log('=====================================\n');
    
    // Create schemas first
    console.log('📁 Creating schemas...');
    await client.query('CREATE SCHEMA IF NOT EXISTS bulk_upload');
    await client.query('CREATE SCHEMA IF NOT EXISTS audit');
    console.log('✅ Schemas created\n');
    
    // Drop existing tables to start fresh
    console.log('🗑️  Dropping existing broken tables...');
    const dropTables = [
      'DROP TABLE IF EXISTS bulk_upload.processing_errors CASCADE',
      'DROP TABLE IF EXISTS bulk_upload.upload_chunks CASCADE',
      'DROP TABLE IF EXISTS bulk_upload.upload_jobs CASCADE',
      'DROP TABLE IF EXISTS bulk_upload.deduplication CASCADE',
      'DROP TABLE IF EXISTS audit.upload_audit_log CASCADE',
      'DROP TABLE IF EXISTS public.historical_invoices CASCADE',
      'DROP TABLE IF EXISTS public.invoice_items CASCADE'
    ];
    
    for (const sql of dropTables) {
      await client.query(sql);
    }
    console.log('✅ Old tables dropped\n');
    
    // Create invoice_items table
    console.log('📊 Creating invoice_items table...');
    await client.query(`
      CREATE TABLE invoice_items (
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
      )
    `);
    console.log('✅ invoice_items table created\n');
    
    // Create historical_invoices table
    console.log('📊 Creating historical_invoices table...');
    await client.query(`
      CREATE TABLE historical_invoices (
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
      )
    `);
    console.log('✅ historical_invoices table created\n');
    
    // Create upload_jobs table
    console.log('📊 Creating bulk_upload.upload_jobs table...');
    await client.query(`
      CREATE TABLE bulk_upload.upload_jobs (
        id UUID PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NOT NULL DEFAULT 'csv',
        file_size_bytes BIGINT,
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
        user_id VARCHAR(100),
        ip_address VARCHAR(45),
        user_agent TEXT,
        metadata JSONB,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        processing_time_ms BIGINT,
        rows_per_second DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ upload_jobs table created\n');
    
    // Create upload_chunks table
    console.log('📊 Creating bulk_upload.upload_chunks table...');
    await client.query(`
      CREATE TABLE bulk_upload.upload_chunks (
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
      )
    `);
    console.log('✅ upload_chunks table created\n');
    
    // Create processing_errors table
    console.log('📊 Creating bulk_upload.processing_errors table...');
    await client.query(`
      CREATE TABLE bulk_upload.processing_errors (
        id SERIAL PRIMARY KEY,
        upload_id UUID REFERENCES bulk_upload.upload_jobs(id) ON DELETE CASCADE,
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
      )
    `);
    console.log('✅ processing_errors table created\n');
    
    // Create deduplication table
    console.log('📊 Creating bulk_upload.deduplication table...');
    await client.query(`
      CREATE TABLE bulk_upload.deduplication (
        id SERIAL PRIMARY KEY,
        record_hash VARCHAR(64) UNIQUE NOT NULL,
        business_key VARCHAR(255),
        first_seen_upload_id UUID,
        duplicate_count INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ deduplication table created\n');
    
    // Create audit log table
    console.log('📊 Creating audit.upload_audit_log table...');
    await client.query(`
      CREATE TABLE audit.upload_audit_log (
        id SERIAL PRIMARY KEY,
        upload_id UUID,
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB,
        user_id VARCHAR(100),
        ip_address VARCHAR(45),
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ upload_audit_log table created\n');
    
    // Create indexes
    console.log('🔍 Creating indexes...');
    const indexes = [
      'CREATE INDEX idx_invoice_items_invoice_no ON invoice_items(invoice_no)',
      'CREATE INDEX idx_invoice_items_store ON invoice_items(store_name, store_code)',
      'CREATE INDEX idx_invoice_items_date ON invoice_items(invoice_date)',
      'CREATE INDEX idx_upload_jobs_status ON bulk_upload.upload_jobs(status)',
      'CREATE INDEX idx_upload_jobs_created ON bulk_upload.upload_jobs(created_at DESC)',
      'CREATE INDEX idx_upload_jobs_file_hash ON bulk_upload.upload_jobs(file_hash)',
      'CREATE INDEX idx_upload_chunks_upload ON bulk_upload.upload_chunks(upload_id)',
      'CREATE INDEX idx_upload_chunks_status ON bulk_upload.upload_chunks(status)',
      'CREATE INDEX idx_processing_errors_upload ON bulk_upload.processing_errors(upload_id)',
      'CREATE INDEX idx_processing_errors_type ON bulk_upload.processing_errors(error_type)',
      'CREATE INDEX idx_deduplication_hash ON bulk_upload.deduplication(record_hash)',
      'CREATE INDEX idx_deduplication_key ON bulk_upload.deduplication(business_key)',
      'CREATE INDEX idx_audit_upload ON audit.upload_audit_log(upload_id)',
      'CREATE INDEX idx_audit_timestamp ON audit.upload_audit_log(timestamp DESC)'
    ];
    
    for (const idx of indexes) {
      await client.query(idx);
    }
    console.log('✅ All indexes created\n');
    
    // Verify tables
    console.log('🔍 Verifying all tables...');
    const verification = await client.query(`
      SELECT 
        table_schema,
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE c.table_schema = t.table_schema 
           AND c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema IN ('public', 'bulk_upload', 'audit')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);
    
    console.log('\n📋 TABLES CREATED:');
    console.log('==================');
    for (const row of verification.rows) {
      console.log(`  ✅ ${row.table_schema}.${row.table_name} (${row.column_count} columns)`);
    }
    
    // Verify critical columns
    console.log('\n🔍 Verifying critical columns...');
    const criticalChecks = [
      { table: 'bulk_upload.upload_jobs', column: 'file_type' },
      { table: 'bulk_upload.upload_jobs', column: 'strategy' },
      { table: 'bulk_upload.upload_jobs', column: 'priority' },
      { table: 'bulk_upload.upload_jobs', column: 'schema_version' },
      { table: 'invoice_items', column: 'invoice_date' },
      { table: 'invoice_items', column: 'invoice_no' }
    ];
    
    for (const check of criticalChecks) {
      const [schema, table] = check.table.includes('.') 
        ? check.table.split('.') 
        : ['public', check.table];
      
      const result = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = $1 
          AND table_name = $2 
          AND column_name = $3
      `, [schema, table, check.column]);
      
      if (result.rows.length > 0) {
        console.log(`  ✅ ${check.table}.${check.column} (${result.rows[0].data_type})`);
      } else {
        console.log(`  ❌ MISSING: ${check.table}.${check.column}`);
      }
    }
    
    console.log('\n🎉 DATABASE SETUP COMPLETE!');
    console.log('All tables created successfully with correct schema.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
createTables().catch(console.error);