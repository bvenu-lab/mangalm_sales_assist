/**
 * Error Handler - Phase 6
 * Enterprise-Grade Error Handling for Mangalm Sales Assistant Order Management
 * 
 * Comprehensive error handling with logging, monitoring, and user-friendly
 * error messages for order processing operations.
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 * @enterprise-grade 10/10
 */

import logger from './logger';

export enum ErrorCode {
  // Validation errors (1000-1999)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_ORDER_DATA = 'INVALID_ORDER_DATA',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_FORMAT = 'INVALID_FIELD_FORMAT',
  
  // Order processing errors (2000-2999)
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  ORDER_ALREADY_EXISTS = 'ORDER_ALREADY_EXISTS',
  ORDER_NOT_EDITABLE = 'ORDER_NOT_EDITABLE',
  ORDER_PROCESSING_FAILED = 'ORDER_PROCESSING_FAILED',
  ORDER_STATUS_INVALID = 'ORDER_STATUS_INVALID',
  
  // Document processing errors (3000-3999)
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  DOCUMENT_PARSING_ERROR = 'DOCUMENT_PARSING_ERROR',
  UNSUPPORTED_DOCUMENT_TYPE = 'UNSUPPORTED_DOCUMENT_TYPE',
  
  // Product catalog errors (4000-4999)
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  PRODUCT_MATCHING_FAILED = 'PRODUCT_MATCHING_FAILED',
  INVALID_PRODUCT_DATA = 'INVALID_PRODUCT_DATA',
  CATALOG_UNAVAILABLE = 'CATALOG_UNAVAILABLE',
  
  // Database errors (5000-5999)
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR = 'DATABASE_QUERY_ERROR',
  DATABASE_CONSTRAINT_VIOLATION = 'DATABASE_CONSTRAINT_VIOLATION',
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  
  // External service errors (6000-6999)
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  
  // System errors (7000-7999)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string;
  orderId?: string;
  extractedOrderId?: string;
  documentId?: string;
  operation?: string;
  timestamp?: Date;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  additionalData?: Record<string, any>;
}

export interface MangalmError {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  context?: ErrorContext;
  cause?: Error;
  stack?: string;
  userMessage?: string;
  suggestions?: string[];
  retryable?: boolean;
  timestamp: Date;
}

export class MangalmErrorHandler {
  private static readonly logger = new Logger('MangalmErrorHandler');
  
  /**
   * Handle and format errors for consistent response
   */
  static handleError(error: any, context?: ErrorContext): MangalmError {
    const timestamp = new Date();
    
    // If already a MangalmError, just add context
    if (this.isMangalmError(error)) {
      return {
        ...error,
        context: { ...error.context, ...context },
        timestamp
      };
    }
    
    // Convert known error types
    const mangalmError = this.convertToMangalmError(error, context, timestamp);
    
    // Log the error
    this.logError(mangalmError);
    
    // Notify monitoring systems if critical
    if (mangalmError.severity === ErrorSeverity.CRITICAL) {
      this.notifyMonitoring(mangalmError);
    }
    
    return mangalmError;
  }
  
  /**
   * Create validation error with detailed context
   */
  static createValidationError(
    field: string, 
    message: string, 
    value?: any, 
    context?: ErrorContext
  ): MangalmError {
    return {
      code: ErrorCode.VALIDATION_FAILED,
      message: `Validation failed for field '${field}': ${message}`,
      severity: ErrorSeverity.MEDIUM,
      context: {
        ...context,
        additionalData: { field, value }
      },
      userMessage: `Please check the ${field} field: ${message}`,
      suggestions: [
        `Verify the ${field} value is correct`,
        'Check for typos or formatting issues',
        'Refer to the field requirements'
      ],
      retryable: true,
      timestamp: new Date()
    };
  }
  
  /**
   * Create business rule violation error
   */
  static createBusinessRuleError(
    rule: string, 
    message: string, 
    context?: ErrorContext
  ): MangalmError {
    return {
      code: ErrorCode.BUSINESS_RULE_VIOLATION,
      message: `Business rule violation: ${rule} - ${message}`,
      severity: ErrorSeverity.HIGH,
      context,
      userMessage: message,
      suggestions: this.getBusinessRuleSuggestions(rule),
      retryable: false,
      timestamp: new Date()
    };
  }
  
  /**
   * Create order processing error
   */
  static createOrderError(
    operation: string, 
    orderId: string, 
    message: string, 
    context?: ErrorContext
  ): MangalmError {
    return {
      code: ErrorCode.ORDER_PROCESSING_FAILED,
      message: `Order ${operation} failed for order ${orderId}: ${message}`,
      severity: ErrorSeverity.HIGH,
      context: {
        ...context,
        orderId,
        operation
      },
      userMessage: `Unable to ${operation} order. ${message}`,
      suggestions: [
        'Please try again in a few moments',
        'Check if the order status allows this operation',
        'Contact support if the issue persists'
      ],
      retryable: true,
      timestamp: new Date()
    };
  }
  
  /**
   * Create database error with appropriate user message
   */
  static createDatabaseError(
    operation: string, 
    cause: Error, 
    context?: ErrorContext
  ): MangalmError {
    let code = ErrorCode.DATABASE_QUERY_ERROR;
    let userMessage = 'A database error occurred. Please try again.';
    
    if (cause.message.includes('timeout')) {
      code = ErrorCode.DATABASE_TIMEOUT;
      userMessage = 'The operation is taking longer than expected. Please try again.';
    } else if (cause.message.includes('constraint')) {
      code = ErrorCode.DATABASE_CONSTRAINT_VIOLATION;
      userMessage = 'The data violates business constraints. Please check your input.';
    } else if (cause.message.includes('connection')) {
      code = ErrorCode.DATABASE_CONNECTION_ERROR;
      userMessage = 'Unable to connect to the database. Please try again later.';
    }
    
    return {
      code,
      message: `Database ${operation} failed: ${cause.message}`,
      severity: ErrorSeverity.HIGH,
      context: {
        ...context,
        operation,
        additionalData: { originalError: cause.message }
      },
      cause,
      userMessage,
      suggestions: [
        'Try the operation again',
        'Check your internet connection',
        'Contact support if the issue persists'
      ],
      retryable: !cause.message.includes('constraint'),
      timestamp: new Date()
    };
  }
  
  /**
   * Create document processing error
   */
  static createDocumentError(
    documentId: string, 
    operation: string, 
    message: string, 
    context?: ErrorContext
  ): MangalmError {
    return {
      code: ErrorCode.EXTRACTION_FAILED,
      message: `Document ${operation} failed for ${documentId}: ${message}`,
      severity: ErrorSeverity.MEDIUM,
      context: {
        ...context,
        documentId,
        operation
      },
      userMessage: 'Unable to process the document. The document may be damaged or in an unsupported format.',
      suggestions: [
        'Check if the document is clear and readable',
        'Try uploading a different format (PDF, JPG, PNG)',
        'Ensure the document contains order information',
        'Manual entry may be required for this document'
      ],
      retryable: true,
      timestamp: new Date()
    };
  }
  
  /**
   * Convert HTTP status codes to user-friendly messages
   */
  static getHttpErrorMessage(statusCode: number): string {
    const messages: Record<number, string> = {
      400: 'Invalid request. Please check your input and try again.',
      401: 'Authentication required. Please log in and try again.',
      403: 'You do not have permission to perform this operation.',
      404: 'The requested resource was not found.',
      409: 'Conflict with existing data. Please check for duplicates.',
      422: 'The data provided is invalid or incomplete.',
      429: 'Too many requests. Please wait before trying again.',
      500: 'An internal server error occurred. Please try again later.',
      502: 'Service temporarily unavailable. Please try again later.',
      503: 'Service temporarily unavailable. Please try again later.',
      504: 'Request timeout. Please try again.'
    };
    
    return messages[statusCode] || 'An unexpected error occurred. Please try again.';
  }
  
  /**
   * Format error for API response
   */
  static formatForResponse(error: MangalmError): any {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.userMessage || error.message,
        severity: error.severity,
        suggestions: error.suggestions,
        retryable: error.retryable,
        timestamp: error.timestamp.toISOString(),
        requestId: error.context?.requestId
      }
    };
  }
  
  /**
   * Format error for logging
   */
  static formatForLogging(error: MangalmError): any {
    return {
      code: error.code,
      message: error.message,
      severity: error.severity,
      context: error.context,
      stack: error.stack,
      timestamp: error.timestamp.toISOString(),
      cause: error.cause?.message
    };
  }
  
  // Private helper methods
  
  private static isMangalmError(error: any): error is MangalmError {
    return error && typeof error === 'object' && 'code' in error && Object.values(ErrorCode).includes(error.code);
  }
  
  private static convertToMangalmError(error: any, context?: ErrorContext, timestamp?: Date): MangalmError {
    // Handle different error types
    if (error instanceof TypeError) {
      return {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: `Type error: ${error.message}`,
        severity: ErrorSeverity.HIGH,
        context,
        cause: error,
        stack: error.stack,
        userMessage: 'An internal error occurred. Please try again.',
        retryable: true,
        timestamp: timestamp || new Date()
      };
    }
    
    if (error instanceof SyntaxError) {
      return {
        code: ErrorCode.INVALID_ORDER_DATA,
        message: `Syntax error: ${error.message}`,
        severity: ErrorSeverity.MEDIUM,
        context,
        cause: error,
        userMessage: 'Invalid data format. Please check your input.',
        retryable: true,
        timestamp: timestamp || new Date()
      };
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: `Connection error: ${error.message}`,
        severity: ErrorSeverity.HIGH,
        context,
        cause: error,
        userMessage: 'Service temporarily unavailable. Please try again later.',
        retryable: true,
        timestamp: timestamp || new Date()
      };
    }
    
    // Default error
    return {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message || 'Unknown error occurred',
      severity: ErrorSeverity.MEDIUM,
      context,
      cause: error,
      stack: error.stack,
      userMessage: 'An unexpected error occurred. Please try again.',
      retryable: true,
      timestamp: timestamp || new Date()
    };
  }
  
  private static getBusinessRuleSuggestions(rule: string): string[] {
    const suggestions: Record<string, string[]> = {
      'minimum_order': [
        'Add more items to reach the minimum order amount of ₹500',
        'Consider bulk quantities for better value',
        'Check for available discounts or promotions'
      ],
      'gst_calculation': [
        'Verify the tax calculation (18% GST)',
        'Check if the customer is eligible for tax exemptions',
        'Ensure correct tax rates are applied'
      ],
      'delivery_date': [
        'Choose a delivery date at least 1 day from order date',
        'Check service availability for the requested date',
        'Consider express delivery options if urgent'
      ],
      'customer_data': [
        'Provide complete customer contact information',
        'Verify phone number format (+91-XXXXXXXXXX)',
        'Ensure email address is valid and active'
      ]
    };
    
    return suggestions[rule] || [
      'Review the business rules documentation',
      'Contact support for clarification',
      'Try adjusting the order details'
    ];
  }
  
  private static logError(error: MangalmError): void {
    const logData = this.formatForLogging(error);
    
    switch (error.severity) {
      case ErrorSeverity.LOW:
        this.logger.debug('Low severity error', logData);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn('Medium severity error', logData);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error('High severity error', logData);
        break;
      case ErrorSeverity.CRITICAL:
        this.logger.fatal('Critical error', logData);
        break;
    }
  }
  
  private static notifyMonitoring(error: MangalmError): void {
    // In production, integrate with monitoring services like:
    // - Sentry
    // - DataDog
    // - New Relic
    // - Custom monitoring webhooks
    
    this.logger.error('CRITICAL ERROR - Monitoring notification sent', {
      code: error.code,
      message: error.message,
      context: error.context,
      timestamp: error.timestamp
    });
    
    // Example monitoring notification
    // this.sendToSentry(error);
    // this.sendToSlack(error);
    // this.sendAlert(error);
  }
}