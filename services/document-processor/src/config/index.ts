import * as joi from 'joi';
import * as path from 'path';
import * as fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema with strict validation
const configSchema = joi.object({
  // Service configuration
  service: joi.object({
    name: joi.string().default('document-processor'),
    version: joi.string().default('1.0.0'),
    port: joi.number().integer().min(1000).max(65535).default(3010),
    host: joi.string().default('localhost'),
    env: joi.string().valid('development', 'staging', 'production').default('development'),
    shutdownTimeout: joi.number().integer().min(1000).max(30000).default(10000)
  }).required(),

  // Database configuration
  database: joi.object({
    host: joi.string().required(),
    port: joi.number().integer().min(1).max(65535).default(5432),
    username: joi.string().required(),
    password: joi.string().required(),
    database: joi.string().required(),
    ssl: joi.boolean().default(false),
    synchronize: joi.boolean().default(false),
    logging: joi.boolean().default(false),
    connectionTimeout: joi.number().integer().min(1000).max(30000).default(5000),
    idleTimeout: joi.number().integer().min(1000).max(300000).default(30000),
    maxConnections: joi.number().integer().min(1).max(100).default(10),
    acquireTimeout: joi.number().integer().min(1000).max(60000).default(10000),
    retryAttempts: joi.number().integer().min(0).max(10).default(3),
    retryDelay: joi.number().integer().min(100).max(5000).default(1000)
  }).required(),

  // Redis configuration
  redis: joi.object({
    host: joi.string().required(),
    port: joi.number().integer().min(1).max(65535).default(6379),
    password: joi.string().allow('').optional(),
    db: joi.number().integer().min(0).max(15).default(0),
    connectionTimeout: joi.number().integer().min(1000).max(30000).default(5000),
    commandTimeout: joi.number().integer().min(1000).max(30000).default(5000),
    retryAttempts: joi.number().integer().min(0).max(10).default(3),
    retryDelay: joi.number().integer().min(100).max(5000).default(1000),
    maxRetryDelay: joi.number().integer().min(1000).max(30000).default(10000)
  }).required(),

  // File upload configuration
  upload: joi.object({
    uploadDir: joi.string().required(),
    tempDir: joi.string().required(),
    maxFileSize: joi.number().integer().min(1024).max(104857600).default(10485760), // 10MB
    allowedFileTypes: joi.array().items(joi.string()).default([
      'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'application/pdf'
    ]),
    allowedExtensions: joi.array().items(joi.string()).default([
      '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.pdf'
    ]),
    cleanupInterval: joi.number().integer().min(60000).max(86400000).default(3600000), // 1 hour
    tempFileExpiry: joi.number().integer().min(60000).max(86400000).default(7200000), // 2 hours
    virusScanEnabled: joi.boolean().default(false),
    encryptionEnabled: joi.boolean().default(false)
  }).required(),

  // Document processing configuration
  processing: joi.object({
    queueConcurrency: joi.number().integer().min(1).max(50).default(5),
    maxRetries: joi.number().integer().min(0).max(10).default(3),
    retryDelay: joi.number().integer().min(1000).max(30000).default(5000),
    jobTimeout: joi.number().integer().min(30000).max(600000).default(120000), // 2 minutes
    batchSize: joi.number().integer().min(1).max(100).default(10),
    memoryLimit: joi.number().integer().min(134217728).max(2147483648).default(536870912), // 512MB
    confidenceThreshold: joi.number().min(0).max(1).default(0.6),
    highConfidenceThreshold: joi.number().min(0).max(1).default(0.85),
    qualityThresholds: joi.object({
      high: joi.number().min(0).max(1).default(0.8),
      medium: joi.number().min(0).max(1).default(0.6),
      low: joi.number().min(0).max(1).default(0.4)
    }).required()
  }).required(),

  // OCR configuration
  ocr: joi.object({
    tesseract: joi.object({
      enabled: joi.boolean().default(true),
      lang: joi.string().default('eng'),
      psm: joi.number().integer().min(0).max(13).default(3),
      oem: joi.number().integer().min(0).max(3).default(3)
    }).required(),
    googleVision: joi.object({
      enabled: joi.boolean().default(false),
      apiKey: joi.string().when('enabled', {
        is: true,
        then: joi.required(),
        otherwise: joi.optional()
      }),
      projectId: joi.string().when('enabled', {
        is: true,
        then: joi.required(),
        otherwise: joi.optional()
      })
    }).required(),
    azure: joi.object({
      enabled: joi.boolean().default(false),
      endpoint: joi.string().when('enabled', {
        is: true,
        then: joi.required(),
        otherwise: joi.optional()
      }),
      apiKey: joi.string().when('enabled', {
        is: true,
        then: joi.required(),
        otherwise: joi.optional()
      })
    }).required(),
    aws: joi.object({
      enabled: joi.boolean().default(false),
      region: joi.string().default('us-east-1'),
      accessKeyId: joi.string().when('enabled', {
        is: true,
        then: joi.required(),
        otherwise: joi.optional()
      }),
      secretAccessKey: joi.string().when('enabled', {
        is: true,
        then: joi.required(),
        otherwise: joi.optional()
      })
    }).required()
  }).required(),

  // Logging configuration
  logging: joi.object({
    level: joi.string().valid('error', 'warn', 'info', 'debug', 'trace').default('info'),
    file: joi.string().required(),
    errorFile: joi.string().required(),
    maxFileSize: joi.number().integer().min(1048576).max(104857600).default(10485760), // 10MB
    maxFiles: joi.number().integer().min(1).max(50).default(5),
    enableConsole: joi.boolean().default(true),
    enableFile: joi.boolean().default(true),
    enableCorrelationId: joi.boolean().default(true),
    enableSensitiveDataMasking: joi.boolean().default(true)
  }).required(),

  // Security configuration
  security: joi.object({
    jwtSecret: joi.string().min(32).required(),
    jwtExpiry: joi.string().default('24h'),
    enableRateLimiting: joi.boolean().default(true),
    rateLimits: joi.object({
      global: joi.object({
        windowMs: joi.number().integer().min(1000).max(3600000).default(900000), // 15 minutes
        max: joi.number().integer().min(1).max(10000).default(1000)
      }).required(),
      upload: joi.object({
        windowMs: joi.number().integer().min(1000).max(3600000).default(60000), // 1 minute
        max: joi.number().integer().min(1).max(100).default(10)
      }).required(),
      classify: joi.object({
        windowMs: joi.number().integer().min(1000).max(3600000).default(60000), // 1 minute
        max: joi.number().integer().min(1).max(1000).default(50)
      }).required()
    }).required()
  }).required(),

  // CORS configuration
  cors: joi.object({
    origin: joi.alternatives().try(
      joi.string(),
      joi.array().items(joi.string()),
      joi.boolean()
    ).default(['http://localhost:3000', 'http://localhost:3007']),
    credentials: joi.boolean().default(true),
    methods: joi.array().items(joi.string()).default(['GET', 'POST', 'PUT', 'DELETE']),
    allowedHeaders: joi.array().items(joi.string()).default([
      'Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Request-ID'
    ])
  }).required(),

  // API Gateway configuration
  apiGateway: joi.object({
    url: joi.string().uri().required()
  }).required(),

  // Feature flags
  features: joi.object({
    enableExperimentalAlgorithms: joi.boolean().default(false),
    enableBetaFeatures: joi.boolean().default(false),
    enableAdvancedClassification: joi.boolean().default(true),
    enableCloudOcr: joi.boolean().default(false),
    enableBatchProcessing: joi.boolean().default(true),
    enablePreprocessingOptimization: joi.boolean().default(true)
  }).required()
});

interface Config {
  service: {
    name: string;
    version: string;
    port: number;
    host: string;
    env: string;
    shutdownTimeout: number;
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
    synchronize: boolean;
    logging: boolean;
    connectionTimeout: number;
    idleTimeout: number;
    maxConnections: number;
    acquireTimeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    connectionTimeout: number;
    commandTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    maxRetryDelay: number;
  };
  upload: {
    uploadDir: string;
    tempDir: string;
    maxFileSize: number;
    allowedFileTypes: string[];
    allowedExtensions: string[];
    cleanupInterval: number;
    tempFileExpiry: number;
    virusScanEnabled: boolean;
    encryptionEnabled: boolean;
  };
  processing: {
    queueConcurrency: number;
    maxRetries: number;
    retryDelay: number;
    jobTimeout: number;
    batchSize: number;
    memoryLimit: number;
    confidenceThreshold: number;
    highConfidenceThreshold: number;
    qualityThresholds: {
      high: number;
      medium: number;
      low: number;
    };
  };
  ocr: {
    tesseract: {
      enabled: boolean;
      lang: string;
      psm: number;
      oem: number;
    };
    googleVision: {
      enabled: boolean;
      apiKey?: string;
      projectId?: string;
    };
    azure: {
      enabled: boolean;
      endpoint?: string;
      apiKey?: string;
    };
    aws: {
      enabled: boolean;
      region: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    };
  };
  logging: {
    level: string;
    file: string;
    errorFile: string;
    maxFileSize: number;
    maxFiles: number;
    enableConsole: boolean;
    enableFile: boolean;
    enableCorrelationId: boolean;
    enableSensitiveDataMasking: boolean;
  };
  security: {
    jwtSecret: string;
    jwtExpiry: string;
    enableRateLimiting: boolean;
    rateLimits: {
      global: {
        windowMs: number;
        max: number;
      };
      upload: {
        windowMs: number;
        max: number;
      };
      classify: {
        windowMs: number;
        max: number;
      };
    };
  };
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  apiGateway: {
    url: string;
  };
  features: {
    enableExperimentalAlgorithms: boolean;
    enableBetaFeatures: boolean;
    enableAdvancedClassification: boolean;
    enableCloudOcr: boolean;
    enableBatchProcessing: boolean;
    enablePreprocessingOptimization: boolean;
  };
}

class ConfigurationManager {
  private static instance: ConfigurationManager;
  private _config: Config | null = null;

  private constructor() {}

  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  public load(): Config {
    if (this._config) {
      return this._config;
    }

    // Load from environment variables with proper validation
    const rawConfig = {
      service: {
        name: process.env.SERVICE_NAME || 'document-processor',
        version: process.env.SERVICE_VERSION || '1.0.0',
        port: parseInt(process.env.DOCUMENT_PROCESSOR_PORT || '3010', 10),
        host: process.env.HOST || 'localhost',
        env: process.env.NODE_ENV || 'development',
        shutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT || '10000', 10)
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USER || 'mangalm',
        password: process.env.DB_PASSWORD || 'mangalm_secure_2024',
        database: process.env.DB_NAME || 'mangalm_sales',
        ssl: process.env.DB_SSL === 'true',
        synchronize: process.env.NODE_ENV === 'development',
        logging: process.env.DB_LOGGING === 'true',
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
        acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '10000', 10),
        retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3', 10),
        retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000', 10)
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT || '5000', 10),
        commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
        retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3', 10),
        retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
        maxRetryDelay: parseInt(process.env.REDIS_MAX_RETRY_DELAY || '10000', 10)
      },
      upload: {
        uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
        tempDir: process.env.TEMP_DIR || path.join(process.cwd(), 'temp'),
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
        allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
          'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/bmp'
        ],
        allowedExtensions: process.env.ALLOWED_EXTENSIONS?.split(',') || [
          '.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp'
        ],
        cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '3600000', 10),
        tempFileExpiry: parseInt(process.env.TEMP_FILE_EXPIRY || '7200000', 10),
        virusScanEnabled: process.env.VIRUS_SCAN_ENABLED === 'true',
        encryptionEnabled: process.env.ENCRYPTION_ENABLED === 'true'
      },
      processing: {
        queueConcurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
        maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
        retryDelay: parseInt(process.env.RETRY_DELAY || '5000', 10),
        jobTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '120000', 10),
        batchSize: parseInt(process.env.BATCH_SIZE || '10', 10),
        memoryLimit: parseInt(process.env.MEMORY_LIMIT || '536870912', 10),
        confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.6'),
        highConfidenceThreshold: parseFloat(process.env.HIGH_CONFIDENCE_THRESHOLD || '0.85'),
        qualityThresholds: {
          high: parseFloat(process.env.QUALITY_THRESHOLD_HIGH || '0.8'),
          medium: parseFloat(process.env.QUALITY_THRESHOLD_MEDIUM || '0.6'),
          low: parseFloat(process.env.QUALITY_THRESHOLD_LOW || '0.4')
        }
      },
      ocr: {
        tesseract: {
          enabled: process.env.OCR_TESSERACT_ENABLED !== 'false',
          lang: process.env.OCR_TESSERACT_LANG || 'eng',
          psm: parseInt(process.env.OCR_TESSERACT_PSM || '3', 10),
          oem: parseInt(process.env.OCR_TESSERACT_OEM || '3', 10)
        },
        googleVision: {
          enabled: process.env.OCR_GOOGLE_VISION_ENABLED === 'true',
          apiKey: process.env.GOOGLE_VISION_API_KEY,
          projectId: process.env.GOOGLE_PROJECT_ID
        },
        azure: {
          enabled: process.env.OCR_AZURE_ENABLED === 'true',
          endpoint: process.env.AZURE_ENDPOINT,
          apiKey: process.env.AZURE_API_KEY
        },
        aws: {
          enabled: process.env.OCR_AWS_ENABLED === 'true',
          region: process.env.AWS_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'app.log'),
        errorFile: process.env.ERROR_LOG_FILE || path.join(process.cwd(), 'logs', 'error.log'),
        maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760', 10),
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
        enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
        enableFile: process.env.LOG_ENABLE_FILE !== 'false',
        enableCorrelationId: process.env.ENABLE_CORRELATION_ID !== 'false',
        enableSensitiveDataMasking: process.env.ENABLE_SENSITIVE_DATA_MASKING !== 'false'
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'mangalm-document-processor-secret-2024',
        jwtExpiry: process.env.JWT_EXPIRY || '24h',
        enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
        rateLimits: {
          global: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
            max: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10)
          },
          upload: {
            windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW || '60000', 10),
            max: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || '10', 10)
          },
          classify: {
            windowMs: parseInt(process.env.RATE_LIMIT_CLASSIFY_WINDOW || '60000', 10),
            max: parseInt(process.env.RATE_LIMIT_CLASSIFY_MAX || '50', 10)
          }
        }
      },
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3007'],
        credentials: process.env.CORS_CREDENTIALS !== 'false',
        methods: process.env.CORS_METHODS?.split(',') || ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: process.env.CORS_ALLOWED_HEADERS?.split(',') || [
          'Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Request-ID'
        ]
      },
      apiGateway: {
        url: process.env.API_GATEWAY_URL || 'http://localhost:3007'
      },
      features: {
        enableExperimentalAlgorithms: process.env.ENABLE_EXPERIMENTAL_ALGORITHMS === 'true',
        enableBetaFeatures: process.env.ENABLE_BETA_FEATURES === 'true',
        enableAdvancedClassification: process.env.ENABLE_ADVANCED_CLASSIFICATION !== 'false',
        enableCloudOcr: process.env.ENABLE_CLOUD_OCR === 'true',
        enableBatchProcessing: process.env.ENABLE_BATCH_PROCESSING !== 'false',
        enablePreprocessingOptimization: process.env.ENABLE_PREPROCESSING_OPTIMIZATION !== 'false'
      }
    };

    // Validate configuration
    const { error, value } = configSchema.validate(rawConfig, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message).join(', ');
      throw new Error(`Configuration validation failed: ${errorMessages}`);
    }

    // Ensure required directories exist
    this.ensureDirectories(value);

    this._config = value as Config;
    return this._config;
  }

  private ensureDirectories(config: any): void {
    const directories = [
      config.upload.uploadDir,
      config.upload.tempDir,
      path.dirname(config.logging.file),
      path.dirname(config.logging.errorFile)
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (error) {
          throw new Error(`Failed to create directory ${dir}: ${error}`);
        }
      }
    });
  }

  public get config(): Config {
    if (!this._config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this._config;
  }

  public reload(): Config {
    this._config = null;
    return this.load();
  }

  public validateEnvironment(): string[] {
    const requiredVars = [
      'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
      'REDIS_HOST', 'JWT_SECRET'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    return missing;
  }

  public isProduction(): boolean {
    return this.config.service.env === 'production';
  }

  public isDevelopment(): boolean {
    return this.config.service.env === 'development';
  }

  public isFeatureEnabled(feature: keyof Config['features']): boolean {
    return this.config.features[feature];
  }
}

// Export singleton instance
export const configManager = ConfigurationManager.getInstance();
export const config = configManager.load();
export type { Config };