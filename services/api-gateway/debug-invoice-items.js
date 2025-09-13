const { Pool } = require('pg');
const fs = require('fs');
const csv = require('csv-parse');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'postgres',
  password: 'postgres'
});

async function debug() {
  // Get sample order numbers
  const orders = await pool.query('SELECT id, order_number FROM orders LIMIT 5');
  console.log('Sample orders from database:');
  orders.rows.forEach(r => console.log(`  ID: ${r.id}, Number: ${r.order_number}`));
  
  // Get sample invoice IDs from CSV
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
  
  const invoiceIds = new Set();
  for (let i = 0; i < Math.min(100, records.length); i++) {
    const id = records[i]['Invoice ID'];
    if (id) invoiceIds.add(id.trim());
  }
  
  console.log('\nSample Invoice IDs from CSV:');
  Array.from(invoiceIds).slice(0, 5).forEach(id => console.log('  ' + id));
  
  // Check if any match
  console.log('\nChecking for matches...');
  let matchCount = 0;
  for (const invoiceId of invoiceIds) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE order_number = $1 OR order_number LIKE $2',
      [invoiceId, `%${invoiceId}%`]
    );
    if (result.rows[0].count > 0) {
      matchCount++;
      if (matchCount <= 3) {
        console.log(`  Found match for invoice ID: ${invoiceId}`);
      }
    }
  }
  console.log(`Total matches found: ${matchCount} out of ${invoiceIds.size} invoice IDs`);
  
  await pool.end();
}

debug().catch(console.error);