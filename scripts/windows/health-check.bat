@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Mangalm Services Health Check
echo ========================================
echo.
echo Checking service health status...
echo.

set TOTAL_SERVICES=6
set HEALTHY_SERVICES=0
set WARNING_SERVICES=0
set FAILED_SERVICES=0

REM Function to check service health
:CheckService
set SERVICE_NAME=%~1
set SERVICE_URL=%~2
set SERVICE_PORT=%~3

echo Checking %SERVICE_NAME%...

REM First check if port is listening
netstat -an | findstr ":%SERVICE_PORT%" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [FAILED] %SERVICE_NAME% - Port %SERVICE_PORT% not listening
    set /a FAILED_SERVICES+=1
    goto :eof
)

REM Try to get health endpoint
curl -s -o nul -w "%%{http_code}" %SERVICE_URL% > temp_status.txt 2>nul
set /p HTTP_STATUS=<temp_status.txt
del temp_status.txt >nul 2>&1

if "%HTTP_STATUS%"=="200" (
    echo   [OK] %SERVICE_NAME% - Healthy
    set /a HEALTHY_SERVICES+=1
) else if "%HTTP_STATUS%"=="000" (
    echo   [WARNING] %SERVICE_NAME% - Running but health endpoint not responding
    set /a WARNING_SERVICES+=1
) else (
    echo   [FAILED] %SERVICE_NAME% - HTTP Status: %HTTP_STATUS%
    set /a FAILED_SERVICES+=1
)
goto :eof

REM Check PostgreSQL
echo.
echo [Database Services]
echo -------------------
pg_isready -h localhost -p 5432 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] PostgreSQL - Running on port 5432
    
    REM Check database connection
    for /f "tokens=1,2 delims==" %%a in ('findstr "DB_" ".env" 2^>nul') do set %%a=%%b
    set PGPASSWORD=!DB_PASSWORD!
    psql -U !DB_USER! -h localhost -p 5432 -d !DB_NAME! -c "SELECT 1;" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo   [OK] Database connection - Success
    ) else (
        echo   [FAILED] Database connection - Cannot connect to mangalm_sales
    )
    set PGPASSWORD=
) else (
    echo   [FAILED] PostgreSQL - Not running
    set /a FAILED_SERVICES+=1
)

REM Check Redis
redis-cli ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] Redis - Running on port 6379
) else (
    echo   [INFO] Redis - Not running (optional)
)

echo.
echo [Application Services]
echo ----------------------

REM Check each service
call :CheckService "Frontend" "http://localhost:3000" "3000"
call :CheckService "API Gateway" "http://localhost:3007/health" "3007"
call :CheckService "AI Service" "http://localhost:3006/health" "3006"
call :CheckService "Document Processor" "http://localhost:3010/health" "3010"
call :CheckService "PM Orchestrator" "http://localhost:3003/health" "3003"
call :CheckService "Zoho Integration" "http://localhost:3002/health" "3002"

echo.
echo [API Endpoints]
echo ---------------

REM Check specific API endpoints
curl -s http://localhost:3007/api-docs >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] API Documentation - Available at http://localhost:3007/api-docs
) else (
    echo   [WARNING] API Documentation - Not available
)

REM Check authentication endpoint
curl -s -X POST http://localhost:3007/auth/login -H "Content-Type: application/json" -d "{\"username\":\"test\",\"password\":\"test\"}" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] Authentication API - Responding
) else (
    echo   [WARNING] Authentication API - Not responding
)

echo.
echo [System Resources]
echo ------------------

REM Check memory usage
for /f "skip=1" %%a in ('wmic os get TotalVisibleMemorySize') do (
    set /a TOTAL_MEM=%%a/1024
    goto :gotmem
)
:gotmem

for /f "skip=1" %%a in ('wmic os get FreePhysicalMemory') do (
    set /a FREE_MEM=%%a/1024
    goto :gotfreemem
)
:gotfreemem

set /a USED_MEM=TOTAL_MEM-FREE_MEM
set /a MEM_PERCENT=USED_MEM*100/TOTAL_MEM

echo   Memory: %USED_MEM%MB / %TOTAL_MEM%MB (%MEM_PERCENT%%% used)

if %MEM_PERCENT% GTR 90 (
    echo   [WARNING] High memory usage detected
)

REM Check disk space
for /f "tokens=3" %%a in ('dir C:\ ^| findstr "bytes free"') do (
    set FREE_SPACE=%%a
)
echo   Disk Space: %FREE_SPACE% bytes free on C:\

echo.
echo [Log Files]
echo -----------
if exist "logs\" (
    echo   Log directory exists
    dir logs\*.log 2>nul | find "File(s)" >nul
    if !ERRORLEVEL! EQU 0 (
        echo   [OK] Log files are being generated
    ) else (
        echo   [INFO] No log files found yet
    )
) else (
    echo   [INFO] Log directory not found
)

echo.
echo ========================================
echo Health Check Summary
echo ========================================
echo.
echo   Healthy Services:  %HEALTHY_SERVICES%
echo   Warning Services:  %WARNING_SERVICES%
echo   Failed Services:   %FAILED_SERVICES%
echo.

if %FAILED_SERVICES% GTR 0 (
    echo [CRITICAL] Some services are not running properly!
    echo.
    echo Troubleshooting steps:
    echo 1. Check if all services are started: run start-all.bat
    echo 2. Check logs in the logs\ directory
    echo 3. Verify PostgreSQL is running
    echo 4. Check if ports are not blocked by firewall
    echo 5. Run troubleshoot.bat for detailed diagnostics
) else if %WARNING_SERVICES% GTR 0 (
    echo [WARNING] Some services have warnings but system is operational
) else (
    echo [SUCCESS] All services are healthy!
    echo.
    echo You can access the application at:
    echo   http://localhost:3000
)

echo.
pause