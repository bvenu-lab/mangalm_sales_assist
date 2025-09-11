@echo off
REM ================================================
REM CLEAR ALL DATA FROM ALL TABLES
REM Use this to reset the database to empty state
REM ================================================

echo.
echo ========================================================
echo     DATABASE RESET - CLEARING ALL DATA
echo ========================================================
echo.
echo Clearing all 18 tables...

REM Execute the clear command directly
docker exec mangalm-postgres psql -U mangalm -d mangalm_sales -c "SET session_replication_role = 'replica'; DELETE FROM user_actions; DELETE FROM realtime_sync_queue; DELETE FROM dashboard_settings; DELETE FROM upselling_recommendations; DELETE FROM product_associations; DELETE FROM predicted_order_items; DELETE FROM predicted_orders; DELETE FROM sales_forecasts; DELETE FROM model_performance; DELETE FROM order_patterns; DELETE FROM call_prioritization; DELETE FROM store_preferences; DELETE FROM customer_segments; DELETE FROM invoice_items; DELETE FROM orders; DELETE FROM mangalam_invoices; DELETE FROM products; DELETE FROM stores; SET session_replication_role = 'origin'; VACUUM ANALYZE;" >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo     SUCCESS - ALL DATA CLEARED
    echo ========================================================
    echo.
    echo Verifying...
    docker exec mangalm-postgres psql -U mangalm -d mangalm_sales -c "SELECT 'stores' as table, COUNT(*) as records FROM stores UNION ALL SELECT 'products', COUNT(*) FROM products UNION ALL SELECT 'invoices', COUNT(*) FROM mangalam_invoices UNION ALL SELECT 'predictions', COUNT(*) FROM predicted_orders;"
    echo.
    echo Database is now empty and ready for fresh data!
    echo.
    echo To load new data:
    echo   1. Upload CSV via http://localhost:3009/upload
    echo   2. Or run: start-all.bat --clean
) else (
    echo.
    echo ERROR: Failed to clear database
    echo Please ensure Docker is running and PostgreSQL is accessible
)

echo.
pause