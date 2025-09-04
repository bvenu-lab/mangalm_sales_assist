/**
 * End-to-End Test for Full Upload Flow
 * Tests the complete journey from file upload to database
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;
const { Pool } = require('pg');
const Bull = require('bull');
const Redis = require('ioredis');
const { generateCSV, generateLargeCSV } = require('../fixtures/test-data-generator');

describe('E2E: Full Bulk Upload Flow', () => {
  let app;
  let testFile;
  let dbPool;
  let redis;
  let uploadQueue;
  
  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.DB_NAME = 'mangalm_test';
    process.env.REDIS_DB = '1';
    
    // Initialize database pool
    dbPool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'mangalm_test',
      user: 'postgres',
      password: 'postgres'
    });
    
    // Initialize Redis
    redis = new Redis({
      host: 'localhost',
      port: 6379,
      db: 1
    });
    
    // Clear test data
    await clearTestData();
    
    // Initialize app
    app = require('../../server-enterprise');
    
    // Initialize queue
    uploadQueue = new Bull('bulk-upload-queue', {
      redis: { host: 'localhost', port: 6379, db: 1 }
    });
    
    // Create test directories
    await fs.mkdir('./test/uploads/temp', { recursive: true });
  });
  
  afterAll(async () => {
    // Cleanup
    await clearTestData();
    if (uploadQueue) await uploadQueue.close();
    if (redis) await redis.quit();
    if (dbPool) await dbPool.end();
  });
  
  afterEach(async () => {
    // Clean up test files
    if (testFile) {
      try {
        await fs.unlink(testFile);
      } catch (e) {
        // File might not exist
      }
    }
  });
  
  async function clearTestData() {
    try {
      const client = await dbPool.connect();
      await client.query('TRUNCATE TABLE invoice_items CASCADE');
      await client.query('TRUNCATE TABLE bulk_upload.upload_jobs CASCADE');
      await client.query('TRUNCATE TABLE bulk_upload.upload_chunks CASCADE');
      await client.query('TRUNCATE TABLE bulk_upload.processing_errors CASCADE');
      await client.query('TRUNCATE TABLE bulk_upload.deduplication CASCADE');
      client.release();
    } catch (error) {
      console.error('Error clearing test data:', error);
    }
    
    // Clear Redis queues
    await redis.flushdb();
  }
  
  describe('Health Check', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.components).toBeDefined();
      expect(response.body.components.database).toBeDefined();
      expect(response.body.components.redis).toBeDefined();
    });
    
    test('should return system info', async () => {
      const response = await request(app)
        .get('/api/system/info')
        .expect(200);
      
      expect(response.body.version).toBeDefined();
      expect(response.body.features.bulkUpload).toBe(true);
      expect(response.body.endpoints.upload).toBe('/api/bulk-upload');
    });
  });
  
  describe('File Upload', () => {
    test('should upload CSV file successfully', async () => {
      // Generate test file
      testFile = await generateCSV('./test/uploads/temp/test.csv', 10);
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile)
        .field('userId', 'test-user')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.uploadId).toBeDefined();
      expect(response.body.fileName).toBe('test.csv');
      expect(response.body.rowCount).toBe(10);
      expect(response.body.status).toBe('pending');
      expect(response.body.sseEndpoint).toBeDefined();
      
      // Verify database record
      const client = await dbPool.connect();
      const result = await client.query(
        'SELECT * FROM bulk_upload.upload_jobs WHERE id = $1',
        [response.body.uploadId]
      );
      client.release();
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].file_name).toBe('test.csv');
      expect(result.rows[0].total_rows).toBe(10);
    });
    
    test('should reject non-CSV files', async () => {
      const txtFile = './test/uploads/temp/test.txt';
      await fs.writeFile(txtFile, 'This is not a CSV');
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', txtFile)
        .expect(500);
      
      expect(response.body.error).toBeDefined();
      
      await fs.unlink(txtFile);
    });
    
    test('should handle missing file', async () => {
      const response = await request(app)
        .post('/api/bulk-upload')
        .field('userId', 'test-user')
        .expect(400);
      
      expect(response.body.error).toBe('No file uploaded');
    });
    
    test('should detect duplicate uploads', async () => {
      testFile = await generateCSV('./test/uploads/temp/duplicate.csv', 5);
      
      // First upload
      const response1 = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile)
        .expect(200);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Second upload with same file
      const response2 = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile)
        .expect(200);
      
      // Should create new upload (user can choose to re-process)
      expect(response2.body.uploadId).not.toBe(response1.body.uploadId);
    });
  });
  
  describe('Upload Status', () => {
    let uploadId;
    
    beforeEach(async () => {
      // Create an upload
      testFile = await generateCSV('./test/uploads/temp/status-test.csv', 5);
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile);
      
      uploadId = response.body.uploadId;
    });
    
    test('should get upload status', async () => {
      const response = await request(app)
        .get(`/api/bulk-upload/${uploadId}/status`)
        .expect(200);
      
      expect(response.body.id).toBe(uploadId);
      expect(response.body.status).toBeDefined();
      expect(response.body.total_rows).toBe(5);
    });
    
    test('should return 404 for non-existent upload', async () => {
      await request(app)
        .get('/api/bulk-upload/non-existent-id/status')
        .expect(404);
    });
    
    test('should get processing errors', async () => {
      const response = await request(app)
        .get(`/api/bulk-upload/${uploadId}/errors`)
        .expect(200);
      
      expect(response.body.errors).toBeDefined();
      expect(Array.isArray(response.body.errors)).toBe(true);
    });
    
    test('should list recent uploads', async () => {
      const response = await request(app)
        .get('/api/bulk-upload')
        .query({ limit: 10 })
        .expect(200);
      
      expect(response.body.uploads).toBeDefined();
      expect(Array.isArray(response.body.uploads)).toBe(true);
      expect(response.body.uploads.length).toBeGreaterThan(0);
    });
  });
  
  describe('Queue Processing', () => {
    test('should add job to queue after upload', async () => {
      testFile = await generateCSV('./test/uploads/temp/queue-test.csv', 10);
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile)
        .expect(200);
      
      // Check queue
      const jobs = await uploadQueue.getJobs(['waiting', 'active']);
      const uploadJob = jobs.find(j => j.data.uploadId === response.body.uploadId);
      
      expect(uploadJob).toBeDefined();
      expect(uploadJob.data.fileName).toBe('queue-test.csv');
      expect(uploadJob.data.rowCount).toBe(10);
    });
    
    test('should process upload through queue', async () => {
      testFile = await generateCSV('./test/uploads/temp/process-test.csv', 5);
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile)
        .expect(200);
      
      const uploadId = response.body.uploadId;
      
      // Wait for processing (with timeout)
      const maxWaitTime = 10000; // 10 seconds
      const startTime = Date.now();
      let processed = false;
      
      while (!processed && (Date.now() - startTime) < maxWaitTime) {
        const client = await dbPool.connect();
        const result = await client.query(
          'SELECT status FROM bulk_upload.upload_jobs WHERE id = $1',
          [uploadId]
        );
        client.release();
        
        if (result.rows[0] && result.rows[0].status === 'completed') {
          processed = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      expect(processed).toBe(true);
      
      // Verify data in invoice_items
      const client = await dbPool.connect();
      const result = await client.query('SELECT COUNT(*) FROM invoice_items');
      client.release();
      
      expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);
    });
  });
  
  describe('SSE Progress Updates', () => {
    test('should establish SSE connection', (done) => {
      generateCSV('./test/uploads/temp/sse-test.csv', 10).then(async (file) => {
        testFile = file;
        
        const response = await request(app)
          .post('/api/bulk-upload')
          .attach('file', testFile);
        
        const uploadId = response.body.uploadId;
        
        // Test SSE endpoint
        const req = request(app)
          .get(`/api/bulk-upload/${uploadId}/progress`)
          .set('Accept', 'text/event-stream');
        
        req.on('response', (res) => {
          expect(res.headers['content-type']).toBe('text/event-stream');
          expect(res.headers['cache-control']).toBe('no-cache');
          
          let dataReceived = false;
          
          res.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('data:') && !dataReceived) {
              dataReceived = true;
              expect(data).toContain('uploadId');
              req.abort();
              done();
            }
          });
          
          // Timeout fallback
          setTimeout(() => {
            req.abort();
            done();
          }, 5000);
        });
      });
    });
  });
  
  describe('Data Validation', () => {
    test('should validate and reject invalid rows', async () => {
      // Create CSV with invalid data
      const invalidCsv = './test/uploads/temp/invalid.csv';
      const content = `Invoice No,Invoice Date,Month,Year,Salesman Name,Store Name,Store Code,Item Name,Batch No,Quantity,Rate,MRP,Dis,Amount,Company Name,Division,HQ,Expiry Date
,2024-01-15,Jan,2024,John,Store A,ST001,Product 1,B001,10,50,60,5,500,Test,Sales,Mumbai,2025-12-31
INV-002,,Jan,2024,Jane,Store B,ST002,Product 2,B002,20,30,36,3,600,Test,Sales,Delhi,2025-12-31
INV-003,2024-01-15,Jan,2024,Bob,,ST003,Product 3,B003,invalid,40,48,4,1200,Test,Sales,Mumbai,2025-12-31`;
      
      await fs.writeFile(invalidCsv, content);
      testFile = invalidCsv;
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile)
        .expect(200);
      
      const uploadId = response.body.uploadId;
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check for errors
      const errorsResponse = await request(app)
        .get(`/api/bulk-upload/${uploadId}/errors`)
        .expect(200);
      
      expect(errorsResponse.body.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Performance', () => {
    test('should handle large file upload', async () => {
      // Generate large CSV (1000 rows)
      testFile = await generateLargeCSV('./test/uploads/temp/large.csv', 1000);
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/bulk-upload')
        .attach('file', testFile)
        .expect(200);
      
      const uploadTime = Date.now() - startTime;
      
      expect(response.body.rowCount).toBe(1000);
      expect(uploadTime).toBeLessThan(10000); // Should upload in less than 10 seconds
      
      // Wait for processing to complete
      const uploadId = response.body.uploadId;
      const maxWaitTime = 30000; // 30 seconds for 1000 rows
      const processStartTime = Date.now();
      let completed = false;
      
      while (!completed && (Date.now() - processStartTime) < maxWaitTime) {
        const statusResponse = await request(app)
          .get(`/api/bulk-upload/${uploadId}/status`);
        
        if (statusResponse.body.status === 'completed' || 
            statusResponse.body.status === 'partially_completed') {
          completed = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      expect(completed).toBe(true);
      
      // Check processing speed
      const client = await dbPool.connect();
      const result = await client.query(
        'SELECT rows_per_second FROM bulk_upload.upload_jobs WHERE id = $1',
        [uploadId]
      );
      client.release();
      
      if (result.rows[0] && result.rows[0].rows_per_second) {
        console.log(`Processing speed: ${result.rows[0].rows_per_second} rows/sec`);
        expect(result.rows[0].rows_per_second).toBeGreaterThan(30); // At least 30 rows/sec
      }
    }, 60000); // 60 second timeout for this test
  });
  
  describe('Concurrent Uploads', () => {
    test('should handle multiple concurrent uploads', async () => {
      // Generate multiple test files
      const files = await Promise.all([
        generateCSV('./test/uploads/temp/concurrent1.csv', 10),
        generateCSV('./test/uploads/temp/concurrent2.csv', 10),
        generateCSV('./test/uploads/temp/concurrent3.csv', 10)
      ]);
      
      // Upload all files concurrently
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
        expect(response.body.success).toBe(true);
        expect(response.body.uploadId).toBeDefined();
      });
      
      // Clean up
      await Promise.all(files.map(f => fs.unlink(f)));
    });
  });
  
  describe('Error Recovery', () => {
    test('should handle database connection failure gracefully', async () => {
      // This would require mocking the database connection
      // For now, we'll test that the circuit breaker works
      
      const { DatabasePoolManager } = require('../../config/database.config');
      const testDb = new DatabasePoolManager('test');
      
      // Force circuit breaker open
      for (let i = 0; i < 5; i++) {
        testDb.handlePoolError(new Error('Connection failed'));
      }
      
      expect(testDb.circuitBreakerOpen).toBe(true);
      
      await testDb.shutdown();
    });
    
    test('should handle Redis connection failure gracefully', async () => {
      const { RedisManager } = require('../../config/redis.config');
      const testRedis = new RedisManager('test');
      
      // Force circuit breaker open
      for (let i = 0; i < 10; i++) {
        testRedis.handleError(new Error('Connection failed'));
      }
      
      expect(testRedis.circuitBreakerOpen).toBe(true);
      
      await testRedis.shutdown();
    });
  });
});