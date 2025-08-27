import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create the new v2_algo_results table
  await knex.schema.createTable("v2_algo_results", (table) => {
    table.increments("id").primary();
    table.string("job_id", 36).notNullable().index();
    table.decimal("suggested_price", 10, 2);
    table.decimal("lowest_price", 10, 2);
    table.decimal("lowest_vendor_id").unsigned();
    table.text("comment").notNullable();
    table.string("triggered_by_vendor", 255);
    table.string("result", 255).notNullable().index();
    table.integer("quantity").unsigned().notNullable();
    table.integer("vendor_id").unsigned().notNullable().index();
    table.integer("mp_id").unsigned().notNullable();
    table.string("cron_name", 255).notNullable().index();
    table.boolean("q_break_valid").notNullable();
    table.string("price_update_result", 255);
    table.string("new_price_breaks", 255).nullable();
    table.timestamps(true, true);

    // Add indexes for common query patterns
    table.index(["mp_id", "vendor_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop the v2_algo_results table
  await knex.schema.dropTableIfExists("v2_algo_results");
}
