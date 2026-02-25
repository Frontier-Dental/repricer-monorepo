import { AlgoBadgeIndicator, AlgoHandlingTimeGroup, AlgoPriceDirection, AlgoPriceStrategy, VendorNameLookup } from "@repricer-monorepo/shared";
import { getKnexInstance, destroyKnexInstance } from "../knex-wrapper";

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
  price_strategy: AlgoPriceStrategy;
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
  price_strategy: AlgoPriceStrategy;
}

export async function getV2AlgoSettingsByMpId(mpId: number): Promise<V2AlgoSettingsDb[]> {
  const knex = getKnexInstance();

  const settings = await knex("v2_algo_settings").where("mp_id", mpId).select("*").orderBy("vendor_id");
  //destroyKnexInstance();
  return settings;
}

export async function updateV2AlgoSettings(settings: V2AlgoSettings): Promise<number> {
  const knex = getKnexInstance();
  try {
    // Check if settings exist based on mp_id and vendor_id
    const existingSettings = await knex("v2_algo_settings")
      .where({
        mp_id: settings.mp_id,
        vendor_id: settings.vendor_id,
      })
      .first();

    if (existingSettings) {
      // Update existing settings
      await knex("v2_algo_settings")
        .where({
          mp_id: settings.mp_id,
          vendor_id: settings.vendor_id,
        })
        .update(settings);
      return existingSettings.id;
    } else {
      // Insert new settings
      const [insertId] = await knex("v2_algo_settings").insert(settings);
      return insertId;
    }
  } catch (error) {
    console.error("Error updating V2 algo settings:", error);
    return -1;
  } finally {
    //destroyKnexInstance();
  }
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

export async function syncVendorSettingsForMpId(mpId: number): Promise<SyncResult> {
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
    {
      tableName: "table_triadDetails",
      vendorId: 5,
      vendorName: "Triad",
    },
    {
      tableName: "table_biteSupplyDetails",
      vendorId: 20891,
      vendorName: "BiteSupply",
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
      const vendorTableExists = await knex.schema.hasTable(vendorConfig.tableName);
      if (!vendorTableExists) {
        return {
          vendorName: vendorConfig.vendorName,
          insertedCount: 0,
          updatedCount: 0,
          error: `Table ${vendorConfig.tableName} does not exist`,
        };
      }

      // Get vendor settings for specific MP ID
      const vendorSettings = await knex(vendorConfig.tableName).where("MpId", mpId).select("*");

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
        suppress_price_break_if_Q1_not_updated: setting.SuppressPriceBreakForOne === 1,
        suppress_price_break: setting.SuppressPriceBreak === 1,
        compete_on_price_break_only: setting.BeatQPrice === 1,
        up_down: setting.RepricingRule === 2 ? AlgoPriceDirection.UP_DOWN : AlgoPriceDirection.DOWN,
        badge_indicator: setting.BadgeIndicator === "BADGE_ONLY" ? AlgoBadgeIndicator.BADGE : AlgoBadgeIndicator.ALL,
        execution_priority: setting.ExecutionPriority || 0,
        reprice_up_percentage: setting.PercentageIncrease || -1,
        compare_q2_with_q1: setting.CompareWithQ1 === 1,
        compete_with_all_vendors: setting.CompeteAll === 1,
        reprice_up_badge_percentage: setting.BadgePercentage || -1,
        sister_vendor_ids: setting.SisterVendorId ? setting.SisterVendorId.split(";").join(",") : "",
        exclude_vendors: setting.ExcludedVendors ? setting.ExcludedVendors.split(";").join(",") : "",
        inactive_vendor_id: setting.InactiveVendorId ? setting.InactiveVendorId.split(";").join(",") : "",
        handling_time_group: setting.HandlingTimeFilter || "ALL",
        keep_position: setting.KeepPosition === 1,
        inventory_competition_threshold: setting.InventoryThreshold || 1,
        reprice_down_percentage: Number(setting.PercentageDown) !== 0 ? Number(setting.PercentageDown) * 100 : -1,
        floor_price: setting.FloorPrice || 0,
        max_price: setting.MaxPrice || 99999999.99,
        reprice_down_badge_percentage: Number(setting.BadgePercentageDown) !== 0 ? Number(setting.BadgePercentageDown) * 100 : -1,
        floor_compete_with_next: setting.CompeteWithNext === 1,
        own_vendor_threshold: setting.OwnVendorThreshold || 1,
        price_strategy: setting.IsNCNeeded === 1 ? AlgoPriceStrategy.TOTAL : AlgoPriceStrategy.UNIT,
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

export interface ProductWithAlgoData {
  // V2 algo settings fields
  floor_price: string;
  max_price: string;
  price_strategy: AlgoPriceStrategy;
  enabled: number;
  vendor_id: number;
  mp_id: number;
  suppress_price_break_if_Q1_not_updated: number;
  target_price: string | null;

  // Channel IDs fields
  channel_id: string | null;

  // Scrape product list fields
  net32_url: string | null;
  cron_name: string | null;
  slow_cron_name: string | null;
  algo_execution_mode: string | null;
  product_active: number | null;

  // Latest successful algo results fields
  last_updated_cron_name: string | null;
  last_updated_at: string | null;

  // Latest cron run fields (regardless of status)
  last_cron_run_at: string | null;
  last_cron_run_name: string | null;
  last_reprice_comment: string | null;
  last_suggested_price: string | null;
  result: string | null;
  triggered_by_vendor: string | null;
  lowest_price: string | null;
  quantity: number | null;

  // Computed field
  channel_name: string;
}

export async function getAllProductsWithAlgoData(): Promise<ProductWithAlgoData[]> {
  const knex = getKnexInstance();

  const query = knex("v2_algo_settings as vas")
    .leftJoin("channel_ids as ci", function () {
      this.on("vas.mp_id", "=", "ci.mp_id").andOn("vas.vendor_id", "=", "ci.vendor_id");
    })
    .leftJoin("table_scrapeProductList as spl", function () {
      this.on("vas.mp_id", "=", "spl.MpId");
    })
    .leftJoin(
      function () {
        this.select("mp_id", "vendor_id", knex.raw("MAX(cron_name) as cron_name"), knex.raw("MAX(created_at) as created_at"))
          .from("v2_algo_results as var1")
          .whereIn(["mp_id", "vendor_id", "created_at"], function () {
            this.select("mp_id", "vendor_id", knex.raw("MAX(created_at) as created_at")).from("v2_algo_results").where("price_update_result", "=", "OK").groupBy("mp_id", "vendor_id");
          })
          .groupBy("mp_id", "vendor_id")
          .as("latest_updated_result");
      },
      function () {
        this.on("vas.mp_id", "=", "latest_updated_result.mp_id").andOn("vas.vendor_id", "=", "latest_updated_result.vendor_id");
      }
    )
    .leftJoin(
      function () {
        this.select(
          "mp_id",
          "vendor_id",
          knex.raw("MAX(created_at) as created_at"),
          knex.raw("MAX(cron_name) as cron_name"),
          knex.raw("MAX(lowest_price) as lowest_price"),
          knex.raw(`
            GROUP_CONCAT(
              CONCAT(
                IF(quantity IS NOT NULL, CONCAT(' [Q', quantity, '] '), ''),
                IFNULL(suggested_price, '')
              ) 
              ORDER BY quantity ASC 
              SEPARATOR ','
            ) as suggested_price
          `),
          knex.raw(`
            GROUP_CONCAT(
              CONCAT(
                IF(quantity IS NOT NULL, CONCAT(' [Q', quantity, '] '), ''),
                IFNULL(result, '')
              ) 
              ORDER BY quantity ASC 
              SEPARATOR ','
            ) as result
          `),
          knex.raw(`
            GROUP_CONCAT(
              CONCAT(
                IF(quantity IS NOT NULL, CONCAT(' [Q', quantity, '] '), ''),
                IFNULL(comment, '')
              ) 
              ORDER BY quantity ASC 
              SEPARATOR ','
            ) as comment
          `)
        )
          .from("v2_algo_results as var2")
          .whereIn(["mp_id", "vendor_id", "created_at"], function () {
            this.select("mp_id", "vendor_id", knex.raw("MAX(created_at) as created_at")).from("v2_algo_results").groupBy("mp_id", "vendor_id");
          })
          .groupBy("mp_id", "vendor_id")
          .as("latest_cron_run");
      },
      function () {
        this.on("vas.mp_id", "=", "latest_cron_run.mp_id").andOn("vas.vendor_id", "=", "latest_cron_run.vendor_id");
      }
    )
    .leftJoin(
      function () {
        this.select(
          "mp_id",
          "vendor_id",
          knex.raw(`
          GROUP_CONCAT(
            CONCAT(
              IF(quantity IS NOT NULL, CONCAT(' [Q', quantity, '] '), ''),
              IFNULL(triggered_by_vendor, '')
            ) 
            ORDER BY quantity ASC 
            SEPARATOR ','
          ) as triggered_by_vendor
        `),
          knex.raw("MAX(created_at) as created_at")
        )
          .from("v2_algo_results as var3")
          .whereIn(["mp_id", "vendor_id", "created_at"], function () {
            this.select("mp_id", "vendor_id", knex.raw("MAX(created_at) as created_at")).from("v2_algo_results").where("result", "LIKE", "%CHANGE%").groupBy("mp_id", "vendor_id");
          })
          .whereNotNull("triggered_by_vendor")
          .where("result", "LIKE", "%CHANGE%")
          .groupBy("mp_id", "vendor_id")
          .as("latest_change_result");
      },
      function () {
        this.on("vas.mp_id", "=", "latest_change_result.mp_id").andOn("vas.vendor_id", "=", "latest_change_result.vendor_id");
      }
    );

  const results = query
    .select(
      // V2 algo settings fields (main table)
      "vas.floor_price",
      "vas.max_price",
      "vas.price_strategy",
      "vas.enabled",
      "vas.vendor_id",
      "vas.mp_id",
      "vas.suppress_price_break_if_Q1_not_updated",
      "vas.target_price",
      "ci.channel_id",
      "spl.Net32Url as net32_url",
      "spl.RegularCronName as cron_name",
      "spl.SlowCronName as slow_cron_name",
      "spl.algo_execution_mode",
      "spl.IsActive as product_active",
      "latest_updated_result.cron_name as last_updated_cron_name",
      "latest_updated_result.created_at as last_updated_at",
      "latest_cron_run.created_at as last_cron_run_at",
      "latest_cron_run.cron_name as last_cron_run_name",
      "latest_cron_run.comment as last_reprice_comment",
      "latest_cron_run.suggested_price as last_suggested_price",
      "latest_cron_run.result",
      "latest_cron_run.lowest_price",
      "latest_change_result.triggered_by_vendor as triggered_by_vendor",
      "latest_change_result.created_at as triggered_by_date"
    )
    .orderBy(["vas.mp_id", "vas.vendor_id"]);

  const executed = await results;

  return executed.map(
    (result): ProductWithAlgoData => ({
      ...result,
      channel_name: VendorNameLookup[result.vendor_id] || `Vendor ${result.vendor_id}`,
    })
  );
}

export async function toggleV2AlgoEnabled(mpId: number, vendorId: number): Promise<{ enabled: boolean }> {
  const knex = getKnexInstance();

  // First, check if settings exist
  const currentSetting = await knex("v2_algo_settings").where({ mp_id: mpId, vendor_id: vendorId }).first();

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
  await knex("v2_algo_settings").where({ mp_id: mpId, vendor_id: vendorId }).update({ enabled: newEnabledStatus });

  return { enabled: newEnabledStatus };
}

export async function getNet32Url(mpId: number): Promise<string | null> {
  const knex = getKnexInstance();

  const result = await knex("table_scrapeProductList").where("MpId", mpId).select("Net32Url").first();

  return result?.Net32Url || null;
}

// Vendor configurations - centralized to avoid duplication
const VENDOR_CONFIGS = [
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
  { tableName: "table_mvpDetails", vendorId: 20755, vendorName: "MVP" },
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
  {
    tableName: "table_triadDetails",
    vendorId: 5,
    vendorName: "Triad",
  },
  {
    tableName: "table_biteSupplyDetails",
    vendorId: 20891,
    vendorName: "BiteSupply",
  },
];

// Transform vendor settings to v2_algo_settings format
function transformVendorSettings(vendorSettings: any[], vendorConfig: any) {
  return vendorSettings.map((setting: any) => ({
    mp_id: setting.MpId,
    vendor_id: vendorConfig.vendorId,
    enabled: setting.Activated === 1,
    suppress_price_break_if_Q1_not_updated: setting.SuppressPriceBreakForOne === 1,
    suppress_price_break: setting.SuppressPriceBreak === 1,
    compete_on_price_break_only: setting.BeatQPrice === 1,
    up_down: setting.RepricingRule === 2 ? AlgoPriceDirection.UP_DOWN : AlgoPriceDirection.DOWN,
    badge_indicator: setting.BadgeIndicator === "BADGE_ONLY" ? AlgoBadgeIndicator.BADGE : AlgoBadgeIndicator.ALL,
    execution_priority: setting.ExecutionPriority || 0,
    reprice_up_percentage: setting.PercentageIncrease || -1,
    compare_q2_with_q1: setting.CompareWithQ1 === 1,
    compete_with_all_vendors: setting.CompeteAll === 1,
    reprice_up_badge_percentage: setting.BadgePercentage || -1,
    sister_vendor_ids: setting.SisterVendorId ? setting.SisterVendorId.split(";").join(",") : "",
    exclude_vendors: setting.ExcludedVendors ? setting.ExcludedVendors.split(";").join(",") : "",
    inactive_vendor_id: setting.InactiveVendorId ? setting.InactiveVendorId.split(";").join(",") : "",
    handling_time_group: setting.HandlingTimeFilter || AlgoHandlingTimeGroup.ALL,
    keep_position: setting.KeepPosition === 1,
    inventory_competition_threshold: setting.InventoryThreshold || 1,
    reprice_down_percentage: Number(setting.PercentageDown) !== 0 ? Number(setting.PercentageDown) * 100 : -1,
    floor_price: setting.FloorPrice || 0,
    max_price: setting.MaxPrice || 99999999.99,
    reprice_down_badge_percentage: Number(setting.BadgePercentageDown) !== 0 ? Number(setting.BadgePercentageDown) * 100 : -1,
    floor_compete_with_next: setting.CompeteWithNext === 1,
    own_vendor_threshold: setting.OwnVendorThreshold || 1,
    price_strategy: setting.IsNCNeeded === 1 ? AlgoPriceStrategy.TOTAL : AlgoPriceStrategy.UNIT,
    target_price: setting.UnitPrice || null,
  }));
}

// Perform batch delete-then-insert operations
async function performBatchDeleteThenInsert(knex: any, transformedSettings: any[], vendorConfig: any): Promise<{ insertedCount: number }> {
  let insertedCount = 0;

  try {
    console.log(`🔍 Starting batch delete-then-insert for ${vendorConfig.vendorName} with ${transformedSettings.length} settings`);

    // Use a transaction for the entire operation
    await knex.transaction(async (trx: any) => {
      console.log(`🔄 Transaction started for ${vendorConfig.vendorName}...`);

      // Delete all existing records for this vendor
      console.log(`🗑️  Deleting all existing records for ${vendorConfig.vendorName}...`);
      const deletedCount = await trx("v2_algo_settings").where("vendor_id", vendorConfig.vendorId).del();

      console.log(`🗑️  Deleted ${deletedCount} existing records for ${vendorConfig.vendorName}`);

      // Insert all new records
      if (transformedSettings.length > 0) {
        console.log(`💾 Inserting ${transformedSettings.length} new records for ${vendorConfig.vendorName}...`);
        await trx("v2_algo_settings").insert(transformedSettings);
        insertedCount = transformedSettings.length;
        console.log(`✅ Inserted ${transformedSettings.length} new records for ${vendorConfig.vendorName}`);
      } else {
        console.log(`⏭️  No records to insert for ${vendorConfig.vendorName}`);
      }

      console.log(`🔄 Transaction completed for ${vendorConfig.vendorName}`);
    });

    console.log(`✅ Batch delete-then-insert completed for ${vendorConfig.vendorName}: ${insertedCount} inserted`);
  } catch (error) {
    console.error(`❌ Error during batch operations for ${vendorConfig.vendorName}:`, error);
    throw error;
  }

  return { insertedCount };
}

// Transform channel ID settings for insertion
function transformChannelIdSettings(vendorSettings: any[], vendorConfig: any) {
  return vendorSettings.map((setting: any) => ({
    vendor_id: vendorConfig.vendorId,
    mp_id: setting.MpId,
    channel_id: setting.ChannelId,
  }));
}

// Perform batch delete-then-insert operations for channel IDs
async function performChannelIdBatchDeleteThenInsert(knex: any, transformedSettings: any[], vendorConfig: any): Promise<{ insertedCount: number }> {
  let insertedCount = 0;

  try {
    console.log(`🔍 Starting channel ID batch delete-then-insert for ${vendorConfig.vendorName} with ${transformedSettings.length} settings`);

    // Use a transaction for the entire operation
    await knex.transaction(async (trx: any) => {
      console.log(`🔄 Channel ID transaction started for ${vendorConfig.vendorName}...`);

      // Delete all existing records for this vendor
      console.log(`🗑️  Deleting all existing channel ID records for ${vendorConfig.vendorName}...`);
      const deletedCount = await trx("channel_ids").where("vendor_id", vendorConfig.vendorId).del();

      console.log(`🗑️  Deleted ${deletedCount} existing channel ID records for ${vendorConfig.vendorName}`);

      // Insert all new records
      if (transformedSettings.length > 0) {
        console.log(`💾 Inserting ${transformedSettings.length} new channel ID records for ${vendorConfig.vendorName}...`);
        await trx("channel_ids").insert(transformedSettings);
        insertedCount = transformedSettings.length;
        console.log(`✅ Inserted ${transformedSettings.length} new channel ID records for ${vendorConfig.vendorName}`);
      } else {
        console.log(`⏭️  No channel ID records to insert for ${vendorConfig.vendorName}`);
      }

      console.log(`🔄 Channel ID transaction completed for ${vendorConfig.vendorName}`);
    });

    console.log(`✅ Channel ID batch delete-then-insert completed for ${vendorConfig.vendorName}: ${insertedCount} inserted`);
  } catch (error) {
    console.error(`❌ Error during channel ID batch operations for ${vendorConfig.vendorName}:`, error);
    throw error;
  }

  return { insertedCount };
}

// Sync channel IDs for a single vendor
async function syncVendorChannelIds(knex: any, vendorConfig: any) {
  try {
    console.log(`🔄 Starting ${vendorConfig.vendorName} channel ID sync...`);

    // Check if vendor table exists
    const vendorTableExists = await knex.schema.hasTable(vendorConfig.tableName);
    if (!vendorTableExists) {
      console.log(`❌ ${vendorConfig.tableName} table does not exist`);
      return { insertedCount: 0, updatedCount: 0, skippedCount: 0 };
    }

    // Check if ChannelId column exists
    const hasChannelIdColumn = await knex.schema.hasColumn(vendorConfig.tableName, "ChannelId");

    if (!hasChannelIdColumn) {
      console.log(`⚠️  ${vendorConfig.tableName} table does not have ChannelId column`);
      return { insertedCount: 0, updatedCount: 0, skippedCount: 0 };
    }

    // Get all vendor settings with ChannelId
    const vendorSettings = await knex(vendorConfig.tableName).select("MpId", "ChannelId").whereNotNull("ChannelId").where("ChannelId", "!=", "");

    console.log(`📊 Found ${vendorSettings.length} ${vendorConfig.vendorName} settings with channel IDs to sync`);

    if (vendorSettings.length === 0) {
      console.log(`ℹ️  No ${vendorConfig.vendorName} settings with channel IDs found to sync`);
      return { insertedCount: 0, updatedCount: 0, skippedCount: 0 };
    }

    // Transform settings for insertion
    const transformedSettings = transformChannelIdSettings(vendorSettings, vendorConfig);

    // Perform batch operations
    const { insertedCount } = await performChannelIdBatchDeleteThenInsert(knex, transformedSettings, vendorConfig);

    console.log(`✅ Completed ${vendorConfig.vendorName} channel ID sync`);
    console.log(`✅ ${vendorConfig.vendorName}: ${insertedCount} inserted`);

    return { insertedCount };
  } catch (error) {
    console.error(`❌ Error during ${vendorConfig.vendorName} channel ID sync:`, error);
    throw error;
  }
}

export async function syncAllVendorSettings(): Promise<{
  totalInserted: number;
  totalUpdated: number;
  vendorResults: Array<{
    vendorName: string;
    insertedCount: number;
    updatedCount: number;
    success: boolean;
  }>;
  channelIdResults: {
    totalInserted: number;
    totalUpdated: number;
    totalSkipped: number;
    vendorResults: Array<{
      vendorName: string;
      insertedCount: number;
      updatedCount: number;
      skippedCount: number;
      success: boolean;
    }>;
  };
}> {
  const knex = getKnexInstance();

  console.log("🚀 Starting sync of all vendor settings...");
  console.log(`📋 Vendors to sync: ${VENDOR_CONFIGS.map((v) => v.vendorName).join(", ")}`);

  // Process vendors one at a time
  let totalInserted = 0;
  let totalUpdated = 0;
  const vendorResults: Array<{
    vendorName: string;
    insertedCount: number;
    updatedCount: number;
    success: boolean;
  }> = [];

  for (const vendorConfig of VENDOR_CONFIGS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔄 Starting ${vendorConfig.vendorName} sync...`);

    // Check if vendor table exists
    const vendorTableExists = await knex.schema.hasTable(vendorConfig.tableName);
    if (!vendorTableExists) {
      console.log(`❌ ${vendorConfig.tableName} table does not exist`);
      vendorResults.push({
        vendorName: vendorConfig.vendorName,
        insertedCount: 0,
        updatedCount: 0,
        success: false,
      });
      continue;
    }

    // Get all vendor settings
    const vendorSettings = await knex(vendorConfig.tableName).select("*");

    console.log(`📊 Found ${vendorSettings.length} ${vendorConfig.vendorName} settings to sync`);

    if (vendorSettings.length === 0) {
      console.log(`ℹ️  No ${vendorConfig.vendorName} settings found to sync`);
      vendorResults.push({
        vendorName: vendorConfig.vendorName,
        insertedCount: 0,
        updatedCount: 0,
        success: true,
      });
      continue;
    }

    // Transform settings for upsert
    const transformedSettings = transformVendorSettings(vendorSettings, vendorConfig);

    // Perform batch operations
    const { insertedCount } = await performBatchDeleteThenInsert(knex, transformedSettings, vendorConfig);

    console.log(`✅ Completed ${vendorConfig.vendorName} sync`);
    console.log(`✅ ${vendorConfig.vendorName}: ${insertedCount} records inserted`);

    totalInserted += insertedCount;

    vendorResults.push({
      vendorName: vendorConfig.vendorName,
      insertedCount,
      updatedCount: 0,
      success: true,
    });
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("🎉 Sync Summary:");
  console.log(`📊 Overall Summary:`);
  console.log(`✅ Total Affected Rows: ${totalInserted + totalUpdated} (inserts + updates)`);
  console.log(`📊 Total Processed: ${totalInserted + totalUpdated}`);

  // Now sync channel IDs
  console.log(`\n${"=".repeat(60)}`);
  console.log("🔄 Starting channel ID synchronization...");
  console.log(`📋 Vendors to sync channel IDs: ${VENDOR_CONFIGS.map((v) => v.vendorName).join(", ")}`);

  let channelIdTotalInserted = 0;
  let channelIdTotalUpdated = 0;
  let channelIdTotalSkipped = 0;
  const channelIdVendorResults: Array<{
    vendorName: string;
    insertedCount: number;
    updatedCount: number;
    skippedCount: number;
    success: boolean;
  }> = [];

  for (const vendorConfig of VENDOR_CONFIGS) {
    console.log(`\n${"-".repeat(40)}`);
    console.log(`🔄 Starting ${vendorConfig.vendorName} channel ID sync...`);

    const result = await syncVendorChannelIds(knex, vendorConfig);

    console.log(`✅ Completed ${vendorConfig.vendorName} channel ID sync`);

    const inserted = result.insertedCount || 0;

    console.log(`✅ ${vendorConfig.vendorName}: ${inserted} records inserted`);

    channelIdTotalInserted += inserted;

    channelIdVendorResults.push({
      vendorName: vendorConfig.vendorName,
      insertedCount: inserted,
      updatedCount: 0,
      skippedCount: 0,
      success: true,
    });
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("🎉 Channel ID Sync Summary:");
  console.log(`📊 Overall Summary:`);
  console.log(`✅ Total Affected Rows: ${channelIdTotalInserted + channelIdTotalUpdated} (inserts + updates)`);
  console.log(`📊 Total Processed: ${channelIdTotalInserted + channelIdTotalUpdated + channelIdTotalSkipped}`);

  return {
    totalInserted,
    totalUpdated,
    vendorResults,
    channelIdResults: {
      totalInserted: channelIdTotalInserted,
      totalUpdated: channelIdTotalUpdated,
      totalSkipped: channelIdTotalSkipped,
      vendorResults: channelIdVendorResults,
    },
  };
}
