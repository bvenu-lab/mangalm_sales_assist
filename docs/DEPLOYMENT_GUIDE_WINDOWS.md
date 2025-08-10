# Mangalm Sales Assistant - Windows Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [External Software Installation](#external-software-installation)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Application Installation](#application-installation)
6. [Starting the Application](#starting-the-application)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **OS**: Windows 10/11 (64-bit)
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: 10GB free space
- **CPU**: 4+ cores recommended
- **Network**: Stable internet connection for initial setup

### Required Software Checklist
- [ ] Node.js v18.x or higher
- [ ] PostgreSQL 14 or higher
- [ ] Redis (optional, for caching)
- [ ] Git
- [ ] Visual Studio Code (recommended)

---

## External Software Installation

### 1. Install Node.js

1. **Download Node.js**
   - Visit: https://nodejs.org/
   - Download the LTS version (18.x or higher)
   - Choose the Windows Installer (.msi) 64-bit

2. **Install Node.js**
   - Run the downloaded installer
   - Check "Automatically install the necessary tools"
   - Click through the installation wizard

3. **Verify Installation**
   ```cmd
   node --version
   npm --version
   ```
   Expected output:
   - node: v18.x.x or higher
   - npm: v9.x.x or higher

### 2. Install PostgreSQL

1. **Download PostgreSQL**
   - Visit: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 14 or higher installer

2. **Install PostgreSQL**
   - Run the installer
   - **IMPORTANT: Remember these settings:**
     - Port: `5432` (default)
     - Superuser: `postgres`
     - Password: Choose a strong password (you'll need this!)
   - Select components:
     - [x] PostgreSQL Server
     - [x] pgAdmin 4
     - [x] Command Line Tools

3. **Add PostgreSQL to PATH**
   - Open System Properties → Environment Variables
   - Add to PATH: `C:\Program Files\PostgreSQL\14\bin`

4. **Verify Installation**
   ```cmd
   psql --version
   ```

### 3. Install Redis (Optional but Recommended)

1. **Download Redis for Windows**
   - Visit: https://github.com/microsoftarchive/redis/releases
   - Download Redis-x64-3.x.x.msi

2. **Install Redis**
   - Run the installer
   - Use default port: `6379`
   - Check "Add Redis to PATH"

3. **Verify Redis**
   ```cmd
   redis-cli ping
   ```
   Expected output: `PONG`

### 4. Install Git

1. **Download Git**
   - Visit: https://git-scm.com/download/win
   - Download 64-bit Git for Windows

2. **Install Git**
   - Run the installer with default options

3. **Verify Git**
   ```cmd
   git --version
   ```

---

## Database Setup

### 1. Create Database User and Database

Open Command Prompt as Administrator and run:

```cmd
# Login to PostgreSQL as superuser
psql -U postgres

# Enter your PostgreSQL password when prompted
```

Run these SQL commands:

```sql
-- Create a dedicated user for Mangalm
CREATE USER mangalm WITH PASSWORD 'mangalm_secure_2024';

-- Create the database
CREATE DATABASE mangalm_sales;

-- Grant all privileges to the mangalm user
GRANT ALL PRIVILEGES ON DATABASE mangalm_sales TO mangalm;

-- Connect to the database
\c mangalm_sales

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Exit PostgreSQL
\q
```

### 2. Test Database Connection

```cmd
psql -U mangalm -d mangalm_sales -h localhost
# Enter password: mangalm_secure_2024
# If successful, you'll see: mangalm_sales=>
# Type \q to exit
```

---

## Environment Configuration

### 1. Create Environment Files

Create a file named `.env` in the root directory (`C:\code\mangalm\.env`):

```env
# Database Configuration
DATABASE_URL=postgresql://mangalm:mangalm_secure_2024@localhost:5432/mangalm_sales
DB_HOST=localhost
DB_PORT=5432
DB_USER=mangalm
DB_PASSWORD=mangalm_secure_2024
DB_NAME=mangalm_sales

# Redis Configuration (if installed)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Application Configuration
NODE_ENV=production
PORT=3000

# API Gateway
API_GATEWAY_PORT=3007

# AI Prediction Service
AI_SERVICE_PORT=3001

# PM Agent Orchestrator
PM_ORCHESTRATOR_PORT=3002

# Zoho Integration (optional)
ZOHO_SERVICE_PORT=3003

# Security
JWT_SECRET=mangalm_jwt_secret_key_2024_production
SESSION_SECRET=mangalm_session_secret_2024_production

# CORS Settings
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info
LOG_DIR=C:\code\mangalm\logs

# Feature Flags
ENABLE_REDIS_CACHE=true
ENABLE_RATE_LIMITING=true
ENABLE_WEBSOCKETS=true
```

### 2. Create Service-Specific Environment Files

Create `.env` files in each service directory:

**C:\code\mangalm\services\api-gateway\.env:**
```env
PORT=3007
JWT_SECRET=mangalm_jwt_secret_key_2024_production
DATABASE_URL=postgresql://mangalm:mangalm_secure_2024@localhost:5432/mangalm_sales
REDIS_URL=redis://localhost:6379
```

**C:\code\mangalm\services\ai-prediction-service\.env:**
```env
PORT=3001
DATABASE_URL=postgresql://mangalm:mangalm_secure_2024@localhost:5432/mangalm_sales
REDIS_URL=redis://localhost:6379
MODEL_PATH=./models
```

**C:\code\mangalm\services\sales-frontend\.env:**
```env
REACT_APP_API_URL=http://localhost:3007
REACT_APP_WEBSOCKET_URL=ws://localhost:3007
REACT_APP_ENVIRONMENT=production
```

---

## Application Installation

### 1. Install Dependencies

Open Command Prompt in the project root (`C:\code\mangalm`) and run:

```cmd
# Install root dependencies
npm install --legacy-peer-deps

# Install all service dependencies
npm run install:all
```

This will install dependencies for:
- Database module
- AI Prediction Service
- API Gateway
- PM Agent Orchestrator
- Sales Frontend
- Zoho Integration

### 2. Build the Application

```cmd
# Build all services
npm run build:all
```

Note: Some TypeScript warnings may appear - these are non-blocking.

### 3. Initialize Database

```cmd
# Run database migrations
cd database
npx knex migrate:latest

# Seed initial data (optional)
npx knex seed:run

# Return to root
cd ..
```

---

## Starting the Application

### Method 1: Using NPM Scripts (Recommended for Development)

Create a new file `start-all.bat` in the project root:

```batch
@echo off
echo Starting Mangalm Sales Assistant...
echo.

REM Start PostgreSQL if not running
echo Checking PostgreSQL...
pg_isready -h localhost -p 5432
if %ERRORLEVEL% NEQ 0 (
    echo PostgreSQL is not running! Please start it manually.
    pause
    exit /b 1
)

REM Start Redis if installed
echo Checking Redis...
redis-cli ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Redis is running
) else (
    echo Redis is not running. Starting Redis...
    start "Redis" redis-server
    timeout /t 2 >nul
)

REM Start services in separate windows
echo Starting API Gateway...
start "API Gateway" cmd /k "cd services\api-gateway && npm start"
timeout /t 3 >nul

echo Starting AI Prediction Service...
start "AI Service" cmd /k "cd services\ai-prediction-service && npm start"
timeout /t 3 >nul

echo Starting PM Agent Orchestrator...
start "PM Orchestrator" cmd /k "cd services\pm-agent-orchestrator && npm start"
timeout /t 3 >nul

echo Starting Frontend...
start "Frontend" cmd /k "cd services\sales-frontend && npm start"

echo.
echo All services are starting...
echo.
echo Services will be available at:
echo - Frontend: http://localhost:3000
echo - API Gateway: http://localhost:3007
echo - AI Service: http://localhost:3001
echo - PM Orchestrator: http://localhost:3002
echo.
echo Press any key to open the application in your browser...
pause >nul
start http://localhost:3000
```

Run the script:
```cmd
start-all.bat
```

### Method 2: Using PM2 (Recommended for Production)

1. **Install PM2 globally:**
```cmd
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
```

2. **Create PM2 ecosystem file** (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      cwd: './services/api-gateway',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 3007,
        NODE_ENV: 'production'
      },
      error_file: '../../logs/api-gateway-error.log',
      out_file: '../../logs/api-gateway-out.log'
    },
    {
      name: 'ai-service',
      cwd: './services/ai-prediction-service',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 3001,
        NODE_ENV: 'production'
      },
      error_file: '../../logs/ai-service-error.log',
      out_file: '../../logs/ai-service-out.log'
    },
    {
      name: 'pm-orchestrator',
      cwd: './services/pm-agent-orchestrator',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 3002,
        NODE_ENV: 'production'
      },
      error_file: '../../logs/pm-orchestrator-error.log',
      out_file: '../../logs/pm-orchestrator-out.log'
    },
    {
      name: 'frontend',
      cwd: './services/sales-frontend',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 3000,
        NODE_ENV: 'production'
      },
      error_file: '../../logs/frontend-error.log',
      out_file: '../../logs/frontend-out.log'
    }
  ]
};
```

3. **Start with PM2:**
```cmd
# Start all services
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs

# Stop all services
pm2 stop all

# Restart all services
pm2 restart all
```

### Method 3: Manual Start (for debugging)

Open separate Command Prompt windows for each service:

**Window 1 - API Gateway:**
```cmd
cd C:\code\mangalm\services\api-gateway
npm start
```

**Window 2 - AI Service:**
```cmd
cd C:\code\mangalm\services\ai-prediction-service
npm start
```

**Window 3 - PM Orchestrator:**
```cmd
cd C:\code\mangalm\services\pm-agent-orchestrator
npm start
```

**Window 4 - Frontend:**
```cmd
cd C:\code\mangalm\services\sales-frontend
npm start
```

---

## Verification

### 1. Check Service Health

Open your browser and verify:

1. **Frontend**: http://localhost:3000
   - Should see the login page

2. **API Gateway Health**: http://localhost:3007/health
   - Should return: `{"status":"healthy"}`

3. **API Documentation**: http://localhost:3007/api-docs
   - Should show Swagger/OpenAPI documentation

### 2. Test Login

1. Navigate to: http://localhost:3000
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. You should be redirected to the dashboard

### 3. Verify Database Connection

```cmd
# Check if tables were created
psql -U mangalm -d mangalm_sales -c "\dt"
```

You should see tables like:
- users
- stores
- products
- predictions
- orders

---

## Troubleshooting

### Common Issues and Solutions

#### 1. PostgreSQL Connection Error

**Error:** `ECONNREFUSED 127.0.0.1:5432`

**Solution:**
```cmd
# Check if PostgreSQL is running
pg_isready

# If not running, start it:
# Windows Services (Win+R, services.msc)
# Find "postgresql-x64-14" and start it

# Or via command line:
net start postgresql-x64-14
```

#### 2. Port Already in Use

**Error:** `EADDRINUSE: Port 3000 is already in use`

**Solution:**
```cmd
# Find process using the port
netstat -ano | findstr :3000

# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F

# Or change the port in .env file
```

#### 3. Node Module Errors

**Error:** `Cannot find module`

**Solution:**
```cmd
# Clear node_modules and reinstall
rd /s /q node_modules
npm cache clean --force
npm install --legacy-peer-deps
```

#### 4. Database Migration Errors

**Error:** `relation does not exist`

**Solution:**
```cmd
cd database
npx knex migrate:rollback
npx knex migrate:latest
```

#### 5. Redis Connection Error (if using Redis)

**Error:** `Redis connection refused`

**Solution:**
```cmd
# Start Redis service
redis-server

# Or disable Redis in .env:
ENABLE_REDIS_CACHE=false
```

### Log Files Location

Logs are stored in:
- `C:\code\mangalm\logs\` (if using PM2)
- Individual service directories under `logs/` folder
- Windows Event Viewer for system-level issues

### Getting Help

If you encounter issues:

1. Check the logs in the respective service directory
2. Ensure all prerequisites are installed correctly
3. Verify environment variables are set properly
4. Check Windows Firewall isn't blocking ports
5. Run services individually to identify which one is failing

---

## Security Notes

⚠️ **Important Security Considerations:**

1. **Change Default Passwords**
   - Change PostgreSQL passwords
   - Change default admin/user passwords after first login
   - Update JWT_SECRET in production

2. **Firewall Configuration**
   - Only allow necessary ports through Windows Firewall
   - Don't expose database port (5432) to external networks

3. **Environment Files**
   - Never commit `.env` files to version control
   - Keep production secrets secure
   - Use different credentials for production

---

## Next Steps

After successful deployment:

1. **Change default credentials**
2. **Configure backup procedures**
3. **Set up monitoring**
4. **Review security settings**
5. **Import your data**
6. **Train ML models with your data**

---

*Last Updated: 2025-08-10*
*Version: 1.0.0 - Windows Local Deployment*