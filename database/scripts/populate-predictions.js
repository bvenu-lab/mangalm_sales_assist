const { Pool } = require('pg');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mangalm_sales',
  password: 'postgres',
  port: 5432,
});

async function populatePredictions() {
  console.log('Starting to populate predicted orders and ensure invoice data...');
  
  try {
    // First, ensure historical_invoices table has data from CSV
    const invoiceCount = await pool.query('SELECT COUNT(*) FROM historical_invoices');
    console.log(`Found ${invoiceCount.rows[0].count} historical invoices`);
    
    if (invoiceCount.rows[0].count == 0) {
      console.log('Loading historical invoices from CSV...');
      await loadHistoricalInvoices();
    }
    
    // Create predicted orders based on store patterns
    console.log('Creating predicted orders...');
    await createPredictedOrders();
    
    // Create call prioritization data
    console.log('Creating call prioritization data...');
    await createCallPrioritization();
    
    console.log('Data population completed successfully!');
  } catch (error) {
    console.error('Error populating predictions:', error);
  } finally {
    await pool.end();
  }
}

async function loadHistoricalInvoices() {
  const csvPath = path.join(__dirname, '../../user_journey/Invoices_Mangalam .csv');
  const invoices = new Map();
  const invoiceItems = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        const invoiceId = row['Invoice ID'];
        const customerId = row['Customer ID'];
        const invoiceDate = row['Invoice Date'];
        const totalAmount = parseFloat(row['SubTotal']) || 0;
        const productId = row['Product ID'];
        const itemName = row['Item Name'];
        const quantity = parseInt(row['Quantity']) || 1;
        const unitPrice = parseFloat(row['Item Price']) || 0;
        
        // Create invoice if not exists
        if (!invoices.has(invoiceId) && customerId) {
          invoices.set(invoiceId, {
            id: invoiceId,
            storeId: customerId,
            invoiceDate: new Date(invoiceDate),
            totalAmount: totalAmount,
            paymentStatus: row['Invoice Status'] === 'Closed' ? 'paid' : 'pending',
            notes: row['Notes'] || ''
          });
        }
        
        // Add invoice items
        if (productId && invoiceId) {
          invoiceItems.push({
            invoiceId: invoiceId,
            productId: productId,
            productName: itemName,
            quantity: quantity,
            unitPrice: unitPrice,
            totalPrice: quantity * unitPrice
          });
        }
      })
      .on('end', async () => {
        console.log(`Found ${invoices.size} unique invoices to import`);
        
        // Insert invoices
        for (const invoice of invoices.values()) {
          try {
            await pool.query(`
              INSERT INTO historical_invoices (id, store_id, invoice_date, total_amount, payment_status, notes)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (id) DO NOTHING
            `, [invoice.id, invoice.storeId, invoice.invoiceDate, invoice.totalAmount, invoice.paymentStatus, invoice.notes]);
          } catch (err) {
            // Ignore errors for missing stores
          }
        }
        
        // Insert invoice items
        for (const item of invoiceItems) {
          try {
            // First check if product exists
            const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [item.productId]);
            if (productCheck.rows.length === 0) {
              // Create product if not exists
              await pool.query(`
                INSERT INTO products (id, name, sku, price, stock_quantity, reorder_point, is_active)
                VALUES ($1, $2, $3, $4, 100, 20, true)
                ON CONFLICT (id) DO NOTHING
              `, [item.productId, item.productName, `SKU-${item.productId}`, item.unitPrice]);
            }
            
            // Insert invoice item
            await pool.query(`
              INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, total_price)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT DO NOTHING
            `, [item.invoiceId, item.productId, item.quantity, item.unitPrice, item.totalPrice]);
          } catch (err) {
            // Ignore errors
          }
        }
        
        const finalCount = await pool.query('SELECT COUNT(*) FROM historical_invoices');
        console.log(`Total historical invoices in database: ${finalCount.rows[0].count}`);
        resolve();
      })
      .on('error', reject);
  });
}

async function createPredictedOrders() {
  // Get stores with their ordering patterns
  const storesQuery = `
    SELECT 
      s.id,
      s.name,
      COUNT(hi.id) as order_count,
      MAX(hi.invoice_date) as last_order_date,
      AVG(hi.total_amount) as avg_order_value,
      CASE 
        WHEN COUNT(hi.id) > 1 THEN
          EXTRACT(DAY FROM (MAX(hi.invoice_date) - MIN(hi.invoice_date)) / NULLIF(COUNT(hi.id) - 1, 0))
        ELSE 30
      END as avg_days_between_orders
    FROM stores s
    LEFT JOIN historical_invoices hi ON s.id = hi.store_id
    GROUP BY s.id, s.name
    HAVING COUNT(hi.id) > 0
    LIMIT 50
  `;
  
  const stores = await pool.query(storesQuery);
  console.log(`Creating predicted orders for ${stores.rows.length} stores`);
  
  for (const store of stores.rows) {
    const daysSinceLastOrder = store.last_order_date 
      ? Math.floor((new Date() - new Date(store.last_order_date)) / (1000 * 60 * 60 * 24))
      : 30;
    
    // Create predicted order if store is due for reorder
    if (daysSinceLastOrder > store.avg_days_between_orders * 0.7) {
      // Generate a UUID for the predicted order
      const { v4: uuidv4 } = require('uuid');
      const predictedOrderId = uuidv4();
      
      // Calculate confidence based on order history
      let confidenceScore = 0.5;
      if (store.order_count > 20) confidenceScore = 0.92;
      else if (store.order_count > 10) confidenceScore = 0.85;
      else if (store.order_count > 5) confidenceScore = 0.75;
      else confidenceScore = 0.65;
      
      // Insert predicted order
      await pool.query(`
        INSERT INTO predicted_orders (
          id, store_id, predicted_date, confidence, 
          total_amount, status, priority, ai_recommendation, prediction_model
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        predictedOrderId,
        store.id,
        new Date(),
        confidenceScore,
        store.avg_order_value || 1000,
        'pending',
        daysSinceLastOrder > store.avg_days_between_orders ? 'high' : 'medium',
        `Predicted based on ${store.order_count} historical orders. Average order cycle: ${Math.round(store.avg_days_between_orders)} days`,
        'statistical_analysis'
      ]);
      
      // Add predicted order items (top products)
      const topProductsQuery = `
        SELECT 
          p.id,
          p.name,
          AVG(ii.quantity) as avg_quantity,
          p.price
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.id
        JOIN historical_invoices hi ON ii.invoice_id = hi.id
        WHERE hi.store_id = $1
        GROUP BY p.id, p.name, p.price
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `;
      
      const topProducts = await pool.query(topProductsQuery, [store.id]);
      
      for (const product of topProducts.rows) {
        await pool.query(`
          INSERT INTO predicted_order_items (
            predicted_order_id, product_id, quantity, unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [
          predictedOrderId,
          product.id,
          Math.ceil(product.avg_quantity || 10),
          product.price,
          Math.ceil(product.avg_quantity || 10) * product.price
        ]);
      }
    }
  }
  
  const predictedCount = await pool.query('SELECT COUNT(*) FROM predicted_orders');
  console.log(`Total predicted orders created: ${predictedCount.rows[0].count}`);
}

async function createCallPrioritization() {
  // Create call prioritization entries for stores
  const storesQuery = `
    SELECT 
      s.id,
      s.name,
      MAX(hi.invoice_date) as last_order_date,
      COUNT(hi.id) as order_count,
      AVG(hi.total_amount) as avg_order_value
    FROM stores s
    LEFT JOIN historical_invoices hi ON s.id = hi.store_id
    GROUP BY s.id, s.name
    LIMIT 100
  `;
  
  const stores = await pool.query(storesQuery);
  console.log(`Creating call prioritization for ${stores.rows.length} stores`);
  
  for (const store of stores.rows) {
    const daysSinceLastOrder = store.last_order_date 
      ? Math.floor((new Date() - new Date(store.last_order_date)) / (1000 * 60 * 60 * 24))
      : 60;
    
    // Calculate priority score
    let priorityScore = 5;
    let priorityReason = 'Regular follow-up';
    
    if (daysSinceLastOrder > 45) {
      priorityScore = 9;
      priorityReason = `Overdue for order - ${daysSinceLastOrder} days since last order`;
    } else if (daysSinceLastOrder > 30) {
      priorityScore = 7;
      priorityReason = 'Due for reorder';
    } else if (store.avg_order_value > 50000) {
      priorityScore = 8;
      priorityReason = 'High-value customer';
    } else if (store.order_count > 20) {
      priorityScore = 6;
      priorityReason = 'Regular customer';
    }
    
    await pool.query(`
      INSERT INTO call_prioritization (
        id, store_id, priority_score, priority_reason, 
        last_call_date, next_call_date, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        priority_score = $3,
        priority_reason = $4,
        next_call_date = $6,
        status = $7
    `, [
      `CALL-${store.id}`,
      store.id,
      priorityScore,
      priorityReason,
      store.last_order_date,
      new Date(Date.now() + (7 - Math.floor(priorityScore/2)) * 24 * 60 * 60 * 1000), // Next call based on priority
      'pending',
      `${store.order_count} orders, Avg value: $${Math.round(store.avg_order_value || 0)}`
    ]);
  }
  
  const callCount = await pool.query('SELECT COUNT(*) FROM call_prioritization');
  console.log(`Total call prioritizations created: ${callCount.rows[0].count}`);
}

// Run the population
populatePredictions();