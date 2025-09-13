/**
 * Port Management Utility
 * Automatically handles port conflicts by killing existing processes
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

export interface PortInfo {
  port: number;
  pid?: number;
  processName?: string;
  isInUse: boolean;
}

/**
 * Check if a port is in use
 */
export async function checkPort(port: number): Promise<PortInfo> {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    
    if (stdout.trim()) {
      // Parse netstat output to get PID
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
          const pid = parseInt(parts[4]);
          
          // Get process name
          let processName = 'unknown';
          try {
            const { stdout: processInfo } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
            const processLine = processInfo.trim().split('\n')[0];
            if (processLine) {
              processName = processLine.split(',')[0].replace(/"/g, '');
            }
          } catch (error) {
            // Ignore error getting process name
          }
          
          return {
            port,
            pid,
            processName,
            isInUse: true
          };
        }
      }
    }
    
    return {
      port,
      isInUse: false
    };
    
  } catch (error) {
    logger.warn('Error checking port', { 
      port, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return {
      port,
      isInUse: false
    };
  }
}

/**
 * Kill process using a specific port with multiple strategies
 */
export async function killProcessOnPort(port: number): Promise<boolean> {
  try {
    const portInfo = await checkPort(port);

    if (!portInfo.isInUse || !portInfo.pid) {
      logger.info('Port is not in use', { port });
      return true;
    }

    logger.info('Killing process on port', {
      port,
      pid: portInfo.pid,
      processName: portInfo.processName
    });

    // Strategy 1: Standard taskkill with force flag
    try {
      await execAsync(`taskkill /PID ${portInfo.pid} /F`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const verify1 = await checkPort(port);
      if (!verify1.isInUse) {
        logger.info('Successfully killed process with taskkill /F', { port });
        return true;
      }
    } catch (error) {
      logger.warn('Strategy 1 failed, trying more aggressive methods', { port });
    }

    // Strategy 2: Kill all Node.js processes if it's a Node process
    if (portInfo.processName === 'node.exe') {
      try {
        logger.info('Attempting to kill all node.exe processes', { port });
        await execAsync(`taskkill /F /IM node.exe`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        const verify2 = await checkPort(port);
        if (!verify2.isInUse) {
          logger.info('Successfully freed port by killing all node processes', { port });
          return true;
        }
      } catch (error) {
        logger.warn('Strategy 2 failed, trying final method', { port });
      }
    }

    // Strategy 3: Use wmic to force terminate the process tree
    try {
      await execAsync(`wmic process where "ProcessId=${portInfo.pid}" delete`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const verify3 = await checkPort(port);
      if (!verify3.isInUse) {
        logger.info('Successfully killed process with wmic', { port });
        return true;
      }
    } catch (error) {
      logger.warn('Strategy 3 failed', { port });
    }

    // Strategy 4: Nuclear option - kill by process name if all else fails
    if (portInfo.processName) {
      try {
        await execAsync(`taskkill /F /IM "${portInfo.processName}"`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        const verify4 = await checkPort(port);
        if (!verify4.isInUse) {
          logger.info('Successfully freed port by killing all instances of process', {
            port,
            processName: portInfo.processName
          });
          return true;
        }
      } catch (error) {
        logger.warn('Strategy 4 failed', { port });
      }
    }

    logger.error('All kill strategies failed', { port, pid: portInfo.pid });
    return false;

  } catch (error) {
    logger.error('Error killing process on port', {
      port,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Ensure port is available, killing existing process if necessary
 */
export async function ensurePortAvailable(port: number): Promise<boolean> {
  const portInfo = await checkPort(port);
  
  if (!portInfo.isInUse) {
    logger.info('Port is available', { port });
    return true;
  }
  
  logger.warn('Port is in use, attempting to free it', {
    port,
    pid: portInfo.pid,
    processName: portInfo.processName
  });
  
  return await killProcessOnPort(port);
}

/**
 * Find next available port starting from a base port
 */
export async function findAvailablePort(basePort: number, maxAttempts: number = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const testPort = basePort + i;
    const portInfo = await checkPort(testPort);
    
    if (!portInfo.isInUse) {
      logger.info('Found available port', { port: testPort });
      return testPort;
    }
  }
  
  throw new Error(`No available ports found starting from ${basePort} (tried ${maxAttempts} ports)`);
}

/**
 * Automated port startup manager
 */
export class PortManager {
  private serviceName: string;
  private preferredPort: number;
  private autoKill: boolean;
  
  constructor(serviceName: string, preferredPort: number, autoKill: boolean = true) {
    this.serviceName = serviceName;
    this.preferredPort = preferredPort;
    this.autoKill = autoKill;
  }
  
  /**
   * Prepare port for service startup - NEVER changes ports, only kills processes
   */
  async preparePort(): Promise<number> {
    logger.info(`${this.serviceName}: Preparing port ${this.preferredPort}`);

    if (this.autoKill) {
      // Keep trying until we free the preferred port - no alternatives allowed
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        attempts++;
        logger.info(`${this.serviceName}: Port cleanup attempt ${attempts}/${maxAttempts}`);

        const success = await ensurePortAvailable(this.preferredPort);
        if (success) {
          logger.info(`${this.serviceName}: Successfully claimed port ${this.preferredPort}`);
          return this.preferredPort;
        }

        if (attempts < maxAttempts) {
          logger.warn(`${this.serviceName}: Attempt ${attempts} failed, retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // If all attempts fail, throw an error - we don't use alternative ports
      throw new Error(`${this.serviceName}: Failed to free port ${this.preferredPort} after ${maxAttempts} attempts. Port must be freed manually.`);

    } else {
      const portInfo = await checkPort(this.preferredPort);
      if (!portInfo.isInUse) {
        return this.preferredPort;
      } else {
        throw new Error(`${this.serviceName}: Port ${this.preferredPort} is in use and autoKill is disabled. Cannot start service.`);
      }
    }
  }
  
  /**
   * Get port status information
   */
  async getPortStatus(): Promise<PortInfo> {
    return await checkPort(this.preferredPort);
  }
}

export default {
  checkPort,
  killProcessOnPort,
  ensurePortAvailable,
  findAvailablePort,
  PortManager
};