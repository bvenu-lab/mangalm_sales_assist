/**
 * World-class Rate Limiting System
 * Token bucket and sliding window algorithms
 */
import { Request, Response, NextFunction } from 'express';
import { RedisCache } from '../cache/redis-cache';
export interface RateLimitConfig {
    windowMs?: number;
    max?: number;
    message?: string | object;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    keyGenerator?: (req: Request) => string;
    handler?: (req: Request, res: Response) => void;
    algorithm?: 'token-bucket' | 'sliding-window' | 'fixed-window';
    burst?: number;
}
export declare class RateLimiter {
    private config;
    private cache;
    private keyGenerator;
    private handler?;
    constructor(config?: RateLimitConfig, cache?: RedisCache);
    /**
     * Express middleware
     */
    middleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Check rate limit
     */
    private checkLimit;
    /**
     * Token bucket algorithm
     */
    private tokenBucket;
    /**
     * Sliding window algorithm
     */
    private slidingWindow;
    /**
     * Fixed window algorithm
     */
    private fixedWindow;
    /**
     * Default key generator
     */
    private defaultKeyGenerator;
    /**
     * Create rate limiter for specific use cases
     */
    static createLimiter(type: 'api' | 'auth' | 'strict', cache?: RedisCache): RateLimiter;
}
export default RateLimiter;
