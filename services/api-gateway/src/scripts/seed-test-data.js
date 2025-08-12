const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'mangalm_sales',
  user: 'postgres',
  // No password needed with trust authentication
  port: 5432
});

async function seedTestData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const storeId = '4261931000001048016';
    console.log('Seeding test data for store:', storeId);
    
    // Add predicted orders with items
    const orderResult = await client.query(`
      INSERT INTO predicted_orders (store_id, predicted_date, confidence, priority, status, total_amount, ai_recommendation)
      VALUES 
        ($1, CURRENT_DATE + INTERVAL '7 days', 0.92, 'high', 'pending', 3500.00, 'High demand expected for premium products'),
        ($1, CURRENT_DATE + INTERVAL '14 days', 0.88, 'medium', 'pending', 4200.00, 'Regular order pattern detected'),
        ($1, CURRENT_DATE + INTERVAL '21 days', 0.85, 'medium', 'pending', 3800.00, 'Seasonal demand increase anticipated')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [storeId]);
    
    console.log('Added', orderResult.rows.length, 'predicted orders');
    
    // Add items for each predicted order
    for (const order of orderResult.rows) {
      await client.query(`
        INSERT INTO predicted_order_items (predicted_order_id, product_id, product_name, predicted_quantity, unit_price, total_price)
        VALUES 
          ($1, '4261931000000278107', 'Premium Product', 30, 100.00, 3000.00),
          ($1, '4261931000000278105', 'Standard Product', 20, 25.00, 500.00)
        ON CONFLICT DO NOTHING;
      `, [order.id]);
      
      console.log('Added items for order:', order.id);
    }
    
    // Add call prioritization for this store
    await client.query(`
      INSERT INTO call_prioritization (id, store_id, priority_score, priority_reason, next_call_date, status)
      VALUES ($1, $2, 8.5, 'High-value customer with upcoming predicted orders', CURRENT_DATE + INTERVAL '2 days', 'pending')
      ON CONFLICT (id) DO NOTHING;
    `, [`call-${storeId}-${Date.now()}`, storeId]);
    
    console.log('Added call prioritization');
    
    await client.query('COMMIT');
    console.log('Test data seeded successfully!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding data:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestData().catch(console.error);