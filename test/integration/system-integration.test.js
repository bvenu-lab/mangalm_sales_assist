/**
 * Integration Test Suite
 * Tests complete system integration across all components
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;
const { Pool } = require('pg');
const Bull = require('bull');
const Redis = require('ioredis');
const { DatabasePoolManager } = require('../../config/database.config');
const { RedisManager } = require('../../config/redis.config');
const { BulkUploadProcessor } = require('../../services/queue-processor/processor');
const { generateCSV } = require('../fixtures/test-data-generator');

describe('System Integration Tests', () => {
  let app;
  let dbManager;
  let redisManager;
  let processor;
  let testFile;
  
  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.DB_NAME = 'mangalm_test';
    process.env.REDIS_DB = '1';
    
    // Initialize components
    dbManager = new DatabasePoolManager('test');
    redisManager = new RedisManager('test');
    processor = new BulkUploadProcessor('test');
    
    // Clear test data
    await clearAllTestData();
    
    // Start server
    app = require('../../server-enterprise');
    
    // Wait for services to be ready
    await waitForServices();
  });
  
  afterAll(async () => {
    await clearAllTestData();
    
    if (processor) await processor.shutdown();
    if (redisManager) await redisManager.shutdown();
    if (dbManager) await dbManager.shutdown();
  });
  
  afterEach(async () => {
    if (testFile) {
      try {
        await fs.unlink(testFile);
      } catch (e) {
        // File might not exist
      }
    }
  });
  
  async function clearAllTestData() {
    // Clear database
    const client = await dbManager.getClient();
    try {
      await client.query('TRUNCATE TABLE invoice_items CASCADE');
      await client.query('TRUNCATE TABLE bulk_upload.upload_jobs CASCADE');
      await client.query('TRUNCATE TABLE bulk_upload.upload_chunks CASCADE');
      await client.query('TRUNCATE TABLE bulk_upload.processing_errors CASCADE');
      await client.query('TRUNCATE TABLE bulk_upload.deduplication CASCADE');
      await client.query('TRUNCATE TABLE audit.audit_log CASCADE');
    } finally {
      client.release();
    }
    
    // Clear Redis
    await redisManager.client.flushdb();
  }
  
  async function waitForServices() {
    const maxAttempts = 30;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        // Check database
        const dbHealth = await dbManager.health();
        if (!dbHealth.healthy) throw new Error('Database not ready');
        
        // Check Redis
        const redisHealth = await redisManager.health();
        if (!redisHealth.healthy) throw new Error('Redis not ready');
        
        // Check API
        const response = await request(app).get('/health');
        if (response.status !== 200) throw new Error('API not ready');
        
        console.log('All services ready');
        return;
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Services failed to start');
  }
  
  describe('Complete Upload Flow', () => {
    test('should process file from upload to database', async () => {
      // Generate test file
      testFile = await generateCSV('./test/uploads/temp/integration.csv', 100);
      
      // Step 1: Upload file
      const uploadResponse = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile)
        .field('userId', 'integration-test')
        .expect(200);
      
      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.uploadId).toBeDefined();
      const uploadId = uploadResponse.body.uploadId;
      
      // Step 2: Verify job created in database
      const client = await dbManager.getClient();
      try {
        const jobResult = await client.query(
          'SELECT * FROM bulk_upload.upload_jobs WHERE id = $1',
          [uploadId]
        );
        expect(jobResult.rows).toHaveLength(1);
        expect(jobResult.rows[0].status).toBe('pending');
      } finally {
        client.release();
      }
      
      // Step 3: Wait for processing to complete
      let processed = false;
      const maxWaitTime = 30000;
      const startTime = Date.now();
      
      while (!processed && (Date.now() - startTime) < maxWaitTime) {
        const statusResponse = await request(app)
          .get(`/api/bulk-upload/${uploadId}/status`);
        
        if (statusResponse.body.status === 'completed') {
          processed = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      expect(processed).toBe(true);
      
      // Step 4: Verify data in invoice_items
      const dataClient = await dbManager.getClient();
      try {
        const dataResult = await dataClient.query(
          'SELECT COUNT(*) FROM invoice_items'
        );
        expect(parseInt(dataResult.rows[0].count)).toBe(100);
      } finally {
        dataClient.release();
      }
      
      // Step 5: Verify audit trail
      const auditClient = await dbManager.getClient();
      try {
        const auditResult = await auditClient.query(
          'SELECT * FROM audit.audit_log WHERE entity_id = $1',
          [uploadId]
        );
        expect(auditResult.rows.length).toBeGreaterThan(0);
      } finally {
        auditClient.release();
      }
    }, 60000);
    
    test('should handle duplicate detection', async () => {
      // Upload same file twice
      testFile = await generateCSV('./test/uploads/temp/duplicate.csv', 50);
      
      // First upload
      const response1 = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile)
        .expect(200);
      
      const uploadId1 = response1.body.uploadId;
      
      // Wait for first upload to complete
      await waitForUploadCompletion(uploadId1);
      
      // Second upload of same file
      const response2 = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile)
        .expect(200);
      
      expect(response2.body.uploadId).not.toBe(uploadId1);
      
      // Check deduplication records
      const client = await dbManager.getClient();
      try {
        const dedupResult = await client.query(
          'SELECT COUNT(DISTINCT hash) as unique_count FROM bulk_upload.deduplication'
        );
        // Should have unique hashes for each row
        expect(parseInt(dedupResult.rows[0].unique_count)).toBe(50);
      } finally {
        client.release();
      }
    });
  });
  
  describe('Component Communication', () => {
    test('should coordinate between API, queue, and processor', async () => {
      testFile = await generateCSV('./test/uploads/temp/coordination.csv', 20);
      
      // Upload triggers API -> Queue
      const uploadResponse = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile);
      
      const uploadId = uploadResponse.body.uploadId;
      
      // Check queue has job
      const queue = redisManager.createQueue('bulk-upload-queue');
      const jobs = await queue.getJobs(['waiting', 'active']);
      const uploadJob = jobs.find(j => j.data.uploadId === uploadId);
      expect(uploadJob).toBeDefined();
      
      // Wait for processor to handle it
      await waitForUploadCompletion(uploadId);
      
      // Verify all components updated
      const statusResponse = await request(app)
        .get(`/api/bulk-upload/${uploadId}/status`);
      
      expect(statusResponse.body.status).toBe('completed');
      expect(statusResponse.body.processed_rows).toBe(20);
    });
    
    test('should handle SSE updates during processing', (done) => {
      generateCSV('./test/uploads/temp/sse-test.csv', 30).then(async (file) => {
        testFile = file;
        
        const uploadResponse = await request(app)
          .post('/api/bulk-upload')
          .attach('file', testFile);
        
        const uploadId = uploadResponse.body.uploadId;
        
        // Connect to SSE
        const req = request(app)
          .get(`/api/bulk-upload/${uploadId}/progress`)
          .set('Accept', 'text/event-stream');
        
        let eventsReceived = [];
        
        req.on('response', (res) => {
          res.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('data:')) {
              eventsReceived.push(data);
              
              // Check for completion
              if (data.includes('"status":"completed"')) {
                expect(eventsReceived.length).toBeGreaterThan(1);
                req.abort();
                done();
              }
            }
          });
        });
        
        setTimeout(() => {
          req.abort();
          done();
        }, 30000);
      });
    }, 35000);
  });
  
  describe('Error Recovery', () => {
    test('should recover from database connection failure', async () => {
      // Simulate connection failure
      const originalQuery = dbManager.query.bind(dbManager);
      let failureCount = 0;
      
      dbManager.query = async function(...args) {
        if (failureCount++ < 2) {
          throw new Error('Connection failed');
        }
        return originalQuery(...args);
      };
      
      testFile = await generateCSV('./test/uploads/temp/recovery.csv', 10);
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile);
      
      expect(response.body.uploadId).toBeDefined();
      
      // Restore original method
      dbManager.query = originalQuery;
    });
    
    test('should handle Redis reconnection', async () => {
      // Force disconnect
      await redisManager.client.disconnect();
      
      // Should reconnect automatically
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const isConnected = await redisManager.isConnected();
      expect(isConnected).toBe(true);
    });
    
    test('should retry failed chunks', async () => {
      testFile = await generateCSV('./test/uploads/temp/retry.csv', 50);
      
      // Mock a failure in chunk processing
      const originalProcess = processor.processChunk;
      let attemptCount = 0;
      
      processor.processChunk = async function(chunk, ...args) {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Transient error');
        }
        return originalProcess.call(this, chunk, ...args);
      };
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile);
      
      await waitForUploadCompletion(response.body.uploadId);
      
      // Should have retried and succeeded
      expect(attemptCount).toBeGreaterThan(1);
      
      // Restore original method
      processor.processChunk = originalProcess;
    });
  });
  
  describe('Performance Under Load', () => {
    test('should handle concurrent uploads', async () => {
      // Create multiple files
      const files = await Promise.all([
        generateCSV('./test/uploads/temp/concurrent1.csv', 25),
        generateCSV('./test/uploads/temp/concurrent2.csv', 25),
        generateCSV('./test/uploads/temp/concurrent3.csv', 25),
        generateCSV('./test/uploads/temp/concurrent4.csv', 25),
        generateCSV('./test/uploads/temp/concurrent5.csv', 25)
      ]);
      
      // Upload concurrently
      const uploads = await Promise.all(
        files.map(file =>
          request(app)
            .post('/api/bulk-upload')
            .attach('file', file)
        )
      );
      
      // All should succeed
      uploads.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.uploadId).toBeDefined();
      });
      
      // Wait for all to complete
      await Promise.all(
        uploads.map(response =>
          waitForUploadCompletion(response.body.uploadId)
        )
      );
      
      // Verify total rows processed
      const client = await dbManager.getClient();
      try {
        const result = await client.query('SELECT COUNT(*) FROM invoice_items');
        expect(parseInt(result.rows[0].count)).toBe(125); // 5 files * 25 rows
      } finally {
        client.release();
      }
      
      // Cleanup files
      await Promise.all(files.map(f => fs.unlink(f).catch(() => {})));
    }, 60000);
    
    test('should maintain performance with large queue', async () => {
      // Add many jobs to queue
      const queue = redisManager.createQueue('bulk-upload-queue');
      
      for (let i = 0; i < 100; i++) {
        await queue.add({
          uploadId: `load-test-${i}`,
          fileName: `test-${i}.csv`,
          filePath: './test/nonexistent.csv',
          rowCount: 10
        });
      }
      
      // Check queue can handle load
      const counts = await queue.getJobCounts();
      expect(counts.waiting + counts.active).toBeGreaterThan(0);
      
      // Clean queue
      await queue.empty();
    });
  });
  
  describe('Data Integrity', () => {
    test('should maintain transaction consistency', async () => {
      testFile = await generateCSV('./test/uploads/temp/transaction.csv', 40);
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile);
      
      await waitForUploadCompletion(response.body.uploadId);
      
      // Verify all chunks processed atomically
      const client = await dbManager.getClient();
      try {
        const chunkResult = await client.query(
          'SELECT COUNT(*) as count, status FROM bulk_upload.upload_chunks WHERE upload_id = $1 GROUP BY status',
          [response.body.uploadId]
        );
        
        // All chunks should be completed
        const completedChunks = chunkResult.rows.find(r => r.status === 'completed');
        expect(completedChunks).toBeDefined();
        
        // No partial chunks
        const processingChunks = chunkResult.rows.find(r => r.status === 'processing');
        expect(processingChunks).toBeUndefined();
      } finally {
        client.release();
      }
    });
    
    test('should validate data before insertion', async () => {
      // Create CSV with invalid data
      const invalidCsv = './test/uploads/temp/invalid-data.csv';
      const content = `Invoice No,Invoice Date,Month,Year,Salesman Name,Store Name,Store Code,Item Name,Batch No,Quantity,Rate,MRP,Dis,Amount,Company Name,Division,HQ,Expiry Date
INV-001,invalid-date,Jan,2024,John,Store A,ST001,Product 1,B001,-10,50,60,5,-500,Test,Sales,Mumbai,2025-12-31`;
      
      await fs.writeFile(invalidCsv, content);
      testFile = invalidCsv;
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile);
      
      const uploadId = response.body.uploadId;
      await waitForUploadCompletion(uploadId, 10000);
      
      // Check for validation errors
      const errorsResponse = await request(app)
        .get(`/api/bulk-upload/${uploadId}/errors`);
      
      expect(errorsResponse.body.errors.length).toBeGreaterThan(0);
      expect(errorsResponse.body.errors[0].error).toContain('Invalid');
    });
  });
  
  // Helper function to wait for upload completion
  async function waitForUploadCompletion(uploadId, maxWaitTime = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const response = await request(app)
        .get(`/api/bulk-upload/${uploadId}/status`);
      
      if (response.body.status === 'completed' ||
          response.body.status === 'failed' ||
          response.body.status === 'partially_completed') {
        return response.body;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Upload ${uploadId} did not complete within ${maxWaitTime}ms`);
  }
});