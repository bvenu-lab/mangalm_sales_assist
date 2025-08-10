import { Knex } from 'knex';

/**
 * Migration to create the roles table
 * ENTERPRISE ROLE-BASED ACCESS CONTROL (RBAC)
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('roles', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Role information
    table.string('name').notNullable().unique();
    table.string('display_name').notNullable();
    table.text('description').nullable();
    table.string('category').notNullable().defaultTo('business'); // system, business, custom
    table.integer('level').notNullable().defaultTo(1); // 1=lowest, 10=highest
    
    // Role configuration
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('is_system_role').notNullable().defaultTo(false);
    table.boolean('is_inheritable').notNullable().defaultTo(true);
    table.json('metadata').nullable();
    
    // Hierarchical roles
    table.uuid('parent_role_id').nullable();
    table.foreign('parent_role_id').references('id').inTable('roles').onDelete('SET NULL');
    
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
    table.string('approval_workflow').nullable();
    
    // Indexes
    table.index(['name'], 'idx_roles_name');
    table.index(['category'], 'idx_roles_category');
    table.index(['level'], 'idx_roles_level');
    table.index(['is_active'], 'idx_roles_active');
    table.index(['is_system_role'], 'idx_roles_system');
    table.index(['parent_role_id'], 'idx_roles_parent');
    table.index(['created_at'], 'idx_roles_created');
    table.index(['deleted_at'], 'idx_roles_deleted');
    
    // Check constraints
    table.check('level >= 1 AND level <= 10', [], 'chk_roles_level_range');
    table.check('version > 0', [], 'chk_roles_version');
  });
}

/**
 * Migration to drop the roles table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('roles');
}