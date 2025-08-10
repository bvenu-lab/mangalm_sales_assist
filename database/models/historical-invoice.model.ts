/**
 * HistoricalInvoice model representing a past invoice in the Mangalm Sales-Assist system
 */
export interface HistoricalInvoice {
  id: string;
  store_id: string;
  invoice_date: string;
  total_amount: number;
  payment_status?: string;
  notes?: string;
  created_at: string;
}

/**
 * HistoricalInvoice creation data transfer object
 */
export type CreateHistoricalInvoiceDto = Omit<HistoricalInvoice, 'id' | 'created_at'> & {
  id?: string;
};

/**
 * HistoricalInvoice update data transfer object
 */
export type UpdateHistoricalInvoiceDto = Partial<Omit<HistoricalInvoice, 'id' | 'created_at'>>;

/**
 * HistoricalInvoice with related data
 */
export interface HistoricalInvoiceWithRelations extends HistoricalInvoice {
  store?: any;
  invoice_items?: any[];
}
