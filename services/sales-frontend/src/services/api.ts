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
      apiGatewayClient.get('/mangalm/stores/recent', { limit }),
    create: (store: Partial<Store>) => 
      apiGatewayClient.post('/mangalm/stores', store),
    update: (id: string, store: Partial<Store>) => 
      apiGatewayClient.put(`/mangalm/stores/${id}`, store),
    delete: (id: string) => 
      apiGatewayClient.delete(`/mangalm/stores/${id}`),
  },

  // Product endpoints
  product: {
    getAll: (params?: FilterParams) => 
      apiGatewayClient.getProducts(params),
    getById: (id: string) => 
      apiGatewayClient.getProductById(id),
    getByCategory: (category: string, params?: FilterParams) => 
      apiGatewayClient.get(`/mangalm/products/category/${category}`, params),
    create: (product: Partial<Product>) => 
      apiGatewayClient.post('/mangalm/products', product),
    update: (id: string, product: Partial<Product>) => 
      apiGatewayClient.put(`/mangalm/products/${id}`, product),
    delete: (id: string) => 
      apiGatewayClient.delete(`/mangalm/products/${id}`),
  },

  // Invoice endpoints
  invoice: {
    getAll: (params?: FilterParams) => 
      apiGatewayClient.getHistoricalInvoices(params),
    getById: (id: string) => 
      apiGatewayClient.getInvoiceById(id),
    getByStore: (storeId: string, params?: FilterParams) => 
      apiGatewayClient.get(`/mangalm/invoices/store/${storeId}`, params),
    getRecent: (limit = 5) => 
      apiGatewayClient.get('/mangalm/invoices/recent', { limit }),
  },

  // Predicted order endpoints
  predictedOrder: {
    getAll: (params?: FilterParams) => 
      apiGatewayClient.getPredictedOrders(params),
    getById: (id: string) => 
      apiGatewayClient.getPredictedOrderById(id),
    getByStore: (storeId: string, params?: FilterParams) => 
      apiGatewayClient.get(`/mangalm/predicted-orders/store/${storeId}`, params),
    approve: (id: string) => 
      apiGatewayClient.post(`/mangalm/predicted-orders/${id}/approve`),
    reject: (id: string, reason: string) => 
      apiGatewayClient.post(`/mangalm/predicted-orders/${id}/reject`, { reason }),
    modify: (id: string, changes: any) => 
      apiGatewayClient.put(`/mangalm/predicted-orders/${id}`, changes),
    // Aliases for modify to maintain compatibility with common CRUD naming
    update: (id: string, changes: any) => 
      apiGatewayClient.put(`/mangalm/predicted-orders/${id}`, changes),
    create: (order: Partial<PredictedOrder>) => 
      apiGatewayClient.post('/mangalm/predicted-orders', order),
  },

  // Call prioritization endpoints
  callPrioritization: {
    getAll: (params?: FilterParams) => 
      apiGatewayClient.getCallPrioritization(params),
    getById: (id: string) => 
      apiGatewayClient.get(`/mangalm/call-prioritization/${id}`),
    markAsContacted: (id: string, notes: string) => 
      apiGatewayClient.post(`/mangalm/call-prioritization/${id}/contacted`, { notes }),
    reschedule: (id: string, scheduledDate: string) => 
      apiGatewayClient.post(`/mangalm/call-prioritization/${id}/reschedule`, { scheduledDate }),
    generate: (forceUpdate?: boolean, agentId?: string) => 
      apiGatewayClient.generateCallPrioritizations(forceUpdate, agentId),
    getForAgent: (agentId: string, status?: string) => 
      apiGatewayClient.getCallPrioritizationsForAgent(agentId, status),
    updateStatus: (id: string, status: string, notes?: string) => 
      apiGatewayClient.updateCallPrioritizationStatus(id, status, notes),
    assign: (id: string, agentId: string) => 
      apiGatewayClient.assignCallPrioritization(id, agentId)
  },

  // Sales agent performance endpoints
  performance: {
    getSummary: () => 
      apiGatewayClient.getSalesAgentPerformance(),
    getByPeriod: (period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly') => 
      apiGatewayClient.get(`/mangalm/sales-agent-performance/${period}`),
    getByMetric: (metric: string) => 
      apiGatewayClient.get(`/mangalm/sales-agent-performance/metric/${metric}`),
  },

  // Dashboard endpoints
  dashboard: {
    getSummary: () => 
      apiGatewayClient.get('/mangalm/dashboard/summary'),
    getRecentActivity: (limit = 10) => 
      apiGatewayClient.get('/mangalm/dashboard/activity', { limit }),
    getPerformanceMetrics: () => 
      apiGatewayClient.get('/mangalm/dashboard/performance'),
    getUpcomingCalls: (limit = 5) => 
      apiGatewayClient.get('/mangalm/dashboard/upcoming-calls', { limit }),
    getPendingOrders: (limit = 5) => 
      apiGatewayClient.get('/mangalm/dashboard/pending-orders', { limit }),
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
      apiGatewayClient.get(`/mangalm/ai-predictions/${storeId}/recommendations`),
    getTrends: (storeId: string) => 
      apiGatewayClient.get(`/mangalm/ai-predictions/${storeId}/trends`),
  }
};

// Export the API service as default
export default api;
