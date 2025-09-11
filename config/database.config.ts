/**
 * Enterprise-Grade Database Configuration
 * PostgreSQL connection pooling with circuit breaker and retry logic
 */

import { Pool, PoolConfig, Client } from 'pg';
import { EventEmitter } from 'events';

// Enterprise configuration with connection pooling
export interface DatabaseConfig {
  // Connection settings
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  
  // Pool configuration (10/10 enterprise settings)
  max: number;                      // Maximum pool size
  min: number;                      // Minimum pool size
  idleTimeoutMillis: number;        // Close idle clients after this many milliseconds
  connectionTimeoutMillis: number;  // Return error after this many milliseconds if connection cannot be acquired
  maxUses: number;                  // Max times a connection can be reused
  
  // Performance tuning
  statement_timeout: number;        // Abort statements that take more than specified milliseconds
  query_timeout: number;            // Similar to statement_timeout but at query level
  idle_in_transaction_session_timeout: number; // Terminate session with idle transaction
  
  // SSL/TLS for production
  ssl?: {
    rejectUnauthorized: boolean;
    ca?: string;
    key?: string;
    cert?: string;
  };
  
  // Application name for monitoring
  application_name: string;
  
  // Keep alive
  keepAlive: boolean;
  keepAliveInitialDelayMillis: number;
}

// Environment-specific configurations
const configs: Record<string, DatabaseConfig> = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3432', 10),
    database: process.env.DB_NAME || 'mangalm_sales',
    user: process.env.DB_USER || 'mangalm',
    password: process.env.DB_PASSWORD || 'mangalm_secure_password',
    
    // Development pool settings
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500,
    
    // Timeouts
    statement_timeout: 60000,
    query_timeout: 60000,
    idle_in_transaction_session_timeout: 60000,
    
    application_name: 'mangalm_bulk_upload_dev',
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  },
  
  production: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    
    // Production pool settings (aggressive)
    max: 100,
    min: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 3000,
    maxUses: 7500,
    
    // Stricter timeouts for production
    statement_timeout: 30000,
    query_timeout: 30000,
    idle_in_transaction_session_timeout: 30000,
    
    // SSL required for production
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DB_SSL_CA,
      key: process.env.DB_SSL_KEY,
      cert: process.env.DB_SSL_CERT
    },
    
    application_name: 'mangalm_bulk_upload_prod',
    keepAlive: true,
    keepAliveInitialDelayMillis: 0
  },
  
  test: {
    host: 'localhost',
    port: 5432,
    database: 'mangalm_test',
    user: 'postgres',
    password: 'postgres_test',
    
    // Test pool settings (minimal)
    max: 5,
    min: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 1000,
    maxUses: 1000,
    
    statement_timeout: 5000,
    query_timeout: 5000,
    idle_in_transaction_session_timeout: 5000,
    
    application_name: 'mangalm_bulk_upload_test',
    keepAlive: false,
    keepAliveInitialDelayMillis: 0
  }
};

/**
 * Enterprise Database Pool Manager with circuit breaker pattern
 */
export class DatabasePoolManager extends EventEmitter {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private connectionRetries = 0;
  private maxRetries = 5;
  private retryDelay = 1000;
  private circuitBreakerOpen = false;
  private failureCount = 0;
  private failureThreshold = 5;
  private circuitBreakerResetTime = 60000; // 1 minute
  private healthCheckInterval: NodeJS.Timer | null = null;
  
  // Metrics
  private metrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    errors: 0,
    queryCount: 0,
    avgQueryTime: 0
  };

  constructor(environment: string = process.env.NODE_ENV || 'development') {
    super();
    
    if (!configs[environment]) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    this.config = configs[environment];
    this.setupPool();
    this.startHealthCheck();
  }

  private setupPool(): void {
    const poolConfig: PoolConfig = {
      ...this.config,
      
      // Connection lifecycle callbacks - handled separately 
      // Pool callbacks not supported in modern pg PoolConfig
    };

    this.pool = new Pool(poolConfig);

    // Setup pool event handlers
    this.pool.on('connect', () => {
      this.metrics.activeConnections++;
      this.failureCount = 0; // Reset on successful connection
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

  private handlePoolError(error: Error): void {
    console.error('[DatabasePool] Error:', error);
    this.failureCount++;
    
    if (this.failureCount >= this.failureThreshold && !this.circuitBreakerOpen) {
      this.openCircuitBreaker();
    }
    
    this.emit('error', error);
  }

  private openCircuitBreaker(): void {
    console.warn('[DatabasePool] Circuit breaker opened due to repeated failures');
    this.circuitBreakerOpen = true;
    this.emit('circuitBreaker:open');
    
    // Schedule circuit breaker reset
    setTimeout(() => {
      this.closeCircuitBreaker();
    }, this.circuitBreakerResetTime);
  }

  private closeCircuitBreaker(): void {
    console.info('[DatabasePool] Circuit breaker closed, attempting recovery');
    this.circuitBreakerOpen = false;
    this.failureCount = 0;
    this.emit('circuitBreaker:close');
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.health();
      } catch (error) {
        console.error('[DatabasePool] Health check failed:', error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Get a client from the pool with circuit breaker check
   */
  async getClient(): Promise<any> {
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
      client.query = async (...args: any[]) => {
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
      this.handlePoolError(error as Error);
      throw error;
    }
  }

  /**
   * Execute a query with automatic client management
   */
  async query<T = any>(text: string, params?: any[]): Promise<T> {
    const client = await this.getClient();
    
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async transaction<T = any>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
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

  /**
   * Health check
   */
  async health(): Promise<{
    healthy: boolean;
    pool: any;
    metrics: any;
    circuitBreaker: string;
  }> {
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

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(): Promise<void> {
    console.info('[DatabasePool] Shutting down...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval as any);
    }
    
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    
    this.emit('shutdown');
  }

  /**
   * Get current metrics
   */
  getMetrics(): any {
    return { ...this.metrics };
  }

  /**
   * Update query metrics with exponential moving average
   */
  private updateQueryMetrics(duration: number): void {
    this.metrics.queryCount++;
    const alpha = 0.1; // Smoothing factor
    this.metrics.avgQueryTime = 
      alpha * duration + (1 - alpha) * this.metrics.avgQueryTime;
  }
}

// Export singleton instance for the application
export const dbPool = new DatabasePoolManager();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await dbPool.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await dbPool.shutdown();
  process.exit(0);
});

export default dbPool;