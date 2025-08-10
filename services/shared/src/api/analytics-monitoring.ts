/**
 * Enterprise API Analytics and Monitoring System
 * Real-time metrics, performance tracking, and usage analytics
 */

import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { RedisCache } from '../cache/redis-cache';
import { logger } from '../utils/logger';

/**
 * API Metrics Interface
 */
export interface ApiMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  userId?: string;
  userAgent?: string;
  ip: string;
  timestamp: Date;
  apiVersion: string;
  errorCode?: string;
  cachehit?: boolean;
}

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  count: number;
  totalResponseTime: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorCount: number;
  errorRate: number;
  requestsPerMinute: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  lastUpdated: Date;
}

/**
 * Usage Analytics
 */
export interface UsageAnalytics {
  totalRequests: number;
  uniqueUsers: number;
  topEndpoints: Array<{ endpoint: string; count: number; percentage: number }>;
  topUsers: Array<{ userId: string; count: number; percentage: number }>;
  statusCodeDistribution: Record<number, number>;
  methodDistribution: Record<string, number>;
  hourlyDistribution: Record<number, number>;
  dailyDistribution: Record<string, number>;
  averageResponseTime: number;
  errorRate: number;
  timeRange: { start: Date; end: Date };
}

/**
 * Rate Limiting Metrics
 */
export interface RateLimitMetrics {
  endpoint: string;
  userId?: string;
  ip: string;
  requestCount: number;
  windowStart: Date;
  windowEnd: Date;
  isBlocked: boolean;
  lastRequest: Date;
}

/**
 * Health Check Metrics
 */
export interface HealthMetrics {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  activeConnections: number;
  errorRate: number;
  lastChecked: Date;
}

/**
 * API Analytics Engine
 */
export class ApiAnalyticsEngine extends EventEmitter {
  private cache: RedisCache;
  private metricsBuffer: ApiMetrics[] = [];
  private bufferSize: number;
  private flushInterval: number;
  private flushTimer?: NodeJS.Timeout;
  private performanceCache: Map<string, number[]> = new Map();

  constructor(config: {
    cache?: RedisCache;
    bufferSize?: number;
    flushInterval?: number;
  } = {}) {
    super();
    
    this.cache = config.cache || new RedisCache({ keyPrefix: 'analytics:' });
    this.bufferSize = config.bufferSize || 100;
    this.flushInterval = config.flushInterval || 60000; // 1 minute
    
    this.startFlushTimer();
    this.setupGracefulShutdown();
  }

  /**
   * Record API metrics
   */
  public async recordMetrics(metrics: ApiMetrics): Promise<void> {
    try {
      // Add to buffer
      this.metricsBuffer.push(metrics);

      // Update performance cache for real-time calculations
      const endpointKey = `${metrics.method}:${metrics.endpoint}`;
      if (!this.performanceCache.has(endpointKey)) {
        this.performanceCache.set(endpointKey, []);
      }
      
      const responseTimes = this.performanceCache.get(endpointKey)!;
      responseTimes.push(metrics.responseTime);
      
      // Keep only last 1000 response times per endpoint
      if (responseTimes.length > 1000) {
        responseTimes.splice(0, responseTimes.length - 1000);
      }

      // Flush if buffer is full
      if (this.metricsBuffer.length >= this.bufferSize) {
        await this.flushMetrics();
      }

      // Emit real-time events
      this.emit('metrics', metrics);
      
      // Emit alerts for slow requests
      if (metrics.responseTime > 5000) { // 5 seconds
        this.emit('slowRequest', metrics);
      }

      // Emit alerts for errors
      if (metrics.statusCode >= 400) {
        this.emit('error', metrics);
      }

    } catch (error) {
      logger.error('Failed to record metrics', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics 
      });
    }
  }

  /**
   * Get performance metrics for an endpoint
   */
  public async getPerformanceMetrics(
    endpoint: string,
    method: string,
    timeRange: { start: Date; end: Date }
  ): Promise<PerformanceMetrics | null> {
    try {
      const key = `perf:${method}:${endpoint}`;
      const cached = await this.cache.get(key);
      
      if (cached) {
        return cached as PerformanceMetrics;
      }

      // Calculate from raw metrics (this would typically query a time-series DB)
      const metrics = await this.calculatePerformanceMetrics(endpoint, method, timeRange);
      
      // Cache for 5 minutes
      await this.cache.set(key, metrics, { ttl: 300 });
      
      return metrics;

    } catch (error) {
      logger.error('Failed to get performance metrics', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint, 
        method 
      });
      return null;
    }
  }

  /**
   * Get usage analytics
   */
  public async getUsageAnalytics(timeRange: { start: Date; end: Date }): Promise<UsageAnalytics | null> {
    try {
      const cacheKey = `usage:${timeRange.start.toISOString()}:${timeRange.end.toISOString()}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return cached as UsageAnalytics;
      }

      const analytics = await this.calculateUsageAnalytics(timeRange);
      
      // Cache for 10 minutes
      await this.cache.set(cacheKey, analytics, { ttl: 600 });
      
      return analytics;

    } catch (error) {
      logger.error('Failed to get usage analytics', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timeRange 
      });
      return null;
    }
  }

  /**
   * Get real-time metrics dashboard data
   */
  public async getDashboardMetrics(): Promise<{
    currentRpm: number;
    averageResponseTime: number;
    errorRate: number;
    activeEndpoints: number;
    topSlowEndpoints: Array<{ endpoint: string; avgTime: number }>;
    recentErrors: ApiMetrics[];
  }> {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      
      const recentMetrics = this.metricsBuffer.filter(
        m => m.timestamp >= oneMinuteAgo
      );

      const currentRpm = recentMetrics.length;
      const totalResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0);
      const averageResponseTime = totalResponseTime / (recentMetrics.length || 1);
      const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
      const errorRate = (errorCount / (recentMetrics.length || 1)) * 100;
      const activeEndpoints = new Set(recentMetrics.map(m => m.endpoint)).size;

      // Calculate top slow endpoints from performance cache
      const topSlowEndpoints = Array.from(this.performanceCache.entries())
        .map(([key, times]) => {
          const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
          return { endpoint: key, avgTime };
        })
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 5);

      const recentErrors = recentMetrics
        .filter(m => m.statusCode >= 400)
        .slice(-10); // Last 10 errors

      return {
        currentRpm,
        averageResponseTime,
        errorRate,
        activeEndpoints,
        topSlowEndpoints,
        recentErrors
      };

    } catch (error) {
      logger.error('Failed to get dashboard metrics', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate performance report
   */
  public async generatePerformanceReport(
    timeRange: { start: Date; end: Date }
  ): Promise<{
    summary: {
      totalRequests: number;
      averageResponseTime: number;
      errorRate: number;
      peakRpm: number;
      slowestEndpoint: string;
    };
    endpointBreakdown: PerformanceMetrics[];
    recommendations: string[];
  }> {
    try {
      // This would typically query a time-series database
      // For now, we'll use a simplified calculation
      
      const summary = {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        peakRpm: 0,
        slowestEndpoint: ''
      };

      const endpointBreakdown: PerformanceMetrics[] = [];
      const recommendations: string[] = [];

      // Calculate recommendations based on metrics
      if (summary.averageResponseTime > 2000) {
        recommendations.push('Consider implementing caching for slow endpoints');
      }
      
      if (summary.errorRate > 5) {
        recommendations.push('High error rate detected - review error logs');
      }

      return {
        summary,
        endpointBreakdown,
        recommendations
      };

    } catch (error) {
      logger.error('Failed to generate performance report', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timeRange 
      });
      throw error;
    }
  }

  /**
   * Flush metrics buffer to persistent storage
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metricsToFlush = [...this.metricsBuffer];
      this.metricsBuffer = [];

      // Store raw metrics (would typically be a time-series database)
      const batch: Array<[string, any]> = metricsToFlush.map(metric => [
        `raw:${metric.timestamp.getTime()}:${Math.random()}`,
        metric
      ]);

      await this.cache.setMultiple(batch, { ttl: 86400 * 7 }); // 7 days

      // Update aggregated metrics
      await this.updateAggregatedMetrics(metricsToFlush);

      this.emit('metricsFlushed', { count: metricsToFlush.length });

    } catch (error) {
      logger.error('Failed to flush metrics', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        bufferSize: this.metricsBuffer.length 
      });
    }
  }

  /**
   * Update aggregated metrics
   */
  private async updateAggregatedMetrics(metrics: ApiMetrics[]): Promise<void> {
    const aggregations = new Map<string, any>();

    for (const metric of metrics) {
      const endpointKey = `${metric.method}:${metric.endpoint}`;
      
      if (!aggregations.has(endpointKey)) {
        aggregations.set(endpointKey, {
          count: 0,
          totalTime: 0,
          errorCount: 0,
          responseTimes: []
        });
      }

      const agg = aggregations.get(endpointKey);
      agg.count++;
      agg.totalTime += metric.responseTime;
      agg.responseTimes.push(metric.responseTime);
      
      if (metric.statusCode >= 400) {
        agg.errorCount++;
      }
    }

    // Store aggregated data
    const updates: Array<[string, any]> = [];
    
    for (const [key, agg] of aggregations) {
      // Sort response times for percentile calculation
      agg.responseTimes.sort((a: number, b: number) => a - b);
      
      const performanceMetric: Partial<PerformanceMetrics> = {
        endpoint: key.split(':')[1],
        method: key.split(':')[0],
        count: agg.count,
        totalResponseTime: agg.totalTime,
        averageResponseTime: agg.totalTime / agg.count,
        minResponseTime: agg.responseTimes[0],
        maxResponseTime: agg.responseTimes[agg.responseTimes.length - 1],
        errorCount: agg.errorCount,
        errorRate: (agg.errorCount / agg.count) * 100,
        p95ResponseTime: this.calculatePercentile(agg.responseTimes, 95),
        p99ResponseTime: this.calculatePercentile(agg.responseTimes, 99),
        lastUpdated: new Date()
      };

      updates.push([`agg:${key}`, performanceMetric]);
    }

    await this.cache.setMultiple(updates, { ttl: 86400 }); // 24 hours
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }

  /**
   * Calculate performance metrics (placeholder - would query time-series DB)
   */
  private async calculatePerformanceMetrics(
    endpoint: string,
    method: string,
    timeRange: { start: Date; end: Date }
  ): Promise<PerformanceMetrics> {
    // This is a placeholder implementation
    // In a real system, this would query a time-series database
    
    return {
      endpoint,
      method,
      count: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      errorCount: 0,
      errorRate: 0,
      requestsPerMinute: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate usage analytics (placeholder - would query time-series DB)
   */
  private async calculateUsageAnalytics(
    timeRange: { start: Date; end: Date }
  ): Promise<UsageAnalytics> {
    // This is a placeholder implementation
    return {
      totalRequests: 0,
      uniqueUsers: 0,
      topEndpoints: [],
      topUsers: [],
      statusCodeDistribution: {},
      methodDistribution: {},
      hourlyDistribution: {},
      dailyDistribution: {},
      averageResponseTime: 0,
      errorRate: 0,
      timeRange
    };
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics().catch(error => 
        logger.error('Scheduled metrics flush failed', { error })
      );
    }, this.flushInterval);
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
      await this.flushMetrics();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('beforeExit', shutdown);
  }
}

/**
 * Analytics Middleware Factory
 */
export function createAnalyticsMiddleware(analytics: ApiAnalyticsEngine) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestSize = JSON.stringify(req.body || {}).length;

    // Store start time in request
    (req as any).analyticsStartTime = startTime;

    // Intercept response to capture metrics
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function(body: any) {
      captureMetrics(body);
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      captureMetrics(body);
      return originalJson.call(this, body);
    };

    function captureMetrics(responseBody: any) {
      const responseTime = Date.now() - startTime;
      const responseSize = JSON.stringify(responseBody || {}).length;

      const metrics: ApiMetrics = {
        endpoint: req.route?.path || req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        requestSize,
        responseSize,
        userId: (req as any).user?.id,
        userAgent: req.get('user-agent'),
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        timestamp: new Date(startTime),
        apiVersion: (req as any).apiVersion || '1.0.0',
        errorCode: responseBody?.error?.code,
        cachehit: res.get('X-Cache-Status') === 'HIT'
      };

      // Record metrics asynchronously
      analytics.recordMetrics(metrics).catch(error =>
        logger.error('Failed to record request metrics', { error })
      );
    }

    next();
  };
}

/**
 * Health Check Middleware
 */
export function healthCheckMiddleware(serviceName: string) {
  return async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    
    try {
      const healthMetrics: HealthMetrics = {
        service: serviceName,
        status: 'healthy',
        responseTime: Date.now() - startTime,
        uptime: process.uptime(),
        memoryUsage: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        },
        cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
        activeConnections: (req.socket.server as any)?._connections || 0,
        errorRate: 0, // Would be calculated from recent metrics
        lastChecked: new Date()
      };

      // Determine status based on metrics
      if (healthMetrics.memoryUsage.percentage > 90 || healthMetrics.responseTime > 5000) {
        healthMetrics.status = 'degraded';
      }

      res.status(healthMetrics.status === 'healthy' ? 200 : 503).json({
        success: healthMetrics.status === 'healthy',
        data: healthMetrics,
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      res.status(503).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check failed'
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    }
  };
}

/**
 * Metrics Dashboard Routes
 */
export function createMetricsRoutes(analytics: ApiAnalyticsEngine) {
  const router = require('express').Router();

  // Real-time dashboard metrics
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const metrics = await analytics.getDashboardMetrics();
      res.json({ success: true, data: metrics });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: { code: 'METRICS_ERROR', message: 'Failed to get dashboard metrics' }
      });
    }
  });

  // Performance metrics for specific endpoint
  router.get('/performance/:endpoint', async (req: Request, res: Response) => {
    try {
      const { endpoint } = req.params;
      const method = req.query.method as string || 'GET';
      const start = new Date(req.query.start as string || Date.now() - 86400000); // 24h ago
      const end = new Date(req.query.end as string || Date.now());

      const metrics = await analytics.getPerformanceMetrics(endpoint, method, { start, end });
      res.json({ success: true, data: metrics });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: { code: 'METRICS_ERROR', message: 'Failed to get performance metrics' }
      });
    }
  });

  // Usage analytics
  router.get('/usage', async (req: Request, res: Response) => {
    try {
      const start = new Date(req.query.start as string || Date.now() - 86400000);
      const end = new Date(req.query.end as string || Date.now());

      const analytics_data = await analytics.getUsageAnalytics({ start, end });
      res.json({ success: true, data: analytics_data });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: { code: 'METRICS_ERROR', message: 'Failed to get usage analytics' }
      });
    }
  });

  // Performance report
  router.get('/report', async (req: Request, res: Response) => {
    try {
      const start = new Date(req.query.start as string || Date.now() - 604800000); // 7 days
      const end = new Date(req.query.end as string || Date.now());

      const report = await analytics.generatePerformanceReport({ start, end });
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: { code: 'METRICS_ERROR', message: 'Failed to generate report' }
      });
    }
  });

  return router;
}

export default {
  ApiAnalyticsEngine,
  createAnalyticsMiddleware,
  healthCheckMiddleware,
  createMetricsRoutes
};