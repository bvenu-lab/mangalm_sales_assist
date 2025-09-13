#!/usr/bin/env node

/**
 * Test Data Population Script for Mangalm Sales Assistant
 *
 * This script generates realistic test data for development and testing.
 * It should NEVER be run in production.
 */

const { Client } = require('pg');

// Database connection configuration
const dbConfig = {
  host: 'localhost',
  port: 3432,
  database: 'mangalm_sales',
  user: 'mangalm',
  password: 'mangalm123'
};

// Test data templates
const stores = [
  {
    id: '4261931000000094375',
    name: 'India Sweet and Spices Portland',
    address: '1620 NW Bethany Ct, Beaverton, OR',
    phone: '503-690-0499',
    email: 'contact@indiasweetspices.com',
    region: 'Portland'
  },
  {
    id: '4261931000000095135',
    name: 'Raja Indian Cuisine',
    address: '123 Main St, Portland, OR',
    phone: '503-555-0123',
    email: 'info@rajacuisine.com',
    region: 'Portland'
  },
  {
    id: '4261931000000092001',
    name: 'Rangoli Sweets',
    address: '456 Oak Ave, Seattle, WA',
    phone: '206-555-0456',
    email: 'orders@rangolisweets.com',
    region: 'Seattle'
  },
  {
    id: '4261931000000327001',
    name: 'New Indian Supermarket',
    address: '789 Pine St, San Francisco, CA',
    phone: '415-555-0789',
    email: 'contact@newindianmarket.com',
    region: 'Bay Area'
  },
  {
    id: '4261931000000106125',
    name: 'Bazaar Indian Market',
    address: '321 Elm St, Los Angeles, CA',
    phone: '213-555-0321',
    email: 'info@bazaar.com',
    region: 'Los Angeles'
  }
];

const products = [
  { name: 'Basmati Rice 10lb', category: 'Grains', price: 15.99 },
  { name: 'Turmeric Powder 200g', category: 'Spices', price: 4.99 },
  { name: 'Cardamom Pods 50g', category: 'Spices', price: 12.99 },
  { name: 'Ghee Pure 500ml', category: 'Dairy', price: 8.99 },
  { name: 'Curry Leaves Fresh', category: 'Fresh', price: 2.99 },
  { name: 'Tamarind Paste 400g', category: 'Condiments', price: 5.99 },
  { name: 'Coconut Oil 500ml', category: 'Oils', price: 7.99 },
  { name: 'Lentils Red 2lb', category: 'Legumes', price: 6.99 },
  { name: 'Chickpea Flour 2lb', category: 'Flours', price: 4.99 },
  { name: 'Jaggery Block 500g', category: 'Sweeteners', price: 3.99 }
];

class TestDataGenerator {
  constructor() {
    this.client = new Client(dbConfig);
  }

  async connect() {
    await this.client.connect();
    console.log('Connected to database');
  }

  async disconnect() {
    await this.client.end();
    console.log('Disconnected from database');
  }

  async clearExistingData() {
    console.log('Clearing existing test data...');

    // Clear in proper order to respect foreign keys
    const clearQueries = [
      'DELETE FROM user_actions',
      'DELETE FROM realtime_sync_queue',
      'DELETE FROM dashboard_settings',
      'DELETE FROM upselling_recommendations',
      'DELETE FROM product_associations',
      'DELETE FROM predicted_order_items',
      'DELETE FROM predicted_orders',
      'DELETE FROM sales_forecasts',
      'DELETE FROM model_performance',
      'DELETE FROM order_patterns',
      'DELETE FROM call_prioritization',
      'DELETE FROM store_preferences',
      'DELETE FROM customer_segments',
      'DELETE FROM invoice_items',
      'DELETE FROM orders',
      'DELETE FROM mangalam_invoices',
      'DELETE FROM products',
      'DELETE FROM stores'
    ];

    for (const query of clearQueries) {
      try {
        await this.client.query(query);
      } catch (error) {
        // Ignore table not exists errors
        if (!error.message.includes('does not exist')) {
          console.warn(`Warning clearing data: ${error.message}`);
        }
      }
    }

    // Reset sequences
    const resetQueries = [
      'ALTER SEQUENCE IF EXISTS mangalam_invoices_id_seq RESTART WITH 1',
      'ALTER SEQUENCE IF EXISTS orders_id_seq RESTART WITH 1'
    ];

    for (const query of resetQueries) {
      try {
        await this.client.query(query);
      } catch (error) {
        console.warn(`Warning resetting sequence: ${error.message}`);
      }
    }

    console.log('Existing data cleared');
  }

  async populateStores() {
    console.log('Populating stores...');

    for (const store of stores) {
      try {
        await this.client.query(`
          INSERT INTO stores (id, name, address, phone, email, region)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `, [store.id, store.name, store.address, store.phone, store.email, store.region]);
      } catch (error) {
        console.error(`Error inserting store ${store.name}: ${error.message}`);
      }
    }

    console.log(`${stores.length} stores populated`);
  }

  async populateProducts() {
    console.log('Populating products...');

    for (const product of products) {
      try {
        await this.client.query(`
          INSERT INTO products (name, category, price, created_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (name) DO NOTHING
        `, [product.name, product.category, product.price]);
      } catch (error) {
        console.error(`Error inserting product ${product.name}: ${error.message}`);
      }
    }

    console.log(`${products.length} products populated`);
  }

  async populateInvoices() {
    console.log('Generating invoices...');

    let invoiceCount = 0;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6); // Start 6 months ago

    for (const store of stores) {
      // Generate 10-20 invoices per store over the last 6 months
      const numInvoices = 10 + Math.floor(Math.random() * 10);

      for (let i = 0; i < numInvoices; i++) {
        const invoiceDate = new Date(startDate.getTime() + Math.random() * (Date.now() - startDate.getTime()));
        const invoiceNumber = `INV-${store.id.slice(-6)}-${String(i + 1).padStart(3, '0')}`;

        // Random selection of products (1-5 items per invoice)
        const numItems = 1 + Math.floor(Math.random() * 5);
        const selectedProducts = [];
        const usedProducts = new Set();

        while (selectedProducts.length < numItems) {
          const product = products[Math.floor(Math.random() * products.length)];
          if (!usedProducts.has(product.name)) {
            usedProducts.add(product.name);
            const quantity = 1 + Math.floor(Math.random() * 5);
            selectedProducts.push({
              ...product,
              quantity,
              total: product.price * quantity
            });
          }
        }

        const totalAmount = selectedProducts.reduce((sum, item) => sum + item.total, 0);

        try {
          // Insert invoice
          const result = await this.client.query(`
            INSERT INTO mangalam_invoices (
              invoice_number, customer_name, customer_id, invoice_date,
              total, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING id
          `, [invoiceNumber, store.name, store.id, invoiceDate, totalAmount.toFixed(2)]);

          const invoiceId = result.rows[0].id;

          // Insert invoice items
          for (const item of selectedProducts) {
            await this.client.query(`
              INSERT INTO invoice_items (
                invoice_id, product_name, quantity, unit_price, total_price, created_at
              )
              VALUES ($1, $2, $3, $4, $5, NOW())
            `, [invoiceId, item.name, item.quantity, item.price, item.total]);
          }

          invoiceCount++;

        } catch (error) {
          console.error(`Error creating invoice for ${store.name}: ${error.message}`);
        }
      }
    }

    console.log(`${invoiceCount} invoices with items generated`);
  }

  async generatePredictedOrders() {
    console.log('Generating predicted orders...');

    let predictedCount = 0;

    for (const store of stores) {
      // Generate 2-3 predicted orders per store
      const numPredictions = 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < numPredictions; i++) {
        const predictionDate = new Date();
        predictionDate.setDate(predictionDate.getDate() + 1 + Math.floor(Math.random() * 14)); // 1-14 days in future

        const confidence = 0.65 + Math.random() * 0.3; // 65-95% confidence
        const priority = confidence > 0.85 ? 'high' : confidence > 0.75 ? 'medium' : 'low';

        // Random items for prediction
        const numItems = 1 + Math.floor(Math.random() * 4);
        const predictedItems = [];

        for (let j = 0; j < numItems; j++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const quantity = 1 + Math.floor(Math.random() * 3);
          predictedItems.push({
            product_name: product.name,
            quantity,
            price: product.price,
            total: product.price * quantity
          });
        }

        const totalAmount = predictedItems.reduce((sum, item) => sum + item.total, 0);

        try {
          await this.client.query(`
            INSERT INTO predicted_orders (
              store_id, predicted_date, confidence, priority, total_amount,
              items, status, manual_verification_required, ai_recommendation,
              prediction_model, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          `, [
            store.id,
            predictionDate,
            confidence,
            priority,
            totalAmount,
            JSON.stringify(predictedItems),
            'pending',
            confidence < 0.8,
            'Based on historical purchasing patterns and seasonal trends',
            'time_series_v1'
          ]);

          predictedCount++;

        } catch (error) {
          console.error(`Error creating predicted order for ${store.name}: ${error.message}`);
        }
      }
    }

    console.log(`${predictedCount} predicted orders generated`);
  }

  async generateCallPrioritization() {
    console.log('Generating call prioritization data...');

    for (const store of stores) {
      try {
        // Get recent invoice data for this store
        const result = await this.client.query(`
          SELECT
            MAX(invoice_date) as last_order_date,
            AVG(CAST(total AS DECIMAL)) as avg_order_value,
            COUNT(*) as order_count
          FROM mangalam_invoices
          WHERE customer_name = $1 AND invoice_date > NOW() - INTERVAL '90 days'
        `, [store.name]);

        const data = result.rows[0];
        const lastOrderDate = data.last_order_date;
        const avgOrderValue = parseFloat(data.avg_order_value || 0);
        const daysSinceLastOrder = lastOrderDate ?
          Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)) : 90;

        // Calculate priority score based on recency and value
        let priorityScore = 1;
        if (daysSinceLastOrder > 30) priorityScore += 3;
        if (daysSinceLastOrder > 14) priorityScore += 2;
        if (avgOrderValue > 50) priorityScore += 2;
        if (avgOrderValue > 100) priorityScore += 2;
        priorityScore = Math.min(10, priorityScore); // Cap at 10

        const scheduledDate = new Date();
        if (priorityScore >= 8) {
          // High priority - call today
          scheduledDate.setDate(scheduledDate.getDate());
        } else if (priorityScore >= 5) {
          // Medium priority - call within 3 days
          scheduledDate.setDate(scheduledDate.getDate() + Math.floor(Math.random() * 3));
        } else {
          // Low priority - call within a week
          scheduledDate.setDate(scheduledDate.getDate() + 3 + Math.floor(Math.random() * 4));
        }

        await this.client.query(`
          INSERT INTO call_prioritization (
            store_id, priority_score, last_order_date, days_since_last_order,
            average_order_value, call_status, scheduled_call_date, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (store_id) DO UPDATE SET
            priority_score = EXCLUDED.priority_score,
            last_order_date = EXCLUDED.last_order_date,
            days_since_last_order = EXCLUDED.days_since_last_order,
            average_order_value = EXCLUDED.average_order_value,
            scheduled_call_date = EXCLUDED.scheduled_call_date,
            updated_at = NOW()
        `, [store.id, priorityScore, lastOrderDate, daysSinceLastOrder, avgOrderValue, 'pending', scheduledDate]);

      } catch (error) {
        console.error(`Error creating call prioritization for ${store.name}: ${error.message}`);
      }
    }

    console.log('Call prioritization data generated');
  }

  async generateOrders() {
    console.log('Generating recent orders...');

    let orderCount = 0;

    for (const store of stores) {
      // Generate 3-5 recent orders (last 30 days) and 2-3 pending orders (future)
      const recentOrders = 3 + Math.floor(Math.random() * 3);
      const pendingOrders = 2 + Math.floor(Math.random() * 2);

      // Recent completed orders
      for (let i = 0; i < recentOrders; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30));

        const deliveryDate = new Date(orderDate);
        deliveryDate.setDate(deliveryDate.getDate() + 2);

        const orderValue = 50 + Math.random() * 200; // $50-250

        try {
          await this.client.query(`
            INSERT INTO orders (
              id, store_id, order_date, total_amount, status, order_number,
              customer_name, delivery_date, payment_status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          `, [
            require('crypto').randomUUID(),
            store.id,
            orderDate,
            orderValue,
            'completed',
            `ORD-${Date.now()}-${i}`,
            store.name,
            deliveryDate,
            'paid'
          ]);

          orderCount++;

        } catch (error) {
          console.error(`Error creating completed order for ${store.name}: ${error.message}`);
        }
      }

      // Pending future orders
      for (let i = 0; i < pendingOrders; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() + 1 + Math.floor(Math.random() * 7));

        const deliveryDate = new Date(orderDate);
        deliveryDate.setDate(deliveryDate.getDate() + 2 + Math.floor(Math.random() * 3));

        const orderValue = 75 + Math.random() * 150; // $75-225

        try {
          await this.client.query(`
            INSERT INTO orders (
              id, store_id, order_date, total_amount, status, order_number,
              customer_name, delivery_date, payment_status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          `, [
            require('crypto').randomUUID(),
            store.id,
            orderDate,
            orderValue,
            'pending',
            `ORD-${Date.now()}-P${i}`,
            store.name,
            deliveryDate,
            'pending'
          ]);

          orderCount++;

        } catch (error) {
          console.error(`Error creating pending order for ${store.name}: ${error.message}`);
        }
      }
    }

    console.log(`${orderCount} orders generated`);
  }

  async refreshMaterializedViews() {
    console.log('Refreshing materialized views...');

    try {
      await this.client.query('REFRESH MATERIALIZED VIEW IF EXISTS dashboard_summary');
      console.log('Materialized views refreshed');
    } catch (error) {
      console.warn('Warning refreshing materialized views:', error.message);
    }
  }

  async generateTestData() {
    try {
      console.log('🚀 Starting test data generation...');
      console.log('⚠️  This will clear existing data and generate fresh test data');

      await this.connect();
      await this.clearExistingData();
      await this.populateStores();
      await this.populateProducts();
      await this.populateInvoices();
      await this.generatePredictedOrders();
      await this.generateCallPrioritization();
      await this.generateOrders();
      await this.refreshMaterializedViews();

      console.log('✅ Test data generation completed successfully!');
      console.log('');
      console.log('Generated data summary:');
      console.log(`• ${stores.length} stores`);
      console.log(`• ${products.length} products`);
      console.log('• ~50-100 historical invoices');
      console.log('• ~10-15 predicted orders');
      console.log('• ~25-40 recent/pending orders');
      console.log('• Call prioritization data for all stores');
      console.log('');
      console.log('🌐 Access the application at: http://localhost:3000');

    } catch (error) {
      console.error('❌ Error generating test data:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const generator = new TestDataGenerator();
  generator.generateTestData();
}

module.exports = TestDataGenerator;