@echo off
setlocal enabledelayedexpansion

REM If not already in a new window, restart in a new window
if not defined RUNNING_IN_NEW_WINDOW (
    set RUNNING_IN_NEW_WINDOW=1
    start "Mangalm Startup" cmd /k "%~f0" %*
    exit /b
)

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

REM Try to find pg_isready in common PostgreSQL installations
set PG_ISREADY=
if exist "C:\Program Files\PostgreSQL\17\bin\pg_isready.exe" (
    set PG_ISREADY="C:\Program Files\PostgreSQL\17\bin\pg_isready.exe"
) else if exist "C:\Program Files\PostgreSQL\16\bin\pg_isready.exe" (
    set PG_ISREADY="C:\Program Files\PostgreSQL\16\bin\pg_isready.exe"
) else if exist "C:\Program Files\PostgreSQL\15\bin\pg_isready.exe" (
    set PG_ISREADY="C:\Program Files\PostgreSQL\15\bin\pg_isready.exe"
) else if exist "C:\Program Files\PostgreSQL\14\bin\pg_isready.exe" (
    set PG_ISREADY="C:\Program Files\PostgreSQL\14\bin\pg_isready.exe"
)

REM Check if PostgreSQL is running
set PG_RUNNING=0
if defined PG_ISREADY (
    %PG_ISREADY% -h localhost -p 5432 >nul 2>&1
    if !ERRORLEVEL! EQU 0 set PG_RUNNING=1
) else (
    REM Fallback: check if service is running
    sc query postgresql-x64-17 2>nul | find "RUNNING" >nul 2>&1
    if !ERRORLEVEL! EQU 0 set PG_RUNNING=1
)

if !PG_RUNNING! EQU 0 (
    echo [WARNING] PostgreSQL is not running!
    echo Attempting to start PostgreSQL service...
    
    REM Try to start PostgreSQL service
    net start postgresql-x64-17 >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        net start postgresql-x64-16 >nul 2>&1
        if !ERRORLEVEL! NEQ 0 (
            net start postgresql-x64-15 >nul 2>&1
            if !ERRORLEVEL! NEQ 0 (
                net start postgresql-x64-14 >nul 2>&1
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
    )
    
    timeout /t 3 >nul
    
    REM Verify PostgreSQL is now running
    set PG_RUNNING=0
    if defined PG_ISREADY (
        %PG_ISREADY% -h localhost -p 5432 >nul 2>&1
        if !ERRORLEVEL! EQU 0 set PG_RUNNING=1
    ) else (
        sc query postgresql-x64-17 2>nul | find "RUNNING" >nul 2>&1
        if !ERRORLEVEL! EQU 0 set PG_RUNNING=1
    )
    
    if !PG_RUNNING! EQU 0 (
        echo [ERROR] PostgreSQL still not running!
        pause
        exit /b 1
    )
)
echo [OK] PostgreSQL is running
echo.

REM Check Redis (optional)
echo Checking Redis...
set REDIS_RUNNING=0
set REDIS_SERVICE_EXISTS=0
set REDIS_INSTALLED=0

REM First check if Redis Windows service exists
sc query Redis >nul 2>&1
if !ERRORLEVEL! EQU 0 set REDIS_SERVICE_EXISTS=1

REM Check if Redis Windows service is running
if !REDIS_SERVICE_EXISTS! EQU 1 (
    sc query Redis 2>nul | find "RUNNING" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set REDIS_RUNNING=1
        echo [OK] Redis Windows service is running
    ) else (
        echo [INFO] Redis Windows service exists but is stopped
    )
)

REM If service doesn't exist or isn't running, check if Redis is running on port 6379
if !REDIS_RUNNING! EQU 0 (
    netstat -an | findstr ":6379" | findstr "LISTENING" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set REDIS_RUNNING=1
        if !REDIS_SERVICE_EXISTS! EQU 0 (
            echo [OK] Redis is running on port 6379 (non-service mode)
        ) else (
            echo [OK] Redis is running on port 6379
        )
    )
)

REM Check if Redis CLI is available
where redis-cli >nul 2>&1
if !ERRORLEVEL! EQU 0 set REDIS_INSTALLED=1

REM If still not detected but CLI is available, try to ping Redis
if !REDIS_RUNNING! EQU 0 (
    if !REDIS_INSTALLED! EQU 1 (
        redis-cli -h localhost -p 6379 ping >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            set REDIS_RUNNING=1
            echo [OK] Redis server is responding to ping
        )
    )
)

REM Determine final status and take action if needed
if !REDIS_RUNNING! EQU 1 (
    set REDIS_AVAILABLE=true
) else (
    set REDIS_AVAILABLE=false
    
    REM If service exists but is stopped, try to start it
    if !REDIS_SERVICE_EXISTS! EQU 1 (
        echo [INFO] Attempting to start Redis Windows service...
        net start Redis >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            echo [OK] Redis service started successfully
            set REDIS_AVAILABLE=true
        ) else (
            echo [WARNING] Failed to start Redis service - administrator privileges may be required
            echo           To start manually: Run 'net start Redis' as administrator
        )
    ) else (
        REM No service exists, check if Redis executables are available
        where redis-server >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            echo [INFO] Redis executable found but not running as a service
            choice /C YN /T 10 /D N /M "Start Redis server? (will skip in 10 seconds)"
            if !ERRORLEVEL! EQU 1 (
                echo Starting Redis server...
                start "Redis" redis-server
                timeout /t 3 >nul
                
                REM Verify Redis started
                netstat -an | findstr ":6379" | findstr "LISTENING" >nul 2>&1
                if !ERRORLEVEL! EQU 0 (
                    echo [OK] Redis server started successfully
                    set REDIS_AVAILABLE=true
                ) else (
                    echo [WARNING] Failed to start Redis - continuing without cache
                )
            ) else (
                echo [INFO] Skipping Redis startup - application will work without caching
            )
        ) else (
            echo [INFO] Redis is not installed. The application will work without Redis caching.
            echo       To enable caching, you can:
            echo       - Install Redis for Windows from: https://github.com/microsoftarchive/redis/releases
            echo       - Or use WSL/Docker with Redis
        )
    )
)
echo.

REM Kill any existing Node processes on our ports
echo Checking for port conflicts...
for %%p in (3000 3002 3003 3006 3007 3010) do (
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
echo [1/5] Starting API Gateway (Port 3007)...
start "API Gateway" /D "%PROJECT_ROOT%\services\api-gateway" cmd /k "set PORT=3007 && npm start"
timeout /t 3 >nul

REM Verify API Gateway started
curl -s http://localhost:3007/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] API Gateway may not have started properly
) else (
    echo [OK] API Gateway is running
)

REM Start AI Prediction Service
echo [2/5] Starting AI Prediction Service (Port 3006)...
start "AI Service" /D "%PROJECT_ROOT%\services\ai-prediction-service" cmd /k "npm start"
timeout /t 3 >nul
echo [OK] AI Service started

REM Start Document Processor Service
echo [3/5] Starting Document Processor Service (Port 3010)...
start "Document Processor" /D "%PROJECT_ROOT%\services\document-processor" cmd /k "set PORT=3010 && npm start"
timeout /t 3 >nul
echo [OK] Document Processor started

REM Start PM Agent Orchestrator
echo [4/5] Starting PM Agent Orchestrator (Port 3003)...
start "PM Orchestrator" /D "%PROJECT_ROOT%\services\pm-agent-orchestrator" cmd /k "npm start"
timeout /t 3 >nul
echo [OK] PM Orchestrator started

REM Start Frontend
echo [5/5] Starting Frontend (Port 3000)...
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
echo   AI Service:        http://localhost:3006
echo   PM Orchestrator:   http://localhost:3003
  echo   Doc Processor:     http://localhost:3010
echo.
echo Default Login Credentials:
echo   Username: demo    Password: demo2025  (Admin)
echo   Username: admin   Password: admin123  (Admin)
echo   Username: user    Password: user123   (Regular User)
echo.
echo Redis Cache: %REDIS_AVAILABLE%
echo.
echo The browser will open automatically in 10 seconds...
echo Press any key to open now, or Ctrl+C to skip
echo.
timeout /t 10 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start http://localhost:3000
)
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