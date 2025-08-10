import { Knex } from 'knex';

/**
 * Migration to create the sales_agent_performance table
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('sales_agent_performance', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Agent information
    table.uuid('agent_id').notNullable();
    table.string('agent_name').notNullable();
    table.string('agent_email').notNullable();
    table.string('agent_role').notNullable();
    table.string('agent_region').nullable();
    table.string('agent_territory').nullable();
    
    // Time period
    table.date('period_start').notNullable();
    table.date('period_end').notNullable();
    table.string('period_type').notNullable().defaultTo('monthly');
    
    // Performance metrics
    table.integer('calls_made').notNullable().defaultTo(0);
    table.integer('calls_scheduled').notNullable().defaultTo(0);
    table.integer('calls_completed').notNullable().defaultTo(0);
    table.integer('calls_resulting_in_orders').notNullable().defaultTo(0);
    table.decimal('call_conversion_rate', 5, 2).notNullable().defaultTo(0);
    table.decimal('avg_call_duration_minutes', 5, 2).nullable();
    
    // Order metrics
    table.integer('orders_taken').notNullable().defaultTo(0);
    table.integer('predicted_orders_confirmed').notNullable().defaultTo(0);
    table.integer('unpredicted_orders_created').notNullable().defaultTo(0);
    table.decimal('total_order_value', 14, 2).notNullable().defaultTo(0);
    table.decimal('avg_order_value', 14, 2).notNullable().defaultTo(0);
    table.decimal('predicted_order_accuracy', 5, 2).nullable();
    
    // Store metrics
    table.integer('stores_managed').notNullable().defaultTo(0);
    table.integer('active_stores').notNullable().defaultTo(0);
    table.integer('stores_with_orders').notNullable().defaultTo(0);
    table.decimal('store_engagement_rate', 5, 2).notNullable().defaultTo(0);
    
    // Product metrics
    table.integer('unique_products_sold').notNullable().defaultTo(0);
    table.integer('new_products_introduced').notNullable().defaultTo(0);
    table.decimal('cross_sell_rate', 5, 2).nullable();
    table.decimal('upsell_rate', 5, 2).nullable();
    
    // Performance scores
    table.decimal('efficiency_score', 5, 2).nullable();
    table.decimal('effectiveness_score', 5, 2).nullable();
    table.decimal('customer_satisfaction_score', 5, 2).nullable();
    table.decimal('overall_performance_score', 5, 2).nullable();
    
    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['agent_id'], 'idx_sales_agent_performance_agent');
    table.index(['period_start', 'period_end'], 'idx_sales_agent_performance_period');
    table.index(['period_type'], 'idx_sales_agent_performance_period_type');
    table.index(['agent_region', 'agent_territory'], 'idx_sales_agent_performance_region');
    table.index(['overall_performance_score'], 'idx_sales_agent_performance_score');
    
    // Unique constraint
    table.unique(['agent_id', 'period_start', 'period_end', 'period_type'], 'uq_sales_agent_performance_period');
  });
}

/**
 * Migration to drop the sales_agent_performance table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('sales_agent_performance');
}
