import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Database configuration
interface DatabaseConfig {
  url: string;
  apiKey: string;
}

// Prediction configuration
interface PredictionConfig {
  confidenceThreshold: string;
  historyMonths: number;
  seasonalAdjustmentEnabled: string;
  batchSize: number;
}

// Prioritization configuration
interface PrioritizationConfig {
  daysSinceOrderWeight: string;
  predictedValueWeight: string;
  confidenceWeight: string;
  geographicWeight: string;
  workloadWeight: string;
}

// Server configuration
interface ServerConfig {
  port: number;
  host: string;
  logLevel: string;
  environment: string;
  nodeEnv: string;
  serviceRegistryUrl: string;
  serviceId: string;
  serviceName: string;
}

// Services configuration
interface ServicesConfig {
  databaseOrchestrator: {
    url: string;
    apiKey?: string;
  };
  serviceRegistry: {
    url: string;
  };
  apiGateway: {
    url: string;
  };
}

// Configuration object
interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  prediction: PredictionConfig;
  prioritization: PrioritizationConfig;
  services: ServicesConfig;
  cors: {
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
  };
}

// Default configuration
const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3004', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    environment: process.env.NODE_ENV || 'development',
    nodeEnv: process.env.NODE_ENV || 'development',
    serviceRegistryUrl: process.env.SERVICE_REGISTRY_URL || 'http://localhost:3000',
    serviceId: process.env.SERVICE_ID || 'ai-prediction-service',
    serviceName: process.env.SERVICE_NAME || 'AI Prediction Service',
  },
  database: {
    url: process.env.DATABASE_URL || 'http://localhost:3002',
    apiKey: process.env.DATABASE_API_KEY || 'default-api-key',
  },
  services: {
    databaseOrchestrator: {
      url: process.env.DATABASE_ORCHESTRATOR_URL || 'http://localhost:3002',
      apiKey: process.env.DATABASE_API_KEY,
    },
    serviceRegistry: {
      url: process.env.SERVICE_REGISTRY_URL || 'http://localhost:3000',
    },
    apiGateway: {
      url: process.env.API_GATEWAY_URL || 'http://localhost:3001',
    },
  },
  prediction: {
    confidenceThreshold: process.env.PREDICTION_CONFIDENCE_THRESHOLD || '0.6',
    historyMonths: parseInt(process.env.PREDICTION_HISTORY_MONTHS || '12', 10),
    seasonalAdjustmentEnabled: process.env.PREDICTION_SEASONAL_ADJUSTMENT_ENABLED || 'true',
    batchSize: parseInt(process.env.PREDICTION_BATCH_SIZE || '32', 10),
  },
  prioritization: {
    daysSinceOrderWeight: process.env.PRIORITIZATION_DAYS_SINCE_ORDER_WEIGHT || '0.3',
    predictedValueWeight: process.env.PRIORITIZATION_PREDICTED_VALUE_WEIGHT || '0.3',
    confidenceWeight: process.env.PRIORITIZATION_CONFIDENCE_WEIGHT || '0.2',
    geographicWeight: process.env.PRIORITIZATION_GEOGRAPHIC_WEIGHT || '0.1',
    workloadWeight: process.env.PRIORITIZATION_WORKLOAD_WEIGHT || '0.1',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  },
};

export default config;
