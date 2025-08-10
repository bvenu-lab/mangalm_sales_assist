import { Knex } from 'knex';

/**
 * Migration to create the territory_assignments table
 * ENTERPRISE SALES TERRITORY MANAGEMENT
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('territory_assignments', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Territory definition
    table.string('territory_code').notNullable().unique();
    table.string('territory_name').notNullable();
    table.text('territory_description').nullable();
    table.string('territory_type').notNullable().defaultTo('geographic'); // geographic, vertical, strategic
    
    // Assignment details
    table.uuid('assigned_user_id').notNullable();
    table.foreign('assigned_user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('assigned_by').notNullable();
    table.foreign('assigned_by').references('id').inTable('users').onDelete('RESTRICT');
    table.string('assignment_reason').nullable();
    
    // Territory boundaries
    table.json('geographic_boundaries').nullable(); // States, cities, zip codes
    table.json('vertical_industries').nullable(); // Industry codes/names
    table.json('customer_segments').nullable(); // Enterprise, SMB, etc.
    table.decimal('min_revenue_threshold', 14, 2).nullable();
    table.decimal('max_revenue_threshold', 14, 2).nullable();
    
    // Territory metrics
    table.integer('total_stores_assigned').notNullable().defaultTo(0);
    table.integer('active_stores_assigned').notNullable().defaultTo(0);
    table.decimal('territory_potential', 14, 2).nullable();
    table.decimal('current_revenue', 14, 2).notNullable().defaultTo(0);
    table.decimal('revenue_target', 14, 2).nullable();
    table.decimal('achievement_percentage', 5, 2).notNullable().defaultTo(0);
    
    // Territory status
    table.boolean('is_active').notNullable().defaultTo(true);
    table.date('effective_from').notNullable().defaultTo(knex.fn.now());
    table.date('effective_until').nullable();
    table.string('status').notNullable().defaultTo('active'); // active, suspended, transitioning
    
    // Performance tracking
    table.integer('stores_visited_last_30_days').notNullable().defaultTo(0);
    table.integer('orders_generated_last_30_days').notNullable().defaultTo(0);
    table.decimal('revenue_last_30_days', 14, 2).notNullable().defaultTo(0);
    table.timestamp('last_performance_update').nullable();
    
    // Audit trail (ENTERPRISE REQUIRED)
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.timestamp('deleted_at').nullable();
    table.uuid('deleted_by').nullable();
    table.integer('version').notNullable().defaultTo(1);
    
    // Compliance fields (ENTERPRISE REQUIRED)
    table.string('data_classification').notNullable().defaultTo('internal');
    table.string('retention_policy').notNullable().defaultTo('7_years');
    table.boolean('consent_status').notNullable().defaultTo(true);
    
    // Indexes
    table.index(['territory_code'], 'idx_territory_code');
    table.index(['assigned_user_id'], 'idx_territory_user');
    table.index(['assigned_by'], 'idx_territory_assigned_by');
    table.index(['territory_type'], 'idx_territory_type');
    table.index(['is_active'], 'idx_territory_active');
    table.index(['status'], 'idx_territory_status');
    table.index(['effective_from', 'effective_until'], 'idx_territory_temporal');
    table.index(['current_revenue'], 'idx_territory_revenue');
    table.index(['achievement_percentage'], 'idx_territory_achievement');
    table.index(['created_at'], 'idx_territory_created');
    table.index(['deleted_at'], 'idx_territory_deleted');
    
    // Check constraints
    table.check('effective_until IS NULL OR effective_until > effective_from', [], 'chk_territory_temporal');
    table.check('total_stores_assigned >= 0', [], 'chk_territory_stores');
    table.check('active_stores_assigned <= total_stores_assigned', [], 'chk_territory_active_stores');
    table.check('current_revenue >= 0', [], 'chk_territory_revenue');
    table.check('achievement_percentage >= 0', [], 'chk_territory_achievement');
    table.check('version > 0', [], 'chk_territory_version');
  });
}

/**
 * Migration to drop the territory_assignments table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('territory_assignments');
}