import { Knex } from 'knex';

/**
 * Migration to create the users table
 * ENTERPRISE AUTHENTICATION SYSTEM
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Authentication fields
    table.string('username').notNullable().unique();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('password_salt').notNullable();
    
    // Personal information
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    // Full name will be computed at application level, not database level
    table.string('full_name').nullable();
    table.string('phone').nullable();
    table.string('avatar_url').nullable();
    
    // Employment information
    table.string('employee_id').nullable().unique();
    table.string('department').nullable();
    table.string('job_title').nullable();
    table.string('manager_id').nullable();
    table.string('office_location').nullable();
    table.date('hire_date').nullable();
    table.date('termination_date').nullable();
    
    // Account status
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('is_verified').notNullable().defaultTo(false);
    table.boolean('is_locked').notNullable().defaultTo(false);
    table.integer('failed_login_attempts').notNullable().defaultTo(0);
    table.timestamp('last_login_at').nullable();
    table.string('last_login_ip').nullable();
    table.timestamp('password_changed_at').nullable();
    table.boolean('must_change_password').notNullable().defaultTo(false);
    
    // Two-factor authentication
    table.boolean('two_factor_enabled').notNullable().defaultTo(false);
    table.string('two_factor_secret').nullable();
    table.text('recovery_codes').nullable(); // JSON array of backup codes
    
    // API access
    table.string('api_key').nullable().unique();
    table.timestamp('api_key_expires_at').nullable();
    table.boolean('api_access_enabled').notNullable().defaultTo(false);
    
    // Preferences
    table.string('timezone').notNullable().defaultTo('UTC');
    table.string('language').notNullable().defaultTo('en');
    table.string('theme').notNullable().defaultTo('light');
    table.json('notification_preferences').nullable();
    table.json('ui_preferences').nullable();
    
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
    table.timestamp('consent_date').nullable();
    table.timestamp('anonymization_date').nullable();
    
    // Indexes
    table.index(['username'], 'idx_users_username');
    table.index(['email'], 'idx_users_email');
    table.index(['employee_id'], 'idx_users_employee_id');
    table.index(['is_active'], 'idx_users_active');
    table.index(['is_locked'], 'idx_users_locked');
    table.index(['department'], 'idx_users_department');
    table.index(['manager_id'], 'idx_users_manager');
    table.index(['last_login_at'], 'idx_users_last_login');
    table.index(['created_at'], 'idx_users_created');
    table.index(['deleted_at'], 'idx_users_deleted');
    
    // Full-text search index - use composite index instead
    table.index(['first_name', 'last_name', 'email'], 'idx_users_search');
    
    // Check constraints
    table.check('LENGTH(password_hash) >= 60', [], 'chk_users_password_length'); // bcrypt minimum
    table.check('email ~* \'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$\'', [], 'chk_users_email_format');
    table.check('failed_login_attempts >= 0', [], 'chk_users_failed_attempts');
    table.check('version > 0', [], 'chk_users_version');
  });
}

/**
 * Migration to drop the users table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users');
}