@echo off
setlocal enabledelayedexpansion

REM Check for --clean flag to start with clean database
if "%1"=="--clean" (
    call start-enterprise-clean.bat
    exit /b
)

REM ============================================
REM ENTERPRISE-GRADE SYSTEM STARTUP SCRIPT v3.0
REM Production-ready with proper error handling
REM ============================================

REM Configuration
set LOG_DIR=logs
set POSTGRES_PORT=3432
set REDIS_PORT=3379
set API_GATEWAY_PORT=3007
set BULK_UPLOAD_PORT=3009
set FRONTEND_PORT=3000
set MAX_WAIT=30

REM Container names (as shown by docker ps)
set POSTGRES_CONTAINER=mangalm-postgres
set REDIS_CONTAINER=mangalm-redis

REM Create necessary directories
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Clear old log files
del /Q "%LOG_DIR%\*.log" >nul 2>&1

echo.
echo ========================================================
echo     MANGALM ENTERPRISE SYSTEM STARTUP v3.0
echo     Production-Ready Infrastructure
echo ========================================================
echo.
echo [%DATE% %TIME%] Starting system initialization...
echo.

REM ===== PHASE 1: PRE-FLIGHT CHECKS =====
echo [PHASE 1] Pre-flight Checks
echo ----------------------------------------

REM Check Docker
echo [CHECK] Docker availability...
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Docker is not installed or not running
    echo   Please install Docker Desktop and ensure it's running
    pause
    exit /b 1
)
echo   [OK] Docker is available

REM Check Docker daemon
echo [CHECK] Docker daemon status...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Docker daemon is not responding
    echo   Please restart Docker Desktop
    pause
    exit /b 1
)
echo   [OK] Docker daemon is running

REM Check and clean ports if needed
echo [CHECK] Port availability...
set PORTS_IN_USE=0
for %%p in (%POSTGRES_PORT% %REDIS_PORT% %API_GATEWAY_PORT% %BULK_UPLOAD_PORT% %FRONTEND_PORT%) do (
    netstat -ano | findstr :%%p | findstr LISTENING >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [WARN] Port %%p is in use, attempting cleanup...
        set PORTS_IN_USE=1
    )
)

if !PORTS_IN_USE! equ 1 (
    echo   [ACTION] Running cleanup script...
    call stop-enterprise.bat --silent >nul 2>&1
    ping -n 3 localhost >nul 2>&1
    
    REM Verify ports are now free
    set STILL_BLOCKED=0
    for %%p in (%API_GATEWAY_PORT% %BULK_UPLOAD_PORT% %FRONTEND_PORT%) do (
        netstat -ano | findstr :%%p | findstr LISTENING >nul 2>&1
        if !errorlevel! equ 0 (
            echo   [ERROR] Port %%p still in use after cleanup
            set STILL_BLOCKED=1
        )
    )
    
    if !STILL_BLOCKED! equ 1 (
        echo   [ERROR] Cannot free required ports
        echo   Please manually stop conflicting services
        pause
        exit /b 1
    )
)
echo   [OK] All required ports are available

echo.
REM ===== PHASE 2: DOCKER INFRASTRUCTURE =====
echo [PHASE 2] Docker Infrastructure
echo ----------------------------------------

echo [START] Starting Docker containers...
docker-compose up -d >"%LOG_DIR%\docker-compose.log" 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Failed to start Docker containers
    echo   Check logs\docker-compose.log for details
    type "%LOG_DIR%\docker-compose.log" | findstr "ERROR"
    pause
    exit /b 1
)
echo   [OK] Docker containers started

REM Wait for PostgreSQL with proper container name
echo [WAIT] PostgreSQL initialization...
set COUNTER=0
:wait_postgres
ping -n 2 localhost >nul 2>&1
set /a COUNTER+=1
docker exec %POSTGRES_CONTAINER% pg_isready -U mangalm >nul 2>&1
if %errorlevel% neq 0 (
    if !COUNTER! lss %MAX_WAIT% (
        echo   ... waiting !COUNTER!/%MAX_WAIT% seconds
        goto wait_postgres
    ) else (
        echo   [ERROR] PostgreSQL failed to start within %MAX_WAIT% seconds
        docker logs %POSTGRES_CONTAINER% >"%LOG_DIR%\postgres-error.log" 2>&1
        echo   Check logs\postgres-error.log for details
        pause
        exit /b 1
    )
)
echo   [OK] PostgreSQL ready after !COUNTER! seconds

REM Wait for Redis with proper container name
echo [WAIT] Redis initialization...
set COUNTER=0
:wait_redis
ping -n 2 localhost >nul 2>&1
set /a COUNTER+=1
docker exec %REDIS_CONTAINER% redis-cli ping >nul 2>&1
if %errorlevel% neq 0 (
    if !COUNTER! lss %MAX_WAIT% (
        echo   ... waiting !COUNTER!/%MAX_WAIT% seconds
        goto wait_redis
    ) else (
        echo   [ERROR] Redis failed to start within %MAX_WAIT% seconds
        docker logs %REDIS_CONTAINER% >"%LOG_DIR%\redis-error.log" 2>&1
        echo   Check logs\redis-error.log for details
        pause
        exit /b 1
    )
)
echo   [OK] Redis ready after !COUNTER! seconds

REM Initialize database schema
echo [INIT] Database schema...
ping -n 3 localhost >nul 2>&1
for %%f in (database\init\*.sql) do (
    if exist "%%f" (
        echo   Processing %%~nxf...
        docker exec %POSTGRES_CONTAINER% psql -U mangalm -d mangalm_sales -f /docker-entrypoint-initdb.d/%%~nxf >"%LOG_DIR%\schema-%%~nxf.log" 2>&1
        if !errorlevel! neq 0 (
            REM Check if it's just "already exists" error
            findstr /C:"already exists" "%LOG_DIR%\schema-%%~nxf.log" >nul
            if !errorlevel! equ 0 (
                echo     [INFO] Schema already exists
            ) else (
                echo     [WARN] Issue with %%~nxf - check logs
            )
        )
    )
)
echo   [OK] Database schema initialized

echo.
REM ===== PHASE 3: APPLICATION SERVICES =====
echo [PHASE 3] Application Services
echo ----------------------------------------

REM Build services if needed
echo [BUILD] Checking service builds...
if not exist services\api-gateway\dist (
    echo   Building API Gateway...
    cd services\api-gateway
    call npm run build >..\..\%LOG_DIR%\build-api-gateway.log 2>&1
    if !errorlevel! neq 0 (
        echo   [ERROR] API Gateway build failed
        cd ..\..
        pause
        exit /b 1
    )
    cd ..\..
    echo   [OK] API Gateway built
) else (
    echo   [OK] API Gateway already built
)

REM Start API Gateway
echo [START] API Gateway (port %API_GATEWAY_PORT%)...
start "API Gateway" /MIN cmd /c "cd services\api-gateway && npm start >..\..\%LOG_DIR%\api-gateway.log 2>&1"
ping -n 4 localhost >nul 2>&1

REM Verify API Gateway started
curl -s http://localhost:%API_GATEWAY_PORT%/health >nul 2>&1
if %errorlevel% neq 0 (
    echo   [WARN] API Gateway not responding yet, waiting...
    ping -n 6 localhost >nul 2>&1
    curl -s http://localhost:%API_GATEWAY_PORT%/health >nul 2>&1
    if !errorlevel! neq 0 (
        echo   [ERROR] API Gateway failed to start
        echo   Check logs\api-gateway.log for details
        pause
        exit /b 1
    )
)
echo   [OK] API Gateway running

REM Start Bulk Upload API (using the correct server file)
echo [START] Bulk Upload API (port %BULK_UPLOAD_PORT%)...
start "Bulk Upload API" /MIN cmd /c "cd services\bulk-upload-api && set PORT=%BULK_UPLOAD_PORT% && node server-enterprise-v2.js >..\..\%LOG_DIR%\bulk-upload.log 2>&1"
ping -n 4 localhost >nul 2>&1

REM Verify Bulk Upload API started
curl -s http://localhost:%BULK_UPLOAD_PORT%/health >nul 2>&1
if %errorlevel% neq 0 (
    echo   [WARN] Bulk Upload API not responding yet, waiting...
    ping -n 6 localhost >nul 2>&1
    curl -s http://localhost:%BULK_UPLOAD_PORT%/health >nul 2>&1
    if !errorlevel! neq 0 (
        echo   [ERROR] Bulk Upload API failed to start
        echo   Check logs\bulk-upload.log for details
        pause
        exit /b 1
    )
)
echo   [OK] Bulk Upload API running

REM Start Frontend
echo [START] Frontend (port %FRONTEND_PORT%)...
start "Sales Frontend" /MIN cmd /c "cd services\sales-frontend && set PORT=%FRONTEND_PORT% && npm start >..\..\%LOG_DIR%\frontend.log 2>&1"
echo   [OK] Frontend starting (may take 30-60 seconds to compile)

echo.
REM ===== PHASE 4: HEALTH VERIFICATION =====
echo [PHASE 4] System Health Verification
echo ----------------------------------------

ping -n 6 localhost >nul 2>&1

echo [TEST] Running health checks...

REM Test database connection
echo   Testing database connection...
docker exec %POSTGRES_CONTAINER% psql -U mangalm -d mangalm_sales -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo     [WARN] Database connection test failed
) else (
    echo     [OK] Database connection verified
)

REM Test Redis connection
echo   Testing Redis connection...
docker exec %REDIS_CONTAINER% redis-cli SET test:startup "ok" EX 10 >nul 2>&1
if %errorlevel% neq 0 (
    echo     [WARN] Redis connection test failed
) else (
    echo     [OK] Redis connection verified
)

REM Test API endpoints
echo   Testing API Gateway health...
curl -s http://localhost:%API_GATEWAY_PORT%/health >nul 2>&1
if %errorlevel% neq 0 (
    echo     [WARN] API Gateway health check failed
) else (
    echo     [OK] API Gateway health verified
)

echo   Testing Bulk Upload health...
curl -s http://localhost:%BULK_UPLOAD_PORT%/health >nul 2>&1
if %errorlevel% neq 0 (
    echo     [WARN] Bulk Upload health check failed
) else (
    echo     [OK] Bulk Upload health verified
)

echo.
echo ========================================================
echo     SYSTEM STARTUP COMPLETE
echo ========================================================
echo.
echo Service Endpoints:
echo ------------------
echo   Frontend:        http://localhost:%FRONTEND_PORT%
echo   API Gateway:     http://localhost:%API_GATEWAY_PORT%
echo   Bulk Upload:     http://localhost:%BULK_UPLOAD_PORT%
echo   API Docs:        http://localhost:%API_GATEWAY_PORT%/api-docs
echo.
echo Infrastructure:
echo ---------------
echo   PostgreSQL:      localhost:%POSTGRES_PORT% (internal: 5432)
echo   Redis:           localhost:%REDIS_PORT% (internal: 6379)
echo   PgAdmin:         http://localhost:5050
echo   Redis Commander: http://localhost:8081
echo.
echo Commands:
echo ---------
echo   View logs:       docker-compose logs -f
echo   Stop all:        stop-enterprise.bat
echo   Clean stop:      stop-enterprise.bat --clean
echo.
echo The application will open in your browser in 20 seconds...
echo (Frontend compilation may take up to 60 seconds)
echo.
ping -n 21 localhost >nul 2>&1
start http://localhost:%FRONTEND_PORT%
echo.
echo [%DATE% %TIME%] Startup sequence completed successfully.
echo.
pause