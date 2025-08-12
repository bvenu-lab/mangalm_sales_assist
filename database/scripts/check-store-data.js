const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mangalm_sales',
  password: 'postgres',
  port: 5432,
});

async function checkStoreData() {
  const storeId = '4261931000001048015'; // Aarti Sashank
  
  try {
    console.log('=== Store Data Completeness Check ===');
    console.log('Store: Aarti Sashank (ID: ' + storeId + ')');
    console.log('=====================================\n');
    
    // Check store details
    const storeResult = await pool.query(
      'SELECT * FROM stores WHERE id = $1',
      [storeId]
    );
    
    if (storeResult.rows.length === 0) {
      console.log('ERROR: Store not found!');
      return;
    }
    
    const store = storeResult.rows[0];
    console.log('1. STORE DETAILS:');
    console.log('   - Name:', store.name);
    console.log('   - Address:', store.address || 'MISSING');
    console.log('   - City:', store.city || 'MISSING');
    console.log('   - State:', store.state || 'MISSING');
    console.log('   - Phone:', store.phone || 'MISSING');
    console.log('   - Email:', store.email || 'MISSING');
    console.log('   - Contact Person:', store.primary_contact_name || 'MISSING');
    console.log('   - Store Size:', store.size || 'MISSING');
    console.log('   - Call Frequency:', store.call_frequency || 'MISSING');
    console.log('');
    
    // Check historical invoices
    const invoiceResult = await pool.query(
      `SELECT COUNT(*) as count, 
              MAX(invoice_date) as last_date, 
              MIN(invoice_date) as first_date,
              SUM(total_amount) as total,
              AVG(total_amount) as avg_amount
       FROM historical_invoices 
       WHERE store_id = $1`,
      [storeId]
    );
    
    console.log('2. HISTORICAL INVOICES:');
    const invData = invoiceResult.rows[0];
    console.log('   - Total Invoices:', invData.count || 0);
    console.log('   - First Invoice:', invData.first_date || 'NONE');
    console.log('   - Last Invoice:', invData.last_date || 'NONE');
    console.log('   - Total Revenue: $', invData.total || 0);
    console.log('   - Average Order: $', invData.avg_amount ? parseFloat(invData.avg_amount).toFixed(2) : 0);
    
    // Check invoice items
    const itemsResult = await pool.query(
      `SELECT COUNT(DISTINCT ii.product_id) as unique_products,
              COUNT(*) as total_items,
              SUM(ii.quantity) as total_quantity
       FROM invoice_items ii
       JOIN historical_invoices hi ON ii.invoice_id = hi.id
       WHERE hi.store_id = $1`,
      [storeId]
    );
    
    const itemData = itemsResult.rows[0];
    console.log('   - Unique Products Ordered:', itemData.unique_products || 0);
    console.log('   - Total Line Items:', itemData.total_items || 0);
    console.log('   - Total Units Sold:', itemData.total_quantity || 0);
    console.log('');
    
    // Check predicted orders
    const predResult = await pool.query(
      `SELECT COUNT(*) as count,
              MIN(predicted_date) as next_date,
              SUM(total_amount) as total
       FROM predicted_orders 
       WHERE store_id = $1`,
      [storeId]
    );
    
    console.log('3. PREDICTED ORDERS:');
    const predData = predResult.rows[0];
    console.log('   - Total Predictions:', predData.count || 0);
    console.log('   - Next Predicted Order:', predData.next_date || 'NONE');
    console.log('   - Predicted Revenue: $', predData.total || 0);
    console.log('');
    
    // Check call prioritization
    const callResult = await pool.query(
      'SELECT * FROM call_prioritization WHERE store_id = $1',
      [storeId]
    );
    
    console.log('4. CALL PRIORITIZATION:');
    if (callResult.rows.length > 0) {
      const call = callResult.rows[0];
      console.log('   - Priority Score:', call.priority_score || 'MISSING');
      console.log('   - Priority Reason:', call.priority_reason || 'MISSING');
      console.log('   - Last Call:', call.last_call_date || 'MISSING');
      console.log('   - Next Call:', call.next_call_date || 'MISSING');
      console.log('   - Status:', call.status || 'MISSING');
    } else {
      console.log('   MISSING: No call prioritization data');
    }
    
    console.log('\n=== DATA QUALITY SUMMARY ===');
    const issues = [];
    
    if (!store.address || store.address === 'Unknown') issues.push('Missing store address');
    if (!store.phone) issues.push('Missing phone number');
    if (!store.email) issues.push('Missing email');
    if (!store.primary_contact_name) issues.push('Missing contact person');
    if (invData.count == 0) issues.push('No historical invoices');
    if (itemData.total_items == 0) issues.push('No invoice items');
    if (predData.count == 0) issues.push('No predicted orders');
    if (callResult.rows.length === 0) issues.push('No call prioritization');
    
    if (issues.length === 0) {
      console.log('✅ ALL DATA COMPLETE - Store is fully configured');
    } else {
      console.log('❌ DATA ISSUES FOUND:');
      issues.forEach(issue => console.log('   - ' + issue));
    }
    
  } catch (error) {
    console.error('Error checking store data:', error);
  } finally {
    await pool.end();
  }
}

checkStoreData();