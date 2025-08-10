/**
 * InvoiceItem model representing an item in a historical invoice in the Mangalm Sales-Assist system
 */
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  total_price: number;
}

/**
 * InvoiceItem creation data transfer object
 */
export type CreateInvoiceItemDto = Omit<InvoiceItem, 'id'> & {
  id?: string;
};

/**
 * InvoiceItem update data transfer object
 */
export type UpdateInvoiceItemDto = Partial<Omit<InvoiceItem, 'id' | 'invoice_id'>>;

/**
 * InvoiceItem with related data
 */
export interface InvoiceItemWithRelations extends InvoiceItem {
  invoice?: any;
  product?: any;
}
