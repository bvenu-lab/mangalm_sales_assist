import { Knex } from 'knex';

/**
 * Migration to create the agent_activities table
 * ENTERPRISE SALES AGENT ACTIVITY TRACKING
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('agent_activities', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Agent and store association
    table.uuid('agent_id').notNullable();
    table.uuid('store_id').notNullable();
    table.foreign('agent_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('store_id').references('id').inTable('stores').onDelete('CASCADE');
    
    // Activity details
    table.string('activity_type').notNullable(); // call, visit, email, order, follow_up, meeting
    table.string('activity_subtype').nullable(); // cold_call, scheduled_call, demo, negotiation
    table.string('activity_status').notNullable().defaultTo('completed'); // scheduled, completed, cancelled, no_show
    table.text('activity_description').nullable();
    table.text('activity_notes').nullable();
    table.json('activity_metadata').nullable(); // Call duration, meeting attendees, etc.
    
    // Timing information
    table.timestamp('scheduled_at').nullable();
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.integer('duration_minutes').nullable();
    table.string('timezone').notNullable().defaultTo('UTC');
    
    // Outcome tracking
    table.string('outcome').nullable(); // positive, negative, neutral, follow_up_required
    table.text('outcome_notes').nullable();
    table.boolean('resulted_in_order').notNullable().defaultTo(false);
    table.uuid('related_order_id').nullable(); // Link to orders if applicable
    table.decimal('order_value', 14, 2).nullable();
    table.decimal('pipeline_value_created', 14, 2).nullable();
    
    // Follow-up tracking
    table.boolean('requires_follow_up').notNullable().defaultTo(false);
    table.timestamp('follow_up_date').nullable();
    table.text('follow_up_notes').nullable();
    table.uuid('follow_up_activity_id').nullable(); // Self-reference to follow-up activity
    
    // Location information (for visits)
    table.string('location_type').nullable(); // store, office, virtual, phone
    table.string('location_address').nullable();
    table.decimal('location_latitude', 10, 7).nullable();
    table.decimal('location_longitude', 10, 7).nullable();
    table.boolean('location_verified').notNullable().defaultTo(false);
    
    // Contact information
    table.string('contact_person_name').nullable();
    table.string('contact_person_title').nullable();
    table.string('contact_person_phone').nullable();
    table.string('contact_person_email').nullable();
    table.json('additional_attendees').nullable();
    
    // Performance metrics
    table.integer('quality_score').nullable(); // 1-10 rating
    table.text('quality_notes').nullable();
    table.string('competitive_intelligence').nullable();
    table.json('customer_feedback').nullable();
    
    // AI Assistant integration
    table.boolean('ai_assisted').notNullable().defaultTo(false);
    table.json('ai_recommendations_used').nullable();
    table.json('ai_predictions_accuracy').nullable();
    table.text('ai_insights_generated').nullable();
    
    // Audit trail (ENTERPRISE REQUIRED)
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.timestamp('deleted_at').nullable();
    table.uuid('deleted_by').nullable();
    table.integer('version').notNullable().defaultTo(1);
    
    // Compliance fields (ENTERPRISE REQUIRED)
    table.string('data_classification').notNullable().defaultTo('confidential');
    table.string('retention_policy').notNullable().defaultTo('7_years');
    table.boolean('consent_status').notNullable().defaultTo(true);
    table.timestamp('anonymization_date').nullable();
    
    // Indexes
    table.index(['agent_id'], 'idx_activities_agent');
    table.index(['store_id'], 'idx_activities_store');
    table.index(['activity_type'], 'idx_activities_type');
    table.index(['activity_status'], 'idx_activities_status');
    table.index(['scheduled_at'], 'idx_activities_scheduled');
    table.index(['completed_at'], 'idx_activities_completed');
    table.index(['outcome'], 'idx_activities_outcome');
    table.index(['resulted_in_order'], 'idx_activities_order_result');
    table.index(['requires_follow_up'], 'idx_activities_follow_up');
    table.index(['follow_up_date'], 'idx_activities_follow_up_date');
    table.index(['ai_assisted'], 'idx_activities_ai');
    table.index(['created_at'], 'idx_activities_created');
    table.index(['deleted_at'], 'idx_activities_deleted');
    
    // Composite indexes for performance
    table.index(['agent_id', 'activity_type', 'completed_at'], 'idx_activities_agent_type_date');
    table.index(['store_id', 'activity_type', 'completed_at'], 'idx_activities_store_type_date');
    table.index(['completed_at', 'resulted_in_order'], 'idx_activities_completion_order');
    
    // Check constraints
    table.check('scheduled_at IS NULL OR started_at IS NULL OR started_at >= scheduled_at', [], 'chk_activities_schedule');
    table.check('started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at', [], 'chk_activities_timing');
    table.check('duration_minutes IS NULL OR duration_minutes > 0', [], 'chk_activities_duration');
    table.check('quality_score IS NULL OR (quality_score >= 1 AND quality_score <= 10)', [], 'chk_activities_quality');
    table.check('order_value IS NULL OR order_value >= 0', [], 'chk_activities_order_value');
    table.check('version > 0', [], 'chk_activities_version');
  });
}

/**
 * Migration to drop the agent_activities table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('agent_activities');
}