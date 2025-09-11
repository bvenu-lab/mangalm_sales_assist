/**
 * Enterprise Bulk Upload Server with All Features
 * Actually implements SSE, streaming, transactions, and queue processing
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
const { Transform, pipeline } = require('stream');
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

// Create Express app
const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());

// PostgreSQL connection with transaction support
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3432'),
    database: process.env.DB_NAME || 'mangalm_sales',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Redis connection for queue
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: 3,
});

// Bull queue for async processing
const uploadQueue = new Bull('upload-queue', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
    }
});

// SSE Manager for real-time updates
class SSEManager extends EventEmitter {
    constructor() {
        super();
        this.clients = new Map();
    }
    
    addClient(jobId, res) {
        this.clients.set(jobId, res);
        
        // Setup SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });
        
        // Send initial connection message
        res.write(`data: ${JSON.stringify({ 
            type: 'connected', 
            jobId,
            timestamp: new Date().toISOString()
        })}\n\n`);
        
        // Setup heartbeat
        const heartbeat = setInterval(() => {
            if (this.clients.has(jobId)) {
                res.write(': heartbeat\n\n');
            } else {
                clearInterval(heartbeat);
            }
        }, 30000);
        
        // Clean up on disconnect
        res.on('close', () => {
            this.clients.delete(jobId);
            clearInterval(heartbeat);
        });
    }
    
    sendProgress(jobId, data) {
        const client = this.clients.get(jobId);
        if (client) {
            client.write(`data: ${JSON.stringify({
                type: 'progress',
                ...data,
                timestamp: new Date().toISOString()
            })}\n\n`);
        }
    }
    
    sendComplete(jobId, data) {
        const client = this.clients.get(jobId);
        if (client) {
            client.write(`data: ${JSON.stringify({
                type: 'complete',
                ...data,
                timestamp: new Date().toISOString()
            })}\n\n`);
            
            // Close connection after completion
            setTimeout(() => {
                if (this.clients.has(jobId)) {
                    const c = this.clients.get(jobId);
                    c.end();
                    this.clients.delete(jobId);
                }
            }, 1000);
        }
    }
    
    sendError(jobId, error) {
        const client = this.clients.get(jobId);
        if (client) {
            client.write(`data: ${JSON.stringify({
                type: 'error',
                error: error.message || error,
                timestamp: new Date().toISOString()
            })}\n\n`);
        }
    }
}

const sseManager = new SSEManager();

// Stream transformer for CSV processing with batching
class CSVBatchTransformer extends Transform {
    constructor(options = {}) {
        super({ objectMode: true });
        this.batchSize = options.batchSize || 100;
        this.batch = [];
        this.rowCount = 0;
        this.jobId = options.jobId;
    }
    
    _transform(chunk, encoding, callback) {
        this.rowCount++;
        this.batch.push(chunk);
        
        if (this.batch.length >= this.batchSize) {
            this.push([...this.batch]);
            this.batch = [];
        }
        
        // Send progress update every 100 rows
        if (this.rowCount % 100 === 0) {
            sseManager.sendProgress(this.jobId, {
                rowsProcessed: this.rowCount,
                message: `Processing row ${this.rowCount}...`
            });
        }
        
        callback();
    }
    
    _flush(callback) {
        if (this.batch.length > 0) {
            this.push(this.batch);
        }
        callback();
    }
}

// Database batch inserter with transactions
class DatabaseBatchInserter extends Transform {
    constructor(options = {}) {
        super({ objectMode: true });
        this.pool = options.pool;
        this.jobId = options.jobId;
        this.successCount = 0;
        this.errorCount = 0;
        this.duplicateCount = 0;
    }
    
    async _transform(batch, encoding, callback) {
        const client = await this.pool.connect();
        
        try {
            // Start transaction
            await client.query('BEGIN');
            
            for (const row of batch) {
                try {
                    // Calculate hash for deduplication
                    const rowHash = crypto
                        .createHash('sha256')
                        .update(JSON.stringify(row))
                        .digest('hex');
                    
                    // Check for duplicate
                    const dupCheck = await client.query(
                        'SELECT 1 FROM bulk_upload.deduplication WHERE record_hash = $1',
                        [rowHash]
                    );
                    
                    if (dupCheck.rows.length > 0) {
                        this.duplicateCount++;
                        await client.query(
                            'UPDATE bulk_upload.deduplication SET duplicate_count = duplicate_count + 1, last_seen_at = NOW() WHERE record_hash = $1',
                            [rowHash]
                        );
                        continue;
                    }
                    
                    // Insert into invoice_items
                    await client.query(`
                        INSERT INTO invoice_items 
                        (invoice_no, invoice_date, month, year, salesman_name, 
                         store_name, store_code, item_name, batch_no, quantity, 
                         rate, mrp, discount, amount, company_name, division, 
                         hq, expiry_date)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                               $11, $12, $13, $14, $15, $16, $17, $18)
                        ON CONFLICT (invoice_no, item_name, batch_no) DO UPDATE
                        SET quantity = EXCLUDED.quantity,
                            rate = EXCLUDED.rate,
                            amount = EXCLUDED.amount,
                            updated_at = NOW()
                    `, [
                        row['Invoice No'] || row.invoice_no,
                        row['Invoice Date'] || row.invoice_date,
                        row['Month'] || row.month,
                        parseInt(row['Year'] || row.year) || null,
                        row['Salesman Name'] || row.salesman_name,
                        row['Store Name'] || row.store_name,
                        row['Store Code'] || row.store_code,
                        row['Item Name'] || row.item_name,
                        row['Batch No'] || row.batch_no,
                        parseFloat(row['Quantity'] || row.quantity || 0),
                        parseFloat(row['Rate'] || row.rate || 0),
                        parseFloat(row['MRP'] || row.mrp || 0),
                        parseFloat(row['Discount'] || row.discount || 0),
                        parseFloat(row['Amount'] || row.amount || 0),
                        row['Company Name'] || row.company_name,
                        row['Division'] || row.division,
                        row['HQ'] || row.hq,
                        row['Expiry Date'] || row.expiry_date
                    ]);
                    
                    // Record deduplication entry
                    await client.query(`
                        INSERT INTO bulk_upload.deduplication 
                        (record_hash, business_key, first_seen_upload_id)
                        VALUES ($1, $2, $3::INTEGER)
                    `, [rowHash, `${row['Invoice No']}-${row['Item Name']}-${row['Batch No']}`, this.jobId]);
                    
                    this.successCount++;
                    
                } catch (rowError) {
                    this.errorCount++;
                    
                    // Log error to processing_errors table
                    await client.query(`
                        INSERT INTO bulk_upload.processing_errors 
                        (upload_id, row_number, error_type, error_message, raw_data, retryable)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        this.jobId,
                        this.successCount + this.errorCount,
                        'INSERT_ERROR',
                        rowError.message,
                        JSON.stringify(row),
                        true
                    ]);
                }
            }
            
            // Commit transaction
            await client.query('COMMIT');
            
            // Send progress update
            sseManager.sendProgress(this.jobId, {
                successCount: this.successCount,
                errorCount: this.errorCount,
                duplicateCount: this.duplicateCount,
                message: `Processed batch: ${this.successCount} success, ${this.errorCount} errors, ${this.duplicateCount} duplicates`
            });
            
        } catch (error) {
            // Rollback on error
            await client.query('ROLLBACK');
            console.error('Batch processing error:', error);
            this.errorCount += batch.length;
            
        } finally {
            client.release();
        }
        
        callback();
    }
    
    _flush(callback) {
        // Update final statistics
        this.push({
            success: this.successCount,
            errors: this.errorCount,
            duplicates: this.duplicateCount
        });
        callback();
    }
}

// Multer configuration for file uploads
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
        fileSize: 100 * 1024 * 1024 // 100MB
    },
    fileFilter: (req, file, cb) => {
        if (file.originalname.toLowerCase().endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

// Queue processor
uploadQueue.process(async (job) => {
    const { jobId, filePath } = job.data;
    console.log(`Processing job ${jobId}`);
    
    const startTime = Date.now();
    
    try {
        // Update job status to processing
        await pool.query(`
            UPDATE bulk_upload.upload_jobs 
            SET status = 'processing', 
                started_at = NOW()
            WHERE job_id = $1
        `, [jobId]);
        
        // Create processing pipeline
        const readStream = fs.createReadStream(filePath);
        const csvParser = csv();
        const batchTransformer = new CSVBatchTransformer({ 
            batchSize: 100, 
            jobId 
        });
        const dbInserter = new DatabaseBatchInserter({ 
            pool, 
            jobId: job.data.uploadId 
        });
        
        let totalRows = 0;
        let finalStats = null;
        
        // Count total rows first (for progress calculation)
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', () => totalRows++)
                .on('end', resolve)
                .on('error', reject);
        });
        
        // Process the file
        await new Promise((resolve, reject) => {
            pipeline(
                readStream,
                csvParser,
                batchTransformer,
                dbInserter,
                async (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
            
            dbInserter.on('data', (stats) => {
                finalStats = stats;
            });
        });
        
        const processingTime = Date.now() - startTime;
        const rowsPerSecond = totalRows / (processingTime / 1000);
        
        // Update job as completed
        await pool.query(`
            UPDATE bulk_upload.upload_jobs 
            SET status = 'completed',
                completed_at = NOW(),
                total_rows = $1,
                processed_rows = $1,
                successful_rows = $2,
                failed_rows = $3,
                duplicate_rows = $4,
                processing_time_ms = $5,
                rows_per_second = $6
            WHERE job_id = $7
        `, [
            totalRows,
            finalStats?.success || 0,
            finalStats?.errors || 0,
            finalStats?.duplicates || 0,
            processingTime,
            rowsPerSecond,
            jobId
        ]);
        
        // Send completion notification
        sseManager.sendComplete(jobId, {
            totalRows,
            success: finalStats?.success || 0,
            errors: finalStats?.errors || 0,
            duplicates: finalStats?.duplicates || 0,
            processingTime,
            rowsPerSecond: Math.round(rowsPerSecond)
        });
        
        // Clean up temp file
        fs.unlinkSync(filePath);
        
        console.log(`Job ${jobId} completed: ${totalRows} rows in ${processingTime}ms`);
        
    } catch (error) {
        console.error(`Job ${jobId} failed:`, error);
        
        // Update job as failed
        await pool.query(`
            UPDATE bulk_upload.upload_jobs 
            SET status = 'failed',
                completed_at = NOW(),
                error_message = $1
            WHERE job_id = $2
        `, [error.message, jobId]);
        
        // Send error notification
        sseManager.sendError(jobId, error);
        
        throw error;
    }
});

// Health check endpoint
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

// Upload endpoint with queue support
app.post('/api/bulk-upload', upload.single('file'), async (req, res) => {
    console.log('Upload request received');
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const jobId = uuidv4();
    const filePath = req.file.path;
    
    try {
        // Calculate file hash for deduplication
        const fileBuffer = fs.readFileSync(filePath);
        const fileHash = crypto
            .createHash('sha256')
            .update(fileBuffer)
            .digest('hex');
        
        // Check if file was already uploaded
        const existingUpload = await pool.query(
            'SELECT job_id, status FROM bulk_upload.upload_jobs WHERE file_hash = $1 AND status = $2',
            [fileHash, 'completed']
        );
        
        if (existingUpload.rows.length > 0) {
            fs.unlinkSync(filePath); // Clean up duplicate file
            return res.json({
                success: true,
                jobId: existingUpload.rows[0].job_id,
                message: 'File already processed',
                duplicate: true
            });
        }
        
        // Create job record in database
        const result = await pool.query(`
            INSERT INTO bulk_upload.upload_jobs 
            (job_id, file_name, file_path, file_size, file_hash, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, job_id
        `, [
            jobId,
            req.file.originalname,
            filePath,
            req.file.size,
            fileHash,
            'queued'
        ]);
        
        const uploadId = result.rows[0].id;
        
        // Add to processing queue
        await uploadQueue.add({
            jobId,
            uploadId,
            filePath,
            fileName: req.file.originalname,
            fileSize: req.file.size
        }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            }
        });
        
        console.log(`Job ${jobId} queued for processing`);
        
        res.json({
            success: true,
            jobId,
            message: 'File queued for processing',
            filename: req.file.originalname,
            size: req.file.size,
            sseUrl: `/api/bulk-upload/${jobId}/progress`
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up file on error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        res.status(500).json({ 
            error: 'Upload failed', 
            message: error.message 
        });
    }
});

// SSE endpoint for real-time progress
app.get('/api/bulk-upload/:jobId/progress', (req, res) => {
    const { jobId } = req.params;
    console.log(`SSE connection established for job ${jobId}`);
    
    // Add client to SSE manager
    sseManager.addClient(jobId, res);
    
    // Check current job status
    pool.query(
        'SELECT * FROM bulk_upload.upload_jobs WHERE job_id = $1',
        [jobId]
    ).then(result => {
        if (result.rows.length > 0) {
            const job = result.rows[0];
            if (job.status === 'completed') {
                sseManager.sendComplete(jobId, {
                    totalRows: job.total_rows,
                    success: job.successful_rows,
                    errors: job.failed_rows,
                    duplicates: job.duplicate_rows,
                    processingTime: job.processing_time_ms,
                    rowsPerSecond: job.rows_per_second
                });
            } else if (job.status === 'failed') {
                sseManager.sendError(jobId, { message: job.error_message });
            }
        }
    });
});

// Get upload status
app.get('/api/bulk-upload/:jobId/status', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM bulk_upload.upload_jobs WHERE job_id = $1',
            [req.params.jobId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        const job = result.rows[0];
        
        // Get error details if failed
        let errors = [];
        if (job.failed_rows > 0) {
            const errorResult = await pool.query(
                'SELECT * FROM bulk_upload.processing_errors WHERE upload_id = $1 LIMIT 10',
                [job.id]
            );
            errors = errorResult.rows;
        }
        
        res.json({
            ...job,
            errors: errors
        });
    } catch (error) {
        console.error('Status query error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// Get queue statistics
app.get('/api/bulk-upload/queue/stats', async (req, res) => {
    try {
        const stats = await uploadQueue.getJobCounts();
        const workers = await uploadQueue.getWorkers();
        
        res.json({
            queue: stats,
            workers: workers.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.BULK_UPLOAD_PORT || 3009;
app.listen(PORT, () => {
    console.log(`\n===========================================`);
    console.log(`Enterprise Bulk Upload Server`);
    console.log(`Port: ${PORT}`);
    console.log(`===========================================`);
    console.log(`Features:`);
    console.log(`✅ Stream processing for large files`);
    console.log(`✅ Transaction support with rollback`);
    console.log(`✅ SSE for real-time progress`);
    console.log(`✅ Queue-based async processing`);
    console.log(`✅ Deduplication support`);
    console.log(`✅ Error tracking and recovery`);
    console.log(`===========================================`);
    console.log(`Endpoints:`);
    console.log(`GET  /health - Health check`);
    console.log(`POST /api/bulk-upload - Upload CSV file`);
    console.log(`GET  /api/bulk-upload/:jobId/progress - SSE progress`);
    console.log(`GET  /api/bulk-upload/:jobId/status - Get job status`);
    console.log(`GET  /api/bulk-upload/queue/stats - Queue statistics`);
    console.log(`===========================================\n`);
});