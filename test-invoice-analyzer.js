// Test invoice analyzer
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const invoicesPath = path.join(process.cwd(), 'user_journey/Invoices_Mangalam .csv');
console.log('Looking for file at:', invoicesPath);
console.log('File exists:', fs.existsSync(invoicesPath));

if (fs.existsSync(invoicesPath)) {
  const csvContent = fs.readFileSync(invoicesPath, 'utf-8');
  const data = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true
  });
  
  console.log('Total records:', data.length);
  
  // Get unique stores
  const stores = new Map();
  data.forEach(row => {
    const customerName = row['Customer Name'];
    const customerId = row['Customer ID'];
    if (customerName) {
      if (!stores.has(customerName)) {
        stores.set(customerName, {
          id: customerId,
          name: customerName,
          invoiceCount: 0,
          totalRevenue: 0
        });
      }
      const store = stores.get(customerName);
      store.invoiceCount++;
      store.totalRevenue += parseFloat(row['Item Total'] || '0');
    }
  });
  
  console.log('Unique stores:', stores.size);
  console.log('\nFirst 5 stores:');
  let count = 0;
  stores.forEach((store, name) => {
    if (count < 5) {
      console.log(`- ${name} (ID: ${store.id})`);
      console.log(`  Invoices: ${store.invoiceCount}, Revenue: $${store.totalRevenue.toFixed(2)}`);
      count++;
    }
  });
  
  // Test specific store
  const testStoreId = '4261931000000094375';
  console.log(`\nLooking for store with ID: ${testStoreId}`);
  
  const storeInvoices = data.filter(row => row['Customer ID'] === testStoreId);
  console.log(`Found ${storeInvoices.length} invoice lines for this store`);
  
  if (storeInvoices.length > 0) {
    console.log('Store name:', storeInvoices[0]['Customer Name']);
  }
}