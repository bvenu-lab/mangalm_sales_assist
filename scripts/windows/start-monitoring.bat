@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Starting Mangalm Monitoring Stack
echo ========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Docker not installed. Using local monitoring alternatives.
    echo.
    goto :LocalMonitoring
)

REM Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo Starting monitoring containers...
echo.

REM Navigate to monitoring directory
cd /d "%~dp0..\..\monitoring"

REM Start monitoring stack
echo [1/6] Starting Prometheus...
docker-compose -f docker-compose.monitoring.yml up -d prometheus
timeout /t 2 >nul

echo [2/6] Starting Grafana...
docker-compose -f docker-compose.monitoring.yml up -d grafana
timeout /t 2 >nul

echo [3/6] Starting Loki...
docker-compose -f docker-compose.monitoring.yml up -d loki
timeout /t 2 >nul

echo [4/6] Starting Jaeger...
docker-compose -f docker-compose.monitoring.yml up -d jaeger
timeout /t 2 >nul

echo [5/6] Starting AlertManager...
docker-compose -f docker-compose.monitoring.yml up -d alertmanager
timeout /t 2 >nul

echo [6/6] Starting exporters...
docker-compose -f docker-compose.monitoring.yml up -d node-exporter postgres-exporter promtail
timeout /t 5 >nul

echo.
echo ========================================
echo Monitoring Stack Started!
echo ========================================
echo.
echo Access monitoring services at:
echo   Grafana:       http://localhost:3009 (admin/admin123)
echo   Prometheus:    http://localhost:9090
echo   Jaeger:        http://localhost:16686
echo   AlertManager:  http://localhost:9093
echo.
echo Waiting for services to be ready...
timeout /t 10 >nul

REM Open Grafana in browser
start http://localhost:3009

goto :End

:LocalMonitoring
echo ========================================
echo Local Monitoring Mode (No Docker)
echo ========================================
echo.

REM Create monitoring directories
if not exist "%~dp0..\..\monitoring\local" mkdir "%~dp0..\..\monitoring\local"
if not exist "%~dp0..\..\monitoring\local\logs" mkdir "%~dp0..\..\monitoring\local\logs"
if not exist "%~dp0..\..\monitoring\local\metrics" mkdir "%~dp0..\..\monitoring\local\metrics"

REM Start local monitoring services
echo [1/3] Starting metrics collection...
start "Metrics Collector" /D "%~dp0" cmd /k "node ..\..\monitoring\local\metrics-collector.js"
timeout /t 2 >nul

echo [2/3] Starting log aggregator...
start "Log Aggregator" /D "%~dp0" cmd /k "node ..\..\monitoring\local\log-aggregator.js"
timeout /t 2 >nul

echo [3/3] Starting monitoring dashboard...
start "Monitoring Dashboard" /D "%~dp0" cmd /k "node ..\..\monitoring\local\dashboard-server.js"
timeout /t 5 >nul

echo.
echo ========================================
echo Local Monitoring Started!
echo ========================================
echo.
echo Access monitoring at:
echo   Dashboard: http://localhost:9999
echo   Metrics:   http://localhost:9998/metrics
echo   Logs:      %~dp0..\..\monitoring\local\logs
echo.

REM Open local dashboard in browser
start http://localhost:9999

:End
echo.
pause