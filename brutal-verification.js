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

const results = {
  honest_assessment: [],
  lies_detected: [],
  actually_working: [],
  completely_broken: [],
  partially_working: []
};

async function brutallyHonestVerification() {
  console.log('🔍 BRUTAL VERIFICATION - NO BULLSHIT ASSESSMENT\n');
  console.log('=' .repeat(70));
  
  // TEST 1: Is rate limiting ACTUALLY implemented or just claimed?
  console.log('\n1️⃣ RATE LIMITING - ACTUAL IMPLEMENTATION CHECK');
  console.log('-'.repeat(50));
  
  try {
    // First, test if we can even connect
    const testResponse = await axios.get(`${BASE_URL}/api/stores`, {
      validateStatus: () => true
    });
    
    if (testResponse.status === 200) {
      console.log('✅ API is accessible');
      
      // Check for rate limit headers
      const hasHeaders = testResponse.headers['x-ratelimit-limit'] !== undefined;
      if (hasHeaders) {
        console.log(`✅ Rate limit headers present: Limit=${testResponse.headers['x-ratelimit-limit']}`);
        results.actually_working.push('Rate limit headers exist');
      } else {
        console.log('❌ NO RATE LIMIT HEADERS - Implementation incomplete!');
        results.lies_detected.push('Rate limiting claimed but headers missing');
      }
      
      // Now hammer it to test actual limiting
      console.log('   Testing actual rate limiting by sending 105 rapid requests...');
      let rateLimitHit = false;
      let successCount = 0;
      
      for (let i = 0; i < 105; i++) {
        try {
          const r = await axios.get(`${BASE_URL}/api/stores`, {
            validateStatus: () => true,
            timeout: 1000
          });
          if (r.status === 429) {
            rateLimitHit = true;
            console.log(`   ✅ Rate limit HIT at request ${i + 1} - ACTUALLY WORKING!`);
            results.actually_working.push(`Rate limiting triggers at ${i + 1} requests`);
            break;
          } else if (r.status === 200) {
            successCount++;
          }
        } catch (e) {
          // Ignore timeout errors
        }
      }
      
      if (!rateLimitHit) {
        console.log('   ❌ RATE LIMITING NOT WORKING - Sent 105 requests without being blocked!');
        results.completely_broken.push('Rate limiting does NOT work despite claims');
      }
    } else {
      console.log(`❌ API returned ${testResponse.status} - Something is wrong`);
      results.completely_broken.push('API Gateway not responding correctly');
    }
  } catch (error) {
    console.log(`❌ CRITICAL: Cannot connect to API - ${error.message}`);
    results.completely_broken.push('API Gateway not running or accessible');
  }
  
  // TEST 2: Are orders ACTUALLY in the database?
  console.log('\n2️⃣ DATABASE ORDERS - ACTUAL DATA CHECK');
  console.log('-'.repeat(50));
  
  try {
    const orderCount = await pool.query('SELECT COUNT(*) as count FROM orders');
    const actualCount = parseInt(orderCount.rows[0].count);
    
    console.log(`   Orders in database: ${actualCount}`);
    
    if (actualCount === 0) {
      console.log('   ❌ ORDERS TABLE IS EMPTY - Migration didn\'t work!');
      results.completely_broken.push('Orders table has 0 records');
    } else if (actualCount < 100) {
      console.log(`   ⚠️ Only ${actualCount} orders - Migration partially worked`);
      results.partially_working.push(`Only ${actualCount} orders migrated`);
    } else {
      console.log(`   ✅ ${actualCount} orders present - Migration successful`);
      results.actually_working.push(`${actualCount} orders in database`);
      
      // Check if they're real orders with data
      const sampleOrder = await pool.query('SELECT * FROM orders LIMIT 1');
      if (sampleOrder.rows[0]) {
        const order = sampleOrder.rows[0];
        if (!order.customer_name || !order.total_amount) {
          console.log('   ⚠️ Orders exist but have missing data');
          results.partially_working.push('Orders have incomplete data');
        } else {
          console.log('   ✅ Orders have proper data structure');
          results.actually_working.push('Orders have complete data');
        }
      }
    }
  } catch (error) {
    console.log(`   ❌ Database error: ${error.message}`);
    results.completely_broken.push('Cannot query orders table');
  }
  
  // TEST 3: Does the orders API endpoint ACTUALLY work?
  console.log('\n3️⃣ ORDERS API ENDPOINT - FUNCTIONAL CHECK');
  console.log('-'.repeat(50));
  
  // Wait a bit for rate limit to cool down
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    const ordersResponse = await axios.get(`${BASE_URL}/api/orders`, {
      validateStatus: () => true,
      headers: { 'X-Forwarded-For': '192.168.1.' + Math.floor(Math.random() * 255) }
    });
    
    console.log(`   GET /api/orders status: ${ordersResponse.status}`);
    
    if (ordersResponse.status === 200) {
      const data = ordersResponse.data;
      if (data.success && data.data && Array.isArray(data.data)) {
        console.log(`   ✅ Endpoint returns ${data.data.length} orders`);
        results.actually_working.push(`Orders API returns ${data.data.length} records`);
        
        // Verify data structure
        if (data.data.length > 0) {
          const firstOrder = data.data[0];
          const requiredFields = ['id', 'store_id', 'customer_name', 'total_amount'];
          const missingFields = requiredFields.filter(f => !firstOrder.hasOwnProperty(f));
          
          if (missingFields.length > 0) {
            console.log(`   ⚠️ Orders missing fields: ${missingFields.join(', ')}`);
            results.partially_working.push('Orders API returns incomplete data');
          } else {
            console.log('   ✅ Orders have all required fields');
          }
        }
      } else {
        console.log('   ❌ Invalid response structure');
        results.partially_working.push('Orders API returns invalid structure');
      }
    } else if (ordersResponse.status === 429) {
      console.log('   ⚠️ Rate limited - can\'t test properly');
      results.honest_assessment.push('Orders endpoint blocked by rate limit during testing');
    } else if (ordersResponse.status === 500) {
      console.log('   ❌ ENDPOINT RETURNS 500 ERROR - NOT FIXED!');
      results.completely_broken.push('Orders endpoint still returns 500 error');
    } else {
      console.log(`   ❌ Unexpected status: ${ordersResponse.status}`);
      results.completely_broken.push(`Orders endpoint returns ${ordersResponse.status}`);
    }
  } catch (error) {
    console.log(`   ❌ API error: ${error.message}`);
    results.completely_broken.push('Orders API endpoint throws error');
  }
  
  // TEST 4: Other critical endpoints
  console.log('\n4️⃣ OTHER CRITICAL ENDPOINTS - REALITY CHECK');
  console.log('-'.repeat(50));
  
  const criticalEndpoints = [
    '/api/stores',
    '/api/products', 
    '/api/orders/analytics',
    '/api/performance/summary',
    '/api/upselling/suggestions'
  ];
  
  for (const endpoint of criticalEndpoints) {
    try {
      // Use different IPs to avoid rate limit
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        validateStatus: () => true,
        timeout: 3000,
        headers: { 'X-Forwarded-For': '10.0.0.' + Math.floor(Math.random() * 255) }
      });
      
      if (response.status === 200) {
        console.log(`   ✅ ${endpoint} - Working (${response.status})`);
        results.actually_working.push(`${endpoint} works`);
      } else if (response.status === 429) {
        console.log(`   ⚠️ ${endpoint} - Rate limited, can't verify`);
      } else if (response.status === 404) {
        console.log(`   ❌ ${endpoint} - NOT IMPLEMENTED (404)`);
        results.completely_broken.push(`${endpoint} not implemented`);
      } else if (response.status >= 500) {
        console.log(`   ❌ ${endpoint} - SERVER ERROR (${response.status})`);
        results.completely_broken.push(`${endpoint} has server error`);
      } else {
        console.log(`   ⚠️ ${endpoint} - Status ${response.status}`);
        results.partially_working.push(`${endpoint} returns ${response.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.log(`   ❌ ${endpoint} - Error: ${error.message}`);
      results.completely_broken.push(`${endpoint} throws error`);
    }
  }
  
  // TEST 5: Database integrity check
  console.log('\n5️⃣ DATABASE INTEGRITY - TRUTH CHECK');
  console.log('-'.repeat(50));
  
  try {
    const integrityCheck = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM stores) as stores,
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM mangalam_invoices) as invoices,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT COUNT(*) FROM orders WHERE store_id IS NULL) as orders_without_store,
        (SELECT COUNT(*) FROM orders WHERE customer_name IS NULL) as orders_without_customer,
        (SELECT COUNT(*) FROM orders WHERE total_amount IS NULL OR total_amount = 0) as orders_without_amount
    `);
    
    const stats = integrityCheck.rows[0];
    console.log(`   Stores: ${stats.stores}`);
    console.log(`   Products: ${stats.products}`);
    console.log(`   Invoices: ${stats.invoices}`);
    console.log(`   Orders: ${stats.orders}`);
    console.log(`   Orders without store: ${stats.orders_without_store}`);
    console.log(`   Orders without customer: ${stats.orders_without_customer}`);
    console.log(`   Orders without amount: ${stats.orders_without_amount}`);
    
    if (stats.orders === 0) {
      results.completely_broken.push('No orders in database');
    } else if (stats.orders_without_store > 0 || stats.orders_without_customer > 0) {
      results.partially_working.push('Orders have missing critical data');
    } else {
      results.actually_working.push('Database integrity good');
    }
    
    // Check if orders were actually created from invoices
    const migrationCheck = await pool.query(`
      SELECT COUNT(*) as migrated FROM orders WHERE source = 'invoice_migration'
    `);
    const migrated = migrationCheck.rows[0].migrated;
    
    if (migrated > 0) {
      console.log(`   ✅ ${migrated} orders migrated from invoices`);
      results.actually_working.push(`${migrated} orders properly migrated`);
    } else {
      console.log('   ❌ No orders from invoice migration found');
      results.lies_detected.push('Migration claimed but no migrated orders found');
    }
    
  } catch (error) {
    console.log(`   ❌ Database check failed: ${error.message}`);
    results.completely_broken.push('Database integrity check failed');
  }
  
  await pool.end();
  
  // FINAL BRUTAL ASSESSMENT
  console.log('\n' + '='.repeat(70));
  console.log('🔥 BRUTAL HONEST ASSESSMENT - THE TRUTH\n');
  
  console.log('✅ ACTUALLY WORKING:');
  if (results.actually_working.length === 0) {
    console.log('   NOTHING! Everything is broken or fake!');
  } else {
    results.actually_working.forEach(item => console.log(`   • ${item}`));
  }
  
  console.log('\n❌ COMPLETELY BROKEN:');
  if (results.completely_broken.length === 0) {
    console.log('   None');
  } else {
    results.completely_broken.forEach(item => console.log(`   • ${item}`));
  }
  
  console.log('\n⚠️ PARTIALLY WORKING:');
  if (results.partially_working.length === 0) {
    console.log('   None');
  } else {
    results.partially_working.forEach(item => console.log(`   • ${item}`));
  }
  
  console.log('\n🚨 LIES/EXAGGERATIONS DETECTED:');
  if (results.lies_detected.length === 0) {
    console.log('   None - claims appear accurate');
  } else {
    results.lies_detected.forEach(item => console.log(`   • ${item}`));
  }
  
  // Calculate honest score
  const totalTests = results.actually_working.length + 
                     results.completely_broken.length + 
                     results.partially_working.length;
  const workingScore = (results.actually_working.length / totalTests) * 100;
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL HONEST SCORE:\n');
  console.log(`   Actually Working: ${results.actually_working.length}/${totalTests} (${workingScore.toFixed(1)}%)`);
  console.log(`   Completely Broken: ${results.completely_broken.length}/${totalTests}`);
  console.log(`   Partially Working: ${results.partially_working.length}/${totalTests}`);
  
  if (workingScore >= 80) {
    console.log('\n   ✅ VERDICT: Claims are mostly accurate, system is functional');
  } else if (workingScore >= 50) {
    console.log('\n   ⚠️ VERDICT: Partially functional, significant issues remain');
  } else {
    console.log('\n   ❌ VERDICT: System is mostly broken, claims are exaggerated');
  }
  
  console.log('\n🎯 ABSOLUTE TRUTH:');
  if (results.completely_broken.length > 5) {
    console.log('   The system has MAJOR issues that were NOT actually fixed.');
    console.log('   Previous claims of fixes were premature or false.');
  } else if (results.completely_broken.length > 0) {
    console.log('   Some critical issues remain despite claims of fixes.');
  } else {
    console.log('   The fixes appear to be genuinely implemented.');
  }
}

brutallyHonestVerification().catch(console.error);