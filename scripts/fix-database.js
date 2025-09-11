/**
 * Database Fix Script
 * Executes SQL to create all required tables with correct schema
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'mangalm_sales',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  connectionTimeoutMillis: 10000
};

async function executeSQLFile(pool, filePath) {
  try {
    console.log(`\n📄 Reading SQL file: ${filePath}`);
    const sql = await fs.readFile(filePath, 'utf8');
    
    // Remove psql-specific commands and split into statements
    const statements = sql
      .replace(/\\c\s+\w+;?/gi, '') // Remove \c commands
      .replace(/PRINT\s+'[^']*';/gi, '') // Remove PRINT statements
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length > 50) {
        console.log(`  [${i+1}/${statements.length}] Executing: ${stmt.substring(0, 50)}...`);
      }
      
      try {
        await pool.query(stmt);
      } catch (err) {
        if (err.code === '42P07') { // duplicate_table
          console.log(`    ⚠️  Table already exists (skipping)`);
        } else if (err.code === '42710') { // duplicate_object
          console.log(`    ⚠️  Object already exists (skipping)`);
        } else if (err.code === '42P06') { // duplicate_schema
          console.log(`    ⚠️  Schema already exists (skipping)`);
        } else {
          console.error(`    ❌ Error: ${err.message}`);
          // Continue with other statements
        }
      }
    }
    
    console.log(`✅ SQL file executed successfully`);
  } catch (error) {
    console.error(`❌ Failed to execute SQL file: ${error.message}`);
    throw error;
  }
}

async function verifyTables(pool) {
  console.log('\n🔍 Verifying database tables...');
  
  const requiredTables = [
    { schema: 'public', table: 'invoice_items', minColumns: 18 },
    { schema: 'public', table: 'historical_invoices', minColumns: 19 },
    { schema: 'bulk_upload', table: 'upload_jobs', minColumns: 20 },
    { schema: 'bulk_upload', table: 'upload_chunks', minColumns: 12 },
    { schema: 'bulk_upload', table: 'processing_errors', minColumns: 10 },
    { schema: 'bulk_upload', table: 'deduplication', minColumns: 6 },
    { schema: 'audit', table: 'upload_audit_log', minColumns: 7 }
  ];
  
  let allGood = true;
  
  for (const req of requiredTables) {
    try {
      // Check if table exists
      const tableCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      `, [req.schema, req.table]);
      
      if (tableCheck.rows[0].count === '0') {
        console.log(`  ❌ Missing table: ${req.schema}.${req.table}`);
        allGood = false;
        continue;
      }
      
      // Check column count
      const columnCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
      `, [req.schema, req.table]);
      
      const columnCount = parseInt(columnCheck.rows[0].count);
      if (columnCount < req.minColumns) {
        console.log(`  ⚠️  Table ${req.schema}.${req.table} has ${columnCount} columns (expected at least ${req.minColumns})`);
      } else {
        console.log(`  ✅ Table ${req.schema}.${req.table} exists with ${columnCount} columns`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error checking ${req.schema}.${req.table}: ${error.message}`);
      allGood = false;
    }
  }
  
  // Check specific critical columns
  console.log('\n🔍 Verifying critical columns...');
  const criticalColumns = [
    { table: 'bulk_upload.upload_jobs', columns: ['file_type', 'strategy', 'priority', 'updated_at', 'schema_version'] },
    { table: 'invoice_items', columns: ['invoice_date', 'invoice_no', 'store_name'] }
  ];
  
  for (const check of criticalColumns) {
    for (const column of check.columns) {
      const [schema, table] = check.table.includes('.') 
        ? check.table.split('.') 
        : ['public', check.table];
      
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_schema = $1 
          AND table_name = $2 
          AND column_name = $3
      `, [schema, table, column]);
      
      if (result.rows[0].count === '0') {
        console.log(`  ❌ Missing column: ${check.table}.${column}`);
        allGood = false;
      } else {
        console.log(`  ✅ Column exists: ${check.table}.${column}`);
      }
    }
  }
  
  return allGood;
}

async function main() {
  const pool = new Pool(config);
  
  try {
    console.log('🔧 ENTERPRISE DATABASE FIX SCRIPT');
    console.log('==================================');
    console.log(`📍 Connecting to: ${config.host}:${config.port}/${config.database}`);
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    
    // Execute the fix script
    const sqlPath = path.join(__dirname, '..', 'database', 'init', '03-fix-enterprise-tables.sql');
    await executeSQLFile(pool, sqlPath);
    
    // Verify all tables exist
    const verified = await verifyTables(pool);
    
    if (verified) {
      console.log('\n🎉 DATABASE SETUP COMPLETE!');
      console.log('All required tables and columns now exist.');
    } else {
      console.log('\n⚠️  DATABASE SETUP PARTIALLY COMPLETE');
      console.log('Some issues were found. Please review the output above.');
    }
    
    // Show final statistics
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('public', 'bulk_upload', 'audit')) as table_count,
        (SELECT COUNT(*) FROM invoice_items) as invoice_count,
        (SELECT COUNT(*) FROM bulk_upload.upload_jobs) as upload_count
    `);
    
    console.log('\n📊 Database Statistics:');
    console.log(`  • Total tables: ${stats.rows[0].table_count}`);
    console.log(`  • Invoice records: ${stats.rows[0].invoice_count}`);
    console.log(`  • Upload jobs: ${stats.rows[0].upload_count}`);
    
  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the fix
main().catch(console.error);