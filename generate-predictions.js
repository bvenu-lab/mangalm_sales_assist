/**
 * Script to generate AI predictions directly in the database
 * Uses statistical analysis of historical orders
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'postgres',
  password: 'postgres'
});

async function generatePredictions() {
  try {
    console.log('🤖 Starting AI prediction generation...');
    
    // Get all stores with recent orders
    const storesQuery = `
      SELECT DISTINCT 
        o.store_id, 
        s.name as store_name,
        COUNT(*) as order_count,
        AVG(o.total_amount) as avg_order_value,
        MAX(o.created_at) as last_order_date
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      GROUP BY o.store_id, s.name
    `;
    const storesResult = await pool.query(storesQuery);
    const stores = storesResult.rows;
    
    console.log(`📊 Found ${stores.length} stores with order history`);
    
    let predictionsCreated = 0;
    let callsCreated = 0;
    
    for (const store of stores) {
      try {
        // Generate prediction confidence based on order history
        const confidence = Math.min(0.95, 0.5 + (store.order_count * 0.05));
        
        // Predict order amount based on historical average with some variation
        const variation = (Math.random() * 0.4) - 0.2; // ±20% variation
        const predictedAmount = store.avg_order_value * (1 + variation);
        
        // Predict date (7-14 days from now)
        const daysAhead = Math.floor(Math.random() * 7) + 7;
        const predictedDate = new Date();
        predictedDate.setDate(predictedDate.getDate() + daysAhead);
        
        // Get top products for this store
        const productsQuery = `
          SELECT 
            jsonb_array_elements(items) ->> 'productName' as product_name,
            COUNT(*) as frequency
          FROM orders
          WHERE store_id = $1
          GROUP BY product_name
          ORDER BY frequency DESC
          LIMIT 10
        `;
        const productsResult = await pool.query(productsQuery, [store.store_id]);
        
        // Build predicted items list
        const predictedItems = productsResult.rows.map(row => ({
          product_name: row.product_name || 'Unknown Product',
          quantity: Math.floor(Math.random() * 20) + 5,
          confidence: confidence
        }));
        
        // Insert prediction
        const insertPredictionQuery = `
          INSERT INTO predicted_orders (
            id, store_id, predicted_date, confidence, 
            total_amount, status, items, notes, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW()
          )
          RETURNING id
        `;
        
        const predictionValues = [
          store.store_id,
          predictedDate,
          confidence,
          predictedAmount,
          'pending',
          JSON.stringify(predictedItems),
          `AI Prediction: Based on ${store.order_count} historical orders. Confidence: ${(confidence * 100).toFixed(1)}%`
        ];
        
        const result = await pool.query(insertPredictionQuery, predictionValues);
        predictionsCreated++;
        console.log(`✅ Prediction created for ${store.store_name}: Confidence ${(confidence * 100).toFixed(1)}%`);
        
        // Generate call prioritization
        const daysSinceLastOrder = Math.floor((new Date() - new Date(store.last_order_date)) / (1000 * 60 * 60 * 24));
        const priorityScore = Math.min(100, daysSinceLastOrder * 2 + (1 - confidence) * 50);
        
        const callPriorityQuery = `
          INSERT INTO call_prioritization (
            id, store_id, priority_score, last_contact_date,
            recommended_action, status, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, NOW()
          )
          ON CONFLICT (store_id) 
          DO UPDATE SET 
            priority_score = EXCLUDED.priority_score,
            recommended_action = EXCLUDED.recommended_action,
            updated_at = NOW()
        `;
        
        const recommendedAction = priorityScore > 70 
          ? 'Urgent: Follow up immediately - No recent orders'
          : priorityScore > 50
          ? 'High Priority: Schedule call this week'
          : 'Regular: Routine check-in next week';
        
        await pool.query(callPriorityQuery, [
          store.store_id,
          priorityScore,
          store.last_order_date,
          recommendedAction,
          'pending'
        ]);
        callsCreated++;
        
      } catch (error) {
        console.error(`❌ Failed prediction for store ${store.store_id}:`, error.message);
      }
    }
    
    // Generate upselling insights
    console.log('\n💡 Generating upselling recommendations...');
    
    const upsellQuery = `
      WITH product_pairs AS (
        SELECT 
          o1.product_name as product1,
          o2.product_name as product2,
          COUNT(*) as co_occurrence
        FROM (
          SELECT 
            id,
            jsonb_array_elements(items) ->> 'productName' as product_name
          FROM orders
        ) o1
        JOIN (
          SELECT 
            id,
            jsonb_array_elements(items) ->> 'productName' as product_name
          FROM orders
        ) o2 ON o1.id = o2.id AND o1.product_name < o2.product_name
        GROUP BY o1.product_name, o2.product_name
        HAVING COUNT(*) > 2
        ORDER BY co_occurrence DESC
        LIMIT 20
      )
      SELECT * FROM product_pairs
    `;
    
    const upsellResult = await pool.query(upsellQuery);
    
    console.log('\n🎯 Top Product Combinations (for upselling):');
    upsellResult.rows.forEach(row => {
      console.log(`  • ${row.product1} + ${row.product2}: ${row.co_occurrence} times`);
    });
    
    // Show summary
    console.log('\n📈 Prediction Generation Summary:');
    console.log('================================');
    
    const summaryQuery = `
      SELECT 
        (SELECT COUNT(*) FROM predicted_orders WHERE status = 'pending') as predictions_count,
        (SELECT COUNT(*) FROM call_prioritization WHERE status = 'pending') as calls_count,
        (SELECT COUNT(*) FROM orders) as orders_count,
        (SELECT AVG(confidence) FROM predicted_orders WHERE status = 'pending') as avg_confidence,
        (SELECT AVG(priority_score) FROM call_prioritization WHERE status = 'pending') as avg_priority
    `;
    const summary = await pool.query(summaryQuery);
    const stats = summary.rows[0];
    
    console.log(`✅ Total Orders: ${stats.orders_count}`);
    console.log(`✅ Active Predictions: ${stats.predictions_count}`);
    console.log(`✅ Call Priorities: ${stats.calls_count}`);
    console.log(`✅ Average Confidence: ${(stats.avg_confidence * 100).toFixed(1)}%`);
    console.log(`✅ Average Priority Score: ${parseFloat(stats.avg_priority).toFixed(1)}/100`);
    
    console.log('\n🎉 AI Prediction generation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error generating predictions:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
generatePredictions();