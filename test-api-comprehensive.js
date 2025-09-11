/**
 * Comprehensive API Testing Suite for Mangalam System
 * Tests all endpoints to ensure they're working correctly
 */

const axios = require('axios');
const colors = require('colors/safe');

const API_BASE_URL = 'http://localhost:3007';
const TEST_RESULTS = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper function to make API requests
async function testEndpoint(method, path, description, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  console.log(`\n${colors.blue('Testing:')} ${description}`);
  console.log(`  ${method} ${url}`);
  
  try {
    const config = {
      method,
      url,
      timeout: 5000,
      validateStatus: () => true, // Don't throw on any status
      ...options
    };
    
    const response = await axios(config);
    
    // Check if response is successful
    if (response.status >= 200 && response.status < 300) {
      console.log(`  ${colors.green('✓')} Status: ${response.status}`);
      
      // Validate response structure
      if (response.data) {
        if (response.data.success !== undefined) {
          if (response.data.success) {
            console.log(`  ${colors.green('✓')} Response: success=true`);
            if (response.data.data) {
              console.log(`  ${colors.green('✓')} Data structure present`);
            }
          } else {
            console.log(`  ${colors.yellow('⚠')} Response: success=false`);
            if (response.data.error) {
              console.log(`  ${colors.yellow('⚠')} Error: ${response.data.error}`);
            }
          }
        }
        
        // Log sample data if available
        if (response.data.data) {
          const dataType = Array.isArray(response.data.data) ? 'array' : typeof response.data.data;
          const dataLength = Array.isArray(response.data.data) ? response.data.data.length : 
                            (response.data.data && typeof response.data.data === 'object' ? 
                             Object.keys(response.data.data).length : 0);
          console.log(`  ${colors.cyan('ℹ')} Data type: ${dataType}, items/keys: ${dataLength}`);
        }
      }
      
      TEST_RESULTS.passed.push({ endpoint: path, description, status: response.status });
      return { success: true, response };
    } else {
      console.log(`  ${colors.red('✗')} Status: ${response.status}`);
      if (response.data?.error) {
        console.log(`  ${colors.red('✗')} Error: ${response.data.error}`);
      }
      TEST_RESULTS.failed.push({ 
        endpoint: path, 
        description, 
        status: response.status,
        error: response.data?.error || response.statusText 
      });
      return { success: false, response };
    }
  } catch (error) {
    console.log(`  ${colors.red('✗')} Request failed: ${error.message}`);
    TEST_RESULTS.failed.push({ 
      endpoint: path, 
      description, 
      error: error.message 
    });
    return { success: false, error };
  }
}

// Test database connectivity
async function testDatabaseConnection() {
  console.log(colors.yellow('\n═══════════════════════════════════════════'));
  console.log(colors.yellow('Testing Database Connection'));
  console.log(colors.yellow('═══════════════════════════════════════════'));
  
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
    console.log(`${colors.green('✓')} Connected to PostgreSQL`);
    
    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`${colors.green('✓')} Found ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach(row => {
      console.log(`    - ${row.table_name}`);
    });
    
    // Check data in key tables
    const dataChecks = [
      { table: 'mangalam_invoices', description: 'Invoice records' },
      { table: 'stores', description: 'Store records' },
      { table: 'orders', description: 'Order records' },
      { table: 'products', description: 'Product records' }
    ];
    
    console.log(`\n${colors.cyan('Data Check:')}`);
    for (const check of dataChecks) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${check.table}`);
        const count = result.rows[0].count;
        if (count > 0) {
          console.log(`  ${colors.green('✓')} ${check.description}: ${count} records`);
        } else {
          console.log(`  ${colors.yellow('⚠')} ${check.description}: 0 records`);
          TEST_RESULTS.warnings.push(`No data in ${check.table}`);
        }
      } catch (err) {
        console.log(`  ${colors.red('✗')} ${check.description}: Table not found`);
      }
    }
    
    // Check date ranges in mangalam_invoices
    const dateResult = await client.query(`
      SELECT 
        MIN(invoice_date) as min_date,
        MAX(invoice_date) as max_date,
        COUNT(*) as total_count,
        COUNT(DISTINCT customer_name) as unique_customers
      FROM mangalam_invoices
    `);
    
    if (dateResult.rows[0].total_count > 0) {
      const data = dateResult.rows[0];
      console.log(`\n${colors.cyan('Invoice Data Range:')}`);
      console.log(`  Earliest: ${data.min_date}`);
      console.log(`  Latest: ${data.max_date}`);
      console.log(`  Total invoices: ${data.total_count}`);
      console.log(`  Unique customers: ${data.unique_customers}`);
    }
    
    await client.end();
    return true;
  } catch (error) {
    console.log(`${colors.red('✗')} Database connection failed: ${error.message}`);
    TEST_RESULTS.failed.push({ 
      endpoint: 'database', 
      description: 'Database Connection', 
      error: error.message 
    });
    return false;
  }
}

// Main test suite
async function runTests() {
  console.log(colors.bold.cyan('\n╔══════════════════════════════════════════╗'));
  console.log(colors.bold.cyan('║   MANGALAM API COMPREHENSIVE TEST SUITE   ║'));
  console.log(colors.bold.cyan('╚══════════════════════════════════════════╝'));
  
  // Test database first
  await testDatabaseConnection();
  
  // Analytics Endpoints
  console.log(colors.yellow('\n═══════════════════════════════════════════'));
  console.log(colors.yellow('Testing Analytics Endpoints'));
  console.log(colors.yellow('═══════════════════════════════════════════'));
  
  await testEndpoint('GET', '/api/analytics/trends?range=7d', 'Analytics Trends (7 days)');
  await testEndpoint('GET', '/api/analytics/trends?range=30d', 'Analytics Trends (30 days)');
  await testEndpoint('GET', '/api/analytics/product-distribution', 'Product Distribution');
  await testEndpoint('GET', '/api/analytics/performance-metrics', 'Performance Metrics');
  await testEndpoint('GET', '/api/analytics/insights', 'Analytics Insights');
  
  // Dashboard Endpoints
  console.log(colors.yellow('\n═══════════════════════════════════════════'));
  console.log(colors.yellow('Testing Dashboard Endpoints'));
  console.log(colors.yellow('═══════════════════════════════════════════'));
  
  await testEndpoint('GET', '/api/calls/prioritized?limit=10', 'Prioritized Calls');
  await testEndpoint('GET', '/api/orders/recent?limit=10', 'Recent Orders');
  await testEndpoint('GET', '/api/orders/pending', 'Pending Orders');
  await testEndpoint('GET', '/api/stores/recent?limit=10', 'Recent Stores');
  await testEndpoint('GET', '/api/performance/summary', 'Performance Summary');
  
  // Store Management Endpoints
  console.log(colors.yellow('\n═══════════════════════════════════════════'));
  console.log(colors.yellow('Testing Store Management Endpoints'));
  console.log(colors.yellow('═══════════════════════════════════════════'));
  
  await testEndpoint('GET', '/api/stores?limit=5', 'List Stores');
  await testEndpoint('GET', '/api/stores/regions', 'Store Regions');
  
  // Product Endpoints
  console.log(colors.yellow('\n═══════════════════════════════════════════'));
  console.log(colors.yellow('Testing Product Endpoints'));
  console.log(colors.yellow('═══════════════════════════════════════════'));
  
  await testEndpoint('GET', '/api/products?limit=5', 'List Products');
  await testEndpoint('GET', '/api/products/categories', 'Product Categories');
  await testEndpoint('GET', '/api/products/brands', 'Product Brands');
  
  // Order Management Endpoints
  console.log(colors.yellow('\n═══════════════════════════════════════════'));
  console.log(colors.yellow('Testing Order Management Endpoints'));
  console.log(colors.yellow('═══════════════════════════════════════════'));
  
  await testEndpoint('GET', '/api/orders?limit=5', 'List Orders');
  await testEndpoint('GET', '/api/orders/analytics', 'Order Analytics');
  
  // Health Check
  console.log(colors.yellow('\n═══════════════════════════════════════════'));
  console.log(colors.yellow('Testing Health Endpoints'));
  console.log(colors.yellow('═══════════════════════════════════════════'));
  
  await testEndpoint('GET', '/health', 'API Gateway Health');
  await testEndpoint('GET', '/api/auth/health', 'Auth System Health');
  
  // Generate Summary Report
  console.log(colors.bold.yellow('\n═══════════════════════════════════════════'));
  console.log(colors.bold.yellow('TEST SUMMARY'));
  console.log(colors.bold.yellow('═══════════════════════════════════════════'));
  
  console.log(`\n${colors.green('Passed:')} ${TEST_RESULTS.passed.length} tests`);
  TEST_RESULTS.passed.forEach(test => {
    console.log(`  ${colors.green('✓')} ${test.description} (${test.endpoint})`);
  });
  
  if (TEST_RESULTS.warnings.length > 0) {
    console.log(`\n${colors.yellow('Warnings:')} ${TEST_RESULTS.warnings.length} issues`);
    TEST_RESULTS.warnings.forEach(warning => {
      console.log(`  ${colors.yellow('⚠')} ${warning}`);
    });
  }
  
  if (TEST_RESULTS.failed.length > 0) {
    console.log(`\n${colors.red('Failed:')} ${TEST_RESULTS.failed.length} tests`);
    TEST_RESULTS.failed.forEach(test => {
      console.log(`  ${colors.red('✗')} ${test.description} - ${test.error}`);
    });
  }
  
  // Overall status
  console.log(colors.bold.cyan('\n╔══════════════════════════════════════════╗'));
  if (TEST_RESULTS.failed.length === 0) {
    console.log(colors.bold.green('║         ALL TESTS PASSED! 🎉              ║'));
  } else {
    console.log(colors.bold.red(`║     ${TEST_RESULTS.failed.length} TESTS FAILED - NEEDS ATTENTION     ║`));
  }
  console.log(colors.bold.cyan('╚══════════════════════════════════════════╝\n'));
  
  // Return exit code
  process.exit(TEST_RESULTS.failed.length > 0 ? 1 : 0);
}

// Check if required modules are installed
async function checkDependencies() {
  const requiredModules = ['axios', 'colors', 'pg'];
  const missing = [];
  
  for (const module of requiredModules) {
    try {
      require.resolve(module);
    } catch (e) {
      missing.push(module);
    }
  }
  
  if (missing.length > 0) {
    console.log(colors.yellow('Installing required dependencies...'));
    const { execSync } = require('child_process');
    execSync(`npm install ${missing.join(' ')}`, { stdio: 'inherit' });
  }
}

// Run the tests
(async () => {
  await checkDependencies();
  await runTests();
})();