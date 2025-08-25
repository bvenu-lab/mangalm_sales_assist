-- Create a view for all known products from order history
-- This serves as the source of truth for what products can be predicted

-- Drop existing view if it exists
DROP VIEW IF EXISTS known_products CASCADE;

-- Create view of all products that have been ordered
CREATE VIEW known_products AS
WITH all_products AS (
  -- Extract products from orders table (new system)
  SELECT DISTINCT 
    COALESCE(item->>'product_name', item->>'productName') as product_name,
    COALESCE(item->>'product_code', item->>'productCode') as product_code,
    item->>'unit' as unit,
    CAST(COALESCE(item->>'unitPrice', item->>'unit_price', '0') AS DECIMAL(10,2)) as unit_price,
    'orders' as source,
    MAX(created_at) as last_seen
  FROM orders,
  LATERAL jsonb_array_elements(items) AS item
  WHERE items IS NOT NULL
    AND COALESCE(item->>'product_name', item->>'productName') IS NOT NULL
  GROUP BY 1, 2, 3, 4, 5
  
  UNION ALL
  
  -- Extract products from historical invoices via products table
  SELECT DISTINCT
    p.name as product_name,
    p.sku as product_code,
    NULL::TEXT as unit,
    ii.unit_price,
    'historical_invoices' as source,
    MAX(hi.invoice_date) as last_seen
  FROM invoice_items ii
  JOIN historical_invoices hi ON ii.invoice_id = hi.id
  JOIN products p ON ii.product_id = p.id
  WHERE p.name IS NOT NULL
  GROUP BY 1, 2, 3, 4, 5
  
  UNION ALL
  
  -- Include all products from products master table
  SELECT DISTINCT
    p.name as product_name,
    p.sku as product_code,
    NULL::TEXT as unit,
    p.price as unit_price,
    'products_master' as source,
    p.created_at as last_seen
  FROM products p
  WHERE p.name IS NOT NULL
  
  UNION ALL
  
  -- Extract products from extracted_orders (document processing)
  SELECT DISTINCT
    item->>'productName' as product_name,
    item->>'productCode' as product_code,
    item->>'unit' as unit,
    CAST(COALESCE(item->>'unitPrice', '0') AS DECIMAL(10,2)) as unit_price,
    'extracted_orders' as source,
    MAX(created_at) as last_seen
  FROM extracted_orders,
  LATERAL jsonb_array_elements(extracted_data->'items') AS item
  WHERE extracted_data->'items' IS NOT NULL
    AND item->>'productName' IS NOT NULL
  GROUP BY 1, 2, 3, 4, 5
)
SELECT 
  product_name,
  product_code,
  unit,
  MAX(unit_price) as latest_unit_price,
  STRING_AGG(DISTINCT source, ', ' ORDER BY source) as sources,
  MAX(last_seen) as last_ordered_date,
  COUNT(DISTINCT source) as source_count
FROM all_products
GROUP BY product_name, product_code, unit;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_items_gin ON orders USING gin(items);

-- Create function to validate if a product exists in order history
CREATE OR REPLACE FUNCTION is_valid_product(p_product_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM known_products 
    WHERE LOWER(product_name) = LOWER(p_product_name)
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to get unknown products from a prediction
CREATE OR REPLACE FUNCTION get_unknown_products(p_items JSONB)
RETURNS TABLE(
  product_name TEXT,
  quantity DECIMAL,
  is_unknown BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(item->>'product_name', item->>'productName')::TEXT as product_name,
    CAST(COALESCE(item->>'quantity', '0') AS DECIMAL) as quantity,
    NOT is_valid_product(COALESCE(item->>'product_name', item->>'productName')) as is_unknown
  FROM jsonb_array_elements(p_items) AS item;
END;
$$ LANGUAGE plpgsql;

-- Create alerts table for out-of-stock/unknown products
CREATE TABLE IF NOT EXISTS product_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL, -- 'unknown_product', 'out_of_stock', 'new_product'
  product_name TEXT NOT NULL,
  source_type VARCHAR(50), -- 'prediction', 'order_upload', 'manual_entry'
  source_id UUID, -- Reference to predicted_order, order, etc.
  quantity_requested DECIMAL(10,2),
  alert_message TEXT,
  severity VARCHAR(20) DEFAULT 'warning', -- 'info', 'warning', 'error', 'critical'
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) DEFAULT 'system'
);

-- Create trigger to validate predicted orders
CREATE OR REPLACE FUNCTION validate_predicted_order_products()
RETURNS TRIGGER AS $$
DECLARE
  v_unknown_products RECORD;
  v_alert_message TEXT;
BEGIN
  -- Check for unknown products in the predicted order
  FOR v_unknown_products IN 
    SELECT * FROM get_unknown_products(NEW.items)
    WHERE is_unknown = TRUE
  LOOP
    -- Create alert for unknown product
    v_alert_message := FORMAT(
      'Unknown product "%s" predicted for store %s. Quantity: %s. This product has never been ordered before.',
      v_unknown_products.product_name,
      NEW.store_id,
      v_unknown_products.quantity
    );
    
    INSERT INTO product_alerts (
      alert_type,
      product_name,
      source_type,
      source_id,
      quantity_requested,
      alert_message,
      severity
    ) VALUES (
      'unknown_product',
      v_unknown_products.product_name,
      'prediction',
      NEW.id,
      v_unknown_products.quantity,
      v_alert_message,
      'warning'
    );
    
    -- Optionally, you could reject the prediction or mark it as requiring review
    -- For now, we'll allow it but flag it
    NEW.manual_verification_required := TRUE;
    NEW.notes := COALESCE(NEW.notes || E'\n', '') || 
                 'Contains unknown products: ' || v_unknown_products.product_name;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on predicted_orders
DROP TRIGGER IF EXISTS validate_predicted_products ON predicted_orders;
CREATE TRIGGER validate_predicted_products
  BEFORE INSERT OR UPDATE ON predicted_orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_predicted_order_products();

-- Create function to validate order uploads
CREATE OR REPLACE FUNCTION validate_order_products()
RETURNS TRIGGER AS $$
DECLARE
  v_unknown_products RECORD;
  v_alert_message TEXT;
  v_has_unknown BOOLEAN := FALSE;
BEGIN
  -- Check for unknown products in the order
  FOR v_unknown_products IN 
    SELECT * FROM get_unknown_products(NEW.items)
    WHERE is_unknown = TRUE
  LOOP
    v_has_unknown := TRUE;
    
    -- Create alert for unknown product
    v_alert_message := FORMAT(
      'New product "%s" detected in order %s. This product has not been ordered before and may need to be added to inventory.',
      v_unknown_products.product_name,
      NEW.order_number
    );
    
    INSERT INTO product_alerts (
      alert_type,
      product_name,
      source_type,
      source_id,
      quantity_requested,
      alert_message,
      severity
    ) VALUES (
      'new_product',
      v_unknown_products.product_name,
      'order_upload',
      NEW.id,
      v_unknown_products.quantity,
      v_alert_message,
      'info'  -- Less severe for actual orders, just informational
    );
  END LOOP;
  
  -- Mark order for review if it contains unknown products
  IF v_has_unknown THEN
    NEW.manual_verification_required := TRUE;
    NEW.notes := COALESCE(NEW.notes || E'\n', '') || 'Contains new products not in product catalog';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS validate_order_products_trigger ON orders;
CREATE TRIGGER validate_order_products_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_products();

-- Create summary view for product alerts dashboard
CREATE OR REPLACE VIEW product_alerts_summary AS
SELECT 
  alert_type,
  severity,
  COUNT(*) as alert_count,
  COUNT(CASE WHEN is_resolved = FALSE THEN 1 END) as unresolved_count,
  MAX(created_at) as latest_alert,
  STRING_AGG(DISTINCT product_name, ', ' ORDER BY product_name) 
    FILTER (WHERE is_resolved = FALSE) as unresolved_products
FROM product_alerts
WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY alert_type, severity;

-- Create function to get product catalog with availability status
CREATE OR REPLACE FUNCTION get_product_catalog()
RETURNS TABLE(
  product_name TEXT,
  product_code TEXT,
  unit TEXT,
  latest_price DECIMAL,
  last_ordered DATE,
  days_since_order INTEGER,
  order_frequency TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kp.product_name,
    kp.product_code,
    kp.unit,
    kp.latest_unit_price,
    kp.last_ordered_date::DATE,
    EXTRACT(DAY FROM NOW() - kp.last_ordered_date)::INTEGER as days_since_order,
    CASE 
      WHEN EXTRACT(DAY FROM NOW() - kp.last_ordered_date) < 7 THEN 'Very Active'
      WHEN EXTRACT(DAY FROM NOW() - kp.last_ordered_date) < 30 THEN 'Active'
      WHEN EXTRACT(DAY FROM NOW() - kp.last_ordered_date) < 90 THEN 'Moderate'
      ELSE 'Inactive'
    END as order_frequency,
    CASE 
      WHEN EXTRACT(DAY FROM NOW() - kp.last_ordered_date) > 180 THEN 'Possibly Discontinued'
      WHEN kp.source_count > 1 THEN 'Available'
      ELSE 'Limited Availability'
    END as status
  FROM known_products kp
  ORDER BY kp.last_ordered_date DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the system
COMMENT ON VIEW known_products IS 'Master list of all products that have been ordered at least once. Used to validate predictions and identify new/unknown products.';
COMMENT ON TABLE product_alerts IS 'Alerts for unknown products in predictions or new products in orders that need inventory management attention.';
COMMENT ON FUNCTION is_valid_product IS 'Check if a product name exists in order history';
COMMENT ON FUNCTION get_unknown_products IS 'Extract unknown products from a JSON array of items';