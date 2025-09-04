@echo off
REM ============================================
REM Enterprise System Shutdown Script
REM ============================================

echo.
echo =========================================
echo   STOPPING ENTERPRISE BULK UPLOAD SYSTEM
echo =========================================
echo.

REM Stop Node.js server
echo [1/3] Stopping Node.js Enterprise Server...
taskkill /FI "WindowTitle eq Enterprise Server*" /T /F >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo [OK] Node.js server stopped

REM Stop Docker containers
echo [2/3] Stopping Docker containers...
docker-compose -f docker-compose.enterprise.yml down
echo [OK] Docker containers stopped

REM Clean up ports (optional)
echo [3/3] Cleaning up ports...
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        taskkill /PID %%a /F >nul 2>&1
    )
)
netstat -ano | findstr :3002 >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002') do (
        taskkill /PID %%a /F >nul 2>&1
    )
)
echo [OK] Ports cleaned

echo.
echo =========================================
echo   SYSTEM SHUTDOWN COMPLETE
echo =========================================
echo.
pause