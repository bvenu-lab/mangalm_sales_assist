import { db } from './db-connection';
import { logger } from '../utils/logger';
import { invoiceAnalyzer } from '../services/invoice-analyzer';

export interface PredictedOrder {
  id: string;
  storeId: string;
  storeName?: string;
  predictedDate: Date;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  totalAmount?: number;
  items: PredictedOrderItem[];
  aiRecommendation?: string;
  predictionModel?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PredictedOrderItem {
  id: string;
  predictedOrderId: string;
  productId: string;
  productName: string;
  productCode?: string;
  predictedQuantity: number;
  confidence: number;
  unitPrice?: number;
  totalPrice?: number;
  aiReasoning?: string;
}

export class PredictedOrdersRepository {
  /**
   * Get all predicted orders
   */
  async getAll(params?: {
    limit?: number;
    offset?: number;
    storeId?: string;
    status?: string;
    priority?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: PredictedOrder[]; total: number }> {
    try {
      let query = `
        SELECT po.*, s.name as store_name,
               ARRAY_AGG(
                 JSON_BUILD_OBJECT(
                   'id', poi.id,
                   'predictedOrderId', poi.predicted_order_id,
                   'productId', poi.product_id,
                   'productName', poi.product_name,
                   'productCode', poi.product_code,
                   'predictedQuantity', poi.predicted_quantity,
                   'confidence', poi.confidence,
                   'unitPrice', poi.unit_price,
                   'totalPrice', poi.total_price,
                   'aiReasoning', poi.ai_reasoning
                 )
               ) as items
        FROM predicted_orders po
        LEFT JOIN stores s ON po.store_id = s.id
        LEFT JOIN predicted_order_items poi ON po.id = poi.predicted_order_id
        WHERE 1=1
      `;
      
      let countQuery = 'SELECT COUNT(*) FROM predicted_orders po WHERE 1=1';
      const queryParams: any[] = [];
      const countParams: any[] = [];
      let paramIndex = 1;

      // Add filters
      if (params?.storeId) {
        const storeCondition = ` AND po.store_id = $${paramIndex}`;
        query += storeCondition;
        countQuery += storeCondition;
        queryParams.push(params.storeId);
        countParams.push(params.storeId);
        paramIndex++;
      }

      if (params?.status) {
        const statusCondition = ` AND po.status = $${paramIndex}`;
        query += statusCondition;
        countQuery += statusCondition;
        queryParams.push(params.status);
        countParams.push(params.status);
        paramIndex++;
      }

      if (params?.priority) {
        const priorityCondition = ` AND po.priority = $${paramIndex}`;
        query += priorityCondition;
        countQuery += priorityCondition;
        queryParams.push(params.priority);
        countParams.push(params.priority);
        paramIndex++;
      }

      if (params?.startDate) {
        const dateCondition = ` AND po.predicted_date >= $${paramIndex}`;
        query += dateCondition;
        countQuery += dateCondition;
        queryParams.push(params.startDate);
        countParams.push(params.startDate);
        paramIndex++;
      }

      if (params?.endDate) {
        const dateCondition = ` AND po.predicted_date <= $${paramIndex}`;
        query += dateCondition;
        countQuery += dateCondition;
        queryParams.push(params.endDate);
        countParams.push(params.endDate);
        paramIndex++;
      }

      // Add grouping and ordering
      query += ` GROUP BY po.id, s.name ORDER BY po.predicted_date DESC`;

      // Add pagination
      if (params?.limit) {
        query += ` LIMIT $${paramIndex}`;
        queryParams.push(params.limit);
        paramIndex++;
      }
      if (params?.offset) {
        query += ` OFFSET $${paramIndex}`;
        queryParams.push(params.offset);
        paramIndex++;
      }

      // Execute queries
      const [dataResult, countResult] = await Promise.all([
        db.query(query, queryParams),
        db.query(countQuery, countParams)
      ]);

      const orders = dataResult.rows.map(this.mapRowToPredictedOrder);
      const total = parseInt(countResult.rows[0].count, 10);

      logger.info('Fetched predicted orders from database', {
        count: orders.length,
        total,
        params
      });

      return { data: orders, total };
    } catch (error) {
      logger.error('Error fetching predicted orders from database', error);
      throw new Error('Failed to fetch predicted orders');
    }
  }

  /**
   * Get predicted orders by store ID
   */
  async getByStoreId(storeId: string, params?: {
    limit?: number;
    offset?: number;
    status?: string;
    priority?: string;
  }): Promise<{ data: PredictedOrder[]; total: number }> {
    try {
      // Try to get from database first
      const dbResult = await this.getAll({ ...params, storeId }).catch(() => null);
      if (dbResult && dbResult.data.length > 0) {
        return dbResult;
      }

      // Generate predictions from invoice analysis
      const predictions = invoiceAnalyzer.generatePredictions(storeId);
      if (!predictions) {
        return { data: [], total: 0 };
      }

      // Convert to PredictedOrder format
      const predictedOrders: PredictedOrder[] = [{
        id: `pred_${storeId}_${Date.now()}`,
        storeId: predictions.storeId,
        storeName: predictions.storeName,
        predictedDate: new Date(predictions.predictedOrderDate),
        confidence: predictions.confidence,
        priority: predictions.priority as 'high' | 'medium' | 'low',
        status: 'pending',
        totalAmount: predictions.predictedAmount,
        items: predictions.recommendedProducts.map((product, idx) => ({
          id: `item_${idx}`,
          predictedOrderId: `pred_${storeId}_${Date.now()}`,
          productId: product.productId,
          productName: product.productName,
          productCode: undefined,
          predictedQuantity: product.quantity,
          confidence: product.confidence,
          unitPrice: undefined,
          totalPrice: undefined,
          aiReasoning: product.reason
        })),
        aiRecommendation: predictions.analysisNotes,
        predictionModel: 'invoice-analyzer-v1',
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      // Add historical predictions if needed to show trend
      const analytics = invoiceAnalyzer.getStoreAnalytics(storeId);
      if (analytics && analytics.predictedProducts.length > 0) {
        // Generate predictions for next few periods
        for (let i = 1; i < Math.min(3, params?.limit || 3); i++) {
          const futureDate = new Date(predictions.predictedOrderDate);
          futureDate.setDate(futureDate.getDate() + (i * predictions.historicalMetrics.orderFrequency));
          
          predictedOrders.push({
            id: `pred_${storeId}_future_${i}`,
            storeId: predictions.storeId,
            storeName: predictions.storeName,
            predictedDate: futureDate,
            confidence: predictions.confidence * (1 - i * 0.1), // Decrease confidence for future predictions
            priority: 'low',
            status: 'pending',
            totalAmount: predictions.predictedAmount,
            items: analytics.predictedProducts.slice(i * 3, (i + 1) * 3).map((product, idx) => ({
              id: `item_future_${i}_${idx}`,
              predictedOrderId: `pred_${storeId}_future_${i}`,
              productId: product.productId,
              productName: product.productName,
              productCode: product.brand,
              predictedQuantity: product.averageQuantity,
              confidence: product.confidence,
              unitPrice: undefined,
              totalPrice: undefined,
              aiReasoning: `Regular reorder - typically ordered every ${product.reorderFrequency} days`
            })),
            aiRecommendation: `Future projection based on historical pattern`,
            predictionModel: 'invoice-analyzer-v1',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      logger.info(`Generated ${predictedOrders.length} predictions for store ${storeId}`);
      return { data: predictedOrders, total: predictedOrders.length };
    } catch (error) {
      logger.error('Error fetching predicted orders for store', error);
      return { data: [], total: 0 };
    }
  }

  /**
   * Get predicted order by ID
   */
  async getById(id: string): Promise<PredictedOrder | null> {
    try {
      const query = `
        SELECT po.*, s.name as store_name,
               ARRAY_AGG(
                 JSON_BUILD_OBJECT(
                   'id', poi.id,
                   'predictedOrderId', poi.predicted_order_id,
                   'productId', poi.product_id,
                   'productName', poi.product_name,
                   'productCode', poi.product_code,
                   'predictedQuantity', poi.predicted_quantity,
                   'confidence', poi.confidence,
                   'unitPrice', poi.unit_price,
                   'totalPrice', poi.total_price,
                   'aiReasoning', poi.ai_reasoning
                 )
               ) as items
        FROM predicted_orders po
        LEFT JOIN stores s ON po.store_id = s.id
        LEFT JOIN predicted_order_items poi ON po.id = poi.predicted_order_id
        WHERE po.id = $1
        GROUP BY po.id, s.name
      `;
      
      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPredictedOrder(result.rows[0]);
    } catch (error) {
      logger.error(`Error fetching predicted order with id ${id}`, error);
      throw new Error('Failed to fetch predicted order');
    }
  }

  /**
   * Create a new predicted order
   */
  async create(order: Partial<PredictedOrder>): Promise<PredictedOrder> {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert the main predicted order
      const orderQuery = `
        INSERT INTO predicted_orders (
          store_id, predicted_date, confidence, priority, status, 
          total_amount, ai_recommendation, prediction_model
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const orderValues = [
        order.storeId,
        order.predictedDate || new Date(),
        order.confidence || 0.5,
        order.priority || 'medium',
        order.status || 'pending',
        order.totalAmount || 0,
        order.aiRecommendation,
        order.predictionModel || 'default'
      ];

      const orderResult = await client.query(orderQuery, orderValues);
      const createdOrder = orderResult.rows[0];

      // Insert predicted order items if provided
      if (order.items && order.items.length > 0) {
        const itemsQuery = `
          INSERT INTO predicted_order_items (
            predicted_order_id, product_id, product_name, product_code,
            predicted_quantity, confidence, unit_price, total_price, ai_reasoning
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        for (const item of order.items) {
          await client.query(itemsQuery, [
            createdOrder.id,
            item.productId,
            item.productName,
            item.productCode,
            item.predictedQuantity,
            item.confidence || 0.5,
            item.unitPrice,
            item.totalPrice,
            item.aiReasoning
          ]);
        }
      }

      await client.query('COMMIT');
      
      // Return the created order with items
      return await this.getById(createdOrder.id) as PredictedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating predicted order', error);
      throw new Error('Failed to create predicted order');
    } finally {
      client.release();
    }
  }

  /**
   * Update predicted order status
   */
  async updateStatus(id: string, status: string, reason?: string): Promise<PredictedOrder | null> {
    try {
      const query = `
        UPDATE predicted_orders
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [id, status]);
      
      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Updated predicted order status`, { id, status, reason });
      
      return await this.getById(id);
    } catch (error) {
      logger.error(`Error updating predicted order status for id ${id}`, error);
      throw new Error('Failed to update predicted order status');
    }
  }

  /**
   * Map database row to PredictedOrder object
   */
  private mapRowToPredictedOrder(row: any): PredictedOrder {
    return {
      id: row.id,
      storeId: row.store_id,
      storeName: row.store_name,
      predictedDate: row.predicted_date,
      confidence: parseFloat(row.confidence),
      priority: row.priority,
      status: row.status,
      totalAmount: row.total_amount ? parseFloat(row.total_amount) : undefined,
      items: row.items ? row.items.filter((item: any) => item.id) : [],
      aiRecommendation: row.ai_recommendation,
      predictionModel: row.prediction_model,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export singleton instance
export const predictedOrdersRepository = new PredictedOrdersRepository();