import {
  AlgoBadgeIndicator,
  AlgoHandlingTimeGroup,
  AlgoPriceDirection,
  AlgoPriceStrategy,
} from "@repricer-monorepo/shared";
import {
  getKnexInstance,
  destroyKnexInstance,
} from "../../model/sql-models/knex-wrapper";

export interface V2AlgoSettingsData {
  id?: number;
  mp_id: number;
  vendor_id: number;
  suppress_price_break_if_Q1_not_updated: boolean;
  suppress_price_break: boolean;
  compete_on_price_break_only: boolean;
  up_down: AlgoPriceDirection;
  badge_indicator: AlgoBadgeIndicator;
  execution_priority: number;
  reprice_up_percentage: number;
  compare_q2_with_q1: boolean;
  compete_with_all_vendors: boolean;
  reprice_up_badge_percentage: number;
  sister_vendor_ids: string;
  exclude_vendors: string;
  inactive_vendor_id: string;
  handling_time_group: AlgoHandlingTimeGroup;
  keep_position: boolean;
  inventory_competition_threshold: number;
  reprice_down_percentage: number;
  max_price: number;
  floor_price: number;
  reprice_down_badge_percentage: number;
  floor_compete_with_next: boolean;
  own_vendor_threshold: number;
  price_strategy: AlgoPriceStrategy;
  enabled: boolean;
}

export async function findV2AlgoSettings(
  mpId: number,
  vendorId: number,
): Promise<V2AlgoSettingsData | null> {
  const knex = getKnexInstance();

  const result = await knex("v2_algo_settings")
    .where({ mp_id: mpId, vendor_id: vendorId })
    .first();
  //destroyKnexInstance();
  return result || null;
}

export async function createV2AlgoSettings(
  mpId: number,
  vendorId: number,
): Promise<V2AlgoSettingsData> {
  const knex = getKnexInstance();

  const defaultSettings: Omit<V2AlgoSettingsData, "id"> = {
    mp_id: mpId,
    vendor_id: vendorId,
    suppress_price_break_if_Q1_not_updated: false,
    suppress_price_break: false,
    compete_on_price_break_only: false,
    up_down: AlgoPriceDirection.UP_DOWN,
    badge_indicator: AlgoBadgeIndicator.ALL,
    execution_priority: 0,
    reprice_up_percentage: -1,
    compare_q2_with_q1: false,
    compete_with_all_vendors: false,
    reprice_up_badge_percentage: -1,
    sister_vendor_ids: "",
    exclude_vendors: "",
    inactive_vendor_id: "",
    handling_time_group: AlgoHandlingTimeGroup.ALL,
    keep_position: false,
    max_price: 99999999.99,
    floor_price: 0,
    inventory_competition_threshold: 1,
    reprice_down_percentage: -1,
    reprice_down_badge_percentage: -1,
    floor_compete_with_next: false,
    own_vendor_threshold: 1,
    price_strategy: AlgoPriceStrategy.UNIT,
    enabled: false,
  };

  const [insertId] = await knex("v2_algo_settings").insert(defaultSettings);
  //destroyKnexInstance();
  return {
    id: insertId,
    ...defaultSettings,
  };
}

export async function findOrCreateV2AlgoSettings(
  mpId: number,
  vendorId: number,
): Promise<V2AlgoSettingsData> {
  let settings = await findV2AlgoSettings(mpId, vendorId);

  if (!settings) {
    settings = await createV2AlgoSettings(mpId, vendorId);
  }

  return settings;
}

export async function findOrCreateV2AlgoSettingsForVendors(
  mpId: number,
  vendorIds: number[],
): Promise<V2AlgoSettingsData[]> {
  const settingsPromises = vendorIds.map((vendorId) =>
    findOrCreateV2AlgoSettings(mpId, vendorId),
  );
  return Promise.all(settingsPromises);
}
