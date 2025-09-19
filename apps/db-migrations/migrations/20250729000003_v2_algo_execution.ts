import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("v2_algo_execution", (table) => {
    table.increments("id").primary();
    table.integer("scrape_product_id").notNullable();
    table.datetime("created_at").notNullable();
    table.datetime("expires_at").notNullable();
    table.specificType("chain_of_thought_html", "MEDIUMBLOB").notNullable();
    table.integer("mp_id").notNullable().index();
    table.integer("vendor_id").notNullable().index();
    table.string("job_id", 36).notNullable().index();
    table.foreign("job_id").references("job_id").inTable("v2_algo_results");

    // Foreign key constraint
    table
      .foreign("scrape_product_id")
      .references("Id")
      .inTable("table_scrapeProductList");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("v2_algo_execution");
}
