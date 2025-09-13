-- POPULATE REMAINING 5 EMPTY TABLES

-- 1. Upselling Recommendations
INSERT INTO upselling_recommendations (
    order_id, store_id, product_id, recommendation_type,
    confidence, reason, suggested_quantity, expected_revenue
)
SELECT 
    o.id, o.store_id, p.id,
    CASE FLOOR(RANDOM() * 3)
        WHEN 0 THEN 'cross_sell'
        WHEN 1 THEN 'upsell'
        ELSE 'bundle'
    END,
    0.65 + RANDOM() * 0.3,
    CASE FLOOR(RANDOM() * 4)
        WHEN 0 THEN 'Frequently bought together'
        WHEN 1 THEN 'Popular with similar customers'
        WHEN 2 THEN 'New product promotion'
        ELSE 'Seasonal recommendation'
    END,
    FLOOR(1 + RANDOM() * 5)::integer,
    p.price * (1 + RANDOM() * 3)
FROM orders o
CROSS JOIN products p
WHERE RANDOM() < 0.005
LIMIT 200
ON CONFLICT DO NOTHING;

-- 2. Order Patterns (check actual columns first)
INSERT INTO order_patterns (
    store_id, pattern_type, frequency, last_occurrence, created_at
)
SELECT 
    s.id,
    CASE FLOOR(RANDOM() * 4)
        WHEN 0 THEN 'weekly_regular'
        WHEN 1 THEN 'monthly_bulk'
        WHEN 2 THEN 'seasonal_spike'
        ELSE 'occasional'
    END,
    FLOOR(1 + RANDOM() * 10),
    CURRENT_DATE - (RANDOM() * 30)::integer,
    NOW()
FROM stores s
WHERE RANDOM() < 0.25
LIMIT 50
ON CONFLICT DO NOTHING;

-- 3. Store Preferences (check actual columns)
INSERT INTO store_preferences (
    store_id, created_at, updated_at
)
SELECT 
    s.id,
    NOW(),
    NOW()
FROM stores s
WHERE NOT EXISTS (
    SELECT 1 FROM store_preferences sp WHERE sp.store_id = s.id
)
AND RANDOM() < 0.4
LIMIT 80
ON CONFLICT DO NOTHING;

-- 4. User Actions (simplified)
INSERT INTO user_actions (
    user_id, action_type, ip_address, user_agent, created_at
)
SELECT 
    'user_' || FLOOR(RANDOM() * 10 + 1),
    CASE FLOOR(RANDOM() * 5)
        WHEN 0 THEN 'login'
        WHEN 1 THEN 'view_dashboard'
        WHEN 2 THEN 'export_report'
        WHEN 3 THEN 'update_order'
        ELSE 'view_analytics'
    END,
    '192.168.1.' || FLOOR(RANDOM() * 255),
    'Mozilla/5.0',
    NOW() - (RANDOM() * INTERVAL '30 days')
FROM generate_series(1, 100)
ON CONFLICT DO NOTHING;

-- 5. Dashboard Settings (simplified)
INSERT INTO dashboard_settings (
    user_id, created_at, updated_at
)
SELECT 
    'user_' || n,
    NOW(),
    NOW()
FROM generate_series(1, 10) AS n
ON CONFLICT DO NOTHING;

-- Verify all tables have data
SELECT 
    'Final Population Status' AS status,
    (SELECT COUNT(*) FROM upselling_recommendations) AS upselling,
    (SELECT COUNT(*) FROM order_patterns) AS patterns,
    (SELECT COUNT(*) FROM store_preferences) AS preferences,
    (SELECT COUNT(*) FROM user_actions) AS actions,
    (SELECT COUNT(*) FROM dashboard_settings) AS dashboard;