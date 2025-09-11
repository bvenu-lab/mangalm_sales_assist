const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'mangalm',
  password: 'mangalm_secure_password'
});

async function checkSchema() {
  const client = await pool.connect();
  
  try {
    // Check predicted_orders columns
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'predicted_orders'
      ORDER BY ordinal_position
    `);
    
    console.log('predicted_orders columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
    // Check if we have product names instead
    const sampleInvoice = await client.query(`
      SELECT DISTINCT product_name 
      FROM mangalam_invoices 
      LIMIT 5
    `);
    
    console.log('\nSample product names from invoices:');
    sampleInvoice.rows.forEach(row => {
      console.log(`  - ${row.product_name}`);
    });
    
    // Check if products table has matching names
    const productMatch = await client.query(`
      SELECT COUNT(*) as matched_products
      FROM mangalam_invoices mi
      JOIN products p ON p.name = mi.product_name
      WHERE mi.product_name IS NOT NULL
    `);
    
    console.log(`\nMatched products between invoices and products table: ${productMatch.rows[0].matched_products}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    pool.end();
  }
}

checkSchema();