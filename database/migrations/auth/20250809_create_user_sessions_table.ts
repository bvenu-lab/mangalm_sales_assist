import { Knex } from 'knex';

/**
 * Migration to create the user_sessions table
 * ENTERPRISE SESSION MANAGEMENT
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_sessions', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Session identification
    table.string('session_token').notNullable().unique();
    table.string('refresh_token').nullable().unique();
    table.string('device_fingerprint').nullable();
    
    // User association
    table.uuid('user_id').notNullable();
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // Session metadata
    table.string('user_agent').nullable();
    table.string('ip_address').notNullable();
    table.string('device_type').nullable(); // mobile, desktop, tablet, api
    table.string('browser').nullable();
    table.string('os').nullable();
    table.string('location').nullable(); // City, Country
    table.json('metadata').nullable();
    
    // Session lifecycle
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.timestamp('last_activity_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('terminated_at').nullable();
    table.string('termination_reason').nullable(); // logout, timeout, forced, security
    
    // Session status
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('is_suspicious').notNullable().defaultTo(false);
    table.text('suspicious_reasons').nullable();
    table.integer('activity_count').notNullable().defaultTo(0);
    
    // Security features
    table.boolean('requires_mfa').notNullable().defaultTo(false);
    table.boolean('mfa_verified').notNullable().defaultTo(false);
    table.timestamp('mfa_verified_at').nullable();
    table.boolean('is_elevated').notNullable().defaultTo(false); // High-privilege session
    table.timestamp('elevated_until').nullable();
    
    // Audit trail (ENTERPRISE REQUIRED)
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.integer('version').notNullable().defaultTo(1);
    
    // Compliance fields (ENTERPRISE REQUIRED)
    table.string('data_classification').notNullable().defaultTo('confidential');
    table.timestamp('anonymization_date').nullable();
    
    // Indexes
    table.index(['session_token'], 'idx_sessions_token');
    table.index(['refresh_token'], 'idx_sessions_refresh');
    table.index(['user_id'], 'idx_sessions_user');
    table.index(['ip_address'], 'idx_sessions_ip');
    table.index(['device_fingerprint'], 'idx_sessions_device');
    table.index(['expires_at'], 'idx_sessions_expires');
    table.index(['last_activity_at'], 'idx_sessions_activity');
    table.index(['is_active'], 'idx_sessions_active');
    table.index(['is_suspicious'], 'idx_sessions_suspicious');
    table.index(['device_type'], 'idx_sessions_device_type');
    table.index(['created_at'], 'idx_sessions_created');
    table.index(['terminated_at'], 'idx_sessions_terminated');
    
    // Check constraints
    table.check('expires_at > created_at', [], 'chk_sessions_expires');
    table.check('last_activity_at >= created_at', [], 'chk_sessions_activity');
    table.check('terminated_at IS NULL OR terminated_at >= created_at', [], 'chk_sessions_terminated');
    table.check('activity_count >= 0', [], 'chk_sessions_activity_count');
    table.check('version > 0', [], 'chk_sessions_version');
  });
}

/**
 * Migration to drop the user_sessions table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('user_sessions');
}