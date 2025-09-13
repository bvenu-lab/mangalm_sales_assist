import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { logger, stream } from './utils/logger';
import config from './config';
// Import routes
import healthRoutes from './routes/health-routes';
// import predictionRoutes from './routes/prediction-routes'; // Has compilation errors
// import prioritizationRoutes from './routes/prioritization-routes';
// Auth routes removed - no authentication needed
import mockDataRoutes from './routes/mock-data-routes';
import callPrioritizationRoutes from './routes/call-prioritization-routes';
// import vectorRoutes from './routes/vector-routes';

// Add request ID to express Request interface
declare global {
  namespace Express {
    interface Request {
      id?: string;
      headers: any;
    }
  }
}

// Create Express server
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
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
}));

// Compress response bodies
app.use(compression());

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// HTTP request logger
app.use(morgan('combined', { stream }));

// API routes
app.use('/health', healthRoutes);
// No auth routes needed
app.use('/api/call-prioritization', callPrioritizationRoutes);
app.use('/mangalm/call-prioritization', callPrioritizationRoutes);
// app.use('/api/predictions', predictionRoutes); // Disabled - real ML has compilation errors
app.use('/api', mockDataRoutes); // Mock data routes for all /api/* endpoints
app.use('/', mockDataRoutes); // Also mount at root for direct access from gateway
app.use('/mangalm', mockDataRoutes); // Also mount at /mangalm for gateway routing
// app.use('/api/prioritization', prioritizationRoutes);
// app.use('/api/vector', vectorRoutes); // Vector database routes

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
const server = app.listen(config.server.port, () => {
  logger.info(`Server started in ${config.server.nodeEnv} mode`);
  logger.info(`Listening on port ${config.server.port}`);
  logger.info(`http://localhost:${config.server.port}`);
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

// Export Express server for testing
export default app;
