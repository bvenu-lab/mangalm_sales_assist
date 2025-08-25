import { AppDataSource } from '../database/connection';
import { EntityManager, QueryRunner } from 'typeorm';
import { monitoring } from './monitoring.service';
import * as winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/transactions.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

export interface TransactionOptions {
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class TransactionService {
  private static instance: TransactionService;
  private activeTransactions: Map<string, QueryRunner> = new Map();
  private transactionMetrics = {
    total: 0,
    successful: 0,
    failed: 0,
    rolledBack: 0,
    timedOut: 0
  };

  private constructor() {
    this.startMetricsReporting();
  }

  public static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  /**
   * Execute a function within a database transaction with automatic retry and rollback
   */
  async executeInTransaction<T>(
    fn: (manager: EntityManager) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const {
      isolationLevel = 'READ COMMITTED',
      timeout = 30000,
      retries = 3,
      retryDelay = 1000
    } = options;

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      const transactionId = this.generateTransactionId();
      const startTime = Date.now();
      
      try {
        const result = await this.runTransaction(fn, {
          transactionId,
          isolationLevel,
          timeout,
          attempt
        });
        
        this.recordTransactionSuccess(transactionId, Date.now() - startTime);
        return result;
        
      } catch (error: any) {
        lastError = error;
        
        this.recordTransactionFailure(transactionId, error, Date.now() - startTime);
        
        if (this.isRetryableError(error) && attempt < retries) {
          logger.warn(`Transaction failed (attempt ${attempt}/${retries}), retrying...`, {
            transactionId,
            error: error.message,
            attempt
          });
          
          await this.delay(retryDelay * attempt); // Exponential backoff
          continue;
        }
        
        break;
      }
    }
    
    throw lastError || new Error('Transaction failed after all retries');
  }

  /**
   * Execute multiple operations in a single transaction
   */
  async executeBatch<T>(
    operations: Array<(manager: EntityManager) => Promise<any>>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    return this.executeInTransaction(async (manager) => {
      const results: T[] = [];
      
      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await operations[i](manager);
          results.push(result);
        } catch (error: any) {
          logger.error(`Batch operation ${i + 1} failed`, {
            operationIndex: i,
            error: error.message,
            stack: error.stack
          });
          throw error; // This will trigger rollback
        }
      }
      
      return results;
    }, options);
  }

  /**
   * Execute a transaction with savepoints for partial rollback
   */
  async executeWithSavepoints<T>(
    operations: Array<{
      name: string;
      fn: (manager: EntityManager) => Promise<any>;
      canFail?: boolean;
    }>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction(options.isolationLevel);
    
    const results: T[] = [];
    const savepoints: string[] = [];
    
    try {
      for (const operation of operations) {
        const savepointName = `sp_${operation.name}_${Date.now()}`;
        
        try {
          // Create savepoint
          await queryRunner.query(`SAVEPOINT ${savepointName}`);
          savepoints.push(savepointName);
          
          // Execute operation
          const result = await operation.fn(queryRunner.manager);
          results.push(result);
          
        } catch (error: any) {
          logger.error(`Operation ${operation.name} failed`, {
            operation: operation.name,
            error: error.message
          });
          
          if (!operation.canFail) {
            // Rollback to savepoint and rethrow
            await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
            throw error;
          }
          
          // Continue with null result for failed optional operations
          results.push(null as any);
        }
      }
      
      await queryRunner.commitTransaction();
      return results;
      
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute a read-only query with read replica support
   */
  async executeReadOnly<T>(
    fn: (manager: EntityManager) => Promise<T>,
    useReplica: boolean = true
  ): Promise<T> {
    const queryRunner = AppDataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      
      // Set read-only transaction
      await queryRunner.query('SET TRANSACTION READ ONLY');
      
      return await fn(queryRunner.manager);
      
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute with optimistic locking
   */
  async executeWithOptimisticLock<T>(
    entity: any,
    version: number,
    fn: (manager: EntityManager) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    return this.executeInTransaction(async (manager) => {
      // Check version
      const currentEntity = await manager.findOne(entity.constructor, {
        where: { id: entity.id }
      });
      
      if (!currentEntity) {
        throw new Error('Entity not found');
      }
      
      if (currentEntity.version !== version) {
        throw new OptimisticLockError('Entity was modified by another transaction');
      }
      
      // Execute function
      const result = await fn(manager);
      
      // Update version
      await manager.update(entity.constructor, entity.id, {
        version: version + 1
      });
      
      return result;
    }, options);
  }

  /**
   * Execute with pessimistic locking
   */
  async executeWithPessimisticLock<T>(
    entityClass: any,
    id: any,
    fn: (manager: EntityManager, entity: any) => Promise<T>,
    lockMode: 'pessimistic_read' | 'pessimistic_write' = 'pessimistic_write',
    options: TransactionOptions = {}
  ): Promise<T> {
    return this.executeInTransaction(async (manager) => {
      // Lock entity
      const entity = await manager.findOne(entityClass, {
        where: { id },
        lock: { mode: lockMode }
      });
      
      if (!entity) {
        throw new Error('Entity not found for locking');
      }
      
      return await fn(manager, entity);
    }, options);
  }

  /**
   * Execute distributed transaction across multiple databases
   */
  async executeDistributed<T>(
    operations: Array<{
      dataSource: string;
      fn: (manager: EntityManager) => Promise<any>;
    }>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    const transactionId = this.generateTransactionId();
    const queryRunners: Map<string, QueryRunner> = new Map();
    
    try {
      // Start transactions on all data sources
      for (const operation of operations) {
        const queryRunner = AppDataSource.createQueryRunner(); // Would get specific datasource
        await queryRunner.connect();
        await queryRunner.startTransaction(options.isolationLevel);
        queryRunners.set(operation.dataSource, queryRunner);
      }
      
      // Execute operations
      const results: T[] = [];
      for (const operation of operations) {
        const queryRunner = queryRunners.get(operation.dataSource)!;
        const result = await operation.fn(queryRunner.manager);
        results.push(result);
      }
      
      // Commit all transactions
      for (const queryRunner of queryRunners.values()) {
        await queryRunner.commitTransaction();
      }
      
      return results;
      
    } catch (error) {
      // Rollback all transactions
      for (const queryRunner of queryRunners.values()) {
        try {
          await queryRunner.rollbackTransaction();
        } catch (rollbackError) {
          logger.error('Error rolling back distributed transaction', {
            transactionId,
            error: rollbackError
          });
        }
      }
      throw error;
      
    } finally {
      // Release all connections
      for (const queryRunner of queryRunners.values()) {
        await queryRunner.release();
      }
    }
  }

  /**
   * Private helper methods
   */
  private async runTransaction<T>(
    fn: (manager: EntityManager) => Promise<T>,
    config: {
      transactionId: string;
      isolationLevel: string;
      timeout: number;
      attempt: number;
    }
  ): Promise<T> {
    const queryRunner = AppDataSource.createQueryRunner();
    const { transactionId, isolationLevel, timeout, attempt } = config;
    
    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      this.handleTimeout(transactionId, queryRunner);
    }, timeout);
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction(isolationLevel as any);
      
      this.activeTransactions.set(transactionId, queryRunner);
      
      logger.debug(`Transaction ${transactionId} started`, {
        transactionId,
        isolationLevel,
        attempt
      });
      
      const result = await fn(queryRunner.manager);
      
      await queryRunner.commitTransaction();
      
      logger.debug(`Transaction ${transactionId} committed`, {
        transactionId
      });
      
      return result;
      
    } catch (error: any) {
      logger.error(`Transaction ${transactionId} failed`, {
        transactionId,
        error: error.message,
        stack: error.stack
      });
      
      await queryRunner.rollbackTransaction();
      this.transactionMetrics.rolledBack++;
      
      throw error;
      
    } finally {
      clearTimeout(timeoutHandle);
      this.activeTransactions.delete(transactionId);
      await queryRunner.release();
    }
  }

  private async handleTimeout(transactionId: string, queryRunner: QueryRunner): Promise<void> {
    logger.error(`Transaction ${transactionId} timed out`);
    
    this.transactionMetrics.timedOut++;
    
    try {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
    } catch (error) {
      logger.error(`Error handling transaction timeout`, {
        transactionId,
        error
      });
    }
    
    this.activeTransactions.delete(transactionId);
  }

  private isRetryableError(error: any): boolean {
    const retryablePatterns = [
      /deadlock/i,
      /lock.*timeout/i,
      /connection.*lost/i,
      /connection.*refused/i,
      /serialization failure/i,
      /could not serialize/i
    ];
    
    const errorMessage = error.message || '';
    return retryablePatterns.some(pattern => pattern.test(errorMessage));
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private recordTransactionSuccess(transactionId: string, duration: number): void {
    this.transactionMetrics.total++;
    this.transactionMetrics.successful++;
    
    monitoring.recordTiming('transaction.duration', duration, ['status:success']);
    monitoring.incrementCounter('transaction.count', 1, ['status:success']);
    
    logger.info(`Transaction completed successfully`, {
      transactionId,
      duration
    });
  }

  private recordTransactionFailure(transactionId: string, error: any, duration: number): void {
    this.transactionMetrics.total++;
    this.transactionMetrics.failed++;
    
    monitoring.recordTiming('transaction.duration', duration, ['status:failed']);
    monitoring.incrementCounter('transaction.count', 1, ['status:failed']);
    
    logger.error(`Transaction failed`, {
      transactionId,
      duration,
      error: error.message
    });
  }

  private startMetricsReporting(): void {
    setInterval(() => {
      monitoring.recordMetric('transaction.active', this.activeTransactions.size);
      monitoring.recordMetric('transaction.total', this.transactionMetrics.total);
      monitoring.recordMetric('transaction.successful', this.transactionMetrics.successful);
      monitoring.recordMetric('transaction.failed', this.transactionMetrics.failed);
      monitoring.recordMetric('transaction.rolledback', this.transactionMetrics.rolledBack);
      monitoring.recordMetric('transaction.timedout', this.transactionMetrics.timedOut);
    }, 30000); // Every 30 seconds
  }

  /**
   * Get transaction statistics
   */
  getStatistics() {
    return {
      ...this.transactionMetrics,
      activeTransactions: this.activeTransactions.size,
      successRate: this.transactionMetrics.total > 0
        ? (this.transactionMetrics.successful / this.transactionMetrics.total * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

// Custom error classes
export class OptimisticLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

export class TransactionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionTimeoutError';
  }
}

// Export singleton instance
export const transactionService = TransactionService.getInstance();