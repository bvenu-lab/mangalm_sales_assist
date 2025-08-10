/**
 * Enterprise API Integration for Mangalm API Gateway
 * Integration of all enterprise API standards and systems
 */

import { Application, Request, Response, NextFunction, Router } from 'express';
import { logger } from '../utils/logger';

// Import types for consistency
interface EnterpriseApiConfig {
  serviceName: string;
  version: string;
  enableAnalytics: boolean;
  enableOpenAPI: boolean;
  enableVersioning: boolean;
  enableHealthCheck: boolean;
  cacheConfig?: {
    host: string;
    port: number;
    password?: string;
  };
}

/**
 * Self-contained OpenAPI Configuration
 */
const openApiConfig = {
  title: 'Mangalm Sales Assistant API',
  description: 'Comprehensive API for the Mangalm Sales Assistant system with AI-powered predictions, store management, and Zoho integration.',
  version: '1.0.0',
  serverUrl: process.env.API_GATEWAY_URL || 'http://localhost:3007',
  contact: {
    name: 'Mangalm API Team',
    email: 'api@mangalm.com',
    url: 'https://mangalm.com/contact'
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT'
  },
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization'
    },
    {
      name: 'Stores',
      description: 'Store management operations'
    },
    {
      name: 'Products',
      description: 'Product catalog management'
    },
    {
      name: 'Orders',
      description: 'Order processing and tracking'
    },
    {
      name: 'Predictions',
      description: 'AI-powered sales predictions'
    },
    {
      name: 'Zoho Integration',
      description: 'Zoho CRM synchronization'
    },
    {
      name: 'Analytics',
      description: 'Performance analytics and reporting'
    }
  ]
};

/**
 * Simple Analytics System (self-contained)
 */
class SimpleAnalyticsEngine {
  private metrics: any[] = [];
  private maxMetrics = 1000;

  public async recordMetrics(metrics: any): Promise<void> {
    this.metrics.push({
      ...metrics,
      timestamp: new Date()
    });

    // Keep only last 1000 metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  public async getDashboardMetrics(): Promise<any> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    const recentMetrics = this.metrics.filter(m => new Date(m.timestamp) >= oneMinuteAgo);
    
    return {
      currentRpm: recentMetrics.length,
      averageResponseTime: recentMetrics.length ? 
        recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length : 0,
      errorRate: recentMetrics.length ?
        (recentMetrics.filter(m => m.statusCode >= 400).length / recentMetrics.length) * 100 : 0,
      activeEndpoints: new Set(recentMetrics.map(m => m.endpoint)).size,
      totalRequests: this.metrics.length,
      recentErrors: recentMetrics.filter(m => m.statusCode >= 400).slice(-5)
    };
  }
}

/**
 * Simple API Version Manager (self-contained)
 */
class SimpleVersionManager {
  private versions = new Map([
    ['1.0.0', { version: '1.0.0', isDeprecated: false, description: 'Current stable version' }]
  ]);

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const version = req.headers['api-version'] as string || '1.0.0';
      (req as any).apiVersion = version;
      res.set('API-Version', version);
      next();
    };
  }
}

/**
 * Simple Error Response Builder
 */
class SimpleResponseBuilder {
  private request: Request;
  private startTime: number;

  constructor(req: Request) {
    this.request = req;
    this.startTime = Date.now();
    
    if (!(req as any).id) {
      (req as any).id = this.generateId();
    }
  }

  public success<T>(data: T): any {
    return {
      success: true,
      data,
      meta: {
        requestId: (this.request as any).id,
        timestamp: new Date().toISOString(),
        version: (this.request as any).apiVersion || '1.0.0',
        timing: {
          processingTime: Date.now() - this.startTime
        }
      }
    };
  }

  public error(code: string, message: string, details?: any): any {
    return {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        requestId: (this.request as any).id,
        timestamp: new Date().toISOString(),
        version: (this.request as any).apiVersion || '1.0.0',
        timing: {
          processingTime: Date.now() - this.startTime
        }
      }
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}

/**
 * Simple OpenAPI Generator (self-contained)
 */
class SimpleOpenAPIGenerator {
  public generateSpec(): any {
    return {
      openapi: '3.0.3',
      info: {
        title: openApiConfig.title,
        description: openApiConfig.description,
        version: openApiConfig.version,
        contact: openApiConfig.contact,
        license: openApiConfig.license
      },
      servers: [
        { url: openApiConfig.serverUrl, description: 'Main API Server' }
      ],
      tags: openApiConfig.tags,
      paths: {
        '/auth/login': {
          post: {
            tags: ['Authentication'],
            summary: 'User login',
            description: 'Authenticate user with username and password',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      username: { type: 'string', example: 'admin' },
                      password: { type: 'string', example: 'admin123' }
                    },
                    required: ['username', 'password']
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Successful authentication',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean', example: true },
                        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            username: { type: 'string' },
                            role: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              },
              '401': {
                description: 'Authentication failed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string', example: 'Invalid username or password' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/stores': {
          get: {
            tags: ['Stores'],
            summary: 'List stores',
            description: 'Get a list of all stores with pagination and filtering',
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'page',
                in: 'query',
                description: 'Page number',
                schema: { type: 'integer', minimum: 1, default: 1 }
              },
              {
                name: 'limit',
                in: 'query',
                description: 'Items per page',
                schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
              },
              {
                name: 'search',
                in: 'query',
                description: 'Search term',
                schema: { type: 'string' }
              }
            ],
            responses: {
              '200': {
                description: 'List of stores',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean', example: true },
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              address: { type: 'string' },
                              city: { type: 'string' },
                              state: { type: 'string' },
                              totalOrders: { type: 'integer' },
                              totalRevenue: { type: 'number' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/predictions': {
          post: {
            tags: ['Predictions'],
            summary: 'Generate prediction',
            description: 'Generate AI-powered sales predictions',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      storeId: { type: 'string', format: 'uuid' },
                      type: { 
                        type: 'string',
                        enum: ['sales', 'inventory', 'demand', 'revenue']
                      },
                      timeframe: {
                        type: 'string',
                        enum: ['week', 'month', 'quarter', 'year'],
                        default: 'month'
                      }
                    },
                    required: ['storeId', 'type']
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Prediction generated successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean', example: true },
                        data: {
                          type: 'object',
                          properties: {
                            prediction: { type: 'number' },
                            confidence: { type: 'number' },
                            factors: { type: 'array', items: { type: 'string' } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    };
  }

  public setupSwaggerUI(app: Application, basePath: string = '/api-docs'): void {
    try {
      const swaggerUi = require('swagger-ui-express');
      const specs = this.generateSpec();
      
      app.use(basePath, swaggerUi.serve);
      app.get(basePath, swaggerUi.setup(specs, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Mangalm API Documentation',
        swaggerOptions: {
          persistAuthorization: true,
          displayOperationId: true,
          docExpansion: 'list'
        }
      }));

      app.get(`${basePath}.json`, (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(specs);
      });
      
      logger.info('Swagger UI setup complete', { basePath });
    } catch (error) {
      logger.warn('Swagger UI not available, serving raw OpenAPI spec only', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback: serve raw OpenAPI spec
      const specs = this.generateSpec();
      app.get(basePath, (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(specs);
      });
      
      app.get(`${basePath}.json`, (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(specs);
      });
    }
  }
}

/**
 * Enterprise API Integration Class
 */
export class EnterpriseApiIntegration {
  private analytics: SimpleAnalyticsEngine;
  private versionManager: SimpleVersionManager;
  private openApiGenerator: SimpleOpenAPIGenerator;
  private config: EnterpriseApiConfig;

  constructor(config: EnterpriseApiConfig) {
    this.config = config;
    this.analytics = new SimpleAnalyticsEngine();
    this.versionManager = new SimpleVersionManager();
    this.openApiGenerator = new SimpleOpenAPIGenerator();
  }

  /**
   * Setup complete enterprise API system
   */
  public setupEnterpriseApi(app: Application): void {
    logger.info('Setting up Enterprise API Integration', this.config);

    // 1. Request ID and timing middleware (must be first)
    app.use(this.requestIdMiddleware);

    // 2. Version management
    if (this.config.enableVersioning) {
      app.use(this.versionManager.middleware());
    }

    // 3. Analytics middleware
    if (this.config.enableAnalytics) {
      app.use(this.createAnalyticsMiddleware());
    }

    // 4. OpenAPI documentation
    if (this.config.enableOpenAPI) {
      this.openApiGenerator.setupSwaggerUI(app, '/api-docs');
      logger.info('OpenAPI documentation available at /api-docs');
    }

    // 5. Health check endpoint
    if (this.config.enableHealthCheck) {
      app.get('/health', this.createHealthCheckHandler());
      app.get('/api/health', this.createHealthCheckHandler());
    }

    // 6. API metrics dashboard
    if (this.config.enableAnalytics) {
      app.use('/api/metrics', this.createMetricsRouter());
    }

    // 7. Enhanced API endpoints with new standards
    this.setupEnhancedEndpoints(app);

    logger.info('Enterprise API Integration setup complete');
  }

  /**
   * Request ID and timing middleware
   */
  private requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!(req as any).id) {
      (req as any).id = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
    (req as any).startTime = Date.now();
    
    res.set('X-Request-ID', (req as any).id);
    res.set('X-Powered-By', 'Mangalm Enterprise API');
    
    next();
  };

  /**
   * Analytics middleware
   */
  private createAnalyticsMiddleware() {
    const analytics = this.analytics; // Capture reference
    
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();

      // Capture response
      const originalSend = res.send;
      res.send = function(body: any) {
        const responseTime = Date.now() - startTime;
        
        // Record metrics
        const metrics = {
          endpoint: req.route?.path || req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          userId: (req as any).user?.id,
          userAgent: req.get('user-agent'),
          ip: req.ip || 'unknown',
          apiVersion: (req as any).apiVersion || '1.0.0'
        };

        // Record asynchronously
        analytics.recordMetrics(metrics).catch(() => {});

        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Health check handler
   */
  private createHealthCheckHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      const responseBuilder = new SimpleResponseBuilder(req);
      
      try {
        const healthData = {
          service: this.config.serviceName,
          version: this.config.version,
          status: 'healthy',
          timestamp: new Date(),
          uptime: process.uptime(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          },
          features: {
            analytics: this.config.enableAnalytics,
            openapi: this.config.enableOpenAPI,
            versioning: this.config.enableVersioning
          }
        };

        res.json(responseBuilder.success(healthData));
      } catch (error) {
        res.status(503).json(responseBuilder.error('HEALTH_CHECK_FAILED', 'Health check failed'));
      }
    };
  }

  /**
   * Metrics router
   */
  private createMetricsRouter(): Router {
    const router = Router();

    router.get('/dashboard', async (req: Request, res: Response) => {
      const responseBuilder = new SimpleResponseBuilder(req);
      try {
        const metrics = await this.analytics.getDashboardMetrics();
        res.json(responseBuilder.success(metrics));
      } catch (error) {
        res.status(500).json(responseBuilder.error('METRICS_ERROR', 'Failed to get metrics'));
      }
    });

    return router;
  }

  /**
   * Setup enhanced endpoints with new standards
   */
  private setupEnhancedEndpoints(app: Application): void {
    // Enhanced stores endpoint with pagination and search
    app.get('/api/v1/stores', async (req: Request, res: Response) => {
      const responseBuilder = new SimpleResponseBuilder(req);
      
      try {
        // Parse query parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const search = req.query.search as string;

        // This would typically query your database
        // For demo, we'll return mock data with pagination
        const mockStores = [
          { id: '1', name: 'Store A', city: 'New York', totalRevenue: 15000 },
          { id: '2', name: 'Store B', city: 'Los Angeles', totalRevenue: 12000 },
          { id: '3', name: 'Store C', city: 'Chicago', totalRevenue: 18000 }
        ];

        let filteredStores = mockStores;
        if (search) {
          filteredStores = mockStores.filter(store => 
            store.name.toLowerCase().includes(search.toLowerCase()) ||
            store.city.toLowerCase().includes(search.toLowerCase())
          );
        }

        const total = filteredStores.length;
        const offset = (page - 1) * limit;
        const paginatedStores = filteredStores.slice(offset, offset + limit);

        const response = responseBuilder.success(paginatedStores);
        
        // Add pagination metadata
        response.meta.pagination = {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        };

        res.json(response);
      } catch (error) {
        res.status(500).json(responseBuilder.error('INTERNAL_ERROR', 'Failed to fetch stores'));
      }
    });

    // Enhanced predictions endpoint with validation
    app.post('/api/v1/predictions', async (req: Request, res: Response) => {
      const responseBuilder = new SimpleResponseBuilder(req);
      
      try {
        const { storeId, type, timeframe } = req.body;

        // Basic validation
        if (!storeId || !type) {
          return res.status(400).json(
            responseBuilder.error('VALIDATION_ERROR', 'storeId and type are required')
          );
        }

        if (!['sales', 'inventory', 'demand', 'revenue'].includes(type)) {
          return res.status(400).json(
            responseBuilder.error('VALIDATION_ERROR', 'Invalid prediction type')
          );
        }

        // Mock prediction response
        const predictionData = {
          id: Math.random().toString(36).substr(2, 9),
          storeId,
          type,
          timeframe: timeframe || 'month',
          prediction: Math.round(Math.random() * 10000),
          confidence: 0.85,
          factors: ['seasonal', 'trends'],
          modelVersion: '1.2.0',
          createdAt: new Date()
        };

        res.json(responseBuilder.success(predictionData));
      } catch (error) {
        res.status(500).json(responseBuilder.error('INTERNAL_ERROR', 'Failed to generate prediction'));
      }
    });

    logger.info('Enhanced API endpoints configured');
  }

  /**
   * Get analytics engine for external access
   */
  public getAnalytics(): SimpleAnalyticsEngine {
    return this.analytics;
  }
}

/**
 * Factory function to create and setup enterprise API
 */
export function setupEnterpriseApi(
  app: Application, 
  config: Partial<EnterpriseApiConfig> = {}
): EnterpriseApiIntegration {
  
  const defaultConfig: EnterpriseApiConfig = {
    serviceName: 'Mangalm API Gateway',
    version: '1.0.0',
    enableAnalytics: true,
    enableOpenAPI: true,
    enableVersioning: true,
    enableHealthCheck: true,
    ...config
  };

  const integration = new EnterpriseApiIntegration(defaultConfig);
  integration.setupEnterpriseApi(app);
  
  return integration;
}

export default {
  EnterpriseApiIntegration,
  setupEnterpriseApi,
  SimpleResponseBuilder
};