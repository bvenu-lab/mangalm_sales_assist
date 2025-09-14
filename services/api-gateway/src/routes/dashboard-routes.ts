import express, { Request, Response, Router } from 'express';
import { logger } from '../utils/logger';
import { db } from '../database/db-connection';

/**
 * Create dashboard routes for the frontend with real database data
 */
export function createDashboardRoutes(): Router {
  const router = express.Router();

  // Get prioritized call list based on stores that need attention
  router.get('/calls/prioritized', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const storeId = req.query.storeId as string;
      logger.info('Fetching prioritized call list', { limit, storeId });
      
      // First check if we have any invoices at all - if not, return empty
      const invoiceCheck = await db.query('SELECT COUNT(*) as count FROM mangalam_invoices');
      if (parseInt(invoiceCheck.rows[0].count) === 0) {
        return res.json({
          success: true,
          data: [],
          total: 0
        });
      }
      
      // Query stores with their last order information and calculate priority
      const query = `
        WITH store_orders AS (
          SELECT
            s.id,
            s.name,
            s.address,
            MAX(mi.invoice_date) as last_order_date,
            COUNT(mi.id) as total_orders,
            AVG(mi.total) as avg_order_value,
            SUM(mi.total) as total_revenue
          FROM stores s
          LEFT JOIN mangalam_invoices mi ON LOWER(TRIM(s.name)) = LOWER(TRIM(mi.customer_name))
          ${storeId ? 'WHERE s.id = $2' : ''}
          GROUP BY s.id, s.name, s.address
        ),
        priority_scores AS (
          SELECT
            *,
            -- Calculate priority score based on:
            -- 1. Days since last order (higher score for longer gaps)
            -- 2. Average order value (higher score for valuable customers)
            -- 3. Total orders (regular customers get priority)
            CASE
              WHEN last_order_date IS NULL THEN 10.0
              ELSE LEAST(10.0, EXTRACT(DAY FROM NOW() - last_order_date) / 7.0 * 5.0)
            END +
            CASE
              WHEN avg_order_value > 50000 THEN 3.0
              WHEN avg_order_value > 30000 THEN 2.0
              WHEN avg_order_value > 10000 THEN 1.0
              ELSE 0.5
            END +
            CASE
              WHEN total_orders > 20 THEN 2.0
              WHEN total_orders > 10 THEN 1.5
              WHEN total_orders > 5 THEN 1.0
              ELSE 0.5
            END as priority_score,
            CASE
              WHEN last_order_date IS NULL THEN 'New customer - never ordered'
              WHEN EXTRACT(DAY FROM NOW() - last_order_date) > 30 THEN 'Overdue for order - ' || EXTRACT(DAY FROM NOW() - last_order_date)::INTEGER || ' days'
              WHEN avg_order_value > 50000 THEN 'High-value customer'
              WHEN total_orders > 20 THEN 'Regular customer'
              ELSE 'Standard follow-up'
            END as priority_reason
          FROM store_orders
        ),
        ranked_stores AS (
          SELECT *,
            ROW_NUMBER() OVER (ORDER BY priority_score DESC) as priority_rank
          FROM priority_scores
        )
        SELECT
          rs.priority_rank as id,
          rs.id as "storeId",
          json_build_object(
            'id', rs.id,
            'name', rs.name,
            'address', COALESCE(rs.address, ''),
            'city', COALESCE(rs.address, ''),
            'region', COALESCE(rs.address, '')
          ) as store,
          rs.priority_rank as "priorityScore",
          rs.priority_score as "actualScore",
          rs.priority_reason as "priorityReason",
          CASE
            WHEN rs.last_order_date IS NOT NULL THEN rs.last_order_date::text
            ELSE NULL
          END as "lastCallDate",
          (CURRENT_DATE + INTERVAL '3 days')::text as "nextCallDate",
          'Agent1' as "assignedAgent",
          'Pending' as status,
          NOW() as "createdAt",
          NOW() as "updatedAt"
        FROM ranked_stores rs
        ORDER BY rs.priority_rank
        LIMIT $1
      `;
      
      const params = storeId ? [limit, storeId] : [limit];
      const result = await db.query(query, params);
      
      // Ensure numeric fields are properly typed
      const mappedRows = result.rows.map((row: any) => ({
        ...row,
        priorityScore: parseFloat(row.priorityScore) || 0,
        storeId: row.storeId
      }));
      
      res.json({
        success: true,
        data: mappedRows,
        total: result.rowCount
      });
    } catch (error) {
      logger.error('Error fetching prioritized calls', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch prioritized calls'
      });
    }
  });

  // Get next priority call after current store
  router.get('/calls/next-priority/:storeId', async (req: Request, res: Response) => {
    try {
      const currentStoreId = req.params.storeId;
      logger.info('Fetching next priority call after store', { currentStoreId });
      
      // Get current store's priority score first
      const currentStoreQuery = `
        WITH store_orders AS (
          SELECT 
            s.id,
            MAX(hi.invoice_date) as last_order_date,
            COUNT(hi.id) as total_orders,
            AVG(hi.total_amount) as avg_order_value
          FROM stores s
          LEFT JOIN mangalam_invoices hi ON s.name = hi.customer_name
          WHERE s.id = $1
          GROUP BY s.id
        )
        SELECT 
          CASE 
            WHEN last_order_date IS NULL THEN 10.0
            ELSE LEAST(10.0, EXTRACT(DAY FROM NOW() - last_order_date) / 7.0 * 5.0)
          END +
          CASE 
            WHEN avg_order_value > 50000 THEN 3.0
            WHEN avg_order_value > 30000 THEN 2.0
            WHEN avg_order_value > 10000 THEN 1.0
            ELSE 0.5
          END +
          CASE
            WHEN total_orders > 20 THEN 2.0
            WHEN total_orders > 10 THEN 1.5
            WHEN total_orders > 5 THEN 1.0
            ELSE 0.5
          END as current_priority
        FROM store_orders
      `;
      
      const currentResult = await db.query(currentStoreQuery, [currentStoreId]);
      const currentPriority = currentResult.rows[0]?.current_priority || 0;
      
      // Get next highest priority store
      const nextStoreQuery = `
        WITH store_orders AS (
          SELECT 
            s.id,
            s.name,
            COALESCE(s.address, ''),
            COALESCE(s.address, ''),
            MAX(hi.invoice_date) as last_order_date,
            COUNT(hi.id) as total_orders,
            AVG(hi.total_amount) as avg_order_value
          FROM stores s
          LEFT JOIN mangalam_invoices hi ON s.name = hi.customer_name
          WHERE s.id != $1
          GROUP BY s.id, s.name, s.address
        ),
        priority_scores AS (
          SELECT 
            *,
            CASE 
              WHEN last_order_date IS NULL THEN 10.0
              ELSE LEAST(10.0, EXTRACT(DAY FROM NOW() - last_order_date) / 7.0 * 5.0)
            END +
            CASE 
              WHEN avg_order_value > 50000 THEN 3.0
              WHEN avg_order_value > 30000 THEN 2.0
              WHEN avg_order_value > 10000 THEN 1.0
              ELSE 0.5
            END +
            CASE
              WHEN total_orders > 20 THEN 2.0
              WHEN total_orders > 10 THEN 1.5
              WHEN total_orders > 5 THEN 1.0
              ELSE 0.5
            END as priority_score,
            CASE
              WHEN last_order_date IS NULL THEN 'New customer - never ordered'
              WHEN EXTRACT(DAY FROM NOW() - last_order_date) > 30 THEN 'Overdue for order'
              WHEN avg_order_value > 50000 THEN 'High-value customer'
              WHEN total_orders > 20 THEN 'Regular customer'
              ELSE 'Standard follow-up'
            END as priority_reason
          FROM store_orders
        )
        SELECT 
          id as "storeId",
          json_build_object(
            'name', name,
            'city', COALESCE(address, ''),
            'region', COALESCE(address, '')
          ) as store,
          ROUND(priority_score::numeric, 1) as "priorityScore",
          priority_reason as "priorityReason"
        FROM priority_scores
        WHERE priority_score < $2
        ORDER BY priority_score DESC
        LIMIT 1
      `;
      
      const nextResult = await db.query(nextStoreQuery, [currentStoreId, currentPriority]);
      
      logger.info('Next priority query result', {
        currentStoreId,
        currentPriority,
        rowCount: nextResult.rows.length,
        firstRow: nextResult.rows[0]
      });
      
      if (nextResult.rows.length > 0) {
        res.json({
          success: true,
          data: nextResult.rows[0]
        });
      } else {
        // If no next store, get the highest priority one
        const highestQuery = `
          WITH store_orders AS (
            SELECT 
              s.id,
              s.name,
              COALESCE(s.address, ''),
              COALESCE(s.address, ''),
              MAX(hi.invoice_date) as last_order_date,
              COUNT(hi.id) as total_orders,
              AVG(hi.total_amount) as avg_order_value
            FROM stores s
            LEFT JOIN mangalam_invoices hi ON s.name = hi.customer_name
            WHERE s.id != $1
            GROUP BY s.id, s.name, s.address
          ),
          priority_scores AS (
            SELECT 
              *,
              CASE 
                WHEN last_order_date IS NULL THEN 10.0
                ELSE LEAST(10.0, EXTRACT(DAY FROM NOW() - last_order_date) / 7.0 * 5.0)
              END +
              CASE 
                WHEN avg_order_value > 50000 THEN 3.0
                WHEN avg_order_value > 30000 THEN 2.0
                WHEN avg_order_value > 10000 THEN 1.0
                ELSE 0.5
              END +
              CASE
                WHEN total_orders > 20 THEN 2.0
                WHEN total_orders > 10 THEN 1.5
                WHEN total_orders > 5 THEN 1.0
                ELSE 0.5
              END as priority_score,
              CASE
                WHEN last_order_date IS NULL THEN 'New customer - never ordered'
                WHEN EXTRACT(DAY FROM NOW() - last_order_date) > 30 THEN 'Overdue for order'
                WHEN avg_order_value > 50000 THEN 'High-value customer'
                WHEN total_orders > 20 THEN 'Regular customer'
                ELSE 'Standard follow-up'
              END as priority_reason
            FROM store_orders
          )
          SELECT 
            id as store_id,
            json_build_object(
              'name', name,
              'city', city,
              'region', state
            ) as store,
            ROUND(priority_score::numeric, 1) as priority_score,
            priority_reason
          FROM priority_scores
          ORDER BY priority_score DESC
          LIMIT 1
        `;
        
        const highestResult = await db.query(highestQuery, [currentStoreId]);
        
        res.json({
          success: true,
          data: highestResult.rows[0] || null
        });
      }
    } catch (error) {
      logger.error('Error fetching next priority call', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch next priority call'
      });
    }
  });

  // Get previous priority call before current store
  router.get('/calls/previous-priority/:storeId', async (req: Request, res: Response) => {
    try {
      const currentStoreId = req.params.storeId;
      logger.info('Fetching previous priority call before store', { currentStoreId });
      
      // Get current store's priority score first
      const currentStoreQuery = `
        WITH store_orders AS (
          SELECT 
            s.id,
            MAX(hi.invoice_date) as last_order_date,
            COUNT(hi.id) as total_orders,
            AVG(hi.total_amount) as avg_order_value
          FROM stores s
          LEFT JOIN mangalam_invoices hi ON s.name = hi.customer_name
          WHERE s.id = $1
          GROUP BY s.id
        )
        SELECT 
          CASE 
            WHEN last_order_date IS NULL THEN 10.0
            ELSE LEAST(10.0, EXTRACT(DAY FROM NOW() - last_order_date) / 7.0 * 5.0)
          END +
          CASE 
            WHEN avg_order_value > 50000 THEN 3.0
            WHEN avg_order_value > 30000 THEN 2.0
            WHEN avg_order_value > 10000 THEN 1.0
            ELSE 0.5
          END +
          CASE
            WHEN total_orders > 20 THEN 2.0
            WHEN total_orders > 10 THEN 1.5
            WHEN total_orders > 5 THEN 1.0
            ELSE 0.5
          END as current_priority
        FROM store_orders
      `;
      
      const currentResult = await db.query(currentStoreQuery, [currentStoreId]);
      const currentPriority = currentResult.rows[0]?.current_priority || 0;
      
      // Get previous higher priority store (higher score = higher priority)
      const previousStoreQuery = `
        WITH store_orders AS (
          SELECT 
            s.id,
            s.name,
            COALESCE(s.address, ''),
            COALESCE(s.address, ''),
            MAX(hi.invoice_date) as last_order_date,
            COUNT(hi.id) as total_orders,
            AVG(hi.total_amount) as avg_order_value
          FROM stores s
          LEFT JOIN mangalam_invoices hi ON s.name = hi.customer_name
          WHERE s.id != $1
          GROUP BY s.id, s.name, s.address
        ),
        priority_scores AS (
          SELECT 
            *,
            CASE 
              WHEN last_order_date IS NULL THEN 10.0
              ELSE LEAST(10.0, EXTRACT(DAY FROM NOW() - last_order_date) / 7.0 * 5.0)
            END +
            CASE 
              WHEN avg_order_value > 50000 THEN 3.0
              WHEN avg_order_value > 30000 THEN 2.0
              WHEN avg_order_value > 10000 THEN 1.0
              ELSE 0.5
            END +
            CASE
              WHEN total_orders > 20 THEN 2.0
              WHEN total_orders > 10 THEN 1.5
              WHEN total_orders > 5 THEN 1.0
              ELSE 0.5
            END as priority_score,
            CASE
              WHEN last_order_date IS NULL THEN 'New customer - never ordered'
              WHEN EXTRACT(DAY FROM NOW() - last_order_date) > 30 THEN 'Overdue for order'
              WHEN avg_order_value > 50000 THEN 'High-value customer'
              WHEN total_orders > 20 THEN 'Regular customer'
              ELSE 'Standard follow-up'
            END as priority_reason
          FROM store_orders
        )
        SELECT 
          id as "storeId",
          json_build_object(
            'name', name,
            'city', COALESCE(address, ''),
            'region', COALESCE(address, '')
          ) as store,
          ROUND(priority_score::numeric, 1) as "priorityScore",
          priority_reason as "priorityReason"
        FROM priority_scores
        WHERE priority_score > $2
        ORDER BY priority_score DESC
        LIMIT 1
      `;
      
      const previousResult = await db.query(previousStoreQuery, [currentStoreId, currentPriority]);
      
      logger.info('Previous priority query result', {
        currentStoreId,
        currentPriority,
        rowCount: previousResult.rows.length,
        firstRow: previousResult.rows[0]
      });
      
      if (previousResult.rows.length > 0) {
        res.json({
          success: true,
          data: previousResult.rows[0]
        });
      } else {
        // If no previous store with higher priority, wrap around to the highest priority one
        const highestQuery = `
          WITH store_orders AS (
            SELECT 
              s.id,
              s.name,
              COALESCE(s.address, ''),
              COALESCE(s.address, ''),
              MAX(hi.invoice_date) as last_order_date,
              COUNT(hi.id) as total_orders,
              AVG(hi.total_amount) as avg_order_value
            FROM stores s
            LEFT JOIN mangalam_invoices hi ON s.name = hi.customer_name
            WHERE s.id != $1
            GROUP BY s.id, s.name, s.address
          ),
          priority_scores AS (
            SELECT 
              *,
              CASE 
                WHEN last_order_date IS NULL THEN 10.0
                ELSE LEAST(10.0, EXTRACT(DAY FROM NOW() - last_order_date) / 7.0 * 5.0)
              END +
              CASE 
                WHEN avg_order_value > 50000 THEN 3.0
                WHEN avg_order_value > 30000 THEN 2.0
                WHEN avg_order_value > 10000 THEN 1.0
                ELSE 0.5
              END +
              CASE
                WHEN total_orders > 20 THEN 2.0
                WHEN total_orders > 10 THEN 1.5
                WHEN total_orders > 5 THEN 1.0
                ELSE 0.5
              END as priority_score,
              CASE
                WHEN last_order_date IS NULL THEN 'New customer - never ordered'
                WHEN EXTRACT(DAY FROM NOW() - last_order_date) > 30 THEN 'Overdue for order'
                WHEN avg_order_value > 50000 THEN 'High-value customer'
                WHEN total_orders > 20 THEN 'Regular customer'
                ELSE 'Standard follow-up'
              END as priority_reason
            FROM store_orders
          )
          SELECT 
            id as "storeId",
            json_build_object(
              'name', name,
              'city', city,
              'region', state
            ) as store,
            ROUND(priority_score::numeric, 1) as "priorityScore",
            priority_reason as "priorityReason"
          FROM priority_scores
          ORDER BY priority_score DESC
          LIMIT 1
        `;
        
        const highestResult = await db.query(highestQuery, [currentStoreId]);
        
        res.json({
          success: true,
          data: highestResult.rows[0] || null
        });
      }
    } catch (error) {
      logger.error('Error fetching previous priority call', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch previous priority call'
      });
    }
  });

  // Get recent stores (recently added or recently ordered)
  router.get('/stores/recent', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      logger.info('Fetching recent stores', { limit });
      
      const query = `
        SELECT 
          s.id,
          s.name,
          COALESCE(s.address, ''),
          COALESCE(s.address, '') as region,
          s.name as contact_person,
          '+91-' || SUBSTRING(MD5(s.id), 1, 10) as phone,
          MAX(hi.invoice_date) as last_order_date
        FROM stores s
        LEFT JOIN historical_invoices hi ON s.id = hi.store_id
        GROUP BY s.id, s.name, s.address
        ORDER BY 
          CASE 
            WHEN MAX(hi.invoice_date) IS NOT NULL THEN MAX(hi.invoice_date)
            ELSE s.created_at
          END DESC
        LIMIT $1
      `;
      
      const result = await db.query(query, [limit]);
      
      res.json({
        success: true,
        data: result.rows,
        total: result.rowCount
      });
    } catch (error) {
      logger.error('Error fetching recent stores', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent stores'
      });
    }
  });

  // Get pending orders (predicted orders based on historical patterns)
  router.get('/orders/pending', async (req: Request, res: Response) => {
    try {
      const storeId = req.query.store_id as string;
      const limit = parseInt(req.query.limit as string) || 10;
      logger.info('Fetching pending orders', { storeId, limit });

      // Use mangalam_invoices data to simulate pending orders based on recent patterns
      let query;
      let params: any[] = [];

      if (storeId) {
        // First get the store name for this ID
        const storeResult = await db.query('SELECT name FROM stores WHERE id = $1', [storeId]);
        const storeName = storeResult.rows[0]?.name;

        if (storeName) {
          query = `
            WITH recent_invoices AS (
              SELECT
                mi.id,
                mi.customer_id as store_id,
                mi.customer_name as store_name,
                s.id as actual_store_id,
                s.address as store_address,
                mi.invoice_date,
                mi.total as total_amount,
                json_build_object(
                  'product_id', mi.product_id,
                  'product_name', mi.item_name,
                  'quantity', mi.quantity,
                  'unit_price', mi.item_price
                ) as item_details
              FROM mangalam_invoices mi
              LEFT JOIN stores s ON LOWER(TRIM(s.name)) = LOWER(TRIM(mi.customer_name))
              WHERE LOWER(TRIM(mi.customer_name)) = LOWER(TRIM($1))
                AND mi.invoice_date > CURRENT_DATE - INTERVAL '30 days'
              ORDER BY mi.invoice_date DESC
              LIMIT 20
            )
            SELECT
              ROW_NUMBER() OVER () as id,
              COALESCE(actual_store_id, store_id) as store_id,
              json_build_object(
                'name', store_name,
                'city', COALESCE(store_address, '')
              ) as store,
              CURRENT_DATE + INTERVAL '7 days' as prediction_date,
              0.85 + RANDOM() * 0.1 as confidence_score,
              AVG(total_amount) as estimated_value,
              'pending' as status,
              json_agg(item_details) as predicted_items
            FROM recent_invoices
            GROUP BY actual_store_id, store_id, store_name, store_address
            LIMIT $2
          `;
          params = [storeName, limit];
        } else {
          // Store not found, return empty
          return res.json({ success: true, data: [], total: 0 });
        }
      } else {
        // Get pending orders for all stores
        query = `
          WITH recent_store_activity AS (
            SELECT
              mi.customer_name as store_name,
              s.id as store_id,
              s.address as store_address,
              MAX(mi.invoice_date) as last_order_date,
              AVG(mi.total) as avg_order_value,
              COUNT(DISTINCT mi.invoice_number) as order_count,
              json_agg(json_build_object(
                'product_id', mi.product_id,
                'product_name', mi.item_name,
                'quantity', mi.quantity
              )) as typical_items
            FROM mangalam_invoices mi
            LEFT JOIN stores s ON LOWER(TRIM(s.name)) = LOWER(TRIM(mi.customer_name))
            WHERE mi.invoice_date > CURRENT_DATE - INTERVAL '60 days'
            GROUP BY mi.customer_name, s.id, s.address
            HAVING MAX(mi.invoice_date) < CURRENT_DATE - INTERVAL '7 days'
          )
          SELECT
            ROW_NUMBER() OVER () as id,
            store_id,
            json_build_object(
              'name', store_name,
              'city', COALESCE(store_address, '')
            ) as store,
            CURRENT_DATE + INTERVAL '3 days' as prediction_date,
            CASE
              WHEN order_count > 10 THEN 0.9
              WHEN order_count > 5 THEN 0.85
              ELSE 0.75
            END as confidence_score,
            avg_order_value as estimated_value,
            'pending' as status,
            typical_items as predicted_items
          FROM recent_store_activity
          ORDER BY last_order_date ASC, avg_order_value DESC
          LIMIT $1
        `;
        params = [limit];
      }

      const result = await db.query(query, params);
      
      res.json({
        success: true,
        data: result.rows,
        total: result.rowCount
      });
    } catch (error) {
      logger.error('Error fetching pending orders', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending orders'
      });
    }
  });

  // Get recent actual orders (from document uploads and manual entries)
  router.get('/orders/recent', async (req: Request, res: Response) => {
    try {
      const storeId = req.query.store_id as string;
      const limit = parseInt(req.query.limit as string) || 10;
      logger.info('Fetching recent actual orders', { storeId, limit, headers: req.headers });
      
      const query = storeId ? `
        SELECT 
          o.id,
          o.order_number,
          o.store_id,
          json_build_object(
            'id', s.id,
            'name', s.name,
            'address', s.address,
            'region', COALESCE(s.address, '')
          ) as store,
          o.customer_name,
          o.customer_phone,
          o.customer_email,
          o.created_at as order_date,
          o.status,
          o.items,
          o.item_count,
          o.total_quantity,
          o.total_amount,
          o.source,
          COALESCE(o.extraction_confidence, 0.95) as extraction_confidence,
          COALESCE(o.data_quality_score, 0.9) as data_quality_score,
          o.created_at,
          o.notes
        FROM orders o
        JOIN stores s ON o.store_id = s.id
        WHERE o.store_id = $1
        ORDER BY o.created_at DESC
        LIMIT $2
      ` : `
        SELECT 
          o.id,
          o.order_number,
          o.store_id,
          json_build_object(
            'id', s.id,
            'name', s.name,
            'address', s.address,
            'region', COALESCE(s.address, '')
          ) as store,
          o.customer_name,
          o.customer_phone,
          o.customer_email,
          o.created_at as order_date,
          o.status,
          o.items,
          o.item_count,
          o.total_quantity,
          o.total_amount,
          o.source,
          COALESCE(o.extraction_confidence, 0.95) as extraction_confidence,
          COALESCE(o.data_quality_score, 0.9) as data_quality_score,
          o.created_at,
          o.notes
        FROM orders o
        JOIN stores s ON o.store_id = s.id
        ORDER BY o.created_at DESC
        LIMIT $1
      `;
      
      const params = storeId ? [storeId, limit] : [limit];
      const result = await db.query(query, params);
      
      logger.info(`Found ${result.rows.length} recent orders`);
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error: any) {
      logger.error('Failed to fetch recent orders', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent orders',
        message: error.message
      });
    }
  });

  // Get pending orders history
  router.get('/orders/pending/history', async (req: Request, res: Response) => {
    try {
      logger.info('Fetching pending orders history');
      
      // Return mock data for now - this will be replaced with actual database query
      const mockHistory = {
        success: true,
        data: {
          orders: [],
          total: 0,
          page: 1,
          limit: 10
        }
      };
      
      res.json(mockHistory);
    } catch (error: any) {
      logger.error('Failed to fetch pending orders history', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending orders history',
        message: error.message
      });
    }
  });

  // Get a single predicted order by ID
  router.get('/orders/pending/:id', async (req: Request, res: Response) => {
    try {
      const orderId = req.params.id;
      logger.info('Fetching predicted order', { orderId });
      
      const query = `
        SELECT 
          po.id,
          po.store_id,
          json_build_object(
            'id', s.id,
            'name', s.name,
            'address', s.address,
            'region', COALESCE(s.address, '')
          ) as store,
          po.predicted_date as prediction_date,
          po.confidence as confidence_score,
          po.total_amount as estimated_value,
          po.status,
          po.priority,
          po.ai_recommendation,
          COALESCE(
            (SELECT json_agg(
              json_build_object(
                'id', poi.id,
                'productId', poi.product_id,
                'productName', COALESCE(p.name, poi.product_name, poi.product_id),
                'name', COALESCE(p.name, poi.product_name, poi.product_id),
                'quantity', poi.predicted_quantity,
                'suggestedQuantity', poi.predicted_quantity,
                'price', poi.unit_price,
                'unitPrice', poi.unit_price,
                'totalPrice', poi.total_price,
                'confidence', poi.confidence,
                'confidenceScore', poi.confidence,
                'justification', poi.ai_reasoning
              )
            )
            FROM predicted_order_items poi
            LEFT JOIN products p ON poi.product_id = p.id
            WHERE poi.predicted_order_id = po.id
            ), '[]'::json
          ) as predicted_items
        FROM predicted_orders po
        JOIN stores s ON po.store_id = s.id
        WHERE po.id = $1
      `;
      
      const result = await db.query(query, [orderId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Predicted order not found'
        });
      }
      
      // Transform to match expected format for order edit page
      const order = result.rows[0];
      const transformedOrder = {
        id: order.id,
        storeId: order.store_id,
        store: order.store,
        orderDate: order.prediction_date,
        predictionDate: order.prediction_date, // Frontend expects 'predictionDate'
        predictedDate: order.prediction_date,
        expectedDeliveryDate: new Date(new Date(order.prediction_date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        totalAmount: order.estimated_value,
        status: 'Predicted',
        priority: order.priority,
        confidence: order.confidence_score,
        confidenceScore: order.confidence_score,
        aiRecommendation: order.ai_recommendation,
        notes: order.ai_recommendation,
        items: Array.isArray(order.predicted_items) ? order.predicted_items.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.totalPrice || (item.quantity * item.price),
          confidence: item.confidence,
          suggestedQuantity: item.quantity,
          actualQuantity: item.quantity
        })) : []
      };
      
      res.json({
        success: true,
        data: transformedOrder
      });
    } catch (error) {
      logger.error('Error fetching predicted order', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch predicted order'
      });
    }
  });

  // Get performance summary
  router.get('/performance/summary', async (req: Request, res: Response) => {
    try {
      logger.info('Fetching performance summary');
      
      // Calculate performance metrics from mangalam_invoices table which has actual data
      const metricsQuery = `
        WITH most_recent_date AS (
          SELECT MAX(invoice_date) as max_date 
          FROM mangalam_invoices
        ),
        today_metrics AS (
          SELECT 
            COUNT(DISTINCT mi.id) as orders_count,
            COUNT(DISTINCT mi.customer_id) as stores_served,
            COALESCE(SUM(mi.total), 0) as total_revenue,
            COALESCE(AVG(mi.total), 0) as avg_order_value
          FROM mangalam_invoices mi
          CROSS JOIN most_recent_date mrd
          WHERE mi.invoice_date = mrd.max_date
        ),
        recent_period AS (
          SELECT 
            COUNT(DISTINCT id) as orders_count_30d,
            COUNT(DISTINCT customer_id) as stores_served_30d,
            COALESCE(SUM(total), 0) as total_revenue_30d,
            COALESCE(AVG(total), 0) as avg_order_value_30d
          FROM mangalam_invoices
          WHERE invoice_date >= (SELECT max_date FROM most_recent_date) - INTERVAL '30 days'
        ),
        daily_trend AS (
          SELECT 
            invoice_date as date,
            COALESCE(SUM(total), 0) as daily_revenue
          FROM mangalam_invoices
          WHERE invoice_date >= (SELECT max_date FROM most_recent_date) - INTERVAL '7 days'
          GROUP BY invoice_date
          ORDER BY date
        )
        SELECT 
          -- Use most recent date's metrics for the KPI cards
          COALESCE(tm.orders_count, 0) as calls_completed,
          COALESCE(tm.orders_count, 0) as orders_placed,
          0.0 as upsell_success_rate,  -- No mock data - only real upsell tracking
          COALESCE(tm.avg_order_value, 0) as average_order_value,
          COALESCE(tm.total_revenue, 0) as total_revenue,
          (SELECT max_date FROM most_recent_date) as most_recent_date,
          tm.total_revenue as most_recent_date_revenue,
          COALESCE(json_agg(
            json_build_object(
              'date', dt.date,
              'value', dt.daily_revenue
            ) ORDER BY dt.date
          ) FILTER (WHERE dt.date IS NOT NULL), '[]'::json) as performance_trend
        FROM today_metrics tm
        CROSS JOIN recent_period rp
        LEFT JOIN daily_trend dt ON true
        GROUP BY tm.orders_count, tm.avg_order_value, 
                 tm.total_revenue
      `;
      
      const topProductsQuery = `
        -- Get top products from invoice_items
        WITH most_recent_date AS (
          SELECT MAX(invoice_date) as max_date 
          FROM mangalam_invoices
        )
        SELECT 
          COALESCE(ii.product_name, p.name, 'Unknown Product') as name,
          SUM(ii.quantity) as units
        FROM invoice_items ii
        LEFT JOIN mangalam_invoices mi ON ii.invoice_id = mi.invoice_id
        LEFT JOIN products p ON ii.product_id = p.id
        CROSS JOIN most_recent_date mrd
        WHERE mi.invoice_date >= mrd.max_date - INTERVAL '30 days'
        GROUP BY COALESCE(ii.product_name, p.name, 'Unknown Product')
        ORDER BY units DESC
        LIMIT 3
      `;
      
      const [metricsResult, topProductsResult] = await Promise.all([
        db.query(metricsQuery),
        db.query(topProductsQuery)
      ]);
      
      const metrics = metricsResult.rows[0] || {
        calls_completed: 0,
        orders_placed: 0,
        upsell_success_rate: 0,
        average_order_value: 0,
        total_revenue: 0,
        performance_trend: []
      };
      
      const performance = {
        callsCompleted: metrics.calls_completed || 0,
        ordersPlaced: metrics.orders_placed || 0,
        upsellSuccessRate: parseFloat(metrics.upsell_success_rate) || 0,
        averageOrderValue: parseFloat(metrics.average_order_value) || 0,
        totalRevenue: parseFloat(metrics.total_revenue) || 0,
        mostRecentDate: metrics.most_recent_date,
        mostRecentDateRevenue: parseFloat(metrics.most_recent_date_revenue) || 0,
        period: 'last_30_days',
        topProducts: topProductsResult.rows || [],
        performanceTrend: metrics.performance_trend || []
      };
      
      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      logger.error('Error fetching performance summary', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance summary'
      });
    }
  });

  // Removed duplicate /stores route - now handled by store-routes.ts

  // Removed duplicate /products route - now handled by product-routes.ts

  // Get historical invoices
  router.get('/invoices', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const storeId = req.query.store_id as string;

      logger.info('Fetching invoices', { limit, offset, storeId });

      let query = `
        SELECT
          mi.id,
          s.id as store_id,
          mi.customer_name as store_name,
          mi.customer_id,
          mi.invoice_date,
          mi.due_date,
          mi.invoice_number,
          mi.invoice_status,
          mi.total as total_amount,
          mi.balance,
          mi.sales_person,
          json_build_object(
            'productId', mi.product_id,
            'productName', mi.item_name,
            'sku', mi.sku,
            'brand', mi.brand,
            'category', mi.category_name,
            'quantity', mi.quantity,
            'unitPrice', mi.item_price,
            'mrp', mi.mrp,
            'discount', mi.discount,
            'totalPrice', mi.item_total
          ) as item_details
        FROM mangalam_invoices mi
        LEFT JOIN stores s ON LOWER(TRIM(s.name)) = LOWER(TRIM(mi.customer_name))
      `;

      const params: any[] = [];

      if (storeId) {
        // First try to get the store name for this ID
        const storeResult = await db.query('SELECT name FROM stores WHERE id = $1', [storeId]);
        if (storeResult.rows.length > 0) {
          query += ` WHERE LOWER(TRIM(mi.customer_name)) = LOWER(TRIM($1))`;
          params.push(storeResult.rows[0].name);
        } else {
          // If store not found, still try with the ID as customer_name
          query += ` WHERE s.id = $1 OR mi.customer_id = $1`;
          params.push(storeId);
        }
      }

      query += `
        ORDER BY mi.invoice_date DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(limit, offset);

      const result = await db.query(query, params);

      // Group invoices by invoice number to consolidate items
      const invoiceMap = new Map();
      result.rows.forEach((row: any) => {
        const invoiceNum = row.invoice_number;
        if (!invoiceMap.has(invoiceNum)) {
          invoiceMap.set(invoiceNum, {
            id: row.id,
            store_id: row.store_id,
            store_name: row.store_name,
            customer_id: row.customer_id,
            invoice_date: row.invoice_date,
            due_date: row.due_date,
            invoice_number: row.invoice_number,
            invoice_status: row.invoice_status,
            total_amount: row.total_amount,
            balance: row.balance,
            sales_person: row.sales_person,
            items: []
          });
        }
        invoiceMap.get(invoiceNum).items.push(row.item_details);
      });

      const invoices = Array.from(invoiceMap.values());

      res.json({
        success: true,
        data: invoices,
        total: invoices.length,
        limit,
        offset
      });
    } catch (error) {
      logger.error('Error fetching invoices', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch invoices'
      });
    }
  });

  // Public test endpoint for recent orders (no auth required)
  router.get('/orders/recent-public', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      logger.info('Fetching recent orders (public endpoint)', { limit });
      
      const query = `
        SELECT 
          o.id,
          o.order_number,
          o.store_id,
          json_build_object(
            'id', s.id,
            'name', s.name,
            'address', s.address,
            'region', COALESCE(s.address, '')
          ) as store,
          o.customer_name,
          o.total_amount,
          o.source,
          o.status,
          o.created_at
        FROM orders o
        JOIN stores s ON o.store_id = s.id
        WHERE o.source = 'document'
        ORDER BY o.created_at DESC
        LIMIT $1
      `;
      
      const result = await db.query(query, [limit]);
      
      logger.info(`Found ${result.rows.length} recent orders (public)`);
      
      res.json({
        success: true,
        data: result.rows,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Failed to fetch recent orders (public)', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent orders',
        message: error.message
      });
    }
  });

  // Get call prioritization data for dashboard
  router.get('/call-prioritization', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      logger.info('Fetching call prioritization data', { limit });

      // Use mangalam_invoices data to generate call prioritization
      const query = `
        WITH store_metrics AS (
          SELECT
            s.id as store_id,
            s.name as store_name,
            MAX(mi.invoice_date) as last_order_date,
            COUNT(DISTINCT mi.invoice_number) as order_count,
            AVG(mi.total) as avg_order_value,
            SUM(mi.total) as total_revenue,
            CASE
              WHEN MAX(mi.invoice_date) IS NULL THEN true
              ELSE false
            END as is_new_customer,
            CASE
              WHEN MAX(mi.invoice_date) IS NOT NULL THEN
                (CURRENT_DATE - MAX(mi.invoice_date))::INTEGER
              ELSE 999
            END as last_order_days
          FROM stores s
          LEFT JOIN mangalam_invoices mi ON LOWER(TRIM(s.name)) = LOWER(TRIM(mi.customer_name))
          GROUP BY s.id, s.name
        ),
        prioritized_stores AS (
          SELECT
            ROW_NUMBER() OVER (ORDER BY
              CASE
                WHEN last_order_days > 30 THEN last_order_days * 2
                WHEN is_new_customer THEN 100
                ELSE last_order_days
              END DESC,
              total_revenue DESC
            ) as id,
            store_id as "storeId",
            store_name as "storeName",
            ROUND(
              CASE
                WHEN is_new_customer THEN 95.0
                WHEN last_order_days > 60 THEN 90.0
                WHEN last_order_days > 30 THEN 85.0
                WHEN last_order_days > 14 THEN 75.0
                WHEN avg_order_value > 5000 THEN 70.0
                ELSE 50.0 + (last_order_days * 0.5)
              END, 1
            ) as "priorityScore",
            last_order_days as "lastOrderDays",
            CASE
              WHEN order_count = 0 THEN 'Never ordered'
              WHEN order_count < 5 THEN 'Low frequency'
              WHEN order_count < 10 THEN 'Medium frequency'
              ELSE 'High frequency'
            END as "orderFrequency",
            ROUND(avg_order_value::numeric, 2) as "avgOrderValue",
            ROUND(total_revenue::numeric, 2) as "totalRevenue",
            is_new_customer as "isNewCustomer",
            CASE
              WHEN is_new_customer THEN 'Onboard new customer'
              WHEN last_order_days > 60 THEN 'Win back - High priority'
              WHEN last_order_days > 30 THEN 'Re-engage customer'
              WHEN last_order_days > 14 THEN 'Follow up'
              WHEN avg_order_value > 5000 THEN 'Maintain relationship'
              ELSE 'Regular check-in'
            END as "recommendedAction",
            CURRENT_TIMESTAMP as "createdAt"
          FROM store_metrics
        )
        SELECT *
        FROM prioritized_stores
        WHERE "priorityScore" > 40
        ORDER BY "priorityScore" DESC
        LIMIT $1
      `;

      const result = await db.query(query, [limit]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching call prioritization', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch call prioritization data'
      });
    }
  });

  return router;
}