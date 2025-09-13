/**
 * Shared Enterprise Backend Components
 * World-class microservices infrastructure
 */

// Service Discovery
export { ServiceRegistry, ServiceInstance, ServiceRegistryConfig } from './service-discovery/service-registry';
export { ServiceDiscoveryClient, ServiceClientConfig } from './service-discovery/service-client';
export { getServiceRegistry } from './service-discovery/service-registry';

// Resilience Patterns
export { 
  CircuitBreaker, 
  CircuitBreakerConfig, 
  CircuitBreakerError,
  CircuitBreakerFactory,
  CircuitState 
} from './resilience/circuit-breaker';

// Caching
export { 
  RedisCache, 
  CacheConfig, 
  CacheOptions, 
  CacheStats,
  getRedisCache 
} from './cache/redis-cache';

// Message Queue
export * from './messaging/message-queue';

// Health Checks
export * from './health/health-check';

// Distributed Tracing
export * from './tracing/distributed-tracing';

// Rate Limiting
export * from './rate-limiting/rate-limiter';

// Authentication - removed (no longer needed)

// API Versioning
export * from './api/versioning';

// Interceptors
export * from './interceptors/request-interceptor';
export * from './interceptors/response-interceptor';

// Retry Logic
export * from './resilience/retry-logic';

// Configuration
export * from './config/configuration-manager';

// Monitoring
export * from './monitoring/metrics-collector';

// Utilities
export * from './utils/logger';
export * from './utils/validator';
export * from './utils/error-handler';