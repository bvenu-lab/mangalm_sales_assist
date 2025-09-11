@echo off
echo ===============================================
echo MANGALM APPLICATION STARTUP
echo ===============================================

echo.
echo [1/5] Stopping any existing Node processes...
taskkill /IM node.exe /F 2>nul
timeout /t 2 /nobreak >nul

echo [2/5] Starting API Gateway (Port 3007)...
cd services\api-gateway
start /B cmd /c "npm start 2>&1"
cd ..\..
timeout /t 3 /nobreak >nul

echo [3/5] Starting Bulk Upload API (Port 3009)...
cd services\bulk-upload-api
start /B cmd /c "node server-enterprise.js 2>&1"
cd ..\..
timeout /t 2 /nobreak >nul

echo [4/5] Starting Queue Processor...
cd services\queue-processor
start /B cmd /c "node processor.js 2>&1"
cd ..\..
timeout /t 2 /nobreak >nul

echo [5/5] Starting Frontend (Port 3002)...
cd services\sales-frontend
start cmd /c "set PORT=3002 && npm start"
cd ..\..

echo.
echo ===============================================
echo APPLICATION STARTED SUCCESSFULLY!
echo ===============================================
echo.
echo Services Available:
echo -------------------
echo Frontend:        http://localhost:3002
echo API Gateway:     http://localhost:3007
echo Bulk Upload API: http://localhost:3009
echo.
echo Login Credentials:
echo -----------------
echo Username: admin
echo Password: admin123
echo.
echo OR
echo.
echo Username: test2@soloforge.com
echo Password: test123
echo.
echo ===============================================
echo Press Ctrl+C to stop all services
echo ===============================================
pause