import request from 'supertest';
import express from 'express';
import { predictionRouter } from '../../src/routes/prediction-routes';

describe('Prediction Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/predictions', predictionRouter);
  });

  describe('POST /api/predictions/generate', () => {
    it('should generate prediction for a single store', async () => {
      const response = await request(app)
        .post('/api/predictions/generate')
        .send({ storeId: 'store-123' })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.storeId).toBe('store-123');
      expect(response.body.data.predictions).toBeDefined();
    });

    it('should validate storeId is provided', async () => {
      const response = await request(app)
        .post('/api/predictions/generate')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('storeId');
    });

    it('should handle prediction generation errors gracefully', async () => {
      const response = await request(app)
        .post('/api/predictions/generate')
        .send({ storeId: 'error-trigger' }) // Special ID to trigger error in mock
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/predictions/batch', () => {
    it('should generate batch predictions', async () => {
      const storeIds = ['store-1', 'store-2', 'store-3'];
      
      const response = await request(app)
        .post('/api/predictions/batch')
        .send({ storeIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(3);
    });

    it('should validate storeIds array', async () => {
      const response = await request(app)
        .post('/api/predictions/batch')
        .send({ storeIds: 'not-an-array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('array');
    });

    it('should handle empty array', async () => {
      const response = await request(app)
        .post('/api/predictions/batch')
        .send({ storeIds: [] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should limit batch size', async () => {
      const storeIds = Array.from({ length: 101 }, (_, i) => `store-${i}`);
      
      const response = await request(app)
        .post('/api/predictions/batch')
        .send({ storeIds })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('limit');
    });
  });

  describe('GET /api/predictions/history/:storeId', () => {
    it('should return prediction history for a store', async () => {
      const response = await request(app)
        .get('/api/predictions/history/store-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support date range filtering', async () => {
      const response = await request(app)
        .get('/api/predictions/history/store-123')
        .query({ 
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should validate date format', async () => {
      const response = await request(app)
        .get('/api/predictions/history/store-123')
        .query({ startDate: 'invalid-date' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('date');
    });
  });

  describe('GET /api/predictions/metrics', () => {
    it('should return model metrics', async () => {
      const response = await request(app)
        .get('/api/predictions/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.accuracy).toBeDefined();
      expect(response.body.data.precision).toBeDefined();
      expect(response.body.data.recall).toBeDefined();
      expect(response.body.data.f1Score).toBeDefined();
    });

    it('should include cache headers', async () => {
      const response = await request(app)
        .get('/api/predictions/metrics')
        .expect(200);

      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['cache-control']).toContain('max-age');
    });
  });

  describe('POST /api/predictions/train', () => {
    it('should trigger model training', async () => {
      const trainingConfig = {
        algorithm: 'random-forest',
        parameters: {
          n_estimators: 100,
          max_depth: 10,
        },
      };

      const response = await request(app)
        .post('/api/predictions/train')
        .send(trainingConfig)
        .expect(202); // Accepted for async processing

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
      expect(response.body.data.status).toBe('training_started');
    });

    it('should validate training configuration', async () => {
      const response = await request(app)
        .post('/api/predictions/train')
        .send({ algorithm: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('algorithm');
    });
  });

  describe('GET /api/predictions/status/:jobId', () => {
    it('should return training job status', async () => {
      const response = await request(app)
        .get('/api/predictions/status/job-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe('job-123');
      expect(response.body.data.status).toBeDefined();
      expect(['pending', 'running', 'completed', 'failed']).toContain(response.body.data.status);
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/predictions/status/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/predictions/feedback', () => {
    it('should accept prediction feedback', async () => {
      const feedback = {
        predictionId: 'pred-123',
        storeId: 'store-123',
        actualQuantity: 15,
        predictedQuantity: 12,
        productId: 'prod-456',
      };

      const response = await request(app)
        .post('/api/predictions/feedback')
        .send(feedback)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.processed).toBe(true);
    });

    it('should validate feedback data', async () => {
      const response = await request(app)
        .post('/api/predictions/feedback')
        .send({ predictionId: 'pred-123' }) // Missing required fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/predictions/export', () => {
    it('should export model configuration', async () => {
      const response = await request(app)
        .get('/api/predictions/export')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBeDefined();
      expect(response.body.data.algorithm).toBeDefined();
      expect(response.body.data.parameters).toBeDefined();
    });

    it('should support different export formats', async () => {
      const response = await request(app)
        .get('/api/predictions/export')
        .query({ format: 'onnx' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.format).toBe('onnx');
    });
  });

  describe('POST /api/predictions/import', () => {
    it('should import model configuration', async () => {
      const modelData = {
        version: '1.0.0',
        algorithm: 'gradient-boosting',
        parameters: {
          learning_rate: 0.1,
          n_estimators: 200,
        },
      };

      const response = await request(app)
        .post('/api/predictions/import')
        .send(modelData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(true);
    });

    it('should validate model data before import', async () => {
      const response = await request(app)
        .post('/api/predictions/import')
        .send({ version: '1.0.0' }) // Missing required fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});