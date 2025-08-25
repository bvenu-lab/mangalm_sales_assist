import Bull from 'bull';
import { config } from '../config';
import * as winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export interface ProcessingJob {
  documentId: string;
  priority: number;
  attempt?: number;
}

export class ProcessingQueue {
  private queue: Bull.Queue<ProcessingJob>;

  constructor() {
    this.queue = new Bull('document-processing', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: config.processing.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.processing.retryDelay,
        },
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.queue.on('completed', (job) => {
      logger.info(`Job ${job.id} completed for document ${job.data.documentId}`);
    });

    this.queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed for document ${job.data.documentId}:`, error);
    });

    this.queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled for document ${job.data.documentId}`);
    });

    this.queue.on('active', (job) => {
      logger.info(`Job ${job.id} started for document ${job.data.documentId}`);
    });
  }

  async addDocument(documentId: string, options: { priority?: number } = {}): Promise<Bull.Job<ProcessingJob>> {
    const job = await this.queue.add(
      {
        documentId,
        priority: options.priority || 5,
      },
      {
        priority: options.priority || 5,
        delay: 0,
      }
    );

    logger.info(`Document ${documentId} added to processing queue with job ID ${job.id}`);
    return job;
  }

  async getQueuePosition(documentId: string): Promise<number | null> {
    const jobs = await this.queue.getWaiting();
    const position = jobs.findIndex(job => job.data.documentId === documentId);
    return position !== -1 ? position + 1 : null;
  }

  async getQueueStats(): Promise<any> {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();
    const completed = await this.queue.getCompletedCount();
    const failed = await this.queue.getFailedCount();
    const delayed = await this.queue.getDelayedCount();

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    logger.info('Processing queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    logger.info('Processing queue resumed');
  }

  async clearQueue(): Promise<void> {
    await this.queue.empty();
    logger.info('Processing queue cleared');
  }

  async removeJob(documentId: string): Promise<boolean> {
    const jobs = await this.queue.getWaiting();
    const job = jobs.find(j => j.data.documentId === documentId);
    
    if (job) {
      await job.remove();
      logger.info(`Job for document ${documentId} removed from queue`);
      return true;
    }
    
    return false;
  }

  async retryFailedJobs(): Promise<number> {
    const failedJobs = await this.queue.getFailed();
    let retryCount = 0;

    for (const job of failedJobs) {
      await job.retry();
      retryCount++;
      logger.info(`Retrying job ${job.id} for document ${job.data.documentId}`);
    }

    return retryCount;
  }

  getQueue(): Bull.Queue<ProcessingJob> {
    return this.queue;
  }
}