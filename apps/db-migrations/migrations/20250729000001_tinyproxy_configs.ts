import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("tinyproxy_configs", (table) => {
    table.increments("id").primary();
    table.string("proxy_username").notNullable();
    table.string("proxy_password").notNullable();
    table.string("subscription_key").notNullable();
    table.string("ip").notNullable();
    table.integer("port").unsigned().notNullable();
    table.integer("vendor_id").unsigned().notNullable().index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("tinyproxy_configs");
}
