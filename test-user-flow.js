/**
 * Simple User Flow Testing
 * Tests the actual user experience without browser automation
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3007';

// Test results tracking
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper to format JSON
const formatJSON = (obj) => JSON.stringify(obj, null, 2);

// Test Frontend Availability
async function testFrontend() {
  console.log(('\n═══════════════════════════════════════════'));
  console.log(('1. FRONTEND AVAILABILITY TEST'));
  console.log(('═══════════════════════════════════════════'));
  
  try {
    const response = await axios.get(BASE_URL, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      console.log(`${('✓')} Frontend is accessible at ${BASE_URL}`);
      console.log(`${('✓')} Response headers indicate: ${response.headers['content-type']}`);
      
      // Check if it's React app
      if (response.data.includes('root') || response.data.includes('React')) {
        console.log(`${('✓')} React application detected`);
        results.passed.push('Frontend React App');
      }
      
      // Check for login elements in HTML
      if (response.data.includes('login') || response.data.includes('Login')) {
        console.log(`${('✓')} Login page elements found`);
        results.passed.push('Login Page Present');
      } else if (response.data.includes('dashboard') || response.data.includes('Dashboard')) {
        console.log(`${('⚠')} Already on dashboard (no auth required?)`);
        results.warnings.push('No authentication required');
      }
      
      results.passed.push('Frontend Accessible');
    } else {
      console.log(`${('✗')} Frontend returned status: ${response.status}`);
      results.failed.push({ test: 'Frontend', error: `Status ${response.status}` });
    }
  } catch (error) {
    console.log(`${('✗')} Frontend not accessible: ${error.message}`);
    results.failed.push({ test: 'Frontend', error: error.message });
  }
}

// Test API Authentication
async function testAuthentication() {
  console.log(('\n═══════════════════════════════════════════'));
  console.log(('2. AUTHENTICATION TEST'));
  console.log(('═══════════════════════════════════════════'));
  
  const credentials = [
    { username: 'admin', password: 'admin123', expectedRole: 'admin' },
    { username: 'user', password: 'user123', expectedRole: 'user' },
    { username: 'demo', password: 'demo2025', expectedRole: 'demo' }
  ];
  
  let validToken = null;
  
  for (const cred of credentials) {
    console.log(`\n${('Testing login:')} ${cred.username}`);
    
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, cred, {
        validateStatus: () => true
      });
      
      if (response.status === 200) {
        console.log(`  ${('✓')} Login successful`);
        console.log(`  ${('✓')} Token received: ${response.data.token?.substring(0, 20)}...`);
        console.log(`  ${('✓')} User role: ${response.data.user?.role}`);
        
        if (response.data.user?.role === cred.expectedRole) {
          console.log(`  ${('✓')} Role matches expected: ${cred.expectedRole}`);
        }
        
        results.passed.push(`Login: ${cred.username}`);
        
        if (!validToken) {
          validToken = response.data.token;
        }
      } else {
        console.log(`  ${('✗')} Login failed: ${response.status}`);
        if (response.data?.error) {
          console.log(`  ${('✗')} Error: ${response.data.error}`);
        }
        results.failed.push({ test: `Login: ${cred.username}`, error: response.data?.error });
      }
    } catch (error) {
      console.log(`  ${('✗')} Login error: ${error.message}`);
      results.failed.push({ test: `Login: ${cred.username}`, error: error.message });
    }
  }
  
  return validToken;
}

// Test Dashboard Data APIs
async function testDashboardAPIs(token) {
  console.log(('\n═══════════════════════════════════════════'));
  console.log(('3. DASHBOARD DATA APIS TEST'));
  console.log(('═══════════════════════════════════════════'));
  
  const endpoints = [
    { path: '/api/analytics/trends?range=7d', name: 'Analytics Trends' },
    { path: '/api/analytics/product-distribution', name: 'Product Distribution' },
    { path: '/api/analytics/performance-metrics', name: 'Performance Metrics' },
    { path: '/api/calls/prioritized?limit=10', name: 'Prioritized Calls' },
    { path: '/api/orders/recent?limit=10', name: 'Recent Orders' },
    { path: '/api/stores/recent?limit=10', name: 'Recent Stores' },
    { path: '/api/performance/summary', name: 'Performance Summary' },
    { path: '/api/products?limit=5', name: 'Products List' },
    { path: '/api/stores?limit=5', name: 'Stores List' }
  ];
  
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  for (const endpoint of endpoints) {
    console.log(`\n${('Testing:')} ${endpoint.name}`);
    console.log(`  Endpoint: ${endpoint.path}`);
    
    try {
      const response = await axios.get(`${API_URL}${endpoint.path}`, {
        headers,
        validateStatus: () => true,
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log(`  ${('✓')} Status: 200 OK`);
        
        if (response.data?.success) {
          console.log(`  ${('✓')} Success: true`);
          
          if (response.data.data) {
            const dataInfo = Array.isArray(response.data.data) 
              ? `Array with ${response.data.data.length} items`
              : `Object with ${Object.keys(response.data.data).length} keys`;
            console.log(`  ${('✓')} Data: ${dataInfo}`);
            
            // Show sample data for verification
            if (Array.isArray(response.data.data) && response.data.data.length > 0) {
              console.log(`  ${('ℹ')} Sample: ${JSON.stringify(response.data.data[0]).substring(0, 100)}...`);
            }
          }
        }
        
        results.passed.push(endpoint.name);
      } else if (response.status === 401) {
        console.log(`  ${('⚠')} Authentication required (401)`);
        results.warnings.push(`${endpoint.name} requires auth`);
      } else {
        console.log(`  ${('✗')} Status: ${response.status}`);
        if (response.data?.error) {
          console.log(`  ${('✗')} Error: ${response.data.error}`);
        }
        results.failed.push({ test: endpoint.name, error: `Status ${response.status}` });
      }
    } catch (error) {
      console.log(`  ${('✗')} Request failed: ${error.message}`);
      results.failed.push({ test: endpoint.name, error: error.message });
    }
  }
}

// Test Frontend API Integration
async function testFrontendAPIIntegration() {
  console.log(('\n═══════════════════════════════════════════'));
  console.log(('4. FRONTEND-API INTEGRATION TEST'));
  console.log(('═══════════════════════════════════════════'));
  
  // Check if frontend proxies to API correctly
  console.log(`\n${('Testing frontend proxy to API...')}`);
  
  try {
    // Try to access API through frontend proxy
    const response = await axios.get(`${BASE_URL}/api/health`, {
      validateStatus: () => true,
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log(`  ${('✓')} Frontend proxy to API working`);
      results.passed.push('Frontend API Proxy');
    } else {
      console.log(`  ${('⚠')} Frontend proxy returned: ${response.status}`);
      console.log(`  ${('ℹ')} Frontend might be using direct API calls`);
    }
  } catch (error) {
    console.log(`  ${('⚠')} Frontend proxy not configured`);
    console.log(`  ${('ℹ')} Frontend likely uses direct API calls to ${API_URL}`);
  }
}

// Test CORS Configuration
async function testCORS() {
  console.log(('\n═══════════════════════════════════════════'));
  console.log(('5. CORS CONFIGURATION TEST'));
  console.log(('═══════════════════════════════════════════'));
  
  try {
    const response = await axios.options(`${API_URL}/api/auth/login`, {
      headers: {
        'Origin': BASE_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      },
      validateStatus: () => true
    });
    
    const corsHeaders = response.headers['access-control-allow-origin'];
    if (corsHeaders) {
      console.log(`  ${('✓')} CORS enabled: ${corsHeaders}`);
      results.passed.push('CORS Configuration');
    } else {
      console.log(`  ${('⚠')} CORS headers not found`);
      results.warnings.push('CORS might need configuration');
    }
  } catch (error) {
    console.log(`  ${('✗')} CORS test failed: ${error.message}`);
  }
}

// Main test runner
async function runTests() {
  console.log(('\n╔══════════════════════════════════════════╗'));
  console.log(('║    USER EXPERIENCE FLOW TESTING           ║'));
  console.log(('╚══════════════════════════════════════════╝'));
  
  console.log(`\n${('Test Configuration:')}`);
  console.log(`  Frontend URL: ${BASE_URL}`);
  console.log(`  API URL: ${API_URL}`);
  console.log(`  Test Time: ${new Date().toISOString()}`);
  
  // Run tests
  await testFrontend();
  const token = await testAuthentication();
  await testDashboardAPIs(token);
  await testFrontendAPIIntegration();
  await testCORS();
  
  // Summary
  console.log(('\n═══════════════════════════════════════════'));
  console.log(('TEST SUMMARY'));
  console.log(('═══════════════════════════════════════════'));
  
  console.log(`\n${('✅ Passed:')} ${results.passed.length} tests`);
  results.passed.forEach(test => {
    console.log(`  ${('✓')} ${test}`);
  });
  
  if (results.warnings.length > 0) {
    console.log(`\n${('⚠️  Warnings:')} ${results.warnings.length} issues`);
    results.warnings.forEach(warning => {
      console.log(`  ${('⚠')} ${warning}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log(`\n${('❌ Failed:')} ${results.failed.length} tests`);
    results.failed.forEach(test => {
      console.log(`  ${('✗')} ${test.test}: ${test.error}`);
    });
  }
  
  // Recommendations
  console.log(('\n═══════════════════════════════════════════'));
  console.log(('RECOMMENDATIONS'));
  console.log(('═══════════════════════════════════════════'));
  
  if (results.failed.length === 0) {
    console.log(`${('✅')} All critical systems are operational!`);
    console.log(`${('✅')} Users can login and access the dashboard.`);
  } else {
    console.log(`${('❌')} Some issues need attention:`);
    if (results.failed.some(f => f.test?.includes('Frontend'))) {
      console.log(`  • Check if frontend is properly configured`);
    }
    if (results.failed.some(f => f.test?.includes('Login'))) {
      console.log(`  • Verify authentication configuration`);
    }
  }
  
  console.log(`\n${('To access the application:')}`);
  console.log(`  1. Open browser to: ${BASE_URL}`);
  console.log(`  2. Login with: admin / admin123`);
  console.log(`  3. Dashboard should load with data from APIs`);
  
  console.log(('\n╚══════════════════════════════════════════╝\n'));
  
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(console.error);