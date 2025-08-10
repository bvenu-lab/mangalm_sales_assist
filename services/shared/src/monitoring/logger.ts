import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import LokiTransport from 'winston-loki';
import path from 'path';
import { hostname } from 'os';

// Define log levels
const logLevels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

// Define colors for each level
const logColors = {
  fatal: 'red',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  trace: 'magenta',
};

winston.addColors(logColors);

export interface LoggerOptions {
  service: string;
  level?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableElasticsearch?: boolean;
  enableLoki?: boolean;
  elasticsearchNode?: string;
  lokiHost?: string;
}

/**
 * Create a centralized logger instance with multiple transports
 */
export function createLogger(options: LoggerOptions): winston.Logger {
  const {
    service,
    level = process.env.LOG_LEVEL || 'info',
    enableConsole = true,
    enableFile = true,
    enableElasticsearch = process.env.ENABLE_ELASTICSEARCH === 'true',
    enableLoki = process.env.ENABLE_LOKI === 'true',
    elasticsearchNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    lokiHost = process.env.LOKI_HOST || 'http://localhost:3100',
  } = options;

  const transports: winston.transport[] = [];

  // Common format for all transports
  const commonFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({
      fillExcept: ['message', 'level', 'timestamp', 'service'],
    })
  );

  // Console transport
  if (enableConsole) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          commonFormat,
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service, metadata }) => {
            const meta = metadata && Object.keys(metadata).length 
              ? `\n${JSON.stringify(metadata, null, 2)}` 
              : '';
            return `${timestamp} [${service}] ${level}: ${message}${meta}`;
          })
        ),
      })
    );
  }

  // File transports
  if (enableFile) {
    const logDir = path.join(process.cwd(), 'logs');
    
    // Combined log
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, `${service}-combined.log`),
        format: winston.format.combine(
          commonFormat,
          winston.format.json()
        ),
        maxsize: 10485760, // 10MB
        maxFiles: 10,
      })
    );

    // Error log
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, `${service}-error.log`),
        level: 'error',
        format: winston.format.combine(
          commonFormat,
          winston.format.json()
        ),
        maxsize: 10485760, // 10MB
        maxFiles: 10,
      })
    );
  }

  // Elasticsearch transport for centralized logging
  if (enableElasticsearch) {
    transports.push(
      new ElasticsearchTransport({
        level,
        clientOpts: {
          node: elasticsearchNode,
        },
        index: `mangalm-logs-${service}`,
        format: winston.format.combine(
          commonFormat,
          winston.format.json()
        ),
      })
    );
  }

  // Loki transport for Grafana integration
  if (enableLoki) {
    transports.push(
      new LokiTransport({
        host: lokiHost,
        labels: {
          service,
          hostname: hostname(),
          environment: process.env.NODE_ENV || 'development',
        },
        format: winston.format.combine(
          commonFormat,
          winston.format.json()
        ),
        batching: true,
        interval: 5,
      })
    );
  }

  // Create the logger
  const logger = winston.createLogger({
    levels: logLevels,
    level,
    defaultMeta: { service },
    transports,
    exitOnError: false,
  });

  // Add correlation ID support
  logger.child = function(metadata: any) {
    const childLogger = Object.create(this);
    childLogger.defaultMeta = { ...this.defaultMeta, ...metadata };
    return childLogger;
  };

  return logger;
}

/**
 * Express middleware for request logging with correlation IDs
 */
export function createRequestLogger(logger: winston.Logger) {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const correlationId = req.headers['x-correlation-id'] || 
                          req.headers['x-request-id'] || 
                          `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Attach correlation ID to request
    req.correlationId = correlationId;
    req.logger = logger.child({ correlationId });

    // Log request
    req.logger.info('Incoming request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Log response
    const originalSend = res.send;
    res.send = function(data: any) {
      const duration = Date.now() - start;
      
      req.logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });

      // Call original send
      originalSend.call(this, data);
    };

    // Attach correlation ID to response headers
    res.setHeader('X-Correlation-ID', correlationId);
    
    next();
  };
}

/**
 * Performance logging decorator
 */
export function logPerformance(logger: winston.Logger) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const start = Date.now();
      const className = target.constructor.name;
      
      logger.debug(`[${className}.${propertyKey}] Starting execution`);
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        
        logger.info(`[${className}.${propertyKey}] Completed`, {
          duration: `${duration}ms`,
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        
        logger.error(`[${className}.${propertyKey}] Failed`, {
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Structured logging utilities
 */
export class StructuredLogger {
  constructor(private logger: winston.Logger) {}

  logBusinessEvent(event: string, data: any, userId?: string) {
    this.logger.info('Business Event', {
      event,
      userId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  logSecurityEvent(event: string, data: any, userId?: string, ip?: string) {
    this.logger.warn('Security Event', {
      event,
      userId,
      ip,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  logPerformanceMetric(metric: string, value: number, unit: string = 'ms') {
    this.logger.info('Performance Metric', {
      metric,
      value,
      unit,
      timestamp: new Date().toISOString(),
    });
  }

  logError(error: Error, context?: any) {
    this.logger.error('Application Error', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  logAudit(action: string, entity: string, entityId: string, userId: string, changes?: any) {
    this.logger.info('Audit Log', {
      action,
      entity,
      entityId,
      userId,
      changes,
      timestamp: new Date().toISOString(),
    });
  }
}