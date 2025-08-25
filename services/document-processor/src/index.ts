import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { initializeDatabase } from './database/connection';
import uploadRoutes from './routes/upload.routes';
import healthRoutes from './routes/health.routes';
import { DocumentProcessorWorker } from './workers/document-processor.worker';
import * as winston from 'winston';
import path from 'path';
import fs from 'fs';

// Create logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: config.logging.errorFile,
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

// Create Express app
const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors(config.cors));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
});

// Routes
app.use('/api/documents', uploadRoutes);
app.use('/health', healthRoutes);

// Import and use processing routes
import processingRoutes from './routes/processing.routes';
app.use('/api/processing', processingRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  if (err.message?.includes('Invalid file type')) {
    res.status(400).json({
      success: false,
      error: err.message
    });
    return;
  }

  if (err.message?.includes('File too large')) {
    res.status(400).json({
      success: false,
      error: 'File size exceeds maximum limit of 10MB'
    });
    return;
  }

  res.status(err.status || 500).json({
    success: false,
    error: config.env === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Create required directories
const createDirectories = () => {
  const dirs = [
    config.upload.uploadDir,
    config.upload.tempDir,
    path.dirname(config.logging.file),
    path.dirname(config.logging.errorFile)
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

// Start server
const startServer = async () => {
  try {
    // Create required directories
    createDirectories();

    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Start document processor worker
    const processorWorker = new DocumentProcessorWorker();
    await processorWorker.start();
    logger.info('Document processor worker started');

    // Start server
    const server = app.listen(config.service.port, () => {
      logger.info(`Document Processor Service running on port ${config.service.port}`);
      logger.info(`Environment: ${config.service.env}`);
      logger.info(`Upload directory: ${config.upload.uploadDir}`);
      logger.info(`Max file size: ${config.upload.maxFileSize} bytes`);
      logger.info(`Processing worker: Active with ${config.processing.queueConcurrency} concurrent jobs`);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Starting graceful shutdown...');
      
      // Stop the processor worker
      await processorWorker.stop();
      logger.info('Document processor worker stopped');
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();