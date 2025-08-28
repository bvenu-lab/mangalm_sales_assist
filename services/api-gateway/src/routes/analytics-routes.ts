import express, { Request, Response, Router } from 'express';
import { logger } from '../utils/logger';
import { db } from '../database/db-connection';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Create analytics routes for enhanced dashboard visualizations
 */
export function createAnalyticsRoutes(): Router {
  const router = express.Router();

  // Get trends data for specified time range
  router.get('/trends', async (req: Request, res: Response) => {
    try {
      const range = req.query.range as string || '7d';
      logger.info('Fetching analytics trends', { range });
      
      // Parse range
      let days = 7;
      if (range === '30d') days = 30;
      if (range === '90d') days = 90;
      
      const startDate = subDays(new Date(), days);
      
      // Get daily revenue and order trends
      const trendsQuery = `
        WITH daily_metrics AS (
          SELECT 
            DATE(hi.invoice_date) as date,
            COUNT(DISTINCT hi.id) as orders,
            SUM(hi.total_amount) as revenue,
            COUNT(DISTINCT hi.store_id) as unique_stores,
            AVG(hi.total_amount) as avg_order_value
          FROM historical_invoices hi
          WHERE hi.invoice_date >= $1
          GROUP BY DATE(hi.invoice_date)
        ),
        date_series AS (
          SELECT generate_series(
            DATE($1),
            CURRENT_DATE,
            '1 day'::interval
          )::date as date
        )
        SELECT 
          TO_CHAR(ds.date, 'YYYY-MM-DD') as date,
          COALESCE(dm.orders, 0) as orders,
          COALESCE(dm.revenue, 0) as revenue,
          COALESCE(dm.unique_stores, 0) as stores,
          COALESCE(dm.avg_order_value, 0) as avg_order_value,
          -- No mock target - only show real data
          0 as target
        FROM date_series ds
        LEFT JOIN daily_metrics dm ON ds.date = dm.date
        ORDER BY ds.date
      `;
      
      const result = await db.query(trendsQuery, [startDate]);
      
      // Also get store-specific trends
      const storeQuery = `
        SELECT 
          s.id,
          s.name,
          COUNT(hi.id) as order_count,
          SUM(hi.total_amount) as total_revenue,
          AVG(hi.total_amount) as avg_order_value,
          MAX(hi.invoice_date) as last_order_date
        FROM stores s
        LEFT JOIN historical_invoices hi ON s.id = hi.store_id
          AND hi.invoice_date >= $1
        GROUP BY s.id, s.name
        ORDER BY total_revenue DESC NULLS LAST
        LIMIT 10
      `;
      
      const storeResult = await db.query(storeQuery, [startDate]);
      
      res.json({
        success: true,
        data: {
          daily: result.rows,
          stores: storeResult.rows,
          period: range,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching analytics trends', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics trends'
      });
    }
  });

  // Get product distribution across stores
  router.get('/product-distribution', async (req: Request, res: Response) => {
    try {
      logger.info('Fetching product distribution');
      
      // Get product quantities by store
      const query = `
        WITH recent_orders AS (
          SELECT 
            s.id as store_id,
            s.name as store_name,
            p.name as product_name,
            p.id as product_id,
            SUM(ii.quantity) as total_quantity,
            SUM(ii.total_price) as total_revenue,
            COUNT(DISTINCT hi.id) as order_count
          FROM stores s
          JOIN historical_invoices hi ON s.id = hi.store_id
          JOIN invoice_items ii ON hi.id = ii.invoice_id
          JOIN products p ON ii.product_id = p.id
          WHERE hi.invoice_date >= NOW() - INTERVAL '30 days'
          GROUP BY s.id, s.name, p.id, p.name
        ),
        store_totals AS (
          SELECT 
            store_id,
            store_name,
            SUM(total_quantity) as store_total_quantity,
            SUM(total_revenue) as store_total_revenue
          FROM recent_orders
          GROUP BY store_id, store_name
        ),
        product_distribution AS (
          SELECT 
            ro.store_id,
            ro.store_name,
            ro.product_name,
            ro.product_id,
            ro.total_quantity,
            ro.total_revenue,
            st.store_total_quantity,
            st.store_total_revenue,
            ROUND((ro.total_quantity::numeric / NULLIF(st.store_total_quantity, 0)) * 100, 2) as percentage
          FROM recent_orders ro
          JOIN store_totals st ON ro.store_id = st.store_id
        )
        SELECT 
          store_id,
          store_name,
          store_total_quantity,
          store_total_revenue,
          json_object_agg(
            product_name, 
            json_build_object(
              'quantity', total_quantity,
              'revenue', total_revenue,
              'percentage', percentage
            )
          ) as products
        FROM product_distribution
        GROUP BY store_id, store_name, store_total_quantity, store_total_revenue
        ORDER BY store_total_revenue DESC
        LIMIT 20
      `;
      
      const result = await db.query(query);
      
      // Also get top products overall
      const topProductsQuery = `
        SELECT 
          p.name as product_name,
          p.id as product_id,
          SUM(ii.quantity) as total_quantity,
          SUM(ii.total_price) as total_revenue,
          COUNT(DISTINCT hi.store_id) as store_count,
          COUNT(DISTINCT hi.id) as order_count
        FROM products p
        JOIN invoice_items ii ON p.id = ii.product_id
        JOIN historical_invoices hi ON ii.invoice_id = hi.id
        WHERE hi.invoice_date >= NOW() - INTERVAL '30 days'
        GROUP BY p.id, p.name
        ORDER BY total_quantity DESC
        LIMIT 10
      `;
      
      const topProducts = await db.query(topProductsQuery);
      
      res.json({
        success: true,
        data: {
          storeDistribution: result.rows,
          topProducts: topProducts.rows,
          totalStores: result.rowCount,
          period: 'last_30_days'
        }
      });
    } catch (error) {
      logger.error('Error fetching product distribution', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch product distribution'
      });
    }
  });

  // Get performance metrics
  router.get('/performance-metrics', async (req: Request, res: Response) => {
    try {
      const storeId = req.query.storeId as string;
      const period = req.query.period as string || '7d';
      
      logger.info('Fetching performance metrics', { storeId, period });
      
      let days = 7;
      if (period === '30d') days = 30;
      if (period === '90d') days = 90;
      
      const startDate = subDays(new Date(), days);
      
      const metricsQuery = `
        WITH metrics AS (
          SELECT 
            COUNT(DISTINCT hi.id) as total_orders,
            COUNT(DISTINCT hi.store_id) as unique_stores,
            SUM(hi.total_amount) as total_revenue,
            AVG(hi.total_amount) as avg_order_value,
            MAX(hi.total_amount) as max_order_value,
            MIN(hi.total_amount) as min_order_value,
            -- Calculate conversion rate (mock for now)
            ROUND((COUNT(DISTINCT hi.store_id)::numeric / 
              GREATEST(COUNT(DISTINCT s.id), 1)) * 100, 2) as conversion_rate
          FROM stores s
          LEFT JOIN historical_invoices hi ON s.id = hi.store_id
            AND hi.invoice_date >= $1
            ${storeId ? 'AND hi.store_id = $2' : ''}
        ),
        previous_period AS (
          SELECT 
            SUM(hi.total_amount) as prev_revenue,
            COUNT(DISTINCT hi.id) as prev_orders
          FROM historical_invoices hi
          WHERE hi.invoice_date >= $1 - INTERVAL '${days} days'
            AND hi.invoice_date < $1
            ${storeId ? 'AND hi.store_id = $2' : ''}
        )
        SELECT 
          m.*,
          pp.prev_revenue,
          pp.prev_orders,
          CASE 
            WHEN pp.prev_revenue > 0 THEN 
              ROUND(((m.total_revenue - pp.prev_revenue) / pp.prev_revenue) * 100, 2)
            ELSE 0
          END as revenue_growth,
          CASE 
            WHEN pp.prev_orders > 0 THEN 
              ROUND(((m.total_orders - pp.prev_orders)::numeric / pp.prev_orders) * 100, 2)
            ELSE 0
          END as order_growth
        FROM metrics m
        CROSS JOIN previous_period pp
      `;
      
      const params = storeId ? [startDate, storeId] : [startDate];
      const result = await db.query(metricsQuery, params);
      
      res.json({
        success: true,
        data: result.rows[0] || {
          total_orders: 0,
          unique_stores: 0,
          total_revenue: 0,
          avg_order_value: 0,
          conversion_rate: 0,
          revenue_growth: 0,
          order_growth: 0
        }
      });
    } catch (error) {
      logger.error('Error fetching performance metrics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance metrics'
      });
    }
  });

  // Get insights and recommendations
  router.get('/insights', async (req: Request, res: Response) => {
    try {
      logger.info('Generating insights');
      
      // Generate insights based on data patterns
      const insights = [];
      
      // Top performing store
      const topStoreQuery = `
        SELECT 
          s.id,
          s.name,
          COUNT(hi.id) as order_count,
          SUM(hi.total_amount) as total_revenue,
          AVG(hi.total_amount) as avg_order_value
        FROM stores s
        JOIN historical_invoices hi ON s.id = hi.store_id
        WHERE hi.invoice_date >= NOW() - INTERVAL '7 days'
        GROUP BY s.id, s.name
        ORDER BY total_revenue DESC
        LIMIT 1
      `;
      
      const topStore = await db.query(topStoreQuery);
      if (topStore.rows[0]) {
        insights.push({
          type: 'top_performer',
          title: 'Top Performing Store',
          value: topStore.rows[0].name,
          metric: `₹${Math.round(topStore.rows[0].total_revenue).toLocaleString()}`,
          recommendation: 'Analyze their ordering patterns to replicate success',
          priority: 'high'
        });
      }
      
      // Trending product
      const trendingProductQuery = `
        WITH recent_sales AS (
          SELECT 
            p.name,
            SUM(ii.quantity) as recent_quantity
          FROM products p
          JOIN invoice_items ii ON p.id = ii.product_id
          JOIN historical_invoices hi ON ii.invoice_id = hi.id
          WHERE hi.invoice_date >= NOW() - INTERVAL '7 days'
          GROUP BY p.name
        ),
        previous_sales AS (
          SELECT 
            p.name,
            SUM(ii.quantity) as prev_quantity
          FROM products p
          JOIN invoice_items ii ON p.id = ii.product_id
          JOIN historical_invoices hi ON ii.invoice_id = hi.id
          WHERE hi.invoice_date >= NOW() - INTERVAL '14 days'
            AND hi.invoice_date < NOW() - INTERVAL '7 days'
          GROUP BY p.name
        )
        SELECT 
          rs.name,
          rs.recent_quantity,
          ps.prev_quantity,
          CASE 
            WHEN ps.prev_quantity > 0 THEN 
              ROUND(((rs.recent_quantity - ps.prev_quantity)::numeric / ps.prev_quantity) * 100, 0)
            ELSE 100
          END as growth_rate
        FROM recent_sales rs
        LEFT JOIN previous_sales ps ON rs.name = ps.name
        ORDER BY growth_rate DESC
        LIMIT 1
      `;
      
      const trendingProduct = await db.query(trendingProductQuery);
      if (trendingProduct.rows[0]) {
        insights.push({
          type: 'trending_product',
          title: 'Trending Product',
          value: trendingProduct.rows[0].name,
          metric: `+${trendingProduct.rows[0].growth_rate}% this week`,
          recommendation: 'Ensure adequate stock levels',
          priority: 'medium'
        });
      }
      
      // Stores needing attention
      const needsAttentionQuery = `
        SELECT 
          COUNT(DISTINCT s.id) as inactive_stores
        FROM stores s
        LEFT JOIN historical_invoices hi ON s.id = hi.store_id
          AND hi.invoice_date >= NOW() - INTERVAL '30 days'
        WHERE hi.id IS NULL
      `;
      
      const needsAttention = await db.query(needsAttentionQuery);
      if (needsAttention.rows[0]?.inactive_stores > 0) {
        insights.push({
          type: 'needs_attention',
          title: 'Stores Needing Attention',
          value: needsAttention.rows[0].inactive_stores,
          metric: 'No orders in 30 days',
          recommendation: 'Priority call list generated',
          priority: 'high'
        });
      }
      
      // Best call time (mock data for demo)
      insights.push({
        type: 'best_practice',
        title: 'Optimal Call Time',
        value: '10:00 AM - 12:00 PM',
        metric: '40% higher conversion',
        recommendation: 'Schedule priority calls during this window',
        priority: 'low'
      });
      
      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      logger.error('Error generating insights', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate insights'
      });
    }
  });

  return router;
}