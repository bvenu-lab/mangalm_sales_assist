"use strict";
/**
 * World-class Circuit Breaker Implementation
 * Netflix Hystrix-style circuit breaker for fault tolerance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreakerFactory = exports.CircuitBreakerError = exports.CircuitBreaker = exports.CircuitState = void 0;
const events_1 = require("events");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.state = CircuitState.CLOSED;
        this.rollingWindow = [];
        this.nextAttempt = 0;
        this.halfOpenRequests = 0;
        this.MAX_HALF_OPEN_REQUESTS = 1;
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
    async execute(fn, fallback) {
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
                throw new CircuitBreakerError(`Circuit breaker is OPEN for ${this.config.name}`, 'CIRCUIT_OPEN');
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
                throw new CircuitBreakerError(`Circuit breaker is HALF_OPEN and at capacity for ${this.config.name}`, 'CIRCUIT_HALF_OPEN');
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
        }
        catch (error) {
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
    open() {
        this.transitionTo(CircuitState.OPEN);
    }
    /**
     * Manually close the circuit
     */
    close() {
        this.transitionTo(CircuitState.CLOSED);
    }
    /**
     * Reset all metrics
     */
    reset() {
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
    getState() {
        return this.state;
    }
    /**
     * Get current metrics
     */
    getMetrics() {
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
    isHealthy() {
        return this.state === CircuitState.CLOSED;
    }
    // Private methods
    async executeWithTimeout(fn) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new CircuitBreakerError(`Request timeout after ${this.config.timeout}ms`, 'TIMEOUT'));
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
    async executeFallback(fallback) {
        try {
            const result = await fallback();
            this.emit('fallback-success', { name: this.config.name });
            return result;
        }
        catch (error) {
            this.emit('fallback-failure', { name: this.config.name, error });
            throw new CircuitBreakerError(`Fallback failed for ${this.config.name}`, 'FALLBACK_FAILED', error);
        }
    }
    recordSuccess(duration) {
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
    recordFailure(duration, error) {
        const isTimeout = error instanceof CircuitBreakerError && error.code === 'TIMEOUT';
        if (isTimeout) {
            this.metrics.timeouts++;
        }
        else {
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
    updateCircuitState() {
        if (this.state === CircuitState.CLOSED) {
            const metrics = this.getWindowMetrics();
            // Check if we should open the circuit
            if (metrics.totalRequests >= this.config.volumeThreshold &&
                metrics.errorRate >= this.config.errorThreshold) {
                this.transitionTo(CircuitState.OPEN);
            }
        }
    }
    transitionTo(newState) {
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
    getWindowMetrics() {
        const now = Date.now();
        const windowSize = 60000; // 1 minute rolling window
        // Filter to recent requests
        const recentRequests = this.rollingWindow.filter(r => now - r.timestamp < windowSize);
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
    startMetricsCleanup() {
        // Clean up old metrics every minute
        setInterval(() => {
            const now = Date.now();
            const windowSize = 60000; // Keep 1 minute of data
            this.rollingWindow = this.rollingWindow.filter(r => now - r.timestamp < windowSize);
        }, 60000);
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Circuit Breaker Error
 */
class CircuitBreakerError extends Error {
    constructor(message, code, cause) {
        super(message);
        this.name = 'CircuitBreakerError';
        this.code = code;
        this.cause = cause;
    }
}
exports.CircuitBreakerError = CircuitBreakerError;
/**
 * Circuit Breaker Factory for managing multiple breakers
 */
class CircuitBreakerFactory {
    /**
     * Get or create a circuit breaker
     */
    static getBreaker(config) {
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
    static getAllBreakers() {
        return new Map(this.breakers);
    }
    /**
     * Get metrics for all breakers
     */
    static getAllMetrics() {
        const metrics = {};
        for (const [name, breaker] of this.breakers) {
            metrics[name] = breaker.getMetrics();
        }
        return metrics;
    }
    /**
     * Reset a specific breaker
     */
    static resetBreaker(name) {
        const breaker = this.breakers.get(name);
        if (breaker) {
            breaker.reset();
        }
    }
    /**
     * Reset all breakers
     */
    static resetAll() {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
    }
    /**
     * Remove a breaker
     */
    static removeBreaker(name) {
        this.breakers.delete(name);
    }
    /**
     * Clear all breakers
     */
    static clear() {
        this.breakers.clear();
    }
}
exports.CircuitBreakerFactory = CircuitBreakerFactory;
CircuitBreakerFactory.breakers = new Map();
exports.default = CircuitBreaker;
//# sourceMappingURL=circuit-breaker.js.map