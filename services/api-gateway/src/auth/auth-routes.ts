/**
 * Simple Authentication Routes for API Gateway - Local Release 1
 */

import { Router, Request, Response } from 'express';
import { SimpleAuth } from './simple-auth';
import { logger } from '../utils/logger';

export function createAuthRoutes(auth: SimpleAuth): Router {
  const router = Router();

  // Apply input sanitization to all routes
  router.use(auth.sanitizeInput);

  /**
   * POST /auth/login
   * Authenticate user with username/password
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      const result = await auth.login(username, password);

      if (result.success) {
        res.json({
          success: true,
          token: result.token,
          user: result.user
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error
        });
      }

    } catch (error: any) {
      logger.error('Login endpoint error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * POST /auth/logout
   * Logout user (token invalidation would be more complex in a full implementation)
   */
  router.post('/logout', auth.authenticateToken, async (req: Request, res: Response) => {
    try {
      // In a full implementation, we'd add the token to a blacklist
      // For local release 1, we just return success
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error: any) {
      logger.error('Logout endpoint error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /auth/me
   * Get current user information
   */
  router.get('/me', auth.authenticate, (req: Request, res: Response) => {
    try {
      const user = auth.getCurrentUser(req);

      res.json({
        success: true,
        user
      });

    } catch (error: any) {
      logger.error('Me endpoint error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /auth/health
   * Health check for auth service
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'api-gateway-auth'
    });
  });

  return router;
}

export default createAuthRoutes;