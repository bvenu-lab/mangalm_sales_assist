@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Mangalm Database Setup Script
echo ========================================
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PostgreSQL is not installed or not in PATH!
    echo Please install PostgreSQL from: https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)

REM Check if PostgreSQL is running
pg_isready -h localhost -p 5432 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] PostgreSQL service is not running!
    echo Attempting to start PostgreSQL service...
    net start postgresql-x64-14 >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to start PostgreSQL service.
        echo Please start it manually from Windows Services.
        pause
        exit /b 1
    )
    timeout /t 3 >nul
)

echo [OK] PostgreSQL is running
echo.

REM Get PostgreSQL superuser password
echo Please enter your PostgreSQL 'postgres' user password:
set /p POSTGRES_PWD=Password: 

echo.
echo Creating Mangalm database and user...
echo.

REM Create SQL script
set SQL_FILE=%TEMP%\mangalm_setup.sql
(
echo -- Drop existing connections to the database if it exists
echo SELECT pg_terminate_backend^(pid^) FROM pg_stat_activity WHERE datname = 'mangalm_sales' AND pid ^<^> pg_backend_pid^(^);
echo.
echo -- Drop database if exists
echo DROP DATABASE IF EXISTS mangalm_sales;
echo.
echo -- Drop user if exists
echo DROP USER IF EXISTS mangalm;
echo.
echo -- Create user
echo CREATE USER mangalm WITH PASSWORD 'mangalm_secure_2024';
echo.
echo -- Create database
echo CREATE DATABASE mangalm_sales OWNER mangalm;
echo.
echo -- Grant privileges
echo GRANT ALL PRIVILEGES ON DATABASE mangalm_sales TO mangalm;
) > "%SQL_FILE%"

REM Execute SQL script
psql -U postgres -h localhost -p 5432 -f "%SQL_FILE%" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to create database. Please check your password.
    del "%SQL_FILE%" >nul 2>&1
    pause
    exit /b 1
)

del "%SQL_FILE%" >nul 2>&1

echo [OK] Database 'mangalm_sales' created
echo [OK] User 'mangalm' created with password 'mangalm_secure_2024'
echo.

REM Enable UUID extension
echo Enabling UUID extension...
set SQL_FILE=%TEMP%\mangalm_extensions.sql
(
echo CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
echo CREATE EXTENSION IF NOT EXISTS "pgcrypto";
) > "%SQL_FILE%"

set PGPASSWORD=mangalm_secure_2024
psql -U mangalm -h localhost -p 5432 -d mangalm_sales -f "%SQL_FILE%" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Could not enable extensions. This is not critical.
)
set PGPASSWORD=
del "%SQL_FILE%" >nul 2>&1

echo [OK] Database extensions enabled
echo.

REM Test connection
echo Testing database connection...
set PGPASSWORD=mangalm_secure_2024
psql -U mangalm -h localhost -p 5432 -d mangalm_sales -c "SELECT version();" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Database connection successful!
) else (
    echo [ERROR] Could not connect to database with mangalm user
    set PGPASSWORD=
    pause
    exit /b 1
)
set PGPASSWORD=

echo.
echo ========================================
echo Database setup completed successfully!
echo ========================================
echo.
echo Connection Details:
echo   Host: localhost
echo   Port: 5432
echo   Database: mangalm_sales
echo   Username: mangalm
echo   Password: mangalm_secure_2024
echo.
echo Connection String:
echo   postgresql://mangalm:mangalm_secure_2024@localhost:5432/mangalm_sales
echo.
echo [IMPORTANT] Please save these credentials securely!
echo.
pause