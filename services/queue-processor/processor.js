"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processor = exports.BulkUploadProcessor = void 0;
const events_1 = require("events");
const worker_threads_1 = require("worker_threads");
const path = __importStar(require("path"));
const redis_config_1 = require("../../config/redis.config");
const database_config_1 = require("../../config/database.config");
const bulk_upload_entities_1 = require("../../models/bulk-upload.entities");
class BulkUploadProcessor extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.workers = new Map();
        this.workerPool = [];
        this.workerMetrics = new Map();
        this.isShuttingDown = false;
        this.metrics = {
            jobsProcessed: 0,
            jobsFailed: 0,
            rowsProcessed: 0,
            avgProcessingTime: 0,
            peakMemoryUsage: 0,
            currentThroughput: 0
        };
        this.maxWorkers = options.maxWorkers || 8;
        const concurrency = options.concurrency || 5;
        this.uploadQueue = redis_config_1.redisManager.getQueue('bulk-upload-queue', {
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: 100,
                removeOnFail: 500
            }
        });
        this.processingQueue = redis_config_1.redisManager.getQueue('processing-queue');
        this.validationQueue = redis_config_1.redisManager.getQueue('validation-queue');
        this.notificationQueue = redis_config_1.redisManager.getQueue('notification-queue');
        this.setupQueueProcessors(concurrency);
        this.initializeWorkerPool();
        this.startMetricsCollection();
    }
    setupQueueProcessors(concurrency) {
        this.uploadQueue.process(concurrency, async (job) => {
            const startTime = Date.now();
            try {
                this.emit('job:started', job.id);
                const result = await this.processUploadJob(job);
                const duration = Date.now() - startTime;
                this.updateMetrics(duration, true);
                this.emit('job:completed', job.id, result);
                return result;
            }
            catch (error) {
                const duration = Date.now() - startTime;
                this.updateMetrics(duration, false);
                this.emit('job:failed', job.id, error);
                throw error;
            }
        });
        this.processingQueue.process(concurrency * 2, async (job) => {
            return this.processChunk(job);
        });
        this.validationQueue.process(concurrency, async (job) => {
            return this.validateData(job);
        });
        this.notificationQueue.process(async (job) => {
            return this.sendNotification(job);
        });
        this.setupQueueEventHandlers();
    }
    async processUploadJob(job) {
        const { uploadId, data } = job.data;
        const client = await database_config_1.dbPool.getClient();
        try {
            await client.query('BEGIN');
            await client.query(`
        UPDATE bulk_upload.upload_jobs 
        SET status = $1, started_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [bulk_upload_entities_1.UploadStatus.PROCESSING, uploadId]);
            const uploadResult = await client.query(`
        SELECT * FROM bulk_upload.upload_jobs WHERE id = $1
      `, [uploadId]);
            if (!uploadResult.rows[0]) {
                throw new Error(`Upload job ${uploadId} not found`);
            }
            const uploadJob = uploadResult.rows[0];
            const chunks = await this.createChunks(uploadJob, client);
            const chunkJobs = await Promise.all(chunks.map(chunk => this.processingQueue.add(`chunk-${chunk.id}`, {
                uploadId,
                chunkId: chunk.id,
                chunk
            }, {
                priority: job.opts.priority || 0,
                attempts: 3
            })));
            await client.query('COMMIT');
            const results = await this.waitForChunks(chunkJobs, uploadId);
            await this.finalizeUpload(uploadId, results);
            return {
                uploadId,
                chunksProcessed: results.length,
                status: bulk_upload_entities_1.UploadStatus.COMPLETED
            };
        }
        catch (error) {
            await client.query('ROLLBACK');
            await this.recordError(uploadId, error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    async createChunks(uploadJob, client) {
        const chunkSize = parseInt(process.env.UPLOAD_BATCH_SIZE || '1000', 10);
        const totalChunks = Math.ceil(uploadJob.totalRows / chunkSize);
        const chunks = [];
        for (let i = 0; i < totalChunks; i++) {
            const startRow = i * chunkSize;
            const endRow = Math.min((i + 1) * chunkSize - 1, uploadJob.totalRows - 1);
            const chunkResult = await client.query(`
        INSERT INTO bulk_upload.upload_chunks (
          upload_id, chunk_number, start_row, end_row, 
          row_count, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *
      `, [
                uploadJob.id,
                i + 1,
                startRow,
                endRow,
                endRow - startRow + 1,
                bulk_upload_entities_1.ChunkStatus.PENDING
            ]);
            chunks.push(chunkResult.rows[0]);
        }
        return chunks;
    }
    async processChunk(job) {
        const { uploadId, chunkId, chunk } = job.data;
        const worker = await this.getAvailableWorker();
        return new Promise((resolve, reject) => {
            worker.postMessage({
                type: 'PROCESS_CHUNK',
                uploadId,
                chunkId,
                chunk
            });
            const messageHandler = (message) => {
                if (message.chunkId === chunkId) {
                    worker.off('message', messageHandler);
                    if (message.error) {
                        reject(new Error(message.error));
                    }
                    else {
                        resolve(message.result);
                    }
                    this.returnWorkerToPool(worker);
                }
            };
            worker.on('message', messageHandler);
            const timeout = setTimeout(() => {
                worker.off('message', messageHandler);
                this.returnWorkerToPool(worker);
                reject(new Error(`Chunk ${chunkId} processing timeout`));
            }, 60000);
            worker.once('message', () => clearTimeout(timeout));
        });
    }
    initializeWorkerPool() {
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = new worker_threads_1.Worker(path.join(__dirname, 'chunk-worker.js'), {
                workerData: {
                    workerId: `worker-${i}`,
                    dbConfig: {
                        host: process.env.DB_HOST,
                        port: process.env.DB_PORT,
                        database: process.env.DB_NAME,
                        user: process.env.DB_USER,
                        password: process.env.DB_PASSWORD
                    }
                }
            });
            worker.on('error', (error) => {
                console.error(`Worker error:`, error);
                this.handleWorkerError(worker, error);
            });
            worker.on('exit', (code) => {
                if (!this.isShuttingDown && code !== 0) {
                    console.warn(`Worker exited with code ${code}, restarting...`);
                    this.restartWorker(worker);
                }
            });
            worker.on('message', (message) => {
                if (message.type === 'METRICS') {
                    this.workerMetrics.set(message.workerId, message.metrics);
                }
            });
            this.workerPool.push(worker);
            this.workers.set(`worker-${i}`, worker);
        }
    }
    async getAvailableWorker() {
        while (this.workerPool.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return this.workerPool.shift();
    }
    returnWorkerToPool(worker) {
        if (!this.isShuttingDown) {
            this.workerPool.push(worker);
        }
    }
    async waitForChunks(chunkJobs, uploadId) {
        const results = await Promise.allSettled(chunkJobs.map(job => job.finished()));
        let completed = 0;
        for (const result of results) {
            completed++;
            await this.sendProgressUpdate(uploadId, {
                currentChunk: completed,
                totalChunks: results.length,
                percentComplete: (completed / results.length) * 100
            });
        }
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error(`${failures.length} chunks failed for upload ${uploadId}`);
        }
        return results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
    }
    async finalizeUpload(uploadId, chunkResults) {
        const client = await database_config_1.dbPool.getClient();
        try {
            await client.query('BEGIN');
            const totals = chunkResults.reduce((acc, result) => ({
                processedRows: acc.processedRows + (result.processedRows || 0),
                successfulRows: acc.successfulRows + (result.successfulRows || 0),
                failedRows: acc.failedRows + (result.failedRows || 0),
                duplicateRows: acc.duplicateRows + (result.duplicateRows || 0)
            }), {
                processedRows: 0,
                successfulRows: 0,
                failedRows: 0,
                duplicateRows: 0
            });
            await client.query(`
        UPDATE bulk_upload.upload_jobs 
        SET 
          status = $1,
          processed_rows = $2,
          successful_rows = $3,
          failed_rows = $4,
          duplicate_rows = $5,
          completed_at = NOW(),
          processing_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
          rows_per_second = $2 / NULLIF(EXTRACT(EPOCH FROM (NOW() - started_at)), 0),
          updated_at = NOW()
        WHERE id = $6
      `, [
                totals.failedRows > 0 ? bulk_upload_entities_1.UploadStatus.PARTIALLY_COMPLETED : bulk_upload_entities_1.UploadStatus.COMPLETED,
                totals.processedRows,
                totals.successfulRows,
                totals.failedRows,
                totals.duplicateRows,
                uploadId
            ]);
            await client.query(`
        INSERT INTO audit.upload_audit_log (
          upload_id, event_type, event_data, user_id, timestamp
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [
                uploadId,
                'UPLOAD_COMPLETED',
                JSON.stringify(totals),
                'system'
            ]);
            await client.query('COMMIT');
            await this.notificationQueue.add('upload-complete', {
                uploadId,
                totals
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async validateData(job) {
        const { data, schema } = job.data;
        return { valid: true, errors: [] };
    }
    async sendNotification(job) {
        const { type, data } = job.data;
        this.emit('notification', { type, data });
        if (process.env.NOTIFICATION_WEBHOOK_ENABLED === 'true') {
        }
    }
    async sendProgressUpdate(uploadId, update) {
        const client = await database_config_1.dbPool.getClient();
        try {
            const result = await client.query(`
        SELECT * FROM bulk_upload.upload_jobs WHERE id = $1
      `, [uploadId]);
            if (result.rows[0]) {
                const job = result.rows[0];
                const progressUpdate = {
                    uploadId,
                    status: job.status,
                    totalRows: job.total_rows,
                    processedRows: job.processed_rows,
                    successfulRows: job.successful_rows,
                    failedRows: job.failed_rows,
                    duplicateRows: job.duplicate_rows,
                    percentComplete: (job.processed_rows / job.total_rows) * 100,
                    ...update,
                    timestamp: new Date()
                };
                this.emit('progress', progressUpdate);
            }
        }
        finally {
            client.release();
        }
    }
    async recordError(uploadId, error, rowNumber) {
        const client = await database_config_1.dbPool.getClient();
        try {
            await client.query(`
        INSERT INTO bulk_upload.processing_errors (
          upload_id, row_number, error_type, error_code, 
          error_message, stack_trace, retryable, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
                uploadId,
                rowNumber || null,
                bulk_upload_entities_1.ErrorType.PROCESSING,
                error.code || 'UNKNOWN',
                error.message,
                error.stack,
                true
            ]);
        }
        finally {
            client.release();
        }
    }
    setupQueueEventHandlers() {
        this.uploadQueue.on('completed', (job, result) => {
            this.metrics.jobsProcessed++;
            console.info(`Job ${job.id} completed`);
        });
        this.uploadQueue.on('failed', (job, err) => {
            this.metrics.jobsFailed++;
            console.error(`Job ${job.id} failed:`, err);
        });
        this.uploadQueue.on('stalled', (job) => {
            console.warn(`Job ${job.id} stalled`);
        });
        this.processingQueue.on('completed', (job) => {
            console.debug(`Chunk ${job.data.chunkId} processed`);
        });
        this.processingQueue.on('failed', (job, err) => {
            console.error(`Chunk ${job.data.chunkId} failed:`, err);
        });
    }
    handleWorkerError(worker, error) {
        console.error('Worker error:', error);
        const index = this.workerPool.indexOf(worker);
        if (index > -1) {
            this.workerPool.splice(index, 1);
        }
        if (!this.isShuttingDown) {
            this.restartWorker(worker);
        }
    }
    restartWorker(oldWorker) {
        let workerId;
        for (const [id, w] of this.workers.entries()) {
            if (w === oldWorker) {
                workerId = id;
                break;
            }
        }
        if (!workerId)
            return;
        oldWorker.terminate();
        const newWorker = new worker_threads_1.Worker(path.join(__dirname, 'chunk-worker.js'), {
            workerData: {
                workerId,
                dbConfig: {
                    host: process.env.DB_HOST,
                    port: process.env.DB_PORT,
                    database: process.env.DB_NAME,
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD
                }
            }
        });
        newWorker.on('error', (error) => {
            this.handleWorkerError(newWorker, error);
        });
        newWorker.on('exit', (code) => {
            if (!this.isShuttingDown && code !== 0) {
                this.restartWorker(newWorker);
            }
        });
        this.workers.set(workerId, newWorker);
        this.workerPool.push(newWorker);
    }
    updateMetrics(duration, success) {
        if (success) {
            this.metrics.jobsProcessed++;
        }
        else {
            this.metrics.jobsFailed++;
        }
        const alpha = 0.1;
        this.metrics.avgProcessingTime =
            alpha * duration + (1 - alpha) * this.metrics.avgProcessingTime;
        const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        if (memUsage > this.metrics.peakMemoryUsage) {
            this.metrics.peakMemoryUsage = memUsage;
        }
    }
    startMetricsCollection() {
        setInterval(() => {
            const throughput = this.metrics.rowsProcessed /
                (this.metrics.avgProcessingTime / 1000);
            this.metrics.currentThroughput = throughput;
            this.emit('metrics', this.metrics);
            if (throughput < 5000 && this.metrics.jobsProcessed > 0) {
                console.warn(`Throughput below target: ${throughput.toFixed(0)} rows/sec`);
            }
        }, 10000);
    }
    async health() {
        const queueHealth = await this.uploadQueue.getJobCounts();
        return {
            healthy: true,
            queues: {
                upload: queueHealth,
                processing: await this.processingQueue.getJobCounts(),
                validation: await this.validationQueue.getJobCounts(),
                notification: await this.notificationQueue.getJobCounts()
            },
            workers: {
                total: this.workers.size,
                available: this.workerPool.length,
                metrics: Array.from(this.workerMetrics.values())
            },
            performance: this.metrics
        };
    }
    async shutdown() {
        console.info('[Processor] Shutting down...');
        this.isShuttingDown = true;
        await this.uploadQueue.pause();
        await this.processingQueue.pause();
        await this.validationQueue.pause();
        await this.notificationQueue.pause();
        await this.uploadQueue.whenCurrentJobsFinished();
        await this.processingQueue.whenCurrentJobsFinished();
        for (const worker of this.workers.values()) {
            await worker.terminate();
        }
        await this.uploadQueue.close();
        await this.processingQueue.close();
        await this.validationQueue.close();
        await this.notificationQueue.close();
        this.emit('shutdown');
    }
}
exports.BulkUploadProcessor = BulkUploadProcessor;
exports.processor = new BulkUploadProcessor();
process.on('SIGTERM', async () => {
    await exports.processor.shutdown();
    process.exit(0);
});
process.on('SIGINT', async () => {
    await exports.processor.shutdown();
    process.exit(0);
});
exports.default = exports.processor;
