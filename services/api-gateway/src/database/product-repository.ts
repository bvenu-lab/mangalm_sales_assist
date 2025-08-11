import { db } from './db-connection';
import { logger } from '../utils/logger';

export interface Product {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  subCategory?: string;
  brand?: string;
  unitPrice?: number;
  unitOfMeasure?: string;
  packSize?: number;
  minOrderQuantity?: number;
  description?: string;
  isActive?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export class ProductRepository {
  /**
   * Get all products
   */
  async getAll(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    category?: string;
    brand?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: Product[]; total: number }> {
    try {
      let query = 'SELECT * FROM products WHERE 1=1';
      let countQuery = 'SELECT COUNT(*) FROM products WHERE 1=1';
      const queryParams: any[] = [];
      const countParams: any[] = [];
      let paramIndex = 1;

      // Add search filter
      if (params?.search) {
        const searchCondition = ` AND (
          LOWER(name) LIKE $${paramIndex} OR 
          LOWER(COALESCE(category, '')) LIKE $${paramIndex} OR 
          LOWER(COALESCE(brand, '')) LIKE $${paramIndex}
        )`;
        query += searchCondition;
        countQuery += searchCondition;
        const searchValue = `%${params.search.toLowerCase()}%`;
        queryParams.push(searchValue);
        countParams.push(searchValue);
        paramIndex++;
      }

      // Add category filter
      if (params?.category) {
        query += ` AND category = $${paramIndex}`;
        countQuery += ` AND category = $${paramIndex}`;
        queryParams.push(params.category);
        countParams.push(params.category);
        paramIndex++;
      }

      // Add brand filter
      if (params?.brand) {
        query += ` AND brand = $${paramIndex}`;
        countQuery += ` AND brand = $${paramIndex}`;
        queryParams.push(params.brand);
        countParams.push(params.brand);
        paramIndex++;
      }

      // Add active filter
      if (params?.isActive !== undefined) {
        query += ` AND is_active = $${paramIndex}`;
        countQuery += ` AND is_active = $${paramIndex}`;
        queryParams.push(params.isActive);
        countParams.push(params.isActive);
        paramIndex++;
      }

      // Add sorting
      const sortBy = params?.sortBy || 'created_at';
      const sortOrder = params?.sortOrder || 'desc';
      query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

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

      const products = dataResult.rows.map(this.mapRowToProduct);
      const total = parseInt(countResult.rows[0].count, 10);

      logger.info('Fetched products from database', {
        count: products.length,
        total,
        params
      });

      return { data: products, total };
    } catch (error) {
      logger.error('Error fetching products from database', error);
      throw new Error('Failed to fetch products');
    }
  }

  /**
   * Get product by ID
   */
  async getById(id: string): Promise<Product | null> {
    try {
      const query = 'SELECT * FROM products WHERE id = $1';
      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToProduct(result.rows[0]);
    } catch (error) {
      logger.error(`Error fetching product with id ${id}`, error);
      throw new Error('Failed to fetch product');
    }
  }

  /**
   * Get products by category
   */
  async getByCategory(category: string, limit?: number): Promise<Product[]> {
    try {
      let query = 'SELECT * FROM products WHERE category = $1 AND is_active = true ORDER BY name';
      const params: any[] = [category];
      
      if (limit) {
        query += ' LIMIT $2';
        params.push(limit);
      }
      
      const result = await db.query(query, params);
      return result.rows.map(this.mapRowToProduct);
    } catch (error) {
      logger.error(`Error fetching products by category ${category}`, error);
      throw new Error('Failed to fetch products by category');
    }
  }

  /**
   * Get unique categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const query = 'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category';
      const result = await db.query(query);
      
      return result.rows.map((row: any) => row.category);
    } catch (error) {
      logger.error('Error fetching categories', error);
      throw new Error('Failed to fetch categories');
    }
  }

  /**
   * Get unique brands
   */
  async getBrands(): Promise<string[]> {
    try {
      const query = 'SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL ORDER BY brand';
      const result = await db.query(query);
      
      return result.rows.map((row: any) => row.brand);
    } catch (error) {
      logger.error('Error fetching brands', error);
      throw new Error('Failed to fetch brands');
    }
  }

  /**
   * Create a new product
   */
  async create(product: Partial<Product>): Promise<Product> {
    try {
      const query = `
        INSERT INTO products (
          name, sku, category, sub_category, brand, 
          unit_price, unit_of_measure, pack_size, 
          min_order_quantity, description, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      const values = [
        product.name,
        product.sku,
        product.category,
        product.subCategory,
        product.brand,
        product.unitPrice,
        product.unitOfMeasure,
        product.packSize,
        product.minOrderQuantity,
        product.description,
        product.isActive !== undefined ? product.isActive : true
      ];

      const result = await db.query(query, values);
      return this.mapRowToProduct(result.rows[0]);
    } catch (error) {
      logger.error('Error creating product', error);
      throw new Error('Failed to create product');
    }
  }

  /**
   * Update a product
   */
  async update(id: string, product: Partial<Product>): Promise<Product> {
    try {
      const query = `
        UPDATE products
        SET name = COALESCE($2, name),
            sku = COALESCE($3, sku),
            category = COALESCE($4, category),
            sub_category = COALESCE($5, sub_category),
            brand = COALESCE($6, brand),
            unit_price = COALESCE($7, unit_price),
            unit_of_measure = COALESCE($8, unit_of_measure),
            pack_size = COALESCE($9, pack_size),
            min_order_quantity = COALESCE($10, min_order_quantity),
            description = COALESCE($11, description),
            is_active = COALESCE($12, is_active),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const values = [
        id,
        product.name,
        product.sku,
        product.category,
        product.subCategory,
        product.brand,
        product.unitPrice,
        product.unitOfMeasure,
        product.packSize,
        product.minOrderQuantity,
        product.description,
        product.isActive
      ];

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Product not found');
      }

      return this.mapRowToProduct(result.rows[0]);
    } catch (error) {
      logger.error(`Error updating product with id ${id}`, error);
      throw new Error('Failed to update product');
    }
  }

  /**
   * Delete a product
   */
  async delete(id: string): Promise<boolean> {
    try {
      const query = 'DELETE FROM products WHERE id = $1';
      const result = await db.query(query, [id]);
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting product with id ${id}`, error);
      throw new Error('Failed to delete product');
    }
  }

  /**
   * Map database row to Product object
   */
  private mapRowToProduct(row: any): Product {
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      category: row.category,
      subCategory: row.sub_category,
      brand: row.brand,
      unitPrice: row.unit_price ? parseFloat(row.unit_price) : undefined,
      unitOfMeasure: row.unit_of_measure,
      packSize: row.pack_size,
      minOrderQuantity: row.min_order_quantity,
      description: row.description,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export singleton instance
export const productRepository = new ProductRepository();