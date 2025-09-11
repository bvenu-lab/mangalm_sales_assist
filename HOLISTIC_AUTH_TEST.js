/**
 * HOLISTIC AUTHENTICATION VERIFICATION
 * Complete end-to-end test of authentication system
 */

const http = require('http');
const https = require('https');

// Color codes for output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

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

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFrontendLoad() {
  console.log(`\n${BLUE}[FRONTEND TEST]${RESET} Testing frontend accessibility...`);
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    });
    
    if (response.statusCode === 200) {
      const hasReactRoot = response.body.includes('root');
      const hasScript = response.body.includes('<script');
      
      if (hasReactRoot && hasScript) {
        console.log(`${GREEN}✅ Frontend is loading React app${RESET}`);
        return true;
      } else {
        console.log(`${RED}❌ Frontend HTML missing React components${RESET}`);
        return false;
      }
    } else {
      console.log(`${RED}❌ Frontend returned status ${response.statusCode}${RESET}`);
      return false;
    }
  } catch (error) {
    console.log(`${RED}❌ Frontend not accessible: ${error.message}${RESET}`);
    return false;
  }
}

async function testAuthFlow() {
  console.log(`\n${BOLD}════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}   HOLISTIC AUTHENTICATION VERIFICATION${RESET}`);
  console.log(`${BOLD}════════════════════════════════════════════════════════${RESET}\n`);

  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // 1. Test Service Availability
  console.log(`${BLUE}[PHASE 1]${RESET} Service Health Checks`);
  console.log('─'.repeat(50));
  
  // Test Frontend
  const frontendOk = await testFrontendLoad();
  if (frontendOk) results.passed.push('Frontend accessible');
  else results.failed.push('Frontend accessible');
  
  // Test API Gateway health
  console.log(`\n${BLUE}[API GATEWAY TEST]${RESET} Testing API Gateway health...`);
  try {
    const healthResponse = await makeRequest({
      hostname: 'localhost',
      port: 3007,
      path: '/health',
      method: 'GET'
    });
    
    if (healthResponse.statusCode === 200) {
      console.log(`${GREEN}✅ API Gateway is healthy${RESET}`);
      results.passed.push('API Gateway health');
    } else {
      console.log(`${RED}❌ API Gateway health check failed${RESET}`);
      results.failed.push('API Gateway health');
    }
  } catch (error) {
    console.log(`${RED}❌ API Gateway not responding: ${error.message}${RESET}`);
    results.failed.push('API Gateway health');
  }

  // 2. Test Authentication Endpoints
  console.log(`\n${BLUE}[PHASE 2]${RESET} Authentication Endpoint Tests`);
  console.log('─'.repeat(50));
  
  // Test login with invalid credentials
  console.log(`\n${YELLOW}[TEST]${RESET} Invalid credentials should be rejected...`);
  const invalidLogin = JSON.stringify({
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
        'Content-Length': invalidLogin.length
      }
    }, invalidLogin);
    
    if (invalidResponse.statusCode === 401) {
      console.log(`${GREEN}✅ Invalid credentials correctly rejected${RESET}`);
      results.passed.push('Reject invalid credentials');
    } else {
      console.log(`${RED}❌ Invalid credentials not rejected (status: ${invalidResponse.statusCode})${RESET}`);
      results.failed.push('Reject invalid credentials');
    }
  } catch (error) {
    console.log(`${RED}❌ Error testing invalid login: ${error.message}${RESET}`);
    results.failed.push('Reject invalid credentials');
  }
  
  // Test login with valid credentials
  console.log(`\n${YELLOW}[TEST]${RESET} Valid credentials should authenticate...`);
  const validLogin = JSON.stringify({
    username: 'demo',
    password: 'demo2025'
  });
  
  let authToken = null;
  let userData = null;
  
  try {
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3007,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': validLogin.length
      }
    }, validLogin);
    
    if (loginResponse.statusCode === 200) {
      const result = JSON.parse(loginResponse.body);
      console.log(`${BLUE}Response structure:${RESET}`, {
        hasSuccess: 'success' in result,
        hasToken: 'token' in result,
        hasUser: 'user' in result,
        success: result.success
      });
      
      if (result.success && result.token && result.user) {
        authToken = result.token;
        userData = result.user;
        console.log(`${GREEN}✅ Login successful${RESET}`);
        console.log(`  Token: ${authToken.substring(0, 30)}...`);
        console.log(`  User: ${userData.username} (${userData.role})`);
        results.passed.push('Login with valid credentials');
      } else {
        console.log(`${RED}❌ Login response missing required fields${RESET}`);
        console.log(`  Response:`, result);
        results.failed.push('Login with valid credentials');
      }
    } else {
      console.log(`${RED}❌ Login failed with status ${loginResponse.statusCode}${RESET}`);
      console.log(`  Response:`, loginResponse.body);
      results.failed.push('Login with valid credentials');
    }
  } catch (error) {
    console.log(`${RED}❌ Login error: ${error.message}${RESET}`);
    results.failed.push('Login with valid credentials');
  }
  
  // 3. Test Token Validation
  if (authToken) {
    console.log(`\n${BLUE}[PHASE 3]${RESET} Token Validation Tests`);
    console.log('─'.repeat(50));
    
    // Test /auth/me endpoint
    console.log(`\n${YELLOW}[TEST]${RESET} Token should validate with /auth/me...`);
    try {
      const meResponse = await makeRequest({
        hostname: 'localhost',
        port: 3007,
        path: '/api/auth/me',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (meResponse.statusCode === 200) {
        const meResult = JSON.parse(meResponse.body);
        console.log(`${BLUE}Response structure:${RESET}`, {
          hasSuccess: 'success' in meResult,
          hasUser: 'user' in meResult,
          success: meResult.success
        });
        
        if (meResult.success && meResult.user) {
          console.log(`${GREEN}✅ Token validation successful${RESET}`);
          console.log(`  Verified user: ${meResult.user.username}`);
          results.passed.push('Token validation');
        } else {
          console.log(`${RED}❌ /auth/me response missing required fields${RESET}`);
          results.failed.push('Token validation');
        }
      } else {
        console.log(`${RED}❌ Token validation failed (status: ${meResponse.statusCode})${RESET}`);
        results.failed.push('Token validation');
      }
    } catch (error) {
      console.log(`${RED}❌ Token validation error: ${error.message}${RESET}`);
      results.failed.push('Token validation');
    }
    
    // 4. Test Protected Routes
    console.log(`\n${BLUE}[PHASE 4]${RESET} Protected Route Tests`);
    console.log('─'.repeat(50));
    
    // Test with token
    console.log(`\n${YELLOW}[TEST]${RESET} Protected routes should accept valid token...`);
    try {
      const protectedResponse = await makeRequest({
        hostname: 'localhost',
        port: 3007,
        path: '/api/stores',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (protectedResponse.statusCode === 200) {
        console.log(`${GREEN}✅ Protected route accessible with token${RESET}`);
        results.passed.push('Protected route with token');
      } else {
        console.log(`${RED}❌ Protected route rejected valid token (status: ${protectedResponse.statusCode})${RESET}`);
        results.failed.push('Protected route with token');
      }
    } catch (error) {
      console.log(`${RED}❌ Protected route error: ${error.message}${RESET}`);
      results.failed.push('Protected route with token');
    }
  }
  
  // Test without token
  console.log(`\n${YELLOW}[TEST]${RESET} Protected routes should reject missing token...`);
  try {
    const noAuthResponse = await makeRequest({
      hostname: 'localhost',
      port: 3007,
      path: '/api/stores',
      method: 'GET'
    });
    
    if (noAuthResponse.statusCode === 401 || noAuthResponse.statusCode === 403) {
      console.log(`${GREEN}✅ Protected route correctly rejects missing token${RESET}`);
      results.passed.push('Protected route security');
    } else {
      console.log(`${RED}❌ SECURITY ISSUE: Protected route accessible without token!${RESET}`);
      console.log(`  Status: ${noAuthResponse.statusCode}`);
      results.failed.push('Protected route security');
    }
  } catch (error) {
    console.log(`${RED}❌ Protected route test error: ${error.message}${RESET}`);
    results.failed.push('Protected route security');
  }
  
  // 5. Test Frontend Integration
  console.log(`\n${BLUE}[PHASE 5]${RESET} Frontend Integration Tests`);
  console.log('─'.repeat(50));
  
  console.log(`\n${YELLOW}[TEST]${RESET} Frontend should load without token...`);
  try {
    const frontendResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    });
    
    if (frontendResponse.statusCode === 200) {
      console.log(`${GREEN}✅ Frontend loads successfully${RESET}`);
      
      // Check for React app
      if (frontendResponse.body.includes('id="root"')) {
        console.log(`${GREEN}✅ React app container found${RESET}`);
        results.passed.push('Frontend React integration');
      } else {
        console.log(`${YELLOW}⚠️  React root element not found in HTML${RESET}`);
        results.warnings.push('React root element');
      }
    } else {
      console.log(`${RED}❌ Frontend returned status ${frontendResponse.statusCode}${RESET}`);
      results.failed.push('Frontend loading');
    }
  } catch (error) {
    console.log(`${RED}❌ Frontend test error: ${error.message}${RESET}`);
    results.failed.push('Frontend loading');
  }
  
  // SUMMARY
  console.log(`\n${BOLD}════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}   TEST SUMMARY${RESET}`);
  console.log(`${BOLD}════════════════════════════════════════════════════════${RESET}`);
  
  console.log(`\n${GREEN}✅ PASSED (${results.passed.length}):${RESET}`);
  results.passed.forEach(test => console.log(`   • ${test}`));
  
  if (results.warnings.length > 0) {
    console.log(`\n${YELLOW}⚠️  WARNINGS (${results.warnings.length}):${RESET}`);
    results.warnings.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\n${RED}❌ FAILED (${results.failed.length}):${RESET}`);
    results.failed.forEach(test => console.log(`   • ${test}`));
  }
  
  const totalTests = results.passed.length + results.failed.length;
  const passRate = (results.passed.length / totalTests * 100).toFixed(1);
  
  console.log(`\n${BOLD}════════════════════════════════════════════════════════${RESET}`);
  if (results.failed.length === 0) {
    console.log(`${GREEN}${BOLD}   🎉 ALL TESTS PASSED! (${passRate}%)${RESET}`);
    console.log(`${GREEN}${BOLD}   AUTHENTICATION SYSTEM IS FULLY OPERATIONAL${RESET}`);
  } else {
    console.log(`${RED}${BOLD}   ⚠️  SOME TESTS FAILED (${passRate}% pass rate)${RESET}`);
    console.log(`${RED}${BOLD}   AUTHENTICATION NEEDS ATTENTION${RESET}`);
  }
  console.log(`${BOLD}════════════════════════════════════════════════════════${RESET}`);
  
  // Browser Testing Instructions
  console.log(`\n${BLUE}${BOLD}BROWSER VERIFICATION STEPS:${RESET}`);
  console.log('─'.repeat(50));
  console.log('1. Open a NEW incognito/private window');
  console.log('2. Open DevTools (F12) → Console tab');
  console.log('3. Navigate to: http://localhost:3000');
  console.log('4. Watch console for authentication logs');
  console.log('5. You should see login page');
  console.log('6. Enter: demo / demo2025');
  console.log('7. Click Login');
  console.log('8. Should redirect to dashboard');
  console.log('\nLook for these console messages:');
  console.log('  • [AuthContext] MOUNT: Starting authentication check');
  console.log('  • [AuthContext] LOGIN: Success! Token received');
  console.log('  • [AuthContext] LOGIN: Navigating NOW to /dashboard');
  console.log('  • [ProtectedRoute] User authenticated, rendering protected content');
  
  return results.failed.length === 0;
}

// Run the test
testAuthFlow().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error(`${RED}Test suite error: ${error.message}${RESET}`);
  process.exit(1);
});