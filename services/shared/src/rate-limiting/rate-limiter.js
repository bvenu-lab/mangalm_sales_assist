"use strict";
/**
 * World-class Rate Limiting System
 * Token bucket and sliding window algorithms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
const redis_cache_1 = require("../cache/redis-cache");
class RateLimiter {
    constructor(config = {}, cache) {
        /**
         * Express middleware
         */
        this.middleware = async (req, res, next) => {
            const key = this.keyGenerator(req);
            try {
                const allowed = await this.checkLimit(key);
                if (!allowed.allowed) {
                    if (this.config.standardHeaders) {
                        res.setHeader('RateLimit-Limit', this.config.max.toString());
                        res.setHeader('RateLimit-Remaining', '0');
                        res.setHeader('RateLimit-Reset', new Date(allowed.resetAt).toISOString());
                    }
                    if (this.handler) {
                        this.handler(req, res);
                    }
                    else {
                        res.status(429).json(this.config.message);
                    }
                    return;
                }
                if (this.config.standardHeaders) {
                    res.setHeader('RateLimit-Limit', this.config.max.toString());
                    res.setHeader('RateLimit-Remaining', allowed.remaining.toString());
                    res.setHeader('RateLimit-Reset', new Date(allowed.resetAt).toISOString());
                }
                next();
            }
            catch (error) {
                console.error('[RateLimiter] Error:', error);
                next(); // Allow request on error
            }
        };
        this.config = {
            windowMs: config.windowMs || 60000,
            max: config.max || 100,
            message: config.message || 'Too many requests',
            standardHeaders: config.standardHeaders !== false,
            legacyHeaders: config.legacyHeaders || false,
            skipSuccessfulRequests: config.skipSuccessfulRequests || false,
            skipFailedRequests: config.skipFailedRequests || false,
            algorithm: config.algorithm || 'sliding-window',
            burst: config.burst || config.max || 100,
        };
        this.keyGenerator = config.keyGenerator || this.defaultKeyGenerator;
        this.handler = config.handler;
        this.cache = cache || new redis_cache_1.RedisCache({ keyPrefix: 'ratelimit:' });
    }
    /**
     * Check rate limit
     */
    async checkLimit(key) {
        switch (this.config.algorithm) {
            case 'token-bucket':
                return this.tokenBucket(key);
            case 'sliding-window':
                return this.slidingWindow(key);
            case 'fixed-window':
                return this.fixedWindow(key);
            default:
                return this.slidingWindow(key);
        }
    }
    /**
     * Token bucket algorithm
     */
    async tokenBucket(key) {
        const now = Date.now();
        const bucketKey = `bucket:${key}`;
        const data = await this.cache.get(bucketKey);
        const refillRate = this.config.max / this.config.windowMs;
        const maxTokens = this.config.burst;
        let tokens = maxTokens;
        let lastRefill = now;
        if (data) {
            const timePassed = now - data.lastRefill;
            const tokensToAdd = timePassed * refillRate;
            tokens = Math.min(maxTokens, data.tokens + tokensToAdd);
            lastRefill = now;
        }
        if (tokens >= 1) {
            tokens -= 1;
            await this.cache.set(bucketKey, { tokens, lastRefill }, {
                ttl: Math.ceil(this.config.windowMs / 1000),
            });
            return {
                allowed: true,
                remaining: Math.floor(tokens),
                resetAt: now + this.config.windowMs,
            };
        }
        return {
            allowed: false,
            remaining: 0,
            resetAt: now + (1 / refillRate),
        };
    }
    /**
     * Sliding window algorithm
     */
    async slidingWindow(key) {
        const now = Date.now();
        const windowKey = `window:${key}`;
        const windowStart = now - this.config.windowMs;
        // Get all requests in window
        const requests = await this.cache.get(windowKey) || [];
        // Filter out expired requests
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        if (validRequests.length < this.config.max) {
            validRequests.push(now);
            await this.cache.set(windowKey, validRequests, {
                ttl: Math.ceil(this.config.windowMs / 1000),
            });
            return {
                allowed: true,
                remaining: this.config.max - validRequests.length,
                resetAt: validRequests[0] + this.config.windowMs,
            };
        }
        return {
            allowed: false,
            remaining: 0,
            resetAt: validRequests[0] + this.config.windowMs,
        };
    }
    /**
     * Fixed window algorithm
     */
    async fixedWindow(key) {
        const now = Date.now();
        const windowId = Math.floor(now / this.config.windowMs);
        const windowKey = `fixed:${key}:${windowId}`;
        const count = await this.cache.get(windowKey) || 0;
        if (count < this.config.max) {
            await this.cache.set(windowKey, count + 1, {
                ttl: Math.ceil(this.config.windowMs / 1000),
            });
            return {
                allowed: true,
                remaining: this.config.max - count - 1,
                resetAt: (windowId + 1) * this.config.windowMs,
            };
        }
        return {
            allowed: false,
            remaining: 0,
            resetAt: (windowId + 1) * this.config.windowMs,
        };
    }
    /**
     * Default key generator
     */
    defaultKeyGenerator(req) {
        return req.ip || 'unknown';
    }
    /**
     * Create rate limiter for specific use cases
     */
    static createLimiter(type, cache) {
        const configs = {
            api: {
                windowMs: 60000,
                max: 100,
                algorithm: 'sliding-window',
            },
            auth: {
                windowMs: 900000, // 15 minutes
                max: 5,
                algorithm: 'fixed-window',
                message: 'Too many authentication attempts',
            },
            strict: {
                windowMs: 60000,
                max: 10,
                algorithm: 'token-bucket',
                burst: 20,
            },
        };
        return new RateLimiter(configs[type], cache);
    }
}
exports.RateLimiter = RateLimiter;
exports.default = RateLimiter;
//# sourceMappingURL=rate-limiter.js.map