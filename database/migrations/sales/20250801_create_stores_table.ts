import { Knex } from 'knex';

/**
 * Migration to create the stores table
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('stores', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Store information
    table.string('name').notNullable();
    table.string('code').notNullable().unique();
    table.string('address').notNullable();
    table.string('city').notNullable();
    table.string('state').notNullable();
    table.string('postal_code').notNullable();
    table.string('country').notNullable().defaultTo('USA');
    table.string('phone').nullable();
    table.string('email').nullable();
    table.string('website').nullable();
    
    // Store classification
    table.string('type').notNullable().defaultTo('retail');
    table.string('category').nullable();
    table.string('size').nullable();
    table.decimal('square_footage', 10, 2).nullable();
    
    // Business information
    table.string('tax_id').nullable();
    table.string('business_license').nullable();
    table.date('license_expiry').nullable();
    
    // Contact information
    table.string('primary_contact_name').nullable();
    table.string('primary_contact_phone').nullable();
    table.string('primary_contact_email').nullable();
    table.string('secondary_contact_name').nullable();
    table.string('secondary_contact_phone').nullable();
    table.string('secondary_contact_email').nullable();
    
    // Sales information
    table.string('sales_region').nullable();
    table.string('sales_territory').nullable();
    table.string('assigned_sales_rep_id').nullable();
    
    // Status and metadata
    table.boolean('is_active').notNullable().defaultTo(true);
    table.date('onboarding_date').nullable();
    table.date('last_order_date').nullable();
    table.decimal('lifetime_value', 14, 2).nullable();
    table.decimal('credit_limit', 14, 2).nullable();
    table.string('payment_terms').nullable();
    table.string('preferred_shipping_method').nullable();
    
    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['name'], 'idx_stores_name');
    table.index(['code'], 'idx_stores_code');
    table.index(['city', 'state'], 'idx_stores_location');
    table.index(['sales_region', 'sales_territory'], 'idx_stores_sales_region');
    table.index(['assigned_sales_rep_id'], 'idx_stores_sales_rep');
    table.index(['is_active'], 'idx_stores_active');
    table.index(['last_order_date'], 'idx_stores_last_order');
  });
}

/**
 * Migration to drop the stores table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('stores');
}
