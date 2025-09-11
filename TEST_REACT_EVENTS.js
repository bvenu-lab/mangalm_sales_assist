/**
 * Automated React Event Handler Test
 * Tests if React events are working in the browser
 */

const puppeteer = require('puppeteer');

async function testReactEvents() {
  console.log('════════════════════════════════════════════════════════');
  console.log('   AUTOMATED REACT EVENT TESTING');
  console.log('════════════════════════════════════════════════════════\n');

  let browser;
  try {
    // Launch browser
    console.log('Launching headless browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      if (text.includes('[DEBUG]') || text.includes('[LoginPage]') || text.includes('[AuthContext]')) {
        console.log('Browser console:', text);
      }
    });

    // Navigate to login page
    console.log('\nNavigating to http://localhost:3000/login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    
    // Wait for page to load
    await page.waitForTimeout(2000);

    // Test 1: Check if page loaded
    console.log('\n[TEST 1] Checking if React app loaded...');
    const hasReactRoot = await page.evaluate(() => {
      return document.getElementById('root') !== null;
    });
    console.log(hasReactRoot ? '✅ React root found' : '❌ React root NOT found');

    // Test 2: Check if login form exists
    console.log('\n[TEST 2] Looking for login elements...');
    const elements = await page.evaluate(() => {
      const results = {
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent),
        inputs: Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, value: i.value })),
        hasForm: document.querySelector('form') !== null
      };
      return results;
    });
    console.log('Found buttons:', elements.buttons);
    console.log('Found inputs:', elements.inputs);
    console.log('Has form tag:', elements.hasForm);

    // Test 3: Try clicking a button
    console.log('\n[TEST 3] Attempting to click buttons...');
    const buttons = await page.$$('button');
    for (let i = 0; i < buttons.length && i < 3; i++) {
      const buttonText = await buttons[i].evaluate(el => el.textContent);
      console.log(`Clicking button: "${buttonText}"`);
      await buttons[i].click();
      await page.waitForTimeout(500);
    }

    // Test 4: Try typing in inputs
    console.log('\n[TEST 4] Attempting to type in inputs...');
    const inputs = await page.$$('input[type="text"], input[type="password"]');
    for (let i = 0; i < inputs.length && i < 2; i++) {
      console.log(`Typing in input ${i + 1}...`);
      await inputs[i].click();
      await inputs[i].type('test');
      await page.waitForTimeout(500);
    }

    // Test 5: Execute React event directly
    console.log('\n[TEST 5] Testing React events directly in browser...');
    const reactTest = await page.evaluate(() => {
      const results = {
        reactVersion: null,
        hasReactInternals: false,
        eventHandlers: [],
        canTriggerClick: false
      };

      // Check React version
      if (window.React) {
        results.reactVersion = window.React.version;
      }

      // Check for React internals
      const root = document.getElementById('root');
      if (root && root._reactRootContainer) {
        results.hasReactInternals = true;
      }

      // Find all elements with onClick handlers
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const props = Object.keys(el);
        const hasOnClick = props.some(prop => prop.startsWith('__reactEventHandlers') || prop.startsWith('__reactProps'));
        if (hasOnClick) {
          results.eventHandlers.push(el.tagName);
        }
      });

      // Try to trigger a click
      const button = document.querySelector('button');
      if (button) {
        button.click();
        results.canTriggerClick = true;
      }

      return results;
    });
    console.log('React test results:', reactTest);

    // Test 6: Check console logs
    console.log('\n[TEST 6] Analyzing console output...');
    const relevantLogs = consoleLogs.filter(log => 
      log.includes('clicked') || 
      log.includes('onChange') || 
      log.includes('LOGIN') ||
      log.includes('[DEBUG]')
    );
    
    if (relevantLogs.length > 0) {
      console.log('✅ Found React event logs:');
      relevantLogs.forEach(log => console.log('  -', log));
    } else {
      console.log('❌ No React event logs found!');
    }

    // Test 7: Try login with direct JavaScript
    console.log('\n[TEST 7] Attempting login via JavaScript injection...');
    const loginResult = await page.evaluate(async () => {
      // Try to find and call login function directly
      const loginData = { username: 'demo', password: 'demo2025' };
      
      try {
        const response = await fetch('http://localhost:3007/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginData)
        });
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    if (loginResult.success && loginResult.data.success) {
      console.log('✅ Direct API login works!');
      console.log('Token:', loginResult.data.token ? loginResult.data.token.substring(0, 30) + '...' : 'N/A');
    } else {
      console.log('❌ Direct API login failed:', loginResult);
    }

    // Summary
    console.log('\n════════════════════════════════════════════════════════');
    console.log('   TEST SUMMARY');
    console.log('════════════════════════════════════════════════════════');
    
    const hasEventLogs = relevantLogs.length > 0;
    const hasButtons = elements.buttons.length > 0;
    const hasInputs = elements.inputs.length > 0;
    
    console.log(`React App Loaded: ${hasReactRoot ? '✅' : '❌'}`);
    console.log(`UI Elements Found: ${hasButtons && hasInputs ? '✅' : '❌'}`);
    console.log(`React Events Firing: ${hasEventLogs ? '✅' : '❌'}`);
    console.log(`API Working: ${loginResult.success ? '✅' : '❌'}`);
    
    if (!hasEventLogs) {
      console.log('\n⚠️  DIAGNOSIS: React event handlers are NOT working!');
      console.log('Possible causes:');
      console.log('1. React event delegation is broken');
      console.log('2. Event handlers not properly bound');
      console.log('3. Build/compilation issue');
      console.log('4. React version mismatch');
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if puppeteer is installed
try {
  require.resolve('puppeteer');
  testReactEvents();
} catch (e) {
  console.log('Puppeteer not installed. Installing...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install puppeteer', { stdio: 'inherit', cwd: __dirname });
    console.log('Puppeteer installed. Please run this script again.');
  } catch (installError) {
    console.error('Failed to install puppeteer:', installError.message);
    console.log('\nManual test alternative: Please run these commands:');
    console.log('1. npm install puppeteer');
    console.log('2. node TEST_REACT_EVENTS.js');
  }
}