@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Stopping Mangalm Sales Assistant
echo ========================================
echo.

REM Kill Node.js processes on specific ports
echo Stopping services...

set PORTS=3000 3001 3002 3003 3004 3005 3006 3007
set FOUND=0

for %%p in (%PORTS%) do (
    echo Checking port %%p...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%%p"') do (
        set PID=%%a
        if !PID! NEQ 0 (
            taskkill /F /PID !PID! >nul 2>&1
            if !ERRORLEVEL! EQU 0 (
                echo [OK] Stopped service on port %%p (PID: !PID!)
                set /a FOUND+=1
            )
        )
    )
)

if %FOUND% EQU 0 (
    echo No services were running.
) else (
    echo.
    echo [OK] Stopped %FOUND% service(s)
)

REM Optionally stop Redis
redis-cli ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    choice /C YN /T 5 /D N /M "Stop Redis?"
    if !ERRORLEVEL! EQU 1 (
        redis-cli shutdown >nul 2>&1
        echo [OK] Redis stopped
    )
)

REM Note: Removed global Node.js kill to prevent closing other applications

echo.
echo ========================================
echo All services stopped
echo ========================================
echo.
pause