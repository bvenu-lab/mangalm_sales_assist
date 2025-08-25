import { Request, Response, NextFunction } from 'express';
import * as winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

declare global {
  namespace Express {
    interface Request {
      user?: any;
      correlationId?: string;
    }
  }
}

/**
 * Audit logging middleware for tracking user actions
 */
export const audit = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // Log the start of the action
    logger.info('Audit: Action started', {
      action,
      correlationId: req.correlationId,
      user: req.user?.id || 'anonymous',
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Capture the original send method
    const originalSend = res.send;
    
    // Override the send method to log the response
    res.send = function(data: any) {
      const duration = Date.now() - startTime;
      
      logger.info('Audit: Action completed', {
        action,
        correlationId: req.correlationId,
        user: req.user?.id || 'anonymous',
        statusCode: res.statusCode,
        duration,
        success: res.statusCode < 400
      });
      
      // Call the original send method
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Simple audit middleware without action parameter
 */
export const simpleAudit = (req: Request, res: Response, next: NextFunction): void => {
  logger.info('Audit: Request received', {
    correlationId: req.correlationId,
    user: req.user?.id || 'anonymous',
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.method === 'POST' || req.method === 'PUT' ? '[REDACTED]' : undefined,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  next();
};

export default {
  audit,
  simpleAudit
};