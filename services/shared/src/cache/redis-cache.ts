/**
 * World-class Distributed Redis Cache
 * Enterprise-grade caching with patterns, TTL, and cache-aside strategy
 */

import Redis, { Redis as RedisClient } from 'ioredis';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

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
  clusterNodes?: Array<{ host: string; port: number }>;
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

export class RedisCache {
  private client: RedisClient;
  private config: Required<CacheConfig>;
  private stats: CacheStats;
  private getTimings: number[] = [];
  private setTimings: number[] = [];
  private isConnected: boolean = false;

  constructor(config: CacheConfig = {}) {
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

  private initializeClient(): void {
    if (this.config.enableCluster && this.config.clusterNodes.length > 0) {
      // Cluster mode
      this.client = new Redis.Cluster(this.config.clusterNodes, {
        redisOptions: {
          password: this.config.password,
          db: this.config.db,
        },
        clusterRetryStrategy: (times: number) => {
          if (times > this.config.maxRetries) {
            return null;
          }
          return Math.min(times * this.config.retryDelay, 5000);
        },
      }) as any;
    } else {
      // Single node mode
      this.client = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        retryStrategy: (times: number) => {
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
  public async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
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
      const result = await this.deserialize<T>(value);
      
      return result;
    } catch (error) {
      this.stats.errors++;
      console.error(`[RedisCache] Error getting key ${key}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  public async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<boolean> {
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
      } else {
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
    } catch (error) {
      this.stats.errors++;
      console.error(`[RedisCache] Error setting key ${key}:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  public async delete(key: string, options?: { version?: string }): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    const cacheKey = this.buildKey(key, options?.version);

    try {
      const result = await this.client.del(cacheKey);
      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      console.error(`[RedisCache] Error deleting key ${key}:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string, options?: { version?: string }): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    const cacheKey = this.buildKey(key, options?.version);

    try {
      const exists = await this.client.exists(cacheKey);
      return exists > 0;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get or set (cache-aside pattern)
   */
  public async getOrSet<T = any>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);
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
  public async invalidatePattern(pattern: string): Promise<number> {
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
    } catch (error) {
      this.stats.errors++;
      console.error('[RedisCache] Error invalidating pattern:', (error as Error).message);
      return 0;
    }
  }

  /**
   * Invalidate by tags
   */
  public async invalidateTags(tags: string[]): Promise<number> {
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
    } catch (error) {
      this.stats.errors++;
      console.error('[RedisCache] Error invalidating tags:', (error as Error).message);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  public async clear(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.flushdb();
      this.resetStats();
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error('[RedisCache] Error clearing cache:', (error as Error).message);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
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
  public async getMemoryUsage(): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const info = await this.client.info('memory');
      const match = info.match(/used_memory:(\d+)/);
      return match ? parseInt(match[1]) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Implement cache warming
   */
  public async warm(keys: Array<{ key: string; factory: () => Promise<any>; options?: CacheOptions }>): Promise<void> {
    const promises = keys.map(async ({ key, factory, options }) => {
      try {
        const value = await factory();
        await this.set(key, value, options);
      } catch (error) {
        console.error(`[RedisCache] Error warming key ${key}:`, (error as Error).message);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Implement distributed locking
   */
  public async acquireLock(
    resource: string,
    ttl: number = 10000,
    retries: number = 3
  ): Promise<{ unlock: () => Promise<void> } | null> {
    const lockKey = `${this.config.keyPrefix}locks:${resource}`;
    const lockValue = `${Date.now()}:${Math.random()}`;
    
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.client.set(
          lockKey,
          lockValue,
          'PX',
          ttl,
          'NX'
        );

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
      } catch (error) {
        console.error('[RedisCache] Error acquiring lock:', (error as Error).message);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }

    return null;
  }

  /**
   * Pub/Sub functionality
   */
  public async publish(channel: string, message: any): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const serialized = JSON.stringify(message);
      return await this.client.publish(channel, serialized);
    } catch (error) {
      console.error('[RedisCache] Error publishing message:', (error as Error).message);
      return 0;
    }
  }

  public async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<() => void> {
    const subscriber = this.client.duplicate();
    
    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (error) {
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

  private buildKey(key: string, version?: string): string {
    const hashedKey = this.hashKey(key);
    return version ? `${hashedKey}:v${version}` : hashedKey;
  }

  private hashKey(key: string): string {
    // For long keys, use hash
    if (key.length > 250) {
      return createHash('sha256').update(key).digest('hex');
    }
    return key;
  }

  private async serialize(value: any, compress?: boolean): Promise<string> {
    const json = JSON.stringify(value);
    
    // Compress if enabled and over threshold
    if (
      (compress !== false && this.config.enableCompression) &&
      json.length > this.config.compressionThreshold
    ) {
      const compressed = await gzipAsync(json);
      return `gzip:${compressed.toString('base64')}`;
    }

    return json;
  }

  private async deserialize<T>(value: string): Promise<T> {
    // Check if compressed
    if (value.startsWith('gzip:')) {
      const compressed = Buffer.from(value.slice(5), 'base64');
      const decompressed = await gunzipAsync(compressed);
      return JSON.parse(decompressed.toString());
    }

    return JSON.parse(value);
  }

  private async tagKey(key: string, tags: string[]): Promise<void> {
    const pipeline = this.client.pipeline();
    
    for (const tag of tags) {
      const tagKey = `${this.config.keyPrefix}tags:${tag}`;
      pipeline.sadd(tagKey, key);
      // Set expiry on tag set (30 days)
      pipeline.expire(tagKey, 2592000);
    }

    await pipeline.exec();
  }

  private recordGetTiming(duration: number): void {
    this.getTimings.push(duration);
    
    // Keep only last 100 timings
    if (this.getTimings.length > 100) {
      this.getTimings.shift();
    }
    
    // Update average
    this.stats.avgGetTime = 
      this.getTimings.reduce((sum, t) => sum + t, 0) / this.getTimings.length;
  }

  private recordSetTiming(duration: number): void {
    this.setTimings.push(duration);
    
    // Keep only last 100 timings
    if (this.setTimings.length > 100) {
      this.setTimings.shift();
    }
    
    // Update average
    this.stats.avgSetTime = 
      this.setTimings.reduce((sum, t) => sum + t, 0) / this.setTimings.length;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

// Singleton instance
let cacheInstance: RedisCache | null = null;

export const getRedisCache = (config?: CacheConfig): RedisCache => {
  if (!cacheInstance) {
    cacheInstance = new RedisCache(config);
  }
  return cacheInstance;
};

export default RedisCache;