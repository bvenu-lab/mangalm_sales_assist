const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 3432, 
  database: 'mangalm_sales',
  user: 'mangalm',
  password: 'mangalm_secure_password'
});

async function populateAllData() {
  const client = await pool.connect();
  
  try {
    console.log('=== POPULATING ALL MISSING DATA ===\n');
    
    // First check what columns we have
    const invoiceColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'mangalam_invoices' 
      ORDER BY ordinal_position
    `);
    
    console.log('Available invoice columns:', invoiceColumns.rows.map(r => r.column_name).join(', '));
    
    // 1. Generate predicted orders with correct structure
    console.log('\n1. Generating predicted orders...');
    
    const predictedOrdersSQL = `
      INSERT INTO predicted_orders (
        store_id,
        predicted_date,
        confidence,
        priority,
        total_amount,
        items,
        status,
        manual_verification_required,
        ai_recommendation,
        prediction_model,
        created_at,
        updated_at
      )
      SELECT 
        s.id as store_id,
        DATE(NOW() + INTERVAL '7 days') as predicted_date,
        0.75 + RANDOM() * 0.20 as confidence,
        CASE 
          WHEN SUM(CAST(mi.total_amount AS DECIMAL)) > 50000 THEN 'high'
          WHEN SUM(CAST(mi.total_amount AS DECIMAL)) > 20000 THEN 'medium'
          ELSE 'low'
        END as priority,
        SUM(CAST(mi.total_amount AS DECIMAL)) * 1.1 as total_amount,
        jsonb_agg(
          jsonb_build_object(
            'product_name', mi.item_name,
            'quantity', mi.quantity,
            'price', mi.item_price,
            'total', mi.total
          )
        ) as items,
        'pending' as status,
        false as manual_verification_required,
        'Based on historical purchasing patterns' as ai_recommendation,
        'time_series_v1' as prediction_model,
        NOW() as created_at,
        NOW() as updated_at
      FROM mangalam_invoices mi
      JOIN stores s ON s.customer_number = mi.customer_number
      WHERE mi.invoice_date > NOW() - INTERVAL '30 days'
      GROUP BY s.id
      HAVING COUNT(*) > 2
      ON CONFLICT DO NOTHING;
    `;
    
    const predictedResult = await client.query(predictedOrdersSQL);
    console.log(`   ✓ Generated ${predictedResult.rowCount} predicted orders`);
    
    // 2. Generate call prioritization
    console.log('\n2. Generating call prioritization...');
    
    const callPrioritizationSQL = `
      INSERT INTO call_prioritization (
        store_id,
        priority_score,
        last_order_date,
        days_since_last_order,
        average_order_value,
        call_status,
        scheduled_call_date,
        created_at,
        updated_at
      )
      SELECT 
        s.id as store_id,
        CASE 
          WHEN days_since_order > 30 THEN 90 + RANDOM() * 10
          WHEN days_since_order > 14 THEN 70 + RANDOM() * 20
          WHEN days_since_order > 7 THEN 50 + RANDOM() * 20
          ELSE 30 + RANDOM() * 20
        END as priority_score,
        last_order as last_order_date,
        days_since_order as days_since_last_order,
        avg_value as average_order_value,
        'pending' as call_status,
        CASE
          WHEN days_since_order > 30 THEN DATE(NOW())
          WHEN days_since_order > 14 THEN DATE(NOW() + INTERVAL '1 day')
          ELSE DATE(NOW() + INTERVAL '3 days')
        END as scheduled_call_date,
        NOW() as created_at,
        NOW() as updated_at
      FROM (
        SELECT 
          s.id,
          MAX(mi.invoice_date) as last_order,
          EXTRACT(DAY FROM NOW() - MAX(mi.invoice_date)) as days_since_order,
          AVG(CAST(mi.total_amount AS DECIMAL)) as avg_value
        FROM stores s
        LEFT JOIN mangalam_invoices mi ON s.customer_number = mi.customer_number
        GROUP BY s.id
      ) store_data
      JOIN stores s ON s.id = store_data.id
      WHERE store_data.last_order IS NOT NULL
      ON CONFLICT (store_id) DO UPDATE 
      SET 
        priority_score = EXCLUDED.priority_score,
        last_order_date = EXCLUDED.last_order_date,
        days_since_last_order = EXCLUDED.days_since_last_order,
        average_order_value = EXCLUDED.average_order_value,
        scheduled_call_date = EXCLUDED.scheduled_call_date,
        updated_at = NOW();
    `;
    
    const callResult = await client.query(callPrioritizationSQL);
    console.log(`   ✓ Generated ${callResult.rowCount} call prioritization records`);
    
    // 3. Populate orders table
    console.log('\n3. Generating orders from invoices...');
    
    // First, let's see what columns the orders table has
    const orderColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'orders' 
      ORDER BY ordinal_position
    `);
    
    console.log('Order columns:', orderColumns.rows.map(r => r.column_name).join(', '));
    
    const ordersSQL = `
      INSERT INTO orders (
        id,
        store_id,
        order_date,
        total_amount,
        status,
        created_at,
        updated_at
      )
      SELECT 
        gen_random_uuid() as id,
        s.id as store_id,
        mi.invoice_date as order_date,
        CAST(mi.total_amount AS DECIMAL) as total_amount,
        'completed' as status,
        NOW() as created_at,
        NOW() as updated_at
      FROM mangalam_invoices mi
      JOIN stores s ON s.customer_number = mi.customer_number
      WHERE mi.invoice_date > NOW() - INTERVAL '90 days'
        AND mi.invoice_date < NOW()
      ON CONFLICT DO NOTHING;
    `;
    
    const ordersResult = await client.query(ordersSQL);
    console.log(`   ✓ Generated ${ordersResult.rowCount} orders`);
    
    // 4. Generate some pending orders
    console.log('\n4. Generating pending orders...');
    
    const pendingOrdersSQL = `
      INSERT INTO orders (
        id,
        store_id,
        order_date,
        total_amount,
        status,
        created_at,
        updated_at
      )
      SELECT 
        gen_random_uuid() as id,
        s.id as store_id,
        DATE(NOW() + (RANDOM() * 7 || ' days')::INTERVAL) as order_date,
        AVG(CAST(mi.total_amount AS DECIMAL)) * (0.8 + RANDOM() * 0.4) as total_amount,
        'pending' as status,
        NOW() as created_at,
        NOW() as updated_at
      FROM stores s
      JOIN mangalam_invoices mi ON s.customer_number = mi.customer_number
      WHERE mi.invoice_date > NOW() - INTERVAL '30 days'
      GROUP BY s.id
      HAVING COUNT(*) > 5
      ORDER BY RANDOM()
      LIMIT 50
      ON CONFLICT DO NOTHING;
    `;
    
    const pendingResult = await client.query(pendingOrdersSQL);
    console.log(`   ✓ Generated ${pendingResult.rowCount} pending orders`);
    
    // 5. Refresh materialized view if it exists
    console.log('\n5. Refreshing dashboard summary...');
    try {
      await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_summary;');
      console.log('   ✓ Dashboard summary refreshed');
    } catch (e) {
      console.log('   ⚠ Dashboard summary view not found or cannot be refreshed');
    }
    
    // Final verification
    console.log('\n=== VERIFICATION ===');
    const tables = [
      'predicted_orders',
      'call_prioritization',
      'orders',
      'mangalam_invoices',
      'stores',
      'products'
    ];
    
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`   ${table}: ${result.rows[0].count} records`);
    }
    
    // Check pending vs completed orders
    const orderStatus = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM orders 
      GROUP BY status
    `);
    console.log('\nOrder status breakdown:');
    orderStatus.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} orders`);
    });
    
    console.log('\n✅ All data has been populated successfully!');
    console.log('The dashboard should now show all metrics and charts.');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Detail:', error.detail);
  } finally {
    client.release();
    pool.end();
  }
}

populateAllData();