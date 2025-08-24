import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("v2_algo_results", (table) => {
    table.string("new_price_breaks", 255).nullable();
    table.string("sister_position_check", 255).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("v2_algo_results", (table) => {
    table.dropColumn("new_price_breaks");
    table.dropColumn("sister_position_check");
  });
}
