/**
 * PredictedOrder model representing a predicted order in the Mangalm Sales-Assist system
 */
export interface PredictedOrder {
  id: string;
  store_id: string;
  prediction_date: string;
  confidence_score?: number;
  status: 'Predicted' | 'Confirmed' | 'Completed';
  notes?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * PredictedOrder creation data transfer object
 */
export type CreatePredictedOrderDto = Omit<PredictedOrder, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

/**
 * PredictedOrder update data transfer object
 */
export type UpdatePredictedOrderDto = Partial<Omit<PredictedOrder, 'id' | 'created_at' | 'updated_at'>>;

/**
 * PredictedOrder with related data
 */
export interface PredictedOrderWithRelations extends PredictedOrder {
  store?: any;
  predicted_order_items?: any[];
}
