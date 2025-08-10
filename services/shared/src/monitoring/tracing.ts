import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor, ConsoleSpanExporter, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { 
  trace, 
  context, 
  SpanStatusCode, 
  SpanKind,
  Span,
  Context,
  Tracer
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { Request, Response, NextFunction } from 'express';

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  jaegerEndpoint?: string;
  enableConsoleExporter?: boolean;
  enablePrometheus?: boolean;
  prometheusPort?: number;
}

/**
 * Initialize OpenTelemetry tracing
 */
export function initializeTracing(config: TracingConfig): NodeSDK {
  const {
    serviceName,
    serviceVersion = '1.0.0',
    environment = process.env.NODE_ENV || 'development',
    jaegerEndpoint = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    enableConsoleExporter = process.env.ENABLE_CONSOLE_TRACING === 'true',
    enablePrometheus = process.env.ENABLE_PROMETHEUS_METRICS === 'true',
    prometheusPort = parseInt(process.env.PROMETHEUS_PORT || '9464', 10),
  } = config;

  // Create resource
  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
      [SemanticResourceAttributes.HOST_NAME]: process.env.HOSTNAME || 'localhost',
    })
  );

  // Create span processors
  const spanProcessors: SpanProcessor[] = [];

  // Jaeger exporter
  const jaegerExporter = new JaegerExporter({
    endpoint: jaegerEndpoint,
  });
  spanProcessors.push(new BatchSpanProcessor(jaegerExporter));

  // Console exporter (for debugging)
  if (enableConsoleExporter) {
    spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()));
  }

  // Initialize SDK
  const sdk = new NodeSDK({
    resource,
    spanProcessor: spanProcessors[0], // SDK expects single processor
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable fs instrumentation to reduce noise
        },
      }),
    ],
    textMapPropagator: new W3CTraceContextPropagator(),
  });

  // Initialize Prometheus metrics if enabled
  if (enablePrometheus) {
    const prometheusExporter = new PrometheusExporter(
      {
        port: prometheusPort,
        endpoint: '/metrics',
      },
      () => {
        console.log(`Prometheus metrics server started on port ${prometheusPort}`);
      }
    );

    const meterProvider = new MeterProvider({
      resource,
      readers: [prometheusExporter],
    });
  }

  // Initialize the SDK
  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.error('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });

  return sdk;
}

/**
 * Get or create a tracer instance
 */
export function getTracer(name: string, version?: string): Tracer {
  return trace.getTracer(name, version);
}

/**
 * Express middleware for distributed tracing
 */
export function tracingMiddleware(serviceName: string) {
  const tracer = getTracer(serviceName);

  return (req: Request, res: Response, next: NextFunction) => {
    const spanName = `${req.method} ${req.route?.path || req.path}`;
    
    // Extract parent context from headers
    const parentContext = trace.getSpanContext(context.active());
    
    // Start a new span
    const span = tracer.startSpan(spanName, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.scheme': req.protocol,
        'http.user_agent': req.headers['user-agent'] || 'unknown',
        'net.peer.ip': req.ip,
        'service.name': serviceName,
      },
    });

    // Store span in request for later use
    (req as any).span = span;
    (req as any).tracer = tracer;

    // Create context with span
    const ctx = trace.setSpan(context.active(), span);

    // Run the rest of the request in the context
    context.with(ctx, () => {
      // Hook into response finish
      res.on('finish', () => {
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response.size': parseInt(res.getHeader('content-length') as string || '0', 10),
        });

        // Set span status based on HTTP status code
        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        span.end();
      });

      next();
    });
  };
}

/**
 * Decorator for tracing class methods
 */
export function Trace(spanName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = async function (...args: any[]) {
      const tracer = getTracer(className);
      const name = spanName || `${className}.${propertyKey}`;
      
      return tracer.startActiveSpan(name, async (span) => {
        try {
          // Add method metadata
          span.setAttributes({
            'code.function': propertyKey,
            'code.namespace': className,
          });

          const result = await originalMethod.apply(this, args);
          
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}

/**
 * Utility class for manual span management
 */
export class TracingUtils {
  private tracer: Tracer;

  constructor(serviceName: string) {
    this.tracer = getTracer(serviceName);
  }

  /**
   * Start a new span
   */
  startSpan(name: string, options?: any): Span {
    return this.tracer.startSpan(name, options);
  }

  /**
   * Create a child span
   */
  startChildSpan(name: string, parentSpan?: Span): Span {
    const ctx = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();
    return this.tracer.startSpan(name, undefined, ctx);
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: any) {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set attributes on current span
   */
  setAttributes(attributes: any) {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Record an exception
   */
  recordException(error: Error) {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }
  }

  /**
   * Execute function within a span
   */
  async withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    return this.tracer.startActiveSpan(name, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Create a span for database operations
   */
  async traceDatabaseOperation<T>(
    operation: string,
    query: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.withSpan(`db.${operation}`, async (span) => {
      span.setAttributes({
        'db.system': 'postgresql',
        'db.operation': operation,
        'db.statement': query.substring(0, 1000), // Truncate long queries
      });
      return fn();
    });
  }

  /**
   * Create a span for external API calls
   */
  async traceAPICall<T>(
    service: string,
    method: string,
    url: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.withSpan(`http.${service}`, async (span) => {
      span.setAttributes({
        'http.method': method,
        'http.url': url,
        'peer.service': service,
        'span.kind': 'client',
      });
      return fn();
    });
  }

  /**
   * Create a span for cache operations
   */
  async traceCacheOperation<T>(
    operation: 'get' | 'set' | 'delete',
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.withSpan(`cache.${operation}`, async (span) => {
      span.setAttributes({
        'cache.operation': operation,
        'cache.key': key,
      });
      const result = await fn();
      
      // Add cache hit/miss for get operations
      if (operation === 'get') {
        span.setAttribute('cache.hit', result !== null && result !== undefined);
      }
      
      return result;
    });
  }

  /**
   * Create a span for message queue operations
   */
  async traceMessageOperation<T>(
    operation: 'send' | 'receive' | 'process',
    queue: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.withSpan(`queue.${operation}`, async (span) => {
      span.setAttributes({
        'messaging.system': 'rabbitmq',
        'messaging.destination': queue,
        'messaging.operation': operation,
      });
      return fn();
    });
  }
}

/**
 * Context propagation utilities
 */
export class ContextPropagation {
  /**
   * Extract trace context from HTTP headers
   */
  static extractFromHeaders(headers: any): Context {
    const propagator = new W3CTraceContextPropagator();
    return propagator.extract(context.active(), headers, {
      get(headers, key) {
        return headers[key];
      },
      keys(headers) {
        return Object.keys(headers);
      },
    });
  }

  /**
   * Inject trace context into HTTP headers
   */
  static injectToHeaders(headers: any = {}): any {
    const propagator = new W3CTraceContextPropagator();
    propagator.inject(context.active(), headers, {
      set(headers, key, value) {
        headers[key] = value;
      },
    });
    return headers;
  }

  /**
   * Get current trace ID
   */
  static getCurrentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().traceId;
  }

  /**
   * Get current span ID
   */
  static getCurrentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().spanId;
  }
}