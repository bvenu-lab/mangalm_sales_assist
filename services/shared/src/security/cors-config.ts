/**
 * CORS Configuration for Local Release 1
 * Simple, secure CORS setup for development and local deployment
 */

import cors from 'cors';
import { logger } from '../utils/logger';

export interface CorsConfigOptions {
  allowedOrigins?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
  development?: boolean;
}

/**
 * Create CORS middleware with secure defaults for local release
 */
export function createCorsConfig(options: CorsConfigOptions = {}) {
  const {
    allowedOrigins = ['http://localhost:3000', 'http://localhost:3005', 'http://127.0.0.1:3000', 'http://127.0.0.1:3005'],
    allowCredentials = true,
    maxAge = 86400, // 24 hours
    development = process.env.NODE_ENV !== 'production'
  } = options;

  // Development vs Production CORS settings
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // In development, allow localhost variations
      if (development) {
        const isLocalhost = origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
        if (isLocalhost) {
          return callback(null, true);
        }
      }

      // Check against allowed origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn('CORS blocked request from unauthorized origin', { origin });
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },

    credentials: allowCredentials,

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

    // Preflight cache time
    maxAge,

    // Include credentials in preflight response
    preflightContinue: false,

    // Pass control to next handler
    optionsSuccessStatus: 204
  };

  logger.info('CORS configuration initialized', {
    allowedOrigins: development ? 'localhost + configured origins' : allowedOrigins,
    allowCredentials,
    development
  });

  return cors(corsOptions);
}

/**
 * Simple CORS configuration for local development
 */
export const developmentCors = createCorsConfig({
  development: true,
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:3005',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3005',
    'http://127.0.0.1:8080'
  ]
});

/**
 * Restrictive CORS configuration for production
 */
export const productionCors = createCorsConfig({
  development: false,
  allowedOrigins: [
    // Add your production domains here
    // 'https://yourdomain.com',
    // 'https://app.yourdomain.com'
  ]
});

/**
 * Get appropriate CORS configuration based on environment
 */
export function getCorsConfig(customOrigins?: string[]): ReturnType<typeof createCorsConfig> {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (customOrigins) {
    return createCorsConfig({
      allowedOrigins: customOrigins,
      development: isDevelopment
    });
  }

  return isDevelopment ? developmentCors : productionCors;
}

export default getCorsConfig;