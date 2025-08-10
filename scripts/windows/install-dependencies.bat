@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Mangalm Dependencies Installation
echo ========================================
echo.

REM Check Node.js
echo Checking Node.js installation...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=2 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js version: v%NODE_VERSION%

REM Check npm
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed!
    pause
    exit /b 1
)

for /f %%i in ('npm --version') do set NPM_VERSION=%%i
echo [OK] npm version: %NPM_VERSION%
echo.

REM Change to project root
cd /d "%~dp0\..\.."
echo Working directory: %CD%
echo.

REM Clean install (optional)
choice /C YN /M "Do you want to clean install (remove existing node_modules)?"
if %ERRORLEVEL% EQU 1 (
    echo Cleaning existing installations...
    if exist node_modules rd /s /q node_modules
    if exist package-lock.json del package-lock.json
    
    for %%d in (services\ai-prediction-service services\api-gateway services\pm-agent-orchestrator services\sales-frontend services\zoho-integration database) do (
        if exist %%d\node_modules (
            echo Cleaning %%d\node_modules...
            rd /s /q %%d\node_modules
        )
        if exist %%d\package-lock.json del %%d\package-lock.json
    )
    echo [OK] Clean completed
    echo.
)

REM Install root dependencies
echo Installing root dependencies...
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install root dependencies
    pause
    exit /b 1
)
echo [OK] Root dependencies installed
echo.

REM Install service dependencies
echo Installing service dependencies...
echo.

echo [1/6] Installing database dependencies...
cd database
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Database dependencies installation had issues
)
cd ..
echo.

echo [2/6] Installing API Gateway dependencies...
cd services\api-gateway
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] API Gateway dependencies installation had issues
)
cd ..\..
echo.

echo [3/6] Installing AI Prediction Service dependencies...
cd services\ai-prediction-service
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] AI Service dependencies installation had issues
)
cd ..\..
echo.

echo [4/6] Installing PM Agent Orchestrator dependencies...
cd services\pm-agent-orchestrator
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] PM Orchestrator dependencies installation had issues
)
cd ..\..
echo.

echo [5/6] Installing Sales Frontend dependencies...
cd services\sales-frontend
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Frontend dependencies installation had issues
)
cd ..\..
echo.

echo [6/6] Installing Zoho Integration dependencies...
cd services\zoho-integration
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Zoho Integration dependencies installation had issues
)
cd ..\..
echo.

REM Install global tools
echo Installing global tools...
choice /C YN /M "Install PM2 for process management?"
if %ERRORLEVEL% EQU 1 (
    echo Installing PM2...
    call npm install -g pm2
    call npm install -g pm2-windows-startup
    echo [OK] PM2 installed
)
echo.

REM Audit check
echo Running security audit...
call npm audit --audit-level=high
echo.

echo ========================================
echo Dependencies installation completed!
echo ========================================
echo.
echo Next steps:
echo 1. Run setup-database.bat to configure PostgreSQL
echo 2. Run setup-environment.bat to create .env files
echo 3. Run migrate-database.bat to initialize database schema
echo 4. Run start-all.bat to start the application
echo.
pause