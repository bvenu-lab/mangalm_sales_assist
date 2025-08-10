import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { InvoiceCSVImporter } from './import-invoices-csv';

/**
 * Database importer for Mangalm invoice data
 */
class DatabaseImporter {
  private client: Client;
  
  constructor() {
    // Configure PostgreSQL connection
    this.client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'mangalm_sales',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    });
  }

  /**
   * Connect to database
   */
  async connect(): Promise<void> {
    await this.client.connect();
    console.log('Connected to PostgreSQL database');
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    await this.client.end();
    console.log('Disconnected from database');
  }

  /**
   * Import stores into database
   */
  async importStores(stores: any[]): Promise<void> {
    console.log(`\nImporting ${stores.length} stores...`);
    
    for (const store of stores) {
      try {
        await this.client.query(
          `INSERT INTO stores (id, name, city, state, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               city = EXCLUDED.city,
               state = EXCLUDED.state`,
          [store.id, store.name, store.city, store.state, new Date()]
        );
      } catch (error) {
        console.error(`Error importing store ${store.name}:`, error);
      }
    }
    
    console.log('Stores imported successfully');
  }

  /**
   * Import products into database
   */
  async importProducts(products: any[]): Promise<void> {
    console.log(`\nImporting ${products.length} products...`);
    
    for (const product of products) {
      try {
        await this.client.query(
          `INSERT INTO products (id, name, brand, category, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               brand = EXCLUDED.brand,
               category = EXCLUDED.category`,
          [product.id, product.name, product.brand, product.category, new Date()]
        );
      } catch (error) {
        console.error(`Error importing product ${product.name}:`, error);
      }
    }
    
    console.log('Products imported successfully');
  }

  /**
   * Import historical invoices into database
   */
  async importInvoices(invoices: any[]): Promise<void> {
    console.log(`\nImporting ${invoices.length} invoices...`);
    
    let imported = 0;
    for (const invoice of invoices) {
      try {
        await this.client.query(
          `INSERT INTO historical_invoices 
           (id, store_id, invoice_date, total_amount, payment_status, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE
           SET total_amount = EXCLUDED.total_amount,
               payment_status = EXCLUDED.payment_status`,
          [
            invoice.id,
            invoice.store_id,
            invoice.invoice_date,
            invoice.total_amount,
            invoice.payment_status,
            invoice.invoice_number,
            invoice.created_at
          ]
        );
        
        imported++;
        if (imported % 100 === 0) {
          console.log(`  Imported ${imported}/${invoices.length} invoices...`);
        }
      } catch (error) {
        console.error(`Error importing invoice ${invoice.id}:`, error);
      }
    }
    
    console.log(`Invoices imported successfully (${imported}/${invoices.length})`);
  }

  /**
   * Import invoice items into database
   */
  async importInvoiceItems(items: any[]): Promise<void> {
    console.log(`\nImporting ${items.length} invoice items...`);
    
    let imported = 0;
    for (const item of items) {
      try {
        await this.client.query(
          `INSERT INTO invoice_items 
           (id, invoice_id, product_id, quantity, unit_price, discount, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            item.id,
            item.invoice_id,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.discount,
            item.total_price
          ]
        );
        
        imported++;
        if (imported % 1000 === 0) {
          console.log(`  Imported ${imported}/${items.length} items...`);
        }
      } catch (error) {
        // Silently skip duplicates
        if (!error.message.includes('duplicate key')) {
          console.error(`Error importing invoice item:`, error);
        }
      }
    }
    
    console.log(`Invoice items imported successfully (${imported}/${items.length})`);
  }

  /**
   * Create database tables if they don't exist
   */
  async createTables(): Promise<void> {
    console.log('\nCreating database tables if not exists...');
    
    // Create stores table
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(255),
        state VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create products table
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(255),
        category VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create historical_invoices table
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS historical_invoices (
        id VARCHAR(255) PRIMARY KEY,
        store_id VARCHAR(255) REFERENCES stores(id),
        invoice_date TIMESTAMP NOT NULL,
        total_amount DECIMAL(10, 2),
        payment_status VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create invoice_items table
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id VARCHAR(255) PRIMARY KEY,
        invoice_id VARCHAR(255) REFERENCES historical_invoices(id),
        product_id VARCHAR(255) REFERENCES products(id),
        quantity INTEGER,
        unit_price DECIMAL(10, 2),
        discount DECIMAL(10, 2),
        total_price DECIMAL(10, 2)
      )
    `);
    
    // Create indexes for better query performance
    await this.client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_store_id ON historical_invoices(store_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_date ON historical_invoices(invoice_date);
      CREATE INDEX IF NOT EXISTS idx_items_invoice_id ON invoice_items(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_items_product_id ON invoice_items(product_id);
    `);
    
    console.log('Database tables created successfully');
  }

  /**
   * Generate and store analytics data
   */
  async generateAnalytics(): Promise<void> {
    console.log('\n=== Generating Analytics ===');
    
    // Store-level analytics
    const storeAnalytics = await this.client.query(`
      SELECT 
        s.name as store_name,
        COUNT(DISTINCT hi.id) as invoice_count,
        SUM(hi.total_amount) as total_revenue,
        AVG(hi.total_amount) as avg_invoice_value,
        MIN(hi.invoice_date) as first_invoice,
        MAX(hi.invoice_date) as last_invoice
      FROM stores s
      LEFT JOIN historical_invoices hi ON s.id = hi.store_id
      GROUP BY s.id, s.name
      ORDER BY total_revenue DESC NULLS LAST
      LIMIT 10
    `);
    
    console.log('\nTop 10 Stores by Revenue:');
    storeAnalytics.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.store_name}: $${parseFloat(row.total_revenue || 0).toFixed(2)} (${row.invoice_count} invoices)`);
    });
    
    // Product analytics
    const productAnalytics = await this.client.query(`
      SELECT 
        p.name as product_name,
        p.brand,
        COUNT(DISTINCT ii.invoice_id) as order_count,
        SUM(ii.quantity) as total_quantity,
        SUM(ii.total_price) as total_revenue
      FROM products p
      LEFT JOIN invoice_items ii ON p.id = ii.product_id
      GROUP BY p.id, p.name, p.brand
      ORDER BY total_revenue DESC NULLS LAST
      LIMIT 10
    `);
    
    console.log('\nTop 10 Products by Revenue:');
    productAnalytics.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.product_name} (${row.brand}): $${parseFloat(row.total_revenue || 0).toFixed(2)} (${row.total_quantity} units)`);
    });
    
    // Monthly trends
    const monthlyTrends = await this.client.query(`
      SELECT 
        DATE_TRUNC('month', invoice_date) as month,
        COUNT(*) as invoice_count,
        SUM(total_amount) as revenue
      FROM historical_invoices
      GROUP BY DATE_TRUNC('month', invoice_date)
      ORDER BY month DESC
      LIMIT 12
    `);
    
    console.log('\nMonthly Revenue Trends (Last 12 months):');
    monthlyTrends.rows.forEach(row => {
      const month = new Date(row.month).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      console.log(`  ${month}: $${parseFloat(row.revenue || 0).toFixed(2)} (${row.invoice_count} invoices)`);
    });
  }
}

// Main execution
async function main() {
  const csvFilePath = path.join(
    'C:\\code\\Dynamo\\dynamo_data\\database\\microservice_migration',
    'docs\\user_journey\\Invoices_Mangalam .csv'
  );
  
  const csvImporter = new InvoiceCSVImporter();
  const dbImporter = new DatabaseImporter();
  
  try {
    // Step 1: Import from CSV
    console.log('Step 1: Importing from CSV file...');
    await csvImporter.importFromCSV(csvFilePath);
    
    // Step 2: Get parsed data
    const data = csvImporter.exportForDatabase();
    
    // Step 3: Connect to database
    console.log('\nStep 2: Connecting to database...');
    await dbImporter.connect();
    
    // Step 4: Create tables
    await dbImporter.createTables();
    
    // Step 5: Import data
    console.log('\nStep 3: Importing data to database...');
    await dbImporter.importStores(data.stores);
    await dbImporter.importProducts(data.products);
    await dbImporter.importInvoices(data.invoices);
    await dbImporter.importInvoiceItems(data.invoiceItems);
    
    // Step 6: Generate analytics
    await dbImporter.generateAnalytics();
    
    console.log('\n✅ Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await dbImporter.disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { DatabaseImporter };