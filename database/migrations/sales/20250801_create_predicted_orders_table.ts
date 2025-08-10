import { Knex } from 'knex';

/**
 * Migration to create the predicted_orders table
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('predicted_orders', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Relationships
    table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    
    // Prediction information
    table.date('predicted_date').notNullable();
    table.date('order_window_start').notNullable();
    table.date('order_window_end').notNullable();
    table.decimal('predicted_total', 14, 2).notNullable();
    table.decimal('confidence_score', 5, 2).notNullable();
    table.string('prediction_model').notNullable();
    table.string('prediction_version').notNullable();
    
    // Order information
    table.string('order_type').notNullable().defaultTo('regular');
    table.string('order_frequency').nullable();
    table.string('order_channel').nullable();
    table.string('shipping_method').nullable();
    table.string('payment_terms').nullable();
    
    // Status and metadata
    table.string('status').notNullable().defaultTo('predicted');
    table.boolean('is_confirmed').notNullable().defaultTo(false);
    table.date('confirmation_date').nullable();
    table.uuid('confirmed_by').nullable();
    table.uuid('actual_order_id').nullable();
    table.decimal('accuracy_score', 5, 2).nullable();
    table.text('notes').nullable();
    
    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['store_id'], 'idx_predicted_orders_store');
    table.index(['predicted_date'], 'idx_predicted_orders_date');
    table.index(['order_window_start', 'order_window_end'], 'idx_predicted_orders_window');
    table.index(['confidence_score'], 'idx_predicted_orders_confidence');
    table.index(['status'], 'idx_predicted_orders_status');
    table.index(['is_confirmed'], 'idx_predicted_orders_confirmed');
    table.index(['actual_order_id'], 'idx_predicted_orders_actual');
  });
}

/**
 * Migration to drop the predicted_orders table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('predicted_orders');
}
