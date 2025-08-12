const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mangalm_sales',
  password: 'postgres',
  port: 5432,
});

async function fixPredictionTables() {
  try {
    console.log('Checking and fixing prediction tables...');
    
    // Check if predicted_orders table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'predicted_orders'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating predicted_orders table...');
      await pool.query(`
        CREATE TABLE predicted_orders (
          id VARCHAR(100) PRIMARY KEY,
          store_id VARCHAR(100) REFERENCES stores(id),
          prediction_date TIMESTAMP DEFAULT NOW(),
          confidence_score DECIMAL(3,2),
          estimated_value DECIMAL(14,2),
          status VARCHAR(50) DEFAULT 'pending',
          priority VARCHAR(20) DEFAULT 'medium',
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('Created predicted_orders table');
    }
    
    // Check if predicted_order_items table exists
    const itemsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'predicted_order_items'
      )
    `);
    
    if (!itemsTableCheck.rows[0].exists) {
      console.log('Creating predicted_order_items table...');
      await pool.query(`
        CREATE TABLE predicted_order_items (
          id SERIAL PRIMARY KEY,
          predicted_order_id VARCHAR(100) REFERENCES predicted_orders(id),
          product_id VARCHAR(100),
          quantity INTEGER,
          unit_price DECIMAL(10,2),
          total_price DECIMAL(14,2),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('Created predicted_order_items table');
    }
    
    // Check if call_prioritization table exists
    const callTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'call_prioritization'
      )
    `);
    
    if (!callTableCheck.rows[0].exists) {
      console.log('Creating call_prioritization table...');
      await pool.query(`
        CREATE TABLE call_prioritization (
          id VARCHAR(100) PRIMARY KEY,
          store_id VARCHAR(100) REFERENCES stores(id),
          priority_score DECIMAL(3,1),
          priority_reason TEXT,
          last_call_date DATE,
          next_call_date DATE,
          status VARCHAR(50) DEFAULT 'pending',
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('Created call_prioritization table');
    }
    
    // Check if invoice_items table exists
    const invoiceItemsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'invoice_items'
      )
    `);
    
    if (!invoiceItemsCheck.rows[0].exists) {
      console.log('Creating invoice_items table...');
      await pool.query(`
        CREATE TABLE invoice_items (
          id SERIAL PRIMARY KEY,
          invoice_id VARCHAR(100),
          product_id VARCHAR(100),
          quantity INTEGER,
          unit_price DECIMAL(10,2),
          total_price DECIMAL(14,2),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('Created invoice_items table');
    }
    
    console.log('Tables fixed successfully!');
    
    // Show table counts
    const tables = ['predicted_orders', 'predicted_order_items', 'call_prioritization', 'historical_invoices', 'invoice_items'];
    for (const table of tables) {
      try {
        const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`${table}: ${count.rows[0].count} records`);
      } catch (err) {
        console.log(`${table}: not found or error`);
      }
    }
    
  } catch (error) {
    console.error('Error fixing tables:', error);
  } finally {
    await pool.end();
  }
}

fixPredictionTables();