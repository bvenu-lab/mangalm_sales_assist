/**
 * Simple Authentication Service for Local Release 1
 * Practical, functional authentication without over-engineering
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { RedisCache } from '../cache/redis-cache';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  passwordHash: string;
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  tokenExpiry: string;
  saltRounds: number;
  enableApiKeys: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: Omit<User, 'passwordHash'>;
  error?: string;
}

export class SimpleAuthService {
  private config: AuthConfig;
  private cache: RedisCache;
  private users: Map<string, User> = new Map();
  private apiKeys: Map<string, { userId: string; name: string }> = new Map();

  constructor(config: AuthConfig, cache?: RedisCache) {
    this.config = {
      jwtSecret: config.jwtSecret || process.env.JWT_SECRET || 'local-dev-secret',
      tokenExpiry: config.tokenExpiry || '24h',
      saltRounds: config.saltRounds || 10,
      enableApiKeys: config.enableApiKeys || true
    };
    
    this.cache = cache || new RedisCache({ keyPrefix: 'auth:' });
    this.initializeDefaultUsers();

    logger.info('Simple Auth Service initialized', {
      enableApiKeys: this.config.enableApiKeys
    });
  }

  /**
   * Authenticate user with username/password
   */
  public async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      const user = Array.from(this.users.values()).find(
        u => u.username === credentials.username && u.isActive
      );

      if (!user) {
        return { success: false, error: 'Invalid username or password' };
      }

      const validPassword = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!validPassword) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Update last login
      user.lastLoginAt = new Date();
      this.users.set(user.id, user);

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username,
          role: user.role 
        },
        this.config.jwtSecret,
        { expiresIn: this.config.tokenExpiry }
      );

      // Store token in cache for session management
      await this.cache.set(`token:${token}`, user.id, { ttl: 86400 }); // 24 hours

      const userInfo = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        isActive: user.isActive
      };

      logger.info('User logged in successfully', {
        userId: user.id,
        username: user.username
      });

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
   * Create new user (for local setup)
   */
  public async createUser(userData: {
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'user';
  }): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = Array.from(this.users.values()).find(
        u => u.username === userData.username || u.email === userData.email
      );

      if (existingUser) {
        return { success: false, error: 'User already exists' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, this.config.saltRounds);

      // Create user
      const user: User = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: userData.username,
        email: userData.email,
        role: userData.role || 'user',
        passwordHash,
        createdAt: new Date(),
        isActive: true
      };

      this.users.set(user.id, user);

      const userInfo = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        isActive: user.isActive
      };

      logger.info('User created successfully', {
        userId: user.id,
        username: user.username,
        role: user.role
      });

      return { success: true, user: userInfo };

    } catch (error: any) {
      logger.error('Failed to create user', { error: error.message });
      return { success: false, error: 'Failed to create user' };
    }
  }

  /**
   * Logout user (invalidate token)
   */
  public async logout(token: string): Promise<void> {
    try {
      await this.cache.delete(`token:${token}`);
      logger.info('User logged out successfully');
    } catch (error: any) {
      logger.error('Logout failed', { error: error.message });
    }
  }

  /**
   * Middleware to authenticate JWT token
   */
  public authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
      }

      // Check if token is in cache (not revoked)
      const userId = await this.cache.get(`token:${token}`);
      if (!userId) {
        res.status(401).json({ error: 'Token invalid or expired' });
        return;
      }

      // Verify JWT
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      
      // Get user info
      const user = this.users.get(decoded.userId);
      if (!user || !user.isActive) {
        res.status(401).json({ error: 'User not found or inactive' });
        return;
      }

      // Attach user info to request
      (req as any).user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };

      next();

    } catch (error: any) {
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
   * Generate API key for programmatic access
   */
  public async generateApiKey(userId: string, name: string): Promise<string | null> {
    if (!this.config.enableApiKeys) {
      return null;
    }

    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const apiKey = `ak_${Date.now()}_${Math.random().toString(36).substr(2, 20)}`;
      this.apiKeys.set(apiKey, { userId, name });

      // Store in cache
      await this.cache.set(`apikey:${apiKey}`, { userId, name }, { ttl: 0 });

      logger.info('API key generated', { userId, name });
      return apiKey;

    } catch (error: any) {
      logger.error('Failed to generate API key', { error: error.message });
      return null;
    }
  }

  /**
   * Middleware to authenticate API key
   */
  public authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!this.config.enableApiKeys) {
      res.status(401).json({ error: 'API key authentication disabled' });
      return;
    }

    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        res.status(401).json({ error: 'API key required' });
        return;
      }

      // Check API key
      let apiKeyData = await this.cache.get(`apikey:${apiKey}`);
      if (!apiKeyData) {
        apiKeyData = this.apiKeys.get(apiKey);
        if (!apiKeyData) {
          res.status(401).json({ error: 'Invalid API key' });
          return;
        }
      }

      // Get user
      const user = this.users.get(apiKeyData.userId);
      if (!user || !user.isActive) {
        res.status(401).json({ error: 'User not found or inactive' });
        return;
      }

      // Attach user info to request
      (req as any).user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };

      (req as any).authMethod = 'apikey';

      next();

    } catch (error: any) {
      logger.error('API key authentication failed', { error: error.message });
      res.status(403).json({ error: 'Invalid API key' });
    }
  };

  /**
   * Combined authentication middleware (JWT or API key)
   */
  public authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const hasApiKey = req.headers['x-api-key'];
    const hasToken = req.headers.authorization;

    if (hasApiKey) {
      return this.authenticateApiKey(req, res, next);
    } else if (hasToken) {
      return this.authenticateToken(req, res, next);
    } else {
      res.status(401).json({ error: 'Authentication required (provide token or API key)' });
    }
  };

  /**
   * Get current user from request
   */
  public getCurrentUser(req: Request): any {
    return (req as any).user;
  }

  /**
   * List all users (admin only)
   */
  public getUsers(): Omit<User, 'passwordHash'>[] {
    return Array.from(this.users.values()).map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive
    }));
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

  // Private methods

  private initializeDefaultUsers(): void {
    // Create default admin user for local development
    const defaultAdmin: User = {
      id: 'admin-default',
      username: 'admin',
      email: 'admin@local.dev',
      role: 'admin',
      passwordHash: bcrypt.hashSync('admin123', this.config.saltRounds),
      createdAt: new Date(),
      isActive: true
    };

    // Create default regular user
    const defaultUser: User = {
      id: 'user-default',
      username: 'user',
      email: 'user@local.dev',
      role: 'user',
      passwordHash: bcrypt.hashSync('user123', this.config.saltRounds),
      createdAt: new Date(),
      isActive: true
    };

    this.users.set(defaultAdmin.id, defaultAdmin);
    this.users.set(defaultUser.id, defaultUser);

    logger.info('Default users created', {
      admin: 'username: admin, password: admin123',
      user: 'username: user, password: user123'
    });
  }
}

export default SimpleAuthService;