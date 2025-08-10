@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Mangalm Troubleshooting Diagnostics
echo ========================================
echo.
echo Running comprehensive system diagnostics...
echo.

set ISSUES_FOUND=0
set WARNINGS_FOUND=0

REM Create temp directory for diagnostic outputs
set DIAG_DIR=%~dp0..\..\diagnostics
if not exist "%DIAG_DIR%" mkdir "%DIAG_DIR%"
set DIAG_FILE=%DIAG_DIR%\diagnostic_%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.txt
set DIAG_FILE=%DIAG_FILE: =0%

echo Diagnostic Report > "%DIAG_FILE%"
echo Generated: %date% %time% >> "%DIAG_FILE%"
echo ======================================== >> "%DIAG_FILE%"
echo. >> "%DIAG_FILE%"

REM Check System Requirements
echo [1/10] Checking System Requirements...
echo. >> "%DIAG_FILE%"
echo SYSTEM REQUIREMENTS >> "%DIAG_FILE%"
echo ------------------- >> "%DIAG_FILE%"

REM Check Windows version
ver | findstr /i "10\. 11\." >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [WARNING] Windows 10 or 11 recommended
    echo   WARNING: Windows 10 or 11 recommended >> "%DIAG_FILE%"
    set /a WARNINGS_FOUND+=1
) else (
    echo   [OK] Windows version compatible
    echo   OK: Windows version compatible >> "%DIAG_FILE%"
)

REM Check Node.js
echo.
echo [2/10] Checking Node.js Installation...
echo. >> "%DIAG_FILE%"
echo NODE.JS >> "%DIAG_FILE%"
echo ------- >> "%DIAG_FILE%"

node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [ERROR] Node.js is not installed!
    echo   ERROR: Node.js is not installed >> "%DIAG_FILE%"
    echo   Solution: Download and install from https://nodejs.org/
    echo   Solution: Download from https://nodejs.org/ >> "%DIAG_FILE%"
    set /a ISSUES_FOUND+=1
) else (
    for /f "tokens=*" %%v in ('node --version') do set NODE_VERSION=%%v
    echo   [OK] Node.js !NODE_VERSION! installed
    echo   OK: Node.js !NODE_VERSION! installed >> "%DIAG_FILE%"
    
    REM Check Node version
    for /f "tokens=2 delims=v." %%a in ('node --version') do set NODE_MAJOR=%%a
    if !NODE_MAJOR! LSS 16 (
        echo   [WARNING] Node.js 16+ recommended (current: !NODE_VERSION!)
        echo   WARNING: Node.js 16+ recommended >> "%DIAG_FILE%"
        set /a WARNINGS_FOUND+=1
    )
)

REM Check npm
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [ERROR] npm is not installed!
    echo   ERROR: npm is not installed >> "%DIAG_FILE%"
    set /a ISSUES_FOUND+=1
) else (
    for /f "tokens=*" %%v in ('npm --version') do set NPM_VERSION=%%v
    echo   [OK] npm !NPM_VERSION! installed
    echo   OK: npm !NPM_VERSION! installed >> "%DIAG_FILE%"
)

REM Check PostgreSQL
echo.
echo [3/10] Checking PostgreSQL...
echo. >> "%DIAG_FILE%"
echo POSTGRESQL >> "%DIAG_FILE%"
echo ---------- >> "%DIAG_FILE%"

pg_isready --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [ERROR] PostgreSQL client tools not found!
    echo   ERROR: PostgreSQL client tools not found >> "%DIAG_FILE%"
    echo   Solution: Add PostgreSQL bin directory to PATH
    echo   Solution: Add PostgreSQL\bin to PATH >> "%DIAG_FILE%"
    set /a ISSUES_FOUND+=1
) else (
    for /f "tokens=*" %%v in ('psql --version 2^>nul') do set PG_VERSION=%%v
    echo   [OK] PostgreSQL tools installed
    echo   OK: !PG_VERSION! >> "%DIAG_FILE%"
)

REM Check if PostgreSQL is running
pg_isready -h localhost -p 5432 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [ERROR] PostgreSQL service is not running!
    echo   ERROR: PostgreSQL service not running >> "%DIAG_FILE%"
    echo   Solution: Start PostgreSQL service from Services (services.msc)
    echo   Solution: Start from Services (services.msc) >> "%DIAG_FILE%"
    set /a ISSUES_FOUND+=1
    
    REM Try to identify the service
    sc query state=all | findstr /i "postgresql" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo   PostgreSQL service found but not running
        for /f "tokens=2" %%s in ('sc query state^=all ^| findstr /i "postgresql"') do (
            echo   Service name: %%s >> "%DIAG_FILE%"
        )
    )
) else (
    echo   [OK] PostgreSQL is running on port 5432
    echo   OK: PostgreSQL running on port 5432 >> "%DIAG_FILE%"
)

REM Check Database Connection
echo.
echo [4/10] Checking Database Connection...
echo. >> "%DIAG_FILE%"
echo DATABASE CONNECTION >> "%DIAG_FILE%"
echo ------------------- >> "%DIAG_FILE%"

if exist "%~dp0..\..\\.env" (
    for /f "tokens=1,2 delims==" %%a in ('findstr "DB_" "%~dp0..\..\\.env" 2^>nul') do set %%a=%%b
    
    if "!DB_NAME!"=="" (
        echo   [ERROR] Database configuration not found in .env
        echo   ERROR: DB configuration missing >> "%DIAG_FILE%"
        set /a ISSUES_FOUND+=1
    ) else (
        set PGPASSWORD=!DB_PASSWORD!
        psql -U !DB_USER! -h !DB_HOST! -p !DB_PORT! -d !DB_NAME! -c "SELECT 1;" >nul 2>&1
        if !ERRORLEVEL! NEQ 0 (
            echo   [ERROR] Cannot connect to database !DB_NAME!
            echo   ERROR: Cannot connect to !DB_NAME! >> "%DIAG_FILE%"
            echo   Check credentials in .env file
            set /a ISSUES_FOUND+=1
            
            REM Try to diagnose the issue
            psql -U !DB_USER! -h !DB_HOST! -p !DB_PORT! -d postgres -c "SELECT 1;" >nul 2>&1
            if !ERRORLEVEL! EQU 0 (
                echo   User can connect to postgres, database may not exist
                echo   Database !DB_NAME! may not exist >> "%DIAG_FILE%"
                echo   Solution: Run setup-database.bat
            ) else (
                echo   Authentication failed or user doesn't exist
                echo   User !DB_USER! authentication failed >> "%DIAG_FILE%"
            )
        ) else (
            echo   [OK] Database connection successful
            echo   OK: Connected to !DB_NAME! >> "%DIAG_FILE%"
        )
        set PGPASSWORD=
    )
) else (
    echo   [ERROR] .env file not found!
    echo   ERROR: .env file not found >> "%DIAG_FILE%"
    echo   Solution: Run setup-environment.bat
    set /a ISSUES_FOUND+=1
)

REM Check Port Availability
echo.
echo [5/10] Checking Port Availability...
echo. >> "%DIAG_FILE%"
echo PORT AVAILABILITY >> "%DIAG_FILE%"
echo ----------------- >> "%DIAG_FILE%"

set PORTS=3000 3001 3002 3003 3007 5432 6379
for %%p in (%PORTS%) do (
    netstat -an | findstr ":%%p" | findstr "LISTENING" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        if %%p==5432 (
            echo   [OK] Port %%p (PostgreSQL) - In use (expected)
            echo   OK: Port %%p (PostgreSQL) in use >> "%DIAG_FILE%"
        ) else if %%p==6379 (
            echo   [INFO] Port %%p (Redis) - In use
            echo   INFO: Port %%p (Redis) in use >> "%DIAG_FILE%"
        ) else (
            REM Check if it's our service
            for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%%p" ^| findstr "LISTENING"') do set PID=%%a
            for /f "tokens=*" %%n in ('tasklist /FI "PID eq !PID!" ^| findstr "node.exe"') do (
                echo   [INFO] Port %%p - Used by Node.js (PID: !PID!)
                echo   INFO: Port %%p used by Node.js >> "%DIAG_FILE%"
            )
        )
    ) else (
        if %%p==5432 (
            echo   [ERROR] Port %%p (PostgreSQL) - Not available!
            echo   ERROR: Port %%p (PostgreSQL) not available >> "%DIAG_FILE%"
            set /a ISSUES_FOUND+=1
        ) else if %%p==6379 (
            echo   [INFO] Port %%p (Redis) - Available (optional)
            echo   INFO: Port %%p (Redis) available >> "%DIAG_FILE%"
        ) else (
            echo   [OK] Port %%p - Available
            echo   OK: Port %%p available >> "%DIAG_FILE%"
        )
    )
)

REM Check Firewall
echo.
echo [6/10] Checking Windows Firewall...
echo. >> "%DIAG_FILE%"
echo FIREWALL >> "%DIAG_FILE%"
echo -------- >> "%DIAG_FILE%"

netsh advfirewall show currentprofile | findstr "State" | findstr "ON" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [INFO] Windows Firewall is enabled
    echo   INFO: Firewall enabled >> "%DIAG_FILE%"
    
    REM Check if Node.js is allowed
    netsh advfirewall firewall show rule name=all | findstr /i "node.js" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo   [WARNING] Node.js may be blocked by firewall
        echo   WARNING: Node.js firewall rule not found >> "%DIAG_FILE%"
        echo   Solution: Allow Node.js through firewall when prompted
        set /a WARNINGS_FOUND+=1
    ) else (
        echo   [OK] Node.js firewall rule exists
        echo   OK: Node.js firewall rule exists >> "%DIAG_FILE%"
    )
) else (
    echo   [OK] Windows Firewall is disabled
    echo   OK: Firewall disabled >> "%DIAG_FILE%"
)

REM Check Dependencies
echo.
echo [7/10] Checking Node Dependencies...
echo. >> "%DIAG_FILE%"
echo NODE DEPENDENCIES >> "%DIAG_FILE%"
echo ----------------- >> "%DIAG_FILE%"

set SERVICES=api-gateway ai-prediction-service pm-agent-orchestrator sales-frontend zoho-integration
set MISSING_DEPS=0

for %%s in (%SERVICES%) do (
    if exist "%~dp0..\..\services\%%s\node_modules" (
        echo   [OK] %%s dependencies installed
        echo   OK: %%s dependencies installed >> "%DIAG_FILE%"
    ) else (
        echo   [ERROR] %%s dependencies not installed!
        echo   ERROR: %%s dependencies missing >> "%DIAG_FILE%"
        set /a MISSING_DEPS+=1
    )
)

if %MISSING_DEPS% GTR 0 (
    echo   Solution: Run install-dependencies.bat
    echo   Solution: Run install-dependencies.bat >> "%DIAG_FILE%"
    set /a ISSUES_FOUND+=%MISSING_DEPS%
)

REM Check Environment Variables
echo.
echo [8/10] Checking Environment Configuration...
echo. >> "%DIAG_FILE%"
echo ENVIRONMENT CONFIGURATION >> "%DIAG_FILE%"
echo ------------------------- >> "%DIAG_FILE%"

if exist "%~dp0..\..\\.env" (
    set REQUIRED_VARS=NODE_ENV DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD JWT_SECRET API_KEY
    set MISSING_VARS=0
    
    for %%v in (%REQUIRED_VARS%) do (
        findstr "^%%v=" "%~dp0..\..\\.env" >nul 2>&1
        if !ERRORLEVEL! NEQ 0 (
            echo   [ERROR] Missing environment variable: %%v
            echo   ERROR: Missing %%v >> "%DIAG_FILE%"
            set /a MISSING_VARS+=1
        )
    )
    
    if !MISSING_VARS! EQU 0 (
        echo   [OK] All required environment variables present
        echo   OK: All required variables present >> "%DIAG_FILE%"
    ) else (
        echo   Solution: Update .env file with missing variables
        echo   Solution: Update .env file >> "%DIAG_FILE%"
        set /a ISSUES_FOUND+=!MISSING_VARS!
    )
) else (
    echo   [ERROR] .env file not found!
    echo   ERROR: .env file not found >> "%DIAG_FILE%"
    set /a ISSUES_FOUND+=1
)

REM Check Disk Space
echo.
echo [9/10] Checking Disk Space...
echo. >> "%DIAG_FILE%"
echo DISK SPACE >> "%DIAG_FILE%"
echo ---------- >> "%DIAG_FILE%"

for /f "tokens=3" %%a in ('dir C:\ ^| findstr "bytes free"') do set FREE_BYTES=%%a
set FREE_BYTES=%FREE_BYTES:,=%

REM Convert to MB (rough estimation)
set /a FREE_MB=%FREE_BYTES:~0,-6%
if %FREE_MB% LSS 1000 (
    echo   [WARNING] Low disk space: %FREE_MB% MB free
    echo   WARNING: Low disk space %FREE_MB% MB >> "%DIAG_FILE%"
    set /a WARNINGS_FOUND+=1
) else (
    echo   [OK] Sufficient disk space: %FREE_MB% MB free
    echo   OK: %FREE_MB% MB free >> "%DIAG_FILE%"
)

REM Check Recent Errors
echo.
echo [10/10] Checking Recent Errors...
echo. >> "%DIAG_FILE%"
echo RECENT ERRORS >> "%DIAG_FILE%"
echo ------------- >> "%DIAG_FILE%"

set ERROR_COUNT=0
if exist "%~dp0..\..\logs" (
    for %%f in ("%~dp0..\..\logs\*error*.log") do (
        for /f %%c in ('find /c "ERROR" "%%f" 2^>nul') do (
            if %%c GTR 0 (
                echo   [WARNING] Found errors in %%~nxf
                echo   WARNING: Errors in %%~nxf >> "%DIAG_FILE%"
                set /a ERROR_COUNT+=%%c
            )
        )
    )
    
    if %ERROR_COUNT% GTR 0 (
        echo   Total errors found in logs: %ERROR_COUNT%
        echo   Total errors in logs: %ERROR_COUNT% >> "%DIAG_FILE%"
        set /a WARNINGS_FOUND+=1
    ) else (
        echo   [OK] No recent errors in log files
        echo   OK: No recent errors >> "%DIAG_FILE%"
    )
) else (
    echo   [INFO] Log directory not found
    echo   INFO: No log directory >> "%DIAG_FILE%"
)

REM Generate Summary
echo.
echo ========================================
echo Diagnostic Summary
echo ========================================
echo.
echo. >> "%DIAG_FILE%"
echo SUMMARY >> "%DIAG_FILE%"
echo ------- >> "%DIAG_FILE%"

if %ISSUES_FOUND% EQU 0 (
    if %WARNINGS_FOUND% EQU 0 (
        echo [SUCCESS] No issues found! System is ready.
        echo SUCCESS: System ready >> "%DIAG_FILE%"
    ) else (
        echo [WARNING] System is functional with %WARNINGS_FOUND% warning(s)
        echo WARNING: %WARNINGS_FOUND% warnings found >> "%DIAG_FILE%"
    )
) else (
    echo [CRITICAL] Found %ISSUES_FOUND% critical issue(s) that need attention!
    echo CRITICAL: %ISSUES_FOUND% issues found >> "%DIAG_FILE%"
)

echo.
echo Issues Found:   %ISSUES_FOUND%
echo Warnings Found: %WARNINGS_FOUND%
echo.
echo Issues: %ISSUES_FOUND% >> "%DIAG_FILE%"
echo Warnings: %WARNINGS_FOUND% >> "%DIAG_FILE%"

REM Provide solutions
if %ISSUES_FOUND% GTR 0 (
    echo ========================================
    echo Recommended Actions
    echo ========================================
    echo.
    echo. >> "%DIAG_FILE%"
    echo RECOMMENDED ACTIONS >> "%DIAG_FILE%"
    echo ------------------- >> "%DIAG_FILE%"
    
    echo 1. Fix critical issues listed above
    echo 2. Run setup scripts in this order:
    echo    - setup-environment.bat
    echo    - install-dependencies.bat
    echo    - setup-database.bat
    echo    - run-migrations.bat
    echo 3. Then run start-all.bat
    
    echo 1. Fix critical issues >> "%DIAG_FILE%"
    echo 2. Run setup scripts in order >> "%DIAG_FILE%"
    echo 3. Run start-all.bat >> "%DIAG_FILE%"
)

echo.
echo Diagnostic report saved to:
echo   %DIAG_FILE%
echo.
echo. >> "%DIAG_FILE%"
echo Report generated: %date% %time% >> "%DIAG_FILE%"

REM Open report in notepad if issues found
if %ISSUES_FOUND% GTR 0 (
    choice /C YN /T 10 /D N /M "Open diagnostic report?"
    if !ERRORLEVEL! EQU 1 (
        start notepad "%DIAG_FILE%"
    )
)

pause