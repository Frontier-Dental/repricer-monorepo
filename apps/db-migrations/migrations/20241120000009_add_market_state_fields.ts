import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const vendorTables = [
    'table_tradentDetails',
    'table_frontierDetails',
    'table_mvpDetails',
    'table_topDentDetails',
    'table_firstDentDetails',
    'table_triadDetails'
  ];

  for (const tableName of vendorTables) {
    await knex.schema.alterTable(tableName, (table) => {
      table.boolean('CurrentInStock').nullable().defaultTo(null);
      table.integer('CurrentInventory').nullable().defaultTo(null);
      table.decimal('OurLastPrice', 10, 2).nullable().defaultTo(null);
      table.timestamp('MarketStateUpdatedAt').nullable().defaultTo(null);

      // Add index for quick filtering by stock status
      table.index('CurrentInStock', `idx_${tableName}_in_stock`);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const vendorTables = [
    'table_tradentDetails',
    'table_frontierDetails',
    'table_mvpDetails',
    'table_topDentDetails',
    'table_firstDentDetails',
    'table_triadDetails'
  ];

  for (const tableName of vendorTables) {
    await knex.schema.alterTable(tableName, (table) => {
      // Drop index first
      table.dropIndex('CurrentInStock', `idx_${tableName}_in_stock`);

      // Then drop columns
      table.dropColumn('CurrentInStock');
      table.dropColumn('CurrentInventory');
      table.dropColumn('OurLastPrice');
      table.dropColumn('MarketStateUpdatedAt');
    });
  }
}