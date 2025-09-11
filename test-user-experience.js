/**
 * End-to-End User Experience Testing
 * Simulates real user interactions with the Mangalam system
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const colors = require('colors/safe');

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3007';

const TEST_RESULTS = {
  passed: [],
  failed: [],
  warnings: []
};

// Test credentials
const TEST_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'user', password: 'user123', role: 'user' },
  { username: 'demo', password: 'demo2025', role: 'demo' }
];

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test API login directly
async function testAPILogin(username, password) {
  console.log(`\n${colors.blue('Testing API Login:')} ${username}`);
  
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      username,
      password
    }, {
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      console.log(`  ${colors.green('✓')} API Login successful`);
      if (response.data.token) {
        console.log(`  ${colors.green('✓')} JWT token received`);
      }
      if (response.data.user) {
        console.log(`  ${colors.green('✓')} User data received: ${response.data.user.username} (${response.data.user.role})`);
      }
      TEST_RESULTS.passed.push({ test: 'API Login', user: username });
      return response.data.token;
    } else {
      console.log(`  ${colors.red('✗')} API Login failed: ${response.status}`);
      if (response.data?.error) {
        console.log(`  ${colors.red('✗')} Error: ${response.data.error}`);
      }
      TEST_RESULTS.failed.push({ test: 'API Login', user: username, error: response.data?.error });
      return null;
    }
  } catch (error) {
    console.log(`  ${colors.red('✗')} API Login error: ${error.message}`);
    TEST_RESULTS.failed.push({ test: 'API Login', user: username, error: error.message });
    return null;
  }
}

// Test authenticated API calls
async function testAuthenticatedAPIs(token) {
  console.log(`\n${colors.blue('Testing Authenticated API Calls:')}`);
  
  const endpoints = [
    { path: '/api/stores', description: 'Stores list' },
    { path: '/api/products', description: 'Products list' },
    { path: '/api/orders/recent', description: 'Recent orders' },
    { path: '/api/analytics/trends?range=7d', description: 'Analytics trends' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${API_URL}${endpoint.path}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        validateStatus: () => true
      });
      
      if (response.status === 200) {
        console.log(`  ${colors.green('✓')} ${endpoint.description}: Success`);
        TEST_RESULTS.passed.push({ test: `Auth API: ${endpoint.description}` });
      } else {
        console.log(`  ${colors.red('✗')} ${endpoint.description}: ${response.status}`);
        TEST_RESULTS.failed.push({ test: `Auth API: ${endpoint.description}`, error: response.status });
      }
    } catch (error) {
      console.log(`  ${colors.red('✗')} ${endpoint.description}: ${error.message}`);
      TEST_RESULTS.failed.push({ test: `Auth API: ${endpoint.description}`, error: error.message });
    }
  }
}

// Test browser experience with Puppeteer
async function testBrowserExperience() {
  console.log(`\n${colors.yellow('═══════════════════════════════════════════')}`);
  console.log(colors.yellow('Testing Browser User Experience'));
  console.log(colors.yellow('═══════════════════════════════════════════'));
  
  let browser;
  
  try {
    // Check if frontend is running
    console.log(`\n${colors.blue('Checking frontend availability...')}`);
    try {
      const response = await axios.get(BASE_URL, { 
        timeout: 5000,
        validateStatus: () => true 
      });
      console.log(`  ${colors.green('✓')} Frontend responding on port 3000`);
    } catch (error) {
      console.log(`  ${colors.red('✗')} Frontend not accessible: ${error.message}`);
      TEST_RESULTS.failed.push({ test: 'Frontend Availability', error: error.message });
      return;
    }
    
    // Launch browser
    console.log(`\n${colors.blue('Launching browser...')}`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`  ${colors.red('[Browser Console Error]')} ${msg.text()}`);
      }
    });
    
    // Navigate to login page
    console.log(`\n${colors.blue('Testing Login Page:')}`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check if login form exists
    const loginFormExists = await page.evaluate(() => {
      return document.querySelector('input[type="text"]') !== null ||
             document.querySelector('input[name="username"]') !== null ||
             document.querySelector('#username') !== null;
    });
    
    if (loginFormExists) {
      console.log(`  ${colors.green('✓')} Login form found`);
      TEST_RESULTS.passed.push({ test: 'Login Form Rendered' });
      
      // Try to login
      console.log(`\n${colors.blue('Attempting browser login...')}`);
      
      // Find and fill username field
      const usernameSelector = await page.evaluate(() => {
        const selectors = ['input[name="username"]', '#username', 'input[type="text"]'];
        for (const sel of selectors) {
          if (document.querySelector(sel)) return sel;
        }
        return null;
      });
      
      if (usernameSelector) {
        await page.type(usernameSelector, 'admin');
        console.log(`  ${colors.green('✓')} Username entered`);
      }
      
      // Find and fill password field
      const passwordSelector = await page.evaluate(() => {
        const selectors = ['input[name="password"]', '#password', 'input[type="password"]'];
        for (const sel of selectors) {
          if (document.querySelector(sel)) return sel;
        }
        return null;
      });
      
      if (passwordSelector) {
        await page.type(passwordSelector, 'admin123');
        console.log(`  ${colors.green('✓')} Password entered`);
      }
      
      // Submit form
      const submitButton = await page.evaluate(() => {
        const selectors = ['button[type="submit"]', 'input[type="submit"]', 'button:contains("Login")', 'button:contains("Sign in")'];
        for (const sel of selectors) {
          const elem = document.querySelector(sel);
          if (elem) return sel;
        }
        // Try finding by text
        const buttons = Array.from(document.querySelectorAll('button'));
        const loginButton = buttons.find(b => 
          b.textContent.toLowerCase().includes('login') || 
          b.textContent.toLowerCase().includes('sign in')
        );
        return loginButton ? 'button' : null;
      });
      
      if (submitButton) {
        await page.click(submitButton);
        console.log(`  ${colors.green('✓')} Login form submitted`);
        
        // Wait for navigation or dashboard to load
        await wait(3000);
        
        // Check if we're on dashboard
        const isDashboard = await page.evaluate(() => {
          return window.location.pathname.includes('dashboard') ||
                 document.querySelector('[class*="dashboard"]') !== null ||
                 document.title.toLowerCase().includes('dashboard');
        });
        
        if (isDashboard) {
          console.log(`  ${colors.green('✓')} Dashboard loaded successfully`);
          TEST_RESULTS.passed.push({ test: 'Browser Login & Dashboard Load' });
        } else {
          console.log(`  ${colors.yellow('⚠')} Dashboard not detected after login`);
          TEST_RESULTS.warnings.push('Dashboard detection failed');
        }
      }
    } else {
      console.log(`  ${colors.red('✗')} Login form not found`);
      console.log(`  ${colors.yellow('ℹ')} Current URL: ${page.url()}`);
      
      // Check if already on dashboard (no auth required)
      const isDashboard = await page.evaluate(() => {
        return document.querySelector('[class*="dashboard"]') !== null ||
               document.querySelector('[class*="Dashboard"]') !== null;
      });
      
      if (isDashboard) {
        console.log(`  ${colors.yellow('⚠')} Dashboard loaded without authentication`);
        TEST_RESULTS.warnings.push('No authentication required');
      } else {
        TEST_RESULTS.failed.push({ test: 'Login Form', error: 'Not found' });
      }
    }
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-screenshot.png' });
    console.log(`  ${colors.cyan('ℹ')} Screenshot saved as test-screenshot.png`);
    
  } catch (error) {
    console.log(`  ${colors.red('✗')} Browser test error: ${error.message}`);
    TEST_RESULTS.failed.push({ test: 'Browser Experience', error: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if frontend process is running
async function checkFrontendProcess() {
  console.log(`\n${colors.blue('Checking Frontend Process:')}`);
  
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    exec('netstat -an | findstr ":3000"', (error, stdout) => {
      if (stdout.includes('LISTENING')) {
        console.log(`  ${colors.green('✓')} Frontend is listening on port 3000`);
        TEST_RESULTS.passed.push({ test: 'Frontend Port' });
        resolve(true);
      } else {
        console.log(`  ${colors.red('✗')} Frontend not listening on port 3000`);
        TEST_RESULTS.failed.push({ test: 'Frontend Port', error: 'Not listening' });
        resolve(false);
      }
    });
  });
}

// Main test runner
async function runTests() {
  console.log(colors.bold.cyan('\n╔══════════════════════════════════════════╗'));
  console.log(colors.bold.cyan('║   USER EXPERIENCE COMPREHENSIVE TEST      ║'));
  console.log(colors.bold.cyan('╚══════════════════════════════════════════╝'));
  
  // Check frontend process
  const frontendRunning = await checkFrontendProcess();
  
  // Test API authentication
  console.log(colors.yellow('\n═══════════════════════════════════════════'));
  console.log(colors.yellow('Testing API Authentication'));
  console.log(colors.yellow('═══════════════════════════════════════════'));
  
  let token = null;
  for (const user of TEST_USERS) {
    const userToken = await testAPILogin(user.username, user.password);
    if (userToken && !token) {
      token = userToken;
    }
  }
  
  // Test authenticated endpoints
  if (token) {
    await testAuthenticatedAPIs(token);
  }
  
  // Test browser experience if frontend is running
  if (frontendRunning) {
    await testBrowserExperience();
  }
  
  // Summary
  console.log(colors.bold.yellow('\n═══════════════════════════════════════════'));
  console.log(colors.bold.yellow('TEST SUMMARY'));
  console.log(colors.bold.yellow('═══════════════════════════════════════════'));
  
  console.log(`\n${colors.green('Passed:')} ${TEST_RESULTS.passed.length} tests`);
  TEST_RESULTS.passed.forEach(test => {
    console.log(`  ${colors.green('✓')} ${test.test || test}`);
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
      console.log(`  ${colors.red('✗')} ${test.test} - ${test.error}`);
    });
  }
  
  // Overall status
  console.log(colors.bold.cyan('\n╔══════════════════════════════════════════╗'));
  if (TEST_RESULTS.failed.length === 0) {
    console.log(colors.bold.green('║     USER EXPERIENCE TESTS PASSED! 🎉      ║'));
  } else {
    console.log(colors.bold.red(`║   ${TEST_RESULTS.failed.length} USER EXPERIENCE TESTS FAILED     ║`));
  }
  console.log(colors.bold.cyan('╚══════════════════════════════════════════╝\n'));
  
  process.exit(TEST_RESULTS.failed.length > 0 ? 1 : 0);
}

// Check and install dependencies
async function checkDependencies() {
  const requiredModules = ['puppeteer', 'axios', 'colors'];
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
    execSync(`npm install ${missing.join(' ')} --no-save`, { stdio: 'inherit' });
  }
}

// Run tests
(async () => {
  await checkDependencies();
  await runTests();
})();