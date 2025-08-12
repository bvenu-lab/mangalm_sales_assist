const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mangalm_sales',
  password: 'postgres',
  port: 5432,
});

async function addStoreData() {
  const storeId = '4261931000001048016'; // Sample Store 2
  
  try {
    console.log(`Adding data for store ${storeId}...`);
    
    // Add call prioritization for this store
    await pool.query(`
      INSERT INTO call_prioritization (
        id, store_id, priority_score, priority_reason, 
        last_call_date, next_call_date, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        priority_score = $3,
        priority_reason = $4,
        next_call_date = $6,
        status = $7,
        notes = $8
    `, [
      `CALL-${storeId}`,
      storeId,
      7.5, // High priority score
      'High-value customer - Due for reorder',
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last call 7 days ago
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Next call in 2 days
      'pending',
      'Regular customer with consistent ordering pattern. Average order value: $5,000'
    ]);
    console.log('Added call prioritization');
    
    // Add some historical invoices for this store
    const invoiceData = [
      { id: `INV-${storeId}-001`, date: '2024-11-01', amount: 4500, status: 'paid' },
      { id: `INV-${storeId}-002`, date: '2024-10-15', amount: 5200, status: 'paid' },
      { id: `INV-${storeId}-003`, date: '2024-09-28', amount: 4800, status: 'paid' },
      { id: `INV-${storeId}-004`, date: '2024-09-10', amount: 5500, status: 'paid' },
      { id: `INV-${storeId}-005`, date: '2024-08-20', amount: 4200, status: 'paid' }
    ];
    
    for (const invoice of invoiceData) {
      await pool.query(`
        INSERT INTO historical_invoices (
          id, store_id, invoice_date, total_amount, payment_status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          total_amount = $4,
          payment_status = $5
      `, [
        invoice.id,
        storeId,
        new Date(invoice.date),
        invoice.amount,
        invoice.status,
        'Regular monthly order'
      ]);
    }
    console.log(`Added ${invoiceData.length} historical invoices`);
    
    // Add predicted order with items
    const { v4: uuidv4 } = require('uuid');
    const predictedOrderId = uuidv4();
    
    await pool.query(`
      INSERT INTO predicted_orders (
        id, store_id, predicted_date, confidence, 
        total_amount, status, priority, ai_recommendation, prediction_model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `, [
      predictedOrderId,
      storeId,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Predicted for next week
      0.85, // 85% confidence
      5000, // Expected order value
      'pending',
      'high',
      'Based on 6-month ordering pattern. Customer typically orders every 2-3 weeks. Recommend upselling premium products.',
      'ml_regression'
    ]);
    console.log('Added predicted order');
    
    // Get some products to add as predicted order items
    const productsResult = await pool.query('SELECT id, name, price FROM products LIMIT 10');
    if (productsResult.rows.length > 0) {
      for (let i = 0; i < Math.min(5, productsResult.rows.length); i++) {
        const product = productsResult.rows[i];
        const quantity = Math.floor(Math.random() * 20) + 10;
        
        await pool.query(`
          INSERT INTO predicted_order_items (
            predicted_order_id, product_id, quantity, unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [
          predictedOrderId,
          product.id,
          quantity,
          product.price || 10,
          quantity * (product.price || 10)
        ]);
      }
      console.log('Added predicted order items');
    }
    
    // Verify the data
    const callCheck = await pool.query('SELECT * FROM call_prioritization WHERE store_id = $1', [storeId]);
    const orderCheck = await pool.query('SELECT * FROM predicted_orders WHERE store_id = $1', [storeId]);
    const invoiceCheck = await pool.query('SELECT COUNT(*) FROM historical_invoices WHERE store_id = $1', [storeId]);
    
    console.log('\nData verification:');
    console.log(`- Call prioritization records: ${callCheck.rows.length}`);
    console.log(`- Predicted orders: ${orderCheck.rows.length}`);
    console.log(`- Historical invoices: ${invoiceCheck.rows[0].count}`);
    
    console.log('\nData successfully added for store:', storeId);
    
  } catch (error) {
    console.error('Error adding store data:', error);
  } finally {
    await pool.end();
  }
}

addStoreData();