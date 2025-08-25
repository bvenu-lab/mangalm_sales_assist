/**
 * Authorization Middleware for Order Management
 * Enterprise-Grade Role-Based Access Control for Mangalm Sales Assistant
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { logger } from '../utils/logger';

export type UserRole = 'admin' | 'sales_manager' | 'sales_rep' | 'viewer';

export const authorizeRoles = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userRole = req.user.role as UserRole;

      if (!allowedRoles.includes(userRole)) {
        logger.warn('Unauthorized access attempt', {
          userId: req.user.id,
          userRole,
          requiredRoles: allowedRoles,
          path: req.path,
          method: req.method
        });

        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          required: allowedRoles,
          current: userRole
        });
      }

      next();
    } catch (error) {
      logger.error('Authorization middleware error', error);
      res.status(500).json({
        success: false,
        error: 'Authorization service error'
      });
    }
  };
};

export const requireStoreAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Admin and sales managers have access to all stores
    if (['admin', 'sales_manager'].includes(req.user.role)) {
      return next();
    }

    // Sales reps need specific store access
    const requestedStoreId = req.params.storeId || req.body.storeId || req.query.storeId;
    
    if (requestedStoreId && req.user.storeIds && !req.user.storeIds.includes(requestedStoreId)) {
      logger.warn('Store access denied', {
        userId: req.user.id,
        requestedStoreId,
        allowedStores: req.user.storeIds
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied for this store'
      });
    }

    next();
  } catch (error) {
    logger.error('Store access middleware error', error);
    res.status(500).json({
      success: false,
      error: 'Authorization service error'
    });
  }
};