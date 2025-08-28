/**
 * Cloud Run Configuration
 * Handles environment-specific configuration for Google Cloud Run deployment
 */

export interface CloudRunConfig {
  isCloudRun: boolean;
  projectId?: string;
  region?: string;
  service?: string;
  revision?: string;
  configPath?: string;
}

/**
 * Detect if running on Cloud Run
 */
export function isRunningOnCloudRun(): boolean {
  return !!(
    process.env.K_SERVICE ||
    process.env.K_REVISION ||
    process.env.K_CONFIGURATION
  );
}

/**
 * Get Cloud Run configuration
 */
export function getCloudRunConfig(): CloudRunConfig {
  const isCloudRun = isRunningOnCloudRun();
  
  if (!isCloudRun) {
    return { isCloudRun: false };
  }

  return {
    isCloudRun: true,
    projectId: process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
    region: process.env.REGION || 'us-west1',
    service: process.env.K_SERVICE,
    revision: process.env.K_REVISION,
    configPath: process.env.K_CONFIGURATION,
  };
}

/**
 * Get database configuration for Cloud Run
 */
export function getDatabaseConfig() {
  const cloudRun = getCloudRunConfig();
  
  if (cloudRun.isCloudRun) {
    // Use Unix socket connection for Cloud SQL
    return {
      host: process.env.DB_HOST || `/cloudsql/${cloudRun.projectId}:${cloudRun.region}:mangalm-db`,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'mangalm_sales',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      // Additional Cloud SQL specific settings
      ...(process.env.DB_HOST?.startsWith('/cloudsql') && {
        socketPath: process.env.DB_HOST,
        host: undefined,
      }),
    };
  }

  // Local development configuration
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'mangalm_sales',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
}

/**
 * Get service URLs based on environment
 */
export function getServiceUrls() {
  const cloudRun = getCloudRunConfig();
  
  if (cloudRun.isCloudRun) {
    const projectId = cloudRun.projectId;
    const region = cloudRun.region;
    
    return {
      aiPrediction: process.env.AI_PREDICTION_URL || `https://mangalm-ai-prediction-${projectId}.${region}.run.app`,
      zohoIntegration: process.env.ZOHO_INTEGRATION_URL || `https://mangalm-zoho-integration-${projectId}.${region}.run.app`,
      documentProcessor: process.env.DOCUMENT_PROCESSOR_URL || `https://mangalm-document-processor-${projectId}.${region}.run.app`,
    };
  }

  // Local development URLs
  return {
    aiPrediction: process.env.AI_PREDICTION_URL || 'http://localhost:3006',
    zohoIntegration: process.env.ZOHO_INTEGRATION_URL || 'http://localhost:3005',
    documentProcessor: process.env.DOCUMENT_PROCESSOR_URL || 'http://localhost:3002',
  };
}

/**
 * Get CORS configuration
 */
export function getCorsOrigin() {
  const cloudRun = getCloudRunConfig();
  
  if (cloudRun.isCloudRun) {
    return process.env.CORS_ORIGIN || `https://mangalm-sales-frontend-${cloudRun.projectId}.${cloudRun.region}.run.app`;
  }

  // Allow multiple origins in development
  return process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'];
}

/**
 * Log configuration on startup
 */
export function logConfiguration() {
  const cloudRun = getCloudRunConfig();
  
  console.log('=================================');
  console.log('Environment Configuration:');
  console.log('=================================');
  console.log(`Running on Cloud Run: ${cloudRun.isCloudRun}`);
  
  if (cloudRun.isCloudRun) {
    console.log(`Project ID: ${cloudRun.projectId}`);
    console.log(`Region: ${cloudRun.region}`);
    console.log(`Service: ${cloudRun.service}`);
    console.log(`Revision: ${cloudRun.revision}`);
  } else {
    console.log('Running in local development mode');
  }
  
  const dbConfig = getDatabaseConfig();
  console.log(`Database: ${dbConfig.database}`);
  console.log(`Database Host: ${dbConfig.host || dbConfig.socketPath || 'Not configured'}`);
  
  const serviceUrls = getServiceUrls();
  console.log(`AI Prediction Service: ${serviceUrls.aiPrediction}`);
  console.log(`Document Processor: ${serviceUrls.documentProcessor}`);
  console.log('=================================');
}

export default {
  isRunningOnCloudRun,
  getCloudRunConfig,
  getDatabaseConfig,
  getServiceUrls,
  getCorsOrigin,
  logConfiguration,
};