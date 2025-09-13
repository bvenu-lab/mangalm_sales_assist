import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * API Gateway Client Configuration
 */
export interface ApiGatewayClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * API Gateway Client
 * 
 * Client for interacting with the API Gateway
 */
export class ApiGatewayClient {
  private client: AxiosInstance;

  /**
   * Constructor
   */
  constructor(config: ApiGatewayClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Log request details
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
          params: config.params,
          data: config.data,
          headers: config.headers
        });
        return config;
      },
      (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log successful response
        console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        });
        return response;
      },
      (error) => {
        // Log error response
        console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          error: error.message
        });
        
        // Log 401 errors (no auth required)
        if (error.response && error.response.status === 401) {
          console.log('[API] 401 Unauthorized - Ignoring (no auth required)');
        }
        return Promise.reject(error);
      }
    );
  }


  /**
   * Get stores
   */
  public async getStores(params?: any): Promise<any> {
    console.log('[Data] Fetching stores with params:', params);
    try {
      const response = await this.client.get('/api/stores', { params });
      console.log(`[Data] Retrieved ${response.data?.data?.length || 0} stores`);
      return response.data?.data || [];
    } catch (error) {
      console.error('[Data] Failed to fetch stores:', error);
      throw error;
    }
  }

  /**
   * Get store by ID
   */
  public async getStoreById(id: string): Promise<any> {
    console.log(`[Data] Fetching store with ID: ${id}`);
    try {
      const response = await this.client.get(`/api/stores/${id}`);
      console.log(`[Data] Store API raw response:`, JSON.stringify(response.data));
      
      // Check if we have a success/data wrapper
      if (response.data && response.data.success && response.data.data) {
        console.log(`[Data] Extracting from success/data wrapper`);
        const storeData = response.data.data;
        console.log(`[Data] Extracted store data:`, JSON.stringify(storeData));
        return storeData;
      }
      
      // Otherwise return the response as is
      console.log(`[Data] Returning response as is:`, JSON.stringify(response.data));
      return response.data;
    } catch (error) {
      console.error(`[Data] Failed to fetch store ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get products
   */
  public async getProducts(params?: any): Promise<any> {
    console.log('[Data] Fetching products with params:', params);
    try {
      const response = await this.client.get('/api/products', { params });
      console.log(`[Data] Retrieved ${response.data?.data?.length || 0} products`);
      return response.data?.data || [];
    } catch (error) {
      console.error('[Data] Failed to fetch products:', error);
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  public async getProductById(id: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/products/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Get product ${id} error:`, error);
      throw error;
    }
  }

  /**
   * Get historical invoices
   */
  public async getHistoricalInvoices(params?: any): Promise<any> {
    console.log('[Data] Fetching historical invoices with params:', params);
    try {
      const response = await this.client.get('/api/invoices', { params });
      console.log(`[Data] Retrieved ${response.data?.length || 0} invoices`);
      return response.data;
    } catch (error) {
      console.error('[Data] Failed to fetch invoices:', error);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  public async getInvoiceById(id: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/invoices/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Get invoice ${id} error:`, error);
      throw error;
    }
  }

  /**
   * Get predicted orders
   */
  public async getPredictedOrders(params?: any): Promise<any> {
    console.log('[Data] Fetching predicted orders with params:', params);
    try {
      const response = await this.client.get('/api/predicted-orders', { params });
      console.log(`[Data] Retrieved ${response.data?.length || 0} predicted orders`);
      return response.data;
    } catch (error) {
      console.error('[Data] Failed to fetch predicted orders:', error);
      throw error;
    }
  }

  /**
   * Get predicted order by ID
   */
  public async getPredictedOrderById(id: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/predicted-orders/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Get predicted order ${id} error:`, error);
      throw error;
    }
  }

  /**
   * Create order
   */
  public async createOrder(orderData: any): Promise<any> {
    try {
      const response = await this.client.post('/api/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Create order error:', error);
      throw error;
    }
  }

  /**
   * Update order
   */
  public async updateOrder(id: string, orderData: any): Promise<any> {
    try {
      const response = await this.client.put(`/api/orders/${id}`, orderData);
      return response.data;
    } catch (error) {
      console.error(`Update order ${id} error:`, error);
      throw error;
    }
  }

  /**
   * Delete order
   */
  public async deleteOrder(id: string): Promise<any> {
    try {
      const response = await this.client.delete(`/api/orders/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Delete order ${id} error:`, error);
      throw error;
    }
  }

  /**
   * Get call prioritization
   */
  public async getCallPrioritization(params?: any): Promise<any> {
    console.log('[Data] Fetching call prioritization with params:', params);
    try {
      const response = await this.client.get('/api/call-prioritization', { params });
      console.log(`[Data] Retrieved ${response.data?.length || 0} call prioritizations`);
      return response.data;
    } catch (error) {
      console.error('[Data] Failed to fetch call prioritization:', error);
      throw error;
    }
  }

  /**
   * Get sales agent performance
   */
  public async getSalesAgentPerformance(params?: any): Promise<any> {
    console.log('[Data] Fetching sales agent performance with params:', params);
    try {
      const response = await this.client.get('/api/sales-agent-performance', { params });
      console.log('[Data] Retrieved sales agent performance data');
      return response.data;
    } catch (error) {
      console.error('[Data] Failed to fetch sales agent performance:', error);
      throw error;
    }
  }

  /**
   * Get AI predictions for a store
   */
  public async getAIPredictions(storeId: string, months?: number): Promise<any> {
    try {
      const params = months ? { months } : undefined;
      const response = await this.client.get(`/api/ai-predictions/stores/${storeId}`, { params });
      return response.data;
    } catch (error) {
      console.error(`Get AI predictions for store ${storeId} error:`, error);
      throw error;
    }
  }

  /**
   * Generate AI predictions for a store
   */
  public async generateAIPredictions(storeId: string, months?: number, forceUpdate?: boolean): Promise<any> {
    try {
      const data = {
        months: months || 1,
        forceUpdate: forceUpdate || false
      };
      const response = await this.client.post(`/api/ai-predictions/stores/${storeId}`, data);
      return response.data;
    } catch (error) {
      console.error(`Generate AI predictions for store ${storeId} error:`, error);
      throw error;
    }
  }

  /**
   * Delete AI predictions for a store
   */
  public async deleteAIPredictions(storeId: string): Promise<any> {
    try {
      const response = await this.client.delete(`/api/ai-predictions/stores/${storeId}`);
      return response.data;
    } catch (error) {
      console.error(`Delete AI predictions for store ${storeId} error:`, error);
      throw error;
    }
  }

  /**
   * Generate batch AI predictions for all stores
   */
  public async generateBatchAIPredictions(months?: number, forceUpdate?: boolean): Promise<any> {
    try {
      const data = {
        months: months || 1,
        forceUpdate: forceUpdate || false
      };
      const response = await this.client.post('/api/ai-predictions/batch', data);
      return response.data;
    } catch (error) {
      console.error('Generate batch AI predictions error:', error);
      throw error;
    }
  }

  /**
   * Sync stores from Zoho CRM
   */
  public async syncZohoStores(): Promise<any> {
    try {
      const response = await this.client.post('/api/zoho/sync/stores');
      return response.data;
    } catch (error) {
      console.error('Sync Zoho stores error:', error);
      throw error;
    }
  }

  /**
   * Sync products from Zoho CRM
   */
  public async syncZohoProducts(): Promise<any> {
    try {
      const response = await this.client.post('/api/zoho/sync/products');
      return response.data;
    } catch (error) {
      console.error('Sync Zoho products error:', error);
      throw error;
    }
  }

  /**
   * Sync invoices from Zoho CRM
   */
  public async syncZohoInvoices(): Promise<any> {
    try {
      const response = await this.client.post('/api/zoho/sync/invoices');
      return response.data;
    } catch (error) {
      console.error('Sync Zoho invoices error:', error);
      throw error;
    }
  }

  /**
   * Sync all data from Zoho CRM
   */
  public async syncZohoAll(triggerAiUpdate: boolean = true): Promise<any> {
    try {
      const response = await this.client.post('/api/zoho/sync/all', { triggerAiUpdate });
      return response.data;
    } catch (error) {
      console.error('Sync all Zoho data error:', error);
      throw error;
    }
  }

  /**
   * Get Zoho sync scheduler jobs
   */
  public async getZohoSchedulerJobs(): Promise<any> {
    try {
      const response = await this.client.get('/api/zoho/scheduler/jobs');
      return response.data;
    } catch (error) {
      console.error('Get Zoho scheduler jobs error:', error);
      throw error;
    }
  }

  /**
   * Start a Zoho sync scheduler job
   */
  public async startZohoSchedulerJob(name: string): Promise<any> {
    try {
      const response = await this.client.post(`/api/zoho/scheduler/jobs/${name}/start`);
      return response.data;
    } catch (error) {
      console.error(`Start Zoho scheduler job ${name} error:`, error);
      throw error;
    }
  }

  /**
   * Generate call prioritizations
   */
  public async generateCallPrioritizations(forceUpdate?: boolean, agentId?: string): Promise<any> {
    try {
      const data = {
        forceUpdate: forceUpdate || false,
        agentId
      };
      const response = await this.client.post('/api/prioritization/calls/generate', data);
      return response.data;
    } catch (error) {
      console.error('Generate call prioritizations error:', error);
      throw error;
    }
  }

  /**
   * Get call prioritizations for an agent
   */
  public async getCallPrioritizationsForAgent(agentId: string, status?: string): Promise<any> {
    try {
      const params = status ? { status } : undefined;
      const response = await this.client.get(`/api/prioritization/calls/agents/${agentId}`, { params });
      return response.data;
    } catch (error) {
      console.error(`Get call prioritizations for agent ${agentId} error:`, error);
      throw error;
    }
  }

  /**
   * Update call prioritization status
   */
  public async updateCallPrioritizationStatus(id: string, status: string, notes?: string): Promise<any> {
    try {
      const data = {
        status,
        notes
      };
      const response = await this.client.put(`/api/prioritization/calls/${id}/status`, data);
      return response.data;
    } catch (error) {
      console.error(`Update call prioritization ${id} status error:`, error);
      throw error;
    }
  }

  /**
   * Assign call prioritization to an agent
   */
  public async assignCallPrioritization(id: string, agentId: string): Promise<any> {
    try {
      const data = {
        agentId
      };
      const response = await this.client.put(`/api/prioritization/calls/${id}/assign`, data);
      return response.data;
    } catch (error) {
      console.error(`Assign call prioritization ${id} error:`, error);
      throw error;
    }
  }

  /**
   * Generic GET request
   */
  public async get(url: string, params?: any): Promise<any> {
    console.log(`[API Gateway] GET ${url} with params:`, params);
    try {
      const response = await this.client.get(url, { params });
      return response.data;
    } catch (error) {
      console.error(`GET ${url} error:`, error);
      throw error;
    }
  }

  /**
   * Generic POST request
   */
  public async post(url: string, data?: any): Promise<any> {
    try {
      const response = await this.client.post(url, data);
      return response.data;
    } catch (error) {
      console.error(`POST ${url} error:`, error);
      throw error;
    }
  }

  /**
   * Generic PUT request
   */
  public async put(url: string, data?: any): Promise<any> {
    try {
      const response = await this.client.put(url, data);
      return response.data;
    } catch (error) {
      console.error(`PUT ${url} error:`, error);
      throw error;
    }
  }

  /**
   * Generic DELETE request
   */
  public async delete(url: string): Promise<any> {
    try {
      const response = await this.client.delete(url);
      return response.data;
    } catch (error) {
      console.error(`DELETE ${url} error:`, error);
      throw error;
    }
  }
}

// Create singleton instance
const apiGatewayClient = new ApiGatewayClient({
  baseURL: process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:3007',
  timeout: 30000
});

export default apiGatewayClient;
