/**
 * Comprehensive test for bulk upload functionality
 * Tests the entire data flow from CSV import to data propagation
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_GATEWAY_URL = 'http://localhost:3007';
const BULK_UPLOAD_URL = 'http://localhost:3009';
const CSV_FILE_PATH = 'C:\\code\\mangalm\\user_journey\\Invoices_Mangalam.csv';

// Test results
let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

// Helper function to make HTTP requests
async function makeRequest(url, options = {}) {
    const http = require('http');
    return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// Test 1: Check services health
async function testServicesHealth() {
    console.log('\n=== Test 1: Services Health Check ===');
    
    try {
        // Check API Gateway
        const apiGatewayHealth = await makeRequest(`${API_GATEWAY_URL}/health`);
        if (apiGatewayHealth.status === 200) {
            console.log('✅ API Gateway is healthy');
            testResults.passed++;
        } else {
            console.log('❌ API Gateway health check failed');
            testResults.failed++;
        }
        
        // Check Bulk Upload Service
        const bulkUploadHealth = await makeRequest(`${BULK_UPLOAD_URL}/health`);
        if (bulkUploadHealth.status === 200) {
            console.log('✅ Bulk Upload Service is healthy');
            testResults.passed++;
        } else {
            console.log('❌ Bulk Upload Service health check failed');
            testResults.failed++;
        }
    } catch (error) {
        console.error('❌ Health check error:', error.message);
        testResults.failed += 2;
    }
}

// Test 2: Test CSV import
async function testCSVImport() {
    console.log('\n=== Test 2: CSV Import Test ===');
    
    try {
        const response = await makeRequest(`${API_GATEWAY_URL}/api/orders/import-local`, {
            method: 'POST'
        });
        
        if (response.status === 200 && response.data.success) {
            console.log(`✅ CSV import successful: ${response.data.processedCount} orders imported`);
            console.log(`   Total rows processed: ${response.data.totalRows}`);
            console.log(`   First order ID: ${response.data.orders[0].id}`);
            console.log(`   First customer: ${response.data.orders[0].customerName}`);
            testResults.passed++;
            return response.data;
        } else {
            console.log('❌ CSV import failed:', response.data);
            testResults.failed++;
            return null;
        }
    } catch (error) {
        console.error('❌ CSV import error:', error.message);
        testResults.failed++;
        return null;
    }
}

// Test 3: Verify data integrity
async function testDataIntegrity(importData) {
    console.log('\n=== Test 3: Data Integrity Check ===');
    
    if (!importData) {
        console.log('⚠️  Skipping data integrity test (no import data)');
        return;
    }
    
    try {
        // Check if orders have required fields
        const sampleOrder = importData.orders[0];
        const requiredFields = ['id', 'orderNumber', 'customerName', 'items', 'totalAmount', 'status'];
        let allFieldsPresent = true;
        
        for (const field of requiredFields) {
            if (!sampleOrder.hasOwnProperty(field)) {
                console.log(`❌ Missing required field: ${field}`);
                allFieldsPresent = false;
            }
        }
        
        if (allFieldsPresent) {
            console.log('✅ All required fields present in orders');
            testResults.passed++;
        } else {
            testResults.failed++;
        }
        
        // Check items structure
        if (sampleOrder.items && Array.isArray(sampleOrder.items) && sampleOrder.items.length > 0) {
            const sampleItem = sampleOrder.items[0];
            const itemFields = ['productName', 'quantity', 'unitPrice', 'totalPrice'];
            let allItemFieldsPresent = true;
            
            for (const field of itemFields) {
                if (!sampleItem.hasOwnProperty(field)) {
                    console.log(`❌ Missing item field: ${field}`);
                    allItemFieldsPresent = false;
                }
            }
            
            if (allItemFieldsPresent) {
                console.log('✅ Item structure is valid');
                testResults.passed++;
            } else {
                testResults.failed++;
            }
        }
        
        // Verify calculations
        const calculatedTotal = sampleOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
        const subtotal = sampleOrder.subtotalAmount;
        
        if (Math.abs(calculatedTotal - subtotal) < 0.01) {
            console.log('✅ Order calculations are correct');
            testResults.passed++;
        } else {
            console.log(`❌ Order calculation mismatch: calculated ${calculatedTotal}, expected ${subtotal}`);
            testResults.failed++;
        }
        
    } catch (error) {
        console.error('❌ Data integrity check error:', error.message);
        testResults.failed++;
    }
}

// Test 4: Test authentication
async function testAuthentication() {
    console.log('\n=== Test 4: Authentication Test ===');
    
    try {
        const response = await makeRequest(`${API_GATEWAY_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });
        
        if (response.status === 200 && response.data.token) {
            console.log('✅ Authentication successful');
            console.log(`   User: ${response.data.user.username}`);
            console.log(`   Role: ${response.data.user.role}`);
            testResults.passed++;
            return response.data.token;
        } else {
            console.log('❌ Authentication failed');
            testResults.failed++;
            return null;
        }
    } catch (error) {
        console.error('❌ Authentication error:', error.message);
        testResults.failed++;
        return null;
    }
}

// Test 5: Performance test
async function testPerformance() {
    console.log('\n=== Test 5: Performance Test ===');
    
    try {
        const startTime = Date.now();
        const response = await makeRequest(`${API_GATEWAY_URL}/api/orders/import-local`, {
            method: 'POST'
        });
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`   Import duration: ${duration}ms`);
        
        if (response.data && response.data.processedCount) {
            const rowsPerSecond = (response.data.totalRows / (duration / 1000)).toFixed(2);
            console.log(`   Processing speed: ${rowsPerSecond} rows/second`);
            
            if (duration < 30000) { // Should complete within 30 seconds
                console.log('✅ Performance is acceptable');
                testResults.passed++;
            } else {
                console.log('❌ Performance is too slow');
                testResults.failed++;
            }
        }
    } catch (error) {
        console.error('❌ Performance test error:', error.message);
        testResults.failed++;
    }
}

// Main test runner
async function runTests() {
    console.log('========================================');
    console.log('   BULK UPLOAD COMPREHENSIVE TEST');
    console.log('========================================');
    console.log(`CSV File: ${CSV_FILE_PATH}`);
    console.log(`API Gateway: ${API_GATEWAY_URL}`);
    console.log(`Bulk Upload: ${BULK_UPLOAD_URL}`);
    
    // Run tests
    await testServicesHealth();
    const importData = await testCSVImport();
    await testDataIntegrity(importData);
    const token = await testAuthentication();
    await testPerformance();
    
    // Print summary
    console.log('\n========================================');
    console.log('           TEST SUMMARY');
    console.log('========================================');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total: ${testResults.passed + testResults.failed}`);
    console.log(`🎯 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2)}%`);
    console.log('========================================');
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(console.error);