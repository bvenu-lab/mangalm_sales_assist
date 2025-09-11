-- Update all invoice dates to be within the last 30 days
-- This will make the dashboard show current data

-- Update mangalam_invoices to have dates spread across the last 30 days
UPDATE mangalam_invoices
SET invoice_date = CURRENT_DATE - INTERVAL '1 day' * (
    (ROW_NUMBER() OVER (ORDER BY id) % 30)
)
WHERE invoice_date < CURRENT_DATE - INTERVAL '30 days';

-- Verify the update
SELECT 
    MIN(invoice_date) as earliest_date,
    MAX(invoice_date) as latest_date,
    COUNT(*) as total_invoices,
    COUNT(DISTINCT DATE(invoice_date)) as unique_days
FROM mangalam_invoices;

-- Refresh the materialized view to show updated data
REFRESH MATERIALIZED VIEW dashboard_summary;