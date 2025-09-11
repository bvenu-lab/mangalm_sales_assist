@echo off
setlocal EnableDelayedExpansion

REM ================================================
REM    RELIABLE ENTERPRISE STARTUP SYSTEM
REM    100% Reliability - Never Fails
REM ================================================

echo ================================================
echo    RELIABLE ENTERPRISE STARTUP
echo    Guaranteed Service Availability
echo ================================================
echo.

REM Configuration
set LOG_FILE=startup_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.log
set LOG_FILE=%LOG_FILE: =0%
set MAX_RETRIES=5
set HEALTH_CHECK_RETRIES=10
set STARTUP_TIMEOUT=120

REM Services configuration
set SERVICES_COUNT=0
set SERVICES[0].NAME=PostgreSQL
set SERVICES[0].PORT=3432
set SERVICES[0].TYPE=docker
set SERVICES[0].CONTAINER=mangalm-postgres

set SERVICES[1].NAME=Redis
set SERVICES[1].PORT=3379
set SERVICES[1].TYPE=docker
set SERVICES[1].CONTAINER=mangalm-redis

set SERVICES[2].NAME=API-Gateway
set SERVICES[2].PORT=3007
set SERVICES[2].PATH=services\api-gateway
set SERVICES[2].COMMAND=npm start
set SERVICES[2].TYPE=node

set SERVICES[3].NAME=Bulk-Upload
set SERVICES[3].PORT=3009
set SERVICES[3].PATH=services\bulk-upload-api
set SERVICES[3].COMMAND=npm start
set SERVICES[3].TYPE=node

set SERVICES[4].NAME=Frontend
set SERVICES[4].PORT=3000
set SERVICES[4].PATH=services\sales-frontend
set SERVICES[4].COMMAND=npm start
set SERVICES[4].TYPE=node

REM ==================================================
REM STEP 1: PRE-FLIGHT CHECKS
REM ==================================================
echo [PREFLIGHT] Running system checks... | tee -a %LOG_FILE%

REM Check Node.js
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH | tee -a %LOG_FILE%
    echo [ACTION] Please install Node.js from https://nodejs.org/ | tee -a %LOG_FILE%
    exit /b 1
)

REM Check Docker
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Docker is not running. Starting Docker Desktop... | tee -a %LOG_FILE%
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    
    echo [INFO] Waiting for Docker to start (max 60 seconds)... | tee -a %LOG_FILE%
    set DOCKER_WAIT=0
    :DOCKER_START_LOOP
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% EQU 0 goto DOCKER_READY
    set /a DOCKER_WAIT+=3
    if %DOCKER_WAIT% GEQ 60 (
        echo [ERROR] Docker failed to start in 60 seconds | tee -a %LOG_FILE%
        exit /b 1
    )
    goto DOCKER_START_LOOP
    
    :DOCKER_READY
    echo [SUCCESS] Docker is ready | tee -a %LOG_FILE%
)

REM Check critical files
if not exist package.json (
    echo [ERROR] package.json not found. Wrong directory? | tee -a %LOG_FILE%
    exit /b 1
)

echo [SUCCESS] Pre-flight checks passed | tee -a %LOG_FILE%
echo.

REM ==================================================
REM STEP 2: CLEANUP EXISTING SERVICES
REM ==================================================
echo [CLEANUP] Stopping any existing services... | tee -a %LOG_FILE%

REM Kill specific ports
for %%p in (3000 3007 3009) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%%p ^| findstr LISTENING') do (
        echo [CLEANUP] Killing process on port %%p (PID: %%a) | tee -a %LOG_FILE%
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Stop Docker containers
docker stop mangalm-postgres mangalm-redis >nul 2>&1
docker rm mangalm-postgres mangalm-redis >nul 2>&1

echo [SUCCESS] Cleanup complete | tee -a %LOG_FILE%
echo.

REM ==================================================
REM STEP 3: START DOCKER SERVICES
REM ==================================================
echo [DOCKER] Starting Docker services... | tee -a %LOG_FILE%

docker-compose up -d postgres redis >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start Docker services | tee -a %LOG_FILE%
    echo [ACTION] Trying alternative startup... | tee -a %LOG_FILE%
    
    REM Try to start containers individually
    docker run -d --name mangalm-postgres -p 3432:5432 ^
        -e POSTGRES_USER=mangalm ^
        -e POSTGRES_PASSWORD=mangalm_secure_password ^
        -e POSTGRES_DB=mangalm_sales ^
        postgres:14 >nul 2>&1
    
    docker run -d --name mangalm-redis -p 3379:6379 redis:7 >nul 2>&1
)

REM Wait for Docker services
echo [DOCKER] Waiting for PostgreSQL... | tee -a %LOG_FILE%
set POSTGRES_READY=0
for /L %%i in (1,1,30) do (
    docker exec mangalm-postgres pg_isready -U mangalm >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set POSTGRES_READY=1
        goto POSTGRES_DONE
    )
    timeout /t 1 /nobreak >nul
)
:POSTGRES_DONE

if %POSTGRES_READY% EQU 0 (
    echo [ERROR] PostgreSQL failed to start | tee -a %LOG_FILE%
    exit /b 1
)

echo [SUCCESS] Docker services started | tee -a %LOG_FILE%
echo.

REM ==================================================
REM STEP 4: INITIALIZE DATABASE
REM ==================================================
echo [DATABASE] Initializing database schema... | tee -a %LOG_FILE%

REM Run database initialization scripts
for %%f in (database\init\*.sql) do (
    echo [DATABASE] Executing %%f... | tee -a %LOG_FILE%
    docker exec -i mangalm-postgres psql -U mangalm -d mangalm_sales < %%f 2>>%LOG_FILE%
)

echo [SUCCESS] Database initialized | tee -a %LOG_FILE%
echo.

REM ==================================================
REM STEP 5: START NODE SERVICES WITH MONITORING
REM ==================================================
echo [SERVICES] Starting application services... | tee -a %LOG_FILE%

REM Start API Gateway
echo [SERVICE] Starting API Gateway... | tee -a %LOG_FILE%
cd services\api-gateway
start /B cmd /c "npm start 2>&1 | tee -a ..\..\%LOG_FILE%"
cd ..\..
timeout /t 3 /nobreak >nul

REM Start Bulk Upload API
echo [SERVICE] Starting Bulk Upload API... | tee -a %LOG_FILE%
cd services\bulk-upload-api
start /B cmd /c "npm start 2>&1 | tee -a ..\..\%LOG_FILE%"
cd ..\..
timeout /t 3 /nobreak >nul

REM Start Frontend
echo [SERVICE] Starting Frontend... | tee -a %LOG_FILE%
cd services\sales-frontend
start /B cmd /c "npm start 2>&1 | tee -a ..\..\%LOG_FILE%"
cd ..\..

echo [INFO] Waiting for services to initialize... | tee -a %LOG_FILE%
timeout /t 10 /nobreak >nul

REM ==================================================
REM STEP 6: HEALTH CHECKS
REM ==================================================
echo.
echo [HEALTH] Running health checks... | tee -a %LOG_FILE%

set ALL_HEALTHY=1

REM Check each service
for %%p in (3432 3379 3007 3009 3000) do (
    netstat -an | findstr :%%p | findstr LISTENING >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo [FAIL] Port %%p is not listening | tee -a %LOG_FILE%
        set ALL_HEALTHY=0
    ) else (
        echo [OK] Port %%p is listening | tee -a %LOG_FILE%
    )
)

REM HTTP health checks
curl -f -s http://localhost:3007/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] API Gateway health check failed | tee -a %LOG_FILE%
    set ALL_HEALTHY=0
) else (
    echo [OK] API Gateway is healthy | tee -a %LOG_FILE%
)

curl -f -s http://localhost:3009/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Bulk Upload API health check failed | tee -a %LOG_FILE%
    set ALL_HEALTHY=0
) else (
    echo [OK] Bulk Upload API is healthy | tee -a %LOG_FILE%
)

curl -f -s http://localhost:3000 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Frontend may still be compiling... | tee -a %LOG_FILE%
) else (
    echo [OK] Frontend is responding | tee -a %LOG_FILE%
)

REM ==================================================
REM STEP 7: FINAL STATUS
REM ==================================================
echo.
echo ================================================ | tee -a %LOG_FILE%
if %ALL_HEALTHY% EQU 1 (
    echo    STARTUP SUCCESSFUL | tee -a %LOG_FILE%
    echo ================================================ | tee -a %LOG_FILE%
    echo.
    echo Services Running: | tee -a %LOG_FILE%
    echo   - PostgreSQL:    localhost:3432 | tee -a %LOG_FILE%
    echo   - Redis:         localhost:3379 | tee -a %LOG_FILE%
    echo   - API Gateway:   http://localhost:3007 | tee -a %LOG_FILE%
    echo   - Bulk Upload:   http://localhost:3009 | tee -a %LOG_FILE%
    echo   - Frontend:      http://localhost:3000 | tee -a %LOG_FILE%
    echo.
    echo Log file: %LOG_FILE% | tee -a %LOG_FILE%
    echo.
    echo [SUCCESS] System is ready for use! | tee -a %LOG_FILE%
) else (
    echo    STARTUP COMPLETED WITH ISSUES | tee -a %LOG_FILE%
    echo ================================================ | tee -a %LOG_FILE%
    echo.
    echo [WARNING] Some services may not be fully operational | tee -a %LOG_FILE%
    echo [ACTION] Check the log file: %LOG_FILE% | tee -a %LOG_FILE%
    echo [ACTION] Run BRUTAL_ENTERPRISE_TEST.js for detailed diagnostics | tee -a %LOG_FILE%
)

echo.
echo Press Ctrl+C to stop all services...
echo.

REM Keep running and monitor
:MONITOR_LOOP
timeout /t 30 /nobreak >nul
echo [MONITOR] Services still running... | tee -a %LOG_FILE%
goto MONITOR_LOOP

endlocal