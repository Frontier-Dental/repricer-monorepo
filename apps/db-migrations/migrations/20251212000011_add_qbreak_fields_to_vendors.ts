import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const vendorTables = ["table_tradentDetails", "table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_firstDentDetails", "table_triadDetails", "table_biteSupplyDetails"];

  for (const tableName of vendorTables) {
    await knex.schema.alterTable(tableName, (table) => {
      table.integer("QBreakCount").nullable().defaultTo(null);
      table.text("QBreakDetails").nullable().defaultTo(null);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const vendorTables = ["table_tradentDetails", "table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_firstDentDetails", "table_triadDetails", "table_biteSupplyDetails"];

  for (const tableName of vendorTables) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn("QBreakCount");
      table.dropColumn("QBreakDetails");
    });
  }
}
