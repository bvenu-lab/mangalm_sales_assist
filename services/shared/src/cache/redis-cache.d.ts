/**
 * World-class Distributed Redis Cache
 * Enterprise-grade caching with patterns, TTL, and cache-aside strategy
 */
export interface CacheConfig {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    defaultTTL?: number;
    enableCompression?: boolean;
    compressionThreshold?: number;
    maxRetries?: number;
    retryDelay?: number;
    enableCluster?: boolean;
    clusterNodes?: Array<{
        host: string;
        port: number;
    }>;
}
export interface CacheOptions {
    ttl?: number;
    compress?: boolean;
    tags?: string[];
    version?: string;
}
export interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
    hitRate: number;
    avgGetTime: number;
    avgSetTime: number;
    memoryUsage?: number;
}
export declare class RedisCache {
    private client;
    private config;
    private stats;
    private getTimings;
    private setTimings;
    private isConnected;
    constructor(config?: CacheConfig);
    private initializeClient;
    /**
     * Get value from cache
     */
    get<T = any>(key: string, options?: CacheOptions): Promise<T | null>;
    /**
     * Set value in cache
     */
    set<T = any>(key: string, value: T, options?: CacheOptions): Promise<boolean>;
    /**
     * Delete value from cache
     */
    delete(key: string, options?: {
        version?: string;
    }): Promise<boolean>;
    /**
     * Check if key exists
     */
    exists(key: string, options?: {
        version?: string;
    }): Promise<boolean>;
    /**
     * Get or set (cache-aside pattern)
     */
    getOrSet<T = any>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T>;
    /**
     * Invalidate by pattern
     */
    invalidatePattern(pattern: string): Promise<number>;
    /**
     * Invalidate by tags
     */
    invalidateTags(tags: string[]): Promise<number>;
    /**
     * Clear all cache
     */
    clear(): Promise<boolean>;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Get memory usage
     */
    getMemoryUsage(): Promise<number>;
    /**
     * Implement cache warming
     */
    warm(keys: Array<{
        key: string;
        factory: () => Promise<any>;
        options?: CacheOptions;
    }>): Promise<void>;
    /**
     * Implement distributed locking
     */
    acquireLock(resource: string, ttl?: number, retries?: number): Promise<{
        unlock: () => Promise<void>;
    } | null>;
    /**
     * Pub/Sub functionality
     */
    publish(channel: string, message: any): Promise<number>;
    subscribe(channel: string, callback: (message: any) => void): Promise<() => void>;
    private buildKey;
    private hashKey;
    private serialize;
    private deserialize;
    private tagKey;
    private recordGetTiming;
    private recordSetTiming;
    private updateHitRate;
    /**
     * Disconnect from Redis
     */
    disconnect(): Promise<void>;
}
export declare const getRedisCache: (config?: CacheConfig) => RedisCache;
export default RedisCache;
