const axios = require('axios');

const INR_TO_USD_RATE = 83; // 1 USD = 83 INR

async function testUSDConversion() {
  try {
    console.log('💵 Testing USD Conversion in Pie Chart\n');
    console.log('=' .repeat(50));
    console.log(`Conversion Rate: 1 USD = ${INR_TO_USD_RATE} INR\n`);

    // Get product data
    const response = await axios.get('http://localhost:3007/api/analytics/product-distribution?range=180d');

    if (response.data.success && response.data.data) {
      const { topProducts } = response.data.data;

      if (topProducts && topProducts.length > 0) {
        console.log('📊 TOP 5 PRODUCTS - REVENUE COMPARISON:\n');

        topProducts.slice(0, 5).forEach((product, index) => {
          const revenueINR = parseFloat(product.total_revenue);
          const revenueUSD = revenueINR / INR_TO_USD_RATE;

          console.log(`${index + 1}. ${product.product_name}`);
          console.log(`   INR: ₹${revenueINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          console.log(`   USD: $${revenueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          console.log(`   Display: $${(revenueUSD / 1000).toFixed(1)}K`);
          console.log('');
        });

        // Calculate totals
        const totalINR = topProducts.reduce((sum, p) => sum + parseFloat(p.total_revenue), 0);
        const totalUSD = totalINR / INR_TO_USD_RATE;

        console.log('=' .repeat(50));
        console.log('\n📈 TOTALS:');
        console.log(`   Total Revenue (INR): ₹${totalINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`   Total Revenue (USD): $${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

        console.log('\n✅ PIE CHART $ VIEW UPDATES:');
        console.log('   • Labels now show USD amounts (e.g., $2.3K)');
        console.log('   • Tooltips display full USD values with 2 decimal places');
        console.log('   • Conversion rate: 1 USD = 83 INR');

        console.log('\n🎯 TO VERIFY IN BROWSER:');
        console.log('   1. Open http://localhost:3000/dashboard');
        console.log('   2. Find the "Top Products" pie chart');
        console.log('   3. Click the "$" toggle button');
        console.log('   4. Labels should show USD amounts like "$2.3K"');
        console.log('   5. Hover over segments to see full USD values');

      } else {
        console.log('❌ No product data available');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testUSDConversion();