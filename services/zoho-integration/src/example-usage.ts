/**
 * Example Usage of Enterprise Zoho Integration
 * Demonstrates world-class integration capabilities
 */

import { EnterpriseSyncOrchestrator } from './services/enterprise-sync-orchestrator';
import { ZohoModule } from './services/zoho/zoho-types';
import { logger } from './utils/logger';

// Example configuration for enterprise deployment
const config = {
  zoho: {
    apiDomain: 'www.zohoapis.com',
    clientId: process.env.ZOHO_CLIENT_ID!,
    clientSecret: process.env.ZOHO_CLIENT_SECRET!,
    refreshToken: process.env.ZOHO_REFRESH_TOKEN!
  },
  webhook: {
    port: 3001,
    path: '/zoho/webhooks',
    secret: process.env.WEBHOOK_SECRET!,
    enableBatching: true,
    batchSize: 50
  },
  sync: {
    enableScheduled: true,
    cronExpression: '0 2 * * *', // Daily at 2 AM
    modules: [ZohoModule.ACCOUNTS, ZohoModule.PRODUCTS, ZohoModule.INVOICES],
    conflictResolution: 'merge' as const
  },
  cache: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    }
  },
  rateLimiting: {
    windowMs: 60000, // 1 minute
    max: 100 // 100 requests per minute per IP
  },
  circuitBreaker: {
    timeout: 30000, // 30 seconds
    errorThresholdPercentage: 50,
    resetTimeout: 60000 // 1 minute
  }
};

/**
 * Example: Initialize and start enterprise Zoho integration
 */
async function initializeEnterpriseIntegration() {
  try {
    console.log('🚀 Starting Enterprise Zoho Integration...');
    
    // Create orchestrator instance
    const orchestrator = new EnterpriseSyncOrchestrator(config);

    // Set up event handlers
    setupEventHandlers(orchestrator);

    // Start the orchestrator
    await orchestrator.start();
    
    console.log('✅ Enterprise Zoho Integration started successfully');
    
    // Example: Trigger initial full sync
    await performInitialSync(orchestrator);
    
    // Example: Monitor system health
    await monitorSystemHealth(orchestrator);
    
    // Example: Handle conflicts
    await demonstrateConflictResolution(orchestrator);
    
  } catch (error) {
    console.error('❌ Failed to start integration:', error);
    process.exit(1);
  }
}

/**
 * Set up event handlers for monitoring and logging
 */
function setupEventHandlers(orchestrator: EnterpriseSyncOrchestrator) {
  // Sync events
  orchestrator.on('moduleSyncCompleted', (data) => {
    console.log(`📊 Module sync completed: ${data.module}`, {
      processed: data.result.processed,
      created: data.result.created,
      updated: data.result.updated,
      failed: data.result.failed
    });
  });

  // Webhook events
  orchestrator.on('webhookReceived', (event) => {
    console.log(`📡 Webhook received: ${event.module} ${event.operation}`, {
      recordId: event.recordId
    });
  });

  // Conflict events
  orchestrator.on('conflictDetected', (conflict) => {
    console.log(`⚠️  Conflict detected: ${conflict.module}`, {
      conflictFields: conflict.conflictFields.length,
      recordId: conflict.zohoData?.id
    });
  });

  // Validation events
  orchestrator.on('validationFailed', (data) => {
    console.log(`🔍 Validation failed: ${data.module}`, {
      errors: data.result.errors.length,
      warnings: data.result.warnings.length
    });
  });

  // System events
  orchestrator.on('started', () => {
    console.log('🎉 Enterprise Sync Orchestrator is now active');
  });
}

/**
 * Perform initial full synchronization
 */
async function performInitialSync(orchestrator: EnterpriseSyncOrchestrator) {
  try {
    console.log('\n📥 Starting initial full synchronization...');
    
    const result = await orchestrator.triggerFullSync({
      direction: 'bidirectional',
      validateData: true
    });
    
    console.log('✅ Initial sync completed:', {
      modulesProcessed: result.summary.modulesProcessed,
      recordsProcessed: result.summary.recordsProcessed,
      duration: `${result.summary.duration}ms`,
      errors: result.summary.errors
    });
    
  } catch (error) {
    console.error('❌ Initial sync failed:', error);
  }
}

/**
 * Monitor system health continuously
 */
async function monitorSystemHealth(orchestrator: EnterpriseSyncOrchestrator) {
  console.log('\n🏥 Starting health monitoring...');
  
  setInterval(async () => {
    try {
      const health = await orchestrator.getSystemHealth();
      
      if (health.overall !== 'healthy') {
        console.warn(`⚠️  System health: ${health.overall}`, health.components);
      } else {
        console.log('💚 System healthy - all components operational');
      }
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }, 30000); // Check every 30 seconds
}

/**
 * Demonstrate conflict resolution capabilities
 */
async function demonstrateConflictResolution(orchestrator: EnterpriseSyncOrchestrator) {
  console.log('\n🔧 Setting up conflict resolution monitoring...');
  
  // Monitor for conflicts and auto-resolve simple ones
  orchestrator.on('conflictDetected', async (conflict) => {
    try {
      // Auto-resolve conflicts with only 1-2 fields different
      if (conflict.conflictFields.length <= 2) {
        console.log(`🔄 Auto-resolving simple conflict: ${conflict.conflictId}`);
        await orchestrator.resolveConflict(conflict.conflictId, 'merge');
      } else {
        console.log(`👤 Complex conflict requires manual resolution: ${conflict.conflictId}`);
        // In a real application, this would notify administrators
      }
      
    } catch (error) {
      console.error('❌ Conflict resolution failed:', error);
    }
  });
}

/**
 * Example: Advanced data quality monitoring
 */
async function monitorDataQuality(orchestrator: EnterpriseSyncOrchestrator) {
  console.log('\n📊 Starting data quality monitoring...');
  
  setInterval(() => {
    const qualityMetrics = orchestrator.getDataQualityMetrics();
    
    for (const [module, metrics] of Object.entries(qualityMetrics)) {
      if (metrics.validity < 95) {
        console.warn(`📉 Data quality issue in ${module}:`, {
          validity: `${metrics.validity.toFixed(1)}%`,
          completeness: `${metrics.completeness.toFixed(1)}%`,
          totalRecords: metrics.totalRecords
        });
      }
    }
  }, 60000); // Check every minute
}

/**
 * Example: Custom webhook handling
 */
function setupCustomWebhookHandling(orchestrator: EnterpriseSyncOrchestrator) {
  orchestrator.on('webhookEventProcessed', (event) => {
    // Custom business logic based on webhook events
    switch (event.operation) {
      case 'create':
        console.log(`➕ New ${event.module} created: ${event.recordId}`);
        // Trigger custom workflows, notifications, etc.
        break;
        
      case 'update':
        console.log(`✏️  ${event.module} updated: ${event.recordId}`);
        // Update related systems, clear caches, etc.
        break;
        
      case 'delete':
        console.log(`🗑️  ${event.module} deleted: ${event.recordId}`);
        // Cleanup related data, audit trail, etc.
        break;
    }
  });
}

/**
 * Example: Backup and recovery operations
 */
async function demonstrateBackupRecovery() {
  // This would be implemented with the BackupRecoveryService
  console.log('💾 Backup and recovery capabilities are available');
  console.log('- Automated daily backups');
  console.log('- Point-in-time recovery');
  console.log('- Incremental backup support');
  console.log('- Data integrity verification');
}

// Main execution
if (require.main === module) {
  initializeEnterpriseIntegration().catch(console.error);
}

export {
  initializeEnterpriseIntegration,
  config as exampleConfig
};