const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mangalm_sales',
  password: 'postgres',
  port: 5432,
});

async function addInvoiceItems() {
  const storeId = '4261931000001048016';
  
  try {
    console.log(`Adding invoice items for store ${storeId}...`);
    
    // Get existing invoices for this store
    const invoiceResult = await pool.query(
      'SELECT id, total_amount FROM historical_invoices WHERE store_id = $1',
      [storeId]
    );
    
    console.log(`Found ${invoiceResult.rows.length} invoices`);
    
    // Get some products to use
    const productsResult = await pool.query(
      'SELECT id, name FROM products LIMIT 10'
    );
    
    if (productsResult.rows.length === 0) {
      console.log('No products found!');
      return;
    }
    
    const products = productsResult.rows;
    console.log(`Using ${products.length} products for items`);
    
    // Add items to each invoice
    for (const invoice of invoiceResult.rows) {
      console.log(`\nAdding items to invoice ${invoice.id}...`);
      
      // Calculate how to distribute the total amount
      const numItems = Math.floor(Math.random() * 3) + 3; // 3-5 items per invoice
      const avgPrice = invoice.total_amount / numItems;
      
      let totalAdded = 0;
      for (let i = 0; i < numItems && i < products.length; i++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 20) + 5; // 5-24 units
        const unitPrice = (avgPrice / quantity) * (0.8 + Math.random() * 0.4); // Add some variation
        const totalPrice = quantity * unitPrice;
        
        const itemId = `${invoice.id}_ITEM_${i + 1}`;
        await pool.query(`
          INSERT INTO invoice_items (
            id, invoice_id, product_id, quantity, unit_price, total_price, discount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          itemId,
          invoice.id,
          product.id,
          quantity,
          unitPrice.toFixed(2),
          totalPrice.toFixed(2),
          0
        ]);
        
        totalAdded += totalPrice;
        console.log(`  - Added ${quantity} x ${product.name} @ $${unitPrice.toFixed(2)}`);
      }
      
      console.log(`  Total items value: $${totalAdded.toFixed(2)}`);
    }
    
    // Verify the items were added
    const itemCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM invoice_items ii
      JOIN historical_invoices hi ON ii.invoice_id = hi.id
      WHERE hi.store_id = $1
    `, [storeId]);
    
    console.log(`\nTotal invoice items added: ${itemCount.rows[0].count}`);
    
    // Show a sample with product names
    const sampleItems = await pool.query(`
      SELECT ii.*, p.name as product_name
      FROM invoice_items ii
      JOIN historical_invoices hi ON ii.invoice_id = hi.id
      JOIN products p ON ii.product_id = p.id
      WHERE hi.store_id = $1
      LIMIT 5
    `, [storeId]);
    
    console.log('\nSample items with product names:');
    sampleItems.rows.forEach(item => {
      console.log(`  ${item.quantity} x ${item.product_name} @ $${item.unit_price} = $${item.total_price}`);
    });
    
  } catch (error) {
    console.error('Error adding invoice items:', error);
  } finally {
    await pool.end();
  }
}

addInvoiceItems();