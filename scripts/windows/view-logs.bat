@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Mangalm Log Viewer
echo ========================================
echo.

REM Set logs directory
set LOG_DIR=%~dp0..\..\logs

if not exist "%LOG_DIR%" (
    echo [ERROR] Logs directory not found!
    echo Expected location: %LOG_DIR%
    pause
    exit /b 1
)

:Menu
echo Select log viewing option:
echo.
echo 1. View latest combined logs (all services)
echo 2. View error logs only
echo 3. Tail logs in real-time
echo 4. Search logs for specific text
echo 5. View logs for specific service
echo 6. Generate log summary report
echo 7. Open logs directory
echo 8. Exit
echo.
set /p CHOICE="Enter choice (1-8): "

if "%CHOICE%"=="1" goto :ViewCombined
if "%CHOICE%"=="2" goto :ViewErrors
if "%CHOICE%"=="3" goto :TailLogs
if "%CHOICE%"=="4" goto :SearchLogs
if "%CHOICE%"=="5" goto :ServiceLogs
if "%CHOICE%"=="6" goto :LogSummary
if "%CHOICE%"=="7" goto :OpenDirectory
if "%CHOICE%"=="8" exit /b 0

echo Invalid choice!
goto :Menu

:ViewCombined
echo.
echo Latest combined logs:
echo ========================================
for %%f in ("%LOG_DIR%\*combined.log") do (
    echo.
    echo File: %%~nxf
    echo ----------------------------------------
    type "%%f" 2>nul | more
)
echo.
pause
goto :Menu

:ViewErrors
echo.
echo Recent errors across all services:
echo ========================================
for %%f in ("%LOG_DIR%\*error.log") do (
    if exist "%%f" (
        echo.
        echo Service: %%~nf
        echo ----------------------------------------
        type "%%f" 2>nul | findstr /i "error exception fail critical" | more
    )
)
echo.
pause
goto :Menu

:TailLogs
echo.
echo Select service to tail:
echo.
set COUNT=0
for %%f in ("%LOG_DIR%\*.log") do (
    set /a COUNT+=1
    echo !COUNT!. %%~nxf
    set FILE_!COUNT!=%%f
)
echo.
set /p FILE_CHOICE="Enter file number: "

if defined FILE_%FILE_CHOICE% (
    echo.
    echo Tailing !FILE_%FILE_CHOICE%! (Press Ctrl+C to stop)...
    echo ========================================
    powershell -command "Get-Content '!FILE_%FILE_CHOICE%!' -Wait -Tail 50"
) else (
    echo Invalid selection!
)
goto :Menu

:SearchLogs
echo.
set /p SEARCH_TERM="Enter search term: "
echo.
echo Searching for "%SEARCH_TERM%" in all logs...
echo ========================================

set FOUND=0
for %%f in ("%LOG_DIR%\*.log") do (
    findstr /i /c:"%SEARCH_TERM%" "%%f" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo.
        echo Found in: %%~nxf
        echo ----------------------------------------
        findstr /i /n /c:"%SEARCH_TERM%" "%%f" | more
        set /a FOUND+=1
    )
)

if %FOUND% EQU 0 (
    echo No matches found for "%SEARCH_TERM%"
)
echo.
pause
goto :Menu

:ServiceLogs
echo.
echo Select service:
echo.
echo 1. API Gateway
echo 2. AI Prediction Service
echo 3. PM Orchestrator
echo 4. Zoho Integration
echo 5. Frontend
echo.
set /p SERVICE_CHOICE="Enter choice (1-5): "

if "%SERVICE_CHOICE%"=="1" set SERVICE_NAME=api-gateway
if "%SERVICE_CHOICE%"=="2" set SERVICE_NAME=ai-service
if "%SERVICE_CHOICE%"=="3" set SERVICE_NAME=pm-orchestrator
if "%SERVICE_CHOICE%"=="4" set SERVICE_NAME=zoho-integration
if "%SERVICE_CHOICE%"=="5" set SERVICE_NAME=frontend

if defined SERVICE_NAME (
    echo.
    echo Logs for %SERVICE_NAME%:
    echo ========================================
    if exist "%LOG_DIR%\%SERVICE_NAME%-combined.log" (
        type "%LOG_DIR%\%SERVICE_NAME%-combined.log" | more
    ) else (
        echo No logs found for %SERVICE_NAME%
    )
) else (
    echo Invalid selection!
)
echo.
pause
goto :Menu

:LogSummary
echo.
echo Generating log summary report...
echo ========================================
echo.

set REPORT_FILE=%LOG_DIR%\log-summary-%date:~-4%%date:~4,2%%date:~7,2%-%time:~0,2%%time:~3,2%.txt
set REPORT_FILE=%REPORT_FILE: =0%

echo Log Summary Report > "%REPORT_FILE%"
echo Generated: %date% %time% >> "%REPORT_FILE%"
echo ======================================== >> "%REPORT_FILE%"
echo. >> "%REPORT_FILE%"

echo Log Files: >> "%REPORT_FILE%"
echo ---------- >> "%REPORT_FILE%"
for %%f in ("%LOG_DIR%\*.log") do (
    for %%i in ("%%f") do (
        set FILE_SIZE=%%~zi
        set /a FILE_SIZE_KB=!FILE_SIZE!/1024
        echo %%~nxf - !FILE_SIZE_KB! KB >> "%REPORT_FILE%"
    )
)
echo. >> "%REPORT_FILE%"

echo Error Summary: >> "%REPORT_FILE%"
echo -------------- >> "%REPORT_FILE%"
for %%f in ("%LOG_DIR%\*.log") do (
    for /f %%c in ('findstr /i /c:"ERROR" "%%f" 2^>nul ^| find /c /v ""') do (
        if %%c GTR 0 (
            echo %%~nxf: %%c errors >> "%REPORT_FILE%"
        )
    )
)
echo. >> "%REPORT_FILE%"

echo Warning Summary: >> "%REPORT_FILE%"
echo ---------------- >> "%REPORT_FILE%"
for %%f in ("%LOG_DIR%\*.log") do (
    for /f %%c in ('findstr /i /c:"WARN" "%%f" 2^>nul ^| find /c /v ""') do (
        if %%c GTR 0 (
            echo %%~nxf: %%c warnings >> "%REPORT_FILE%"
        )
    )
)
echo. >> "%REPORT_FILE%"

echo Recent Errors (last 10): >> "%REPORT_FILE%"
echo ------------------------ >> "%REPORT_FILE%"
for %%f in ("%LOG_DIR%\*error.log") do (
    if exist "%%f" (
        echo. >> "%REPORT_FILE%"
        echo From %%~nxf: >> "%REPORT_FILE%"
        powershell -command "Get-Content '%%f' -Tail 10" >> "%REPORT_FILE%" 2>nul
    )
)

echo.
echo Report saved to: %REPORT_FILE%
echo.
notepad "%REPORT_FILE%"
pause
goto :Menu

:OpenDirectory
echo.
echo Opening logs directory...
start "" "%LOG_DIR%"
goto :Menu