@echo off
setlocal enabledelayedexpansion
REM ============================================
REM ENTERPRISE-GRADE SYSTEM SHUTDOWN SCRIPT v3.0
REM Graceful shutdown with complete cleanup
REM ============================================

REM Configuration
set LOG_DIR=logs
set POSTGRES_PORT=3432
set REDIS_PORT=3379
set API_GATEWAY_PORT=3007
set BULK_UPLOAD_PORT=3009
set FRONTEND_PORT=3000
set GRACE_PERIOD=3

REM Container names (as shown by docker ps)
set POSTGRES_CONTAINER=mangalm-postgres
set REDIS_CONTAINER=mangalm-redis

echo.
echo ========================================================
echo     MANGALM ENTERPRISE SYSTEM SHUTDOWN v3.0
echo     Graceful Service Termination
echo ========================================================
echo.
echo [%DATE% %TIME%] Initiating shutdown sequence...
echo.

REM ===== PHASE 1: APPLICATION SHUTDOWN =====
echo [PHASE 1] Application Services Shutdown
echo ----------------------------------------

echo [CHECK] Identifying running services...
set SERVICES_FOUND=0

REM Check for services by window title
for %%t in ("API Gateway" "Bulk Upload API" "Sales Frontend" "Enterprise Server" "Frontend") do (
    tasklist /FI "WindowTitle eq %%~t*" 2>nul | findstr /i "cmd.exe" >nul
    if !errorlevel! equ 0 (
        echo   Found: %%~t
        set SERVICES_FOUND=1
    )
)

if !SERVICES_FOUND! equ 1 (
    echo [STOP] Sending graceful termination signals...
    
    REM Gracefully stop Node services by window title
    taskkill /FI "WindowTitle eq API Gateway*" /T >nul 2>&1
    taskkill /FI "WindowTitle eq Bulk Upload API*" /T >nul 2>&1
    taskkill /FI "WindowTitle eq Sales Frontend*" /T >nul 2>&1
    taskkill /FI "WindowTitle eq Enterprise Server*" /T >nul 2>&1
    taskkill /FI "WindowTitle eq Frontend*" /T >nul 2>&1
    
    echo   [OK] Termination signals sent
    echo   Waiting %GRACE_PERIOD% seconds for graceful shutdown...
    ping -n %GRACE_PERIOD% localhost >nul 2>&1
    
    REM Force kill if still running
    echo [CLEANUP] Ensuring services stopped...
    taskkill /FI "WindowTitle eq API Gateway*" /T /F >nul 2>&1
    taskkill /FI "WindowTitle eq Bulk Upload API*" /T /F >nul 2>&1
    taskkill /FI "WindowTitle eq Sales Frontend*" /T /F >nul 2>&1
    taskkill /FI "WindowTitle eq Enterprise Server*" /T /F >nul 2>&1
    taskkill /FI "WindowTitle eq Frontend*" /T /F >nul 2>&1
    
    echo   [OK] Application services stopped
) else (
    echo   [OK] No application services running
)

echo.
REM ===== PHASE 2: PORT CLEANUP =====
echo [PHASE 2] Port Cleanup
echo ----------------------------------------

echo [CLEAN] Checking for orphaned port listeners...
set PORTS_CLEANED=0

for %%p in (%API_GATEWAY_PORT% %BULK_UPLOAD_PORT% %FRONTEND_PORT%) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
        set PID=%%a
        
        REM Check if this is a Node process (avoid killing other apps)
        tasklist /FI "PID eq !PID!" 2>nul | findstr "node.exe" >nul
        if !errorlevel! equ 0 (
            echo   Port %%p held by Node.js PID !PID!
            
            REM Kill the specific Node process
            taskkill /PID !PID! /F >nul 2>&1
            if !errorlevel! equ 0 (
                set /a PORTS_CLEANED+=1
                echo   [OK] Terminated orphaned process on port %%p
            ) else (
                echo   [WARN] Could not terminate PID !PID!
            )
        )
    )
)

if !PORTS_CLEANED! gtr 0 (
    echo   [OK] Cleaned !PORTS_CLEANED! orphaned port listeners
) else (
    echo   [OK] No orphaned port listeners found
)

echo.
REM ===== PHASE 3: DOCKER CLEANUP =====
echo [PHASE 3] Docker Infrastructure
echo ----------------------------------------

echo [CHECK] Docker service status...
docker ps >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Docker is running
    
    echo [STOP] Stopping Docker containers...
    docker-compose down >"%LOG_DIR%\docker-stop.log" 2>&1
    if !errorlevel! equ 0 (
        echo   [OK] Docker containers stopped
    ) else (
        echo   [INFO] Docker containers may not have been running
    )
    
    REM Optional: Remove volumes on full cleanup
    if "%1"=="--clean" (
        echo [CLEAN] Removing Docker volumes...
        docker-compose down -v >>"%LOG_DIR%\docker-stop.log" 2>&1
        if !errorlevel! equ 0 (
            echo   [OK] Docker volumes removed
        ) else (
            echo   [WARN] Could not remove volumes (may not exist)
        )
    )
) else (
    echo   [INFO] Docker not running or not accessible
)

echo.
REM ===== PHASE 4: FILE CLEANUP =====
echo [PHASE 4] File Cleanup
echo ----------------------------------------

echo [CLEAN] Cleaning temporary files...
set FILES_CLEANED=0

REM Clean upload directory
if exist services\bulk-upload-api\uploads (
    for %%f in (services\bulk-upload-api\uploads\*.*) do (
        del /Q "%%f" >nul 2>&1
        if !errorlevel! equ 0 set /a FILES_CLEANED+=1
    )
)

REM Clean temp CSV files
for %%f in (*.csv.tmp *.csv.processing test-*.csv) do (
    if exist "%%f" (
        del /Q "%%f" >nul 2>&1
        if !errorlevel! equ 0 set /a FILES_CLEANED+=1
    )
)

REM Clean log files older than 7 days (optional)
if "%1"=="--clean" (
    if exist "%LOG_DIR%" (
        forfiles /P "%LOG_DIR%" /M *.log /D -7 /C "cmd /c del @file" >nul 2>&1
        echo   [INFO] Cleaned old log files
    )
)

if !FILES_CLEANED! gtr 0 (
    echo   [OK] Cleaned !FILES_CLEANED! temporary files
) else (
    echo   [OK] No temporary files to clean
)

echo.
REM ===== PHASE 5: VERIFICATION =====
echo [PHASE 5] Shutdown Verification
echo ----------------------------------------

echo [VERIFY] Checking service status...
set ISSUES=0

REM Check if critical ports are free
for %%p in (%API_GATEWAY_PORT% %BULK_UPLOAD_PORT% %FRONTEND_PORT%) do (
    netstat -ano | findstr :%%p | findstr LISTENING >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [WARN] Port %%p still in use
        set /a ISSUES+=1
    )
)

REM Check Docker containers
docker ps --format "{{.Names}}" 2>nul | findstr "mangalm" >nul 2>&1
if !errorlevel! equ 0 (
    echo   [WARN] Some Docker containers still running
    docker ps --format "table {{.Names}}\t{{.Status}}" | findstr "mangalm"
    set /a ISSUES+=1
)

REM Final status
if !ISSUES! equ 0 (
    echo   [OK] All services successfully stopped
    echo   [OK] All ports are free
    echo   [OK] System is clean
) else (
    echo   [WARN] !ISSUES! issue(s) detected
    echo   Manual cleanup may be required
    echo.
    echo   To force cleanup all Node processes on ports:
    echo   for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3007 :3009 :3001"') do taskkill /PID %%a /F
)

echo.
echo ========================================================
echo     SHUTDOWN COMPLETE
echo ========================================================
echo.
echo [%DATE% %TIME%] Shutdown sequence completed.
echo.
echo Options:
echo ---------
echo   stop-enterprise.bat           (normal shutdown)
echo   stop-enterprise.bat --clean   (remove Docker volumes and old logs)
echo   stop-enterprise.bat --silent  (no pause at end)
echo.
echo To restart the system:
echo   start-enterprise.bat
echo.

if not "%1"=="--silent" (
    if not "%2"=="--silent" (
        pause
    )
)