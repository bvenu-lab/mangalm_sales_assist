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
 * Kill process using a specific port
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
    
    // Kill the process
    await execAsync(`taskkill /PID ${portInfo.pid} /F`);
    
    // Wait a moment for the process to terminate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify the port is now free
    const verifyInfo = await checkPort(port);
    if (!verifyInfo.isInUse) {
      logger.info('Successfully killed process on port', { port });
      return true;
    } else {
      logger.error('Failed to kill process on port', { port });
      return false;
    }
    
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
   * Prepare port for service startup
   */
  async preparePort(): Promise<number> {
    logger.info(`${this.serviceName}: Preparing port ${this.preferredPort}`);
    
    if (this.autoKill) {
      const success = await ensurePortAvailable(this.preferredPort);
      if (success) {
        return this.preferredPort;
      } else {
        logger.warn(`${this.serviceName}: Failed to free preferred port, finding alternative`);
        return await findAvailablePort(this.preferredPort + 1);
      }
    } else {
      const portInfo = await checkPort(this.preferredPort);
      if (!portInfo.isInUse) {
        return this.preferredPort;
      } else {
        logger.warn(`${this.serviceName}: Preferred port in use, finding alternative`);
        return await findAvailablePort(this.preferredPort + 1);
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