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
import multer from 'multer';
import csv from 'csv-parse';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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
    fileSize: 5 * 1024 * 1024, // 5MB limit
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

// Clear all orders route temporarily removed for GCP deployment

/**
 * Import orders from CSV/Excel file
 */
router.post('/orders/import',
  authenticateToken,
  upload.single('file'),
  async (req: Request, res: Response) => {
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
        const parser = csv.parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        });

        orders = await new Promise((resolve, reject) => {
          const results: any[] = [];
          parser.on('data', (data) => results.push(data));
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

      res.status(500).json({
        success: false,
        error: 'Import failed',
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