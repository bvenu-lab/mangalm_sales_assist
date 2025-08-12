const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mangalm_sales',
  password: 'postgres',
  port: 5432,
});

async function fixStoresTable() {
  try {
    console.log('Adding missing columns to stores table...');
    
    // Add missing columns one by one (PostgreSQL doesn't support adding multiple columns in one ALTER TABLE)
    const columnsToAdd = [
      { name: 'code', type: 'VARCHAR(50)', constraint: 'UNIQUE' },
      { name: 'address', type: 'VARCHAR(255)' },
      { name: 'postal_code', type: 'VARCHAR(20)' },
      { name: 'country', type: 'VARCHAR(100) DEFAULT \'USA\'' },
      { name: 'phone', type: 'VARCHAR(50)' },
      { name: 'email', type: 'VARCHAR(100)' },
      { name: 'website', type: 'VARCHAR(255)' },
      { name: 'type', type: 'VARCHAR(50) DEFAULT \'retail\'' },
      { name: 'category', type: 'VARCHAR(100)' },
      { name: 'size', type: 'VARCHAR(50)' },
      { name: 'square_footage', type: 'DECIMAL(10,2)' },
      { name: 'tax_id', type: 'VARCHAR(50)' },
      { name: 'business_license', type: 'VARCHAR(100)' },
      { name: 'license_expiry', type: 'DATE' },
      { name: 'primary_contact_name', type: 'VARCHAR(100)' },
      { name: 'primary_contact_phone', type: 'VARCHAR(50)' },
      { name: 'primary_contact_email', type: 'VARCHAR(100)' },
      { name: 'secondary_contact_name', type: 'VARCHAR(100)' },
      { name: 'secondary_contact_phone', type: 'VARCHAR(50)' },
      { name: 'secondary_contact_email', type: 'VARCHAR(100)' },
      { name: 'sales_region', type: 'VARCHAR(100)' },
      { name: 'sales_territory', type: 'VARCHAR(100)' },
      { name: 'assigned_sales_rep_id', type: 'VARCHAR(50)' },
      { name: 'is_active', type: 'BOOLEAN DEFAULT true' },
      { name: 'onboarding_date', type: 'DATE' },
      { name: 'last_order_date', type: 'DATE' },
      { name: 'lifetime_value', type: 'DECIMAL(14,2)' },
      { name: 'credit_limit', type: 'DECIMAL(14,2)' },
      { name: 'payment_terms', type: 'VARCHAR(100)' },
      { name: 'preferred_shipping_method', type: 'VARCHAR(100)' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' }
    ];
    
    for (const column of columnsToAdd) {
      try {
        // Check if column exists
        const checkQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'stores' AND column_name = $1
        `;
        const exists = await pool.query(checkQuery, [column.name]);
        
        if (exists.rows.length === 0) {
          // Add column
          let query = `ALTER TABLE stores ADD COLUMN ${column.name} ${column.type}`;
          await pool.query(query);
          console.log(`Added column: ${column.name}`);
          
          // Add unique constraint if needed
          if (column.constraint === 'UNIQUE' && column.name === 'code') {
            // First generate unique codes for existing records
            const stores = await pool.query('SELECT id, name FROM stores WHERE code IS NULL');
            for (let i = 0; i < stores.rows.length; i++) {
              const store = stores.rows[i];
              const code = `${store.name.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(4, '0')}`;
              await pool.query('UPDATE stores SET code = $1 WHERE id = $2', [code, store.id]);
            }
            // Then add the unique constraint
            await pool.query('ALTER TABLE stores ADD CONSTRAINT stores_code_unique UNIQUE (code)');
            console.log(`Added unique constraint for: ${column.name}`);
          }
        } else {
          console.log(`Column already exists: ${column.name}`);
        }
      } catch (err) {
        console.error(`Error adding column ${column.name}:`, err.message);
      }
    }
    
    // Update existing records with default values for required fields
    console.log('\nUpdating existing records with default values...');
    
    const updateQueries = [
      `UPDATE stores SET address = '123 Main St' WHERE address IS NULL OR address = ''`,
      `UPDATE stores SET postal_code = '00000' WHERE postal_code IS NULL OR postal_code = ''`,
      `UPDATE stores SET phone = '000-000-0000' WHERE phone IS NULL OR phone = ''`,
      `UPDATE stores SET primary_contact_name = 'Store Manager' WHERE primary_contact_name IS NULL`,
      `UPDATE stores SET size = 'medium' WHERE size IS NULL`,
      `UPDATE stores SET sales_region = state WHERE sales_region IS NULL AND state IS NOT NULL AND state != ''`,
      `UPDATE stores SET city = 'Unknown City' WHERE city IS NULL OR city = ''`,
      `UPDATE stores SET state = 'Unknown State' WHERE state IS NULL OR state = ''`
    ];
    
    for (const query of updateQueries) {
      try {
        const result = await pool.query(query);
        console.log(`Updated ${result.rowCount} records: ${query.substring(0, 50)}...`);
      } catch (err) {
        console.error(`Error updating records:`, err.message);
      }
    }
    
    // Create indexes for better performance
    console.log('\nCreating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(name)',
      'CREATE INDEX IF NOT EXISTS idx_stores_location ON stores(city, state)',
      'CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_stores_sales_region ON stores(sales_region)'
    ];
    
    for (const index of indexes) {
      try {
        await pool.query(index);
        console.log(`Created index: ${index.match(/idx_\w+/)[0]}`);
      } catch (err) {
        console.error(`Error creating index:`, err.message);
      }
    }
    
    console.log('\nStores table structure fixed successfully!');
    
    // Verify the fix
    const sampleStore = await pool.query('SELECT * FROM stores LIMIT 1');
    if (sampleStore.rows.length > 0) {
      console.log('\nSample store after fix:');
      console.log(JSON.stringify(sampleStore.rows[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error fixing stores table:', error);
  } finally {
    await pool.end();
  }
}

fixStoresTable();