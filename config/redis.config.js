"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisManager = exports.RedisManager = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const bull_1 = __importDefault(require("bull"));
const events_1 = require("events");
const configs = {
    development: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '3379', 10),
        password: process.env.REDIS_PASSWORD || 'redis_dev_2024',
        db: 0,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy: (times) => {
            if (times > 10)
                return undefined;
            return Math.min(times * 100, 3000);
        },
        reconnectOnError: (err) => {
            const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
            return targetErrors.some(e => err.message.includes(e));
        },
        enableOfflineQueue: true,
        connectTimeout: 20000,
        keepAlive: 30000
    },
    production: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '3379', 10),
        password: process.env.REDIS_PASSWORD,
        db: 0,
        maxRetriesPerRequest: 5,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy: (times) => {
            if (times > 20)
                return undefined;
            return Math.min(times * 200, 5000);
        },
        reconnectOnError: (err) => {
            return true;
        },
        enableOfflineQueue: true,
        connectTimeout: 10000,
        keepAlive: 10000,
        tls: process.env.REDIS_TLS === 'true' ? {
            ca: process.env.REDIS_TLS_CA,
            cert: process.env.REDIS_TLS_CERT,
            key: process.env.REDIS_TLS_KEY
        } : undefined
    },
    test: {
        host: 'localhost',
        port: 3379,
        db: 1,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: () => undefined,
        reconnectOnError: () => false,
        enableOfflineQueue: false,
        connectTimeout: 1000,
        keepAlive: 0
    }
};
class RedisManager extends events_1.EventEmitter {
    constructor(environment = process.env.NODE_ENV || 'development') {
        super();
        this.redis = null;
        this.subscriber = null;
        this.publisher = null;
        this.queues = new Map();
        this.circuitBreakerOpen = false;
        this.failureCount = 0;
        this.failureThreshold = 10;
        this.metrics = {
            commandsSent: 0,
            commandsReceived: 0,
            errors: 0,
            reconnections: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgResponseTime: 0,
            memoryUsage: 0
        };
        if (!configs[environment]) {
            throw new Error(`Invalid environment: ${environment}`);
        }
        this.config = configs[environment];
        this.initialize();
    }
    async initialize() {
        this.redis = new ioredis_1.default(this.config);
        this.subscriber = new ioredis_1.default(this.config);
        this.publisher = new ioredis_1.default(this.config);
        this.setupEventHandlers(this.redis, 'main');
        this.setupEventHandlers(this.subscriber, 'subscriber');
        this.setupEventHandlers(this.publisher, 'publisher');
        this.startMetricsCollection();
    }
    setupEventHandlers(client, name) {
        client.on('connect', () => {
            console.info(`[Redis:${name}] Connected`);
            this.failureCount = 0;
            this.emit('connected', name);
        });
        client.on('ready', () => {
            console.info(`[Redis:${name}] Ready`);
            this.emit('ready', name);
        });
        client.on('error', (err) => {
            console.error(`[Redis:${name}] Error:`, err);
            this.metrics.errors++;
            this.handleError(err);
        });
        client.on('close', () => {
            console.warn(`[Redis:${name}] Connection closed`);
            this.emit('disconnected', name);
        });
        client.on('reconnecting', () => {
            console.info(`[Redis:${name}] Reconnecting...`);
            this.metrics.reconnections++;
            this.emit('reconnecting', name);
        });
    }
    handleError(error) {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold && !this.circuitBreakerOpen) {
            this.openCircuitBreaker();
        }
        this.emit('error', error);
    }
    openCircuitBreaker() {
        console.error('[Redis] Circuit breaker opened');
        this.circuitBreakerOpen = true;
        this.emit('circuitBreaker:open');
        setTimeout(() => {
            this.closeCircuitBreaker();
        }, 60000);
    }
    closeCircuitBreaker() {
        console.info('[Redis] Circuit breaker closed');
        this.circuitBreakerOpen = false;
        this.failureCount = 0;
        this.emit('circuitBreaker:close');
    }
    startMetricsCollection() {
        setInterval(async () => {
            if (this.redis && this.redis.status === 'ready') {
                try {
                    const info = await this.redis.info('memory');
                    const memMatch = info.match(/used_memory:(\d+)/);
                    if (memMatch) {
                        this.metrics.memoryUsage = parseInt(memMatch[1], 10);
                    }
                    this.emit('metrics', this.metrics);
                }
                catch (error) {
                    console.error('[Redis] Failed to collect metrics:', error);
                }
            }
        }, 30000);
    }
    getClient() {
        if (this.circuitBreakerOpen) {
            throw new Error('Redis circuit breaker is open');
        }
        if (!this.redis) {
            throw new Error('Redis not initialized');
        }
        return this.redis;
    }
    getQueue(name, options) {
        if (this.queues.has(name)) {
            return this.queues.get(name);
        }
        
        // Create Bull-specific Redis config without problematic options
        const bullRedisConfig = {
            host: this.config.host,
            port: this.config.port,
            password: this.config.password,
            db: this.config.db,
            // Remove enableReadyCheck and maxRetriesPerRequest for Bull
            retryStrategy: this.config.retryStrategy,
            reconnectOnError: this.config.reconnectOnError,
            enableOfflineQueue: this.config.enableOfflineQueue,
            connectTimeout: this.config.connectTimeout,
            keepAlive: this.config.keepAlive,
            tls: this.config.tls
        };
        
        const queue = new bull_1.default(name, {
            redis: bullRedisConfig,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: 100,
                removeOnFail: 500
            },
            ...options
        });
        queue.on('error', (error) => {
            console.error(`[Queue:${name}] Error:`, error);
            this.metrics.errors++;
        });
        queue.on('waiting', (jobId) => {
            this.emit('queue:waiting', { queue: name, jobId });
        });
        queue.on('active', (job) => {
            this.emit('queue:active', { queue: name, jobId: job.id });
        });
        queue.on('completed', (job) => {
            this.emit('queue:completed', { queue: name, jobId: job.id });
        });
        queue.on('failed', (job, err) => {
            this.emit('queue:failed', { queue: name, jobId: job.id, error: err });
        });
        this.queues.set(name, queue);
        return queue;
    }
    async cache(key, ttl, factory) {
        const client = this.getClient();
        const startTime = Date.now();
        try {
            const cached = await client.get(key);
            if (cached) {
                this.metrics.cacheHits++;
                this.updateResponseTime(Date.now() - startTime);
                return JSON.parse(cached);
            }
            this.metrics.cacheMisses++;
            const value = await factory();
            await client.setex(key, ttl, JSON.stringify(value));
            this.updateResponseTime(Date.now() - startTime);
            return value;
        }
        catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }
    async publish(channel, message) {
        if (!this.publisher) {
            throw new Error('Publisher not initialized');
        }
        await this.publisher.publish(channel, JSON.stringify(message));
        this.metrics.commandsSent++;
    }
    async subscribe(channel, handler) {
        if (!this.subscriber) {
            throw new Error('Subscriber not initialized');
        }
        await this.subscriber.subscribe(channel);
        this.subscriber.on('message', (ch, message) => {
            if (ch === channel) {
                this.metrics.commandsReceived++;
                try {
                    handler(JSON.parse(message));
                }
                catch (error) {
                    console.error(`[Redis] Failed to process message:`, error);
                }
            }
        });
    }
    async acquireLock(key, ttl = 30000) {
        const client = this.getClient();
        const lockKey = `lock:${key}`;
        const lockId = `${Date.now()}:${Math.random()}`;
        const acquired = await client.set(lockKey, lockId, 'PX', ttl, 'NX');
        if (acquired !== 'OK') {
            throw new Error(`Failed to acquire lock for ${key}`);
        }
        return async () => {
            const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
            await client.eval(script, 1, lockKey, lockId);
        };
    }
    async health() {
        try {
            const client = this.getClient();
            await client.ping();
            return {
                healthy: true,
                redis: client.status,
                queues: Array.from(this.queues.keys()),
                metrics: this.metrics,
                circuitBreaker: this.circuitBreakerOpen ? 'OPEN' : 'CLOSED'
            };
        }
        catch (error) {
            return {
                healthy: false,
                redis: 'disconnected',
                queues: [],
                metrics: this.metrics,
                circuitBreaker: this.circuitBreakerOpen ? 'OPEN' : 'CLOSED'
            };
        }
    }
    async shutdown() {
        console.info('[Redis] Shutting down...');
        for (const [name, queue] of this.queues) {
            await queue.close();
            console.info(`[Redis] Queue ${name} closed`);
        }
        if (this.redis)
            await this.redis.quit();
        if (this.subscriber)
            await this.subscriber.quit();
        if (this.publisher)
            await this.publisher.quit();
        this.emit('shutdown');
    }
    getMetrics() {
        return { ...this.metrics };
    }
    updateResponseTime(duration) {
        const alpha = 0.1;
        this.metrics.avgResponseTime =
            alpha * duration + (1 - alpha) * this.metrics.avgResponseTime;
    }
}
exports.RedisManager = RedisManager;
exports.redisManager = new RedisManager();
process.on('SIGTERM', async () => {
    await exports.redisManager.shutdown();
});
process.on('SIGINT', async () => {
    await exports.redisManager.shutdown();
});
exports.default = exports.redisManager;
