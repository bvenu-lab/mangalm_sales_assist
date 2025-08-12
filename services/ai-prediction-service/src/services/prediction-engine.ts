/**
 * Advanced Prediction Engine for AI-based Order Forecasting
 * Uses multiple ML techniques including trend analysis, seasonality detection, and pattern recognition
 */

import { db } from '../database/db-connection';
import { logger } from '../utils/logger';

export interface PredictionConfig {
  storeId?: string;
  lookbackMonths?: number;
  forecastDays?: number;
  minConfidence?: number;
  useSeasonality?: boolean;
  useTrendAnalysis?: boolean;
}

export class PredictionEngine {
  /**
   * Generate predictions for all stores or a specific store
   */
  async generatePredictions(config: PredictionConfig = {}): Promise<void> {
    const {
      storeId,
      lookbackMonths = 12,
      forecastDays = 30,
      minConfidence = 0.3,
      useSeasonality = true,
      useTrendAnalysis = true
    } = config;

    logger.info('Starting prediction generation', config);

    try {
      // Clear existing predictions
      if (storeId) {
        await db.query(
          'DELETE FROM predicted_order_items WHERE predicted_order_id IN (SELECT id FROM predicted_orders WHERE store_id = $1)',
          [storeId]
        );
        await db.query('DELETE FROM predicted_orders WHERE store_id = $1', [storeId]);
      } else {
        await db.query('TRUNCATE TABLE predicted_order_items CASCADE');
        await db.query('TRUNCATE TABLE predicted_orders CASCADE');
      }

      // Get stores to predict for
      const storesQuery = storeId
        ? 'SELECT DISTINCT store_id FROM historical_invoices WHERE store_id = $1'
        : 'SELECT DISTINCT store_id FROM historical_invoices';
      const storesResult = await db.query(storesQuery, storeId ? [storeId] : []);

      for (const row of storesResult.rows) {
        await this.generateStorePredicti ons(row.store_id, {
          lookbackMonths,
          forecastDays,
          minConfidence,
          useSeasonality,
          useTrendAnalysis
        });
      }

      logger.info('Prediction generation completed');
    } catch (error) {
      logger.error('Error generating predictions', error);
      throw error;
    }
  }

  /**
   * Generate predictions for a specific store
   */
  private async generateStorePredictions(
    storeId: string,
    config: Omit<PredictionConfig, 'storeId'>
  ): Promise<void> {
    const { lookbackMonths, forecastDays, minConfidence, useSeasonality, useTrendAnalysis } = config;

    // Analyze historical patterns
    const analysisQuery = `
      WITH order_analysis AS (
        SELECT 
          COUNT(*) as order_count,
          AVG(total_amount) as avg_amount,
          STDDEV(total_amount) as amount_stddev,
          MAX(invoice_date) as last_order,
          MIN(invoice_date) as first_order,
          AVG(EXTRACT(DAY FROM lead(invoice_date) OVER (ORDER BY invoice_date) - invoice_date)) as avg_days_between
        FROM historical_invoices
        WHERE store_id = $1 
          AND invoice_date >= NOW() - INTERVAL '${lookbackMonths} months'
      ),
      product_patterns AS (
        SELECT 
          ii.product_id,
          p.name as product_name,
          COUNT(DISTINCT hi.id) as order_frequency,
          AVG(ii.quantity) as avg_quantity,
          STDDEV(ii.quantity) as quantity_stddev,
          AVG(ii.unit_price) as avg_price,
          -- Linear regression slope for trend
          (COUNT(*) * SUM(EXTRACT(EPOCH FROM hi.invoice_date) * ii.quantity) - 
           SUM(EXTRACT(EPOCH FROM hi.invoice_date)) * SUM(ii.quantity)) /
          NULLIF(COUNT(*) * SUM(POWER(EXTRACT(EPOCH FROM hi.invoice_date), 2)) - 
           POWER(SUM(EXTRACT(EPOCH FROM hi.invoice_date)), 2), 0) as trend_slope
        FROM historical_invoices hi
        JOIN invoice_items ii ON hi.id = ii.invoice_id
        LEFT JOIN products p ON ii.product_id = p.id
        WHERE hi.store_id = $1
          AND hi.invoice_date >= NOW() - INTERVAL '${lookbackMonths} months'
        GROUP BY ii.product_id, p.name
        HAVING COUNT(*) >= 2
      ),
      seasonal_patterns AS (
        SELECT 
          ii.product_id,
          EXTRACT(MONTH FROM hi.invoice_date) as month,
          AVG(ii.quantity) as seasonal_avg
        FROM historical_invoices hi
        JOIN invoice_items ii ON hi.id = ii.invoice_id
        WHERE hi.store_id = $1
          AND hi.invoice_date >= NOW() - INTERVAL '2 years'
        GROUP BY ii.product_id, EXTRACT(MONTH FROM hi.invoice_date)
      )
      SELECT 
        oa.*,
        json_agg(DISTINCT pp.*) as products,
        json_agg(DISTINCT sp.*) as seasonality
      FROM order_analysis oa
      CROSS JOIN product_patterns pp
      LEFT JOIN seasonal_patterns sp ON pp.product_id = sp.product_id
      GROUP BY oa.order_count, oa.avg_amount, oa.amount_stddev, 
               oa.last_order, oa.first_order, oa.avg_days_between
    `;

    const analysisResult = await db.query(analysisQuery, [storeId]);
    
    if (analysisResult.rows.length === 0 || !analysisResult.rows[0].order_count) {
      logger.warn(`No historical data for store ${storeId}`);
      return;
    }

    const analysis = analysisResult.rows[0];
    const products = analysis.products || [];
    const seasonality = analysis.seasonality || [];

    // Calculate next order date
    const daysSinceLastOrder = Math.floor(
      (Date.now() - new Date(analysis.last_order).getTime()) / (1000 * 60 * 60 * 24)
    );
    const avgDaysBetween = analysis.avg_days_between || 30;
    const nextOrderDays = Math.max(7, Math.min(forecastDays, avgDaysBetween - daysSinceLastOrder));
    const predictedDate = new Date();
    predictedDate.setDate(predictedDate.getDate() + nextOrderDays);

    // Calculate confidence based on data availability and consistency
    let confidence = minConfidence;
    if (analysis.order_count >= 20) confidence = 0.85;
    else if (analysis.order_count >= 10) confidence = 0.70;
    else if (analysis.order_count >= 5) confidence = 0.55;
    else if (analysis.order_count >= 2) confidence = 0.40;

    // Adjust confidence based on consistency (lower stddev = higher confidence)
    const cv = analysis.amount_stddev / analysis.avg_amount; // Coefficient of variation
    if (cv < 0.2) confidence *= 1.1;
    else if (cv > 0.5) confidence *= 0.9;
    confidence = Math.min(0.95, Math.max(minConfidence, confidence));

    // Insert predicted order
    const orderInsertQuery = `
      INSERT INTO predicted_orders (
        store_id, predicted_date, confidence, priority, status, 
        total_amount, ai_recommendation, prediction_model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const priority = daysSinceLastOrder > avgDaysBetween * 1.2 ? 'high' : 
                    daysSinceLastOrder > avgDaysBetween * 0.8 ? 'medium' : 'low';

    const recommendation = `ML-based prediction using ${analysis.order_count} orders. ` +
      `Avg frequency: ${Math.round(avgDaysBetween)} days. ` +
      (useTrendAnalysis ? 'Trend analysis applied. ' : '') +
      (useSeasonality ? 'Seasonal adjustments included.' : '');

    const orderResult = await db.query(orderInsertQuery, [
      storeId,
      predictedDate,
      confidence,
      priority,
      'pending',
      analysis.avg_amount * 1.02, // 2% growth assumption
      recommendation,
      'ml_engine_v2'
    ]);

    const predictedOrderId = orderResult.rows[0].id;

    // Generate product-level predictions
    for (const product of products) {
      if (!product.product_id) continue;

      let predictedQuantity = product.avg_quantity;

      // Apply trend analysis
      if (useTrendAnalysis && product.trend_slope) {
        const trendAdjustment = product.trend_slope * nextOrderDays * 0.1;
        predictedQuantity *= (1 + Math.max(-0.3, Math.min(0.3, trendAdjustment)));
      }

      // Apply seasonal adjustment
      if (useSeasonality) {
        const currentMonth = new Date().getMonth() + 1;
        const seasonalData = seasonality.find(
          s => s.product_id === product.product_id && s.month === currentMonth
        );
        if (seasonalData) {
          const seasonalFactor = seasonalData.seasonal_avg / product.avg_quantity;
          predictedQuantity *= seasonalFactor;
        }
      }

      // Round and ensure minimum quantity
      predictedQuantity = Math.max(1, Math.round(predictedQuantity));

      // Calculate product confidence
      const productConfidence = Math.min(0.9, confidence * 
        (product.order_frequency / analysis.order_count));

      // Insert predicted item
      await db.query(`
        INSERT INTO predicted_order_items (
          predicted_order_id, product_id, product_name, predicted_quantity,
          confidence, unit_price, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        predictedOrderId,
        product.product_id,
        product.product_name || product.product_id,
        predictedQuantity,
        productConfidence,
        product.avg_price,
        predictedQuantity * product.avg_price
      ]);
    }

    logger.info(`Generated prediction for store ${storeId}`, {
      orderId: predictedOrderId,
      confidence,
      itemCount: products.length,
      predictedDate
    });
  }

  /**
   * Update prediction confidence based on actual orders
   */
  async updatePredictionAccuracy(storeId: string): Promise<void> {
    // This would compare predicted vs actual orders and update the model
    // For now, this is a placeholder for future ML model refinement
    logger.info(`Updating prediction accuracy for store ${storeId}`);
  }
}

export const predictionEngine = new PredictionEngine();