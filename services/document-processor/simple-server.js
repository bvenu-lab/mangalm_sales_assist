// Simple document processor server for Cloud Run
// This is a lightweight version that doesn't require heavy dependencies

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3008;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mangalm_sales',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Security middleware
app.use(helmet());
app.use(compression());

// CORS middleware
app.use(cors({
  origin: process.env.CORS_ALLOWED_ORIGINS ?
    process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()) :
    '*'
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      service: 'document-processor',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'document-processor',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Basic upload endpoint (simplified)
app.post('/api/upload', (req, res) => {
  res.json({
    success: true,
    message: 'Upload endpoint - simplified version',
    note: 'Full OCR capabilities disabled in lightweight mode'
  });
});

// Processing status endpoint
app.get('/api/processing/status/:id', (req, res) => {
  res.json({
    success: true,
    id: req.params.id,
    status: 'completed',
    message: 'Simplified processing - no actual OCR'
  });
});

// Data extraction endpoint (mock)
app.post('/api/data-extraction/extract', (req, res) => {
  res.json({
    success: true,
    message: 'Data extraction - simplified version',
    data: {
      text: 'OCR capabilities disabled in lightweight mode',
      confidence: 0
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Document Processor (Lightweight) running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});