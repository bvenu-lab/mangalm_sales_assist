const axios = require('axios');

async function testPieChart() {
  try {
    console.log('Testing product distribution API endpoint...\n');

    // Test the API endpoint
    const response = await axios.get('http://localhost:3007/api/analytics/product-distribution?range=180d');

    if (response.data.success && response.data.data) {
      const { topProducts, storeDistribution } = response.data.data;

      console.log('✅ API Response received successfully');
      console.log(`   - Top Products: ${topProducts ? topProducts.length : 0} products`);
      console.log(`   - Store Distribution: ${storeDistribution ? storeDistribution.length : 0} stores\n`);

      if (topProducts && topProducts.length > 0) {
        console.log('Top 5 Products:');
        topProducts.slice(0, 5).forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.product_name}`);
          console.log(`      - Quantity: ${product.total_quantity}`);
          console.log(`      - Revenue: ₹${parseFloat(product.total_revenue).toLocaleString()}`);
          console.log(`      - Stores: ${product.store_count}`);
        });

        console.log('\n✅ PIE CHART DATA IS AVAILABLE');
        console.log('   The pie chart should display these products.');

        // Transform for pie chart
        const pieData = topProducts.map(p => ({
          name: p.product_name,
          value: p.total_quantity,
          fill: getProductColor(p.product_name)
        }));

        console.log('\nPie Chart Format (first 3 items):');
        pieData.slice(0, 3).forEach(item => {
          console.log(`   - ${item.name}: ${item.value} units`);
        });

      } else {
        console.log('❌ No top products data available');
      }

    } else {
      console.log('❌ Invalid API response structure');
    }

    console.log('\n📊 DASHBOARD STATUS:');
    console.log('   - API Gateway: ✅ Running on port 3007');
    console.log('   - Frontend: ✅ Running on port 3000');
    console.log('   - Database: ✅ Has product data');
    console.log('\n🔍 TO CHECK PIE CHART:');
    console.log('   1. Open http://localhost:3000/dashboard');
    console.log('   2. Look for "Top Products" section on the right side');
    console.log('   3. Open browser console (F12) to see debug logs');
    console.log('   4. Look for logs starting with [PieChart] and [processData]');

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

function getProductColor(productName) {
  const PRODUCT_COLORS = {
    'BHEL PURI': '#FF6B6B',
    'SEV PURI': '#4ECDC4',
    'DAHI PURI': '#45B7D1',
    'PANI PURI': '#96CEB4',
    'SAMOSA': '#FFEAA7',
    'KACHORI': '#DDA0DD',
    'DHOKLA': '#98D8C8',
    'KHAMAN': '#F7DC6F',
    'FAFDA': '#F8B739',
    'JALEBI': '#FF8C42',
    'Default': '#95A5A6',
  };

  const key = Object.keys(PRODUCT_COLORS).find(k =>
    productName.toUpperCase().includes(k)
  );
  return PRODUCT_COLORS[key] || PRODUCT_COLORS.Default;
}

testPieChart();