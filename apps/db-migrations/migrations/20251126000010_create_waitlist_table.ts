import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable("waitlist");
  if (exists) {
    return;
  }

  await knex.schema.createTable("waitlist", (table) => {
    table.increments("id").primary();
    table.integer("mp_id").unsigned().notNullable();
    table.string("vendor_name", 255).notNullable();
    table.integer("old_inventory").unsigned().notNullable();
    table.integer("new_inventory").unsigned().notNullable();
    table.integer("net32_inventory").unsigned().notNullable();
    table.string("api_status", 64).notNullable().defaultTo("pending");
    table.text("message").nullable();
    table.timestamps(true, true);

    table.index(["vendor_name"], "waitlist_vendor_name_idx");
    table.index(["mp_id"], "waitlist_mpid_idx");
    table.index(["api_status"], "waitlist_api_status_idx");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("waitlist");
}
