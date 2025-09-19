import type { Knex } from "knex";
import { AlgoExecutionMode } from "@repricer-monorepo/shared";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("table_scrapeProductList", (table) => {
    table
      .enum("algo_execution_mode", [
        AlgoExecutionMode.V2_ONLY,
        AlgoExecutionMode.V1_ONLY,
        AlgoExecutionMode.V2_EXECUTE_V1_DRY,
        AlgoExecutionMode.V1_EXECUTE_V2_DRY,
      ])
      .notNullable()
      .defaultTo(AlgoExecutionMode.V1_EXECUTE_V2_DRY);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("table_scrapeProductList", (table) => {
    table.dropColumn("algo_execution_mode");
  });
}
