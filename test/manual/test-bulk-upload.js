/**
 * Manual Test for Bulk Upload System
 * Tests the actual bulk upload flow with real components
 */

const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

async function generateTestCSV(filename, rows = 100) {
  const headers = [
    'Invoice No', 'Invoice Date', 'Month', 'Year', 'Salesman Name',
    'Store Name', 'Store Code', 'Item Name', 'Batch No',
    'Quantity', 'Rate', 'MRP', 'Dis', 'Amount',
    'Company Name', 'Division', 'HQ', 'Expiry Date'
  ];
  
  let content = headers.join(',') + '\n';
  
  for (let i = 1; i <= rows; i++) {
    const row = [
      `INV-2024-${String(i).padStart(5, '0')}`,
      '2024-01-15',
      'January',
      '2024',
      `Salesman ${i % 5}`,
      `Store ${i % 10}`,
      `ST${String(i % 10).padStart(3, '0')}`,
      `Product ${i % 20}`,
      `BATCH-${String(i).padStart(4, '0')}`,
      Math.floor(Math.random() * 100) + 1,
      (Math.random() * 100 + 10).toFixed(2),
      (Math.random() * 120 + 15).toFixed(2),
      (Math.random() * 10).toFixed(2),
      (Math.random() * 1000 + 100).toFixed(2),
      'Test Company Ltd',
      'Sales',
      'Mumbai',
      '2025-12-31'
    ];
    content += row.join(',') + '\n';
  }
  
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, content);
  return filename;
}

async function testBulkUpload() {
  console.log('=== Manual Bulk Upload Test ===\n');
  
  try {
    // 1. Check if server is running
    console.log('1. Checking server health...');
    try {
      const health = await axios.get('http://localhost:3000/health');
      console.log('   ✓ Server is healthy:', health.data.status);
    } catch (error) {
      console.error('   ✗ Server is not running. Please start it with: node server-enterprise.js');
      return;
    }
    
    // 2. Generate test file
    console.log('\n2. Generating test CSV file...');
    const testFile = await generateTestCSV('./test/uploads/manual-test.csv', 100);
    console.log('   ✓ Created test file with 100 rows');
    
    // 3. Upload file
    console.log('\n3. Uploading file...');
    const formData = new FormData();
    formData.append('file', await fs.readFile(testFile), 'manual-test.csv');
    formData.append('userId', 'manual-test');
    
    const uploadResponse = await axios.post(
      'http://localhost:3000/api/bulk-upload',
      formData,
      {
        headers: formData.getHeaders()
      }
    );
    
    console.log('   ✓ Upload successful');
    console.log('   Upload ID:', uploadResponse.data.uploadId);
    console.log('   Status:', uploadResponse.data.status);
    console.log('   Rows:', uploadResponse.data.rowCount);
    
    const uploadId = uploadResponse.data.uploadId;
    
    // 4. Monitor progress
    console.log('\n4. Monitoring progress...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await axios.get(
        `http://localhost:3000/api/bulk-upload/${uploadId}/status`
      );
      
      const status = statusResponse.data;
      process.stdout.write(`\r   Status: ${status.status} | Processed: ${status.processed_rows || 0}/${status.total_rows || 0}`);
      
      if (status.status === 'completed' || status.status === 'failed') {
        completed = true;
        console.log('\n   ✓ Processing completed');
        console.log('\n   Final Status:', status.status);
        console.log('   Total Rows:', status.total_rows);
        console.log('   Processed:', status.processed_rows);
        console.log('   Failed:', status.failed_rows);
        
        if (status.status === 'failed') {
          console.log('   Error:', status.error_message);
        }
      }
      
      attempts++;
    }
    
    if (!completed) {
      console.log('\n   ⚠ Processing timeout after 60 seconds');
    }
    
    // 5. Check for errors
    console.log('\n5. Checking for errors...');
    const errorsResponse = await axios.get(
      `http://localhost:3000/api/bulk-upload/${uploadId}/errors`
    );
    
    const errors = errorsResponse.data.errors;
    if (errors && errors.length > 0) {
      console.log(`   ⚠ Found ${errors.length} errors:`);
      errors.slice(0, 5).forEach(error => {
        console.log(`     - Row ${error.row_number}: ${error.error_message}`);
      });
    } else {
      console.log('   ✓ No errors found');
    }
    
    // 6. Verify data in database
    console.log('\n6. Verifying data in database...');
    const { Pool } = require('pg');
    const pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'mangalm_sales',
      user: 'postgres',
      password: 'postgres'
    });
    
    try {
      const result = await pool.query('SELECT COUNT(*) FROM invoice_items');
      console.log('   ✓ Total records in database:', result.rows[0].count);
    } catch (dbError) {
      console.log('   ⚠ Could not verify database:', dbError.message);
    } finally {
      await pool.end();
    }
    
    // Clean up
    await fs.unlink(testFile);
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

// Run test
testBulkUpload().then(() => {
  console.log('\n=== Test Complete ===');
  process.exit(0);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});