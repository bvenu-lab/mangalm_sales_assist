import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

/**
 * Database connection pool for API Gateway
 */
class DatabaseConnection {
  private pool: Pool | null = null;
  private isConnected: boolean = false;

  /**
   * Initialize database connection pool
   */
  initialize(): void {
    if (this.pool) {
      return;
    }

    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3432'),
      database: process.env.DB_NAME || 'mangalm_sales',
      user: process.env.DB_USER || 'mangalm',
      password: process.env.DB_PASSWORD || 'mangalm_secure_password',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', err);
    });

    // Test connection
    this.testConnection();
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool!.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to database', error);
      this.isConnected = false;
    }
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      this.initialize();
    }
    return this.pool!.connect();
  }

  /**
   * Execute a query
   */
  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      this.initialize();
    }
    
    const start = Date.now();
    try {
      const result = await this.pool!.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Database query executed', {
        text: text.substring(0, 100),
        duration,
        rows: result.rowCount
      });
      
      return result;
    } catch (error) {
      logger.error('Database query error', {
        text: text.substring(0, 100),
        error
      });
      throw error;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }

  /**
   * Check if connected
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const db = new DatabaseConnection();

// Initialize on module load
db.initialize();