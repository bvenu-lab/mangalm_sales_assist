const axios = require('axios');

const API_GATEWAY_URL = 'http://localhost:3007';

async function testAllEndpoints() {
  console.log('=== TESTING ALL DASHBOARD ENDPOINTS ===\n');
  
  const endpoints = [
    { name: 'Dashboard Summary', url: '/api/dashboard/summary' },
    { name: 'Performance Metrics', url: '/api/analytics/performance-metrics' },
    { name: 'Product Distribution', url: '/api/analytics/product-distribution' },
    { name: 'Revenue Trends', url: '/api/analytics/trends' },
    { name: 'AI Insights', url: '/api/analytics/insights' },
    { name: 'Call Prioritization', url: '/api/dashboard/call-prioritization' },
    { name: 'Orders List', url: '/api/orders' },
    { name: 'Predicted Orders', url: '/api/predicted-orders' },
    { name: 'Stores List', url: '/api/stores' }
  ];
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name}...`);
      const response = await axios.get(`${API_GATEWAY_URL}${endpoint.url}`, {
        timeout: 5000
      });
      
      if (response.data) {
        const dataInfo = Array.isArray(response.data) 
          ? `Array with ${response.data.length} items`
          : typeof response.data === 'object' 
            ? `Object with keys: ${Object.keys(response.data).slice(0, 5).join(', ')}${Object.keys(response.data).length > 5 ? '...' : ''}`
            : 'Data received';
            
        console.log(`   ✓ ${endpoint.name}: ${dataInfo}`);
        passedTests++;
      } else {
        console.log(`   ⚠ ${endpoint.name}: Empty response`);
        failedTests++;
      }
    } catch (error) {
      console.log(`   ✗ ${endpoint.name}: ${error.message}`);
      failedTests++;
    }
  }
  
  console.log('\n=== TEST RESULTS ===');
  console.log(`Passed: ${passedTests}/${endpoints.length}`);
  console.log(`Failed: ${failedTests}/${endpoints.length}`);
  
  const successRate = (passedTests / endpoints.length) * 100;
  console.log(`Success Rate: ${successRate.toFixed(1)}%`);
  
  if (successRate === 100) {
    console.log('\n✅ ALL ENDPOINTS WORKING PERFECTLY!');
    console.log('✅ SYSTEM IS FULLY OPERATIONAL!');
    console.log('\n🎉 The dashboard should now display:');
    console.log('   - Revenue metrics and KPIs');
    console.log('   - Order status distribution');
    console.log('   - Product performance charts');
    console.log('   - Call prioritization list');
    console.log('   - AI-powered predictions');
    console.log('   - Store analytics');
  } else if (successRate >= 80) {
    console.log('\n⚠ SYSTEM MOSTLY OPERATIONAL');
    console.log('Some endpoints need attention.');
  } else {
    console.log('\n❌ SYSTEM NEEDS FIXES');
    console.log('Multiple endpoints are failing.');
  }
}

testAllEndpoints().catch(console.error);