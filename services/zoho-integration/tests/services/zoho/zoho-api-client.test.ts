import { ZohoApiClient } from '../../../src/services/zoho/zoho-api-client';
import { logger } from '../../../src/utils/logger';

// Mock logger to avoid actual logging during tests
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ZohoApiClient', () => {
  const mockConfig = {
    apiDomain: 'https://www.zohoapis.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    refreshToken: 'test-refresh-token',
    redirectUri: 'https://example.com/callback'
  };

  let apiClient: ZohoApiClient;

  beforeEach(() => {
    apiClient = new ZohoApiClient(mockConfig, logger);
  });

  describe('constructor', () => {
    test('creates ZohoApiClient instance', () => {
      expect(apiClient).toBeInstanceOf(ZohoApiClient);
    });
  });

  describe('API methods', () => {
    test('getRecords method exists', () => {
      expect(typeof apiClient.getRecords).toBe('function');
    });

    test('createRecord method exists', () => {
      expect(typeof apiClient.createRecord).toBe('function');
    });

    test('updateRecord method exists', () => {
      expect(typeof apiClient.updateRecord).toBe('function');
    });

    test('deleteRecord method exists', () => {
      expect(typeof apiClient.deleteRecord).toBe('function');
    });

    test('searchRecords method exists', () => {
      expect(typeof apiClient.searchRecords).toBe('function');
    });
  });

  describe('authentication methods', () => {
    test('generateAccessToken method exists', () => {
      expect(typeof apiClient.generateAccessToken).toBe('function');
    });

    test('refreshAccessToken method exists', () => {
      expect(typeof apiClient.refreshAccessToken).toBe('function');
    });
  });
});