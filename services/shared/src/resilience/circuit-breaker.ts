/**
 * World-class Circuit Breaker Implementation
 * Netflix Hystrix-style circuit breaker for fault tolerance
 */

import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  name: string;
  timeout?: number; // Request timeout in ms
  errorThreshold?: number; // Error percentage to open circuit
  volumeThreshold?: number; // Minimum requests before calculating error percentage
  sleepWindow?: number; // Time to wait before trying half-open
  requestVolumeThreshold?: number; // Rolling window size
  fallback?: () => Promise<any>; // Fallback function when circuit is open
  isError?: (error: any) => boolean; // Custom error detection
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

interface RequestMetrics {
  successes: number;
  failures: number;
  timeouts: number;
  shortCircuits: number;
  totalTime: number;
  lastFailureTime?: number;
}

export class CircuitBreaker extends EventEmitter {
  private config: Required<Omit<CircuitBreakerConfig, 'fallback' | 'isError' | 'onStateChange'>>;
  private state: CircuitState = CircuitState.CLOSED;
  private metrics: RequestMetrics;
  private rollingWindow: Array<{ timestamp: number; success: boolean; duration: number }> = [];
  private nextAttempt: number = 0;
  private halfOpenRequests: number = 0;
  private readonly MAX_HALF_OPEN_REQUESTS = 1;

  constructor(config: CircuitBreakerConfig) {
    super();
    
    this.config = {
      name: config.name,
      timeout: config.timeout || 10000,
      errorThreshold: config.errorThreshold || 50,
      volumeThreshold: config.volumeThreshold || 20,
      sleepWindow: config.sleepWindow || 60000,
      requestVolumeThreshold: config.requestVolumeThreshold || 10,
    };

    this.metrics = {
      successes: 0,
      failures: 0,
      timeouts: 0,
      shortCircuits: 0,
      totalTime: 0,
    };

    // Bind optional callbacks
    if (config.onStateChange) {
      this.on('state-change', config.onStateChange);
    }

    // Start metrics cleanup
    this.startMetricsCleanup();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  public async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check if circuit should be opened based on metrics
    this.updateCircuitState();

    // If circuit is open, try fallback or throw error
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.metrics.shortCircuits++;
        this.emit('short-circuit', { name: this.config.name });
        
        if (fallback) {
          return this.executeFallback(fallback);
        }
        
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.config.name}`,
          'CIRCUIT_OPEN'
        );
      }
      
      // Try to transition to half-open
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    // If half-open, limit concurrent requests
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.MAX_HALF_OPEN_REQUESTS) {
        this.metrics.shortCircuits++;
        
        if (fallback) {
          return this.executeFallback(fallback);
        }
        
        throw new CircuitBreakerError(
          `Circuit breaker is HALF_OPEN and at capacity for ${this.config.name}`,
          'CIRCUIT_HALF_OPEN'
        );
      }
      this.halfOpenRequests++;
    }

    // Execute the function with timeout
    const startTime = Date.now();
    
    try {
      const result = await this.executeWithTimeout(fn);
      this.recordSuccess(Date.now() - startTime);
      
      // If half-open and successful, try closing
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenRequests--;
        this.transitionTo(CircuitState.CLOSED);
      }
      
      return result;
    } catch (error) {
      this.recordFailure(Date.now() - startTime, error);
      
      // If half-open and failed, open again
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenRequests--;
        this.transitionTo(CircuitState.OPEN);
      }
      
      // Try fallback if available
      if (fallback) {
        return this.executeFallback(fallback);
      }
      
      throw error;
    }
  }

  /**
   * Manually open the circuit
   */
  public open(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Manually close the circuit
   */
  public close(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.metrics = {
      successes: 0,
      failures: 0,
      timeouts: 0,
      shortCircuits: 0,
      totalTime: 0,
    };
    this.rollingWindow = [];
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Get current state
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current metrics
   */
  public getMetrics(): {
    state: CircuitState;
    metrics: RequestMetrics;
    errorRate: number;
    averageResponseTime: number;
    throughput: number;
  } {
    const windowMetrics = this.getWindowMetrics();
    
    return {
      state: this.state,
      metrics: { ...this.metrics },
      errorRate: windowMetrics.errorRate,
      averageResponseTime: windowMetrics.averageResponseTime,
      throughput: windowMetrics.throughput,
    };
  }

  /**
   * Check health status
   */
  public isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  // Private methods

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new CircuitBreakerError(
          `Request timeout after ${this.config.timeout}ms`,
          'TIMEOUT'
        ));
      }, this.config.timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeFallback<T>(fallback: () => Promise<T>): Promise<T> {
    try {
      const result = await fallback();
      this.emit('fallback-success', { name: this.config.name });
      return result;
    } catch (error) {
      this.emit('fallback-failure', { name: this.config.name, error });
      throw new CircuitBreakerError(
        `Fallback failed for ${this.config.name}`,
        'FALLBACK_FAILED',
        error as Error
      );
    }
  }

  private recordSuccess(duration: number): void {
    this.metrics.successes++;
    this.metrics.totalTime += duration;
    
    this.rollingWindow.push({
      timestamp: Date.now(),
      success: true,
      duration,
    });
    
    this.emit('success', {
      name: this.config.name,
      duration,
    });
  }

  private recordFailure(duration: number, error: any): void {
    const isTimeout = error instanceof CircuitBreakerError && error.code === 'TIMEOUT';
    
    if (isTimeout) {
      this.metrics.timeouts++;
    } else {
      this.metrics.failures++;
    }
    
    this.metrics.totalTime += duration;
    this.metrics.lastFailureTime = Date.now();
    
    this.rollingWindow.push({
      timestamp: Date.now(),
      success: false,
      duration,
    });
    
    this.emit('failure', {
      name: this.config.name,
      duration,
      error: error.message,
      isTimeout,
    });
  }

  private updateCircuitState(): void {
    if (this.state === CircuitState.CLOSED) {
      const metrics = this.getWindowMetrics();
      
      // Check if we should open the circuit
      if (
        metrics.totalRequests >= this.config.volumeThreshold &&
        metrics.errorRate >= this.config.errorThreshold
      ) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    
    if (oldState === newState) {
      return;
    }
    
    this.state = newState;
    
    // Set next attempt time when opening circuit
    if (newState === CircuitState.OPEN) {
      this.nextAttempt = Date.now() + this.config.sleepWindow;
    }
    
    // Reset half-open counter
    if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenRequests = 0;
    }
    
    this.emit('state-change', oldState, newState);
    
    console.log(`[CircuitBreaker] ${this.config.name}: ${oldState} -> ${newState}`);
  }

  private getWindowMetrics(): {
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
    throughput: number;
  } {
    const now = Date.now();
    const windowSize = 60000; // 1 minute rolling window
    
    // Filter to recent requests
    const recentRequests = this.rollingWindow.filter(
      r => now - r.timestamp < windowSize
    );
    
    if (recentRequests.length === 0) {
      return {
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
        throughput: 0,
      };
    }
    
    const failures = recentRequests.filter(r => !r.success).length;
    const totalTime = recentRequests.reduce((sum, r) => sum + r.duration, 0);
    
    return {
      totalRequests: recentRequests.length,
      errorRate: (failures / recentRequests.length) * 100,
      averageResponseTime: totalTime / recentRequests.length,
      throughput: recentRequests.length / (windowSize / 1000), // requests per second
    };
  }

  private startMetricsCleanup(): void {
    // Clean up old metrics every minute
    setInterval(() => {
      const now = Date.now();
      const windowSize = 60000; // Keep 1 minute of data
      
      this.rollingWindow = this.rollingWindow.filter(
        r => now - r.timestamp < windowSize
      );
    }, 60000);
  }
}

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  public readonly code: string;
  public readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Circuit Breaker Factory for managing multiple breakers
 */
export class CircuitBreakerFactory {
  private static breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  public static getBreaker(config: CircuitBreakerConfig): CircuitBreaker {
    let breaker = this.breakers.get(config.name);
    
    if (!breaker) {
      breaker = new CircuitBreaker(config);
      this.breakers.set(config.name, breaker);
    }
    
    return breaker;
  }

  /**
   * Get all circuit breakers
   */
  public static getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get metrics for all breakers
   */
  public static getAllMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    
    return metrics;
  }

  /**
   * Reset a specific breaker
   */
  public static resetBreaker(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * Reset all breakers
   */
  public static resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Remove a breaker
   */
  public static removeBreaker(name: string): void {
    this.breakers.delete(name);
  }

  /**
   * Clear all breakers
   */
  public static clear(): void {
    this.breakers.clear();
  }
}

export default CircuitBreaker;