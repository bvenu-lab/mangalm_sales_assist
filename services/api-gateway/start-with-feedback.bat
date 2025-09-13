@echo off
echo Starting API Gateway with Feedback Support...

REM Set Resend environment variables
set RESEND_API_KEY=re_iDuD6crZ_EQrpvghaSj2aqNxCxY46hE5h
set FROM_EMAIL=SoloForge.AI ^<eran@soloforgeai.com^>
set ADMIN_EMAIL=eran@soloforgeai.com

REM Set database connection
set DATABASE_URL=postgresql://mangalm:mangalm123@localhost:3432/mangalm_sales

REM Set port
set PORT=3007

echo.
echo Environment variables set:
echo   RESEND_API_KEY: %RESEND_API_KEY:~0,10%...
echo   FROM_EMAIL: %FROM_EMAIL%
echo   ADMIN_EMAIL: %ADMIN_EMAIL%
echo   PORT: %PORT%
echo.

REM Start the API Gateway
echo Starting API Gateway on port %PORT%...
npm start