// Test setup for API Gateway
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.PORT = '0'; // Use random port for tests

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers for rate limiting tests
jest.useFakeTimers();

// Clean up after tests
afterAll(async () => {
  jest.clearAllTimers();
  jest.useRealTimers();
  await new Promise(resolve => setTimeout(resolve, 500));
});