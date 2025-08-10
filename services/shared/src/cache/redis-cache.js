"use strict";
/**
 * World-class Distributed Redis Cache
 * Enterprise-grade caching with patterns, TTL, and cache-aside strategy
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisCache = exports.RedisCache = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const crypto_1 = require("crypto");
const util_1 = require("util");
const zlib_1 = require("zlib");
const gzipAsync = (0, util_1.promisify)(zlib_1.gzip);
const gunzipAsync = (0, util_1.promisify)(zlib_1.gunzip);
class RedisCache {
    constructor(config = {}) {
        this.getTimings = [];
        this.setTimings = [];
        this.isConnected = false;
        this.config = {
            host: config.host || process.env.REDIS_HOST || 'localhost',
            port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
            password: config.password || process.env.REDIS_PASSWORD || '',
            db: config.db || 0,
            keyPrefix: config.keyPrefix || 'cache:',
            defaultTTL: config.defaultTTL || 3600, // 1 hour
            enableCompression: config.enableCompression !== false,
            compressionThreshold: config.compressionThreshold || 1024, // 1KB
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            enableCluster: config.enableCluster || false,
            clusterNodes: config.clusterNodes || [],
        };
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0,
            hitRate: 0,
            avgGetTime: 0,
            avgSetTime: 0,
        };
        this.initializeClient();
    }
    initializeClient() {
        if (this.config.enableCluster && this.config.clusterNodes.length > 0) {
            // Cluster mode
            this.client = new ioredis_1.default.Cluster(this.config.clusterNodes, {
                redisOptions: {
                    password: this.config.password,
                    db: this.config.db,
                },
                clusterRetryStrategy: (times) => {
                    if (times > this.config.maxRetries) {
                        return null;
                    }
                    return Math.min(times * this.config.retryDelay, 5000);
                },
            });
        }
        else {
            // Single node mode
            this.client = new ioredis_1.default({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                db: this.config.db,
                keyPrefix: this.config.keyPrefix,
                retryStrategy: (times) => {
                    if (times > this.config.maxRetries) {
                        return null;
                    }
                    return Math.min(times * this.config.retryDelay, 5000);
                },
                lazyConnect: true,
            });
        }
        // Event handlers
        this.client.on('connect', () => {
            this.isConnected = true;
            console.log('[RedisCache] Connected to Redis');
        });
        this.client.on('error', (error) => {
            this.stats.errors++;
            console.error('[RedisCache] Redis error:', error.message);
        });
        this.client.on('close', () => {
            this.isConnected = false;
            console.log('[RedisCache] Connection closed');
        });
        // Connect
        this.client.connect().catch(console.error);
    }
    /**
     * Get value from cache
     */
    async get(key, options) {
        if (!this.isConnected) {
            return null;
        }
        const startTime = Date.now();
        const cacheKey = this.buildKey(key, options?.version);
        try {
            const value = await this.client.get(cacheKey);
            const duration = Date.now() - startTime;
            this.recordGetTiming(duration);
            if (value === null) {
                this.stats.misses++;
                this.updateHitRate();
                return null;
            }
            this.stats.hits++;
            this.updateHitRate();
            // Deserialize and decompress if needed
            const result = await this.deserialize(value);
            return result;
        }
        catch (error) {
            this.stats.errors++;
            console.error(`[RedisCache] Error getting key ${key}:`, error.message);
            return null;
        }
    }
    /**
     * Set value in cache
     */
    async set(key, value, options) {
        if (!this.isConnected) {
            return false;
        }
        const startTime = Date.now();
        const cacheKey = this.buildKey(key, options?.version);
        const ttl = options?.ttl || this.config.defaultTTL;
        try {
            // Serialize and compress if needed
            const serialized = await this.serialize(value, options?.compress);
            // Set with TTL
            if (ttl > 0) {
                await this.client.setex(cacheKey, ttl, serialized);
            }
            else {
                await this.client.set(cacheKey, serialized);
            }
            // Tag the key if tags are provided
            if (options?.tags && options.tags.length > 0) {
                await this.tagKey(cacheKey, options.tags);
            }
            const duration = Date.now() - startTime;
            this.recordSetTiming(duration);
            this.stats.sets++;
            return true;
        }
        catch (error) {
            this.stats.errors++;
            console.error(`[RedisCache] Error setting key ${key}:`, error.message);
            return false;
        }
    }
    /**
     * Delete value from cache
     */
    async delete(key, options) {
        if (!this.isConnected) {
            return false;
        }
        const cacheKey = this.buildKey(key, options?.version);
        try {
            const result = await this.client.del(cacheKey);
            this.stats.deletes++;
            return result > 0;
        }
        catch (error) {
            this.stats.errors++;
            console.error(`[RedisCache] Error deleting key ${key}:`, error.message);
            return false;
        }
    }
    /**
     * Check if key exists
     */
    async exists(key, options) {
        if (!this.isConnected) {
            return false;
        }
        const cacheKey = this.buildKey(key, options?.version);
        try {
            const exists = await this.client.exists(cacheKey);
            return exists > 0;
        }
        catch (error) {
            this.stats.errors++;
            return false;
        }
    }
    /**
     * Get or set (cache-aside pattern)
     */
    async getOrSet(key, factory, options) {
        // Try to get from cache
        const cached = await this.get(key, options);
        if (cached !== null) {
            return cached;
        }
        // Get from factory
        const value = await factory();
        // Set in cache (don't await to return faster)
        this.set(key, value, options).catch(console.error);
        return value;
    }
    /**
     * Invalidate by pattern
     */
    async invalidatePattern(pattern) {
        if (!this.isConnected) {
            return 0;
        }
        try {
            const keys = await this.client.keys(`${this.config.keyPrefix}${pattern}`);
            if (keys.length === 0) {
                return 0;
            }
            const pipeline = this.client.pipeline();
            keys.forEach(key => pipeline.del(key.replace(this.config.keyPrefix, '')));
            const results = await pipeline.exec();
            const deleted = results?.filter(r => r[0] === null).length || 0;
            this.stats.deletes += deleted;
            return deleted;
        }
        catch (error) {
            this.stats.errors++;
            console.error('[RedisCache] Error invalidating pattern:', error.message);
            return 0;
        }
    }
    /**
     * Invalidate by tags
     */
    async invalidateTags(tags) {
        if (!this.isConnected || tags.length === 0) {
            return 0;
        }
        try {
            let totalDeleted = 0;
            for (const tag of tags) {
                const tagKey = `${this.config.keyPrefix}tags:${tag}`;
                const members = await this.client.smembers(tagKey);
                if (members.length > 0) {
                    const pipeline = this.client.pipeline();
                    members.forEach(key => pipeline.del(key));
                    pipeline.del(tagKey);
                    const results = await pipeline.exec();
                    totalDeleted += results?.filter(r => r[0] === null).length || 0;
                }
            }
            this.stats.deletes += totalDeleted;
            return totalDeleted;
        }
        catch (error) {
            this.stats.errors++;
            console.error('[RedisCache] Error invalidating tags:', error.message);
            return 0;
        }
    }
    /**
     * Clear all cache
     */
    async clear() {
        if (!this.isConnected) {
            return false;
        }
        try {
            await this.client.flushdb();
            this.resetStats();
            return true;
        }
        catch (error) {
            this.stats.errors++;
            console.error('[RedisCache] Error clearing cache:', error.message);
            return false;
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0,
            hitRate: 0,
            avgGetTime: 0,
            avgSetTime: 0,
        };
        this.getTimings = [];
        this.setTimings = [];
    }
    /**
     * Get memory usage
     */
    async getMemoryUsage() {
        if (!this.isConnected) {
            return 0;
        }
        try {
            const info = await this.client.info('memory');
            const match = info.match(/used_memory:(\d+)/);
            return match ? parseInt(match[1]) : 0;
        }
        catch (error) {
            return 0;
        }
    }
    /**
     * Implement cache warming
     */
    async warm(keys) {
        const promises = keys.map(async ({ key, factory, options }) => {
            try {
                const value = await factory();
                await this.set(key, value, options);
            }
            catch (error) {
                console.error(`[RedisCache] Error warming key ${key}:`, error.message);
            }
        });
        await Promise.all(promises);
    }
    /**
     * Implement distributed locking
     */
    async acquireLock(resource, ttl = 10000, retries = 3) {
        const lockKey = `${this.config.keyPrefix}locks:${resource}`;
        const lockValue = `${Date.now()}:${Math.random()}`;
        for (let i = 0; i < retries; i++) {
            try {
                const result = await this.client.set(lockKey, lockValue, 'PX', ttl, 'NX');
                if (result === 'OK') {
                    return {
                        unlock: async () => {
                            // Use Lua script for atomic unlock
                            const script = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                  return redis.call("del", KEYS[1])
                else
                  return 0
                end
              `;
                            await this.client.eval(script, 1, lockKey, lockValue);
                        },
                    };
                }
            }
            catch (error) {
                console.error('[RedisCache] Error acquiring lock:', error.message);
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        }
        return null;
    }
    /**
     * Pub/Sub functionality
     */
    async publish(channel, message) {
        if (!this.isConnected) {
            return 0;
        }
        try {
            const serialized = JSON.stringify(message);
            return await this.client.publish(channel, serialized);
        }
        catch (error) {
            console.error('[RedisCache] Error publishing message:', error.message);
            return 0;
        }
    }
    async subscribe(channel, callback) {
        const subscriber = this.client.duplicate();
        subscriber.on('message', (ch, message) => {
            if (ch === channel) {
                try {
                    const parsed = JSON.parse(message);
                    callback(parsed);
                }
                catch (error) {
                    callback(message);
                }
            }
        });
        await subscriber.subscribe(channel);
        // Return unsubscribe function
        return () => {
            subscriber.unsubscribe(channel);
            subscriber.disconnect();
        };
    }
    // Private methods
    buildKey(key, version) {
        const hashedKey = this.hashKey(key);
        return version ? `${hashedKey}:v${version}` : hashedKey;
    }
    hashKey(key) {
        // For long keys, use hash
        if (key.length > 250) {
            return (0, crypto_1.createHash)('sha256').update(key).digest('hex');
        }
        return key;
    }
    async serialize(value, compress) {
        const json = JSON.stringify(value);
        // Compress if enabled and over threshold
        if ((compress !== false && this.config.enableCompression) &&
            json.length > this.config.compressionThreshold) {
            const compressed = await gzipAsync(json);
            return `gzip:${compressed.toString('base64')}`;
        }
        return json;
    }
    async deserialize(value) {
        // Check if compressed
        if (value.startsWith('gzip:')) {
            const compressed = Buffer.from(value.slice(5), 'base64');
            const decompressed = await gunzipAsync(compressed);
            return JSON.parse(decompressed.toString());
        }
        return JSON.parse(value);
    }
    async tagKey(key, tags) {
        const pipeline = this.client.pipeline();
        for (const tag of tags) {
            const tagKey = `${this.config.keyPrefix}tags:${tag}`;
            pipeline.sadd(tagKey, key);
            // Set expiry on tag set (30 days)
            pipeline.expire(tagKey, 2592000);
        }
        await pipeline.exec();
    }
    recordGetTiming(duration) {
        this.getTimings.push(duration);
        // Keep only last 100 timings
        if (this.getTimings.length > 100) {
            this.getTimings.shift();
        }
        // Update average
        this.stats.avgGetTime =
            this.getTimings.reduce((sum, t) => sum + t, 0) / this.getTimings.length;
    }
    recordSetTiming(duration) {
        this.setTimings.push(duration);
        // Keep only last 100 timings
        if (this.setTimings.length > 100) {
            this.setTimings.shift();
        }
        // Update average
        this.stats.avgSetTime =
            this.setTimings.reduce((sum, t) => sum + t, 0) / this.setTimings.length;
    }
    updateHitRate() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    }
    /**
     * Disconnect from Redis
     */
    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
        }
    }
}
exports.RedisCache = RedisCache;
// Singleton instance
let cacheInstance = null;
const getRedisCache = (config) => {
    if (!cacheInstance) {
        cacheInstance = new RedisCache(config);
    }
    return cacheInstance;
};
exports.getRedisCache = getRedisCache;
exports.default = RedisCache;
//# sourceMappingURL=redis-cache.js.map