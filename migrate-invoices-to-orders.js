const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'mangalm',
  password: 'mangalm_secure_password'
});

async function migrateInvoicesToOrders() {
  console.log('🔄 Starting Invoice to Order Migration...\n');
  
  try {
    // Check current status
    const statusQuery = `
      SELECT 
        (SELECT COUNT(*) FROM mangalam_invoices) as total_invoices,
        (SELECT COUNT(*) FROM orders) as current_orders
    `;
    const statusResult = await pool.query(statusQuery);
    const status = statusResult.rows[0];
    
    console.log(`📊 Current Status:`);
    console.log(`   Invoices: ${status.total_invoices}`);
    console.log(`   Orders: ${status.current_orders}\n`);
    
    if (status.total_invoices === 0) {
      console.log('❌ No invoices to migrate');
      return;
    }
    
    // Get sample invoices to understand the data
    console.log('📝 Analyzing invoice data structure...');
    const sampleQuery = 'SELECT * FROM mangalam_invoices LIMIT 5';
    const sampleResult = await pool.query(sampleQuery);
    
    // Get all stores for mapping
    const storesQuery = 'SELECT id, name FROM stores';
    const storesResult = await pool.query(storesQuery);
    const storeMap = {};
    storesResult.rows.forEach(store => {
      storeMap[store.name.toLowerCase()] = store.id;
    });
    console.log(`   Found ${storesResult.rows.length} stores for mapping\n`);
    
    // Migrate invoices in batches
    console.log('🚀 Starting migration...');
    const batchSize = 100;
    let offset = 0;
    let totalMigrated = 0;
    
    while (true) {
      const invoicesQuery = `
        SELECT * FROM mangalam_invoices 
        ORDER BY id 
        LIMIT $1 OFFSET $2
      `;
      const invoicesResult = await pool.query(invoicesQuery, [batchSize, offset]);
      
      if (invoicesResult.rows.length === 0) {
        break;
      }
      
      console.log(`   Processing batch ${offset / batchSize + 1} (${invoicesResult.rows.length} invoices)...`);
      
      for (const invoice of invoicesResult.rows) {
        try {
          // Try to find matching store
          let storeId = null;
          if (invoice.customer_name) {
            const customerLower = invoice.customer_name.toLowerCase();
            for (const [storeName, id] of Object.entries(storeMap)) {
              if (customerLower.includes(storeName.split(' ')[0])) {
                storeId = id;
                break;
              }
            }
          }
          
          // Default to first store if no match
          if (!storeId) {
            storeId = storesResult.rows[0]?.id || '4261931000000665698';
          }
          
          // Check if order already exists
          const existsQuery = `
            SELECT 1 FROM orders 
            WHERE order_number = $1 
               OR order_number = $2
               OR notes LIKE $3
            LIMIT 1
          `;
          const existsResult = await pool.query(existsQuery, [
            invoice.invoice_number,
            invoice.invoice_id,
            '%' + invoice.invoice_id + '%'
          ]);
          
          if (existsResult.rows.length > 0) {
            continue; // Skip if already migrated
          }
          
          // Create order
          const insertQuery = `
            INSERT INTO orders (
              order_number,
              store_id,
              customer_name,
              customer_phone,
              customer_email,
              items,
              item_count,
              total_quantity,
              subtotal_amount,
              tax_amount,
              total_amount,
              status,
              source,
              order_date,
              delivery_date,
              payment_status,
              notes
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
            )
          `;
          
          const orderNumber = invoice.invoice_number || invoice.invoice_id || `INV-${invoice.id}`;
          const customerName = invoice.customer_name || 'Unknown Customer';
          const items = [{
            product_id: invoice.product_id,
            name: invoice.item_name,
            sku: invoice.sku,
            brand: invoice.brand,
            category: invoice.category_name,
            quantity: invoice.quantity || 1,
            unit_price: invoice.rate || 0,
            total: invoice.amount || 0
          }];
          
          const subtotal = parseFloat(invoice.amount) || 0;
          const tax = (parseFloat(invoice.cgst_amount) || 0) + 
                     (parseFloat(invoice.sgst_amount) || 0) + 
                     (parseFloat(invoice.igst_amount) || 0);
          const total = subtotal + tax;
          
          const status = invoice.invoice_status === 'Paid' ? 'delivered' : 
                        invoice.invoice_status === 'Overdue' ? 'pending_review' : 
                        'confirmed';
          
          const paymentStatus = invoice.invoice_status === 'Paid' ? 'paid' :
                               invoice.invoice_status === 'Overdue' ? 'overdue' :
                               'pending';
          
          await pool.query(insertQuery, [
            orderNumber,
            storeId,
            customerName,
            '555-0000',
            customerName.toLowerCase().replace(/\s+/g, '.') + '@example.com',
            JSON.stringify(items),
            1,
            invoice.quantity || 1,
            subtotal,
            tax,
            total,
            status,
            'invoice_migration',
            invoice.invoice_date || new Date(),
            invoice.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            paymentStatus,
            `Migrated from invoice ID: ${invoice.invoice_id} | Status: ${invoice.invoice_status || 'Unknown'}`
          ]);
          
          totalMigrated++;
        } catch (err) {
          console.log(`      ⚠️ Failed to migrate invoice ${invoice.id}: ${err.message}`);
        }
      }
      
      offset += batchSize;
      
      // Stop after 1000 orders for safety
      if (totalMigrated >= 1000) {
        console.log('   Reached migration limit of 1000 orders');
        break;
      }
    }
    
    console.log(`\n✅ Migration complete! Migrated ${totalMigrated} invoices to orders`);
    
    // Verify final status
    const finalStatusQuery = `
      SELECT 
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE source = 'invoice_migration') as migrated_orders
    `;
    const finalResult = await pool.query(finalStatusQuery);
    const final = finalResult.rows[0];
    
    console.log(`\n📊 Final Status:`);
    console.log(`   Total Orders: ${final.total_orders}`);
    console.log(`   Migrated Orders: ${final.migrated_orders}`);
    
    // Show sample orders
    const sampleOrdersQuery = `
      SELECT id, order_number, store_id, customer_name, total_amount, status
      FROM orders 
      WHERE source = 'invoice_migration'
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const sampleOrders = await pool.query(sampleOrdersQuery);
    
    console.log(`\n📦 Sample Migrated Orders:`);
    sampleOrders.rows.forEach(order => {
      console.log(`   - ${order.order_number}: ${order.customer_name} ($${order.total_amount})`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

migrateInvoicesToOrders().catch(console.error);