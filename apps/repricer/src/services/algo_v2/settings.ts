import {
  AlgoBadgeIndicator,
  AlgoHandlingTimeGroup,
  AlgoPriceDirection,
  VendorNameLookup,
} from "@repricer-monorepo/shared";
import { getKnexInstance } from "../knex-wrapper";

export interface V2AlgoSettings {
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
  not_cheapest: boolean;
}

export interface V2AlgoSettingsDb {
  id?: number;
  enabled: number;
  mp_id: number;
  vendor_id: number;
  suppress_price_break_if_Q1_not_updated: number;
  suppress_price_break: number;
  compete_on_price_break_only: number;
  up_down: AlgoPriceDirection;
  badge_indicator: AlgoBadgeIndicator;
  execution_priority: number;
  reprice_up_percentage: number;
  compare_q2_with_q1: number;
  compete_with_all_vendors: number;
  reprice_up_badge_percentage: string;
  sister_vendor_ids: string;
  exclude_vendors: string;
  inactive_vendor_id: string;
  handling_time_group: AlgoHandlingTimeGroup;
  keep_position: number;
  inventory_competition_threshold: number;
  reprice_down_percentage: string;
  max_price: string;
  floor_price: string;
  reprice_down_badge_percentage: string;
  floor_compete_with_next: number;
  own_vendor_threshold: number;
  not_cheapest: number;
}

export async function getV2AlgoSettingsByMpId(
  mpId: number,
): Promise<V2AlgoSettingsDb[]> {
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

interface VendorConfig {
  tableName: string;
  vendorId: number;
  vendorName: string;
}

interface SyncResult {
  insertedCount: number;
  updatedCount: number;
  vendorResults: Array<{
    vendorName: string;
    insertedCount: number;
    updatedCount: number;
    error?: string;
  }>;
}

export async function syncVendorSettingsForMpId(
  mpId: number,
): Promise<SyncResult> {
  const knex = getKnexInstance();

  const vendorConfigs: VendorConfig[] = [
    {
      tableName: "table_firstDentDetails",
      vendorId: 20533,
      vendorName: "FirstDent",
    },
    {
      tableName: "table_frontierDetails",
      vendorId: 20722,
      vendorName: "Frontier",
    },
    {
      tableName: "table_mvpDetails",
      vendorId: 20755,
      vendorName: "MVP",
    },
    {
      tableName: "table_topDentDetails",
      vendorId: 20727,
      vendorName: "TopDent",
    },
    {
      tableName: "table_tradentDetails",
      vendorId: 17357,
      vendorName: "Tradent",
    },
  ];

  let totalInserted = 0;
  let totalUpdated = 0;
  const vendorResults: Array<{
    vendorName: string;
    insertedCount: number;
    updatedCount: number;
    error?: string;
  }> = [];

  // Process each vendor in parallel
  const syncPromises = vendorConfigs.map(async (vendorConfig) => {
    try {
      // Check if vendor table exists
      const vendorTableExists = await knex.schema.hasTable(
        vendorConfig.tableName,
      );
      if (!vendorTableExists) {
        return {
          vendorName: vendorConfig.vendorName,
          insertedCount: 0,
          updatedCount: 0,
          error: `Table ${vendorConfig.tableName} does not exist`,
        };
      }

      // Get vendor settings for specific MP ID
      const vendorSettings = await knex(vendorConfig.tableName)
        .where("MpId", mpId)
        .select("*");

      if (vendorSettings.length === 0) {
        return {
          vendorName: vendorConfig.vendorName,
          insertedCount: 0,
          updatedCount: 0,
        };
      }

      // Transform settings for upsert
      const transformedSettings = vendorSettings.map((setting: any) => ({
        mp_id: setting.MpId,
        vendor_id: vendorConfig.vendorId,
        enabled: setting.Activated === 1,
        suppress_price_break_if_Q1_not_updated:
          setting.SuppressPriceBreakForOne === 1,
        suppress_price_break: setting.SuppressPriceBreak === 1,
        compete_on_price_break_only: setting.BeatQPrice === 1,
        up_down:
          setting.RepricingRule === 2
            ? AlgoPriceDirection.UP_DOWN
            : AlgoPriceDirection.DOWN,
        badge_indicator:
          setting.BadgeIndicator === "BADGE_ONLY"
            ? AlgoBadgeIndicator.BADGE
            : AlgoBadgeIndicator.ALL,
        execution_priority: setting.ExecutionPriority || 0,
        reprice_up_percentage: setting.PercentageIncrease || -1,
        compare_q2_with_q1: setting.CompareWithQ1 === 1,
        compete_with_all_vendors: setting.CompeteAll === 1,
        reprice_up_badge_percentage: setting.BadgePercentage || -1,
        sister_vendor_ids: setting.SisterVendorId || "",
        exclude_vendors: setting.ExcludedVendors || "",
        inactive_vendor_id: setting.InactiveVendorId || "",
        handling_time_group: setting.HandlingTimeFilter || "ALL",
        keep_position: setting.KeepPosition === 1,
        inventory_competition_threshold: setting.InventoryThreshold || 1,
        reprice_down_percentage:
          Number(setting.PercentageDown) !== 0
            ? Number(setting.PercentageDown) * 100
            : -1,
        floor_price: setting.FloorPrice || 0,
        max_price: setting.MaxPrice || 99999999.99,
        reprice_down_badge_percentage:
          Number(setting.BadgePercentageDown) !== 0
            ? Number(setting.BadgePercentageDown) * 100
            : -1,
        floor_compete_with_next: setting.CompeteWithNext === 1,
        own_vendor_threshold: setting.OwnVendorThreshold || 1,
        not_cheapest: setting.IsNCNeeded === 1,
      }));

      let insertedCount = 0;
      let updatedCount = 0;

      for (const setting of transformedSettings) {
        // Check if record already exists
        const existingRecord = await knex("v2_algo_settings")
          .where({
            mp_id: setting.mp_id,
            vendor_id: setting.vendor_id,
          })
          .first();

        if (existingRecord) {
          // Update existing record
          await knex("v2_algo_settings")
            .where({
              mp_id: setting.mp_id,
              vendor_id: setting.vendor_id,
            })
            .update(setting);
          updatedCount++;
        } else {
          // Insert new record
          await knex("v2_algo_settings").insert(setting);
          insertedCount++;
        }
      }

      return {
        vendorName: vendorConfig.vendorName,
        insertedCount,
        updatedCount,
      };
    } catch (error) {
      return {
        vendorName: vendorConfig.vendorName,
        insertedCount: 0,
        updatedCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Wait for all syncs to complete
  const results = await Promise.all(syncPromises);

  // Aggregate results
  for (const result of results) {
    totalInserted += result.insertedCount;
    totalUpdated += result.updatedCount;
    vendorResults.push(result);
  }

  return {
    insertedCount: totalInserted,
    updatedCount: totalUpdated,
    vendorResults,
  };
}

export async function getAllProductsWithAlgoData(): Promise<any[]> {
  const knex = getKnexInstance();

  const query = knex("v2_algo_settings as vas")
    .leftJoin("channel_ids as ci", function () {
      this.on("vas.mp_id", "=", "ci.mp_id").andOn(
        "vas.vendor_id",
        "=",
        "ci.vendor_id",
      );
    })
    .leftJoin("table_scrapeProductList as spl", function () {
      this.on("vas.mp_id", "=", "spl.MpId");
    })
    .leftJoin(
      function () {
        this.select(
          "mp_id",
          "vendor_id",
          "triggered_by_vendor",
          "cron_name",
          "created_at",
        )
          .from("v2_algo_results as var1")
          .where("price_update_result", "=", "OK")
          .whereIn(["mp_id", "vendor_id", "created_at"], function () {
            this.select(
              "mp_id",
              "vendor_id",
              knex.raw("MAX(created_at) as created_at"),
            )
              .from("v2_algo_results")
              .where("price_update_result", "=", "OK")
              .groupBy("mp_id", "vendor_id");
          })
          .as("latest_updated_result");
      },
      function () {
        this.on("vas.mp_id", "=", "latest_updated_result.mp_id").andOn(
          "vas.vendor_id",
          "=",
          "latest_updated_result.vendor_id",
        );
      },
    )
    .leftJoin(
      function () {
        this.select(
          "mp_id",
          "vendor_id",
          "created_at",
          "cron_name",
          "comment",
          "suggested_price",
          "result",
          "triggered_by_vendor",
        )
          .from("v2_algo_results as var2")
          .whereIn(["mp_id", "vendor_id", "created_at"], function () {
            this.select(
              "mp_id",
              "vendor_id",
              knex.raw("MAX(created_at) as created_at"),
            )
              .from("v2_algo_results")
              .groupBy("mp_id", "vendor_id");
          })
          .as("latest_cron_run");
      },
      function () {
        this.on("vas.mp_id", "=", "latest_cron_run.mp_id").andOn(
          "vas.vendor_id",
          "=",
          "latest_cron_run.vendor_id",
        );
      },
    );

  const results = await query
    .select(
      // V2 algo settings fields (main table)
      "vas.floor_price",
      "vas.max_price",
      "vas.not_cheapest",
      "vas.enabled",
      "vas.vendor_id",
      "vas.mp_id",
      "vas.suppress_price_break_if_Q1_not_updated",
      // Channel IDs fields
      "ci.channel_id",
      // Scrape product list fields (if they exist)
      "spl.Net32Url as net32_url",
      "spl.RegularCronName as cron_name",
      "spl.SlowCronName as slow_cron_name",
      "spl.algo_execution_mode",
      // Latest successful algo results fields (if they exist)
      "latest_updated_result.cron_name as last_updated_cron_name",
      "latest_updated_result.created_at as last_updated_at",
      // Latest cron run fields (regardless of status)
      // "latest_cron_run.*",
      "latest_cron_run.created_at as last_cron_run_at",
      "latest_cron_run.cron_name as last_cron_run_name",
      "latest_cron_run.comment as last_reprice_comment",
      "latest_cron_run.suggested_price as last_suggested_price",
      "latest_cron_run.result",
      "latest_cron_run.triggered_by_vendor",
    )
    .orderBy(["vas.mp_id", "vas.vendor_id"]);

  return results.map((result) => ({
    ...result,
    channel_name:
      VendorNameLookup[result.vendor_id] || `Vendor ${result.vendor_id}`,
  }));
}

export async function toggleV2AlgoEnabled(
  mpId: number,
  vendorId: number,
): Promise<{ enabled: boolean }> {
  const knex = getKnexInstance();

  // First, check if settings exist
  const currentSetting = await knex("v2_algo_settings")
    .where({ mp_id: mpId, vendor_id: vendorId })
    .select("enabled")
    .first();

  if (!currentSetting) {
    // Settings don't exist, create them with enabled = true
    const defaultSettings = {
      mp_id: mpId,
      vendor_id: vendorId,
      enabled: true, // Start enabled when creating new settings
    };

    await knex("v2_algo_settings").insert(defaultSettings);
    return { enabled: true };
  }

  // Settings exist, toggle the enabled status
  const newEnabledStatus = !currentSetting.enabled;

  // Update the database
  await knex("v2_algo_settings")
    .where({ mp_id: mpId, vendor_id: vendorId })
    .update({ enabled: newEnabledStatus });

  return { enabled: newEnabledStatus };
}

export async function getNet32Url(mpId: number): Promise<string | null> {
  const knex = getKnexInstance();

  const result = await knex("table_scrapeProductList")
    .where("MpId", mpId)
    .select("Net32Url")
    .first();

  return result?.Net32Url || null;
}
