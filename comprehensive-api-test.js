const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3007';
const results = {
  passed: [],
  failed: [],
  errors: [],
  performance: []
};

// Test configurations
const endpoints = [
  // Dashboard endpoints
  { method: 'GET', path: '/api/stores/recent', expected: 200, description: 'Recent stores' },
  { method: 'GET', path: '/api/orders/pending', expected: 200, description: 'Pending orders' },
  { method: 'GET', path: '/api/orders/recent', expected: 200, description: 'Recent orders' },
  { method: 'GET', path: '/api/calls/prioritized', expected: 200, description: 'Prioritized calls' },
  { method: 'GET', path: '/api/performance/summary', expected: 200, description: 'Performance summary' },
  
  // Analytics endpoints
  { method: 'GET', path: '/api/analytics/trends', expected: 200, description: 'Analytics trends' },
  { method: 'GET', path: '/api/analytics/trends?range=30d', expected: 200, description: 'Analytics trends 30 days' },
  { method: 'GET', path: '/api/analytics/product-distribution', expected: 200, description: 'Product distribution' },
  { method: 'GET', path: '/api/analytics/performance-metrics', expected: 200, description: 'Performance metrics' },
  { method: 'GET', path: '/api/analytics/insights', expected: 200, description: 'Analytics insights' },
  
  // Store CRUD
  { method: 'GET', path: '/api/stores', expected: 200, description: 'List all stores' },
  { method: 'GET', path: '/api/stores/4261931000000665698', expected: 200, description: 'Get specific store' },
  { method: 'GET', path: '/api/stores/invalid-id', expected: 404, description: 'Get invalid store (should 404)' },
  { method: 'GET', path: '/api/stores/regions', expected: 200, description: 'Store regions' },
  
  // Product endpoints
  { method: 'GET', path: '/api/products', expected: 200, description: 'List all products' },
  { method: 'GET', path: '/api/products/categories', expected: 200, description: 'Product categories' },
  { method: 'GET', path: '/api/products/brands', expected: 200, description: 'Product brands' },
  
  // Order endpoints
  { method: 'GET', path: '/api/orders', expected: 200, description: 'List all orders' },
  { method: 'GET', path: '/api/orders/analytics', expected: 200, description: 'Order analytics' },
  { method: 'POST', path: '/api/orders/generate', expected: [200, 201], description: 'Generate order', data: { storeId: '4261931000000665698' } },
  
  // Performance endpoints
  { method: 'GET', path: '/api/sales-agent-performance/daily', expected: 200, description: 'Daily performance' },
  { method: 'GET', path: '/api/sales-agent-performance/weekly', expected: 200, description: 'Weekly performance' },
  { method: 'GET', path: '/api/sales-agent-performance/metric/revenue', expected: 200, description: 'Revenue metric' },
  { method: 'GET', path: '/api/sales-agent-performance/summary/overview', expected: 200, description: 'Performance overview' },
  
  // Health checks
  { method: 'GET', path: '/health', expected: 200, description: 'Health check' },
  { method: 'GET', path: '/gateway/status', expected: 200, description: 'Gateway status' },
  
  // Error cases
  { method: 'GET', path: '/api/nonexistent', expected: 404, description: 'Non-existent endpoint' },
  { method: 'POST', path: '/api/orders', expected: [400, 422], description: 'Invalid POST to orders', data: {} },
  
  // Upselling endpoints
  { method: 'GET', path: '/api/upselling/suggestions?storeId=4261931000000665698', expected: 200, description: 'Upselling suggestions' },
  
  // User actions
  { method: 'GET', path: '/api/user-actions', expected: 200, description: 'User actions' },
  { method: 'POST', path: '/api/user-actions', expected: [200, 201], description: 'Create user action', 
    data: { userId: 'test', action: 'view_dashboard', timestamp: new Date().toISOString() } },
];

async function testEndpoint(config) {
  const startTime = Date.now();
  try {
    const options = {
      method: config.method,
      url: `${BASE_URL}${config.path}`,
      timeout: 5000,
      validateStatus: () => true // Don't throw on any status
    };
    
    if (config.data) {
      options.data = config.data;
      options.headers = { 'Content-Type': 'application/json' };
    }
    
    const response = await axios(options);
    const duration = Date.now() - startTime;
    
    const expectedStatuses = Array.isArray(config.expected) ? config.expected : [config.expected];
    const passed = expectedStatuses.includes(response.status);
    
    const result = {
      endpoint: `${config.method} ${config.path}`,
      description: config.description,
      expected: config.expected,
      actual: response.status,
      duration: duration,
      passed: passed,
      hasData: !!response.data,
      dataType: typeof response.data,
      sample: response.data ? JSON.stringify(response.data).substring(0, 100) : null
    };
    
    if (passed) {
      results.passed.push(result);
      
      // Additional validation for successful responses
      if (response.status === 200) {
        if (!response.data) {
          result.warning = 'No data in response';
        } else if (response.data.success === false) {
          result.warning = 'Success flag is false';
        }
      }
    } else {
      results.failed.push(result);
    }
    
    // Track performance
    if (duration > 1000) {
      results.performance.push({
        endpoint: result.endpoint,
        duration: duration,
        slow: true
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorResult = {
      endpoint: `${config.method} ${config.path}`,
      description: config.description,
      error: error.message,
      code: error.code,
      duration: duration
    };
    results.errors.push(errorResult);
    return errorResult;
  }
}

async function runTests() {
  console.log('🔬 Starting Comprehensive API Testing...\n');
  console.log('═'.repeat(80));
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    
    if (result.error) {
      console.log(`❌ ${result.endpoint} - ${result.description}`);
      console.log(`   Error: ${result.error} (${result.duration}ms)`);
    } else if (result.passed) {
      console.log(`✅ ${result.endpoint} - ${result.description}`);
      console.log(`   Status: ${result.actual} (${result.duration}ms)`);
      if (result.warning) {
        console.log(`   ⚠️  Warning: ${result.warning}`);
      }
    } else {
      console.log(`❌ ${result.endpoint} - ${result.description}`);
      console.log(`   Expected: ${result.expected}, Got: ${result.actual} (${result.duration}ms)`);
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY:\n');
  console.log(`✅ Passed: ${results.passed.length}/${endpoints.length}`);
  console.log(`❌ Failed: ${results.failed.length}/${endpoints.length}`);
  console.log(`🔥 Errors: ${results.errors.length}/${endpoints.length}`);
  console.log(`🐌 Slow endpoints (>1s): ${results.performance.length}`);
  
  // Detailed failure analysis
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach(f => {
      console.log(`  - ${f.endpoint}: Expected ${f.expected}, got ${f.actual}`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n🔥 ERROR DETAILS:');
    results.errors.forEach(e => {
      console.log(`  - ${e.endpoint}: ${e.error} (${e.code})`);
    });
  }
  
  if (results.performance.length > 0) {
    console.log('\n🐌 SLOW ENDPOINTS:');
    results.performance.forEach(p => {
      console.log(`  - ${p.endpoint}: ${p.duration}ms`);
    });
  }
  
  // Save detailed report
  fs.writeFileSync('api-test-report.json', JSON.stringify(results, null, 2));
  console.log('\n📄 Detailed report saved to api-test-report.json');
  
  return results;
}

// Run the tests
runTests().then(results => {
  const successRate = (results.passed.length / endpoints.length) * 100;
  console.log(`\n🎯 Overall Success Rate: ${successRate.toFixed(1)}%`);
  
  if (successRate < 80) {
    console.log('\n⚠️  CRITICAL: Success rate below 80% - System has significant issues!');
    process.exit(1);
  } else if (successRate < 95) {
    console.log('\n⚠️  WARNING: Success rate below 95% - System needs attention');
  } else {
    console.log('\n✅ System API health is good!');
  }
}).catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});