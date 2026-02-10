import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("service_toggles", (table) => {
    table.string("service_name", 100).primary();
    table.boolean("is_enabled").notNullable().defaultTo(true);
  });

  await knex("service_toggles").insert({
    service_name: "direct-scrape-monitor",
    is_enabled: true,
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("service_toggles");
}
