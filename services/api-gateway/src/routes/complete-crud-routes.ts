import express, { Request, Response, Router } from 'express';
import { db } from '../database/db-connection';
import { logger } from '../utils/logger';

/**
 * Complete CRUD routes for all entities with full persistence
 */
export function createCompleteCRUDRoutes(): Router {
  const router = express.Router();

  // ==================== PREDICTED ORDERS ====================
  
  // GET all predicted orders
  router.get('/predicted-orders', async (req: Request, res: Response) => {
    try {
      const { status, store_id, date_from, date_to } = req.query;
      
      let query = `
        SELECT 
          po.*,
          s.name as store_name,
          COALESCE(
            (SELECT json_agg(poi.*)
             FROM predicted_order_items poi
             WHERE poi.predicted_order_id = po.id), '[]'::json
          ) as items
        FROM predicted_orders po
        LEFT JOIN stores s ON po.store_id = s.id
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (status) {
        query += ` AND po.status = $${paramIndex++}`;
        params.push(status);
      }
      if (store_id) {
        query += ` AND po.store_id = $${paramIndex++}`;
        params.push(store_id);
      }
      if (date_from) {
        query += ` AND po.predicted_date >= $${paramIndex++}`;
        params.push(date_from);
      }
      if (date_to) {
        query += ` AND po.predicted_date <= $${paramIndex++}`;
        params.push(date_to);
      }
      
      query += ' ORDER BY po.predicted_date DESC, po.priority DESC';
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        data: result.rows,
        total: result.rowCount
      });
    } catch (error) {
      logger.error('Error fetching predicted orders', error);
      res.status(500).json({ success: false, error: 'Failed to fetch predicted orders' });
    }
  });

  // CREATE new predicted order
  router.post('/predicted-orders', async (req: Request, res: Response) => {
    try {
      const { store_id, predicted_date, items, confidence, priority, notes } = req.body;
      
      await db.query('BEGIN');
      
      // Insert predicted order
      const orderResult = await db.query(`
        INSERT INTO predicted_orders (
          store_id, predicted_date, confidence, priority, 
          total_amount, notes, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        RETURNING *
      `, [
        store_id, 
        predicted_date, 
        confidence || 0.75, 
        priority || 'medium',
        items?.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0) || 0,
        notes,
        req.body.user_id || 'system'
      ]);
      
      const orderId = orderResult.rows[0].id;
      
      // Insert items if provided
      if (items && items.length > 0) {
        for (const item of items) {
          await db.query(`
            INSERT INTO predicted_order_items (
              predicted_order_id, product_id, product_name, 
              predicted_quantity, unit_price, total_price, confidence
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            orderId,
            item.product_id,
            item.product_name,
            item.quantity,
            item.unit_price,
            item.quantity * item.unit_price,
            item.confidence || 0.75
          ]);
        }
      }
      
      await db.query('COMMIT');
      
      res.json({
        success: true,
        data: orderResult.rows[0],
        message: 'Predicted order created successfully'
      });
    } catch (error) {
      await db.query('ROLLBACK');
      logger.error('Error creating predicted order', error);
      res.status(500).json({ success: false, error: 'Failed to create predicted order' });
    }
  });

  // UPDATE predicted order
  router.put('/predicted-orders/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      Object.keys(updates).forEach(key => {
        if (key !== 'id' && key !== 'created_at') {
          updateFields.push(`${key} = $${paramIndex++}`);
          values.push(updates[key]);
        }
      });
      
      if (updateFields.length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }
      
      values.push(id);
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateFields.push(`modified_by = $${paramIndex++}`);
      values.push(req.body.user_id || 'system');
      values.push(id); // for WHERE clause
      
      const query = `
        UPDATE predicted_orders 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const result = await db.query(query, values);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Predicted order not found' });
      }
      
      res.json({
        success: true,
        data: result.rows[0],
        message: 'Predicted order updated successfully'
      });
    } catch (error) {
      logger.error('Error updating predicted order', error);
      res.status(500).json({ success: false, error: 'Failed to update predicted order' });
    }
  });

  // DELETE predicted order
  router.delete('/predicted-orders/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        'DELETE FROM predicted_orders WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Predicted order not found' });
      }
      
      res.json({
        success: true,
        message: 'Predicted order deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting predicted order', error);
      res.status(500).json({ success: false, error: 'Failed to delete predicted order' });
    }
  });

  // ==================== STORE PREFERENCES ====================
  
  // GET store preferences
  router.get('/stores/:id/preferences', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        'SELECT * FROM store_preferences WHERE store_id = $1',
        [id]
      );
      
      if (result.rowCount === 0) {
        // Return default preferences if none exist
        return res.json({
          success: true,
          data: {
            store_id: id,
            call_frequency: 'weekly',
            payment_terms: 30,
            auto_approve_predictions: false
          }
        });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching store preferences', error);
      res.status(500).json({ success: false, error: 'Failed to fetch store preferences' });
    }
  });

  // UPDATE store preferences
  router.put('/stores/:id/preferences', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const preferences = req.body;
      
      const result = await db.query(`
        INSERT INTO store_preferences (
          store_id, call_frequency, preferred_contact_time,
          special_instructions, credit_limit, payment_terms,
          discount_percentage, auto_approve_predictions,
          min_order_value, max_order_value
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (store_id) DO UPDATE SET
          call_frequency = EXCLUDED.call_frequency,
          preferred_contact_time = EXCLUDED.preferred_contact_time,
          special_instructions = EXCLUDED.special_instructions,
          credit_limit = EXCLUDED.credit_limit,
          payment_terms = EXCLUDED.payment_terms,
          discount_percentage = EXCLUDED.discount_percentage,
          auto_approve_predictions = EXCLUDED.auto_approve_predictions,
          min_order_value = EXCLUDED.min_order_value,
          max_order_value = EXCLUDED.max_order_value,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        id,
        preferences.call_frequency,
        preferences.preferred_contact_time,
        preferences.special_instructions,
        preferences.credit_limit,
        preferences.payment_terms,
        preferences.discount_percentage,
        preferences.auto_approve_predictions,
        preferences.min_order_value,
        preferences.max_order_value
      ]);
      
      res.json({
        success: true,
        data: result.rows[0],
        message: 'Store preferences updated successfully'
      });
    } catch (error) {
      logger.error('Error updating store preferences', error);
      res.status(500).json({ success: false, error: 'Failed to update store preferences' });
    }
  });

  // ==================== DASHBOARD SETTINGS ====================
  
  // GET user dashboard settings
  router.get('/dashboard-settings/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      
      const result = await db.query(
        'SELECT * FROM dashboard_settings WHERE user_id = $1',
        [userId]
      );
      
      if (result.rowCount === 0) {
        // Return default settings if none exist
        return res.json({
          success: true,
          data: {
            user_id: userId,
            theme: 'light',
            default_date_range: '30d',
            layout_config: {},
            widget_preferences: {}
          }
        });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching dashboard settings', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard settings' });
    }
  });

  // UPDATE dashboard settings
  router.put('/dashboard-settings/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const settings = req.body;
      
      const result = await db.query(`
        INSERT INTO dashboard_settings (
          user_id, theme, layout_config, widget_preferences,
          notification_settings, default_date_range,
          favorite_stores, favorite_products
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id) DO UPDATE SET
          theme = EXCLUDED.theme,
          layout_config = EXCLUDED.layout_config,
          widget_preferences = EXCLUDED.widget_preferences,
          notification_settings = EXCLUDED.notification_settings,
          default_date_range = EXCLUDED.default_date_range,
          favorite_stores = EXCLUDED.favorite_stores,
          favorite_products = EXCLUDED.favorite_products,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        userId,
        settings.theme,
        JSON.stringify(settings.layout_config || {}),
        JSON.stringify(settings.widget_preferences || {}),
        JSON.stringify(settings.notification_settings || {}),
        settings.default_date_range,
        settings.favorite_stores,
        settings.favorite_products
      ]);
      
      res.json({
        success: true,
        data: result.rows[0],
        message: 'Dashboard settings saved successfully'
      });
    } catch (error) {
      logger.error('Error updating dashboard settings', error);
      res.status(500).json({ success: false, error: 'Failed to update dashboard settings' });
    }
  });

  // ==================== ORDERS - Full CRUD ====================
  
  // UPDATE order
  router.put('/orders/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Track old value for audit
      const oldValue = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
      
      if (oldValue.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      
      // Build update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      Object.keys(updates).forEach(key => {
        if (key !== 'id' && key !== 'created_at') {
          updateFields.push(`${key} = $${paramIndex++}`);
          values.push(updates[key]);
        }
      });
      
      values.push(id);
      
      const result = await db.query(`
        UPDATE orders 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
      
      res.json({
        success: true,
        data: result.rows[0],
        message: 'Order updated successfully'
      });
    } catch (error) {
      logger.error('Error updating order', error);
      res.status(500).json({ success: false, error: 'Failed to update order' });
    }
  });

  // ==================== USER ACTIONS AUDIT ====================
  
  // GET user action history
  router.get('/user-actions', async (req: Request, res: Response) => {
    try {
      const { user_id, entity_type, entity_id, limit = 100 } = req.query;
      
      let query = 'SELECT * FROM user_actions WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (user_id) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(user_id);
      }
      if (entity_type) {
        query += ` AND entity_type = $${paramIndex++}`;
        params.push(entity_type);
      }
      if (entity_id) {
        query += ` AND entity_id = $${paramIndex++}`;
        params.push(entity_id);
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
      params.push(limit);
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        data: result.rows,
        total: result.rowCount
      });
    } catch (error) {
      logger.error('Error fetching user actions', error);
      res.status(500).json({ success: false, error: 'Failed to fetch user actions' });
    }
  });

  // ==================== DASHBOARD SUMMARY ====================
  
  // GET refreshed dashboard summary
  router.get('/dashboard/summary', async (req: Request, res: Response) => {
    try {
      // Refresh materialized view
      await db.query('SELECT refresh_dashboard()');
      
      // Get summary data
      const result = await db.query('SELECT * FROM dashboard_summary');
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching dashboard summary', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard summary' });
    }
  });

  return router;
}