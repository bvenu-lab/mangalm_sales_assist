const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'mangalm_sales',
  user: 'postgres',
  // No password needed with trust authentication
  port: 5432
});

async function seedRealStoreData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Use Jassi Catering which has real invoice history
    const storeId = '4261931000000166057';
    console.log('Adding predicted orders for Jassi Catering (store:', storeId + ')');
    
    // Add predicted orders based on historical patterns
    const orderResult = await client.query(`
      INSERT INTO predicted_orders (store_id, predicted_date, confidence, priority, status, total_amount, ai_recommendation)
      VALUES 
        ($1, CURRENT_DATE + INTERVAL '7 days', 0.92, 'high', 'pending', 478.92, 'Based on weekly ordering pattern, high confidence for regular items'),
        ($1, CURRENT_DATE + INTERVAL '14 days', 0.88, 'medium', 'pending', 520.50, 'Regular bi-weekly order expected'),
        ($1, CURRENT_DATE + INTERVAL '21 days', 0.85, 'medium', 'pending', 445.75, 'End of month standard replenishment')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [storeId]);
    
    console.log('Added', orderResult.rows.length, 'predicted orders');
    
    // Add items for each predicted order based on common products
    for (const order of orderResult.rows) {
      await client.query(`
        INSERT INTO predicted_order_items (predicted_order_id, product_id, product_name, predicted_quantity, unit_price, total_price)
        VALUES 
          ($1, '4261931000000278107', 'Mtr Rosted Vermicelli Pkt 15X900Gm', 15, 20.50, 307.50),
          ($1, '4261931000000278105', 'Mtr Mix Veg Pickle Pet 12X500Gm', 8, 15.75, 126.00),
          ($1, '4261931000000278111', 'Mtr Mango Pickle Pet 12X500Gm', 5, 15.75, 78.75)
        ON CONFLICT DO NOTHING;
      `, [order.id]);
      
      console.log('Added items for order:', order.id);
    }
    
    // Add call prioritization for this store
    await client.query(`
      INSERT INTO call_prioritization (id, store_id, priority_score, priority_reason, next_call_date, status)
      VALUES ($1, $2, 9.0, 'High-volume customer with consistent weekly orders. Last order 3 days ago.', CURRENT_DATE + INTERVAL '2 days', 'pending')
      ON CONFLICT (id) DO UPDATE SET
        priority_score = EXCLUDED.priority_score,
        priority_reason = EXCLUDED.priority_reason,
        next_call_date = EXCLUDED.next_call_date;
    `, [`call-${storeId}-${Date.now()}`, storeId]);
    
    console.log('Added call prioritization');
    
    await client.query('COMMIT');
    console.log('Real store data seeded successfully!');
    console.log('\nYou can now view this store at: http://localhost:3000/stores/' + storeId);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding data:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedRealStoreData().catch(console.error);