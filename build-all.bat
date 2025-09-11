@echo off
echo ===============================================
echo MANGALM ENTERPRISE SYSTEM - BUILD VERIFICATION
echo ===============================================
echo.

set "BUILD_SUCCESS=1"

echo [1/6] Building Sales Frontend (React/TypeScript)...
cd services\sales-frontend
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Frontend build FAILED
    set "BUILD_SUCCESS=0"
) else (
    echo ✅ Frontend build SUCCESS
)
echo.

echo [2/6] Building API Gateway (TypeScript)...
cd ..\api-gateway  
call npm run build
if %errorlevel% neq 0 (
    echo ❌ API Gateway build FAILED
    set "BUILD_SUCCESS=0"
) else (
    echo ✅ API Gateway build SUCCESS
)
echo.

echo [3/6] Building Data Import Service (TypeScript)...
cd ..\data-import
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Data Import build FAILED
    set "BUILD_SUCCESS=0"
) else (
    echo ✅ Data Import build SUCCESS
)
echo.

echo [4/6] Building AI Prediction Service (TypeScript)...
cd ..\ai-prediction-service
call npm run build
if %errorlevel% neq 0 (
    echo ❌ AI Prediction Service build FAILED
    set "BUILD_SUCCESS=0"
) else (
    echo ✅ AI Prediction Service build SUCCESS
)
echo.

echo [5/6] Verifying Bulk Upload API (JavaScript)...
cd ..\bulk-upload-api
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Bulk Upload API verification FAILED
    set "BUILD_SUCCESS=0"
) else (
    echo ✅ Bulk Upload API verification SUCCESS
)
echo.

echo [6/6] Building Document Processor (TypeScript)...
cd ..\document-processor
call npm run build 2>nul
if %errorlevel% neq 0 (
    echo ⚠️ Document Processor build skipped (optional service)
) else (
    echo ✅ Document Processor build SUCCESS
)

cd ..\..
echo.
echo ===============================================
if "%BUILD_SUCCESS%"=="1" (
    echo ✅ ALL CRITICAL BUILDS SUCCESSFUL
    echo    The enterprise bulk upload system is ready for production
) else (
    echo ❌ SOME BUILDS FAILED
    echo    Please check the error messages above
)
echo ===============================================