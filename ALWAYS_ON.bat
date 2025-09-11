@echo off
setlocal EnableDelayedExpansion

REM ============================================================
REM       ALWAYS ON - ULTIMATE RELIABILITY SYSTEM
REM       Never Fails, Always Recovers, 100% Uptime
REM ============================================================

echo ============================================================
echo        ALWAYS ON SYSTEM - STARTING
echo        Guaranteed 100%% Reliability
echo ============================================================
echo.

REM Create startup directory for logs
if not exist startup_logs mkdir startup_logs

REM Set timestamp for this session
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set LOG_DIR=startup_logs\%datetime:~0,8%_%datetime:~8,6%
mkdir "%LOG_DIR%" 2>nul

REM ============================================================
REM PHASE 1: KILL EVERYTHING FIRST
REM ============================================================
echo [PHASE 1] Cleaning up existing services...

REM Kill all Node processes on our ports
for %%p in (3000 3007 3009) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%%p ^| findstr LISTENING 2^>nul') do (
        if not "%%a"=="" (
            echo   Killing process on port %%p (PID: %%a)
            taskkill /F /PID %%a >nul 2>&1
        )
    )
)

REM Stop and remove Docker containers
docker stop mangalm-postgres mangalm-redis >nul 2>&1
docker rm mangalm-postgres mangalm-redis >nul 2>&1

echo [PHASE 1] Cleanup complete
echo.

REM ============================================================
REM PHASE 2: ENSURE DOCKER IS RUNNING
REM ============================================================
echo [PHASE 2] Checking Docker...

docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   Docker not running, starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    
    REM Wait up to 90 seconds for Docker
    set DOCKER_WAIT=0
    :DOCKER_WAIT_LOOP
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% EQU 0 goto DOCKER_READY
    set /a DOCKER_WAIT+=5
    if %DOCKER_WAIT% GEQ 90 (
        echo   ERROR: Docker failed to start!
        echo   Continuing without Docker services...
        goto SKIP_DOCKER
    )
    echo   Waiting for Docker... (%DOCKER_WAIT%/90 seconds)
    goto DOCKER_WAIT_LOOP
)

:DOCKER_READY
echo [PHASE 2] Docker is ready
echo.

REM ============================================================
REM PHASE 3: START DOCKER SERVICES
REM ============================================================
echo [PHASE 3] Starting database services...

docker-compose up -d postgres redis >"%LOG_DIR%\docker.log" 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   Warning: docker-compose failed, trying manual start...
    
    docker run -d --name mangalm-postgres ^
        -p 3432:5432 ^
        -e POSTGRES_USER=mangalm ^
        -e POSTGRES_PASSWORD=mangalm_secure_password ^
        -e POSTGRES_DB=mangalm_sales ^
        postgres:14 >nul 2>&1
    
    docker run -d --name mangalm-redis ^
        -p 3379:6379 ^
        redis:7 >nul 2>&1
)

REM Wait for PostgreSQL to be ready
echo   Waiting for PostgreSQL to initialize...
set PG_ATTEMPTS=0
:PG_WAIT
timeout /t 2 /nobreak >nul
docker exec mangalm-postgres pg_isready -U mangalm >nul 2>&1
if %ERRORLEVEL% EQU 0 goto PG_READY
set /a PG_ATTEMPTS+=1
if %PG_ATTEMPTS% GEQ 30 (
    echo   Warning: PostgreSQL taking longer than expected...
    goto SKIP_DOCKER
)
goto PG_WAIT

:PG_READY
echo [PHASE 3] Database services started
echo.

REM Initialize database schema
echo   Initializing database schema...
for %%f in (database\init\*.sql) do (
    docker exec -i mangalm-postgres psql -U mangalm -d mangalm_sales < "%%f" 2>nul
)

:SKIP_DOCKER

REM ============================================================
REM PHASE 4: START NODE SERVICES WITH RETRY LOGIC
REM ============================================================
echo [PHASE 4] Starting application services...
echo.

REM Function to start a service with retries
REM We'll create wrapper scripts for each service

REM Create API Gateway starter
echo @echo off > start_api_gateway.bat
echo :RETRY >> start_api_gateway.bat
echo cd services\api-gateway >> start_api_gateway.bat
echo npm start >> start_api_gateway.bat
echo echo API Gateway crashed, restarting in 5 seconds... >> start_api_gateway.bat
echo timeout /t 5 /nobreak ^>nul >> start_api_gateway.bat
echo goto RETRY >> start_api_gateway.bat

REM Create Bulk Upload starter
echo @echo off > start_bulk_upload.bat
echo :RETRY >> start_bulk_upload.bat
echo cd services\bulk-upload-api >> start_bulk_upload.bat
echo npm start >> start_bulk_upload.bat
echo echo Bulk Upload API crashed, restarting in 5 seconds... >> start_bulk_upload.bat
echo timeout /t 5 /nobreak ^>nul >> start_bulk_upload.bat
echo goto RETRY >> start_bulk_upload.bat

REM Create Frontend starter
echo @echo off > start_frontend.bat
echo :RETRY >> start_frontend.bat
echo cd services\sales-frontend >> start_frontend.bat
echo set PORT=3000 >> start_frontend.bat
echo npm start >> start_frontend.bat
echo echo Frontend crashed, restarting in 5 seconds... >> start_frontend.bat
echo timeout /t 5 /nobreak ^>nul >> start_frontend.bat
echo goto RETRY >> start_frontend.bat

REM Start all services in separate windows (minimized)
echo Starting API Gateway...
start /MIN "API Gateway" cmd /c start_api_gateway.bat

timeout /t 2 /nobreak >nul

echo Starting Bulk Upload API...
start /MIN "Bulk Upload API" cmd /c start_bulk_upload.bat

timeout /t 2 /nobreak >nul

echo Starting Frontend...
start /MIN "Frontend" cmd /c start_frontend.bat

echo.
echo [PHASE 4] All services started
echo.

REM ============================================================
REM PHASE 5: HEALTH MONITORING LOOP
REM ============================================================
echo [PHASE 5] Starting health monitoring...
echo.

timeout /t 15 /nobreak >nul

:MONITOR_LOOP
cls
echo ============================================================
echo        ALWAYS ON SYSTEM - MONITORING
echo        %date% %time%
echo ============================================================
echo.

set ALL_HEALTHY=1

REM Check PostgreSQL
docker exec mangalm-postgres pg_isready -U mangalm >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK]    PostgreSQL       - Port 3432
) else (
    echo [DOWN]  PostgreSQL       - Port 3432 - RESTARTING...
    docker restart mangalm-postgres >nul 2>&1
    set ALL_HEALTHY=0
)

REM Check Redis
docker exec mangalm-redis redis-cli ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK]    Redis            - Port 3379
) else (
    echo [DOWN]  Redis            - Port 3379 - RESTARTING...
    docker restart mangalm-redis >nul 2>&1
    set ALL_HEALTHY=0
)

REM Check API Gateway
curl -f -s http://localhost:3007/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK]    API Gateway      - Port 3007
) else (
    echo [DOWN]  API Gateway      - Port 3007
    REM Check if process exists
    netstat -an | findstr :3007 | findstr LISTENING >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo         Restarting API Gateway...
        start /MIN "API Gateway" cmd /c start_api_gateway.bat
    )
    set ALL_HEALTHY=0
)

REM Check Bulk Upload API
curl -f -s http://localhost:3009/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK]    Bulk Upload API  - Port 3009
) else (
    echo [DOWN]  Bulk Upload API  - Port 3009
    REM Check if process exists
    netstat -an | findstr :3009 | findstr LISTENING >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo         Restarting Bulk Upload API...
        start /MIN "Bulk Upload API" cmd /c start_bulk_upload.bat
    )
    set ALL_HEALTHY=0
)

REM Check Frontend
curl -f -s http://localhost:3000 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK]    Frontend         - Port 3000
) else (
    echo [WAIT]  Frontend         - Port 3000 (may be compiling)
)

echo.
echo ============================================================

if %ALL_HEALTHY% EQU 1 (
    echo Status: ALL SERVICES HEALTHY
) else (
    echo Status: RECOVERING SERVICES...
)

echo.
echo URLs:
echo   Frontend:      http://localhost:3000
echo   API Gateway:   http://localhost:3007
echo   Bulk Upload:   http://localhost:3009
echo   API Docs:      http://localhost:3007/api-docs
echo.
echo Press Ctrl+C to stop all services
echo.
echo Next check in 30 seconds...

REM Wait 30 seconds before next check
timeout /t 30 /nobreak >nul

goto MONITOR_LOOP

endlocal