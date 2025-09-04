/**
 * Unit Tests for Redis Configuration
 * Tests connection management, circuit breaker, and queue operations
 */

const { RedisManager } = require('../../config/redis.config');
const Bull = require('bull');

describe('RedisManager', () => {
  let redisManager;
  
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.REDIS_DB = '1';
    redisManager = new RedisManager('test');
  });
  
  afterEach(async () => {
    if (redisManager) {
      await redisManager.shutdown();
    }
  });
  
  describe('Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(redisManager.config).toBeDefined();
      expect(redisManager.config.db).toBe(1);
      expect(redisManager.client).toBeDefined();
    });
    
    test('should throw error for invalid environment', () => {
      expect(() => new RedisManager('invalid')).toThrow('Invalid environment');
    });
  });
  
  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      const isConnected = await redisManager.isConnected();
      expect(isConnected).toBe(true);
    });
    
    test('should handle ping command', async () => {
      const result = await redisManager.ping();
      expect(result).toBe('PONG');
    });
    
    test('should reconnect automatically', (done) => {
      redisManager.on('reconnecting', () => {
        expect(redisManager.isReconnecting).toBe(true);
        done();
      });
      
      // Simulate connection loss
      redisManager.client.disconnect();
    });
  });
  
  describe('Basic Operations', () => {
    test('should set and get values', async () => {
      await redisManager.set('test-key', 'test-value');
      const value = await redisManager.get('test-key');
      expect(value).toBe('test-value');
    });
    
    test('should set values with expiry', async () => {
      await redisManager.setex('expiring-key', 1, 'temporary');
      let value = await redisManager.get('expiring-key');
      expect(value).toBe('temporary');
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      value = await redisManager.get('expiring-key');
      expect(value).toBeNull();
    });
    
    test('should delete keys', async () => {
      await redisManager.set('delete-me', 'value');
      await redisManager.del('delete-me');
      const value = await redisManager.get('delete-me');
      expect(value).toBeNull();
    });
    
    test('should check key existence', async () => {
      await redisManager.set('existing-key', 'value');
      
      const exists = await redisManager.exists('existing-key');
      expect(exists).toBe(1);
      
      const notExists = await redisManager.exists('non-existing-key');
      expect(notExists).toBe(0);
    });
  });
  
  describe('Hash Operations', () => {
    test('should set and get hash fields', async () => {
      await redisManager.hset('hash-key', 'field1', 'value1');
      const value = await redisManager.hget('hash-key', 'field1');
      expect(value).toBe('value1');
    });
    
    test('should get all hash fields', async () => {
      await redisManager.hset('hash-key', 'field1', 'value1');
      await redisManager.hset('hash-key', 'field2', 'value2');
      
      const all = await redisManager.hgetall('hash-key');
      expect(all).toEqual({
        field1: 'value1',
        field2: 'value2'
      });
    });
  });
  
  describe('List Operations', () => {
    test('should push and pop from lists', async () => {
      await redisManager.rpush('list-key', 'item1');
      await redisManager.rpush('list-key', 'item2');
      
      const length = await redisManager.llen('list-key');
      expect(length).toBe(2);
      
      const item = await redisManager.lpop('list-key');
      expect(item).toBe('item1');
    });
    
    test('should get list range', async () => {
      await redisManager.rpush('list-key', 'item1');
      await redisManager.rpush('list-key', 'item2');
      await redisManager.rpush('list-key', 'item3');
      
      const range = await redisManager.lrange('list-key', 0, 1);
      expect(range).toEqual(['item1', 'item2']);
    });
  });
  
  describe('Queue Operations', () => {
    test('should create and manage Bull queue', () => {
      const queue = redisManager.createQueue('test-queue');
      expect(queue).toBeInstanceOf(Bull);
      expect(queue.name).toBe('test-queue');
    });
    
    test('should reuse existing queue', () => {
      const queue1 = redisManager.createQueue('same-queue');
      const queue2 = redisManager.createQueue('same-queue');
      expect(queue1).toBe(queue2);
    });
    
    test('should add job to queue', async () => {
      const queue = redisManager.createQueue('job-queue');
      const job = await queue.add({ test: 'data' });
      
      expect(job.id).toBeDefined();
      expect(job.data).toEqual({ test: 'data' });
    });
  });
  
  describe('Circuit Breaker', () => {
    test('should open circuit breaker after threshold failures', () => {
      // Simulate multiple failures
      for (let i = 0; i < 10; i++) {
        redisManager.handleError(new Error('Connection failed'));
      }
      
      expect(redisManager.circuitBreakerOpen).toBe(true);
    });
    
    test('should reject operations when circuit breaker is open', async () => {
      redisManager.circuitBreakerOpen = true;
      
      await expect(redisManager.get('test')).rejects.toThrow(
        'Redis circuit breaker is open'
      );
    });
    
    test('should reset circuit breaker', () => {
      redisManager.circuitBreakerOpen = true;
      redisManager.closeCircuitBreaker();
      
      expect(redisManager.circuitBreakerOpen).toBe(false);
      expect(redisManager.failureCount).toBe(0);
    });
  });
  
  describe('Health Check', () => {
    test('should return healthy status when connected', async () => {
      const health = await redisManager.health();
      
      expect(health.healthy).toBe(true);
      expect(health.info).toBeDefined();
      expect(health.metrics).toBeDefined();
      expect(health.circuitBreaker).toBe('CLOSED');
    });
    
    test('should return unhealthy status when circuit breaker is open', async () => {
      redisManager.circuitBreakerOpen = true;
      
      const health = await redisManager.health();
      expect(health.healthy).toBe(false);
      expect(health.circuitBreaker).toBe('OPEN');
    });
  });
  
  describe('Metrics', () => {
    test('should track command metrics', () => {
      const metrics = redisManager.getMetrics();
      
      expect(metrics).toHaveProperty('totalCommands');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('queues');
      expect(metrics).toHaveProperty('avgResponseTime');
    });
    
    test('should update metrics on operations', async () => {
      const initialMetrics = redisManager.getMetrics();
      
      await redisManager.set('test', 'value');
      await redisManager.get('test');
      
      const updatedMetrics = redisManager.getMetrics();
      expect(updatedMetrics.totalCommands).toBeGreaterThan(initialMetrics.totalCommands);
    });
  });
  
  describe('Error Handling', () => {
    test('should emit error event on client error', (done) => {
      redisManager.once('error', (error) => {
        expect(error.message).toBe('Test error');
        done();
      });
      
      redisManager.handleError(new Error('Test error'));
    });
    
    test('should increment failure count on error', () => {
      const initialCount = redisManager.failureCount;
      redisManager.handleError(new Error('Test error'));
      expect(redisManager.failureCount).toBe(initialCount + 1);
    });
  });
  
  describe('Cleanup', () => {
    test('should close all queues on shutdown', async () => {
      const queue1 = redisManager.createQueue('queue1');
      const queue2 = redisManager.createQueue('queue2');
      
      const spy1 = jest.spyOn(queue1, 'close');
      const spy2 = jest.spyOn(queue2, 'close');
      
      await redisManager.shutdown();
      
      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
    });
    
    test('should disconnect client on shutdown', async () => {
      const spy = jest.spyOn(redisManager.client, 'quit');
      await redisManager.shutdown();
      expect(spy).toHaveBeenCalled();
    });
  });
});