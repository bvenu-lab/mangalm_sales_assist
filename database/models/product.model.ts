/**
 * Product model representing a product in the Mangalm Sales-Assist system
 */
export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  unit?: string;
  unit_price: number;
  stock_quantity?: number;
  reorder_level?: number;
  expiry_date?: string;
  warehouse_location?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Product creation data transfer object
 */
export type CreateProductDto = Omit<Product, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

/**
 * Product update data transfer object
 */
export type UpdateProductDto = Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>;

/**
 * Product with related data
 */
export interface ProductWithRelations extends Product {
  invoice_items?: any[];
  predicted_order_items?: any[];
}
