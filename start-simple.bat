@echo off
REM ============================================
REM Simple System Startup Script
REM Starts all services without timeout issues
REM ============================================

echo.
echo =========================================
echo   MANGALM SIMPLE STARTUP
echo =========================================
echo.

REM Check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

echo [1/6] Checking Docker status...
echo [OK] Docker is running

REM Stop any existing containers
echo [2/6] Stopping existing services...
docker-compose down >nul 2>&1

REM Start the infrastructure using docker-compose
echo [3/6] Starting Docker infrastructure...
docker-compose up -d

REM Simple wait for services
echo [4/6] Waiting for services to start (10 seconds)...
ping -n 11 127.0.0.1 >nul

REM Start the API Gateway
echo [5/6] Starting API Gateway (port 3007)...
start "API Gateway" cmd /k "cd services\api-gateway && npm start"

REM Start the Bulk Upload API  
echo [6/6] Starting Bulk Upload API (port 3009)...
start "Bulk Upload API" cmd /k "cd services\bulk-upload-api && node server.js"

echo.
echo =========================================
echo   SERVICES STARTING!
echo =========================================
echo.
echo Main Services:
echo --------------
echo   API Gateway:        http://localhost:3007
echo   Bulk Upload API:    http://localhost:3009
echo.
echo Infrastructure:
echo ---------------
echo   PostgreSQL:         localhost:3432
echo   Redis:             localhost:3379
echo.
echo =========================================
echo.
echo To stop all services, run: stop-all.bat
echo.
pause