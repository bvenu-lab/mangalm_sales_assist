/**
 * CORS Configuration for API Gateway - Local Release 1
 */

import cors from 'cors';
import { logger } from '../utils/logger';

export function createCorsConfig() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Allow 'null' origin for local file testing
      if (origin === 'null') {
        return callback(null, true);
      }

      // In development, allow localhost variations
      if (isDevelopment) {
        const isLocalhost = origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
        if (isLocalhost) {
          return callback(null, true);
        }
      }

      // Get allowed origins from environment or use defaults
      const envOrigins = process.env.CORS_ALLOWED_ORIGINS ?
        process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [];

      // Default allowed origins for local development
      const defaultOrigins = isDevelopment ? [
        'http://localhost:3000',
        'http://localhost:3005',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3005',
        'http://127.0.0.1:8080',
        'file://'
      ] : [];

      const allowedOrigins = [...envOrigins, ...defaultOrigins];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn('CORS blocked request from unauthorized origin', { origin });
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },

    credentials: true,

    // Allow common HTTP methods
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],

    // Allow common headers
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'Cache-Control'
    ],

    // Expose headers that client can access
    exposedHeaders: [
      'X-Total-Count',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],

    // Preflight cache time (24 hours)
    maxAge: 86400,

    // Include credentials in preflight response
    preflightContinue: false,

    // Pass control to next handler
    optionsSuccessStatus: 204
  };

  logger.info('CORS configuration initialized for local release 1', {
    development: isDevelopment
  });

  return cors(corsOptions);
}

export default createCorsConfig;