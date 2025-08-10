/**
 * Enterprise Webhook Service for Real-time Zoho Integration
 * Handles webhooks, real-time sync, and event processing
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { EnterpriseZohoClient, WebhookPayload } from '../zoho/enterprise-zoho-client';
import { ZohoModule } from '../zoho/zoho-types';
import { RedisCache } from '../../../../shared/src/cache/redis-cache';
import { RateLimiter } from '../../../../shared/src/rate-limiting/rate-limiter';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface WebhookConfig {
  port: number;
  path: string;
  secret: string;
  enableRetries: boolean;
  maxRetries: number;
  retryDelay: number;
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  enableFiltering: boolean;
  filters: WebhookFilter[];
}

export interface WebhookFilter {
  module: ZohoModule;
  operation: 'create' | 'update' | 'delete' | '*';
  conditions?: Record<string, any>;
}

export interface WebhookEvent {
  id: string;
  module: ZohoModule;
  operation: 'create' | 'update' | 'delete';
  recordId: string;
  data: any;
  timestamp: Date;
  processed: boolean;
  retryCount: number;
  error?: string;
}

export interface WebhookBatch {
  id: string;
  events: WebhookEvent[];
  createdAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface WebhookMetrics {
  totalReceived: number;
  totalProcessed: number;
  totalFailed: number;
  avgProcessingTime: number;
  currentBatches: number;
  lastProcessed: Date;
  errorRate: number;
}

export class WebhookService extends EventEmitter {
  private app: express.Application;
  private config: WebhookConfig;
  private zohoClient: EnterpriseZohoClient;
  private cache: RedisCache;
  private rateLimiter: RateLimiter;
  private events: Map<string, WebhookEvent> = new Map();
  private batches: Map<string, WebhookBatch> = new Map();
  private metrics: WebhookMetrics;
  private batchTimer?: NodeJS.Timeout;
  private processingQueue: WebhookEvent[] = [];
  private isProcessing = false;

  constructor(
    config: WebhookConfig,
    zohoClient: EnterpriseZohoClient,
    cache?: RedisCache,
    rateLimiter?: RateLimiter
  ) {
    super();
    this.config = config;
    this.zohoClient = zohoClient;
    this.cache = cache || new RedisCache({ keyPrefix: 'webhook:' });
    this.rateLimiter = rateLimiter || new RateLimiter({
      windowMs: 60000,
      max: 1000,
      message: 'Webhook rate limit exceeded'
    });

    this.metrics = {
      totalReceived: 0,
      totalProcessed: 0,
      totalFailed: 0,
      avgProcessingTime: 0,
      currentBatches: 0,
      lastProcessed: new Date(),
      errorRate: 0
    };

    this.initializeExpressApp();
    this.startBatchProcessor();

    logger.info('Webhook Service initialized', {
      port: config.port,
      path: config.path,
      enableBatching: config.enableBatching,
      enableRetries: config.enableRetries
    });
  }

  /**
   * Start the webhook server
   */
  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, () => {
        logger.info(`Webhook server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Register webhook with Zoho CRM
   */
  public async registerWebhook(module: ZohoModule, operations: string[]): Promise<void> {
    try {
      logger.info(`Registering webhook for ${module}`, { operations });

      // This would typically call Zoho's webhook registration API
      const webhookData = {
        notify_url: `${process.env.WEBHOOK_BASE_URL}${this.config.path}`,
        module: module,
        events: operations,
        token: this.config.secret
      };

      // Store webhook registration
      await this.cache.set(`webhook_registration_${module}`, webhookData);

      logger.info(`Webhook registered successfully for ${module}`);
    } catch (error: any) {
      logger.error(`Failed to register webhook for ${module}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process webhook payload
   */
  private async processWebhook(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Verify webhook signature
      const signature = req.headers['x-zoho-signature'] as string;
      if (!this.verifySignature(req.body, signature)) {
        logger.warn('Invalid webhook signature', {
          signature,
          ip: req.ip
        });
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Parse webhook payload
      const payload = this.parseWebhookPayload(req.body);
      if (!payload) {
        logger.warn('Invalid webhook payload', { body: req.body });
        res.status(400).json({ error: 'Invalid payload' });
        return;
      }

      // Apply filters
      if (this.config.enableFiltering && !this.passesFilters(payload)) {
        logger.debug('Webhook filtered out', { payload });
        res.status(200).json({ status: 'filtered' });
        return;
      }

      // Create webhook event
      const event: WebhookEvent = {
        id: uuidv4(),
        module: payload.module,
        operation: payload.operation,
        recordId: payload.recordId,
        data: payload.data,
        timestamp: new Date(),
        processed: false,
        retryCount: 0
      };

      this.events.set(event.id, event);
      this.metrics.totalReceived++;

      // Process immediately or add to batch
      if (this.config.enableBatching) {
        await this.addToBatch(event);
      } else {
        await this.processEventImmediate(event);
      }

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime);

      res.status(200).json({ 
        status: 'received',
        eventId: event.id,
        processingTime
      });

      this.emit('webhookReceived', event);

    } catch (error: any) {
      logger.error('Failed to process webhook', {
        error: error.message,
        body: req.body
      });

      res.status(500).json({ error: 'Processing failed' });
      this.metrics.totalFailed++;
    }
  }

  /**
   * Process single event immediately
   */
  private async processEventImmediate(event: WebhookEvent): Promise<void> {
    try {
      await this.processEvent(event);
      event.processed = true;
      this.metrics.totalProcessed++;
      this.metrics.lastProcessed = new Date();

      this.emit('eventProcessed', event);

    } catch (error: any) {
      logger.error('Failed to process webhook event', {
        eventId: event.id,
        error: error.message
      });

      event.error = error.message;
      
      if (this.config.enableRetries && event.retryCount < this.config.maxRetries) {
        await this.scheduleRetry(event);
      } else {
        this.metrics.totalFailed++;
        this.emit('eventFailed', event);
      }
    }
  }

  /**
   * Add event to batch
   */
  private async addToBatch(event: WebhookEvent): Promise<void> {
    // Find existing batch or create new one
    let batch = Array.from(this.batches.values()).find(b => 
      b.status === 'pending' && b.events.length < this.config.batchSize
    );

    if (!batch) {
      batch = {
        id: uuidv4(),
        events: [],
        createdAt: new Date(),
        status: 'pending'
      };
      this.batches.set(batch.id, batch);
      this.metrics.currentBatches++;
    }

    batch.events.push(event);

    // Process batch if full
    if (batch.events.length >= this.config.batchSize) {
      await this.processBatch(batch);
    }
  }

  /**
   * Process batch of events
   */
  private async processBatch(batch: WebhookBatch): Promise<void> {
    try {
      logger.info(`Processing webhook batch`, {
        batchId: batch.id,
        eventCount: batch.events.length
      });

      batch.status = 'processing';
      batch.processedAt = new Date();

      // Process events in parallel
      const promises = batch.events.map(event => this.processEvent(event));
      const results = await Promise.allSettled(promises);

      // Update event statuses
      results.forEach((result, index) => {
        const event = batch.events[index];
        if (result.status === 'fulfilled') {
          event.processed = true;
          this.metrics.totalProcessed++;
        } else {
          event.error = result.reason?.message;
          this.metrics.totalFailed++;
        }
      });

      batch.status = 'completed';
      this.metrics.currentBatches--;
      this.metrics.lastProcessed = new Date();

      this.emit('batchProcessed', batch);

    } catch (error: any) {
      logger.error('Failed to process webhook batch', {
        batchId: batch.id,
        error: error.message
      });

      batch.status = 'failed';
      this.metrics.totalFailed += batch.events.length;
      this.emit('batchFailed', batch);
    }
  }

  /**
   * Process individual webhook event
   */
  private async processEvent(event: WebhookEvent): Promise<void> {
    logger.debug('Processing webhook event', {
      eventId: event.id,
      module: event.module,
      operation: event.operation
    });

    // Create webhook payload for Zoho client
    const payload: WebhookPayload = {
      module: event.module,
      operation: event.operation,
      recordId: event.recordId,
      data: event.data,
      timestamp: event.timestamp,
      signature: '' // Already verified
    };

    // Process through Zoho client
    await this.zohoClient.handleWebhook(payload);

    // Store processed event
    await this.cache.set(`processed_event_${event.id}`, event, { ttl: 86400 }); // 24 hours
  }

  /**
   * Schedule retry for failed event
   */
  private async scheduleRetry(event: WebhookEvent): Promise<void> {
    event.retryCount++;
    const delay = this.config.retryDelay * Math.pow(2, event.retryCount - 1); // Exponential backoff

    logger.info(`Scheduling retry for webhook event`, {
      eventId: event.id,
      retryCount: event.retryCount,
      delay
    });

    setTimeout(async () => {
      try {
        await this.processEventImmediate(event);
      } catch (error: any) {
        logger.error(`Retry failed for webhook event`, {
          eventId: event.id,
          retryCount: event.retryCount,
          error: error.message
        });
      }
    }, delay);
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    if (!this.config.enableBatching) {
      return;
    }

    // Process batches on timeout
    this.batchTimer = setInterval(() => {
      this.processPendingBatches();
    }, this.config.batchTimeout);
  }

  /**
   * Process pending batches
   */
  private async processPendingBatches(): Promise<void> {
    const pendingBatches = Array.from(this.batches.values()).filter(
      batch => batch.status === 'pending' && batch.events.length > 0
    );

    for (const batch of pendingBatches) {
      await this.processBatch(batch);
    }
  }

  /**
   * Initialize Express app
   */
  private initializeExpressApp(): void {
    this.app = express();

    // Middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    this.app.use(this.rateLimiter.middleware);

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        metrics: this.metrics,
        timestamp: new Date()
      });
    });

    // Webhook endpoint
    this.app.post(this.config.path, (req: Request, res: Response) => {
      this.processWebhook(req, res).catch(error => {
        logger.error('Unhandled webhook error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req: Request, res: Response) => {
      res.json({
        metrics: this.metrics,
        events: {
          total: this.events.size,
          processed: Array.from(this.events.values()).filter(e => e.processed).length,
          failed: Array.from(this.events.values()).filter(e => e.error).length
        },
        batches: {
          total: this.batches.size,
          pending: Array.from(this.batches.values()).filter(b => b.status === 'pending').length,
          processing: Array.from(this.batches.values()).filter(b => b.status === 'processing').length,
          completed: Array.from(this.batches.values()).filter(b => b.status === 'completed').length
        }
      });
    });

    // Error handling
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Express error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /**
   * Verify webhook signature
   */
  private verifySignature(payload: any, signature: string): boolean {
    if (!signature || !this.config.secret) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', this.config.secret);
    hmac.update(JSON.stringify(payload));
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Parse webhook payload
   */
  private parseWebhookPayload(body: any): WebhookPayload | null {
    try {
      // Zoho webhook payload structure
      if (!body.module || !body.operation || !body.data) {
        return null;
      }

      return {
        module: body.module as ZohoModule,
        operation: body.operation,
        recordId: body.data.id || body.record_id,
        data: body.data,
        timestamp: new Date(body.timestamp || Date.now()),
        signature: body.signature || ''
      };

    } catch (error: any) {
      logger.error('Failed to parse webhook payload', {
        error: error.message,
        body
      });
      return null;
    }
  }

  /**
   * Check if webhook passes filters
   */
  private passesFilters(payload: WebhookPayload): boolean {
    if (!this.config.filters || this.config.filters.length === 0) {
      return true;
    }

    return this.config.filters.some(filter => {
      // Check module
      if (filter.module !== payload.module) {
        return false;
      }

      // Check operation
      if (filter.operation !== '*' && filter.operation !== payload.operation) {
        return false;
      }

      // Check conditions
      if (filter.conditions) {
        for (const [field, value] of Object.entries(filter.conditions)) {
          if (payload.data[field] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Update metrics
   */
  private updateMetrics(processingTime: number): void {
    // Update average processing time
    const totalProcessed = this.metrics.totalProcessed + this.metrics.totalFailed;
    if (totalProcessed > 0) {
      this.metrics.avgProcessingTime = 
        (this.metrics.avgProcessingTime * (totalProcessed - 1) + processingTime) / totalProcessed;
    }

    // Update error rate
    if (this.metrics.totalReceived > 0) {
      this.metrics.errorRate = (this.metrics.totalFailed / this.metrics.totalReceived) * 100;
    }
  }

  /**
   * Get webhook statistics
   */
  public getStatistics(): any {
    return {
      metrics: this.metrics,
      events: {
        total: this.events.size,
        processed: Array.from(this.events.values()).filter(e => e.processed).length,
        failed: Array.from(this.events.values()).filter(e => e.error).length,
        pending: Array.from(this.events.values()).filter(e => !e.processed && !e.error).length
      },
      batches: {
        total: this.batches.size,
        pending: Array.from(this.batches.values()).filter(b => b.status === 'pending').length,
        processing: Array.from(this.batches.values()).filter(b => b.status === 'processing').length,
        completed: Array.from(this.batches.values()).filter(b => b.status === 'completed').length,
        failed: Array.from(this.batches.values()).filter(b => b.status === 'failed').length
      }
    };
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Process any pending batches before cleanup
    this.processPendingBatches().catch(error => {
      logger.error('Error processing pending batches during cleanup', {
        error: error.message
      });
    });

    logger.info('Webhook service cleaned up');
  }
}

export default WebhookService;