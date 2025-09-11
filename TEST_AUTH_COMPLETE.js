/**
 * Complete Authentication Test Suite
 * Tests the entire authentication flow with proper architecture
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

async function testAuthenticationFlow() {
  console.log('════════════════════════════════════════════════════════');
  console.log('   COMPLETE AUTHENTICATION FLOW TEST');
  console.log('════════════════════════════════════════════════════════\n');

  let allTestsPassed = true;
  const results = {
    passed: [],
    failed: []
  };

  // Test 1: Login with valid credentials
  console.log('[TEST 1] Testing login with valid credentials...');
  
  const loginData = JSON.stringify({
    username: 'demo',
    password: 'demo2025'
  });

  try {
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
      
      if (result.token && result.user) {
        console.log('✅ Login successful');
        console.log('   Token received:', result.token.substring(0, 20) + '...');
        console.log('   User:', result.user.username);
        results.passed.push('Login with valid credentials');
        
        const token = result.token;
        
        // Test 2: Verify token with /auth/me
        console.log('\n[TEST 2] Testing /auth/me with valid token...');
        
        const meResponse = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/auth/me',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (meResponse.statusCode === 200) {
          const meResult = JSON.parse(meResponse.body);
          if (meResult.user) {
            console.log('✅ Token verification successful');
            console.log('   User verified:', meResult.user.username);
            results.passed.push('Token verification with /auth/me');
          } else {
            console.log('❌ Token verification failed - no user in response');
            results.failed.push('Token verification with /auth/me');
            allTestsPassed = false;
          }
        } else {
          console.log('❌ Token verification failed');
          console.log('   Status:', meResponse.statusCode);
          console.log('   Response:', meResponse.body);
          results.failed.push('Token verification with /auth/me');
          allTestsPassed = false;
        }

        // Test 3: Access protected endpoint with token
        console.log('\n[TEST 3] Testing protected endpoint with token...');
        
        const protectedResponse = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/stores',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (protectedResponse.statusCode === 200) {
          console.log('✅ Protected endpoint accessible with valid token');
          results.passed.push('Access protected endpoint with token');
        } else {
          console.log('❌ Protected endpoint not accessible');
          console.log('   Status:', protectedResponse.statusCode);
          results.failed.push('Access protected endpoint with token');
          allTestsPassed = false;
        }

        // Test 4: Verify protected endpoint blocks requests without token
        console.log('\n[TEST 4] Testing protected endpoint WITHOUT token...');
        
        const noAuthResponse = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/stores',
          method: 'GET'
        });

        if (noAuthResponse.statusCode === 401 || noAuthResponse.statusCode === 403) {
          console.log('✅ Protected endpoint correctly rejects requests without token');
          results.passed.push('Protected endpoint blocks unauthorized access');
        } else {
          console.log('❌ SECURITY ISSUE: Protected endpoint accessible without token!');
          console.log('   Status:', noAuthResponse.statusCode);
          results.failed.push('Protected endpoint blocks unauthorized access');
          allTestsPassed = false;
        }

        // Test 5: Test logout
        console.log('\n[TEST 5] Testing logout...');
        
        const logoutResponse = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/auth/logout',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (logoutResponse.statusCode === 200) {
          console.log('✅ Logout successful');
          results.passed.push('Logout functionality');
        } else {
          console.log('❌ Logout failed');
          console.log('   Status:', logoutResponse.statusCode);
          results.failed.push('Logout functionality');
          allTestsPassed = false;
        }

      } else {
        console.log('❌ Login response missing token or user');
        console.log('   Response:', loginResponse.body);
        results.failed.push('Login with valid credentials');
        allTestsPassed = false;
      }
    } else {
      console.log('❌ Login failed');
      console.log('   Status:', loginResponse.statusCode);
      console.log('   Response:', loginResponse.body);
      results.failed.push('Login with valid credentials');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Test error:', error.message);
    results.failed.push('Connection to API Gateway');
    allTestsPassed = false;
  }

  // Test 6: Invalid login credentials
  console.log('\n[TEST 6] Testing login with invalid credentials...');
  
  const invalidLoginData = JSON.stringify({
    username: 'demo',
    password: 'wrongpassword'
  });

  try {
    const invalidResponse = await makeRequest({
      hostname: 'localhost',
      port: 3007,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': invalidLoginData.length
      }
    }, invalidLoginData);

    if (invalidResponse.statusCode === 401) {
      console.log('✅ Invalid credentials correctly rejected');
      results.passed.push('Reject invalid credentials');
    } else {
      console.log('❌ Invalid credentials not properly rejected');
      console.log('   Status:', invalidResponse.statusCode);
      results.failed.push('Reject invalid credentials');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Test error:', error.message);
    results.failed.push('Reject invalid credentials');
    allTestsPassed = false;
  }

  // Summary
  console.log('\n════════════════════════════════════════════════════════');
  console.log('   TEST SUMMARY');
  console.log('════════════════════════════════════════════════════════');
  
  console.log('\n✅ PASSED TESTS (' + results.passed.length + '):');
  results.passed.forEach(test => console.log('   - ' + test));
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS (' + results.failed.length + '):');
    results.failed.forEach(test => console.log('   - ' + test));
  }

  console.log('\n════════════════════════════════════════════════════════');
  if (allTestsPassed) {
    console.log('   🎉 ALL TESTS PASSED! AUTHENTICATION IS WORKING!');
  } else {
    console.log('   ⚠️  SOME TESTS FAILED - AUTHENTICATION NEEDS FIXES');
  }
  console.log('════════════════════════════════════════════════════════');

  console.log('\n📝 BROWSER TESTING INSTRUCTIONS:');
  console.log('════════════════════════════════════════════════════════');
  console.log('1. Open a NEW incognito/private browser window');
  console.log('2. Navigate to: http://localhost:3000');
  console.log('3. You should see the login page');
  console.log('4. Enter credentials:');
  console.log('   Username: demo');
  console.log('   Password: demo2025');
  console.log('5. Click Login');
  console.log('6. You should be redirected to the dashboard');
  console.log('\nIf you see cached content:');
  console.log('1. Open DevTools (F12)');
  console.log('2. Go to Console tab');
  console.log('3. Type: localStorage.clear()');
  console.log('4. Press Enter and refresh the page');
  console.log('════════════════════════════════════════════════════════');
}

// Run the test
testAuthenticationFlow().catch(console.error);