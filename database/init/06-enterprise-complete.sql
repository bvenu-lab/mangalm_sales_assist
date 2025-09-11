-- ================================================================
-- TRULY ENTERPRISE-GRADE COMPLETE SYSTEM
-- All tables, triggers, and automatic population
-- ================================================================

-- Drop all tables to start fresh
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS upselling_recommendations CASCADE;
DROP TABLE IF EXISTS product_associations CASCADE;
DROP TABLE IF EXISTS customer_segments CASCADE;
DROP TABLE IF EXISTS realtime_sync_queue CASCADE;

-- 1. INVOICE ITEMS - Required for upselling algorithm
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id VARCHAR(255) NOT NULL,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2),
    total_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON invoice_items(product_id);

-- 2. UPSELLING RECOMMENDATIONS - Store all recommendations
CREATE TABLE upselling_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID,
    store_id VARCHAR(255) REFERENCES stores(id),
    product_id UUID REFERENCES products(id),
    recommendation_type VARCHAR(50), -- 'cross_sell', 'upsell', 'bundle', 'substitute'
    confidence DECIMAL(3, 2),
    reason TEXT,
    suggested_quantity INTEGER,
    expected_revenue DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
    user_feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    accepted_at TIMESTAMP
);

CREATE INDEX idx_upsell_order ON upselling_recommendations(order_id);
CREATE INDEX idx_upsell_store ON upselling_recommendations(store_id);
CREATE INDEX idx_upsell_status ON upselling_recommendations(status);

-- 3. PRODUCT ASSOCIATIONS - Track frequently bought together
CREATE TABLE product_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_a UUID REFERENCES products(id),
    product_b UUID REFERENCES products(id),
    association_type VARCHAR(50), -- 'frequently_bought', 'substitute', 'complement'
    co_occurrence_count INTEGER DEFAULT 0,
    confidence_score DECIMAL(3, 2),
    lift_score DECIMAL(5, 2), -- Association rule mining metric
    support DECIMAL(5, 4), -- Percentage of transactions
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_a, product_b, association_type)
);

CREATE INDEX idx_assoc_product_a ON product_associations(product_a);
CREATE INDEX idx_assoc_product_b ON product_associations(product_b);

-- 4. CUSTOMER SEGMENTS - For targeted recommendations
CREATE TABLE customer_segments (
    store_id VARCHAR(255) PRIMARY KEY REFERENCES stores(id),
    segment_name VARCHAR(100),
    segment_value VARCHAR(20), -- 'high', 'medium', 'low'
    total_revenue DECIMAL(12, 2),
    order_frequency DECIMAL(5, 2), -- orders per month
    avg_order_value DECIMAL(10, 2),
    last_order_date DATE,
    churn_risk DECIMAL(3, 2), -- 0-1 probability
    preferred_categories TEXT[],
    preferred_brands TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. REALTIME SYNC QUEUE - For frontend-backend sync
CREATE TABLE realtime_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    operation VARCHAR(20), -- 'INSERT', 'UPDATE', 'DELETE'
    payload JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX idx_sync_status ON realtime_sync_queue(status);
CREATE INDEX idx_sync_created ON realtime_sync_queue(created_at);

-- Create function to populate invoice_items from mangalam_invoices
CREATE OR REPLACE FUNCTION populate_invoice_items()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into invoice_items
    INSERT INTO invoice_items (
        invoice_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price
    )
    SELECT 
        NEW.invoice_id,
        p.id,
        NEW.item_name,
        NEW.quantity,
        NEW.item_price,
        NEW.item_total
    FROM products p
    WHERE p.name = NEW.item_name
    ON CONFLICT DO NOTHING;
    
    -- Add to sync queue for frontend update
    INSERT INTO realtime_sync_queue (
        entity_type,
        entity_id,
        operation,
        payload
    ) VALUES (
        'invoice',
        NEW.invoice_id,
        'INSERT',
        row_to_json(NEW)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-populate invoice_items
CREATE TRIGGER auto_populate_invoice_items
AFTER INSERT ON mangalam_invoices
FOR EACH ROW
EXECUTE FUNCTION populate_invoice_items();

-- Function to generate upselling recommendations
CREATE OR REPLACE FUNCTION generate_upselling_recommendations()
RETURNS TRIGGER AS $$
DECLARE
    rec RECORD;
BEGIN
    -- Generate recommendations based on order
    FOR rec IN 
        SELECT 
            pa.product_b as recommended_product,
            pa.confidence_score,
            pa.association_type,
            p.price
        FROM predicted_order_items poi
        JOIN product_associations pa ON poi.product_id = pa.product_a
        JOIN products p ON pa.product_b = p.id
        WHERE poi.predicted_order_id = NEW.id
        AND pa.confidence_score > 0.5
        LIMIT 5
    LOOP
        INSERT INTO upselling_recommendations (
            order_id,
            store_id,
            product_id,
            recommendation_type,
            confidence,
            reason,
            suggested_quantity,
            expected_revenue,
            expires_at
        ) VALUES (
            NEW.id,
            NEW.store_id,
            rec.recommended_product,
            rec.association_type,
            rec.confidence_score,
            'Based on purchase patterns',
            5,
            rec.price * 5,
            NEW.predicted_date + INTERVAL '7 days'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-generating recommendations
CREATE TRIGGER auto_generate_upselling
AFTER INSERT OR UPDATE ON predicted_orders
FOR EACH ROW
EXECUTE FUNCTION generate_upselling_recommendations();

-- Function to update customer segments
CREATE OR REPLACE FUNCTION update_customer_segments()
RETURNS void AS $$
BEGIN
    INSERT INTO customer_segments (
        store_id,
        segment_name,
        segment_value,
        total_revenue,
        order_frequency,
        avg_order_value,
        last_order_date,
        churn_risk,
        preferred_categories,
        preferred_brands
    )
    SELECT 
        s.id,
        CASE 
            WHEN SUM(mi.total) > 100000 THEN 'Premium'
            WHEN SUM(mi.total) > 50000 THEN 'Regular'
            ELSE 'Occasional'
        END,
        CASE 
            WHEN SUM(mi.total) > 100000 THEN 'high'
            WHEN SUM(mi.total) > 50000 THEN 'medium'
            ELSE 'low'
        END,
        COALESCE(SUM(mi.total), 0),
        COUNT(DISTINCT mi.invoice_date) / 30.0,
        AVG(mi.total),
        MAX(mi.invoice_date),
        CASE 
            WHEN MAX(mi.invoice_date) < CURRENT_DATE - INTERVAL '60 days' THEN 0.8
            WHEN MAX(mi.invoice_date) < CURRENT_DATE - INTERVAL '30 days' THEN 0.5
            ELSE 0.2
        END,
        array_agg(DISTINCT mi.category_name),
        array_agg(DISTINCT mi.brand)
    FROM stores s
    LEFT JOIN mangalam_invoices mi ON s.id = mi.customer_id
    WHERE mi.invoice_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY s.id
    ON CONFLICT (store_id) DO UPDATE SET
        segment_name = EXCLUDED.segment_name,
        segment_value = EXCLUDED.segment_value,
        total_revenue = EXCLUDED.total_revenue,
        order_frequency = EXCLUDED.order_frequency,
        avg_order_value = EXCLUDED.avg_order_value,
        last_order_date = EXCLUDED.last_order_date,
        churn_risk = EXCLUDED.churn_risk,
        preferred_categories = EXCLUDED.preferred_categories,
        preferred_brands = EXCLUDED.preferred_brands,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate product associations
CREATE OR REPLACE FUNCTION calculate_product_associations()
RETURNS void AS $$
DECLARE
    total_transactions INTEGER;
BEGIN
    -- Get total number of transactions
    SELECT COUNT(DISTINCT invoice_id) INTO total_transactions FROM invoice_items;
    
    -- Calculate frequently bought together
    INSERT INTO product_associations (
        product_a,
        product_b,
        association_type,
        co_occurrence_count,
        support,
        confidence_score,
        lift_score
    )
    SELECT 
        ii1.product_id,
        ii2.product_id,
        'frequently_bought',
        COUNT(*),
        COUNT(*)::DECIMAL / total_transactions,
        COUNT(*)::DECIMAL / COUNT(DISTINCT ii1.invoice_id),
        (COUNT(*)::DECIMAL / total_transactions) / 
            (COUNT(DISTINCT ii1.invoice_id)::DECIMAL / total_transactions * 
             COUNT(DISTINCT ii2.invoice_id)::DECIMAL / total_transactions)
    FROM invoice_items ii1
    JOIN invoice_items ii2 ON ii1.invoice_id = ii2.invoice_id
    WHERE ii1.product_id < ii2.product_id
    GROUP BY ii1.product_id, ii2.product_id
    HAVING COUNT(*) > 5
    ON CONFLICT (product_a, product_b, association_type) DO UPDATE SET
        co_occurrence_count = EXCLUDED.co_occurrence_count,
        support = EXCLUDED.support,
        confidence_score = EXCLUDED.confidence_score,
        lift_score = EXCLUDED.lift_score,
        last_calculated = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function for complete bulk upload processing
CREATE OR REPLACE FUNCTION process_bulk_upload_complete()
RETURNS void AS $$
BEGIN
    -- 1. Populate invoice_items from mangalam_invoices
    INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, total_price)
    SELECT 
        mi.invoice_id,
        p.id,
        mi.item_name,
        mi.quantity,
        mi.item_price,
        mi.item_total
    FROM mangalam_invoices mi
    LEFT JOIN products p ON p.name = mi.item_name
    WHERE NOT EXISTS (
        SELECT 1 FROM invoice_items ii 
        WHERE ii.invoice_id = mi.invoice_id 
        AND ii.product_name = mi.item_name
    );
    
    -- 2. Calculate product associations
    PERFORM calculate_product_associations();
    
    -- 3. Update customer segments
    PERFORM update_customer_segments();
    
    -- 4. Generate predictions (if not exists)
    PERFORM generate_order_predictions();
    
    -- 5. Generate upselling for existing orders
    INSERT INTO upselling_recommendations (
        store_id,
        product_id,
        recommendation_type,
        confidence,
        reason,
        suggested_quantity
    )
    SELECT DISTINCT
        cs.store_id,
        pa.product_b,
        'cross_sell',
        pa.confidence_score,
        'Frequently bought by similar customers',
        5
    FROM customer_segments cs
    JOIN product_associations pa ON true
    WHERE cs.segment_value IN ('high', 'medium')
    AND pa.confidence_score > 0.6
    LIMIT 100
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Bulk upload processing complete - all tables populated';
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX idx_invoice_items_date ON mangalam_invoices(invoice_date);
CREATE INDEX idx_sync_queue_pending ON realtime_sync_queue(status) WHERE status = 'pending';

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO mangalm;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO mangalm;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO mangalm;