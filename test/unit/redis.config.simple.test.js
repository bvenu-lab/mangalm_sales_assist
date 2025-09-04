/**
 * Simplified Unit Tests for Redis Configuration
 * Tests configuration and basic functionality with mocks
 */

describe('RedisManager Configuration', () => {
  let RedisManager;
  
  beforeEach(() => {
    // Clear module cache
    jest.resetModules();
    
    // The mock is already set up in mock-setup.js
    RedisManager = require('../../config/redis.config').RedisManager;
  });
  
  test('should initialize with development configuration', () => {
    const redisManager = new RedisManager('development');
    
    expect(redisManager.config).toBeDefined();
    expect(redisManager.config.host).toBe('localhost');
    expect(redisManager.config.port).toBe(6379);
    expect(redisManager.circuitBreakerOpen).toBe(false);
  });
  
  test('should initialize with test configuration', () => {
    const redisManager = new RedisManager('test');
    
    expect(redisManager.config).toBeDefined();
    expect(redisManager.config.db).toBe(1);
  });
  
  test('should throw error for invalid environment', () => {
    expect(() => new RedisManager('invalid')).toThrow('Invalid environment');
  });
  
  test('should handle circuit breaker logic', () => {
    const redisManager = new RedisManager('test');
    
    // Add error listener to prevent unhandled error
    redisManager.on('error', () => {});
    
    // Simulate multiple failures
    for (let i = 0; i < 10; i++) {
      redisManager.handleError(new Error('Connection failed'));
    }
    
    expect(redisManager.circuitBreakerOpen).toBe(true);
    expect(redisManager.failureCount).toBe(10);
    
    // Reset circuit breaker
    redisManager.closeCircuitBreaker();
    expect(redisManager.circuitBreakerOpen).toBe(false);
    expect(redisManager.failureCount).toBe(0);
  });
  
  test('should have metrics properties', () => {
    const redisManager = new RedisManager('test');
    
    // Check that metrics exist on the instance
    expect(redisManager.metrics).toBeDefined();
    expect(redisManager.metrics.totalCommands).toBeDefined();
    expect(redisManager.metrics.errors).toBeDefined();
  });
  
  test('should create Bull queue', () => {
    const Bull = require('bull');
    const queue = new Bull('test-queue');
    
    expect(queue).toBeDefined();
    expect(queue.add).toBeDefined();
    expect(queue.process).toBeDefined();
  });
});