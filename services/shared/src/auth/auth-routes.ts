/**
 * Simple Authentication Routes for Local Release 1
 * Provides login, logout, register, and user management endpoints
 */

import { Router, Request, Response } from 'express';
import { SimpleAuthService } from './simple-auth-service';
import { RedisCache } from '../cache/redis-cache';
import { logger } from '../utils/logger';

export interface AuthRoutesOptions {
  enableRegistration?: boolean;
  enableUserManagement?: boolean;
  adminOnly?: boolean;
}

export function createAuthRoutes(
  authService: SimpleAuthService,
  options: AuthRoutesOptions = {}
): Router {
  const router = Router();
  const { enableRegistration = true, enableUserManagement = true, adminOnly = false } = options;

  // Apply input sanitization to all routes
  router.use(authService.sanitizeInput);

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

      const result = await authService.login({ username, password });

      if (result.success) {
        logger.info('User login successful', { username });
        res.json({
          success: true,
          token: result.token,
          user: result.user
        });
      } else {
        logger.warn('User login failed', { username });
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
   * Logout user (invalidate token)
   */
  router.post('/logout', authService.authenticateToken, async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        await authService.logout(token);
      }

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
   * POST /auth/register
   * Create new user account (if registration is enabled)
   */
  if (enableRegistration) {
    router.post('/register', async (req: Request, res: Response) => {
      try {
        const { username, email, password, role } = req.body;

        if (!username || !email || !password) {
          return res.status(400).json({
            success: false,
            error: 'Username, email, and password are required'
          });
        }

        // Validate password strength for local use (basic)
        if (password.length < 6) {
          return res.status(400).json({
            success: false,
            error: 'Password must be at least 6 characters long'
          });
        }

        // Only admins can create admin users (if adminOnly is true)
        const requestedRole = role || 'user';
        if (adminOnly && requestedRole === 'admin') {
          const user = authService.getCurrentUser(req);
          if (!user || user.role !== 'admin') {
            return res.status(403).json({
              success: false,
              error: 'Admin privileges required to create admin users'
            });
          }
        }

        const result = await authService.createUser({
          username,
          email,
          password,
          role: requestedRole
        });

        if (result.success) {
          logger.info('User registration successful', { username, email });
          res.status(201).json({
            success: true,
            user: result.user
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error
          });
        }

      } catch (error: any) {
        logger.error('Registration endpoint error', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });
  }

  /**
   * GET /auth/me
   * Get current user information
   */
  router.get('/me', authService.authenticate, (req: Request, res: Response) => {
    try {
      const user = authService.getCurrentUser(req);
      const authMethod = (req as any).authMethod || 'token';

      res.json({
        success: true,
        user,
        authMethod
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
   * GET /auth/users
   * List all users (admin only)
   */
  if (enableUserManagement) {
    router.get('/users', 
      authService.authenticate,
      authService.requireRole('admin'),
      (req: Request, res: Response) => {
        try {
          const users = authService.getUsers();
          res.json({
            success: true,
            users
          });

        } catch (error: any) {
          logger.error('Users list endpoint error', { error: error.message });
          res.status(500).json({
            success: false,
            error: 'Internal server error'
          });
        }
      }
    );
  }

  /**
   * POST /auth/api-key
   * Generate API key for programmatic access
   */
  router.post('/api-key',
    authService.authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const user = authService.getCurrentUser(req);
        const { name } = req.body;

        if (!name) {
          return res.status(400).json({
            success: false,
            error: 'API key name is required'
          });
        }

        const apiKey = await authService.generateApiKey(user.id, name);

        if (apiKey) {
          res.json({
            success: true,
            apiKey,
            name
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Failed to generate API key'
          });
        }

      } catch (error: any) {
        logger.error('API key generation error', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * GET /auth/health
   * Health check for auth service
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'simple-auth-service'
    });
  });

  return router;
}

/**
 * Create default auth service instance and routes
 */
export function createDefaultAuthRoutes(options: AuthRoutesOptions = {}): {
  authService: SimpleAuthService;
  router: Router;
} {
  const cache = new RedisCache({ keyPrefix: 'auth:' });
  
  const authService = new SimpleAuthService({
    jwtSecret: process.env.JWT_SECRET || 'local-dev-secret-change-in-production',
    tokenExpiry: '24h',
    saltRounds: 10,
    enableApiKeys: true
  }, cache);

  const router = createAuthRoutes(authService, options);

  return { authService, router };
}

export default createAuthRoutes;