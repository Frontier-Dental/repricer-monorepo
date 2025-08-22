import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("v2_algo_settings", (table) => {
    table.boolean("enabled").defaultTo(false).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("v2_algo_settings", (table) => {
    table.dropColumn("enabled");
  });
}
