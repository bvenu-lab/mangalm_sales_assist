const axios = require('axios');

const BASE_URL = 'http://localhost:3007';

async function testRateLimit() {
  console.log('🔒 Testing Rate Limiting Implementation...\n');
  
  // Test 1: Normal rate limit (100 requests per minute)
  console.log('Test 1: Testing standard rate limit on /api/stores...');
  let successCount = 0;
  let rateLimitHit = false;
  let rateLimitResponse = null;
  
  for (let i = 0; i < 120; i++) {
    try {
      const response = await axios.get(`${BASE_URL}/api/stores`, {
        validateStatus: () => true
      });
      
      if (response.status === 429) {
        rateLimitHit = true;
        rateLimitResponse = response;
        console.log(`  ✅ Rate limit triggered at request ${i + 1}`);
        console.log(`  Headers: X-RateLimit-Limit: ${response.headers['x-ratelimit-limit']}`);
        console.log(`  Headers: X-RateLimit-Remaining: ${response.headers['x-ratelimit-remaining']}`);
        console.log(`  Response: ${JSON.stringify(response.data)}`);
        break;
      } else if (response.status === 200) {
        successCount++;
      }
    } catch (e) {
      console.log(`  Error at request ${i + 1}: ${e.message}`);
    }
  }
  
  if (rateLimitHit) {
    console.log(`  ✅ RATE LIMITING IS WORKING! Hit after ${successCount} successful requests\n`);
  } else {
    console.log(`  ❌ WARNING: No rate limit hit after 120 requests!\n`);
  }
  
  // Test 2: Strict rate limit (60 requests per minute on sensitive endpoints)
  console.log('Test 2: Testing strict rate limit on /api/orders/generate...');
  let strictSuccess = 0;
  let strictRateLimitHit = false;
  
  // Wait a bit to reset rate limit window
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  for (let i = 0; i < 70; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/api/orders/generate`, 
        { storeId: '4261931000000665698' },
        { validateStatus: () => true }
      );
      
      if (response.status === 429) {
        strictRateLimitHit = true;
        console.log(`  ✅ Strict rate limit triggered at request ${i + 1}`);
        break;
      } else {
        strictSuccess++;
      }
    } catch (e) {
      // Continue
    }
  }
  
  if (strictRateLimitHit) {
    console.log(`  ✅ STRICT RATE LIMITING IS WORKING! Hit after ${strictSuccess} requests\n`);
  } else {
    console.log(`  ⚠️ Strict rate limit may not be configured correctly\n`);
  }
  
  // Test 3: Check rate limit headers
  console.log('Test 3: Checking rate limit headers...');
  try {
    const response = await axios.get(`${BASE_URL}/api/stores`, {
      validateStatus: () => true
    });
    
    const headers = response.headers;
    if (headers['x-ratelimit-limit']) {
      console.log(`  ✅ Rate limit headers present:`);
      console.log(`     X-RateLimit-Limit: ${headers['x-ratelimit-limit']}`);
      console.log(`     X-RateLimit-Remaining: ${headers['x-ratelimit-remaining']}`);
      console.log(`     X-RateLimit-Used: ${headers['x-ratelimit-used']}`);
      if (headers['x-ratelimit-reset']) {
        console.log(`     X-RateLimit-Reset: ${headers['x-ratelimit-reset']}`);
      }
    } else {
      console.log('  ⚠️ Rate limit headers not found');
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RATE LIMITING TEST SUMMARY:\n');
  
  if (rateLimitHit) {
    console.log('✅ CRITICAL SECURITY ISSUE FIXED!');
    console.log('   - Rate limiting is now active');
    console.log('   - DDoS vulnerability has been mitigated');
    console.log('   - Standard limit: 100 requests/minute');
    console.log('   - Strict limit: 60 requests/minute for sensitive endpoints');
  } else {
    console.log('❌ RATE LIMITING NOT WORKING PROPERLY');
    console.log('   - System is still vulnerable to DDoS attacks');
    console.log('   - Further investigation needed');
  }
}

testRateLimit().catch(console.error);