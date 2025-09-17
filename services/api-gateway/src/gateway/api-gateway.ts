import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createAPIRateLimit, createStrictRateLimit } from '../middleware/rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
// Auth routes removed - no authentication needed
import { createCorsConfig } from '../security/cors-config';
import { setupEnterpriseApi } from '../api/enterprise-api-integration';
import { createDashboardRoutes } from '../routes/dashboard-routes';
import { createPerformanceRoutes } from '../routes/performance-routes';
import { createUpsellingRoutes } from '../routes/upselling-routes';
import { createAnalyticsRoutes } from '../routes/analytics-routes';
import { storeRoutes } from '../routes/store-routes';
import { productRoutes } from '../routes/product-routes';
import { orderRoutes, importLocalHandler } from '../routes/order-routes';
import { documentRoutes } from '../routes/document-routes';
import { predictedOrdersRoutes } from '../routes/predicted-orders-routes';
import { testUploadRoutes } from '../routes/test-upload-routes';
import { productAlertsRoutes } from '../routes/product-alerts-routes';
import { createCompleteCRUDRoutes } from '../routes/complete-crud-routes';
import enterpriseUploadRoutes, { setupWebSocket } from '../routes/enterprise-upload-routes';
import { feedbackRoutes } from '../routes/feedback-routes';
import { logger } from '../utils/logger';
import { PortManager } from '../utils/port-manager';
// Cloud-agnostic database (SQLite local, PostgreSQL cloud)
const { getDatabase } = require('../../../../shared/database/cloud-agnostic-db');
import sqliteRoutes from '../routes/sqlite-routes';

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
  private server: any;
  private io: SocketServer | null = null;
  private routes: ServiceRoute[] = [];

  constructor() {
    this.app = express();
    this.setupMiddleware();
    
    // Initialize cloud-agnostic database connection
    try {
      const db = getDatabase();
      // Database initialization will happen on first query
      logger.info('Cloud-agnostic database initialized', {
        type: process.env.DATABASE_TYPE || 'sqlite',
        cloud_ready: process.env.DATABASE_TYPE === 'postgresql'
      });
    } catch (error) {
      logger.error('Failed to initialize cloud-agnostic database', { error });
    }
    
    // Set up test routes BEFORE authentication
    this.app.use('/test', testUploadRoutes);
    
    this.setupAuthentication();
    this.setupEnterpriseApi();
    this.setupRoutes();
  }

  private setupAuthentication(): void {
    // No authentication needed - all endpoints are public
    logger.info('No authentication required - all endpoints are public');
    
    // Setup document routes FIRST (WITHOUT auth for public uploads)
    this.app.use('/api/documents', documentRoutes);
    logger.info('Document routes initialized (public access)', {
      endpoints: ['/api/documents/upload', '/api/documents/ocr/process', '/api/documents/ocr/health']
    });
    
    // Setup local import endpoint (WITHOUT auth for local testing)
    this.app.post('/api/orders/import-local', importLocalHandler);
    
    logger.info('CSV import endpoints initialized (public access)', {
      endpoints: ['/api/orders/import-local']
    });
    
    // TEMPORARILY DISABLE AUTHENTICATION FOR TESTING
    // Setup SQLite-based routes for real database connection
    this.app.use('/api', sqliteRoutes);
    logger.info('SQLite routes initialized for real database access');
    
    // Setup performance routes  
    const performanceRouter = createPerformanceRoutes();
    this.app.use('/api/sales-agent-performance', performanceRouter);
    
    // Setup upselling routes
    const upsellingRouter = createUpsellingRoutes();
    this.app.use('/api/upselling', upsellingRouter);
    
    // Setup analytics routes
    const analyticsRouter = createAnalyticsRoutes();
    this.app.use('/api/analytics', analyticsRouter);
    logger.info('Analytics routes initialized', {
      endpoints: ['/api/analytics/trends', '/api/analytics/product-distribution', '/api/analytics/performance-metrics', '/api/analytics/insights']
    });

    // Setup feedback routes
    this.app.use('/api', feedbackRoutes);
    logger.info('Feedback routes initialized', {
      endpoints: ['/api/feedback/submit', '/api/feedback/stats']
    });
    
    // Setup store routes with real database connection
    this.app.use('/api', storeRoutes);
    
    // Setup complete CRUD routes for all entities with persistence
    const completeCRUDRouter = createCompleteCRUDRoutes();
    this.app.use('/api', completeCRUDRouter);
    logger.info('Complete CRUD routes initialized', {
      endpoints: [
        '/api/predicted-orders', 
        '/api/stores/:id/preferences',
        '/api/dashboard-settings/:userId',
        '/api/orders/:id',
        '/api/user-actions',
        '/api/dashboard/summary'
      ]
    });
    
    // Setup product routes with real database connection
    this.app.use('/api', productRoutes);

    // Setup predicted orders routes BEFORE order routes to avoid :id matching
    this.app.use('/api', predictedOrdersRoutes);
    logger.info('Predicted orders routes initialized', {
      endpoints: ['/api/orders/predicted', '/api/orders/pending']
    });

    // Setup order routes WITHOUT authentication for testing
    this.app.use('/api', orderRoutes);

    // Setup product alerts routes
    this.app.use('/api', productAlertsRoutes);
    
    // Setup enterprise upload routes with WebSocket support
    this.app.use('/api/enterprise', enterpriseUploadRoutes);
    
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
    
    logger.info('Order routes initialized', {
      endpoints: ['/api/orders', '/api/orders/:id', '/api/orders/generate', '/api/orders/:id/confirm', '/api/orders/:id/reject', '/api/orders/analytics']
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

    // Apply global rate limiting - CRITICAL SECURITY FIX
    // Standard rate limit for all API endpoints
    this.app.use('/api/', createAPIRateLimit());
    
    // Stricter rate limit for sensitive operations
    this.app.use('/api/orders/generate', createStrictRateLimit());
    this.app.use('/api/enterprise/upload', createStrictRateLimit());
    
    logger.info('Rate limiting enabled', {
      standard: '100 requests per minute for /api/*',
      strict: '60 requests per minute for sensitive endpoints'
    });

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

      // Document Processor Service - Handled directly in gateway for now
      // {
      //   path: '/api/documents',
      //   target: 'http://localhost:3010',
      //   auth: true,
      //   rateLimit: {
      //     windowMs: 60 * 1000, // 1 minute
      //     max: 10 // 10 uploads per minute
      //   }
      // },
      
      // AI Prediction Service - Using local ML algorithms (no external API calls)
      {
        path: '/api/predictions',
        target: 'http://localhost:3001',
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
      // Performance is handled directly by API Gateway
      // {
      //   path: '/api/performance',
      //   target: 'http://localhost:3006',
      //   auth: true
      // },
      // Call prioritization handled by AI service with ML algorithms
      {
        path: '/api/call-prioritization',
        target: 'http://localhost:3001',
        auth: true
      },
      // Orders are now handled directly by API Gateway with database connection
      // {
      //   path: '/api/orders',
      //   target: 'http://localhost:3006',
      //   auth: true
      // },
      // Predicted orders handled directly by API Gateway
      // {
      //   path: '/mangalm/predicted-orders',
      //   target: 'http://localhost:3006',
      //   auth: true,
      //   pathPrefix: '/api'
      // },
      // Invoices handled directly by API Gateway
      // {
      //   path: '/mangalm/invoices',
      //   target: 'http://localhost:3006',
      //   auth: true
      // },
      // Call prioritization handled directly by API Gateway
      // {
      //   path: '/mangalm/call-prioritization',
      //   target: 'http://localhost:3006',
      //   auth: true
      // },

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

    // Gateway status endpoint (no auth)
    this.app.get('/gateway/status', (req: Request, res: Response) => {
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
      
      this.app.use(routePath, limiter as any);
    }

    // No authentication - skip auth middleware
    if (route.auth) {
      console.log(`[API Gateway] Skipping authentication for ${routePath} (auth disabled)`);
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
        
        // Forward default user context (no auth)
        console.log(`[API Gateway] Forwarding default user context`);
        proxyReq.setHeader('X-User-Id', 'default-user');
        proxyReq.setHeader('X-User-Role', 'admin');
        proxyReq.setHeader('X-User-Username', 'default');
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
      'zoho-integration': { url: 'http://localhost:3002', status: 'unknown' },
      'document-processor': { url: 'http://localhost:3010', status: 'unknown' }
    };
  }

  public getApp(): express.Application {
    return this.app;
  }

  public async start(port: number): Promise<void> {
    const portManager = new PortManager('API Gateway', port, true);
    
    try {
      const availablePort = await portManager.preparePort();
      
      // Create HTTP server
      this.server = createServer(this.app);
      
      // Initialize WebSocket server
      this.io = new SocketServer(this.server, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST']
        }
      });
      
      // Setup WebSocket for enterprise upload
      setupWebSocket(this.io);
      
      this.server.listen(availablePort, () => {
        logger.info('API Gateway started with WebSocket support', {
          port: availablePort,
          requestedPort: port,
          portChanged: availablePort !== port,
          routes: this.routes.length,
          services: Object.keys(this.getServiceStatus()).length,
          websocket: true
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