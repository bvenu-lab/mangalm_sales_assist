@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Mangalm Metrics Health Check
echo ========================================
echo.

set SERVICES=api-gateway:3007 ai-prediction-service:3001 pm-orchestrator:3002 zoho-integration:3003

echo Checking metrics endpoints...
echo.

set TOTAL=0
set AVAILABLE=0

for %%s in (%SERVICES%) do (
    for /f "tokens=1,2 delims=:" %%a in ("%%s") do (
        set SERVICE=%%a
        set PORT=%%b
        set /a TOTAL+=1
        
        echo Checking !SERVICE! on port !PORT!...
        
        REM Try to fetch metrics
        curl -s -o nul -w "%%{http_code}" http://localhost:!PORT!/metrics > temp_status.txt 2>nul
        set /p HTTP_STATUS=<temp_status.txt
        del temp_status.txt >nul 2>&1
        
        if "!HTTP_STATUS!"=="200" (
            echo   [OK] Metrics available
            set /a AVAILABLE+=1
            
            REM Fetch sample metrics
            curl -s http://localhost:!PORT!/metrics 2>nul | findstr "mangalm_" | find /c /v "" > temp_count.txt
            set /p METRIC_COUNT=<temp_count.txt
            del temp_count.txt >nul 2>&1
            echo   Found !METRIC_COUNT! custom metrics
            
        ) else if "!HTTP_STATUS!"=="000" (
            echo   [ERROR] Service not responding
        ) else (
            echo   [ERROR] Metrics endpoint returned: !HTTP_STATUS!
        )
        echo.
    )
)

echo ========================================
echo Summary
echo ========================================
echo.
echo Metrics Available: %AVAILABLE%/%TOTAL% services
echo.

if %AVAILABLE% EQU %TOTAL% (
    echo [SUCCESS] All services are exposing metrics
) else (
    echo [WARNING] Some services are not exposing metrics
    echo.
    echo Troubleshooting:
    echo 1. Ensure all services are running (run health-check.bat)
    echo 2. Check if metrics endpoints are implemented
    echo 3. Review service logs for errors
)

echo.
echo ========================================
echo Key Metrics to Monitor
echo ========================================
echo.
echo HTTP Metrics:
echo   - mangalm_http_requests_total
echo   - mangalm_http_request_duration_seconds
echo   - mangalm_http_request_size_bytes
echo   - mangalm_http_response_size_bytes
echo.
echo Business Metrics:
echo   - mangalm_predictions_total
echo   - mangalm_prediction_duration_seconds
echo   - mangalm_orders_processed_total
echo   - mangalm_revenue_total
echo.
echo System Metrics:
echo   - mangalm_active_connections
echo   - mangalm_database_pool_size
echo   - mangalm_cache_hits_total
echo   - mangalm_errors_total
echo.

REM Check if Prometheus is running
echo Checking Prometheus...
curl -s -o nul -w "%%{http_code}" http://localhost:9090/-/healthy > temp_status.txt 2>nul
set /p PROM_STATUS=<temp_status.txt
del temp_status.txt >nul 2>&1

if "%PROM_STATUS%"=="200" (
    echo [OK] Prometheus is running
    echo.
    echo View metrics at: http://localhost:9090
    
    choice /C YN /T 10 /D N /M "Open Prometheus in browser?"
    if !ERRORLEVEL! EQU 1 (
        start http://localhost:9090
    )
) else (
    echo [INFO] Prometheus is not running
    echo Run start-monitoring.bat to start the monitoring stack
)

echo.
pause