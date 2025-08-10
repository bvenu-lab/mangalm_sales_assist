/**
 * World-class Service Discovery and Registry
 * Implements Netflix Eureka-style service registration with health checks
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface ServiceInstance {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc';
  healthCheckUrl?: string;
  metadata: Record<string, any>;
  status: 'UP' | 'DOWN' | 'STARTING' | 'OUT_OF_SERVICE';
  lastHeartbeat: Date;
  registeredAt: Date;
  load?: number; // Current load (0-100)
  responseTime?: number; // Average response time in ms
}

export interface ServiceRegistryConfig {
  heartbeatInterval?: number;
  healthCheckInterval?: number;
  deregistrationTimeout?: number;
  loadBalancingStrategy?: 'ROUND_ROBIN' | 'LEAST_CONNECTIONS' | 'WEIGHTED' | 'RANDOM';
  enableMetrics?: boolean;
}

export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInstance[]> = new Map();
  private healthCheckers: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();
  private config: Required<ServiceRegistryConfig>;
  
  constructor(config: ServiceRegistryConfig = {}) {
    super();
    
    this.config = {
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
      healthCheckInterval: config.healthCheckInterval || 10000, // 10 seconds
      deregistrationTimeout: config.deregistrationTimeout || 90000, // 90 seconds
      loadBalancingStrategy: config.loadBalancingStrategy || 'ROUND_ROBIN',
      enableMetrics: config.enableMetrics !== false,
    };
    
    this.startCleanupTask();
  }

  /**
   * Register a service instance
   */
  public register(service: Omit<ServiceInstance, 'id' | 'registeredAt' | 'lastHeartbeat'>): ServiceInstance {
    const instance: ServiceInstance = {
      ...service,
      id: uuidv4(),
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
      status: service.status || 'STARTING',
    };

    const instances = this.services.get(service.name) || [];
    instances.push(instance);
    this.services.set(service.name, instances);

    // Start health checking
    if (instance.healthCheckUrl) {
      this.startHealthCheck(instance);
    }

    // Start heartbeat timer
    this.startHeartbeatTimer(instance);

    this.emit('service:registered', instance);
    
    console.log(`[ServiceRegistry] Registered service: ${service.name} at ${service.host}:${service.port}`);
    
    return instance;
  }

  /**
   * Deregister a service instance
   */
  public deregister(serviceId: string): boolean {
    for (const [serviceName, instances] of this.services.entries()) {
      const index = instances.findIndex(i => i.id === serviceId);
      
      if (index !== -1) {
        const instance = instances[index];
        instances.splice(index, 1);
        
        if (instances.length === 0) {
          this.services.delete(serviceName);
        }

        // Stop health checking
        this.stopHealthCheck(serviceId);
        this.stopHeartbeatTimer(serviceId);

        this.emit('service:deregistered', instance);
        
        console.log(`[ServiceRegistry] Deregistered service: ${instance.name} (${serviceId})`);
        
        return true;
      }
    }
    
    return false;
  }

  /**
   * Update service heartbeat
   */
  public heartbeat(serviceId: string, metadata?: Partial<ServiceInstance>): boolean {
    const instance = this.findInstanceById(serviceId);
    
    if (instance) {
      instance.lastHeartbeat = new Date();
      instance.status = 'UP';
      
      if (metadata) {
        Object.assign(instance, metadata);
      }
      
      // Reset heartbeat timer
      this.startHeartbeatTimer(instance);
      
      return true;
    }
    
    return false;
  }

  /**
   * Get all instances of a service
   */
  public getInstances(serviceName: string): ServiceInstance[] {
    const instances = this.services.get(serviceName) || [];
    return instances.filter(i => i.status === 'UP');
  }

  /**
   * Get a single instance using load balancing
   */
  public getInstance(serviceName: string): ServiceInstance | null {
    const instances = this.getInstances(serviceName);
    
    if (instances.length === 0) {
      return null;
    }

    switch (this.config.loadBalancingStrategy) {
      case 'ROUND_ROBIN':
        return this.getRoundRobinInstance(serviceName, instances);
      
      case 'LEAST_CONNECTIONS':
        return this.getLeastLoadedInstance(instances);
      
      case 'WEIGHTED':
        return this.getWeightedInstance(instances);
      
      case 'RANDOM':
        return instances[Math.floor(Math.random() * instances.length)];
      
      default:
        return instances[0];
    }
  }

  /**
   * Get service URL with load balancing
   */
  public getServiceUrl(serviceName: string, path: string = ''): string | null {
    const instance = this.getInstance(serviceName);
    
    if (!instance) {
      return null;
    }
    
    return `${instance.protocol}://${instance.host}:${instance.port}${path}`;
  }

  /**
   * Get all registered services
   */
  public getAllServices(): Map<string, ServiceInstance[]> {
    return new Map(this.services);
  }

  /**
   * Update service status
   */
  public updateStatus(serviceId: string, status: ServiceInstance['status']): boolean {
    const instance = this.findInstanceById(serviceId);
    
    if (instance) {
      const oldStatus = instance.status;
      instance.status = status;
      
      if (oldStatus !== status) {
        this.emit('service:status-changed', {
          instance,
          oldStatus,
          newStatus: status,
        });
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Get service metrics
   */
  public getMetrics(serviceName?: string): Record<string, any> {
    if (serviceName) {
      const instances = this.services.get(serviceName) || [];
      return this.calculateServiceMetrics(serviceName, instances);
    }

    const metrics: Record<string, any> = {};
    
    for (const [name, instances] of this.services.entries()) {
      metrics[name] = this.calculateServiceMetrics(name, instances);
    }
    
    return metrics;
  }

  /**
   * Check if service is available
   */
  public isAvailable(serviceName: string): boolean {
    const instances = this.getInstances(serviceName);
    return instances.length > 0;
  }

  /**
   * Wait for service to be available
   */
  public async waitForService(
    serviceName: string,
    timeout: number = 30000
  ): Promise<ServiceInstance> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const instances = this.getInstances(serviceName);
      
      if (instances.length > 0) {
        return instances[0];
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Service ${serviceName} not available after ${timeout}ms`);
  }

  // Private methods

  private findInstanceById(serviceId: string): ServiceInstance | null {
    for (const instances of this.services.values()) {
      const instance = instances.find(i => i.id === serviceId);
      if (instance) {
        return instance;
      }
    }
    return null;
  }

  private getRoundRobinInstance(
    serviceName: string,
    instances: ServiceInstance[]
  ): ServiceInstance {
    const counter = this.roundRobinCounters.get(serviceName) || 0;
    const instance = instances[counter % instances.length];
    this.roundRobinCounters.set(serviceName, counter + 1);
    return instance;
  }

  private getLeastLoadedInstance(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((least, current) => {
      const leastLoad = least.load || 0;
      const currentLoad = current.load || 0;
      return currentLoad < leastLoad ? current : least;
    });
  }

  private getWeightedInstance(instances: ServiceInstance[]): ServiceInstance {
    // Weight based on response time and load
    const weights = instances.map(instance => {
      const load = instance.load || 50;
      const responseTime = instance.responseTime || 100;
      return 100 - (load * 0.7 + Math.min(responseTime / 10, 30) * 0.3);
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < instances.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return instances[i];
      }
    }

    return instances[0];
  }

  private startHealthCheck(instance: ServiceInstance): void {
    const checkHealth = async () => {
      try {
        const response = await axios.get(instance.healthCheckUrl!, {
          timeout: 5000,
        });

        if (response.status === 200) {
          instance.status = 'UP';
          instance.lastHeartbeat = new Date();
          
          // Update metrics if provided
          if (response.data) {
            if (typeof response.data.load === 'number') {
              instance.load = response.data.load;
            }
            if (typeof response.data.responseTime === 'number') {
              instance.responseTime = response.data.responseTime;
            }
          }
        } else {
          instance.status = 'DOWN';
        }
      } catch (error) {
        instance.status = 'DOWN';
        this.emit('service:health-check-failed', {
          instance,
          error: (error as Error).message,
        });
      }
    };

    // Initial check
    checkHealth();

    // Schedule periodic checks
    const timer = setInterval(checkHealth, this.config.healthCheckInterval);
    this.healthCheckers.set(instance.id, timer);
  }

  private stopHealthCheck(serviceId: string): void {
    const timer = this.healthCheckers.get(serviceId);
    if (timer) {
      clearInterval(timer);
      this.healthCheckers.delete(serviceId);
    }
  }

  private startHeartbeatTimer(instance: ServiceInstance): void {
    // Clear existing timer
    this.stopHeartbeatTimer(instance.id);

    const timer = setTimeout(() => {
      instance.status = 'DOWN';
      this.emit('service:heartbeat-timeout', instance);
      
      // Auto-deregister if configured
      if (this.config.deregistrationTimeout > 0) {
        setTimeout(() => {
          if (instance.status === 'DOWN') {
            this.deregister(instance.id);
          }
        }, this.config.deregistrationTimeout - this.config.heartbeatInterval);
      }
    }, this.config.heartbeatInterval * 2);

    this.heartbeatTimers.set(instance.id, timer);
  }

  private stopHeartbeatTimer(serviceId: string): void {
    const timer = this.heartbeatTimers.get(serviceId);
    if (timer) {
      clearTimeout(timer);
      this.heartbeatTimers.delete(serviceId);
    }
  }

  private startCleanupTask(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const [serviceName, instances] of this.services.entries()) {
        const activeInstances = instances.filter(instance => {
          const timeSinceHeartbeat = now - instance.lastHeartbeat.getTime();
          
          if (timeSinceHeartbeat > this.config.deregistrationTimeout) {
            this.emit('service:auto-deregistered', instance);
            this.stopHealthCheck(instance.id);
            this.stopHeartbeatTimer(instance.id);
            return false;
          }
          
          return true;
        });

        if (activeInstances.length === 0) {
          this.services.delete(serviceName);
        } else {
          this.services.set(serviceName, activeInstances);
        }
      }
    }, this.config.deregistrationTimeout);
  }

  private calculateServiceMetrics(
    serviceName: string,
    instances: ServiceInstance[]
  ): Record<string, any> {
    const upInstances = instances.filter(i => i.status === 'UP');
    const totalLoad = upInstances.reduce((sum, i) => sum + (i.load || 0), 0);
    const avgResponseTime = upInstances.reduce((sum, i) => sum + (i.responseTime || 0), 0) / 
                           (upInstances.length || 1);

    return {
      name: serviceName,
      totalInstances: instances.length,
      healthyInstances: upInstances.length,
      unhealthyInstances: instances.length - upInstances.length,
      averageLoad: totalLoad / (upInstances.length || 1),
      averageResponseTime: avgResponseTime,
      availability: (upInstances.length / (instances.length || 1)) * 100,
    };
  }

  /**
   * Shutdown the registry
   */
  public shutdown(): void {
    // Clear all health checkers
    for (const timer of this.healthCheckers.values()) {
      clearInterval(timer);
    }
    this.healthCheckers.clear();

    // Clear all heartbeat timers
    for (const timer of this.heartbeatTimers.values()) {
      clearTimeout(timer);
    }
    this.heartbeatTimers.clear();

    // Clear services
    this.services.clear();
    
    this.emit('registry:shutdown');
  }
}

// Singleton instance
let registryInstance: ServiceRegistry | null = null;

export const getServiceRegistry = (config?: ServiceRegistryConfig): ServiceRegistry => {
  if (!registryInstance) {
    registryInstance = new ServiceRegistry(config);
  }
  return registryInstance;
};

export default ServiceRegistry;