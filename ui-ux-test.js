const axios = require('axios');

const FRONTEND_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3007';

async function testUIComponents() {
  console.log('🎨 Starting UI/UX Component Testing...\n');
  console.log('═'.repeat(60));
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  // Test 1: Frontend availability
  console.log('Test 1: Frontend server availability...');
  try {
    const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
    if (response.status === 200) {
      console.log('  ✅ Frontend is accessible');
      results.passed.push('Frontend accessible');
    }
  } catch (e) {
    console.log('  ❌ Frontend not accessible:', e.message);
    results.failed.push('Frontend not accessible');
  }
  
  // Test 2: Static assets
  console.log('\nTest 2: Static asset loading...');
  const assets = [
    '/static/js/bundle.js',
    '/static/css/main.css',
    '/manifest.json',
    '/favicon.ico'
  ];
  
  for (const asset of assets) {
    try {
      const response = await axios.head(`${FRONTEND_URL}${asset}`, { 
        timeout: 2000,
        validateStatus: () => true 
      });
      if (response.status === 200 || response.status === 304) {
        console.log(`  ✅ ${asset} - OK`);
      } else {
        console.log(`  ⚠️ ${asset} - Status ${response.status}`);
        results.warnings.push(`${asset} returned ${response.status}`);
      }
    } catch (e) {
      console.log(`  ❌ ${asset} - Failed`);
      results.failed.push(`Asset ${asset} failed to load`);
    }
  }
  
  // Test 3: API connectivity from frontend perspective
  console.log('\nTest 3: Frontend-to-API connectivity...');
  const apiEndpoints = [
    '/api/stores/recent',
    '/api/analytics/trends',
    '/api/performance/summary'
  ];
  
  for (const endpoint of apiEndpoints) {
    try {
      const response = await axios.get(`${API_URL}${endpoint}`, { timeout: 3000 });
      console.log(`  ✅ ${endpoint} - Accessible`);
      
      // Check response structure
      if (!response.data || typeof response.data !== 'object') {
        console.log(`    ⚠️ Invalid response structure`);
        results.warnings.push(`${endpoint} has invalid structure`);
      }
    } catch (e) {
      console.log(`  ❌ ${endpoint} - Failed`);
      results.failed.push(`API ${endpoint} not accessible`);
    }
  }
  
  // Test 4: CORS headers
  console.log('\nTest 4: CORS configuration...');
  try {
    const response = await axios.options(`${API_URL}/api/stores`, {
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      },
      validateStatus: () => true
    });
    
    const corsHeaders = response.headers['access-control-allow-origin'];
    if (corsHeaders) {
      console.log(`  ✅ CORS headers present: ${corsHeaders}`);
      results.passed.push('CORS configured');
    } else {
      console.log('  ❌ CORS headers missing');
      results.failed.push('CORS not configured');
    }
  } catch (e) {
    console.log('  ❌ CORS test failed:', e.message);
    results.failed.push('CORS test failed');
  }
  
  // Test 5: Response times for UI-critical endpoints
  console.log('\nTest 5: UI-critical endpoint performance...');
  const criticalEndpoints = [
    { path: '/api/stores/recent', maxTime: 200 },
    { path: '/api/analytics/trends', maxTime: 300 },
    { path: '/api/calls/prioritized', maxTime: 200 }
  ];
  
  for (const endpoint of criticalEndpoints) {
    const start = Date.now();
    try {
      await axios.get(`${API_URL}${endpoint.path}`);
      const duration = Date.now() - start;
      
      if (duration <= endpoint.maxTime) {
        console.log(`  ✅ ${endpoint.path} - ${duration}ms (max: ${endpoint.maxTime}ms)`);
      } else {
        console.log(`  ⚠️ ${endpoint.path} - ${duration}ms (exceeds ${endpoint.maxTime}ms)`);
        results.warnings.push(`${endpoint.path} slow: ${duration}ms`);
      }
    } catch (e) {
      console.log(`  ❌ ${endpoint.path} - Failed`);
      results.failed.push(`Critical endpoint ${endpoint.path} failed`);
    }
  }
  
  // Test 6: WebSocket support
  console.log('\nTest 6: WebSocket support...');
  try {
    const io = require('socket.io-client');
    const socket = io(`${API_URL}/upload-progress`, {
      transports: ['websocket'],
      timeout: 3000
    });
    
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('  ✅ WebSocket connection established');
        socket.disconnect();
        resolve();
      });
      socket.on('connect_error', (error) => {
        console.log('  ⚠️ WebSocket connection failed:', error.message);
        results.warnings.push('WebSocket not available');
        reject(error);
      });
      setTimeout(() => reject(new Error('Timeout')), 3000);
    }).catch(() => {});
  } catch (e) {
    console.log('  ℹ️ WebSocket test skipped (socket.io-client not available)');
  }
  
  // Final Report
  console.log('\n' + '═'.repeat(60));
  console.log('📊 UI/UX TEST SUMMARY:\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️ Warnings: ${results.warnings.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ CRITICAL FAILURES:');
    results.failed.forEach(f => console.log(`  - ${f}`));
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    results.warnings.forEach(w => console.log(`  - ${w}`));
  }
  
  // Overall assessment
  console.log('\n🎯 OVERALL UI/UX ASSESSMENT:');
  if (results.failed.length === 0) {
    console.log('  ✅ UI/UX components are functional');
  } else if (results.failed.length <= 2) {
    console.log('  ⚠️ UI/UX has minor issues');
  } else {
    console.log('  ❌ UI/UX has critical issues affecting user experience');
  }
  
  return results;
}

testUIComponents().catch(console.error);