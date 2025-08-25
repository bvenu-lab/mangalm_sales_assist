import apiGatewayClient from './api-gateway-client';
import { Store, Product, HistoricalInvoice, PredictedOrder, CallPrioritization, SalesAgentPerformance } from '../types/models';

// Define common filter parameters interface
export interface FilterParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  [key: string]: any;
}

// Define paginated response interface
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// API service with typed endpoints that uses the API Gateway client
const api = {
  // Auth endpoints
  auth: {
    login: (credentials: { username: string; password: string }) => 
      apiGatewayClient.login(credentials.username, credentials.password),
    verify: () => 
      apiGatewayClient.get('/auth/verify'),
    logout: () => 
      apiGatewayClient.logout(),
  },

  // Store endpoints
  store: {
    getAll: (params?: FilterParams) => 
      apiGatewayClient.getStores(params),
    getById: (id: string) => 
      apiGatewayClient.getStoreById(id),
    getRecent: (limit = 5) => 
      apiGatewayClient.get('/api/stores/recent', { limit }),
    create: (store: Partial<Store>) => 
      apiGatewayClient.post('/api/stores', store),
    update: (id: string, store: Partial<Store>) => 
      apiGatewayClient.put(`/api/stores/${id}`, store),
    delete: (id: string) => 
      apiGatewayClient.delete(`/api/stores/${id}`),
  },

  // Product endpoints
  product: {
    getAll: (params?: FilterParams) => 
      apiGatewayClient.getProducts(params),
    getById: (id: string) => 
      apiGatewayClient.getProductById(id),
    getByCategory: (category: string, params?: FilterParams) => 
      apiGatewayClient.get(`/api/products/category/${category}`, params),
    create: (product: Partial<Product>) => 
      apiGatewayClient.post('/api/products', product),
    update: (id: string, product: Partial<Product>) => 
      apiGatewayClient.put(`/api/products/${id}`, product),
    delete: (id: string) => 
      apiGatewayClient.delete(`/api/products/${id}`),
  },

  // Invoice endpoints
  invoice: {
    getAll: (params?: FilterParams) => 
      apiGatewayClient.getHistoricalInvoices(params),
    getById: (id: string) => 
      apiGatewayClient.getInvoiceById(id),
    getByStore: (storeId: string, params?: FilterParams) => 
      apiGatewayClient.get(`/api/invoices`, { ...params, store_id: storeId }),
    getRecent: (limit = 5) => 
      apiGatewayClient.get('/api/invoices/recent', { limit }),
  },

  // Predicted order endpoints
  predictedOrder: {
    getAll: (params?: FilterParams) => 
      apiGatewayClient.get('/api/orders/pending', params),
    getById: (id: string) => 
      apiGatewayClient.get(`/api/orders/pending/${id}`),
    getByStore: (storeId: string, params?: FilterParams) => 
      apiGatewayClient.get(`/api/orders/pending`, { ...params, store_id: storeId }),
    approve: (id: string) => 
      apiGatewayClient.post(`/api/orders/${id}/approve`),
    reject: (id: string, reason: string) => 
      apiGatewayClient.post(`/api/orders/${id}/reject`, { reason }),
    modify: (id: string, changes: any) => 
      apiGatewayClient.put(`/api/orders/${id}`, changes),
    // Aliases for modify to maintain compatibility with common CRUD naming
    update: (id: string, changes: any) => 
      apiGatewayClient.put(`/api/orders/${id}`, changes),
    create: (order: Partial<PredictedOrder>) => 
      apiGatewayClient.post('/api/orders', order),
  },

  // Call prioritization endpoints
  callPrioritization: {
    getAll: (params?: FilterParams) => 
      apiGatewayClient.get('/api/calls/prioritized', params),
    getById: (id: string) => 
      apiGatewayClient.get(`/api/calls/prioritized/${id}`),
    markAsContacted: (id: string, notes: string) => 
      apiGatewayClient.post(`/api/calls/${id}/contacted`, { notes }),
    reschedule: (id: string, scheduledDate: string) => 
      apiGatewayClient.post(`/api/calls/${id}/reschedule`, { scheduledDate }),
    generate: (forceUpdate?: boolean, agentId?: string) => 
      apiGatewayClient.post('/api/calls/generate', { forceUpdate, agentId }),
    getForAgent: (agentId: string, status?: string) => 
      apiGatewayClient.get(`/api/calls/agents/${agentId}`, { status }),
    updateStatus: (id: string, status: string, notes?: string) => 
      apiGatewayClient.put(`/api/calls/${id}/status`, { status, notes }),
    assign: (id: string, agentId: string) => 
      apiGatewayClient.put(`/api/calls/${id}/assign`, { agentId })
  },

  // Sales agent performance endpoints
  performance: {
    getSummary: () => 
      apiGatewayClient.getSalesAgentPerformance(),
    getByPeriod: (period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly') => 
      apiGatewayClient.get(`/api/sales-agent-performance/${period}`),
    getByMetric: (metric: string) => 
      apiGatewayClient.get(`/api/sales-agent-performance/metric/${metric}`),
  },

  // Dashboard endpoints
  dashboard: {
    getSummary: () => 
      apiGatewayClient.get('/api/dashboard/summary'),
    getRecentActivity: (limit = 10) => 
      apiGatewayClient.get('/api/dashboard/activity', { limit }),
    getPerformanceMetrics: () => 
      apiGatewayClient.get('/api/dashboard/performance'),
    getUpcomingCalls: (limit = 5) => 
      apiGatewayClient.get('/api/dashboard/upcoming-calls', { limit }),
    getPendingOrders: (limit = 5) => 
      apiGatewayClient.get('/api/dashboard/pending-orders', { limit }),
  },

  // AI predictions endpoints
  aiPredictions: {
    getForStore: (storeId: string, months?: number) => 
      apiGatewayClient.getAIPredictions(storeId, months),
    generateForStore: (storeId: string, months?: number, forceUpdate?: boolean) => 
      apiGatewayClient.generateAIPredictions(storeId, months, forceUpdate),
    deleteForStore: (storeId: string) => 
      apiGatewayClient.deleteAIPredictions(storeId),
    generateBatch: (months?: number, forceUpdate?: boolean) => 
      apiGatewayClient.generateBatchAIPredictions(months, forceUpdate),
    getRecommendations: (storeId: string) => 
      apiGatewayClient.get(`/api/ai-predictions/${storeId}/recommendations`),
    getTrends: (storeId: string) => 
      apiGatewayClient.get(`/api/ai-predictions/${storeId}/trends`),
  }
};

// Export the getAuthToken function
export const getAuthToken = () => apiGatewayClient.getAuthToken();

// Export the API service as default
export default api;
