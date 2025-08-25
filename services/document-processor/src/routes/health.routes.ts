import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database/connection';
import { ProcessingQueue } from '../services/processing-queue.service';
import { config } from '../config';
import os from 'os';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const processingQueue = new ProcessingQueue();
    const queueStats = await processingQueue.getQueueStats();
    
    const health = {
      status: 'healthy',
      service: 'document-processor',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      database: {
        connected: AppDataSource.isInitialized,
        type: 'postgresql'
      },
      queue: {
        status: 'active',
        stats: queueStats
      },
      system: {
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          free: os.freemem(),
          systemTotal: os.totalmem()
        },
        cpu: {
          cores: os.cpus().length,
          loadAverage: os.loadavg()
        }
      },
      features: {
        tesseract: config.ocr.tesseract.enabled,
        googleVision: config.ocr.googleVision.enabled,
        azure: config.ocr.azure.enabled,
        aws: config.ocr.aws.enabled
      }
    };

    res.json(health);
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'document-processor',
      error: error.message
    });
  }
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connection
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not connected');
    }

    // Check queue availability
    const processingQueue = new ProcessingQueue();
    await processingQueue.getQueueStats();

    res.json({
      ready: true,
      service: 'document-processor'
    });
  } catch (error: any) {
    res.status(503).json({
      ready: false,
      service: 'document-processor',
      error: error.message
    });
  }
});

router.get('/live', (req: Request, res: Response) => {
  res.json({
    alive: true,
    service: 'document-processor',
    timestamp: new Date().toISOString()
  });
});

export default router;