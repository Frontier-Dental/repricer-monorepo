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
  skippedCount: number;
}

async function migrateVendorChannelIds(vendorConfig: VendorConfig) {
  const db = createKnexInstance();

  try {
    console.log(
      `🔄 Starting migration of ${vendorConfig.vendorName} channel IDs...`,
    );

    // Check if tables exist
    const vendorTableExists = await db.schema.hasTable(vendorConfig.tableName);
    const channelIdsTableExists = await db.schema.hasTable("channel_ids");

    if (!vendorTableExists) {
      console.log(`❌ ${vendorConfig.tableName} table does not exist`);
      return { insertedCount: 0, updatedCount: 0, skippedCount: 0 };
    }

    if (!channelIdsTableExists) {
      console.log(
        "❌ channel_ids table does not exist. Please run migrations first.",
      );
      return { insertedCount: 0, updatedCount: 0, skippedCount: 0 };
    }

    // Check if ChannelId column exists
    const hasChannelIdColumn = await db.schema.hasColumn(
      vendorConfig.tableName,
      "ChannelId",
    );

    if (!hasChannelIdColumn) {
      console.log(
        `⚠️  ${vendorConfig.tableName} table does not have ChannelId column`,
      );
      return { insertedCount: 0, updatedCount: 0, skippedCount: 0 };
    }

    // Get all vendor settings with ChannelId
    const vendorSettings = await db(vendorConfig.tableName)
      .select("MpId", "ChannelId")
      .whereNotNull("ChannelId")
      .where("ChannelId", "!=", "");

    console.log(
      `📊 Found ${vendorSettings.length} ${vendorConfig.vendorName} settings with channel IDs to migrate`,
    );

    if (vendorSettings.length === 0) {
      console.log(
        `ℹ️  No ${vendorConfig.vendorName} settings with channel IDs found to migrate`,
      );
      return { insertedCount: 0, updatedCount: 0, skippedCount: 0 };
    }

    // Transform settings for insertion
    const transformedSettings = vendorSettings.map((setting: any) => ({
      vendor_id: vendorConfig.vendorId,
      mp_id: setting.MpId,
      channel_id: setting.ChannelId,
    }));

    // Perform batch operations
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    try {
      // Get existing records to determine what needs to be inserted vs updated
      const existingRecords = await db("channel_ids")
        .whereIn(
          ["vendor_id", "mp_id"],
          transformedSettings.map((s) => [s.vendor_id, s.mp_id]),
        )
        .select("vendor_id", "mp_id", "channel_id");

      // Create a map for quick lookup
      const existingMap = new Map(
        existingRecords.map((r) => [`${r.vendor_id}-${r.mp_id}`, true]),
      );

      // Separate records into insert and update batches
      const toInsert: typeof transformedSettings = [];
      const toUpdate: typeof transformedSettings = [];
      const toSkip: typeof transformedSettings = [];

      for (const setting of transformedSettings) {
        const key = `${setting.vendor_id}-${setting.mp_id}`;
        const existing = existingMap.get(key);

        if (existing) {
          // Check if channel_id is different
          const existingRecord = existingRecords.find(
            (r) =>
              r.vendor_id === setting.vendor_id && r.mp_id === setting.mp_id,
          );

          if (
            existingRecord &&
            existingRecord.channel_id !== setting.channel_id
          ) {
            toUpdate.push(setting);
          } else {
            toSkip.push(setting);
          }
        } else {
          toInsert.push(setting);
        }
      }

      // Perform batch insert for new records
      if (toInsert.length > 0) {
        await db("channel_ids").insert(toInsert);
        insertedCount = toInsert.length;
        console.log(
          `✅ Batch inserted ${toInsert.length} new channel ID records for ${vendorConfig.vendorName}`,
        );
      }

      // Perform batch updates for existing records with different channel IDs
      if (toUpdate.length > 0) {
        // Use a transaction for batch updates
        await db.transaction(async (trx) => {
          for (const setting of toUpdate) {
            await trx("channel_ids")
              .where({
                vendor_id: setting.vendor_id,
                mp_id: setting.mp_id,
              })
              .update({ channel_id: setting.channel_id });
          }
        });
        updatedCount = toUpdate.length;
        console.log(
          `🔄 Batch updated ${toUpdate.length} existing channel ID records for ${vendorConfig.vendorName}`,
        );
      }

      skippedCount = toSkip.length;
      if (toSkip.length > 0) {
        console.log(
          `⏭️  Skipped ${toSkip.length} records that already have the same channel ID for ${vendorConfig.vendorName}`,
        );
      }
    } catch (error) {
      console.error(
        `❌ Error during batch operations for ${vendorConfig.vendorName}:`,
        error,
      );
      throw error;
    }

    console.log(
      `✅ Successfully migrated ${vendorConfig.vendorName} channel IDs`,
    );
    console.log(
      `📝 Inserted: ${insertedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`,
    );

    // Verify the migration
    const finalCount = await db("channel_ids")
      .where("vendor_id", vendorConfig.vendorId)
      .count("* as count")
      .first();

    console.log(
      `📊 Total ${vendorConfig.vendorName} channel IDs in channel_ids table: ${finalCount ? finalCount.count : 0}`,
    );

    return { insertedCount, updatedCount, skippedCount } as MigrationResult;
  } catch (error) {
    console.error(
      `❌ Error during ${vendorConfig.vendorName} channel ID migration:`,
      error,
    );
    throw error;
  } finally {
    if (db) {
      await db.destroy();
    }
  }
}

async function migrateAllVendorChannelIds() {
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

  console.log("🚀 Starting sequential migration of all vendor channel IDs...");
  console.log(
    `📋 Vendors to migrate: ${vendorConfigs.map((v) => v.vendorName).join(", ")}`,
  );

  // Process vendors one at a time
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const vendorConfig of vendorConfigs) {
    try {
      console.log(`\n${"=".repeat(60)}`);
      console.log(
        `🔄 Starting ${vendorConfig.vendorName} channel ID migration...`,
      );

      const result = await migrateVendorChannelIds(vendorConfig);

      console.log(
        `✅ Completed ${vendorConfig.vendorName} channel ID migration`,
      );

      const inserted = result.insertedCount || 0;
      const updated = result.updatedCount || 0;
      const skipped = result.skippedCount || 0;

      console.log(
        `✅ ${vendorConfig.vendorName}: ${inserted} inserted, ${updated} updated, ${skipped} skipped`,
      );

      totalInserted += inserted;
      totalUpdated += updated;
      totalSkipped += skipped;
      successCount++;
    } catch (error) {
      console.error(
        `❌ Failed to migrate ${vendorConfig.vendorName} channel IDs:`,
        error,
      );
      errorCount++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("🎉 Channel ID Migration Summary:");
  console.log(`📊 Overall Summary:`);
  console.log(
    `✅ Successful migrations: ${successCount}/${vendorConfigs.length}`,
  );
  console.log(`❌ Failed migrations: ${errorCount}/${vendorConfigs.length}`);
  console.log(`📊 Total Inserted: ${totalInserted}`);
  console.log(`📊 Total Updated: ${totalUpdated}`);
  console.log(`📊 Total Skipped: ${totalSkipped}`);
  console.log(
    `📊 Total Processed: ${totalInserted + totalUpdated + totalSkipped}`,
  );

  process.exit(0);
}

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return { mode: "all" };
  }

  if (args[0] === "--help" || args[0] === "-h") {
    console.log(`
🚀 Channel ID Migration Script Usage:

1. Migrate ALL vendor channel IDs:
   npm run migrate-channel-ids
   node migrate-channel-ids.js

2. Show help:
   npm run migrate-channel-ids -- --help
   node migrate-channel-ids.js --help

This script will migrate ChannelId values from the following tables:
- table_firstDentDetails (Vendor ID: 20533)
- table_frontierDetails (Vendor ID: 20722)
- table_topDentDetails (Vendor ID: 20727)
- table_tradentDetails (Vendor ID: 17357)

Into the new channel_ids table.
`);
    process.exit(0);
  }

  console.error("❌ Invalid arguments. Use --help for usage information.");
  process.exit(1);
}

// Main execution
async function main() {
  const args = parseArguments();

  if (args.mode === "all") {
    await migrateAllVendorChannelIds();
  }
}

// Run the migration based on arguments
main().catch((error) => {
  console.error("❌ Channel ID migration failed:", error);
  process.exit(1);
});
