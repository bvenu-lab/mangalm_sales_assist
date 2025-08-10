import axios from 'axios';
import { logger } from '../../utils/logger';
import config from '../../config';
import { DatabaseClient } from './database-client';

/**
 * Enhanced database client with additional methods for AI prediction service
 */
export class EnhancedDatabaseClient extends DatabaseClient {
  /**
   * Get predictions with pagination
   */
  public async getPredictions(storeId?: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    try {
      let queryString = '';
      const params: string[] = [];
      
      if (storeId) {
        params.push(`storeId=${encodeURIComponent(storeId)}`);
      }
      
      params.push(`limit=${limit}`);
      params.push(`offset=${offset}`);
      
      queryString = params.join('&');
      
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/predictions?${queryString}`);
      return response.data.predictions || [];
    } catch (error: any) {
      logger.error(`Error getting predictions: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
        limit,
        offset,
      });
      
      return [];
    }
  }
  
  /**
   * Get prediction by ID
   */
  public async getPredictionById(id: string): Promise<any> {
    try {
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/predictions/${id}`);
      return response.data.prediction;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      
      logger.error(`Error getting prediction by ID ${id}: ${error.message}`, {
        error,
        stack: error.stack,
        id,
      });
      
      return null;
    }
  }
  
  /**
   * Update prediction
   */
  public async updatePrediction(id: string, prediction: any): Promise<any> {
    try {
      const response = await axios.put(`${config.services.databaseOrchestrator.url}/api/predictions/${id}`, prediction);
      return response.data.prediction;
    } catch (error: any) {
      logger.error(`Error updating prediction ${id}: ${error.message}`, {
        error,
        stack: error.stack,
        id,
      });
      
      throw error;
    }
  }
  
  /**
   * Delete prediction
   */
  public async deletePrediction(id: string): Promise<boolean> {
    try {
      await axios.delete(`${config.services.databaseOrchestrator.url}/api/predictions/${id}`);
      return true;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return false;
      }
      
      logger.error(`Error deleting prediction ${id}: ${error.message}`, {
        error,
        stack: error.stack,
        id,
      });
      
      return false;
    }
  }
  
  /**
   * Save predictions
   */
  public async savePredictions(predictions: any[]): Promise<any[]> {
    try {
      const response = await axios.post(`${config.services.databaseOrchestrator.url}/api/predictions/batch`, {
        predictions,
      });
      
      return response.data.predictions;
    } catch (error: any) {
      logger.error(`Error saving predictions: ${error.message}`, {
        error,
        stack: error.stack,
        predictionCount: predictions.length,
      });
      
      throw error;
    }
  }
  
  /**
   * Get store by ID
   */
  public async getStoreById(storeId: string): Promise<any> {
    try {
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/stores/${storeId}`);
      return response.data.store;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      
      logger.error(`Error getting store by ID ${storeId}: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
      });
      
      return null;
    }
  }
  
  /**
   * Get stores by IDs
   */
  public async getStoresByIds(storeIds: string[]): Promise<any[]> {
    try {
      const response = await axios.post(`${config.services.databaseOrchestrator.url}/api/stores/batch`, {
        storeIds,
      });
      
      return response.data.stores;
    } catch (error: any) {
      logger.error(`Error getting stores by IDs: ${error.message}`, {
        error,
        stack: error.stack,
        storeIds,
      });
      
      return [];
    }
  }
  
  /**
   * Get historical invoices by store ID
   */
  public async getHistoricalInvoicesByStoreId(storeId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/invoices/store/${storeId}`);
      return response.data.invoices;
    } catch (error: any) {
      logger.error(`Error getting historical invoices for store ${storeId}: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
      });
      
      return [];
    }
  }
  
  /**
   * Get historical invoices by store IDs
   */
  public async getHistoricalInvoicesByStoreIds(storeIds: string[]): Promise<any[]> {
    try {
      const response = await axios.post(`${config.services.databaseOrchestrator.url}/api/invoices/stores/batch`, {
        storeIds,
      });
      
      return response.data.invoices;
    } catch (error: any) {
      logger.error(`Error getting historical invoices for stores: ${error.message}`, {
        error,
        stack: error.stack,
        storeIds,
      });
      
      return [];
    }
  }
  
  /**
   * Get predictions by store ID with pagination
   */
  public async getPredictionsByStoreId(storeId: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    try {
      const params = [
        `limit=${limit}`,
        `offset=${offset}`
      ];
      
      const queryString = params.join('&');
      
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/predictions/store/${storeId}?${queryString}`);
      return response.data.predictions || [];
    } catch (error: any) {
      logger.error(`Error getting predictions by store ID: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
        limit,
        offset,
      });
      
      return [];
    }
  }
  
  /**
   * Get predictions with actual orders for accuracy metrics
   */
  public async getPredictionsWithActualOrders(period: string, storeId?: string): Promise<any[]> {
    try {
      let queryString = `period=${encodeURIComponent(period)}`;
      
      if (storeId) {
        queryString += `&storeId=${encodeURIComponent(storeId)}`;
      }
      
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/predictions/with-actual-orders?${queryString}`);
      return response.data.predictions || [];
    } catch (error: any) {
      logger.error(`Error getting predictions with actual orders: ${error.message}`, {
        error,
        stack: error.stack,
        period,
        storeId,
      });
      
      return [];
    }
  }
  
  /**
   * Link prediction to actual order
   */
  public async linkPredictionToActualOrder(predictionId: string, orderId: string): Promise<boolean> {
    try {
      await axios.post(`${config.services.databaseOrchestrator.url}/api/predictions/${predictionId}/link-order`, {
        orderId,
      });
      
      return true;
    } catch (error: any) {
      logger.error(`Error linking prediction to actual order: ${error.message}`, {
        error,
        stack: error.stack,
        predictionId,
        orderId,
      });
      
      return false;
    }
  }
  
  /**
   * Get order by ID
   */
  public async getOrderById(orderId: string): Promise<any> {
    try {
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/orders/${orderId}`);
      return response.data.order;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      
      logger.error(`Error getting order by ID: ${error.message}`, {
        error,
        stack: error.stack,
        orderId,
      });
      
      return null;
    }
  }
  
  /**
   * Schedule model retraining
   */
  public async scheduleModelRetraining(modelType: string): Promise<boolean> {
    try {
      await axios.post(`${config.services.databaseOrchestrator.url}/api/models/retraining`, {
        modelType,
        priority: 'high',
        scheduledAt: new Date().toISOString(),
      });
      
      logger.info(`Scheduled retraining for model: ${modelType}`);
      return true;
    } catch (error: any) {
      logger.error(`Error scheduling model retraining: ${error.message}`, {
        error,
        stack: error.stack,
        modelType,
      });
      
      return false;
    }
  }
  
  /**
   * Get model by type
   */
  public async getModel(modelType: string): Promise<any> {
    try {
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/models/${modelType}`);
      return response.data.model;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      
      logger.error(`Error getting model: ${error.message}`, {
        error,
        stack: error.stack,
        modelType,
      });
      
      return null;
    }
  }
  
  /**
   * Save model
   */
  public async saveModel(modelType: string, modelData: any): Promise<any> {
    try {
      const response = await axios.post(`${config.services.databaseOrchestrator.url}/api/models`, {
        modelType,
        modelData,
        version: new Date().toISOString(),
        metadata: {
          createdAt: new Date().toISOString(),
          framework: 'tensorflow',
        },
      });
      
      return response.data.model;
    } catch (error: any) {
      logger.error(`Error saving model: ${error.message}`, {
        error,
        stack: error.stack,
        modelType,
      });
      
      throw error;
    }
  }
  
  /**
   * Get all historical invoices
   */
  public async getAllHistoricalInvoices(): Promise<any[]> {
    try {
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/invoices`);
      return response.data.invoices;
    } catch (error: any) {
      logger.error(`Error getting all historical invoices: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      return [];
    }
  }
  
  /**
   * Get call prioritization by store ID
   */
  public async getCallPrioritizationByStoreId(storeId: string): Promise<any> {
    try {
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/call-prioritizations/store/${storeId}`);
      return response.data.prioritization;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      
      logger.error(`Error getting call prioritization by store ID: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
      });
      
      return null;
    }
  }
  
  /**
   * Get call prioritization by ID
   */
  public async getCallPrioritizationById(id: string): Promise<any> {
    try {
      const response = await axios.get(`${config.services.databaseOrchestrator.url}/api/call-prioritizations/${id}`);
      return response.data.prioritization;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      
      logger.error(`Error getting call prioritization by ID: ${error.message}`, {
        error,
        stack: error.stack,
        id,
      });
      
      return null;
    }
  }
  
  /**
   * Update call prioritization
   */
  public async updateCallPrioritization(id: string, prioritization: any): Promise<any> {
    try {
      const response = await axios.put(`${config.services.databaseOrchestrator.url}/api/call-prioritizations/${id}`, prioritization);
      return response.data.prioritization;
    } catch (error: any) {
      logger.error(`Error updating call prioritization: ${error.message}`, {
        error,
        stack: error.stack,
        id,
      });
      
      throw error;
    }
  }
  
  /**
   * Link call prioritization to order
   */
  public async linkCallPrioritizationToOrder(prioritizationId: string, orderId: string): Promise<boolean> {
    try {
      await axios.post(`${config.services.databaseOrchestrator.url}/api/call-prioritizations/${prioritizationId}/link-order`, {
        orderId,
      });
      
      return true;
    } catch (error: any) {
      logger.error(`Error linking call prioritization to order: ${error.message}`, {
        error,
        stack: error.stack,
        prioritizationId,
        orderId,
      });
      
      return false;
    }
  }
}

// Export singleton instance
export const enhancedDatabaseClient = new EnhancedDatabaseClient();
