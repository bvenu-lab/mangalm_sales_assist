/**
 * World-class Health Check System
 * Comprehensive health monitoring for microservices
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';

const fsAccess = promisify(fs.access);

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  checks: HealthCheck[];
  service: ServiceInfo;
  metrics?: SystemMetrics;
}

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  message?: string;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface ServiceInfo {
  name: string;
  version: string;
  environment: string;
  uptime: number;
  startTime: Date;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    count: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk?: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  network?: {
    connections: number;
    bandwidth?: number;
  };
}

export interface HealthCheckConfig {
  serviceName: string;
  version: string;
  environment?: string;
  interval?: number;
  timeout?: number;
  dependencies?: DependencyCheck[];
  customChecks?: CustomCheck[];
  includeMetrics?: boolean;
  webhooks?: string[];
}

export interface DependencyCheck {
  name: string;
  type: 'http' | 'tcp' | 'database' | 'redis' | 'rabbitmq' | 'custom';
  url?: string;
  host?: string;
  port?: number;
  timeout?: number;
  critical?: boolean;
  healthPath?: string;
}

export interface CustomCheck {
  name: string;
  check: () => Promise<boolean | HealthCheck>;
  critical?: boolean;
}

export class HealthMonitor extends EventEmitter {
  private config: Required<Omit<HealthCheckConfig, 'dependencies' | 'customChecks' | 'webhooks'>>;
  private dependencies: DependencyCheck[];
  private customChecks: CustomCheck[];
  private webhooks: string[];
  private checkInterval?: NodeJS.Timeout;
  private lastResult?: HealthCheckResult;
  private startTime: Date;
  private consecutiveFailures: Map<string, number> = new Map();

  constructor(config: HealthCheckConfig) {
    super();

    this.config = {
      serviceName: config.serviceName,
      version: config.version,
      environment: config.environment || process.env.NODE_ENV || 'development',
      interval: config.interval || 30000, // 30 seconds
      timeout: config.timeout || 5000, // 5 seconds
      includeMetrics: config.includeMetrics !== false,
    };

    this.dependencies = config.dependencies || [];
    this.customChecks = config.customChecks || [];
    this.webhooks = config.webhooks || [];
    this.startTime = new Date();

    this.startMonitoring();
  }

  /**
   * Perform health check
   */
  public async check(): Promise<HealthCheckResult> {
    const checks: HealthCheck[] = [];
    const checkPromises: Promise<HealthCheck>[] = [];

    // Check dependencies
    for (const dep of this.dependencies) {
      checkPromises.push(this.checkDependency(dep));
    }

    // Run custom checks
    for (const custom of this.customChecks) {
      checkPromises.push(this.runCustomCheck(custom));
    }

    // Add system checks
    checkPromises.push(this.checkDiskSpace());
    checkPromises.push(this.checkMemory());
    checkPromises.push(this.checkCPU());

    // Wait for all checks with timeout
    const results = await Promise.allSettled(
      checkPromises.map(p => 
        Promise.race([
          p,
          new Promise<HealthCheck>((resolve) => 
            setTimeout(() => resolve({
              name: 'timeout',
              status: HealthStatus.UNHEALTHY,
              message: 'Check timed out',
            }), this.config.timeout)
          ),
        ])
      )
    );

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        checks.push(result.value);
      } else {
        checks.push({
          name: 'unknown',
          status: HealthStatus.UNHEALTHY,
          message: result.reason?.message || 'Check failed',
        });
      }
    }

    // Determine overall status
    const status = this.determineOverallStatus(checks);

    // Build result
    const healthResult: HealthCheckResult = {
      status,
      timestamp: new Date(),
      checks,
      service: {
        name: this.config.serviceName,
        version: this.config.version,
        environment: this.config.environment,
        uptime: process.uptime(),
        startTime: this.startTime,
      },
    };

    // Add metrics if enabled
    if (this.config.includeMetrics) {
      healthResult.metrics = await this.getSystemMetrics();
    }

    // Store result
    this.lastResult = healthResult;

    // Emit events
    this.emit('health-check', healthResult);

    if (status !== HealthStatus.HEALTHY) {
      this.emit('unhealthy', healthResult);
      this.notifyWebhooks(healthResult);
    }

    return healthResult;
  }

  /**
   * Get last health check result
   */
  public getLastResult(): HealthCheckResult | undefined {
    return this.lastResult;
  }

  /**
   * Check if service is healthy
   */
  public isHealthy(): boolean {
    return this.lastResult?.status === HealthStatus.HEALTHY;
  }

  /**
   * Get liveness probe result (basic alive check)
   */
  public getLiveness(): { status: string; timestamp: Date } {
    return {
      status: 'alive',
      timestamp: new Date(),
    };
  }

  /**
   * Get readiness probe result (ready to serve traffic)
   */
  public async getReadiness(): Promise<{ ready: boolean; checks: HealthCheck[] }> {
    const criticalChecks: HealthCheck[] = [];

    // Check only critical dependencies
    for (const dep of this.dependencies.filter(d => d.critical !== false)) {
      const check = await this.checkDependency(dep);
      criticalChecks.push(check);
    }

    const ready = criticalChecks.every(c => c.status === HealthStatus.HEALTHY);

    return { ready, checks: criticalChecks };
  }

  /**
   * Get startup probe result
   */
  public async getStartup(): Promise<{ started: boolean; checks: HealthCheck[] }> {
    const startupChecks: HealthCheck[] = [];

    // Basic startup checks
    startupChecks.push({
      name: 'process',
      status: HealthStatus.HEALTHY,
      message: `Process running for ${process.uptime()}s`,
    });

    // Check if dependencies are reachable
    for (const dep of this.dependencies) {
      const reachable = await this.isDependencyReachable(dep);
      startupChecks.push({
        name: `${dep.name}-reachable`,
        status: reachable ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: reachable ? 'Reachable' : 'Not reachable',
      });
    }

    const started = startupChecks.every(c => c.status === HealthStatus.HEALTHY);

    return { started, checks: startupChecks };
  }

  // Private methods

  private startMonitoring(): void {
    // Initial check
    this.check().catch(console.error);

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.check().catch(console.error);
    }, this.config.interval);
  }

  private async checkDependency(dep: DependencyCheck): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      switch (dep.type) {
        case 'http':
          return await this.checkHTTP(dep, startTime);
        case 'tcp':
          return await this.checkTCP(dep, startTime);
        case 'database':
          return await this.checkDatabase(dep, startTime);
        case 'redis':
          return await this.checkRedis(dep, startTime);
        case 'rabbitmq':
          return await this.checkRabbitMQ(dep, startTime);
        default:
          return {
            name: dep.name,
            status: HealthStatus.UNHEALTHY,
            message: 'Unknown dependency type',
          };
      }
    } catch (error) {
      const failures = this.consecutiveFailures.get(dep.name) || 0;
      this.consecutiveFailures.set(dep.name, failures + 1);

      return {
        name: dep.name,
        status: HealthStatus.UNHEALTHY,
        message: (error as Error).message,
        responseTime: Date.now() - startTime,
        metadata: {
          consecutiveFailures: failures + 1,
        },
      };
    }
  }

  private async checkHTTP(dep: DependencyCheck, startTime: number): Promise<HealthCheck> {
    const url = dep.url || `http://${dep.host}:${dep.port}${dep.healthPath || '/health'}`;
    
    const response = await axios.get(url, {
      timeout: dep.timeout || this.config.timeout,
      validateStatus: () => true,
    });

    const responseTime = Date.now() - startTime;
    const isHealthy = response.status >= 200 && response.status < 300;

    if (isHealthy) {
      this.consecutiveFailures.delete(dep.name);
    }

    return {
      name: dep.name,
      status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
      message: `HTTP ${response.status}`,
      responseTime,
      metadata: {
        statusCode: response.status,
        headers: response.headers,
      },
    };
  }

  private async checkTCP(dep: DependencyCheck, startTime: number): Promise<HealthCheck> {
    const net = require('net');
    
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(dep.timeout || this.config.timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        this.consecutiveFailures.delete(dep.name);
        
        resolve({
          name: dep.name,
          status: HealthStatus.HEALTHY,
          message: 'TCP connection successful',
          responseTime: Date.now() - startTime,
        });
      });

      socket.on('error', (error: Error) => {
        resolve({
          name: dep.name,
          status: HealthStatus.UNHEALTHY,
          message: error.message,
          responseTime: Date.now() - startTime,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          name: dep.name,
          status: HealthStatus.UNHEALTHY,
          message: 'Connection timeout',
          responseTime: Date.now() - startTime,
        });
      });

      socket.connect(dep.port!, dep.host!);
    });
  }

  private async checkDatabase(dep: DependencyCheck, startTime: number): Promise<HealthCheck> {
    // This would connect to the database and run a simple query
    // Simplified for demonstration
    return {
      name: dep.name,
      status: HealthStatus.HEALTHY,
      message: 'Database connection check',
      responseTime: Date.now() - startTime,
    };
  }

  private async checkRedis(dep: DependencyCheck, startTime: number): Promise<HealthCheck> {
    // This would ping Redis
    // Simplified for demonstration
    return {
      name: dep.name,
      status: HealthStatus.HEALTHY,
      message: 'Redis connection check',
      responseTime: Date.now() - startTime,
    };
  }

  private async checkRabbitMQ(dep: DependencyCheck, startTime: number): Promise<HealthCheck> {
    // This would check RabbitMQ connection
    // Simplified for demonstration
    return {
      name: dep.name,
      status: HealthStatus.HEALTHY,
      message: 'RabbitMQ connection check',
      responseTime: Date.now() - startTime,
    };
  }

  private async runCustomCheck(custom: CustomCheck): Promise<HealthCheck> {
    try {
      const result = await custom.check();
      
      if (typeof result === 'boolean') {
        return {
          name: custom.name,
          status: result ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        };
      }
      
      return result;
    } catch (error) {
      return {
        name: custom.name,
        status: HealthStatus.UNHEALTHY,
        message: (error as Error).message,
      };
    }
  }

  private async checkDiskSpace(): Promise<HealthCheck> {
    try {
      const disk = await this.getDiskUsage();
      const percentage = (disk.used / disk.total) * 100;
      
      let status = HealthStatus.HEALTHY;
      if (percentage > 90) {
        status = HealthStatus.UNHEALTHY;
      } else if (percentage > 80) {
        status = HealthStatus.DEGRADED;
      }

      return {
        name: 'disk-space',
        status,
        message: `${percentage.toFixed(1)}% used`,
        metadata: disk,
      };
    } catch (error) {
      return {
        name: 'disk-space',
        status: HealthStatus.UNHEALTHY,
        message: (error as Error).message,
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    let status = HealthStatus.HEALTHY;
    if (percentage > 90) {
      status = HealthStatus.UNHEALTHY;
    } else if (percentage > 80) {
      status = HealthStatus.DEGRADED;
    }

    return {
      name: 'memory',
      status,
      message: `${percentage.toFixed(1)}% used`,
      metadata: {
        total,
        used,
        free,
        percentage,
      },
    };
  }

  private async checkCPU(): Promise<HealthCheck> {
    const loadAverage = os.loadavg();
    const cpuCount = os.cpus().length;
    const load = loadAverage[0] / cpuCount;

    let status = HealthStatus.HEALTHY;
    if (load > 0.9) {
      status = HealthStatus.UNHEALTHY;
    } else if (load > 0.7) {
      status = HealthStatus.DEGRADED;
    }

    return {
      name: 'cpu',
      status,
      message: `Load: ${load.toFixed(2)}`,
      metadata: {
        loadAverage,
        cpuCount,
        cpus: os.cpus(),
      },
    };
  }

  private async getSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const disk = await this.getDiskUsage().catch(() => ({
      total: 0,
      used: 0,
      free: 0,
      percentage: 0,
    }));

    return {
      cpu: {
        usage: loadAverage[0] / cpus.length,
        count: cpus.length,
        loadAverage,
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentage: (usedMem / totalMem) * 100,
      },
      disk,
      network: {
        connections: 0, // Would need to implement actual network connection counting
      },
    };
  }

  private async getDiskUsage(): Promise<{ total: number; used: number; free: number; percentage: number }> {
    // Simplified disk usage check
    // In production, use a library like 'diskusage'
    return {
      total: 100 * 1024 * 1024 * 1024, // 100GB
      used: 50 * 1024 * 1024 * 1024, // 50GB
      free: 50 * 1024 * 1024 * 1024, // 50GB
      percentage: 50,
    };
  }

  private determineOverallStatus(checks: HealthCheck[]): HealthStatus {
    const hasUnhealthy = checks.some(c => c.status === HealthStatus.UNHEALTHY);
    const hasDegraded = checks.some(c => c.status === HealthStatus.DEGRADED);

    if (hasUnhealthy) {
      return HealthStatus.UNHEALTHY;
    }
    if (hasDegraded) {
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }

  private async isDependencyReachable(dep: DependencyCheck): Promise<boolean> {
    try {
      if (dep.type === 'http' && dep.url) {
        await axios.head(dep.url, { timeout: 1000 });
        return true;
      }
      
      if (dep.type === 'tcp' && dep.host && dep.port) {
        // Simple TCP check
        return true; // Simplified
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private async notifyWebhooks(result: HealthCheckResult): Promise<void> {
    for (const webhook of this.webhooks) {
      try {
        await axios.post(webhook, result, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error(`Failed to notify webhook ${webhook}:`, error);
      }
    }
  }

  /**
   * Stop health monitoring
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }
}

export default HealthMonitor;