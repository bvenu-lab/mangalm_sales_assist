/**
 * Test Login Flow - Verify Login is Working
 */

const http = require('http');

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseData
        });
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testLoginFlow() {
  console.log('========================================');
  console.log('   TESTING COMPLETE LOGIN FLOW');
  console.log('========================================\n');

  // Step 1: Test login endpoint
  console.log('[STEP 1] Testing login endpoint...');
  
  const loginData = JSON.stringify({
    username: 'demo',
    password: 'demo2025'
  });

  const loginResponse = await makeRequest({
    hostname: 'localhost',
    port: 3007,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  }, loginData);

  if (loginResponse.statusCode === 200) {
    const result = JSON.parse(loginResponse.body);
    console.log('✅ Login successful!');
    console.log('   Token:', result.token ? result.token.substring(0, 50) + '...' : 'MISSING');
    console.log('   User:', result.user ? result.user.username : 'MISSING');
    
    if (!result.token) {
      console.log('❌ ERROR: No token in response!');
      return;
    }

    // Step 2: Test /auth/me endpoint with token
    console.log('\n[STEP 2] Testing /auth/me endpoint with token...');
    
    const meResponse = await makeRequest({
      hostname: 'localhost',
      port: 3007,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${result.token}`
      }
    });

    if (meResponse.statusCode === 200) {
      const meResult = JSON.parse(meResponse.body);
      console.log('✅ Auth verification successful!');
      console.log('   User verified:', meResult.user ? meResult.user.username : 'MISSING');
    } else {
      console.log('❌ Auth verification failed!');
      console.log('   Status:', meResponse.statusCode);
      console.log('   Response:', meResponse.body);
    }

    // Step 3: Test protected endpoint
    console.log('\n[STEP 3] Testing protected endpoint (stores)...');
    
    const storesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3007,
      path: '/api/stores',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${result.token}`
      }
    });

    if (storesResponse.statusCode === 200) {
      console.log('✅ Protected endpoint accessible with token!');
    } else {
      console.log('❌ Protected endpoint failed!');
      console.log('   Status:', storesResponse.statusCode);
    }

    // Step 4: Test without token (should fail)
    console.log('\n[STEP 4] Testing protected endpoint WITHOUT token...');
    
    const noAuthResponse = await makeRequest({
      hostname: 'localhost',
      port: 3007,
      path: '/api/stores',
      method: 'GET'
    });

    if (noAuthResponse.statusCode === 401 || noAuthResponse.statusCode === 403) {
      console.log('✅ Protected endpoint properly rejects requests without token!');
    } else {
      console.log('❌ SECURITY ISSUE: Protected endpoint accessible without token!');
      console.log('   Status:', noAuthResponse.statusCode);
    }

  } else {
    console.log('❌ Login failed!');
    console.log('   Status:', loginResponse.statusCode);
    console.log('   Response:', loginResponse.body);
  }

  console.log('\n========================================');
  console.log('   LOGIN FLOW TEST COMPLETE');
  console.log('========================================');
  console.log('\nTo test in browser:');
  console.log('1. Open http://localhost:3000 in incognito/private window');
  console.log('2. You should see the login page');
  console.log('3. Enter: demo / demo2025');
  console.log('4. You should be redirected to dashboard');
  console.log('\nIf already logged in:');
  console.log('1. Go to http://localhost:3000/clear-auth');
  console.log('2. OR press F12 > Console > type: localStorage.clear()');
  console.log('3. Refresh the page');
}

// Run the test
testLoginFlow().catch(console.error);