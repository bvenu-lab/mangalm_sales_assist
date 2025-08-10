@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Database Backup Utility
echo ========================================
echo.

REM Set backup directory
set BACKUP_DIR=%~dp0..\..\backups
set DATE_STR=%date:~-4%%date:~4,2%%date:~7,2%
set TIME_STR=%time:~0,2%%time:~3,2%%time:~6,2%
set TIME_STR=%TIME_STR: =0%
set TIMESTAMP=%DATE_STR%_%TIME_STR%

REM Create backup directory if not exists
if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
    echo Created backup directory: %BACKUP_DIR%
)

REM Load database credentials
for /f "tokens=1,2 delims==" %%a in ('findstr "DB_" "..\..\..env" 2^>nul') do set %%a=%%b

if "%DB_NAME%"=="" (
    echo [ERROR] Could not load database configuration from .env
    echo Please ensure .env file exists and contains DB_ variables
    pause
    exit /b 1
)

echo Database: %DB_NAME%
echo Backup location: %BACKUP_DIR%
echo.

REM Menu
echo Select backup option:
echo.
echo 1. Full Database Backup (Structure + Data)
echo 2. Structure Only Backup
echo 3. Data Only Backup
echo 4. Specific Tables Backup
echo 5. Restore from Backup
echo 6. List Available Backups
echo 7. Exit
echo.
set /p CHOICE="Enter choice (1-7): "

if "%CHOICE%"=="1" goto :FullBackup
if "%CHOICE%"=="2" goto :StructureBackup
if "%CHOICE%"=="3" goto :DataBackup
if "%CHOICE%"=="4" goto :TablesBackup
if "%CHOICE%"=="5" goto :RestoreBackup
if "%CHOICE%"=="6" goto :ListBackups
if "%CHOICE%"=="7" exit /b 0

echo Invalid choice!
pause
exit /b 1

:FullBackup
echo.
echo Creating full database backup...
set BACKUP_FILE=%BACKUP_DIR%\mangalm_full_%TIMESTAMP%.sql
set PGPASSWORD=%DB_PASSWORD%
pg_dump -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -F p -b -v -f "%BACKUP_FILE%" 2>"%BACKUP_DIR%\backup_%TIMESTAMP%.log"
set PGPASSWORD=

if %ERRORLEVEL% EQU 0 (
    echo [OK] Full backup created: %BACKUP_FILE%
    
    REM Compress the backup
    echo Compressing backup...
    powershell -command "Compress-Archive -Path '%BACKUP_FILE%' -DestinationPath '%BACKUP_FILE%.zip' -Force"
    if !ERRORLEVEL! EQU 0 (
        del "%BACKUP_FILE%"
        echo [OK] Backup compressed: %BACKUP_FILE%.zip
        
        REM Calculate size
        for %%I in ("%BACKUP_FILE%.zip") do set SIZE=%%~zI
        set /a SIZE_MB=!SIZE!/1048576
        echo Backup size: !SIZE_MB! MB
    )
) else (
    echo [ERROR] Backup failed! Check %BACKUP_DIR%\backup_%TIMESTAMP%.log for details
)
goto :End

:StructureBackup
echo.
echo Creating structure-only backup...
set BACKUP_FILE=%BACKUP_DIR%\mangalm_structure_%TIMESTAMP%.sql
set PGPASSWORD=%DB_PASSWORD%
pg_dump -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -s -v -f "%BACKUP_FILE%"
set PGPASSWORD=

if %ERRORLEVEL% EQU 0 (
    echo [OK] Structure backup created: %BACKUP_FILE%
) else (
    echo [ERROR] Backup failed!
)
goto :End

:DataBackup
echo.
echo Creating data-only backup...
set BACKUP_FILE=%BACKUP_DIR%\mangalm_data_%TIMESTAMP%.sql
set PGPASSWORD=%DB_PASSWORD%
pg_dump -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -a --column-inserts -v -f "%BACKUP_FILE%"
set PGPASSWORD=

if %ERRORLEVEL% EQU 0 (
    echo [OK] Data backup created: %BACKUP_FILE%
    
    REM Compress if large
    for %%I in ("%BACKUP_FILE%") do set SIZE=%%~zI
    set /a SIZE_MB=!SIZE!/1048576
    if !SIZE_MB! GTR 10 (
        echo Compressing large backup...
        powershell -command "Compress-Archive -Path '%BACKUP_FILE%' -DestinationPath '%BACKUP_FILE%.zip' -Force"
        del "%BACKUP_FILE%"
        echo [OK] Backup compressed
    )
) else (
    echo [ERROR] Backup failed!
)
goto :End

:TablesBackup
echo.
echo Available tables:
set PGPASSWORD=%DB_PASSWORD%
psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -c "\dt" 2>nul
set PGPASSWORD=
echo.
set /p TABLES="Enter table names (space-separated): "
echo.
echo Backing up tables: %TABLES%
set BACKUP_FILE=%BACKUP_DIR%\mangalm_tables_%TIMESTAMP%.sql
set PGPASSWORD=%DB_PASSWORD%

set TABLE_ARGS=
for %%t in (%TABLES%) do (
    set TABLE_ARGS=!TABLE_ARGS! -t %%t
)

pg_dump -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% !TABLE_ARGS! -v -f "%BACKUP_FILE%"
set PGPASSWORD=

if %ERRORLEVEL% EQU 0 (
    echo [OK] Tables backup created: %BACKUP_FILE%
) else (
    echo [ERROR] Backup failed!
)
goto :End

:RestoreBackup
echo.
echo Available backups:
echo.
set COUNT=0
for %%f in ("%BACKUP_DIR%\*.sql" "%BACKUP_DIR%\*.sql.zip") do (
    set /a COUNT+=1
    echo !COUNT!. %%~nxf (%%~tf)
    set BACKUP_!COUNT!=%%f
)

if %COUNT% EQU 0 (
    echo No backups found!
    goto :End
)

echo.
set /p RESTORE_CHOICE="Select backup to restore (1-%COUNT%): "

if not defined BACKUP_%RESTORE_CHOICE% (
    echo Invalid selection!
    goto :End
)

set RESTORE_FILE=!BACKUP_%RESTORE_CHOICE%!
echo.
echo Selected: %RESTORE_FILE%
echo.
echo [WARNING] This will DROP and RECREATE the database!
echo All current data will be lost!
echo.
set /p CONFIRM="Are you sure? Type YES to confirm: "

if not "%CONFIRM%"=="YES" (
    echo Restore cancelled.
    goto :End
)

REM Check if it's a zip file
if "%RESTORE_FILE:~-4%"==".zip" (
    echo Extracting backup...
    set EXTRACTED_FILE=%RESTORE_FILE:~0,-4%
    powershell -command "Expand-Archive -Path '%RESTORE_FILE%' -DestinationPath '%BACKUP_DIR%' -Force"
    set RESTORE_FILE=!EXTRACTED_FILE!
)

echo.
echo Restoring database...

REM Drop and recreate database
set PGPASSWORD=%DB_PASSWORD%
psql -U postgres -h %DB_HOST% -p %DB_PORT% -c "DROP DATABASE IF EXISTS %DB_NAME%;"
psql -U postgres -h %DB_HOST% -p %DB_PORT% -c "CREATE DATABASE %DB_NAME% OWNER %DB_USER%;"

REM Restore backup
psql -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -f "%RESTORE_FILE%"
set PGPASSWORD=

if %ERRORLEVEL% EQU 0 (
    echo [OK] Database restored successfully!
) else (
    echo [ERROR] Restore failed!
)

REM Clean up extracted file if it was a zip
if defined EXTRACTED_FILE (
    del "%EXTRACTED_FILE%" >nul 2>&1
)
goto :End

:ListBackups
echo.
echo Available backups in %BACKUP_DIR%:
echo.
echo Name                                          Size        Date
echo ============================================ =========== ===================
for %%f in ("%BACKUP_DIR%\*.sql" "%BACKUP_DIR%\*.sql.zip") do (
    set FILENAME=%%~nxf
    set FILESIZE=%%~zf
    set /a FILESIZE_MB=!FILESIZE!/1048576
    set FILEDATE=%%~tf
    
    REM Pad filename to 44 characters
    set "PADDED_NAME=!FILENAME!                                            "
    set "PADDED_NAME=!PADDED_NAME:~0,44!"
    
    REM Pad size to 11 characters
    set "SIZE_STR=!FILESIZE_MB! MB          "
    set "SIZE_STR=!SIZE_STR:~0,11!"
    
    echo !PADDED_NAME! !SIZE_STR! !FILEDATE!
)
echo.

REM Calculate total backup size
set /a TOTAL_SIZE=0
for %%f in ("%BACKUP_DIR%\*.sql" "%BACKUP_DIR%\*.sql.zip") do (
    set /a TOTAL_SIZE+=%%~zf
)
set /a TOTAL_SIZE_MB=%TOTAL_SIZE%/1048576
echo Total backup size: %TOTAL_SIZE_MB% MB
goto :End

:End
echo.
echo ========================================
echo Backup utility finished
echo ========================================
echo.

REM Cleanup old backups (keep last 30 days)
echo Cleaning old backups (older than 30 days)...
forfiles /P "%BACKUP_DIR%" /M *.sql* /D -30 /C "cmd /c del @path" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Old backups cleaned
)

pause