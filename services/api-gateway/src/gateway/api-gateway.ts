import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { SimpleAuth } from '../auth/simple-auth';
import { createAuthRoutes } from '../auth/auth-routes';
import { createCorsConfig } from '../security/cors-config';
import { setupEnterpriseApi } from '../api/enterprise-api-integration';
import { logger } from '../utils/logger';
import { PortManager } from '../utils/port-manager';

export interface ServiceRoute {
  path: string;
  target: string;
  auth?: boolean;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  roles?: string[];
}

export class APIGateway {
  private app: express.Application;
  private routes: ServiceRoute[] = [];
  private authService!: SimpleAuth;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupAuthentication();
    this.setupEnterpriseApi();
    this.setupRoutes();
  }

  private setupAuthentication(): void {
    // Create auth service and routes
    this.authService = new SimpleAuth();
    const authRouter = createAuthRoutes(this.authService);
    this.app.use('/auth', authRouter);

    logger.info('Authentication system initialized', {
      endpoints: ['/auth/login', '/auth/logout', '/auth/me', '/auth/health']
    });
  }

  private setupEnterpriseApi(): void {
    // Setup enterprise API features
    setupEnterpriseApi(this.app, {
      serviceName: 'Mangalm API Gateway',
      version: '1.0.0',
      enableAnalytics: true,
      enableOpenAPI: true,
      enableVersioning: true,
      enableHealthCheck: true
    });

    logger.info('Enterprise API features initialized', {
      features: ['OpenAPI docs', 'Analytics', 'Versioning', 'Health checks'],
      endpoints: ['/api-docs', '/api/metrics/dashboard', '/api/v1/stores', '/health']
    });
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS configuration - use secure configuration
    this.app.use(createCorsConfig());

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('API Gateway Request', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('user-agent'),
          ip: req.ip
        });
      });
      
      next();
    });
  }

  private setupRoutes(): void {
    // Define service routes
    this.routes = [
      // Authentication service (AI Prediction Service handles auth for now)
      {
        path: '/api/auth',
        target: 'http://localhost:3004',
        auth: false, // Auth endpoints don't require auth
        rateLimit: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 10 // limit each IP to 10 requests per windowMs
        }
      },

      // AI Prediction Service
      {
        path: '/api/predictions',
        target: 'http://localhost:3004',
        auth: true,
        rateLimit: {
          windowMs: 60 * 1000, // 1 minute
          max: 100 // 100 requests per minute
        }
      },

      // Sales data endpoints (stores, products, performance)
      {
        path: '/api/stores',
        target: 'http://localhost:3004',
        auth: true
      },
      {
        path: '/api/products',
        target: 'http://localhost:3004',
        auth: true
      },
      {
        path: '/api/performance',
        target: 'http://localhost:3004',
        auth: true
      },
      {
        path: '/api/calls',
        target: 'http://localhost:3004',
        auth: true
      },
      {
        path: '/api/orders',
        target: 'http://localhost:3004',
        auth: true
      },

      // PM Agent Orchestrator
      {
        path: '/api/projects',
        target: 'http://localhost:3003',
        auth: true,
        roles: ['admin', 'project_manager']
      },
      {
        path: '/api/orchestrator',
        target: 'http://localhost:3003',
        auth: true,
        roles: ['admin']
      },
      {
        path: '/api/tasks',
        target: 'http://localhost:3003',
        auth: true,
        roles: ['admin', 'project_manager']
      },

      // Zoho Integration (when available)
      {
        path: '/api/zoho',
        target: 'http://localhost:3002',
        auth: true,
        roles: ['admin']
      }
    ];

    // Create proxy middlewares for each route
    this.routes.forEach(route => {
      this.createRoute(route);
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date(),
        gateway: 'api-gateway',
        services: this.getServiceStatus()
      });
    });

    // Gateway status endpoint
    this.app.get('/gateway/status', this.authService.authenticate, (req: Request, res: Response) => {
      res.json({
        status: 'operational',
        routes: this.routes.length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: this.getServiceStatus()
      });
    });
  }

  private createRoute(route: ServiceRoute): void {
    // Apply rate limiting if specified
    if (route.rateLimit) {
      const limiter = rateLimit({
        windowMs: route.rateLimit.windowMs,
        max: route.rateLimit.max,
        message: {
          error: 'Too many requests',
          retryAfter: Math.ceil(route.rateLimit.windowMs / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false
      });
      
      this.app.use(route.path, limiter);
    }

    // Apply authentication if required
    if (route.auth) {
      this.app.use(route.path, this.authService.authenticate);
      
      // Apply role-based authorization if specified
      if (route.roles) {
        this.app.use(route.path, this.authService.requireRole(route.roles));
      }
    }

    // Create proxy middleware
    const proxyOptions = {
      target: route.target,
      changeOrigin: true,
      pathRewrite: (path: string) => {
        // Remove the base path for forwarding to service
        return path;
      },
      onProxyReq: (proxyReq: any, req: Request) => {
        // Add service routing headers
        proxyReq.setHeader('X-Gateway-Route', route.path);
        proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
        
        // Forward user context if authenticated
        const user = this.authService.getCurrentUser(req);
        if (user) {
          proxyReq.setHeader('X-User-Id', user.id);
          proxyReq.setHeader('X-User-Role', user.role);
          proxyReq.setHeader('X-User-Username', user.username);
        }
      },
      onProxyRes: (proxyRes: any, req: Request, res: Response) => {
        // Add gateway headers to response
        res.setHeader('X-Gateway-Service', route.target);
        res.setHeader('X-Gateway-Route', route.path);
      },
      onError: (err: any, req: Request, res: Response) => {
        logger.error('Proxy error', {
          route: route.path,
          target: route.target,
          error: err.message,
          path: req.path
        });

        res.status(503).json({
          error: 'Service unavailable',
          message: 'The requested service is temporarily unavailable',
          route: route.path
        });
      }
    };

    const proxy = createProxyMiddleware(proxyOptions);
    this.app.use(route.path, proxy);

    logger.info('Route registered', {
      path: route.path,
      target: route.target,
      auth: route.auth,
      roles: route.roles
    });
  }


  private getServiceStatus() {
    return {
      'ai-prediction': { url: 'http://localhost:3004', status: 'unknown' },
      'pm-orchestrator': { url: 'http://localhost:3003', status: 'unknown' },
      'zoho-integration': { url: 'http://localhost:3002', status: 'unknown' }
    };
  }

  public getApp(): express.Application {
    return this.app;
  }

  public async start(port: number): Promise<void> {
    const portManager = new PortManager('API Gateway', port, true);
    
    try {
      const availablePort = await portManager.preparePort();
      
      this.app.listen(availablePort, () => {
        logger.info('API Gateway started', {
          port: availablePort,
          requestedPort: port,
          portChanged: availablePort !== port,
          routes: this.routes.length,
          services: Object.keys(this.getServiceStatus()).length
        });
      });
    } catch (error) {
      logger.error('Failed to start API Gateway', {
        requestedPort: port,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}