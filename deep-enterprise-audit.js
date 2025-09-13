const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'mangalm',
  password: 'mangalm_secure_password'
});

const API_BASE = 'http://localhost:3007';

const auditResults = {
  critical_issues: [],
  empty_tables: [],
  mock_data_found: [],
  missing_relationships: [],
  api_failures: [],
  data_misalignments: [],
  fake_implementations: [],
  missing_features: []
};

async function deepEnterpriseAudit() {
  console.log('🔍 DEEP ENTERPRISE AUDIT - FINDING ALL ISSUES\n');
  console.log('=' .repeat(80));
  
  // PHASE 1: Complete Database Audit
  console.log('\n📊 PHASE 1: DATABASE AUDIT - ALL TABLES\n');
  console.log('-'.repeat(80));
  
  try {
    // Get all tables
    const tablesQuery = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;
    const tablesResult = await pool.query(tablesQuery);
    const tables = tablesResult.rows.map(r => r.tablename);
    
    console.log(`Found ${tables.length} tables to audit:\n`);
    
    for (const table of tables) {
      // Get count and sample data
      const countQuery = `SELECT COUNT(*) as count FROM ${table}`;
      const countResult = await pool.query(countQuery);
      const count = parseInt(countResult.rows[0].count);
      
      console.log(`📋 ${table}: ${count} records`);
      
      if (count === 0) {
        auditResults.empty_tables.push(table);
        console.log(`   ❌ EMPTY TABLE - No data!`);
        
        // Check what this table should contain
        if (table.includes('predicted') || table.includes('forecast')) {
          auditResults.critical_issues.push(`AI/ML table '${table}' is empty - predictions not working`);
        }
        if (table.includes('upselling') || table.includes('recommendation')) {
          auditResults.critical_issues.push(`Revenue optimization table '${table}' is empty`);
        }
      } else {
        // Check for mock/test data
        try {
          const sampleQuery = `SELECT * FROM ${table} LIMIT 3`;
          const sampleResult = await pool.query(sampleQuery);
          
          // Look for signs of mock data
          const mockIndicators = ['test', 'mock', 'fake', 'dummy', 'example', 'todo', 'xxx', 'placeholder'];
          for (const row of sampleResult.rows) {
            const rowStr = JSON.stringify(row).toLowerCase();
            for (const indicator of mockIndicators) {
              if (rowStr.includes(indicator)) {
                console.log(`   ⚠️ Possible mock data detected (contains '${indicator}')`);
                auditResults.mock_data_found.push({table, indicator, sample: row});
                break;
              }
            }
          }
          
          // Special checks for specific tables
          if (table === 'stores' || table === 'products') {
            // Check if IDs are realistic
            if (sampleResult.rows[0].id && sampleResult.rows[0].id.length < 10) {
              console.log(`   ⚠️ Suspicious ID format (too short for enterprise)`);
            }
          }
          
          if (table === 'orders') {
            // Check order integrity
            const integrityQuery = `
              SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT store_id) as unique_stores,
                COUNT(DISTINCT customer_name) as unique_customers,
                AVG(total_amount) as avg_amount,
                COUNT(CASE WHEN total_amount = 0 THEN 1 END) as zero_amount,
                COUNT(CASE WHEN items IS NULL OR items = '[]' THEN 1 END) as no_items
              FROM orders
            `;
            const integrityResult = await pool.query(integrityQuery);
            const integrity = integrityResult.rows[0];
            
            if (integrity.zero_amount > 0) {
              console.log(`   ❌ ${integrity.zero_amount} orders with $0 amount!`);
              auditResults.critical_issues.push(`${integrity.zero_amount} orders have no monetary value`);
            }
            if (integrity.no_items > 0) {
              console.log(`   ❌ ${integrity.no_items} orders with no items!`);
              auditResults.critical_issues.push(`${integrity.no_items} orders have no items`);
            }
          }
        } catch (e) {
          // Ignore sample query errors
        }
      }
    }
  } catch (error) {
    console.error('Database audit failed:', error.message);
    auditResults.critical_issues.push('Cannot complete database audit');
  }
  
  // PHASE 2: Foreign Key and Relationship Checks
  console.log('\n🔗 PHASE 2: RELATIONSHIP AND FOREIGN KEY AUDIT\n');
  console.log('-'.repeat(80));
  
  try {
    // Check orders -> stores relationship
    const orphanOrdersQuery = `
      SELECT COUNT(*) as orphan_count 
      FROM orders o
      WHERE NOT EXISTS (
        SELECT 1 FROM stores s WHERE s.id::text = o.store_id
      )
    `;
    const orphanOrders = await pool.query(orphanOrdersQuery);
    if (orphanOrders.rows[0].orphan_count > 0) {
      console.log(`❌ ${orphanOrders.rows[0].orphan_count} orders reference non-existent stores!`);
      auditResults.missing_relationships.push(`${orphanOrders.rows[0].orphan_count} orphan orders`);
    }
    
    // Check invoice_items -> products relationship
    const orphanItemsQuery = `
      SELECT COUNT(*) as orphan_count
      FROM invoice_items ii
      WHERE ii.product_id IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM products p WHERE p.id::text = ii.product_id::text
        )
    `;
    const orphanItems = await pool.query(orphanItemsQuery);
    if (orphanItems.rows[0].orphan_count > 0) {
      console.log(`❌ ${orphanItems.rows[0].orphan_count} invoice items reference non-existent products!`);
      auditResults.missing_relationships.push(`${orphanItems.rows[0].orphan_count} orphan invoice items`);
    }
    
    console.log('✅ Relationship audit complete');
  } catch (error) {
    console.error('Relationship audit failed:', error.message);
  }
  
  // PHASE 3: API Endpoint Deep Testing
  console.log('\n🌐 PHASE 3: API ENDPOINT DEEP TESTING\n');
  console.log('-'.repeat(80));
  
  const endpoints = [
    // Core business endpoints
    { path: '/api/orders', critical: true },
    { path: '/api/orders/generate', method: 'POST', critical: true },
    { path: '/api/orders/analytics', critical: true },
    { path: '/api/stores', critical: true },
    { path: '/api/products', critical: true },
    
    // AI/ML endpoints
    { path: '/api/predictions/sales', critical: false },
    { path: '/api/predictions/forecast', critical: false },
    
    // Revenue optimization
    { path: '/api/upselling/suggestions', critical: false },
    { path: '/api/upselling/recommendations', critical: false },
    
    // Performance tracking
    { path: '/api/sales-agent-performance/daily', critical: false },
    { path: '/api/performance/metrics', critical: false },
    
    // User tracking
    { path: '/api/user-actions', critical: false },
    { path: '/api/dashboard/settings', critical: false },
    
    // Analytics
    { path: '/api/analytics/trends', critical: true },
    { path: '/api/analytics/insights', critical: false }
  ];
  
  console.log('Testing endpoints (avoiding rate limit)...\n');
  
  for (const endpoint of endpoints) {
    await new Promise(resolve => setTimeout(resolve, 650)); // Avoid rate limit
    
    try {
      const response = await axios({
        method: endpoint.method || 'GET',
        url: `${API_BASE}${endpoint.path}`,
        data: endpoint.method === 'POST' ? { storeId: '4261931000000665698' } : undefined,
        validateStatus: () => true,
        timeout: 3000
      });
      
      console.log(`${endpoint.critical ? '🔴' : '🟡'} ${endpoint.path}: ${response.status}`);
      
      if (response.status === 404) {
        console.log(`   ❌ NOT IMPLEMENTED`);
        if (endpoint.critical) {
          auditResults.critical_issues.push(`Critical endpoint ${endpoint.path} not implemented`);
        } else {
          auditResults.missing_features.push(`${endpoint.path} not implemented`);
        }
      } else if (response.status >= 500) {
        console.log(`   ❌ SERVER ERROR`);
        auditResults.api_failures.push(`${endpoint.path} returns ${response.status}`);
      } else if (response.status === 200) {
        // Check if it's returning real data or mock
        if (response.data) {
          const dataStr = JSON.stringify(response.data).toLowerCase();
          if (dataStr.includes('mock') || dataStr.includes('todo') || dataStr.includes('not implemented')) {
            console.log(`   ⚠️ Returns mock/placeholder data`);
            auditResults.fake_implementations.push(`${endpoint.path} returns fake data`);
          }
          
          // Check if arrays are empty
          if (response.data.data && Array.isArray(response.data.data) && response.data.data.length === 0) {
            console.log(`   ⚠️ Returns empty array`);
          }
        }
      }
    } catch (error) {
      console.log(`${endpoint.critical ? '🔴' : '🟡'} ${endpoint.path}: ERROR - ${error.message}`);
      auditResults.api_failures.push(`${endpoint.path} throws error`);
    }
  }
  
  // PHASE 4: Service Files Inspection
  console.log('\n📁 PHASE 4: CODE INSPECTION FOR MOCK IMPLEMENTATIONS\n');
  console.log('-'.repeat(80));
  
  const servicePaths = [
    'services/api-gateway/src',
    'services/ai-prediction-service/src',
    'services/bulk-upload-api/src',
    'services/sales-frontend/src'
  ];
  
  for (const servicePath of servicePaths) {
    console.log(`\nInspecting ${servicePath}...`);
    
    try {
      // Use grep to find mock implementations
      const { execSync } = require('child_process');
      
      // Search for TODO, FIXME, mock, fake, placeholder
      const patterns = ['TODO', 'FIXME', 'mock', 'fake', 'placeholder', 'hardcoded', 'temporary'];
      
      for (const pattern of patterns) {
        try {
          const command = `findstr /S /I "${pattern}" ${servicePath}\\*.ts ${servicePath}\\*.js 2>nul | find /C ":"`;
          const result = execSync(command, { encoding: 'utf8' }).trim();
          const count = parseInt(result) || 0;
          
          if (count > 0) {
            console.log(`   ⚠️ Found ${count} instances of "${pattern}" in code`);
            auditResults.fake_implementations.push(`${count} "${pattern}" markers in ${servicePath}`);
          }
        } catch (e) {
          // Command failed, likely no matches
        }
      }
    } catch (error) {
      console.log(`   Could not inspect ${servicePath}`);
    }
  }
  
  // PHASE 5: Data Flow Testing
  console.log('\n🔄 PHASE 5: END-TO-END DATA FLOW TESTING\n');
  console.log('-'.repeat(80));
  
  // Test: Can we track data from invoice -> order -> analytics?
  try {
    console.log('Testing data flow: Invoice -> Order -> Analytics...');
    
    // Pick a random invoice
    const invoiceQuery = 'SELECT * FROM mangalam_invoices LIMIT 1';
    const invoice = (await pool.query(invoiceQuery)).rows[0];
    
    if (invoice) {
      // Check if it became an order
      const orderQuery = `
        SELECT * FROM orders 
        WHERE order_number = $1 OR order_number = $2
        LIMIT 1
      `;
      const order = (await pool.query(orderQuery, [invoice.invoice_number, invoice.invoice_id])).rows[0];
      
      if (order) {
        console.log(`   ✅ Invoice ${invoice.invoice_id} -> Order ${order.id}`);
        
        // Check if order appears in analytics
        // This would require checking analytics tables
      } else {
        console.log(`   ❌ Invoice ${invoice.invoice_id} has no corresponding order`);
        auditResults.data_misalignments.push('Some invoices not converted to orders');
      }
    }
  } catch (error) {
    console.log('   ❌ Data flow test failed:', error.message);
  }
  
  // PHASE 6: Business Logic Validation
  console.log('\n💼 PHASE 6: BUSINESS LOGIC VALIDATION\n');
  console.log('-'.repeat(80));
  
  try {
    // Check if we have predictions
    const predictionsCount = await pool.query('SELECT COUNT(*) as count FROM predicted_orders');
    if (predictionsCount.rows[0].count === 0) {
      console.log('❌ No sales predictions - AI not working');
      auditResults.critical_issues.push('AI prediction system not generating predictions');
    }
    
    // Check if we have forecasts
    const forecastsCount = await pool.query('SELECT COUNT(*) as count FROM sales_forecasts');
    if (forecastsCount.rows[0].count === 0) {
      console.log('❌ No sales forecasts - Forecasting not working');
      auditResults.critical_issues.push('Forecasting system not generating forecasts');
    }
    
    // Check if we have upselling recommendations
    const upsellCount = await pool.query('SELECT COUNT(*) as count FROM upselling_recommendations');
    if (upsellCount.rows[0].count === 0) {
      console.log('❌ No upselling recommendations - Revenue optimization not working');
      auditResults.critical_issues.push('Upselling system not generating recommendations');
    }
    
    // Check call prioritization
    const callPriorityCount = await pool.query('SELECT COUNT(*) as count FROM call_prioritization');
    if (callPriorityCount.rows[0].count === 0) {
      console.log('❌ No call prioritization data - Sales optimization not working');
      auditResults.critical_issues.push('Call prioritization system not working');
    }
  } catch (error) {
    console.log('Business logic validation failed:', error.message);
  }
  
  await pool.end();
  
  // FINAL REPORT
  console.log('\n' + '='.repeat(80));
  console.log('🔥 DEEP AUDIT RESULTS - THE COMPLETE TRUTH\n');
  
  console.log('🚨 CRITICAL ISSUES (Must Fix):');
  if (auditResults.critical_issues.length === 0) {
    console.log('   None found');
  } else {
    auditResults.critical_issues.forEach(issue => console.log(`   • ${issue}`));
  }
  
  console.log('\n📭 EMPTY TABLES (No Data):');
  if (auditResults.empty_tables.length === 0) {
    console.log('   All tables have data');
  } else {
    auditResults.empty_tables.forEach(table => console.log(`   • ${table}`));
  }
  
  console.log('\n🎭 MOCK/FAKE DATA DETECTED:');
  if (auditResults.mock_data_found.length === 0 && auditResults.fake_implementations.length === 0) {
    console.log('   No mock data found');
  } else {
    auditResults.mock_data_found.forEach(m => console.log(`   • ${m.table}: contains '${m.indicator}'`));
    auditResults.fake_implementations.forEach(f => console.log(`   • ${f}`));
  }
  
  console.log('\n🔗 MISSING RELATIONSHIPS:');
  if (auditResults.missing_relationships.length === 0) {
    console.log('   All relationships intact');
  } else {
    auditResults.missing_relationships.forEach(r => console.log(`   • ${r}`));
  }
  
  console.log('\n❌ API FAILURES:');
  if (auditResults.api_failures.length === 0) {
    console.log('   All APIs working');
  } else {
    auditResults.api_failures.forEach(f => console.log(`   • ${f}`));
  }
  
  console.log('\n🚫 MISSING FEATURES:');
  if (auditResults.missing_features.length === 0) {
    console.log('   All features implemented');
  } else {
    auditResults.missing_features.forEach(f => console.log(`   • ${f}`));
  }
  
  // Calculate enterprise readiness score
  const totalIssues = 
    auditResults.critical_issues.length * 10 +
    auditResults.empty_tables.length * 5 +
    auditResults.mock_data_found.length * 3 +
    auditResults.fake_implementations.length * 3 +
    auditResults.missing_relationships.length * 5 +
    auditResults.api_failures.length * 5 +
    auditResults.missing_features.length * 2;
  
  const maxScore = 100;
  const score = Math.max(0, maxScore - totalIssues);
  
  console.log('\n' + '='.repeat(80));
  console.log(`📊 ENTERPRISE READINESS SCORE: ${score}/100`);
  
  if (score >= 90) {
    console.log('✅ VERDICT: Enterprise-ready');
  } else if (score >= 70) {
    console.log('⚠️ VERDICT: Needs work but functional');
  } else if (score >= 50) {
    console.log('❌ VERDICT: Major issues, not enterprise-ready');
  } else {
    console.log('💀 VERDICT: System is mostly broken or mock');
  }
  
  console.log('\n🎯 TOP PRIORITIES TO FIX:');
  console.log('1. Populate all empty critical tables');
  console.log('2. Implement AI/ML predictions');
  console.log('3. Fix all broken API endpoints');
  console.log('4. Replace mock implementations with real code');
  console.log('5. Establish proper data relationships');
}

deepEnterpriseAudit().catch(console.error);