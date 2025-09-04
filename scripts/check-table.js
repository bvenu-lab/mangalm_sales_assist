const { Client } = require('pg');

async function checkTable() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'mangalm_sales',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    await client.connect();
    
    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'invoice_items'
      )
    `);
    
    console.log('Table exists:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Get column names
      const columns = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'invoice_items'
        ORDER BY ordinal_position
      `);
      
      console.log('\nExisting columns:');
      columns.rows.forEach(row => {
        console.log(`- ${row.column_name} (${row.data_type})`);
      });
    }
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTable();