import { APIGateway } from './gateway/api-gateway';
import { logger } from './utils/logger';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3007;

// Initialize API Gateway
const gateway = new APIGateway();

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received, shutting down API Gateway');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received, shutting down API Gateway');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason,
    promise
  });
  process.exit(1);
});

// Start the gateway
(async () => {
  try {
    await gateway.start(port);
  } catch (error) {
    logger.error('Failed to start API Gateway', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
})();

export default gateway;