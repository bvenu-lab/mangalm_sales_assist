import { Knex } from 'knex';

/**
 * Migration to add audit trail fields to stores table
 * ENTERPRISE AUDIT REQUIREMENTS
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('stores', (table) => {
    // Audit trail fields (ENTERPRISE REQUIRED)
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.timestamp('deleted_at').nullable();
    table.uuid('deleted_by').nullable();
    table.integer('version').notNullable().defaultTo(1);
    
    // Compliance fields (ENTERPRISE REQUIRED)
    table.string('data_classification').notNullable().defaultTo('internal');
    table.string('retention_policy').notNullable().defaultTo('7_years');
    table.boolean('consent_status').notNullable().defaultTo(true);
    table.timestamp('consent_date').nullable();
    table.timestamp('anonymization_date').nullable();
    
    // Business audit fields
    table.string('data_source').notNullable().defaultTo('manual'); // zoho, manual, import, api
    table.string('import_batch_id').nullable();
    table.timestamp('last_validated_at').nullable();
    table.uuid('last_validated_by').nullable();
    table.json('validation_notes').nullable();
    
    // Indexes for audit fields
    table.index(['created_by'], 'idx_stores_created_by');
    table.index(['updated_by'], 'idx_stores_updated_by');
    table.index(['deleted_at'], 'idx_stores_deleted_at');
    table.index(['deleted_by'], 'idx_stores_deleted_by');
    table.index(['version'], 'idx_stores_version');
    table.index(['data_classification'], 'idx_stores_classification');
    table.index(['data_source'], 'idx_stores_source');
    table.index(['import_batch_id'], 'idx_stores_batch');
    table.index(['last_validated_at'], 'idx_stores_validated');
    
    // Check constraints
    table.check('version > 0', [], 'chk_stores_version');
  });
}

/**
 * Migration to remove audit trail fields from stores table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('stores', (table) => {
    // Drop indexes first
    table.dropIndex(['created_by'], 'idx_stores_created_by');
    table.dropIndex(['updated_by'], 'idx_stores_updated_by');
    table.dropIndex(['deleted_at'], 'idx_stores_deleted_at');
    table.dropIndex(['deleted_by'], 'idx_stores_deleted_by');
    table.dropIndex(['version'], 'idx_stores_version');
    table.dropIndex(['data_classification'], 'idx_stores_classification');
    table.dropIndex(['data_source'], 'idx_stores_source');
    table.dropIndex(['import_batch_id'], 'idx_stores_batch');
    table.dropIndex(['last_validated_at'], 'idx_stores_validated');
    
    // Drop columns
    table.dropColumn('created_by');
    table.dropColumn('updated_by');
    table.dropColumn('deleted_at');
    table.dropColumn('deleted_by');
    table.dropColumn('version');
    table.dropColumn('data_classification');
    table.dropColumn('retention_policy');
    table.dropColumn('consent_status');
    table.dropColumn('consent_date');
    table.dropColumn('anonymization_date');
    table.dropColumn('data_source');
    table.dropColumn('import_batch_id');
    table.dropColumn('last_validated_at');
    table.dropColumn('last_validated_by');
    table.dropColumn('validation_notes');
  });
}