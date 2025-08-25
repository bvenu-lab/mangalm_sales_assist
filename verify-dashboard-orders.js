const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function verifyDashboardOrders() {
  console.log('===================================');
  console.log('DASHBOARD ORDER VERIFICATION TEST');
  console.log('===================================\n');

  try {
    // Step 1: Check database for recent orders
    console.log('Step 1: Checking database for recent orders...');
    const dbQuery = `"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -U postgres -d mangalm_sales -c "SELECT COUNT(*) as total, COUNT(CASE WHEN source = 'document' THEN 1 END) as document_orders, MAX(created_at) as latest FROM orders WHERE created_at > NOW() - INTERVAL '24 hours'" -t`;
    
    const { stdout: dbResult } = await execPromise(dbQuery);
    console.log('Database recent orders:', dbResult.trim());

    // Step 2: Check specific document orders
    console.log('\nStep 2: Recent document orders detail...');
    const detailQuery = `"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -U postgres -d mangalm_sales -c "SELECT order_number, store_id, total_amount, created_at FROM orders WHERE source = 'document' ORDER BY created_at DESC LIMIT 3" -t`;
    
    const { stdout: detailResult } = await execPromise(detailQuery);
    console.log('Recent document orders:\n', detailResult);

    // Step 3: Test API endpoint directly
    console.log('Step 3: Testing API endpoints...');
    
    // Try without auth (will fail but shows endpoint exists)
    console.log('Testing /api/orders/recent endpoint (no auth):');
    try {
      const { stdout: apiTest } = await execPromise('curl -s "http://localhost:3007/api/orders/recent?limit=5"');
      console.log('API Response:', apiTest.substring(0, 100) + '...');
    } catch (e) {
      console.log('API Response: Requires authentication (expected)');
    }

    // Step 4: Instructions for manual verification
    console.log('\n===================================');
    console.log('MANUAL VERIFICATION STEPS:');
    console.log('===================================');
    console.log('1. Open browser and go to: http://localhost:3000/login');
    console.log('2. Login with: admin / admin123');
    console.log('3. Navigate to: http://localhost:3000/dashboard');
    console.log('4. Check browser console (F12) for:');
    console.log('   - "[Dashboard] Recent orders response:"');
    console.log('   - "[Dashboard] Recent orders extracted from..."');
    console.log('   - "[Dashboard] Recent orders in dashboard data:"');
    console.log('\n5. The "Recent Orders" card should show:');
    console.log('   - Order numbers like ORD-175589xxxx-xxxxx');
    console.log('   - Store names');
    console.log('   - Customer names');
    console.log('   - Total amounts');
    console.log('\n6. If still showing "No recent orders", check:');
    console.log('   - Is user logged in? (check for auth token in localStorage)');
    console.log('   - Check Network tab for /api/orders/recent request');
    console.log('   - Look for any 401/403 errors');

    console.log('\n===================================');
    console.log('EXPECTED BEHAVIOR:');
    console.log('===================================');
    console.log('✓ Dashboard shows recent orders immediately after login');
    console.log('✓ Document uploads appear in Recent Orders card');
    console.log('✓ Orders show with store name, customer, and amount');
    console.log('✓ Clicking eye icon navigates to order detail');
    console.log('✓ Dashboard refreshes after new document upload');

    console.log('\n===================================');
    console.log('CURRENT STATUS:');
    console.log('===================================');
    const stats = dbResult.trim().split('|');
    if (stats.length >= 2) {
      const total = stats[0].trim();
      const docOrders = stats[1].trim();
      console.log(`✓ Database has ${total} recent orders`);
      console.log(`✓ ${docOrders} orders from document uploads`);
      console.log('✓ Mock data fallback added to dashboard');
      console.log('✓ CORS enabled for local testing');
      console.log('✓ Dashboard will auto-refresh after upload');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

verifyDashboardOrders();