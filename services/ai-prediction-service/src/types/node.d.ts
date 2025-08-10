declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    NODE_ENV?: 'development' | 'production' | 'test';
    SERVICE_NAME?: string;
    LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
    
    API_GATEWAY_URL?: string;
    SERVICE_REGISTRY_URL?: string;
    HEARTBEAT_INTERVAL?: string;
    
    npm_package_version?: string;
    
    DATABASE_ORCHESTRATOR_URL?: string;
    
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    
    TF_CPP_MIN_LOG_LEVEL?: string;
    
    JWT_SECRET?: string;
    JWT_EXPIRATION?: string;
    
    CORS_ORIGIN?: string;
    
    PREDICTION_CONFIDENCE_THRESHOLD?: string;
    PREDICTION_HISTORY_MONTHS?: string;
    SEASONAL_ADJUSTMENT_ENABLED?: string;
    PREDICTION_SEASONAL_ADJUSTMENT_ENABLED?: string;
    PREDICTION_BATCH_SIZE?: string;
    PREDICTION_UPDATE_INTERVAL_HOURS?: string;
    
    HOST?: string;
    SERVICE_ID?: string;
    SERVICE_NAME?: string;
    DATABASE_URL?: string;
    DATABASE_API_KEY?: string;
    
    RECOMMENDATION_MAX_ITEMS?: string;
    RECOMMENDATION_MIN_CONFIDENCE?: string;
    RECOMMENDATION_DIVERSITY_FACTOR?: string;
    
    CALL_PRIORITY_MAX_DAYS_SINCE_ORDER?: string;
    CALL_PRIORITY_GEOGRAPHIC_WEIGHT?: string;
    CALL_PRIORITY_SALES_OPPORTUNITY_WEIGHT?: string;
    CALL_PRIORITY_RELATIONSHIP_WEIGHT?: string;
    
    PERFORMANCE_METRICS_RETENTION_DAYS?: string;
    PERFORMANCE_REPORT_SCHEDULE?: string;
    
    PRIORITIZATION_DAYS_SINCE_ORDER_WEIGHT?: string;
    PRIORITIZATION_PREDICTED_VALUE_WEIGHT?: string;
    PRIORITIZATION_CONFIDENCE_WEIGHT?: string;
    PRIORITIZATION_GEOGRAPHIC_WEIGHT?: string;
    PRIORITIZATION_WORKLOAD_WEIGHT?: string;
  }

  interface Process {
    arch: string;
    argv: string[];
    env: ProcessEnv;
    exit(code?: number): never;
    platform: string;
    version: string;
    uptime(): number;
    cwd(): string;
    memoryUsage(): {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    on(event: string, listener: (...args: any[]) => void): Process;
  }

  type Platform = 'aix' | 'android' | 'darwin' | 'freebsd' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin' | 'netbsd';

  interface Timeout {
    ref(): Timeout;
    unref(): Timeout;
  }
}

declare var process: NodeJS.Process;
declare function setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
declare function clearTimeout(timeoutId: NodeJS.Timeout): void;
declare function setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
declare function clearInterval(intervalId: NodeJS.Timeout): void;
