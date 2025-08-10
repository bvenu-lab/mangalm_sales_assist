/**
 * Enterprise API Standards and Response Framework
 * Consistent API design patterns across all Mangalm services
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Standard API Response Envelope
 * All API responses must conform to this structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ResponseMetadata;
}

/**
 * Standard Error Structure
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: any;
  field?: string;
  stack?: string; // Only in development
}

/**
 * Response Metadata
 */
export interface ResponseMetadata {
  requestId: string;
  timestamp: string;
  version: string;
  pagination?: PaginationMeta;
  rateLimit?: RateLimitMeta;
  timing?: {
    processingTime: number;
    dbQueries?: number;
    externalCalls?: number;
  };
}

/**
 * Pagination Metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage?: number;
  prevPage?: number;
}

/**
 * Rate Limiting Metadata
 */
export interface RateLimitMeta {
  limit: number;
  remaining: number;
  resetTime: string;
  retryAfter?: number;
}

/**
 * Comprehensive Error Code Taxonomy
 */
export enum ErrorCode {
  // Authentication & Authorization (4000-4099)
  AUTHENTICATION_REQUIRED = 'AUTH_001',
  INVALID_TOKEN = 'AUTH_002',
  TOKEN_EXPIRED = 'AUTH_003',
  INSUFFICIENT_PERMISSIONS = 'AUTH_004',
  API_KEY_INVALID = 'AUTH_005',

  // Validation Errors (4100-4199)
  VALIDATION_FAILED = 'VALIDATION_001',
  REQUIRED_FIELD_MISSING = 'VALIDATION_002',
  INVALID_FORMAT = 'VALIDATION_003',
  VALUE_OUT_OF_RANGE = 'VALIDATION_004',
  INVALID_ENUM_VALUE = 'VALIDATION_005',
  DUPLICATE_VALUE = 'VALIDATION_006',

  // Resource Errors (4200-4299)
  RESOURCE_NOT_FOUND = 'RESOURCE_001',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_002',
  RESOURCE_LOCKED = 'RESOURCE_003',
  RESOURCE_DELETED = 'RESOURCE_004',
  RESOURCE_CONFLICT = 'RESOURCE_005',

  // Business Logic Errors (4300-4399)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_001',
  OPERATION_NOT_ALLOWED = 'BUSINESS_002',
  INSUFFICIENT_BALANCE = 'BUSINESS_003',
  QUOTA_EXCEEDED = 'BUSINESS_004',
  DEADLINE_EXCEEDED = 'BUSINESS_005',

  // External Service Errors (5000-5099)
  EXTERNAL_SERVICE_UNAVAILABLE = 'EXTERNAL_001',
  EXTERNAL_SERVICE_TIMEOUT = 'EXTERNAL_002',
  EXTERNAL_API_ERROR = 'EXTERNAL_003',
  ZOHO_SYNC_FAILED = 'EXTERNAL_004',
  PAYMENT_GATEWAY_ERROR = 'EXTERNAL_005',

  // System Errors (5100-5199)
  INTERNAL_SERVER_ERROR = 'SYSTEM_001',
  DATABASE_ERROR = 'SYSTEM_002',
  CACHE_ERROR = 'SYSTEM_003',
  QUEUE_ERROR = 'SYSTEM_004',
  FILE_SYSTEM_ERROR = 'SYSTEM_005',

  // Rate Limiting (4290-4299)
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  CONCURRENT_LIMIT_EXCEEDED = 'RATE_002',
  BANDWIDTH_EXCEEDED = 'RATE_003'
}

/**
 * Standard Query Parameters for List Endpoints
 */
export interface StandardQuery {
  // Pagination
  page?: number;
  limit?: number;
  offset?: number;

  // Sorting
  sort?: string; // e.g., "name", "-createdAt", "+price"
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';

  // Filtering
  filter?: string; // JSON string or simple filter
  search?: string;
  q?: string; // Quick search

  // Field Selection
  fields?: string; // Comma-separated fields
  include?: string; // Related resources to include
  exclude?: string; // Fields to exclude

  // Date Ranges
  startDate?: string;
  endDate?: string;
  dateRange?: string;

  // Common Filters
  status?: string;
  active?: boolean;
  archived?: boolean;
}

/**
 * Enterprise API Response Builder
 */
export class ApiResponseBuilder {
  private request: Request;
  private startTime: number;
  private version: string;

  constructor(req: Request, version: string = '1.0.0') {
    this.request = req;
    this.startTime = Date.now();
    this.version = version;
    
    // Ensure request has an ID
    if (!(req as any).id) {
      (req as any).id = uuidv4();
    }
  }

  /**
   * Build success response
   */
  public success<T>(data: T, pagination?: PaginationMeta): ApiResponse<T> {
    const meta: ResponseMetadata = this.buildMeta();
    if (pagination) {
      meta.pagination = pagination;
    }

    return {
      success: true,
      data,
      meta
    };
  }

  /**
   * Build error response
   */
  public error(
    code: ErrorCode,
    message: string,
    details?: any,
    field?: string
  ): ApiResponse {
    const meta: ResponseMetadata = this.buildMeta();
    const error: ApiError = {
      code,
      message,
      details,
      field
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && details instanceof Error) {
      error.stack = details.stack;
    }

    return {
      success: false,
      error,
      meta
    };
  }

  /**
   * Build validation error response
   */
  public validationError(errors: ValidationError[]): ApiResponse {
    const meta: ResponseMetadata = this.buildMeta();
    
    return {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Validation failed',
        details: errors
      },
      meta
    };
  }

  /**
   * Build metadata object
   */
  private buildMeta(): ResponseMetadata {
    const processingTime = Date.now() - this.startTime;
    
    return {
      requestId: (this.request as any).id,
      timestamp: new Date().toISOString(),
      version: this.version,
      timing: {
        processingTime
      }
    };
  }
}

/**
 * Validation Error Structure
 */
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
}

/**
 * Utility Functions
 */
export class ApiUtils {
  /**
   * Parse pagination parameters
   */
  public static parsePagination(query: StandardQuery): {
    page: number;
    limit: number;
    offset: number;
  } {
    const page = Math.max(1, parseInt(query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Parse sorting parameters
   */
  public static parseSort(query: StandardQuery): {
    field: string;
    direction: 'ASC' | 'DESC';
  } | null {
    let sortField = query.sort || query.sortBy;
    
    if (!sortField) return null;

    let direction: 'ASC' | 'DESC' = 'ASC';
    
    // Handle prefixed sort (e.g., "-createdAt", "+name")
    if (sortField.startsWith('-')) {
      direction = 'DESC';
      sortField = sortField.substring(1);
    } else if (sortField.startsWith('+')) {
      direction = 'ASC';
      sortField = sortField.substring(1);
    }

    // Handle explicit sort order
    if (query.sortOrder) {
      direction = query.sortOrder.toUpperCase() as 'ASC' | 'DESC';
    }

    return { field: sortField, direction };
  }

  /**
   * Build pagination metadata
   */
  public static buildPaginationMeta(
    page: number,
    limit: number,
    total: number
  ): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
      nextPage: hasNext ? page + 1 : undefined,
      prevPage: hasPrev ? page - 1 : undefined
    };
  }

  /**
   * Parse field selection
   */
  public static parseFields(query: StandardQuery): {
    include?: string[];
    exclude?: string[];
    fields?: string[];
  } {
    const result: any = {};

    if (query.fields) {
      result.fields = query.fields.split(',').map(f => f.trim());
    }

    if (query.include) {
      result.include = query.include.split(',').map(f => f.trim());
    }

    if (query.exclude) {
      result.exclude = query.exclude.split(',').map(f => f.trim());
    }

    return result;
  }
}

/**
 * HTTP Status Code Mappings for Error Codes
 */
export const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  // 400 Bad Request
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.REQUIRED_FIELD_MISSING]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.VALUE_OUT_OF_RANGE]: 400,
  [ErrorCode.INVALID_ENUM_VALUE]: 400,

  // 401 Unauthorized
  [ErrorCode.AUTHENTICATION_REQUIRED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.API_KEY_INVALID]: 401,

  // 403 Forbidden
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  // 404 Not Found
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,

  // 409 Conflict
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCode.DUPLICATE_VALUE]: 409,
  [ErrorCode.RESOURCE_CONFLICT]: 409,

  // 422 Unprocessable Entity
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 422,
  [ErrorCode.OPERATION_NOT_ALLOWED]: 422,
  [ErrorCode.INSUFFICIENT_BALANCE]: 422,
  [ErrorCode.DEADLINE_EXCEEDED]: 422,

  // 423 Locked
  [ErrorCode.RESOURCE_LOCKED]: 423,

  // 429 Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.CONCURRENT_LIMIT_EXCEEDED]: 429,
  [ErrorCode.BANDWIDTH_EXCEEDED]: 429,
  [ErrorCode.QUOTA_EXCEEDED]: 429,

  // 500 Internal Server Error
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CACHE_ERROR]: 500,
  [ErrorCode.QUEUE_ERROR]: 500,
  [ErrorCode.FILE_SYSTEM_ERROR]: 500,

  // 502 Bad Gateway / 503 Service Unavailable
  [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.EXTERNAL_SERVICE_TIMEOUT]: 504,
  [ErrorCode.EXTERNAL_API_ERROR]: 502,
  [ErrorCode.ZOHO_SYNC_FAILED]: 502,
  [ErrorCode.PAYMENT_GATEWAY_ERROR]: 502,

  // 410 Gone
  [ErrorCode.RESOURCE_DELETED]: 410
};

export default {
  ApiResponseBuilder,
  ApiUtils,
  ErrorCode,
  HTTP_STATUS_MAP
};