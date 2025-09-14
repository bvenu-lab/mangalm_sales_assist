import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger';
// Auth routes removed - no authentication needed
import mockDataRoutes from './routes/mock-data-routes';
import healthRoutes from './routes/health-routes';

const app = express();

// Add request ID middleware
app.use((req: any, res: any, next: any) => {
  req.id = req.headers['x-request-id'] as string || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Set security-related HTTP headers
app.use(helmet());

// Enable Cross Origin Resource Sharing
const corsOrigins = process.env.CORS_ALLOWED_ORIGINS ?
  process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()) :
  ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compress response bodies
app.use(compression());

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// HTTP request logger
app.use(morgan('combined'));

// API routes
app.use('/health', healthRoutes);
// No auth routes needed
app.use('/api', mockDataRoutes);
app.use('/', mockDataRoutes);
app.use('/mangalm', mockDataRoutes);

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  logger.error(`Unhandled error: ${err.message}`, {
    error: err,
    stack: err.stack,
    requestId: req.id,
  });

  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500,
      requestId: req.id,
    },
  });
});

// Start Express server
const port = parseInt(process.env.PORT || '3006');
const server = app.listen(port, () => {
  logger.info(`AI Prediction Service started on port ${port}`);
  logger.info(`http://localhost:${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received');
  logger.info('Closing HTTP server');
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received');
  logger.info('Closing HTTP server');
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    error: err,
    stack: err.stack,
  });
  
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason,
    promise,
  });
  
  process.exit(1);
});

export default app;