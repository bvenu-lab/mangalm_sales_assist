/**
 * Simple Bulk Upload API Server
 * Minimal working implementation to test connectivity
 */

require('dotenv').config({ path: '../../.env' });
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { Pool } = require('pg');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3432'),
    database: process.env.DB_NAME || 'mangalm_sales',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected at:', res.rows[0].now);
    }
});

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
        if (file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: pool.totalCount > 0 ? 'connected' : 'disconnected'
    });
});

// Upload endpoint
app.post('/api/bulk-upload', upload.single('file'), async (req, res) => {
    console.log('Upload request received');
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const jobId = uuidv4();
    const filePath = req.file.path;
    
    try {
        // Create job record in database
        const insertQuery = `
            INSERT INTO bulk_upload.upload_jobs 
            (job_id, file_name, file_path, file_size, status, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id, job_id
        `;
        
        const result = await pool.query(insertQuery, [
            jobId,
            req.file.originalname,
            filePath,
            req.file.size,
            'processing'
        ]);
        
        console.log('Job created:', result.rows[0]);
        
        // Process CSV file
        let rowCount = 0;
        const rows = [];
        
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                rowCount++;
                rows.push(data);
            })
            .on('end', async () => {
                console.log(`CSV file processed: ${rowCount} rows`);
                
                // Insert data into invoice_items table
                let successCount = 0;
                let errorCount = 0;
                
                for (const row of rows) {
                    try {
                        const insertInvoiceQuery = `
                            INSERT INTO invoice_items 
                            (invoice_no, invoice_date, month, year, salesman_name, 
                             store_name, store_code, item_name, batch_no, quantity, 
                             rate, mrp, discount, amount, company_name, division, 
                             hq, expiry_date)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                                   $11, $12, $13, $14, $15, $16, $17, $18)
                            ON CONFLICT (invoice_no, item_name, batch_no) DO NOTHING
                        `;
                        
                        await pool.query(insertInvoiceQuery, [
                            row['Invoice No'] || row.invoice_no,
                            row['Invoice Date'] || row.invoice_date,
                            row['Month'] || row.month,
                            row['Year'] || row.year,
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
                        successCount++;
                    } catch (error) {
                        errorCount++;
                        console.error('Row insert error:', error.message);
                    }
                }
                
                // Update job status
                await pool.query(`
                    UPDATE bulk_upload.upload_jobs 
                    SET status = 'completed',
                        total_rows = $1,
                        processed_rows = $2,
                        successful_rows = $3,
                        failed_rows = $4,
                        completed_at = NOW()
                    WHERE job_id = $5
                `, [rowCount, rowCount, successCount, errorCount, jobId]);
                
                console.log(`Upload completed: ${successCount} success, ${errorCount} errors`);
            })
            .on('error', async (error) => {
                console.error('CSV processing error:', error);
                await pool.query(`
                    UPDATE bulk_upload.upload_jobs 
                    SET status = 'failed',
                        error_message = $1,
                        completed_at = NOW()
                    WHERE job_id = $2
                `, [error.message, jobId]);
            });
        
        res.json({
            success: true,
            jobId: jobId,
            message: 'File upload started',
            filename: req.file.originalname,
            size: req.file.size
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Upload failed', 
            message: error.message 
        });
    }
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
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Status query error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// Start server
const PORT = process.env.BULK_UPLOAD_PORT || 3008;
app.listen(PORT, () => {
    console.log(`\n===========================================`);
    console.log(`Bulk Upload API Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Upload endpoint: POST http://localhost:${PORT}/api/bulk-upload`);
    console.log(`===========================================\n`);
});