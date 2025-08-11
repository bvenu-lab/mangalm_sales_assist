const fs = require('fs');
const path = require('path');
import { parse } from 'csv-parse/sync';
import { logger } from '../utils/logger';

interface InvoiceData {
  'Invoice Date': string;
  'Invoice ID': string;
  'Invoice Number': string;
  'Customer Name': string;
  'Customer ID': string;
  'Item Name': string;
  'SKU': string;
  'Brand': string;
  'Quantity': string;
  'Item Price': string;
  'Item Total': string;
  'Total': string;
  'Billing City': string;
  'Billing State': string;
  'Billing Country': string;
  'Billing Phone': string;
}

interface StoreAnalytics {
  storeId: string;
  storeName: string;
  totalInvoices: number;
  totalRevenue: number;
  totalProducts: number;
  firstOrderDate: string;
  lastOrderDate: string;
  averageOrderValue: number;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
    frequency: number;
  }>;
  orderHistory: Array<{
    invoiceId: string;
    invoiceNumber: string;
    date: string;
    total: number;
    itemCount: number;
    products: Array<{
      name: string;
      brand: string;
      quantity: number;
      price: number;
      total: number;
    }>;
  }>;
  predictedProducts: Array<{
    productId: string;
    productName: string;
    brand: string;
    averageQuantity: number;
    reorderFrequency: number;
    lastOrderDate: string;
    predictedNextOrder: string;
    confidence: number;
  }>;
  contactInfo: {
    city?: string;
    state?: string;
    country?: string;
    phone?: string;
  };
}

export class InvoiceAnalyzer {
  private invoicesData: InvoiceData[] = [];
  private storeAnalytics: Map<string, StoreAnalytics> = new Map();

  constructor() {
    this.loadAndAnalyzeData();
  }

  private loadAndAnalyzeData() {
    try {
      // Use process.cwd() for better compatibility
      const invoicesPath = path.join(process.cwd(), 'user_journey/Invoices_Mangalam .csv');
      if (fs.existsSync(invoicesPath)) {
        const csvContent = fs.readFileSync(invoicesPath, 'utf-8');
        this.invoicesData = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          relax_quotes: true,
          relax_column_count: true
        });
        
        logger.info(`Loaded ${this.invoicesData.length} invoice records`);
        this.analyzeStores();
      }
    } catch (error) {
      logger.error('Error loading invoice data:', error);
    }
  }

  private analyzeStores() {
    const storeMap = new Map<string, InvoiceData[]>();
    
    // Group invoices by customer (store)
    this.invoicesData.forEach(invoice => {
      const customerName = invoice['Customer Name'];
      if (customerName) {
        if (!storeMap.has(customerName)) {
          storeMap.set(customerName, []);
        }
        storeMap.get(customerName)!.push(invoice);
      }
    });

    // Analyze each store
    storeMap.forEach((invoices, storeName) => {
      const analytics = this.analyzeStore(storeName, invoices);
      this.storeAnalytics.set(analytics.storeId, analytics);
    });

    logger.info(`Analyzed ${this.storeAnalytics.size} stores`);
  }

  private analyzeStore(storeName: string, invoices: InvoiceData[]): StoreAnalytics {
    // Group invoices by invoice ID to consolidate line items
    const invoiceGroups = new Map<string, InvoiceData[]>();
    invoices.forEach(invoice => {
      const invoiceId = invoice['Invoice ID'];
      if (!invoiceGroups.has(invoiceId)) {
        invoiceGroups.set(invoiceId, []);
      }
      invoiceGroups.get(invoiceId)!.push(invoice);
    });

    // Calculate product statistics
    const productStats = new Map<string, {
      quantity: number;
      revenue: number;
      frequency: number;
      brand: string;
      lastOrderDate: string;
      orderDates: string[];
    }>();

    const orderHistory: StoreAnalytics['orderHistory'] = [];
    let totalRevenue = 0;
    let firstOrderDate = '';
    let lastOrderDate = '';

    // Process each invoice
    invoiceGroups.forEach((items, invoiceId) => {
      const firstItem = items[0];
      const invoiceDate = firstItem['Invoice Date'];
      const invoiceTotal = parseFloat(firstItem['Total'] || '0');
      
      if (!firstOrderDate || invoiceDate < firstOrderDate) {
        firstOrderDate = invoiceDate;
      }
      if (!lastOrderDate || invoiceDate > lastOrderDate) {
        lastOrderDate = invoiceDate;
      }

      const products = items.map(item => {
        const productName = item['Item Name'];
        const quantity = parseFloat(item['Quantity'] || '0');
        const price = parseFloat(item['Item Price'] || '0');
        const itemTotal = parseFloat(item['Item Total'] || '0');
        const brand = item['Brand'] || '';

        // Update product statistics
        if (productName) {
          if (!productStats.has(productName)) {
            productStats.set(productName, {
              quantity: 0,
              revenue: 0,
              frequency: 0,
              brand: brand,
              lastOrderDate: invoiceDate,
              orderDates: []
            });
          }
          const stats = productStats.get(productName)!;
          stats.quantity += quantity;
          stats.revenue += itemTotal;
          stats.frequency += 1;
          stats.orderDates.push(invoiceDate);
          if (invoiceDate > stats.lastOrderDate) {
            stats.lastOrderDate = invoiceDate;
          }
        }

        return {
          name: productName,
          brand: brand,
          quantity: quantity,
          price: price,
          total: itemTotal
        };
      });

      orderHistory.push({
        invoiceId: invoiceId,
        invoiceNumber: firstItem['Invoice Number'],
        date: invoiceDate,
        total: invoiceTotal,
        itemCount: items.length,
        products: products
      });

      totalRevenue += invoiceTotal;
    });

    // Sort order history by date (most recent first)
    orderHistory.sort((a, b) => b.date.localeCompare(a.date));

    // Get top products
    const topProducts = Array.from(productStats.entries())
      .map(([name, stats]) => ({
        name,
        quantity: stats.quantity,
        revenue: stats.revenue,
        frequency: stats.frequency
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Generate predicted products based on purchase patterns
    const predictedProducts = Array.from(productStats.entries())
      .filter(([_, stats]) => stats.frequency >= 2) // Only predict for products ordered at least twice
      .map(([name, stats]) => {
        // Calculate average days between orders
        const dates = stats.orderDates.sort();
        let totalDays = 0;
        let intervals = 0;
        
        for (let i = 1; i < dates.length; i++) {
          const days = this.daysBetween(dates[i-1], dates[i]);
          if (days > 0) {
            totalDays += days;
            intervals++;
          }
        }
        
        const avgDaysBetween = intervals > 0 ? totalDays / intervals : 30;
        const daysSinceLastOrder = this.daysBetween(stats.lastOrderDate, new Date().toISOString().split('T')[0]);
        const daysUntilNextOrder = Math.max(0, avgDaysBetween - daysSinceLastOrder);
        const nextOrderDate = new Date();
        nextOrderDate.setDate(nextOrderDate.getDate() + daysUntilNextOrder);
        
        // Calculate confidence based on order frequency consistency
        const confidence = Math.min(0.95, 0.5 + (stats.frequency * 0.1));

        return {
          productId: name.replace(/[^a-zA-Z0-9]/g, '-'),
          productName: name,
          brand: stats.brand,
          averageQuantity: Math.round(stats.quantity / stats.frequency),
          reorderFrequency: Math.round(avgDaysBetween),
          lastOrderDate: stats.lastOrderDate,
          predictedNextOrder: nextOrderDate.toISOString().split('T')[0],
          confidence: confidence
        };
      })
      .sort((a, b) => a.predictedNextOrder.localeCompare(b.predictedNextOrder))
      .slice(0, 15);

    // Get contact info from first invoice
    const firstInvoice = invoices[0];
    const contactInfo = {
      city: firstInvoice['Billing City'] || undefined,
      state: firstInvoice['Billing State'] || undefined,
      country: firstInvoice['Billing Country'] || undefined,
      phone: firstInvoice['Billing Phone'] || undefined
    };

    return {
      storeId: firstInvoice['Customer ID'] || storeName.replace(/[^a-zA-Z0-9]/g, '-'),
      storeName: storeName,
      totalInvoices: invoiceGroups.size,
      totalRevenue: totalRevenue,
      totalProducts: productStats.size,
      firstOrderDate: firstOrderDate,
      lastOrderDate: lastOrderDate,
      averageOrderValue: totalRevenue / Math.max(invoiceGroups.size, 1),
      topProducts: topProducts,
      orderHistory: orderHistory.slice(0, 50), // Limit to 50 most recent orders
      predictedProducts: predictedProducts,
      contactInfo: contactInfo
    };
  }

  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public getStoreAnalytics(storeId: string): StoreAnalytics | undefined {
    return this.storeAnalytics.get(storeId);
  }

  public getAllStores(): Array<{ storeId: string; storeName: string; totalRevenue: number; totalInvoices: number }> {
    return Array.from(this.storeAnalytics.values()).map(analytics => ({
      storeId: analytics.storeId,
      storeName: analytics.storeName,
      totalRevenue: analytics.totalRevenue,
      totalInvoices: analytics.totalInvoices
    }));
  }

  public generatePredictions(storeId: string) {
    const analytics = this.storeAnalytics.get(storeId);
    if (!analytics) return null;

    // Calculate next predicted order date based on average ordering frequency
    const orderDates = analytics.orderHistory.map(o => o.date).sort();
    let avgDaysBetween = 14; // Default to 2 weeks
    
    if (orderDates.length >= 2) {
      let totalDays = 0;
      for (let i = 1; i < Math.min(orderDates.length, 10); i++) {
        totalDays += this.daysBetween(orderDates[i-1], orderDates[i]);
      }
      avgDaysBetween = totalDays / Math.min(orderDates.length - 1, 9);
    }

    const daysSinceLastOrder = this.daysBetween(analytics.lastOrderDate, new Date().toISOString().split('T')[0]);
    const daysUntilNextOrder = Math.max(1, avgDaysBetween - daysSinceLastOrder);
    const predictedDate = new Date();
    predictedDate.setDate(predictedDate.getDate() + daysUntilNextOrder);

    // Select top products for recommendation
    const recommendedProducts = analytics.predictedProducts.slice(0, 10).map(p => ({
      productId: p.productId,
      productName: p.productName,
      quantity: p.averageQuantity,
      confidence: p.confidence,
      reason: `Ordered ${p.reorderFrequency} times, typically every ${p.reorderFrequency} days`
    }));

    // Calculate confidence score based on order history consistency
    const baseConfidence = Math.min(0.9, 0.4 + (analytics.totalInvoices * 0.02));
    
    return {
      storeId: analytics.storeId,
      storeName: analytics.storeName,
      predictedOrderDate: predictedDate.toISOString(),
      predictedAmount: analytics.averageOrderValue * 1.05, // 5% growth factor
      confidence: baseConfidence,
      priority: daysSinceLastOrder > avgDaysBetween * 1.5 ? 'high' : 
               daysSinceLastOrder > avgDaysBetween ? 'medium' : 'low',
      recommendedProducts: recommendedProducts,
      analysisNotes: `Based on ${analytics.totalInvoices} historical orders with average frequency of ${Math.round(avgDaysBetween)} days`,
      historicalMetrics: {
        avgOrderValue: analytics.averageOrderValue,
        totalRevenue: analytics.totalRevenue,
        orderFrequency: avgDaysBetween,
        lastOrderDaysAgo: daysSinceLastOrder
      }
    };
  }
}

// Export singleton instance
export const invoiceAnalyzer = new InvoiceAnalyzer();