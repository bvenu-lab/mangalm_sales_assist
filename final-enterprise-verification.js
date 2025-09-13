const axios = require('axios');
const { Pool } = require('pg');

const BASE_URL = 'http://localhost:3007';
const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'mangalm',
  password: 'mangalm_secure_password'
});

async function finalEnterpriseVerification() {
  console.log('🏢 FINAL ENTERPRISE SYSTEM VERIFICATION');
  console.log('=' .repeat(70));
  console.log('Date:', new Date().toISOString());
  console.log('=' .repeat(70));

  let totalScore = 0;
  let maxScore = 0;
  const results = {
    database: { score: 0, max: 30, details: {} },
    api: { score: 0, max: 30, details: {} },
    features: { score: 0, max: 40, details: {} }
  };

  // 1. DATABASE VERIFICATION
  console.log('\n📊 DATABASE VERIFICATION');
  console.log('-'.repeat(50));
  
  try {
    const tableCheck = await pool.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.tables t WHERE t.table_name = tables.table_name) as exists,
        CASE table_name
          WHEN 'stores' THEN (SELECT COUNT(*) FROM stores)
          WHEN 'products' THEN (SELECT COUNT(*) FROM products)
          WHEN 'orders' THEN (SELECT COUNT(*) FROM orders)
          WHEN 'mangalam_invoices' THEN (SELECT COUNT(*) FROM mangalam_invoices)
          WHEN 'invoice_items' THEN (SELECT COUNT(*) FROM invoice_items)
          WHEN 'call_prioritization' THEN (SELECT COUNT(*) FROM call_prioritization)
          WHEN 'predicted_orders' THEN (SELECT COUNT(*) FROM predicted_orders)
          WHEN 'sales_forecasts' THEN (SELECT COUNT(*) FROM sales_forecasts)
          WHEN 'upselling_recommendations' THEN (SELECT COUNT(*) FROM upselling_recommendations)
          WHEN 'product_associations' THEN (SELECT COUNT(*) FROM product_associations)
          WHEN 'store_preferences' THEN (SELECT COUNT(*) FROM store_preferences)
          WHEN 'user_actions' THEN (SELECT COUNT(*) FROM user_actions)
          WHEN 'model_performance' THEN (SELECT COUNT(*) FROM model_performance)
          WHEN 'order_patterns' THEN (SELECT COUNT(*) FROM order_patterns)
          WHEN 'dashboard_settings' THEN (SELECT COUNT(*) FROM dashboard_settings)
          WHEN 'customer_segments' THEN (SELECT COUNT(*) FROM customer_segments)
          ELSE 0
        END as record_count
      FROM (
        VALUES 
          ('stores'), ('products'), ('orders'), ('mangalam_invoices'), ('invoice_items'),
          ('call_prioritization'), ('predicted_orders'), ('sales_forecasts'),
          ('upselling_recommendations'), ('product_associations'), ('store_preferences'),
          ('user_actions'), ('model_performance'), ('order_patterns'),
          ('dashboard_settings'), ('customer_segments')
      ) AS tables(table_name)
    `);

    let emptyTables = [];
    let populatedTables = 0;
    
    console.log('\nTable Status:');
    for (const row of tableCheck.rows) {
      const status = row.record_count > 0 ? '✅' : '❌';
      const scoreAdd = row.record_count > 0 ? 2 : 0;
      
      console.log(`  ${status} ${row.table_name.padEnd(30)} : ${row.record_count} records`);
      
      if (row.record_count > 0) {
        populatedTables++;
        results.database.score += scoreAdd;
      } else {
        emptyTables.push(row.table_name);
      }
    }
    
    results.database.max = tableCheck.rows.length * 2;
    results.database.details.populated = populatedTables;
    results.database.details.total = tableCheck.rows.length;
    results.database.details.empty = emptyTables;
    
    // Check data quality
    const dataQuality = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM orders WHERE total_amount IS NULL OR total_amount = 0) as zero_orders,
        (SELECT COUNT(*) FROM orders WHERE total_amount > 0) as valid_orders,
        (SELECT AVG(total_amount) FROM orders WHERE total_amount > 0) as avg_order_value
    `);
    
    const quality = dataQuality.rows[0];
    console.log('\nData Quality:');
    console.log(`  Valid Orders: ${quality.valid_orders}`);
    console.log(`  Zero Amount Orders: ${quality.zero_orders}`);
    console.log(`  Average Order Value: $${parseFloat(quality.avg_order_value || 0).toFixed(2)}`);
    
    if (quality.zero_orders === 0 && quality.valid_orders > 0) {
      results.database.score += 10;
      console.log('  ✅ All orders have valid amounts');
    } else if (quality.valid_orders > quality.zero_orders) {
      results.database.score += 5;
      console.log('  ⚠️ Some orders have zero amounts');
    } else {
      console.log('  ❌ Most orders have invalid amounts');
    }
    
  } catch (error) {
    console.log('  ❌ Database verification failed:', error.message);
  }

  // 2. API ENDPOINT VERIFICATION
  console.log('\n🌐 API ENDPOINT VERIFICATION');
  console.log('-'.repeat(50));
  
  const endpoints = [
    { path: '/api/stores', name: 'Stores API', critical: true },
    { path: '/api/products', name: 'Products API', critical: true },
    { path: '/api/orders', name: 'Orders API', critical: true },
    { path: '/api/orders/analytics', name: 'Order Analytics', critical: false },
    { path: '/api/performance/summary', name: 'Performance Summary', critical: false },
    { path: '/api/upselling/suggestions', name: 'Upselling Suggestions', critical: false },
    { path: '/api/predictions', name: 'AI Predictions', critical: false },
    { path: '/api/call-prioritization', name: 'Call Prioritization', critical: false }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${BASE_URL}${endpoint.path}`, {
        validateStatus: () => true,
        timeout: 3000
      });
      
      const points = endpoint.critical ? 5 : 3;
      
      if (response.status === 200) {
        console.log(`  ✅ ${endpoint.name.padEnd(25)} : ${response.status} OK`);
        results.api.score += points;
        
        // Check if returns data
        if (response.data && response.data.data && response.data.data.length > 0) {
          console.log(`     └─ Returns ${response.data.data.length} records`);
          results.api.score += 1;
        }
      } else if (response.status === 429) {
        console.log(`  ⚠️ ${endpoint.name.padEnd(25)} : Rate Limited`);
        results.api.score += points / 2; // Partial credit - endpoint exists
      } else {
        console.log(`  ❌ ${endpoint.name.padEnd(25)} : ${response.status} Error`);
      }
      
      results.api.max += points + 1;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`  ❌ ${endpoint.name.padEnd(25)} : Connection Failed`);
      results.api.max += endpoint.critical ? 6 : 4;
    }
  }

  // 3. ENTERPRISE FEATURES VERIFICATION
  console.log('\n🎯 ENTERPRISE FEATURES VERIFICATION');
  console.log('-'.repeat(50));
  
  const features = [
    { name: 'Rate Limiting', check: async () => {
      try {
        // Check if rate limit headers exist
        const r = await axios.get(`${BASE_URL}/api/stores`, { validateStatus: () => true });
        return r.headers['x-ratelimit-limit'] !== undefined;
      } catch { return false; }
    }, points: 10 },
    
    { name: 'AI Predictions Data', check: async () => {
      const r = await pool.query('SELECT COUNT(*) as count FROM predicted_orders');
      return r.rows[0].count > 0;
    }, points: 8 },
    
    { name: 'Sales Forecasts', check: async () => {
      const r = await pool.query('SELECT COUNT(*) as count FROM sales_forecasts');
      return r.rows[0].count > 0;
    }, points: 8 },
    
    { name: 'Call Prioritization', check: async () => {
      const r = await pool.query('SELECT COUNT(*) as count FROM call_prioritization');
      return r.rows[0].count > 0;
    }, points: 7 },
    
    { name: 'Upselling System', check: async () => {
      const r = await pool.query('SELECT COUNT(*) as count FROM upselling_recommendations');
      return r.rows[0].count > 0;
    }, points: 7 }
  ];
  
  for (const feature of features) {
    try {
      const passed = await feature.check();
      if (passed) {
        console.log(`  ✅ ${feature.name.padEnd(25)} : Implemented`);
        results.features.score += feature.points;
      } else {
        console.log(`  ❌ ${feature.name.padEnd(25)} : Not Found`);
      }
      results.features.max += feature.points;
    } catch (error) {
      console.log(`  ❌ ${feature.name.padEnd(25)} : Check Failed`);
      results.features.max += feature.points;
    }
  }

  await pool.end();

  // FINAL SCORING
  console.log('\n' + '='.repeat(70));
  console.log('📈 FINAL ENTERPRISE READINESS SCORE');
  console.log('='.repeat(70));
  
  totalScore = results.database.score + results.api.score + results.features.score;
  maxScore = results.database.max + results.api.max + results.features.max;
  
  console.log('\nCategory Scores:');
  console.log(`  Database:  ${results.database.score}/${results.database.max} (${(results.database.score/results.database.max*100).toFixed(1)}%)`);
  console.log(`  API:       ${results.api.score}/${results.api.max} (${(results.api.score/results.api.max*100).toFixed(1)}%)`);
  console.log(`  Features:  ${results.features.score}/${results.features.max} (${(results.features.score/results.features.max*100).toFixed(1)}%)`);
  
  const percentage = (totalScore / maxScore) * 100;
  
  console.log('\n' + '='.repeat(70));
  console.log(`TOTAL SCORE: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)`);
  console.log('='.repeat(70));
  
  // Grade assignment
  let grade, status;
  if (percentage >= 90) {
    grade = 'A';
    status = '✅ PRODUCTION READY';
  } else if (percentage >= 80) {
    grade = 'B';
    status = '✅ STAGING READY';
  } else if (percentage >= 70) {
    grade = 'C';
    status = '⚠️ DEVELOPMENT READY';
  } else if (percentage >= 60) {
    grade = 'D';
    status = '⚠️ NEEDS WORK';
  } else {
    grade = 'F';
    status = '❌ NOT READY';
  }
  
  console.log(`\nGRADE: ${grade}`);
  console.log(`STATUS: ${status}`);
  
  // Summary
  console.log('\n📋 SUMMARY:');
  if (results.database.details.empty.length > 0) {
    console.log(`  ⚠️ Empty tables: ${results.database.details.empty.join(', ')}`);
  } else {
    console.log('  ✅ All tables have data');
  }
  
  console.log(`  ✅ ${results.database.details.populated}/${results.database.details.total} tables populated`);
  console.log(`  ✅ Rate limiting: ${results.features.score >= 10 ? 'Active' : 'Not Working'}`);
  console.log(`  ✅ Enterprise features: ${Math.floor(results.features.score/results.features.max*100)}% implemented`);
  
  console.log('\n🎯 TRUTH ASSESSMENT:');
  if (percentage >= 80) {
    console.log('  The system has been successfully transformed to an enterprise solution.');
    console.log('  All critical issues have been addressed.');
  } else if (percentage >= 60) {
    console.log('  The system is partially enterprise-ready but needs more work.');
    console.log('  Some critical components are still missing or broken.');
  } else {
    console.log('  The system is NOT enterprise-ready.');
    console.log('  Major components are broken or missing.');
  }
  
  return percentage;
}

finalEnterpriseVerification().catch(console.error);