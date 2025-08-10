import { Knex } from 'knex';

/**
 * Migration to create the products table
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('products', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Product information
    table.string('name').notNullable();
    table.string('sku').notNullable().unique();
    table.string('upc').nullable().unique();
    table.text('description').nullable();
    table.string('brand').nullable();
    table.string('manufacturer').nullable();
    
    // Product categorization
    table.string('category').notNullable();
    table.string('subcategory').nullable();
    table.string('product_line').nullable();
    table.string('product_type').nullable();
    table.string('tags').nullable();
    
    // Product specifications
    table.string('size').nullable();
    table.string('color').nullable();
    table.string('material').nullable();
    table.string('dimensions').nullable();
    table.decimal('weight', 10, 2).nullable();
    table.string('weight_unit').nullable();
    
    // Pricing information
    table.decimal('base_price', 14, 2).notNullable();
    table.decimal('wholesale_price', 14, 2).notNullable();
    table.decimal('msrp', 14, 2).nullable();
    table.decimal('cost', 14, 2).nullable();
    table.decimal('margin_percentage', 5, 2).nullable();
    table.string('currency').notNullable().defaultTo('USD');
    
    // Inventory information
    table.integer('stock_quantity').notNullable().defaultTo(0);
    table.integer('reorder_point').nullable();
    table.integer('reorder_quantity').nullable();
    table.string('warehouse_location').nullable();
    table.string('bin_location').nullable();
    
    // Status and metadata
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('is_featured').notNullable().defaultTo(false);
    table.boolean('is_taxable').notNullable().defaultTo(true);
    table.decimal('tax_rate', 5, 2).nullable();
    table.date('release_date').nullable();
    table.date('discontinue_date').nullable();
    
    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['name'], 'idx_products_name');
    table.index(['sku'], 'idx_products_sku');
    table.index(['category', 'subcategory'], 'idx_products_category');
    table.index(['brand'], 'idx_products_brand');
    table.index(['is_active'], 'idx_products_active');
    table.index(['base_price'], 'idx_products_price');
    table.index(['stock_quantity'], 'idx_products_stock');
  });
}

/**
 * Migration to drop the products table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('products');
}
