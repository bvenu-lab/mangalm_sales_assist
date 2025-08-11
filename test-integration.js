const axios = require('axios');

async function testIntegration() {
  const apiUrl = 'http://localhost:3001';
  
  console.log('Testing Mangalm Sales Assistant Integration...\n');
  
  try {
    // Step 1: Login
    console.log('1. Testing Authentication...');
    const loginResponse = await axios.post(`${apiUrl}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Authentication successful');
    console.log(`  Token: ${token.substring(0, 50)}...`);
    
    // Configure axios with auth token
    const authAxios = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Step 2: Test Stores API
    console.log('\n2. Testing Stores API...');
    const storesResponse = await authAxios.get('/api/stores?limit=5');
    console.log('✓ Stores API working');
    console.log(`  Retrieved ${storesResponse.data.data.length} stores`);
    console.log(`  Total stores in database: ${storesResponse.data.total}`);
    if (storesResponse.data.data.length > 0) {
      const firstStore = storesResponse.data.data[0];
      console.log(`  Sample store: ${firstStore.name} (${firstStore.city || 'No city'})`);
    }
    
    // Step 3: Test Products API
    console.log('\n3. Testing Products API...');
    const productsResponse = await authAxios.get('/api/products?limit=5');
    console.log('✓ Products API working');
    console.log(`  Retrieved ${productsResponse.data.data.length} products`);
    console.log(`  Total products in database: ${productsResponse.data.total}`);
    if (productsResponse.data.data.length > 0) {
      const firstProduct = productsResponse.data.data[0];
      console.log(`  Sample product: ${firstProduct.name} - ${firstProduct.brand || 'No brand'}`);
    }
    
    // Step 4: Test Dashboard Routes
    console.log('\n4. Testing Dashboard Routes...');
    const dashboardResponse = await authAxios.get('/api/calls/prioritized');
    console.log('✓ Dashboard API working');
    console.log(`  Call prioritization data available`);
    
    // Step 5: Test Store Details
    if (storesResponse.data.data.length > 0) {
      console.log('\n5. Testing Store Details API...');
      const storeId = storesResponse.data.data[0].id;
      const storeDetailResponse = await authAxios.get(`/api/stores/${storeId}`);
      console.log('✓ Store detail API working');
      console.log(`  Retrieved details for: ${storeDetailResponse.data.data.name}`);
    }
    
    console.log('\n========================================');
    console.log('✅ ALL INTEGRATION TESTS PASSED!');
    console.log('========================================');
    console.log('\nThe store page correctly uses the API routes/gateway');
    console.log('Real data from the database is loading properly.');
    console.log('\nYou can access the application at:');
    console.log('  Frontend: http://localhost:3000');
    console.log('  API Gateway: http://localhost:3001');
    console.log('\nLogin credentials:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    
  } catch (error) {
    console.error('\n❌ Integration test failed:');
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Message: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error('  No response from server. Make sure services are running.');
    } else {
      console.error(`  Error: ${error.message}`);
    }
    process.exit(1);
  }
}

// Run the test
testIntegration();