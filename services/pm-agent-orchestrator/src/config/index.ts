// Configuration settings for the PM Agent Orchestrator service

// Load environment variables
const env = process.env.NODE_ENV || 'development';

// Service configuration
export const config = {
  env,
  port: process.env.PORT || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'pm_agent_orchestrator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  },
  
  // Service registry configuration
  serviceRegistry: {
    url: process.env.SERVICE_REGISTRY_URL || 'http://localhost:4000',
    serviceName: 'pm-agent-orchestrator',
    serviceVersion: '1.0.0',
    healthCheckInterval: 30000 // 30 seconds
  }
};
