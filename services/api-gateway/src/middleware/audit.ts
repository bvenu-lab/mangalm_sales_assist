/**
 * Audit Logging Middleware for Order Management
 * Enterprise-Grade Audit Trail for Mangalm Sales Assistant API Gateway
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 */

import { Request, Response, NextFunction } from 'express';
// Auth types removed
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    storeIds?: string[];
  };
}
import { logger } from '../utils/logger';

export interface AuditEntry {
  timestamp: string;
  userId?: string;
  username?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  statusCode?: number;
  ipAddress: string;
  userAgent?: string;
  duration?: number;
  requestBody?: any;
  responseBody?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// Simple in-memory store for audit logs
// In production, use a persistent database or audit service
const auditLogs: AuditEntry[] = [];

export const auditLog = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Extract request information
  const auditEntry: Partial<AuditEntry> = {
    timestamp: new Date().toISOString(),
    userId: req.user?.id,
    username: req.user?.username,
    userRole: req.user?.role,
    action: determineAction(req.method, req.path),
    resource: determineResource(req.path),
    resourceId: extractResourceId(req.path, req.params),
    method: req.method,
    path: req.path,
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('user-agent'),
    requestBody: shouldLogRequestBody(req) ? sanitizeBody(req.body) : undefined,
    metadata: {
      query: req.query,
      params: req.params,
      headers: sanitizeHeaders(req.headers)
    }
  };

  // Capture response information
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    
    const completeAuditEntry: AuditEntry = {
      ...auditEntry,
      statusCode: res.statusCode,
      duration,
      responseBody: shouldLogResponseBody(res, body) ? sanitizeBody(body) : undefined,
      error: res.statusCode >= 400 ? extractErrorMessage(body) : undefined
    } as AuditEntry;

    // Store audit entry
    auditLogs.push(completeAuditEntry);
    
    // Log to application logger
    logAuditEntry(completeAuditEntry);
    
    // Cleanup old audit logs (keep last 10000 entries)
    if (auditLogs.length > 10000) {
      auditLogs.splice(0, auditLogs.length - 10000);
    }

    return originalSend.call(this, body);
  };

  next();
};

function determineAction(method: string, path: string): string {
  const pathLower = path.toLowerCase();
  
  if (pathLower.includes('/generate')) return 'generate_order_form';
  if (pathLower.includes('/confirm')) return 'confirm_order';
  if (pathLower.includes('/reject')) return 'reject_order';
  if (pathLower.includes('/validate')) return 'validate_order';
  if (pathLower.includes('/analytics')) return 'view_analytics';
  
  switch (method.toUpperCase()) {
    case 'GET':
      return pathLower.includes('/orders/') && !pathLower.endsWith('/orders') ? 'view_order' : 'list_orders';
    case 'POST':
      return 'create_order';
    case 'PUT':
    case 'PATCH':
      return 'update_order';
    case 'DELETE':
      return 'delete_order';
    default:
      return 'unknown_action';
  }
}

function determineResource(path: string): string {
  const pathLower = path.toLowerCase();
  
  if (pathLower.includes('/orders')) return 'order';
  if (pathLower.includes('/stores')) return 'store';
  if (pathLower.includes('/products')) return 'product';
  if (pathLower.includes('/customers')) return 'customer';
  if (pathLower.includes('/analytics')) return 'analytics';
  
  return 'unknown_resource';
}

function extractResourceId(path: string, params: any): string | undefined {
  // Try to extract UUID from path parameters
  if (params.id && isUUID(params.id)) {
    return params.id;
  }
  
  // Extract from path segments
  const segments = path.split('/');
  for (const segment of segments) {
    if (isUUID(segment)) {
      return segment;
    }
  }
  
  return undefined;
}

function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function shouldLogRequestBody(req: Request): boolean {
  const method = req.method.toUpperCase();
  const contentType = req.get('content-type') || '';
  
  // Log body for POST, PUT, PATCH requests with JSON content
  return ['POST', 'PUT', 'PATCH'].includes(method) && contentType.includes('application/json');
}

function shouldLogResponseBody(res: Response, body: any): boolean {
  // Don't log large responses or binary content
  if (typeof body === 'string' && body.length > 10000) {
    return false;
  }
  
  // Only log JSON responses with errors or important actions
  const contentType = res.get('content-type') || '';
  return contentType.includes('application/json') && (res.statusCode >= 400 || res.statusCode === 201);
}

function sanitizeBody(body: any): any {
  if (!body) return body;
  
  try {
    let sanitized = typeof body === 'string' ? JSON.parse(body) : { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'authorization'];
    
    function removeSensitiveData(obj: any): any {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(removeSensitiveData);
      }
      
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          cleaned[key] = '[REDACTED]';
        } else {
          cleaned[key] = removeSensitiveData(value);
        }
      }
      
      return cleaned;
    }
    
    return removeSensitiveData(sanitized);
  } catch (error) {
    return { error: 'Failed to sanitize body' };
  }
}

function sanitizeHeaders(headers: any): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = String(value);
    }
  }
  
  return sanitized;
}

function extractErrorMessage(body: any): string | undefined {
  if (!body) return undefined;
  
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    return parsed.error || parsed.message || 'Unknown error';
  } catch (error) {
    return 'Failed to parse error message';
  }
}

function logAuditEntry(entry: AuditEntry) {
  const logLevel = entry.statusCode && entry.statusCode >= 400 ? 'warn' : 'info';
  
  logger[logLevel]('Audit Log', {
    audit: {
      timestamp: entry.timestamp,
      user: entry.userId ? `${entry.username} (${entry.userRole})` : 'anonymous',
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      method: entry.method,
      path: entry.path,
      statusCode: entry.statusCode,
      duration: entry.duration,
      ipAddress: entry.ipAddress,
      error: entry.error
    }
  });
}

// Export function to get audit logs (for admin dashboard)
export function getAuditLogs(filters?: {
  userId?: string;
  resource?: string;
  action?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}): { logs: AuditEntry[]; total: number } {
  let filteredLogs = [...auditLogs];
  
  if (filters) {
    if (filters.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
    }
    
    if (filters.resource) {
      filteredLogs = filteredLogs.filter(log => log.resource === filters.resource);
    }
    
    if (filters.action) {
      filteredLogs = filteredLogs.filter(log => log.action === filters.action);
    }
    
    if (filters.fromDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= filters.fromDate!);
    }
    
    if (filters.toDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= filters.toDate!);
    }
  }
  
  const total = filteredLogs.length;
  const offset = filters?.offset || 0;
  const limit = filters?.limit || 100;
  
  const logs = filteredLogs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(offset, offset + limit);
  
  return { logs, total };
}