/**
 * Interface for validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Interface for validation error
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Interface for validation rule
 */
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone';
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | ValidationError;
}

/**
 * Interface for data cleansing rule
 */
export interface CleansingRule {
  field: string;
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  capitalize?: boolean;
  removeSpaces?: boolean;
  defaultValue?: any;
  transform?: (value: any) => any;
}

/**
 * Service for validating and cleansing data
 */
export class DataValidationService {
  /**
   * Validate data against validation rules
   * @param data Data to validate
   * @param rules Validation rules
   * @returns Validation result
   */
  public validate(data: any, rules: ValidationRule[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: []
    };

    for (const rule of rules) {
      const { field } = rule;
      const value = data[field];

      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        result.isValid = false;
        result.errors.push({
          field,
          message: `${field} is required`
        });
        continue;
      }

      // Skip validation if value is undefined or null and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Check type
      if (rule.type) {
        const typeValid = this.validateType(value, rule.type);
        if (!typeValid) {
          result.isValid = false;
          result.errors.push({
            field,
            message: `${field} must be a valid ${rule.type}`
          });
          continue;
        }
      }

      // Check minLength
      if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) {
        result.isValid = false;
        result.errors.push({
          field,
          message: `${field} must be at least ${rule.minLength} characters`
        });
      }

      // Check maxLength
      if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) {
        result.isValid = false;
        result.errors.push({
          field,
          message: `${field} must be at most ${rule.maxLength} characters`
        });
      }

      // Check minValue
      if (rule.minValue !== undefined && typeof value === 'number' && value < rule.minValue) {
        result.isValid = false;
        result.errors.push({
          field,
          message: `${field} must be at least ${rule.minValue}`
        });
      }

      // Check maxValue
      if (rule.maxValue !== undefined && typeof value === 'number' && value > rule.maxValue) {
        result.isValid = false;
        result.errors.push({
          field,
          message: `${field} must be at most ${rule.maxValue}`
        });
      }

      // Check pattern
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        result.isValid = false;
        result.errors.push({
          field,
          message: `${field} has an invalid format`
        });
      }

      // Check custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (typeof customResult === 'boolean') {
          if (!customResult) {
            result.isValid = false;
            result.errors.push({
              field,
              message: `${field} is invalid`
            });
          }
        } else {
          result.isValid = false;
          result.errors.push(customResult);
        }
      }
    }

    return result;
  }

  /**
   * Cleanse data according to cleansing rules
   * @param data Data to cleanse
   * @param rules Cleansing rules
   * @returns Cleansed data
   */
  public cleanse(data: any, rules: CleansingRule[]): any {
    const cleansedData = { ...data };

    for (const rule of rules) {
      const { field } = rule;
      let value = data[field];

      // Set default value if value is undefined or null
      if ((value === undefined || value === null) && rule.defaultValue !== undefined) {
        cleansedData[field] = rule.defaultValue;
        continue;
      }

      // Skip cleansing if value is undefined or null
      if (value === undefined || value === null) {
        continue;
      }

      // Convert to string if necessary
      if (typeof value !== 'string' && (rule.trim || rule.lowercase || rule.uppercase || rule.capitalize || rule.removeSpaces)) {
        value = String(value);
      }

      // Apply transformations
      if (typeof value === 'string') {
        // Trim
        if (rule.trim) {
          value = value.trim();
        }

        // Lowercase
        if (rule.lowercase) {
          value = value.toLowerCase();
        }

        // Uppercase
        if (rule.uppercase) {
          value = value.toUpperCase();
        }

        // Capitalize
        if (rule.capitalize) {
          value = value.charAt(0).toUpperCase() + value.slice(1);
        }

        // Remove spaces
        if (rule.removeSpaces) {
          value = value.replace(/\s/g, '');
        }
      }

      // Apply custom transformation
      if (rule.transform) {
        value = rule.transform(value);
      }

      cleansedData[field] = value;
    }

    return cleansedData;
  }

  /**
   * Validate and cleanse data
   * @param data Data to validate and cleanse
   * @param validationRules Validation rules
   * @param cleansingRules Cleansing rules
   * @returns Validation result and cleansed data
   */
  public validateAndCleanse(
    data: any,
    validationRules: ValidationRule[],
    cleansingRules: CleansingRule[]
  ): { result: ValidationResult; data: any } {
    // Cleanse data first
    const cleansedData = this.cleanse(data, cleansingRules);

    // Then validate
    const validationResult = this.validate(cleansedData, validationRules);

    return {
      result: validationResult,
      data: cleansedData
    };
  }

  /**
   * Validate type
   * @param value Value to validate
   * @param type Type to validate against
   * @returns Whether the value is of the specified type
   */
  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'phone':
        return typeof value === 'string' && /^\+?[\d\s\-()]{7,}$/.test(value);
      default:
        return true;
    }
  }

  /**
   * Validate a batch of records
   */
  public async validateBatch(records: any[], rules: ValidationRule[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    for (const record of records) {
      results.push(await this.validate(record, rules));
    }
    return results;
  }

  /**
   * Get quality metrics for validation
   */
  public getQualityMetrics(): any {
    return {
      validationCount: 0,
      errorRate: 0,
      successRate: 1,
      timestamp: new Date()
    };
  }

  /**
   * Add event emitter functionality
   */
  public on(event: string, listener: (...args: any[]) => void): this {
    // Mock event emitter - in real implementation extend EventEmitter
    return this;
  }

  /**
   * Get validation history
   */
  public getValidationHistory(): any[] {
    return [];
  }
}
