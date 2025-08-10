/**
 * Configuration for the Sales Frontend application
 */

const config = {
  // API configuration - Now using API Gateway
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  
  // Authentication configuration
  auth: {
    tokenKey: 'auth_token',
    refreshTokenKey: 'refresh_token',
    tokenExpiryKey: 'token_expiry',
  },
  
  // Feature flags
  features: {
    enablePredictions: process.env.REACT_APP_ENABLE_PREDICTIONS === 'true',
    enableCallPrioritization: process.env.REACT_APP_ENABLE_CALL_PRIORITIZATION === 'true',
    enablePerformanceMetrics: process.env.REACT_APP_ENABLE_PERFORMANCE_METRICS === 'true',
  },
  
  // UI configuration
  ui: {
    theme: process.env.REACT_APP_THEME || 'light',
    itemsPerPage: parseInt(process.env.REACT_APP_ITEMS_PER_PAGE || '10', 10),
    dateFormat: process.env.REACT_APP_DATE_FORMAT || 'YYYY-MM-DD',
    timeFormat: process.env.REACT_APP_TIME_FORMAT || 'HH:mm:ss',
    currency: process.env.REACT_APP_CURRENCY || 'USD',
  },
  
  // Service endpoints
  services: {
    apiGateway: process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:3000',
    zohoIntegration: process.env.REACT_APP_ZOHO_INTEGRATION_URL || 'http://localhost:3001',
    aiPrediction: process.env.REACT_APP_AI_PREDICTION_URL || 'http://localhost:3002',
  },
  
  // Logging configuration
  logging: {
    level: process.env.REACT_APP_LOG_LEVEL || 'info',
    enableConsole: process.env.REACT_APP_ENABLE_CONSOLE_LOGGING !== 'false',
    enableRemote: process.env.REACT_APP_ENABLE_REMOTE_LOGGING === 'true',
    remoteEndpoint: process.env.REACT_APP_REMOTE_LOGGING_ENDPOINT,
  },
};

export default config;
