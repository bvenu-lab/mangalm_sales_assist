/**
 * Jest Configuration for Enterprise Bulk Upload Testing
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/test/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  
  // Coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    'services/**/*.js',
    'config/**/*.js',
    'server*.js',
    '!**/node_modules/**',
    '!**/test/**',
    '!**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },
  
  // Setup files  
  setupFiles: ['./test/setup/mock-setup.js'],
  
  // Test timeouts
  testTimeout: 30000,
  
  // Module paths
  moduleDirectories: ['node_modules', 'services', 'config'],
  
  // Transform files
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Mock files
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  
  // Verbose output
  verbose: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Max worker threads
  maxWorkers: '50%',
  
  // Test suites
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['**/test/unit/**/*.test.js']
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['**/test/integration/**/*.test.js']
    },
    {
      displayName: 'E2E Tests',
      testMatch: ['**/test/e2e/**/*.test.js']
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['**/test/performance/**/*.test.js']
    }
  ]
};