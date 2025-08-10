import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import { Histogram, Summary } from 'prom-client';

export interface PerformanceMetric {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, any>;
}

export interface PerformanceThresholds {
  warning: number;
  critical: number;
}

/**
 * Performance monitoring class for tracking application performance
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private thresholds: Map<string, PerformanceThresholds> = new Map();
  private observer: PerformanceObserver;
  private histograms: Map<string, Histogram<string>> = new Map();
  private summaries: Map<string, Summary<string>> = new Map();

  constructor(private serviceName: string) {
    super();
    this.setupObserver();
  }

  /**
   * Set up performance observer
   */
  private setupObserver() {
    this.observer = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        this.recordMetric({
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
          endTime: entry.startTime + entry.duration,
        });
      });
    });

    this.observer.observe({ entryTypes: ['measure', 'function'] });
  }

  /**
   * Start a performance measurement
   */
  startMeasure(name: string, metadata?: Record<string, any>): () => void {
    const startMark = `${name}-start-${Date.now()}`;
    performance.mark(startMark);

    return () => {
      const endMark = `${name}-end-${Date.now()}`;
      performance.mark(endMark);
      
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure').pop();
        
        if (measure) {
          this.recordMetric({
            name,
            duration: measure.duration,
            startTime: measure.startTime,
            endTime: measure.startTime + measure.duration,
            metadata,
          });
        }
      } finally {
        // Clean up marks
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(name);
      }
    };
  }

  /**
   * Measure async function performance
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const endMeasure = this.startMeasure(name, metadata);
    try {
      return await fn();
    } finally {
      endMeasure();
    }
  }

  /**
   * Measure sync function performance
   */
  measureSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const endMeasure = this.startMeasure(name, metadata);
    try {
      return fn();
    } finally {
      endMeasure();
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetric) {
    // Store metric
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }
    this.metrics.get(metric.name)!.push(metric);

    // Update Prometheus metrics if configured
    if (this.histograms.has(metric.name)) {
      this.histograms.get(metric.name)!.observe(metric.duration / 1000);
    }
    if (this.summaries.has(metric.name)) {
      this.summaries.get(metric.name)!.observe(metric.duration / 1000);
    }

    // Check thresholds
    this.checkThresholds(metric);

    // Emit event
    this.emit('metric', metric);

    // Cleanup old metrics (keep last 1000 per metric name)
    const metrics = this.metrics.get(metric.name)!;
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  /**
   * Check if metric exceeds thresholds
   */
  private checkThresholds(metric: PerformanceMetric) {
    const threshold = this.thresholds.get(metric.name);
    if (!threshold) return;

    if (metric.duration > threshold.critical) {
      this.emit('threshold:critical', {
        metric,
        threshold: threshold.critical,
        level: 'critical',
      });
    } else if (metric.duration > threshold.warning) {
      this.emit('threshold:warning', {
        metric,
        threshold: threshold.warning,
        level: 'warning',
      });
    }
  }

  /**
   * Set performance thresholds for a metric
   */
  setThreshold(name: string, warning: number, critical: number) {
    this.thresholds.set(name, { warning, critical });
  }

  /**
   * Register Prometheus histogram for a metric
   */
  registerHistogram(name: string, histogram: Histogram<string>) {
    this.histograms.set(name, histogram);
  }

  /**
   * Register Prometheus summary for a metric
   */
  registerSummary(name: string, summary: Summary<string>) {
    this.summaries.set(name, summary);
  }

  /**
   * Get statistics for a metric
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count,
      min: durations[0],
      max: durations[count - 1],
      mean: sum / count,
      median: durations[Math.floor(count / 2)],
      p95: durations[Math.floor(count * 0.95)],
      p99: durations[Math.floor(count * 0.99)],
    };
  }

  /**
   * Get all metrics for a given name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Clear metrics for a given name
   */
  clearMetrics(name?: string) {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): Record<string, any> {
    const report: Record<string, any> = {
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      metrics: {},
    };

    for (const [name, metrics] of this.metrics.entries()) {
      report.metrics[name] = this.getStats(name);
    }

    return report;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.observer.disconnect();
    this.removeAllListeners();
    this.metrics.clear();
    this.thresholds.clear();
    this.histograms.clear();
    this.summaries.clear();
  }
}

/**
 * Performance monitoring decorator
 */
export function MonitorPerformance(name?: string, thresholds?: PerformanceThresholds) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = (this as any).performanceMonitor || new PerformanceMonitor('default');
      
      if (thresholds) {
        monitor.setThreshold(metricName, thresholds.warning, thresholds.critical);
      }

      return monitor.measureAsync(metricName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Resource usage monitor
 */
export class ResourceMonitor {
  private interval: NodeJS.Timeout | null = null;
  private samples: Array<{
    timestamp: number;
    cpu: NodeJS.CpuUsage;
    memory: NodeJS.MemoryUsage;
  }> = [];

  constructor(
    private sampleInterval: number = 1000,
    private maxSamples: number = 60
  ) {}

  /**
   * Start monitoring
   */
  start() {
    if (this.interval) return;

    let lastCpu = process.cpuUsage();
    
    this.interval = setInterval(() => {
      const currentCpu = process.cpuUsage(lastCpu);
      const memory = process.memoryUsage();
      
      this.samples.push({
        timestamp: Date.now(),
        cpu: currentCpu,
        memory,
      });

      // Keep only recent samples
      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }

      lastCpu = process.cpuUsage();
    }, this.sampleInterval);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Get current resource usage
   */
  getCurrentUsage() {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    
    return {
      memory: {
        rss: memory.rss / 1024 / 1024, // MB
        heapTotal: memory.heapTotal / 1024 / 1024, // MB
        heapUsed: memory.heapUsed / 1024 / 1024, // MB
        external: memory.external / 1024 / 1024, // MB
      },
      cpu: {
        user: cpu.user / 1000000, // seconds
        system: cpu.system / 1000000, // seconds
      },
    };
  }

  /**
   * Get average resource usage
   */
  getAverageUsage() {
    if (this.samples.length === 0) return null;

    const avgMemory = {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
    };

    const avgCpu = {
      user: 0,
      system: 0,
    };

    for (const sample of this.samples) {
      avgMemory.rss += sample.memory.rss;
      avgMemory.heapTotal += sample.memory.heapTotal;
      avgMemory.heapUsed += sample.memory.heapUsed;
      avgMemory.external += sample.memory.external;
      avgCpu.user += sample.cpu.user;
      avgCpu.system += sample.cpu.system;
    }

    const count = this.samples.length;
    
    return {
      memory: {
        rss: avgMemory.rss / count / 1024 / 1024, // MB
        heapTotal: avgMemory.heapTotal / count / 1024 / 1024, // MB
        heapUsed: avgMemory.heapUsed / count / 1024 / 1024, // MB
        external: avgMemory.external / count / 1024 / 1024, // MB
      },
      cpu: {
        user: avgCpu.user / count / 1000000, // seconds
        system: avgCpu.system / count / 1000000, // seconds
      },
    };
  }

  /**
   * Get peak resource usage
   */
  getPeakUsage() {
    if (this.samples.length === 0) return null;

    let peakMemory = {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
    };

    let peakCpu = {
      user: 0,
      system: 0,
    };

    for (const sample of this.samples) {
      peakMemory.rss = Math.max(peakMemory.rss, sample.memory.rss);
      peakMemory.heapTotal = Math.max(peakMemory.heapTotal, sample.memory.heapTotal);
      peakMemory.heapUsed = Math.max(peakMemory.heapUsed, sample.memory.heapUsed);
      peakMemory.external = Math.max(peakMemory.external, sample.memory.external);
      peakCpu.user = Math.max(peakCpu.user, sample.cpu.user);
      peakCpu.system = Math.max(peakCpu.system, sample.cpu.system);
    }

    return {
      memory: {
        rss: peakMemory.rss / 1024 / 1024, // MB
        heapTotal: peakMemory.heapTotal / 1024 / 1024, // MB
        heapUsed: peakMemory.heapUsed / 1024 / 1024, // MB
        external: peakMemory.external / 1024 / 1024, // MB
      },
      cpu: {
        user: peakCpu.user / 1000000, // seconds
        system: peakCpu.system / 1000000, // seconds
      },
    };
  }

  /**
   * Clear samples
   */
  clear() {
    this.samples = [];
  }

  /**
   * Destroy monitor
   */
  destroy() {
    this.stop();
    this.clear();
  }
}

/**
 * Database query performance monitor
 */
export class DatabasePerformanceMonitor {
  private queries: Map<string, Array<{
    duration: number;
    timestamp: number;
    rowCount?: number;
  }>> = new Map();

  /**
   * Record query performance
   */
  recordQuery(query: string, duration: number, rowCount?: number) {
    const key = this.normalizeQuery(query);
    
    if (!this.queries.has(key)) {
      this.queries.set(key, []);
    }

    this.queries.get(key)!.push({
      duration,
      timestamp: Date.now(),
      rowCount,
    });

    // Keep only last 100 executions per query
    const executions = this.queries.get(key)!;
    if (executions.length > 100) {
      executions.shift();
    }
  }

  /**
   * Normalize query for grouping
   */
  private normalizeQuery(query: string): string {
    // Remove specific values to group similar queries
    return query
      .replace(/\d+/g, '?')  // Replace numbers with ?
      .replace(/'[^']*'/g, '?')  // Replace string literals with ?
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim()
      .substring(0, 200);  // Truncate long queries
  }

  /**
   * Get slow queries
   */
  getSlowQueries(threshold: number = 1000): Array<{
    query: string;
    avgDuration: number;
    executions: number;
  }> {
    const slowQueries: Array<{
      query: string;
      avgDuration: number;
      executions: number;
    }> = [];

    for (const [query, executions] of this.queries.entries()) {
      const avgDuration = executions.reduce((sum, e) => sum + e.duration, 0) / executions.length;
      
      if (avgDuration > threshold) {
        slowQueries.push({
          query,
          avgDuration,
          executions: executions.length,
        });
      }
    }

    return slowQueries.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  /**
   * Get query statistics
   */
  getQueryStats(): Array<{
    query: string;
    count: number;
    minDuration: number;
    maxDuration: number;
    avgDuration: number;
    totalDuration: number;
  }> {
    const stats: Array<{
      query: string;
      count: number;
      minDuration: number;
      maxDuration: number;
      avgDuration: number;
      totalDuration: number;
    }> = [];

    for (const [query, executions] of this.queries.entries()) {
      const durations = executions.map(e => e.duration);
      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      
      stats.push({
        query,
        count: executions.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        avgDuration: totalDuration / executions.length,
        totalDuration,
      });
    }

    return stats.sort((a, b) => b.totalDuration - a.totalDuration);
  }

  /**
   * Clear query data
   */
  clear() {
    this.queries.clear();
  }
}