import { Knex } from 'knex';

/**
 * Migration to create the call_prioritization table
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('call_prioritization', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Relationships
    table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    table.uuid('predicted_order_id').nullable().references('id').inTable('predicted_orders').onDelete('SET NULL');
    
    // Prioritization information
    table.integer('priority_score').notNullable();
    table.string('priority_level').notNullable();
    table.date('recommended_call_date').notNullable();
    table.string('recommended_time_window').nullable();
    table.string('reason_code').notNullable();
    table.text('reason_description').nullable();
    
    // Prediction factors
    table.decimal('days_since_last_order', 5, 1).nullable();
    table.decimal('order_probability', 5, 2).nullable();
    table.decimal('predicted_order_value', 14, 2).nullable();
    table.decimal('lifetime_value_factor', 5, 2).nullable();
    table.decimal('seasonal_factor', 5, 2).nullable();
    table.decimal('trend_factor', 5, 2).nullable();
    
    // Call information
    table.boolean('is_called').notNullable().defaultTo(false);
    table.date('call_date').nullable();
    table.string('call_outcome').nullable();
    table.uuid('called_by').nullable();
    table.text('call_notes').nullable();
    table.integer('call_duration_seconds').nullable();
    table.boolean('resulted_in_order').notNullable().defaultTo(false);
    table.uuid('resulting_order_id').nullable();
    
    // Status and metadata
    table.string('status').notNullable().defaultTo('pending');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.string('assigned_to').nullable();
    table.date('assignment_date').nullable();
    table.text('notes').nullable();
    
    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['store_id'], 'idx_call_prioritization_store');
    table.index(['predicted_order_id'], 'idx_call_prioritization_order');
    table.index(['priority_score'], 'idx_call_prioritization_score');
    table.index(['priority_level'], 'idx_call_prioritization_level');
    table.index(['recommended_call_date'], 'idx_call_prioritization_date');
    table.index(['is_called'], 'idx_call_prioritization_called');
    table.index(['status'], 'idx_call_prioritization_status');
    table.index(['is_active'], 'idx_call_prioritization_active');
    table.index(['assigned_to'], 'idx_call_prioritization_assigned');
  });
}

/**
 * Migration to drop the call_prioritization table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('call_prioritization');
}
