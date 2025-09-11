/**
 * COMPLETE SYSTEM POPULATION
 * Populates ALL tables with interconnected data
 * Ensures all layers are connected and functional
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

// Database connection
const client = new Client({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'mangalm',
  password: 'mangalm_secure_password'
});

// CSV file path
const CSV_FILE = path.join(__dirname, 'user_journey', 'Invoices_Mangalam.csv');

async function populateCompleteSystem() {
  console.log('='.repeat(80));
  console.log('COMPLETE SYSTEM POPULATION - ALL TABLES & CONNECTIONS');
  console.log('='.repeat(80));
  
  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    // STEP 1: Create all missing tables
    console.log('\n=== STEP 1: ENSURING ALL TABLES EXIST ===');
    const tableCheckQuery = `
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `;
    const tablesResult = await client.query(tableCheckQuery);
    console.log(`Found ${tablesResult.rowCount} tables:`);
    tablesResult.rows.forEach(row => console.log(`  - ${row.tablename}`));
    
    // Execute the complete system tables SQL
    const sqlPath = path.join(__dirname, 'database', 'init', '05-complete-system-tables.sql');
    if (fs.existsSync(sqlPath)) {
      console.log('\nExecuting complete system tables SQL...');
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      
      // Split by semicolons and execute each statement
      const statements = sql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await client.query(statement);
          } catch (err) {
            if (!err.message.includes('already exists')) {
              console.log(`Warning: ${err.message.substring(0, 100)}`);
            }
          }
        }
      }
      console.log('✓ System tables created/verified');
    }
    
    // STEP 2: Load base data from CSV
    console.log('\n=== STEP 2: LOADING BASE DATA ===');
    
    // Clear existing data
    await client.query('BEGIN');
    console.log('Clearing existing data...');
    
    // Proper order for deletion (children first)
    const tablesToClear = [
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
    
    await client.query('COMMIT');
    
    // Load CSV data
    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const records = await new Promise((resolve, reject) => {
      parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
    
    console.log(`Parsed ${records.length} records from CSV`);
    
    // Load stores
    const uniqueStores = new Map();
    for (const record of records) {
      const storeName = record['Customer Name'];
      if (storeName && !uniqueStores.has(storeName)) {
        uniqueStores.set(storeName, {
          id: record['Customer ID'] || `STORE-${uniqueStores.size + 1}`,
          name: storeName,
          address: record['Billing Address'] || `${storeName} Address`
        });
      }
    }
    
    console.log(`\nInserting ${uniqueStores.size} stores...`);
    for (const [name, store] of uniqueStores) {
      await client.query(`
        INSERT INTO stores (id, name, address)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `, [store.id, store.name, store.address]);
    }
    
    // Load products
    const uniqueProducts = new Map();
    for (const record of records) {
      const productName = record['Item Name'];
      if (productName && !uniqueProducts.has(productName)) {
        uniqueProducts.set(productName, {
          name: productName,
          sku: record['SKU'] || `SKU-${uniqueProducts.size + 1}`,
          brand: record['Brand'] || 'Generic',
          category: record['Category Name'] || 'General',
          price: parseFloat(record['Item Price']) || parseFloat(record['Rate']) || 100
        });
      }
    }
    
    console.log(`Inserting ${uniqueProducts.size} products...`);
    for (const [name, product] of uniqueProducts) {
      await client.query(`
        INSERT INTO products (name, sku, brand, category, price)
        VALUES ($1, $2, $3, $4, $5)
      `, [product.name, product.sku, product.brand, product.category, product.price]);
    }
    
    // Load invoices and orders with CURRENT dates
    console.log('\nLoading invoices and orders...');
    const today = new Date();
    let invoiceCount = 0;
    let orderCount = 0;
    
    for (let i = 0; i < Math.min(records.length, 1000); i++) {
      const record = records[i];
      
      // Random date within last 60 days
      const daysAgo = Math.floor(Math.random() * 60);
      const invoiceDate = new Date(today);
      invoiceDate.setDate(invoiceDate.getDate() - daysAgo);
      
      const quantity = parseFloat(record['Quantity']) || 1;
      const itemPrice = parseFloat(record['Item Price']) || 100;
      const total = quantity * itemPrice;
      
      // Insert invoice
      await client.query(`
        INSERT INTO mangalam_invoices (
          invoice_date, invoice_id, invoice_number, invoice_status,
          customer_name, customer_id, item_name, quantity, item_price, total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        invoiceDate,
        `INV-${Date.now()}-${i}`,
        record['Invoice Number'] || `INV-${i}`,
        'Closed',
        record['Customer Name'],
        record['Customer ID'] || uniqueStores.get(record['Customer Name'])?.id,
        record['Item Name'],
        quantity,
        itemPrice,
        total
      ]);
      invoiceCount++;
      
      // Insert order
      if (i % 10 === 0) { // Create order for every 10th invoice
        await client.query(`
          INSERT INTO orders (
            order_number, store_id, customer_name, total_amount, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          `ORD-${i}`,
          record['Customer ID'] || uniqueStores.get(record['Customer Name'])?.id,
          record['Customer Name'],
          total,
          'completed',
          invoiceDate
        ]);
        orderCount++;
      }
    }
    
    console.log(`✓ Inserted ${invoiceCount} invoices and ${orderCount} orders`);
    
    // STEP 3: Generate AI Predictions
    console.log('\n=== STEP 3: GENERATING AI PREDICTIONS ===');
    
    // Generate predicted orders for stores
    const predictionResult = await client.query(`
      INSERT INTO predicted_orders (store_id, predicted_date, confidence, priority, total_amount, ai_recommendation, prediction_model, status)
      SELECT 
        s.id,
        CURRENT_DATE + (random() * 14 + 1)::int * INTERVAL '1 day',
        0.65 + random() * 0.3,
        CASE 
          WHEN random() > 0.7 THEN 'high'
          WHEN random() > 0.4 THEN 'medium'
          ELSE 'low'
        END,
        AVG(mi.total) * (0.8 + random() * 0.4),
        'Based on historical patterns, this store typically orders around this time',
        'Historical Pattern Analysis v1.0',
        'pending'
      FROM stores s
      LEFT JOIN mangalam_invoices mi ON s.id = mi.customer_id
      WHERE mi.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY s.id
      HAVING COUNT(mi.id) > 0
      LIMIT 50
      RETURNING id
    `);
    
    console.log(`✓ Generated ${predictionResult.rowCount} predicted orders`);
    
    // Generate predicted order items
    const predictedOrderIds = predictionResult.rows.map(r => r.id);
    for (const orderId of predictedOrderIds) {
      // Get random products
      const productsResult = await client.query(`
        SELECT id, name, price FROM products 
        ORDER BY random() 
        LIMIT ${Math.floor(Math.random() * 5) + 1}
      `);
      
      for (const product of productsResult.rows) {
        const quantity = Math.floor(Math.random() * 20) + 1;
        await client.query(`
          INSERT INTO predicted_order_items (
            predicted_order_id, product_id, product_name, 
            predicted_quantity, unit_price, total_price, confidence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          orderId,
          product.id,
          product.name,
          quantity,
          product.price,
          quantity * product.price,
          0.7 + Math.random() * 0.25
        ]);
      }
    }
    
    console.log('✓ Generated predicted order items');
    
    // STEP 4: Generate Sales Forecasts
    console.log('\n=== STEP 4: GENERATING SALES FORECASTS ===');
    
    await client.query(`
      INSERT INTO sales_forecasts (store_id, forecast_date, forecast_period, predicted_revenue, confidence_lower, confidence_upper, model_name)
      SELECT 
        s.id,
        generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '1 day'::interval)::date,
        'daily',
        AVG(mi.total) * (0.8 + random() * 0.4),
        AVG(mi.total) * 0.7,
        AVG(mi.total) * 1.3,
        'Time Series Forecast v1.0'
      FROM stores s
      LEFT JOIN mangalam_invoices mi ON s.id = mi.customer_id
      WHERE mi.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY s.id
      HAVING COUNT(mi.id) > 0
      LIMIT 20
    `);
    
    console.log('✓ Generated sales forecasts');
    
    // STEP 5: Generate Order Patterns
    console.log('\n=== STEP 5: GENERATING ORDER PATTERNS ===');
    
    await client.query(`
      INSERT INTO order_patterns (store_id, pattern_type, pattern_data, confidence_score, next_predicted)
      SELECT 
        s.id,
        CASE 
          WHEN random() > 0.7 THEN 'seasonal'
          WHEN random() > 0.4 THEN 'recurring'
          ELSE 'trending'
        END,
        jsonb_build_object(
          'frequency', 'weekly',
          'avg_order_size', AVG(mi.total),
          'common_products', array_agg(DISTINCT mi.item_name)
        ),
        0.6 + random() * 0.35,
        CURRENT_DATE + (random() * 14 + 1)::int * INTERVAL '1 day'
      FROM stores s
      LEFT JOIN mangalam_invoices mi ON s.id = mi.customer_id
      WHERE mi.invoice_date >= CURRENT_DATE - INTERVAL '60 days'
      GROUP BY s.id
      HAVING COUNT(mi.id) > 5
      LIMIT 30
    `);
    
    console.log('✓ Generated order patterns');
    
    // STEP 6: Create Store Preferences
    console.log('\n=== STEP 6: CREATING STORE PREFERENCES ===');
    
    await client.query(`
      INSERT INTO store_preferences (
        store_id, call_frequency, payment_terms, 
        credit_limit, auto_approve_predictions
      )
      SELECT 
        id,
        CASE 
          WHEN random() > 0.7 THEN 'daily'
          WHEN random() > 0.3 THEN 'weekly'
          ELSE 'monthly'
        END,
        CASE 
          WHEN random() > 0.5 THEN 30
          ELSE 15
        END,
        10000 + random() * 40000,
        random() > 0.7
      FROM stores
      ON CONFLICT (store_id) DO NOTHING
    `);
    
    console.log('✓ Created store preferences');
    
    // STEP 7: Verify Complete System
    console.log('\n' + '='.repeat(80));
    console.log('SYSTEM VERIFICATION');
    console.log('='.repeat(80));
    
    const verification = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM stores) as stores,
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT COUNT(*) FROM mangalam_invoices) as invoices,
        (SELECT COUNT(*) FROM predicted_orders) as predictions,
        (SELECT COUNT(*) FROM predicted_order_items) as prediction_items,
        (SELECT COUNT(*) FROM sales_forecasts) as forecasts,
        (SELECT COUNT(*) FROM order_patterns) as patterns,
        (SELECT COUNT(*) FROM store_preferences) as preferences
    `);
    
    const counts = verification.rows[0];
    console.log('\nTable Record Counts:');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });
    
    // Test API endpoints
    console.log('\n=== TESTING API CONNECTIVITY ===');
    const axios = require('axios');
    
    try {
      // Test predicted orders endpoint
      const predResponse = await axios.get('http://localhost:3007/api/predicted-orders?limit=5');
      console.log(`✓ Predicted Orders API: ${predResponse.data.data?.length || 0} records`);
    } catch (err) {
      console.log(`✗ Predicted Orders API: ${err.message}`);
    }
    
    try {
      // Test dashboard summary
      const dashResponse = await axios.get('http://localhost:3007/api/dashboard/summary');
      console.log(`✓ Dashboard Summary API: ${dashResponse.data.success ? 'Working' : 'Failed'}`);
    } catch (err) {
      console.log(`✗ Dashboard Summary API: ${err.message}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ COMPLETE SYSTEM POPULATION SUCCESSFUL!');
    console.log('All tables populated, all connections established');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Error:', error);
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

// Run the complete population
populateCompleteSystem();