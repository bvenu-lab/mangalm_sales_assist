import express, { Request, Response, Router } from 'express';
import { logger } from '../utils/logger';
import { db } from '../database/db-connection';

/**
 * Create upselling routes for product recommendations
 */
export function createUpsellingRoutes(): Router {
  const router = express.Router();

  // Get upselling suggestions for an order
  router.get('/suggestions/:orderId', async (req: Request, res: Response) => {
    try {
      const orderId = req.params.orderId;
      logger.info('Fetching upselling suggestions for order', { orderId });
      
      // Get the order's current items
      const orderItemsQuery = `
        SELECT 
          poi.product_id,
          poi.predicted_quantity,
          COALESCE(p.name, poi.product_name) as product_name,
          p.category,
          p.brand,
          COALESCE(p.price, poi.unit_price) as unit_price
        FROM predicted_order_items poi
        LEFT JOIN products p ON poi.product_id = p.id
        WHERE poi.predicted_order_id = $1::uuid
      `;
      
      const orderItems = await db.query(orderItemsQuery, [orderId]);
      
      if (orderItems.rows.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }
      
      // Extract categories and brands from current order
      const categories = [...new Set(orderItems.rows.map((item: any) => item.category).filter(Boolean))];
      const brands = [...new Set(orderItems.rows.map((item: any) => item.brand).filter(Boolean))];
      const currentProductIds = orderItems.rows.map((item: any) => item.product_id);
      
      // Find complementary and similar products
      const upsellQuery = `
        WITH product_popularity AS (
          -- Calculate product popularity based on how often they're ordered
          SELECT 
            ii.product_id,
            COUNT(DISTINCT ii.invoice_id) as order_count,
            AVG(ii.quantity) as avg_quantity,
            SUM(ii.quantity) as total_sold
          FROM invoice_items ii
          GROUP BY ii.product_id
        ),
        frequently_bought_together AS (
          -- Find products frequently bought with current order items
          SELECT 
            ii2.product_id,
            COUNT(DISTINCT ii2.invoice_id) as co_occurrence_count
          FROM invoice_items ii1
          JOIN invoice_items ii2 ON ii1.invoice_id = ii2.invoice_id
          WHERE ii1.product_id = ANY($1::text[])
            AND ii2.product_id != ALL($1::text[])
          GROUP BY ii2.product_id
        ),
        category_matches AS (
          -- Find products in similar categories
          SELECT 
            p.id as product_id,
            CASE 
              WHEN p.category = ANY($2::text[]) THEN 2  -- Same category
              WHEN p.brand = ANY($3::text[]) THEN 1     -- Same brand
              ELSE 0
            END as relevance_score
          FROM products p
          WHERE p.id != ALL($1::text[])
        )
        SELECT DISTINCT
          p.id as product_id,
          p.name as product_name,
          p.category,
          p.brand,
          p.price as unit_price,
          -- Suggested quantity based on average quantity ordered
          COALESCE(pp.avg_quantity, 10)::INTEGER as suggested_quantity,
          -- Calculate confidence score
          LEAST(0.95, 
            0.3 + -- Base confidence
            COALESCE(fbt.co_occurrence_count * 0.1, 0) + -- Frequently bought together boost
            COALESCE(cm.relevance_score * 0.15, 0) + -- Category/brand match boost
            CASE WHEN pp.order_count > 50 THEN 0.2 
                 WHEN pp.order_count > 20 THEN 0.1 
                 ELSE 0 END -- Popularity boost
          ) as confidence,
          -- Generate justification
          CASE 
            WHEN fbt.co_occurrence_count > 10 THEN 
              'Frequently purchased together - ' || fbt.co_occurrence_count || ' customers also bought this'
            WHEN fbt.co_occurrence_count > 5 THEN 
              'Often bought together - ' || fbt.co_occurrence_count || ' customers also ordered this'
            WHEN p.category = ANY($2::text[]) THEN 
              'Similar product in ' || p.category || ' category - complements your current selection'
            WHEN p.brand = ANY($3::text[]) THEN 
              'Same brand (' || p.brand || ') - customers who buy this brand often get multiple products'
            WHEN pp.order_count > 50 THEN 
              'Popular item - ordered by ' || pp.order_count || ' stores regularly'
            WHEN pp.total_sold > 500 THEN 
              'Best seller - over ' || pp.total_sold || ' units sold'
            ELSE 
              'Recommended based on order patterns in your region'
          END as justification,
          -- Priority for sorting
          COALESCE(fbt.co_occurrence_count, 0) * 10 + 
          COALESCE(cm.relevance_score, 0) * 5 + 
          COALESCE(pp.order_count, 0) as priority
        FROM products p
        LEFT JOIN product_popularity pp ON p.id = pp.product_id
        LEFT JOIN frequently_bought_together fbt ON p.id = fbt.product_id
        LEFT JOIN category_matches cm ON p.id = cm.product_id
        WHERE p.id != ALL($1::text[])
          AND (
            fbt.co_occurrence_count > 0 OR 
            cm.relevance_score > 0 OR 
            pp.order_count > 10
          )
        ORDER BY priority DESC, confidence DESC
        LIMIT 15
      `;
      
      const params = [
        currentProductIds,
        categories.length > 0 ? categories : [''],
        brands.length > 0 ? brands : ['']
      ];
      
      const upsellResult = await db.query(upsellQuery, params);
      
      // Format the response
      const suggestions = upsellResult.rows.map((row: any) => ({
        productId: row.product_id,
        productName: row.product_name,
        category: row.category,
        brand: row.brand,
        unitPrice: parseFloat(row.unit_price || 0),
        suggestedQuantity: row.suggested_quantity,
        confidence: parseFloat(row.confidence),
        justification: row.justification,
        expectedRevenue: parseFloat(row.unit_price || 0) * row.suggested_quantity
      }));
      
      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      logger.error('Error fetching upselling suggestions', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upselling suggestions'
      });
    }
  });

  // Get upselling suggestions for a store
  router.get('/store/:storeId', async (req: Request, res: Response) => {
    try {
      const storeId = req.params.storeId;
      logger.info('Fetching upselling suggestions for store', { storeId });
      
      // Get store's purchase history
      const historyQuery = `
        WITH store_products AS (
          SELECT 
            ii.product_id,
            SUM(ii.quantity) as total_quantity,
            COUNT(DISTINCT hi.id) as order_count,
            MAX(hi.invoice_date) as last_ordered
          FROM mangalam_invoices hi
          JOIN invoice_items ii ON hi.invoice_id = ii.invoice_id
          WHERE hi.customer_id = $1::text
          GROUP BY ii.product_id
        ),
        product_growth AS (
          -- Identify products with growing demand
          SELECT 
            ii.product_id,
            CASE 
              WHEN COUNT(DISTINCT CASE WHEN hi.invoice_date > NOW() - INTERVAL '3 months' THEN hi.id END) >
                   COUNT(DISTINCT CASE WHEN hi.invoice_date BETWEEN NOW() - INTERVAL '6 months' AND NOW() - INTERVAL '3 months' THEN hi.id END)
              THEN 'growing'
              ELSE 'stable'
            END as trend
          FROM mangalam_invoices hi
          JOIN invoice_items ii ON hi.invoice_id = ii.invoice_id
          WHERE hi.customer_id = $1::text
          GROUP BY ii.product_id
        )
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.category,
          p.brand,
          p.price as unit_price,
          -- Calculate suggested quantity
          CASE 
            WHEN sp.total_quantity IS NOT NULL THEN 
              GREATEST(10, sp.total_quantity / GREATEST(sp.order_count, 1) * 1.2)::INTEGER
            ELSE 15
          END as suggested_quantity,
          -- Confidence based on purchase history
          CASE 
            WHEN sp.order_count > 5 THEN 0.85
            WHEN sp.order_count > 2 THEN 0.65
            WHEN sp.order_count > 0 THEN 0.45
            ELSE 0.35
          END as confidence,
          -- Generate store-specific justification
          CASE 
            WHEN pg.trend = 'growing' THEN 
              'Growing demand - your orders for this have increased recently'
            WHEN sp.last_ordered < NOW() - INTERVAL '60 days' AND sp.order_count > 2 THEN 
              'Restock suggestion - you haven''t ordered this in ' || 
              EXTRACT(DAY FROM NOW() - sp.last_ordered)::INTEGER || ' days'
            WHEN sp.order_count > 5 THEN 
              'Regular item - you''ve ordered this ' || sp.order_count || ' times'
            WHEN p.category IN (
              SELECT DISTINCT p2.category 
              FROM store_products sp2 
              JOIN products p2 ON sp2.product_id = p2.id
            ) THEN 
              'Expands your ' || p.category || ' selection'
            ELSE 
              'New product suggestion based on similar stores'
          END as justification
        FROM products p
        LEFT JOIN store_products sp ON p.id = sp.product_id
        LEFT JOIN product_growth pg ON p.id = pg.product_id
        WHERE 
          -- Include products they've bought before or new relevant products
          sp.product_id IS NOT NULL 
          OR p.category IN (
            SELECT DISTINCT p2.category 
            FROM store_products sp2 
            JOIN products p2 ON sp2.product_id = p2.id
          )
        ORDER BY 
          CASE WHEN pg.trend = 'growing' THEN 0 ELSE 1 END,
          sp.order_count DESC NULLS LAST,
          p.name
        LIMIT 20
      `;
      
      const result = await db.query(historyQuery, [storeId]);
      
      const suggestions = result.rows.map((row: any) => ({
        productId: row.product_id,
        productName: row.product_name,
        category: row.category,
        brand: row.brand,
        unitPrice: parseFloat(row.unit_price || 0),
        suggestedQuantity: row.suggested_quantity,
        confidence: parseFloat(row.confidence),
        justification: row.justification,
        expectedRevenue: parseFloat(row.unit_price || 0) * row.suggested_quantity
      }));
      
      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      logger.error('Error fetching store upselling suggestions', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upselling suggestions'
      });
    }
  });

  // Get upselling suggestions history
  router.get('/suggestions/history', async (req: Request, res: Response) => {
    try {
      logger.info('Fetching upselling suggestions history');
      
      // Return mock data for now - this would be replaced with actual database query
      const mockHistory = {
        success: true,
        data: {
          suggestions: [],
          total: 0,
          page: 1,
          limit: 10
        }
      };
      
      res.json(mockHistory);
    } catch (error) {
      logger.error('Error fetching upselling suggestions history', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upselling suggestions history'
      });
    }
  });

  return router;
}