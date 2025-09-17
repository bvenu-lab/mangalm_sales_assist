const { getDatabase } = require('./shared/database/cloud-agnostic-db.js');

async function checkData() {
  const db = getDatabase();

  try {
    const stores = await db.query('SELECT COUNT(*) as count FROM stores');
    const orders = await db.query('SELECT COUNT(*) as count FROM mangalam_invoices');
    const items = await db.query('SELECT COUNT(*) as count FROM invoice_items');

    console.log('📊 Current Database State:');
    console.log(`  Stores: ${stores.rows[0].count}`);
    console.log(`  Invoices: ${orders.rows[0].count}`);
    console.log(`  Invoice Items: ${items.rows[0].count}`);

    // Check column names first
    const columns = await db.query("PRAGMA table_info(mangalam_invoices)");
    console.log('\n📋 Available columns in mangalam_invoices:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    // Check stores table too
    const storeColumns = await db.query("PRAGMA table_info(stores)");
    console.log('\n📋 Available columns in stores:');
    storeColumns.rows.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    // Sample recent data (use correct column names)
    const sampleInvoices = await db.query('SELECT * FROM mangalam_invoices ORDER BY id DESC LIMIT 1');
    console.log('\n📋 Invoice Data Analysis:');
    sampleInvoices.rows.forEach(invoice => {
      console.log(`  Invoice ID: ${invoice.id}`);
      console.log(`  Invoice Number: ${invoice.invoice_number}`);
      console.log(`  Invoice Date: ${invoice.invoice_date} (Type: ${typeof invoice.invoice_date})`);
      console.log(`  Due Date: ${invoice.due_date}`);
      console.log(`  Customer: ${invoice.customer_name}`);
      console.log(`  Subtotal: ${invoice.subtotal} (Type: ${typeof invoice.subtotal})`);
      console.log(`  Total: ${invoice.total} (Type: ${typeof invoice.total})`);
      console.log(`  Status: ${invoice.status}`);
      console.log(`  Created: ${invoice.created_at}`);
      console.log('  ---');
    });

    // Check invoice items too
    const sampleItems = await db.query('SELECT * FROM invoice_items ORDER BY id DESC LIMIT 2');
    console.log('\n📋 Invoice Items Analysis:');
    sampleItems.rows.forEach(item => {
      console.log(`  Item: ${item.product_name}`);
      console.log(`  Quantity: ${item.quantity} (Type: ${typeof item.quantity})`);
      console.log(`  Unit Price: ${item.unit_price} (Type: ${typeof item.unit_price})`);
      console.log(`  Total: ${item.total_amount} (Type: ${typeof item.total_amount})`);
      console.log(`  Invoice ID: ${item.invoice_id}`);
      console.log('  ---');
    });

    // Sample stores
    const sampleStores = await db.query('SELECT * FROM stores ORDER BY id DESC LIMIT 3');
    console.log('\n📋 Recent Stores:');
    sampleStores.rows.forEach(store => {
      console.log(`  Store ${store.id}:`, JSON.stringify(store, null, 2));
    });

  } catch (error) {
    console.error('Database check failed:', error.message);
  } finally {
    await db.close();
  }
}

checkData();