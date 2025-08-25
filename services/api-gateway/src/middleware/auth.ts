/**
 * Authentication Middleware for Order Management
 * Enterprise-Grade Authentication for Mangalm Sales Assistant API Gateway
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    storeIds?: string[];
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required'
      });
    }

    // Use a default secret for now - in production this should be from environment
    const secret = process.env.JWT_SECRET || 'your-secret-key';

    jwt.verify(token, secret, (err: any, decoded: any) => {
      if (err) {
        logger.warn('Invalid token provided', { error: err.message });
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }

      req.user = decoded as AuthenticatedRequest['user'];
      next();
    });
  } catch (error) {
    logger.error('Authentication middleware error', error);
    res.status(500).json({
      success: false,
      error: 'Authentication service error'
    });
  }
};

export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // Continue without authentication
  }

  const secret = process.env.JWT_SECRET || 'your-secret-key';

  try {
    const decoded = jwt.verify(token, secret) as AuthenticatedRequest['user'];
    req.user = decoded;
  } catch (error) {
    // Continue without authentication on invalid token
    logger.debug('Optional auth failed, continuing without user context', { error });
  }

  next();
};