@echo off
echo ===============================================
echo ENTERPRISE STARTUP WITH CLEAN DATABASE
echo ===============================================
echo.

echo Stopping all services...
call stop-all.bat --silent 2>nul

echo.
echo Starting Docker containers...
docker-compose up -d postgres redis

echo.
echo Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul

echo.
echo ===============================================
echo CLEARING ALL DATABASE DATA
echo ===============================================
echo.

REM Clear ALL data from ALL tables using comprehensive script
echo Clearing all tables (18 total)...
docker cp database\init\clear-all-tables.sql mangalm-postgres:/tmp/clear-all-tables.sql >nul 2>&1
docker exec mangalm-postgres psql -U mangalm -d mangalm_sales -f /tmp/clear-all-tables.sql >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Successfully cleared ALL tables:
    echo   - Transaction tables: mangalam_invoices, invoice_items, orders
    echo   - Master data: stores, products
    echo   - Analytics: predicted_orders, customer_segments
    echo   - Upselling: upselling_recommendations, product_associations
    echo   - System: user_actions, dashboard_settings, realtime_sync_queue
    echo   - Other: call_prioritization, sales_forecasts, model_performance
) else (
    echo Warning: Issue clearing tables - attempting fallback method
    docker exec mangalm-postgres psql -U mangalm -d mangalm_sales -c "SET session_replication_role = 'replica'; DELETE FROM user_actions; DELETE FROM realtime_sync_queue; DELETE FROM dashboard_settings; DELETE FROM upselling_recommendations; DELETE FROM product_associations; DELETE FROM predicted_order_items; DELETE FROM predicted_orders; DELETE FROM sales_forecasts; DELETE FROM model_performance; DELETE FROM order_patterns; DELETE FROM call_prioritization; DELETE FROM store_preferences; DELETE FROM customer_segments; DELETE FROM invoice_items; DELETE FROM orders; DELETE FROM mangalam_invoices; DELETE FROM products; DELETE FROM stores; SET session_replication_role = 'origin';" >nul 2>&1
)

echo.
echo ===============================================
echo STARTING ALL SERVICES
echo ===============================================
echo.

REM Start API Gateway
echo Starting API Gateway on port 3007...
start /min cmd /c "cd services\api-gateway && npm start"

REM Start Bulk Upload API (Enterprise Version)
echo Starting Bulk Upload API on port 3009...
start /min cmd /c "cd services\bulk-upload-api && set PORT=3009 && node server-enterprise-v2.js"

REM Start Queue Processor
echo Starting Queue Processor...
start /min cmd /c "cd services\queue-processor && node processor.js"

REM Start Frontend
echo Starting Frontend on port 3000...
start /min cmd /c "cd services\sales-frontend && npm start"

echo.
echo ===============================================
echo ENTERPRISE SYSTEM STARTED WITH CLEAN DATABASE
echo ===============================================
echo.
echo Services running:
echo   - Frontend:        http://localhost:3000
echo   - API Gateway:     http://localhost:3007
echo   - Bulk Upload:     http://localhost:3009
echo   - PostgreSQL:      localhost:3432
echo   - Redis:           localhost:3379
echo.
echo Database Status: CLEARED - Ready for fresh data
echo.
echo To load test data with current dates, run:
echo   node load-invoices-with-current-dates.js
echo.
pause