import type { Knex } from "knex";
import {
  AlgoPriceDirection,
  AlgoPriceStrategy,
} from "@repricer-monorepo/shared";
import { AlgoBadgeIndicator } from "@repricer-monorepo/shared";
import { AlgoHandlingTimeGroup } from "@repricer-monorepo/shared";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("v2_algo_settings", (table) => {
    table.increments("id").primary();
    table.integer("mp_id").notNullable().index();
    table.integer("vendor_id").notNullable().index();
    table
      .boolean("suppress_price_break_if_Q1_not_updated")
      .notNullable()
      .defaultTo(false);
    table.boolean("suppress_price_break").notNullable().defaultTo(false);
    table.boolean("compete_on_price_break_only").notNullable().defaultTo(false);
    table
      .enum("up_down", [
        AlgoPriceDirection.UP,
        AlgoPriceDirection.UP_DOWN,
        AlgoPriceDirection.DOWN,
      ])
      .notNullable()
      .defaultTo(AlgoPriceDirection.UP_DOWN);
    table
      .enum("badge_indicator", [
        AlgoBadgeIndicator.ALL,
        AlgoBadgeIndicator.BADGE,
      ])
      .notNullable()
      .defaultTo(AlgoBadgeIndicator.ALL);
    table.integer("execution_priority").unsigned().notNullable().defaultTo(0);
    table.decimal("reprice_up_percentage", 10, 2).notNullable().defaultTo(-1);
    table.boolean("compare_q2_with_q1").notNullable().defaultTo(false);
    table.boolean("compete_with_all_vendors").notNullable().defaultTo(false);
    table
      .decimal("reprice_up_badge_percentage", 10, 2)
      .notNullable()
      .defaultTo(-1);
    table.string("sister_vendor_ids").notNullable().defaultTo("");
    table.string("exclude_vendors").notNullable().defaultTo("");
    table.string("inactive_vendor_id").notNullable().defaultTo("");
    table
      .enum("handling_time_group", [
        AlgoHandlingTimeGroup.ALL,
        AlgoHandlingTimeGroup.FAST_SHIPPING,
        AlgoHandlingTimeGroup.STOCKED,
        AlgoHandlingTimeGroup.LONG_HANDLING,
      ])
      .notNullable()
      .defaultTo(AlgoHandlingTimeGroup.ALL);
    table.boolean("keep_position").notNullable().defaultTo(false);
    table
      .integer("inventory_competition_threshold")
      .unsigned()
      .notNullable()
      .defaultTo(1);
    table.decimal("reprice_down_percentage", 10, 2).notNullable().defaultTo(-1);
    table.decimal("floor_price", 10, 2).notNullable().defaultTo(0);
    table.decimal("max_price", 10, 2).notNullable().defaultTo(99999999.99);
    table
      .decimal("reprice_down_badge_percentage", 10, 2)
      .notNullable()
      .defaultTo(-1);
    table.boolean("floor_compete_with_next").notNullable().defaultTo(false);
    table.integer("own_vendor_threshold").unsigned().notNullable().defaultTo(1);
    table
      .enum("price_strategy", [
        AlgoPriceStrategy.UNIT,
        AlgoPriceStrategy.TOTAL,
        AlgoPriceStrategy.BUY_BOX,
      ])
      .notNullable()
      .defaultTo(AlgoPriceStrategy.UNIT);
    table.boolean("enabled").notNullable().defaultTo(false);
    table.decimal("target_price", 10, 2);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("v2_algo_settings");
}
