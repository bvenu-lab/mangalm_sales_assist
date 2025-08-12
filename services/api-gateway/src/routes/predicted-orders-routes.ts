import { Router, Request, Response } from 'express';
import { db } from '../database/db-connection';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get predicted orders from the actual predicted_orders table
 */
router.get('/orders/predicted', async (req: Request, res: Response) => {
  try {
    const storeId = req.query.store_id as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    logger.info('Fetching predicted orders', { storeId, limit, offset });
    
    let query = `
      SELECT 
        po.id,
        po.store_id,
        json_build_object(
          'name', s.name,
          'city', s.city
        ) as store,
        po.predicted_date as prediction_date,
        po.confidence as confidence_score,
        po.total_amount as estimated_value,
        po.status,
        po.ai_recommendation,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'productId', poi.product_id,
              'name', poi.product_name,
              'quantity', poi.predicted_quantity,
              'price', poi.unit_price
            )
          )
          FROM predicted_order_items poi
          WHERE poi.predicted_order_id = po.id
          ), '[]'::json
        ) as predicted_items
      FROM predicted_orders po
      JOIN stores s ON po.store_id = s.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (storeId) {
      params.push(storeId);
      query += ` AND po.store_id = $${params.length}`;
    }
    
    query += ` ORDER BY po.predicted_date ASC`;
    
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    
    params.push(offset);
    query += ` OFFSET $${params.length}`;
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rowCount,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error fetching predicted orders', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predicted orders'
    });
  }
});

/**
 * Also handle the /pending endpoint with proper filtering
 */
router.get('/orders/pending', async (req: Request, res: Response) => {
  try {
    const storeId = req.query.store_id as string;
    const limit = parseInt(req.query.limit as string) || 50;
    
    logger.info('Fetching pending orders', { storeId, limit });
    
    let query = `
      SELECT 
        po.id,
        po.store_id,
        json_build_object(
          'name', s.name,
          'city', s.city
        ) as store,
        po.predicted_date as prediction_date,
        po.confidence as confidence_score,
        po.total_amount as estimated_value,
        po.status,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'productId', poi.product_id,
              'name', poi.product_name,
              'quantity', poi.predicted_quantity,
              'price', poi.unit_price
            )
          )
          FROM predicted_order_items poi
          WHERE poi.predicted_order_id = po.id
          ), '[]'::json
        ) as predicted_items
      FROM predicted_orders po
      JOIN stores s ON po.store_id = s.id
      WHERE po.status = 'pending'
    `;
    
    const params: any[] = [];
    
    if (storeId) {
      params.push(storeId);
      query += ` AND po.store_id = $${params.length}`;
    }
    
    query += ` ORDER BY po.predicted_date ASC`;
    
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    
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

export { router as predictedOrdersRoutes };