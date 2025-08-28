import express, { Request, Response, Router } from 'express';
import { logger } from '../utils/logger';
import { db } from '../database/db-connection';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

// Helper function to execute queries
async function executeQuery(query: string, params: any[] = []) {
  try {
    const result = await db.query(query, params);
    return result;
  } catch (error: any) {
    logger.error('Database query failed', { query, error: error.message });
    throw error;
  }
}

// Get all product alerts
router.get('/product-alerts', async (req: Request, res: Response) => {
  try {
    const { 
      alert_type, 
      severity, 
      is_resolved,
      limit = '50',
      offset = '0' 
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (alert_type) {
      whereClause += ` AND alert_type = $${paramIndex++}`;
      params.push(alert_type);
    }

    if (severity) {
      whereClause += ` AND severity = $${paramIndex++}`;
      params.push(severity);
    }

    if (is_resolved !== undefined) {
      whereClause += ` AND is_resolved = $${paramIndex++}`;
      params.push(is_resolved === 'true');
    }

    const query = `
      SELECT 
        id,
        alert_type,
        product_name,
        source_type,
        source_id,
        quantity_requested,
        alert_message,
        severity,
        is_resolved,
        resolved_at,
        resolved_by,
        resolution_notes,
        created_at,
        created_by
      FROM product_alerts
      ${whereClause}
      ORDER BY 
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'error' THEN 2
          WHEN 'warning' THEN 3
          WHEN 'info' THEN 4
        END,
        created_at DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex}
    `;

    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: result.rowCount
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch product alerts', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product alerts',
      message: error.message
    });
  }
});

// Get product alerts summary
router.get('/product-alerts/summary', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        alert_type,
        severity,
        alert_count,
        unresolved_count,
        latest_alert,
        unresolved_products
      FROM product_alerts_summary
      ORDER BY 
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'error' THEN 2
          WHEN 'warning' THEN 3
          WHEN 'info' THEN 4
        END,
        alert_type
    `;

    const result = await executeQuery(query);

    res.json({
      success: true,
      data: {
        summary: result.rows,
        total_unresolved: result.rows.reduce((sum: number, row: any) => sum + (row.unresolved_count || 0), 0)
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch product alerts summary', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts summary',
      message: error.message
    });
  }
});

// Get known products catalog
router.get('/products/catalog', async (req: Request, res: Response) => {
  try {
    const { 
      status,
      search,
      limit = '100',
      offset = '0'
    } = req.query;

    let query = 'SELECT * FROM get_product_catalog()';
    const params: any[] = [];
    let whereClause = '';

    if (status || search) {
      const conditions: string[] = [];
      
      if (status) {
        conditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }

      if (search) {
        conditions.push(`product_name ILIKE $${params.length + 1}`);
        params.push(`%${search}%`);
      }

      if (conditions.length > 0) {
        query = `
          SELECT * FROM get_product_catalog()
          WHERE ${conditions.join(' AND ')}
        `;
      }
    }

    query += ` ORDER BY last_ordered DESC NULLS LAST`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: result.rowCount
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch product catalog', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product catalog',
      message: error.message
    });
  }
});

// Validate if product exists
router.post('/products/validate', 
  [
    body('product_name').notEmpty().withMessage('Product name is required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    try {
      const { product_name } = req.body;

      const query = 'SELECT is_valid_product($1) as is_valid';
      const result = await executeQuery(query, [product_name]);

      const isValid = result.rows[0]?.is_valid || false;

      res.json({
        success: true,
        data: {
          product_name,
          is_valid: isValid,
          message: isValid 
            ? 'Product exists in catalog' 
            : 'Unknown product - not found in order history'
        }
      });

    } catch (error: any) {
      logger.error('Failed to validate product', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate product',
        message: error.message
      });
    }
  }
);

// Validate multiple products (for bulk checking)
router.post('/products/validate-batch',
  [
    body('products').isArray().withMessage('Products must be an array'),
    body('products.*.product_name').notEmpty().withMessage('Product name is required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    try {
      const { products } = req.body;

      const validationResults = await Promise.all(
        products.map(async (product: any) => {
          const query = 'SELECT is_valid_product($1) as is_valid';
          const result = await executeQuery(query, [product.product_name]);
          const isValid = result.rows[0]?.is_valid || false;

          return {
            product_name: product.product_name,
            quantity: product.quantity,
            is_valid: isValid
          };
        })
      );

      const unknownProducts = validationResults.filter(p => !p.is_valid);
      const validProducts = validationResults.filter(p => p.is_valid);

      res.json({
        success: true,
        data: {
          total: products.length,
          valid_count: validProducts.length,
          unknown_count: unknownProducts.length,
          valid_products: validProducts,
          unknown_products: unknownProducts,
          has_unknown: unknownProducts.length > 0
        }
      });

    } catch (error: any) {
      logger.error('Failed to validate products batch', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate products',
        message: error.message
      });
    }
  }
);

// Resolve a product alert
router.patch('/product-alerts/:id/resolve',
  [
    param('id').isUUID().withMessage('Alert ID must be a valid UUID'),
    body('resolution_notes').optional().isString()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    try {
      const { id } = req.params;
      const { resolution_notes } = req.body;
      const resolved_by = (req as any).user?.username || 'system';

      const query = `
        UPDATE product_alerts
        SET 
          is_resolved = TRUE,
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = $2,
          resolution_notes = $3
        WHERE id = $1
        RETURNING *
      `;

      const result = await executeQuery(query, [id, resolved_by, resolution_notes]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Alert resolved successfully'
      });

    } catch (error: any) {
      logger.error('Failed to resolve alert', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resolve alert',
        message: error.message
      });
    }
  }
);

// Get unknown products from a predicted order
router.post('/products/check-prediction',
  [
    body('items').isArray().withMessage('Items must be an array')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    try {
      const { items } = req.body;

      const query = 'SELECT * FROM get_unknown_products($1::jsonb)';
      const result = await executeQuery(query, [JSON.stringify(items)]);

      const unknownProducts = result.rows.filter((r: any) => r.is_unknown);
      const validProducts = result.rows.filter((r: any) => !r.is_unknown);

      res.json({
        success: true,
        data: {
          total_items: result.rows.length,
          valid_count: validProducts.length,
          unknown_count: unknownProducts.length,
          unknown_products: unknownProducts,
          valid_products: validProducts,
          requires_attention: unknownProducts.length > 0,
          alert_message: unknownProducts.length > 0 
            ? `${unknownProducts.length} unknown product(s) detected. These items have never been ordered before.`
            : 'All products are valid and exist in order history'
        }
      });

    } catch (error: any) {
      logger.error('Failed to check prediction products', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check prediction',
        message: error.message
      });
    }
  }
);

// Get validation system status
router.get('/validation/status', async (req: Request, res: Response) => {
  try {
    const statusQuery = 'SELECT * FROM validation_statistics';
    const statusResult = await executeQuery(statusQuery);

    const configQuery = 'SELECT * FROM system_config ORDER BY key';
    const configResult = await executeQuery(configQuery);

    res.json({
      success: true,
      data: {
        status: statusResult.rows[0],
        configuration: configResult.rows
      }
    });

  } catch (error: any) {
    logger.error('Failed to fetch validation status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation status',
      message: error.message
    });
  }
});

// Update validation mode
router.patch('/validation/mode',
  [
    body('mode').isIn(['learning', 'strict', 'off']).withMessage('Invalid mode')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    try {
      const { mode } = req.body;
      
      const query = `
        UPDATE system_config 
        SET value = $1, updated_at = CURRENT_TIMESTAMP
        WHERE key = 'product_validation_mode'
        RETURNING *
      `;
      
      await executeQuery(query, [mode]);

      // Revalidate all predictions if switching to strict mode
      if (mode === 'strict') {
        await executeQuery('SELECT * FROM revalidate_all_predictions()');
      }

      res.json({
        success: true,
        message: `Validation mode updated to ${mode}`,
        data: { mode }
      });

    } catch (error: any) {
      logger.error('Failed to update validation mode', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update validation mode',
        message: error.message
      });
    }
  }
);

// Revalidate all predictions
router.post('/validation/revalidate', async (req: Request, res: Response) => {
  try {
    const query = 'SELECT * FROM revalidate_all_predictions()';
    const result = await executeQuery(query);

    res.json({
      success: true,
      message: 'All predictions revalidated',
      data: {
        predictions_validated: result.rows.length,
        results: result.rows
      }
    });

  } catch (error: any) {
    logger.error('Failed to revalidate predictions', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revalidate predictions',
      message: error.message
    });
  }
});

// Learn products from a specific order
router.post('/orders/:id/learn-products',
  [
    param('id').isUUID().withMessage('Order ID must be a valid UUID')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    try {
      const { id } = req.params;
      
      const query = 'SELECT * FROM learn_products_from_order($1::uuid)';
      const result = await executeQuery(query, [id]);

      res.json({
        success: true,
        message: 'Products learned from order',
        data: {
          order_id: id,
          products_learned: result.rows
        }
      });

    } catch (error: any) {
      logger.error('Failed to learn products from order', error);
      res.status(500).json({
        success: false,
        error: 'Failed to learn products',
        message: error.message
      });
    }
  }
);

export { router as productAlertsRoutes };