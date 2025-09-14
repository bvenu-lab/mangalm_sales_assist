// Minimal bulk upload server for Cloud Run
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3009;

console.log(`Starting minimal bulk upload server on port ${PORT}`);

// Middleware
app.use(cors());
app.use(express.json());

// File upload configuration - use memory storage for Cloud Run
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// Database configuration (lazy initialization) - don't block startup
let pool = null;
function getPool() {
  if (!pool) {
    // Use Cloud SQL connection string for Cloud Run
    const config = {
      database: process.env.DB_NAME || 'mangalm_sales',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

    // Cloud SQL uses Unix socket connection
    if (process.env.DB_HOST && process.env.DB_HOST.startsWith('/cloudsql/')) {
      config.host = process.env.DB_HOST;
    } else {
      config.host = process.env.DB_HOST || 'localhost';
      config.port = parseInt(process.env.DB_PORT || '5432');
    }

    pool = new Pool(config);
  }
  return pool;
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'bulk-upload-api-minimal',
    timestamp: new Date().toISOString(),
    port: PORT
  };

  // Try database connection but don't fail health check
  try {
    const pool = getPool();
    const result = await pool.query('SELECT 1');
    health.database = 'connected';
  } catch (error) {
    health.database = 'disconnected';
    health.dbError = error.message?.substring(0, 100); // Limit error message size
  }

  res.json(health);
});

// Basic upload endpoint
app.post('/api/bulk-upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const uploadId = uuidv4();

  // Store basic metadata (in production would process async)
  const metadata = {
    uploadId: uploadId,
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    uploadedAt: new Date().toISOString()
  };

  res.json({
    success: true,
    ...metadata,
    message: 'File uploaded successfully (minimal mode)',
    note: 'Processing disabled in minimal mode'
  });
});

// Upload status endpoint
app.get('/api/bulk-upload/:id', (req, res) => {
  res.json({
    id: req.params.id,
    status: 'completed',
    message: 'Minimal mode - no actual processing',
    processed: 0,
    total: 0
  });
});

// Progress endpoint (SSE)
app.get('/api/bulk-upload/:id/progress', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send immediate completion
  res.write(`data: ${JSON.stringify({
    status: 'completed',
    progress: 100,
    message: 'Minimal mode'
  })}\n\n`);

  res.end();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'bulk-upload-api',
    mode: 'minimal',
    status: 'running',
    endpoints: [
      'GET /health',
      'POST /api/bulk-upload',
      'GET /api/bulk-upload/:id',
      'GET /api/bulk-upload/:id/progress'
    ]
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server immediately
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal Bulk Upload Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    if (pool) {
      pool.end();
    }
    process.exit(0);
  });
});