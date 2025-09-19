import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("vendor_thresholds", (table) => {
    table.increments("id").primary();
    table.integer("vendor_id").unsigned().notNullable();
    table.decimal("threshold", 10, 2).notNullable();
    table.decimal("standard_shipping", 10, 2).notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("vendor_thresholds");
}
