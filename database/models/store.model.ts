/**
 * Store model representing a retail store in the Mangalm Sales-Assist system
 * NOW PROPERLY ALIGNED WITH DATABASE MIGRATION
 */

export interface Store {
  // Primary key
  id: string;
  
  // Store information (REQUIRED)
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  
  // Contact information (OPTIONAL)
  phone?: string;
  email?: string;
  website?: string;
  
  // Store classification
  type: string;
  category?: string;
  size?: string;
  square_footage?: number;
  
  // Business information
  tax_id?: string;
  business_license?: string;
  license_expiry?: string;
  
  // Contact persons
  primary_contact_name?: string;
  primary_contact_phone?: string;
  primary_contact_email?: string;
  secondary_contact_name?: string;
  secondary_contact_phone?: string;
  secondary_contact_email?: string;
  
  // Sales information
  sales_region?: string;
  sales_territory?: string;
  assigned_sales_rep_id?: string;
  
  // Status and metadata
  is_active: boolean;
  onboarding_date?: string;
  last_order_date?: string;
  lifetime_value?: number;
  credit_limit?: number;
  payment_terms?: string;
  preferred_shipping_method?: string;
  
  // Audit trail (ENTERPRISE REQUIRED)
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
  version: number;
  
  // Compliance fields (ENTERPRISE REQUIRED)
  data_classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  retention_policy?: string;
  consent_status?: boolean;
  anonymization_date?: string;
}

/**
 * Store creation data transfer object
 */
export type CreateStoreDto = Omit<Store, 'id' | 'created_at' | 'updated_at' | 'version'> & {
  id?: string;
  created_by: string; // REQUIRED for audit
};

/**
 * Store update data transfer object
 */
export type UpdateStoreDto = Partial<Omit<Store, 'id' | 'created_at' | 'updated_at' | 'version'>> & {
  updated_by: string; // REQUIRED for audit
};

/**
 * Store with calculated fields and relations
 */
export interface StoreWithRelations extends Store {
  // Performance metrics (calculated)
  total_orders?: number;
  total_revenue?: number;
  average_order_value?: number;
  last_order_amount?: number;
  order_frequency?: number;
  
  // Predictions (from AI service)
  predicted_next_order_date?: string;
  predicted_order_amount?: number;
  prediction_confidence?: number;
  
  // Relations
  historical_invoices?: any[];
  predicted_orders?: any[];
  call_prioritization?: any;
  assigned_sales_rep?: any;
  performance_metrics?: any[];
}

/**
 * Store search and filter options
 */
export interface StoreFilters {
  name?: string;
  city?: string;
  state?: string;
  sales_region?: string;
  sales_territory?: string;
  assigned_sales_rep_id?: string;
  type?: string;
  category?: string;
  size?: string;
  is_active?: boolean;
  min_lifetime_value?: number;
  max_lifetime_value?: number;
  min_credit_limit?: number;
  max_credit_limit?: number;
  last_order_from?: string;
  last_order_to?: string;
}

/**
 * Store sort options
 */
export interface StoreSortOptions {
  field: keyof Store;
  direction: 'asc' | 'desc';
}

/**
 * Store analytics data
 */
export interface StoreAnalytics {
  store_id: string;
  store_name: string;
  period_start: string;
  period_end: string;
  
  // Sales metrics
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  order_frequency: number;
  
  // Growth metrics
  revenue_growth_rate: number;
  order_count_growth_rate: number;
  
  // Comparative metrics
  rank_by_revenue: number;
  rank_by_orders: number;
  percentile_performance: number;
  
  // Prediction metrics
  prediction_accuracy: number;
  fulfillment_rate: number;
  
  // Risk metrics
  credit_utilization: number;
  payment_delay_days: number;
  risk_score: number;
}