/**
 * Extended Process interface to add missing TypeScript definitions
 */
declare namespace NodeJS {
  interface Process {
    /**
     * CPU usage information
     */
    cpuUsage(previousValue?: { user: number; system: number }): { user: number; system: number };
    
    /**
     * Process ID
     */
    pid: number;
    
    /**
     * Node.js version
     */
    version: string;
  }

  interface ProcessEnv {
    [key: string]: string | undefined;
    NODE_ENV?: string;
    PORT?: string;
    HOST?: string;
    LOG_LEVEL?: string;
    SERVICE_REGISTRY_URL?: string;
    SERVICE_ID?: string;
    SERVICE_NAME?: string;
    DATABASE_URL?: string;
    DATABASE_API_KEY?: string;
    DATABASE_ORCHESTRATOR_URL?: string;
    API_GATEWAY_URL?: string;
    PREDICTION_CONFIDENCE_THRESHOLD?: string;
    PREDICTION_HISTORY_MONTHS?: string;
    PREDICTION_SEASONAL_ADJUSTMENT_ENABLED?: string;
    PREDICTION_BATCH_SIZE?: string;
    PRIORITIZATION_DAYS_SINCE_ORDER_WEIGHT?: string;
    PRIORITIZATION_PREDICTED_VALUE_WEIGHT?: string;
    PRIORITIZATION_CONFIDENCE_WEIGHT?: string;
    PRIORITIZATION_GEOGRAPHIC_WEIGHT?: string;
    PRIORITIZATION_WORKLOAD_WEIGHT?: string;
    CORS_ORIGIN?: string;
    npm_package_version?: string;
  }

  interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  }
}
