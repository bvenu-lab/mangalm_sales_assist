import { MockDatabase } from '../../src/services/database/mock-database';

describe('MockDatabase', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  describe('getStores', () => {
    it('should return a list of stores', async () => {
      const stores = await db.getStores();

      expect(stores).toBeDefined();
      expect(Array.isArray(stores)).toBe(true);
      expect(stores.length).toBeGreaterThan(0);
      
      stores.forEach(store => {
        expect(store.id).toBeDefined();
        expect(store.name).toBeDefined();
        expect(store.city).toBeDefined();
        expect(store.state).toBeDefined();
      });
    });

    it('should return stores with consistent structure', async () => {
      const stores = await db.getStores();
      const firstStore = stores[0];

      expect(firstStore).toHaveProperty('id');
      expect(firstStore).toHaveProperty('name');
      expect(firstStore).toHaveProperty('address');
      expect(firstStore).toHaveProperty('city');
      expect(firstStore).toHaveProperty('state');
      expect(firstStore).toHaveProperty('zipCode');
      expect(firstStore).toHaveProperty('phoneNumber');
      expect(firstStore).toHaveProperty('managerName');
    });
  });

  describe('getStoreById', () => {
    it('should return a specific store by ID', async () => {
      const stores = await db.getStores();
      const targetStore = stores[0];
      
      const store = await db.getStoreById(targetStore.id);

      expect(store).toBeDefined();
      expect(store.id).toBe(targetStore.id);
      expect(store.name).toBe(targetStore.name);
    });

    it('should return null for non-existent store ID', async () => {
      const store = await db.getStoreById('non-existent-id');
      
      expect(store).toBeNull();
    });
  });

  describe('getProducts', () => {
    it('should return a list of products', async () => {
      const products = await db.getProducts();

      expect(products).toBeDefined();
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      
      products.forEach(product => {
        expect(product.id).toBeDefined();
        expect(product.name).toBeDefined();
        expect(product.category).toBeDefined();
        expect(product.price).toBeDefined();
        expect(typeof product.price).toBe('number');
      });
    });

    it('should have valid product categories', async () => {
      const products = await db.getProducts();
      const validCategories = ['Cookies', 'Cakes', 'Bread', 'Pastries', 'Beverages'];
      
      products.forEach(product => {
        expect(validCategories).toContain(product.category);
      });
    });
  });

  describe('getHistoricalInvoices', () => {
    it('should return historical invoices for a store', async () => {
      const stores = await db.getStores();
      const storeId = stores[0].id;
      
      const invoices = await db.getHistoricalInvoices(storeId);

      expect(invoices).toBeDefined();
      expect(Array.isArray(invoices)).toBe(true);
      
      invoices.forEach(invoice => {
        expect(invoice.storeId).toBe(storeId);
        expect(invoice.invoiceDate).toBeDefined();
        expect(invoice.totalAmount).toBeDefined();
        expect(invoice.items).toBeDefined();
        expect(Array.isArray(invoice.items)).toBe(true);
      });
    });

    it('should return invoices with valid date range', async () => {
      const stores = await db.getStores();
      const storeId = stores[0].id;
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const invoices = await db.getHistoricalInvoices(storeId, startDate, endDate);

      invoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate);
        expect(invoiceDate >= startDate).toBe(true);
        expect(invoiceDate <= endDate).toBe(true);
      });
    });

    it('should return empty array for store with no invoices', async () => {
      const invoices = await db.getHistoricalInvoices('store-with-no-invoices');
      
      expect(invoices).toBeDefined();
      expect(Array.isArray(invoices)).toBe(true);
      expect(invoices.length).toBe(0);
    });
  });

  describe('savePrediction', () => {
    it('should save a prediction successfully', async () => {
      const prediction = {
        storeId: 'store-123',
        predictions: [
          { productId: 'prod-1', quantity: 10, confidence: 0.95 },
          { productId: 'prod-2', quantity: 20, confidence: 0.88 },
        ],
        metadata: {
          algorithm: 'random-forest',
          version: '1.0.0',
        },
      };

      const result = await db.savePrediction(prediction);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('should validate prediction data before saving', async () => {
      const invalidPrediction = {
        // Missing required fields
        predictions: [],
      };

      await expect(db.savePrediction(invalidPrediction)).rejects.toThrow();
    });
  });

  describe('getCallPrioritization', () => {
    it('should return call prioritization data', async () => {
      const prioritization = await db.getCallPrioritization();

      expect(prioritization).toBeDefined();
      expect(Array.isArray(prioritization)).toBe(true);
      
      prioritization.forEach(item => {
        expect(item.storeId).toBeDefined();
        expect(item.priority).toBeDefined();
        expect(item.score).toBeDefined();
        expect(typeof item.score).toBe('number');
        expect(item.score).toBeGreaterThanOrEqual(0);
        expect(item.score).toBeLessThanOrEqual(100);
      });
    });

    it('should return prioritization sorted by score', async () => {
      const prioritization = await db.getCallPrioritization();
      
      for (let i = 1; i < prioritization.length; i++) {
        expect(prioritization[i - 1].score).toBeGreaterThanOrEqual(prioritization[i].score);
      }
    });
  });

  describe('updateStoreMetrics', () => {
    it('should update store metrics successfully', async () => {
      const metrics = {
        storeId: 'store-123',
        totalRevenue: 50000,
        averageOrderValue: 250,
        orderCount: 200,
        topProducts: ['prod-1', 'prod-2', 'prod-3'],
      };

      const result = await db.updateStoreMetrics(metrics);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.updatedAt).toBeDefined();
    });

    it('should validate metrics data', async () => {
      const invalidMetrics = {
        storeId: 'store-123',
        totalRevenue: -1000, // Invalid negative revenue
      };

      await expect(db.updateStoreMetrics(invalidMetrics)).rejects.toThrow();
    });
  });

  describe('Connection Management', () => {
    it('should establish database connection', async () => {
      const connected = await db.connect();
      
      expect(connected).toBe(true);
    });

    it('should close database connection', async () => {
      await db.connect();
      const disconnected = await db.disconnect();
      
      expect(disconnected).toBe(true);
    });

    it('should handle reconnection', async () => {
      await db.connect();
      await db.disconnect();
      const reconnected = await db.connect();
      
      expect(reconnected).toBe(true);
    });
  });
});