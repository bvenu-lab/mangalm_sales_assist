/**
 * Unit Tests for Database Configuration
 * Tests connection pooling, circuit breaker, and metrics
 */

const { DatabasePoolManager } = require('../../config/database.config');

describe('DatabasePoolManager', () => {
  let dbManager;
  
  beforeEach(() => {
    // Create new instance for each test
    process.env.NODE_ENV = 'test';
    dbManager = new DatabasePoolManager('test');
  });
  
  afterEach(async () => {
    // Clean up
    if (dbManager) {
      await dbManager.shutdown();
    }
  });
  
  describe('Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(dbManager.config).toBeDefined();
      expect(dbManager.config.database).toBe('mangalm_test');
      expect(dbManager.config.max).toBe(5);
      expect(dbManager.pool).toBeDefined();
    });
    
    test('should throw error for invalid environment', () => {
      expect(() => new DatabasePoolManager('invalid')).toThrow('Invalid environment');
    });
  });
  
  describe('Connection Pool', () => {
    test('should get client from pool', async () => {
      const client = await dbManager.getClient();
      expect(client).toBeDefined();
      expect(client.query).toBeDefined();
      expect(client.release).toBeDefined();
      client.release();
    });
    
    test('should track query metrics', async () => {
      const client = await dbManager.getClient();
      await client.query('SELECT 1');
      client.release();
      
      const metrics = dbManager.getMetrics();
      expect(metrics.queryCount).toBeGreaterThan(0);
    });
    
    test('should execute query with automatic client management', async () => {
      const result = await dbManager.query('SELECT $1::text as test', ['hello']);
      expect(result.rows[0].test).toBe('hello');
    });
  });
  
  describe('Transaction Support', () => {
    test('should handle successful transaction', async () => {
      const result = await dbManager.transaction(async (client) => {
        const res = await client.query('SELECT 1 as value');
        return res.rows[0].value;
      });
      
      expect(result).toBe(1);
    });
    
    test('should rollback on error', async () => {
      await expect(
        dbManager.transaction(async (client) => {
          await client.query('SELECT 1');
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });
  
  describe('Circuit Breaker', () => {
    test('should open circuit breaker after threshold failures', () => {
      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        dbManager.handlePoolError(new Error('Connection failed'));
      }
      
      expect(dbManager.circuitBreakerOpen).toBe(true);
    });
    
    test('should reject requests when circuit breaker is open', async () => {
      dbManager.circuitBreakerOpen = true;
      
      await expect(dbManager.getClient()).rejects.toThrow(
        'Database circuit breaker is open'
      );
    });
    
    test('should reset circuit breaker', () => {
      dbManager.circuitBreakerOpen = true;
      dbManager.closeCircuitBreaker();
      
      expect(dbManager.circuitBreakerOpen).toBe(false);
      expect(dbManager.failureCount).toBe(0);
    });
  });
  
  describe('Health Check', () => {
    test('should return healthy status when connected', async () => {
      const health = await dbManager.health();
      
      expect(health.healthy).toBe(true);
      expect(health.pool).toBeDefined();
      expect(health.metrics).toBeDefined();
      expect(health.circuitBreaker).toBe('CLOSED');
    });
    
    test('should return unhealthy status when circuit breaker is open', async () => {
      dbManager.circuitBreakerOpen = true;
      
      const health = await dbManager.health();
      expect(health.healthy).toBe(false);
      expect(health.circuitBreaker).toBe('OPEN');
    });
  });
  
  describe('Metrics', () => {
    test('should track connection metrics', () => {
      const metrics = dbManager.getMetrics();
      
      expect(metrics).toHaveProperty('totalConnections');
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('idleConnections');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('queryCount');
      expect(metrics).toHaveProperty('avgQueryTime');
    });
    
    test('should update query metrics', async () => {
      const initialMetrics = dbManager.getMetrics();
      
      await dbManager.query('SELECT 1');
      await dbManager.query('SELECT 2');
      
      const updatedMetrics = dbManager.getMetrics();
      expect(updatedMetrics.queryCount).toBeGreaterThan(initialMetrics.queryCount);
    });
  });
  
  describe('Error Handling', () => {
    test('should emit error event on pool error', (done) => {
      dbManager.once('error', (error) => {
        expect(error.message).toBe('Test error');
        done();
      });
      
      dbManager.handlePoolError(new Error('Test error'));
    });
    
    test('should increment failure count on error', () => {
      const initialCount = dbManager.failureCount;
      dbManager.handlePoolError(new Error('Test error'));
      expect(dbManager.failureCount).toBe(initialCount + 1);
    });
  });
});