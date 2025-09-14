-- Generate predictions for ALL stores with at least 1 order
-- Uses graceful degradation based on available data

-- First, migrate any remaining invoice data to orders for stores that don't have orders
WITH invoice_to_orders AS (
  SELECT
    s.id as store_id,
    mi.invoice_number,
    mi.invoice_date,
    SUM(mi.total) as invoice_total,
    MAX(mi.created_at) as created_at
  FROM stores s
  JOIN mangalam_invoices mi ON LOWER(TRIM(s.name)) = LOWER(TRIM(mi.customer_name))
  LEFT JOIN orders o ON s.id = o.store_id
  WHERE o.id IS NULL  -- Only for stores with no orders
  GROUP BY s.id, mi.invoice_number, mi.invoice_date
)
INSERT INTO orders (id, store_id, order_date, total_amount, status, customer_name, created_at)
SELECT
  gen_random_uuid(),
  store_id,
  invoice_date,
  invoice_total,
  'Completed',
  (SELECT name FROM stores WHERE id = store_id),
  COALESCE(created_at, invoice_date)
FROM invoice_to_orders
ON CONFLICT DO NOTHING;

-- Now generate predictions for all stores with orders
WITH store_analysis AS (
  SELECT
    s.id as store_id,
    s.name as store_name,
    COUNT(o.id) as order_count,
    AVG(o.total_amount) as avg_amount,
    STDDEV(o.total_amount) as stddev_amount,
    MIN(o.total_amount) as min_amount,
    MAX(o.total_amount) as max_amount,
    COUNT(DISTINCT DATE_TRUNC('month', o.order_date)) as months_count,
    MAX(o.order_date) as last_order_date,
    MIN(o.order_date) as first_order_date,
    -- Calculate monthly average
    SUM(o.total_amount) / NULLIF(COUNT(DISTINCT DATE_TRUNC('month', o.order_date)), 0) as monthly_avg,
    -- Days since last order
    EXTRACT(EPOCH FROM (CURRENT_DATE - MAX(o.order_date))) / 86400 as days_since_last
  FROM stores s
  LEFT JOIN orders o ON s.id = o.store_id
  WHERE o.id IS NOT NULL  -- Only stores with at least 1 order
  GROUP BY s.id, s.name
),
recent_trend AS (
  -- Calculate recent trend for stores with 3+ months of data
  SELECT
    store_id,
    AVG(month_total) as recent_avg,
    -- Simple linear regression slope
    CASE
      WHEN COUNT(*) >= 2 THEN
        (SUM((month_num - avg_month) * (month_total - avg_total)) /
         NULLIF(SUM((month_num - avg_month) * (month_num - avg_month)), 0))
      ELSE 0
    END as trend_slope
  FROM (
    SELECT
      o.store_id,
      DATE_TRUNC('month', o.order_date) as month,
      SUM(o.total_amount) as month_total,
      ROW_NUMBER() OVER (PARTITION BY o.store_id ORDER BY DATE_TRUNC('month', o.order_date)) as month_num,
      AVG(SUM(o.total_amount)) OVER (PARTITION BY o.store_id) as avg_total,
      AVG(ROW_NUMBER() OVER (PARTITION BY o.store_id ORDER BY DATE_TRUNC('month', o.order_date)))
        OVER (PARTITION BY o.store_id) as avg_month
    FROM orders o
    WHERE o.order_date >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY o.store_id, DATE_TRUNC('month', o.order_date)
  ) monthly_data
  GROUP BY store_id
),
prediction_calc AS (
  SELECT
    sa.store_id,
    sa.store_name,
    sa.order_count,
    sa.months_count,
    sa.avg_amount,
    sa.monthly_avg,
    COALESCE(rt.recent_avg, sa.monthly_avg, sa.avg_amount) as base_amount,
    COALESCE(rt.trend_slope, 0) as trend,
    -- Calculate predicted amount based on data availability
    CASE
      -- 6+ months: Use trend analysis
      WHEN sa.months_count >= 6 AND rt.trend_slope IS NOT NULL THEN
        GREATEST(
          sa.min_amount * 0.5,  -- Never predict less than 50% of minimum
          LEAST(
            sa.max_amount * 2,   -- Never predict more than 2x maximum
            COALESCE(rt.recent_avg, sa.monthly_avg) * (1 + LEAST(0.1, GREATEST(-0.1, rt.trend_slope * 0.01)))
          )
        )
      -- 3-5 months: Use average with small growth
      WHEN sa.months_count >= 3 THEN
        sa.monthly_avg * 1.02
      -- 2 months: Use average
      WHEN sa.months_count = 2 THEN
        sa.monthly_avg
      -- 1 month: Use that month's data
      WHEN sa.months_count = 1 AND sa.order_count > 1 THEN
        sa.avg_amount * sa.order_count  -- Monthly estimate
      -- Single order: Conservative estimate
      ELSE
        sa.avg_amount * 1.5
    END as base_prediction,
    -- Calculate confidence based on data quality
    CASE
      WHEN sa.months_count >= 12 THEN 0.90
      WHEN sa.months_count >= 6 THEN 0.80
      WHEN sa.months_count >= 3 THEN 0.65
      WHEN sa.months_count >= 2 THEN 0.50
      WHEN sa.order_count >= 3 THEN 0.40
      WHEN sa.order_count >= 2 THEN 0.30
      ELSE 0.25
    END as base_confidence,
    -- Generate justification
    'Based on ' || sa.order_count || ' order(s) across ' || sa.months_count || ' month(s). ' ||
    CASE
      WHEN sa.months_count >= 6 THEN 'Trend analysis applied with ' ||
        CASE
          WHEN rt.trend_slope > 0.05 THEN 'positive growth trend.'
          WHEN rt.trend_slope < -0.05 THEN 'declining trend.'
          ELSE 'stable trend.'
        END
      WHEN sa.months_count >= 3 THEN 'Using historical average with modest growth projection.'
      WHEN sa.months_count = 2 THEN 'Limited data - using two-month average.'
      WHEN sa.months_count = 1 THEN 'Single month baseline - conservative estimate.'
      ELSE 'Minimal data - highly conservative estimate.'
    END as justification
  FROM store_analysis sa
  LEFT JOIN recent_trend rt ON sa.store_id = rt.store_id
)
-- Insert predictions for next 3 months
INSERT INTO predicted_orders (
  id,
  store_id,
  predicted_date,
  total_amount,
  confidence,
  priority,
  prediction_model,
  justification,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  store_id,
  DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month' * month_num)::date,
  -- Apply diminishing growth for future months
  ROUND(base_prediction *
    CASE month_num
      WHEN 1 THEN 1.00
      WHEN 2 THEN 1.01  -- 1% growth month 2
      WHEN 3 THEN 1.02  -- 2% growth month 3
    END, 2),
  -- Reduce confidence for future months
  LEAST(0.99, GREATEST(0.10, base_confidence *
    CASE month_num
      WHEN 1 THEN 1.00
      WHEN 2 THEN 0.90
      WHEN 3 THEN 0.80
    END)),
  -- Set priority based on confidence
  CASE
    WHEN base_confidence >= 0.65 THEN 'high'
    WHEN base_confidence >= 0.40 THEN 'medium'
    ELSE 'low'
  END::varchar(20),
  'graceful_degradation_v2',
  justification || ' (Month ' || month_num || ' prediction)',
  NOW(),
  NOW()
FROM prediction_calc
CROSS JOIN generate_series(1, 3) AS month_num
WHERE NOT EXISTS (
  -- Don't create duplicate predictions
  SELECT 1 FROM predicted_orders po
  WHERE po.store_id = prediction_calc.store_id
    AND DATE_TRUNC('month', po.predicted_date) = DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month' * month_num)
)
ORDER BY store_name, month_num;

-- Summary of what was created
SELECT
  'Predictions generated for ' || COUNT(DISTINCT store_id) || ' stores' as summary,
  COUNT(*) as total_predictions,
  AVG(confidence)::numeric(3,2) as avg_confidence,
  COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
  COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
  COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority
FROM predicted_orders
WHERE prediction_model = 'graceful_degradation_v2';