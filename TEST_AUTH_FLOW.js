/**
 * Test Authentication Flow
 * Verifies login is required and working properly
 */

const http = require('http');

async function testAuthFlow() {
  console.log('=================================');
  console.log('   TESTING AUTHENTICATION FLOW');
  console.log('=================================\n');

  // Test 1: Check if accessing protected route redirects to login
  console.log('[TEST 1] Checking if protected routes require login...');
  
  try {
    const response = await new Promise((resolve, reject) => {
      http.get('http://localhost:3000', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      }).on('error', reject);
    });

    // Check if the response contains login-related content
    const hasLoginForm = response.body.includes('login') || 
                        response.body.includes('Login') ||
                        response.body.includes('password') ||
                        response.body.includes('username');
    
    if (hasLoginForm) {
      console.log('✅ Frontend shows login page (auth required)');
    } else {
      console.log('⚠️  Frontend may be bypassing login');
    }
  } catch (error) {
    console.log('❌ Failed to check frontend:', error.message);
  }

  // Test 2: Check API authentication
  console.log('\n[TEST 2] Testing API authentication...');
  
  // Try to access protected endpoint without token
  try {
    const response = await new Promise((resolve, reject) => {
      http.get({
        hostname: 'localhost',
        port: 3007,
        path: '/api/stores',
        headers: {}
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        });
      }).on('error', reject);
    });

    if (response.statusCode === 401 || response.statusCode === 403) {
      console.log('✅ API properly requires authentication');
    } else if (response.statusCode === 200) {
      console.log('⚠️  API returned data without authentication!');
      console.log('   Response:', response.body.substring(0, 100));
    } else {
      console.log('❓ Unexpected status:', response.statusCode);
    }
  } catch (error) {
    console.log('❌ Failed to test API:', error.message);
  }

  // Test 3: Check login endpoint
  console.log('\n[TEST 3] Testing login endpoint...');
  
  const loginData = JSON.stringify({
    username: 'demo',
    password: 'demo2025'
  });

  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3007,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': loginData.length
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        });
      });
      
      req.on('error', reject);
      req.write(loginData);
      req.end();
    });

    if (response.statusCode === 200) {
      const result = JSON.parse(response.body);
      if (result.token) {
        console.log('✅ Login endpoint works correctly');
        console.log('   Token received:', result.token.substring(0, 50) + '...');
        
        // Test 4: Try API with token
        console.log('\n[TEST 4] Testing API access with valid token...');
        
        const authResponse = await new Promise((resolve, reject) => {
          http.get({
            hostname: 'localhost',
            port: 3007,
            path: '/api/stores',
            headers: {
              'Authorization': `Bearer ${result.token}`
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              resolve({
                statusCode: res.statusCode,
                body: data
              });
            });
          }).on('error', reject);
        });

        if (authResponse.statusCode === 200) {
          console.log('✅ API accepts valid authentication token');
        } else {
          console.log('❌ API rejected valid token. Status:', authResponse.statusCode);
        }
      } else {
        console.log('❌ Login response missing token');
      }
    } else {
      console.log('❌ Login failed. Status:', response.statusCode);
    }
  } catch (error) {
    console.log('❌ Login test failed:', error.message);
  }

  // Summary
  console.log('\n=================================');
  console.log('   AUTHENTICATION FLOW SUMMARY');
  console.log('=================================');
  
  console.log('\nTo fix authentication bypass:');
  console.log('1. Clear browser localStorage: Open DevTools > Application > Clear Storage');
  console.log('2. Or navigate to: http://localhost:3000/clear-auth');
  console.log('3. Or run in browser console: localStorage.clear()');
  console.log('\nDefault credentials:');
  console.log('  Username: demo');
  console.log('  Password: demo2025');
  console.log('\nAlternative credentials:');
  console.log('  admin / admin123');
  console.log('  user / user123');
}

// Run the test
testAuthFlow().catch(console.error);