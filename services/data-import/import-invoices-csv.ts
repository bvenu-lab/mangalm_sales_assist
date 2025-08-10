import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import { createReadStream } from 'fs';

interface InvoiceCSVRow {
  'Invoice Date': string;
  'Invoice ID': string;
  'Invoice Number': string;
  'Invoice Status': string;
  'Customer Name': string;
  'Customer ID': string;
  'Due Date': string;
  'Product ID': string;
  'Item Name': string;
  'SKU': string;
  'Brand': string;
  'Category Name': string;
  'Quantity': string;
  'Item Price': string;
  'Item Total': string;
  'SubTotal': string;
  'Total': string;
  'Discount': string;
  'Discount Amount': string;
  'Sales Person': string;
  'Billing City': string;
  'Billing State': string;
}

interface ProcessedInvoice {
  id: string;
  store_id: string;
  store_name: string;
  invoice_date: string;
  invoice_number: string;
  total_amount: number;
  payment_status: string;
  items: ProcessedInvoiceItem[];
}

interface ProcessedInvoiceItem {
  product_id: string;
  product_name: string;
  sku: string;
  brand: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount: number;
}

class InvoiceCSVImporter {
  private invoices: Map<string, ProcessedInvoice> = new Map();
  private stores: Map<string, { id: string; name: string; city: string; state: string }> = new Map();
  private products: Map<string, { id: string; name: string; brand: string; category: string }> = new Map();

  /**
   * Import invoices from CSV file
   */
  public async importFromCSV(csvFilePath: string): Promise<void> {
    console.log(`Starting import from: ${csvFilePath}`);
    
    return new Promise((resolve, reject) => {
      let rowCount = 0;
      
      createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row: InvoiceCSVRow) => {
          rowCount++;
          this.processRow(row);
          
          if (rowCount % 1000 === 0) {
            console.log(`Processed ${rowCount} rows...`);
          }
        })
        .on('end', () => {
          console.log(`\nImport completed. Processed ${rowCount} rows.`);
          this.generateSummary();
          resolve();
        })
        .on('error', (error) => {
          console.error('Error reading CSV:', error);
          reject(error);
        });
    });
  }

  /**
   * Process a single CSV row
   */
  private processRow(row: InvoiceCSVRow): void {
    try {
      // Extract store information
      const storeName = row['Customer Name'];
      const storeId = row['Customer ID'];
      
      if (!storeName || !storeId) return;

      // Store the store information
      if (!this.stores.has(storeId)) {
        this.stores.set(storeId, {
          id: storeId,
          name: storeName,
          city: row['Billing City'] || '',
          state: row['Billing State'] || ''
        });
      }

      // Extract product information
      const productId = row['Product ID'];
      const productName = row['Item Name'];
      
      if (productId && productName) {
        if (!this.products.has(productId)) {
          this.products.set(productId, {
            id: productId,
            name: productName,
            brand: row['Brand'] || '',
            category: row['Category Name'] || ''
          });
        }
      }

      // Process invoice
      const invoiceId = row['Invoice ID'];
      const invoiceNumber = row['Invoice Number'];
      
      if (!invoiceId) return;

      // Get or create invoice
      let invoice = this.invoices.get(invoiceId);
      if (!invoice) {
        invoice = {
          id: invoiceId,
          store_id: storeId,
          store_name: storeName,
          invoice_date: this.parseDate(row['Invoice Date']),
          invoice_number: invoiceNumber,
          total_amount: parseFloat(row['Total']) || 0,
          payment_status: row['Invoice Status'] || 'pending',
          items: []
        };
        this.invoices.set(invoiceId, invoice);
      }

      // Add item to invoice
      if (productId && productName) {
        const item: ProcessedInvoiceItem = {
          product_id: productId,
          product_name: productName,
          sku: row['SKU'] || '',
          brand: row['Brand'] || '',
          category: row['Category Name'] || '',
          quantity: parseInt(row['Quantity']) || 0,
          unit_price: parseFloat(row['Item Price']) || 0,
          total_price: parseFloat(row['Item Total']) || 0,
          discount: parseFloat(row['Discount']) || 0
        };
        
        invoice.items.push(item);
      }
    } catch (error) {
      console.error('Error processing row:', error);
    }
  }

  /**
   * Parse date string to ISO format
   */
  private parseDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Generate summary of imported data
   */
  private generateSummary(): void {
    console.log('\n=== Import Summary ===');
    console.log(`Total Stores: ${this.stores.size}`);
    console.log(`Total Products: ${this.products.size}`);
    console.log(`Total Invoices: ${this.invoices.size}`);
    
    // Calculate total items
    let totalItems = 0;
    let totalRevenue = 0;
    
    for (const invoice of this.invoices.values()) {
      totalItems += invoice.items.length;
      totalRevenue += invoice.total_amount;
    }
    
    console.log(`Total Invoice Items: ${totalItems}`);
    console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
    
    // Show date range
    const dates = Array.from(this.invoices.values()).map(inv => new Date(inv.invoice_date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    console.log(`Date Range: ${minDate.toDateString()} to ${maxDate.toDateString()}`);
    
    // Top 5 stores by invoice count
    const storeInvoiceCounts = new Map<string, number>();
    for (const invoice of this.invoices.values()) {
      const count = storeInvoiceCounts.get(invoice.store_name) || 0;
      storeInvoiceCounts.set(invoice.store_name, count + 1);
    }
    
    const topStores = Array.from(storeInvoiceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    console.log('\nTop 5 Stores by Invoice Count:');
    topStores.forEach(([store, count], i) => {
      console.log(`  ${i + 1}. ${store}: ${count} invoices`);
    });
  }

  /**
   * Export data for database insertion
   */
  public exportForDatabase(): {
    stores: any[];
    products: any[];
    invoices: any[];
    invoiceItems: any[];
  } {
    const stores = Array.from(this.stores.values());
    const products = Array.from(this.products.values());
    const invoices = Array.from(this.invoices.values()).map(inv => ({
      id: inv.id,
      store_id: inv.store_id,
      invoice_date: inv.invoice_date,
      invoice_number: inv.invoice_number,
      total_amount: inv.total_amount,
      payment_status: inv.payment_status,
      created_at: new Date().toISOString()
    }));
    
    const invoiceItems: any[] = [];
    for (const invoice of this.invoices.values()) {
      for (const item of invoice.items) {
        invoiceItems.push({
          id: uuidv4(),
          invoice_id: invoice.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          discount: item.discount
        });
      }
    }
    
    return { stores, products, invoices, invoiceItems };
  }

  /**
   * Generate training data for AI prediction model
   */
  public generateTrainingData(): {
    storeMonthlyAggregates: Map<string, any[]>;
    productFrequencies: Map<string, Map<string, number>>;
  } {
    const storeMonthlyAggregates = new Map<string, any[]>();
    const productFrequencies = new Map<string, Map<string, number>>();
    
    // Group invoices by store and month
    for (const invoice of this.invoices.values()) {
      const date = new Date(invoice.invoice_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Store monthly aggregates
      const storeKey = invoice.store_id;
      if (!storeMonthlyAggregates.has(storeKey)) {
        storeMonthlyAggregates.set(storeKey, []);
      }
      
      const monthData = storeMonthlyAggregates.get(storeKey)!.find(m => m.month === monthKey);
      if (monthData) {
        monthData.invoiceCount++;
        monthData.totalRevenue += invoice.total_amount;
        monthData.itemCount += invoice.items.length;
      } else {
        storeMonthlyAggregates.get(storeKey)!.push({
          month: monthKey,
          invoiceCount: 1,
          totalRevenue: invoice.total_amount,
          itemCount: invoice.items.length
        });
      }
      
      // Product frequencies per store
      if (!productFrequencies.has(storeKey)) {
        productFrequencies.set(storeKey, new Map());
      }
      
      const storeProducts = productFrequencies.get(storeKey)!;
      for (const item of invoice.items) {
        const freq = storeProducts.get(item.product_id) || 0;
        storeProducts.set(item.product_id, freq + item.quantity);
      }
    }
    
    return { storeMonthlyAggregates, productFrequencies };
  }
}

// Main execution
async function main() {
  const csvFilePath = path.join(
    'C:\\code\\Dynamo\\dynamo_data\\database\\microservice_migration',
    'docs\\user_journey\\Invoices_Mangalam .csv'
  );
  
  const importer = new InvoiceCSVImporter();
  
  try {
    await importer.importFromCSV(csvFilePath);
    
    // Export data for database
    const dbData = importer.exportForDatabase();
    
    // Save to JSON files for database import
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(outputDir, 'stores.json'),
      JSON.stringify(dbData.stores, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'products.json'),
      JSON.stringify(dbData.products, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'invoices.json'),
      JSON.stringify(dbData.invoices, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'invoice_items.json'),
      JSON.stringify(dbData.invoiceItems, null, 2)
    );
    
    console.log(`\nData exported to ${outputDir}`);
    
    // Generate training data
    const trainingData = importer.generateTrainingData();
    console.log('\n=== Training Data Summary ===');
    console.log(`Stores with monthly data: ${trainingData.storeMonthlyAggregates.size}`);
    console.log(`Stores with product frequencies: ${trainingData.productFrequencies.size}`);
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { InvoiceCSVImporter };