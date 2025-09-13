const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://mangalm:mangalm123@localhost:3432/mangalm_sales'
});

async function testProductDistribution() {
  try {
    console.log('Testing product distribution query...\n');
    
    // Test simplified query first
    const simpleQuery = `
      SELECT 
        mi.customer_name as store_name,
        COUNT(DISTINCT mi.item_name) as product_count,
        SUM(mi.quantity) as total_quantity,
        SUM(mi.total) as total_revenue
      FROM mangalam_invoices mi
      WHERE mi.invoice_date >= CURRENT_DATE - INTERVAL '180 days'
        AND mi.item_name IS NOT NULL
        AND mi.customer_name IS NOT NULL
      GROUP BY mi.customer_name
      ORDER BY total_revenue DESC NULLS LAST
      LIMIT 5
    `;
    
    const result = await pool.query(simpleQuery);
    console.log('Simple query results:');
    console.log('Row count:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('\nTop 5 stores:');
      result.rows.forEach(row => {
        console.log(`- ${row.store_name}: ${row.product_count} products, revenue: ${row.total_revenue}`);
      });
    }
    
    // Test the complex query with json_agg
    const complexQuery = `
      WITH store_products AS (
        SELECT 
          mi.customer_name as store_name,
          mi.item_name as product_name,
          SUM(mi.quantity) as quantity_sold,
          SUM(mi.total) as revenue,
          MAX(mi.brand) as brand,
          MAX(mi.category_name) as category
        FROM mangalam_invoices mi
        WHERE mi.invoice_date >= CURRENT_DATE - INTERVAL '180 days'
          AND mi.item_name IS NOT NULL
          AND mi.customer_name IS NOT NULL
        GROUP BY mi.customer_name, mi.item_name
      ),
      store_summary AS (
        SELECT 
          store_name,
          COUNT(DISTINCT product_name)::integer as product_count,
          SUM(quantity_sold)::integer as total_quantity,
          SUM(revenue) as total_revenue
        FROM store_products
        GROUP BY store_name
      )
      SELECT 
        ss.store_name,
        ss.product_count,
        ss.total_quantity,
        ss.total_revenue,
        COALESCE(
          json_agg(
            json_build_object(
              'product_name', sp.product_name,
              'quantity', sp.quantity_sold,
              'revenue', sp.revenue,
              'brand', sp.brand,
              'category', sp.category
            ) ORDER BY sp.revenue DESC
          ) FILTER (WHERE sp.product_name IS NOT NULL),
          '[]'::json
        ) as products
      FROM store_summary ss
      LEFT JOIN store_products sp ON ss.store_name = sp.store_name
      GROUP BY ss.store_name, ss.product_count, ss.total_quantity, ss.total_revenue
      ORDER BY ss.total_revenue DESC NULLS LAST
      LIMIT 10
    `;
    
    console.log('\n\nTesting complex query with json_agg...');
    const complexResult = await pool.query(complexQuery);
    console.log('Complex query row count:', complexResult.rows.length);
    
    if (complexResult.rows.length > 0) {
      console.log('\nFirst store details:');
      const firstStore = complexResult.rows[0];
      console.log('Store:', firstStore.store_name);
      console.log('Product count:', firstStore.product_count);
      console.log('Total revenue:', firstStore.total_revenue);
      console.log('Products sample:', JSON.stringify(firstStore.products).substring(0, 200) + '...');
    }
    
    // Test top products query
    const topProductsQuery = `
      SELECT 
        mi.item_name as product_name,
        mi.brand,
        mi.category_name,
        SUM(mi.quantity)::integer as total_quantity,
        SUM(mi.total) as total_revenue,
        COUNT(DISTINCT mi.customer_name)::integer as store_count,
        COUNT(DISTINCT mi.invoice_id)::integer as order_count
      FROM mangalam_invoices mi
      WHERE mi.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
        AND mi.item_name IS NOT NULL
      GROUP BY mi.item_name, mi.brand, mi.category_name
      ORDER BY total_revenue DESC
      LIMIT 5
    `;
    
    console.log('\n\nTesting top products query...');
    const topProducts = await pool.query(topProductsQuery);
    console.log('Top products count:', topProducts.rows.length);
    
    if (topProducts.rows.length > 0) {
      console.log('\nTop 5 products:');
      topProducts.rows.forEach(row => {
        console.log(`- ${row.product_name}: ${row.total_quantity} units, revenue: ${row.total_revenue}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testProductDistribution();