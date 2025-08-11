/**
 * Simple Authentication for API Gateway - Local Release 1
 * Self-contained authentication without external dependencies
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  passwordHash: string;
  isActive: boolean;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: Omit<User, 'passwordHash'>;
  error?: string;
}

export class SimpleAuth {
  private jwtSecret: string;
  private users: Map<string, User> = new Map();

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'local-dev-secret-change-in-production';
    this.initializeDefaultUsers();
  }

  /**
   * Create default users for local development
   */
  private initializeDefaultUsers(): void {
    // Note: In a real app, passwords would be properly hashed with bcrypt
    // For simplicity in local release 1, using basic encoding
    const adminUser: User = {
      id: 'admin-default',
      username: 'admin',
      email: 'admin@local.dev',
      role: 'admin',
      passwordHash: Buffer.from('admin123').toString('base64'),
      isActive: true
    };

    const regularUser: User = {
      id: 'user-default',
      username: 'user',
      email: 'user@local.dev',
      role: 'user',
      passwordHash: Buffer.from('user123').toString('base64'),
      isActive: true
    };

    const demoUser: User = {
      id: 'demo-default',
      username: 'demo',
      email: 'demo@local.dev',
      role: 'admin',
      passwordHash: Buffer.from('demo2025').toString('base64'),
      isActive: true
    };

    this.users.set(adminUser.username, adminUser);
    this.users.set(regularUser.username, regularUser);
    this.users.set(demoUser.username, demoUser);

    logger.info('Default users initialized', {
      admin: 'username: admin, password: admin123',
      user: 'username: user, password: user123',
      demo: 'username: demo, password: demo2025'
    });
  }

  /**
   * Authenticate user with username/password
   */
  public async login(username: string, password: string): Promise<AuthResult> {
    console.log(`[Auth] Login attempt for username: ${username}`);
    try {
      const user = this.users.get(username);
      
      if (!user || !user.isActive) {
        console.log(`[Auth] Login failed - user not found or inactive: ${username}`);
        return { success: false, error: 'Invalid username or password' };
      }

      // Simple password check (in production, use bcrypt.compare)
      const expectedPassword = Buffer.from(user.passwordHash, 'base64').toString();
      if (password !== expectedPassword) {
        console.log(`[Auth] Login failed - invalid password for: ${username}`);
        return { success: false, error: 'Invalid username or password' };
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role
        },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      const userInfo = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      };

      console.log(`[Auth] Login successful for ${username} (${user.role})`);
      console.log(`[Auth] Generated token: ${token.substring(0, 30)}...`);
      logger.info('User logged in successfully', { username });

      return {
        success: true,
        token,
        user: userInfo
      };

    } catch (error: any) {
      logger.error('Login failed', { error: error.message });
      return { success: false, error: 'Login failed' };
    }
  }

  /**
   * Middleware to authenticate JWT token
   */
  public authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log(`[Auth] Authenticating request: ${req.method} ${req.path}`);
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        console.log(`[Auth] No token provided for ${req.path}`);
        res.status(401).json({ error: 'Access token required' });
        return;
      }
      console.log(`[Auth] Token received: ${token?.substring(0, 30)}...`);

      // Verify JWT
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Get user info
      const user = Array.from(this.users.values()).find(u => u.id === decoded.userId);
      if (!user || !user.isActive) {
        console.log(`[Auth] User not found or inactive: ${decoded.userId}`);
        res.status(401).json({ error: 'User not found or inactive' });
        return;
      }
      console.log(`[Auth] Token validated for user: ${user.username} (${user.role})`);

      // Attach user info to request
      (req as any).user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };

      next();

    } catch (error: any) {
      console.log(`[Auth] Token authentication failed: ${error.message}`);
      logger.error('Token authentication failed', { error: error.message });
      res.status(403).json({ error: 'Invalid token' });
    }
  };

  /**
   * Middleware to check user role
   */
  public requireRole = (roles: string | string[]) => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = (req as any).user;
      
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!requiredRoles.includes(user.role)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    };
  };

  /**
   * Combined authentication middleware (supports both JWT and API key)
   */
  public authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // For simplicity in local release 1, only support JWT tokens
    return this.authenticateToken(req, res, next);
  };

  /**
   * Get current user from request
   */
  public getCurrentUser(req: Request): any {
    return (req as any).user;
  }

  /**
   * Basic input sanitization
   */
  public sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
    // Basic XSS protection
    const sanitizeString = (str: string): string => {
      return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    };

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
          req.body[key] = sanitizeString(req.body[key]);
        }
      }
    }

    next();
  };
}

export default SimpleAuth;