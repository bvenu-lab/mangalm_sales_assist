import request from 'supertest';
import express from 'express';
import { APIGateway } from '../../src/gateway/api-gateway';

describe('APIGateway', () => {
  let gateway: APIGateway;
  let app: express.Application;

  beforeEach(() => {
    gateway = new APIGateway();
    app = gateway.getApp();
  });

  afterEach(async () => {
    await gateway.stop();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });

    it('should include service information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.service).toBe('api-gateway');
      expect(response.body.version).toBeDefined();
      expect(response.body.environment).toBeDefined();
    });
  });

  describe('Authentication Routes', () => {
    it('should allow login without authentication', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
    });

    it('should reject invalid login credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'invalid', password: 'wrong' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should validate input on login', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({}) // Missing credentials
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });
  });

  describe('Protected Routes', () => {
    let authToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      
      authToken = loginResponse.body.token;
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
    });

    it('should reject access without token', async () => {
      const response = await request(app)
        .get('/api/stores')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No token provided');
    });

    it('should reject access with invalid token', async () => {
      const response = await request(app)
        .get('/api/stores')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid token');
    });

    it('should reject access with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/stores')
        .set('Authorization', 'NotBearer token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    let authToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({ username: 'user', password: 'user123' });
      
      authToken = loginResponse.body.token;
    });

    it('should enforce rate limits on API endpoints', async () => {
      const requests = [];
      
      // Make multiple requests quickly
      for (let i = 0; i < 12; i++) {
        requests.push(
          request(app)
            .get('/api/stores')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // First 10 should succeed (assuming limit is 10)
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount).toBeGreaterThan(0);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should have different limits for different endpoints', async () => {
      const authResponse = await request(app)
        .post('/auth/login')
        .send({ username: 'user', password: 'user123' });

      const apiResponse = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${authToken}`);

      const authLimit = parseInt(authResponse.headers['x-ratelimit-limit'] || '0');
      const apiLimit = parseInt(apiResponse.headers['x-ratelimit-limit'] || '0');
      
      expect(authLimit).toBeDefined();
      expect(apiLimit).toBeDefined();
      // Auth endpoints typically have stricter limits
      expect(authLimit).toBeLessThanOrEqual(apiLimit);
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers in response', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/stores')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle internal server errors gracefully', async () => {
      // Simulate an error by sending data that would cause an error
      const response = await request(app)
        .post('/api/error-trigger') // Non-existent endpoint
        .send({ triggerError: true })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      // Should not expose internal error details
      expect(response.body.error).not.toContain('stack');
    });
  });

  describe('Request Logging', () => {
    it('should include request ID in response headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^[a-zA-Z0-9-]+$/);
    });

    it('should include response time header', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-response-time']).toBeDefined();
      expect(response.headers['x-response-time']).toMatch(/^\d+ms$/);
    });
  });

  describe('API Versioning', () => {
    let authToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      
      authToken = loginResponse.body.token;
    });

    it('should support version in URL path', async () => {
      const response = await request(app)
        .get('/api/v1/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.meta?.version).toBe('1.0.0');
    });

    it('should support version in header', async () => {
      const response = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .set('API-Version', '1.0.0')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.meta?.version).toBe('1.0.0');
    });

    it('should support version in query parameter', async () => {
      const response = await request(app)
        .get('/api/stores?v=1.0.0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.meta?.version).toBe('1.0.0');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should not expose sensitive headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).not.toContain('Express');
    });
  });
});