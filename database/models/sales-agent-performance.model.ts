/**
 * SalesAgentPerformance model representing a sales agent's performance in the Mangalm Sales-Assist system
 */
export interface SalesAgentPerformance {
  id: string;
  agent_name: string;
  date: string;
  calls_completed: number;
  orders_placed: number;
  upsell_success_rate: number;
  average_order_value: number;
  total_sales_value: number;
  created_at: string;
  updated_at?: string;
}

/**
 * SalesAgentPerformance creation data transfer object
 */
export type CreateSalesAgentPerformanceDto = Omit<SalesAgentPerformance, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

/**
 * SalesAgentPerformance update data transfer object
 */
export type UpdateSalesAgentPerformanceDto = Partial<Omit<SalesAgentPerformance, 'id' | 'created_at' | 'updated_at'>>;

/**
 * SalesAgentPerformance with related data
 */
export interface SalesAgentPerformanceWithRelations extends SalesAgentPerformance {
  // No direct relations in the current schema
}
