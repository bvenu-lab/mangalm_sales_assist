/**
 * Enterprise Error Handling Middleware
 * Unified error handling across all Mangalm services
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponseBuilder, ErrorCode, HTTP_STATUS_MAP, ApiError } from './api-standards';
import { logger } from '../utils/logger';

/**
 * Enhanced Express Request with additional metadata
 */
export interface EnhancedRequest extends Request {
  id: string;
  startTime: number;
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

/**
 * Application Error Class with Enhanced Context
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly field?: string;
  public readonly details?: any;
  public readonly context?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      field?: string;
      details?: any;
      context?: Record<string, any>;
      isOperational?: boolean;
    } = {}
  ) {
    super(message);
    
    this.name = 'AppError';
    this.code = code;
    this.statusCode = HTTP_STATUS_MAP[code] || 500;
    this.isOperational = options.isOperational ?? true;
    this.field = options.field;
    this.details = options.details;
    this.context = options.context;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Database Error Handler
 */
export class DatabaseError extends AppError {
  constructor(originalError: Error, context?: Record<string, any>) {
    super(
      ErrorCode.DATABASE_ERROR,
      'Database operation failed',
      {
        details: originalError.message,
        context,
        isOperational: true
      }
    );
  }
}

/**
 * External Service Error Handler  
 */
export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    originalError: Error,
    context?: Record<string, any>
  ) {
    let errorCode = ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE;
    
    // Map specific service errors
    if (service.toLowerCase().includes('zoho')) {
      errorCode = ErrorCode.ZOHO_SYNC_FAILED;
    }
    
    super(
      errorCode,
      `External service error: ${service}`,
      {
        details: originalError.message,
        context: { service, ...context },
        isOperational: true
      }
    );
  }
}

/**
 * Validation Error Helper
 */
export class ValidationError extends AppError {
  constructor(message: string, field?: string, details?: any) {
    super(
      ErrorCode.VALIDATION_FAILED,
      message,
      {
        field,
        details,
        isOperational: true
      }
    );
  }
}

/**
 * Authorization Error Helper
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      message,
      { isOperational: true }
    );
  }
}

/**
 * Resource Not Found Error Helper
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with ID '${identifier}' not found`
      : `${resource} not found`;
      
    super(
      ErrorCode.RESOURCE_NOT_FOUND,
      message,
      {
        context: { resource, identifier },
        isOperational: true
      }
    );
  }
}

/**
 * Business Logic Error Helper
 */
export class BusinessLogicError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      message,
      {
        context,
        isOperational: true
      }
    );
  }
}

/**
 * Rate Limit Error Helper
 */
export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      {
        details: { retryAfter },
        isOperational: true
      }
    );
  }
}

/**
 * Global Error Handler Middleware
 */
export function globalErrorHandler(
  error: Error,
  req: EnhancedRequest,
  res: Response,
  next: NextFunction
): void {
  const responseBuilder = new ApiResponseBuilder(req);

  // Set processing time if available
  if (req.startTime) {
    (responseBuilder as any).startTime = req.startTime;
  }

  let appError: AppError;

  // Convert various error types to AppError
  if (error instanceof AppError) {
    appError = error;
  } else if (error.name === 'ValidationError') {
    // Joi validation error
    appError = new AppError(
      ErrorCode.VALIDATION_FAILED,
      'Validation failed',
      { details: (error as any).details, isOperational: true }
    );
  } else if (error.name === 'CastError') {
    // Database casting error
    appError = new AppError(
      ErrorCode.INVALID_FORMAT,
      'Invalid data format',
      { field: (error as any).path, isOperational: true }
    );
  } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
    // MongoDB errors
    appError = new DatabaseError(error);
  } else if (error.name === 'JsonWebTokenError') {
    // JWT errors
    appError = new AppError(
      ErrorCode.INVALID_TOKEN,
      'Invalid authentication token',
      { isOperational: true }
    );
  } else if (error.name === 'TokenExpiredError') {
    // JWT expiry
    appError = new AppError(
      ErrorCode.TOKEN_EXPIRED,
      'Authentication token expired',
      { isOperational: true }
    );
  } else if ((error as any).code === 'ENOTFOUND' || (error as any).code === 'ECONNREFUSED') {
    // Network errors
    appError = new AppError(
      ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
      'External service unavailable',
      { details: error.message, isOperational: true }
    );
  } else if ((error as any).code === 'ETIMEDOUT') {
    // Timeout errors
    appError = new AppError(
      ErrorCode.EXTERNAL_SERVICE_TIMEOUT,
      'External service timeout',
      { details: error.message, isOperational: true }
    );
  } else {
    // Unknown errors - treat as system error
    appError = new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Internal server error',
      {
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        isOperational: false
      }
    );
  }

  // Log the error
  logError(appError, req);

  // Build error response
  const errorResponse = responseBuilder.error(
    appError.code,
    appError.message,
    appError.details,
    appError.field
  );

  // Add rate limit info for rate limit errors
  if (appError instanceof RateLimitError && appError.details?.retryAfter) {
    res.set('Retry-After', appError.details.retryAfter.toString());
    if (errorResponse.meta) {
      errorResponse.meta.rateLimit = {
        limit: 0,
        remaining: 0,
        resetTime: new Date(Date.now() + appError.details.retryAfter * 1000).toISOString(),
        retryAfter: appError.details.retryAfter
      };
    }
  }

  // Send error response
  res.status(appError.statusCode).json(errorResponse);
}

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not Found Handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError('Endpoint', req.originalUrl);
  next(error);
}

/**
 * Request ID Middleware
 */
export function requestIdMiddleware(req: EnhancedRequest, res: Response, next: NextFunction): void {
  if (!req.id) {
    req.id = require('uuid').v4();
  }
  req.startTime = Date.now();
  
  // Add request ID to response headers
  res.set('X-Request-ID', req.id);
  
  next();
}

/**
 * Error Logging Function
 */
function logError(error: AppError, req: EnhancedRequest): void {
  const errorInfo = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    userId: req.user?.id,
    username: req.user?.username,
    
    // Error details
    errorCode: error.code,
    errorMessage: error.message,
    statusCode: error.statusCode,
    field: error.field,
    details: error.details,
    context: error.context,
    
    // Request data (sanitized)
    body: sanitizeRequestData(req.body),
    query: req.query,
    params: req.params,
    
    // Timing
    processingTime: req.startTime ? Date.now() - req.startTime : undefined
  };

  if (error.isOperational) {
    // Operational errors (expected) - log as warning
    logger.warn('Operational error occurred', errorInfo);
  } else {
    // System errors (unexpected) - log as error with stack trace
    logger.error('System error occurred', {
      ...errorInfo,
      stack: error.stack
    });
  }
}

/**
 * Sanitize request data for logging
 */
function sanitizeRequestData(data: any): any {
  if (!data) return data;
  
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];
  const sanitized = { ...data };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

/**
 * Express Error Handler Setup
 */
export function setupErrorHandling(app: any): void {
  // Request ID middleware (should be first)
  app.use(requestIdMiddleware);
  
  // 404 handler (should be after all routes)
  app.use(notFoundHandler);
  
  // Global error handler (should be last)
  app.use(globalErrorHandler);
}

/**
 * Error Factory Functions for Common Scenarios
 */
export const ErrorFactory = {
  // Authentication errors
  authenticationRequired: () => new AppError(
    ErrorCode.AUTHENTICATION_REQUIRED,
    'Authentication required'
  ),
  
  invalidToken: () => new AppError(
    ErrorCode.INVALID_TOKEN,
    'Invalid authentication token'
  ),
  
  tokenExpired: () => new AppError(
    ErrorCode.TOKEN_EXPIRED,
    'Authentication token expired'
  ),
  
  // Authorization errors
  insufficientPermissions: (requiredRole?: string) => new AppError(
    ErrorCode.INSUFFICIENT_PERMISSIONS,
    requiredRole 
      ? `Requires ${requiredRole} role`
      : 'Insufficient permissions'
  ),
  
  // Validation errors
  requiredField: (field: string) => new AppError(
    ErrorCode.REQUIRED_FIELD_MISSING,
    `${field} is required`,
    { field }
  ),
  
  invalidFormat: (field: string, expectedFormat?: string) => new AppError(
    ErrorCode.INVALID_FORMAT,
    expectedFormat
      ? `${field} must be in ${expectedFormat} format`
      : `${field} has invalid format`,
    { field }
  ),
  
  // Business logic errors
  businessRuleViolation: (rule: string) => new AppError(
    ErrorCode.BUSINESS_RULE_VIOLATION,
    `Business rule violation: ${rule}`
  ),
  
  operationNotAllowed: (operation: string, reason?: string) => new AppError(
    ErrorCode.OPERATION_NOT_ALLOWED,
    reason 
      ? `${operation} not allowed: ${reason}`
      : `${operation} not allowed`
  ),
  
  // Resource errors
  resourceNotFound: (resource: string, identifier?: string) =>
    new NotFoundError(resource, identifier),
  
  resourceAlreadyExists: (resource: string, identifier?: string) => new AppError(
    ErrorCode.RESOURCE_ALREADY_EXISTS,
    identifier
      ? `${resource} with ID '${identifier}' already exists`
      : `${resource} already exists`,
    { context: { resource, identifier } }
  ),
  
  // External service errors
  externalServiceError: (service: string, operation?: string) =>
    new ExternalServiceError(service, new Error(operation || 'Unknown error')),
  
  // Rate limiting
  rateLimitExceeded: (retryAfter: number) => new RateLimitError(retryAfter)
};

export default {
  AppError,
  DatabaseError,
  ExternalServiceError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  BusinessLogicError,
  RateLimitError,
  globalErrorHandler,
  asyncHandler,
  notFoundHandler,
  requestIdMiddleware,
  setupErrorHandling,
  ErrorFactory
};