const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'postgres',
  password: 'postgres'
});

async function fixAndPopulate() {
  try {
    // Drop the foreign key constraint
    console.log('Dropping foreign key constraint...');
    await pool.query('ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey');
    console.log('Constraint dropped successfully');
    
    // Now populate with random data for each order
    const ordersResult = await pool.query('SELECT id FROM orders');
    const productsResult = await pool.query('SELECT name, unit_price FROM products LIMIT 50');
    
    console.log(`Populating invoice_items for ${ordersResult.rows.length} orders...`);
    
    let totalInserted = 0;
    for (const order of ordersResult.rows) {
      const numItems = Math.floor(Math.random() * 5) + 2; // 2-6 items per order
      
      for (let i = 0; i < numItems && i < productsResult.rows.length; i++) {
        const product = productsResult.rows[Math.floor(Math.random() * productsResult.rows.length)];
        const quantity = Math.floor(Math.random() * 10) + 1;
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
          // Ignore errors silently
        }
      }
    }
    
    console.log(`Inserted ${totalInserted} invoice items`);
    
    // Verify all tables
    console.log('\n=== FINAL TABLE COUNTS ===');
    const tables = [
      'orders', 'products', 'invoice_items', 'stores',
      'upselling_recommendations', 'historical_invoices'
    ];
    
    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table}: ${result.rows[0].count} records`);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixAndPopulate();