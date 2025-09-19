import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("v2_algo_error", (table) => {
    table.increments("id").primary();
    table.datetime("created_at").notNullable();
    table.text("error").notNullable();
    table.json("net32_json").notNullable();
    table.integer("mp_id").unsigned().notNullable();
    table.string("cron_name").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("v2_algo_error");
}
