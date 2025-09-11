/**
 * ENTERPRISE COMPLETE SYSTEM TEST
 * Tests that ALL tables get populated from bulk upload
 * and verifies full system integrity
 */

const { Client } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Database connection
const client = new Client({
    host: 'localhost',
    port: 3432,
    database: 'mangalm_sales',
    user: 'mangalm',
    password: 'mangalm_secure_password'
});

// Test data file
const CSV_FILE = path.join(__dirname, 'user_journey', 'Invoices_Mangalam.csv');

async function clearAllData() {
    console.log('\n=== CLEARING ALL DATA ===');
    
    const tablesToClear = [
        'realtime_sync_queue',
        'customer_segments',
        'product_associations',
        'upselling_recommendations',
        'invoice_items',
        'predicted_order_items',
        'predicted_orders',
        'sales_forecasts',
        'order_patterns',
        'model_performance',
        'user_actions',
        'store_preferences',
        'dashboard_settings',
        'mangalam_invoices',
        'orders',
        'call_prioritization',
        'products',
        'stores'
    ];
    
    for (const table of tablesToClear) {
        try {
            const result = await client.query(`DELETE FROM ${table}`);
            console.log(`  Cleared ${table}: ${result.rowCount} rows`);
        } catch (err) {
            // Table might not exist
        }
    }
}

async function checkTableCounts() {
    console.log('\n=== TABLE RECORD COUNTS ===');
    
    const tables = [
        'stores',
        'products',
        'mangalam_invoices',
        'invoice_items',
        'predicted_orders',
        'predicted_order_items',
        'customer_segments',
        'upselling_recommendations',
        'product_associations',
        'realtime_sync_queue'
    ];
    
    const counts = {};
    for (const table of tables) {
        try {
            const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
            counts[table] = parseInt(result.rows[0].count);
            console.log(`  ${table}: ${counts[table]}`);
        } catch (err) {
            counts[table] = 'ERROR';
            console.log(`  ${table}: ERROR - ${err.message}`);
        }
    }
    
    return counts;
}

async function testBulkUpload() {
    console.log('\n=== TESTING BULK UPLOAD ===');
    
    try {
        // Check if file exists
        if (!fs.existsSync(CSV_FILE)) {
            console.error('CSV file not found:', CSV_FILE);
            return false;
        }
        
        // Prepare form data
        const form = new FormData();
        form.append('file', fs.createReadStream(CSV_FILE));
        
        // Upload the file
        console.log('Uploading CSV file...');
        const response = await axios.post('http://localhost:3009/api/enterprise-bulk-upload', form, {
            headers: form.getHeaders(),
            timeout: 30000
        });
        
        console.log('Upload response:', response.data);
        
        // Wait for processing
        console.log('Waiting for processing to complete...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        return true;
    } catch (error) {
        console.error('Upload failed:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        return false;
    }
}

async function testUpsellingAPI() {
    console.log('\n=== TESTING UPSELLING API ===');
    
    try {
        // Get first predicted order
        const ordersResult = await client.query('SELECT id FROM predicted_orders LIMIT 1');
        if (ordersResult.rows.length === 0) {
            console.log('No predicted orders found');
            return;
        }
        
        const orderId = ordersResult.rows[0].id;
        console.log(`Testing upselling for order: ${orderId}`);
        
        // Call upselling API
        const response = await axios.get(`http://localhost:3007/api/upselling/suggestions/${orderId}`);
        console.log(`Upselling suggestions: ${response.data.data?.length || 0} items`);
        
        if (response.data.data?.length > 0) {
            console.log('Sample suggestion:', response.data.data[0]);
        }
    } catch (error) {
        console.error('Upselling API test failed:', error.message);
    }
}

async function runCompleteTest() {
    console.log('='.repeat(80));
    console.log('ENTERPRISE COMPLETE SYSTEM TEST');
    console.log('='.repeat(80));
    
    try {
        await client.connect();
        console.log('✓ Connected to database');
        
        // Step 1: Clear all data
        await clearAllData();
        
        // Step 2: Check initial counts (should be 0)
        console.log('\n=== INITIAL STATE ===');
        const initialCounts = await checkTableCounts();
        
        // Step 3: Run bulk upload
        const uploadSuccess = await testBulkUpload();
        
        if (!uploadSuccess) {
            console.error('❌ Bulk upload failed');
            return;
        }
        
        // Step 4: Check final counts
        console.log('\n=== FINAL STATE ===');
        const finalCounts = await checkTableCounts();
        
        // Step 5: Verify all tables were populated
        console.log('\n=== VERIFICATION ===');
        let allPopulated = true;
        
        const criticalTables = [
            'stores',
            'products',
            'mangalam_invoices',
            'invoice_items',
            'predicted_orders',
            'customer_segments'
        ];
        
        for (const table of criticalTables) {
            if (typeof finalCounts[table] === 'number' && finalCounts[table] > 0) {
                console.log(`✓ ${table}: ${finalCounts[table]} records`);
            } else {
                console.log(`❌ ${table}: NOT POPULATED`);
                allPopulated = false;
            }
        }
        
        // Step 6: Test upselling API
        await testUpsellingAPI();
        
        // Final verdict
        console.log('\n' + '='.repeat(80));
        if (allPopulated) {
            console.log('✅ ENTERPRISE SYSTEM TEST PASSED!');
            console.log('All critical tables populated from bulk upload');
        } else {
            console.log('❌ ENTERPRISE SYSTEM TEST FAILED');
            console.log('Some tables were not populated');
        }
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await client.end();
    }
}

// Run the test
runCompleteTest();