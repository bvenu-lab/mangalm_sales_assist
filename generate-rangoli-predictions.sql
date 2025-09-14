-- Generate predictions for Rangoli Sweets with graceful degradation
-- This script analyzes historical orders and creates predictions based on available data

WITH store_order_analysis AS (
  -- Analyze historical order patterns
  SELECT
    store_id,
    COUNT(*) as total_orders,
    AVG(total_amount) as avg_order_amount,
    STDDEV(total_amount) as stddev_amount,
    MAX(order_date) as last_order_date,
    MIN(order_date) as first_order_date,
    EXTRACT(EPOCH FROM (MAX(order_date) - MIN(order_date))) / 86400 / NULLIF(COUNT(*) - 1, 0) as avg_days_between_orders,
    -- Calculate monthly averages
    COUNT(DISTINCT DATE_TRUNC('month', order_date)) as months_with_data,
    SUM(total_amount) / NULLIF(COUNT(DISTINCT DATE_TRUNC('month', order_date)), 0) as avg_monthly_revenue
  FROM orders
  WHERE store_id = '4261931000000092001'
  GROUP BY store_id
),
monthly_breakdown AS (
  -- Get month-by-month breakdown
  SELECT
    store_id,
    DATE_TRUNC('month', order_date) as month,
    COUNT(*) as orders_count,
    SUM(total_amount) as month_total,
    AVG(total_amount) as month_avg
  FROM orders
  WHERE store_id = '4261931000000092001'
  GROUP BY store_id, DATE_TRUNC('month', order_date)
),
last_3_months AS (
  -- Focus on last 3 months for trend
  SELECT
    store_id,
    AVG(month_total) as recent_avg_monthly,
    AVG(orders_count) as recent_avg_orders,
    MAX(month_total) as recent_max,
    MIN(month_total) as recent_min
  FROM monthly_breakdown
  WHERE month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
  GROUP BY store_id
),
prediction_base AS (
  SELECT
    soa.store_id,
    -- Use graceful degradation for prediction amount
    CASE
      -- If we have 3+ months, use recent trend
      WHEN soa.months_with_data >= 3 AND l3m.recent_avg_monthly IS NOT NULL
        THEN l3m.recent_avg_monthly * 1.05  -- 5% growth assumption
      -- If we have 2 months, use average
      WHEN soa.months_with_data >= 2
        THEN soa.avg_monthly_revenue
      -- If we have 1 month, use that month's data
      WHEN soa.months_with_data = 1
        THEN soa.avg_order_amount * GREATEST(2, soa.total_orders)
      -- Fallback to last known order
      ELSE soa.avg_order_amount * 3
    END as predicted_amount,
    -- Calculate confidence based on data availability
    CASE
      WHEN soa.months_with_data >= 6 THEN 0.85
      WHEN soa.months_with_data >= 3 THEN 0.70
      WHEN soa.months_with_data >= 2 THEN 0.55
      WHEN soa.months_with_data >= 1 THEN 0.40
      ELSE 0.25
    END as confidence_score,
    -- Prediction justification
    CASE
      WHEN soa.months_with_data >= 3 THEN 'Based on ' || soa.months_with_data || ' months of historical data with trend analysis'
      WHEN soa.months_with_data >= 2 THEN 'Based on ' || soa.months_with_data || ' months of average performance'
      WHEN soa.months_with_data = 1 THEN 'Limited data - based on single month performance'
      ELSE 'Minimal data - estimated based on ' || soa.total_orders || ' historical orders'
    END as justification,
    soa.last_order_date,
    soa.avg_days_between_orders,
    soa.months_with_data,
    soa.total_orders,
    l3m.recent_avg_orders
  FROM store_order_analysis soa
  LEFT JOIN last_3_months l3m ON soa.store_id = l3m.store_id
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
  gen_random_uuid() as id,
  store_id,
  DATE_TRUNC('month', CURRENT_DATE + (interval '1 month' * generate_series(1, 3))) as prediction_date,
  predicted_amount *
    CASE generate_series(1, 3)
      WHEN 1 THEN 1.00  -- Next month
      WHEN 2 THEN 1.02  -- Month 2 with slight growth
      WHEN 3 THEN 1.04  -- Month 3 with continued growth
    END as total_amount,
  confidence_score *
    CASE generate_series(1, 3)
      WHEN 1 THEN 1.00  -- Full confidence for next month
      WHEN 2 THEN 0.90  -- Slightly less for month 2
      WHEN 3 THEN 0.80  -- Even less for month 3
    END as confidence,
  CASE
    WHEN confidence_score >= 0.70 THEN 'high'
    WHEN confidence_score >= 0.50 THEN 'medium'
    ELSE 'low'
  END::varchar(20) as priority,
  'graceful_degradation' as prediction_model,
  justification || ' (Month ' || generate_series(1, 3) || ' prediction)' as justification,
  NOW() as created_at,
  NOW() as updated_at
FROM prediction_base
WHERE NOT EXISTS (
  -- Don't create duplicate predictions
  SELECT 1 FROM predicted_orders po
  WHERE po.store_id = prediction_base.store_id
    AND DATE_TRUNC('month', po.predicted_date) = DATE_TRUNC('month', CURRENT_DATE + (interval '1 month' * generate_series(1, 3)))
);

-- Show what was created
SELECT
  store_id,
  predicted_date,
  total_amount,
  confidence,
  justification
FROM predicted_orders
WHERE store_id = '4261931000000092001'
ORDER BY predicted_date;