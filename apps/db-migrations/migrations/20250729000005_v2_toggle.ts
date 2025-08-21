import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("table_scrapeProductList", (table) => {
    table.boolean("v2_algo_only").defaultTo(false).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("table_scrapeProductList", (table) => {
    table.dropColumn("v2_algo_only");
  });
}
