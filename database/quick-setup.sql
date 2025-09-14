-- Quick setup for Cloud SQL
-- Run this after connecting to mangalm_sales database

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50),
    segment VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    product_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    store_id BIGINT REFERENCES stores(id),
    order_date DATE NOT NULL,
    total_amount DECIMAL(12, 2),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    product_id BIGINT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL
);

-- Insert test data
INSERT INTO stores (store_id, name, city, state, segment) VALUES
('STORE001', 'Manhattan Electronics', 'New York', 'NY', 'Premium'),
('STORE002', 'LA Tech Supplies', 'Los Angeles', 'CA', 'Standard'),
('STORE003', 'Chicago Wholesale', 'Chicago', 'IL', 'Bulk')
ON CONFLICT (store_id) DO NOTHING;

INSERT INTO products (product_id, name, category, unit_price) VALUES
('PROD001', 'Laptop Pro', 'Electronics', 999.99),
('PROD002', 'Wireless Mouse', 'Accessories', 49.99),
('PROD003', 'USB-C Cable', 'Accessories', 19.99)
ON CONFLICT (product_id) DO NOTHING;

-- Verify setup
SELECT COUNT(*) as store_count FROM stores;
SELECT COUNT(*) as product_count FROM products;