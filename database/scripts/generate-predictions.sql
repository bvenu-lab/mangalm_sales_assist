-- Generate AI Predictions for All Stores
-- This script analyzes historical order patterns and creates predictions

-- Clear existing predictions
TRUNCATE TABLE predicted_order_items CASCADE;
TRUNCATE TABLE predicted_orders CASCADE;

-- Generate predictions for all stores with historical data
WITH store_order_analysis AS (
  -- Analyze order patterns for each store
  SELECT 
    s.id as store_id,
    s.name as store_name,
    COUNT(DISTINCT hi.id) as total_orders,
    MAX(hi.invoice_date) as last_order_date,
    MIN(hi.invoice_date) as first_order_date,
    AVG(hi.total_amount) as avg_order_value,
    -- Calculate ordering frequency
    CASE 
      WHEN COUNT(DISTINCT hi.id) > 1 THEN
        EXTRACT(DAY FROM (MAX(hi.invoice_date) - MIN(hi.invoice_date)) / NULLIF(COUNT(DISTINCT hi.id) - 1, 0))
      ELSE 30 -- Default to monthly if only one order
    END as avg_days_between_orders,
    -- Calculate next predicted order date
    CASE 
      WHEN COUNT(DISTINCT hi.id) > 1 THEN
        MAX(hi.invoice_date) + 
        INTERVAL '1 day' * EXTRACT(DAY FROM (MAX(hi.invoice_date) - MIN(hi.invoice_date)) / NULLIF(COUNT(DISTINCT hi.id) - 1, 0))
      ELSE 
        MAX(hi.invoice_date) + INTERVAL '30 days'
    END as next_order_date
  FROM stores s
  LEFT JOIN historical_invoices hi ON s.id = hi.store_id
  WHERE hi.id IS NOT NULL
  GROUP BY s.id, s.name
),
product_order_patterns AS (
  -- Analyze product ordering patterns per store
  SELECT 
    hi.store_id,
    ii.product_id,
    p.name as product_name,
    COUNT(DISTINCT hi.id) as order_count,
    AVG(ii.quantity) as avg_quantity,
    STDDEV(ii.quantity) as quantity_stddev,
    MAX(ii.quantity) as max_quantity,
    MIN(ii.quantity) as min_quantity,
    AVG(ii.unit_price) as avg_price,
    MAX(hi.invoice_date) as last_ordered,
    -- Calculate trend (increasing/decreasing/stable)
    CASE 
      WHEN COUNT(DISTINCT hi.id) >= 3 THEN
        -- Use linear regression approximation
        (SUM(ii.quantity * EXTRACT(EPOCH FROM hi.invoice_date)) - 
         SUM(ii.quantity) * AVG(EXTRACT(EPOCH FROM hi.invoice_date))) /
        NULLIF(SUM(POWER(EXTRACT(EPOCH FROM hi.invoice_date), 2)) - 
         COUNT(*) * POWER(AVG(EXTRACT(EPOCH FROM hi.invoice_date)), 2), 0)
      ELSE 0
    END as quantity_trend,
    -- Frequency score (how often ordered)
    COUNT(DISTINCT hi.id)::FLOAT / NULLIF(
      (SELECT COUNT(DISTINCT id) FROM historical_invoices WHERE store_id = hi.store_id), 0
    ) as frequency_score
  FROM historical_invoices hi
  JOIN invoice_items ii ON hi.id = ii.invoice_id
  LEFT JOIN products p ON ii.product_id = p.id
  GROUP BY hi.store_id, ii.product_id, p.name
),
recent_order_items AS (
  -- Get the most recent order items for each store
  SELECT DISTINCT ON (hi.store_id, ii.product_id)
    hi.store_id,
    ii.product_id,
    ii.quantity as last_quantity,
    ii.unit_price as last_price
  FROM historical_invoices hi
  JOIN invoice_items ii ON hi.id = ii.invoice_id
  ORDER BY hi.store_id, ii.product_id, hi.invoice_date DESC
),
seasonal_patterns AS (
  -- Analyze year-over-year patterns if available
  SELECT 
    hi.store_id,
    ii.product_id,
    EXTRACT(MONTH FROM hi.invoice_date) as order_month,
    AVG(ii.quantity) as avg_monthly_quantity
  FROM historical_invoices hi
  JOIN invoice_items ii ON hi.id = ii.invoice_id
  WHERE hi.invoice_date >= NOW() - INTERVAL '2 years'
  GROUP BY hi.store_id, ii.product_id, EXTRACT(MONTH FROM hi.invoice_date)
),
predicted_orders_insert AS (
  -- Insert predicted orders
  INSERT INTO predicted_orders (
    store_id, 
    predicted_date, 
    confidence, 
    priority, 
    status, 
    total_amount,
    ai_recommendation,
    prediction_model
  )
  SELECT 
    soa.store_id,
    CASE 
      WHEN soa.next_order_date < CURRENT_DATE THEN CURRENT_DATE + INTERVAL '7 days'
      WHEN soa.next_order_date > CURRENT_DATE + INTERVAL '60 days' THEN CURRENT_DATE + INTERVAL '30 days'
      ELSE DATE(soa.next_order_date)
    END as predicted_date,
    -- Calculate confidence based on data availability
    CASE 
      WHEN soa.total_orders >= 20 THEN 0.90
      WHEN soa.total_orders >= 10 THEN 0.75
      WHEN soa.total_orders >= 5 THEN 0.60
      WHEN soa.total_orders >= 2 THEN 0.45
      ELSE 0.30
    END as confidence,
    -- Set priority based on days since last order
    CASE 
      WHEN EXTRACT(DAY FROM CURRENT_DATE - soa.last_order_date) > soa.avg_days_between_orders * 1.5 THEN 'high'
      WHEN EXTRACT(DAY FROM CURRENT_DATE - soa.last_order_date) > soa.avg_days_between_orders THEN 'medium'
      ELSE 'low'
    END as priority,
    'pending' as status,
    soa.avg_order_value * 1.05 as total_amount, -- Slight growth assumption
    CONCAT(
      'Based on ', soa.total_orders, ' historical orders. ',
      'Average order frequency: every ', ROUND(soa.avg_days_between_orders), ' days. ',
      'Last order was ', EXTRACT(DAY FROM CURRENT_DATE - soa.last_order_date), ' days ago.'
    ) as ai_recommendation,
    'historical_pattern_v1' as prediction_model
  FROM store_order_analysis soa
  WHERE soa.total_orders > 0
  RETURNING id, store_id
)
-- Insert predicted order items
INSERT INTO predicted_order_items (
  predicted_order_id,
  product_id,
  product_name,
  predicted_quantity,
  confidence,
  unit_price,
  total_price
)
SELECT 
  poi.id as predicted_order_id,
  pop.product_id,
  pop.product_name,
  -- Calculate predicted quantity
  CASE 
    WHEN pop.quantity_trend > 0 THEN 
      -- Increasing trend
      GREATEST(
        ROUND(pop.avg_quantity * (1 + LEAST(pop.quantity_trend * 0.1, 0.3))),
        roi.last_quantity
      )
    WHEN pop.quantity_trend < 0 AND pop.avg_quantity > pop.min_quantity THEN
      -- Decreasing trend
      ROUND(pop.avg_quantity * (1 + GREATEST(pop.quantity_trend * 0.1, -0.2)))
    ELSE 
      -- Stable or insufficient data - use recent quantity or average
      COALESCE(roi.last_quantity, ROUND(pop.avg_quantity))
  END as predicted_quantity,
  -- Item-level confidence
  CASE 
    WHEN pop.frequency_score >= 0.8 THEN 0.85
    WHEN pop.frequency_score >= 0.5 THEN 0.65
    WHEN pop.frequency_score >= 0.3 THEN 0.45
    ELSE 0.25
  END as confidence_score,
  COALESCE(roi.last_price, pop.avg_price) as unit_price,
  -- Calculate total price
  CASE 
    WHEN pop.quantity_trend > 0 THEN 
      GREATEST(
        ROUND(pop.avg_quantity * (1 + LEAST(pop.quantity_trend * 0.1, 0.3))),
        roi.last_quantity
      ) * COALESCE(roi.last_price, pop.avg_price)
    WHEN pop.quantity_trend < 0 AND pop.avg_quantity > pop.min_quantity THEN
      ROUND(pop.avg_quantity * (1 + GREATEST(pop.quantity_trend * 0.1, -0.2))) * COALESCE(roi.last_price, pop.avg_price)
    ELSE 
      COALESCE(roi.last_quantity, ROUND(pop.avg_quantity)) * COALESCE(roi.last_price, pop.avg_price)
  END as total_price
FROM predicted_orders_insert poi
JOIN product_order_patterns pop ON poi.store_id = pop.store_id
LEFT JOIN recent_order_items roi ON pop.store_id = roi.store_id AND pop.product_id = roi.product_id
LEFT JOIN seasonal_patterns sp ON pop.store_id = sp.store_id 
  AND pop.product_id = sp.product_id 
  AND sp.order_month = EXTRACT(MONTH FROM CURRENT_DATE)
WHERE pop.frequency_score >= 0.2 -- Include products ordered at least 20% of the time
   OR roi.last_quantity IS NOT NULL; -- Or if it was in the last order

-- For stores with only one order, duplicate their last order as prediction
WITH single_order_stores AS (
  SELECT 
    s.id as store_id,
    COUNT(DISTINCT hi.id) as order_count
  FROM stores s
  LEFT JOIN historical_invoices hi ON s.id = hi.store_id
  GROUP BY s.id
  HAVING COUNT(DISTINCT hi.id) = 1
),
last_order_items AS (
  SELECT 
    hi.store_id,
    hi.id as invoice_id,
    hi.total_amount,
    hi.invoice_date
  FROM historical_invoices hi
  JOIN single_order_stores sos ON hi.store_id = sos.store_id
),
duplicate_predictions AS (
  INSERT INTO predicted_orders (
    store_id, 
    predicted_date, 
    confidence, 
    priority, 
    status, 
    total_amount,
    ai_recommendation,
    prediction_model
  )
  SELECT 
    loi.store_id,
    CURRENT_DATE + INTERVAL '14 days' as predicted_date,
    0.35 as confidence,
    'medium' as priority,
    'pending' as status,
    loi.total_amount,
    'Based on single historical order. Duplicating last order as baseline prediction.',
    'last_order_duplicate_v1'
  FROM last_order_items loi
  WHERE NOT EXISTS (
    SELECT 1 FROM predicted_orders po WHERE po.store_id = loi.store_id
  )
  RETURNING id, store_id
)
INSERT INTO predicted_order_items (
  predicted_order_id,
  product_id,
  product_name,
  predicted_quantity,
  confidence,
  unit_price,
  total_price
)
SELECT 
  dp.id,
  ii.product_id,
  p.name,
  ii.quantity,
  0.35,
  ii.unit_price,
  ii.quantity * ii.unit_price
FROM duplicate_predictions dp
JOIN last_order_items loi ON dp.store_id = loi.store_id
JOIN invoice_items ii ON loi.invoice_id = ii.invoice_id
LEFT JOIN products p ON ii.product_id = p.id;

-- Summary
SELECT 
  'Predictions Generated' as status,
  COUNT(DISTINCT store_id) as stores_with_predictions,
  COUNT(*) as total_predictions,
  AVG(confidence)::NUMERIC(5,2) as avg_confidence,
  COUNT(DISTINCT CASE WHEN priority = 'high' THEN store_id END) as high_priority_stores
FROM predicted_orders
WHERE status = 'pending';