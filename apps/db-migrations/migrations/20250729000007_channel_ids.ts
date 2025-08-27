import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("channel_ids", (table) => {
    table.increments("id").primary();
    table.integer("vendor_id").unsigned().notNullable();
    table.integer("mp_id").unsigned().notNullable();
    table.string("channel_id").notNullable();
    table.timestamps(true, true);
    table.index(["vendor_id", "mp_id"], "vendor_mp_id_index");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("channel_ids");
}
