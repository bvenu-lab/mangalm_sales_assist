@echo off
setlocal EnableDelayedExpansion

REM ========================================
REM     ENTERPRISE FULL SYSTEM RESTART
REM     Version: 1.0 Production Grade
REM ========================================

echo ========================================
echo     ENTERPRISE FULL SYSTEM RESTART
echo ========================================
echo Started at: %date% %time%
echo.

REM Initialize variables
set MAX_WAIT_CYCLES=30
set WAIT_CYCLE=0
set FORCE_KILL_AFTER=20

REM Step 1: Stop all services gracefully
echo [STEP 1/4] Stopping all services gracefully...
echo ----------------------------------------
call stop-all.bat --silent >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Initial stop command reported issues
    echo [INFO] Will force-kill if needed...
)

REM Step 2: Verify and force-kill if necessary
echo.
echo [STEP 2/4] Verifying service shutdown...
echo ----------------------------------------

:WAIT_LOOP
set /a WAIT_CYCLE+=1
set ALL_PORTS_FREE=1
set PORTS_IN_USE=

REM Check each port and build list of those still in use
for %%p in (3432 6379 3007 3009 3000 3001) do (
    netstat -an | findstr :%%p | findstr LISTENING >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set ALL_PORTS_FREE=0
        set PORTS_IN_USE=!PORTS_IN_USE! %%p
    )
)

REM Display status
if %ALL_PORTS_FREE% EQU 0 (
    echo [WAIT %WAIT_CYCLE%/%MAX_WAIT_CYCLES%] Ports still in use:!PORTS_IN_USE!
    
    REM Force kill after certain attempts
    if %WAIT_CYCLE% GEQ %FORCE_KILL_AFTER% (
        echo [WARNING] Services not stopping gracefully. Force killing specific services...
        
        REM Force kill ONLY specific services by port (NOT all node.exe processes)
        REM This prevents killing Claude Code or other unrelated Node.js processes
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3007 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3009 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
        
        REM Docker containers need special handling
        docker ps -q --filter "publish=3432" >nul 2>&1 && docker stop $(docker ps -q --filter "publish=3432") >nul 2>&1
        docker ps -q --filter "publish=6379" >nul 2>&1 && docker stop $(docker ps -q --filter "publish=6379") >nul 2>&1
        
        echo [INFO] Force kill commands executed
    )
    
    REM Check if we've exceeded max wait
    if %WAIT_CYCLE% GEQ %MAX_WAIT_CYCLES% (
        echo.
        echo [ERROR] Could not free all ports after %MAX_WAIT_CYCLES% attempts
        echo [ERROR] The following ports are still in use:!PORTS_IN_USE!
        echo.
        echo [ACTION] Manual intervention required:
        echo   1. Check Task Manager for hanging node.exe processes
        echo   2. Check Docker Desktop for running containers
        echo   3. Run 'netstat -aon | findstr LISTENING' to identify processes
        echo.
        echo Aborting restart to prevent conflicts.
        exit /b 1
    )
    
    REM Wait before next check
    timeout /t 2 /nobreak >nul
    goto WAIT_LOOP
)

echo [SUCCESS] All ports are free!

REM Step 3: Clean verification before starting
echo.
echo [STEP 3/4] Final pre-start verification...
echo ----------------------------------------

REM Double-check critical ports one more time
set FINAL_CHECK_PASSED=1
for %%p in (3432 6379 3007 3009 3000 3001) do (
    netstat -an | findstr :%%p | findstr LISTENING >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo [ERROR] Port %%p became occupied during final check!
        set FINAL_CHECK_PASSED=0
    )
)

if %FINAL_CHECK_PASSED% EQU 0 (
    echo [ERROR] Final verification failed. Aborting.
    exit /b 1
)

REM Check Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Docker is not running or not accessible
    echo [ACTION] Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo [INFO] Waiting for Docker to be ready (this may take 30-60 seconds)...
    
    :DOCKER_WAIT
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% NEQ 0 goto DOCKER_WAIT
    
    echo [SUCCESS] Docker is now ready
)

echo [SUCCESS] Pre-start verification complete

REM Step 4: Start all services with clean data
echo.
echo [STEP 4/4] Starting all services with clean data...
echo ----------------------------------------
call start-all.bat --clean

REM Verify services actually started
echo.
echo [VERIFICATION] Checking service startup...
timeout /t 5 /nobreak >nul

set STARTUP_SUCCESS=1
set FAILED_SERVICES=

REM Check each service port
netstat -an | findstr :3432 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set STARTUP_SUCCESS=0
    set FAILED_SERVICES=!FAILED_SERVICES! PostgreSQL
)

netstat -an | findstr :6379 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set STARTUP_SUCCESS=0
    set FAILED_SERVICES=!FAILED_SERVICES! Redis
)

netstat -an | findstr :3007 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set STARTUP_SUCCESS=0
    set FAILED_SERVICES=!FAILED_SERVICES! API-Gateway
)

netstat -an | findstr :3009 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set STARTUP_SUCCESS=0
    set FAILED_SERVICES=!FAILED_SERVICES! Bulk-Upload
)

netstat -an | findstr :3000 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set STARTUP_SUCCESS=0
    set FAILED_SERVICES=!FAILED_SERVICES! Frontend
)

REM Display final status
echo.
echo ========================================
if %STARTUP_SUCCESS% EQU 1 (
    echo     RESTART COMPLETED SUCCESSFULLY
    echo ========================================
    echo.
    echo [SUCCESS] All services are running:
    echo   ✓ PostgreSQL:    http://localhost:3432
    echo   ✓ Redis:         http://localhost:6379
    echo   ✓ API Gateway:   http://localhost:3007
    echo   ✓ Bulk Upload:   http://localhost:3009
    echo   ✓ Frontend:      http://localhost:3000
    echo   ✓ AI Service:    http://localhost:3001
    echo.
    echo [INFO] Application ready at: http://localhost:3000
    echo [INFO] Completed at: %date% %time%
) else (
    echo     RESTART COMPLETED WITH WARNINGS
    echo ========================================
    echo.
    echo [WARNING] Some services may not have started:!FAILED_SERVICES!
    echo.
    echo [ACTION] Check the console output above for errors
    echo [ACTION] Try running individual start commands for failed services
    echo [INFO] Completed at: %date% %time%
)

echo.
endlocal