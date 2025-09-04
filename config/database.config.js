/**
 * Enterprise-Grade Database Configuration - JavaScript version
 * PostgreSQL connection pooling with circuit breaker and retry logic
 */

const { Pool } = require('pg');
const { EventEmitter } = require('events');

// Environment-specific configurations
const configs = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'mangalm_sales',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres_dev_2024',
    
    // Pool settings
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    
    application_name: 'mangalm_bulk_upload_dev'
  },
  
  production: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    
    // Production pool settings
    max: 100,
    min: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 3000,
    
    // SSL for production
    ssl: process.env.DB_SSL === 'true' ? {
      rejectUnauthorized: true,
      ca: process.env.DB_SSL_CA,
      key: process.env.DB_SSL_KEY,
      cert: process.env.DB_SSL_CERT
    } : false,
    
    application_name: 'mangalm_bulk_upload_prod'
  },
  
  test: {
    host: 'localhost',
    port: 5432,
    database: 'mangalm_test',
    user: 'postgres',
    password: 'postgres_test',
    max: 5,
    min: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 1000,
    application_name: 'mangalm_bulk_upload_test'
  }
};

/**
 * Enterprise Database Pool Manager with circuit breaker pattern
 */
class DatabasePoolManager extends EventEmitter {
  constructor(environment = process.env.NODE_ENV || 'development') {
    super();
    
    if (!configs[environment]) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    this.config = configs[environment];
    this.pool = null;
    this.circuitBreakerOpen = false;
    this.failureCount = 0;
    this.failureThreshold = 5;
    this.circuitBreakerResetTime = 60000;
    
    // Metrics
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      errors: 0,
      queryCount: 0,
      avgQueryTime: 0
    };
    
    this.setupPool();
    this.startHealthCheck();
  }

  setupPool() {
    this.pool = new Pool(this.config);

    // Setup pool event handlers
    this.pool.on('connect', () => {
      this.metrics.activeConnections++;
      this.failureCount = 0;
      this.emit('pool:connected');
    });

    this.pool.on('error', (err) => {
      this.handlePoolError(err);
    });

    this.pool.on('remove', () => {
      this.metrics.activeConnections--;
    });

    // Monitor pool metrics
    setInterval(() => {
      if (this.pool) {
        this.metrics.activeConnections = this.pool.totalCount;
        this.metrics.idleConnections = this.pool.idleCount;
        this.metrics.waitingClients = this.pool.waitingCount;
        this.emit('metrics', this.metrics);
      }
    }, 10000);
  }

  handlePoolError(error) {
    console.error('[DatabasePool] Error:', error);
    this.failureCount++;
    this.metrics.errors++;
    
    if (this.failureCount >= this.failureThreshold && !this.circuitBreakerOpen) {
      this.openCircuitBreaker();
    }
    
    this.emit('error', error);
  }

  openCircuitBreaker() {
    console.warn('[DatabasePool] Circuit breaker opened due to repeated failures');
    this.circuitBreakerOpen = true;
    this.emit('circuitBreaker:open');
    
    setTimeout(() => {
      this.closeCircuitBreaker();
    }, this.circuitBreakerResetTime);
  }

  closeCircuitBreaker() {
    console.info('[DatabasePool] Circuit breaker closed, attempting recovery');
    this.circuitBreakerOpen = false;
    this.failureCount = 0;
    this.emit('circuitBreaker:close');
  }

  startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.health();
      } catch (error) {
        console.error('[DatabasePool] Health check failed:', error);
      }
    }, 30000);
  }

  async getClient() {
    if (this.circuitBreakerOpen) {
      throw new Error('Database circuit breaker is open. Service temporarily unavailable.');
    }

    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const startTime = Date.now();
    
    try {
      const client = await this.pool.connect();
      
      // Wrap client to track metrics
      const originalQuery = client.query.bind(client);
      client.query = async (...args) => {
        const queryStart = Date.now();
        try {
          const result = await originalQuery(...args);
          this.updateQueryMetrics(Date.now() - queryStart);
          return result;
        } catch (error) {
          this.metrics.errors++;
          throw error;
        }
      };
      
      return client;
    } catch (error) {
      this.handlePoolError(error);
      throw error;
    }
  }

  async query(text, params) {
    const client = await this.getClient();
    
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async transaction(callback) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async health() {
    try {
      const result = await this.query('SELECT NOW() as time, version() as version');
      
      return {
        healthy: true,
        pool: {
          total: this.pool?.totalCount || 0,
          idle: this.pool?.idleCount || 0,
          waiting: this.pool?.waitingCount || 0
        },
        metrics: this.metrics,
        circuitBreaker: this.circuitBreakerOpen ? 'OPEN' : 'CLOSED'
      };
    } catch (error) {
      return {
        healthy: false,
        pool: null,
        metrics: this.metrics,
        circuitBreaker: this.circuitBreakerOpen ? 'OPEN' : 'CLOSED'
      };
    }
  }

  async shutdown() {
    console.info('[DatabasePool] Shutting down...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    
    this.emit('shutdown');
  }

  getMetrics() {
    return { ...this.metrics };
  }

  updateQueryMetrics(duration) {
    this.metrics.queryCount++;
    const alpha = 0.1;
    this.metrics.avgQueryTime = 
      alpha * duration + (1 - alpha) * this.metrics.avgQueryTime;
  }
}

// Export singleton instance
const dbPool = new DatabasePoolManager();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await dbPool.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await dbPool.shutdown();
  process.exit(0);
});

module.exports = { dbPool, DatabasePoolManager };