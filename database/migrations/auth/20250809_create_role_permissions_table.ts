import { Knex } from 'knex';

/**
 * Migration to create the role_permissions table
 * ENTERPRISE ROLE-PERMISSION ASSIGNMENTS
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('role_permissions', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Foreign keys
    table.uuid('role_id').notNullable();
    table.uuid('permission_id').notNullable();
    table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
    table.foreign('permission_id').references('id').inTable('permissions').onDelete('CASCADE');
    
    // Assignment details
    table.string('assignment_type').notNullable().defaultTo('direct'); // direct, inherited
    table.text('assignment_reason').nullable();
    table.uuid('assigned_by').notNullable();
    
    // Permission overrides
    table.boolean('is_granted').notNullable().defaultTo(true); // true=grant, false=deny
    table.string('scope_override').nullable(); // Override permission scope
    table.json('conditions_override').nullable(); // Override permission conditions
    table.json('metadata').nullable();
    
    // Temporal assignments
    table.timestamp('effective_from').notNullable().defaultTo(knex.fn.now());
    table.timestamp('effective_until').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    
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
    
    // Unique constraint - role can have permission only once
    table.unique(['role_id', 'permission_id'], 'uk_role_permissions_unique');
    
    // Indexes
    table.index(['role_id'], 'idx_role_permissions_role');
    table.index(['permission_id'], 'idx_role_permissions_permission');
    table.index(['assigned_by'], 'idx_role_permissions_assigned_by');
    table.index(['assignment_type'], 'idx_role_permissions_type');
    table.index(['is_granted'], 'idx_role_permissions_granted');
    table.index(['effective_from', 'effective_until'], 'idx_role_permissions_temporal');
    table.index(['is_active'], 'idx_role_permissions_active');
    table.index(['approval_status'], 'idx_role_permissions_approval');
    table.index(['created_at'], 'idx_role_permissions_created');
    table.index(['deleted_at'], 'idx_role_permissions_deleted');
    
    // Check constraints
    table.check('effective_until IS NULL OR effective_until > effective_from', [], 'chk_role_permissions_temporal');
    table.check('version > 0', [], 'chk_role_permissions_version');
  });
}

/**
 * Migration to drop the role_permissions table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('role_permissions');
}