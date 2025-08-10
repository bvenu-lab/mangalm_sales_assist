/**
 * World-class Performance Monitoring Service
 * Real User Monitoring (RUM) with comprehensive metrics
 */

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PageLoadMetrics {
  ttfb: number; // Time to First Byte
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  tti: number; // Time to Interactive
  totalBlockingTime: number;
  domContentLoaded: number;
  windowLoad: number;
}

interface ResourceMetrics {
  name: string;
  type: string;
  duration: number;
  size: number;
  cached: boolean;
  protocol: string;
}

interface UserAction {
  type: string;
  target: string;
  timestamp: number;
  duration?: number;
  success?: boolean;
  error?: string;
}

interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private userActions: UserAction[] = [];
  private sessionId: string;
  private userId?: string;
  private analyticsEndpoint?: string;
  private bufferSize = 50;
  private flushInterval = 30000; // 30 seconds
  private observers: Map<string, PerformanceObserver> = new Map();
  private timers: Map<string, number> = new Map();
  private longTaskThreshold = 50; // 50ms

  constructor(config?: {
    analyticsEndpoint?: string;
    bufferSize?: number;
    flushInterval?: number;
    userId?: string;
  }) {
    this.sessionId = this.generateSessionId();
    this.analyticsEndpoint = config?.analyticsEndpoint;
    this.bufferSize = config?.bufferSize || this.bufferSize;
    this.flushInterval = config?.flushInterval || this.flushInterval;
    this.userId = config?.userId;

    this.initializeObservers();
    this.startAutoFlush();
    this.attachEventListeners();
  }

  // Initialize Performance Observers
  private initializeObservers(): void {
    // Observe Long Tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric({
              name: 'long_task',
              value: entry.duration,
              unit: 'ms',
              timestamp: Date.now(),
              metadata: {
                startTime: entry.startTime,
                name: entry.name,
              },
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (error) {
        console.warn('Long task observer not supported');
      }

      // Observe Layout Shifts
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          let cls = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value;
            }
          }
          if (cls > 0) {
            this.recordMetric({
              name: 'cumulative_layout_shift',
              value: cls,
              unit: 'score',
              timestamp: Date.now(),
            });
          }
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('layout-shift', layoutShiftObserver);
      } catch (error) {
        console.warn('Layout shift observer not supported');
      }

      // Observe Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric({
            name: 'largest_contentful_paint',
            value: lastEntry.startTime,
            unit: 'ms',
            timestamp: Date.now(),
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);
      } catch (error) {
        console.warn('LCP observer not supported');
      }

      // Observe First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric({
              name: 'first_input_delay',
              value: (entry as any).processingStart - entry.startTime,
              unit: 'ms',
              timestamp: Date.now(),
            });
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.set('fid', fidObserver);
      } catch (error) {
        console.warn('FID observer not supported');
      }
    }
  }

  // Get page load metrics
  public getPageLoadMetrics(): PageLoadMetrics | null {
    if (!window.performance || !window.performance.timing) {
      return null;
    }

    const timing = window.performance.timing;
    const paintMetrics = performance.getEntriesByType('paint');

    const fcp = paintMetrics.find(
      (metric) => metric.name === 'first-contentful-paint'
    )?.startTime || 0;

    return {
      ttfb: timing.responseStart - timing.fetchStart,
      fcp,
      lcp: this.getLargestContentfulPaint(),
      fid: this.getFirstInputDelay(),
      cls: this.getCumulativeLayoutShift(),
      tti: this.getTimeToInteractive(),
      totalBlockingTime: this.getTotalBlockingTime(),
      domContentLoaded: timing.domContentLoadedEventEnd - timing.fetchStart,
      windowLoad: timing.loadEventEnd - timing.fetchStart,
    };
  }

  // Get resource loading metrics
  public getResourceMetrics(): ResourceMetrics[] {
    if (!window.performance || !window.performance.getEntriesByType) {
      return [];
    }

    const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    return resources.map((resource) => ({
      name: resource.name,
      type: resource.initiatorType,
      duration: resource.duration,
      size: resource.transferSize || 0,
      cached: resource.transferSize === 0 && resource.decodedBodySize > 0,
      protocol: resource.nextHopProtocol || 'unknown',
    }));
  }

  // Get memory metrics
  public getMemoryMetrics(): MemoryMetrics | null {
    if (!(performance as any).memory) {
      return null;
    }

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }

  // Start timing an operation
  public startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  // End timing and record metric
  public endTimer(name: string, metadata?: Record<string, any>): number | null {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer ${name} was not started`);
      return null;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    this.recordMetric({
      name: `timer_${name}`,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      metadata,
    });

    return duration;
  }

  // Record a custom metric
  public recordMetric(metric: PerformanceMetric): void {
    this.metrics.push({
      ...metric,
      metadata: {
        ...metric.metadata,
        sessionId: this.sessionId,
        userId: this.userId,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    });

    if (this.metrics.length >= this.bufferSize) {
      this.flush();
    }
  }

  // Record user action
  public recordUserAction(action: UserAction): void {
    this.userActions.push({
      ...action,
      timestamp: action.timestamp || Date.now(),
    });

    if (this.userActions.length >= this.bufferSize) {
      this.flush();
    }
  }

  // Track API call performance
  public trackApiCall(url: string, method: string, startTime: number, endTime: number, status: number): void {
    const duration = endTime - startTime;
    
    this.recordMetric({
      name: 'api_call',
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      metadata: {
        url,
        method,
        status,
        success: status >= 200 && status < 300,
      },
    });
  }

  // Track React component render
  public trackComponentRender(componentName: string, duration: number): void {
    this.recordMetric({
      name: 'component_render',
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      metadata: {
        component: componentName,
      },
    });
  }

  // Track custom event
  public trackEvent(eventName: string, data?: Record<string, any>): void {
    this.recordMetric({
      name: `event_${eventName}`,
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      metadata: data,
    });
  }

  // Get Web Vitals scores
  public getWebVitals(): {
    score: 'good' | 'needs-improvement' | 'poor';
    metrics: PageLoadMetrics | null;
  } {
    const metrics = this.getPageLoadMetrics();
    if (!metrics) {
      return { score: 'poor', metrics: null };
    }

    // Thresholds based on Web Vitals standards
    const isGood = 
      metrics.lcp < 2500 &&
      metrics.fid < 100 &&
      metrics.cls < 0.1;

    const isPoor = 
      metrics.lcp > 4000 ||
      metrics.fid > 300 ||
      metrics.cls > 0.25;

    return {
      score: isGood ? 'good' : isPoor ? 'poor' : 'needs-improvement',
      metrics,
    };
  }

  // Analyze performance bottlenecks
  public analyzeBottlenecks(): {
    slowResources: ResourceMetrics[];
    largeResources: ResourceMetrics[];
    uncachedResources: ResourceMetrics[];
  } {
    const resources = this.getResourceMetrics();
    
    return {
      slowResources: resources
        .filter((r) => r.duration > 1000)
        .sort((a, b) => b.duration - a.duration),
      largeResources: resources
        .filter((r) => r.size > 500000) // 500KB
        .sort((a, b) => b.size - a.size),
      uncachedResources: resources
        .filter((r) => !r.cached && r.type !== 'xmlhttprequest'),
    };
  }

  // Send metrics to analytics endpoint
  private async flush(): Promise<void> {
    if (!this.analyticsEndpoint || this.metrics.length === 0) {
      this.metrics = [];
      this.userActions = [];
      return;
    }

    const payload = {
      metrics: [...this.metrics],
      userActions: [...this.userActions],
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    this.metrics = [];
    this.userActions = [];

    try {
      await fetch(this.analyticsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Failed to send performance metrics:', error);
      // Re-add metrics to buffer for retry
      this.metrics.push(...payload.metrics);
      this.userActions.push(...payload.userActions);
    }
  }

  // Start auto flush
  private startAutoFlush(): void {
    setInterval(() => {
      if (this.metrics.length > 0 || this.userActions.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  // Attach event listeners
  private attachEventListeners(): void {
    // Send metrics before page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.recordMetric({
        name: 'visibility_change',
        value: document.hidden ? 0 : 1,
        unit: 'state',
        timestamp: Date.now(),
        metadata: {
          hidden: document.hidden,
        },
      });
    });

    // Track errors
    window.addEventListener('error', (event) => {
      this.recordMetric({
        name: 'javascript_error',
        value: 1,
        unit: 'count',
        timestamp: Date.now(),
        metadata: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordMetric({
        name: 'unhandled_rejection',
        value: 1,
        unit: 'count',
        timestamp: Date.now(),
        metadata: {
          reason: event.reason?.toString(),
        },
      });
    });
  }

  // Helper methods
  private getLargestContentfulPaint(): number {
    const entries = performance.getEntriesByType('largest-contentful-paint');
    const lastEntry = entries[entries.length - 1] as any;
    return lastEntry ? lastEntry.startTime : 0;
  }

  private getFirstInputDelay(): number {
    const entries = performance.getEntriesByType('first-input');
    if (entries.length > 0) {
      const entry = entries[0] as any;
      return entry.processingStart - entry.startTime;
    }
    return 0;
  }

  private getCumulativeLayoutShift(): number {
    let cls = 0;
    const entries = performance.getEntriesByType('layout-shift');
    for (const entry of entries) {
      if (!(entry as any).hadRecentInput) {
        cls += (entry as any).value;
      }
    }
    return cls;
  }

  private getTimeToInteractive(): number {
    // Simplified TTI calculation
    const timing = window.performance.timing;
    return timing.domInteractive - timing.fetchStart;
  }

  private getTotalBlockingTime(): number {
    // Calculate total blocking time from long tasks
    let tbt = 0;
    const entries = performance.getEntriesByType('longtask');
    for (const entry of entries) {
      if (entry.duration > this.longTaskThreshold) {
        tbt += entry.duration - this.longTaskThreshold;
      }
    }
    return tbt;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup
  public destroy(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.flush();
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export const initializePerformanceMonitoring = (config?: {
  analyticsEndpoint?: string;
  userId?: string;
}): PerformanceMonitor => {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor(config);
  }
  return performanceMonitor;
};

export const getPerformanceMonitor = (): PerformanceMonitor | null => {
  return performanceMonitor;
};

export default PerformanceMonitor;