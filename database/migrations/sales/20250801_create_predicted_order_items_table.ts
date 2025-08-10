import { Knex } from 'knex';

/**
 * Migration to create the predicted_order_items table
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('predicted_order_items', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Relationships
    table.uuid('predicted_order_id').notNullable().references('id').inTable('predicted_orders').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    
    // Item information
    table.string('sku').notNullable();
    table.string('name').notNullable();
    
    // Prediction information
    table.integer('predicted_quantity').notNullable();
    table.decimal('confidence_score', 5, 2).notNullable();
    table.string('prediction_basis').notNullable();
    table.integer('historical_avg_quantity').nullable();
    table.integer('seasonal_adjustment').nullable();
    table.integer('trend_adjustment').nullable();
    
    // Pricing information
    table.decimal('unit_price', 14, 2).notNullable();
    table.decimal('subtotal', 14, 2).notNullable();
    
    // Status and metadata
    table.boolean('is_confirmed').notNullable().defaultTo(false);
    table.integer('confirmed_quantity').nullable();
    table.uuid('actual_order_item_id').nullable();
    table.decimal('accuracy_score', 5, 2).nullable();
    table.text('notes').nullable();
    
    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['predicted_order_id'], 'idx_predicted_order_items_order');
    table.index(['product_id'], 'idx_predicted_order_items_product');
    table.index(['sku'], 'idx_predicted_order_items_sku');
    table.index(['confidence_score'], 'idx_predicted_order_items_confidence');
    table.index(['is_confirmed'], 'idx_predicted_order_items_confirmed');
    table.index(['actual_order_item_id'], 'idx_predicted_order_items_actual');
  });
}

/**
 * Migration to drop the predicted_order_items table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('predicted_order_items');
}
