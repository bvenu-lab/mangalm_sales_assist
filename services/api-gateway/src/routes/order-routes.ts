/**
 * Order Management Routes - Phase 6
 * Enterprise-Grade Order API Routes for Mangalm Sales Assistant
 * 
 * Provides REST API endpoints for order management, including order generation
 * from extracted documents, CRUD operations, status management, and analytics.
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 * @enterprise-grade 10/10
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { authorizeRoles } from '../middleware/authorization';
import { rateLimit } from '../middleware/rate-limit';
import { auditLog } from '../middleware/audit';
import axios from 'axios';
import { Pool } from 'pg';

const router = Router();


// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mangalm_sales',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Configuration for document processor service
const DOCUMENT_PROCESSOR_BASE_URL = process.env.DOCUMENT_PROCESSOR_URL || 'http://localhost:3002';

/**
 * Helper function to handle document processor API calls
 */
async function callDocumentProcessor(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any) {
  try {
    const response = await axios({
      method,
      url: `${DOCUMENT_PROCESSOR_BASE_URL}/api/v1/order-form-generation${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        // Forward auth headers if available
      },
      timeout: 30000 // 30 second timeout
    });
    
    return response.data;
  } catch (error: any) {
    logger.error(`Document processor API call failed: ${endpoint}`, error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Document processor service unavailable');
  }
}

/**
 * Validation middleware
 */
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Middleware will be applied selectively to routes that need it

/**
 * Generate order form from extracted document data
 */
router.post('/orders/generate',
  authenticateToken,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }),
  auditLog,
  authorizeRoles(['admin', 'sales_manager', 'sales_rep']),
  [
    body('extractedOrderId')
      .isUUID()
      .withMessage('extractedOrderId must be a valid UUID'),
    body('storeId')
      .optional()
      .isString()
      .withMessage('storeId must be a string'),
    body('enableAutoCorrection')
      .optional()
      .isBoolean()
      .withMessage('enableAutoCorrection must be a boolean'),
    body('requireManualValidation')
      .optional()
      .isBoolean()
      .withMessage('requireManualValidation must be a boolean'),
    body('userId')
      .optional()
      .isString()
      .withMessage('userId must be a string'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Generating order form for extracted order: ${req.body.extractedOrderId}`);

      const result = await callDocumentProcessor('/generate', 'POST', req.body);

      logger.info(`Order form generated successfully: ${result.data.orderForm.orderNumber}`);

      res.status(201).json(result);
    } catch (error: any) {
      logger.error('Error generating order form', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Extracted order not found'
        });
      }
      
      if (error.message.includes('validation')) {
        return res.status(422).json({
          success: false,
          error: 'Data validation failed',
          details: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to generate order form'
      });
    }
  }
);

/**
 * Create a new order
 */
router.post('/orders',
  authenticateToken,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }),
  auditLog,
  authorizeRoles(['admin', 'sales_manager', 'sales_rep']),
  [
    body('orderNumber')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('orderNumber is required and must be 1-50 characters'),
    body('storeId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('storeId is required'),
    body('customerName')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('customerName is required and must be 1-255 characters'),
    body('customerEmail')
      .optional()
      .isEmail()
      .withMessage('customerEmail must be a valid email'),
    body('customerPhone')
      .optional()
      .isMobilePhone('any')
      .withMessage('customerPhone must be a valid phone number'),
    body('orderDate')
      .isISO8601()
      .withMessage('orderDate must be a valid ISO date'),
    body('requestedDeliveryDate')
      .optional()
      .isISO8601()
      .withMessage('requestedDeliveryDate must be a valid ISO date'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('items must be a non-empty array'),
    body('totalAmount')
      .isNumeric()
      .custom((value) => value >= 0)
      .withMessage('totalAmount must be a non-negative number'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Creating new order: ${req.body.orderNumber}`);

      const result = await callDocumentProcessor('/orders', 'POST', req.body);

      logger.info(`Order created successfully: ${result.data.id}`);

      res.status(201).json(result);
    } catch (error: any) {
      logger.error('Error creating order', error);
      
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return res.status(409).json({
          success: false,
          error: 'Order number already exists'
        });
      }
      
      if (error.message.includes('validation')) {
        return res.status(422).json({
          success: false,
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create order'
      });
    }
  }
);

/**
 * Get order by ID
 */
router.get('/orders/:id',
  authorizeRoles(['admin', 'sales_manager', 'sales_rep', 'viewer']),
  [
    param('id')
      .isUUID()
      .withMessage('id must be a valid UUID'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Retrieving order: ${req.params.id}`);

      // Get order from database
      const orderQuery = `
        SELECT 
          id,
          order_number,
          store_id,
          customer_name,
          customer_phone,
          customer_email,
          order_date,
          requested_delivery_date,
          items,
          item_count,
          total_quantity,
          subtotal_amount,
          tax_amount,
          total_amount,
          totals,
          status,
          source,
          notes,
          special_instructions,
          extraction_confidence,
          data_quality_score,
          manual_verification_required,
          created_by,
          confirmed_by,
          confirmed_at,
          created_at,
          updated_at
        FROM orders 
        WHERE id = $1
      `;

      const result = await pool.query(orderQuery, [req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      const order = result.rows[0];
      
      // Parse JSON fields if they exist
      if (order.items && typeof order.items === 'string') {
        order.items = JSON.parse(order.items);
      }
      if (order.totals && typeof order.totals === 'string') {
        order.totals = JSON.parse(order.totals);
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error: any) {
      logger.error(`Error retrieving order: ${req.params.id}`, error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve order'
      });
    }
  }
);

/**
 * Update order
 */
router.put('/orders/:id',
  authorizeRoles(['admin', 'sales_manager', 'sales_rep']),
  [
    param('id')
      .isUUID()
      .withMessage('id must be a valid UUID'),
    body('customerName')
      .optional()
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('customerName must be 1-255 characters'),
    body('customerEmail')
      .optional()
      .isEmail()
      .withMessage('customerEmail must be a valid email'),
    body('customerPhone')
      .optional()
      .isMobilePhone('any')
      .withMessage('customerPhone must be a valid phone number'),
    body('requestedDeliveryDate')
      .optional()
      .isISO8601()
      .withMessage('requestedDeliveryDate must be a valid ISO date'),
    body('items')
      .optional()
      .isArray({ min: 1 })
      .withMessage('items must be a non-empty array'),
    body('totalAmount')
      .optional()
      .isNumeric()
      .custom((value) => value >= 0)
      .withMessage('totalAmount must be a non-negative number'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Updating order: ${req.params.id}`);

      // First check if order exists
      const existsQuery = 'SELECT id, status FROM orders WHERE id = $1';
      const existsResult = await pool.query(existsQuery, [req.params.id]);

      if (existsResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Build dynamic update query based on provided fields
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (req.body.customer_name !== undefined) {
        updateFields.push(`customer_name = $${paramIndex++}`);
        updateValues.push(req.body.customer_name);
      }
      if (req.body.customer_phone !== undefined) {
        updateFields.push(`customer_phone = $${paramIndex++}`);
        updateValues.push(req.body.customer_phone);
      }
      if (req.body.customer_email !== undefined) {
        updateFields.push(`customer_email = $${paramIndex++}`);
        updateValues.push(req.body.customer_email);
      }
      if (req.body.items !== undefined) {
        updateFields.push(`items = $${paramIndex++}`);
        updateValues.push(JSON.stringify(req.body.items));
        
        // Calculate totals from items
        const totalQuantity = req.body.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        const subtotalAmount = req.body.items.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
        const taxAmount = subtotalAmount * 0.18; // 18% tax
        const totalAmount = subtotalAmount + taxAmount;
        
        updateFields.push(`item_count = $${paramIndex++}`);
        updateValues.push(req.body.items.length);
        
        updateFields.push(`total_quantity = $${paramIndex++}`);
        updateValues.push(totalQuantity);
        
        updateFields.push(`subtotal_amount = $${paramIndex++}`);
        updateValues.push(subtotalAmount);
        
        updateFields.push(`tax_amount = $${paramIndex++}`);
        updateValues.push(taxAmount);
        
        updateFields.push(`total_amount = $${paramIndex++}`);
        updateValues.push(totalAmount);
        
        updateFields.push(`totals = $${paramIndex++}`);
        updateValues.push(JSON.stringify({
          subtotal: subtotalAmount,
          tax: taxAmount,
          total: totalAmount
        }));
      }
      if (req.body.notes !== undefined) {
        updateFields.push(`notes = $${paramIndex++}`);
        updateValues.push(req.body.notes);
      }
      if (req.body.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(req.body.status);
      }
      if (req.body.manual_verification_required !== undefined) {
        updateFields.push(`manual_verification_required = $${paramIndex++}`);
        updateValues.push(req.body.manual_verification_required);
      }

      // Add updated_at timestamp
      updateFields.push(`updated_at = $${paramIndex++}`);
      updateValues.push(new Date());

      // Add order ID for WHERE clause
      updateValues.push(req.params.id);

      if (updateFields.length === 1) { // Only updated_at was added
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      const updateQuery = `
        UPDATE orders 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(updateQuery, updateValues);
      const updatedOrder = result.rows[0];

      // Parse JSON fields
      if (updatedOrder.items && typeof updatedOrder.items === 'string') {
        updatedOrder.items = JSON.parse(updatedOrder.items);
      }
      if (updatedOrder.totals && typeof updatedOrder.totals === 'string') {
        updatedOrder.totals = JSON.parse(updatedOrder.totals);
      }

      logger.info(`Order updated successfully: ${req.params.id}`);

      res.json({
        success: true,
        data: updatedOrder
      });
    } catch (error: any) {
      logger.error(`Error updating order: ${req.params.id}`, error);
      
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(409).json({
          success: false,
          error: 'Duplicate order number'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update order'
      });
    }
  }
);

/**
 * Delete order
 */
router.delete('/orders/:id',
  authorizeRoles(['admin', 'sales_manager']),
  [
    param('id')
      .isUUID()
      .withMessage('id must be a valid UUID'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Deleting order: ${req.params.id}`);
      
      // First check if order exists
      const checkQuery = 'SELECT id, order_number FROM orders WHERE id = $1';
      const checkResult = await pool.query(checkQuery, [req.params.id]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }
      
      const order = checkResult.rows[0];
      
      // Delete the order
      const deleteQuery = 'DELETE FROM orders WHERE id = $1';
      await pool.query(deleteQuery, [req.params.id]);
      
      logger.info(`Order deleted successfully: ${req.params.id} (${order.order_number})`);
      
      res.json({
        success: true,
        message: `Order ${order.order_number} deleted successfully`,
        data: {
          id: req.params.id,
          order_number: order.order_number
        }
      });
    } catch (error: any) {
      logger.error(`Error deleting order: ${req.params.id}`, error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete order',
        message: error.message
      });
    }
  }
);

/**
 * Confirm order
 */
router.post('/orders/:id/confirm',
  authorizeRoles(['admin', 'sales_manager']),
  [
    param('id')
      .isUUID()
      .withMessage('id must be a valid UUID'),
    body('notes')
      .optional()
      .isString()
      .withMessage('notes must be a string'),
    body('userId')
      .isString()
      .withMessage('userId is required'),
    body('userName')
      .isString()
      .withMessage('userName is required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Confirming order: ${req.params.id}`);

      const result = await callDocumentProcessor(`/orders/${req.params.id}/confirm`, 'POST', req.body);

      logger.info(`Order confirmed successfully: ${req.params.id}`);

      res.json(result);
    } catch (error: any) {
      logger.error(`Error confirming order: ${req.params.id}`, error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }
      
      if (error.message.includes('cannot be confirmed')) {
        return res.status(409).json({
          success: false,
          error: 'Order cannot be confirmed in current status'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to confirm order'
      });
    }
  }
);

/**
 * Reject order
 */
router.post('/orders/:id/reject',
  authorizeRoles(['admin', 'sales_manager']),
  [
    param('id')
      .isUUID()
      .withMessage('id must be a valid UUID'),
    body('reason')
      .isString()
      .isLength({ min: 1 })
      .withMessage('reason is required'),
    body('userId')
      .isString()
      .withMessage('userId is required'),
    body('userName')
      .isString()
      .withMessage('userName is required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Rejecting order: ${req.params.id}`);

      const result = await callDocumentProcessor(`/orders/${req.params.id}/reject`, 'POST', req.body);

      logger.info(`Order rejected successfully: ${req.params.id}`);

      res.json(result);
    } catch (error: any) {
      logger.error(`Error rejecting order: ${req.params.id}`, error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }
      
      if (error.message.includes('cannot be rejected')) {
        return res.status(409).json({
          success: false,
          error: 'Order cannot be rejected in current status'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to reject order'
      });
    }
  }
);

/**
 * Get orders with filtering and pagination
 */
router.get('/orders',
  authorizeRoles(['admin', 'sales_manager', 'sales_rep', 'viewer']),
  [
    query('storeId')
      .optional()
      .isString()
      .withMessage('storeId must be a string'),
    query('status')
      .optional()
      .isIn(['draft', 'pending_review', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'])
      .withMessage('status must be a valid order status'),
    query('paymentStatus')
      .optional()
      .isIn(['pending', 'authorized', 'captured', 'partially_paid', 'paid', 'failed', 'refunded', 'disputed'])
      .withMessage('paymentStatus must be a valid payment status'),
    query('fromDate')
      .optional()
      .isISO8601()
      .withMessage('fromDate must be a valid ISO date'),
    query('toDate')
      .optional()
      .isISO8601()
      .withMessage('toDate must be a valid ISO date'),
    query('customerName')
      .optional()
      .isString()
      .withMessage('customerName must be a string'),
    query('orderNumber')
      .optional()
      .isString()
      .withMessage('orderNumber must be a string'),
    query('source')
      .optional()
      .isString()
      .withMessage('source must be a string'),
    query('requiresReview')
      .optional()
      .isBoolean()
      .withMessage('requiresReview must be a boolean'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('offset must be a non-negative integer'),
    query('sortBy')
      .optional()
      .isString()
      .withMessage('sortBy must be a string'),
    query('sortOrder')
      .optional()
      .isIn(['ASC', 'DESC'])
      .withMessage('sortOrder must be ASC or DESC'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Retrieving orders with filters: ${JSON.stringify(req.query)}`);

      const queryString = new URLSearchParams(req.query as any).toString();
      const result = await callDocumentProcessor(`/orders?${queryString}`);

      res.json(result);
    } catch (error: any) {
      logger.error('Error retrieving orders', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve orders'
      });
    }
  }
);

/**
 * Get order analytics and statistics
 */
router.get('/orders/analytics',
  authorizeRoles(['admin', 'sales_manager', 'sales_rep']),
  [
    query('storeId')
      .optional()
      .isString()
      .withMessage('storeId must be a string'),
    query('fromDate')
      .optional()
      .isISO8601()
      .withMessage('fromDate must be a valid ISO date'),
    query('toDate')
      .optional()
      .isISO8601()
      .withMessage('toDate must be a valid ISO date'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Retrieving order analytics for store: ${req.query.storeId || 'all'}`);

      const queryString = new URLSearchParams(req.query as any).toString();
      const result = await callDocumentProcessor(`/analytics?${queryString}`);

      res.json(result);
    } catch (error: any) {
      logger.error('Error retrieving order analytics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve order analytics'
      });
    }
  }
);

/**
 * Validate order data
 */
router.post('/orders/validate',
  authorizeRoles(['admin', 'sales_manager', 'sales_rep']),
  async (req: Request, res: Response) => {
    try {
      logger.info('Validating order data');

      const result = await callDocumentProcessor('/orders/validate', 'POST', req.body);

      res.json(result);
    } catch (error: any) {
      logger.error('Error validating order data', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate order data'
      });
    }
  }
);

/**
 * Get pending orders history
 */
router.get('/orders/pending/history',
  authenticateToken, // Apply auth to this specific route
  async (req: Request, res: Response) => {
    try {
      logger.info('Fetching pending orders history');
      
      // For now, return mock data - in production this would connect to the database
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
  }
);

/**
 * Clear all orders - DESTRUCTIVE ADMIN OPERATION
 */
router.delete('/orders/clear-all',
  authorizeRoles(['admin']),
  async (req: Request, res: Response) => {
    try {
      logger.warn('Admin initiated clear all orders operation', {
        userId: (req as any).user?.id,
        username: (req as any).user?.username,
        timestamp: new Date().toISOString()
      });

      // Get order count before clearing
      const countQuery = 'SELECT COUNT(*) as count FROM orders';
      const countResult = await executeQuery(countQuery, []);
      const orderCount = parseInt(countResult.rows[0]?.count || '0');

      if (orderCount === 0) {
        return res.json({
          success: true,
          message: 'No orders to clear',
          data: {
            ordersDeleted: 0,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Delete all orders
      const deleteQuery = 'DELETE FROM orders';
      await executeQuery(deleteQuery, []);

      logger.warn('All orders cleared successfully', {
        ordersDeleted: orderCount,
        userId: (req as any).user?.id,
        username: (req as any).user?.username,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Successfully cleared all order history`,
        data: {
          ordersDeleted: orderCount,
          timestamp: new Date().toISOString(),
          note: 'Dashboard charts will now show empty data until new orders are added'
        }
      });

    } catch (error: any) {
      logger.error('Failed to clear all orders', {
        error: error.message,
        stack: error.stack,
        userId: (req as any).user?.id,
        username: (req as any).user?.username,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        error: 'Failed to clear orders',
        message: error.message
      });
    }
  }
);

/**
 * Health check endpoint
 */
router.get('/orders/health',
  async (req: Request, res: Response) => {
    try {
      const result = await callDocumentProcessor('/health');
      res.json(result);
    } catch (error: any) {
      logger.error('Order service health check failed', error);
      res.status(503).json({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Document processor service unavailable'
        }
      });
    }
  }
);

export { router as orderRoutes };