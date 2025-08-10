/**
 * Enterprise OpenAPI Documentation Generator
 * Generates comprehensive Swagger/OpenAPI 3.0 documentation
 */

import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { ErrorCode, HTTP_STATUS_MAP } from './api-standards';

/**
 * OpenAPI Configuration
 */
export interface OpenAPIConfig {
  title: string;
  description: string;
  version: string;
  serverUrl: string;
  contact?: {
    name: string;
    email: string;
    url: string;
  };
  license?: {
    name: string;
    url: string;
  };
  tags: TagDefinition[];
}

export interface TagDefinition {
  name: string;
  description: string;
  externalDocs?: {
    description: string;
    url: string;
  };
}

/**
 * Standard OpenAPI Components
 */
export const OpenAPIComponents = {
  // Security Schemas
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT Bearer token authentication'
    },
    apiKeyAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
      description: 'API Key authentication for programmatic access'
    }
  },

  // Standard Response Schemas
  schemas: {
    // Success Response Envelope
    SuccessResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { 
          type: 'object',
          description: 'Response data (varies by endpoint)'
        },
        meta: { $ref: '#/components/schemas/ResponseMetadata' }
      },
      required: ['success', 'meta']
    },

    // Error Response Envelope
    ErrorResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { $ref: '#/components/schemas/ApiError' },
        meta: { $ref: '#/components/schemas/ResponseMetadata' }
      },
      required: ['success', 'error', 'meta']
    },

    // API Error
    ApiError: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          enum: Object.values(ErrorCode),
          description: 'Machine-readable error code'
        },
        message: {
          type: 'string',
          description: 'Human-readable error message'
        },
        details: {
          type: 'object',
          description: 'Additional error details'
        },
        field: {
          type: 'string',
          description: 'Field name for validation errors'
        }
      },
      required: ['code', 'message']
    },

    // Response Metadata
    ResponseMetadata: {
      type: 'object',
      properties: {
        requestId: {
          type: 'string',
          format: 'uuid',
          description: 'Unique request identifier'
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'Response timestamp'
        },
        version: {
          type: 'string',
          example: '1.0.0',
          description: 'API version'
        },
        pagination: { $ref: '#/components/schemas/PaginationMeta' },
        rateLimit: { $ref: '#/components/schemas/RateLimitMeta' },
        timing: { $ref: '#/components/schemas/TimingMeta' }
      },
      required: ['requestId', 'timestamp', 'version']
    },

    // Pagination Metadata
    PaginationMeta: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, description: 'Current page number' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Items per page' },
        total: { type: 'integer', minimum: 0, description: 'Total number of items' },
        totalPages: { type: 'integer', minimum: 0, description: 'Total number of pages' },
        hasNext: { type: 'boolean', description: 'Has next page' },
        hasPrev: { type: 'boolean', description: 'Has previous page' },
        nextPage: { type: 'integer', minimum: 1, description: 'Next page number' },
        prevPage: { type: 'integer', minimum: 1, description: 'Previous page number' }
      },
      required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev']
    },

    // Rate Limit Metadata
    RateLimitMeta: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Rate limit maximum' },
        remaining: { type: 'integer', description: 'Remaining requests in window' },
        resetTime: { type: 'string', format: 'date-time', description: 'Window reset time' },
        retryAfter: { type: 'integer', description: 'Seconds until retry allowed' }
      },
      required: ['limit', 'remaining', 'resetTime']
    },

    // Timing Metadata
    TimingMeta: {
      type: 'object',
      properties: {
        processingTime: { 
          type: 'integer',
          description: 'Processing time in milliseconds'
        },
        dbQueries: { 
          type: 'integer',
          description: 'Number of database queries'
        },
        externalCalls: { 
          type: 'integer',
          description: 'Number of external service calls'
        }
      },
      required: ['processingTime']
    },

    // Standard Query Parameters
    StandardQuery: {
      type: 'object',
      properties: {
        page: {
          type: 'integer',
          minimum: 1,
          default: 1,
          description: 'Page number for pagination'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Number of items per page'
        },
        sort: {
          type: 'string',
          description: 'Sort field with optional prefix (+/-)',
          example: '-createdAt'
        },
        search: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          description: 'Search term'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to include',
          example: 'name,email,createdAt'
        },
        startDate: {
          type: 'string',
          format: 'date-time',
          description: 'Start date for filtering'
        },
        endDate: {
          type: 'string',
          format: 'date-time',
          description: 'End date for filtering'
        },
        status: {
          type: 'string',
          description: 'Status filter'
        },
        active: {
          type: 'boolean',
          description: 'Active status filter'
        }
      }
    },

    // Business Entity Schemas
    Store: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', description: 'Store unique identifier' },
        name: { type: 'string', minLength: 1, maxLength: 255, description: 'Store name' },
        address: { type: 'string', maxLength: 500, description: 'Store address' },
        city: { type: 'string', maxLength: 100, description: 'City' },
        state: { type: 'string', maxLength: 100, description: 'State/Province' },
        phone: { type: 'string', pattern: '^\\+?[\\d\\s\\-\\(\\)]+$', description: 'Phone number' },
        email: { type: 'string', format: 'email', description: 'Email address' },
        lastOrderDate: { type: 'string', format: 'date-time', description: 'Last order date' },
        totalOrders: { type: 'integer', minimum: 0, description: 'Total number of orders' },
        totalRevenue: { type: 'number', minimum: 0, description: 'Total revenue' },
        isActive: { type: 'boolean', description: 'Store active status' },
        createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
        updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
      },
      required: ['id', 'name', 'isActive', 'createdAt', 'updatedAt']
    },

    StoreCreate: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 255, description: 'Store name' },
        address: { type: 'string', maxLength: 500, description: 'Store address' },
        city: { type: 'string', maxLength: 100, description: 'City' },
        state: { type: 'string', maxLength: 100, description: 'State/Province' },
        phone: { type: 'string', pattern: '^\\+?[\\d\\s\\-\\(\\)]+$', description: 'Phone number' },
        email: { type: 'string', format: 'email', description: 'Email address' },
        isActive: { type: 'boolean', default: true, description: 'Store active status' }
      },
      required: ['name']
    },

    Product: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', description: 'Product unique identifier' },
        name: { type: 'string', minLength: 1, maxLength: 255, description: 'Product name' },
        sku: { type: 'string', minLength: 1, maxLength: 50, description: 'Stock Keeping Unit' },
        category: { type: 'string', minLength: 1, maxLength: 100, description: 'Product category' },
        price: { type: 'number', minimum: 0.01, description: 'Product price' },
        cost: { type: 'number', minimum: 0, description: 'Product cost' },
        weight: { type: 'number', minimum: 0, description: 'Product weight (kg)' },
        dimensions: {
          type: 'object',
          properties: {
            length: { type: 'number', minimum: 0, description: 'Length (cm)' },
            width: { type: 'number', minimum: 0, description: 'Width (cm)' },
            height: { type: 'number', minimum: 0, description: 'Height (cm)' }
          },
          required: ['length', 'width', 'height']
        },
        isActive: { type: 'boolean', description: 'Product active status' },
        createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
        updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
      },
      required: ['id', 'name', 'sku', 'category', 'price', 'isActive', 'createdAt', 'updatedAt']
    },

    PredictionRequest: {
      type: 'object',
      properties: {
        storeId: { type: 'string', format: 'uuid', description: 'Store ID for prediction' },
        type: {
          type: 'string',
          enum: ['sales', 'inventory', 'demand', 'revenue'],
          description: 'Prediction type'
        },
        timeframe: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'year'],
          default: 'month',
          description: 'Prediction timeframe'
        },
        includeFactors: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['seasonal', 'trends', 'events', 'weather']
          },
          description: 'Factors to include in prediction'
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.95,
          description: 'Confidence interval'
        }
      },
      required: ['storeId', 'type']
    },

    PredictionResult: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', description: 'Prediction unique identifier' },
        storeId: { type: 'string', format: 'uuid', description: 'Store ID' },
        type: { type: 'string', enum: ['sales', 'inventory', 'demand', 'revenue'] },
        timeframe: { type: 'string', enum: ['week', 'month', 'quarter', 'year'] },
        prediction: { type: 'number', description: 'Predicted value' },
        confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confidence level' },
        factors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Factors considered'
        },
        modelVersion: { type: 'string', description: 'ML model version used' },
        createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
        expiresAt: { type: 'string', format: 'date-time', description: 'Prediction expiry' }
      },
      required: ['id', 'storeId', 'type', 'timeframe', 'prediction', 'confidence', 'createdAt']
    }
  },

  // Standard Response Examples
  responses: {
    Success: {
      description: 'Successful operation',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SuccessResponse' }
        }
      }
    },
    BadRequest: {
      description: 'Bad Request - Invalid input data',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            success: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Validation failed',
              details: [
                {
                  field: 'name',
                  code: 'REQUIRED_FIELD_MISSING',
                  message: 'Name is required'
                }
              ]
            },
            meta: {
              requestId: '123e4567-e89b-12d3-a456-426614174000',
              timestamp: '2023-12-09T10:00:00.000Z',
              version: '1.0.0'
            }
          }
        }
      }
    },
    Unauthorized: {
      description: 'Unauthorized - Authentication required',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          example: {
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required'
            },
            meta: {
              requestId: '123e4567-e89b-12d3-a456-426614174000',
              timestamp: '2023-12-09T10:00:00.000Z',
              version: '1.0.0'
            }
          }
        }
      }
    },
    Forbidden: {
      description: 'Forbidden - Insufficient permissions',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' }
        }
      }
    },
    NotFound: {
      description: 'Not Found - Resource not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' }
        }
      }
    },
    TooManyRequests: {
      description: 'Too Many Requests - Rate limit exceeded',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' }
        }
      }
    },
    InternalServerError: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' }
        }
      }
    }
  },

  // Common Parameters
  parameters: {
    PageParam: {
      name: 'page',
      in: 'query',
      description: 'Page number for pagination',
      required: false,
      schema: { type: 'integer', minimum: 1, default: 1 }
    },
    LimitParam: {
      name: 'limit',
      in: 'query',
      description: 'Number of items per page',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
    },
    SortParam: {
      name: 'sort',
      in: 'query',
      description: 'Sort field with optional prefix (+/-)',
      required: false,
      schema: { type: 'string' },
      example: '-createdAt'
    },
    SearchParam: {
      name: 'search',
      in: 'query',
      description: 'Search term',
      required: false,
      schema: { type: 'string', minLength: 1, maxLength: 255 }
    },
    FieldsParam: {
      name: 'fields',
      in: 'query',
      description: 'Comma-separated list of fields to include',
      required: false,
      schema: { type: 'string' },
      example: 'name,email,createdAt'
    },
    IdParam: {
      name: 'id',
      in: 'path',
      description: 'Resource unique identifier',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    }
  }
};

/**
 * OpenAPI Documentation Generator
 */
export class OpenAPIGenerator {
  private config: OpenAPIConfig;

  constructor(config: OpenAPIConfig) {
    this.config = config;
  }

  /**
   * Generate OpenAPI specification
   */
  public generateSpec(): object {
    const swaggerOptions = {
      definition: {
        openapi: '3.0.3',
        info: {
          title: this.config.title,
          description: this.config.description,
          version: this.config.version,
          contact: this.config.contact,
          license: this.config.license,
          termsOfService: 'https://mangalm.com/terms'
        },
        servers: [
          {
            url: this.config.serverUrl,
            description: 'Main API Server'
          }
        ],
        tags: this.config.tags,
        components: OpenAPIComponents,
        security: [
          { bearerAuth: [] },
          { apiKeyAuth: [] }
        ],
        externalDocs: {
          description: 'Find more info here',
          url: 'https://docs.mangalm.com'
        }
      },
      apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // Path to the API files
    };

    return swaggerJSDoc(swaggerOptions);
  }

  /**
   * Setup Swagger UI middleware
   */
  public setupSwaggerUI(app: Express, basePath: string = '/api-docs'): void {
    const specs = this.generateSpec();
    
    // Serve Swagger UI
    app.use(basePath, swaggerUi.serve);
    app.get(basePath, swaggerUi.setup(specs, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: `${this.config.title} API Documentation`,
      swaggerOptions: {
        persistAuthorization: true,
        displayOperationId: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 2,
        defaultModelRendering: 'example'
      }
    }));

    // Serve OpenAPI JSON
    app.get(`${basePath}.json`, (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });

    // Serve OpenAPI YAML
    app.get(`${basePath}.yaml`, (req, res) => {
      res.setHeader('Content-Type', 'text/yaml');
      const yaml = require('js-yaml');
      res.send(yaml.dump(specs));
    });
  }
}

/**
 * Service-specific OpenAPI configurations
 */
export const ServiceConfigs = {
  apiGateway: {
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
  },

  aiPredictionService: {
    title: 'AI Prediction Service API',
    description: 'Machine learning powered predictions for sales, inventory, and demand forecasting.',
    version: '1.0.0',
    serverUrl: 'http://localhost:3004',
    tags: [
      {
        name: 'Predictions',
        description: 'AI model predictions'
      },
      {
        name: 'Models',
        description: 'ML model management'
      },
      {
        name: 'Training',
        description: 'Model training operations'
      }
    ]
  },

  zohoIntegration: {
    title: 'Zoho Integration API',
    description: 'Enterprise-grade Zoho CRM integration with bidirectional sync and conflict resolution.',
    version: '1.0.0',
    serverUrl: 'http://localhost:3002',
    tags: [
      {
        name: 'Sync',
        description: 'Data synchronization operations'
      },
      {
        name: 'Webhooks',
        description: 'Webhook management'
      },
      {
        name: 'Conflicts',
        description: 'Conflict resolution'
      }
    ]
  }
};

export default {
  OpenAPIGenerator,
  OpenAPIComponents,
  ServiceConfigs
};