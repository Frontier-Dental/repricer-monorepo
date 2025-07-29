import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("v2_algo_execution", (table) => {
    table.increments("id").primary();
    table.integer("scrape_product_id").notNullable();
    table.datetime("time").notNullable();
    table.binary("chain_of_thought_html").notNullable();
    table.text("comment").notNullable();

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
