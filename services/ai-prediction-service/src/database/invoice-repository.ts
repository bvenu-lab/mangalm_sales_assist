import { db } from './db-connection';
import { logger } from '../utils/logger';
import { invoiceAnalyzer } from '../services/invoice-analyzer';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  storeId: string;
  storeName: string;
  invoiceDate: Date;
  totalAmount: number;
  currency: string;
  status: string;
  items: InvoiceItem[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  productName: string;
  productCode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discount?: number;
  taxAmount?: number;
}

export class InvoiceRepository {
  /**
   * Get all invoices
   */
  async getAll(params?: {
    limit?: number;
    offset?: number;
    storeId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }): Promise<{ data: Invoice[]; total: number }> {
    try {
      let query = `
        SELECT i.*, 
               ARRAY_AGG(
                 JSON_BUILD_OBJECT(
                   'id', ii.id,
                   'invoiceId', ii.invoice_id,
                   'productId', ii.product_id,
                   'productName', ii.product_name,
                   'productCode', ii.product_code,
                   'quantity', ii.quantity,
                   'unitPrice', ii.unit_price,
                   'totalPrice', ii.total_price,
                   'discount', ii.discount,
                   'taxAmount', ii.tax_amount
                 )
               ) as items
        FROM historical_invoices i
        LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
        WHERE 1=1
      `;
      
      let countQuery = 'SELECT COUNT(*) FROM historical_invoices i WHERE 1=1';
      const queryParams: any[] = [];
      const countParams: any[] = [];
      let paramIndex = 1;

      // Add filters
      if (params?.storeId) {
        const storeCondition = ` AND i.store_id = $${paramIndex}`;
        query += storeCondition;
        countQuery += storeCondition;
        queryParams.push(params.storeId);
        countParams.push(params.storeId);
        paramIndex++;
      }

      if (params?.startDate) {
        const dateCondition = ` AND i.invoice_date >= $${paramIndex}`;
        query += dateCondition;
        countQuery += dateCondition;
        queryParams.push(params.startDate);
        countParams.push(params.startDate);
        paramIndex++;
      }

      if (params?.endDate) {
        const dateCondition = ` AND i.invoice_date <= $${paramIndex}`;
        query += dateCondition;
        countQuery += dateCondition;
        queryParams.push(params.endDate);
        countParams.push(params.endDate);
        paramIndex++;
      }

      if (params?.status) {
        const statusCondition = ` AND i.status = $${paramIndex}`;
        query += statusCondition;
        countQuery += statusCondition;
        queryParams.push(params.status);
        countParams.push(params.status);
        paramIndex++;
      }

      // Add grouping and ordering
      query += ` GROUP BY i.id ORDER BY i.invoice_date DESC`;

      // Add pagination
      if (params?.limit) {
        query += ` LIMIT $${paramIndex}`;
        queryParams.push(params.limit);
        paramIndex++;
      }
      if (params?.offset) {
        query += ` OFFSET $${paramIndex}`;
        queryParams.push(params.offset);
        paramIndex++;
      }

      // Execute queries
      const [dataResult, countResult] = await Promise.all([
        db.query(query, queryParams),
        db.query(countQuery, countParams)
      ]);

      const invoices = dataResult.rows.map(this.mapRowToInvoice);
      const total = parseInt(countResult.rows[0].count, 10);

      logger.info('Fetched invoices from database', {
        count: invoices.length,
        total,
        params
      });

      return { data: invoices, total };
    } catch (error) {
      logger.error('Error fetching invoices from database', error);
      throw new Error('Failed to fetch invoices');
    }
  }

  /**
   * Get invoices by store ID
   */
  async getByStoreId(storeId: string, params?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: Invoice[]; total: number }> {
    try {
      // Try to get from database first
      const dbResult = await this.getAll({ ...params, storeId }).catch(() => null);
      if (dbResult && dbResult.data.length > 0) {
        return dbResult;
      }

      // Fallback to CSV analysis
      const analytics = invoiceAnalyzer.getStoreAnalytics(storeId);
      if (!analytics) {
        return { data: [], total: 0 };
      }

      // Convert analytics order history to Invoice format
      const invoices: Invoice[] = analytics.orderHistory
        .slice(params?.offset || 0, (params?.offset || 0) + (params?.limit || 50))
        .map(order => ({
          id: order.invoiceId,
          invoiceNumber: order.invoiceNumber,
          customerId: analytics.storeId,
          customerName: analytics.storeName,
          storeId: analytics.storeId,
          storeName: analytics.storeName,
          invoiceDate: new Date(order.date),
          totalAmount: order.total,
          currency: 'USD',
          status: 'completed',
          items: order.products.map((product, idx) => ({
            id: `${order.invoiceId}_${idx}`,
            invoiceId: order.invoiceId,
            productId: product.name.replace(/[^a-zA-Z0-9]/g, '-'),
            productName: product.name,
            productCode: product.brand,
            quantity: product.quantity,
            unitPrice: product.price,
            totalPrice: product.total,
            discount: 0,
            taxAmount: 0
          })),
          createdAt: new Date(order.date),
          updatedAt: new Date(order.date)
        }));

      logger.info(`Retrieved ${invoices.length} invoices from CSV analysis for store ${storeId}`);
      return { data: invoices, total: analytics.totalInvoices };
    } catch (error) {
      logger.error('Error fetching invoices for store', error);
      return { data: [], total: 0 };
    }
  }

  /**
   * Get recent invoices
   */
  async getRecent(limit: number = 10): Promise<Invoice[]> {
    try {
      // Try database first
      const query = `
        SELECT i.*, 
               ARRAY_AGG(
                 JSON_BUILD_OBJECT(
                   'id', ii.id,
                   'invoiceId', ii.invoice_id,
                   'productId', ii.product_id,
                   'productName', ii.product_name,
                   'productCode', ii.product_code,
                   'quantity', ii.quantity,
                   'unitPrice', ii.unit_price,
                   'totalPrice', ii.total_price,
                   'discount', ii.discount,
                   'taxAmount', ii.tax_amount
                 )
               ) as items
        FROM historical_invoices i
        LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
        GROUP BY i.id
        ORDER BY i.invoice_date DESC
        LIMIT $1
      `;
      
      const result = await db.query(query, [limit]);
      return result.rows.map(this.mapRowToInvoice);
    } catch (error) {
      logger.error('Error fetching recent invoices', error);
      throw new Error('Failed to fetch recent invoices');
    }
  }

  /**
   * Get invoice by ID
   */
  async getById(id: string): Promise<Invoice | null> {
    try {
      const query = `
        SELECT i.*, 
               ARRAY_AGG(
                 JSON_BUILD_OBJECT(
                   'id', ii.id,
                   'invoiceId', ii.invoice_id,
                   'productId', ii.product_id,
                   'productName', ii.product_name,
                   'productCode', ii.product_code,
                   'quantity', ii.quantity,
                   'unitPrice', ii.unit_price,
                   'totalPrice', ii.total_price,
                   'discount', ii.discount,
                   'taxAmount', ii.tax_amount
                 )
               ) as items
        FROM historical_invoices i
        LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
        WHERE i.id = $1
        GROUP BY i.id
      `;
      
      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToInvoice(result.rows[0]);
    } catch (error) {
      logger.error(`Error fetching invoice with id ${id}`, error);
      throw new Error('Failed to fetch invoice');
    }
  }

  /**
   * Map database row to Invoice object
   */
  private mapRowToInvoice(row: any): Invoice {
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      storeId: row.store_id,
      storeName: row.store_name,
      invoiceDate: row.invoice_date,
      totalAmount: parseFloat(row.total_amount),
      currency: row.currency || 'INR',
      status: row.status || 'completed',
      items: row.items ? row.items.filter((item: any) => item.id) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export singleton instance
export const invoiceRepository = new InvoiceRepository();