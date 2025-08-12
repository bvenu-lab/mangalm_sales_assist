import express, { Request, Response, Router } from 'express';
import { logger } from '../utils/logger';
import { db } from '../database/db-connection';

/**
 * Create performance routes for sales agent metrics
 */
export function createPerformanceRoutes(): Router {
  const router = express.Router();

  // Get sales agent performance by period
  router.get('/:period', async (req: Request, res: Response) => {
    try {
      const period = req.params.period as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
      logger.info('Fetching sales agent performance', { period });
      
      // Calculate date range based on period
      let interval: string;
      let groupBy: string;
      let dateFormat: string;
      
      switch (period) {
        case 'daily':
          interval = '7 days';
          groupBy = 'DATE(hi.invoice_date)';
          dateFormat = 'YYYY-MM-DD';
          break;
        case 'weekly':
          interval = '8 weeks';
          groupBy = 'DATE_TRUNC(\'week\', hi.invoice_date)';
          dateFormat = 'YYYY-MM-DD';
          break;
        case 'monthly':
          interval = '12 months';
          groupBy = 'DATE_TRUNC(\'month\', hi.invoice_date)';
          dateFormat = 'YYYY-MM';
          break;
        case 'quarterly':
          interval = '4 quarters';
          groupBy = 'DATE_TRUNC(\'quarter\', hi.invoice_date)';
          dateFormat = 'YYYY-"Q"Q';
          break;
        case 'yearly':
          interval = '3 years';
          groupBy = 'DATE_TRUNC(\'year\', hi.invoice_date)';
          dateFormat = 'YYYY';
          break;
        default:
          interval = '30 days';
          groupBy = 'DATE(hi.invoice_date)';
          dateFormat = 'YYYY-MM-DD';
      }
      
      // Query to get performance metrics
      const query = `
        WITH performance_data AS (
          SELECT 
            ${groupBy} as period_date,
            COUNT(DISTINCT hi.id) as orders_placed,
            COUNT(DISTINCT hi.store_id) as unique_stores,
            SUM(hi.total_amount) as total_sales_value,
            AVG(hi.total_amount) as average_order_value,
            -- Simulate agent assignment (in production, this would come from a user/agent table)
            'Agent ' || (ROW_NUMBER() OVER (ORDER BY ${groupBy}) % 5 + 1) as agent_name,
            -- Calculate calls (assuming 1.5 calls per order on average)
            ROUND(COUNT(DISTINCT hi.store_id) * 1.5) as calls_completed,
            -- Calculate upsell rate based on order value variance
            CASE 
              WHEN AVG(hi.total_amount) > (
                SELECT AVG(total_amount) * 1.2 
                FROM historical_invoices 
                WHERE invoice_date >= NOW() - INTERVAL '${interval}'
              ) THEN 0.75
              WHEN AVG(hi.total_amount) > (
                SELECT AVG(total_amount) 
                FROM historical_invoices 
                WHERE invoice_date >= NOW() - INTERVAL '${interval}'
              ) THEN 0.55
              ELSE 0.35
            END as upsell_success_rate
          FROM historical_invoices hi
          WHERE hi.invoice_date >= NOW() - INTERVAL '${interval}'
          GROUP BY ${groupBy}
          ORDER BY period_date DESC
        )
        SELECT 
          ROW_NUMBER() OVER (ORDER BY period_date DESC) as id,
          TO_CHAR(period_date, '${dateFormat}') as date,
          agent_name as "agentName",
          'sales_agent_' || (ROW_NUMBER() OVER (ORDER BY period_date DESC) % 5 + 1) as "agentId",
          calls_completed::INTEGER as "callsCompleted",
          orders_placed::INTEGER as "ordersPlaced",
          CAST(upsell_success_rate AS FLOAT) as "upsellSuccessRate",
          CAST(average_order_value AS FLOAT) as "averageOrderValue",
          CAST(total_sales_value AS FLOAT) as "totalSalesValue",
          -- Additional metrics
          unique_stores::INTEGER as "uniqueStoresServed",
          CASE 
            WHEN calls_completed > 0 
            THEN CAST(ROUND((orders_placed::NUMERIC / calls_completed) * 100, 1) AS FLOAT)
            ELSE 0
          END as "conversionRate"
        FROM performance_data
        LIMIT 30
      `;
      
      const result = await db.query(query);
      
      // Ensure numeric values are properly typed
      const data = result.rows.map((row: any) => ({
        ...row,
        callsCompleted: parseInt(row.callsCompleted) || 0,
        ordersPlaced: parseInt(row.ordersPlaced) || 0,
        upsellSuccessRate: parseFloat(row.upsellSuccessRate) || 0,
        averageOrderValue: parseFloat(row.averageOrderValue) || 0,
        totalSalesValue: parseFloat(row.totalSalesValue) || 0,
        uniqueStoresServed: parseInt(row.uniqueStoresServed) || 0,
        conversionRate: parseFloat(row.conversionRate) || 0
      }));
      
      res.json({
        success: true,
        data: data,
        period: period,
        total: result.rowCount
      });
    } catch (error) {
      logger.error('Error fetching sales agent performance', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance data'
      });
    }
  });

  // Get performance by specific metric
  router.get('/metric/:metric', async (req: Request, res: Response) => {
    try {
      const metric = req.params.metric;
      logger.info('Fetching performance by metric', { metric });
      
      let query: string;
      
      switch (metric) {
        case 'top-agents':
          query = `
            WITH agent_performance AS (
              SELECT 
                'Agent ' || (EXTRACT(HOUR FROM hi.invoice_date) % 5 + 1) as agent_name,
                COUNT(DISTINCT hi.id) as total_orders,
                SUM(hi.total_amount) as total_sales,
                AVG(hi.total_amount) as avg_order_value
              FROM historical_invoices hi
              WHERE hi.invoice_date >= NOW() - INTERVAL '30 days'
              GROUP BY EXTRACT(HOUR FROM hi.invoice_date) % 5
            )
            SELECT 
              ROW_NUMBER() OVER (ORDER BY total_sales DESC) as rank,
              agent_name as "agentName",
              total_orders::INTEGER as "totalOrders",
              CAST(total_sales AS FLOAT) as "totalSales",
              CAST(avg_order_value AS FLOAT) as "avgOrderValue"
            FROM agent_performance
            ORDER BY total_sales DESC
            LIMIT 10
          `;
          break;
          
        case 'hourly-performance':
          query = `
            SELECT 
              EXTRACT(HOUR FROM hi.invoice_date) as hour,
              COUNT(*)::INTEGER as orders,
              CAST(SUM(hi.total_amount) AS FLOAT) as sales
            FROM historical_invoices hi
            WHERE hi.invoice_date >= NOW() - INTERVAL '7 days'
            GROUP BY EXTRACT(HOUR FROM hi.invoice_date)
            ORDER BY hour
          `;
          break;
          
        case 'product-performance':
          query = `
            SELECT 
              p.name as "productName",
              p.category,
              SUM(ii.quantity)::INTEGER as "unitsSold",
              CAST(SUM(ii.total_price) AS FLOAT) as "totalRevenue",
              COUNT(DISTINCT ii.invoice_id)::INTEGER as "orderCount"
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.id
            JOIN historical_invoices hi ON ii.invoice_id = hi.id
            WHERE hi.invoice_date >= NOW() - INTERVAL '30 days'
            GROUP BY p.name, p.category
            ORDER BY "totalRevenue" DESC
            LIMIT 20
          `;
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid metric specified'
          });
      }
      
      const result = await db.query(query);
      
      res.json({
        success: true,
        data: result.rows,
        metric: metric
      });
    } catch (error) {
      logger.error('Error fetching performance metric', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance metric'
      });
    }
  });

  // Get performance summary (overall KPIs)
  router.get('/summary/overview', async (req: Request, res: Response) => {
    try {
      logger.info('Fetching performance summary overview');
      
      const summaryQuery = `
        WITH current_period AS (
          SELECT 
            COUNT(DISTINCT hi.id) as total_orders,
            COUNT(DISTINCT hi.store_id) as unique_customers,
            SUM(hi.total_amount) as total_revenue,
            AVG(hi.total_amount) as avg_order_value
          FROM historical_invoices hi
          WHERE hi.invoice_date >= NOW() - INTERVAL '30 days'
        ),
        previous_period AS (
          SELECT 
            COUNT(DISTINCT hi.id) as prev_orders,
            SUM(hi.total_amount) as prev_revenue
          FROM historical_invoices hi
          WHERE hi.invoice_date >= NOW() - INTERVAL '60 days'
            AND hi.invoice_date < NOW() - INTERVAL '30 days'
        ),
        product_metrics AS (
          SELECT 
            COUNT(DISTINCT ii.product_id) as products_sold,
            SUM(ii.quantity) as total_units
          FROM invoice_items ii
          JOIN historical_invoices hi ON ii.invoice_id = hi.id
          WHERE hi.invoice_date >= NOW() - INTERVAL '30 days'
        )
        SELECT 
          cp.total_orders::INTEGER as "totalOrders",
          cp.unique_customers::INTEGER as "uniqueCustomers",
          CAST(cp.total_revenue AS FLOAT) as "totalRevenue",
          CAST(cp.avg_order_value AS FLOAT) as "avgOrderValue",
          pm.products_sold::INTEGER as "productsSold",
          pm.total_units::INTEGER as "totalUnits",
          CASE 
            WHEN pp.prev_orders > 0 
            THEN ROUND(((cp.total_orders - pp.prev_orders)::NUMERIC / pp.prev_orders) * 100, 1)
            ELSE 0
          END as "orderGrowth",
          CASE 
            WHEN pp.prev_revenue > 0 
            THEN ROUND(((cp.total_revenue - pp.prev_revenue)::NUMERIC / pp.prev_revenue) * 100, 1)
            ELSE 0
          END as "revenueGrowth"
        FROM current_period cp
        CROSS JOIN previous_period pp
        CROSS JOIN product_metrics pm
      `;
      
      const result = await db.query(summaryQuery);
      
      res.json({
        success: true,
        data: result.rows[0] || {
          totalOrders: 0,
          uniqueCustomers: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          productsSold: 0,
          totalUnits: 0,
          orderGrowth: 0,
          revenueGrowth: 0
        }
      });
    } catch (error) {
      logger.error('Error fetching performance summary', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance summary'
      });
    }
  });

  return router;
}