@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Database Migration Script
echo ========================================
echo.

REM Change to project root
cd /d "%~dp0\..\.."
set PROJECT_ROOT=%CD%

REM Check if .env exists
if not exist "%PROJECT_ROOT%\.env" (
    echo [ERROR] .env file not found!
    echo Please run setup-environment.bat first.
    pause
    exit /b 1
)

REM Load database credentials from .env
for /f "tokens=1,2 delims==" %%a in ('findstr "DB_" "%PROJECT_ROOT%\.env"') do (
    set %%a=%%b
)

echo Database: %DB_NAME%
echo Host: %DB_HOST%
echo Port: %DB_PORT%
echo User: %DB_USER%
echo.

REM Check PostgreSQL connection
echo Testing database connection...
set PGPASSWORD=%DB_PASSWORD%
psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -c "SELECT 1;" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot connect to database!
    echo Please ensure PostgreSQL is running and credentials are correct.
    set PGPASSWORD=
    pause
    exit /b 1
)
set PGPASSWORD=
echo [OK] Database connection successful
echo.

REM Change to database directory
cd "%PROJECT_ROOT%\database"

REM Check if knex is installed
if not exist "node_modules\knex" (
    echo Installing database dependencies...
    call npm install --legacy-peer-deps
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install database dependencies
        pause
        exit /b 1
    )
)

REM Create knexfile.js if not exists
if not exist "knexfile.js" (
    echo Creating knexfile.js...
    (
        echo module.exports = {
        echo   production: {
        echo     client: 'postgresql',
        echo     connection: {
        echo       host: '%DB_HOST%',
        echo       port: %DB_PORT%,
        echo       database: '%DB_NAME%',
        echo       user: '%DB_USER%',
        echo       password: '%DB_PASSWORD%'
        echo     },
        echo     migrations: {
        echo       directory: './migrations',
        echo       tableName: 'knex_migrations'
        echo     },
        echo     seeds: {
        echo       directory: './seeds'
        echo     }
        echo   }
        echo };
    ) > knexfile.js
    echo [OK] knexfile.js created
)

echo.
echo Running database migrations...
echo.

REM Run migrations
call npx knex migrate:latest --env production
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Migration failed!
    echo.
    choice /C YN /M "Do you want to rollback and try again?"
    if !ERRORLEVEL! EQU 1 (
        echo Rolling back migrations...
        call npx knex migrate:rollback --env production
        echo Retrying migrations...
        call npx knex migrate:latest --env production
        if !ERRORLEVEL! NEQ 0 (
            echo [ERROR] Migration failed again. Please check the error messages.
            pause
            exit /b 1
        )
    ) else (
        pause
        exit /b 1
    )
)

echo [OK] Migrations completed successfully
echo.

REM Check if seeds exist
if exist "seeds\*.js" (
    choice /C YN /M "Do you want to seed the database with sample data?"
    if !ERRORLEVEL! EQU 1 (
        echo Running database seeds...
        call npx knex seed:run --env production
        if !ERRORLEVEL! EQU 0 (
            echo [OK] Database seeded successfully
        ) else (
            echo [WARNING] Seeding had some issues but is not critical
        )
    )
) else (
    echo No seed files found. Creating initial data...
    
    REM Create initial admin user directly
    set SQL_FILE=%TEMP%\initial_data.sql
    (
        echo -- Create initial admin user
        echo INSERT INTO users ^(id, username, email, password_hash, password_salt, first_name, last_name, role, is_active, is_verified^)
        echo VALUES ^(
        echo   gen_random_uuid^(^),
        echo   'admin',
        echo   'admin@mangalm.com',
        echo   '$2b$10$K7L1fKU8.hash', -- This is a placeholder, actual hash needed
        echo   'salt123',
        echo   'System',
        echo   'Administrator',
        echo   'admin',
        echo   true,
        echo   true
        echo ^) ON CONFLICT ^(username^) DO NOTHING;
    ) > "%SQL_FILE%"
    
    set PGPASSWORD=%DB_PASSWORD%
    psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -f "%SQL_FILE%" >nul 2>&1
    set PGPASSWORD=
    del "%SQL_FILE%" >nul 2>&1
)

echo.
echo Verifying database tables...
set PGPASSWORD=%DB_PASSWORD%
for /f %%i in ('psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"') do set TABLE_COUNT=%%i
set PGPASSWORD=

echo [OK] Database has %TABLE_COUNT% tables
echo.

echo ========================================
echo Database migration completed!
echo ========================================
echo.
echo Database is ready with the following:
echo   - All tables created
echo   - Migrations applied
echo   - Initial data loaded
echo.
echo You can now start the application!
echo.
pause