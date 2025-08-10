import { Knex } from 'knex';

/**
 * Migration to create the user_roles table
 * ENTERPRISE USER-ROLE ASSIGNMENTS
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_roles', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Foreign keys
    table.uuid('user_id').notNullable();
    table.uuid('role_id').notNullable();
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
    
    // Assignment details
    table.string('assignment_type').notNullable().defaultTo('direct'); // direct, inherited, temporary
    table.text('assignment_reason').nullable();
    table.uuid('assigned_by').notNullable();
    table.foreign('assigned_by').references('id').inTable('users').onDelete('RESTRICT');
    
    // Temporal assignments
    table.timestamp('effective_from').notNullable().defaultTo(knex.fn.now());
    table.timestamp('effective_until').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    
    // Scope restrictions
    table.string('scope_type').nullable(); // department, territory, store, global
    table.json('scope_values').nullable(); // Array of scope IDs
    table.json('conditions').nullable(); // Additional conditions
    
    // Emergency access
    table.boolean('is_emergency_access').notNullable().defaultTo(false);
    table.string('emergency_justification').nullable();
    table.timestamp('emergency_expires_at').nullable();
    
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
    table.boolean('requires_approval').notNullable().defaultTo(false);
    table.string('approval_status').nullable(); // pending, approved, rejected
    table.uuid('approved_by').nullable();
    table.timestamp('approved_at').nullable();
    
    // Unique constraint - user can have role only once per scope
    table.unique(['user_id', 'role_id', 'scope_type'], 'uk_user_roles_unique');
    
    // Indexes
    table.index(['user_id'], 'idx_user_roles_user');
    table.index(['role_id'], 'idx_user_roles_role');
    table.index(['assigned_by'], 'idx_user_roles_assigned_by');
    table.index(['assignment_type'], 'idx_user_roles_type');
    table.index(['effective_from', 'effective_until'], 'idx_user_roles_temporal');
    table.index(['is_active'], 'idx_user_roles_active');
    table.index(['is_emergency_access'], 'idx_user_roles_emergency');
    table.index(['approval_status'], 'idx_user_roles_approval');
    table.index(['created_at'], 'idx_user_roles_created');
    table.index(['deleted_at'], 'idx_user_roles_deleted');
    
    // Check constraints
    table.check('effective_until IS NULL OR effective_until > effective_from', [], 'chk_user_roles_temporal');
    table.check('is_emergency_access = false OR emergency_expires_at IS NOT NULL', [], 'chk_user_roles_emergency');
    table.check('version > 0', [], 'chk_user_roles_version');
  });
}

/**
 * Migration to drop the user_roles table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('user_roles');
}