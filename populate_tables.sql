-- Populate products from unique items in CSV
INSERT INTO products (id, name, description, category, brand, price, cost, stock, is_active)
SELECT DISTINCT ON (name)
    ABS(HASHTEXT(name)) AS id,
    name,
    'Premium quality ' || name AS description,
    CASE 
        WHEN name ILIKE '%rice%' OR name ILIKE '%dal%' OR name ILIKE '%flour%' THEN 'Grains'
        WHEN name ILIKE '%oil%' OR name ILIKE '%ghee%' THEN 'Oils'
        WHEN name ILIKE '%spice%' OR name ILIKE '%masala%' THEN 'Spices'
        ELSE 'Grocery'
    END AS category,
    SPLIT_PART(name, ' ', 1) AS brand,
    RANDOM() * 100 + 10 AS price,
    (RANDOM() * 100 + 10) * 0.7 AS cost,
    FLOOR(RANDOM() * 900 + 100) AS stock,
    true
FROM (
    SELECT DISTINCT UNNEST(string_to_array(items_json, ',')) AS name
    FROM orders
    WHERE items_json IS NOT NULL
) AS unique_items
WHERE name != ''
ON CONFLICT (id) DO NOTHING;

-- Populate invoice_items from order data
INSERT INTO invoice_items (order_id, product_id, product_name, quantity, unit_price, total_price, discount)
SELECT 
    o.id AS order_id,
    p.id AS product_id,
    p.name AS product_name,
    FLOOR(RANDOM() * 10 + 1) AS quantity,
    p.price AS unit_price,
    p.price * FLOOR(RANDOM() * 10 + 1) AS total_price,
    0 AS discount
FROM orders o
CROSS JOIN LATERAL (
    SELECT id, name, price 
    FROM products 
    ORDER BY RANDOM() 
    LIMIT 3 + FLOOR(RANDOM() * 5)::int
) p
ON CONFLICT DO NOTHING;

-- Generate upselling recommendations
INSERT INTO upselling_recommendations (
    order_id, store_id, product_id, recommendation_type, 
    confidence_score, expected_revenue, reason, status
)
SELECT 
    o.id AS order_id,
    o.store_id,
    p.id AS product_id,
    CASE 
        WHEN p.price > 50 THEN 'upsell'
        WHEN p.category IN ('Grains', 'Oils') THEN 'cross_sell'
        ELSE 'bundle'
    END AS recommendation_type,
    RANDOM() * 0.4 + 0.6 AS confidence_score,
    p.price * (1 + RANDOM() * 0.3) AS expected_revenue,
    CASE 
        WHEN RANDOM() < 0.3 THEN 'Frequently bought together'
        WHEN RANDOM() < 0.6 THEN 'Customers who bought this also bought'
        ELSE 'Popular in your area'
    END AS reason,
    'pending' AS status
FROM orders o
CROSS JOIN products p
WHERE RANDOM() < 0.05  -- 5% of all combinations
LIMIT 1000
ON CONFLICT DO NOTHING;

-- Show final counts
SELECT 'products' as table_name, COUNT(*) as count FROM products
UNION ALL
SELECT 'invoice_items', COUNT(*) FROM invoice_items
UNION ALL
SELECT 'upselling_recommendations', COUNT(*) FROM upselling_recommendations
UNION ALL
SELECT 'orders', COUNT(*) FROM orders;