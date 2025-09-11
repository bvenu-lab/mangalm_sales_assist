-- Dashboard Summary Materialized View for Enterprise Grade Analytics
-- This provides pre-aggregated data for the dashboard

-- Create the materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_summary AS
SELECT 
    -- Store metrics
    (SELECT COUNT(DISTINCT id) FROM stores) as total_stores,
    (SELECT COUNT(DISTINCT id) FROM stores) as active_stores, -- All stores are active by default
    
    -- Product metrics
    (SELECT COUNT(DISTINCT id) FROM products) as total_products,
    (SELECT COUNT(DISTINCT category) FROM products) as product_categories,
    
    -- Order metrics (from mangalam_invoices)
    (SELECT COUNT(*) FROM mangalam_invoices) as total_orders,
    (SELECT COUNT(DISTINCT customer_id) FROM mangalam_invoices) as stores_with_orders,
    (SELECT COALESCE(SUM(total), 0) FROM mangalam_invoices) as total_revenue,
    (SELECT COALESCE(AVG(total), 0) FROM mangalam_invoices) as average_order_value,
    
    -- Recent activity (last 30 days)
    (SELECT COUNT(*) FROM mangalam_invoices 
     WHERE invoice_date >= CURRENT_DATE - INTERVAL '30 days') as orders_last_30_days,
    (SELECT COALESCE(SUM(total), 0) FROM mangalam_invoices 
     WHERE invoice_date >= CURRENT_DATE - INTERVAL '30 days') as revenue_last_30_days,
    
    -- Predictions
    (SELECT COUNT(*) FROM predicted_orders WHERE status = 'pending') as pending_predictions,
    (SELECT COUNT(*) FROM predicted_orders WHERE status = 'approved') as approved_predictions,
    (SELECT COALESCE(AVG(confidence), 0) FROM predicted_orders) as average_prediction_confidence,
    
    -- Customer segments
    (SELECT COUNT(*) FROM customer_segments WHERE segment_value = 'high') as high_value_customers,
    (SELECT COUNT(*) FROM customer_segments WHERE segment_value = 'medium') as medium_value_customers,
    (SELECT COUNT(*) FROM customer_segments WHERE segment_value = 'low') as low_value_customers,
    
    -- Upselling opportunities
    (SELECT COUNT(*) FROM upselling_recommendations WHERE status = 'pending') as pending_upsells,
    (SELECT COALESCE(SUM(expected_revenue), 0) FROM upselling_recommendations 
     WHERE status = 'pending') as potential_upsell_revenue,
    
    -- Top performing metrics
    (SELECT json_agg(row_to_json(t)) FROM (
        SELECT s.id, s.name, COUNT(mi.id) as order_count, COALESCE(SUM(mi.total), 0) as revenue
        FROM stores s
        LEFT JOIN mangalam_invoices mi ON s.id = mi.customer_id
        GROUP BY s.id, s.name
        ORDER BY revenue DESC
        LIMIT 5
    ) t) as top_stores,
    
    (SELECT json_agg(row_to_json(t)) FROM (
        SELECT p.id, p.name, COUNT(ii.id) as order_count, COALESCE(SUM(ii.total_price), 0) as revenue
        FROM products p
        LEFT JOIN invoice_items ii ON p.id = ii.product_id
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 5
    ) t) as top_products,
    
    -- Time-based metrics
    CURRENT_TIMESTAMP as last_updated;

-- Create index for faster refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_summary_refresh ON dashboard_summary (last_updated);

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_dashboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_summary;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get dashboard data with automatic refresh if stale
CREATE OR REPLACE FUNCTION get_dashboard_summary()
RETURNS TABLE (data json) AS $$
DECLARE
    last_update TIMESTAMP;
BEGIN
    -- Check when last updated
    SELECT last_updated INTO last_update FROM dashboard_summary LIMIT 1;
    
    -- Refresh if data is older than 5 minutes
    IF last_update IS NULL OR last_update < CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN
        PERFORM refresh_dashboard();
    END IF;
    
    -- Return the data as JSON
    RETURN QUERY
    SELECT row_to_json(ds.*) FROM dashboard_summary ds;
END;
$$ LANGUAGE plpgsql;

-- Initial population
REFRESH MATERIALIZED VIEW dashboard_summary;