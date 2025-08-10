/**
 * Type definitions for the Mangalm Sales-Assist MVP models
 * These interfaces match the database schema and are used throughout the frontend
 */

export interface Store {
  id: string;
  name: string;
  address?: string;
  city?: string;
  region?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  storeSize?: 'Small' | 'Medium' | 'Large';
  callFrequency?: 'Weekly' | 'Bi-weekly' | 'Monthly';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  unit?: string;
  unitPrice: number;
  stockQuantity?: number;
  reorderLevel?: number;
  expiryDate?: string;
  warehouseLocation?: string;
  createdAt: string;
  updatedAt?: string;
  sku?: string;
  price?: number; // Alias for unitPrice for backward compatibility
}

export interface HistoricalInvoice {
  id: string;
  storeId: string;
  invoiceDate: string;
  totalAmount: number;
  paymentStatus?: string;
  notes?: string;
  createdAt: string;
  store?: Store;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  totalPrice: number;
  product?: Product;
}

export interface PredictedOrder {
  id: string;
  storeId: string;
  predictionDate: string;
  expectedDeliveryDate?: string;
  confidenceScore?: number;
  status: 'Predicted' | 'Confirmed' | 'Completed' | 'Cancelled';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  store?: Store;
  items?: PredictedOrderItem[];
  totalAmount?: number;
}

export interface PredictedOrderItem {
  id: string;
  predictedOrderId: string;
  productId: string;
  suggestedQuantity: number;
  actualQuantity?: number;
  confidenceScore?: number;
  isUpsell: boolean;
  upsellReason?: string;
  product?: Product;
  quantity?: number; // Alias for actualQuantity or suggestedQuantity
  unitPrice?: number;
  discount?: number;
  notes?: string;
}

export interface CallPrioritization {
  id: string;
  storeId: string;
  priorityScore: number;
  priorityReason?: string;
  lastCallDate?: string;
  nextCallDate?: string;
  assignedAgent?: string;
  status: 'Pending' | 'Completed' | 'Skipped';
  createdAt: string;
  updatedAt?: string;
  store?: Store;
}

export interface SalesAgentPerformance {
  id: string;
  agentName: string;
  date: string;
  callsCompleted: number;
  ordersPlaced: number;
  upsellSuccessRate: number;
  averageOrderValue: number;
  totalSalesValue: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  [key: string]: any;
}
