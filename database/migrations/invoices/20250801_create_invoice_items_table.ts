import { Knex } from 'knex';

/**
 * Migration to create the invoice_items table
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('invoice_items', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Relationships
    table.uuid('invoice_id').notNullable().references('id').inTable('historical_invoices').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    
    // Item information
    table.string('sku').notNullable();
    table.string('name').notNullable();
    table.text('description').nullable();
    
    // Quantity and pricing
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 14, 2).notNullable();
    table.decimal('discount_percentage', 5, 2).notNullable().defaultTo(0);
    table.decimal('discount_amount', 14, 2).notNullable().defaultTo(0);
    table.decimal('tax_percentage', 5, 2).notNullable().defaultTo(0);
    table.decimal('tax_amount', 14, 2).notNullable().defaultTo(0);
    table.decimal('subtotal', 14, 2).notNullable();
    table.decimal('total', 14, 2).notNullable();
    
    // Additional information
    table.string('unit_of_measure').nullable();
    table.string('tax_code').nullable();
    table.string('discount_reason').nullable();
    table.integer('line_number').notNullable();
    table.boolean('is_taxable').notNullable().defaultTo(true);
    table.string('notes').nullable();
    
    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['invoice_id'], 'idx_invoice_items_invoice');
    table.index(['product_id'], 'idx_invoice_items_product');
    table.index(['sku'], 'idx_invoice_items_sku');
  });
}

/**
 * Migration to drop the invoice_items table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('invoice_items');
}
