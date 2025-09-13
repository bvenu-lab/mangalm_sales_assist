const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'postgres',
  password: 'postgres'
});

async function populateInvoiceItems() {
  console.log('Populating invoice_items table...\n');
  
  // Get all orders
  const ordersResult = await pool.query('SELECT id FROM orders');
  console.log(`Found ${ordersResult.rows.length} orders`);
  
  // Get all products
  const productsResult = await pool.query('SELECT id, name, unit_price FROM products LIMIT 100');
  console.log(`Found ${productsResult.rows.length} products to use`);
  
  if (productsResult.rows.length === 0) {
    console.log('No products found. Please run populate-all-tables.js first.');
    await pool.end();
    return;
  }
  
  let totalInserted = 0;
  const products = productsResult.rows;
  
  // For each order, create 3-10 invoice items
  for (const order of ordersResult.rows) {
    const numItems = Math.floor(Math.random() * 8) + 3; // 3-10 items per order
    const usedProducts = new Set();
    
    for (let i = 0; i < numItems && i < products.length; i++) {
      // Pick a random product that hasn't been used in this order
      let product;
      let attempts = 0;
      do {
        product = products[Math.floor(Math.random() * products.length)];
        attempts++;
      } while (usedProducts.has(product.id) && attempts < 10);
      
      if (usedProducts.has(product.id)) continue;
      usedProducts.add(product.id);
      
      const quantity = Math.floor(Math.random() * 10) + 1; // 1-10 quantity
      const unitPrice = product.unit_price || Math.random() * 100 + 10;
      const totalPrice = unitPrice * quantity;
      
      try {
        await pool.query(`
          INSERT INTO invoice_items (
            invoice_id, product_name, quantity,
            unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [
          order.id,
          product.name,
          quantity,
          unitPrice,
          totalPrice
        ]);
        totalInserted++;
      } catch (err) {
        console.error(`Error inserting invoice item:`, err.message);
      }
    }
  }
  
  console.log(`\nInserted ${totalInserted} invoice items`);
  
  // Verify
  const countResult = await pool.query('SELECT COUNT(*) FROM invoice_items');
  console.log(`Total invoice_items in database: ${countResult.rows[0].count}`);
  
  await pool.end();
}

populateInvoiceItems().catch(console.error);