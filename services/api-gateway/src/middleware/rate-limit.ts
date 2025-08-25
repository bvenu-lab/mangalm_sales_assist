/**
 * Rate Limiting Middleware for Order Management
 * Enterprise-Grade Rate Limiting for Mangalm Sales Assistant API Gateway
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitInfo {
  totalHits: number;
  firstHit: number;
  lastHit: number;
}

// Simple in-memory store for rate limiting
// In production, use Redis for distributed rate limiting
const rateLimitStore = new Map<string, RateLimitInfo>();

export const rateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req: Request) => req.ip || 'unknown'
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const now = Date.now();
      
      // Clean up expired entries periodically
      if (Math.random() < 0.01) { // 1% chance to cleanup
        cleanupExpiredEntries(now, windowMs);
      }

      let limitInfo = rateLimitStore.get(key);

      if (!limitInfo) {
        // First request from this key
        limitInfo = {
          totalHits: 1,
          firstHit: now,
          lastHit: now
        };
        rateLimitStore.set(key, limitInfo);
      } else {
        // Check if window has expired
        if (now - limitInfo.firstHit > windowMs) {
          // Reset window
          limitInfo = {
            totalHits: 1,
            firstHit: now,
            lastHit: now
          };
          rateLimitStore.set(key, limitInfo);
        } else {
          // Increment hit count
          limitInfo.totalHits++;
          limitInfo.lastHit = now;
          rateLimitStore.set(key, limitInfo);
        }
      }

      // Set rate limit headers
      const remaining = Math.max(0, max - limitInfo.totalHits);
      const resetTime = new Date(limitInfo.firstHit + windowMs);

      res.set({
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toISOString(),
        'X-RateLimit-Used': limitInfo.totalHits.toString()
      });

      // Check if rate limit exceeded
      if (limitInfo.totalHits > max) {
        logger.warn('Rate limit exceeded', {
          key,
          hits: limitInfo.totalHits,
          limit: max,
          windowMs,
          path: req.path,
          method: req.method,
          userAgent: req.get('user-agent')
        });

        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((limitInfo.firstHit + windowMs - now) / 1000),
          limit: max,
          remaining: 0,
          resetTime: resetTime.toISOString()
        });
      }

      // Handle response tracking for skip options
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.send;
        res.send = function(body) {
          const shouldSkip = 
            (skipSuccessfulRequests && res.statusCode >= 200 && res.statusCode < 300) ||
            (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip && limitInfo) {
            limitInfo.totalHits--;
            rateLimitStore.set(key, limitInfo);
          }

          return originalSend.call(this, body);
        };
      }

      next();
    } catch (error) {
      logger.error('Rate limit middleware error', error);
      // Don't block requests on rate limit errors
      next();
    }
  };
};

// Cleanup expired entries to prevent memory leaks
function cleanupExpiredEntries(now: number, windowMs: number) {
  for (const [key, info] of rateLimitStore.entries()) {
    if (now - info.firstHit > windowMs) {
      rateLimitStore.delete(key);
    }
  }
}

// Predefined rate limiters for common use cases
export const createStandardRateLimit = () => rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // 1000 requests per 15 minutes
});

export const createStrictRateLimit = () => rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60 // 60 requests per minute
});

export const createAPIRateLimit = () => rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // 100 requests per minute
});

export const createUploadRateLimit = () => rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10 // 10 uploads per minute
});