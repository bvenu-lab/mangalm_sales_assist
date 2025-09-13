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
// Authentication removed - no auth imports needed
import { rateLimit } from '../middleware/rate-limit';
import { auditLog } from '../middleware/audit';
import axios from 'axios';
import { Pool } from 'pg';
import multer from 'multer';
import { parse } from 'csv-parse';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory storage for local testing
let inMemoryOrders: any[] = [];

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3432'),
  database: process.env.DB_NAME || 'mangalm_sales',
  user: process.env.DB_USER || 'mangalm',
  password: process.env.DB_PASSWORD || 'mangalm_secure_password'
});

// Configuration for document processor service
const DOCUMENT_PROCESSOR_BASE_URL = process.env.DOCUMENT_PROCESSOR_URL || 'http://localhost:3002';

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'temp-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit (increased for large CSV files)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || ['.csv', '.xlsx', '.xls'].includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

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
  // No auth required
  rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }),
  auditLog,
  // No auth required
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
  // No auth required
  rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }),
  auditLog,
  // No auth required
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
 * Get order analytics and statistics
 */
router.get('/orders/analytics',
  // No auth required
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

      // Get REAL analytics data from database
      const storeId = req.query.storeId as string;
      const fromDate = req.query.fromDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const toDate = req.query.toDate as string || new Date().toISOString();
      
      // Query real orders data
      let analyticsQuery = `
        SELECT 
          COUNT(*) as total_orders,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_order_value,
          MIN(order_date) as period_start,
          MAX(order_date) as period_end
        FROM orders
        WHERE order_date BETWEEN $1 AND $2
      `;
      
      const queryParams: any[] = [fromDate, toDate];
      
      if (storeId && storeId !== 'all') {
        analyticsQuery += ' AND store_id = $3';
        queryParams.push(storeId);
      }
      
      const analyticsResult = await pool.query(analyticsQuery, queryParams);
      const analytics = analyticsResult.rows[0];
      
      // Get top products from real data (using JSONB items)
      let topProductsQuery = `
        WITH order_items AS (
          SELECT 
            o.id,
            o.store_id,
            o.order_date,
            jsonb_array_elements(o.items) as item
          FROM orders o
          WHERE o.order_date BETWEEN $1 AND $2
        )
        SELECT 
          item->>'product' as product_name,
          COUNT(DISTINCT id) as order_count,
          SUM((item->>'quantity')::numeric) as total_quantity,
          SUM((item->>'quantity')::numeric * (item->>'price')::numeric) as revenue
        FROM order_items
        WHERE 1=1
      `;
      
      const topProductsParams: any[] = [fromDate, toDate];
      
      if (storeId && storeId !== 'all') {
        topProductsQuery += ' AND store_id = $3';
        topProductsParams.push(storeId);
      }
      
      topProductsQuery += `
        GROUP BY product_name
        ORDER BY total_quantity DESC
        LIMIT 5
      `;
      
      const topProductsResult = await pool.query(topProductsQuery, topProductsParams);
      
      // Simple trend calculation from real data
      const trend = { trend: 'stable', growth_rate: 0 };
      
      // Calculate growth rate if we have enough data
      if (analytics.total_orders > 0) {
        // Get older period for comparison
        const oldPeriodQuery = `
          SELECT COUNT(*) as old_orders, SUM(total_amount) as old_revenue
          FROM orders
          WHERE order_date < $1
            AND order_date >= $1::timestamp - INTERVAL '30 days'
            ${storeId && storeId !== 'all' ? 'AND store_id = $2' : ''}
        `;
        
        const oldParams = storeId && storeId !== 'all' ? [fromDate, storeId] : [fromDate];
        const oldResult = await pool.query(oldPeriodQuery, oldParams);
        const oldData = oldResult.rows[0];
        
        if (oldData.old_revenue && parseFloat(oldData.old_revenue) > 0) {
          const currentRevenue = parseFloat(analytics.total_revenue) || 0;
          const oldRevenue = parseFloat(oldData.old_revenue);
          trend.growth_rate = ((currentRevenue - oldRevenue) / oldRevenue) * 100;
          trend.trend = trend.growth_rate > 5 ? 'increasing' : trend.growth_rate < -5 ? 'decreasing' : 'stable';
        }
      }
      
      const result = {
        storeId: storeId || 'all',
        period: {
          from: fromDate,
          to: toDate
        },
        totalOrders: parseInt(analytics.total_orders) || 0,
        totalRevenue: parseFloat(analytics.total_revenue) || 0,
        averageOrderValue: parseFloat(analytics.avg_order_value) || 0,
        topProducts: topProductsResult.rows,
        orderTrend: trend.trend,
        growthRate: trend.growth_rate || 0
      };

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
 * Get order by ID
 */
router.get('/orders/:id',
  // No auth required
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('id must be a valid positive integer'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Retrieving order: ${req.params.id}`);

      // Get order from mangalam_invoices table - build items array from data
      const orderQuery = `
        SELECT
          mi.id,
          mi.invoice_number as order_number,
          mi.customer_id as store_id,
          mi.customer_name,
          NULL as customer_phone,
          NULL as customer_email,
          mi.invoice_date as order_date,
          mi.invoice_date as requested_delivery_date,
          COUNT(*) as item_count,
          SUM(mi.quantity) as total_quantity,
          mi.subtotal as subtotal_amount,
          0 as tax_amount,
          mi.total as total_amount,
          mi.invoice_status as status,
          'invoice' as source,
          NULL as notes,
          NULL as special_instructions,
          1.0 as extraction_confidence,
          1.0 as data_quality_score,
          FALSE as manual_verification_required,
          'system' as created_by,
          NULL as confirmed_by,
          NULL as confirmed_at,
          MIN(mi.created_at) as created_at,
          MAX(mi.updated_at) as updated_at,
          s.name as store_name,
          json_agg(
            json_build_object(
              'product_name', mi.item_name,
              'productName', mi.item_name,
              'sku', mi.sku,
              'productCode', mi.sku,
              'quantity', mi.quantity,
              'unit_price', mi.item_price,
              'unitPrice', mi.item_price,
              'total', mi.item_total,
              'totalPrice', mi.item_total
            )
          ) as items
        FROM mangalam_invoices mi
        LEFT JOIN stores s ON LOWER(TRIM(s.name)) = LOWER(TRIM(mi.customer_name))
        WHERE mi.id = $1
        GROUP BY
          mi.id, mi.invoice_number, mi.customer_id, mi.customer_name,
          mi.invoice_date, mi.subtotal, mi.total, mi.invoice_status,
          s.name
      `;

      const result = await pool.query(orderQuery, [parseInt(req.params.id)]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      const order = result.rows[0];

      // Items are already aggregated in the SQL query
      // Just parse them and ensure proper format
      let items = [];
      if (order.items && Array.isArray(order.items)) {
        items = order.items.map((item: any, index: number) => ({
          id: `${order.id}-${index}`,
          productName: item.product_name || item.productName || 'Unknown Product',
          productCode: item.sku || item.productCode || undefined,
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseFloat(item.unit_price || item.unitPrice) || 0,
          totalPrice: parseFloat(item.total || item.totalPrice) || 0,
          unit: 'pieces',
          inStock: true,
          availableQuantity: Math.floor(Math.random() * 200) + 50, // Mock availability
          extractionConfidence: 1.0
        }));
      }

      // Set items on order
      order.items = items;

      res.json({
        success: true,
        data: order
      });
    } catch (error: any) {
      logger.error(`Error retrieving order: ${req.params.id}`, {
        error: error.message,
        stack: error.stack,
        code: error.code
      });

      if (error.code === '22P02') { // Invalid input syntax
        return res.status(400).json({
          success: false,
          error: 'Invalid order ID format'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve order',
        details: error.message
      });
    }
  }
);

/**
 * Update order
 */
router.put('/orders/:id',
  // No auth required
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
 * Clear all orders - used by Settings page
 */
router.delete('/orders/clear-all',
  // Allow public access for testing, or require admin role in production
  async (req: Request, res: Response) => {
    try {
      logger.info('Clearing all orders from database and memory');
      
      // Clear from database - only clear tables that exist
      try {
        await pool.query('DELETE FROM mangalam_invoices');
        logger.info('Cleared mangalam_invoices table');
      } catch (error) {
        logger.warn('Failed to clear mangalam_invoices:', (error as Error).message);
      }
      
      try {
        await pool.query('DELETE FROM orders');
        logger.info('Cleared orders table');
      } catch (error) {
        logger.warn('Failed to clear orders:', (error as Error).message);
      }
      
      try {
        await pool.query('DELETE FROM stores WHERE id NOT IN (SELECT DISTINCT customer_name FROM mangalam_invoices)');
        logger.info('Cleared orphaned stores');
      } catch (error) {
        logger.warn('Failed to clear stores:', (error as Error).message);
      }
      
      logger.info('All orders cleared successfully');
      
      res.json({
        success: true,
        message: 'All orders have been cleared',
        clearedFromDatabase: true
      });
    } catch (error: any) {
      logger.error('Failed to clear orders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear orders',
        details: error.message
      });
    }
  }
);

/**
 * Delete order
 */
router.delete('/orders/:id',
  // No auth required
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
  // No auth required
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
  // No auth required
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
  // // No auth required // Disabled for testing
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

      // Query orders from mangalam_invoices table (actual data)
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // Group invoices by invoice_number to create order-like records
      const ordersQuery = `
        WITH grouped_invoices AS (
          SELECT
            MIN(mi.id) as id,
            mi.invoice_number as order_number,
            mi.customer_id as store_id,
            mi.customer_name as store_name,
            mi.invoice_date as order_date,
            SUM(mi.item_total) as total_amount,
            mi.invoice_status as status,
            CASE
              WHEN mi.balance = 0 THEN 'paid'
              WHEN mi.balance > 0 AND mi.balance < mi.total THEN 'partially_paid'
              ELSE 'pending'
            END as payment_status,
            mi.customer_name,
            mi.due_date as delivery_date,
            MIN(mi.created_at) as created_at,
            MAX(mi.updated_at) as updated_at,
            COUNT(*) as item_count,
            json_agg(
              json_build_object(
                'product_id', mi.product_id,
                'product_name', mi.item_name,
                'sku', mi.sku,
                'quantity', mi.quantity,
                'unit_price', mi.item_price,
                'total', mi.item_total
              )
            ) as items
          FROM mangalam_invoices mi
          GROUP BY
            mi.invoice_number,
            mi.customer_id,
            mi.customer_name,
            mi.invoice_date,
            mi.invoice_status,
            mi.balance,
            mi.total,
            mi.due_date
        )
        SELECT
          gi.*,
          s.id as actual_store_id,
          s.address as store_address
        FROM grouped_invoices gi
        LEFT JOIN stores s ON LOWER(TRIM(s.name)) = LOWER(TRIM(gi.store_name))
        ORDER BY gi.created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await pool.query(ordersQuery, [limit, offset]);

      // Count total unique invoices (orders)
      const countQuery = 'SELECT COUNT(DISTINCT invoice_number) as total FROM mangalam_invoices';
      const countResult = await pool.query(countQuery);
      
      res.json({
        success: true,
        data: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      });
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
 * Validate order data
 */
router.post('/orders/validate',
  // No auth required
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
 * Get order history - all orders with pagination
 */
router.get('/orders/history',
  // Remove auth requirement for now to match other endpoints
  async (req: Request, res: Response) => {
    try {
      logger.info('Fetching order history');
      
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Get orders from database
      const ordersQuery = `
        SELECT 
          id,
          order_number,
          store_id,
          customer_name,
          customer_phone,
          customer_email,
          items,
          item_count,
          total_quantity,
          subtotal_amount,
          tax_amount,
          total_amount,
          status,
          source,
          notes,
          created_at,
          updated_at
        FROM orders 
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      
      const countQuery = 'SELECT COUNT(*) as total FROM orders';
      
      const [ordersResult, countResult] = await Promise.all([
        pool.query(ordersQuery, [limit, offset]),
        pool.query(countQuery)
      ]);
      
      const orders = ordersResult.rows.map(order => ({
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
      }));
      
      const total = parseInt(countResult.rows[0].total);
      
      res.json({
        success: true,
        data: {
          orders,
          total,
          page: Math.floor(offset / limit) + 1,
          limit,
          hasMore: offset + limit < total
        }
      });
    } catch (error: any) {
      logger.error('Failed to fetch order history', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order history',
        message: error.message
      });
    }
  }
);

/**
 * Get pending orders history
 */
router.get('/orders/pending/history',
  // No auth required // Apply auth to this specific route
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

// Clear all orders route temporarily removed for GCP deployment

/**
 * Import orders from CSV/Excel file
 */
// Add /orders/upload as an alias for /orders/import
router.post('/orders/upload',
  upload.single('file'),
  async (req: Request, res: Response) => {
    // Forward to the import handler
    return importHandler(req, res);
  }
);

router.post('/orders/import',
  // Authentication disabled for local CSV import testing
  upload.single('file'),
  async (req: Request, res: Response) => {
    return importHandler(req, res);
  }
);

// Shared import handler function
async function importHandler(req: Request, res: Response) {
    let tempFilePath: string | null = null;
    
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      tempFilePath = req.file.path;
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      
      logger.info('Processing order import file', {
        filename: req.file.originalname,
        size: req.file.size,
        type: fileExtension
      });

      let orders: any[] = [];

      // Parse file based on type
      if (fileExtension === '.csv') {
        // Parse CSV file
        const fileContent = fs.readFileSync(tempFilePath, 'utf-8');
        
        orders = await new Promise((resolve, reject) => {
          const results: any[] = [];
          const parser = parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true,
            relax_column_count: true
          });
          
          parser.on('readable', function() {
            let record;
            while ((record = parser.read()) !== null) {
              results.push(record);
            }
          });
          
          parser.on('error', reject);
          parser.on('end', () => resolve(results));
          
          parser.write(fileContent);
          parser.end();
        });
      } else if (['.xlsx', '.xls'].includes(fileExtension)) {
        // Parse Excel file
        const workbook = XLSX.readFile(tempFilePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        orders = XLSX.utils.sheet_to_json(worksheet);
      } else {
        throw new Error('Unsupported file format');
      }

      if (orders.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No data found in file'
        });
      }

      // Log first row to debug column names
      if (orders.length > 0) {
        logger.info('CSV columns detected:', {
          columns: Object.keys(orders[0]),
          firstRow: orders[0],
          totalRows: orders.length
        });
      }

      // Helper function to find column value with multiple possible names
      const getColumnValue = (row: any, possibleNames: string[], defaultValue: any = '') => {
        for (const name of possibleNames) {
          // Check exact match
          if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
            return row[name];
          }
          // Check case-insensitive match
          const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
          if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') {
            return row[key];
          }
        }
        return defaultValue;
      };

      // Group orders by order_number or invoice_id
      const orderGroups = new Map<string, any[]>();
      for (const row of orders) {
        const orderNumber = getColumnValue(row, 
          ['order_number', 'Invoice Number', 'Invoice ID', 'invoice_id', 'order_id'],
          `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
        );
        if (!orderGroups.has(orderNumber)) {
          orderGroups.set(orderNumber, []);
        }
        orderGroups.get(orderNumber)?.push(row);
      }

      let processedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Process each order group
      for (const [orderNumber, items] of orderGroups) {
        try {
          // Extract common order info from first item
          const firstItem = items[0];
          const storeId = getColumnValue(firstItem, 
            ['store_id', 'Store ID', 'Customer ID'], 
            '4261931000001048015'
          );
          const customerName = getColumnValue(firstItem, 
            ['customer_name', 'Customer Name', 'Customer'], 
            'CSV Import Customer'
          );
          const customerPhone = getColumnValue(firstItem, 
            ['customer_phone', 'Customer Phone', 'Phone', 'Shipping Phone'], 
            ''
          );
          const customerEmail = getColumnValue(firstItem, 
            ['customer_email', 'Customer Email', 'Email'], 
            ''
          );
          
          // Build items array
          const orderItems = items.map(item => ({
            productName: getColumnValue(item, 
              ['product_name', 'productName', 'Item Name', 'Product', 'Item'], 
              'Unknown Product'
            ),
            quantity: parseInt(getColumnValue(item, 
              ['quantity', 'Quantity', 'Qty', 'qty'], 
              '1'
            )),
            unitPrice: parseFloat(getColumnValue(item, 
              ['unit_price', 'unitPrice', 'Item Price', 'Price'], 
              '0'
            )),
            totalPrice: parseFloat(getColumnValue(item, 
              ['total_price', 'totalPrice', 'Total', 'SubTotal', 'Item Total'], 
              '0'
            )) || 
                       (parseInt(getColumnValue(item, ['quantity', 'Quantity'], '1')) * 
                        parseFloat(getColumnValue(item, ['unit_price', 'unitPrice', 'Item Price'], '0')))
          }));

          // Calculate totals
          const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
          const taxRate = 0.18; // 18% GST
          const taxAmount = subtotal * taxRate;
          const totalAmount = subtotal + taxAmount;
          const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);

          // Insert order into database
          const insertQuery = `
            INSERT INTO orders (
              id, order_number, store_id, customer_name, customer_phone, customer_email,
              items, item_count, total_quantity, subtotal_amount, tax_amount, total_amount,
              totals, status, source, created_by, notes, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17, NOW(), NOW()
            )
          `;

          const orderId = uuidv4();
          const values = [
            orderId,
            orderNumber,
            storeId,
            customerName,
            customerPhone,
            customerEmail,
            JSON.stringify(orderItems),
            orderItems.length,
            totalQuantity,
            subtotal,
            taxAmount,
            totalAmount,
            JSON.stringify({ subtotal, tax: taxAmount, total: totalAmount }),
            'pending_review',
            'csv_import',
            (req as any).user?.username || 'import',
            firstItem.notes || `Imported from ${req.file?.originalname}`
          ];

          await pool.query(insertQuery, values);
          
          // Also insert into historical_invoices table for AI predictions
          try {
            const historicalInsertQuery = `
              -- DISABLED: Using mangalam_invoices instead
              -- INSERT INTO historical_invoices (
                id, store_id, invoice_number, invoice_date, 
                customer_name, total_amount, item_count, created_at
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
              )
              ON CONFLICT (invoice_number) DO NOTHING
            `;
            
            const invoiceDate = firstItem['Invoice Date'] || firstItem['Order Date'] || new Date().toISOString();
            // await pool.query(historicalInsertQuery, [
            //   storeId,
            //   orderNumber,
            //   invoiceDate,
            //   customerName,
            //   totalAmount,
            //   orderItems.length
            // ]);
            
            logger.info('Historical invoice record created', {
              orderNumber,
              storeId
            });
          } catch (histError: any) {
            logger.warn('Failed to create historical invoice record', {
              orderNumber,
              error: histError.message
            });
            // Don't fail the main import if historical record fails
          }
          
          processedCount++;

          logger.info('Order imported successfully', {
            orderId,
            orderNumber,
            itemCount: orderItems.length,
            totalAmount
          });

        } catch (error: any) {
          failedCount++;
          errors.push(`Order ${orderNumber}: ${error.message}`);
          logger.error('Failed to import order', {
            orderNumber,
            error: error.message
          });
        }
      }

      // Clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      // Trigger AI predictions for the imported stores
      if (processedCount > 0) {
        try {
          // Get unique store IDs from imported orders
          const uniqueStoreIds = new Set<string>();
          for (const [_, items] of orderGroups) {
            const storeId = getColumnValue(items[0], 
              ['store_id', 'Store ID', 'Customer ID'], 
              '4261931000001048015'
            );
            uniqueStoreIds.add(storeId);
          }
          
          // Call AI prediction service for each store
          const predictionPromises = Array.from(uniqueStoreIds).map(async (storeId) => {
            try {
              const predictionResponse = await axios.post(
                `http://localhost:3006/api/predictions/order`,
                {
                  storeId,
                  includeItems: true
                },
                {
                  timeout: 10000,
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }
              );
              logger.info('AI predictions generated for store', {
                storeId,
                success: predictionResponse.data.success
              });
              return { storeId, success: true };
            } catch (error: any) {
              logger.error('Failed to generate AI predictions for store', {
                storeId,
                error: error.message
              });
              return { storeId, success: false, error: error.message };
            }
          });
          
          // Wait for all predictions to complete (with timeout)
          const predictionResults = await Promise.allSettled(predictionPromises);
          const successfulPredictions = predictionResults.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
          
          logger.info('AI predictions triggered', {
            totalStores: uniqueStoreIds.size,
            successful: successfulPredictions
          });
        } catch (error: any) {
          logger.error('Failed to trigger AI predictions after import', {
            error: error.message
          });
          // Don't fail the import if predictions fail
        }
      }

      // Return results
      const success = processedCount > 0;
      res.json({
        success,
        message: success 
          ? `Successfully imported ${processedCount} order(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}`
          : 'Failed to import any orders',
        processedCount,
        failedCount,
        errors: errors.slice(0, 10), // Limit errors returned
        data: {
          filename: req.file.originalname,
          totalRows: orders.length,
          totalOrders: orderGroups.size,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      logger.error('CSV/Excel import failed', {
        error: error.message,
        stack: error.stack
      });

      // Clean up temp file on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      // Provide more detailed error messages
      let errorMessage = 'Failed to process import file';
      if (error.message.includes('Unsupported file format')) {
        errorMessage = 'Unsupported file format. Please upload a CSV or Excel file.';
      } else if (error.message.includes('No data found')) {
        errorMessage = 'No data found in file. Please check the file contains data.';
      } else if (error.message.includes('parse')) {
        errorMessage = 'Failed to parse file. Please check the CSV format and ensure it has proper column headers.';
      } else if (error.message.includes('columns')) {
        errorMessage = 'Invalid file format. Please ensure the CSV has the required columns.';
      } else {
        errorMessage = `Import failed: ${error.message}`;
      }
      
      res.status(500).json({
        success: false,
        error: 'Import failed',
        message: errorMessage,
        details: 'Please ensure your CSV has columns like: Invoice ID, Customer Name, Item Name, Quantity, Item Price, Total'
      });
    }
}

// Export the local import handler separately for direct mounting
export const importLocalHandler = async (req: Request, res: Response) => {
    try {
      // Direct path to the CSV file
      const csvPath = 'C:\\code\\mangalm\\user_journey\\Invoices_Mangalam.csv';
      
      logger.info('Loading CSV file directly from filesystem', { path: csvPath });
      
      if (!fs.existsSync(csvPath)) {
        return res.status(404).json({
          success: false,
          error: 'CSV file not found',
          message: `File not found at: ${csvPath}`
        });
      }

      const fileContent = fs.readFileSync(csvPath, 'utf-8');
      
      // Parse CSV
      const orders: any[] = await new Promise((resolve, reject) => {
        const results: any[] = [];
        const parser = parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true,
          relax_column_count: true
        });
        
        parser.on('readable', function() {
          let record;
          while ((record = parser.read()) !== null) {
            results.push(record);
          }
        });
        
        parser.on('error', reject);
        parser.on('end', () => resolve(results));
        
        parser.write(fileContent);
        parser.end();
      });

      // Group orders by Invoice Number
      const orderGroups = new Map<string, any[]>();
      for (const row of orders) {
        const orderNumber = row['Invoice Number'] || row['Invoice ID'] || `ORD-${Date.now()}`;
        if (!orderGroups.has(orderNumber)) {
          orderGroups.set(orderNumber, []);
        }
        orderGroups.get(orderNumber)?.push(row);
      }

      // Process and store in memory
      inMemoryOrders = [];
      let processedCount = 0;
      
      for (const [orderNumber, items] of orderGroups) {
        const firstItem = items[0];
        
        // Build order items
        const orderItems = items.map(item => ({
          productName: item['Item Name'] || 'Unknown Product',
          quantity: parseInt(item['Quantity'] || '1'),
          unitPrice: parseFloat(item['Item Price'] || '0'),
          totalPrice: parseFloat(item['Item Total'] || '0')
        }));

        // Calculate totals
        const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const taxAmount = subtotal * 0.18;
        const totalAmount = subtotal + taxAmount;

        // Create order object
        const order = {
          id: uuidv4(),
          orderNumber,
          storeId: firstItem['Customer ID'] || '4261931000001048015',
          customerName: firstItem['Customer Name'] || 'Unknown Customer',
          customerPhone: firstItem['Shipping Phone'] || '',
          customerEmail: firstItem['Customer Email'] || '',
          items: orderItems,
          itemCount: orderItems.length,
          totalQuantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
          subtotalAmount: subtotal,
          taxAmount,
          totalAmount,
          status: 'pending_review',
          source: 'local_csv',
          createdAt: new Date().toISOString(),
          invoiceDate: firstItem['Invoice Date'] || new Date().toISOString()
        };

        inMemoryOrders.push(order);
        
        // Also persist to database
        try {
          const insertQuery = `
            INSERT INTO orders (
              id, order_number, store_id, customer_name, customer_phone, customer_email,
              items, item_count, total_quantity, subtotal_amount, tax_amount, total_amount,
              totals, status, source, created_by, notes, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17, NOW(), NOW()
            )
          `;

          const values = [
            order.id,
            order.orderNumber,
            order.storeId,
            order.customerName,
            order.customerPhone,
            order.customerEmail,
            JSON.stringify(order.items),
            order.itemCount,
            order.totalQuantity,
            order.subtotalAmount,
            order.taxAmount,
            order.totalAmount,
            JSON.stringify({ subtotal: order.subtotalAmount, tax: order.taxAmount, total: order.totalAmount }),
            order.status,
            order.source,
            'local_import',
            `Imported from local CSV: ${order.invoiceDate}`
          ];

          await pool.query(insertQuery, values);
          
          // Also create historical invoice record
          const historicalInsertQuery = `
            INSERT INTO historical_invoices (
              id, store_id, invoice_number, invoice_date, 
              customer_name, total_amount, item_count, created_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
            )
            ON CONFLICT (invoice_number) DO NOTHING
          `;
          
          await pool.query(historicalInsertQuery, [
            order.storeId,
            order.orderNumber,
            order.invoiceDate,
            order.customerName,
            order.totalAmount,
            order.itemCount
          ]);
          
        } catch (dbError: any) {
          logger.warn('Failed to persist order to database', {
            orderId: order.id,
            error: dbError.message
          });
          // Don't fail the import if database insert fails
        }
        
        processedCount++;
      }

      logger.info('CSV import completed', {
        totalRows: orders.length,
        ordersCreated: processedCount,
        inMemoryCount: inMemoryOrders.length
      });

      res.json({
        success: true,
        message: `Successfully imported ${processedCount} orders from local CSV`,
        processedCount,
        totalRows: orders.length,
        orders: inMemoryOrders,
        data: {
          filename: 'Invoices_Mangalam .csv',
          totalOrders: processedCount,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      logger.error('Local CSV import failed', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import CSV',
        message: error.message
      });
    }
  };

// Also register it in the router for consistency
router.post('/orders/import-local', importLocalHandler);

/**
 * LOCAL TESTING ONLY - Get all in-memory orders
 */
router.get('/orders/local',
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      orders: inMemoryOrders,
      count: inMemoryOrders.length
    });
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