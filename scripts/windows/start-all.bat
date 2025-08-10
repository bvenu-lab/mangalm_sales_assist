@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Starting Mangalm Sales Assistant
echo ========================================
echo.

REM Change to project root
cd /d "%~dp0\..\.."
set PROJECT_ROOT=%CD%

REM Check prerequisites
echo Checking prerequisites...

REM Check Node.js
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    pause
    exit /b 1
)

REM Check .env file
if not exist "%PROJECT_ROOT%\.env" (
    echo [ERROR] .env file not found!
    echo Please run setup-environment.bat first.
    pause
    exit /b 1
)

REM Check PostgreSQL
echo Checking PostgreSQL...
pg_isready -h localhost -p 5432 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] PostgreSQL is not running!
    echo Attempting to start PostgreSQL service...
    
    REM Try to start PostgreSQL service
    net start postgresql-x64-14 >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        net start postgresql-x64-15 >nul 2>&1
        if !ERRORLEVEL! NEQ 0 (
            net start postgresql-x64-13 >nul 2>&1
            if !ERRORLEVEL! NEQ 0 (
                echo [ERROR] Failed to start PostgreSQL service.
                echo Please start PostgreSQL manually:
                echo   1. Open Services (Win+R, services.msc)
                echo   2. Find PostgreSQL service
                echo   3. Right-click and select Start
                pause
                exit /b 1
            )
        )
    )
    
    timeout /t 3 >nul
    
    REM Verify PostgreSQL is now running
    pg_isready -h localhost -p 5432 >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] PostgreSQL still not running!
        pause
        exit /b 1
    )
)
echo [OK] PostgreSQL is running
echo.

REM Check Redis (optional)
redis-cli ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Redis is running
    set REDIS_AVAILABLE=true
) else (
    echo [INFO] Redis is not running (optional)
    set REDIS_AVAILABLE=false
    
    choice /C YN /T 5 /D N /M "Start Redis?"
    if !ERRORLEVEL! EQU 1 (
        start "Redis" redis-server
        timeout /t 2 >nul
        redis-cli ping >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            echo [OK] Redis started
            set REDIS_AVAILABLE=true
        )
    )
)
echo.

REM Kill any existing Node processes on our ports
echo Checking for port conflicts...
for %%p in (3000 3001 3002 3003 3007) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%%p"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)
echo [OK] Ports cleared
echo.

REM Start services
echo Starting services...
echo.

REM Start API Gateway
echo [1/4] Starting API Gateway (Port 3007)...
start "API Gateway" /D "%PROJECT_ROOT%\services\api-gateway" cmd /k "npm start"
timeout /t 3 >nul

REM Verify API Gateway started
curl -s http://localhost:3007/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] API Gateway may not have started properly
) else (
    echo [OK] API Gateway is running
)

REM Start AI Prediction Service
echo [2/4] Starting AI Prediction Service (Port 3001)...
start "AI Service" /D "%PROJECT_ROOT%\services\ai-prediction-service" cmd /k "npm start"
timeout /t 3 >nul
echo [OK] AI Service started

REM Start PM Agent Orchestrator
echo [3/4] Starting PM Agent Orchestrator (Port 3002)...
start "PM Orchestrator" /D "%PROJECT_ROOT%\services\pm-agent-orchestrator" cmd /k "npm start"
timeout /t 3 >nul
echo [OK] PM Orchestrator started

REM Start Frontend
echo [4/4] Starting Frontend (Port 3000)...
start "Frontend" /D "%PROJECT_ROOT%\services\sales-frontend" cmd /k "npm start"
echo [OK] Frontend starting (this may take a moment)...
echo.

REM Wait for services to initialize
echo Waiting for services to initialize...
timeout /t 5 >nul

echo.
echo ========================================
echo Mangalm Sales Assistant is starting!
echo ========================================
echo.
echo Services are available at:
echo.
echo   Frontend:          http://localhost:3000
echo   API Gateway:       http://localhost:3007
echo   API Health:        http://localhost:3007/health
echo   API Docs:          http://localhost:3007/api-docs
echo   AI Service:        http://localhost:3001
echo   PM Orchestrator:   http://localhost:3002
echo.
echo Default Login Credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo Redis Cache: %REDIS_AVAILABLE%
echo.
echo The browser will open automatically in 10 seconds...
echo Press any key to open now, or Ctrl+C to skip
echo.
timeout /t 10
start http://localhost:3000
echo.
echo ========================================
echo Application is running!
echo ========================================
echo.
echo To stop all services:
echo   Close this window and all service windows
echo   Or run: stop-all.bat
echo.
pause