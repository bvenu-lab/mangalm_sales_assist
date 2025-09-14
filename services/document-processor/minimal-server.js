// Ultra-minimal document processor for Cloud Run
const express = require('express');
const cors = require('cors');
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

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      service: 'document-processor-minimal'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Mock endpoints
app.post('/api/upload', (req, res) => {
  res.json({ success: true, message: 'Upload received (mock)' });
});

app.get('/api/processing/status/:id', (req, res) => {
  res.json({
    success: true,
    id: req.params.id,
    status: 'completed'
  });
});

app.post('/api/data-extraction/extract', (req, res) => {
  res.json({
    success: true,
    data: { text: 'Mock extraction' }
  });
});

// Catch all
app.get('*', (req, res) => {
  res.json({
    service: 'document-processor',
    status: 'running',
    mode: 'minimal'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Document Processor Minimal on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  pool.end();
  process.exit(0);
});