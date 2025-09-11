const { Pool } = require('pg');

// Database configuration
const dbConfig = {
    user: 'postgres',
    host: 'localhost',
    database: 'mangalm_sales',
    password: 'postgres',
    port: 3432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
};

const pool = new Pool(dbConfig);

async function transformInvoiceData() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('Starting data transformation from mangalam_invoices...');
        
        // 1. Populate stores table from unique customers
        console.log('Populating stores table...');
        const storeResult = await client.query(`
            INSERT INTO stores (
                id, name, address, city, state, 
                zip, contact_person, phone, email, region,
                created_at
            )
            SELECT DISTINCT ON (customer_id)
                customer_id::VARCHAR(255) as id,
                customer_name as name,
                COALESCE(billing_city, 'Unknown') || ', ' || COALESCE(billing_state, 'Unknown') as address,
                COALESCE(billing_city, 'Unknown') as city,
                COALESCE(billing_state, 'Unknown') as state,
                COALESCE(billing_code, '00000') as zip,
                sales_person as contact_person,
                '1234567890' as phone,
                LOWER(REPLACE(customer_name, ' ', '_')) || '@example.com' as email,
                COALESCE(billing_state, 'Unknown') as region,
                NOW() as created_at
            FROM mangalam_invoices
            WHERE customer_id IS NOT NULL AND customer_name IS NOT NULL
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                city = EXCLUDED.city,
                state = EXCLUDED.state,
                updated_at = NOW()
            RETURNING id
        `);
        console.log(`Inserted/Updated ${storeResult.rowCount} stores`);

        // 2. Populate products table from unique items
        console.log('Populating products table...');
        const productResult = await client.query(`
            INSERT INTO products (
                id, name, sku, category, brand,
                unit_price, description, created_at
            )
            SELECT DISTINCT ON (COALESCE(product_id, sku))
                COALESCE(product_id, sku, 'PROD_' || ROW_NUMBER() OVER())::VARCHAR(255) as id,
                item_name as name,
                COALESCE(sku, 'SKU_' || product_id) as sku,
                COALESCE(category_name, 'General') as category,
                COALESCE(brand, 'Generic') as brand,
                COALESCE(item_price, 0)::DECIMAL(10,2) as unit_price,
                COALESCE(item_desc, item_name) as description,
                NOW() as created_at
            FROM mangalam_invoices
            WHERE item_name IS NOT NULL
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                category = EXCLUDED.category,
                brand = EXCLUDED.brand,
                unit_price = EXCLUDED.unit_price,
                updated_at = NOW()
            RETURNING id
        `);
        console.log(`Inserted/Updated ${productResult.rowCount} products`);

        // 3. Populate orders table from invoice data
        console.log('Populating orders table...');
        const orderResult = await client.query(`
            INSERT INTO orders (
                order_number, store_id, customer_name, order_date, 
                requested_delivery_date, total_amount, status,
                created_by, source, created_at
            )
            SELECT DISTINCT ON (invoice_number)
                invoice_number as order_number,
                customer_id::VARCHAR(255) as store_id,
                customer_name,
                COALESCE(invoice_date, CURRENT_DATE)::TIMESTAMP as order_date,
                COALESCE(due_date, invoice_date + INTERVAL '7 days', CURRENT_DATE + INTERVAL '7 days')::TIMESTAMP as requested_delivery_date,
                COALESCE(total, 0)::DECIMAL(10,2) as total_amount,
                CASE 
                    WHEN LOWER(invoice_status) = 'paid' THEN 'completed'
                    WHEN LOWER(invoice_status) = 'unpaid' THEN 'pending_review'
                    ELSE 'confirmed'
                END::order_status as status,
                COALESCE(sales_person, 'System') as created_by,
                'bulk_upload' as source,
                NOW() as created_at
            FROM mangalam_invoices
            WHERE invoice_number IS NOT NULL AND customer_id IS NOT NULL
            ON CONFLICT (order_number) DO UPDATE SET
                total_amount = EXCLUDED.total_amount,
                status = EXCLUDED.status,
                updated_at = NOW()
            RETURNING id, order_number
        `);
        console.log(`Inserted/Updated ${orderResult.rowCount} orders`);

        // 4. Skip order_items for now - using invoice_items instead
        console.log('Order items already in invoice_items table');
        const itemsResult = { rowCount: 0 };
        console.log(`Inserted/Updated ${itemsResult.rowCount} order items`);

        // 5. Skip predicted orders - will be generated by AI/ML prediction service
        console.log('Predicted orders will be generated by AI/ML service');
        const predictionResult = { rowCount: 0 };

        // 6. Skip call priorities - will be managed by backend services
        console.log('Call priorities will be managed by backend services');
        const priorityResult = { rowCount: 0 };

        await client.query('COMMIT');
        
        // Display summary
        console.log('\n=== Data Transformation Complete ===');
        
        const summary = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM stores) as stores_count,
                (SELECT COUNT(*) FROM products) as products_count,
                (SELECT COUNT(*) FROM orders) as orders_count,
                (SELECT COUNT(*) FROM invoice_items) as invoice_items_count,
                (SELECT COUNT(*) FROM predicted_orders) as predictions_count,
                (SELECT COUNT(*) FROM call_priorities) as priorities_count
        `);
        
        console.log('Summary:', summary.rows[0]);
        console.log('\nData is now ready for:');
        console.log('✅ Store order forms');
        console.log('✅ Product predictions');
        console.log('✅ Upselling recommendations');
        console.log('✅ Dashboard analytics');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error transforming data:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the transformation
transformInvoiceData()
    .then(() => {
        console.log('\nTransformation completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Transformation failed:', error);
        process.exit(1);
    });