/// <reference types="jest" />

import { ZohoSyncService, SyncStatus } from '../../../src/services/zoho/zoho-sync-service';
import { ZohoSdkClient } from '../../../src/services/zoho/zoho-sdk-client';
import { ZohoModule } from '../../../src/services/zoho/zoho-types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock ZohoSdkClient
jest.mock('../../../src/services/zoho/zoho-sdk-client');
const MockedZohoSdkClient = ZohoSdkClient as jest.MockedClass<typeof ZohoSdkClient>;

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ZohoSyncService', () => {
  let zohoSyncService: ZohoSyncService;
  let mockZohoClient: jest.Mocked<ZohoSdkClient>;
  let mockDatabaseClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock database client
    mockDatabaseClient = {
      query: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn((callback) => callback(mockDatabaseClient))
    };

    // Create mock Zoho client
    mockZohoClient = new MockedZohoSdkClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      refreshToken: 'test-refresh-token'
    }, {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }) as jest.Mocked<ZohoSdkClient>;
    
    // Create ZohoSyncService instance
    zohoSyncService = new ZohoSyncService({
      zohoClient: mockZohoClient,
      databaseClient: mockDatabaseClient,
      databaseOrchestratorUrl: 'http://localhost:3001',
      aiPredictionServiceUrl: 'http://localhost:3003',
      apiGatewayUrl: 'http://localhost:3000'
    });
  });

  describe('syncStores', () => {
    it('should sync stores successfully', async () => {
      // Mock Zoho API response
      mockZohoClient.getRecords.mockResolvedValueOnce({
        data: [
          {
            id: 'store1',
            Account_Name: 'Store 1',
            Billing_Street: '123 Main St',
            Billing_City: 'New York',
            Billing_State: 'NY',
            Contact_Name: 'John Doe',
            Phone: '123-456-7890',
            Email: 'john@example.com',
            Annual_Revenue: '200000',
            Account_Type: 'Customer - Direct',
            Description: 'Test store'
          },
          {
            id: 'store2',
            Account_Name: 'Store 2',
            Billing_Street: '456 Oak St',
            Billing_City: 'Los Angeles',
            Billing_State: 'CA',
            Contact_Name: 'Jane Smith',
            Phone: '987-654-3210',
            Email: 'jane@example.com',
            Annual_Revenue: '500000',
            Account_Type: 'Customer - Channel',
            Description: 'Another test store'
          }
        ]
      });

      // Mock database query response for existing store
      mockDatabaseClient.query.mockResolvedValueOnce([{ id: 'store1' }]);
      mockDatabaseClient.query.mockResolvedValueOnce([]);

      // Execute sync
      const result = await zohoSyncService.syncStores();

      // Verify Zoho API was called
      expect(mockZohoClient.getRecords).toHaveBeenCalledWith(ZohoModule.ACCOUNTS);

      // Verify database operations
      expect(mockDatabaseClient.query).toHaveBeenCalledTimes(2);
      expect(mockDatabaseClient.update).toHaveBeenCalledTimes(1);
      expect(mockDatabaseClient.insert).toHaveBeenCalledTimes(1);

      // Verify result
      expect(result.status).toBe(SyncStatus.COMPLETED);
      expect(result.recordsProcessed).toBe(2);
      expect(result.recordsCreated).toBe(1);
      expect(result.recordsUpdated).toBe(1);
      expect(result.recordsFailed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors during store sync', async () => {
      // Mock Zoho API response
      mockZohoClient.getRecords.mockResolvedValueOnce({
        data: [
          {
            id: 'store1',
            Account_Name: 'Store 1'
          }
        ]
      });

      // Mock database query to throw error
      mockDatabaseClient.query.mockRejectedValueOnce(new Error('Database error'));

      // Execute sync
      const result = await zohoSyncService.syncStores();

      // Verify result
      expect(result.status).toBe(SyncStatus.COMPLETED);
      expect(result.recordsProcessed).toBe(1);
      expect(result.recordsFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Database error');
    });

    it('should handle Zoho API errors', async () => {
      // Mock Zoho API to throw error
      mockZohoClient.getRecords.mockRejectedValueOnce(new Error('Zoho API error'));

      // Execute sync
      const result = await zohoSyncService.syncStores();

      // Verify result
      expect(result.status).toBe(SyncStatus.FAILED);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Zoho API error');
    });
  });

  describe('syncProducts', () => {
    it('should sync products successfully', async () => {
      // Mock Zoho API response
      mockZohoClient.getRecords.mockResolvedValueOnce({
        data: [
          {
            id: 'product1',
            Product_Name: 'Product 1',
            Product_Category: 'Category 1',
            Product_Sub_Category: 'Sub Category 1',
            Vendor_Name: 'Vendor 1',
            Unit: 'Each',
            Unit_Price: '10.99',
            Qty_in_Stock: '100',
            Reorder_Level: '20',
            Expiry_Date: '2025-12-31',
            Warehouse_Location: 'A1'
          }
        ]
      });

      // Mock database query response for new product
      mockDatabaseClient.query.mockResolvedValueOnce([]);

      // Execute sync
      const result = await zohoSyncService.syncProducts();

      // Verify Zoho API was called
      expect(mockZohoClient.getRecords).toHaveBeenCalledWith(ZohoModule.PRODUCTS);

      // Verify database operations
      expect(mockDatabaseClient.query).toHaveBeenCalledTimes(1);
      expect(mockDatabaseClient.insert).toHaveBeenCalledTimes(1);

      // Verify result
      expect(result.status).toBe(SyncStatus.COMPLETED);
      expect(result.recordsProcessed).toBe(1);
      expect(result.recordsCreated).toBe(1);
      expect(result.recordsUpdated).toBe(0);
      expect(result.recordsFailed).toBe(0);
    });
  });

  describe('syncInvoices', () => {
    it('should sync invoices successfully', async () => {
      // Mock Zoho API response
      mockZohoClient.getRecords.mockResolvedValueOnce({
        data: [
          {
            id: 'invoice1',
            Account_ID: { id: 'store1' },
            Invoice_Date: '2025-08-01',
            Sub_Total: '100.00',
            Status: 'Paid',
            Terms_and_Conditions: 'Test terms',
            Product_Details: [
              {
                product: { id: 'product1' },
                quantity: '2',
                unit_price: '10.99',
                Discount: '0',
                total: '21.98'
              }
            ]
          }
        ]
      });

      // Mock database query responses
      mockDatabaseClient.query.mockResolvedValueOnce([]);  // Invoice doesn't exist
      mockDatabaseClient.query.mockResolvedValueOnce([]);  // Invoice item doesn't exist

      // Execute sync
      const result = await zohoSyncService.syncInvoices();

      // Verify Zoho API was called
      expect(mockZohoClient.getRecords).toHaveBeenCalledWith(ZohoModule.INVOICES);

      // Verify database operations
      expect(mockDatabaseClient.query).toHaveBeenCalledTimes(2);
      expect(mockDatabaseClient.insert).toHaveBeenCalledTimes(2);  // Invoice and invoice item

      // Verify result
      expect(result.status).toBe(SyncStatus.COMPLETED);
      expect(result.recordsProcessed).toBe(1);
      expect(result.recordsCreated).toBe(1);
      expect(result.recordsUpdated).toBe(0);
      expect(result.recordsFailed).toBe(0);
    });
  });

  describe('syncAll', () => {
    it('should sync all data and trigger AI prediction update', async () => {
      // Mock individual sync methods
      const syncStoresSpy = jest.spyOn(zohoSyncService, 'syncStores').mockResolvedValueOnce({
        status: SyncStatus.COMPLETED,
        recordsProcessed: 2,
        recordsCreated: 1,
        recordsUpdated: 1,
        recordsFailed: 0,
        errors: [],
        startTime: new Date()
      });

      const syncProductsSpy = jest.spyOn(zohoSyncService, 'syncProducts').mockResolvedValueOnce({
        status: SyncStatus.COMPLETED,
        recordsProcessed: 3,
        recordsCreated: 2,
        recordsUpdated: 1,
        recordsFailed: 0,
        errors: [],
        startTime: new Date()
      });

      const syncInvoicesSpy = jest.spyOn(zohoSyncService, 'syncInvoices').mockResolvedValueOnce({
        status: SyncStatus.COMPLETED,
        recordsProcessed: 5,
        recordsCreated: 3,
        recordsUpdated: 1,
        recordsFailed: 1,
        errors: [new Error('Test error')],
        startTime: new Date()
      });

      // Mock axios for AI prediction update
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success' } });

      // Execute sync all
      const result = await zohoSyncService.syncAll(true);

      // Verify individual sync methods were called
      expect(syncStoresSpy).toHaveBeenCalled();
      expect(syncProductsSpy).toHaveBeenCalled();
      expect(syncInvoicesSpy).toHaveBeenCalled();

      // Verify AI prediction update was triggered
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3000/mangalm/ai-predictions/batch',
        { forceUpdate: true }
      );

      // Verify result
      expect(result.status).toBe(SyncStatus.COMPLETED);
      expect(result.recordsProcessed).toBe(10);  // 2 + 3 + 5
      expect(result.recordsCreated).toBe(6);     // 1 + 2 + 3
      expect(result.recordsUpdated).toBe(3);     // 1 + 1 + 1
      expect(result.recordsFailed).toBe(1);      // 0 + 0 + 1
      expect(result.errors).toHaveLength(1);
      expect(result.aiPredictionUpdateStatus).toBe('SUCCESS');
    });

    it('should handle AI prediction update failure', async () => {
      // Mock individual sync methods
      jest.spyOn(zohoSyncService, 'syncStores').mockResolvedValueOnce({
        status: SyncStatus.COMPLETED,
        recordsProcessed: 1,
        recordsCreated: 1,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        startTime: new Date()
      });

      jest.spyOn(zohoSyncService, 'syncProducts').mockResolvedValueOnce({
        status: SyncStatus.COMPLETED,
        recordsProcessed: 1,
        recordsCreated: 1,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        startTime: new Date()
      });

      jest.spyOn(zohoSyncService, 'syncInvoices').mockResolvedValueOnce({
        status: SyncStatus.COMPLETED,
        recordsProcessed: 1,
        recordsCreated: 1,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        startTime: new Date()
      });

      // Mock triggerAiPredictionUpdate to fail
      jest.spyOn(zohoSyncService, 'triggerAiPredictionUpdate').mockRejectedValueOnce(new Error('AI prediction update failed'));

      // Execute sync all
      const result = await zohoSyncService.syncAll(true);

      // Verify result
      expect(result.status).toBe(SyncStatus.COMPLETED);
      expect(result.aiPredictionUpdateStatus).toBe('FAILED');
      expect(result.aiPredictionUpdateError).toBe('AI prediction update failed');
    });

    it('should skip AI prediction update when triggerAiUpdate is false', async () => {
      // Mock individual sync methods
      jest.spyOn(zohoSyncService, 'syncStores').mockResolvedValueOnce({
        status: SyncStatus.COMPLETED,
        recordsProcessed: 1,
        recordsCreated: 1,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        startTime: new Date()
      });

      jest.spyOn(zohoSyncService, 'syncProducts').mockResolvedValueOnce({
        status: SyncStatus.COMPLETED,
        recordsProcessed: 1,
        recordsCreated: 1,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        startTime: new Date()
      });

      jest.spyOn(zohoSyncService, 'syncInvoices').mockResolvedValueOnce({
        status: SyncStatus.COMPLETED,
        recordsProcessed: 1,
        recordsCreated: 1,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        startTime: new Date()
      });

      // Execute sync all with triggerAiUpdate = false
      const result = await zohoSyncService.syncAll(false);

      // Verify AI prediction update was not triggered
      expect(mockedAxios.post).not.toHaveBeenCalled();

      // Verify result
      expect(result.status).toBe(SyncStatus.COMPLETED);
      expect(result.aiPredictionUpdateStatus).toBe('SKIPPED');
    });
  });

  describe('triggerAiPredictionUpdate', () => {
    it('should trigger AI prediction update via API Gateway', async () => {
      // Mock axios for API Gateway call
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success' } });

      // Trigger AI prediction update
      await zohoSyncService.triggerAiPredictionUpdate();

      // Verify API Gateway was called
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3000/mangalm/ai-predictions/batch',
        { forceUpdate: true }
      );
    });

    it('should fall back to direct service call if API Gateway fails', async () => {
      // Mock axios for API Gateway call to fail
      mockedAxios.post.mockRejectedValueOnce(new Error('API Gateway error'));
      // Mock axios for direct service call
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success' } });

      // Trigger AI prediction update
      await zohoSyncService.triggerAiPredictionUpdate();

      // Verify direct service call was made after API Gateway failed
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        1,
        'http://localhost:3000/mangalm/ai-predictions/batch',
        { forceUpdate: true }
      );
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3003/api/predictions/batch',
        { forceUpdate: true }
      );
    });

    it('should throw error if both API Gateway and direct service calls fail', async () => {
      // Mock axios for both calls to fail
      mockedAxios.post.mockRejectedValueOnce(new Error('API Gateway error'));
      mockedAxios.post.mockRejectedValueOnce(new Error('Direct service error'));

      // Trigger AI prediction update and expect error
      await expect(zohoSyncService.triggerAiPredictionUpdate()).rejects.toThrow('Direct service error');
    });

    it('should throw error if no API Gateway or AI Prediction Service URL is configured', async () => {
      // Create service without URLs
      const serviceWithoutUrls = new ZohoSyncService({
        zohoClient: mockZohoClient,
        databaseClient: mockDatabaseClient,
        databaseOrchestratorUrl: 'http://localhost:3001'
      });

      // Trigger AI prediction update and expect error
      await expect(serviceWithoutUrls.triggerAiPredictionUpdate()).rejects.toThrow(
        'Cannot trigger AI prediction update: No API Gateway or AI Prediction Service URL configured'
      );
    });
  });

  describe('triggerCallPrioritizationUpdate', () => {
    it('should trigger call prioritization update via API Gateway', async () => {
      // Mock axios for API Gateway call
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success' } });

      // Trigger call prioritization update
      await zohoSyncService.triggerCallPrioritizationUpdate();

      // Verify API Gateway was called
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3000/mangalm/call-prioritization/generate',
        { forceUpdate: true }
      );
    });
  });
});
