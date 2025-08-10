import { logger } from '../../src/utils/logger';

describe('Logger', () => {
  test('logger instance exists', () => {
    expect(logger).toBeDefined();
  });

  test('has info method', () => {
    expect(typeof logger.info).toBe('function');
  });

  test('has error method', () => {
    expect(typeof logger.error).toBe('function');
  });

  test('has warn method', () => {
    expect(typeof logger.warn).toBe('function');
  });

  test('has debug method', () => {
    expect(typeof logger.debug).toBe('function');
  });

  test('can log info message', () => {
    expect(() => logger.info('Test info message')).not.toThrow();
  });

  test('can log error message', () => {
    expect(() => logger.error('Test error message')).not.toThrow();
  });

  test('can log warn message', () => {
    expect(() => logger.warn('Test warning message')).not.toThrow();
  });
});