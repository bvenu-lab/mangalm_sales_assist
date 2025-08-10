import { DataValidationService, ValidationRule } from '../../../src/services/validation/data-validation-service';

describe('DataValidationService', () => {
  let validationService: DataValidationService;

  beforeEach(() => {
    validationService = new DataValidationService();
  });

  describe('validate method', () => {
    const rules: ValidationRule[] = [
      { field: 'name', required: true, type: 'string', minLength: 2 },
      { field: 'email', required: true, type: 'email' },
      { field: 'age', type: 'number', minValue: 0, maxValue: 150 }
    ];

    test('validates valid data successfully', async () => {
      const data = { name: 'John Doe', email: 'john@example.com', age: 30 };
      const result = await validationService.validate(data, rules);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects missing required fields', async () => {
      const data = { age: 30 };
      const result = await validationService.validate(data, rules);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('validates email format', async () => {
      const data = { name: 'John', email: 'invalid-email', age: 30 };
      const result = await validationService.validate(data, rules);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'email')).toBe(true);
    });
  });

  describe('validateBatch method', () => {
    test('validates multiple records', async () => {
      const records = [
        { name: 'John', email: 'john@test.com' },
        { name: 'Jane', email: 'jane@test.com' }
      ];
      const rules: ValidationRule[] = [
        { field: 'name', required: true },
        { field: 'email', required: true, type: 'email' }
      ];

      const results = await validationService.validateBatch(records, rules);
      
      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
    });
  });

  describe('getQualityMetrics method', () => {
    test('returns metrics object', () => {
      const metrics = validationService.getQualityMetrics();
      
      expect(metrics).toHaveProperty('validationCount');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('timestamp');
    });
  });
});