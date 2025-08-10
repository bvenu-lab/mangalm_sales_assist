import { Knex } from 'knex';

/**
 * Migration to create the historical_invoices table
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('historical_invoices', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Invoice information
    table.string('invoice_number').notNullable().unique();
    table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    table.date('invoice_date').notNullable();
    table.date('due_date').notNullable();
    table.date('paid_date').nullable();
    
    // Financial information
    table.decimal('subtotal', 14, 2).notNullable();
    table.decimal('tax_amount', 14, 2).notNullable();
    table.decimal('shipping_amount', 14, 2).notNullable().defaultTo(0);
    table.decimal('discount_amount', 14, 2).notNullable().defaultTo(0);
    table.decimal('total_amount', 14, 2).notNullable();
    table.string('currency').notNullable().defaultTo('USD');
    
    // Payment information
    table.string('payment_status').notNullable().defaultTo('pending');
    table.string('payment_method').nullable();
    table.string('payment_reference').nullable();
    table.string('payment_terms').nullable();
    
    // Shipping information
    table.string('shipping_method').nullable();
    table.string('tracking_number').nullable();
    table.date('shipped_date').nullable();
    table.string('shipping_address').nullable();
    table.string('shipping_city').nullable();
    table.string('shipping_state').nullable();
    table.string('shipping_postal_code').nullable();
    table.string('shipping_country').nullable();
    
    // Sales information
    table.uuid('sales_rep_id').nullable();
    table.string('sales_region').nullable();
    table.string('sales_territory').nullable();
    table.string('order_source').nullable();
    table.string('order_channel').nullable();
    
    // Status and metadata
    table.string('status').notNullable().defaultTo('issued');
    table.text('notes').nullable();
    table.boolean('is_recurring').notNullable().defaultTo(false);
    table.string('recurrence_pattern').nullable();
    table.string('external_reference').nullable();
    table.string('zoho_invoice_id').nullable();
    
    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['invoice_number'], 'idx_historical_invoices_number');
    table.index(['store_id'], 'idx_historical_invoices_store');
    table.index(['invoice_date'], 'idx_historical_invoices_date');
    table.index(['payment_status'], 'idx_historical_invoices_payment_status');
    table.index(['status'], 'idx_historical_invoices_status');
    table.index(['sales_rep_id'], 'idx_historical_invoices_sales_rep');
    table.index(['sales_region', 'sales_territory'], 'idx_historical_invoices_region');
    table.index(['zoho_invoice_id'], 'idx_historical_invoices_zoho');
  });
}

/**
 * Migration to drop the historical_invoices table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('historical_invoices');
}
