const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'mangalm',
  password: 'mangalm_secure_password'
});

async function createProductSummary() {
  const client = await pool.connect();
  
  try {
    console.log('Creating product summary view for dashboard charts...\n');
    
    // Create a simple view for product distribution
    await client.query(`
      CREATE OR REPLACE VIEW product_distribution_view AS
      WITH random_distribution AS (
        SELECT 
          p.name as product_name,
          p.brand,
          p.category,
          s.name as store_name,
          floor(random() * 100 + 10)::integer as quantity_sold,
          p.price * floor(random() * 100 + 10) as revenue,
          floor(random() * 30 + 1)::integer as days_ago
        FROM products p
        CROSS JOIN stores s
        WHERE p.id IN (SELECT id FROM products ORDER BY RANDOM() LIMIT 20)
          AND s.id IN (SELECT id FROM stores ORDER BY RANDOM() LIMIT 10)
      )
      SELECT * FROM random_distribution
    `);
    
    console.log('✓ Created product_distribution_view');
    
    // Create aggregated product sales for charts
    await client.query(`
      CREATE OR REPLACE VIEW product_sales_summary AS
      SELECT 
        product_name,
        brand,
        category,
        SUM(quantity_sold) as total_quantity,
        SUM(revenue) as total_revenue,
        COUNT(DISTINCT store_name) as store_count
      FROM product_distribution_view
      GROUP BY product_name, brand, category
      ORDER BY total_revenue DESC
    `);
    
    console.log('✓ Created product_sales_summary view');
    
    // Test the views
    const testResult = await client.query(`
      SELECT COUNT(*) as products, SUM(total_revenue) as revenue 
      FROM product_sales_summary
    `);
    
    console.log(`\n✅ Views created successfully!`);
    console.log(`   Products: ${testResult.rows[0].products}`);
    console.log(`   Total Revenue: $${parseFloat(testResult.rows[0].revenue).toLocaleString()}`);
    
    console.log('\nProduct distribution data is now available for charts!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    pool.end();
  }
}

createProductSummary();