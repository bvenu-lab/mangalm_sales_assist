const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'mangalm',
  password: 'mangalm_secure_password'
});

const API_URL = 'http://localhost:3007';

async function verifyChartData() {
  console.log('===========================================');
  console.log('    COMPREHENSIVE CHART DATA VERIFICATION  ');
  console.log('===========================================\n');
  
  const client = await pool.connect();
  let allTestsPassed = true;
  
  try {
    // TEST 1: Verify Trends API returns real database data
    console.log('TEST 1: TRENDS API DATA VERIFICATION');
    console.log('=====================================');
    
    // Get data from database
    const dbTrends = await client.query(`
      SELECT 
        DATE(order_date) as date,
        COUNT(*) as orders,
        SUM(total_amount) as revenue
      FROM orders
      WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(order_date)
      ORDER BY date DESC
      LIMIT 1
    `);
    
    // Get data from API
    const apiResponse = await axios.get(`${API_URL}/api/analytics/trends?range=7d`);
    const apiData = apiResponse.data.data.daily;
    
    // Find matching date in API response
    const latestDbDate = dbTrends.rows[0].date.toISOString().split('T')[0];
    const apiRecord = apiData.find(d => d.date === latestDbDate);
    
    console.log('Database Data:');
    console.log(`  Date: ${latestDbDate}`);
    console.log(`  Orders: ${dbTrends.rows[0].orders}`);
    console.log(`  Revenue: $${parseFloat(dbTrends.rows[0].revenue).toFixed(2)}`);
    
    console.log('\nAPI Response:');
    console.log(`  Date: ${apiRecord?.date}`);
    console.log(`  Orders: ${apiRecord?.orders}`);
    console.log(`  Revenue: $${parseFloat(apiRecord?.revenue || 0).toFixed(2)}`);
    
    const trendsMatch = 
      apiRecord?.orders === dbTrends.rows[0].orders &&
      Math.abs(parseFloat(apiRecord?.revenue) - parseFloat(dbTrends.rows[0].revenue)) < 0.01;
    
    if (trendsMatch) {
      console.log('\n✅ PASS: API data matches database exactly!');
    } else {
      console.log('\n❌ FAIL: API data does not match database');
      allTestsPassed = false;
    }
    
    // TEST 2: Verify dashboard summary
    console.log('\n\nTEST 2: DASHBOARD SUMMARY VERIFICATION');
    console.log('=======================================');
    
    const dbSummary = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM stores) as total_stores,
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT SUM(total_amount) FROM orders WHERE status = 'completed') as total_revenue
    `);
    
    const dashboardResponse = await axios.get(`${API_URL}/api/dashboard/summary`);
    const dashData = dashboardResponse.data.data;
    
    console.log('Database Summary:');
    console.log(`  Stores: ${dbSummary.rows[0].total_stores}`);
    console.log(`  Products: ${dbSummary.rows[0].total_products}`);
    console.log(`  Orders: ${dbSummary.rows[0].total_orders}`);
    
    console.log('\nAPI Summary:');
    console.log(`  Stores: ${dashData.total_stores}`);
    console.log(`  Products: ${dashData.total_products}`);
    console.log(`  Orders: ${dashData.total_orders || dashData.orders_last_30_days}`);
    
    const summaryMatch = 
      parseInt(dashData.total_stores) === parseInt(dbSummary.rows[0].total_stores) &&
      parseInt(dashData.total_products) === parseInt(dbSummary.rows[0].total_products);
    
    if (summaryMatch) {
      console.log('\n✅ PASS: Dashboard summary matches database!');
    } else {
      console.log('\n❌ FAIL: Dashboard summary does not match');
      allTestsPassed = false;
    }
    
    // TEST 3: Test data reactivity
    console.log('\n\nTEST 3: DATA REACTIVITY TEST');
    console.log('============================');
    
    // Add a test order
    const testAmount = Math.floor(Math.random() * 10000) + 1000;
    await client.query(`
      INSERT INTO orders (id, store_id, order_date, total_amount, status, created_at)
      VALUES (gen_random_uuid(), (SELECT id FROM stores LIMIT 1), CURRENT_DATE, $1, 'completed', NOW())
    `, [testAmount]);
    
    console.log(`Added test order with amount: $${testAmount}`);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if API reflects the change
    const newApiResponse = await axios.get(`${API_URL}/api/analytics/trends?range=7d`);
    const todayData = newApiResponse.data.data.daily.find(d => 
      d.date === new Date().toISOString().split('T')[0]
    );
    
    console.log(`API now shows revenue: $${parseFloat(todayData?.revenue || 0).toFixed(2)}`);
    
    // Verify the increase
    const newDbCheck = await client.query(`
      SELECT SUM(total_amount) as revenue
      FROM orders
      WHERE DATE(order_date) = CURRENT_DATE
    `);
    
    const apiRevenue = parseFloat(todayData?.revenue || 0);
    const dbRevenue = parseFloat(newDbCheck.rows[0].revenue);
    
    if (Math.abs(apiRevenue - dbRevenue) < 0.01) {
      console.log('\n✅ PASS: API immediately reflects database changes!');
    } else {
      console.log('\n❌ FAIL: API not reflecting latest changes');
      console.log(`   DB Revenue: $${dbRevenue.toFixed(2)}`);
      console.log(`   API Revenue: $${apiRevenue.toFixed(2)}`);
      allTestsPassed = false;
    }
    
    // TEST 4: Check chart data structure
    console.log('\n\nTEST 4: CHART DATA STRUCTURE VERIFICATION');
    console.log('=========================================');
    
    const hasValidStructure = 
      apiData.every(point => 
        point.hasOwnProperty('date') &&
        point.hasOwnProperty('orders') &&
        point.hasOwnProperty('revenue') &&
        point.hasOwnProperty('target')
      );
    
    if (hasValidStructure) {
      console.log('✅ PASS: All data points have required fields for charts');
      console.log('   Fields: date, orders, revenue, target');
    } else {
      console.log('❌ FAIL: Missing required fields for chart rendering');
      allTestsPassed = false;
    }
    
    // TEST 5: Check frontend endpoints
    console.log('\n\nTEST 5: FRONTEND INTEGRATION CHECK');
    console.log('===================================');
    
    const endpoints = [
      '/api/analytics/trends?range=7d',
      '/api/analytics/product-distribution',
      '/api/dashboard/summary',
      '/api/dashboard/call-prioritization',
      '/api/orders',
      '/api/stores'
    ];
    
    console.log('Testing all chart-related endpoints:');
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${API_URL}${endpoint}`);
        const hasData = response.data && (
          response.data.data || 
          response.data.success || 
          Array.isArray(response.data)
        );
        console.log(`  ${hasData ? '✅' : '❌'} ${endpoint}`);
        if (!hasData) allTestsPassed = false;
      } catch (error) {
        console.log(`  ❌ ${endpoint} - ${error.message}`);
        allTestsPassed = false;
      }
    }
    
    // FINAL SUMMARY
    console.log('\n\n===========================================');
    console.log('           VERIFICATION SUMMARY            ');
    console.log('===========================================');
    
    if (allTestsPassed) {
      console.log('\n🎉 SUCCESS! All tests passed!');
      console.log('\n✅ Your dashboard charts are receiving REAL data from the database');
      console.log('✅ The data updates immediately when database changes');
      console.log('✅ All required endpoints are working');
      console.log('✅ Data structure is correct for chart rendering');
      
      console.log('\n📊 The frontend dashboard should display:');
      console.log('   • Line/Bar charts with revenue trends');
      console.log('   • Pie charts with product distribution');
      console.log('   • Real-time order counts and metrics');
      console.log('   • Call prioritization data');
    } else {
      console.log('\n⚠️  Some tests failed. Check the issues above.');
    }
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error.message);
  } finally {
    client.release();
    pool.end();
  }
}

verifyChartData().catch(console.error);