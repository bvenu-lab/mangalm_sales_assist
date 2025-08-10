/**
 * CallPrioritization model representing a prioritized call in the Mangalm Sales-Assist system
 */
export interface CallPrioritization {
  id: string;
  store_id: string;
  priority_score: number;
  priority_reason?: string;
  last_call_date?: string;
  next_call_date?: string;
  assigned_agent?: string;
  status: 'Pending' | 'Completed' | 'Skipped';
  created_at: string;
  updated_at?: string;
}

/**
 * CallPrioritization creation data transfer object
 */
export type CreateCallPrioritizationDto = Omit<CallPrioritization, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

/**
 * CallPrioritization update data transfer object
 */
export type UpdateCallPrioritizationDto = Partial<Omit<CallPrioritization, 'id' | 'created_at' | 'updated_at'>>;

/**
 * CallPrioritization with related data
 */
export interface CallPrioritizationWithRelations extends CallPrioritization {
  store?: any;
}
