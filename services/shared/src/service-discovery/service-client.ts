/**
 * Service Discovery Client
 * Used by services to register themselves and discover other services
 */

import axios, { AxiosInstance } from 'axios';
import { hostname } from 'os';
import { ServiceInstance } from './service-registry';

export interface ServiceClientConfig {
  registryUrl?: string;
  serviceName: string;
  serviceVersion: string;
  servicePort: number;
  serviceProtocol?: 'http' | 'https' | 'grpc';
  healthCheckPath?: string;
  metadata?: Record<string, any>;
  heartbeatInterval?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class ServiceDiscoveryClient {
  private config: Required<ServiceClientConfig>;
  private httpClient: AxiosInstance;
  private instanceId?: string;
  private heartbeatTimer?: NodeJS.Timeout;
  private isRegistered: boolean = false;
  private serviceCache: Map<string, { instances: ServiceInstance[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 10000; // 10 seconds

  constructor(config: ServiceClientConfig) {
    this.config = {
      registryUrl: config.registryUrl || process.env.SERVICE_REGISTRY_URL || 'http://localhost:8761',
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      servicePort: config.servicePort,
      serviceProtocol: config.serviceProtocol || 'http',
      healthCheckPath: config.healthCheckPath || '/health',
      metadata: config.metadata || {},
      heartbeatInterval: config.heartbeatInterval || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
    };

    this.httpClient = axios.create({
      baseURL: this.config.registryUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Auto-register on creation
    this.register().catch(console.error);

    // Handle graceful shutdown
    this.setupShutdownHandlers();
  }

  /**
   * Register this service with the registry
   */
  public async register(): Promise<void> {
    const maxRetries = this.config.retryAttempts;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const serviceInfo: Omit<ServiceInstance, 'id' | 'registeredAt' | 'lastHeartbeat'> = {
          name: this.config.serviceName,
          version: this.config.serviceVersion,
          host: this.getServiceHost(),
          port: this.config.servicePort,
          protocol: this.config.serviceProtocol,
          healthCheckUrl: `${this.config.serviceProtocol}://${this.getServiceHost()}:${this.config.servicePort}${this.config.healthCheckPath}`,
          metadata: {
            ...this.config.metadata,
            hostname: hostname(),
            pid: process.pid,
            startTime: new Date().toISOString(),
          },
          status: 'UP',
        };

        const response = await this.httpClient.post('/register', serviceInfo);
        this.instanceId = response.data.id;
        this.isRegistered = true;

        console.log(`[ServiceDiscovery] Registered ${this.config.serviceName} with ID: ${this.instanceId}`);

        // Start heartbeat
        this.startHeartbeat();
        
        return;
      } catch (error) {
        attempt++;
        console.error(`[ServiceDiscovery] Registration failed (attempt ${attempt}/${maxRetries}):`, (error as Error).message);
        
        if (attempt < maxRetries) {
          await this.sleep(this.config.retryDelay * attempt);
        }
      }
    }

    throw new Error(`Failed to register service after ${maxRetries} attempts`);
  }

  /**
   * Deregister this service from the registry
   */
  public async deregister(): Promise<void> {
    if (!this.instanceId || !this.isRegistered) {
      return;
    }

    try {
      await this.httpClient.delete(`/deregister/${this.instanceId}`);
      this.stopHeartbeat();
      this.isRegistered = false;
      console.log(`[ServiceDiscovery] Deregistered service ${this.config.serviceName}`);
    } catch (error) {
      console.error('[ServiceDiscovery] Deregistration failed:', (error as Error).message);
    }
  }

  /**
   * Discover instances of a service
   */
  public async discover(serviceName: string, useCache: boolean = true): Promise<ServiceInstance[]> {
    // Check cache first
    if (useCache) {
      const cached = this.serviceCache.get(serviceName);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.instances;
      }
    }

    try {
      const response = await this.httpClient.get(`/services/${serviceName}`);
      const instances = response.data as ServiceInstance[];
      
      // Update cache
      this.serviceCache.set(serviceName, {
        instances,
        timestamp: Date.now(),
      });

      return instances;
    } catch (error) {
      console.error(`[ServiceDiscovery] Failed to discover ${serviceName}:`, (error as Error).message);
      
      // Return cached data if available
      const cached = this.serviceCache.get(serviceName);
      if (cached) {
        return cached.instances;
      }
      
      return [];
    }
  }

  /**
   * Get URL for a service with load balancing
   */
  public async getServiceUrl(serviceName: string, path: string = ''): Promise<string | null> {
    try {
      const response = await this.httpClient.get(`/service-url/${serviceName}`, {
        params: { path },
      });
      return response.data.url;
    } catch (error) {
      console.error(`[ServiceDiscovery] Failed to get URL for ${serviceName}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Call a service with automatic discovery and retry
   */
  public async callService<T = any>(
    serviceName: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      path: string;
      data?: any;
      headers?: Record<string, string>;
      timeout?: number;
    }
  ): Promise<T> {
    const maxRetries = this.config.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const instances = await this.discover(serviceName);
      
      if (instances.length === 0) {
        throw new Error(`No instances available for service: ${serviceName}`);
      }

      // Simple round-robin selection
      const instance = instances[attempt % instances.length];
      const url = `${instance.protocol}://${instance.host}:${instance.port}${options.path}`;

      try {
        const response = await axios({
          method: options.method,
          url,
          data: options.data,
          headers: options.headers,
          timeout: options.timeout || 10000,
        });

        return response.data;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[ServiceDiscovery] Call to ${serviceName} failed (attempt ${attempt + 1}/${maxRetries}):`, lastError.message);
        
        // Mark instance as unhealthy if it's a connection error
        if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
          await this.reportUnhealthyInstance(instance.id);
        }

        if (attempt < maxRetries - 1) {
          await this.sleep(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError || new Error(`Failed to call service ${serviceName} after ${maxRetries} attempts`);
  }

  /**
   * Check if a service is available
   */
  public async isServiceAvailable(serviceName: string): Promise<boolean> {
    const instances = await this.discover(serviceName);
    return instances.length > 0;
  }

  /**
   * Wait for a service to become available
   */
  public async waitForService(serviceName: string, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await this.isServiceAvailable(serviceName)) {
        return;
      }
      await this.sleep(1000);
    }

    throw new Error(`Service ${serviceName} not available after ${timeout}ms`);
  }

  /**
   * Update service metadata
   */
  public async updateMetadata(metadata: Record<string, any>): Promise<void> {
    if (!this.instanceId || !this.isRegistered) {
      return;
    }

    try {
      await this.httpClient.put(`/services/${this.instanceId}/metadata`, metadata);
      this.config.metadata = { ...this.config.metadata, ...metadata };
    } catch (error) {
      console.error('[ServiceDiscovery] Failed to update metadata:', (error as Error).message);
    }
  }

  /**
   * Update service status
   */
  public async updateStatus(status: 'UP' | 'DOWN' | 'OUT_OF_SERVICE'): Promise<void> {
    if (!this.instanceId || !this.isRegistered) {
      return;
    }

    try {
      await this.httpClient.put(`/services/${this.instanceId}/status`, { status });
    } catch (error) {
      console.error('[ServiceDiscovery] Failed to update status:', (error as Error).message);
    }
  }

  /**
   * Get all available services
   */
  public async getAllServices(): Promise<Map<string, ServiceInstance[]>> {
    try {
      const response = await this.httpClient.get('/services');
      return new Map(Object.entries(response.data));
    } catch (error) {
      console.error('[ServiceDiscovery] Failed to get all services:', (error as Error).message);
      return new Map();
    }
  }

  // Private methods

  private startHeartbeat(): void {
    this.stopHeartbeat();

    const sendHeartbeat = async () => {
      if (!this.instanceId || !this.isRegistered) {
        return;
      }

      try {
        // Include current metrics in heartbeat
        const metrics = this.getServiceMetrics();
        
        await this.httpClient.put(`/heartbeat/${this.instanceId}`, {
          load: metrics.load,
          responseTime: metrics.responseTime,
          metadata: {
            ...this.config.metadata,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
          },
        });
      } catch (error) {
        console.error('[ServiceDiscovery] Heartbeat failed:', (error as Error).message);
        
        // Try to re-register if heartbeat fails
        if (this.isRegistered) {
          this.isRegistered = false;
          this.register().catch(console.error);
        }
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Schedule periodic heartbeats
    this.heartbeatTimer = setInterval(sendHeartbeat, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private getServiceHost(): string {
    // In Docker, use the container name or service name
    if (process.env.DOCKER_CONTAINER_NAME) {
      return process.env.DOCKER_CONTAINER_NAME;
    }

    // In Kubernetes, use the pod IP
    if (process.env.KUBERNETES_POD_IP) {
      return process.env.KUBERNETES_POD_IP;
    }

    // Default to localhost for local development
    return process.env.SERVICE_HOST || 'localhost';
  }

  private getServiceMetrics(): { load: number; responseTime: number } {
    // Calculate simple load metric based on event loop lag
    const load = Math.min(100, Math.max(0, process.cpuUsage().system / 1000000));
    
    // This would be replaced with actual response time tracking
    const responseTime = Math.random() * 100; // Placeholder

    return { load, responseTime };
  }

  private async reportUnhealthyInstance(instanceId: string): Promise<void> {
    try {
      await this.httpClient.post(`/services/${instanceId}/report-unhealthy`);
    } catch (error) {
      // Ignore errors when reporting unhealthy instances
    }
  }

  private setupShutdownHandlers(): void {
    const gracefulShutdown = async () => {
      console.log('[ServiceDiscovery] Graceful shutdown initiated');
      await this.deregister();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown); // For nodemon
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a circuit breaker for service calls
   */
  public createCircuitBreaker(serviceName: string, options?: {
    threshold?: number;
    timeout?: number;
    resetTimeout?: number;
  }) {
    // This will be implemented in the circuit-breaker.ts file
    // Placeholder for now
    return {
      call: async <T>(fn: () => Promise<T>): Promise<T> => {
        return fn();
      },
    };
  }
}

export default ServiceDiscoveryClient;