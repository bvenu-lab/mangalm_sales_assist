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
        po.justification,
        po.reasoning,
        po.data_sources,
        po.pattern_indicators,
        po.notes,
        po.prediction_model,
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
 * Get a single predicted order by ID (UUID)
 */
router.get('/orders/predicted/:id', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;

    logger.info('Fetching predicted order by ID', { orderId });

    const query = `
      SELECT
        po.id,
        po.store_id,
        json_build_object(
          'id', s.id,
          'name', s.name,
          'address', s.address,
          'city', s.city,
          'phone', s.phone,
          'email', s.email,
          'contactPerson', s.contact_person
        ) as store,
        po.predicted_date as prediction_date,
        po.confidence as confidence_score,
        po.total_amount as estimated_value,
        po.status,
        po.priority,
        po.ai_recommendation,
        po.justification,
        po.reasoning,
        po.data_sources,
        po.pattern_indicators,
        po.notes,
        po.prediction_model,
        po.manual_verification_required,
        po.created_at,
        po.updated_at,
        po.created_by,
        po.modified_by,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', poi.id,
              'productId', poi.product_id,
              'name', poi.product_name,
              'quantity', poi.predicted_quantity,
              'price', poi.unit_price,
              'total', poi.predicted_quantity * poi.unit_price,
              'confidence', poi.confidence
            )
          )
          FROM predicted_order_items poi
          WHERE poi.predicted_order_id = po.id
          ), '[]'::json
        ) as predicted_items,
        (SELECT COUNT(*) FROM predicted_order_items WHERE predicted_order_id = po.id) as item_count,
        (SELECT SUM(predicted_quantity) FROM predicted_order_items WHERE predicted_order_id = po.id) as total_quantity
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

    // Return the complete predicted order data
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error fetching predicted order by ID', {
      orderId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predicted order',
      details: error.message
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
        po.ai_recommendation,
        po.justification,
        po.reasoning,
        po.data_sources,
        po.pattern_indicators,
        po.notes,
        po.prediction_model,
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