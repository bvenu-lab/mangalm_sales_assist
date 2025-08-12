const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'mangalm_sales',
  user: 'postgres',
  password: 'postgres',
  port: 5432
});

async function addPredictedOrders() {
  try {
    // Insert predicted orders for store 4261931000001048016
    const storeId = '4261931000001048016';
    
    // First, get store details
    const storeQuery = 'SELECT name, city FROM stores WHERE id = $1';
    const storeResult = await pool.query(storeQuery, [storeId]);
    
    if (storeResult.rows.length === 0) {
      console.log('Store not found:', storeId);
      return;
    }
    
    const store = storeResult.rows[0];
    console.log('Adding predicted orders for:', store.name, 'in', store.city);
    
    const query = `
      INSERT INTO predicted_orders (id, store_id, prediction_date, confidence_score, predicted_items, estimated_value, status, created_at)
      VALUES 
        ($1, $2, NOW(), 0.92, $3::jsonb, 3500.00, 'pending', NOW()),
        ($4, $2, NOW() + INTERVAL '7 days', 0.88, $5::jsonb, 4200.00, 'pending', NOW()),
        ($6, $2, NOW() + INTERVAL '14 days', 0.85, $7::jsonb, 3800.00, 'pending', NOW())
      ON CONFLICT (id) DO UPDATE SET
        predicted_items = EXCLUDED.predicted_items,
        estimated_value = EXCLUDED.estimated_value,
        confidence_score = EXCLUDED.confidence_score
      RETURNING *;
    `;
    
    const items1 = JSON.stringify([
      { productId: 'prod-001', name: 'Premium Product', quantity: 30, price: 100 },
      { productId: 'prod-002', name: 'Standard Product', quantity: 20, price: 25 }
    ]);
    
    const items2 = JSON.stringify([
      { productId: 'prod-001', name: 'Premium Product', quantity: 40, price: 100 },
      { productId: 'prod-003', name: 'Budget Product', quantity: 10, price: 20 }
    ]);
    
    const items3 = JSON.stringify([
      { productId: 'prod-002', name: 'Standard Product', quantity: 50, price: 25 },
      { productId: 'prod-003', name: 'Budget Product', quantity: 25, price: 20 },
      { productId: 'prod-004', name: 'Special Product', quantity: 15, price: 70 }
    ]);
    
    const timestamp = Date.now();
    const result = await pool.query(query, [
      `pred-${storeId}-${timestamp}`,
      storeId,
      items1,
      `pred-${storeId}-${timestamp + 1}`,
      items2,
      `pred-${storeId}-${timestamp + 2}`,
      items3
    ]);
    
    console.log('Successfully added', result.rows.length, 'predicted orders');
    result.rows.forEach(row => {
      console.log('- Order ID:', row.id);
      console.log('  Prediction Date:', row.prediction_date);
      console.log('  Estimated Value: $', row.estimated_value);
      console.log('  Confidence:', row.confidence_score);
    });
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await pool.end();
  }
}

addPredictedOrders();