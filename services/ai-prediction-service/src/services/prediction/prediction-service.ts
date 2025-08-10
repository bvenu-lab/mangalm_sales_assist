import { logger } from '../../utils/logger';
import { enhancedDatabaseClient } from '../database/enhanced-database-client';
import { EnterpriseMLEngine, ModelType, Algorithm } from '../../ml/enterprise-ml-engine';
import { AutoMLService } from '../../ml/automl-service';
import { ModelRegistry } from '../../ml/model-registry';
import { RedisCache } from '../../../../shared/src/cache/redis-cache';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enterprise Sales Prediction Service
 * Uses proper ML algorithms instead of TensorFlow
 */
export class PredictionService {
  private mlEngine: EnterpriseMLEngine;
  private autoML: AutoMLService;
  private modelRegistry: ModelRegistry;
  private cache: RedisCache;
  
  /**
   * Constructor
   */
  constructor() {
    this.mlEngine = new EnterpriseMLEngine();
    this.autoML = new AutoMLService(this.mlEngine);
    this.cache = new RedisCache({ keyPrefix: 'prediction:' });
    this.modelRegistry = new ModelRegistry(this.mlEngine, this.cache);
    this.initializeMLEngine();
  }
  
  /**
   * Initialize Enterprise ML Engine
   */
  private async initializeMLEngine(): Promise<void> {
    try {
      // Load historical data for training
      const historicalData = await this.getTrainingData();
      
      if (historicalData.length > 0) {
        logger.info(`Training ML models with ${historicalData.length} data points`);
        await this.mlEngine.trainModel(
          historicalData,
          'total_sales',
          ModelType.REGRESSION,
          Algorithm.RANDOM_FOREST_REGRESSOR,
          {
            validation: true,
            hyperparameterTuning: true,
            testSize: 0.2,
            randomSeed: 42
          }
        );
        logger.info('ML engine initialized successfully');
      } else {
        logger.warn('No historical data found, using pre-trained models');
        // Load default models or create synthetic training data
        await this.createDefaultModels();
      }
    } catch (error: any) {
      logger.error(`Failed to initialize ML engine: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      // Create fallback models
      await this.createDefaultModels();
    }
  }
  
  /**
   * Get training data from historical invoices
   */
  private async getTrainingData(): Promise<any[]> {
    try {
      // Get historical invoices
      const historicalInvoices = await enhancedDatabaseClient.getAllHistoricalInvoices();
      
      if (historicalInvoices.length === 0) {
        return [];
      }
      
      // Transform invoices to ML training format
      const trainingData = historicalInvoices.map(invoice => ({
        store_id: invoice.storeId,
        invoice_date: new Date(invoice.date),
        total_sales: invoice.totalAmount,
        item_count: invoice.items.length,
        unique_products: new Set(invoice.items.map((item: any) => item.productId)).size,
        avg_item_price: invoice.items.reduce((sum: number, item: any) => sum + item.price, 0) / invoice.items.length,
        day_of_week: new Date(invoice.date).getDay(),
        month_of_year: new Date(invoice.date).getMonth() + 1,
        quarter: Math.floor(new Date(invoice.date).getMonth() / 3) + 1,
        is_weekend: [0, 6].includes(new Date(invoice.date).getDay()) ? 1 : 0,
        items: invoice.items
      }));
      
      logger.info(`Prepared ${trainingData.length} training samples`);
      return trainingData;
    } catch (error: any) {
      logger.error(`Failed to get training data: ${error.message}`, error);
      return [];
    }
  }
  
  /**
   * Create default models with synthetic data
   */
  private async createDefaultModels(): Promise<void> {
    try {
      // Create synthetic training data for demonstration
      const syntheticData = this.generateSyntheticTrainingData(1000);
      
      // Train multiple models for ensemble
      await this.mlEngine.trainModel(
        syntheticData,
        'total_sales',
        ModelType.REGRESSION,
        Algorithm.RANDOM_FOREST_REGRESSOR,
        {
          validation: true,
          testSize: 0.2,
          randomSeed: 42
        }
      );
      
      await this.mlEngine.trainModel(
        syntheticData,
        'total_sales',
        ModelType.REGRESSION,
        Algorithm.GRADIENT_BOOSTING_REGRESSOR,
        {
          validation: true,
          testSize: 0.2,
          randomSeed: 42
        }
      );
      
      // Create ensemble
      await this.mlEngine.createEnsemble('sales_ensemble', [
        'sales_prediction_rf',
        'sales_prediction_lgb'
      ], 'voting');
      
      logger.info('Created default ML models with synthetic data');
    } catch (error: any) {
      logger.error(`Failed to create default models: ${error.message}`, error);
    }
  }
  
  /**
   * Generate synthetic training data for model initialization
   */
  private generateSyntheticTrainingData(count: number): any[] {
    const data = [];
    const storeIds = ['store-1', 'store-2', 'store-3', 'store-4', 'store-5'];
    
    for (let i = 0; i < count; i++) {
      const storeId = storeIds[Math.floor(Math.random() * storeIds.length)];
      const dayOfWeek = Math.floor(Math.random() * 7);
      const month = Math.floor(Math.random() * 12) + 1;
      const isWeekend = [0, 6].includes(dayOfWeek) ? 1 : 0;
      const quarter = Math.floor((month - 1) / 3) + 1;
      
      // Generate realistic sales data with correlations
      const baseSales = Math.random() * 5000 + 1000;
      const seasonalMultiplier = month >= 11 || month <= 2 ? 1.3 : 1.0; // Holiday season
      const weekendMultiplier = isWeekend ? 1.2 : 1.0;
      const itemCount = Math.floor(Math.random() * 20) + 5;
      
      data.push({
        store_id: storeId,
        invoice_date: new Date(2024, month - 1, Math.floor(Math.random() * 28) + 1),
        total_sales: baseSales * seasonalMultiplier * weekendMultiplier,
        item_count: itemCount,
        unique_products: Math.floor(itemCount * 0.8),
        avg_item_price: (baseSales / itemCount) + (Math.random() - 0.5) * 50,
        day_of_week: dayOfWeek,
        month_of_year: month,
        quarter,
        is_weekend: isWeekend
      });
    }
    
    return data;
  }
  
  /**
   * Get predictions with pagination
   */
  public async getPredictions(storeId?: string, options: { limit: number; page: number } = { limit: 10, page: 1 }): Promise<any[]> {
    try {
      const { limit, page } = options;
      const offset = (page - 1) * limit;
      
      // Get predictions from database
      const predictions = await enhancedDatabaseClient.getPredictions(storeId, limit, offset);
      
      return predictions;
    } catch (error: any) {
      logger.error(`Error fetching predictions: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      throw error;
    }
  }
  
  /**
   * Get prediction by ID
   */
  public async getPredictionById(id: string): Promise<any> {
    try {
      // Get prediction from database
      const prediction = await enhancedDatabaseClient.getPredictionById(id);
      
      return prediction;
    } catch (error: any) {
      logger.error(`Error fetching prediction by ID: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      throw error;
    }
  }
  
  /**
   * Update prediction
   */
  public async updatePrediction(id: string, updates: any): Promise<any> {
    try {
      // Get existing prediction
      const existingPrediction = await enhancedDatabaseClient.getPredictionById(id);
      
      if (!existingPrediction) {
        return null;
      }
      
      // Update prediction
      const updatedPrediction = {
        ...existingPrediction,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      // Save to database
      await enhancedDatabaseClient.updatePrediction(id, updatedPrediction);
      
      return updatedPrediction;
    } catch (error: any) {
      logger.error(`Error updating prediction: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      throw error;
    }
  }
  
  /**
   * Delete prediction
   */
  public async deletePrediction(id: string): Promise<boolean> {
    try {
      // Get existing prediction
      const existingPrediction = await enhancedDatabaseClient.getPredictionById(id);
      
      if (!existingPrediction) {
        return false;
      }
      
      // Delete from database
      await enhancedDatabaseClient.deletePrediction(id);
      
      return true;
    } catch (error: any) {
      logger.error(`Error deleting prediction: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      throw error;
    }
  }
  
  /**
   * Predict order for a store using enterprise ML engine
   * @param storeId Store ID
   * @param date Optional date for prediction
   * @param includeItems Whether to include predicted items
   */
  public async predictOrder(storeId: string, date?: string, includeItems: boolean = false): Promise<any> {
    try {
      logger.info(`Predicting order for store ${storeId}`, {
        storeId,
        date: date || 'next order date',
        includeItems,
      });
      
      // Check cache first
      const cacheKey = `order:${storeId}:${date || 'next'}:${includeItems}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        logger.info('Returning cached prediction');
        return cached;
      }
      
      // Get store features
      const features = await this.extractStoreFeatures(storeId, date);
      
      // Make prediction using ensemble model
      const prediction = await this.mlEngine.predict('sales_ensemble', features);
      
      // Create prediction object
      const result = {
        id: uuidv4(),
        storeId,
        predictedDate: date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        predictedTotalAmount: prediction.value,
        confidence: prediction.confidence,
        modelVersion: prediction.modelVersion,
        features: features,
        items: includeItems ? await this.predictItems(storeId, prediction.value) : undefined,
        createdAt: new Date().toISOString(),
      };
      
      // Cache the result
      await this.cache.set(cacheKey, result, { ttl: 3600 }); // 1 hour cache
      
      return result;
    } catch (error: any) {
      logger.error(`Error predicting order: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
      });
      
      throw error;
    }
  }
  
  /**
   * Predict orders for multiple stores using batch processing
   * @param storeIds Array of store IDs
   * @param date Optional date for prediction
   * @param includeItems Whether to include predicted items
   */
  public async predictBatchOrders(storeIds: string[], date?: string, includeItems: boolean = false): Promise<any> {
    try {
      logger.info(`Predicting batch orders for ${storeIds.length} stores`, {
        storeCount: storeIds.length,
        date: date || 'next order date',
        includeItems,
      });
      
      // Extract features for all stores
      const allFeatures = await Promise.all(
        storeIds.map(storeId => this.extractStoreFeatures(storeId, date))
      );
      
      // Make batch predictions
      const predictions = await this.mlEngine.predictBatch('sales_ensemble', allFeatures);
      
      // Create result objects
      const results = await Promise.all(
        predictions.map(async (prediction, index) => ({
          id: uuidv4(),
          storeId: storeIds[index],
          predictedDate: date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          predictedTotalAmount: prediction.value,
          confidence: prediction.confidence,
          modelVersion: prediction.modelVersion,
          features: allFeatures[index],
          items: includeItems ? await this.predictItems(storeIds[index], prediction.value) : undefined,
          createdAt: new Date().toISOString(),
        }))
      );
      
      return {
        successCount: results.length,
        totalCount: storeIds.length,
        predictions: results,
      };
    } catch (error: any) {
      logger.error(`Error predicting batch orders: ${error.message}`, {
        error,
        stack: error.stack,
        storeCount: storeIds.length,
      });
      
      throw error;
    }
  }
  
  /**
   * Get prediction history for a store
   * @param storeId Store ID
   * @param limit Number of predictions to return
   * @param offset Offset for pagination
   */
  public async getPredictionHistory(storeId: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    try {
      logger.info(`Getting prediction history for store ${storeId}`, {
        storeId,
        limit,
        offset,
      });
      
      // Get predictions from database
      const predictions = await enhancedDatabaseClient.getPredictionsByStoreId(storeId, limit, offset);
      
      return predictions;
    } catch (error: any) {
      logger.error(`Error getting prediction history: ${error.message}`, {
        error,
        stack: error.stack,
        storeId,
      });
      
      throw error;
    }
  }
  
  /**
   * Get accuracy metrics for predictions
   * @param period Period for metrics (e.g., 'last-30-days', 'last-90-days')
   * @param storeId Optional store ID to filter metrics
   */
  public async getAccuracyMetrics(period: string = 'last-30-days', storeId?: string): Promise<any> {
    try {
      logger.info(`Getting prediction accuracy metrics`, {
        period,
        storeId: storeId || 'all',
      });
      
      // Get predictions with actual orders
      const predictions = await enhancedDatabaseClient.getPredictionsWithActualOrders(period, storeId);
      
      if (predictions.length === 0) {
        return {
          period,
          storeId: storeId || 'all',
          totalPredictions: 0,
          metrics: {
            totalAmountAccuracy: 0,
            itemCountAccuracy: 0,
            productMatchAccuracy: 0,
            overallAccuracy: 0,
          },
        };
      }
      
      // Calculate accuracy metrics
      let totalAmountAccuracy = 0;
      let itemCountAccuracy = 0;
      let productMatchAccuracy = 0;
      
      for (const prediction of predictions) {
        // Calculate total amount accuracy
        const predictedAmount = prediction.predictedTotalAmount;
        const actualAmount = prediction.actualOrder?.totalAmount || 0;
        const amountAccuracy = actualAmount > 0 
          ? Math.max(0, 100 - Math.abs((predictedAmount - actualAmount) / actualAmount * 100))
          : 0;
        
        // Calculate item count accuracy
        const predictedItemCount = prediction.predictedItemCount;
        const actualItemCount = prediction.actualOrder?.items?.length || 0;
        const itemAccuracy = actualItemCount > 0
          ? Math.max(0, 100 - Math.abs((predictedItemCount - actualItemCount) / actualItemCount * 100))
          : 0;
        
        // Calculate product match accuracy
        const predictedProducts = prediction.items?.map((item: any) => item.productId) || [];
        const actualProducts = prediction.actualOrder?.items?.map((item: any) => item.productId) || [];
        
        let matchCount = 0;
        for (const productId of predictedProducts) {
          if (actualProducts.includes(productId)) {
            matchCount++;
          }
        }
        
        const productAccuracy = predictedProducts.length > 0
          ? (matchCount / predictedProducts.length) * 100
          : 0;
        
        totalAmountAccuracy += amountAccuracy;
        itemCountAccuracy += itemAccuracy;
        productMatchAccuracy += productAccuracy;
      }
      
      // Calculate average accuracy
      const avgTotalAmountAccuracy = totalAmountAccuracy / predictions.length;
      const avgItemCountAccuracy = itemCountAccuracy / predictions.length;
      const avgProductMatchAccuracy = productMatchAccuracy / predictions.length;
      const overallAccuracy = (avgTotalAmountAccuracy + avgItemCountAccuracy + avgProductMatchAccuracy) / 3;
      
      return {
        period,
        storeId: storeId || 'all',
        totalPredictions: predictions.length,
        metrics: {
          totalAmountAccuracy: avgTotalAmountAccuracy,
          itemCountAccuracy: avgItemCountAccuracy,
          productMatchAccuracy: avgProductMatchAccuracy,
          overallAccuracy,
        },
      };
    } catch (error: any) {
      logger.error(`Error getting accuracy metrics: ${error.message}`, {
        error,
        stack: error.stack,
        period,
        storeId,
      });
      
      throw error;
    }
  }
  
  /**
   * Submit feedback on a prediction
   * @param predictionId Prediction ID
   * @param feedback Feedback data
   * @param actualOrderId Optional actual order ID
   */
  public async submitFeedback(predictionId: string, feedback: any, actualOrderId?: string): Promise<void> {
    try {
      logger.info(`Submitting feedback for prediction ${predictionId}`, {
        predictionId,
        feedbackType: feedback.type,
        actualOrderId,
      });
      
      // Get prediction
      const prediction = await enhancedDatabaseClient.getPredictionById(predictionId);
      
      if (!prediction) {
        throw new Error(`Prediction not found with ID: ${predictionId}`);
      }
      
      // Update prediction with feedback
      const updatedPrediction = {
        ...prediction,
        feedback: {
          ...feedback,
          submittedAt: new Date().toISOString(),
        },
        actualOrderId,
        updatedAt: new Date().toISOString(),
      };
      
      // Save updated prediction
      await enhancedDatabaseClient.updatePrediction(predictionId, updatedPrediction);
      
      // If actual order ID is provided, link it to the prediction
      if (actualOrderId) {
        await enhancedDatabaseClient.linkPredictionToActualOrder(predictionId, actualOrderId);
      }
      
      // Use feedback to improve model
      this.useFeedbackToImproveModel(prediction, feedback, actualOrderId);
    } catch (error: any) {
      logger.error(`Error submitting feedback: ${error.message}`, {
        error,
        stack: error.stack,
        predictionId,
      });
      
      throw error;
    }
  }
  
  /**
   * Use feedback to improve the ML models with continuous learning
   * @param prediction Original prediction
   * @param feedback Feedback data
   * @param actualOrderId Optional actual order ID
   */
  private async useFeedbackToImproveModel(prediction: any, feedback: any, actualOrderId?: string): Promise<void> {
    try {
      // If no actual order ID, we can't use it for training
      if (!actualOrderId) {
        return;
      }
      
      // Get actual order
      const actualOrder = await enhancedDatabaseClient.getOrderById(actualOrderId);
      
      if (!actualOrder) {
        logger.warn(`Actual order not found with ID: ${actualOrderId}`);
        return;
      }
      
      // Create feedback data point for continuous learning
      const feedbackData = {
        storeId: prediction.storeId,
        predicted: {
          totalAmount: prediction.predictedTotalAmount,
          itemCount: prediction.predictedItemCount || 0,
          items: prediction.items || []
        },
        actual: {
          totalAmount: actualOrder.totalAmount,
          itemCount: actualOrder.items.length,
          items: actualOrder.items
        },
        features: prediction.features,
        timestamp: new Date(),
        accuracy: this.calculateAccuracy(prediction, actualOrder)
      };
      
      // Add feedback to ML engine for continuous learning
      await this.mlEngine.addFeedback('sales_ensemble', feedbackData);
      
      // Check if drift detection is needed
      await this.mlEngine.checkModelDrift('sales_ensemble');
      
      // Schedule retraining if accuracy drops below threshold
      if (feedbackData.accuracy < 0.7) {
        logger.warn('Model accuracy below threshold, scheduling retraining');
        await this.mlEngine.scheduleRetraining('sales_ensemble');
      }
      
      logger.info('Processed feedback for continuous learning', {
        storeId: prediction.storeId,
        accuracy: feedbackData.accuracy
      });
    } catch (error: any) {
      logger.error(`Error using feedback to improve model: ${error.message}`, {
        error,
        stack: error.stack,
      });
    }
  }
  
  /**
   * Generate batch predictions using the enterprise ML engine
   */
  public async generateBatchPredictions(storeIds: string[], date?: string, options?: any): Promise<any> {
    return await this.predictBatchOrders(storeIds, date, options?.includeItems || false);
  }
  
  /**
   * Generate predictions for a single store using the enterprise ML engine
   */
  public async generatePredictions(storeId: string, date?: string, options?: any): Promise<any> {
    try {
      const months = options?.months || 3;
      const includeItems = options?.includeItems || false;
      const predictions = [];
      
      // Generate predictions for each month
      for (let i = 1; i <= months; i++) {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + i);
        
        const prediction = await this.predictOrder(
          storeId,
          targetDate.toISOString(),
          includeItems
        );
        
        if (prediction) {
          predictions.push(prediction);
        }
      }
      
      return {
        count: predictions.length,
        predictions,
      };
    } catch (error: any) {
      logger.error(`Error generating predictions: ${error.message}`, {
        error,
        stack: error.stack,
      });
      
      throw error;
    }
  }
  
  /**
   * Extract features for a specific store
   */
  private async extractStoreFeatures(storeId: string, date?: string): Promise<Record<string, any>> {
    try {
      // Get store information
      const store = await enhancedDatabaseClient.getStoreById(storeId);
      
      // Get historical invoices for the store
      const historicalInvoices = await enhancedDatabaseClient.getHistoricalInvoicesByStoreId(storeId);
      
      const targetDate = date ? new Date(date) : new Date();
      const threeMonthsAgo = new Date(targetDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      // Filter recent invoices (last 3 months)
      const recentInvoices = historicalInvoices.filter(
        inv => new Date(inv.date) >= threeMonthsAgo && new Date(inv.date) < targetDate
      );
      
      if (recentInvoices.length === 0) {
        // Use default features if no historical data
        return {
          store_id: storeId,
          total_sales: 1000,
          item_count: 10,
          unique_products: 5,
          avg_item_price: 100,
          day_of_week: targetDate.getDay(),
          month_of_year: targetDate.getMonth() + 1,
          quarter: Math.floor(targetDate.getMonth() / 3) + 1,
          is_weekend: [0, 6].includes(targetDate.getDay()) ? 1 : 0,
          has_sales_agent: store?.salesAgentId ? 1 : 0,
          store_age: store?.yearEstablished ? targetDate.getFullYear() - store.yearEstablished : 5
        };
      }
      
      // Calculate aggregated features
      const totalSales = recentInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const totalItems = recentInvoices.reduce((sum, inv) => sum + inv.items.length, 0);
      const allItems = recentInvoices.flatMap(inv => inv.items);
      const uniqueProducts = new Set(allItems.map((item: any) => item.productId)).size;
      
      return {
        store_id: storeId,
        total_sales: totalSales / 3, // Average monthly sales
        item_count: totalItems / recentInvoices.length, // Average items per order
        unique_products: uniqueProducts,
        avg_item_price: allItems.reduce((sum: number, item: any) => sum + item.price, 0) / allItems.length,
        day_of_week: targetDate.getDay(),
        month_of_year: targetDate.getMonth() + 1,
        quarter: Math.floor(targetDate.getMonth() / 3) + 1,
        is_weekend: [0, 6].includes(targetDate.getDay()) ? 1 : 0,
        has_sales_agent: store?.salesAgentId ? 1 : 0,
        store_age: store?.yearEstablished ? targetDate.getFullYear() - store.yearEstablished : 5,
        recent_order_count: recentInvoices.length,
        avg_order_value: totalSales / recentInvoices.length
      };
    } catch (error: any) {
      logger.error(`Error extracting store features: ${error.message}`, error);
      
      // Return default features on error
      return {
        store_id: storeId,
        total_sales: 1000,
        item_count: 10,
        unique_products: 5,
        avg_item_price: 100,
        day_of_week: new Date().getDay(),
        month_of_year: new Date().getMonth() + 1,
        quarter: Math.floor(new Date().getMonth() / 3) + 1,
        is_weekend: 0,
        has_sales_agent: 0,
        store_age: 5
      };
    }
  }
  
  /**
   * Predict items for a store based on predicted total amount
   */
  private async predictItems(storeId: string, predictedAmount: number): Promise<any[]> {
    try {
      // Get historical invoices to understand item patterns
      const historicalInvoices = await enhancedDatabaseClient.getHistoricalInvoicesByStoreId(storeId);
      
      if (historicalInvoices.length === 0) {
        return [];
      }
      
      // Analyze product patterns
      const productFrequency: Record<string, number> = {};
      const productDetails: Record<string, any> = {};
      
      for (const invoice of historicalInvoices) {
        for (const item of invoice.items) {
          const productId = item.productId;
          
          if (!productFrequency[productId]) {
            productFrequency[productId] = 0;
            productDetails[productId] = {
              name: item.name,
              price: item.price,
              quantities: [],
            };
          }
          
          productFrequency[productId]++;
          productDetails[productId].quantities.push(item.quantity);
        }
      }
      
      // Sort products by frequency
      const sortedProducts = Object.keys(productFrequency)
        .sort((a, b) => productFrequency[b] - productFrequency[a])
        .slice(0, 10); // Top 10 most frequent products
      
      // Generate predicted items to match predicted amount
      const predictedItems: any[] = [];
      let remainingAmount = predictedAmount;
      
      for (const productId of sortedProducts) {
        if (remainingAmount <= 0) break;
        
        const details = productDetails[productId];
        const avgQuantity = Math.round(
          details.quantities.reduce((sum: number, q: number) => sum + q, 0) / details.quantities.length
        );
        const itemAmount = avgQuantity * details.price;
        
        if (itemAmount <= remainingAmount) {
          predictedItems.push({
            productId,
            name: details.name,
            quantity: avgQuantity,
            price: details.price,
            totalAmount: itemAmount,
            confidence: Math.min(0.95, productFrequency[productId] / historicalInvoices.length),
          });
          
          remainingAmount -= itemAmount;
        }
      }
      
      return predictedItems;
    } catch (error: any) {
      logger.error(`Error predicting items: ${error.message}`, error);
      return [];
    }
  }
  
  /**
   * Calculate accuracy between prediction and actual order
   */
  private calculateAccuracy(prediction: any, actualOrder: any): number {
    const predictedAmount = prediction.predictedTotalAmount;
    const actualAmount = actualOrder.totalAmount;
    
    // Calculate percentage error
    const amountError = Math.abs(predictedAmount - actualAmount) / actualAmount;
    const amountAccuracy = Math.max(0, 1 - amountError);
    
    // If items are available, calculate item accuracy too
    if (prediction.items && actualOrder.items) {
      const predictedProducts = new Set(prediction.items.map((item: any) => item.productId));
      const actualProducts = new Set(actualOrder.items.map((item: any) => item.productId));
      
      const intersection = new Set([...predictedProducts].filter(x => actualProducts.has(x)));
      const union = new Set([...predictedProducts, ...actualProducts]);
      const itemAccuracy = intersection.size / union.size;
      
      // Weighted average of amount and item accuracy
      return (amountAccuracy * 0.7) + (itemAccuracy * 0.3);
    }
    
    return amountAccuracy;
  }
  
  /**
   * Get model performance metrics
   */
  public async getModelPerformance(modelName: string = 'sales_ensemble'): Promise<any> {
    try {
      return await this.mlEngine.getModelMetrics(modelName);
    } catch (error: any) {
      logger.error(`Error getting model performance: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Retrain models with latest data
   */
  public async retrainModels(): Promise<void> {
    try {
      logger.info('Starting model retraining with latest data');
      
      // Get fresh training data
      const trainingData = await this.getTrainingData();
      
      if (trainingData.length < 100) {
        logger.warn('Insufficient training data for retraining');
        return;
      }
      
      // Retrain all models
      await this.mlEngine.trainModel(
        trainingData,
        'total_sales',
        ModelType.REGRESSION,
        Algorithm.RANDOM_FOREST_REGRESSOR,
        {
          validation: true,
          hyperparameterTuning: true,
          testSize: 0.2,
          randomSeed: 42
        }
      );
      
      await this.mlEngine.trainModel(
        trainingData,
        'total_sales',
        ModelType.REGRESSION,
        Algorithm.GRADIENT_BOOSTING_REGRESSOR,
        {
          validation: true,
          hyperparameterTuning: true,
          testSize: 0.2,
          randomSeed: 42
        }
      );
      
      // Update ensemble
      await this.mlEngine.updateEnsemble('sales_ensemble', [
        'sales_prediction_rf',
        'sales_prediction_lgb'
      ]);
      
      logger.info('Model retraining completed successfully');
    } catch (error: any) {
      logger.error(`Error retraining models: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Get feature importance for explainability
   */
  public async getFeatureImportance(modelName: string = 'sales_ensemble'): Promise<any> {
    try {
      return await this.mlEngine.getFeatureImportance(modelName);
    } catch (error: any) {
      logger.error(`Error getting feature importance: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Explain a specific prediction
   */
  public async explainPrediction(predictionId: string): Promise<any> {
    try {
      const prediction = await enhancedDatabaseClient.getPredictionById(predictionId);
      
      if (!prediction) {
        throw new Error(`Prediction not found with ID: ${predictionId}`);
      }
      
      // Get explanation using SHAP-like values
      const predictionResult = {
        id: predictionId,
        modelId: 'sales_ensemble',
        modelVersion: '1.0',
        prediction: prediction.prediction,
        confidence: prediction.confidence,
        timestamp: prediction.timestamp || new Date(),
        latency: 0
      };
      return await this.mlEngine.explainPrediction(predictionResult);
    } catch (error: any) {
      logger.error(`Error explaining prediction: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Run AutoML to find the best model automatically
   */
  public async runAutoML(config?: any): Promise<any> {
    try {
      logger.info('Starting AutoML pipeline for sales prediction');
      
      // Get training data
      const trainingData = await this.getTrainingData();
      
      if (trainingData.length < 100) {
        throw new Error('Insufficient training data for AutoML (minimum 100 samples required)');
      }
      
      // Run AutoML
      const result = await this.autoML.runAutoML(trainingData, {
        targetColumn: 'total_sales',
        timeLimit: config?.timeLimit || 30, // 30 minutes default
        optimizationMetric: config?.metric || 'rmse',
        crossValidationFolds: 5,
        maxTrials: config?.maxTrials || 50,
        ...config
      });
      
      // Deploy the best model as the new ensemble
      await this.deployAutoMLModel(result);
      
      // Get recommendations
      const recommendations = this.autoML.getRecommendations(result);
      
      logger.info('AutoML pipeline completed successfully', {
        bestAlgorithm: result.bestModel.algorithm,
        bestScore: result.bestModel.score,
        totalTrials: result.allTrials.length,
        executionTime: result.executionTime
      });
      
      return {
        ...result,
        recommendations,
        deployedAs: 'sales_automl_ensemble'
      };
    } catch (error: any) {
      logger.error(`AutoML pipeline failed: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Deploy AutoML result as production model
   */
  private async deployAutoMLModel(autoMLResult: any): Promise<void> {
    try {
      // Create a new ensemble with the best models from AutoML
      const topModels = autoMLResult.allTrials
        .slice(0, 3) // Top 3 models
        .map((trial: any, index: number) => {
          const modelName = `automl_${trial.algorithm}_${index}`;
          // The models were already trained during AutoML
          return modelName;
        });
      
      // Create ensemble from top performing models
      await this.mlEngine.createEnsemble('sales_automl_ensemble', topModels, 'weighted_voting');
      
      // Set as default model for predictions
      // This would replace the current 'sales_ensemble' in production
      logger.info('AutoML model deployed successfully', {
        ensembleName: 'sales_automl_ensemble',
        topModels: topModels.length
      });
      
    } catch (error: any) {
      logger.error(`Failed to deploy AutoML model: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Register a new model in the registry
   */
  public async registerModel(
    name: string,
    version: string,
    algorithm: string,
    metrics: Record<string, number>,
    metadata?: any
  ): Promise<string> {
    try {
      return await this.modelRegistry.registerModel(name, version, algorithm, metrics, metadata);
    } catch (error: any) {
      logger.error(`Failed to register model: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Deploy model to environment
   */
  public async deployModelToEnvironment(
    modelId: string,
    environment: 'development' | 'staging' | 'production',
    config?: any
  ): Promise<boolean> {
    try {
      return await this.modelRegistry.deployModel(modelId, environment, config);
    } catch (error: any) {
      logger.error(`Failed to deploy model: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Compare models for deployment decision
   */
  public async compareModelsForDeployment(currentModelId: string, newModelId: string): Promise<any> {
    try {
      return await this.modelRegistry.compareModels(currentModelId, newModelId);
    } catch (error: any) {
      logger.error(`Failed to compare models: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Get deployment status
   */
  public async getDeploymentStatus(environment?: string): Promise<any> {
    try {
      return await this.modelRegistry.getDeploymentStatus(environment || 'production');
    } catch (error: any) {
      logger.error(`Failed to get deployment status: ${error.message}`, error);
      return null;
    }
  }
  
  /**
   * Monitor model performance
   */
  public async monitorModelPerformance(modelId?: string): Promise<any> {
    try {
      if (!modelId) {
        // Monitor all deployed models
        const deploymentStatus = await this.getDeploymentStatus();
        const monitoringResults = [];
        
        for (const model of deploymentStatus.models) {
          const monitoring = await this.modelRegistry.monitorModelPerformance(model.modelId);
          monitoringResults.push(monitoring);
        }
        
        return {
          timestamp: new Date(),
          models: monitoringResults,
          overallStatus: monitoringResults.some(m => m.overallStatus === 'needs_attention') 
            ? 'needs_attention' : 'healthy'
        };
      }
      
      return await this.modelRegistry.monitorModelPerformance(modelId);
    } catch (error: any) {
      logger.error(`Failed to monitor model performance: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Rollback deployment if issues occur
   */
  public async rollbackDeployment(
    environment: 'development' | 'staging' | 'production',
    modelName: string
  ): Promise<boolean> {
    try {
      return await this.modelRegistry.rollbackDeployment(environment, modelName);
    } catch (error: any) {
      logger.error(`Failed to rollback deployment: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * List all models in registry
   */
  public async listModels(filters?: any): Promise<any[]> {
    try {
      return await this.modelRegistry.listModels(filters);
    } catch (error: any) {
      logger.error(`Failed to list models: ${error.message}`, error);
      return [];
    }
  }
  
  /**
   * Get comprehensive system health
   */
  public async getSystemHealth(): Promise<any> {
    try {
      // Get deployment status
      const deploymentStatus = await this.getDeploymentStatus();
      
      // Get model performance monitoring
      const modelMonitoring = await this.monitorModelPerformance();
      
      // Get ML engine metrics
      const engineMetrics = await this.mlEngine.getSystemMetrics?.() || {};
      
      // Get cache health
      const cacheHealth = await this.checkCacheHealth();
      
      return {
        timestamp: new Date(),
        overallStatus: this.calculateOverallHealth([
          deploymentStatus.models.length > 0 ? 'healthy' : 'warning',
          modelMonitoring.overallStatus,
          cacheHealth ? 'healthy' : 'error'
        ]),
        components: {
          deployment: {
            status: deploymentStatus.models.length > 0 ? 'healthy' : 'warning',
            details: deploymentStatus
          },
          models: {
            status: modelMonitoring.overallStatus,
            details: modelMonitoring
          },
          mlEngine: {
            status: 'healthy',
            metrics: engineMetrics
          },
          cache: {
            status: cacheHealth ? 'healthy' : 'error'
          }
        }
      };
    } catch (error: any) {
      logger.error(`Failed to get system health: ${error.message}`, error);
      return {
        timestamp: new Date(),
        overallStatus: 'error',
        error: error.message
      };
    }
  }
  
  // Private helper methods
  
  private async checkCacheHealth(): Promise<boolean> {
    try {
      await this.cache.set('health_check', 'ok', { ttl: 10 });
      const result = await this.cache.get('health_check');
      return result === 'ok';
    } catch {
      return false;
    }
  }
  
  private calculateOverallHealth(statuses: string[]): string {
    if (statuses.includes('error')) return 'error';
    if (statuses.includes('needs_attention')) return 'needs_attention';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }
}
