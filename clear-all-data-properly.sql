-- ================================================================
-- PROPERLY CLEAR ALL DATA FROM ALL TABLES
-- This script ACTUALLY clears everything without silent failures
-- ================================================================

-- First, list all tables we're going to clear
DO $$
BEGIN
    RAISE NOTICE 'Starting complete database cleanup...';
END $$;

-- Drop all foreign key constraints temporarily to avoid cascade issues
ALTER TABLE IF EXISTS predicted_order_items DROP CONSTRAINT IF EXISTS predicted_order_items_predicted_order_id_fkey;
ALTER TABLE IF EXISTS predicted_orders DROP CONSTRAINT IF EXISTS predicted_orders_store_id_fkey;
ALTER TABLE IF EXISTS mangalam_invoices DROP CONSTRAINT IF EXISTS mangalam_invoices_customer_id_fkey;
ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_store_id_fkey;
ALTER TABLE IF EXISTS call_prioritization DROP CONSTRAINT IF EXISTS call_prioritization_store_id_fkey;

-- Clear all tables in the correct order (children first, then parents)
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Clear prediction tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'predicted_order_items') THEN
        DELETE FROM predicted_order_items;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % rows from predicted_order_items', v_count;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'predicted_orders') THEN
        DELETE FROM predicted_orders;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % rows from predicted_orders', v_count;
    END IF;
    
    -- Clear main transaction tables
    DELETE FROM mangalam_invoices;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % rows from mangalam_invoices', v_count;
    
    DELETE FROM orders;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % rows from orders', v_count;
    
    DELETE FROM call_prioritization;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % rows from call_prioritization', v_count;
    
    -- Clear master data tables
    DELETE FROM products;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % rows from products', v_count;
    
    DELETE FROM stores;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % rows from stores', v_count;
    
    -- Clear bulk_upload schema if exists
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'bulk_upload') THEN
        DELETE FROM bulk_upload.processing_errors;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % rows from bulk_upload.processing_errors', v_count;
    END IF;
    
    RAISE NOTICE 'All tables cleared successfully!';
END $$;

-- Reset all sequences
ALTER SEQUENCE IF EXISTS products_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS stores_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS orders_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS mangalam_invoices_id_seq RESTART WITH 1;

-- Re-add foreign key constraints
ALTER TABLE predicted_order_items 
ADD CONSTRAINT predicted_order_items_predicted_order_id_fkey 
FOREIGN KEY (predicted_order_id) REFERENCES predicted_orders(id) ON DELETE CASCADE;

ALTER TABLE predicted_orders 
ADD CONSTRAINT predicted_orders_store_id_fkey 
FOREIGN KEY (store_id) REFERENCES stores(id);

-- Verify everything is cleared
DO $$
DECLARE
    v_total INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM mangalam_invoices;
    RAISE NOTICE 'mangalam_invoices count: %', v_total;
    
    SELECT COUNT(*) INTO v_total FROM orders;
    RAISE NOTICE 'orders count: %', v_total;
    
    SELECT COUNT(*) INTO v_total FROM products;
    RAISE NOTICE 'products count: %', v_total;
    
    SELECT COUNT(*) INTO v_total FROM stores;
    RAISE NOTICE 'stores count: %', v_total;
    
    SELECT COUNT(*) INTO v_total FROM call_prioritization;
    RAISE NOTICE 'call_prioritization count: %', v_total;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'predicted_orders') THEN
        SELECT COUNT(*) INTO v_total FROM predicted_orders;
        RAISE NOTICE 'predicted_orders count: %', v_total;
    END IF;
    
    RAISE NOTICE '================================';
    RAISE NOTICE 'DATABASE CLEANUP COMPLETE!';
    RAISE NOTICE '================================';
END $$;