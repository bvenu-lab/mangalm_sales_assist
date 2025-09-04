/**
 * Unit Tests for CSV Stream Processor
 * Tests parsing, validation, and batch processing
 */

const path = require('path');
const fs = require('fs').promises;
const {
  validateRow,
  transformRow,
  parseDate,
  processBatch
} = require('../../services/queue-processor/csv-stream-processor');
const { generateCSV, generateInvalidCSV } = require('../fixtures/test-data-generator');

describe('CSV Stream Processor', () => {
  
  describe('validateRow', () => {
    test('should validate correct row', () => {
      const row = {
        InvoiceNo: 'INV-001',
        InvoiceDate: '2024-01-15',
        StoreName: 'Store A',
        ItemName: 'Product 1',
        Quantity: '10',
        Rate: '50.00',
        Amount: '500.00'
      };
      
      const result = validateRow(row, 1);
      expect(result.valid).toBe(true);
    });
    
    test('should reject row with missing required fields', () => {
      const row = {
        InvoiceDate: '2024-01-15',
        StoreName: 'Store A',
        Quantity: '10'
      };
      
      const result = validateRow(row, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required field');
    });
    
    test('should reject row with invalid quantity', () => {
      const row = {
        InvoiceNo: 'INV-001',
        InvoiceDate: '2024-01-15',
        StoreName: 'Store A',
        ItemName: 'Product 1',
        Quantity: 'invalid',
        Rate: '50.00',
        Amount: '500.00'
      };
      
      const result = validateRow(row, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid numeric value');
    });
    
    test('should reject negative quantity', () => {
      const row = {
        InvoiceNo: 'INV-001',
        InvoiceDate: '2024-01-15',
        StoreName: 'Store A',
        ItemName: 'Product 1',
        Quantity: '-5',
        Rate: '50.00',
        Amount: '-250.00'
      };
      
      const result = validateRow(row, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });
    
    test('should validate amount calculation', () => {
      const row = {
        InvoiceNo: 'INV-001',
        InvoiceDate: '2024-01-15',
        StoreName: 'Store A',
        ItemName: 'Product 1',
        Quantity: '10',
        Rate: '50.00',
        Amount: '600.00' // Wrong amount
      };
      
      const result = validateRow(row, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Amount mismatch');
    });
  });
  
  describe('transformRow', () => {
    test('should transform row to database format', () => {
      const row = {
        'Invoice No': 'INV-001',
        'Invoice Date': '2024-01-15',
        'Month': 'January',
        'Year': '2024',
        'Salesman Name': 'John Doe',
        'Store Name': 'Store A',
        'Store Code': 'ST001',
        'Item Name': 'Product 1',
        'Batch No': 'BATCH-001',
        'Quantity': '10',
        'Rate': '50.00',
        'MRP': '60.00',
        'Dis': '5',
        'Amount': '500.00',
        'Company Name': 'Test Co',
        'Division': 'Sales',
        'HQ': 'Mumbai',
        'Expiry Date': '2025-12-31'
      };
      
      const transformed = transformRow(row);
      
      expect(transformed.invoice_no).toBe('INV-001');
      expect(transformed.invoice_date).toBe('2024-01-15');
      expect(transformed.quantity).toBe(10);
      expect(transformed.rate).toBe(50);
      expect(transformed.amount).toBe(500);
      expect(transformed.discount).toBe(5);
    });
    
    test('should handle both CamelCase and space-separated field names', () => {
      const row1 = { InvoiceNo: 'INV-001', StoreName: 'Store A' };
      const row2 = { 'Invoice No': 'INV-002', 'Store Name': 'Store B' };
      
      const transformed1 = transformRow(row1);
      const transformed2 = transformRow(row2);
      
      expect(transformed1.invoice_no).toBe('INV-001');
      expect(transformed1.store_name).toBe('Store A');
      expect(transformed2.invoice_no).toBe('INV-002');
      expect(transformed2.store_name).toBe('Store B');
    });
    
    test('should handle missing optional fields', () => {
      const row = {
        'Invoice No': 'INV-001',
        'Invoice Date': '2024-01-15',
        'Store Name': 'Store A',
        'Item Name': 'Product 1',
        'Quantity': '10',
        'Rate': '50',
        'Amount': '500'
      };
      
      const transformed = transformRow(row);
      
      expect(transformed.invoice_no).toBe('INV-001');
      expect(transformed.salesman_name).toBe('');
      expect(transformed.batch_no).toBe('');
      expect(transformed.expiry_date).toBeNull();
    });
  });
  
  describe('parseDate', () => {
    test('should parse ISO date format', () => {
      expect(parseDate('2024-01-15')).toBe('2024-01-15');
      expect(parseDate('2024-12-31')).toBe('2024-12-31');
    });
    
    test('should parse DD/MM/YYYY format', () => {
      expect(parseDate('15/01/2024')).toBe('2024-01-15');
      expect(parseDate('31/12/2024')).toBe('2024-12-31');
    });
    
    test('should parse DD-MM-YYYY format', () => {
      expect(parseDate('15-01-2024')).toBe('2024-01-15');
      expect(parseDate('31-12-2024')).toBe('2024-12-31');
    });
    
    test('should handle 2-digit years', () => {
      expect(parseDate('15/01/24')).toBe('2024-01-15');
      expect(parseDate('15/01/99')).toBe('1999-01-15');
    });
    
    test('should return null for invalid dates', () => {
      expect(parseDate('')).toBeNull();
      expect(parseDate('invalid')).toBeNull();
      expect(parseDate('32/13/2024')).toBeNull();
    });
  });
  
  describe('processBatch', () => {
    let mockClient;
    
    beforeEach(() => {
      mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
    });
    
    test('should process empty batch without error', async () => {
      await processBatch([], mockClient);
      expect(mockClient.query).not.toHaveBeenCalled();
    });
    
    test('should build correct INSERT query for batch', async () => {
      const batch = [
        {
          invoice_no: 'INV-001',
          invoice_date: '2024-01-15',
          month: 'January',
          year: 2024,
          salesman_name: 'John Doe',
          store_name: 'Store A',
          store_code: 'ST001',
          item_name: 'Product 1',
          batch_no: 'BATCH-001',
          quantity: 10,
          rate: 50,
          mrp: 60,
          discount: 5,
          amount: 500,
          company_name: 'Test Co',
          division: 'Sales',
          hq: 'Mumbai',
          expiry_date: '2025-12-31',
          hash: 'testhash123'
        }
      ];
      
      await processBatch(batch, mockClient);
      
      // Check INSERT query was called
      const insertCall = mockClient.query.mock.calls.find(
        call => call[0].includes('INSERT INTO invoice_items')
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[0]).toContain('ON CONFLICT');
      expect(insertCall[1]).toHaveLength(18); // 18 fields per row
      
      // Check deduplication query was called
      const dedupCall = mockClient.query.mock.calls.find(
        call => call[0].includes('INSERT INTO bulk_upload.deduplication')
      );
      expect(dedupCall).toBeDefined();
    });
    
    test('should handle multiple rows in batch', async () => {
      const batch = [
        {
          invoice_no: 'INV-001',
          invoice_date: '2024-01-15',
          month: 'January',
          year: 2024,
          salesman_name: 'John',
          store_name: 'Store A',
          store_code: 'ST001',
          item_name: 'Product 1',
          batch_no: 'B001',
          quantity: 10,
          rate: 50,
          mrp: 60,
          discount: 5,
          amount: 500,
          company_name: 'Test',
          division: 'Sales',
          hq: 'Mumbai',
          expiry_date: '2025-12-31',
          hash: 'hash1'
        },
        {
          invoice_no: 'INV-002',
          invoice_date: '2024-01-16',
          month: 'January',
          year: 2024,
          salesman_name: 'Jane',
          store_name: 'Store B',
          store_code: 'ST002',
          item_name: 'Product 2',
          batch_no: 'B002',
          quantity: 20,
          rate: 30,
          mrp: 36,
          discount: 3,
          amount: 600,
          company_name: 'Test',
          division: 'Sales',
          hq: 'Delhi',
          expiry_date: '2025-12-31',
          hash: 'hash2'
        }
      ];
      
      await processBatch(batch, mockClient);
      
      const insertCall = mockClient.query.mock.calls.find(
        call => call[0].includes('INSERT INTO invoice_items')
      );
      expect(insertCall[1]).toHaveLength(36); // 18 fields * 2 rows
    });
  });
  
  describe('CSV File Processing', () => {
    let testFile;
    
    beforeEach(async () => {
      await fs.mkdir('./test/uploads/temp', { recursive: true });
    });
    
    afterEach(async () => {
      if (testFile) {
        try {
          await fs.unlink(testFile);
        } catch (e) {
          // File might not exist
        }
      }
    });
    
    test('should process valid CSV file', async () => {
      testFile = await generateCSV('./test/uploads/temp/valid.csv', 10);
      
      const stats = await fs.stat(testFile);
      expect(stats.size).toBeGreaterThan(0);
      
      const content = await fs.readFile(testFile, 'utf-8');
      const lines = content.split('\n');
      expect(lines.length).toBe(12); // Header + 10 rows + empty line
    });
    
    test('should handle CSV with invalid rows', async () => {
      testFile = await generateInvalidCSV('./test/uploads/temp/invalid.csv');
      
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('invalid');
      expect(content).toContain(',,'); // Empty fields
    });
  });
});