import { getKnexInstance } from "../knex-wrapper";

export interface V2AlgoSettings {
  id?: number;
  mp_id: number;
  vendor_id: number;
  suppress_price_break_if_Q1_not_updated: boolean;
  suppress_price_break: boolean;
  compete_on_price_break_only: boolean;
  up_down: "UP" | "UP/DOWN" | "DOWN";
  badge_indicator: "ALL" | "BADGE";
  execution_priority: number;
  reprice_up_percentage: number;
  compare_q2_with_q1: boolean;
  compete_with_all_vendors: boolean;
  reprice_up_badge_percentage: number;
  sister_vendor_ids: string;
  exclude_vendors: string;
  inactive_vendor_id: string;
  handling_time_group: boolean;
  keep_position: boolean;
  inventory_competition_threshold: number;
  reprice_down_percentage: number;
  max_price: number;
  floor_price: number;
  reprice_down_badge_percentage: number;
  floor_compete_with_next: boolean;
  compete_with_own_quantity_0: boolean;
  not_cheapest: boolean;
}

export async function getV2AlgoSettingsByMpId(
  mpId: number,
): Promise<V2AlgoSettings[]> {
  const knex = getKnexInstance();

  const settings = await knex("v2_algo_settings")
    .where("mp_id", mpId)
    .select("*")
    .orderBy("vendor_id");

  return settings;
}

export async function updateV2AlgoSettings(
  settings: V2AlgoSettings,
): Promise<number> {
  const knex = getKnexInstance();

  if (settings.id) {
    // Update existing settings
    await knex("v2_algo_settings").where("id", settings.id).update(settings);
    return settings.id;
  } else {
    // Insert new settings
    const [insertId] = await knex("v2_algo_settings").insert(settings);
    return insertId;
  }
}

export async function createV2AlgoSettings(
  settings: V2AlgoSettings,
): Promise<number> {
  const knex = getKnexInstance();

  const [insertId] = await knex("v2_algo_settings").insert(settings);
  return insertId;
}
