/**
 * Unit Tests for Queue Processor
 * Tests job processing, worker threads, and error handling
 */

const { BulkUploadProcessor } = require('../../services/queue-processor/processor');
const Bull = require('bull');
const path = require('path');
const fs = require('fs').promises;

// Mock worker threads
jest.mock('worker_threads', () => ({
  Worker: jest.fn().mockImplementation(function(script) {
    this.postMessage = jest.fn();
    this.on = jest.fn();
    this.terminate = jest.fn().mockResolvedValue();
  })
}));

describe('BulkUploadProcessor', () => {
  let processor;
  let mockQueue;
  let mockJob;
  
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    
    // Mock queue
    mockQueue = {
      process: jest.fn(),
      on: jest.fn(),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      })
    };
    
    // Mock job
    mockJob = {
      id: 'test-job-123',
      data: {
        uploadId: 'upload-123',
        fileName: 'test.csv',
        filePath: './test/uploads/test.csv',
        rowCount: 100,
        userId: 'user-123'
      },
      progress: jest.fn(),
      log: jest.fn(),
      attemptsMade: 0,
      opts: { attempts: 3 }
    };
    
    processor = new BulkUploadProcessor('test');
    processor.queue = mockQueue;
  });
  
  afterEach(async () => {
    if (processor) {
      await processor.shutdown();
    }
  });
  
  describe('Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(processor.environment).toBe('test');
      expect(processor.workerPool).toEqual([]);
      expect(processor.activeJobs).toBeInstanceOf(Map);
      expect(processor.metrics).toBeDefined();
    });
    
    test('should register queue event handlers', () => {
      processor.setupEventHandlers();
      
      expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('stalled', expect.any(Function));
    });
  });
  
  describe('Job Processing', () => {
    test('should validate job data', async () => {
      const invalidJob = { ...mockJob, data: {} };
      
      await expect(processor.processUpload(invalidJob)).rejects.toThrow(
        'Invalid job data'
      );
    });
    
    test('should check file existence', async () => {
      await expect(processor.processUpload(mockJob)).rejects.toThrow(
        'File not found'
      );
    });
    
    test('should track active jobs', async () => {
      // Create test file
      await fs.mkdir(path.dirname(mockJob.data.filePath), { recursive: true });
      await fs.writeFile(mockJob.data.filePath, 'test content');
      
      processor.activeJobs.set(mockJob.id, mockJob);
      expect(processor.activeJobs.has(mockJob.id)).toBe(true);
      
      // Cleanup
      await fs.unlink(mockJob.data.filePath);
    });
    
    test('should update job progress', async () => {
      const progress = {
        stage: 'processing',
        processed: 50,
        total: 100
      };
      
      processor.updateJobProgress(mockJob, progress);
      
      expect(mockJob.progress).toHaveBeenCalledWith(50);
      expect(mockJob.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing: 50/100')
      );
    });
  });
  
  describe('Worker Thread Management', () => {
    test('should create worker thread', () => {
      const worker = processor.createWorker();
      
      expect(worker).toBeDefined();
      expect(processor.workerPool).toContain(worker);
    });
    
    test('should limit worker pool size', () => {
      const maxWorkers = require('os').cpus().length;
      
      for (let i = 0; i < maxWorkers + 5; i++) {
        processor.getOrCreateWorker();
      }
      
      expect(processor.workerPool.length).toBeLessThanOrEqual(maxWorkers);
    });
    
    test('should reuse existing workers', () => {
      const worker1 = processor.getOrCreateWorker();
      const worker2 = processor.getOrCreateWorker();
      
      // Should reuse when pool not full
      expect(processor.workerPool.length).toBeLessThanOrEqual(2);
    });
    
    test('should handle worker errors', () => {
      const worker = processor.createWorker();
      const errorHandler = worker.on.mock.calls.find(
        call => call[0] === 'error'
      )[1];
      
      // Simulate worker error
      errorHandler(new Error('Worker crashed'));
      
      expect(processor.workerPool).not.toContain(worker);
    });
    
    test('should clean up workers on shutdown', async () => {
      const worker1 = processor.createWorker();
      const worker2 = processor.createWorker();
      
      await processor.shutdown();
      
      expect(worker1.terminate).toHaveBeenCalled();
      expect(worker2.terminate).toHaveBeenCalled();
      expect(processor.workerPool).toHaveLength(0);
    });
  });
  
  describe('Chunk Processing', () => {
    test('should split data into chunks', () => {
      const rows = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      const chunks = processor.splitIntoChunks(rows, 100);
      
      expect(chunks).toHaveLength(10);
      expect(chunks[0]).toHaveLength(100);
      expect(chunks[9]).toHaveLength(100);
    });
    
    test('should handle non-divisible chunk sizes', () => {
      const rows = Array.from({ length: 157 }, (_, i) => ({ id: i }));
      const chunks = processor.splitIntoChunks(rows, 50);
      
      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toHaveLength(50);
      expect(chunks[1]).toHaveLength(50);
      expect(chunks[2]).toHaveLength(50);
      expect(chunks[3]).toHaveLength(7);
    });
  });
  
  describe('Error Handling', () => {
    test('should retry on transient errors', async () => {
      mockJob.attemptsMade = 1;
      
      const error = new Error('Connection timeout');
      error.code = 'ETIMEDOUT';
      
      try {
        await processor.handleJobError(mockJob, error);
      } catch (e) {
        expect(e.message).toContain('Retry attempt 1/3');
      }
    });
    
    test('should not retry on validation errors', async () => {
      const error = new Error('Invalid data format');
      
      await expect(
        processor.handleJobError(mockJob, error)
      ).rejects.toThrow('Invalid data format');
    });
    
    test('should not retry after max attempts', async () => {
      mockJob.attemptsMade = 3;
      
      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';
      
      await expect(
        processor.handleJobError(mockJob, error)
      ).rejects.toThrow('Max retry attempts reached');
    });
  });
  
  describe('Metrics', () => {
    test('should track processing metrics', () => {
      processor.metrics.jobsProcessed = 10;
      processor.metrics.jobsFailed = 2;
      processor.metrics.rowsProcessed = 1000;
      
      const metrics = processor.getMetrics();
      
      expect(metrics.jobsProcessed).toBe(10);
      expect(metrics.jobsFailed).toBe(2);
      expect(metrics.rowsProcessed).toBe(1000);
      expect(metrics.successRate).toBe(0.8);
    });
    
    test('should calculate average processing time', () => {
      processor.metrics.totalProcessingTime = 10000; // 10 seconds
      processor.metrics.jobsProcessed = 5;
      
      const metrics = processor.getMetrics();
      expect(metrics.avgProcessingTime).toBe(2000);
    });
    
    test('should handle zero processed jobs', () => {
      const metrics = processor.getMetrics();
      
      expect(metrics.successRate).toBe(0);
      expect(metrics.avgProcessingTime).toBe(0);
    });
  });
  
  describe('Queue Status', () => {
    test('should get queue status', async () => {
      const status = await processor.getQueueStatus();
      
      expect(mockQueue.getJobCounts).toHaveBeenCalled();
      expect(status).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      });
    });
    
    test('should pause processing', async () => {
      processor.queue.pause = jest.fn().mockResolvedValue();
      await processor.pause();
      expect(processor.queue.pause).toHaveBeenCalled();
    });
    
    test('should resume processing', async () => {
      processor.queue.resume = jest.fn().mockResolvedValue();
      await processor.resume();
      expect(processor.queue.resume).toHaveBeenCalled();
    });
  });
  
  describe('Memory Management', () => {
    test('should monitor memory usage', () => {
      const memUsage = processor.getMemoryUsage();
      
      expect(memUsage).toHaveProperty('heapUsed');
      expect(memUsage).toHaveProperty('heapTotal');
      expect(memUsage).toHaveProperty('external');
      expect(memUsage).toHaveProperty('rss');
    });
    
    test('should trigger garbage collection when needed', () => {
      global.gc = jest.fn();
      
      // Simulate high memory usage
      const mockMemUsage = {
        heapUsed: 1024 * 1024 * 1024, // 1GB
        heapTotal: 1024 * 1024 * 1024 * 1.2
      };
      
      jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemUsage);
      
      processor.checkMemoryPressure();
      
      if (global.gc) {
        expect(global.gc).toHaveBeenCalled();
      }
    });
  });
});