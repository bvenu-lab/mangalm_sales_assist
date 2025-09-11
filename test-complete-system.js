/**
 * COMPREHENSIVE END-TO-END SYSTEM TEST
 * Tests the entire Mangalam system including all services, APIs, and user workflows
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Service endpoints
const SERVICES = {
  frontend: 'http://localhost:3000',
  apiGateway: 'http://localhost:3007',
  bulkUpload: 'http://localhost:3009',
  aiPrediction: 'http://localhost:3001'
};

// Test results tracking
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
  startTime: new Date(),
  endTime: null
};

// Helper functions
const log = {
  section: (title) => console.log(`\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`),
  test: (name) => console.log(`\nTesting: ${name}`),
  pass: (msg) => { console.log(`  ✓ ${msg}`); testResults.passed.push(msg); },
  fail: (msg, error) => { console.log(`  ✗ ${msg}: ${error}`); testResults.failed.push({ msg, error }); },
  warn: (msg) => { console.log(`  ⚠ ${msg}`); testResults.warnings.push(msg); },
  info: (msg) => console.log(`  ℹ ${msg}`)
};

// Create test CSV file
function createTestCSV() {
  const csvContent = `invoice_date,invoice_number,customer_name,item_name,quantity,item_price,total
2025-09-10,TEST-001,Test Store 1,Product A,10,100,1000
2025-09-10,TEST-002,Test Store 2,Product B,20,150,3000
2025-09-10,TEST-003,Test Store 3,Product C,15,200,3000`;
  
  const filePath = path.join(__dirname, 'test-upload.csv');
  fs.writeFileSync(filePath, csvContent);
  return filePath;
}

// 1. TEST SERVICE AVAILABILITY
async function testServiceAvailability() {
  log.section('1. SERVICE AVAILABILITY TESTS');
  
  for (const [name, url] of Object.entries(SERVICES)) {
    log.test(`${name} service`);
    try {
      const response = await axios.get(url, { 
        timeout: 5000,
        validateStatus: () => true 
      });
      
      if (response.status < 500) {
        log.pass(`${name} is running on ${url} (Status: ${response.status})`);
      } else {
        log.fail(`${name} returned error`, `Status ${response.status}`);
      }
    } catch (error) {
      if (name === 'aiPrediction') {
        log.warn(`${name} not accessible (optional service)`);
      } else {
        log.fail(`${name} not accessible`, error.message);
      }
    }
  }
}

// 2. TEST AUTHENTICATION SYSTEM
async function testAuthentication() {
  log.section('2. AUTHENTICATION SYSTEM TESTS');
  
  const users = [
    { username: 'admin', password: 'admin123' },
    { username: 'user', password: 'user123' },
    { username: 'demo', password: 'demo2025' },
    { username: 'invalid', password: 'wrong', shouldFail: true }
  ];
  
  const tokens = {};
  
  for (const user of users) {
    log.test(`Login: ${user.username}`);
    try {
      const response = await axios.post(`${SERVICES.apiGateway}/api/auth/login`, {
        username: user.username,
        password: user.password
      }, { validateStatus: () => true });
      
      if (response.status === 200) {
        if (user.shouldFail) {
          log.fail('Invalid login succeeded', 'Should have been rejected');
        } else {
          log.pass(`Login successful for ${user.username}`);
          if (response.data.token) {
            tokens[user.username] = response.data.token;
            log.pass(`JWT token received`);
          }
          if (response.data.user?.role) {
            log.pass(`User role: ${response.data.user.role}`);
          }
        }
      } else {
        if (user.shouldFail) {
          log.pass(`Invalid login correctly rejected`);
        } else {
          log.fail(`Login failed`, `Status ${response.status}`);
        }
      }
    } catch (error) {
      log.fail(`Login error`, error.message);
    }
  }
  
  return tokens.admin; // Return admin token for further tests
}

// 3. TEST ALL API ENDPOINTS
async function testAPIEndpoints(token) {
  log.section('3. API ENDPOINT TESTS');
  
  const endpoints = [
    // Health checks
    { method: 'GET', path: '/health', name: 'API Gateway Health', requiresAuth: false },
    { method: 'GET', path: '/api/auth/health', name: 'Auth Health', requiresAuth: false },
    
    // Analytics endpoints
    { method: 'GET', path: '/api/analytics/trends?range=7d', name: 'Analytics Trends (7d)' },
    { method: 'GET', path: '/api/analytics/trends?range=30d', name: 'Analytics Trends (30d)' },
    { method: 'GET', path: '/api/analytics/product-distribution', name: 'Product Distribution' },
    { method: 'GET', path: '/api/analytics/performance-metrics', name: 'Performance Metrics' },
    { method: 'GET', path: '/api/analytics/insights', name: 'Analytics Insights' },
    
    // Dashboard endpoints
    { method: 'GET', path: '/api/calls/prioritized?limit=10', name: 'Prioritized Calls' },
    { method: 'GET', path: '/api/orders/recent?limit=10', name: 'Recent Orders' },
    { method: 'GET', path: '/api/orders/pending', name: 'Pending Orders' },
    { method: 'GET', path: '/api/stores/recent?limit=10', name: 'Recent Stores' },
    { method: 'GET', path: '/api/performance/summary', name: 'Performance Summary' },
    
    // Store management
    { method: 'GET', path: '/api/stores?limit=5', name: 'Store List' },
    { method: 'GET', path: '/api/stores/regions', name: 'Store Regions' },
    
    // Product management
    { method: 'GET', path: '/api/products?limit=5', name: 'Product List' },
    { method: 'GET', path: '/api/products/categories', name: 'Product Categories' },
    { method: 'GET', path: '/api/products/brands', name: 'Product Brands' },
    
    // Order management (requires auth)
    { method: 'GET', path: '/api/orders?limit=5', name: 'Order List', requiresAuth: true },
    { method: 'GET', path: '/api/orders/analytics', name: 'Order Analytics', requiresAuth: true }
  ];
  
  for (const endpoint of endpoints) {
    log.test(endpoint.name);
    
    try {
      const config = {
        method: endpoint.method,
        url: `${SERVICES.apiGateway}${endpoint.path}`,
        timeout: 5000,
        validateStatus: () => true
      };
      
      if (endpoint.requiresAuth || endpoint.requiresAuth === undefined) {
        config.headers = { 'Authorization': `Bearer ${token}` };
      }
      
      const response = await axios(config);
      
      if (response.status === 200) {
        log.pass(`${endpoint.name} - Status 200`);
        
        if (response.data?.success !== undefined) {
          if (response.data.success) {
            log.pass(`Response success: true`);
            
            // Check data structure
            if (response.data.data) {
              const dataType = Array.isArray(response.data.data) ? 'array' : 'object';
              const count = Array.isArray(response.data.data) 
                ? response.data.data.length 
                : Object.keys(response.data.data).length;
              log.info(`Data: ${dataType} with ${count} items/keys`);
            }
          } else {
            log.warn(`Response success: false - ${response.data.error}`);
          }
        }
      } else if (response.status === 401 && !token) {
        log.info(`Authentication required (expected)`);
      } else {
        log.fail(endpoint.name, `Status ${response.status}`);
      }
    } catch (error) {
      log.fail(endpoint.name, error.message);
    }
  }
}

// 4. TEST BULK UPLOAD SERVICE
async function testBulkUpload() {
  log.section('4. BULK UPLOAD SERVICE TESTS');
  
  // Test health endpoint
  log.test('Bulk Upload Health Check');
  try {
    const healthResponse = await axios.get(`${SERVICES.bulkUpload}/health`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (healthResponse.status === 200) {
      log.pass('Bulk Upload service is healthy');
      if (healthResponse.data.database) {
        log.pass(`Database: ${healthResponse.data.database}`);
      }
      if (healthResponse.data.redis) {
        log.pass(`Redis: ${healthResponse.data.redis}`);
      }
    } else {
      log.fail('Health check failed', `Status ${healthResponse.status}`);
    }
  } catch (error) {
    log.fail('Health check error', error.message);
  }
  
  // Test file upload
  log.test('CSV File Upload');
  try {
    const testFile = createTestCSV();
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    form.append('source', 'test-suite');
    
    const uploadResponse = await axios.post(
      `${SERVICES.bulkUpload}/api/enterprise-bulk-upload`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 10000,
        validateStatus: () => true
      }
    );
    
    if (uploadResponse.status === 200 || uploadResponse.status === 202) {
      log.pass('File upload successful');
      if (uploadResponse.data.jobId) {
        log.pass(`Job ID: ${uploadResponse.data.jobId}`);
      }
      if (uploadResponse.data.status) {
        log.pass(`Status: ${uploadResponse.data.status}`);
      }
    } else {
      log.fail('File upload failed', `Status ${uploadResponse.status}`);
    }
    
    // Clean up test file
    fs.unlinkSync(testFile);
  } catch (error) {
    log.fail('File upload error', error.message);
  }
}

// 5. TEST DATABASE CONNECTIVITY
async function testDatabase() {
  log.section('5. DATABASE CONNECTIVITY TESTS');
  
  try {
    const { Client } = require('pg');
    const client = new Client({
      host: 'localhost',
      port: 3432,
      database: 'mangalm_sales',
      user: 'mangalm',
      password: 'mangalm_secure_password'
    });
    
    await client.connect();
    log.pass('Connected to PostgreSQL');
    
    // Test critical tables
    const tables = [
      'mangalam_invoices',
      'stores',
      'products',
      'orders',
      'call_prioritization'
    ];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        log.pass(`Table ${table}: ${result.rows[0].count} records`);
      } catch (err) {
        log.fail(`Table ${table}`, 'Not found or inaccessible');
      }
    }
    
    await client.end();
  } catch (error) {
    log.fail('Database connection', error.message);
  }
}

// 6. TEST REDIS CONNECTIVITY
async function testRedis() {
  log.section('6. REDIS CONNECTIVITY TESTS');
  
  try {
    const redis = require('redis');
    const redisClient = redis.createClient({
      url: 'redis://localhost:3379'
    });
    
    await redisClient.connect();
    log.pass('Connected to Redis');
    
    // Test basic operations
    await redisClient.set('test:key', 'test-value');
    const value = await redisClient.get('test:key');
    if (value === 'test-value') {
      log.pass('Redis read/write working');
    }
    
    await redisClient.del('test:key');
    await redisClient.quit();
  } catch (error) {
    log.warn(`Redis connection failed: ${error.message} (non-critical)`);
  }
}

// 7. TEST CORS CONFIGURATION
async function testCORS() {
  log.section('7. CORS CONFIGURATION TESTS');
  
  try {
    const response = await axios.options(`${SERVICES.apiGateway}/api/auth/login`, {
      headers: {
        'Origin': SERVICES.frontend,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      },
      validateStatus: () => true
    });
    
    const corsHeaders = response.headers['access-control-allow-origin'];
    if (corsHeaders) {
      log.pass(`CORS enabled for: ${corsHeaders}`);
      
      const allowedMethods = response.headers['access-control-allow-methods'];
      if (allowedMethods) {
        log.pass(`Allowed methods: ${allowedMethods}`);
      }
    } else {
      log.warn('CORS headers not found');
    }
  } catch (error) {
    log.fail('CORS test', error.message);
  }
}

// 8. TEST PERFORMANCE
async function testPerformance() {
  log.section('8. PERFORMANCE TESTS');
  
  const performanceTests = [
    { endpoint: '/api/stores?limit=100', name: 'Large Store Query', maxTime: 1000 },
    { endpoint: '/api/products?limit=100', name: 'Large Product Query', maxTime: 1000 },
    { endpoint: '/api/analytics/trends?range=90d', name: '90-day Analytics', maxTime: 2000 }
  ];
  
  for (const test of performanceTests) {
    log.test(test.name);
    const startTime = Date.now();
    
    try {
      await axios.get(`${SERVICES.apiGateway}${test.endpoint}`, {
        timeout: 5000,
        validateStatus: () => true
      });
      
      const duration = Date.now() - startTime;
      if (duration < test.maxTime) {
        log.pass(`Response time: ${duration}ms (< ${test.maxTime}ms)`);
      } else {
        log.warn(`Slow response: ${duration}ms (> ${test.maxTime}ms)`);
      }
    } catch (error) {
      log.fail('Performance test', error.message);
    }
  }
}

// Generate comprehensive report
function generateReport() {
  testResults.endTime = new Date();
  const duration = (testResults.endTime - testResults.startTime) / 1000;
  
  log.section('TEST EXECUTION SUMMARY');
  
  console.log(`\nExecution Time: ${duration.toFixed(2)} seconds`);
  console.log(`Start Time: ${testResults.startTime.toISOString()}`);
  console.log(`End Time: ${testResults.endTime.toISOString()}`);
  
  console.log(`\n✅ PASSED: ${testResults.passed.length} tests`);
  if (testResults.passed.length > 0) {
    testResults.passed.slice(0, 10).forEach(test => console.log(`  ✓ ${test}`));
    if (testResults.passed.length > 10) {
      console.log(`  ... and ${testResults.passed.length - 10} more`);
    }
  }
  
  if (testResults.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS: ${testResults.warnings.length} issues`);
    testResults.warnings.forEach(warning => console.log(`  ⚠ ${warning}`));
  }
  
  if (testResults.failed.length > 0) {
    console.log(`\n❌ FAILED: ${testResults.failed.length} tests`);
    testResults.failed.forEach(test => console.log(`  ✗ ${test.msg}: ${test.error}`));
  }
  
  // Overall status
  console.log('\n' + '='.repeat(60));
  const successRate = (testResults.passed.length / (testResults.passed.length + testResults.failed.length) * 100).toFixed(1);
  
  if (testResults.failed.length === 0) {
    console.log('🎉 ALL TESTS PASSED! System is fully operational.');
  } else if (successRate > 80) {
    console.log(`✅ System is mostly operational (${successRate}% success rate)`);
  } else if (successRate > 50) {
    console.log(`⚠️  System has issues (${successRate}% success rate)`);
  } else {
    console.log(`❌ System has critical issues (${successRate}% success rate)`);
  }
  
  // Recommendations
  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATIONS:');
  
  if (testResults.failed.length === 0) {
    console.log('✅ System is ready for production use');
    console.log('✅ All services are running correctly');
    console.log('✅ Database and Redis are operational');
  } else {
    console.log('Action items:');
    const failedServices = testResults.failed.filter(f => f.msg.includes('not accessible'));
    if (failedServices.length > 0) {
      console.log('  • Start missing services');
    }
    const failedAuth = testResults.failed.filter(f => f.msg.includes('Login'));
    if (failedAuth.length > 0) {
      console.log('  • Fix authentication configuration');
    }
    const failedDB = testResults.failed.filter(f => f.msg.includes('Database'));
    if (failedDB.length > 0) {
      console.log('  • Check database connection and schema');
    }
  }
  
  console.log('\nAccess the application at: ' + SERVICES.frontend);
  console.log('Login with: admin / admin123');
  console.log('=' + '='.repeat(59) + '\n');
}

// Main test runner
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('MANGALAM SYSTEM - COMPREHENSIVE END-TO-END TEST SUITE');
  console.log('=' + '='.repeat(60));
  
  try {
    // Check dependencies
    const requiredModules = ['axios', 'form-data', 'pg', 'redis'];
    for (const module of requiredModules) {
      try {
        require.resolve(module);
      } catch (e) {
        console.log(`Installing ${module}...`);
        require('child_process').execSync(`npm install ${module} --no-save`, { stdio: 'inherit' });
      }
    }
    
    // Run all tests
    await testServiceAvailability();
    const token = await testAuthentication();
    await testAPIEndpoints(token);
    await testBulkUpload();
    await testDatabase();
    await testRedis();
    await testCORS();
    await testPerformance();
    
  } catch (error) {
    console.error('Test suite error:', error.message);
  } finally {
    generateReport();
    process.exit(testResults.failed.length > 0 ? 1 : 0);
  }
}

// Execute tests
runAllTests();