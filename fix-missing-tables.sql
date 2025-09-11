-- ================================================================
-- FIX MISSING TABLES AND ENSURE COMPLETE DATA PIPELINE
-- ================================================================

-- Create predicted_orders table (MISSING!)
CREATE TABLE IF NOT EXISTS predicted_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    predicted_date DATE,
    confidence DECIMAL(3, 2),
    priority VARCHAR(20) DEFAULT 'medium',
    total_amount DECIMAL(10, 2),
    items JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    manual_verification_required BOOLEAN DEFAULT FALSE,
    ai_recommendation TEXT,
    prediction_model VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create predicted_order_items table (MISSING!)
CREATE TABLE IF NOT EXISTS predicted_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predicted_order_id UUID REFERENCES predicted_orders(id) ON DELETE CASCADE,
    product_id VARCHAR(255),
    product_name VARCHAR(255),
    product_code VARCHAR(100),
    predicted_quantity INTEGER,
    confidence DECIMAL(3, 2),
    unit_price DECIMAL(10, 2),
    total_price DECIMAL(10, 2),
    ai_reasoning TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sales_forecasts table for time-series predictions
CREATE TABLE IF NOT EXISTS sales_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    product_id UUID REFERENCES products(id),
    forecast_date DATE,
    forecast_period VARCHAR(20), -- daily, weekly, monthly
    predicted_quantity INTEGER,
    predicted_revenue DECIMAL(10, 2),
    confidence_lower DECIMAL(10, 2),
    confidence_upper DECIMAL(10, 2),
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_patterns table for ML pattern storage
CREATE TABLE IF NOT EXISTS order_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    pattern_type VARCHAR(50), -- seasonal, recurring, trending
    pattern_data JSONB,
    confidence_score DECIMAL(3, 2),
    last_occurrence DATE,
    next_predicted DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create model_performance table to track prediction accuracy
CREATE TABLE IF NOT EXISTS model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    evaluation_date DATE,
    mae DECIMAL(10, 4), -- Mean Absolute Error
    rmse DECIMAL(10, 4), -- Root Mean Square Error
    accuracy DECIMAL(5, 2), -- Percentage accuracy
    precision_score DECIMAL(5, 2),
    recall_score DECIMAL(5, 2),
    f1_score DECIMAL(5, 2),
    sample_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_predicted_orders_store_id ON predicted_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_predicted_orders_date ON predicted_orders(predicted_date);
CREATE INDEX IF NOT EXISTS idx_predicted_orders_status ON predicted_orders(status);
CREATE INDEX IF NOT EXISTS idx_predicted_order_items_order ON predicted_order_items(predicted_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_store ON sales_forecasts(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_date ON sales_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_order_patterns_store ON order_patterns(store_id);

-- Fix call_prioritization table structure
ALTER TABLE call_prioritization 
ADD COLUMN IF NOT EXISTS last_contact_date DATE,
ADD COLUMN IF NOT EXISTS next_call_date DATE,
ADD COLUMN IF NOT EXISTS ai_score DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS predicted_order_value DECIMAL(10, 2);

-- Create a view for dashboard predictions
CREATE OR REPLACE VIEW dashboard_predictions AS
SELECT 
    po.id,
    po.store_id,
    s.name as store_name,
    po.predicted_date,
    po.confidence,
    po.priority,
    po.total_amount,
    po.status,
    po.ai_recommendation,
    COUNT(poi.id) as item_count,
    SUM(poi.predicted_quantity) as total_items
FROM predicted_orders po
LEFT JOIN stores s ON po.store_id = s.id
LEFT JOIN predicted_order_items poi ON po.id = poi.predicted_order_id
WHERE po.predicted_date >= CURRENT_DATE
GROUP BY po.id, s.name;

-- Create function to generate predictions based on historical data
CREATE OR REPLACE FUNCTION generate_order_predictions()
RETURNS void AS $$
DECLARE
    store_record RECORD;
    avg_order_value DECIMAL;
    days_since_last INTERVAL;
    prediction_confidence DECIMAL;
BEGIN
    -- Clear old predictions
    DELETE FROM predicted_orders WHERE predicted_date < CURRENT_DATE;
    
    -- Generate predictions for each store
    FOR store_record IN 
        SELECT DISTINCT s.id, s.name, 
               MAX(mi.invoice_date) as last_order_date,
               AVG(mi.total) as avg_total,
               COUNT(DISTINCT mi.invoice_number) as order_count
        FROM stores s
        LEFT JOIN mangalam_invoices mi ON s.id = mi.customer_id
        WHERE mi.invoice_date >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY s.id, s.name
    LOOP
        -- Calculate prediction confidence based on order history
        IF store_record.order_count > 20 THEN
            prediction_confidence := 0.85;
        ELSIF store_record.order_count > 10 THEN
            prediction_confidence := 0.70;
        ELSE
            prediction_confidence := 0.50;
        END IF;
        
        -- Calculate days since last order
        days_since_last := CURRENT_DATE - store_record.last_order_date;
        
        -- Generate prediction if store is due for an order
        IF EXTRACT(DAY FROM days_since_last) > 7 THEN
            INSERT INTO predicted_orders (
                store_id,
                predicted_date,
                confidence,
                priority,
                total_amount,
                ai_recommendation,
                prediction_model
            ) VALUES (
                store_record.id,
                CURRENT_DATE + INTERVAL '3 days',
                prediction_confidence,
                CASE 
                    WHEN EXTRACT(DAY FROM days_since_last) > 30 THEN 'high'
                    WHEN EXTRACT(DAY FROM days_since_last) > 14 THEN 'medium'
                    ELSE 'low'
                END,
                store_record.avg_total,
                'Store is due for reorder based on ' || EXTRACT(DAY FROM days_since_last) || ' days since last order',
                'Historical Average Model v1.0'
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Populate initial predictions
SELECT generate_order_predictions();

-- Check what we created
SELECT 'Tables created/fixed:' as status;
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('predicted_orders', 'predicted_order_items', 'sales_forecasts', 'order_patterns', 'model_performance')
ORDER BY tablename;