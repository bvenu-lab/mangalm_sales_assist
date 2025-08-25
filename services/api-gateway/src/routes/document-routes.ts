import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
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

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/bmp', 'text/plain', 'text/html', 'application/octet-stream'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

// Mock OCR results storage
const ocrJobs = new Map<string, any>();

// Helper function to create a mock order from uploaded document
async function createOrderFromDocument(documentId: string, fileName: string, storeId?: string) {
  try {
    // Generate mock order data (in production, this would come from OCR)
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
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
        productName: "Samosa (Premium)",
        productCode: "SAM-001",
        unit: "pieces",
        quantity: 100,
        unitPrice: 12,
        totalPrice: 1200
      },
      {
        productName: "Kachori (Spicy)",
        productCode: "KAC-002", 
        unit: "pieces",
        quantity: 50,
        unitPrice: 10,
        totalPrice: 500
      },
      {
        productName: "Bhel Puri Mix",
        productCode: "BHE-003",
        unit: "kg",
        quantity: 5,
        unitPrice: 180,
        totalPrice: 900
      }
    ];
    
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = Math.round((subtotal * 0.18) * 100) / 100; // 18% GST with proper rounding to 2 decimal places
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100; // Ensure 2 decimal precision
    
    // Insert order into database
    const orderQuery = `
      INSERT INTO orders (
        order_number, store_id, customer_name, customer_phone, customer_email,
        items, item_count, total_quantity, subtotal_amount, tax_amount, 
        total_amount, totals, created_by, extraction_confidence, 
        data_quality_score, manual_verification_required, source, status,
        order_date, source_id, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *`;
    
    const orderValues = [
      orderNumber,
      actualStoreId,
      'Document Upload Customer',
      '+91-9876543210',
      'customer@example.com',
      JSON.stringify(items),
      items.length,
      items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      taxAmount,
      totalAmount,
      JSON.stringify({ subtotal, taxAmount, total: totalAmount }),
      'document-upload',
      0.95,
      0.92,
      false,
      'document',
      'pending_review',
      orderDate,
      documentId, // Use source_id to store document ID
      `Created from uploaded document: ${fileName}`
    ];
    
    const result = await pool.query(orderQuery, orderValues);
    logger.info('Order created from document', {
      orderId: result.rows[0].id,
      orderNumber: result.rows[0].order_number,
      documentId
    });
    
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create order from document:', error);
    throw error;
  }
}

// Upload document endpoint
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const documentId = uuidv4();
    const storeId = req.body.storeId;
    
    logger.info('Document uploaded', {
      documentId,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      storeId
    });

    // Create an order from the uploaded document
    let order = null;
    try {
      order = await createOrderFromDocument(documentId, req.file.originalname, storeId);
      logger.info('Order created successfully from uploaded document');
    } catch (orderError) {
      logger.error('Failed to create order, but document was uploaded:', orderError);
    }

    res.json({
      success: true,
      data: {
        documentId,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        status: 'uploaded',
        uploadedAt: new Date().toISOString(),
        orderId: order?.id,
        orderNumber: order?.order_number
      },
      message: order 
        ? `Document uploaded and order ${order.order_number} created successfully`
        : 'Document uploaded successfully'
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Upload failed'
    });
  }
});

// Start OCR processing endpoint
router.post('/ocr/process', async (req: Request, res: Response) => {
  try {
    const { documentId, engine = 'tesseract' } = req.body;
    
    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DOCUMENT_ID',
          message: 'Document ID is required'
        }
      });
    }

    const ocrJobId = uuidv4();
    
    // Store mock OCR job
    ocrJobs.set(ocrJobId, {
      documentId,
      status: 'processing',
      engine,
      startedAt: new Date().toISOString()
    });

    // Simulate OCR completion after 2 seconds
    setTimeout(() => {
      const job = ocrJobs.get(ocrJobId);
      if (job) {
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        job.extractedText = 'Sample extracted text from the document';
        job.confidence = 0.95;
        job.qualityScore = 0.92;
      }
    }, 2000);

    res.json({
      success: true,
      data: {
        ocrJobId,
        status: 'processing',
        correlationId: req.body.correlationId || uuidv4(),
        estimatedProcessingTime: 2000
      },
      message: 'OCR processing started'
    });
  } catch (error) {
    logger.error('OCR processing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'OCR_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'OCR processing failed'
      }
    });
  }
});

// Get OCR job status endpoint
router.get('/ocr/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = ocrJobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'OCR job not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        ocrJobId: jobId,
        status: job.status,
        extractedText: job.extractedText,
        confidence: job.confidence,
        qualityScore: job.qualityScore,
        processingTime: job.completedAt ? 2000 : undefined,
        engineUsed: job.engine
      }
    });
  } catch (error) {
    logger.error('Get OCR status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get OCR status'
      }
    });
  }
});

// Health check endpoint
router.get('/ocr/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'document-processing',
      timestamp: new Date().toISOString()
    }
  });
});

export { router as documentRoutes };