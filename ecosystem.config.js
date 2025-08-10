/**
 * PM2 Configuration for Mangalm Sales Assistant
 * 
 * Usage:
 *   pm2 start ecosystem.config.js              # Start all services
 *   pm2 stop ecosystem.config.js               # Stop all services
 *   pm2 restart ecosystem.config.js            # Restart all services
 *   pm2 reload ecosystem.config.js             # Reload with zero downtime
 *   pm2 status                                 # Check status
 *   pm2 logs                                   # View logs
 *   pm2 monit                                  # Monitor in real-time
 */

module.exports = {
  apps: [
    {
      name: 'api-gateway',
      cwd: './services/api-gateway',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3007
      },
      error_file: './logs/api-gateway-error.log',
      out_file: './logs/api-gateway-out.log',
      log_file: './logs/api-gateway-combined.log',
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000
    },
    {
      name: 'ai-service',
      cwd: './services/ai-prediction-service',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/ai-service-error.log',
      out_file: './logs/ai-service-out.log',
      log_file: './logs/ai-service-combined.log',
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000
    },
    {
      name: 'pm-orchestrator',
      cwd: './services/pm-agent-orchestrator',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/pm-orchestrator-error.log',
      out_file: './logs/pm-orchestrator-out.log',
      log_file: './logs/pm-orchestrator-combined.log',
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000
    },
    {
      name: 'frontend',
      cwd: './services/sales-frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        BROWSER: 'none'  // Don't auto-open browser
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 30000,  // Frontend takes longer to start
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000
    },
    {
      name: 'zoho-integration',
      cwd: './services/zoho-integration',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      },
      error_file: './logs/zoho-integration-error.log',
      out_file: './logs/zoho-integration-out.log',
      log_file: './logs/zoho-integration-combined.log',
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      // Only start if Zoho credentials are configured
      env_production: {
        NODE_ENV: 'production',
        PORT: 3003,
        ENABLED: process.env.ZOHO_CLIENT_ID ? 'true' : 'false'
      }
    }
  ],

  // Deploy configuration (optional)
  deploy: {
    production: {
      user: 'administrator',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/your-org/mangalm.git',
      path: '/var/www/mangalm',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production..."'
    }
  }
};