/**
 * @deprecated This file is deprecated and will be removed in a future release.
 * Please use enhanced-database-client.ts instead.
 */

import { enhancedDatabaseClient } from './enhanced-database-client';
import { logger } from '../../utils/logger';

// Re-export the enhancedDatabaseClient for backward compatibility
export { enhancedDatabaseClient };

// Log a warning when this file is imported
logger.warn(
  'Warning: database-client-extension.ts is deprecated. ' +
  'Please use enhanced-database-client.ts instead.'
);
