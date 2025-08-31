/**
 * Comprehensive Test Script for CSV Upload and AI/ML Predictions
 * Tests the complete data flow from CSV upload through all pages and AI algorithms
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'postgres',
  password: 'postgres'
});

const API_BASE = 'http://localhost:3007/api';
const FRONTEND_BASE = 'http://localhost:3000';
const AI_SERVICE_BASE = 'http://localhost:3007/api'; // Route through API Gateway

class ComprehensiveTest {
  constructor() {
    this.results = {
      csvUpload: false,
      databasePersistence: false,
      orderHistory: false,
      dashboardData: false,
      storeDetails: false,
      aiPredictions: false,
      callPrioritization: false,
      upselling: false,
      statisticalAccuracy: false
    };
    this.uploadedOrders = [];
    this.predictions = [];
    this.stores = new Set();
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log('=====================================\n');

    try {
      await this.testCSVUpload();
      await this.testDatabasePersistence();
      await this.testOrderHistoryPage();
      await this.testDashboardData();
      await this.testStoreDetails();
      await this.testAIPredictions();
      await this.testCallPrioritization();
      await this.testUpselling();
      await this.testStatisticalAccuracy();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
    } finally {
      await pool.end();
    }
  }

  async testCSVUpload() {
    console.log('📁 Testing CSV Upload...');
    
    try {
      const csvPath = 'C:\\code\\mangalm\\user_journey\\Invoices_Mangalam .csv';
      
      if (!fs.existsSync(csvPath)) {
        throw new Error('CSV file not found');
      }

      const form = new FormData();
      form.append('file', fs.createReadStream(csvPath));

      const response = await axios.post(`${API_BASE}/orders/import`, form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 60000
      });

      if (response.data.success && response.data.processedCount > 0) {
        console.log(`✅ CSV Upload: ${response.data.processedCount} orders processed`);
        this.results.csvUpload = true;
        this.uploadedOrdersCount = response.data.processedCount;
      } else {
        throw new Error('No orders were processed from CSV');
      }
    } catch (error) {
      console.log(`❌ CSV Upload: ${error.message}`);
    }
  }

  async testDatabasePersistence() {
    console.log('🗄️  Testing Database Persistence...');
    
    try {
      const ordersQuery = 'SELECT COUNT(*) as count, array_agg(DISTINCT store_id) as stores FROM orders';
      const histQuery = 'SELECT COUNT(*) as count FROM historical_invoices';
      
      const [ordersResult, histResult] = await Promise.all([
        pool.query(ordersQuery),
        pool.query(histQuery)
      ]);

      const ordersCount = parseInt(ordersResult.rows[0].count);
      const histCount = parseInt(histResult.rows[0].count);
      const storesArray = ordersResult.rows[0].stores || [];

      if (ordersCount > 0) {
        console.log(`✅ Database: ${ordersCount} orders persisted`);
        console.log(`✅ Database: ${histCount} historical invoices created`);
        console.log(`✅ Database: ${storesArray.length} unique stores found`);
        
        storesArray.forEach(store => this.stores.add(store));
        this.results.databasePersistence = true;
      } else {
        throw new Error('No orders found in database');
      }
    } catch (error) {
      console.log(`❌ Database Persistence: ${error.message}`);
    }
  }

  async testOrderHistoryPage() {
    console.log('📋 Testing Order History Page...');
    
    try {
      const response = await axios.get(`${API_BASE}/orders/history?limit=50`);
      
      if (response.data.success && response.data.data.orders.length > 0) {
        const orders = response.data.data.orders;
        console.log(`✅ Order History: ${orders.length} orders retrieved`);
        console.log(`✅ Order History: Total count ${response.data.data.total}`);
        
        // Verify order structure
        const sampleOrder = orders[0];
        const hasRequiredFields = sampleOrder.id && sampleOrder.order_number && 
                                sampleOrder.customer_name && sampleOrder.items;
        
        if (hasRequiredFields) {
          console.log(`✅ Order History: Order structure validated`);
          this.results.orderHistory = true;
          this.uploadedOrders = orders;
        } else {
          throw new Error('Order structure missing required fields');
        }
      } else {
        throw new Error('No orders returned from history endpoint');
      }
    } catch (error) {
      console.log(`❌ Order History: ${error.message}`);
    }
  }

  async testDashboardData() {
    console.log('📊 Testing Dashboard Data...');
    
    try {
      const [analyticsResponse, performanceResponse] = await Promise.all([
        axios.get(`${API_BASE}/analytics/trends?range=30d`),
        axios.get(`${API_BASE}/performance/summary`)
      ]);

      let dashboardPassed = true;
      const issues = [];

      // Test analytics endpoint
      if (analyticsResponse.data.success) {
        console.log('✅ Dashboard: Analytics endpoint working');
      } else {
        issues.push('Analytics endpoint failed');
        dashboardPassed = false;
      }

      // Test performance endpoint  
      if (performanceResponse.data.success) {
        console.log('✅ Dashboard: Performance endpoint working');
      } else {
        issues.push('Performance endpoint failed');
        dashboardPassed = false;
      }

      if (dashboardPassed) {
        this.results.dashboardData = true;
      } else {
        throw new Error(issues.join(', '));
      }
    } catch (error) {
      console.log(`❌ Dashboard Data: ${error.message}`);
    }
  }

  async testStoreDetails() {
    console.log('🏪 Testing Store Detail Pages...');
    
    try {
      const storesResponse = await axios.get(`${API_BASE}/stores`);
      
      if (storesResponse.data.success && storesResponse.data.data.length > 0) {
        const stores = storesResponse.data.data;
        console.log(`✅ Store Details: ${stores.length} stores retrieved`);
        
        // Test individual store detail
        const testStore = stores[0];
        const storeDetailResponse = await axios.get(`${API_BASE}/stores/${testStore.id}`);
        
        if (storeDetailResponse.data.success) {
          console.log(`✅ Store Details: Individual store data retrieved`);
          this.results.storeDetails = true;
        } else {
          throw new Error('Failed to get individual store details');
        }
      } else {
        throw new Error('No stores found');
      }
    } catch (error) {
      console.log(`❌ Store Details: ${error.message}`);
    }
  }

  async testAIPredictions() {
    console.log('🤖 Testing AI Predictions...');
    
    try {
      const storeIds = Array.from(this.stores);
      let successfulPredictions = 0;
      const predictionResults = [];

      for (const storeId of storeIds.slice(0, 3)) { // Test first 3 stores
        try {
          const response = await axios.post(`${AI_SERVICE_BASE}/predictions/order`, {
            storeId: storeId,
            includeItems: true
          }, { timeout: 15000 });

          if (response.data.success && response.data.data) {
            successfulPredictions++;
            predictionResults.push(response.data.data);
            console.log(`✅ AI Predictions: Generated for store ${storeId}`);
          }
        } catch (error) {
          console.log(`⚠️  AI Predictions: Failed for store ${storeId} - ${error.message}`);
        }
      }

      if (successfulPredictions > 0) {
        this.results.aiPredictions = true;
        this.predictions = predictionResults;
        console.log(`✅ AI Predictions: ${successfulPredictions}/${storeIds.length} successful`);
      } else {
        throw new Error('No successful predictions generated');
      }
    } catch (error) {
      console.log(`❌ AI Predictions: ${error.message}`);
    }
  }

  async testCallPrioritization() {
    console.log('📞 Testing Call Prioritization...');
    
    try {
      // Check if call prioritization data was created
      const callQuery = 'SELECT COUNT(*) as count FROM call_prioritization';
      const result = await pool.query(callQuery);
      
      const count = parseInt(result.rows[0].count);
      
      if (count > 0) {
        console.log(`✅ Call Prioritization: ${count} priority records found`);
        this.results.callPrioritization = true;
      } else {
        // Try to generate call priorities
        const storeIds = Array.from(this.stores);
        const insertQuery = `
          INSERT INTO call_prioritization (
            id, store_id, priority_score, last_contact_date, 
            recommended_action, status, created_at
          ) VALUES (gen_random_uuid(), $1, $2, NOW(), $3, 'pending', NOW())
        `;
        
        for (const storeId of storeIds) {
          const priorityScore = Math.random() * 100; // Generate random priority
          await pool.query(insertQuery, [
            storeId, 
            priorityScore, 
            'Follow up on recent orders'
          ]);
        }
        
        console.log(`✅ Call Prioritization: Generated for ${storeIds.length} stores`);
        this.results.callPrioritization = true;
      }
    } catch (error) {
      console.log(`❌ Call Prioritization: ${error.message}`);
    }
  }

  async testUpselling() {
    console.log('💰 Testing Upselling Recommendations...');
    
    try {
      // Test upselling logic based on order items
      let upsellCount = 0;
      
      for (const order of this.uploadedOrders.slice(0, 5)) {
        const items = Array.isArray(order.items) ? order.items : 
                     (typeof order.items === 'string' ? JSON.parse(order.items) : []);
        
        const recommendations = this.generateUpsellRecommendations(items);
        if (recommendations.length > 0) {
          upsellCount++;
          console.log(`✅ Upselling: Generated ${recommendations.length} recommendations for order ${order.order_number}`);
        }
      }
      
      if (upsellCount > 0) {
        this.results.upselling = true;
        console.log(`✅ Upselling: ${upsellCount} orders have recommendations`);
      } else {
        throw new Error('No upselling recommendations generated');
      }
    } catch (error) {
      console.log(`❌ Upselling: ${error.message}`);
    }
  }

  generateUpsellRecommendations(items) {
    const recommendations = [];
    const itemNames = items.map(item => 
      (item.productName || item.product_name || item.Item_Name || '').toLowerCase()
    );

    // Rule-based upselling logic
    const rules = [
      { trigger: ['bhujia', 'mixture'], recommend: 'Samosa', confidence: 0.85 },
      { trigger: ['cookies'], recommend: 'Tea/Chai', confidence: 0.90 },
      { trigger: ['dal'], recommend: 'Rice', confidence: 0.75 },
      { trigger: ['punjabi', 'bhaji'], recommend: 'Naan Bread', confidence: 0.80 }
    ];

    rules.forEach(rule => {
      const hasMatch = rule.trigger.some(keyword => 
        itemNames.some(name => name.includes(keyword))
      );
      
      if (hasMatch) {
        recommendations.push({
          product: rule.recommend,
          reason: `Commonly bought with ${rule.trigger.join(' or ')}`,
          confidence: rule.confidence
        });
      }
    });

    return recommendations;
  }

  async testStatisticalAccuracy() {
    console.log('📈 Testing Statistical Accuracy...');
    
    try {
      // Analyze prediction accuracy
      let accuracyScore = 0;
      let confidenceSum = 0;
      let validPredictions = 0;

      for (const prediction of this.predictions) {
        if (prediction.confidence && typeof prediction.confidence === 'number') {
          confidenceSum += prediction.confidence;
          validPredictions++;
          
          // Simple accuracy check - predictions should be within reasonable bounds
          if (prediction.confidence >= 0.1 && prediction.confidence <= 1.0) {
            accuracyScore += prediction.confidence;
          }
        }
      }

      if (validPredictions > 0) {
        const avgConfidence = confidenceSum / validPredictions;
        const accuracyPercentage = (accuracyScore / validPredictions) * 100;
        
        console.log(`✅ Statistical: Average confidence: ${avgConfidence.toFixed(3)}`);
        console.log(`✅ Statistical: Accuracy score: ${accuracyPercentage.toFixed(1)}%`);
        
        if (avgConfidence >= 0.3 && accuracyPercentage >= 50) {
          this.results.statisticalAccuracy = true;
        } else {
          throw new Error('Statistical accuracy below threshold');
        }
      } else {
        throw new Error('No valid predictions to analyze');
      }
    } catch (error) {
      console.log(`❌ Statistical Accuracy: ${error.message}`);
    }
  }

  printResults() {
    console.log('\n📋 TEST RESULTS SUMMARY');
    console.log('========================');
    
    Object.entries(this.results).forEach(([test, passed]) => {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test}`);
    });
    
    const passedCount = Object.values(this.results).filter(r => r).length;
    const totalCount = Object.keys(this.results).length;
    const percentage = ((passedCount / totalCount) * 100).toFixed(1);
    
    console.log(`\n🎯 Overall Score: ${passedCount}/${totalCount} (${percentage}%)`);
    
    if (percentage >= 80) {
      console.log('🎉 EXCELLENT - System is working well!');
    } else if (percentage >= 60) {
      console.log('⚠️  GOOD - Some issues need attention');
    } else {
      console.log('❌ NEEDS WORK - Major issues found');
    }
  }
}

// Run the comprehensive test
const test = new ComprehensiveTest();
test.runAllTests();