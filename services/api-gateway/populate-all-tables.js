const fs = require('fs');
const csv = require('csv-parse');
const { Pool } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'postgres',
  password: 'postgres'
});

async function populateTables() {
  console.log('Starting to populate all tables from CSV...\n');
  
  // Read and parse CSV
  const csvData = fs.readFileSync('C:\\code\\mangalm\\user_journey\\Invoices_Mangalam.csv', 'utf8');
  
  const records = await new Promise((resolve, reject) => {
    csv.parse(csvData, {
      columns: true,
      skip_empty_lines: true
    }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  console.log(`Parsed ${records.length} rows from CSV\n`);

  // Extract unique products
  const products = new Map();
  const invoiceItems = [];
  
  for (const row of records) {
    const itemName = row['Item Name']?.trim();
    const itemPrice = parseFloat(row['Item Price']?.replace(/[$,]/g, '') || 0);
    const quantity = parseFloat(row['Quantity'] || 1);
    const total = parseFloat(row['Total']?.replace(/[$,]/g, '') || 0);
    const invoiceId = row['Invoice ID']?.trim();
    
    if (itemName && !products.has(itemName)) {
      // Generate UUID for product and numeric ID for upselling
      const productId = uuidv4();
      // Generate a numeric ID for upselling_recommendations (bigint)
      const hash = crypto.createHash('md5').update(itemName).digest('hex');
      const numericId = parseInt(hash.substring(0, 8), 16);
      
      products.set(itemName, {
        id: productId,
        numericId: numericId,
        name: itemName,
        price: itemPrice || Math.random() * 100 + 10,
        category: categorizeProduct(itemName),
        brand: itemName.split(' ')[0] || 'Generic'
      });
    }
    
    // Collect invoice items
    if (invoiceId && itemName) {
      invoiceItems.push({
        invoiceId,
        productName: itemName,
        quantity,
        price: itemPrice,
        total
      });
    }
  }

  console.log(`Found ${products.size} unique products`);
  console.log(`Found ${invoiceItems.length} invoice items\n`);

  // Insert products
  console.log('Inserting products...');
  let productCount = 0;
  for (const [name, product] of products) {
    try {
      // Generate SKU from product name
      const sku = name.replace(/[^A-Z0-9]/gi, '').substring(0, 10).toUpperCase() + '-' + product.id.toString().substring(0, 6);
      
      await pool.query(`
        INSERT INTO products (id, name, sku, category, brand, unit_price)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          unit_price = EXCLUDED.unit_price,
          updated_at = NOW()
      `, [
        product.id,
        product.name,
        sku,
        product.category,
        product.brand,
        product.price
      ]);
      productCount++;
    } catch (err) {
      console.error(`Error inserting product ${name}:`, err.message);
    }
  }
  console.log(`Inserted ${productCount} products\n`);

  // Get order mapping
  const orderResult = await pool.query('SELECT id, order_number FROM orders');
  const orderMap = new Map();
  orderResult.rows.forEach(row => {
    orderMap.set(row.order_number, row.id);
  });

  // Insert invoice items
  console.log('Inserting invoice items...');
  let itemCount = 0;
  let errorCount = 0;
  
  for (const item of invoiceItems) {
    // Find matching order
    let orderId = null;
    for (const [orderNum, oid] of orderMap) {
      if (orderNum.includes(item.invoiceId) || item.invoiceId.includes(orderNum)) {
        orderId = oid;
        break;
      }
    }
    
    if (!orderId) {
      // If no exact match, try to find order by invoice ID pattern
      const orderResult = await pool.query(
        'SELECT id FROM orders WHERE order_number LIKE $1 LIMIT 1',
        [`%${item.invoiceId}%`]
      );
      if (orderResult.rows.length > 0) {
        orderId = orderResult.rows[0].id;
      }
    }
    
    if (orderId && products.has(item.productName)) {
      try {
        await pool.query(`
          INSERT INTO invoice_items (
            invoice_id, product_name, quantity,
            unit_price, total_price, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT DO NOTHING
        `, [
          orderId,  // Using order ID as invoice_id since they match
          item.productName,
          item.quantity,
          item.price,
          item.total
        ]);
        itemCount++;
      } catch (err) {
        errorCount++;
        if (errorCount < 5) {
          console.error(`Error inserting invoice item for ${item.productName}:`, err.message);
        }
      }
    }
  }
  console.log(`Inserted ${itemCount} invoice items (${errorCount} errors)\n`);

  // Generate upselling recommendations
  console.log('Generating upselling recommendations...');
  let upsellCount = 0;
  
  // Get some orders to generate recommendations for
  const ordersForRec = await pool.query('SELECT id, store_id FROM orders LIMIT 100');
  
  for (const order of ordersForRec.rows) {
    // Generate 3-5 recommendations per order
    const numRecs = Math.floor(Math.random() * 3) + 3;
    const productsList = Array.from(products.values());
    
    for (let i = 0; i < numRecs && i < productsList.length; i++) {
      const randomProduct = productsList[Math.floor(Math.random() * productsList.length)];
      
      try {
        await pool.query(`
          INSERT INTO upselling_recommendations (
            order_id, store_id, product_id, recommendation_type,
            confidence_score, expected_revenue, reason, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT DO NOTHING
        `, [
          order.id,
          order.store_id || 1,  // Default store_id if null
          randomProduct.numericId,  // Use numeric ID for upselling table
          randomProduct.price > 50 ? 'upsell' : (randomProduct.category === 'Grains' || randomProduct.category === 'Oils' ? 'cross_sell' : 'bundle'),
          Math.random() * 0.4 + 0.6,  // 60-100% confidence
          randomProduct.price * (1 + Math.random() * 0.3),
          ['Frequently bought together', 'Customers who bought this also bought', 'Popular in your area'][Math.floor(Math.random() * 3)],
          'pending'
        ]);
        upsellCount++;
      } catch (err) {
        console.error(`Error inserting upselling recommendation:`, err.message);
      }
    }
  }
  
  console.log(`Generated ${upsellCount} upselling recommendations\n`);

  // Final verification
  console.log('=== FINAL TABLE COUNTS ===');
  const tables = [
    'orders', 'products', 'invoice_items', 'stores',
    'upselling_recommendations', 'historical_invoices'
  ];
  
  for (const table of tables) {
    const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
    console.log(`${table}: ${result.rows[0].count} records`);
  }

  await pool.end();
}

function categorizeProduct(name) {
  const lower = name.toLowerCase();
  if (lower.includes('rice') || lower.includes('atta') || lower.includes('flour')) return 'Grains';
  if (lower.includes('oil') || lower.includes('ghee')) return 'Oils';
  if (lower.includes('dal') || lower.includes('lentil')) return 'Pulses';
  if (lower.includes('spice') || lower.includes('masala')) return 'Spices';
  if (lower.includes('sweet') || lower.includes('sugar')) return 'Sweets';
  return 'Grocery';
}

// Run the population
populateTables().catch(console.error);