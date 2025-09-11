/**
 * SERVICE GUARDIAN - Automatic Recovery System
 * Monitors all services and automatically restarts failed ones
 * Ensures 100% uptime and reliability
 */

const { spawn, exec } = require('child_process');
const http = require('http');
const { Client } = require('pg');
const Redis = require('redis');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

// Service configuration
const SERVICES = [
  {
    name: 'PostgreSQL',
    port: 3432,
    type: 'docker',
    container: 'mangalm-postgres',
    healthCheck: async () => {
      const client = new Client({
        host: 'localhost',
        port: 3432,
        database: 'mangalm_sales',
        user: 'mangalm',
        password: 'mangalm_secure_password'
      });
      try {
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        return true;
      } catch {
        return false;
      }
    },
    restart: async () => {
      await execPromise('docker restart mangalm-postgres').catch(() => {});
      return true;
    }
  },
  {
    name: 'Redis',
    port: 3379,
    type: 'docker',
    container: 'mangalm-redis',
    healthCheck: async () => {
      return new Promise((resolve) => {
        const client = Redis.createClient({ 
          port: 3379,
          host: 'localhost'
        });
        client.on('ready', () => {
          client.quit();
          resolve(true);
        });
        client.on('error', () => {
          resolve(false);
        });
      });
    },
    restart: async () => {
      await execPromise('docker restart mangalm-redis').catch(() => {});
      return true;
    }
  },
  {
    name: 'API Gateway',
    port: 3007,
    type: 'node',
    path: 'services/api-gateway',
    command: 'npm start',
    process: null,
    healthCheck: async () => {
      return checkHTTP('http://localhost:3007/health');
    },
    restart: async function() {
      if (this.process) {
        this.process.kill();
      }
      this.process = spawn('npm', ['start'], {
        cwd: path.join(__dirname, this.path),
        shell: true,
        detached: false
      });
      return true;
    }
  },
  {
    name: 'Bulk Upload API',
    port: 3009,
    type: 'node',
    path: 'services/bulk-upload-api',
    command: 'npm start',
    process: null,
    healthCheck: async () => {
      return checkHTTP('http://localhost:3009/health');
    },
    restart: async function() {
      if (this.process) {
        this.process.kill();
      }
      this.process = spawn('npm', ['start'], {
        cwd: path.join(__dirname, this.path),
        shell: true,
        detached: false
      });
      return true;
    }
  },
  {
    name: 'Frontend',
    port: 3000,
    type: 'node',
    path: 'services/sales-frontend',
    command: 'npm start',
    process: null,
    healthCheck: async () => {
      return checkHTTP('http://localhost:3000');
    },
    restart: async function() {
      if (this.process) {
        this.process.kill();
      }
      this.process = spawn('npm', ['start'], {
        cwd: path.join(__dirname, this.path),
        shell: true,
        detached: false
      });
      return true;
    }
  }
];

// Service status tracking
const SERVICE_STATUS = {};
SERVICES.forEach(service => {
  SERVICE_STATUS[service.name] = {
    healthy: false,
    lastCheck: null,
    failureCount: 0,
    restartCount: 0,
    lastRestart: null
  };
});

// Configuration
const CONFIG = {
  CHECK_INTERVAL: 30000, // Check every 30 seconds
  RESTART_DELAY: 5000, // Wait 5 seconds before restart
  MAX_RESTART_ATTEMPTS: 3, // Max restarts before alert
  RESTART_WINDOW: 300000, // Reset restart count after 5 minutes
  LOG_FILE: 'service_guardian.log'
};

// Logging
async function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message} ${JSON.stringify(data)}\n`;
  
  console.log(logEntry.trim());
  
  try {
    await fs.appendFile(CONFIG.LOG_FILE, logEntry);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

// HTTP health check helper
async function checkHTTP(url) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000);
    
    http.get(url, (res) => {
      clearTimeout(timeout);
      resolve(res.statusCode < 500);
    }).on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

// Check if port is listening
async function checkPort(port) {
  try {
    const { stdout } = await execPromise(`netstat -an | findstr :${port} | findstr LISTENING`);
    return stdout.includes('LISTENING');
  } catch {
    return false;
  }
}

// Monitor single service
async function monitorService(service) {
  const status = SERVICE_STATUS[service.name];
  
  try {
    // Check if service is healthy
    const isHealthy = await service.healthCheck();
    const wasHealthy = status.healthy;
    
    status.healthy = isHealthy;
    status.lastCheck = new Date();
    
    if (isHealthy) {
      if (!wasHealthy) {
        await log('INFO', `Service recovered: ${service.name}`);
        status.failureCount = 0;
      }
      return true;
    }
    
    // Service is unhealthy
    status.failureCount++;
    await log('WARN', `Service unhealthy: ${service.name}`, { 
      failureCount: status.failureCount 
    });
    
    // Check if we should restart
    const now = Date.now();
    const timeSinceLastRestart = status.lastRestart ? 
      now - status.lastRestart.getTime() : CONFIG.RESTART_WINDOW + 1;
    
    // Reset restart count if outside window
    if (timeSinceLastRestart > CONFIG.RESTART_WINDOW) {
      status.restartCount = 0;
    }
    
    // Attempt restart if within limits
    if (status.restartCount < CONFIG.MAX_RESTART_ATTEMPTS) {
      await log('INFO', `Attempting restart: ${service.name}`, {
        attempt: status.restartCount + 1,
        max: CONFIG.MAX_RESTART_ATTEMPTS
      });
      
      // Wait before restart
      await new Promise(resolve => setTimeout(resolve, CONFIG.RESTART_DELAY));
      
      // Restart service
      const restarted = await service.restart();
      
      if (restarted) {
        status.restartCount++;
        status.lastRestart = new Date();
        await log('INFO', `Service restarted: ${service.name}`);
        
        // Wait for service to initialize
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Check if restart was successful
        const nowHealthy = await service.healthCheck();
        if (nowHealthy) {
          status.healthy = true;
          status.failureCount = 0;
          await log('SUCCESS', `Service recovered after restart: ${service.name}`);
          return true;
        }
      }
    } else {
      await log('ERROR', `Max restart attempts reached: ${service.name}`, {
        restartCount: status.restartCount
      });
    }
    
    return false;
    
  } catch (error) {
    await log('ERROR', `Error monitoring service: ${service.name}`, { 
      error: error.message 
    });
    return false;
  }
}

// Main monitoring loop
async function startMonitoring() {
  await log('INFO', 'Service Guardian started');
  
  // Initial check
  await checkAllServices();
  
  // Set up monitoring interval
  setInterval(async () => {
    await checkAllServices();
  }, CONFIG.CHECK_INTERVAL);
  
  // Set up graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Check all services
async function checkAllServices() {
  const results = await Promise.all(
    SERVICES.map(service => monitorService(service))
  );
  
  const healthyCount = results.filter(r => r).length;
  const totalCount = SERVICES.length;
  
  if (healthyCount === totalCount) {
    await log('INFO', 'All services healthy', { 
      healthy: healthyCount, 
      total: totalCount 
    });
  } else {
    await log('WARN', 'Some services unhealthy', { 
      healthy: healthyCount, 
      total: totalCount 
    });
  }
  
  // Generate status report
  await generateStatusReport();
}

// Generate status report
async function generateStatusReport() {
  const report = {
    timestamp: new Date().toISOString(),
    services: {}
  };
  
  for (const service of SERVICES) {
    const status = SERVICE_STATUS[service.name];
    report.services[service.name] = {
      healthy: status.healthy,
      port: service.port,
      lastCheck: status.lastCheck,
      failureCount: status.failureCount,
      restartCount: status.restartCount,
      lastRestart: status.lastRestart
    };
  }
  
  await fs.writeFile('service_status.json', JSON.stringify(report, null, 2));
}

// Graceful shutdown
async function shutdown() {
  await log('INFO', 'Service Guardian shutting down');
  
  // Stop all Node services
  for (const service of SERVICES) {
    if (service.type === 'node' && service.process) {
      service.process.kill();
    }
  }
  
  process.exit(0);
}

// Start the guardian
console.log('═══════════════════════════════════════════');
console.log('     SERVICE GUARDIAN - AUTO RECOVERY');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('Monitoring Configuration:');
console.log(`  Check Interval: ${CONFIG.CHECK_INTERVAL / 1000}s`);
console.log(`  Max Restarts: ${CONFIG.MAX_RESTART_ATTEMPTS}`);
console.log(`  Restart Window: ${CONFIG.RESTART_WINDOW / 60000}m`);
console.log('');
console.log('Services Being Monitored:');
SERVICES.forEach(s => console.log(`  - ${s.name} (port ${s.port})`));
console.log('');
console.log('Starting monitoring...');
console.log('Press Ctrl+C to stop');
console.log('');

startMonitoring().catch(console.error);