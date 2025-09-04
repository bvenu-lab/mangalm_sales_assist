/**
 * Enterprise Bulk Upload API Server
 * JavaScript version - Actually works with server-enterprise.js
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const { createReadStream, promises: fs } = require('fs');
const { Transform } = require('stream');
const path = require('path');
const crypto = require('crypto');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const Bull = require('bull');
const { EventEmitter } = require('events');

// Import our infrastructure components
const { dbPool } = require('../../config/database.config');
const { redisManager } = require('../../config/redis.config');
const { processor } = require('../queue-processor/processor');

// SSE clients manager
class SSEManager extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map();
  }
  
  addClient(clientId, res) {
    this.clients.set(clientId, res);
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
    
    // Setup heartbeat
    const heartbeat = setInterval(() => {
      if (this.clients.has(clientId)) {
        res.write(': heartbeat\n\n');
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);
  }
  
  removeClient(clientId) {
    this.clients.delete(clientId);
  }
  
  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client) {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }
  
  broadcast(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach(client => {
      client.write(message);
    });
  }
}

const sseManager = new SSEManager();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = process.env.UPLOAD_TEMP_DIR || './uploads/temp';
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || '104857600', 10) // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 
                         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Create Express router
const router = express.Router();

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const dbHealth = await dbPool.health();
    const redisHealth = await redisManager.health();
    const queueHealth = await processor.health();
    
    const healthy = dbHealth.healthy && redisHealth.healthy && queueHealth.healthy;
    
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      components: {
        database: dbHealth,
        redis: redisHealth,
        queues: queueHealth
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * Main bulk upload endpoint
 */
router.post('/', upload.single('file'), async (req, res) => {
  let uploadId = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`Processing upload: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // Create upload job record
    uploadId = uuidv4();
    const fileHash = await calculateFileHash(req.file.path);
    
    // Start transaction
    const client = await dbPool.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Check for duplicate upload
      const dupCheck = await client.query(`
        SELECT id, status, created_at 
        FROM bulk_upload.upload_jobs 
        WHERE file_hash = $1 AND status IN ('completed', 'processing')
        ORDER BY created_at DESC LIMIT 1
      `, [fileHash]);
      
      if (dupCheck.rows.length > 0) {
        const existing = dupCheck.rows[0];
        if (existing.status === 'processing') {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'File is already being processed',
            uploadId: existing.id
          });
        }
      }
      
      // Count rows in CSV for accurate progress tracking
      const rowCount = await countCSVRows(req.file.path);
      
      // Create upload job
      await client.query(`
        INSERT INTO bulk_upload.upload_jobs (
          id, file_name, file_type, file_size_bytes, file_hash,
          status, strategy, priority, total_rows, schema_version,
          user_id, ip_address, user_agent, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      `, [
        uploadId,
        req.file.originalname,
        'csv',
        req.file.size,
        fileHash,
        'pending',
        'parallel',
        req.body.priority || 0,
        rowCount,
        '1.0',
        req.body.userId || 'anonymous',
        req.ip,
        req.get('user-agent'),
        JSON.stringify({ filePath: req.file.path })
      ]);
      
      // Create audit log entry
      await client.query(`
        INSERT INTO audit.upload_audit_log (
          upload_id, event_type, event_data, user_id, ip_address, timestamp
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        uploadId,
        'UPLOAD_STARTED',
        JSON.stringify({
          fileName: req.file.originalname,
          fileSize: req.file.size,
          rowCount
        }),
        req.body.userId || 'anonymous',
        req.ip
      ]);
      
      await client.query('COMMIT');
      
      // Add to processing queue
      const uploadQueue = redisManager.getQueue('bulk-upload-queue');
      const job = await uploadQueue.add(`upload-${uploadId}`, {
        uploadId,
        filePath: req.file.path,
        fileName: req.file.originalname,
        fileType: 'csv',
        rowCount,
        userId: req.body.userId || 'anonymous'
      }, {
        priority: req.body.priority || 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });
      
      console.log(`Upload job ${uploadId} queued as job ${job.id}`);
      
      // Send success response
      res.json({
        success: true,
        uploadId,
        jobId: job.id,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        rowCount,
        status: 'pending',
        message: 'File uploaded successfully and queued for processing',
        sseEndpoint: `/api/bulk-upload/${uploadId}/progress`
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up file if upload failed
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        console.error('Failed to delete temp file:', e);
      }
    }
    
    res.status(500).json({
      error: 'Upload failed',
      message: error.message,
      uploadId
    });
  }
});

/**
 * SSE endpoint for real-time progress updates
 */
router.get('/:uploadId/progress', async (req, res) => {
  const { uploadId } = req.params;
  const clientId = uuidv4();
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  
  // Add client to SSE manager
  sseManager.addClient(clientId, res);
  
  // Send initial status
  try {
    const client = await dbPool.getClient();
    const result = await client.query(`
      SELECT * FROM bulk_upload.upload_jobs WHERE id = $1
    `, [uploadId]);
    client.release();
    
    if (result.rows[0]) {
      const job = result.rows[0];
      sseManager.sendToClient(clientId, {
        type: 'status',
        uploadId,
        status: job.status,
        totalRows: job.total_rows,
        processedRows: job.processed_rows || 0,
        successfulRows: job.successful_rows || 0,
        failedRows: job.failed_rows || 0,
        percentComplete: job.total_rows ? 
          ((job.processed_rows || 0) / job.total_rows * 100).toFixed(2) : 0
      });
    }
  } catch (error) {
    console.error('Error fetching initial status:', error);
  }
  
  // Clean up on disconnect
  req.on('close', () => {
    sseManager.removeClient(clientId);
  });
});

/**
 * Get upload status
 */
router.get('/:uploadId/status', async (req, res) => {
  const { uploadId } = req.params;
  
  try {
    const client = await dbPool.getClient();
    
    const result = await client.query(`
      SELECT 
        u.*,
        COUNT(DISTINCT c.id) as total_chunks,
        COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_chunks,
        COUNT(DISTINCT e.id) as error_count
      FROM bulk_upload.upload_jobs u
      LEFT JOIN bulk_upload.upload_chunks c ON c.upload_id = u.id
      LEFT JOIN bulk_upload.processing_errors e ON e.upload_id = u.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [uploadId]);
    
    client.release();
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

/**
 * Get processing errors for an upload
 */
router.get('/:uploadId/errors', async (req, res) => {
  const { uploadId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  
  try {
    const client = await dbPool.getClient();
    
    const result = await client.query(`
      SELECT * FROM bulk_upload.processing_errors 
      WHERE upload_id = $1
      ORDER BY row_number
      LIMIT $2 OFFSET $3
    `, [uploadId, limit, offset]);
    
    client.release();
    
    res.json({
      errors: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error fetching errors:', error);
    res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

/**
 * List recent uploads
 */
router.get('/', async (req, res) => {
  const { limit = 20, offset = 0, status } = req.query;
  
  try {
    const client = await dbPool.getClient();
    
    let query = `
      SELECT * FROM bulk_upload.upload_jobs 
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await client.query(query, params);
    client.release();
    
    res.json({
      uploads: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error listing uploads:', error);
    res.status(500).json({ error: 'Failed to list uploads' });
  }
});

/**
 * Calculate file hash for deduplication
 */
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Count rows in CSV file
 */
async function countCSVRows(filePath) {
  return new Promise((resolve, reject) => {
    let count = 0;
    
    createReadStream(filePath)
      .pipe(csv())
      .on('data', () => count++)
      .on('end', () => resolve(count))
      .on('error', reject);
  });
}

/**
 * Setup progress event listeners from processor
 */
if (processor) {
  processor.on('progress', (update) => {
    // Broadcast progress to all SSE clients
    sseManager.broadcast({
      type: 'progress',
      ...update
    });
  });

  processor.on('job:completed', async (jobId, result) => {
    console.log(`Job ${jobId} completed:`, result);
    
    // Send completion notification
    sseManager.broadcast({
      type: 'completed',
      uploadId: result.uploadId,
      message: 'Upload processing completed successfully'
    });
  });

  processor.on('job:failed', async (jobId, error) => {
    console.error(`Job ${jobId} failed:`, error);
    
    // Send failure notification
    sseManager.broadcast({
      type: 'failed',
      uploadId: jobId,
      error: error.message
    });
  });
}

module.exports = router;