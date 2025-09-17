// SQLite Database Setup for Mangalm Sales Assistant
// Alternative to PostgreSQL when Docker is not available

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database
const dbPath = path.join(dbDir, 'mangalm_sales.db');
console.log(`Creating SQLite database at: ${dbPath}`);

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// SQL schema adapted from PostgreSQL to SQLite
const createTablesSQL = `
-- Drop tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS predicted_order_items;
DROP TABLE IF EXISTS predicted_orders;
DROP TABLE IF EXISTS invoice_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS mangalam_invoices;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS stores;
DROP TABLE IF EXISTS sales_forecasts;
DROP TABLE IF EXISTS order_patterns;
DROP TABLE IF EXISTS model_performance;
DROP TABLE IF EXISTS user_actions;
DROP TABLE IF EXISTS dashboard_settings;
DROP TABLE IF EXISTS store_preferences;
DROP TABLE IF EXISTS upselling_recommendations;
DROP TABLE IF EXISTS product_associations;
DROP TABLE IF EXISTS customer_segments;
DROP TABLE IF EXISTS call_prioritization;
DROP TABLE IF EXISTS realtime_sync_queue;
DROP TABLE IF EXISTS bulk_uploads;
DROP TABLE IF EXISTS upload_validations;
DROP TABLE IF EXISTS processing_status;

-- 1. STORES - Core store information
CREATE TABLE stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'USA',
    zip_code TEXT,
    phone TEXT,
    email TEXT,
    contact_person TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    store_type TEXT,
    territory TEXT,
    region TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCTS - Product catalog
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    brand TEXT,
    category TEXT,
    description TEXT,
    unit_price DECIMAL(10, 2),
    mrp DECIMAL(10, 2),
    upc TEXT,
    mpn TEXT,
    ean TEXT,
    isbn TEXT,
    kit_combo_item_name TEXT,
    suggested_price DECIMAL(10, 2),
    usage_unit TEXT,
    warehouse_name TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. MANGALAM_INVOICES - Invoice header information
CREATE TABLE mangalam_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    store_id TEXT REFERENCES stores(id),
    customer_name TEXT,
    customer_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
    currency_code TEXT DEFAULT 'USD',
    exchange_rate DECIMAL(10, 4) DEFAULT 1.0000,
    subtotal DECIMAL(10, 2) DEFAULT 0.00,
    total DECIMAL(10, 2) DEFAULT 0.00,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    discount_type TEXT,
    discount_percent DECIMAL(5, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    shipping_charge DECIMAL(10, 2) DEFAULT 0.00,
    adjustment DECIMAL(10, 2) DEFAULT 0.00,
    sales_order_number TEXT,
    payment_terms TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. INVOICE_ITEMS - Invoice line items
CREATE TABLE invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT REFERENCES mangalam_invoices(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2),
    discount DECIMAL(5, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. ORDERS - Future orders/predictions
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id),
    order_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    total_amount DECIMAL(10, 2),
    notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. PREDICTED_ORDERS - AI-generated order predictions
CREATE TABLE predicted_orders (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id) ON DELETE CASCADE,
    predicted_date DATE NOT NULL,
    confidence DECIMAL(3, 2) DEFAULT 0.75,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    total_amount DECIMAL(10, 2),
    items TEXT, -- JSON data
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'modified')),
    manual_verification_required BOOLEAN DEFAULT 0,
    ai_recommendation TEXT,
    prediction_model TEXT,
    notes TEXT,
    created_by TEXT DEFAULT 'system',
    modified_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. PREDICTED_ORDER_ITEMS - Items in predicted orders
CREATE TABLE predicted_order_items (
    id TEXT PRIMARY KEY,
    predicted_order_id TEXT REFERENCES predicted_orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_code TEXT,
    predicted_quantity INTEGER DEFAULT 1,
    confidence DECIMAL(3, 2) DEFAULT 0.75,
    unit_price DECIMAL(10, 2),
    total_price DECIMAL(10, 2),
    ai_reasoning TEXT,
    user_modified BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. SALES_FORECASTS - Sales forecasting data
CREATE TABLE sales_forecasts (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id),
    product_id TEXT REFERENCES products(id),
    forecast_date DATE NOT NULL,
    period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
    predicted_quantity INTEGER,
    predicted_revenue DECIMAL(10, 2),
    confidence_score DECIMAL(3, 2),
    model_version TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. ORDER_PATTERNS - Historical order pattern analysis
CREATE TABLE order_patterns (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id),
    pattern_type TEXT NOT NULL,
    pattern_data TEXT, -- JSON
    frequency_score DECIMAL(3, 2),
    reliability_score DECIMAL(3, 2),
    last_occurrence DATE,
    next_predicted_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. MODEL_PERFORMANCE - ML model performance tracking
CREATE TABLE model_performance (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_version TEXT,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(10, 4),
    evaluation_date DATE,
    dataset_size INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. USER_ACTIONS - User interaction tracking
CREATE TABLE user_actions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action_type TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details TEXT, -- JSON
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. DASHBOARD_SETTINGS - User dashboard preferences
CREATE TABLE dashboard_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE,
    layout_config TEXT, -- JSON
    widget_preferences TEXT, -- JSON
    theme TEXT DEFAULT 'light',
    refresh_interval INTEGER DEFAULT 300,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. STORE_PREFERENCES - Store-specific preferences
CREATE TABLE store_preferences (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id),
    preference_type TEXT NOT NULL,
    preference_value TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. UPSELLING_RECOMMENDATIONS - Product upselling suggestions
CREATE TABLE upselling_recommendations (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id),
    primary_product_id TEXT REFERENCES products(id),
    recommended_product_id TEXT REFERENCES products(id),
    confidence_score DECIMAL(3, 2),
    reason TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. PRODUCT_ASSOCIATIONS - Product relationship analysis
CREATE TABLE product_associations (
    id TEXT PRIMARY KEY,
    product_a_id TEXT REFERENCES products(id),
    product_b_id TEXT REFERENCES products(id),
    association_type TEXT NOT NULL,
    strength_score DECIMAL(3, 2),
    frequency INTEGER DEFAULT 0,
    last_seen DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. CUSTOMER_SEGMENTS - Customer segmentation
CREATE TABLE customer_segments (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id),
    segment_name TEXT NOT NULL,
    segment_criteria TEXT, -- JSON
    segment_score DECIMAL(3, 2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 17. CALL_PRIORITIZATION - Sales call prioritization
CREATE TABLE call_prioritization (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id),
    priority_score INTEGER DEFAULT 0,
    reason TEXT,
    last_contact DATE,
    next_contact_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 18. REALTIME_SYNC_QUEUE - Real-time synchronization queue
CREATE TABLE realtime_sync_queue (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    data TEXT, -- JSON
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
);

-- 19. BULK_UPLOADS - Bulk upload tracking
CREATE TABLE bulk_uploads (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_size INTEGER,
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    error_summary TEXT,
    uploaded_by TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 20. UPLOAD_VALIDATIONS - Upload validation results
CREATE TABLE upload_validations (
    id TEXT PRIMARY KEY,
    upload_id TEXT REFERENCES bulk_uploads(id) ON DELETE CASCADE,
    row_number INTEGER,
    field_name TEXT,
    validation_type TEXT,
    error_message TEXT,
    severity TEXT DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'info')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 21. PROCESSING_STATUS - Processing status tracking
CREATE TABLE processing_status (
    id TEXT PRIMARY KEY,
    process_type TEXT NOT NULL,
    process_id TEXT NOT NULL,
    status TEXT NOT NULL,
    progress_percentage INTEGER DEFAULT 0,
    current_step TEXT,
    total_steps INTEGER,
    error_message TEXT,
    metadata TEXT, -- JSON
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Create indexes for better performance
CREATE INDEX idx_stores_status ON stores(status);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_invoices_store_date ON mangalam_invoices(store_id, invoice_date);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_predicted_orders_store ON predicted_orders(store_id, predicted_date);
CREATE INDEX idx_predicted_order_items_order ON predicted_order_items(predicted_order_id);
CREATE INDEX idx_call_prioritization_store ON call_prioritization(store_id);
CREATE INDEX idx_bulk_uploads_status ON bulk_uploads(status);
CREATE INDEX idx_processing_status_type ON processing_status(process_type, process_id);
`;

try {
    // Execute schema creation
    db.exec(createTablesSQL);
    console.log('✅ SQLite database schema created successfully');
    console.log('✅ All 21 tables initialized');
    
    // Verify tables were created
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log(`✅ Created ${tables.length} tables:`, tables.map(t => t.name).join(', '));
    
} catch (error) {
    console.error('❌ Error creating database schema:', error);
    process.exit(1);
}

db.close();
console.log('✅ Database setup completed successfully');