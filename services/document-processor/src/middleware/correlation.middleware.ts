import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware to add correlation ID to requests for tracking
 */
export const correlationId = (req: Request, res: Response, next: NextFunction): void => {
  // Check if correlation ID exists in headers, otherwise generate new one
  const id = req.headers['x-correlation-id'] as string || 
             req.headers['x-request-id'] as string || 
             uuidv4();
  
  // Attach to request object
  req.correlationId = id;
  
  // Add to response headers
  res.setHeader('X-Correlation-Id', id);
  
  next();
};

export default correlationId;