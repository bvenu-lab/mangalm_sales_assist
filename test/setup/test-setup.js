/**
 * Test Setup and Configuration
 * Ensures test environment is properly configured
 */

const path = require('path');
const fs = require('fs').promises;

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'mangalm_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.UPLOAD_TEMP_DIR = './test/uploads/temp';
process.env.UPLOAD_BATCH_SIZE = '100';
process.env.FEATURE_DEDUPLICATION = 'true';

// Create test directories
async function setupTestDirectories() {
  const dirs = [
    './test/uploads/temp',
    './test/uploads/processed',
    './test/uploads/failed',
    './test/fixtures'
  ];
  
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Clean up test files
async function cleanupTestFiles() {
  const dirs = [
    './test/uploads/temp',
    './test/uploads/processed',
    './test/uploads/failed'
  ];
  
  for (const dir of dirs) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        await fs.unlink(path.join(dir, file));
      }
    } catch (error) {
      // Directory might not exist
    }
  }
}

// Mock console for cleaner test output
function mockConsole() {
  const originalConsole = { ...console };
  
  if (process.env.SHOW_LOGS !== 'true') {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.debug = jest.fn();
  }
  
  return originalConsole;
}

module.exports = {
  setupTestDirectories,
  cleanupTestFiles,
  mockConsole
};