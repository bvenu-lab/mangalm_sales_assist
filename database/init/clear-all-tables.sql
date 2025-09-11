-- ================================================
-- CLEAR ALL DATA FROM ALL TABLES
-- Enterprise-Grade Data Cleanup Script
-- ================================================

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Clear audit and system tables first
DELETE FROM user_actions;
DELETE FROM realtime_sync_queue;
DELETE FROM dashboard_settings;

-- Clear analytics and predictions
DELETE FROM upselling_recommendations;
DELETE FROM product_associations;
DELETE FROM predicted_order_items;
DELETE FROM predicted_orders;
DELETE FROM sales_forecasts;
DELETE FROM model_performance;
DELETE FROM order_patterns;
DELETE FROM call_prioritization;

-- Clear customer data
DELETE FROM store_preferences;
DELETE FROM customer_segments;

-- Clear transaction data
DELETE FROM invoice_items;
DELETE FROM orders;
DELETE FROM mangalam_invoices;

-- Clear master data
DELETE FROM products;
DELETE FROM stores;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Reset sequences
ALTER SEQUENCE IF EXISTS mangalam_invoices_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS orders_id_seq RESTART WITH 1;

-- Refresh materialized views (will be empty)
REFRESH MATERIALIZED VIEW IF EXISTS dashboard_summary;

-- Vacuum to reclaim space
VACUUM ANALYZE;

-- Verification query
SELECT 
    'stores' as table_name, COUNT(*) as count FROM stores
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'mangalam_invoices', COUNT(*) FROM mangalam_invoices
UNION ALL SELECT 'invoice_items', COUNT(*) FROM invoice_items
UNION ALL SELECT 'predicted_orders', COUNT(*) FROM predicted_orders
UNION ALL SELECT 'customer_segments', COUNT(*) FROM customer_segments
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'upselling_recommendations', COUNT(*) FROM upselling_recommendations
UNION ALL SELECT 'user_actions', COUNT(*) FROM user_actions
ORDER BY table_name;