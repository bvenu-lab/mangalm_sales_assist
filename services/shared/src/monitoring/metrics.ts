import { Registry, Counter, Histogram, Gauge, Summary, collectDefaultMetrics } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Create a Registry
export const metricsRegistry = new Registry();

// Enable default metrics (CPU, memory, etc.)
collectDefaultMetrics({ 
  register: metricsRegistry,
  prefix: 'mangalm_',
});

// HTTP metrics
export const httpRequestsTotal = new Counter({
  name: 'mangalm_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status', 'service'],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'mangalm_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpRequestSize = new Histogram({
  name: 'mangalm_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route', 'service'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [metricsRegistry],
});

export const httpResponseSize = new Histogram({
  name: 'mangalm_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'service'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [metricsRegistry],
});

// Business metrics
export const predictionsTotal = new Counter({
  name: 'mangalm_predictions_total',
  help: 'Total number of predictions made',
  labelNames: ['model', 'status', 'service'],
  registers: [metricsRegistry],
});

export const predictionDuration = new Histogram({
  name: 'mangalm_prediction_duration_seconds',
  help: 'Duration of predictions in seconds',
  labelNames: ['model', 'service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

export const ordersProcessed = new Counter({
  name: 'mangalm_orders_processed_total',
  help: 'Total number of orders processed',
  labelNames: ['status', 'store', 'service'],
  registers: [metricsRegistry],
});

export const revenueTotal = new Counter({
  name: 'mangalm_revenue_total',
  help: 'Total revenue processed',
  labelNames: ['store', 'currency', 'service'],
  registers: [metricsRegistry],
});

// System metrics
export const activeConnections = new Gauge({
  name: 'mangalm_active_connections',
  help: 'Number of active connections',
  labelNames: ['type', 'service'],
  registers: [metricsRegistry],
});

export const databasePoolSize = new Gauge({
  name: 'mangalm_database_pool_size',
  help: 'Database connection pool size',
  labelNames: ['pool', 'service'],
  registers: [metricsRegistry],
});

export const databasePoolActive = new Gauge({
  name: 'mangalm_database_pool_active_connections',
  help: 'Active database connections',
  labelNames: ['pool', 'service'],
  registers: [metricsRegistry],
});

export const cacheHits = new Counter({
  name: 'mangalm_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache', 'service'],
  registers: [metricsRegistry],
});

export const cacheMisses = new Counter({
  name: 'mangalm_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache', 'service'],
  registers: [metricsRegistry],
});

// Queue metrics
export const queueSize = new Gauge({
  name: 'mangalm_queue_size',
  help: 'Current queue size',
  labelNames: ['queue', 'service'],
  registers: [metricsRegistry],
});

export const messagesProcessed = new Counter({
  name: 'mangalm_messages_processed_total',
  help: 'Total messages processed',
  labelNames: ['queue', 'status', 'service'],
  registers: [metricsRegistry],
});

// Error metrics
export const errorsTotal = new Counter({
  name: 'mangalm_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'service', 'severity'],
  registers: [metricsRegistry],
});

// API rate limiting metrics
export const rateLimitHits = new Counter({
  name: 'mangalm_rate_limit_hits_total',
  help: 'Number of rate limit hits',
  labelNames: ['endpoint', 'service'],
  registers: [metricsRegistry],
});

// WebSocket metrics
export const websocketConnections = new Gauge({
  name: 'mangalm_websocket_connections',
  help: 'Active WebSocket connections',
  labelNames: ['service'],
  registers: [metricsRegistry],
});

export const websocketMessages = new Counter({
  name: 'mangalm_websocket_messages_total',
  help: 'Total WebSocket messages',
  labelNames: ['direction', 'type', 'service'],
  registers: [metricsRegistry],
});

// AI/ML specific metrics
export const modelLoadTime = new Histogram({
  name: 'mangalm_model_load_time_seconds',
  help: 'Time to load ML models',
  labelNames: ['model', 'version', 'service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

export const modelAccuracy = new Gauge({
  name: 'mangalm_model_accuracy',
  help: 'Model accuracy score',
  labelNames: ['model', 'version', 'service'],
  registers: [metricsRegistry],
});

export const featureExtractionTime = new Histogram({
  name: 'mangalm_feature_extraction_time_seconds',
  help: 'Time to extract features',
  labelNames: ['feature_set', 'service'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

// Integration metrics
export const zohoAPICallsTotal = new Counter({
  name: 'mangalm_zoho_api_calls_total',
  help: 'Total Zoho API calls',
  labelNames: ['endpoint', 'status', 'service'],
  registers: [metricsRegistry],
});

export const zohoAPILatency = new Histogram({
  name: 'mangalm_zoho_api_latency_seconds',
  help: 'Zoho API call latency',
  labelNames: ['endpoint', 'service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

export const dataSyncOperations = new Counter({
  name: 'mangalm_data_sync_operations_total',
  help: 'Total data sync operations',
  labelNames: ['source', 'destination', 'status', 'service'],
  registers: [metricsRegistry],
});

/**
 * Express middleware for collecting HTTP metrics
 */
export function metricsMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const route = req.route?.path || req.path || 'unknown';

    // Collect request size
    const requestSize = parseInt(req.headers['content-length'] || '0', 10);
    if (requestSize > 0) {
      httpRequestSize.observe(
        { method: req.method, route, service: serviceName },
        requestSize
      );
    }

    // Hook into response finish event
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const status = res.statusCode.toString();

      // Record metrics
      httpRequestsTotal.inc({
        method: req.method,
        route,
        status,
        service: serviceName,
      });

      httpRequestDuration.observe(
        {
          method: req.method,
          route,
          status,
          service: serviceName,
        },
        duration
      );

      // Collect response size
      const responseSize = parseInt(res.getHeader('content-length') as string || '0', 10);
      if (responseSize > 0) {
        httpResponseSize.observe(
          { method: req.method, route, service: serviceName },
          responseSize
        );
      }

      // Track errors
      if (res.statusCode >= 400) {
        const severity = res.statusCode >= 500 ? 'error' : 'warning';
        errorsTotal.inc({
          type: 'http',
          service: serviceName,
          severity,
        });
      }
    });

    next();
  };
}

/**
 * Metrics endpoint handler
 */
export async function metricsHandler(req: Request, res: Response) {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    const metrics = await metricsRegistry.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
}

/**
 * Custom metrics collector class for business logic
 */
export class MetricsCollector {
  constructor(private serviceName: string) {}

  recordPrediction(model: string, status: 'success' | 'failure', duration: number) {
    predictionsTotal.inc({ model, status, service: this.serviceName });
    predictionDuration.observe({ model, service: this.serviceName }, duration / 1000);
  }

  recordOrder(status: 'completed' | 'failed' | 'cancelled', store: string, amount?: number) {
    ordersProcessed.inc({ status, store, service: this.serviceName });
    if (amount && status === 'completed') {
      revenueTotal.inc({ store, currency: 'USD', service: this.serviceName }, amount);
    }
  }

  recordCacheOperation(cache: string, hit: boolean) {
    if (hit) {
      cacheHits.inc({ cache, service: this.serviceName });
    } else {
      cacheMisses.inc({ cache, service: this.serviceName });
    }
  }

  recordError(type: string, severity: 'warning' | 'error' | 'critical') {
    errorsTotal.inc({ type, service: this.serviceName, severity });
  }

  recordAPICall(endpoint: string, status: 'success' | 'failure', latency: number) {
    zohoAPICallsTotal.inc({ endpoint, status, service: this.serviceName });
    zohoAPILatency.observe({ endpoint, service: this.serviceName }, latency / 1000);
  }

  recordDataSync(source: string, destination: string, status: 'success' | 'failure') {
    dataSyncOperations.inc({ source, destination, status, service: this.serviceName });
  }

  setActiveConnections(type: string, count: number) {
    activeConnections.set({ type, service: this.serviceName }, count);
  }

  setDatabasePoolMetrics(poolName: string, size: number, active: number) {
    databasePoolSize.set({ pool: poolName, service: this.serviceName }, size);
    databasePoolActive.set({ pool: poolName, service: this.serviceName }, active);
  }

  setQueueSize(queueName: string, size: number) {
    queueSize.set({ queue: queueName, service: this.serviceName }, size);
  }

  recordMessageProcessed(queue: string, status: 'success' | 'failure') {
    messagesProcessed.inc({ queue, status, service: this.serviceName });
  }

  recordWebSocketConnection(delta: number) {
    websocketConnections.inc({ service: this.serviceName }, delta);
  }

  recordWebSocketMessage(direction: 'inbound' | 'outbound', type: string) {
    websocketMessages.inc({ direction, type, service: this.serviceName });
  }

  recordModelMetrics(model: string, version: string, loadTime: number, accuracy?: number) {
    modelLoadTime.observe({ model, version, service: this.serviceName }, loadTime / 1000);
    if (accuracy !== undefined) {
      modelAccuracy.set({ model, version, service: this.serviceName }, accuracy);
    }
  }

  recordFeatureExtraction(featureSet: string, duration: number) {
    featureExtractionTime.observe({ feature_set: featureSet, service: this.serviceName }, duration / 1000);
  }

  recordRateLimitHit(endpoint: string) {
    rateLimitHits.inc({ endpoint, service: this.serviceName });
  }
}