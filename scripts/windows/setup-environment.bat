@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Environment Configuration Setup
echo ========================================
echo.

REM Change to project root
cd /d "%~dp0\..\.."
set PROJECT_ROOT=%CD%
echo Project root: %PROJECT_ROOT%
echo.

REM Function to create .env file
echo Creating environment configuration files...
echo.

REM Create root .env file
echo Creating root .env file...
(
echo # Mangalm Sales Assistant Environment Configuration
echo # Generated on %DATE% %TIME%
echo.
echo # Database Configuration
echo DATABASE_URL=postgresql://mangalm:mangalm_secure_2024@localhost:5432/mangalm_sales
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_USER=mangalm
echo DB_PASSWORD=mangalm_secure_2024
echo DB_NAME=mangalm_sales
echo.
echo # Redis Configuration ^(optional^)
echo REDIS_URL=redis://localhost:6379
echo REDIS_HOST=localhost
echo REDIS_PORT=6379
echo ENABLE_REDIS_CACHE=false
echo.
echo # Application Configuration
echo NODE_ENV=production
echo PORT=3000
echo.
echo # Service Ports
echo API_GATEWAY_PORT=3007
echo AI_SERVICE_PORT=3001
echo PM_ORCHESTRATOR_PORT=3002
echo ZOHO_SERVICE_PORT=3003
echo.
echo # Security
echo JWT_SECRET=mangalm_jwt_secret_key_2024_production_%RANDOM%
echo SESSION_SECRET=mangalm_session_secret_2024_production_%RANDOM%
echo BCRYPT_ROUNDS=10
echo.
echo # CORS Settings
echo CORS_ORIGIN=http://localhost:3000
echo.
echo # Logging
echo LOG_LEVEL=info
echo LOG_DIR=%PROJECT_ROOT%\logs
echo.
echo # Feature Flags
echo ENABLE_RATE_LIMITING=true
echo ENABLE_WEBSOCKETS=true
echo ENABLE_SWAGGER_DOCS=true
echo.
echo # API Settings
echo API_TIMEOUT=30000
echo MAX_REQUEST_SIZE=10mb
echo RATE_LIMIT_WINDOW=900000
echo RATE_LIMIT_MAX_REQUESTS=100
) > "%PROJECT_ROOT%\.env"
echo [OK] Root .env created
echo.

REM Create API Gateway .env
echo Creating API Gateway .env...
(
echo PORT=3007
echo NODE_ENV=production
echo JWT_SECRET=mangalm_jwt_secret_key_2024_production_%RANDOM%
echo DATABASE_URL=postgresql://mangalm:mangalm_secure_2024@localhost:5432/mangalm_sales
echo REDIS_URL=redis://localhost:6379
echo ENABLE_REDIS_CACHE=false
echo LOG_LEVEL=info
echo CORS_ORIGIN=http://localhost:3000
) > "%PROJECT_ROOT%\services\api-gateway\.env"
echo [OK] API Gateway .env created
echo.

REM Create AI Prediction Service .env
echo Creating AI Prediction Service .env...
(
echo PORT=3001
echo NODE_ENV=production
echo DATABASE_URL=postgresql://mangalm:mangalm_secure_2024@localhost:5432/mangalm_sales
echo REDIS_URL=redis://localhost:6379
echo ENABLE_REDIS_CACHE=false
echo MODEL_PATH=./models
echo LOG_LEVEL=info
echo MAX_PREDICTION_BATCH_SIZE=100
echo PREDICTION_TIMEOUT=30000
) > "%PROJECT_ROOT%\services\ai-prediction-service\.env"
echo [OK] AI Prediction Service .env created
echo.

REM Create PM Agent Orchestrator .env
echo Creating PM Agent Orchestrator .env...
(
echo PORT=3002
echo NODE_ENV=production
echo DATABASE_URL=postgresql://mangalm:mangalm_secure_2024@localhost:5432/mangalm_sales
echo REDIS_URL=redis://localhost:6379
echo ENABLE_REDIS_CACHE=false
echo LOG_LEVEL=info
echo ORCHESTRATION_INTERVAL=60000
) > "%PROJECT_ROOT%\services\pm-agent-orchestrator\.env"
echo [OK] PM Agent Orchestrator .env created
echo.

REM Create Sales Frontend .env
echo Creating Sales Frontend .env...
(
echo REACT_APP_API_URL=http://localhost:3007
echo REACT_APP_WEBSOCKET_URL=ws://localhost:3007
echo REACT_APP_ENVIRONMENT=production
echo REACT_APP_VERSION=1.0.0
echo REACT_APP_ENABLE_ANALYTICS=false
echo REACT_APP_ENABLE_SERVICE_WORKER=true
) > "%PROJECT_ROOT%\services\sales-frontend\.env"
echo [OK] Sales Frontend .env created
echo.

REM Create Zoho Integration .env
echo Creating Zoho Integration .env...
(
echo PORT=3003
echo NODE_ENV=production
echo DATABASE_URL=postgresql://mangalm:mangalm_secure_2024@localhost:5432/mangalm_sales
echo REDIS_URL=redis://localhost:6379
echo ENABLE_REDIS_CACHE=false
echo LOG_LEVEL=info
echo # Zoho API Configuration ^(add your credentials here^)
echo ZOHO_CLIENT_ID=
echo ZOHO_CLIENT_SECRET=
echo ZOHO_REFRESH_TOKEN=
echo ZOHO_API_DOMAIN=https://www.zohoapis.com
echo ZOHO_SYNC_INTERVAL=3600000
) > "%PROJECT_ROOT%\services\zoho-integration\.env"
echo [OK] Zoho Integration .env created
echo.

REM Create .env.example files
echo Creating .env.example files for reference...
copy "%PROJECT_ROOT%\.env" "%PROJECT_ROOT%\.env.example" >nul
echo [OK] Created .env.example files
echo.

REM Create logs directory
if not exist "%PROJECT_ROOT%\logs" (
    mkdir "%PROJECT_ROOT%\logs"
    echo [OK] Created logs directory
)

REM Create models directory for AI service
if not exist "%PROJECT_ROOT%\services\ai-prediction-service\models" (
    mkdir "%PROJECT_ROOT%\services\ai-prediction-service\models"
    echo [OK] Created models directory
)

echo ========================================
echo Environment setup completed!
echo ========================================
echo.
echo Environment files created:
echo   - \.env
echo   - \services\api-gateway\.env
echo   - \services\ai-prediction-service\.env
echo   - \services\pm-agent-orchestrator\.env
echo   - \services\sales-frontend\.env
echo   - \services\zoho-integration\.env
echo.
echo [IMPORTANT] Security Notes:
echo 1. JWT secrets have been generated with random values
echo 2. Change database password in production
echo 3. Never commit .env files to version control
echo 4. Add Zoho API credentials if using Zoho integration
echo.
pause