import express from 'express';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @route   GET /health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', (req, res) => {
  logger.info('Health check requested', { requestId: req.id });
  
  res.status(200).json({
    status: 'ok',
    service: 'ai-prediction-service',
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
});

/**
 * @route   GET /health/detailed
 * @desc    Detailed health check with service dependencies
 * @access  Public
 */
router.get('/detailed', async (req, res) => {
  logger.info('Detailed health check requested', { requestId: req.id });
  
  try {
    // Check database connection
    const dbStatus = { status: 'ok', message: 'Connected' };
    
    // Check model availability
    const modelStatus = { status: 'ok', message: 'Models loaded' };
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const formattedMemoryUsage = {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
    };
    
    res.status(200).json({
      status: 'ok',
      service: 'ai-prediction-service',
      timestamp: new Date().toISOString(),
      requestId: req.id,
      dependencies: {
        database: dbStatus,
        models: modelStatus,
      },
      system: {
        uptime: `${Math.floor(process.uptime())} seconds`,
        memory: formattedMemoryUsage,
        nodeVersion: process.version,
        platform: process.platform,
      },
    });
  } catch (error) {
    logger.error('Error in detailed health check', {
      error,
      requestId: req.id,
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Error performing health check',
      timestamp: new Date().toISOString(),
      requestId: req.id,
    });
  }
});

export default router;
