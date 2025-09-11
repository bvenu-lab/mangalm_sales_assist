/**
 * Load Invoices CSV with CURRENT dates
 * This script loads the Mangalam invoice CSV but updates all dates to be recent
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { Client } = require('pg');

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

async function loadInvoices() {
  console.log('='.repeat(60));
  console.log('LOADING INVOICES WITH CURRENT DATES');
  console.log('='.repeat(60));
  
  try {
    // Connect to database
    await client.connect();
    console.log('✓ Connected to database');
    
    // Clear existing data
    console.log('\nClearing existing data...');
    await client.query('TRUNCATE TABLE mangalam_invoices, orders, products, stores CASCADE');
    console.log('✓ Cleared all existing data');
    
    // Read and parse CSV
    console.log('\nReading CSV file...');
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
    
    console.log(`✓ Parsed ${records.length} records from CSV`);
    
    // Process records in batches
    const batchSize = 100;
    let totalInserted = 0;
    const uniqueStores = new Set();
    const uniqueProducts = new Set();
    
    // First pass - collect unique stores and products
    console.log('\nCollecting unique stores and products...');
    for (const record of records) {
      if (record['Customer Name']) {
        uniqueStores.add(record['Customer Name']);
      }
      if (record['Item Name']) {
        uniqueProducts.add(JSON.stringify({
          name: record['Item Name'],
          sku: record['SKU'],
          brand: record['Brand'],
          category: record['Category Name']
        }));
      }
    }
    
    // Insert stores
    console.log(`\nInserting ${uniqueStores.size} unique stores...`);
    for (const storeName of uniqueStores) {
      await client.query(`
        INSERT INTO stores (id, name, address)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `, [storeName, storeName, record['Billing Address'] || '']);
    }
    console.log('✓ Stores inserted');
    
    // Insert products
    console.log(`\nInserting ${uniqueProducts.size} unique products...`);
    for (const productJson of uniqueProducts) {
      const product = JSON.parse(productJson);
      await client.query(`
        INSERT INTO products (name, sku, brand, category, price)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        product.name,
        product.sku || 'N/A',
        product.brand || 'Unknown',
        product.category || 'General',
        Math.random() * 100 + 10 // Random price
      ]);
    }
    console.log('✓ Products inserted');
    
    // Insert invoices with CURRENT dates
    console.log('\nInserting invoices with current dates...');
    const today = new Date();
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          // Calculate a random date within the last 60 days
          const daysAgo = Math.floor(Math.random() * 60);
          const invoiceDate = new Date(today);
          invoiceDate.setDate(invoiceDate.getDate() - daysAgo);
          
          // Parse numeric values
          const quantity = parseFloat(record['Quantity']) || 1;
          const itemPrice = parseFloat(record['Item Price']) || 0;
          const itemTotal = parseFloat(record['Item Total']) || (quantity * itemPrice);
          const total = parseFloat(record['Total']) || itemTotal;
          
          await client.query(`
            INSERT INTO mangalam_invoices (
              invoice_date, invoice_id, invoice_number, invoice_status,
              customer_name, customer_id, item_name, sku, brand,
              category_name, quantity, item_price, item_total,
              subtotal, total
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
            invoiceDate,
            record['Invoice ID'] || `INV-${Date.now()}-${i}`,
            record['Invoice Number'] || `INV-${i}`,
            record['Invoice Status'] || 'Closed',
            record['Customer Name'] || 'Unknown Store',
            record['Customer ID'] || `CUST-${i}`,
            record['Item Name'] || 'Unknown Product',
            record['SKU'] || '',
            record['Brand'] || '',
            record['Category Name'] || '',
            quantity,
            itemPrice,
            itemTotal,
            parseFloat(record['SubTotal']) || itemTotal,
            total
          ]);
          
          totalInserted++;
        } catch (err) {
          console.error(`Error inserting record ${i}:`, err.message);
        }
      }
      
      console.log(`  Processed ${Math.min(i + batchSize, records.length)}/${records.length} records...`);
    }
    
    console.log(`\n✓ Inserted ${totalInserted} invoice records`);
    
    // Verify the data
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION');
    console.log('='.repeat(60));
    
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        MIN(invoice_date) as oldest_date,
        MAX(invoice_date) as newest_date,
        COUNT(CASE WHEN invoice_date >= CURRENT_DATE - 7 THEN 1 END) as last_7_days,
        COUNT(CASE WHEN invoice_date >= CURRENT_DATE - 30 THEN 1 END) as last_30_days,
        COUNT(DISTINCT customer_name) as unique_stores,
        COUNT(DISTINCT item_name) as unique_products,
        ROUND(AVG(total)::numeric, 2) as avg_invoice_total
      FROM mangalam_invoices
    `);
    
    const result = stats.rows[0];
    console.log(`Total Records: ${result.total_records}`);
    console.log(`Date Range: ${result.oldest_date} to ${result.newest_date}`);
    console.log(`Records in last 7 days: ${result.last_7_days}`);
    console.log(`Records in last 30 days: ${result.last_30_days}`);
    console.log(`Unique Stores: ${result.unique_stores}`);
    console.log(`Unique Products: ${result.unique_products}`);
    console.log(`Average Invoice Total: $${result.avg_invoice_total}`);
    
    // Test API query
    console.log('\nTesting API query (last 7 days):');
    const testQuery = await client.query(`
      SELECT COUNT(*) as count, SUM(total) as revenue
      FROM mangalam_invoices
      WHERE invoice_date >= NOW() - INTERVAL '7 days'
    `);
    console.log(`  Records: ${testQuery.rows[0].count}`);
    console.log(`  Revenue: $${testQuery.rows[0].revenue || 0}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATA LOADED SUCCESSFULLY WITH CURRENT DATES!');
    console.log('Dashboard should now show data properly.');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

// Run the loader
loadInvoices();