import { apiClient } from '../api';

// Mock axios
jest.mock('axios');

describe('API Client', () => {
  test('exports apiClient', () => {
    expect(apiClient).toBeDefined();
  });

  test('has expected methods', () => {
    expect(typeof apiClient.get).toBe('function');
    expect(typeof apiClient.post).toBe('function');
    expect(typeof apiClient.put).toBe('function');
    expect(typeof apiClient.delete).toBe('function');
  });
});