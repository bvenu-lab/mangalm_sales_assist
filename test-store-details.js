// Test script to verify store details data flow
const axios = require('axios');

const storeId = '4261931000001048015';
const apiUrl = 'http://localhost:3001';

async function testStoreDetailsApi() {
  console.log('=== Testing Store Details API ===\n');
  
  try {
    // Test 1: Get Store Details
    console.log('1. Fetching store details...');
    const storeResponse = await axios.get(`${apiUrl}/api/stores/${storeId}`);
    console.log('Store Response:', JSON.stringify(storeResponse.data, null, 2));
    
    // Test 2: Get Invoices for Store
    console.log('\n2. Fetching invoices for store...');
    const invoicesResponse = await axios.get(`${apiUrl}/api/invoices`, {
      params: { store_id: storeId, limit: 5 }
    });
    console.log('Invoices Response:', JSON.stringify(invoicesResponse.data, null, 2));
    
    // Test 3: Get Predicted Orders
    console.log('\n3. Fetching predicted orders...');
    const ordersResponse = await axios.get(`${apiUrl}/api/orders/pending`, {
      params: { store_id: storeId, limit: 5 }
    });
    console.log('Orders Response:', JSON.stringify(ordersResponse.data, null, 2));
    
    // Test 4: Get Call Prioritization
    console.log('\n4. Fetching call prioritization...');
    const callsResponse = await axios.get(`${apiUrl}/api/calls/prioritized`, {
      params: { limit: 10 }
    });
    console.log('Calls Response:', JSON.stringify(callsResponse.data, null, 2));
    
    // Verify data types
    console.log('\n=== Data Type Verification ===');
    
    if (invoicesResponse.data.data && invoicesResponse.data.data.length > 0) {
      const firstInvoice = invoicesResponse.data.data[0];
      console.log('\nFirst Invoice total_amount type:', typeof firstInvoice.total_amount);
      console.log('First Invoice total_amount value:', firstInvoice.total_amount);
      
      // Test conversion
      const amount = parseFloat(firstInvoice.total_amount);
      console.log('Parsed amount:', amount);
      console.log('Can call toFixed?:', !isNaN(amount));
      if (!isNaN(amount)) {
        console.log('Formatted amount: $' + amount.toFixed(2));
      }
    } else {
      console.log('\nNo invoices found for this store');
    }
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testStoreDetailsApi();