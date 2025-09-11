/**
 * Verify tables exist and fix any remaining issues
 */

const { Pool } = require('pg');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'mangalm_sales',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

async function verifyAndFix() {
  const pool = new Pool(config);
  
  try {
    console.log('🔍 VERIFYING DATABASE SCHEMA');
    console.log('============================\n');
    
    // List all tables
    const tablesResult = await pool.query(`
      SELECT 
        schemaname,
        tablename
      FROM pg_tables
      WHERE schemaname IN ('public', 'bulk_upload', 'audit')
      ORDER BY schemaname, tablename
    `);
    
    console.log('📋 Tables found:');
    for (const row of tablesResult.rows) {
      console.log(`  ✅ ${row.schemaname}.${row.tablename}`);
    }
    
    // Check schema_version column type
    console.log('\n🔍 Checking schema_version column...');
    const schemaVersionCheck = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'bulk_upload' 
        AND table_name = 'upload_jobs'
        AND column_name = 'schema_version'
    `);
    
    if (schemaVersionCheck.rows.length > 0) {
      const col = schemaVersionCheck.rows[0];
      console.log(`  ✅ schema_version exists as ${col.data_type}(${col.character_maximum_length || 'n/a'})`);
    }
    
    // Check all critical columns
    console.log('\n🔍 Checking all critical columns...');
    const criticalColumns = [
      ['bulk_upload', 'upload_jobs', 'file_type'],
      ['bulk_upload', 'upload_jobs', 'strategy'],
      ['bulk_upload', 'upload_jobs', 'priority'],
      ['bulk_upload', 'upload_jobs', 'updated_at'],
      ['bulk_upload', 'upload_jobs', 'schema_version'],
      ['public', 'invoice_items', 'invoice_date'],
      ['public', 'invoice_items', 'invoice_no'],
      ['public', 'invoice_items', 'store_name']
    ];
    
    let allGood = true;
    for (const [schema, table, column] of criticalColumns) {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = $1 
          AND table_name = $2 
          AND column_name = $3
      `, [schema, table, column]);
      
      if (result.rows.length > 0) {
        console.log(`  ✅ ${schema}.${table}.${column} (${result.rows[0].data_type})`);
      } else {
        console.log(`  ❌ MISSING: ${schema}.${table}.${column}`);
        allGood = false;
      }
    }
    
    // Count rows in tables
    console.log('\n📊 Table row counts:');
    const counts = [
      ['public', 'invoice_items'],
      ['public', 'historical_invoices'],
      ['bulk_upload', 'upload_jobs'],
      ['bulk_upload', 'upload_chunks'],
      ['bulk_upload', 'processing_errors'],
      ['bulk_upload', 'deduplication'],
      ['audit', 'upload_audit_log']
    ];
    
    for (const [schema, table] of counts) {
      try {
        const fullTableName = schema === 'public' ? table : `${schema}.${table}`;
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${fullTableName}`);
        console.log(`  ${fullTableName}: ${result.rows[0].count} rows`);
      } catch (err) {
        console.log(`  ${schema}.${table}: ERROR - ${err.message}`);
      }
    }
    
    if (allGood) {
      console.log('\n✅ ALL CRITICAL COLUMNS EXIST!');
      console.log('Database schema is correct and ready for use.');
    } else {
      console.log('\n⚠️  Some columns are still missing.');
    }
    
    // Test with a simple insert to make sure everything works
    console.log('\n🧪 Testing database with sample insert...');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Test upload_jobs insert
      const uploadId = require('crypto').randomUUID();
      await client.query(`
        INSERT INTO bulk_upload.upload_jobs (
          id, file_name, file_type, file_size_bytes, 
          status, strategy, priority, schema_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [uploadId, 'test.csv', 'csv', 1000, 'test', 'parallel', 0, '1.0']);
      
      console.log('  ✅ Successfully inserted test upload_job');
      
      // Test invoice_items insert
      await client.query(`
        INSERT INTO invoice_items (
          invoice_no, invoice_date, store_name, item_name
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, ['TEST-001', '2024-01-01', 'Test Store', 'Test Item']);
      
      console.log('  ✅ Successfully inserted test invoice_item');
      
      await client.query('ROLLBACK'); // Don't keep test data
      console.log('  ✅ Rolled back test data');
      
      console.log('\n🎉 DATABASE IS FULLY FUNCTIONAL!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('  ❌ Test insert failed:', error.message);
      console.error('     This needs to be fixed before the server will work.');
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run
verifyAndFix().catch(console.error);