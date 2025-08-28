@echo off
REM Setup Google Secret Manager for Mangalm Sales Assistant
REM This script creates and manages secrets in Google Secret Manager

setlocal enabledelayedexpansion

echo ========================================
echo Google Secret Manager Setup
echo ========================================

REM Check if gcloud is installed
where gcloud >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: gcloud CLI is not installed
    echo Please install the Google Cloud SDK: https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)

REM Get project ID
for /f "tokens=*" %%i in ('gcloud config get-value project 2^>nul') do set PROJECT_ID=%%i
if "!PROJECT_ID!"=="" (
    echo No project set. Please enter your GCP Project ID:
    set /p PROJECT_ID=
    gcloud config set project "!PROJECT_ID!"
)

echo Using Project: !PROJECT_ID!
echo.

REM Enable Secret Manager API
echo Enabling Secret Manager API...
gcloud services enable secretmanager.googleapis.com --project="!PROJECT_ID!"

echo.
echo Creating Application Secrets
echo ========================================
echo.

REM 1. JWT Secret
echo 1. Creating JWT Secret for authentication...
REM Generate random 32-byte hex string (simplified for Windows)
set JWT_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%

REM Check if secret exists, if not create it
gcloud secrets describe jwt-secret --project="!PROJECT_ID!" >nul 2>nul
if %errorlevel% neq 0 (
    echo Creating new secret: jwt-secret
    echo !JWT_SECRET! | gcloud secrets create jwt-secret --data-file=- --replication-policy=automatic --project="!PROJECT_ID!"
) else (
    echo Secret exists. Creating new version...
    echo !JWT_SECRET! | gcloud secrets versions add jwt-secret --data-file=- --project="!PROJECT_ID!"
)
echo ✓ Secret jwt-secret created/updated

REM 2. Database Password
echo.
echo 2. Database Password
set /p DB_PASSWORD=Enter password for Cloud SQL database (or press Enter to generate): 
if "!DB_PASSWORD!"=="" (
    set DB_PASSWORD=postgres!RANDOM!!RANDOM!
    echo Generated password: !DB_PASSWORD!
    echo IMPORTANT: Save this password! You'll need it to access the database.
)

gcloud secrets describe db-password --project="!PROJECT_ID!" >nul 2>nul
if %errorlevel% neq 0 (
    echo Creating new secret: db-password
    echo !DB_PASSWORD! | gcloud secrets create db-password --data-file=- --replication-policy=automatic --project="!PROJECT_ID!"
) else (
    echo Secret exists. Creating new version...
    echo !DB_PASSWORD! | gcloud secrets versions add db-password --data-file=- --project="!PROJECT_ID!"
)
echo ✓ Secret db-password created/updated

REM 3. OpenAI API Key (optional)
echo.
echo 3. OpenAI API Key (for document processing)
set /p OPENAI_KEY=Enter your OpenAI API Key (or press Enter to skip): 
if not "!OPENAI_KEY!"=="" (
    gcloud secrets describe openai-api-key --project="!PROJECT_ID!" >nul 2>nul
    if %errorlevel% neq 0 (
        echo Creating new secret: openai-api-key
        echo !OPENAI_KEY! | gcloud secrets create openai-api-key --data-file=- --replication-policy=automatic --project="!PROJECT_ID!"
    ) else (
        echo Secret exists. Creating new version...
        echo !OPENAI_KEY! | gcloud secrets versions add openai-api-key --data-file=- --project="!PROJECT_ID!"
    )
    echo ✓ Secret openai-api-key created/updated
)

REM Grant Cloud Run service account access to secrets
echo.
echo Granting Cloud Run access to secrets...
set SERVICE_ACCOUNT=!PROJECT_ID!-compute@developer.gserviceaccount.com

REM Grant access to each secret
for %%s in (jwt-secret db-password openai-api-key) do (
    gcloud secrets describe %%s --project="!PROJECT_ID!" >nul 2>nul
    if !errorlevel! equ 0 (
        echo Granting access to %%s...
        gcloud secrets add-iam-policy-binding %%s --member="serviceAccount:!SERVICE_ACCOUNT!" --role="roles/secretmanager.secretAccessor" --project="!PROJECT_ID!" >nul 2>nul
    )
)

echo ✓ Service account granted access to secrets

echo.
echo ========================================
echo Secret Manager Setup Complete!
echo ========================================
echo.
echo To use these secrets in Cloud Run, use these environment variable values:
echo JWT_SECRET=projects/!PROJECT_ID!/secrets/jwt-secret:latest
echo DB_PASSWORD=projects/!PROJECT_ID!/secrets/db-password:latest
if not "!OPENAI_KEY!"=="" (
    echo OPENAI_API_KEY=projects/!PROJECT_ID!/secrets/openai-api-key:latest
)
echo.
echo View secrets in the console:
echo https://console.cloud.google.com/security/secret-manager?project=!PROJECT_ID!
echo.
echo List all secrets:
echo gcloud secrets list --project=!PROJECT_ID!
echo.
echo Read a secret value:
echo gcloud secrets versions access latest --secret=SECRET_NAME --project=!PROJECT_ID!
echo.
pause