/**
 * Enterprise Schema Validation System
 * Comprehensive validation using Joi with custom extensions
 */

import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ApiResponseBuilder, ErrorCode, ValidationError } from './api-standards';

/**
 * Extended Joi Schema with Custom Validators
 */
export const ValidationSchemas = {
  // Common field patterns
  id: Joi.string().uuid().required().description('Unique identifier (UUID)'),
  optionalId: Joi.string().uuid().optional().description('Optional unique identifier'),
  
  // String validations
  name: Joi.string().min(1).max(255).trim().required().description('Name field'),
  optionalName: Joi.string().min(1).max(255).trim().optional().description('Optional name'),
  email: Joi.string().email().required().description('Valid email address'),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional().description('Phone number'),
  
  // Numeric validations
  positiveInteger: Joi.number().integer().min(1).required().description('Positive integer'),
  nonNegativeInteger: Joi.number().integer().min(0).required().description('Non-negative integer'),
  positiveNumber: Joi.number().min(0.01).precision(2).required().description('Positive number'),
  percentage: Joi.number().min(0).max(100).precision(2).description('Percentage (0-100)'),
  
  // Date validations
  dateString: Joi.string().isoDate().description('ISO date string'),
  dateRange: Joi.object({
    startDate: Joi.string().isoDate().required(),
    endDate: Joi.string().isoDate().min(Joi.ref('startDate')).required()
  }),
  
  // Pagination schemas
  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1).description('Page number'),
    limit: Joi.number().integer().min(1).max(100).default(20).description('Items per page'),
    offset: Joi.number().integer().min(0).optional().description('Offset (alternative to page)')
  }),
  
  // Sorting schemas  
  sortQuery: Joi.object({
    sort: Joi.string().optional().description('Sort field with optional prefix (+/-)'),
    sortBy: Joi.string().optional().description('Sort field name'),
    sortOrder: Joi.string().valid('asc', 'desc').optional().description('Sort direction')
  }),
  
  // Search and filtering
  searchQuery: Joi.object({
    search: Joi.string().min(1).max(255).optional().description('Search term'),
    q: Joi.string().min(1).max(255).optional().description('Quick search'),
    filter: Joi.string().optional().description('JSON filter string')
  }),
  
  // Field selection
  fieldQuery: Joi.object({
    fields: Joi.string().optional().description('Comma-separated field list'),
    include: Joi.string().optional().description('Related fields to include'),
    exclude: Joi.string().optional().description('Fields to exclude')
  })
};

/**
 * Business Domain Schemas
 */
export const BusinessSchemas = {
  // Store validation
  store: Joi.object({
    id: ValidationSchemas.optionalId,
    name: ValidationSchemas.name.description('Store name'),
    address: Joi.string().max(500).optional().description('Store address'),
    city: Joi.string().max(100).optional().description('City'),
    state: Joi.string().max(100).optional().description('State/Province'),
    phone: ValidationSchemas.phone,
    email: ValidationSchemas.email.optional(),
    isActive: Joi.boolean().default(true).description('Store active status')
  }),

  storeUpdate: Joi.object({
    name: ValidationSchemas.optionalName,
    address: Joi.string().max(500).optional().allow(''),
    city: Joi.string().max(100).optional().allow(''),
    state: Joi.string().max(100).optional().allow(''),
    phone: ValidationSchemas.phone.optional(),
    email: ValidationSchemas.email.optional().allow(''),
    isActive: Joi.boolean().optional()
  }),

  // Product validation
  product: Joi.object({
    id: ValidationSchemas.optionalId,
    name: ValidationSchemas.name.description('Product name'),
    sku: Joi.string().alphanum().min(1).max(50).required().description('Stock Keeping Unit'),
    category: Joi.string().min(1).max(100).required().description('Product category'),
    price: ValidationSchemas.positiveNumber.description('Product price'),
    cost: ValidationSchemas.positiveNumber.optional().description('Product cost'),
    weight: Joi.number().min(0).precision(3).optional().description('Product weight (kg)'),
    dimensions: Joi.object({
      length: Joi.number().min(0).precision(2).required(),
      width: Joi.number().min(0).precision(2).required(),
      height: Joi.number().min(0).precision(2).required()
    }).optional().description('Product dimensions (cm)'),
    isActive: Joi.boolean().default(true)
  }),

  // Order validation
  order: Joi.object({
    id: ValidationSchemas.optionalId,
    storeId: ValidationSchemas.id.description('Store ID'),
    orderDate: ValidationSchemas.dateString.default(() => new Date().toISOString()),
    items: Joi.array().items(
      Joi.object({
        productId: ValidationSchemas.id,
        quantity: ValidationSchemas.positiveInteger,
        unitPrice: ValidationSchemas.positiveNumber,
        discount: Joi.number().min(0).max(100).default(0).description('Discount percentage')
      })
    ).min(1).required().description('Order items'),
    status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')
      .default('pending').description('Order status'),
    notes: Joi.string().max(1000).optional().allow('').description('Order notes')
  }),

  // Prediction request validation
  predictionRequest: Joi.object({
    storeId: ValidationSchemas.id.description('Store ID for prediction'),
    type: Joi.string().valid('sales', 'inventory', 'demand', 'revenue')
      .required().description('Prediction type'),
    timeframe: Joi.string().valid('week', 'month', 'quarter', 'year')
      .default('month').description('Prediction timeframe'),
    includeFactors: Joi.array().items(
      Joi.string().valid('seasonal', 'trends', 'events', 'weather')
    ).optional().description('Factors to include in prediction'),
    confidence: Joi.number().min(0).max(1).default(0.95).description('Confidence interval')
  }),

  // Zoho sync request validation
  zohoSyncRequest: Joi.object({
    modules: Joi.array().items(
      Joi.string().valid('accounts', 'products', 'invoices', 'contacts')
    ).min(1).required().description('Modules to sync'),
    direction: Joi.string().valid('pull', 'push', 'bidirectional')
      .default('bidirectional').description('Sync direction'),
    deltaSync: Joi.boolean().default(true).description('Use delta sync'),
    validateData: Joi.boolean().default(true).description('Validate data before sync'),
    conflictResolution: Joi.string().valid('zoho_wins', 'local_wins', 'merge', 'manual')
      .default('merge').description('Conflict resolution strategy')
  })
};

/**
 * Standard Query Schema for List Endpoints
 */
export const StandardListQuery = Joi.object({
  ...ValidationSchemas.paginationQuery.describe().children,
  ...ValidationSchemas.sortQuery.describe().children,
  ...ValidationSchemas.searchQuery.describe().children,
  ...ValidationSchemas.fieldQuery.describe().children,
  
  // Date range filtering
  startDate: Joi.string().isoDate().optional().description('Start date filter'),
  endDate: Joi.string().isoDate().min(Joi.ref('startDate')).optional().description('End date filter'),
  
  // Common filters
  status: Joi.string().optional().description('Status filter'),
  active: Joi.boolean().optional().description('Active status filter'),
  archived: Joi.boolean().optional().description('Archived status filter')
});

/**
 * Validation Middleware Factory
 */
export function validateRequest(schema: Joi.ObjectSchema, target: 'body' | 'query' | 'params' = 'body') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const responseBuilder = new ApiResponseBuilder(req);
    
    try {
      const dataToValidate = req[target];
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const validationErrors: ValidationError[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          code: detail.type.replace(/\./g, '_').toUpperCase(),
          message: detail.message,
          value: detail.context?.value
        }));

        const response = responseBuilder.validationError(validationErrors);
        return res.status(400).json(response);
      }

      // Replace the request data with validated and transformed data
      req[target] = value;
      next();

    } catch (err: any) {
      const response = responseBuilder.error(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Validation system error',
        err
      );
      return res.status(500).json(response);
    }
  };
}

/**
 * Validation Middleware Shortcuts
 */
export const validate = {
  body: (schema: Joi.ObjectSchema) => validateRequest(schema, 'body'),
  query: (schema: Joi.ObjectSchema) => validateRequest(schema, 'query'),
  params: (schema: Joi.ObjectSchema) => validateRequest(schema, 'params'),
  
  // Common validations
  standardListQuery: validateRequest(StandardListQuery, 'query'),
  
  // Business entity validations
  store: validateRequest(BusinessSchemas.store, 'body'),
  storeUpdate: validateRequest(BusinessSchemas.storeUpdate, 'body'),
  product: validateRequest(BusinessSchemas.product, 'body'),
  order: validateRequest(BusinessSchemas.order, 'body'),
  predictionRequest: validateRequest(BusinessSchemas.predictionRequest, 'body'),
  zohoSyncRequest: validateRequest(BusinessSchemas.zohoSyncRequest, 'body')
};

/**
 * Custom Joi Extensions
 */
export const customJoi = Joi.extend({
  type: 'mongoObjectId',
  base: Joi.string(),
  messages: {
    'mongoObjectId.invalid': 'must be a valid MongoDB ObjectId'
  },
  validate(value, helpers) {
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      return { value, errors: helpers.error('mongoObjectId.invalid') };
    }
  }
});

/**
 * Validation Utilities
 */
export class ValidationUtils {
  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Basic XSS prevention
      .substring(0, 10000); // Prevent extremely long inputs
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate email format (more strict than Joi default)
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Parse and validate JSON string
   */
  static parseJSON(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Validate date range
   */
  static validateDateRange(startDate: string, endDate: string): boolean {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start <= end && start <= new Date();
  }
}

/**
 * Type-safe validation result
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Async validation wrapper
 */
export async function validateAsync<T>(
  schema: Joi.ObjectSchema,
  data: any
): Promise<ValidationResult<T>> {
  try {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        code: detail.type.replace(/\./g, '_').toUpperCase(),
        message: detail.message,
        value: detail.context?.value
      }));

      return {
        success: false,
        errors: validationErrors
      };
    }

    return {
      success: true,
      data: value as T
    };

  } catch (err) {
    return {
      success: false,
      errors: [{
        field: 'root',
        code: 'VALIDATION_SYSTEM_ERROR',
        message: 'Validation system error occurred'
      }]
    };
  }
}

export default {
  ValidationSchemas,
  BusinessSchemas,
  StandardListQuery,
  validate,
  validateRequest,
  validateAsync,
  ValidationUtils,
  customJoi
};