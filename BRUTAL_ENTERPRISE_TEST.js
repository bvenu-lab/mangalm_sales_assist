/**
 * BRUTAL ENTERPRISE TESTING SUITE
 * No mercy, no excuses - just raw truth about what's broken
 */

const http = require('http');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const SERVICES = {
  frontend: { port: 3000, name: 'Frontend', healthPath: '/' },
  apiGateway: { port: 3007, name: 'API Gateway', healthPath: '/health' },
  bulkUpload: { port: 3009, name: 'Bulk Upload API', healthPath: '/health' },
  postgres: { port: 3432, name: 'PostgreSQL', type: 'database' },
  redis: { port: 3379, name: 'Redis', type: 'cache' }
};

const TEST_RESULTS = {
  passed: [],
  failed: [],
  critical: [],
  warnings: []
};

// Color codes for terminal output
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
    'critical': `${COLORS.RED}${COLORS.BOLD}[CRITICAL]${COLORS.RESET}`,
    'info': `${COLORS.CYAN}[INFO]${COLORS.RESET}`,
    'test': `${COLORS.MAGENTA}[TEST]${COLORS.RESET}`
  };
  console.log(`${timestamp} ${prefix[type] || prefix.info} ${message}`);
}

function testResult(testName, passed, details = '') {
  if (passed) {
    TEST_RESULTS.passed.push(testName);
    log(`✓ ${testName} ${details}`, 'success');
  } else {
    TEST_RESULTS.failed.push(testName);
    log(`✗ ${testName} ${details}`, 'error');
  }
  return passed;
}

// Level 1: Process & Port Tests
async function testProcessesAndPorts() {
  log('\n════════════════════════════════════════', 'test');
  log('LEVEL 1: PROCESS & PORT VERIFICATION', 'test');
  log('════════════════════════════════════════', 'test');

  // Check Node.js processes
  try {
    const { stdout } = await execPromise('tasklist | findstr node');
    const nodeProcesses = stdout.split('\n').filter(line => line.includes('node.exe'));
    
    testResult(
      'Node.js processes running',
      nodeProcesses.length >= 3,
      `Found ${nodeProcesses.length} processes (need at least 3)`
    );
    
    if (nodeProcesses.length < 3) {
      TEST_RESULTS.critical.push('INSUFFICIENT NODE PROCESSES - Services not started properly');
    }
  } catch (error) {
    testResult('Node.js processes check', false, 'No Node processes found!');
    TEST_RESULTS.critical.push('NO NODE PROCESSES RUNNING');
  }

  // Check port listeners
  for (const [key, service] of Object.entries(SERVICES)) {
    try {
      const { stdout } = await execPromise(`netstat -an | findstr :${service.port}`);
      const listening = stdout.includes('LISTENING');
      testResult(
        `Port ${service.port} listening (${service.name})`,
        listening,
        listening ? '' : 'PORT NOT LISTENING'
      );
      
      if (!listening) {
        TEST_RESULTS.critical.push(`${service.name} port ${service.port} not listening`);
      }
    } catch (error) {
      testResult(`Port ${service.port} check`, false, 'Port check failed');
    }
  }
}

// Level 2: HTTP Service Tests
async function testHTTPServices() {
  log('\n════════════════════════════════════════', 'test');
  log('LEVEL 2: HTTP SERVICE CONNECTIVITY', 'test');
  log('════════════════════════════════════════', 'test');

  for (const [key, service] of Object.entries(SERVICES)) {
    if (service.type === 'database' || service.type === 'cache') continue;

    const result = await testHTTPEndpoint(
      `http://localhost:${service.port}${service.healthPath}`,
      service.name
    );
    
    if (!result) {
      TEST_RESULTS.critical.push(`${service.name} HTTP service is DOWN`);
    }
  }
}

async function testHTTPEndpoint(url, serviceName) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      testResult(`${serviceName} HTTP response`, false, 'TIMEOUT after 5 seconds');
      resolve(false);
    }, 5000);

    http.get(url, (res) => {
      clearTimeout(timeout);
      const passed = res.statusCode < 500;
      testResult(
        `${serviceName} HTTP response`,
        passed,
        `Status: ${res.statusCode}`
      );
      resolve(passed);
    }).on('error', (err) => {
      clearTimeout(timeout);
      testResult(`${serviceName} HTTP response`, false, `Connection failed: ${err.code}`);
      resolve(false);
    });
  });
}

// Level 3: Database Tests
async function testDatabase() {
  log('\n════════════════════════════════════════', 'test');
  log('LEVEL 3: DATABASE CONNECTIVITY & SCHEMA', 'test');
  log('════════════════════════════════════════', 'test');

  const { Client } = require('pg');
  
  const client = new Client({
    host: 'localhost',
    port: 3432,
    database: 'mangalm_sales',
    user: 'mangalm',
    password: 'mangalm_secure_password'
  });

  try {
    await client.connect();
    testResult('PostgreSQL connection', true);

    // Test critical tables
    const criticalTables = [
      'stores', 'products', 'mangalam_invoices', 
      'invoice_items', 'orders', 'dashboard_summary'
    ];

    for (const table of criticalTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        testResult(
          `Table '${table}' exists`,
          true,
          `${result.rows[0].count} rows`
        );
      } catch (error) {
        testResult(`Table '${table}' exists`, false, 'TABLE MISSING!');
        TEST_RESULTS.critical.push(`Missing critical table: ${table}`);
      }
    }

    await client.end();
  } catch (error) {
    testResult('PostgreSQL connection', false, error.message);
    TEST_RESULTS.critical.push('DATABASE CONNECTION FAILED');
  }
}

// Level 4: API Endpoint Tests
async function testAPIEndpoints() {
  log('\n════════════════════════════════════════', 'test');
  log('LEVEL 4: API ENDPOINT FUNCTIONALITY', 'test');
  log('════════════════════════════════════════', 'test');

  const endpoints = [
    { url: 'http://localhost:3007/api/stores', name: 'Get Stores' },
    { url: 'http://localhost:3007/api/products', name: 'Get Products' },
    { url: 'http://localhost:3007/api/dashboard/summary', name: 'Dashboard Summary' },
    { url: 'http://localhost:3009/api/upload/validate', name: 'Upload Validation', method: 'POST' }
  ];

  for (const endpoint of endpoints) {
    await testAPIEndpoint(endpoint);
  }
}

async function testAPIEndpoint(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: parseInt(endpoint.url.split(':')[2].split('/')[0]),
      path: '/' + endpoint.url.split('/').slice(3).join('/'),
      method: endpoint.method || 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const passed = res.statusCode < 400;
        testResult(
          `API: ${endpoint.name}`,
          passed,
          `Status: ${res.statusCode}, Response: ${data.substring(0, 50)}...`
        );
        resolve(passed);
      });
    });

    req.on('error', (err) => {
      testResult(`API: ${endpoint.name}`, false, `Failed: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      testResult(`API: ${endpoint.name}`, false, 'Request timeout');
      req.destroy();
      resolve(false);
    });

    if (endpoint.method === 'POST') {
      req.write(JSON.stringify({}));
    }
    req.end();
  });
}

// Level 5: User Journey Simulation
async function testUserJourney() {
  log('\n════════════════════════════════════════', 'test');
  log('LEVEL 5: COMPLETE USER JOURNEY', 'test');
  log('════════════════════════════════════════', 'test');

  // Simulate complete user flow
  const journey = [
    { step: 'Load homepage', test: () => testHTTPEndpoint('http://localhost:3000', 'Homepage') },
    { step: 'Access upload page', test: () => testHTTPEndpoint('http://localhost:3000/upload', 'Upload Page') },
    { step: 'Check API availability', test: () => testHTTPEndpoint('http://localhost:3007/health', 'API Health') },
    { step: 'Validate upload endpoint', test: () => testAPIEndpoint({ 
      url: 'http://localhost:3009/api/upload/validate', 
      name: 'Upload Validation',
      method: 'POST'
    })}
  ];

  for (const step of journey) {
    log(`Testing: ${step.step}`, 'info');
    const result = await step.test();
    if (!result) {
      TEST_RESULTS.warnings.push(`User journey failed at: ${step.step}`);
    }
  }
}

// Level 6: File System & Configuration Tests
async function testFileSystemAndConfig() {
  log('\n════════════════════════════════════════', 'test');
  log('LEVEL 6: FILE SYSTEM & CONFIGURATION', 'test');
  log('════════════════════════════════════════', 'test');

  const criticalFiles = [
    'package.json',
    'docker-compose.yml',
    'config/database.config.js',
    'services/api-gateway/package.json',
    'services/bulk-upload-api/package.json',
    'services/sales-frontend/package.json'
  ];

  for (const file of criticalFiles) {
    try {
      await fs.access(path.join(__dirname, file));
      testResult(`Critical file: ${file}`, true);
    } catch {
      testResult(`Critical file: ${file}`, false, 'FILE MISSING!');
      TEST_RESULTS.critical.push(`Missing critical file: ${file}`);
    }
  }
}

// Main Test Runner
async function runBrutalTests() {
  console.clear();
  log(`${COLORS.BOLD}${COLORS.MAGENTA}`, 'info');
  log('╔══════════════════════════════════════════════════════╗', 'info');
  log('║     BRUTAL ENTERPRISE TESTING SUITE v1.0            ║', 'info');
  log('║     No Mercy. No Excuses. Just Truth.               ║', 'info');
  log('╚══════════════════════════════════════════════════════╝', 'info');
  log(`${COLORS.RESET}`, 'info');

  const startTime = Date.now();

  try {
    await testProcessesAndPorts();
    await testHTTPServices();
    await testDatabase();
    await testAPIEndpoints();
    await testUserJourney();
    await testFileSystemAndConfig();
  } catch (error) {
    log(`Unexpected error: ${error.message}`, 'critical');
    TEST_RESULTS.critical.push(`Test suite crash: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Final Report
  log('\n╔══════════════════════════════════════════════════════╗', 'info');
  log('║                   FINAL REPORT                       ║', 'info');
  log('╚══════════════════════════════════════════════════════╝', 'info');

  console.log(`\n${COLORS.GREEN}PASSED: ${TEST_RESULTS.passed.length} tests${COLORS.RESET}`);
  console.log(`${COLORS.RED}FAILED: ${TEST_RESULTS.failed.length} tests${COLORS.RESET}`);
  console.log(`${COLORS.YELLOW}WARNINGS: ${TEST_RESULTS.warnings.length}${COLORS.RESET}`);
  console.log(`${COLORS.RED}${COLORS.BOLD}CRITICAL ISSUES: ${TEST_RESULTS.critical.length}${COLORS.RESET}`);

  if (TEST_RESULTS.critical.length > 0) {
    console.log(`\n${COLORS.RED}${COLORS.BOLD}CRITICAL ISSUES FOUND:${COLORS.RESET}`);
    TEST_RESULTS.critical.forEach(issue => {
      console.log(`  ${COLORS.RED}✗ ${issue}${COLORS.RESET}`);
    });
  }

  if (TEST_RESULTS.warnings.length > 0) {
    console.log(`\n${COLORS.YELLOW}WARNINGS:${COLORS.RESET}`);
    TEST_RESULTS.warnings.forEach(warning => {
      console.log(`  ${COLORS.YELLOW}⚠ ${warning}${COLORS.RESET}`);
    });
  }

  const verdict = TEST_RESULTS.critical.length === 0 && TEST_RESULTS.failed.length === 0
    ? `${COLORS.GREEN}${COLORS.BOLD}SYSTEM OPERATIONAL${COLORS.RESET}`
    : `${COLORS.RED}${COLORS.BOLD}SYSTEM FAILURE - IMMEDIATE ACTION REQUIRED${COLORS.RESET}`;

  console.log(`\n${COLORS.BOLD}VERDICT: ${verdict}`);
  console.log(`Test duration: ${duration} seconds\n`);

  // Generate detailed report file
  const report = {
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    summary: {
      passed: TEST_RESULTS.passed.length,
      failed: TEST_RESULTS.failed.length,
      critical: TEST_RESULTS.critical.length,
      warnings: TEST_RESULTS.warnings.length
    },
    details: TEST_RESULTS,
    verdict: TEST_RESULTS.critical.length === 0 && TEST_RESULTS.failed.length === 0 ? 'PASS' : 'FAIL'
  };

  await fs.writeFile(
    'BRUTAL_TEST_REPORT.json',
    JSON.stringify(report, null, 2)
  );

  log('Report saved to BRUTAL_TEST_REPORT.json', 'info');

  // Exit with appropriate code
  process.exit(TEST_RESULTS.critical.length > 0 ? 1 : 0);
}

// Run the tests
runBrutalTests().catch(console.error);