-- COMPLETE DATABASE SETUP FOR CLOUD SQL
-- This creates ALL 18+ tables needed for the application

-- Clean up any existing tables (be careful in production!)
DROP TABLE IF EXISTS predicted_order_items CASCADE;
DROP TABLE IF EXISTS predicted_orders CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS mangalam_invoices CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS sales_forecasts CASCADE;
DROP TABLE IF EXISTS model_performance CASCADE;
DROP TABLE IF EXISTS order_patterns CASCADE;
DROP TABLE IF EXISTS customer_segments CASCADE;
DROP TABLE IF EXISTS store_preferences CASCADE;
DROP TABLE IF EXISTS call_prioritization CASCADE;
DROP TABLE IF EXISTS upselling_recommendations CASCADE;
DROP TABLE IF EXISTS product_associations CASCADE;
DROP TABLE IF EXISTS user_actions CASCADE;
DROP TABLE IF EXISTS dashboard_settings CASCADE;
DROP TABLE IF EXISTS realtime_sync_queue CASCADE;
DROP TABLE IF EXISTS bulk_uploads CASCADE;
DROP TABLE IF EXISTS upload_validations CASCADE;
DROP TABLE IF EXISTS processing_status CASCADE;

-- CORE TABLES

-- 1. Stores
CREATE TABLE stores (
    id VARCHAR(255) PRIMARY KEY,
    store_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(255),
    contact_person VARCHAR(255),
    territory VARCHAR(100),
    segment VARCHAR(50),
    credit_limit DECIMAL(12, 2),
    payment_terms VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    sub_category VARCHAR(100),
    brand VARCHAR(100),
    unit_price DECIMAL(10, 2),
    cost_price DECIMAL(10, 2),
    stock_quantity INTEGER DEFAULT 0,
    sku VARCHAR(100),
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Orders
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    store_id VARCHAR(255) REFERENCES stores(id),
    order_date DATE NOT NULL,
    delivery_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(12, 2),
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    shipping_amount DECIMAL(10, 2) DEFAULT 0,
    payment_status VARCHAR(50),
    payment_method VARCHAR(50),
    sales_person VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Invoice Items
CREATE TABLE invoice_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    tax_percentage DECIMAL(5, 2) DEFAULT 0,
    total_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Mangalam Invoices (legacy support)
CREATE TABLE mangalam_invoices (
    id BIGSERIAL PRIMARY KEY,
    invoice_id VARCHAR(255) UNIQUE NOT NULL,
    store_id VARCHAR(255) REFERENCES stores(id),
    invoice_date DATE NOT NULL,
    total_amount DECIMAL(12, 2),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI/PREDICTION TABLES

-- 6. Predicted Orders
CREATE TABLE predicted_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    predicted_date DATE NOT NULL,
    confidence DECIMAL(3, 2) DEFAULT 0.75,
    priority VARCHAR(20) DEFAULT 'medium',
    total_amount DECIMAL(10, 2),
    items JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    justification TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Predicted Order Items
CREATE TABLE predicted_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predicted_order_id UUID REFERENCES predicted_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    predicted_quantity INTEGER DEFAULT 1,
    confidence DECIMAL(3, 2) DEFAULT 0.75,
    unit_price DECIMAL(10, 2),
    total_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Sales Forecasts
CREATE TABLE sales_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    forecast_date DATE NOT NULL,
    forecast_amount DECIMAL(12, 2),
    actual_amount DECIMAL(12, 2),
    accuracy_percentage DECIMAL(5, 2),
    forecast_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Model Performance
CREATE TABLE model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    evaluation_date DATE NOT NULL,
    accuracy DECIMAL(5, 2),
    precision_score DECIMAL(5, 2),
    recall_score DECIMAL(5, 2),
    f1_score DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Order Patterns
CREATE TABLE order_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    pattern_type VARCHAR(100),
    pattern_data JSONB,
    confidence DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CUSTOMER TABLES

-- 11. Customer Segments
CREATE TABLE customer_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    segment_name VARCHAR(100),
    characteristics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Store Preferences
CREATE TABLE store_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    preference_type VARCHAR(100),
    preference_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Call Prioritization
CREATE TABLE call_prioritization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    priority_score DECIMAL(5, 2),
    last_contact_date DATE,
    next_contact_date DATE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ANALYTICS TABLES

-- 14. Upselling Recommendations
CREATE TABLE upselling_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(255) REFERENCES stores(id),
    product_id UUID REFERENCES products(id),
    recommendation_type VARCHAR(100),
    confidence DECIMAL(3, 2),
    expected_revenue DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Product Associations
CREATE TABLE product_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_a_id UUID REFERENCES products(id),
    product_b_id UUID REFERENCES products(id),
    association_strength DECIMAL(3, 2),
    association_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SYSTEM TABLES

-- 16. User Actions
CREATE TABLE user_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    action_type VARCHAR(100),
    action_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. Dashboard Settings
CREATE TABLE dashboard_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. Realtime Sync Queue
CREATE TABLE realtime_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    action VARCHAR(50),
    payload JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UPLOAD TABLES

-- 19. Bulk Uploads
CREATE TABLE bulk_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 20. Upload Validations
CREATE TABLE upload_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES bulk_uploads(id),
    row_number INTEGER,
    validation_type VARCHAR(100),
    validation_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 21. Processing Status
CREATE TABLE processing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100),
    job_id VARCHAR(255),
    status VARCHAR(50),
    progress INTEGER DEFAULT 0,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CREATE INDEXES FOR PERFORMANCE
CREATE INDEX idx_stores_store_id ON stores(store_id);
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_predicted_orders_store_id ON predicted_orders(store_id);
CREATE INDEX idx_predicted_orders_date ON predicted_orders(predicted_date);
CREATE INDEX idx_sales_forecasts_store_id ON sales_forecasts(store_id);
CREATE INDEX idx_call_prioritization_store_id ON call_prioritization(store_id);

-- INSERT SAMPLE DATA
INSERT INTO stores (id, store_id, name, city, state, segment, credit_limit) VALUES
('4261931000000092001', 'STORE001', 'Manhattan Electronics', 'New York', 'NY', 'Premium', 50000),
('4261931000000092002', 'STORE002', 'LA Tech Supplies', 'Los Angeles', 'CA', 'Standard', 30000),
('4261931000000092003', 'STORE003', 'Chicago Wholesale', 'Chicago', 'IL', 'Bulk', 100000),
('4261931000000092004', 'STORE004', 'Houston Retail', 'Houston', 'TX', 'Standard', 25000),
('4261931000000092005', 'STORE005', 'Phoenix Solutions', 'Phoenix', 'AZ', 'Premium', 75000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (product_id, name, category, unit_price, stock_quantity) VALUES
('PROD001', 'Laptop Pro 15"', 'Electronics', 999.99, 50),
('PROD002', 'Wireless Mouse', 'Accessories', 49.99, 200),
('PROD003', 'USB-C Cable', 'Accessories', 19.99, 500),
('PROD004', 'Monitor 27"', 'Electronics', 399.99, 30),
('PROD005', 'Keyboard Mechanical', 'Accessories', 129.99, 100)
ON CONFLICT (product_id) DO NOTHING;

-- Insert sample orders
INSERT INTO orders (order_id, store_id, order_date, total_amount, status) VALUES
('ORD001', '4261931000000092001', CURRENT_DATE - INTERVAL '5 days', 2499.97, 'completed'),
('ORD002', '4261931000000092002', CURRENT_DATE - INTERVAL '3 days', 149.98, 'completed'),
('ORD003', '4261931000000092003', CURRENT_DATE - INTERVAL '1 day', 5999.95, 'processing'),
('ORD004', '4261931000000092001', CURRENT_DATE, 799.98, 'pending'),
('ORD005', '4261931000000092004', CURRENT_DATE, 1299.97, 'pending')
ON CONFLICT (order_id) DO NOTHING;

-- Insert sample predicted orders
INSERT INTO predicted_orders (store_id, predicted_date, total_amount, confidence, priority) VALUES
('4261931000000092001', CURRENT_DATE + INTERVAL '7 days', 3500.00, 0.85, 'high'),
('4261931000000092002', CURRENT_DATE + INTERVAL '10 days', 1200.00, 0.72, 'medium'),
('4261931000000092003', CURRENT_DATE + INTERVAL '14 days', 8000.00, 0.90, 'high');

-- Insert sample call prioritization
INSERT INTO call_prioritization (store_id, priority_score, next_contact_date, reason) VALUES
('4261931000000092001', 95.5, CURRENT_DATE + INTERVAL '2 days', 'High value customer, order pending'),
('4261931000000092002', 65.0, CURRENT_DATE + INTERVAL '5 days', 'Regular follow-up'),
('4261931000000092004', 80.0, CURRENT_DATE + INTERVAL '3 days', 'New product launch');

-- Verify setup
SELECT 'Tables created:' as status, COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public';
SELECT 'Stores:' as entity, COUNT(*) as count FROM stores
UNION ALL SELECT 'Products:', COUNT(*) FROM products
UNION ALL SELECT 'Orders:', COUNT(*) FROM orders
UNION ALL SELECT 'Predicted Orders:', COUNT(*) FROM predicted_orders;