# Enterprise Bulk Upload Test Suite

Comprehensive test coverage for the enterprise-grade bulk upload system.

## Test Structure

```
test/
├── setup/              # Test environment setup
├── fixtures/           # Test data generators
├── unit/              # Unit tests for individual components
├── integration/       # System integration tests
├── e2e/               # End-to-end flow tests
└── performance/       # Performance benchmarks
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e          # End-to-end tests
npm run test:performance  # Performance benchmarks
npm run test:coverage     # With coverage report
npm run test:watch        # Watch mode for development
```

## Test Coverage

The test suite ensures:
- ✅ **Unit Tests**: Individual component functionality
  - Database configuration and pooling
  - Redis configuration and queuing
  - CSV processing and validation
  - Queue processor and worker threads
  
- ✅ **Integration Tests**: Component communication
  - API to Queue integration
  - Queue to Processor flow
  - Database transaction integrity
  - SSE progress updates
  
- ✅ **E2E Tests**: Complete upload flow
  - File upload to database
  - Error handling and recovery
  - Concurrent uploads
  - Data validation
  
- ✅ **Performance Tests**: System benchmarks
  - 5000+ rows/second throughput
  - 24,726 rows in under 30 seconds
  - Memory efficiency
  - Concurrent processing

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Throughput | 5000+ rows/sec | ✅ |
| 24.7K rows | < 30 seconds | ✅ |
| Memory increase | < 500MB for 50K rows | ✅ |
| Concurrent uploads | 5+ simultaneous | ✅ |
| Database queries | < 200ms | ✅ |

## Test Data

Test data generators create realistic CSV files:
- `generateCSV()`: Standard test files
- `generateLargeCSV()`: Performance testing
- `generateInvalidCSV()`: Validation testing

## Environment Setup

Tests run in isolated test environment:
- Database: `mangalm_test`
- Redis DB: 1 (separate from production)
- Automatic cleanup after tests

## Coverage Requirements

Minimum coverage thresholds:
- Branches: 70%
- Functions: 75%
- Lines: 80%
- Statements: 80%

## Test Database

Tests use a separate PostgreSQL database that is automatically:
- Created before tests
- Cleaned between test suites
- Destroyed after tests complete

## Prerequisites

1. PostgreSQL running on localhost:5432
2. Redis running on localhost:6379
3. Test database user with CREATE privileges
4. Node.js 18+ with npm 9+

## Troubleshooting

### Tests Failing
- Ensure PostgreSQL and Redis are running
- Check test database permissions
- Verify ports 5432 and 6379 are available

### Performance Tests Slow
- Close other applications
- Ensure sufficient RAM (8GB+ recommended)
- Check database indexes are created

### Coverage Not Meeting Thresholds
- Run `npm run test:coverage` to see detailed report
- Check `coverage/index.html` for line-by-line coverage
- Focus on untested error handling paths