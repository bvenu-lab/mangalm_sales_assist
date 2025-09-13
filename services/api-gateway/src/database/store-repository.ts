import { db } from './db-connection';
import { logger } from '../utils/logger';

export interface Store {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  region?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  storeSize?: string;
  callFrequency?: string;
  createdAt: Date;
  updatedAt?: Date;
  // Statistics fields
  orderCount?: number;
  lastOrderDate?: Date;
  totalRevenue?: number;
}

export class StoreRepository {
  /**
   * Get all stores
   */
  async getAll(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    region?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: Store[]; total: number }> {
    try {
      let query = `
        SELECT
          s.*,
          COUNT(DISTINCT mi.invoice_number) as order_count,
          MAX(mi.invoice_date) as last_order_date,
          SUM(mi.total) as total_revenue
        FROM stores s
        LEFT JOIN mangalam_invoices mi ON LOWER(TRIM(s.name)) = LOWER(TRIM(mi.customer_name))
        WHERE 1=1
      `;
      let countQuery = 'SELECT COUNT(DISTINCT s.id) FROM stores s WHERE 1=1';
      const queryParams: any[] = [];
      const countParams: any[] = [];
      let paramIndex = 1;

      // Add search filter
      if (params?.search) {
        const searchCondition = ` AND (
          LOWER(s.name) LIKE $${paramIndex} OR 
          LOWER(COALESCE(s.address, '')) LIKE $${paramIndex}
        )`;
        query += searchCondition;
        countQuery += searchCondition;
        const searchValue = `%${params.search.toLowerCase()}%`;
        queryParams.push(searchValue);
        countParams.push(searchValue);
        paramIndex++;
      }

      // Add region filter (using state column)
      if (params?.region && params.region !== 'all') {
        query += ` AND COALESCE(s.address, '') = $${paramIndex}`;
        countQuery += ` AND COALESCE(s.address, '') = $${paramIndex}`;
        queryParams.push(params.region);
        countParams.push(params.region);
        paramIndex++;
      }

      // Add GROUP BY before sorting
      query += ` GROUP BY s.id`;
      
      // Add sorting
      const sortBy = params?.sortBy || 's.created_at';
      const sortOrder = params?.sortOrder || 'desc';
      // Adjust sort field to include table prefix
      const adjustedSortBy = sortBy.includes('.') ? sortBy : `s.${sortBy}`;
      query += ` ORDER BY ${adjustedSortBy} ${sortOrder.toUpperCase()}`;

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

      logger.info('Store query executed', {
        query: query.substring(0, 200),
        params: queryParams,
        rowCount: dataResult.rowCount,
        firstRow: dataResult.rows[0]
      });

      const stores = dataResult.rows.map(this.mapRowToStore);
      const total = parseInt(countResult.rows[0].count, 10);

      logger.info('Fetched stores from database', {
        count: stores.length,
        total,
        params
      });

      return { data: stores, total };
    } catch (error) {
      logger.error('Error fetching stores from database', error);
      throw new Error('Failed to fetch stores');
    }
  }

  /**
   * Get store by ID
   */
  async getById(id: string): Promise<Store | null> {
    try {
      const query = `
        SELECT
          s.*,
          COUNT(DISTINCT mi.invoice_number) as order_count,
          MAX(mi.invoice_date) as last_order_date,
          SUM(mi.total) as total_revenue
        FROM stores s
        LEFT JOIN mangalam_invoices mi ON LOWER(TRIM(s.name)) = LOWER(TRIM(mi.customer_name))
        WHERE s.id = $1
        GROUP BY s.id
      `;
      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToStore(result.rows[0]);
    } catch (error) {
      logger.error(`Error fetching store with id ${id}`, error);
      throw new Error('Failed to fetch store');
    }
  }

  /**
   * Get recent stores
   */
  async getRecent(limit: number = 5): Promise<Store[]> {
    try {
      const query = 'SELECT * FROM stores ORDER BY created_at DESC LIMIT $1';
      const result = await db.query(query, [limit]);
      
      return result.rows.map(this.mapRowToStore);
    } catch (error) {
      logger.error('Error fetching recent stores', error);
      throw new Error('Failed to fetch recent stores');
    }
  }

  /**
   * Create a new store
   */
  async create(store: Partial<Store>): Promise<Store> {
    try {
      const query = `
        INSERT INTO stores (name, city, state)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const values = [
        store.name,
        store.city || '',
        store.state || store.region || ''
      ];

      const result = await db.query(query, values);
      return this.mapRowToStore(result.rows[0]);
    } catch (error) {
      logger.error('Error creating store', error);
      throw new Error('Failed to create store');
    }
  }

  /**
   * Update a store
   */
  async update(id: string, store: Partial<Store>): Promise<Store> {
    try {
      const query = `
        UPDATE stores
        SET name = COALESCE($2, name),
            city = COALESCE($3, city),
            state = COALESCE($4, state)
        WHERE id = $1
        RETURNING *
      `;
      const values = [
        id,
        store.name,
        store.city,
        store.state || store.region
      ];

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Store not found');
      }

      return this.mapRowToStore(result.rows[0]);
    } catch (error) {
      logger.error(`Error updating store with id ${id}`, error);
      throw new Error('Failed to update store');
    }
  }

  /**
   * Delete a store
   */
  async delete(id: string): Promise<boolean> {
    try {
      const query = 'DELETE FROM stores WHERE id = $1';
      const result = await db.query(query, [id]);
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting store with id ${id}`, error);
      throw new Error('Failed to delete store');
    }
  }

  /**
   * Get unique regions
   */
  async getRegions(): Promise<string[]> {
    try {
      const query = 'SELECT DISTINCT state FROM stores WHERE state IS NOT NULL AND state != \'\' ORDER BY state';
      const result = await db.query(query);
      
      return result.rows.map((row: any) => row.state);
    } catch (error) {
      logger.error('Error fetching regions', error);
      throw new Error('Failed to fetch regions');
    }
  }

  /**
   * Map database row to Store object
   */
  private mapRowToStore(row: any): Store {
    // Parse order statistics - PostgreSQL returns these as strings
    const orderCount = row.order_count ? parseInt(row.order_count, 10) : 0;
    const totalRevenue = row.total_revenue ? parseFloat(row.total_revenue) : 0;
    
    // Log the mapping for debugging
    if (row.order_count !== undefined) {
      logger.info('Mapping store statistics', {
        id: row.id,
        name: row.name,
        raw_order_count: row.order_count,
        parsed_order_count: orderCount,
        raw_total_revenue: row.total_revenue,
        parsed_total_revenue: totalRevenue,
        last_order_date: row.last_order_date
      });
    }
    
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      region: row.state || row.sales_region, // Map state to region for compatibility
      phone: row.phone,
      email: row.email || `store${row.id}@example.com`, // Generate default email if missing
      contactPerson: row.primary_contact_name || row.contact_person || 'Store Manager',
      storeSize: row.store_size || row.size || 'Medium',
      callFrequency: row.call_frequency || 'Weekly',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Add new statistics fields with proper parsing
      orderCount: orderCount,
      lastOrderDate: row.last_order_date,
      totalRevenue: totalRevenue
    };
  }
}

// Export singleton instance
export const storeRepository = new StoreRepository();