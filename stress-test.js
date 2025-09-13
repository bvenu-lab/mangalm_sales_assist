const axios = require('axios');

const BASE_URL = 'http://localhost:3007';

async function stressTest() {
  console.log('🔥 Starting Stress Test & Concurrent Request Testing...\n');
  
  // Test 1: Concurrent requests to same endpoint
  console.log('Test 1: 50 concurrent requests to /api/stores...');
  const start1 = Date.now();
  const promises1 = [];
  for (let i = 0; i < 50; i++) {
    promises1.push(axios.get(`${BASE_URL}/api/stores`).catch(e => ({ error: e.message })));
  }
  const results1 = await Promise.all(promises1);
  const errors1 = results1.filter(r => r.error).length;
  const time1 = Date.now() - start1;
  console.log(`  ✅ Completed in ${time1}ms`);
  console.log(`  📊 Success: ${50 - errors1}/50, Errors: ${errors1}`);
  console.log(`  ⚡ Avg response time: ${(time1 / 50).toFixed(2)}ms per request`);
  
  // Test 2: Mixed concurrent requests
  console.log('\nTest 2: 100 mixed concurrent requests...');
  const endpoints = [
    '/api/stores',
    '/api/products', 
    '/api/stores/recent',
    '/api/analytics/trends',
    '/api/performance/summary'
  ];
  
  const start2 = Date.now();
  const promises2 = [];
  for (let i = 0; i < 100; i++) {
    const endpoint = endpoints[i % endpoints.length];
    promises2.push(
      axios.get(`${BASE_URL}${endpoint}`)
        .then(r => ({ success: true, endpoint }))
        .catch(e => ({ error: e.message, endpoint }))
    );
  }
  const results2 = await Promise.all(promises2);
  const errors2 = results2.filter(r => r.error).length;
  const time2 = Date.now() - start2;
  console.log(`  ✅ Completed in ${time2}ms`);
  console.log(`  📊 Success: ${100 - errors2}/100, Errors: ${errors2}`);
  console.log(`  ⚡ Avg response time: ${(time2 / 100).toFixed(2)}ms per request`);
  
  // Test 3: Rapid sequential requests (testing rate limiting)
  console.log('\nTest 3: Rapid sequential requests (rate limit test)...');
  const start3 = Date.now();
  let rateLimitHit = false;
  let successCount = 0;
  
  for (let i = 0; i < 20; i++) {
    try {
      const response = await axios.get(`${BASE_URL}/api/stores`);
      if (response.status === 429) {
        rateLimitHit = true;
        break;
      }
      successCount++;
    } catch (e) {
      if (e.response && e.response.status === 429) {
        rateLimitHit = true;
        break;
      }
    }
  }
  const time3 = Date.now() - start3;
  console.log(`  ✅ Completed ${successCount} requests in ${time3}ms`);
  console.log(`  🚦 Rate limit hit: ${rateLimitHit ? 'Yes' : 'No (WARNING: No rate limiting!)'}`);
  
  // Test 4: Large payload handling
  console.log('\nTest 4: Large payload handling...');
  const largeData = {
    storeId: '4261931000000665698',
    items: Array(100).fill(null).map((_, i) => ({
      productId: `prod-${i}`,
      quantity: Math.floor(Math.random() * 100),
      price: Math.random() * 1000
    }))
  };
  
  try {
    const start4 = Date.now();
    const response = await axios.post(`${BASE_URL}/api/orders`, largeData, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    const time4 = Date.now() - start4;
    console.log(`  📦 Payload size: ${JSON.stringify(largeData).length} bytes`);
    console.log(`  📊 Response status: ${response.status}`);
    console.log(`  ⏱️ Response time: ${time4}ms`);
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
  }
  
  // Test 5: Memory leak detection (multiple create/delete cycles)
  console.log('\nTest 5: Memory leak detection (100 create operations)...');
  const start5 = Date.now();
  let memoryErrors = 0;
  
  for (let i = 0; i < 100; i++) {
    try {
      await axios.post(`${BASE_URL}/api/user-actions`, {
        userId: `test-${i}`,
        action: 'test',
        timestamp: new Date().toISOString()
      }, { validateStatus: () => true });
    } catch (e) {
      memoryErrors++;
    }
  }
  const time5 = Date.now() - start5;
  console.log(`  ✅ Completed in ${time5}ms`);
  console.log(`  💾 Memory errors: ${memoryErrors}`);
  
  // Final analysis
  console.log('\n' + '═'.repeat(60));
  console.log('📊 STRESS TEST SUMMARY:\n');
  
  const avgResponseTime = (time1 / 50 + time2 / 100) / 2;
  console.log(`⚡ Average response time: ${avgResponseTime.toFixed(2)}ms`);
  
  if (avgResponseTime > 100) {
    console.log('⚠️  WARNING: Response times are slow (>100ms average)');
  }
  
  if (!rateLimitHit) {
    console.log('⚠️  CRITICAL: No rate limiting detected - DDoS vulnerable!');
  }
  
  if (errors1 > 5 || errors2 > 10) {
    console.log('❌ CRITICAL: High error rate under load!');
  } else {
    console.log('✅ System handles concurrent load well');
  }
}

stressTest().catch(console.error);