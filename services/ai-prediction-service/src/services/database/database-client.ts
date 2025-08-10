import axios from 'axios';
import { logger } from '../../utils/logger';
import config from '../../config';

/**
 * Client for interacting with the database orchestrator microservice
 */
export class DatabaseClient {
  private baseUrl: string;
  
  /**
   * Constructor
   */
  constructor() {
    this.baseUrl = config.services.databaseOrchestrator.url;
  }
  
  /**
   * Execute a query against the database
   */
  public async executeQuery(query: string, params: any[] = []): Promise<any[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/database/query`, {
        query,
        params,
      });
      
      return response.data.results;
    } catch (error: any) {
      logger.error(`Database query error: ${error.message}`, {
        error,
        stack: error.stack,
        query,
        params,
      });
      
      throw error;
    }
  }
  
  /**
   * Get all stores
   */
  public async getAllStores(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/stores`);
      return response.data.stores;
    } catch (error: any) {
      logger.error(`Error getting stores: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      return [];
    }
  }
  
  /**
   * Get store by ID
   */
  public async getStore(storeId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/stores/${storeId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Error getting store ${storeId}: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
      });
      
      return null;
    }
  }
  
  /**
   * Get historical invoices for a store
   */
  public async getStoreInvoices(storeId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/invoices/store/${storeId}`);
      return response.data.invoices;
    } catch (error: any) {
      logger.error(`Error getting invoices for store ${storeId}: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
      });
      
      return [];
    }
  }
  
  /**
   * Get all historical invoices
   */
  public async getAllHistoricalInvoices(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/invoices`);
      return response.data.invoices;
    } catch (error: any) {
      logger.error(`Error getting all invoices: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      return [];
    }
  }
  
  /**
   * Get predicted orders for a store
   */
  public async getPredictedOrders(storeId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/predicted-orders/store/${storeId}`);
      return response.data.orders;
    } catch (error: any) {
      logger.error(`Error getting predicted orders for store ${storeId}: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
      });
      
      return [];
    }
  }
  
  /**
   * Get predicted order by ID
   */
  public async getPredictedOrderById(orderId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/predicted-orders/${orderId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Error getting predicted order ${orderId}: ${error.message}`, {
        error,
        stack: error.stack,
        orderId,
      });
      
      return null;
    }
  }
  
  /**
   * Get predicted order items
   */
  public async getPredictedOrderItems(orderId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/predicted-orders/${orderId}/items`);
      return response.data.items;
    } catch (error: any) {
      logger.error(`Error getting predicted order items for order ${orderId}: ${error.message}`, {
        error,
        stack: error.stack,
        orderId,
      });
      
      return [];
    }
  }
  
  /**
   * Save predicted orders
   */
  public async savePredictedOrders(orders: any[]): Promise<any[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/predicted-orders/batch`, {
        orders,
      });
      
      return response.data.orders;
    } catch (error: any) {
      logger.error(`Error saving predicted orders: ${error.message}`, {
        error,
        stack: error.stack,
        orderCount: orders.length,
      });
      
      throw error;
    }
  }
  
  /**
   * Delete predicted orders
   */
  public async deletePredictedOrders(): Promise<number> {
    try {
      const response = await axios.delete(`${this.baseUrl}/api/predicted-orders`);
      return response.data.deletedCount;
    } catch (error: any) {
      logger.error(`Error deleting predicted orders: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      return 0;
    }
  }
  
  /**
   * Delete predicted orders for a store
   */
  public async deletePredictedOrdersForStore(storeId: string): Promise<number> {
    try {
      const response = await axios.delete(`${this.baseUrl}/api/predicted-orders/store/${storeId}`);
      return response.data.deletedCount;
    } catch (error: any) {
      logger.error(`Error deleting predicted orders for store ${storeId}: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
      });
      
      return 0;
    }
  }
  
  /**
   * Delete predicted order
   */
  public async deletePredictedOrder(orderId: string): Promise<boolean> {
    try {
      await axios.delete(`${this.baseUrl}/api/predicted-orders/${orderId}`);
      return true;
    } catch (error: any) {
      logger.error(`Error deleting predicted order ${orderId}: ${error.message}`, {
        error,
        stack: error.stack,
        orderId,
      });
      
      return false;
    }
  }
  
  /**
   * Update predicted order status
   */
  public async updatePredictedOrderStatus(orderId: string, status: string, notes?: string): Promise<any> {
    try {
      const response = await axios.put(`${this.baseUrl}/api/predicted-orders/${orderId}/status`, {
        status,
        notes,
      });
      
      return response.data;
    } catch (error: any) {
      logger.error(`Error updating predicted order status ${orderId}: ${error.message}`, {
        error,
        stack: error.stack,
        orderId,
        status,
      });
      
      return null;
    }
  }
  
  /**
   * Get call prioritizations for an agent
   */
  public async getCallPrioritizationsForAgent(agentId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/call-prioritizations/agent/${agentId}`);
      return response.data.prioritizations;
    } catch (error: any) {
      logger.error(`Error getting call prioritizations for agent ${agentId}: ${error.message}`, {
        error,
        stack: error.stack,
        agentId,
      });
      
      return [];
    }
  }
  
  /**
   * Save call prioritizations
   */
  public async saveCallPrioritizations(prioritizations: any[]): Promise<any[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/call-prioritizations/batch`, {
        prioritizations,
      });
      
      return response.data.prioritizations;
    } catch (error: any) {
      logger.error(`Error saving call prioritizations: ${error.message}`, {
        error,
        stack: error.stack,
        prioritizationCount: prioritizations.length,
      });
      
      throw error;
    }
  }
  
  /**
   * Delete call prioritizations
   */
  public async deleteCallPrioritizations(): Promise<number> {
    try {
      const response = await axios.delete(`${this.baseUrl}/api/call-prioritizations`);
      return response.data.deletedCount;
    } catch (error: any) {
      logger.error(`Error deleting call prioritizations: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      return 0;
    }
  }
  
  /**
   * Update call prioritization status
   */
  public async updateCallPrioritizationStatus(prioritizationId: string, status: string, notes?: string): Promise<any> {
    try {
      const response = await axios.put(`${this.baseUrl}/api/call-prioritizations/${prioritizationId}/status`, {
        status,
        notes,
      });
      
      return response.data;
    } catch (error: any) {
      logger.error(`Error updating call prioritization status ${prioritizationId}: ${error.message}`, {
        error,
        stack: error.stack,
        prioritizationId,
        status,
      });
      
      return null;
    }
  }
  
  /**
   * Assign call prioritization to agent
   */
  public async assignCallPrioritization(prioritizationId: string, agentId: string): Promise<any> {
    try {
      const response = await axios.put(`${this.baseUrl}/api/call-prioritizations/${prioritizationId}/assign`, {
        agentId,
      });
      
      return response.data;
    } catch (error: any) {
      logger.error(`Error assigning call prioritization ${prioritizationId} to agent ${agentId}: ${error.message}`, {
        error,
        stack: error.stack,
        prioritizationId,
        agentId,
      });
      
      return null;
    }
  }
  
  /**
   * Get ML model from database
   */
  public async getModel(modelName: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/ml-models/${modelName}`);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        // Model not found, which is expected for first run
        return null;
      }
      
      logger.error(`Error getting ML model ${modelName}: ${error.message}`, {
        error,
        stack: error.stack,
        modelName,
      });
      
      return null;
    }
  }
  
  /**
   * Save ML model to database
   */
  public async saveModel(modelName: string, modelData: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/ml-models`, {
        name: modelName,
        modelData,
        version: new Date().toISOString(),
      });
      
      return response.data;
    } catch (error: any) {
      logger.error(`Error saving ML model ${modelName}: ${error.message}`, {
        error,
        stack: error.stack,
        modelName,
      });
      
      throw error;
    }
  }
}

// Export singleton instance
export const databaseClient = new DatabaseClient();
