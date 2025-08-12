// Debug script to test store API responses
const axios = require('axios');

const storeId = '4261931000001048015';
const apiUrl = 'http://localhost:3001';

async function debugStoreApi() {
  console.log('=== DEBUGGING STORE API RESPONSES ===\n');
  
  // First login to get auth token
  console.log('0. Logging in to get auth token...');
  const loginResponse = await axios.post(`${apiUrl}/auth/login`, {
    username: 'admin',
    password: 'admin123'
  });
  
  const token = loginResponse.data.token;
  console.log('   Got token:', token ? 'Yes' : 'No');
  
  // Set default auth header
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  
  try {
    // Test 1: Check what invoices endpoint returns WITH store_id
    console.log('1. Testing /api/invoices WITH store_id parameter:');
    console.log(`   GET ${apiUrl}/api/invoices?store_id=${storeId}`);
    
    const invoicesWithStoreId = await axios.get(`${apiUrl}/api/invoices`, {
      params: { store_id: storeId, limit: 3 }
    });
    
    console.log('\n   Response structure:', Object.keys(invoicesWithStoreId.data));
    console.log('   Success:', invoicesWithStoreId.data.success);
    console.log('   Data array length:', invoicesWithStoreId.data.data?.length || 0);
    
    if (invoicesWithStoreId.data.data && invoicesWithStoreId.data.data.length > 0) {
      console.log('\n   First invoice:');
      const firstInvoice = invoicesWithStoreId.data.data[0];
      console.log('   - Fields:', Object.keys(firstInvoice));
      console.log('   - store_id:', firstInvoice.store_id);
      console.log('   - total_amount:', firstInvoice.total_amount, '(type:', typeof firstInvoice.total_amount + ')');
      console.log('   - Full invoice:', JSON.stringify(firstInvoice, null, 2));
    }
    
    // Test 2: Check what invoices endpoint returns WITHOUT store_id
    console.log('\n2. Testing /api/invoices WITHOUT store_id parameter:');
    console.log(`   GET ${apiUrl}/api/invoices`);
    
    const invoicesWithoutStoreId = await axios.get(`${apiUrl}/api/invoices`, {
      params: { limit: 3 }
    });
    
    console.log('\n   Data array length:', invoicesWithoutStoreId.data.data?.length || 0);
    if (invoicesWithoutStoreId.data.data && invoicesWithoutStoreId.data.data.length > 0) {
      console.log('   Store IDs in response:', 
        invoicesWithoutStoreId.data.data.map(inv => inv.store_id).slice(0, 3));
    }
    
    // Test 3: Check predicted orders endpoint
    console.log('\n3. Testing /api/orders/pending WITH store_id:');
    console.log(`   GET ${apiUrl}/api/orders/pending?store_id=${storeId}`);
    
    const ordersWithStoreId = await axios.get(`${apiUrl}/api/orders/pending`, {
      params: { store_id: storeId, limit: 3 }
    });
    
    console.log('   Response structure:', Object.keys(ordersWithStoreId.data));
    console.log('   Data array length:', ordersWithStoreId.data.data?.length || 0);
    
    // Test 4: Check call prioritization
    console.log('\n4. Testing /api/calls/prioritized:');
    const callsResponse = await axios.get(`${apiUrl}/api/calls/prioritized`, {
      params: { limit: 10 }
    });
    
    console.log('   Response structure:', Object.keys(callsResponse.data));
    console.log('   Data array length:', callsResponse.data.data?.length || 0);
    
    if (callsResponse.data.data && callsResponse.data.data.length > 0) {
      const storeCall = callsResponse.data.data.find(c => c.store_id === storeId);
      if (storeCall) {
        console.log('   Found call for our store:', JSON.stringify(storeCall, null, 2));
      } else {
        console.log('   No call prioritization found for store:', storeId);
      }
    }
    
    // Test 5: Check store details
    console.log('\n5. Testing /api/stores/:id endpoint:');
    console.log(`   GET ${apiUrl}/api/stores/${storeId}`);
    
    const storeResponse = await axios.get(`${apiUrl}/api/stores/${storeId}`);
    console.log('   Response structure:', Object.keys(storeResponse.data));
    
    if (storeResponse.data.data) {
      console.log('   Store fields:', Object.keys(storeResponse.data.data));
      console.log('   Has email?:', 'email' in storeResponse.data.data);
      console.log('   Has contactPerson?:', 'contactPerson' in storeResponse.data.data);
      console.log('   Has storeSize?:', 'storeSize' in storeResponse.data.data);
      console.log('   Has callFrequency?:', 'callFrequency' in storeResponse.data.data);
    }
    
    console.log('\n=== DEBUG COMPLETE ===');
    
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

debugStoreApi();