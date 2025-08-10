/**
 * Enterprise API Versioning and Advanced Query System
 * Comprehensive versioning, pagination, filtering, and sorting
 */

import { Request, Response, NextFunction, Router } from 'express';
import { ApiResponseBuilder, StandardQuery } from './api-standards';
import { AppError, ErrorCode, ErrorFactory } from './error-handler';
import { logger } from '../utils/logger';

/**
 * API Version Configuration
 */
export interface VersionConfig {
  version: string;
  isDeprecated: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  description: string;
  changelog?: string[];
}

/**
 * Query Parser Result
 */
export interface ParsedQuery {
  pagination: {
    page: number;
    limit: number;
    offset: number;
  };
  sorting: {
    field: string;
    direction: 'ASC' | 'DESC';
  } | null;
  filtering: {
    search?: string;
    filters: Record<string, any>;
    dateRange?: {
      startDate: Date;
      endDate: Date;
    };
  };
  fields: {
    include?: string[];
    exclude?: string[];
    select?: string[];
  };
  metadata: {
    requestedFields: string[];
    hasComplexFilters: boolean;
    requiresJoins: boolean;
  };
}

/**
 * Database Query Builder Interface
 */
export interface QueryBuilder {
  select(fields: string[]): QueryBuilder;
  where(field: string, operator: string, value: any): QueryBuilder;
  whereBetween(field: string, start: any, end: any): QueryBuilder;
  whereIn(field: string, values: any[]): QueryBuilder;
  whereLike(field: string, pattern: string): QueryBuilder;
  orderBy(field: string, direction: 'ASC' | 'DESC'): QueryBuilder;
  limit(count: number): QueryBuilder;
  offset(count: number): QueryBuilder;
  leftJoin(table: string, localKey: string, foreignKey: string): QueryBuilder;
  count(): Promise<number>;
  execute(): Promise<any[]>;
}

/**
 * API Version Manager
 */
export class ApiVersionManager {
  private versions: Map<string, VersionConfig> = new Map();
  private currentVersion: string;

  constructor(currentVersion: string = '1.0.0') {
    this.currentVersion = currentVersion;
    
    // Register default version
    this.registerVersion({
      version: currentVersion,
      isDeprecated: false,
      description: 'Current stable version',
      changelog: ['Initial release']
    });
  }

  /**
   * Register a new API version
   */
  public registerVersion(config: VersionConfig): void {
    this.versions.set(config.version, config);
    logger.info(`API version registered: ${config.version}`, { config });
  }

  /**
   * Get version from request
   */
  public extractVersion(req: Request): string {
    // Check header first
    const headerVersion = req.headers['api-version'] as string;
    if (headerVersion && this.versions.has(headerVersion)) {
      return headerVersion;
    }

    // Check query parameter
    const queryVersion = req.query['v'] as string;
    if (queryVersion && this.versions.has(queryVersion)) {
      return queryVersion;
    }

    // Check URL path (e.g., /api/v1/users)
    const pathMatch = req.path.match(/^\/api\/v(\d+(?:\.\d+)*)\//);
    if (pathMatch) {
      const pathVersion = pathMatch[1];
      // Normalize version (e.g., "1" -> "1.0.0")
      const normalizedVersion = this.normalizeVersion(pathVersion);
      if (this.versions.has(normalizedVersion)) {
        return normalizedVersion;
      }
    }

    // Default to current version
    return this.currentVersion;
  }

  /**
   * Version middleware
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const version = this.extractVersion(req);
      const versionConfig = this.versions.get(version);

      if (!versionConfig) {
        return next(ErrorFactory.invalidFormat('api-version', 'supported version'));
      }

      // Set version in request
      (req as any).apiVersion = version;
      (req as any).versionConfig = versionConfig;

      // Add version headers
      res.set('API-Version', version);
      res.set('API-Supported-Versions', Array.from(this.versions.keys()).join(', '));

      // Handle deprecated versions
      if (versionConfig.isDeprecated) {
        res.set('API-Deprecation', 'true');
        if (versionConfig.deprecationDate) {
          res.set('API-Deprecation-Date', versionConfig.deprecationDate.toISOString());
        }
        if (versionConfig.sunsetDate) {
          res.set('API-Sunset', versionConfig.sunsetDate.toISOString());
        }

        logger.warn('Deprecated API version used', {
          version,
          url: req.originalUrl,
          userAgent: req.get('user-agent'),
          ip: req.ip
        });

        // Check if version is past sunset date
        if (versionConfig.sunsetDate && new Date() > versionConfig.sunsetDate) {
          return next(new AppError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            `API version ${version} has been sunset`,
            { context: { version, sunsetDate: versionConfig.sunsetDate } }
          ));
        }
      }

      next();
    };
  }

  /**
   * Normalize version string
   */
  private normalizeVersion(version: string): string {
    const parts = version.split('.');
    while (parts.length < 3) {
      parts.push('0');
    }
    return parts.join('.');
  }

  /**
   * Get all versions info
   */
  public getVersions(): VersionConfig[] {
    return Array.from(this.versions.values());
  }

  /**
   * Deprecate a version
   */
  public deprecateVersion(version: string, sunsetDate?: Date): void {
    const config = this.versions.get(version);
    if (config) {
      config.isDeprecated = true;
      config.deprecationDate = new Date();
      if (sunsetDate) {
        config.sunsetDate = sunsetDate;
      }
      this.versions.set(version, config);
    }
  }
}

/**
 * Advanced Query Parser
 */
export class QueryParser {
  /**
   * Parse standard query parameters
   */
  public static parseQuery(query: StandardQuery): ParsedQuery {
    const result: ParsedQuery = {
      pagination: this.parsePagination(query),
      sorting: this.parseSorting(query),
      filtering: this.parseFiltering(query),
      fields: this.parseFields(query),
      metadata: {
        requestedFields: [],
        hasComplexFilters: false,
        requiresJoins: false
      }
    };

    // Analyze metadata
    result.metadata = this.analyzeQuery(result, query);

    return result;
  }

  /**
   * Parse pagination parameters
   */
  private static parsePagination(query: StandardQuery): { page: number; limit: number; offset: number } {
    let page = 1;
    let limit = 20;

    // Parse page
    if (query.page) {
      const parsedPage = parseInt(query.page.toString());
      if (parsedPage > 0) {
        page = parsedPage;
      }
    }

    // Parse limit with bounds
    if (query.limit) {
      const parsedLimit = parseInt(query.limit.toString());
      if (parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit;
      }
    }

    // Handle offset override
    let offset = (page - 1) * limit;
    if (query.offset) {
      const parsedOffset = parseInt(query.offset.toString());
      if (parsedOffset >= 0) {
        offset = parsedOffset;
        page = Math.floor(offset / limit) + 1;
      }
    }

    return { page, limit, offset };
  }

  /**
   * Parse sorting parameters
   */
  private static parseSorting(query: StandardQuery): { field: string; direction: 'ASC' | 'DESC' } | null {
    let sortField = query.sort || query.sortBy;
    
    if (!sortField) return null;

    let direction: 'ASC' | 'DESC' = 'ASC';
    
    // Handle prefixed sort (e.g., "-createdAt", "+name")
    if (typeof sortField === 'string') {
      if (sortField.startsWith('-')) {
        direction = 'DESC';
        sortField = sortField.substring(1);
      } else if (sortField.startsWith('+')) {
        direction = 'ASC';
        sortField = sortField.substring(1);
      }
    }

    // Handle explicit sort order
    if (query.sortOrder) {
      direction = query.sortOrder.toUpperCase() as 'ASC' | 'DESC';
    }

    // Validate sort field (basic security)
    if (typeof sortField !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(sortField)) {
      return null;
    }

    return { field: sortField, direction };
  }

  /**
   * Parse filtering parameters
   */
  private static parseFiltering(query: StandardQuery): {
    search?: string;
    filters: Record<string, any>;
    dateRange?: { startDate: Date; endDate: Date };
  } {
    const result: any = {
      filters: {}
    };

    // Search term
    if (query.search || query.q) {
      result.search = (query.search || query.q)?.toString().trim();
    }

    // Date range
    if (query.startDate || query.endDate) {
      const dateRange: any = {};
      
      if (query.startDate) {
        const startDate = new Date(query.startDate.toString());
        if (!isNaN(startDate.getTime())) {
          dateRange.startDate = startDate;
        }
      }
      
      if (query.endDate) {
        const endDate = new Date(query.endDate.toString());
        if (!isNaN(endDate.getTime())) {
          dateRange.endDate = endDate;
        }
      }
      
      if (dateRange.startDate || dateRange.endDate) {
        result.dateRange = dateRange;
      }
    }

    // Status filters
    if (query.status) {
      result.filters.status = query.status.toString();
    }

    if (query.active !== undefined) {
      result.filters.active = query.active === 'true' || query.active === true;
    }

    if (query.archived !== undefined) {
      result.filters.archived = query.archived === 'true' || query.archived === true;
    }

    // Complex filter JSON
    if (query.filter) {
      try {
        const complexFilters = JSON.parse(query.filter.toString());
        if (typeof complexFilters === 'object') {
          Object.assign(result.filters, complexFilters);
        }
      } catch (error) {
        logger.warn('Invalid filter JSON provided', { 
          filter: query.filter,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return result;
  }

  /**
   * Parse field selection parameters
   */
  private static parseFields(query: StandardQuery): {
    include?: string[];
    exclude?: string[];
    select?: string[];
  } {
    const result: any = {};

    if (query.fields) {
      result.select = query.fields.toString()
        .split(',')
        .map(f => f.trim())
        .filter(f => f && /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(f));
    }

    if (query.include) {
      result.include = query.include.toString()
        .split(',')
        .map(f => f.trim())
        .filter(f => f && /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(f));
    }

    if (query.exclude) {
      result.exclude = query.exclude.toString()
        .split(',')
        .map(f => f.trim())
        .filter(f => f && /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(f));
    }

    return result;
  }

  /**
   * Analyze query complexity and requirements
   */
  private static analyzeQuery(parsedQuery: ParsedQuery, originalQuery: StandardQuery): {
    requestedFields: string[];
    hasComplexFilters: boolean;
    requiresJoins: boolean;
  } {
    const requestedFields = parsedQuery.fields.select || [];
    const hasComplexFilters = Object.keys(parsedQuery.filtering.filters).length > 2 || !!parsedQuery.filtering.search;
    const requiresJoins = !!(parsedQuery.fields.include?.length);

    return {
      requestedFields,
      hasComplexFilters,
      requiresJoins
    };
  }
}

/**
 * Database Query Builder Implementation
 */
export class StandardQueryBuilder implements QueryBuilder {
  private query: any = {};
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.query = {
      table: tableName,
      select: ['*'],
      where: [],
      joins: [],
      orderBy: [],
      limitValue: null,
      offsetValue: 0
    };
  }

  select(fields: string[]): QueryBuilder {
    this.query.select = fields;
    return this;
  }

  where(field: string, operator: string, value: any): QueryBuilder {
    this.query.where.push({ field, operator, value, type: 'AND' });
    return this;
  }

  whereBetween(field: string, start: any, end: any): QueryBuilder {
    this.query.where.push({ 
      field, 
      operator: 'BETWEEN', 
      value: [start, end],
      type: 'AND'
    });
    return this;
  }

  whereIn(field: string, values: any[]): QueryBuilder {
    this.query.where.push({ 
      field, 
      operator: 'IN', 
      value: values,
      type: 'AND'
    });
    return this;
  }

  whereLike(field: string, pattern: string): QueryBuilder {
    this.query.where.push({ 
      field, 
      operator: 'LIKE', 
      value: `%${pattern}%`,
      type: 'AND'
    });
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC'): QueryBuilder {
    this.query.orderBy.push({ field, direction });
    return this;
  }

  limit(count: number): QueryBuilder {
    this.query.limitValue = count;
    return this;
  }

  offset(count: number): QueryBuilder {
    this.query.offsetValue = count;
    return this;
  }

  leftJoin(table: string, localKey: string, foreignKey: string): QueryBuilder {
    this.query.joins.push({ 
      type: 'LEFT JOIN',
      table,
      condition: `${this.tableName}.${localKey} = ${table}.${foreignKey}`
    });
    return this;
  }

  async count(): Promise<number> {
    // This would execute count query
    // Implementation depends on your database library
    return 0;
  }

  async execute(): Promise<any[]> {
    // This would execute the query
    // Implementation depends on your database library
    return [];
  }

  /**
   * Get built query object (for testing/debugging)
   */
  public getQuery(): any {
    return this.query;
  }
}

/**
 * Advanced Query Middleware
 */
export function parseQueryMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const parsedQuery = QueryParser.parseQuery(req.query as StandardQuery);
    (req as any).parsedQuery = parsedQuery;

    // Add helpful metadata to response headers (development only)
    if (process.env.NODE_ENV === 'development') {
      res.set('X-Query-Complexity', parsedQuery.metadata.hasComplexFilters ? 'high' : 'low');
      res.set('X-Query-Fields', parsedQuery.metadata.requestedFields.length.toString());
    }

    next();
  } catch (error) {
    next(ErrorFactory.invalidFormat('query', 'valid query parameters'));
  }
}

/**
 * Build database query from parsed parameters
 */
export function buildQueryFromParsed(
  parsedQuery: ParsedQuery,
  tableName: string,
  allowedFields: string[] = [],
  allowedSortFields: string[] = []
): StandardQueryBuilder {
  const queryBuilder = new StandardQueryBuilder(tableName);

  // Apply field selection
  if (parsedQuery.fields.select?.length) {
    const validFields = allowedFields.length 
      ? parsedQuery.fields.select.filter(f => allowedFields.includes(f))
      : parsedQuery.fields.select;
    
    if (validFields.length) {
      queryBuilder.select(validFields);
    }
  }

  // Apply filtering
  Object.entries(parsedQuery.filtering.filters).forEach(([field, value]) => {
    if (!allowedFields.length || allowedFields.includes(field)) {
      if (Array.isArray(value)) {
        queryBuilder.whereIn(field, value);
      } else if (typeof value === 'string' && value.includes('*')) {
        queryBuilder.whereLike(field, value.replace(/\*/g, ''));
      } else {
        queryBuilder.where(field, '=', value);
      }
    }
  });

  // Apply date range
  if (parsedQuery.filtering.dateRange) {
    const { startDate, endDate } = parsedQuery.filtering.dateRange;
    if (startDate && endDate) {
      queryBuilder.whereBetween('createdAt', startDate, endDate);
    } else if (startDate) {
      queryBuilder.where('createdAt', '>=', startDate);
    } else if (endDate) {
      queryBuilder.where('createdAt', '<=', endDate);
    }
  }

  // Apply search
  if (parsedQuery.filtering.search && allowedFields.includes('name')) {
    queryBuilder.whereLike('name', parsedQuery.filtering.search);
  }

  // Apply sorting
  if (parsedQuery.sorting) {
    const { field, direction } = parsedQuery.sorting;
    if (!allowedSortFields.length || allowedSortFields.includes(field)) {
      queryBuilder.orderBy(field, direction);
    }
  }

  // Apply pagination
  queryBuilder
    .limit(parsedQuery.pagination.limit)
    .offset(parsedQuery.pagination.offset);

  return queryBuilder;
}

/**
 * Helper function to create versioned router
 */
export function createVersionedRouter(version: string): Router {
  const router = Router();
  
  // Add version middleware to all routes in this router
  router.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).routeVersion = version;
    res.set('Route-Version', version);
    next();
  });
  
  return router;
}

export default {
  ApiVersionManager,
  QueryParser,
  StandardQueryBuilder,
  parseQueryMiddleware,
  buildQueryFromParsed,
  createVersionedRouter
};