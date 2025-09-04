/**
 * Mock Setup for Unit Tests
 * Mocks external dependencies to isolate unit tests
 */

// Mock Redis/IORedis
jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    quit: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
    rpush: jest.fn().mockResolvedValue(1),
    lpop: jest.fn().mockResolvedValue(null),
    llen: jest.fn().mockResolvedValue(0),
    lrange: jest.fn().mockResolvedValue([]),
    setex: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG'),
    info: jest.fn().mockResolvedValue('redis_version:7.0.0'),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn()
  }));
  
  return RedisMock;
});

// Mock Bull Queue
jest.mock('bull', () => {
  const QueueMock = jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-1', data: {} }),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(),
    pause: jest.fn().mockResolvedValue(),
    resume: jest.fn().mockResolvedValue(),
    empty: jest.fn().mockResolvedValue(),
    getJobs: jest.fn().mockResolvedValue([]),
    getJob: jest.fn().mockResolvedValue(null),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    }),
    clean: jest.fn().mockResolvedValue([])
  }));
  
  return QueueMock;
});

// Mock worker_threads
jest.mock('worker_threads', () => ({
  Worker: jest.fn().mockImplementation(function(script) {
    this.postMessage = jest.fn();
    this.on = jest.fn();
    this.once = jest.fn();
    this.terminate = jest.fn().mockResolvedValue();
    this.removeAllListeners = jest.fn();
  }),
  isMainThread: true,
  parentPort: null
}));

// Mock file system for tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn().mockImplementation(() => {
    const { Readable } = require('stream');
    const stream = new Readable();
    stream._read = () => {};
    stream.push('test data\n');
    stream.push(null);
    return stream;
  }),
  createWriteStream: jest.fn().mockImplementation(() => {
    const { Writable } = require('stream');
    const stream = new Writable();
    stream._write = (chunk, encoding, callback) => callback();
    return stream;
  })
}));

// Disable console output in tests unless explicitly needed
if (process.env.SHOW_LOGS !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'mangalm_test';
process.env.REDIS_DB = '1';

// Global test timeout
jest.setTimeout(10000);