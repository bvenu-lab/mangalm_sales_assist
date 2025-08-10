import { Knex } from 'knex';

/**
 * Migration to create the permissions table
 * ENTERPRISE GRANULAR PERMISSION SYSTEM
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('permissions', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Permission information
    table.string('name').notNullable().unique();
    table.string('display_name').notNullable();
    table.text('description').nullable();
    table.string('resource').notNullable(); // users, stores, orders, predictions
    table.string('action').notNullable(); // create, read, update, delete, execute
    table.string('scope').notNullable().defaultTo('own'); // own, department, company, all
    
    // Permission categorization
    table.string('category').notNullable(); // security, business, system, api
    table.string('module').notNullable(); // auth, sales, analytics, admin
    table.integer('risk_level').notNullable().defaultTo(1); // 1=low, 5=critical
    
    // Permission configuration
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('is_system_permission').notNullable().defaultTo(false);
    table.boolean('requires_mfa').notNullable().defaultTo(false);
    table.json('conditions').nullable(); // Additional conditions for permission
    table.json('metadata').nullable();
    
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
    table.string('compliance_tags').nullable(); // SOX, GDPR, HIPAA
    
    // Indexes
    table.index(['name'], 'idx_permissions_name');
    table.index(['resource', 'action'], 'idx_permissions_resource_action');
    table.index(['category'], 'idx_permissions_category');
    table.index(['module'], 'idx_permissions_module');
    table.index(['risk_level'], 'idx_permissions_risk');
    table.index(['is_active'], 'idx_permissions_active');
    table.index(['is_system_permission'], 'idx_permissions_system');
    table.index(['requires_mfa'], 'idx_permissions_mfa');
    table.index(['created_at'], 'idx_permissions_created');
    table.index(['deleted_at'], 'idx_permissions_deleted');
    
    // Check constraints
    table.check('risk_level >= 1 AND risk_level <= 5', [], 'chk_permissions_risk_range');
    table.check('version > 0', [], 'chk_permissions_version');
  });
}

/**
 * Migration to drop the permissions table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('permissions');
}