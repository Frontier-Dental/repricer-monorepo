import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`ALTER TABLE v2_algo_settings MODIFY COLUMN handling_time_group ENUM('ALL', 'FAST_SHIPPING', 'STOCKED', 'LONG_HANDLING', 'ONE_TO_TEN_DAYS', 'MIN_ELEVEN_DAYS') NOT NULL DEFAULT 'ALL'`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`ALTER TABLE v2_algo_settings MODIFY COLUMN handling_time_group ENUM('ALL', 'FAST_SHIPPING', 'STOCKED', 'LONG_HANDLING') NOT NULL DEFAULT 'ALL'`);
}
