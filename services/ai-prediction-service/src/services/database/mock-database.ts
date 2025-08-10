import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// Mock database using CSV files from user_journey folder
class MockDatabase {
  private invoicesData: any[] = [];
  private salesOrderData: any[] = [];
  private stores: Map<string, any> = new Map();
  private products: Map<string, any> = new Map();

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      // Load invoices data
      const invoicesPath = path.join(__dirname, '../../../../../user_journey/Invoices_Mangalam .csv');
      if (fs.existsSync(invoicesPath)) {
        const invoicesCSV = fs.readFileSync(invoicesPath, 'utf-8');
        this.invoicesData = parse(invoicesCSV, {
          columns: true,
          skip_empty_lines: true
        });
        console.log(`Loaded ${this.invoicesData.length} invoices from CSV`);
        
        // Extract unique stores and products from invoices
        this.extractStoresAndProducts();
      }

      // Load sales order data if exists
      const salesOrderPath = path.join(__dirname, '../../../../../user_journey/Sales_Order.csv');
      if (fs.existsSync(salesOrderPath)) {
        const salesOrderCSV = fs.readFileSync(salesOrderPath, 'utf-8');
        this.salesOrderData = parse(salesOrderCSV, {
          columns: true,
          skip_empty_lines: true
        });
        console.log(`Loaded ${this.salesOrderData.length} sales orders from CSV`);
      }
    } catch (error) {
      console.error('Error loading CSV data:', error);
    }
  }

  private extractStoresAndProducts() {
    // Extract unique stores from invoice data
    this.invoicesData.forEach(invoice => {
      const storeId = invoice['Customer Name'] || invoice['Bill To Name'];
      if (storeId && !this.stores.has(storeId)) {
        this.stores.set(storeId, {
          id: storeId,
          name: storeId,
          address: invoice['Billing Address'] || '',
          city: invoice['Billing City'] || '',
          state: invoice['Billing State'] || '',
          phone: invoice['Phone'] || '',
          email: invoice['Email'] || '',
          lastOrderDate: invoice['Invoice Date'],
          totalOrders: 0,
          totalRevenue: 0
        });
      }

      // Extract products
      const productName = invoice['Item Name'];
      if (productName && !this.products.has(productName)) {
        this.products.set(productName, {
          id: productName,
          name: productName,
          sku: invoice['SKU'] || '',
          category: invoice['Brand'] || 'General',
          price: parseFloat(invoice['Item Price']) || 0,
          stock: 100 // Default stock
        });
      }
    });

    // Calculate store metrics
    this.invoicesData.forEach(invoice => {
      const storeId = invoice['Customer Name'] || invoice['Bill To Name'];
      if (storeId && this.stores.has(storeId)) {
        const store = this.stores.get(storeId);
        store.totalOrders++;
        store.totalRevenue += parseFloat(invoice['Total']) || 0;
      }
    });
  }

  // Get all stores
  async getStores() {
    return Array.from(this.stores.values());
  }

  // Get store by ID
  async getStoreById(id: string) {
    return this.stores.get(id) || null;
  }

  // Get all products
  async getProducts() {
    return Array.from(this.products.values());
  }

  // Get historical invoices for a store
  async getStoreInvoices(storeId: string) {
    return this.invoicesData.filter(invoice => 
      invoice['Customer Name'] === storeId || invoice['Bill To Name'] === storeId
    );
  }

  // Get predictions (mock data)
  async getPredictions(storeId?: string) {
    const stores = storeId ? [this.stores.get(storeId)] : Array.from(this.stores.values());
    
    return stores.filter(s => s).map(store => ({
      id: `pred_${store.id}`,
      storeId: store.id,
      storeName: store.name,
      predictedOrderDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      predictedAmount: store.totalRevenue / Math.max(store.totalOrders, 1) * 1.1, // 10% increase
      confidence: 0.75 + Math.random() * 0.2, // Random confidence 75-95%
      recommendedProducts: this.getTopProductsForStore(store.id),
      status: 'active'
    }));
  }

  // Get top products for a store
  private getTopProductsForStore(storeId: string) {
    const storeInvoices = this.invoicesData.filter(invoice => 
      invoice['Customer Name'] === storeId || invoice['Bill To Name'] === storeId
    );

    const productCounts = new Map<string, number>();
    storeInvoices.forEach(invoice => {
      const product = invoice['Item Name'];
      if (product) {
        productCounts.set(product, (productCounts.get(product) || 0) + 1);
      }
    });

    return Array.from(productCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([productName]) => {
        const product = this.products.get(productName);
        return {
          productId: productName,
          productName: productName,
          quantity: Math.floor(Math.random() * 10) + 1,
          price: product?.price || 0
        };
      });
  }

  // Get call prioritization list
  async getCallPrioritization() {
    const stores = Array.from(this.stores.values());
    
    return stores.map(store => ({
      id: `call_${store.id}`,
      storeId: store.id,
      storeName: store.name,
      priorityScore: Math.random() * 100,
      lastCallDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      recommendedCallDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      expectedOrderValue: store.totalRevenue / Math.max(store.totalOrders, 1),
      callReason: 'Regular follow-up',
      agentAssigned: 'Admin User'
    })).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  // Get performance metrics
  async getPerformanceMetrics() {
    const totalStores = this.stores.size;
    const totalInvoices = this.invoicesData.length;
    const totalRevenue = Array.from(this.stores.values()).reduce((sum, store) => sum + store.totalRevenue, 0);

    return {
      totalStores,
      totalInvoices,
      totalRevenue,
      averageOrderValue: totalRevenue / Math.max(totalInvoices, 1),
      predictionAccuracy: 0.78 + Math.random() * 0.1, // Mock accuracy 78-88%
      callConversionRate: 0.35 + Math.random() * 0.1, // Mock conversion 35-45%
      topPerformingStores: Array.from(this.stores.values())
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5)
        .map(store => ({
          storeId: store.id,
          storeName: store.name,
          totalRevenue: store.totalRevenue,
          totalOrders: store.totalOrders
        }))
    };
  }
}

// Export singleton instance
export const mockDB = new MockDatabase();
export default mockDB;