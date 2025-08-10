/**
 * World-class Circuit Breaker Implementation
 * Netflix Hystrix-style circuit breaker for fault tolerance
 */
import { EventEmitter } from 'events';
export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    name: string;
    timeout?: number;
    errorThreshold?: number;
    volumeThreshold?: number;
    sleepWindow?: number;
    requestVolumeThreshold?: number;
    fallback?: () => Promise<any>;
    isError?: (error: any) => boolean;
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
export declare class CircuitBreaker extends EventEmitter {
    private config;
    private state;
    private metrics;
    private rollingWindow;
    private nextAttempt;
    private halfOpenRequests;
    private readonly MAX_HALF_OPEN_REQUESTS;
    constructor(config: CircuitBreakerConfig);
    /**
     * Execute a function with circuit breaker protection
     */
    execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;
    /**
     * Manually open the circuit
     */
    open(): void;
    /**
     * Manually close the circuit
     */
    close(): void;
    /**
     * Reset all metrics
     */
    reset(): void;
    /**
     * Get current state
     */
    getState(): CircuitState;
    /**
     * Get current metrics
     */
    getMetrics(): {
        state: CircuitState;
        metrics: RequestMetrics;
        errorRate: number;
        averageResponseTime: number;
        throughput: number;
    };
    /**
     * Check health status
     */
    isHealthy(): boolean;
    private executeWithTimeout;
    private executeFallback;
    private recordSuccess;
    private recordFailure;
    private updateCircuitState;
    private transitionTo;
    private getWindowMetrics;
    private startMetricsCleanup;
}
/**
 * Circuit Breaker Error
 */
export declare class CircuitBreakerError extends Error {
    readonly code: string;
    readonly cause?: Error;
    constructor(message: string, code: string, cause?: Error);
}
/**
 * Circuit Breaker Factory for managing multiple breakers
 */
export declare class CircuitBreakerFactory {
    private static breakers;
    /**
     * Get or create a circuit breaker
     */
    static getBreaker(config: CircuitBreakerConfig): CircuitBreaker;
    /**
     * Get all circuit breakers
     */
    static getAllBreakers(): Map<string, CircuitBreaker>;
    /**
     * Get metrics for all breakers
     */
    static getAllMetrics(): Record<string, any>;
    /**
     * Reset a specific breaker
     */
    static resetBreaker(name: string): void;
    /**
     * Reset all breakers
     */
    static resetAll(): void;
    /**
     * Remove a breaker
     */
    static removeBreaker(name: string): void;
    /**
     * Clear all breakers
     */
    static clear(): void;
}
export default CircuitBreaker;
