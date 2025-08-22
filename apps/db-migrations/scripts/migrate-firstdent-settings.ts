import knex from "knex";
import dotenv from "dotenv";

// Load environment variables
const environment = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${environment}` });

// Create Knex instance
function createKnexInstance() {
  if (!process.env.SQL_HOSTNAME) {
    throw new Error("SQL_HOSTNAME is not set");
  }
  if (!process.env.SQL_PORT) {
    throw new Error("SQL_PORT is not set");
  }
  if (!process.env.SQL_USERNAME) {
    throw new Error("SQL_USERNAME is not set");
  }
  if (!process.env.SQL_PASSWORD) {
    throw new Error("SQL_PASSWORD is not set");
  }
  if (!process.env.SQL_DATABASE) {
    throw new Error("SQL_DATABASE is not set");
  }

  return knex({
    client: "mysql2",
    connection: {
      host: process.env.SQL_HOSTNAME,
      port: parseInt(process.env.SQL_PORT),
      user: process.env.SQL_USERNAME,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DATABASE,
    },
  });
}

interface VendorConfig {
  tableName: string;
  vendorId: number;
  vendorName: string;
}

interface MigrationResult {
  insertedCount: number;
  updatedCount: number;
}

async function migrateVendorSettings(vendorConfig: VendorConfig) {
  const db = createKnexInstance();

  try {
    console.log(
      `🔄 Starting migration of ${vendorConfig.vendorName} settings to v2_algo_settings...`,
    );

    // Check if tables exist
    const vendorTableExists = await db.schema.hasTable(vendorConfig.tableName);
    const v2SettingsExists = await db.schema.hasTable("v2_algo_settings");

    if (!vendorTableExists) {
      console.log(`❌ ${vendorConfig.tableName} table does not exist`);
      return;
    }

    if (!v2SettingsExists) {
      console.log(
        "❌ v2_algo_settings table does not exist. Please run migrations first.",
      );
      return;
    }

    // Get all vendor settings
    const vendorSettings = await db(vendorConfig.tableName).select("*");

    console.log(
      `📊 Found ${vendorSettings.length} ${vendorConfig.vendorName} settings to migrate`,
    );

    if (vendorSettings.length === 0) {
      console.log(
        `ℹ️  No ${vendorConfig.vendorName} settings found to migrate`,
      );
      return;
    }

    // Transform all settings for upsert
    const transformedSettings = vendorSettings.map((setting: any) => ({
      mp_id: setting.MpId,
      vendor_id: vendorConfig.vendorId,
      enabled: setting.Activated === 1, // Map Activated to enabled
      suppress_price_break_if_Q1_not_updated: setting.IgnorePhantomQBreak === 1,
      suppress_price_break: setting.SuppressPriceBreak === 1,
      compete_on_price_break_only: setting.SuppressPriceBreakForOne === 1,
      up_down: setting.RepricingRule === 2 ? "UP/DOWN" : "DOWN",
      badge_indicator:
        setting.BadgeIndicator === "BADGE_ONLY" ? "BADGE" : "ALL",
      execution_priority: setting.ExecutionPriority || 0,
      reprice_up_percentage: setting.PercentageIncrease || -1,
      compare_q2_with_q1: setting.CompareWithQ1 === 1,
      compete_with_all_vendors: setting.CompeteAll === 1,
      reprice_up_badge_percentage: setting.BadgePercentage || -1,
      sister_vendor_ids: setting.SisterVendorId || "",
      exclude_vendors: setting.ExcludedVendors || "",
      inactive_vendor_id: setting.InactiveVendorId || "",
      handling_time_group: setting.HandlingTimeFilter === 1,
      keep_position: setting.KeepPosition === 1,
      inventory_competition_threshold: setting.InventoryThreshold || 1,
      reprice_down_percentage:
        Number(setting.PercentageDown) !== 0
          ? Number(setting.PercentageDown) * 100
          : -1,
      floor_price: setting.FloorPrice || 0,
      max_price: setting.MaxPrice || 99999999.99,
      reprice_down_badge_percentage:
        Number(setting.PercentageDown) !== 0
          ? Number(setting.PercentageDown) * 100
          : -1,
      floor_compete_with_next: setting.CompeteWithNext === 1,
      compete_with_own_quantity_0: setting.CompeteWithOwnQuantity0 === 1,
      not_cheapest: setting.IsNCNeeded === 1,
    }));

    // Perform upsert operation
    let insertedCount = 0;
    let updatedCount = 0;

    for (const setting of transformedSettings) {
      // Check if record already exists
      const existingRecord = await db("v2_algo_settings")
        .where({
          mp_id: setting.mp_id,
          vendor_id: setting.vendor_id,
        })
        .first();

      if (existingRecord) {
        // Update existing record
        await db("v2_algo_settings")
          .where({
            mp_id: setting.mp_id,
            vendor_id: setting.vendor_id,
          })
          .update(setting);
        updatedCount++;
        console.log(
          `🔄 Updated: MP ID ${setting.mp_id} (${updatedCount} updated, ${insertedCount} inserted)`,
        );
      } else {
        // Insert new record
        await db("v2_algo_settings").insert(setting);
        insertedCount++;
        console.log(
          `✅ Inserted: MP ID ${setting.mp_id} (${insertedCount}/${transformedSettings.length})`,
        );
      }
    }

    console.log(
      `✅ Successfully migrated ${transformedSettings.length} ${vendorConfig.vendorName} settings to v2_algo_settings`,
    );
    console.log(`📝 Inserted: ${insertedCount}, Updated: ${updatedCount}`);
    console.log(
      `📋 Vendor ID set to: ${vendorConfig.vendorId} (${vendorConfig.vendorName})`,
    );

    // Verify the migration
    const finalCount = await db("v2_algo_settings")
      .where("vendor_id", vendorConfig.vendorId)
      .count("* as count")
      .first();

    console.log(
      `📊 Total ${vendorConfig.vendorName} settings in v2_algo_settings: ${finalCount ? finalCount.count : 0}`,
    );

    return { insertedCount, updatedCount } as MigrationResult;
  } catch (error) {
    console.error(
      `❌ Error during ${vendorConfig.vendorName} migration:`,
      error,
    );
    throw error;
  } finally {
    if (db) {
      await db.destroy();
    }
  }
}

async function migrateAllVendors() {
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
  ];

  console.log("🚀 Starting parallel migration of all vendor settings...");
  console.log(
    `📋 Vendors to migrate: ${vendorConfigs.map((v) => v.vendorName).join(", ")}`,
  );

  // Start all migrations in parallel
  const migrationPromises = vendorConfigs.map(async (vendorConfig) => {
    try {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🔄 Starting ${vendorConfig.vendorName} migration...`);
      const result = await migrateVendorSettings(vendorConfig);
      console.log(`✅ Completed ${vendorConfig.vendorName} migration`);
      return { vendorName: vendorConfig.vendorName, ...result };
    } catch (error) {
      console.error(`❌ Failed to migrate ${vendorConfig.vendorName}:`, error);
      return {
        vendorName: vendorConfig.vendorName,
        insertedCount: 0,
        updatedCount: 0,
        error: true,
      };
    }
  });

  // Wait for all migrations to complete
  const results = await Promise.all(migrationPromises);

  // Calculate totals
  let totalInserted = 0;
  let totalUpdated = 0;
  let successCount = 0;
  let errorCount = 0;

  console.log(`\n${"=".repeat(60)}`);
  console.log("🎉 Migration Summary:");

  for (const result of results) {
    if (result.error) {
      console.log(`❌ ${result.vendorName}: Failed`);
      errorCount++;
    } else {
      const inserted = result.insertedCount || 0;
      const updated = result.updatedCount || 0;
      console.log(
        `✅ ${result.vendorName}: ${inserted} inserted, ${updated} updated`,
      );
      totalInserted += inserted;
      totalUpdated += updated;
      successCount++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 Overall Summary:");
  console.log(
    `✅ Successful migrations: ${successCount}/${vendorConfigs.length}`,
  );
  console.log(`❌ Failed migrations: ${errorCount}/${vendorConfigs.length}`);
  console.log(`📊 Total Inserted: ${totalInserted}`);
  console.log(`📊 Total Updated: ${totalUpdated}`);
  console.log(`📊 Total Processed: ${totalInserted + totalUpdated}`);

  process.exit(0);
}

// Run the migration for all vendors
migrateAllVendors();
