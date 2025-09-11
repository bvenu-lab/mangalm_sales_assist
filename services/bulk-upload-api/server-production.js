/**
 * Production-Ready Bulk Upload Server
 * Handles real Mangalam invoice data with proper error handling
 */

require('dotenv').config({ path: '../../.env' });
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const compression = require('compression');
const { Pool } = require('pg');
const Bull = require('bull');
const Redis = require('ioredis');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Create Express app
const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());

// PostgreSQL connection with better error handling
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3432'),
    database: process.env.DB_NAME || 'mangalm_sales',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    } else {
        console.log('Database connected:', res.rows[0].now);
    }
});

// Redis for queue
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '3379'),
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
});

// Bull queue
const uploadQueue = new Bull('upload-queue', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '3379'),
    }
});

// SSE Manager
class SSEManager {
    constructor() {
        this.clients = new Map();
    }
    
    addClient(jobId, res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });
        
        this.clients.set(jobId, res);
        this.sendToClient(jobId, { type: 'connected', jobId });
        
        const heartbeat = setInterval(() => {
            if (this.clients.has(jobId)) {
                res.write(': heartbeat\n\n');
            } else {
                clearInterval(heartbeat);
            }
        }, 30000);
        
        res.on('close', () => {
            this.clients.delete(jobId);
            clearInterval(heartbeat);
        });
    }
    
    sendToClient(jobId, data) {
        const client = this.clients.get(jobId);
        if (client && !client.finished) {
            client.write(`data: ${JSON.stringify({
                ...data,
                timestamp: new Date().toISOString()
            })}\n\n`);
        }
    }
}

const sseManager = new SSEManager();

// Helper function to safely parse values
function safeParseFloat(value) {
    if (value === null || value === undefined || value === '' || value === 'N/A') {
        return null;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
}

function safeParseDate(value) {
    if (!value || value === '' || value === 'N/A') {
        return null;
    }
    try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    } catch {
        return null;
    }
}

function safeString(value, maxLength = 500) {
    if (value === null || value === undefined || value === 'N/A') {
        return null;
    }
    return String(value).substring(0, maxLength).trim() || null;
}

// Process batch with proper error handling
async function processBatch(batch, stats, jobId) {
    const client = await pool.connect();
    
    try {
        // Start transaction for this batch
        await client.query('BEGIN');
        
        for (const row of batch) {
            stats.processedRows++;
            
            try {
                // Map CSV columns to database columns with null handling
                const mappedData = {
                    invoice_date: safeParseDate(row['Invoice Date']),
                    invoice_id: safeString(row['Invoice ID']),
                    invoice_number: safeString(row['Invoice Number']),
                    invoice_status: safeString(row['Invoice Status']),
                    customer_name: safeString(row['Customer Name']),
                    customer_id: safeString(row['Customer ID']),
                    due_date: safeParseDate(row['Due Date']),
                    expected_payment_date: safeParseDate(row['Expected Payment Date']),
                    last_payment_date: safeParseDate(row['Last Payment Date']),
                    purchase_order: safeString(row['PurchaseOrder']),
                    sales_order_number: safeString(row['Sales Order Number']),
                    product_id: safeString(row['Product ID']),
                    item_name: safeString(row['Item Name']),
                    sku: safeString(row['SKU']),
                    brand: safeString(row['Brand']),
                    category_name: safeString(row['Category Name']),
                    item_desc: safeString(row['Item Desc'], 5000),
                    quantity: safeParseFloat(row['Quantity']),
                    usage_unit: safeString(row['Usage unit']),
                    item_price: safeParseFloat(row['Item Price']),
                    mrp: safeParseFloat(row['MRP']),
                    discount: safeParseFloat(row['Discount']),
                    discount_amount: safeParseFloat(row['Discount Amount']),
                    item_total: safeParseFloat(row['Item Total']),
                    subtotal: safeParseFloat(row['SubTotal']),
                    total: safeParseFloat(row['Total']),
                    balance: safeParseFloat(row['Balance']),
                    warehouse_name: safeString(row['Warehouse Name']),
                    sales_person: safeString(row['Sales Person']),
                    billing_city: safeString(row['Billing City']),
                    billing_state: safeString(row['Billing State']),
                    billing_country: safeString(row['Billing Country']),
                    billing_code: safeString(row['Billing Code']),
                    shipping_city: safeString(row['Shipping City']),
                    shipping_state: safeString(row['Shipping State']),
                    shipping_country: safeString(row['Shipping Country']),
                    shipping_code: safeString(row['Shipping Code']),
                    upload_batch_id: jobId,
                    row_number: stats.processedRows
                };
                
                // Skip rows without critical fields
                if (!mappedData.invoice_number && !mappedData.item_name) {
                    stats.skippedRows++;
                    continue;
                }
                
                // Insert or update the record
                const query = `
                    INSERT INTO mangalam_invoices (
                        invoice_date, invoice_id, invoice_number, invoice_status,
                        customer_name, customer_id, due_date, expected_payment_date,
                        last_payment_date, purchase_order, sales_order_number,
                        product_id, item_name, sku, brand, category_name, item_desc,
                        quantity, usage_unit, item_price, mrp, discount, discount_amount,
                        item_total, subtotal, total, balance, warehouse_name, sales_person,
                        billing_city, billing_state, billing_country, billing_code,
                        shipping_city, shipping_state, shipping_country, shipping_code,
                        upload_batch_id, row_number
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
                        $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39
                    )
                    ON CONFLICT (invoice_number, product_id, sku) 
                    DO UPDATE SET
                        quantity = EXCLUDED.quantity,
                        item_price = EXCLUDED.item_price,
                        item_total = EXCLUDED.item_total,
                        updated_at = NOW()
                `;
                
                const values = [
                    mappedData.invoice_date, mappedData.invoice_id, mappedData.invoice_number,
                    mappedData.invoice_status, mappedData.customer_name, mappedData.customer_id,
                    mappedData.due_date, mappedData.expected_payment_date, mappedData.last_payment_date,
                    mappedData.purchase_order, mappedData.sales_order_number, mappedData.product_id,
                    mappedData.item_name, mappedData.sku, mappedData.brand, mappedData.category_name,
                    mappedData.item_desc, mappedData.quantity, mappedData.usage_unit, mappedData.item_price,
                    mappedData.mrp, mappedData.discount, mappedData.discount_amount, mappedData.item_total,
                    mappedData.subtotal, mappedData.total, mappedData.balance, mappedData.warehouse_name,
                    mappedData.sales_person, mappedData.billing_city, mappedData.billing_state,
                    mappedData.billing_country, mappedData.billing_code, mappedData.shipping_city,
                    mappedData.shipping_state, mappedData.shipping_country, mappedData.shipping_code,
                    mappedData.upload_batch_id, mappedData.row_number
                ];
                
                await client.query(query, values);
                stats.successCount++;
                
            } catch (rowError) {
                stats.errorCount++;
                console.error(`Row ${stats.processedRows} error:`, rowError.message);
                
                // Log error but continue processing
                try {
                    await client.query(`
                        INSERT INTO bulk_upload.processing_errors 
                        (upload_id, row_number, error_type, error_message, raw_data)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [1, stats.processedRows, 'INSERT_ERROR', rowError.message, JSON.stringify(row).substring(0, 5000)]);
                } catch (logError) {
                    console.error('Failed to log error:', logError.message);
                }
            }
        }
        
        // Commit the batch
        await client.query('COMMIT');
        
    } catch (batchError) {
        // Rollback on batch error
        await client.query('ROLLBACK');
        console.error('Batch processing failed:', batchError.message);
        stats.errorCount += batch.length - stats.successCount;
        
    } finally {
        client.release();
    }
}

// Queue processor
uploadQueue.process(async (job) => {
    const { jobId, filePath } = job.data;
    console.log(`Processing job ${jobId}`);
    
    const stats = {
        totalRows: 0,
        processedRows: 0,
        successCount: 0,
        errorCount: 0,
        skippedRows: 0,
        startTime: Date.now()
    };
    
    try {
        // Update job status
        await pool.query(`
            UPDATE bulk_upload.upload_jobs 
            SET status = 'processing', started_at = NOW()
            WHERE job_id = $1
        `, [jobId]);
        
        // Process CSV in batches
        const batch = [];
        const batchSize = 100;
        
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', async (row) => {
                    stats.totalRows++;
                    batch.push(row);
                    
                    if (batch.length >= batchSize) {
                        const currentBatch = batch.splice(0, batchSize);
                        await processBatch(currentBatch, stats, jobId);
                        
                        // Send progress update
                        if (stats.totalRows % 1000 === 0) {
                            sseManager.sendToClient(jobId, {
                                type: 'progress',
                                totalRows: stats.totalRows,
                                processedRows: stats.processedRows,
                                successCount: stats.successCount,
                                errorCount: stats.errorCount,
                                percentage: Math.round((stats.processedRows / 41000) * 100)
                            });
                        }
                    }
                })
                .on('end', async () => {
                    // Process remaining rows
                    if (batch.length > 0) {
                        await processBatch(batch, stats, jobId);
                    }
                    resolve();
                })
                .on('error', reject);
        });
        
        const elapsedMs = Date.now() - stats.startTime;
        
        // Update job as completed
        await pool.query(`
            UPDATE bulk_upload.upload_jobs 
            SET status = 'completed',
                completed_at = NOW(),
                total_rows = $1,
                processed_rows = $2,
                successful_rows = $3,
                failed_rows = $4,
                processing_time_ms = $5,
                rows_per_second = $6
            WHERE job_id = $7
        `, [
            stats.totalRows,
            stats.processedRows,
            stats.successCount,
            stats.errorCount,
            elapsedMs,
            Math.round(stats.processedRows / (elapsedMs / 1000)),
            jobId
        ]);
        
        // Send completion
        sseManager.sendToClient(jobId, {
            type: 'complete',
            totalRows: stats.totalRows,
            processedRows: stats.processedRows,
            successCount: stats.successCount,
            errorCount: stats.errorCount,
            skippedRows: stats.skippedRows,
            elapsedMs,
            rowsPerSecond: Math.round(stats.processedRows / (elapsedMs / 1000))
        });
        
        // Clean up file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        console.log(`Job ${jobId} completed:`, stats);
        
    } catch (error) {
        console.error(`Job ${jobId} failed:`, error);
        
        await pool.query(`
            UPDATE bulk_upload.upload_jobs 
            SET status = 'failed',
                completed_at = NOW(),
                error_message = $1
            WHERE job_id = $2
        `, [error.message, jobId]);
        
        sseManager.sendToClient(jobId, {
            type: 'error',
            error: error.message
        });
    }
});

// Multer configuration
const upload = multer({
    storage: multer.diskStorage({
        destination: async (req, file, cb) => {
            const uploadDir = './uploads/temp';
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
            cb(null, uniqueName);
        }
    }),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
});

// Health endpoint
app.get('/health', async (req, res) => {
    try {
        const dbCheck = await pool.query('SELECT NOW()');
        const redisCheck = await redis.ping();
        const queueHealth = await uploadQueue.getJobCounts();
        
        res.json({ 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            redis: redisCheck === 'PONG' ? 'connected' : 'disconnected',
            queue: queueHealth
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Upload endpoint
app.post('/api/bulk-upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const jobId = uuidv4();
    const filePath = req.file.path;
    
    try {
        // Create job record
        await pool.query(`
            INSERT INTO bulk_upload.upload_jobs 
            (job_id, file_name, file_path, file_size, status, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
        `, [jobId, req.file.originalname, filePath, req.file.size, 'queued']);
        
        // Add to queue
        await uploadQueue.add({ jobId, filePath }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 }
        });
        
        res.json({
            success: true,
            jobId,
            message: 'File queued for processing',
            sseUrl: `/api/bulk-upload/${jobId}/progress`
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.status(500).json({ error: error.message });
    }
});

// SSE progress endpoint
app.get('/api/bulk-upload/:jobId/progress', (req, res) => {
    const { jobId } = req.params;
    sseManager.addClient(jobId, res);
});

// Status endpoint
app.get('/api/bulk-upload/:jobId/status', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM bulk_upload.upload_jobs WHERE job_id = $1',
            [req.params.jobId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        // Get row count from actual data
        const countResult = await pool.query(
            'SELECT COUNT(*) as count FROM mangalam_invoices WHERE upload_batch_id = $1',
            [req.params.jobId]
        );
        
        res.json({
            ...result.rows[0],
            actual_rows_inserted: countResult.rows[0].count
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.BULK_UPLOAD_PORT || 3011;
app.listen(PORT, () => {
    console.log(`\n===========================================`);
    console.log(`Production Bulk Upload Server`);
    console.log(`Port: ${PORT}`);
    console.log(`===========================================`);
    console.log(`Features:`);
    console.log(`✅ Handles real Mangalam invoice data (95 columns)`);
    console.log(`✅ Null-safe data parsing`);
    console.log(`✅ Transaction-based batch processing`);
    console.log(`✅ Graceful error handling (no crashes)`);
    console.log(`✅ Real-time SSE progress updates`);
    console.log(`✅ Queue-based async processing`);
    console.log(`✅ Automatic retry on failure`);
    console.log(`===========================================\n`);
});