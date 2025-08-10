/**
 * PredictedOrderItem model representing an item in a predicted order in the Mangalm Sales-Assist system
 */
export interface PredictedOrderItem {
  id: string;
  predicted_order_id: string;
  product_id: string;
  suggested_quantity: number;
  actual_quantity?: number;
  confidence_score?: number;
  is_upsell: boolean;
  upsell_reason?: string;
}

/**
 * PredictedOrderItem creation data transfer object
 */
export type CreatePredictedOrderItemDto = Omit<PredictedOrderItem, 'id'> & {
  id?: string;
};

/**
 * PredictedOrderItem update data transfer object
 */
export type UpdatePredictedOrderItemDto = Partial<Omit<PredictedOrderItem, 'id' | 'predicted_order_id'>>;

/**
 * PredictedOrderItem with related data
 */
export interface PredictedOrderItemWithRelations extends PredictedOrderItem {
  predicted_order?: any;
  product?: any;
}
