// Mock Bulk Upload Server for testing frontend integration
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3009;

// Middleware
app.use(cors());
app.use(express.json());

// Mock health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Bulk Upload API',
    port: PORT,
    database: {
      status: 'disconnected',
      message: 'Mock mode - database not connected'
    },
    redis: {
      status: 'disconnected', 
      message: 'Mock mode - Redis not connected'
    },
    queue: {
      status: 'disconnected',
      message: 'Mock mode - Queue not connected'
    },
    timestamp: new Date().toISOString()
  });
});

// Mock system status endpoint
app.get('/api/system/status', (req, res) => {
  res.json({
    overall: 'partial',
    services: {
      database: {
        status: 'unknown',
        message: 'Database connection not available',
        lastCheck: new Date().toISOString()
      },
      redis: {
        status: 'unknown', 
        message: 'Redis connection not available',
        lastCheck: new Date().toISOString()
      },
      queue: {
        status: 'unknown',
        message: 'Queue service not available', 
        lastCheck: new Date().toISOString()
      }
    }
  });
});

// Mock upload endpoint
app.post('/api/enterprise-bulk-upload', (req, res) => {
  res.json({
    success: false,
    message: 'Mock mode - database required for uploads',
    jobId: null
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock Bulk Upload API running on port ${PORT}`);
  console.log('Health endpoint: http://localhost:' + PORT + '/health');
  console.log('System status: http://localhost:' + PORT + '/api/system/status');
});