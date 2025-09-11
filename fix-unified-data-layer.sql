-- Unified Data Layer Fix for Mangalm Enterprise System
-- This creates SQL views to bridge the gap between mangalam_invoices and dashboard expectations

-- 1. Create historical_invoices view as an alias to mangalam_invoices
DROP VIEW IF EXISTS historical_invoices CASCADE;
CREATE VIEW historical_invoices AS 
SELECT 
    id,
    invoice_date,
    invoice_number,
    customer_name as store_id, -- Map customer_name to store_id for compatibility
    customer_name,
    item_name,
    quantity,
    item_total as total_amount,
    total,
    subtotal,
    created_at,
    updated_at
FROM mangalam_invoices
WHERE customer_name IS NOT NULL;

-- 2. Ensure stores table has required columns and data
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS city VARCHAR(255),
ADD COLUMN IF NOT EXISTS state VARCHAR(255);

-- Update stores to use address for city/state compatibility
UPDATE stores SET 
    city = COALESCE(address, 'Unknown City'),
    state = COALESCE(address, 'Unknown State')
WHERE city IS NULL OR state IS NULL;

-- 3. Create invoice_items view for complex analytics
DROP VIEW IF EXISTS invoice_items CASCADE;
CREATE VIEW invoice_items AS
SELECT 
    id as invoice_id,
    id, -- Self-reference for compatibility
    item_name as product_name,
    quantity,
    item_price as unit_price,
    item_total as total_price,
    created_at,
    updated_at
FROM mangalam_invoices
WHERE item_name IS NOT NULL;

-- 4. Create products view
DROP VIEW IF EXISTS products CASCADE;
CREATE VIEW products AS
SELECT DISTINCT
    item_name as id,
    item_name as name,
    brand,
    category_name as category,
    item_price as price,
    sku,
    NOW() as created_at,
    NOW() as updated_at
FROM mangalam_invoices
WHERE item_name IS NOT NULL;

-- 5. Sync stores table with invoice data
INSERT INTO stores (id, name, address, phone, email, created_at)
SELECT DISTINCT 
    customer_name as id,
    customer_name as name,
    COALESCE(billing_city || ', ' || billing_state, 'Unknown Address') as address,
    '+1-555-' || LEFT(MD5(customer_name), 7) as phone,
    LOWER(REPLACE(customer_name, ' ', '')) || '@store.com' as email,
    NOW() as created_at
FROM mangalam_invoices 
WHERE customer_name IS NOT NULL
    AND customer_name NOT IN (SELECT id FROM stores WHERE id IS NOT NULL)
ON CONFLICT (id) DO NOTHING;

-- 6. Update stores with proper city/state from invoice data
UPDATE stores SET 
    city = COALESCE(
        (SELECT DISTINCT billing_city FROM mangalam_invoices WHERE customer_name = stores.id LIMIT 1),
        'Unknown City'
    ),
    state = COALESCE(
        (SELECT DISTINCT billing_state FROM mangalam_invoices WHERE customer_name = stores.id LIMIT 1), 
        'Unknown State'
    ),
    address = COALESCE(
        (SELECT DISTINCT billing_city || ', ' || billing_state 
         FROM mangalam_invoices 
         WHERE customer_name = stores.id 
         AND billing_city IS NOT NULL 
         LIMIT 1),
        address
    )
WHERE EXISTS (SELECT 1 FROM mangalam_invoices WHERE customer_name = stores.id);

-- 7. Populate orders table from mangalam_invoices
INSERT INTO orders (
    id, 
    order_number, 
    store_id, 
    customer_name,
    order_date,
    status,
    total_amount,
    items,
    item_count,
    total_quantity,
    source,
    created_at,
    updated_at
)
SELECT DISTINCT
    invoice_number as id,
    invoice_number as order_number,
    (SELECT id FROM stores WHERE name = customer_name LIMIT 1) as store_id,
    customer_name,
    invoice_date as order_date,
    'completed' as status,
    total as total_amount,
    jsonb_build_array(
        jsonb_build_object(
            'name', item_name,
            'quantity', quantity,
            'price', item_price,
            'total', item_total
        )
    ) as items,
    1 as item_count,
    quantity as total_quantity,
    'bulk_upload' as source,
    created_at,
    updated_at
FROM mangalam_invoices
WHERE invoice_number IS NOT NULL 
    AND customer_name IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    total_amount = EXCLUDED.total_amount,
    updated_at = EXCLUDED.updated_at;

-- 8. Create summary for verification
SELECT 
    'mangalam_invoices' as table_name, COUNT(*) as row_count FROM mangalam_invoices
UNION ALL
SELECT 'stores', COUNT(*) FROM stores  
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL  
SELECT 'historical_invoices (view)', COUNT(*) FROM historical_invoices;