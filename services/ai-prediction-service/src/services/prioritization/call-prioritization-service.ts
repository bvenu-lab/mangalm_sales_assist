import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import config from '../../config';
import { enhancedDatabaseClient } from '../database/enhanced-database-client';

/**
 * Interface for store data
 */
export interface Store {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  lastOrderDate?: string;
  salesAgentId?: string;
  status?: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt?: string;
}

/**
 * Interface for predicted order data
 */
export interface PredictedOrder {
  id: string;
  storeId: string;
  predictedDate: string;
  totalAmount: number;
  confidence: number;
  status: string;
  items: any[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * Interface for call prioritization data
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
 * Interface for store with additional data for prioritization
 */
export interface StoreWithPrioritizationData extends Store {
  daysSinceLastOrder: number;
  predictedOrderValue: number;
  predictedConfidence: number;
  geographicCluster?: string;
  salesAgentWorkload?: number;
}

/**
 * Service for prioritizing sales calls to stores
 */
export class CallPrioritizationService {
  private daysSinceOrderWeight: number;
  private predictedValueWeight: number;
  private confidenceWeight: number;
  private geographicWeight: number;
  private workloadWeight: number;
  private readonly maxPriorityScore: number;

  constructor() {
    // Load configuration weights
    this.daysSinceOrderWeight = parseFloat(config.prioritization.daysSinceOrderWeight);
    this.predictedValueWeight = parseFloat(config.prioritization.predictedValueWeight);
    this.confidenceWeight = parseFloat(config.prioritization.confidenceWeight);
    this.geographicWeight = parseFloat(config.prioritization.geographicWeight);
    this.workloadWeight = parseFloat(config.prioritization.workloadWeight);
    this.maxPriorityScore = 100;
    
    logger.info('CallPrioritizationService initialized', {
      daysSinceOrderWeight: this.daysSinceOrderWeight,
      predictedValueWeight: this.predictedValueWeight,
      confidenceWeight: this.confidenceWeight,
      geographicWeight: this.geographicWeight,
      workloadWeight: this.workloadWeight,
      maxPriorityScore: this.maxPriorityScore,
    });
  }

  /**
   * Generate call prioritization for all stores
   * @returns Array of call prioritizations
   */
  public async generatePrioritization(storeIds?: string[], salesAgentId?: string, options?: any): Promise<CallPrioritization[]> {
    return this.generateCallPrioritization(storeIds, salesAgentId, options);
  }
  
  /**
   * Generate call prioritization for all stores (alias for generatePrioritization)
   * @returns Array of call prioritizations
   */
  public async generateCallPrioritization(storeIds?: string[], salesAgentId?: string, options?: any): Promise<CallPrioritization[]> {
    try {
      logger.info('Generating call prioritization for all stores');
      
      // Get all stores
      const stores = await enhancedDatabaseClient.getAllStores();
      
      if (stores.length === 0) {
        logger.warn('No stores found for call prioritization');
        return [];
      }
      
      // Get predicted orders for all stores
      const storesWithData: StoreWithPrioritizationData[] = [];
      
      for (const store of stores) {
        try {
          // Get predicted orders
          const predictedOrders = await enhancedDatabaseClient.getPredictedOrders(store.id);
          
          // Calculate days since last order
          const lastOrderDate = new Date(store.lastOrderDate);
          const now = new Date();
          const daysSinceLastOrder = Math.floor(
            (now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          // Calculate predicted order value and confidence
          let predictedOrderValue = 0;
          let predictedConfidence = 0;
          
          if (predictedOrders.length > 0) {
            // Use the most recent prediction
            const latestPrediction = predictedOrders.reduce((latest, current) => {
              return new Date(current.predictedDate) > new Date(latest.predictedDate) ? current : latest;
            }, predictedOrders[0]);
            
            predictedOrderValue = latestPrediction.totalAmount;
            predictedConfidence = latestPrediction.confidence;
          }
          
          // Add store with additional data
          storesWithData.push({
            ...store,
            daysSinceLastOrder,
            predictedOrderValue,
            predictedConfidence,
            // Geographic clustering would be based on latitude/longitude
            geographicCluster: store.latitude && store.longitude ? this.getGeographicCluster(store) : undefined,
            // Sales agent workload would come from a separate service
            salesAgentWorkload: store.salesAgentId ? await this.getSalesAgentWorkload(store.salesAgentId) : undefined,
          });
        } catch (storeError: any) {
          logger.error(`Error processing store ${store.id} for prioritization: ${storeError.message}`, {
            error: storeError,
            stack: storeError.stack,
            storeId: store.id,
          });
          // Continue with other stores
        }
      }
      
      // Calculate priority scores
      const prioritizations = this.calculatePriorityScores(storesWithData);
      
      // Save prioritizations to database
      const savedPrioritizations = await this.savePrioritizations(prioritizations);
      
      logger.info(`Generated ${savedPrioritizations.length} call prioritizations`);
      
      return savedPrioritizations;
    } catch (error: any) {
      logger.error(`Error generating call prioritization: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      throw new Error(`Failed to generate call prioritization: ${error.message}`);
    }
  }

  /**
   * Calculate priority scores for stores
   * @param stores Stores with prioritization data
   * @returns Array of call prioritizations
   */
  private calculatePriorityScores(stores: StoreWithPrioritizationData[]): CallPrioritization[] {
    // Calculate raw scores
    const rawScores = stores.map(store => {
      // Days since last order score (higher is better)
      // Cap at 60 days to prevent extreme values
      const daysSinceOrderScore = Math.min(store.daysSinceLastOrder, 60) / 60;
      
      // Predicted value score (higher is better)
      // Normalize to 0-1 range based on the highest value in the dataset
      const maxPredictedValue = Math.max(...stores.map(s => s.predictedOrderValue));
      const predictedValueScore = maxPredictedValue > 0 ? store.predictedOrderValue / maxPredictedValue : 0;
      
      // Confidence score (higher is better)
      const confidenceScore = store.predictedConfidence;
      
      // Geographic cluster score (based on proximity to other stores)
      // This would be more sophisticated in a real implementation
      const geographicScore = store.geographicCluster ? 0.5 : 0;
      
      // Workload score (lower workload is better)
      // Normalize to 0-1 range, invert so lower workload = higher score
      const maxWorkload = Math.max(...stores.filter(s => s.salesAgentWorkload !== undefined).map(s => s.salesAgentWorkload!));
      const workloadScore = store.salesAgentWorkload !== undefined && maxWorkload > 0 
        ? 1 - (store.salesAgentWorkload / maxWorkload) 
        : 0.5; // Default to middle value if unknown
      
      // Calculate weighted score
      const weightedScore = 
        (daysSinceOrderScore * this.daysSinceOrderWeight) +
        (predictedValueScore * this.predictedValueWeight) +
        (confidenceScore * this.confidenceWeight) +
        (geographicScore * this.geographicWeight) +
        (workloadScore * this.workloadWeight);
      
      // Normalize to max priority score
      const priorityScore = Math.round(weightedScore * this.maxPriorityScore);
      
      // Generate priority reason
      const reasons = [];
      
      if (store.daysSinceLastOrder > 30) {
        reasons.push(`${store.daysSinceLastOrder} days since last order`);
      }
      
      if (store.predictedOrderValue > 0) {
        reasons.push(`Predicted order value: $${store.predictedOrderValue.toFixed(2)}`);
      }
      
      if (store.predictedConfidence > 0.7) {
        reasons.push(`High confidence prediction (${(store.predictedConfidence * 100).toFixed(0)}%)`);
      }
      
      // Create prioritization
      return {
        id: uuidv4(),
        store_id: store.id,
        priority_score: priorityScore,
        priority_reason: reasons.join(', '),
        last_call_date: undefined, // Would be populated from call history
        next_call_date: this.calculateNextCallDate(store, priorityScore),
        assigned_agent: store.salesAgentId,
        status: 'Pending' as 'Pending' | 'Completed' | 'Skipped',
        created_at: new Date().toISOString(),
      };
    });
    
    // Sort by priority score (descending)
    return rawScores.sort((a, b) => b.priority_score - a.priority_score);
  }

  /**
   * Calculate next call date based on priority score
   * @param store Store data
   * @param priorityScore Priority score
   * @returns Next call date as ISO string
   */
  private calculateNextCallDate(store: StoreWithPrioritizationData, priorityScore: number): string {
    const now = new Date();
    
    // High priority (>80) = call within 1 day
    // Medium priority (50-80) = call within 3 days
    // Low priority (<50) = call within 7 days
    let daysToAdd = 7;
    
    if (priorityScore > 80) {
      daysToAdd = 1;
    } else if (priorityScore > 50) {
      daysToAdd = 3;
    }
    
    // If it's been a long time since last order, prioritize sooner
    if (store.daysSinceLastOrder > 45) {
      daysToAdd = Math.max(1, daysToAdd - 2);
    }
    
    // Calculate next call date
    const nextCallDate = new Date(now);
    nextCallDate.setDate(now.getDate() + daysToAdd);
    
    return nextCallDate.toISOString();
  }

  /**
   * Get geographic cluster for a store
   * @param store Store data
   * @returns Geographic cluster identifier
   */
  private getGeographicCluster(store: Store): string {
    // This would be a more sophisticated algorithm in a real implementation
    // For now, just use a simple grid-based clustering
    if (!store.latitude || !store.longitude) {
      return 'unknown';
    }
    
    // Round to nearest 0.5 degree for simple clustering
    const latCluster = Math.round(store.latitude * 2) / 2;
    const lonCluster = Math.round(store.longitude * 2) / 2;
    
    return `${latCluster},${lonCluster}`;
  }

  /**
   * Get workload for a sales agent
   * @param agentId Sales agent ID
   * @returns Workload score (number of pending calls)
   */
  private async getSalesAgentWorkload(agentId: string): Promise<number> {
    try {
      // In a real implementation, this would query the database for the agent's current workload
      // For now, return a random value between 1 and 10
      return Math.floor(Math.random() * 10) + 1;
    } catch (error) {
      logger.error(`Error getting workload for agent ${agentId}`, { error, agentId });
      return 5; // Default to middle value
    }
  }

  /**
   * Save prioritizations to database
   * @param prioritizations Call prioritizations to save
   * @returns Saved call prioritizations
   */
  private async savePrioritizations(prioritizations: CallPrioritization[]): Promise<CallPrioritization[]> {
    try {
      // Delete existing prioritizations
      await enhancedDatabaseClient.deleteCallPrioritizations();
      
      // Save new prioritizations
      const savedPrioritizations = await enhancedDatabaseClient.saveCallPrioritizations(prioritizations);
      
      return savedPrioritizations;
    } catch (error: any) {
      logger.error(`Error saving call prioritizations: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      throw new Error(`Failed to save call prioritizations: ${error.message}`);
    }
  }

  /**
   * Get call prioritizations for a specific agent
   * @param agentId Sales agent ID
   * @param limit Number of prioritizations to return
   * @param offset Offset for pagination
   * @returns Array of call prioritizations
   */
  public async getPrioritizationByAgent(agentId: string, limit: number = 10, offset: number = 0): Promise<CallPrioritization[]> {
    return this.getCallPrioritizationsForAgent(agentId, limit, offset);
  }
  
  /**
   * Get call prioritizations for a specific agent (alias for getPrioritizationByAgent)
   * @param agentId Sales agent ID
   * @param limit Number of prioritizations to return
   * @param offset Offset for pagination
   * @returns Array of call prioritizations
   */
  public async getCallPrioritizationsForAgent(agentId: string, limit: number = 10, offset: number = 0): Promise<CallPrioritization[]> {
    try {
      logger.info(`Getting call prioritizations for agent ${agentId}`);
      
      // Get prioritizations from database
      const prioritizations = await enhancedDatabaseClient.getCallPrioritizationsForAgent(agentId);
      
      return prioritizations;
    } catch (error: any) {
      logger.error(`Error getting call prioritizations for agent ${agentId}: ${error.message}`, {
        error,
        stack: error.stack,
        agentId,
      });
      
      throw new Error(`Failed to get call prioritizations: ${error.message}`);
    }
  }

  /**
   * Update call prioritization status
   * @param id Call prioritization ID
   * @param status New status
   * @param notes Optional notes about the status update
   * @returns Updated call prioritization
   */
  public async updatePrioritizationStatus(
    id: string,
    status: 'Pending' | 'Completed' | 'Skipped',
    notes?: string
  ): Promise<CallPrioritization> {
    return this.updateCallPrioritizationStatus(id, status, notes);
  }
  
  /**
   * Update call prioritization status (alias for updatePrioritizationStatus)
   * @param id Call prioritization ID
   * @param status New status
   * @param notes Optional notes about the status update
   * @returns Updated call prioritization
   */
  public async updateCallPrioritizationStatus(
    id: string,
    status: 'Pending' | 'Completed' | 'Skipped',
    notes?: string
  ): Promise<CallPrioritization> {
    try {
      logger.info(`Updating call prioritization ${id} status to ${status}`);
      
      // Update status in database
      const updatedPrioritization = await enhancedDatabaseClient.updateCallPrioritizationStatus(id, status);
      
      return updatedPrioritization;
    } catch (error: any) {
      logger.error(`Error updating call prioritization ${id} status: ${error.message}`, {
        error,
        stack: error.stack,
        id,
        status,
      });
      
      throw new Error(`Failed to update call prioritization status: ${error.message}`);
    }
  }

  /**
   * Assign call prioritization to an agent
   * @param id Call prioritization ID
   * @param agentId Sales agent ID
   * @returns Updated call prioritization
   */
  public async assignCallPrioritization(id: string, agentId: string): Promise<CallPrioritization> {
    try {
      logger.info(`Assigning call prioritization ${id} to agent ${agentId}`);
      
      // Update assignment in database
      const updatedPrioritization = await enhancedDatabaseClient.assignCallPrioritization(id, agentId);
      
      return updatedPrioritization;
    } catch (error: any) {
      logger.error(`Error assigning call prioritization ${id} to agent ${agentId}: ${error.message}`, {
        error,
        stack: error.stack,
        id,
        agentId,
      });
      
      throw new Error(`Failed to assign call prioritization: ${error.message}`);
    }
  }
  
  /**
   * Get call prioritization for a specific store
   * @param storeId Store ID
   * @returns Call prioritization for the store
   */
  public async getPrioritizationByStore(storeId: string): Promise<CallPrioritization | null> {
    try {
      logger.info(`Getting call prioritization for store ${storeId}`);
      
      // Get prioritization from database
      const prioritization = await enhancedDatabaseClient.getCallPrioritizationByStoreId(storeId);
      
      return prioritization;
    } catch (error: any) {
      logger.error(`Error getting call prioritization for store ${storeId}: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
      });
      
      throw new Error(`Failed to get call prioritization: ${error.message}`);
    }
  }
  
  /**
   * Submit feedback on call prioritization
   * @param prioritizationId Call prioritization ID
   * @param feedback Feedback data
   * @param resultOrderId Optional result order ID
   * @returns Success status
   */
  public async submitFeedback(prioritizationId: string, feedback: any, resultOrderId?: string): Promise<boolean> {
    try {
      logger.info(`Submitting feedback for call prioritization ${prioritizationId}`);
      
      // Get prioritization
      const prioritization = await enhancedDatabaseClient.getCallPrioritizationById(prioritizationId);
      
      if (!prioritization) {
        throw new Error(`Call prioritization not found with ID: ${prioritizationId}`);
      }
      
      // Update prioritization with feedback
      const updatedPrioritization = {
        ...prioritization,
        feedback: {
          ...feedback,
          submittedAt: new Date().toISOString(),
        },
        resultOrderId,
        updated_at: new Date().toISOString(),
      };
      
      // Save updated prioritization
      await enhancedDatabaseClient.updateCallPrioritization(prioritizationId, updatedPrioritization);
      
      // If result order ID is provided, link it to the prioritization
      if (resultOrderId) {
        await enhancedDatabaseClient.linkCallPrioritizationToOrder(prioritizationId, resultOrderId);
      }
      
      // Use feedback to improve prioritization algorithm
      this.useFeedbackToImprovePrioritization(prioritization, feedback, resultOrderId);
      
      return true;
    } catch (error: any) {
      logger.error(`Error submitting feedback: ${error.message}`, {
        error,
        stack: error.stack,
        prioritizationId,
      });
      
      throw new Error(`Failed to submit feedback: ${error.message}`);
    }
  }
  
  /**
   * Use feedback to improve prioritization algorithm
   * @param prioritization Original prioritization
   * @param feedback Feedback data
   * @param resultOrderId Optional result order ID
   */
  private async useFeedbackToImprovePrioritization(prioritization: any, feedback: any, resultOrderId?: string): Promise<void> {
    try {
      // If no result order ID, we can't use it for training
      if (!resultOrderId) {
        return;
      }
      
      // Get result order
      const resultOrder = await enhancedDatabaseClient.getOrderById(resultOrderId);
      
      if (!resultOrder) {
        logger.warn(`Result order not found with ID: ${resultOrderId}`);
        return;
      }
      
      // Adjust weights based on feedback
      if (feedback.type === 'positive') {
        // Increase weights for factors that contributed to this prioritization
        if (prioritization.priority_reason?.includes('days since last order')) {
          this.daysSinceOrderWeight *= 1.05;
        }
        
        if (prioritization.priority_reason?.includes('Predicted order value')) {
          this.predictedValueWeight *= 1.05;
        }
        
        if (prioritization.priority_reason?.includes('High confidence prediction')) {
          this.confidenceWeight *= 1.05;
        }
      } else if (feedback.type === 'negative') {
        // Decrease weights for factors that contributed to this prioritization
        if (prioritization.priority_reason?.includes('days since last order')) {
          this.daysSinceOrderWeight *= 0.95;
        }
        
        if (prioritization.priority_reason?.includes('Predicted order value')) {
          this.predictedValueWeight *= 0.95;
        }
        
        if (prioritization.priority_reason?.includes('High confidence prediction')) {
          this.confidenceWeight *= 0.95;
        }
      }
      
      // Normalize weights to ensure they sum to 1
      const totalWeight = this.daysSinceOrderWeight + this.predictedValueWeight + 
                          this.confidenceWeight + this.geographicWeight + this.workloadWeight;
      
      this.daysSinceOrderWeight /= totalWeight;
      this.predictedValueWeight /= totalWeight;
      this.confidenceWeight /= totalWeight;
      this.geographicWeight /= totalWeight;
      this.workloadWeight /= totalWeight;
      
      logger.info('Updated prioritization weights based on feedback', {
        daysSinceOrderWeight: this.daysSinceOrderWeight,
        predictedValueWeight: this.predictedValueWeight,
        confidenceWeight: this.confidenceWeight,
        geographicWeight: this.geographicWeight,
        workloadWeight: this.workloadWeight,
      });
    } catch (error: any) {
      logger.error(`Error using feedback to improve prioritization: ${error.message}`, {
        error,
        stack: error.stack,
      });
    }
  }
}

// Export singleton instance
export const callPrioritizationService = new CallPrioritizationService();
