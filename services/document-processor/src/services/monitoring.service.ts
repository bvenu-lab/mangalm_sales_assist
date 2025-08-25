import * as winston from 'winston';
import { StatsD } from 'node-statsd';
import * as os from 'os';
import * as process from 'process';

// Configuration for monitoring
interface MonitoringConfig {
  statsd: {
    host: string;
    port: number;
    prefix: string;
    globalTags: string[];
  };
  logging: {
    level: string;
    format: string;
  };
  metrics: {
    flushInterval: number;
    sampleRate: number;
  };
}

// Performance metrics
interface PerformanceMetrics {
  documentId: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// System metrics
interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  heapUsed: number;
  heapTotal: number;
  uptime: number;
  loadAverage: number[];
}

export class MonitoringService {
  private static instance: MonitoringService;
  private statsd: StatsD;
  private logger: winston.Logger;
  private metricsBuffer: PerformanceMetrics[] = [];
  private systemMetricsInterval: NodeJS.Timeout | null = null;
  private config: MonitoringConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.statsd = this.initializeStatsd();
    this.logger = this.initializeLogger();
    this.startSystemMetricsCollection();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private loadConfig(): MonitoringConfig {
    return {
      statsd: {
        host: process.env.STATSD_HOST || 'localhost',
        port: parseInt(process.env.STATSD_PORT || '8125'),
        prefix: 'document_processor.',
        globalTags: [
          `env:${process.env.NODE_ENV || 'development'}`,
          `service:document-processor`,
          `host:${os.hostname()}`
        ]
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json'
      },
      metrics: {
        flushInterval: parseInt(process.env.METRICS_FLUSH_INTERVAL || '10000'),
        sampleRate: parseFloat(process.env.METRICS_SAMPLE_RATE || '1.0')
      }
    };
  }

  private initializeStatsd(): StatsD {
    return new StatsD({
      host: this.config.statsd.host,
      port: this.config.statsd.port,
      prefix: this.config.statsd.prefix,
      globalTags: this.config.statsd.globalTags,
      errorHandler: (error: Error) => {
        console.error('StatsD error:', error);
      }
    });
  }

  private initializeLogger(): winston.Logger {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    ];

    // Add custom transport for critical errors
    if (process.env.SENTRY_DSN) {
      // Sentry integration would go here
    }

    return winston.createLogger({
      level: this.config.logging.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'document-processor',
        hostname: os.hostname(),
        pid: process.pid
      },
      transports
    });
  }

  // Logging methods
  public log(level: string, message: string, meta?: any): void {
    this.logger.log(level, message, meta);
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public error(message: string, error?: Error | any, meta?: any): void {
    const errorMeta = {
      ...meta,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...error
      } : undefined
    };
    this.logger.error(message, errorMeta);
    
    // Send critical errors to alerting system
    if (this.isCriticalError(error)) {
      this.sendAlert('critical_error', { message, error: errorMeta });
    }
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  // Metrics methods
  public recordMetric(name: string, value: number, tags?: string[]): void {
    this.statsd.gauge(name, value, this.config.metrics.sampleRate, tags);
  }

  public incrementCounter(name: string, value: number = 1, tags?: string[]): void {
    this.statsd.increment(name, value, this.config.metrics.sampleRate, tags);
  }

  public recordTiming(name: string, duration: number, tags?: string[]): void {
    this.statsd.timing(name, duration, this.config.metrics.sampleRate, tags);
  }

  public recordHistogram(name: string, value: number, tags?: string[]): void {
    this.statsd.histogram(name, value, this.config.metrics.sampleRate, tags);
  }

  // Performance tracking
  public startOperation(documentId: string, operation: string, metadata?: Record<string, any>): PerformanceMetrics {
    const metric: PerformanceMetrics = {
      documentId,
      operation,
      startTime: Date.now(),
      success: false,
      metadata
    };
    this.metricsBuffer.push(metric);
    return metric;
  }

  public endOperation(metric: PerformanceMetrics, success: boolean = true, error?: string): void {
    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.success = success;
    metric.error = error;

    // Record timing metric
    this.recordTiming(`operation.${metric.operation}.duration`, metric.duration, [
      `success:${success}`,
      `document:${metric.documentId}`
    ]);

    // Increment counter
    this.incrementCounter(`operation.${metric.operation}.count`, 1, [
      `success:${success}`
    ]);

    // Log operation
    if (success) {
      this.info(`Operation completed: ${metric.operation}`, {
        documentId: metric.documentId,
        duration: metric.duration,
        ...metric.metadata
      });
    } else {
      this.error(`Operation failed: ${metric.operation}`, undefined, {
        documentId: metric.documentId,
        duration: metric.duration,
        error,
        ...metric.metadata
      });
    }

    // Alert on slow operations
    if (metric.duration > this.getOperationThreshold(metric.operation)) {
      this.warn(`Slow operation detected: ${metric.operation}`, {
        documentId: metric.documentId,
        duration: metric.duration,
        threshold: this.getOperationThreshold(metric.operation)
      });
    }
  }

  // System metrics collection
  private startSystemMetricsCollection(): void {
    this.systemMetricsInterval = setInterval(() => {
      const metrics = this.collectSystemMetrics();
      
      // Record system metrics
      this.recordMetric('system.cpu.usage', metrics.cpuUsage);
      this.recordMetric('system.memory.usage', metrics.memoryUsage);
      this.recordMetric('system.heap.used', metrics.heapUsed);
      this.recordMetric('system.heap.total', metrics.heapTotal);
      this.recordMetric('system.uptime', metrics.uptime);
      
      metrics.loadAverage.forEach((load, index) => {
        this.recordMetric(`system.load.${index + 1}min`, load);
      });

      // Check for high resource usage
      if (metrics.cpuUsage > 80) {
        this.warn('High CPU usage detected', { cpuUsage: metrics.cpuUsage });
      }
      
      if (metrics.memoryUsage > 85) {
        this.warn('High memory usage detected', { memoryUsage: metrics.memoryUsage });
      }
    }, 30000); // Every 30 seconds
  }

  private collectSystemMetrics(): SystemMetrics {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memoryUsage: ((totalMem - freeMem) / totalMem) * 100,
      heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
      heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
      uptime: process.uptime(),
      loadAverage: os.loadavg()
    };
  }

  // Document processing specific metrics
  public recordDocumentProcessing(
    documentId: string,
    status: 'started' | 'completed' | 'failed',
    metadata?: {
      documentType?: string;
      fileSize?: number;
      processingTime?: number;
      quality?: string;
      confidence?: number;
      error?: string;
    }
  ): void {
    const tags = [
      `status:${status}`,
      metadata?.documentType ? `type:${metadata.documentType}` : '',
      metadata?.quality ? `quality:${metadata.quality}` : ''
    ].filter(Boolean);

    this.incrementCounter('document.processing', 1, tags);

    if (metadata?.processingTime) {
      this.recordTiming('document.processing.time', metadata.processingTime, tags);
    }

    if (metadata?.fileSize) {
      this.recordHistogram('document.file.size', metadata.fileSize, tags);
    }

    if (metadata?.confidence !== undefined) {
      this.recordHistogram('document.confidence', metadata.confidence, tags);
    }

    // Log the event
    this.info(`Document processing ${status}`, {
      documentId,
      ...metadata
    });
  }

  // Queue metrics
  public recordQueueMetrics(metrics: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }): void {
    this.recordMetric('queue.waiting', metrics.waiting);
    this.recordMetric('queue.active', metrics.active);
    this.recordMetric('queue.completed', metrics.completed);
    this.recordMetric('queue.failed', metrics.failed);
    this.recordMetric('queue.delayed', metrics.delayed);
    
    const total = metrics.waiting + metrics.active;
    if (total > 100) {
      this.warn('High queue backlog detected', { total, ...metrics });
    }
  }

  // OCR metrics
  public recordOCRMetrics(
    engine: string,
    success: boolean,
    duration: number,
    accuracy?: number,
    characterCount?: number
  ): void {
    const tags = [`engine:${engine}`, `success:${success}`];
    
    this.recordTiming('ocr.processing.time', duration, tags);
    this.incrementCounter('ocr.processing.count', 1, tags);
    
    if (accuracy !== undefined) {
      this.recordHistogram('ocr.accuracy', accuracy, tags);
    }
    
    if (characterCount !== undefined) {
      this.recordHistogram('ocr.character.count', characterCount, tags);
    }
  }

  // Alert management
  private sendAlert(type: string, data: any): void {
    // Integration with alerting system (PagerDuty, Slack, etc.)
    this.error(`ALERT: ${type}`, undefined, data);
    
    // Would integrate with external alerting service here
    if (process.env.SLACK_WEBHOOK_URL) {
      // Send to Slack
    }
    
    if (process.env.PAGERDUTY_KEY) {
      // Send to PagerDuty
    }
  }

  private isCriticalError(error: Error | any): boolean {
    if (!error) return false;
    
    const criticalPatterns = [
      /database.*connection/i,
      /out of memory/i,
      /ENOSPC/i, // No space left
      /EMFILE/i, // Too many open files
      /authentication.*failed/i,
      /permission.*denied/i
    ];
    
    return criticalPatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.stack || '')
    );
  }

  private getOperationThreshold(operation: string): number {
    const thresholds: Record<string, number> = {
      'document.upload': 5000,
      'document.classify': 3000,
      'document.preprocess': 10000,
      'document.ocr': 30000,
      'document.extract': 5000,
      'document.validate': 2000
    };
    
    return thresholds[operation] || 10000; // Default 10 seconds
  }

  // Health check
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: SystemMetrics;
    errors: string[];
  }> {
    const metrics = this.collectSystemMetrics();
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Check CPU
    if (metrics.cpuUsage > 90) {
      errors.push('CPU usage critical');
      status = 'unhealthy';
    } else if (metrics.cpuUsage > 70) {
      errors.push('CPU usage high');
      status = 'degraded';
    }
    
    // Check memory
    if (metrics.memoryUsage > 90) {
      errors.push('Memory usage critical');
      status = 'unhealthy';
    } else if (metrics.memoryUsage > 75) {
      errors.push('Memory usage high');
      status = 'degraded';
    }
    
    // Check heap
    if (metrics.heapUsed / metrics.heapTotal > 0.9) {
      errors.push('Heap usage critical');
      status = 'unhealthy';
    }
    
    return { status, metrics, errors };
  }

  // Cleanup
  public shutdown(): void {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    
    // Flush any remaining metrics
    this.statsd.close();
    
    this.info('Monitoring service shutdown');
  }
}

// Export singleton instance
export const monitoring = MonitoringService.getInstance();