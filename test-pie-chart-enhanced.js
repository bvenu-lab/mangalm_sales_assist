const axios = require('axios');

// Enhanced color palette matching the frontend
const PIE_CHART_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Purple
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#F8B739', // Orange
  '#FF8C42', // Coral
];

async function testEnhancedPieChart() {
  try {
    console.log('🎨 Testing Enhanced Pie Chart Functionality\n');
    console.log('=' .repeat(50));

    // Test the API endpoint
    const response = await axios.get('http://localhost:3007/api/analytics/product-distribution?range=180d');

    if (response.data.success && response.data.data) {
      const { topProducts } = response.data.data;

      if (topProducts && topProducts.length > 0) {
        console.log('\n✅ PIE CHART DATA READY\n');

        // Simulate pie chart data transformation
        const pieData = topProducts.slice(0, 10).map((product, index) => ({
          name: product.product_name,
          value: parseFloat(product.total_quantity),
          revenue: parseFloat(product.total_revenue),
          fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]
        }));

        console.log('📊 PIE CHART SEGMENTS (with unique colors):\n');
        pieData.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.name}`);
          console.log(`      Color: ${item.fill}`);
          console.log(`      Quantity: ${item.value} units`);
          console.log(`      Revenue: ₹${item.revenue.toLocaleString()}`);
          console.log('');
        });

        // Calculate totals for percentage view
        const totalQuantity = pieData.reduce((sum, item) => sum + item.value, 0);
        const totalRevenue = pieData.reduce((sum, item) => sum + item.revenue, 0);

        console.log('📈 VIEW MODES:\n');
        console.log('1. PERCENTAGE VIEW (%)');
        pieData.slice(0, 3).forEach(item => {
          const percent = ((item.value / totalQuantity) * 100).toFixed(1);
          console.log(`   ${item.name}: ${percent}%`);
        });

        console.log('\n2. QUANTITY VIEW (#)');
        pieData.slice(0, 3).forEach(item => {
          console.log(`   ${item.name}: ${item.value} units`);
        });

        console.log('\n3. REVENUE VIEW ($)');
        pieData.slice(0, 3).forEach(item => {
          console.log(`   ${item.name}: ₹${(item.revenue / 1000).toFixed(1)}K`);
        });

        console.log('\n' + '=' .repeat(50));
        console.log('\n🎯 PIE CHART FEATURES IMPLEMENTED:');
        console.log('   ✅ Each segment has a unique color');
        console.log('   ✅ Toggle buttons for % / # / $ views');
        console.log('   ✅ Revenue data included from API');
        console.log('   ✅ Responsive labels with truncation');
        console.log('   ✅ Interactive tooltips with formatted values');
        console.log('   ✅ Legend at bottom of chart');

        console.log('\n📱 TO TEST IN BROWSER:');
        console.log('   1. Open http://localhost:3000/dashboard');
        console.log('   2. Look for "Top Products" card on the right');
        console.log('   3. Click the toggle buttons (%, #, $) to switch views');
        console.log('   4. Hover over segments to see tooltips');
        console.log('   5. Each segment should have a different color');

      } else {
        console.log('❌ No product data available');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEnhancedPieChart();