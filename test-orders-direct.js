const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'mangalm',
  password: 'mangalm_secure_password'
});

async function testOrders() {
  console.log('🔍 Testing Order Management System Directly...\n');
  
  try {
    // Test 1: Query orders directly
    console.log('Test 1: Querying orders table...');
    const ordersResult = await pool.query('SELECT COUNT(*) as count FROM orders');
    console.log(`  Orders count: ${ordersResult.rows[0].count}`);
    
    // Test 2: Check if invoices exist
    console.log('\nTest 2: Checking invoices...');
    const invoicesResult = await pool.query('SELECT COUNT(*) as count FROM mangalam_invoices');
    console.log(`  Invoices count: ${invoicesResult.rows[0].count}`);
    
    // Test 3: Create a test order
    console.log('\nTest 3: Creating test order...');
    const insertQuery = `
      INSERT INTO orders (
        order_number, store_id, customer_name, customer_phone,
        items, item_count, total_quantity, total_amount,
        status, source
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING id
    `;
    
    const testOrder = [
      'TEST-' + Date.now(),
      '4261931000000665698',
      'Test Customer',
      '555-1234',
      JSON.stringify([{product: 'Test Product', quantity: 5, price: 100}]),
      1,
      5,
      500,
      'pending_review',
      'test'
    ];
    
    const insertResult = await pool.query(insertQuery, testOrder);
    console.log(`  ✅ Created order with ID: ${insertResult.rows[0].id}`);
    
    // Test 4: Query the order with JOIN
    console.log('\nTest 4: Testing JOIN query as used in API...');
    const joinQuery = `
      SELECT 
        o.id,
        o.store_id,
        s.name as store_name,
        o.order_date,
        o.total_amount,
        o.status,
        o.payment_status,
        o.customer_name,
        o.delivery_date,
        o.created_at,
        o.updated_at
      FROM orders o
      LEFT JOIN stores s ON o.store_id = s.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `;
    
    const joinResult = await pool.query(joinQuery);
    console.log(`  ✅ JOIN query successful, returned ${joinResult.rows.length} rows`);
    if (joinResult.rows.length > 0) {
      console.log(`  Sample: ${JSON.stringify(joinResult.rows[0], null, 2)}`);
    }
    
    // Test 5: Check if stores table has matching IDs
    console.log('\nTest 5: Checking store ID compatibility...');
    const storeCheckQuery = `
      SELECT id, name FROM stores 
      WHERE id = '4261931000000665698' 
      OR id::text = '4261931000000665698'
      LIMIT 1
    `;
    const storeResult = await pool.query(storeCheckQuery);
    if (storeResult.rows.length > 0) {
      console.log(`  ✅ Found store: ${storeResult.rows[0].name}`);
    } else {
      console.log(`  ⚠️ Store ID '4261931000000665698' not found in stores table`);
      
      // Check store ID format
      const storeFormatQuery = 'SELECT id, name FROM stores LIMIT 5';
      const storeFormatResult = await pool.query(storeFormatQuery);
      console.log('  Sample store IDs:');
      storeFormatResult.rows.forEach(s => {
        console.log(`    - ${s.id} (${typeof s.id}): ${s.name}`);
      });
    }
    
    // Test 6: Data pipeline check
    console.log('\nTest 6: Data Pipeline Analysis...');
    console.log('  Checking if invoice items are being converted to orders...');
    
    const pipelineQuery = `
      SELECT 
        (SELECT COUNT(*) FROM mangalam_invoices) as invoice_count,
        (SELECT COUNT(*) FROM invoice_items) as invoice_items_count,
        (SELECT COUNT(*) FROM orders) as orders_count,
        (SELECT COUNT(DISTINCT store_id) FROM mangalam_invoices) as unique_stores_in_invoices
    `;
    const pipelineResult = await pool.query(pipelineQuery);
    const stats = pipelineResult.rows[0];
    
    console.log(`  Invoices: ${stats.invoice_count}`);
    console.log(`  Invoice Items: ${stats.invoice_items_count}`);
    console.log(`  Orders: ${stats.orders_count}`);
    console.log(`  Unique stores in invoices: ${stats.unique_stores_in_invoices}`);
    
    if (stats.invoice_count > 0 && stats.orders_count <= 1) {
      console.log('\n  ❌ DATA PIPELINE ISSUE DETECTED!');
      console.log('  Invoices exist but orders are not being created.');
      console.log('  The data transformation pipeline is broken.');
    }
    
    // Clean up test order
    console.log('\nCleaning up test order...');
    await pool.query('DELETE FROM orders WHERE source = $1', ['test']);
    console.log('  ✅ Test order deleted');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 ORDER SYSTEM DIAGNOSIS COMPLETE\n');
}

testOrders().catch(console.error);