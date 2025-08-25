-- Fix product validation to handle empty-start scenario
-- The system should allow predictions when catalog is empty, then revalidate as catalog grows

-- Drop the strict validation triggers first
DROP TRIGGER IF EXISTS validate_predicted_products ON predicted_orders;
DROP TRIGGER IF EXISTS validate_order_products_trigger ON orders;

-- Add a system configuration table to control validation behavior
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO system_config (key, value, description) VALUES 
  ('product_validation_mode', 'learning', 'learning = accept new products, strict = only known products, off = no validation'),
  ('min_products_for_strict_mode', '20', 'Minimum number of known products before enabling strict validation'),
  ('auto_learn_from_orders', 'true', 'Automatically add products from confirmed orders to known catalog')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Modify the product alerts table to include learning status
ALTER TABLE product_alerts 
ADD COLUMN IF NOT EXISTS is_learned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS learned_from_order_id UUID,
ADD COLUMN IF NOT EXISTS learned_at TIMESTAMP;

-- Create a function to check validation mode
CREATE OR REPLACE FUNCTION get_validation_mode()
RETURNS TEXT AS $$
DECLARE
  v_mode TEXT;
  v_product_count INTEGER;
  v_min_products INTEGER;
BEGIN
  -- Get current mode setting
  SELECT value INTO v_mode FROM system_config WHERE key = 'product_validation_mode';
  
  -- If in learning mode, check if we should auto-switch to strict
  IF v_mode = 'learning' THEN
    SELECT COUNT(*) INTO v_product_count FROM known_products;
    SELECT value::INTEGER INTO v_min_products FROM system_config WHERE key = 'min_products_for_strict_mode';
    
    -- Don't auto-switch if we have too few products
    IF v_product_count < COALESCE(v_min_products, 20) THEN
      RETURN 'learning';
    END IF;
  END IF;
  
  RETURN COALESCE(v_mode, 'learning');
END;
$$ LANGUAGE plpgsql;

-- Modified validation function that respects the mode
CREATE OR REPLACE FUNCTION validate_predicted_order_products()
RETURNS TRIGGER AS $$
DECLARE
  v_validation_mode TEXT;
  v_unknown_products RECORD;
  v_alert_message TEXT;
  v_severity TEXT;
BEGIN
  -- Get current validation mode
  v_validation_mode := get_validation_mode();
  
  -- Skip validation if turned off
  IF v_validation_mode = 'off' THEN
    RETURN NEW;
  END IF;
  
  -- Check for unknown products
  FOR v_unknown_products IN 
    SELECT * FROM get_unknown_products(NEW.items)
    WHERE is_unknown = TRUE
  LOOP
    -- Determine severity based on mode
    IF v_validation_mode = 'strict' THEN
      v_severity := 'warning';
      NEW.manual_verification_required := TRUE;
    ELSE -- learning mode
      v_severity := 'info';
      -- Don't require manual verification in learning mode
    END IF;
    
    v_alert_message := FORMAT(
      'Product "%s" in prediction for store %s. Quantity: %s. Mode: %s',
      v_unknown_products.product_name,
      NEW.store_id,
      v_unknown_products.quantity,
      v_validation_mode
    );
    
    -- Create alert
    INSERT INTO product_alerts (
      alert_type,
      product_name,
      source_type,
      source_id,
      quantity_requested,
      alert_message,
      severity
    ) VALUES (
      CASE 
        WHEN v_validation_mode = 'learning' THEN 'new_product_learning'
        ELSE 'unknown_product'
      END,
      v_unknown_products.product_name,
      'prediction',
      NEW.id,
      v_unknown_products.quantity,
      v_alert_message,
      v_severity
    );
    
    -- Add note about validation status
    NEW.notes := COALESCE(NEW.notes || E'\n', '') || 
                 FORMAT('Validation (%s mode): Product "%s" - %s', 
                        v_validation_mode,
                        v_unknown_products.product_name,
                        CASE WHEN v_validation_mode = 'learning' THEN 'accepted for learning' 
                             ELSE 'requires verification' END);
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to learn from confirmed orders
CREATE OR REPLACE FUNCTION learn_products_from_order(p_order_id UUID)
RETURNS TABLE(
  product_name TEXT,
  was_unknown BOOLEAN,
  is_learned BOOLEAN
) AS $$
DECLARE
  v_auto_learn BOOLEAN;
BEGIN
  -- Check if auto-learning is enabled
  SELECT value::BOOLEAN INTO v_auto_learn 
  FROM system_config 
  WHERE key = 'auto_learn_from_orders';
  
  IF NOT COALESCE(v_auto_learn, TRUE) THEN
    RETURN;
  END IF;
  
  -- Mark alerts as learned for products in this order
  UPDATE product_alerts pa
  SET 
    is_learned = TRUE,
    learned_from_order_id = p_order_id,
    learned_at = CURRENT_TIMESTAMP,
    is_resolved = TRUE,
    resolved_at = CURRENT_TIMESTAMP,
    resolved_by = 'auto-learning',
    resolution_notes = 'Product learned from confirmed order'
  FROM orders o
  WHERE o.id = p_order_id
    AND pa.product_name IN (
      SELECT DISTINCT COALESCE(item->>'product_name', item->>'productName')
      FROM jsonb_array_elements(o.items) AS item
    )
    AND pa.is_learned = FALSE
    AND pa.alert_type IN ('new_product_learning', 'unknown_product', 'new_product');
  
  -- Return learned products
  RETURN QUERY
  SELECT DISTINCT
    COALESCE(item->>'product_name', item->>'productName')::TEXT as product_name,
    NOT is_valid_product(COALESCE(item->>'product_name', item->>'productName')) as was_unknown,
    TRUE as is_learned
  FROM orders o, jsonb_array_elements(o.items) AS item
  WHERE o.id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to revalidate all predictions
CREATE OR REPLACE FUNCTION revalidate_all_predictions()
RETURNS TABLE(
  prediction_id UUID,
  store_id VARCHAR,
  products_validated INTEGER,
  unknown_products INTEGER,
  status TEXT
) AS $$
DECLARE
  v_prediction RECORD;
  v_unknown_count INTEGER;
  v_total_count INTEGER;
BEGIN
  -- Clear old validation alerts
  DELETE FROM product_alerts 
  WHERE source_type = 'prediction' 
    AND alert_type = 'revalidation'
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 hour';
  
  -- Revalidate each prediction
  FOR v_prediction IN 
    SELECT id, store_id, items 
    FROM predicted_orders 
    WHERE status = 'pending'
  LOOP
    -- Count products
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN is_unknown THEN 1 END) as unknown
    INTO v_total_count, v_unknown_count
    FROM get_unknown_products(v_prediction.items);
    
    -- Update prediction status based on validation
    UPDATE predicted_orders
    SET 
      manual_verification_required = (v_unknown_count > 0 AND get_validation_mode() = 'strict'),
      notes = FORMAT('Revalidated: %s/%s products known', 
                     v_total_count - v_unknown_count, v_total_count)
    WHERE id = v_prediction.id;
    
    RETURN QUERY
    SELECT 
      v_prediction.id,
      v_prediction.store_id,
      v_total_count,
      v_unknown_count,
      CASE 
        WHEN v_unknown_count = 0 THEN 'valid'
        WHEN get_validation_mode() = 'learning' THEN 'learning'
        ELSE 'needs_review'
      END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order confirmation to learn products
CREATE OR REPLACE FUNCTION trigger_learn_from_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Learn products when order is confirmed
  IF NEW.status IN ('confirmed', 'delivered', 'completed') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('confirmed', 'delivered', 'completed')) THEN
    PERFORM learn_products_from_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS learn_products_on_confirmation ON orders;
CREATE TRIGGER learn_products_on_confirmation
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_learn_from_order();

-- Recreate the validation triggers with new logic
CREATE TRIGGER validate_predicted_products
  BEFORE INSERT OR UPDATE ON predicted_orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_predicted_order_products();

-- Modified order validation to be more lenient
CREATE OR REPLACE FUNCTION validate_order_products()
RETURNS TRIGGER AS $$
DECLARE
  v_validation_mode TEXT;
  v_unknown_products RECORD;
  v_alert_message TEXT;
BEGIN
  v_validation_mode := get_validation_mode();
  
  -- In learning mode or off, just track new products
  IF v_validation_mode IN ('learning', 'off') THEN
    FOR v_unknown_products IN 
      SELECT * FROM get_unknown_products(NEW.items)
      WHERE is_unknown = TRUE
    LOOP
      INSERT INTO product_alerts (
        alert_type,
        product_name,
        source_type,
        source_id,
        quantity_requested,
        alert_message,
        severity
      ) VALUES (
        'new_product_learning',
        v_unknown_products.product_name,
        'order_upload',
        NEW.id,
        v_unknown_products.quantity,
        FORMAT('New product "%s" detected in order %s (learning mode)', 
               v_unknown_products.product_name, NEW.order_number),
        'info'
      );
    END LOOP;
  ELSE -- strict mode
    -- Original validation logic
    FOR v_unknown_products IN 
      SELECT * FROM get_unknown_products(NEW.items)
      WHERE is_unknown = TRUE
    LOOP
      NEW.manual_verification_required := TRUE;
      NEW.notes := COALESCE(NEW.notes || E'\n', '') || 
                   'Contains unknown product: ' || v_unknown_products.product_name;
      
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
        'order_upload',
        NEW.id,
        v_unknown_products.quantity,
        FORMAT('Unknown product "%s" in order %s (strict mode)', 
               v_unknown_products.product_name, NEW.order_number),
        'warning'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_order_products_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_products();

-- Create view to show validation statistics
CREATE OR REPLACE VIEW validation_statistics AS
SELECT 
  (SELECT COUNT(*) FROM known_products) as known_products_count,
  (SELECT value FROM system_config WHERE key = 'product_validation_mode') as current_mode,
  (SELECT COUNT(*) FROM product_alerts WHERE is_learned = TRUE) as learned_products,
  (SELECT COUNT(*) FROM product_alerts WHERE is_resolved = FALSE) as pending_alerts,
  (SELECT COUNT(DISTINCT product_name) FROM product_alerts WHERE alert_type = 'new_product_learning') as products_in_learning,
  CASE 
    WHEN (SELECT COUNT(*) FROM known_products) >= 
         COALESCE((SELECT value::INTEGER FROM system_config WHERE key = 'min_products_for_strict_mode'), 20)
    THEN 'Ready for strict mode'
    ELSE FORMAT('Need %s more products for strict mode', 
                GREATEST(0, COALESCE((SELECT value::INTEGER FROM system_config WHERE key = 'min_products_for_strict_mode'), 20) - 
                           (SELECT COUNT(*) FROM known_products)))
  END as validation_readiness;

-- Add comments
COMMENT ON TABLE system_config IS 'System configuration for product validation behavior';
COMMENT ON FUNCTION get_validation_mode IS 'Returns current validation mode based on config and product count';
COMMENT ON FUNCTION learn_products_from_order IS 'Learns new products from confirmed orders';
COMMENT ON FUNCTION revalidate_all_predictions IS 'Revalidates all pending predictions against current catalog';
COMMENT ON VIEW validation_statistics IS 'Dashboard view for validation system status';