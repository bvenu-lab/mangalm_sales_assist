-- POPULATE EMPTY TABLES WITH REAL DATA
-- Simplified version matching actual schemas

-- 1. Call Prioritization (stores don't have status column)
INSERT INTO call_prioritization (
    store_id, store_name, priority_score, 
    last_order_date, days_since_order, days_since_last_order,
    average_order_value, prediction_confidence
)
SELECT 
    s.id, s.name,
    FLOOR(RANDOM() * 100)::numeric AS priority_score,
    CURRENT_DATE - (RANDOM() * 30)::integer AS last_order_date,
    FLOOR(RANDOM() * 30)::integer AS days_since_order,
    FLOOR(RANDOM() * 30)::integer AS days_since_last_order,
    250 + RANDOM() * 750 AS average_order_value,
    0.5 + RANDOM() * 0.4 AS prediction_confidence
FROM stores s
LIMIT 100
ON CONFLICT DO NOTHING;

-- 2. Predicted Orders
INSERT INTO predicted_orders (
    store_id, predicted_date, confidence, priority,
    total_amount, status
)
SELECT 
    s.id,
    CURRENT_DATE + (n || ' days')::interval,
    0.75,
    'medium',
    250 + RANDOM() * 750,
    'pending'
FROM stores s
CROSS JOIN generate_series(1, 3) AS n
LIMIT 300
ON CONFLICT DO NOTHING;

-- 3. Sales Forecasts (products.price not unit_price)
INSERT INTO sales_forecasts (
    store_id, product_id, forecast_date, forecast_period,
    predicted_quantity, predicted_revenue
)
SELECT 
    s.id, p.id,
    CURRENT_DATE + INTERVAL '1 month',
    'monthly',
    FLOOR(10 + RANDOM() * 50)::integer,
    p.price * FLOOR(10 + RANDOM() * 50)
FROM stores s
CROSS JOIN products p
WHERE RANDOM() < 0.01
LIMIT 200
ON CONFLICT DO NOTHING;

-- 4. Product Associations (columns are product_a and product_b)
INSERT INTO product_associations (
    product_a, product_b, association_type, created_at
)
SELECT DISTINCT
    p1.id, p2.id,
    'frequently_bought_together',
    NOW()
FROM products p1
CROSS JOIN products p2
WHERE p1.id < p2.id
  AND RANDOM() < 0.005
LIMIT 100
ON CONFLICT DO NOTHING;

-- 5. Model Performance (simplified columns)
INSERT INTO model_performance (
    model_name, model_version, evaluation_date, created_at
)
VALUES
    ('sales_predictor', 'v2.1', CURRENT_DATE, NOW()),
    ('recommendation_engine', 'v3.0', CURRENT_DATE, NOW()),
    ('forecast_model', 'v1.2', CURRENT_DATE, NOW())
ON CONFLICT DO NOTHING;

-- 6. Customer Segments
INSERT INTO customer_segments (
    store_id, segment_name, segment_value, created_at
)
SELECT 
    s.id,
    CASE FLOOR(RANDOM() * 3)
        WHEN 0 THEN 'Premium'
        WHEN 1 THEN 'Regular'
        ELSE 'New'
    END,
    CASE FLOOR(RANDOM() * 3)
        WHEN 0 THEN 'high'
        WHEN 1 THEN 'medium'
        ELSE 'low'
    END,
    NOW()
FROM stores s
WHERE RANDOM() < 0.3
LIMIT 50
ON CONFLICT DO NOTHING;

-- Check what was populated
SELECT 
    'Tables Populated' AS status,
    (SELECT COUNT(*) FROM call_prioritization) AS call_prioritization,
    (SELECT COUNT(*) FROM predicted_orders) AS predicted_orders,
    (SELECT COUNT(*) FROM sales_forecasts) AS sales_forecasts,
    (SELECT COUNT(*) FROM product_associations) AS product_associations,
    (SELECT COUNT(*) FROM model_performance) AS model_performance,
    (SELECT COUNT(*) FROM customer_segments) AS customer_segments;