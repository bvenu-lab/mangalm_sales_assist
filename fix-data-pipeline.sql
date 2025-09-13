-- Fix Data Pipeline: Convert Invoices to Orders
-- This script migrates invoice data to the orders table

-- First, check if we have data to migrate
SELECT 'Current Status:' as info;
SELECT 
  (SELECT COUNT(*) FROM mangalam_invoices) as total_invoices,
  (SELECT COUNT(*) FROM invoice_items) as total_invoice_items,
  (SELECT COUNT(*) FROM orders) as current_orders;

-- Create orders from invoices grouped by invoice_id and customer
INSERT INTO orders (
  order_number,
  store_id,
  customer_name,
  customer_phone,
  customer_email,
  items,
  item_count,
  total_quantity,
  subtotal_amount,
  tax_amount,
  total_amount,
  status,
  source,
  order_date,
  delivery_date,
  payment_status,
  created_at,
  notes
)
SELECT 
  COALESCE(mi.invoice_number, mi.invoice_id, 'INV-' || mi.id::text) as order_number,
  COALESCE(
    -- Try to match customer name to a store
    (SELECT id::text FROM stores WHERE LOWER(name) LIKE '%' || LOWER(SPLIT_PART(mi.customer_name, ' ', 1)) || '%' LIMIT 1),
    -- Default to first store if no match
    (SELECT id::text FROM stores LIMIT 1),
    '4261931000000665698'
  ) as store_id,
  mi.customer_name,
  '555-0000' as customer_phone, -- Default phone
  LOWER(REPLACE(COALESCE(mi.customer_name, 'customer'), ' ', '.')) || '@example.com' as customer_email,
  json_build_array(
    json_build_object(
      'product_id', mi.product_id,
      'name', mi.item_name,
      'sku', mi.sku,
      'brand', mi.brand,
      'category', mi.category_name,
      'quantity', mi.quantity,
      'unit_price', mi.rate,
      'total', mi.amount
    )
  ) as items,
  1 as item_count,
  COALESCE(mi.quantity, 1) as total_quantity,
  COALESCE(mi.amount, 0) as subtotal_amount,
  COALESCE(mi.cgst_amount + mi.sgst_amount + mi.igst_amount, 0) as tax_amount,
  COALESCE(mi.amount + mi.cgst_amount + mi.sgst_amount + mi.igst_amount, mi.amount, 0) as total_amount,
  CASE 
    WHEN mi.invoice_status = 'Paid' THEN 'delivered'
    WHEN mi.invoice_status = 'Overdue' THEN 'pending_review'
    ELSE 'confirmed'
  END as status,
  'invoice_migration' as source,
  COALESCE(mi.invoice_date, CURRENT_DATE) as order_date,
  COALESCE(mi.due_date, mi.invoice_date + INTERVAL '7 days', CURRENT_DATE + INTERVAL '7 days') as delivery_date,
  CASE 
    WHEN mi.invoice_status = 'Paid' THEN 'paid'
    WHEN mi.invoice_status = 'Overdue' THEN 'overdue'
    ELSE 'pending'
  END as payment_status,
  COALESCE(mi.created_at, NOW()) as created_at,
  'Migrated from invoice ID: ' || mi.invoice_id || ' | Status: ' || COALESCE(mi.invoice_status, 'Unknown') as notes
FROM mangalam_invoices mi
WHERE NOT EXISTS (
  -- Don't create duplicate orders
  SELECT 1 FROM orders o 
  WHERE o.order_number = mi.invoice_number 
     OR o.order_number = mi.invoice_id
     OR o.notes LIKE '%' || mi.invoice_id || '%'
)
LIMIT 1000; -- Process in batches to avoid overwhelming the system

-- Verify migration results
SELECT 'Migration Results:' as info;
SELECT 
  (SELECT COUNT(*) FROM orders WHERE source = 'invoice_migration') as migrated_orders,
  (SELECT COUNT(*) FROM orders) as total_orders;

-- Show sample of migrated orders
SELECT 'Sample Migrated Orders:' as info;
SELECT 
  id,
  order_number,
  store_id,
  customer_name,
  total_amount,
  status,
  order_date
FROM orders 
WHERE source = 'invoice_migration'
ORDER BY created_at DESC
LIMIT 5;