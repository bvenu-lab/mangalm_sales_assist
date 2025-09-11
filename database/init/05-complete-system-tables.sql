-- ================================================================
-- COMPLETE SYSTEM TABLES WITH ALL CONNECTIONS
-- This ensures ALL layers are properly connected
-- ================================================================

-- Drop and recreate all prediction/ML tables properly
DROP TABLE IF EXISTS predicted_order_items CASCADE;
DROP TABLE IF EXISTS predicted_orders CASCADE;
DROP TABLE IF EXISTS sales_forecasts CASCADE;
DROP TABLE IF EXISTS order_patterns CASCADE;
DROP TABLE IF EXISTS model_performance CASCADE;
DROP TABLE IF EXISTS user_actions CASCADE;
DROP TABLE IF EXISTS dashboard_settings CASCADE;
DROP TABLE IF EXISTS store_preferences CASCADE;

-- 1. PREDICTED ORDERS - Core prediction table
CREATE TABLE predicted_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id) ON DELETE CASCADE,
    predicted_date DATE NOT NULL,
    confidence DECIMAL(3, 2) DEFAULT 0.75,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    total_amount DECIMAL(10, 2),
    items JSONB,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'modified')),
    manual_verification_required BOOLEAN DEFAULT FALSE,
    ai_recommendation TEXT,
    prediction_model VARCHAR(100),
    notes TEXT,
    created_by VARCHAR(255) DEFAULT 'system',
    modified_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. PREDICTED ORDER ITEMS - Item-level predictions
CREATE TABLE predicted_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predicted_order_id UUID REFERENCES predicted_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(100),
    predicted_quantity INTEGER DEFAULT 1,
    confidence DECIMAL(3, 2) DEFAULT 0.75,
    unit_price DECIMAL(10, 2),
    total_price DECIMAL(10, 2),
    ai_reasoning TEXT,
    user_modified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. SALES FORECASTS - Time-series predictions
CREATE TABLE sales_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    forecast_date DATE NOT NULL,
    forecast_period VARCHAR(20) CHECK (forecast_period IN ('daily', 'weekly', 'monthly')),
    predicted_quantity INTEGER,
    predicted_revenue DECIMAL(10, 2),
    confidence_lower DECIMAL(10, 2),
    confidence_upper DECIMAL(10, 2),
    actual_quantity INTEGER,
    actual_revenue DECIMAL(10, 2),
    accuracy_score DECIMAL(5, 2),
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ORDER PATTERNS - ML pattern storage
CREATE TABLE order_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) CHECK (pattern_type IN ('seasonal', 'recurring', 'trending', 'promotional')),
    pattern_data JSONB NOT NULL,
    confidence_score DECIMAL(3, 2),
    last_occurrence DATE,
    next_predicted DATE,
    frequency_days INTEGER,
    avg_order_value DECIMAL(10, 2),
    top_products JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. MODEL PERFORMANCE - Track prediction accuracy
CREATE TABLE model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    evaluation_date DATE DEFAULT CURRENT_DATE,
    mae DECIMAL(10, 4),
    rmse DECIMAL(10, 4),
    accuracy DECIMAL(5, 2),
    precision_score DECIMAL(5, 2),
    recall_score DECIMAL(5, 2),
    f1_score DECIMAL(5, 2),
    sample_size INTEGER,
    true_positives INTEGER,
    false_positives INTEGER,
    true_negatives INTEGER,
    false_negatives INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. USER ACTIONS - Track all user interactions for persistence
CREATE TABLE user_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. DASHBOARD SETTINGS - Persist user dashboard preferences
CREATE TABLE dashboard_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) UNIQUE,
    theme VARCHAR(20) DEFAULT 'light',
    layout_config JSONB,
    widget_preferences JSONB,
    notification_settings JSONB,
    default_date_range VARCHAR(20) DEFAULT '30d',
    favorite_stores TEXT[],
    favorite_products TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. STORE PREFERENCES - Store-specific settings and metadata
CREATE TABLE store_preferences (
    store_id VARCHAR(255) PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    call_frequency VARCHAR(20) DEFAULT 'weekly',
    preferred_contact_time VARCHAR(20),
    special_instructions TEXT,
    credit_limit DECIMAL(10, 2),
    payment_terms INTEGER DEFAULT 30,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    auto_approve_predictions BOOLEAN DEFAULT FALSE,
    min_order_value DECIMAL(10, 2),
    max_order_value DECIMAL(10, 2),
    blacklisted_products TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_predicted_orders_store_date ON predicted_orders(store_id, predicted_date);
CREATE INDEX idx_predicted_orders_status ON predicted_orders(status);
CREATE INDEX idx_predicted_order_items_product ON predicted_order_items(product_id);
CREATE INDEX idx_sales_forecasts_store_date ON sales_forecasts(store_id, forecast_date);
CREATE INDEX idx_order_patterns_store_type ON order_patterns(store_id, pattern_type);
CREATE INDEX idx_user_actions_user_time ON user_actions(user_id, created_at DESC);
CREATE INDEX idx_user_actions_entity ON user_actions(entity_type, entity_id);

-- Create update triggers for timestamp management
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_predicted_orders_updated_at BEFORE UPDATE ON predicted_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_predicted_order_items_updated_at BEFORE UPDATE ON predicted_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_patterns_updated_at BEFORE UPDATE ON order_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_settings_updated_at BEFORE UPDATE ON dashboard_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_preferences_updated_at BEFORE UPDATE ON store_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to log user actions automatically
CREATE OR REPLACE FUNCTION log_user_action()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_actions (
        action_type,
        entity_type,
        entity_id,
        old_value,
        new_value,
        metadata
    ) VALUES (
        TG_OP,
        TG_TABLE_NAME,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id::text
            ELSE NEW.id::text
        END,
        CASE 
            WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)
            ELSE NULL
        END,
        CASE 
            WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)
            ELSE NULL
        END,
        jsonb_build_object(
            'table_name', TG_TABLE_NAME,
            'operation', TG_OP,
            'timestamp', CURRENT_TIMESTAMP
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach action logging to critical tables
CREATE TRIGGER log_predicted_orders_changes
    AFTER INSERT OR UPDATE OR DELETE ON predicted_orders
    FOR EACH ROW EXECUTE FUNCTION log_user_action();

CREATE TRIGGER log_orders_changes
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION log_user_action();

-- Create materialized view for dashboard performance
DROP MATERIALIZED VIEW IF EXISTS dashboard_summary CASCADE;
CREATE MATERIALIZED VIEW dashboard_summary AS
SELECT 
    -- Current metrics
    (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE) as orders_today,
    (SELECT SUM(total_amount) FROM orders WHERE DATE(created_at) = CURRENT_DATE) as revenue_today,
    (SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as orders_week,
    (SELECT SUM(total_amount) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as revenue_week,
    
    -- Store metrics
    (SELECT COUNT(*) FROM stores) as total_stores,
    (SELECT COUNT(DISTINCT store_id) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as active_stores,
    
    -- Product metrics
    (SELECT COUNT(*) FROM products) as total_products,
    (SELECT COUNT(DISTINCT mi.item_name) FROM mangalam_invoices mi WHERE mi.invoice_date >= CURRENT_DATE - INTERVAL '30 days') as active_products,
    
    -- Prediction metrics
    (SELECT COUNT(*) FROM predicted_orders WHERE status = 'pending') as pending_predictions,
    (SELECT SUM(total_amount) FROM predicted_orders WHERE status = 'pending') as pending_value,
    
    -- Performance metrics
    (SELECT AVG(accuracy) FROM model_performance WHERE evaluation_date >= CURRENT_DATE - INTERVAL '7 days') as avg_model_accuracy,
    
    -- Last update
    CURRENT_TIMESTAMP as last_refreshed;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_dashboard_summary ON dashboard_summary(last_refreshed);

-- Function to refresh dashboard data
CREATE OR REPLACE FUNCTION refresh_dashboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_summary;
    RAISE NOTICE 'Dashboard data refreshed at %', CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO mangalm;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO mangalm;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO mangalm;
GRANT ALL ON SCHEMA public TO mangalm;

-- Verify all tables created
SELECT 'System tables created:' as status;
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;