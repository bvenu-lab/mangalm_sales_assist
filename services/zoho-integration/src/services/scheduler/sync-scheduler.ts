import cron from 'node-cron';
import { ZohoSyncService, SyncResult, SyncStatus } from '../zoho/zoho-sync-service';
import { Logger } from '../../utils/logger';

/**
 * Interface for sync job configuration
 */
export interface SyncJobConfig {
  name: string;
  cronExpression: string;
  syncFunction: () => Promise<SyncResult>;
  onSuccess?: (result: SyncResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Interface for sync scheduler configuration
 */
export interface SyncSchedulerConfig {
  zohoSyncService: ZohoSyncService;
  logger: Logger;
  timezone?: string;
}

/**
 * Service for scheduling synchronization jobs
 */
export class SyncScheduler {
  private zohoSyncService: ZohoSyncService;
  private logger: Logger;
  private timezone?: string;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Constructor
   * @param config Sync scheduler configuration
   */
  constructor(config: SyncSchedulerConfig) {
    this.zohoSyncService = config.zohoSyncService;
    this.logger = config.logger;
    this.timezone = config.timezone;
  }

  /**
   * Schedule a sync job
   * @param config Sync job configuration
   * @returns Scheduled task
   */
  public scheduleJob(config: SyncJobConfig): cron.ScheduledTask {
    const { name, cronExpression, syncFunction, onSuccess, onError } = config;

    this.logger.info(`Scheduling sync job: ${name} with cron expression: ${cronExpression}`);

    const task = cron.schedule(
      cronExpression,
      async () => {
        this.logger.info(`Running sync job: ${name}`);
        try {
          const result = await syncFunction();
          this.logger.info(`Sync job ${name} completed with status: ${result.status}`);
          this.logger.info(`Processed: ${result.recordsProcessed}, Created: ${result.recordsCreated}, Updated: ${result.recordsUpdated}, Failed: ${result.recordsFailed}`);
          
          if (result.status === SyncStatus.FAILED) {
            this.logger.error(`Sync job ${name} failed with ${result.errors.length} errors`);
            result.errors.forEach((error, index) => {
              this.logger.error(`Error ${index + 1}: ${error.message}`);
            });
          }

          if (onSuccess) {
            onSuccess(result);
          }
        } catch (error) {
          this.logger.error(`Sync job ${name} failed with error: ${error}`);
          if (onError) {
            onError(error as Error);
          }
        }
      },
      {
        scheduled: true,
        timezone: this.timezone
      }
    );

    this.jobs.set(name, task);
    return task;
  }

  /**
   * Schedule all default sync jobs
   */
  public scheduleDefaultJobs(): void {
    // Schedule stores sync job - every day at 1:00 AM
    this.scheduleJob({
      name: 'stores-sync',
      cronExpression: '0 1 * * *',
      syncFunction: () => this.zohoSyncService.syncStores()
    });

    // Schedule products sync job - every day at 2:00 AM
    this.scheduleJob({
      name: 'products-sync',
      cronExpression: '0 2 * * *',
      syncFunction: () => this.zohoSyncService.syncProducts()
    });

    // Schedule invoices sync job - every day at 3:00 AM
    this.scheduleJob({
      name: 'invoices-sync',
      cronExpression: '0 3 * * *',
      syncFunction: () => this.zohoSyncService.syncInvoices()
    });

    // Schedule full sync job - every Sunday at 4:00 AM
    this.scheduleJob({
      name: 'full-sync',
      cronExpression: '0 4 * * 0',
      syncFunction: () => this.zohoSyncService.syncAll()
    });
  }

  /**
   * Start a sync job immediately
   * @param name Job name
   * @returns Sync result
   */
  public async startJobNow(name: string): Promise<SyncResult> {
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`Sync job ${name} not found`);
    }

    this.logger.info(`Starting sync job ${name} immediately`);
    
    let result: SyncResult;
    
    switch (name) {
      case 'stores-sync':
        result = await this.zohoSyncService.syncStores();
        break;
      case 'products-sync':
        result = await this.zohoSyncService.syncProducts();
        break;
      case 'invoices-sync':
        result = await this.zohoSyncService.syncInvoices();
        break;
      case 'full-sync':
        result = await this.zohoSyncService.syncAll();
        break;
      default:
        throw new Error(`Unknown sync job: ${name}`);
    }

    this.logger.info(`Sync job ${name} completed with status: ${result.status}`);
    return result;
  }

  /**
   * Stop a sync job
   * @param name Job name
   */
  public stopJob(name: string): void {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.logger.info(`Stopped sync job: ${name}`);
    } else {
      this.logger.warn(`Sync job ${name} not found`);
    }
  }

  /**
   * Stop all sync jobs
   */
  public stopAllJobs(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      this.logger.info(`Stopped sync job: ${name}`);
    });
  }

  /**
   * Get all scheduled jobs
   * @returns Map of job names to scheduled tasks
   */
  public getJobs(): Map<string, cron.ScheduledTask> {
    return this.jobs;
  }

  /**
   * Get job status
   * @param name Job name
   * @returns Job status
   */
  public getJobStatus(name: string): { name: string; scheduled: boolean } {
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`Sync job ${name} not found`);
    }

    return {
      name,
scheduled: (job as any).running === true
    };
  }

  /**
   * Get all job statuses
   * @returns Array of job statuses
   */
  public getAllJobStatuses(): { name: string; scheduled: boolean }[] {
    return Array.from(this.jobs.entries()).map(([name, job]) => ({
      name,
scheduled: (job as any).running === true
    }));
  }
}
