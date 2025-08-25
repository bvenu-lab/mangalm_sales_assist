import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = Router();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mangalm_sales',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Test endpoint to create order
router.post('/create-order', async (req: Request, res: Response) => {
  try {
    const { storeId, fileName } = req.body;
    
    const orderNumber = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const orderDate = new Date();
    
    // Use provided storeId or select a random store
    let actualStoreId = storeId;
    if (!actualStoreId) {
      const storesResult = await pool.query('SELECT id FROM stores LIMIT 1');
      if (storesResult.rows.length > 0) {
        actualStoreId = storesResult.rows[0].id;
      }
    }
    
    // Mock items for the order
    const items = [
      {
        productName: "Test Product 1",
        productCode: "TEST-001",
        unit: "pieces",
        quantity: 10,
        unitPrice: 100,
        totalPrice: 1000
      }
    ];
    
    const subtotal = 1000;
    const taxAmount = 180;
    const totalAmount = 1180;
    
    // Insert order into database
    const orderQuery = `
      INSERT INTO orders (
        order_number, store_id, customer_name, customer_phone, customer_email,
        items, item_count, total_quantity, subtotal_amount, tax_amount, 
        total_amount, totals, created_by, extraction_confidence, 
        data_quality_score, manual_verification_required, source, status,
        order_date, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING id, order_number`;
    
    const orderValues = [
      orderNumber,
      actualStoreId,
      'Test Upload Customer',
      '+91-9999999999',
      'test@example.com',
      JSON.stringify(items),
      items.length,
      10,
      subtotal,
      taxAmount,
      totalAmount,
      JSON.stringify({ subtotal, taxAmount, total: totalAmount }),
      'test-upload',
      0.95,
      0.92,
      false,
      'test',
      'pending',
      orderDate,
      `Test order created from upload: ${fileName || 'test'}`
    ];
    
    const result = await pool.query(orderQuery, orderValues);
    
    res.json({
      success: true,
      data: {
        orderId: result.rows[0].id,
        orderNumber: result.rows[0].order_number,
        message: 'Test order created successfully'
      }
    });
  } catch (error) {
    logger.error('Test order creation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create test order'
    });
  }
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'Test upload routes working' });
});

export { router as testUploadRoutes };