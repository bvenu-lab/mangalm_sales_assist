import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const rateLimiter = (options?: { max?: number; windowMs?: number }) => {
  return rateLimit({
    windowMs: options?.windowMs || config.security.rateLimitWindow,
    max: options?.max || config.security.rateLimitMax,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later'
      });
    }
  });
};