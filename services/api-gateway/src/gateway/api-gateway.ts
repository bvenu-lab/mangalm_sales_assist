import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { SimpleAuth } from '../auth/simple-auth';
import { createAuthRoutes } from '../auth/auth-routes';
import { createCorsConfig } from '../security/cors-config';
import { setupEnterpriseApi } from '../api/enterprise-api-integration';
import { createDashboardRoutes } from '../routes/dashboard-routes';
import { createPerformanceRoutes } from '../routes/performance-routes';
import { createUpsellingRoutes } from '../routes/upselling-routes';
import { storeRoutes } from '../routes/store-routes';
import { productRoutes } from '../routes/product-routes';
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
  pathPrefix?: string;
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
    
    // Mount auth routes at both /auth and /api/auth for compatibility
    this.app.use('/auth', authRouter);
    this.app.use('/api/auth', authRouter);

    logger.info('Authentication system initialized', {
      endpoints: ['/auth/login', '/auth/logout', '/auth/me', '/auth/health',
                  '/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/auth/health']
    });
    
    // Setup dashboard routes
    const dashboardRouter = createDashboardRoutes();
    this.app.use('/api', this.authService.authenticate, dashboardRouter);
    
    // Setup performance routes
    const performanceRouter = createPerformanceRoutes();
    this.app.use('/api/sales-agent-performance', this.authService.authenticate, performanceRouter);
    
    // Setup upselling routes
    const upsellingRouter = createUpsellingRoutes();
    this.app.use('/api/upselling', this.authService.authenticate, upsellingRouter);
    
    // Setup store routes with real database connection
    this.app.use('/api', this.authService.authenticate, storeRoutes);
    
    // Setup product routes with real database connection
    this.app.use('/api', this.authService.authenticate, productRoutes);
    
    logger.info('Dashboard routes initialized', {
      endpoints: ['/api/calls/prioritized', '/api/stores/recent', '/api/orders/pending', '/api/performance/summary']
    });
    
    logger.info('Performance routes initialized', {
      endpoints: ['/api/sales-agent-performance/:period', '/api/sales-agent-performance/metric/:metric', '/api/sales-agent-performance/summary/overview']
    });
    
    logger.info('Store routes initialized', {
      endpoints: ['/api/stores', '/api/stores/:id', '/api/stores/recent', '/api/stores/regions']
    });
    
    logger.info('Product routes initialized', {
      endpoints: ['/api/products', '/api/products/:id', '/api/products/categories', '/api/products/brands']
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
      // Note: Authentication is handled internally by SimpleAuth, not proxied
      // The /api/auth and /auth routes are configured in setupAuthentication()

      // AI Prediction Service
      {
        path: '/api/predictions',
        target: 'http://localhost:3006',
        auth: true,
        rateLimit: {
          windowMs: 60 * 1000, // 1 minute
          max: 100 // 100 requests per minute
        }
      },

      // Sales data endpoints - using wildcard paths to match all sub-routes
      // Stores are now handled directly by API Gateway with database connection
      // {
      //   path: '/api/stores',
      //   target: 'http://localhost:3006',
      //   auth: true
      // },
      // Products are now handled directly by API Gateway with database connection
      // {
      //   path: '/api/products',
      //   target: 'http://localhost:3006',
      //   auth: true
      // },
      {
        path: '/api/performance',
        target: 'http://localhost:3006',
        auth: true
      },
      {
        path: '/api/calls',
        target: 'http://localhost:3006',
        auth: true
      },
      {
        path: '/api/call-prioritization',
        target: 'http://localhost:3006',
        auth: true
      },
      {
        path: '/api/orders',
        target: 'http://localhost:3006',
        auth: true
      },
      {
        path: '/mangalm/predicted-orders',
        target: 'http://localhost:3006',
        auth: true,
        pathPrefix: '/api'
      },
      {
        path: '/mangalm/invoices',
        target: 'http://localhost:3006',
        auth: true
      },
      {
        path: '/mangalm/call-prioritization',
        target: 'http://localhost:3006',
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
    // Use wildcard pattern to match all sub-paths
    const routePath = route.path.endsWith('*') ? route.path : `${route.path}*`;
    
    console.log(`[API Gateway] Creating route: ${routePath} -> ${route.target}`);
    
    // Apply rate limiting if specified
    if (route.rateLimit) {
      console.log(`[API Gateway] Applying rate limit to ${routePath}: ${route.rateLimit.max} requests per ${route.rateLimit.windowMs}ms`);
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
      
      this.app.use(routePath, limiter);
    }

    // Apply authentication if required
    if (route.auth) {
      this.app.use(routePath, this.authService.authenticate);
      
      // Apply role-based authorization if specified
      if (route.roles) {
        this.app.use(routePath, this.authService.requireRole(route.roles));
      }
    }

    // Create proxy middleware
    const proxyOptions = {
      target: route.target,
      changeOrigin: true,
      pathRewrite: (path: string) => {
        // Remove the base path for forwarding to service
        if (route.path === '/mangalm/predicted-orders' && path.startsWith('/mangalm/predicted-orders')) {
          return path.replace('/mangalm/predicted-orders', '/api/predicted-orders');
        }
        if (route.path === '/mangalm/invoices' && path.startsWith('/mangalm/invoices')) {
          return path; // Keep the path as is for invoices
        }
        return path;
      },
      onProxyReq: (proxyReq: any, req: Request) => {
        console.log(`[API Gateway] Proxying request: ${req.method} ${req.path} -> ${route.target}`);
        console.log(`[API Gateway] Request headers:`, req.headers);
        
        // Add service routing headers
        proxyReq.setHeader('X-Gateway-Route', route.path);
        proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
        
        // Forward user context if authenticated
        const user = this.authService.getCurrentUser(req);
        if (user) {
          console.log(`[API Gateway] Forwarding user context: ${user.username} (${user.role})`);
          proxyReq.setHeader('X-User-Id', user.id);
          proxyReq.setHeader('X-User-Role', user.role);
          proxyReq.setHeader('X-User-Username', user.username);
        } else {
          console.log(`[API Gateway] No user context to forward`);
        }
      },
      onProxyRes: (proxyRes: any, req: Request, res: Response) => {
        console.log(`[API Gateway] Proxy response: ${req.method} ${req.path} - Status: ${proxyRes.statusCode}`);
        // Add gateway headers to response
        res.setHeader('X-Gateway-Service', route.target);
        res.setHeader('X-Gateway-Route', route.path);
      },
      onError: (err: any, req: Request, res: Response) => {
        console.error(`[API Gateway] Proxy error for ${req.method} ${req.path}:`, err.message);
        console.error(`[API Gateway] Target service: ${route.target}`);
        console.error(`[API Gateway] Error details:`, err);
        
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
    this.app.use(routePath, proxy);

    logger.info('Route registered', {
      path: routePath,
      originalPath: route.path,
      target: route.target,
      auth: route.auth,
      roles: route.roles
    });
  }


  private getServiceStatus() {
    return {
      'ai-prediction': { url: 'http://localhost:3006', status: 'unknown' },
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