/**
 * Enterprise Zoho Sync Orchestrator
 * Coordinates all components for world-class integration
 */

import { EventEmitter } from 'events';
import { EnterpriseZohoClient } from './zoho/enterprise-zoho-client';
import { WebhookService } from './webhooks/webhook-service';
import { DataValidationService } from './validation/data-validation-service';
import { ZohoApiClient } from './zoho/zoho-api-client';
import { ZohoModule } from './zoho/zoho-types';
import { RedisCache } from '../../../shared/src/cache/redis-cache';
import { CircuitBreaker } from '../../../shared/src/resilience/circuit-breaker';
import { RateLimiter } from '../../../shared/src/rate-limiting/rate-limiter';
import { logger } from '../utils/logger';
import cron from 'node-cron';

export interface OrchestratorConfig {
  zoho: {
    apiDomain: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  webhook: {
    port: number;
    path: string;
    secret: string;
    enableBatching: boolean;
    batchSize: number;
  };
  sync: {
    enableScheduled: boolean;
    cronExpression: string;
    modules: ZohoModule[];
    conflictResolution: 'zoho_wins' | 'local_wins' | 'merge' | 'manual';
  };
  cache: {
    redis: {
      host: string;
      port: number;
      password?: string;
      db?: number;
    };
  };
  rateLimiting: {
    windowMs: number;
    max: number;
  };
  circuitBreaker: {
    timeout: number;
    errorThresholdPercentage: number;
    resetTimeout: number;
  };
}

export interface SyncStatus {
  lastSync: {
    timestamp: Date;
    duration: number;
    recordsProcessed: number;
    errors: number;
  };
  activeSyncs: number;
  webhookStatus: 'active' | 'inactive' | 'error';
  validationMetrics: Record<string, any>;
  systemHealth: 'healthy' | 'degraded' | 'error';
}

export interface ConflictResolutionRequest {
  conflictId: string;
  module: ZohoModule;
  zohoData: any;
  localData: any;
  conflictFields: string[];
  suggestedResolution: string;
  priority: 'high' | 'medium' | 'low';
}

export class EnterpriseSyncOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private zohoClient: EnterpriseZohoClient;
  private webhookService: WebhookService;
  private validationService: DataValidationService;
  private cache: RedisCache;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private cronJob?: any;
  private syncStatus: SyncStatus;
  private conflictQueue: ConflictResolutionRequest[] = [];
  private isInitialized = false;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.syncStatus = {
      lastSync: {
        timestamp: new Date(),
        duration: 0,
        recordsProcessed: 0,
        errors: 0
      },
      activeSyncs: 0,
      webhookStatus: 'inactive',
      validationMetrics: {},
      systemHealth: 'healthy'
    };

    this.initializeComponents();
  }

  /**
   * Initialize all components
   */
  private async initializeComponents(): Promise<void> {
    try {
      logger.info('Initializing Enterprise Sync Orchestrator components');

      // Initialize cache
      this.cache = new RedisCache({
        keyPrefix: 'zoho_sync:',
        // @ts-ignore
        redis: {
          host: this.config.cache.redis.host,
          port: this.config.cache.redis.port,
          password: this.config.cache.redis.password,
          db: this.config.cache.redis.db || 0
        }
      });

      // Initialize rate limiter
      this.rateLimiter = new RateLimiter({
        windowMs: this.config.rateLimiting.windowMs,
        max: this.config.rateLimiting.max
      }, this.cache);

      // Initialize circuit breaker
      this.circuitBreaker = new CircuitBreaker({
        timeout: this.config.circuitBreaker.timeout,
        // @ts-ignore
        errorThresholdPercentage: this.config.circuitBreaker.errorThresholdPercentage,
        resetTimeout: this.config.circuitBreaker.resetTimeout
      });

      // Initialize Zoho API client
      const apiClient = new ZohoApiClient({
        apiDomain: this.config.zoho.apiDomain,
        clientId: this.config.zoho.clientId,
        clientSecret: this.config.zoho.clientSecret,
        refreshToken: this.config.zoho.refreshToken,
        redirectUri: 'http://localhost:3003/callback'
      }, logger);

      // Initialize Enterprise Zoho client
      this.zohoClient = new EnterpriseZohoClient({
        apiClient,
        cache: this.cache,
        rateLimiter: this.rateLimiter,
        circuitBreaker: this.circuitBreaker,
        enableWebhooks: true,
        enableBidirectionalSync: true,
        enableBulkOperations: true,
        enableDeltaSync: true,
        maxBatchSize: 100
      });

      // Initialize validation service
      this.validationService = new DataValidationService();

      // Initialize webhook service
      this.webhookService = new WebhookService({
        port: this.config.webhook.port,
        path: this.config.webhook.path,
        secret: this.config.webhook.secret,
        enableRetries: true,
        maxRetries: 3,
        retryDelay: 1000,
        enableBatching: this.config.webhook.enableBatching,
        batchSize: this.config.webhook.batchSize,
        batchTimeout: 5000,
        enableFiltering: true,
        filters: []
      }, this.zohoClient, this.cache, this.rateLimiter);

      // Set up event handlers
      this.setupEventHandlers();

      // Initialize scheduled sync if enabled
      if (this.config.sync.enableScheduled) {
        this.setupScheduledSync();
      }

      this.isInitialized = true;
      logger.info('Enterprise Sync Orchestrator initialized successfully');

      this.emit('initialized');

    } catch (error: any) {
      logger.error('Failed to initialize Enterprise Sync Orchestrator', {
        error: error.message,
        stack: error.stack
      });
      this.syncStatus.systemHealth = 'error';
      throw error;
    }
  }

  /**
   * Start the orchestrator
   */
  public async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeComponents();
    }

    try {
      // Start webhook service
      await this.webhookService.start();
      this.syncStatus.webhookStatus = 'active';

      // Register webhooks for all modules
      for (const module of this.config.sync.modules) {
        await this.webhookService.registerWebhook(module, ['create', 'update', 'delete']);
      }

      // Perform initial health check
      await this.performHealthCheck();

      logger.info('Enterprise Sync Orchestrator started successfully');
      this.emit('started');

    } catch (error: any) {
      logger.error('Failed to start Enterprise Sync Orchestrator', {
        error: error.message
      });
      this.syncStatus.systemHealth = 'error';
      throw error;
    }
  }

  /**
   * Stop the orchestrator
   */
  public async stop(): Promise<void> {
    try {
      // Stop scheduled sync
      if (this.cronJob) {
        this.cronJob.destroy();
      }

      // Clean up webhook service
      this.webhookService.cleanup();
      this.syncStatus.webhookStatus = 'inactive';

      logger.info('Enterprise Sync Orchestrator stopped');
      this.emit('stopped');

    } catch (error: any) {
      logger.error('Error stopping Enterprise Sync Orchestrator', {
        error: error.message
      });
    }
  }

  /**
   * Trigger full synchronization
   */
  public async triggerFullSync(options: {
    modules?: ZohoModule[];
    direction?: 'pull' | 'push' | 'bidirectional';
    validateData?: boolean;
  } = {}): Promise<any> {
    const startTime = Date.now();
    this.syncStatus.activeSyncs++;

    try {
      logger.info('Triggering full synchronization', options);

      const modules = options.modules || this.config.sync.modules;
      const results: any[] = [];

      for (const module of modules) {
        try {
          // Step 1: Data validation (if enabled)
          let validationResults;
          if (options.validateData) {
            const records = await this.getRecordsForValidation(module);
            // @ts-ignore
            validationResults = await this.validationService.validateBatch(records);
            
            this.syncStatus.validationMetrics[module] = validationResults.summary;
          }

          // Step 2: Synchronization
          const syncResult = await this.zohoClient.syncModule(module, {
            modules: [module],
            direction: options.direction || 'bidirectional',
            deltaSync: true,
            batchSize: 100,
            conflictResolution: this.config.sync.conflictResolution,
            customFields: {},
            filters: {}
          });

          results.push({
            module,
            syncResult,
            validationResults
          });

          this.emit('moduleSynced', { module, result: syncResult });

        } catch (error: any) {
          logger.error(`Failed to sync module ${module}`, {
            error: error.message
          });
          
          results.push({
            module,
            error: error.message
          });
        }
      }

      // Update sync status
      const duration = Date.now() - startTime;
      const totalProcessed = results.reduce((sum, r) => sum + (r.syncResult?.processed || 0), 0);
      const totalErrors = results.filter(r => r.error).length;

      this.syncStatus.lastSync = {
        timestamp: new Date(),
        duration,
        recordsProcessed: totalProcessed,
        errors: totalErrors
      };

      logger.info('Full synchronization completed', {
        duration,
        modulesProcessed: results.length,
        recordsProcessed: totalProcessed,
        errors: totalErrors
      });

      this.emit('syncCompleted', { results, duration, totalProcessed, totalErrors });

      return {
        success: true,
        results,
        summary: {
          duration,
          modulesProcessed: results.length,
          recordsProcessed: totalProcessed,
          errors: totalErrors
        }
      };

    } catch (error: any) {
      logger.error('Full synchronization failed', {
        error: error.message
      });

      this.emit('syncFailed', { error });
      throw error;

    } finally {
      this.syncStatus.activeSyncs = Math.max(0, this.syncStatus.activeSyncs - 1);
    }
  }

  /**
   * Get sync status
   */
  public getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Get pending conflicts
   */
  public getPendingConflicts(): ConflictResolutionRequest[] {
    return [...this.conflictQueue];
  }

  /**
   * Resolve conflict manually
   */
  public async resolveConflict(
    conflictId: string,
    resolution: 'use_zoho' | 'use_local' | 'merge' | 'custom',
    customData?: any
  ): Promise<void> {
    const conflict = this.conflictQueue.find(c => c.conflictId === conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    try {
      await this.zohoClient.resolveConflict(conflictId, resolution, customData);
      
      // Remove from queue
      this.conflictQueue = this.conflictQueue.filter(c => c.conflictId !== conflictId);
      
      this.emit('conflictResolved', { conflictId, resolution });
      
      logger.info('Conflict resolved successfully', {
        conflictId,
        resolution,
        module: conflict.module
      });

    } catch (error: any) {
      logger.error('Failed to resolve conflict', {
        conflictId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get comprehensive system health
   */
  public async getSystemHealth(): Promise<any> {
    try {
      const [zohoHealth, webhookStats, validationStats] = await Promise.all([
        this.zohoClient.healthCheck(),
        this.webhookService.getStatistics(),
        this.getValidationStatistics()
      ]);

      const health = {
        timestamp: new Date(),
        overall: 'healthy',
        components: {
          zoho: zohoHealth,
          webhooks: {
            status: this.syncStatus.webhookStatus,
            stats: webhookStats
          },
          validation: validationStats,
          sync: {
            status: this.syncStatus.activeSyncs > 0 ? 'active' : 'idle',
            lastSync: this.syncStatus.lastSync,
            pendingConflicts: this.conflictQueue.length
          }
        },
        metrics: {
          syncStatus: this.syncStatus,
          pendingConflicts: this.conflictQueue.length
        }
      };

      // Determine overall health
      if (zohoHealth.status !== 'healthy' || this.syncStatus.webhookStatus === 'error') {
        health.overall = 'degraded';
      }

      if (this.syncStatus.systemHealth === 'error') {
        health.overall = 'error';
      }

      return health;

    } catch (error: any) {
      logger.error('Failed to get system health', {
        error: error.message
      });

      return {
        timestamp: new Date(),
        overall: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get data quality metrics
   */
  public getDataQualityMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};

    for (const module of this.config.sync.modules) {
      // @ts-ignore
      const qualityMetrics = this.validationService.getQualityMetrics(module);
      if (qualityMetrics) {
        metrics[module] = qualityMetrics;
      }
    }

    return metrics;
  }

  // Private methods

  private setupEventHandlers(): void {
    // Zoho client events
    this.zohoClient.on('syncCompleted', (data) => {
      this.emit('moduleSyncCompleted', data);
    });

    this.zohoClient.on('conflictDetected', (conflict) => {
      this.conflictQueue.push({
        conflictId: conflict.id,
        module: conflict.module,
        zohoData: conflict.zohoData,
        localData: conflict.localData,
        conflictFields: conflict.conflictFields,
        suggestedResolution: 'merge',
        priority: 'medium'
      });
      
      this.emit('conflictDetected', conflict);
    });

    // Webhook service events
    this.webhookService.on('webhookReceived', (event) => {
      this.emit('webhookReceived', event);
    });

    this.webhookService.on('eventProcessed', (event) => {
      this.emit('webhookEventProcessed', event);
    });

    // Validation service events
    this.validationService.on('recordValidated', (data) => {
      if (!data.result.isValid) {
        this.emit('validationFailed', data);
      }
    });
  }

  private setupScheduledSync(): void {
    this.cronJob = cron.schedule(this.config.sync.cronExpression, async () => {
      try {
        logger.info('Running scheduled sync');
        await this.triggerFullSync({
          validateData: true,
          direction: 'bidirectional'
        });
      } catch (error: any) {
        logger.error('Scheduled sync failed', {
          error: error.message
        });
      }
    }, {
      scheduled: false
    });

    this.cronJob.start();
    logger.info(`Scheduled sync configured with expression: ${this.config.sync.cronExpression}`);
  }

  private async getRecordsForValidation(module: ZohoModule): Promise<any[]> {
    // This would typically fetch records from local database
    // For now, return empty array
    return [];
  }

  private getValidationStatistics(): any {
    const stats: any = {};
    
    for (const module of this.config.sync.modules) {
      // @ts-ignore
      const metrics = this.validationService.getQualityMetrics(module);
      // @ts-ignore
      const history = this.validationService.getValidationHistory(module, 10);
      
      stats[module] = {
        metrics,
        recentHistory: history.length
      };
    }

    return stats;
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getSystemHealth();
      this.syncStatus.systemHealth = health.overall as any;
      
      logger.info('Health check completed', {
        status: health.overall
      });
    } catch (error: any) {
      logger.error('Health check failed', {
        error: error.message
      });
      this.syncStatus.systemHealth = 'error';
    }
  }
}

export default EnterpriseSyncOrchestrator;