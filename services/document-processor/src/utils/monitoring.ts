import { Request, Response, NextFunction } from 'express';
import logger from './logger';

interface Metrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  peakResponseTime: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
}

class MonitoringService {
  private metrics: Metrics = {
    requestCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    peakResponseTime: 0,
    processingJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
  };

  private responseTimes: number[] = [];

  // Middleware to track request metrics
  trackRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      this.metrics.requestCount++;

      // Track response time
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.responseTimes.push(duration);
        
        // Keep only last 1000 response times
        if (this.responseTimes.length > 1000) {
          this.responseTimes.shift();
        }

        // Update metrics
        this.metrics.averageResponseTime = 
          this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
        
        this.metrics.peakResponseTime = Math.max(
          this.metrics.peakResponseTime,
          duration
        );

        // Log slow requests
        if (duration > 1000) {
          logger.warn(`Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
        }

        // Track errors
        if (res.statusCode >= 400) {
          this.metrics.errorCount++;
        }
      });

      next();
    };
  }

  // Job tracking methods
  startJob(jobId: string, type: string) {
    this.metrics.processingJobs++;
    logger.info(`Job started: ${jobId} (${type})`);
  }

  completeJob(jobId: string, duration: number) {
    this.metrics.processingJobs--;
    this.metrics.completedJobs++;
    logger.info(`Job completed: ${jobId} in ${duration}ms`);
  }

  failJob(jobId: string, error: Error) {
    this.metrics.processingJobs--;
    this.metrics.failedJobs++;
    logger.error(`Job failed: ${jobId}`, error);
  }

  // Get current metrics
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  // Reset metrics
  resetMetrics() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      peakResponseTime: 0,
      processingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
    };
    this.responseTimes = [];
  }

  // Health check
  getHealthStatus() {
    const errorRate = this.metrics.requestCount > 0 
      ? (this.metrics.errorCount / this.metrics.requestCount) * 100
      : 0;

    const status = {
      healthy: errorRate < 5 && this.metrics.averageResponseTime < 500,
      metrics: this.metrics,
      errorRate: `${errorRate.toFixed(2)}%`,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };

    return status;
  }
}

export const monitoring = new MonitoringService();
export default monitoring;