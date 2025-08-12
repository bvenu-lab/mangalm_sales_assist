const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');
const path = require('path');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mangalm_sales',
  password: 'postgres',
  port: 5432,
});

// Function to generate unique store code
function generateStoreCode(name, index) {
  const prefix = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
  return `${prefix}-${String(index).padStart(4, '0')}`;
}

// Import stores from invoice data
async function importStores() {
  console.log('Starting store import...');
  
  try {
    // First, check if stores already exist
    const checkResult = await pool.query('SELECT COUNT(*) FROM stores');
    if (checkResult.rows[0].count > 0) {
      console.log(`Found ${checkResult.rows[0].count} existing stores. Skipping import.`);
      return;
    }

    const stores = new Map();
    const csvPath = path.join(__dirname, '../../user_journey/Invoices_Mangalam .csv');
    
    return new Promise((resolve, reject) => {
      let index = 1;
      
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const customerName = row['Customer Name'];
          const customerId = row['Customer ID'];
          
          if (customerName && !stores.has(customerId)) {
            stores.set(customerId, {
              name: customerName,
              address: row['Billing Address'] || '123 Main St',
              city: row['Billing City'] || 'Portland',
              state: row['Billing State'] || 'Oregon',
              postal_code: row['Billing Code'] || '97201',
              country: row['Billing Country'] || 'U.S.A',
              phone: row['Billing Phone'] || '503-555-0100',
              code: generateStoreCode(customerName, index++),
            });
          }
        })
        .on('end', async () => {
          console.log(`Found ${stores.size} unique stores to import`);
          
          // Insert stores into database
          for (const [customerId, store] of stores) {
            try {
              const query = `
                INSERT INTO stores (
                  name, code, address, city, state, postal_code, country, phone,
                  type, category, size, is_active, primary_contact_name, sales_region
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8,
                  'retail', 'grocery', 'medium', true, 'Store Manager', $9
                )
                ON CONFLICT (code) DO NOTHING
                RETURNING id, name
              `;
              
              const values = [
                store.name,
                store.code,
                store.address,
                store.city,
                store.state,
                store.postal_code,
                store.country,
                store.phone,
                store.state // Use state as region
              ];
              
              const result = await pool.query(query, values);
              if (result.rows.length > 0) {
                console.log(`Imported store: ${result.rows[0].name}`);
              }
            } catch (error) {
              console.error(`Error importing store ${store.name}:`, error.message);
            }
          }
          
          const countResult = await pool.query('SELECT COUNT(*) FROM stores');
          console.log(`Total stores in database: ${countResult.rows[0].count}`);
          resolve();
        })
        .on('error', reject);
    });
  } catch (error) {
    console.error('Error importing stores:', error);
    throw error;
  }
}

// Import products from invoice data
async function importProducts() {
  console.log('Starting product import...');
  
  try {
    // Check if products already exist
    const checkResult = await pool.query('SELECT COUNT(*) FROM products');
    if (checkResult.rows[0].count > 0) {
      console.log(`Found ${checkResult.rows[0].count} existing products. Skipping import.`);
      return;
    }

    const products = new Map();
    const csvPath = path.join(__dirname, '../../user_journey/Invoices_Mangalam .csv');
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const productId = row['Product ID'];
          const itemName = row['Item Name'];
          const sku = row['SKU'];
          const brand = row['Brand'];
          const category = row['Category Name'];
          const price = parseFloat(row['Item Price']) || 0;
          
          if (productId && itemName && !products.has(productId)) {
            products.set(productId, {
              name: itemName,
              sku: sku || `SKU-${productId}`,
              brand: brand || 'Generic',
              category: category || 'General',
              price: price,
            });
          }
        })
        .on('end', async () => {
          console.log(`Found ${products.size} unique products to import`);
          
          // Insert products into database
          for (const [productId, product] of products) {
            try {
              const query = `
                INSERT INTO products (
                  name, sku, brand, category, price, stock_quantity, reorder_point, is_active
                ) VALUES (
                  $1, $2, $3, $4, $5, 100, 20, true
                )
                ON CONFLICT (sku) DO NOTHING
                RETURNING id, name
              `;
              
              const values = [
                product.name,
                product.sku,
                product.brand,
                product.category,
                product.price
              ];
              
              const result = await pool.query(query, values);
              if (result.rows.length > 0) {
                console.log(`Imported product: ${result.rows[0].name}`);
              }
            } catch (error) {
              console.error(`Error importing product ${product.name}:`, error.message);
            }
          }
          
          const countResult = await pool.query('SELECT COUNT(*) FROM products');
          console.log(`Total products in database: ${countResult.rows[0].count}`);
          resolve();
        })
        .on('error', reject);
    });
  } catch (error) {
    console.error('Error importing products:', error);
    throw error;
  }
}

// Main import function
async function main() {
  try {
    console.log('Starting data import process...');
    console.log('Database: mangalm_sales');
    
    // Test database connection
    await pool.query('SELECT 1');
    console.log('Database connection successful');
    
    // Import data
    await importStores();
    await importProducts();
    
    console.log('Data import completed successfully!');
  } catch (error) {
    console.error('Data import failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the import
main();