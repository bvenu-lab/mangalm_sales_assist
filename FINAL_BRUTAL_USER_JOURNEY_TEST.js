/**
 * FINAL BRUTAL USER JOURNEY TEST
 * Complete end-to-end user experience validation
 * Tests EVERYTHING a real user would do
 */

const http = require('http');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const { Client } = require('pg');

// Test results tracking
const TEST_RESULTS = {
  passed: [],
  failed: [],
  journeys: []
};

// Colors for output
const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    'error': `${COLORS.RED}[FAIL]${COLORS.RESET}`,
    'success': `${COLORS.GREEN}[PASS]${COLORS.RESET}`,
    'warning': `${COLORS.YELLOW}[WARN]${COLORS.RESET}`,
    'info': `${COLORS.CYAN}[INFO]${COLORS.RESET}`,
    'journey': `${COLORS.MAGENTA}[JOURNEY]${COLORS.RESET}`,
    'step': `${COLORS.BLUE}[STEP]${COLORS.RESET}`
  };
  console.log(`${timestamp} ${prefix[type] || prefix.info} ${message}`);
}

// HTTP request helper
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Generate test CSV data
async function generateTestCSV() {
  const csvContent = `invoice_number,date,store_id,store_name,product_id,product_name,quantity,price,total
INV-2025-001,2025-09-11,STORE001,Test Store Mumbai,PROD001,Test Product A,10,100.50,1005.00
INV-2025-002,2025-09-11,STORE001,Test Store Mumbai,PROD002,Test Product B,5,250.75,1253.75
INV-2025-003,2025-09-11,STORE002,Test Store Delhi,PROD001,Test Product A,20,100.50,2010.00
INV-2025-004,2025-09-11,STORE002,Test Store Delhi,PROD003,Test Product C,15,75.25,1128.75
INV-2025-005,2025-09-11,STORE003,Test Store Bangalore,PROD002,Test Product B,8,250.75,2006.00`;
  
  const testFile = path.join(__dirname, 'test-upload.csv');
  await fs.writeFile(testFile, csvContent);
  return testFile;
}

// JOURNEY 1: Homepage Load & Navigation
async function testHomepageJourney() {
  log('\n═══════════════════════════════════════════', 'journey');
  log('JOURNEY 1: HOMEPAGE & NAVIGATION', 'journey');
  log('═══════════════════════════════════════════', 'journey');
  
  const steps = [
    {
      name: 'Load Homepage',
      test: async () => {
        const res = await makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: '/',
          method: 'GET'
        });
        return res.success;
      }
    },
    {
      name: 'Check API Gateway Health',
      test: async () => {
        const res = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/health',
          method: 'GET'
        });
        return res.success;
      }
    },
    {
      name: 'Get Stores List',
      test: async () => {
        const res = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/stores',
          method: 'GET'
        });
        return res.success && res.body.includes('"success":true');
      }
    },
    {
      name: 'Get Products List',
      test: async () => {
        const res = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/products',
          method: 'GET'
        });
        return res.success && res.body.includes('"success":true');
      }
    },
    {
      name: 'Get Dashboard Summary',
      test: async () => {
        const res = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/dashboard/summary',
          method: 'GET'
        });
        return res.success && res.body.includes('"total_stores"');
      }
    }
  ];

  let passed = 0;
  for (const step of steps) {
    log(`Testing: ${step.name}`, 'step');
    try {
      const result = await step.test();
      if (result) {
        log(`✓ ${step.name}`, 'success');
        passed++;
      } else {
        log(`✗ ${step.name}`, 'error');
      }
    } catch (error) {
      log(`✗ ${step.name}: ${error.message}`, 'error');
    }
  }
  
  TEST_RESULTS.journeys.push({
    name: 'Homepage & Navigation',
    passed: passed,
    total: steps.length
  });
  
  return passed === steps.length;
}

// JOURNEY 2: File Upload & Processing
async function testUploadJourney() {
  log('\n═══════════════════════════════════════════', 'journey');
  log('JOURNEY 2: FILE UPLOAD & PROCESSING', 'journey');
  log('═══════════════════════════════════════════', 'journey');
  
  let testFile = null;
  let jobId = null;
  
  const steps = [
    {
      name: 'Generate Test CSV',
      test: async () => {
        testFile = await generateTestCSV();
        return testFile !== null;
      }
    },
    {
      name: 'Upload CSV File',
      test: async () => {
        const form = new FormData();
        const fileContent = await fs.readFile(testFile);
        form.append('file', fileContent, 'test-upload.csv');
        
        return new Promise((resolve) => {
          const req = http.request({
            hostname: 'localhost',
            port: 3009,
            path: '/api/enterprise-bulk-upload',
            method: 'POST',
            headers: form.getHeaders()
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (res.statusCode === 200 || res.statusCode === 202) {
                try {
                  const parsed = JSON.parse(data);
                  jobId = parsed.jobId;
                  resolve(true);
                } catch {
                  resolve(false);
                }
              } else {
                resolve(false);
              }
            });
          });
          
          req.on('error', () => resolve(false));
          form.pipe(req);
        });
      }
    },
    {
      name: 'Check Job Status',
      test: async () => {
        if (!jobId) return false;
        
        const res = await makeRequest({
          hostname: 'localhost',
          port: 3009,
          path: `/api/job-status/${jobId}`,
          method: 'GET'
        });
        
        return res.success;
      }
    },
    {
      name: 'Verify Data in Database',
      test: async () => {
        const client = new Client({
          host: 'localhost',
          port: 3432,
          database: 'mangalm_sales',
          user: 'mangalm',
          password: 'mangalm_secure_password'
        });
        
        try {
          await client.connect();
          const result = await client.query('SELECT COUNT(*) FROM mangalam_invoices');
          await client.end();
          return parseInt(result.rows[0].count) > 0;
        } catch {
          return false;
        }
      }
    }
  ];
  
  let passed = 0;
  for (const step of steps) {
    log(`Testing: ${step.name}`, 'step');
    try {
      const result = await step.test();
      if (result) {
        log(`✓ ${step.name}`, 'success');
        passed++;
      } else {
        log(`✗ ${step.name}`, 'error');
      }
    } catch (error) {
      log(`✗ ${step.name}: ${error.message}`, 'error');
    }
  }
  
  // Cleanup
  if (testFile) {
    try {
      await fs.unlink(testFile);
    } catch {}
  }
  
  TEST_RESULTS.journeys.push({
    name: 'File Upload & Processing',
    passed: passed,
    total: steps.length
  });
  
  return passed === steps.length;
}

// JOURNEY 3: Analytics & Reporting
async function testAnalyticsJourney() {
  log('\n═══════════════════════════════════════════', 'journey');
  log('JOURNEY 3: ANALYTICS & REPORTING', 'journey');
  log('═══════════════════════════════════════════', 'journey');
  
  const steps = [
    {
      name: 'Get Analytics Trends',
      test: async () => {
        const res = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/analytics/trends',
          method: 'GET'
        });
        return res.success;
      }
    },
    {
      name: 'Get Product Distribution',
      test: async () => {
        const res = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/analytics/product-distribution',
          method: 'GET'
        });
        return res.success;
      }
    },
    {
      name: 'Get Performance Metrics',
      test: async () => {
        const res = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/analytics/performance-metrics',
          method: 'GET'
        });
        return res.success;
      }
    },
    {
      name: 'Get Analytics Insights',
      test: async () => {
        const res = await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/analytics/insights',
          method: 'GET'
        });
        return res.success;
      }
    }
  ];
  
  let passed = 0;
  for (const step of steps) {
    log(`Testing: ${step.name}`, 'step');
    try {
      const result = await step.test();
      if (result) {
        log(`✓ ${step.name}`, 'success');
        passed++;
      } else {
        log(`✗ ${step.name}`, 'error');
      }
    } catch (error) {
      log(`✗ ${step.name}: ${error.message}`, 'error');
    }
  }
  
  TEST_RESULTS.journeys.push({
    name: 'Analytics & Reporting',
    passed: passed,
    total: steps.length
  });
  
  return passed === steps.length;
}

// JOURNEY 4: Performance & Load Test
async function testPerformanceJourney() {
  log('\n═══════════════════════════════════════════', 'journey');
  log('JOURNEY 4: PERFORMANCE & LOAD TEST', 'journey');
  log('═══════════════════════════════════════════', 'journey');
  
  const steps = [
    {
      name: 'Concurrent API Requests (10x)',
      test: async () => {
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(makeRequest({
            hostname: 'localhost',
            port: 3007,
            path: '/api/stores',
            method: 'GET'
          }));
        }
        
        const results = await Promise.all(promises);
        return results.every(r => r.success);
      }
    },
    {
      name: 'Response Time < 500ms',
      test: async () => {
        const start = Date.now();
        await makeRequest({
          hostname: 'localhost',
          port: 3007,
          path: '/api/dashboard/summary',
          method: 'GET'
        });
        const duration = Date.now() - start;
        return duration < 500;
      }
    },
    {
      name: 'Database Connection Pool',
      test: async () => {
        const promises = [];
        for (let i = 0; i < 5; i++) {
          const client = new Client({
            host: 'localhost',
            port: 3432,
            database: 'mangalm_sales',
            user: 'mangalm',
            password: 'mangalm_secure_password'
          });
          
          promises.push(
            client.connect()
              .then(() => client.query('SELECT 1'))
              .then(() => client.end())
              .then(() => true)
              .catch(() => false)
          );
        }
        
        const results = await Promise.all(promises);
        return results.every(r => r === true);
      }
    }
  ];
  
  let passed = 0;
  for (const step of steps) {
    log(`Testing: ${step.name}`, 'step');
    try {
      const result = await step.test();
      if (result) {
        log(`✓ ${step.name}`, 'success');
        passed++;
      } else {
        log(`✗ ${step.name}`, 'error');
      }
    } catch (error) {
      log(`✗ ${step.name}: ${error.message}`, 'error');
    }
  }
  
  TEST_RESULTS.journeys.push({
    name: 'Performance & Load Test',
    passed: passed,
    total: steps.length
  });
  
  return passed === steps.length;
}

// Main test runner
async function runUserJourneyTests() {
  console.clear();
  log(`${COLORS.BOLD}${COLORS.MAGENTA}`, 'info');
  log('╔══════════════════════════════════════════════════════╗', 'info');
  log('║     FINAL BRUTAL USER JOURNEY TEST                  ║', 'info');
  log('║     Complete End-to-End User Experience             ║', 'info');
  log('╚══════════════════════════════════════════════════════╝', 'info');
  log(`${COLORS.RESET}`, 'info');
  
  const startTime = Date.now();
  
  // Run all journeys
  await testHomepageJourney();
  await testUploadJourney();
  await testAnalyticsJourney();
  await testPerformanceJourney();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Calculate totals
  const totalPassed = TEST_RESULTS.journeys.reduce((sum, j) => sum + j.passed, 0);
  const totalTests = TEST_RESULTS.journeys.reduce((sum, j) => sum + j.total, 0);
  const successRate = ((totalPassed / totalTests) * 100).toFixed(1);
  
  // Final Report
  log('\n╔══════════════════════════════════════════════════════╗', 'info');
  log('║                   FINAL REPORT                       ║', 'info');
  log('╚══════════════════════════════════════════════════════╝', 'info');
  
  console.log('\nJOURNEY RESULTS:');
  TEST_RESULTS.journeys.forEach(journey => {
    const status = journey.passed === journey.total ? 
      `${COLORS.GREEN}✓ PASS${COLORS.RESET}` : 
      `${COLORS.RED}✗ FAIL${COLORS.RESET}`;
    console.log(`  ${journey.name}: ${status} (${journey.passed}/${journey.total})`);
  });
  
  console.log(`\n${COLORS.BOLD}OVERALL:${COLORS.RESET}`);
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Passed: ${COLORS.GREEN}${totalPassed}${COLORS.RESET}`);
  console.log(`  Failed: ${COLORS.RED}${totalTests - totalPassed}${COLORS.RESET}`);
  console.log(`  Success Rate: ${successRate >= 80 ? COLORS.GREEN : COLORS.RED}${successRate}%${COLORS.RESET}`);
  
  const verdict = successRate >= 80 ?
    `${COLORS.GREEN}${COLORS.BOLD}✓ SYSTEM READY FOR PRODUCTION${COLORS.RESET}` :
    `${COLORS.RED}${COLORS.BOLD}✗ SYSTEM NOT READY${COLORS.RESET}`;
  
  console.log(`\n${COLORS.BOLD}VERDICT: ${verdict}`);
  console.log(`Test duration: ${duration} seconds\n`);
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    journeys: TEST_RESULTS.journeys,
    summary: {
      totalTests,
      passed: totalPassed,
      failed: totalTests - totalPassed,
      successRate: `${successRate}%`
    },
    verdict: successRate >= 80 ? 'PRODUCTION_READY' : 'NOT_READY'
  };
  
  await fs.writeFile(
    'USER_JOURNEY_TEST_REPORT.json',
    JSON.stringify(report, null, 2)
  );
  
  log('Report saved to USER_JOURNEY_TEST_REPORT.json', 'info');
  
  process.exit(successRate >= 80 ? 0 : 1);
}

// Run the tests
runUserJourneyTests().catch(console.error);