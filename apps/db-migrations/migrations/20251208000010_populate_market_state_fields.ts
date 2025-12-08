import type { Knex } from "knex";

interface VendorConfig {
  tableName: string;
  vendorId: number;
  channelName: string;
}

const VENDOR_CONFIGS: VendorConfig[] = [
  {
    tableName: "table_tradentDetails",
    vendorId: 17357,
    channelName: "TRADENT",
  },
  {
    tableName: "table_frontierDetails",
    vendorId: 20722,
    channelName: "FRONTIER",
  },
  { tableName: "table_mvpDetails", vendorId: 20755, channelName: "MVP" },
  {
    tableName: "table_topDentDetails",
    vendorId: 20727,
    channelName: "TOPDENT",
  },
  {
    tableName: "table_firstDentDetails",
    vendorId: 20533,
    channelName: "FIRSTDENT",
  },
  { tableName: "table_triadDetails", vendorId: 5, channelName: "TRIAD" },
];

export async function up(knex: Knex): Promise<void> {
  console.log("🔄 Starting migration to populate market state fields...");

  // Create temporary tables for latest records
  await knex.raw(`
    CREATE TEMPORARY TABLE tmp_latest_product_info (
      MpId BIGINT UNSIGNED NOT NULL,
      VendorId BIGINT UNSIGNED NOT NULL,
      InStock TINYINT,
      Inventory INT,
      PRIMARY KEY (MpId, VendorId)
    )
  `);

  await knex.raw(`
    CREATE TEMPORARY TABLE tmp_latest_history (
      MpId BIGINT UNSIGNED NOT NULL,
      ChannelName VARCHAR(50) NOT NULL,
      ExistingPrice DECIMAL(10, 2),
      RefTime DATETIME,
      PRIMARY KEY (MpId, ChannelName)
    )
  `);

  for (const vendorConfig of VENDOR_CONFIGS) {
    console.log(
      `📊 Processing ${vendorConfig.channelName} (${vendorConfig.tableName})...`,
    );

    // Clear temp tables for this vendor
    await knex.raw(`DELETE FROM tmp_latest_product_info`);
    await knex.raw(`DELETE FROM tmp_latest_history`);

    // Populate temp table with latest product info using ROW_NUMBER()
    await knex.raw(
      `
      INSERT INTO tmp_latest_product_info (MpId, VendorId, InStock, Inventory)
      SELECT MpId, VendorId, InStock, Inventory
      FROM (
        SELECT 
          MpId,
          VendorId,
          InStock,
          Inventory,
          ROW_NUMBER() OVER (PARTITION BY MpId ORDER BY Id DESC) as rn
        FROM table_productInfo
        WHERE VendorId = ?
          AND (InStock IS NOT NULL OR Inventory IS NOT NULL)
      ) ranked
      WHERE rn = 1
    `,
      [vendorConfig.vendorId],
    );

    // Populate temp table with latest history
    await knex.raw(
      `
      INSERT INTO tmp_latest_history (MpId, ChannelName, ExistingPrice, RefTime)
      SELECT MpId, ChannelName, ExistingPrice, RefTime
      FROM (
        SELECT 
          MpId,
          ChannelName,
          CAST(ExistingPrice AS DECIMAL(10, 2)) as ExistingPrice,
          RefTime,
          ROW_NUMBER() OVER (PARTITION BY MpId ORDER BY Id DESC) as rn
        FROM table_history
        WHERE ChannelName = ?
          AND (ExistingPrice IS NOT NULL OR RefTime IS NOT NULL)
      ) ranked
      WHERE rn = 1
    `,
      [vendorConfig.channelName],
    );

    // Update from product info
    const productInfoUpdateResult = await knex.raw(
      `
      UPDATE ${vendorConfig.tableName} vd
      INNER JOIN tmp_latest_product_info pi 
        ON vd.MpId = pi.MpId AND pi.VendorId = ?
      SET 
        vd.CurrentInStock = pi.InStock,
        vd.CurrentInventory = pi.Inventory
      WHERE vd.CurrentInStock IS NULL OR vd.CurrentInventory IS NULL
    `,
      [vendorConfig.vendorId],
    );

    const productInfoRowsAffected =
      productInfoUpdateResult[0]?.affectedRows || 0;
    console.log(`✅ Updated ${productInfoRowsAffected} rows with product info`);

    // Update from history
    const historyUpdateResult = await knex.raw(
      `
      UPDATE ${vendorConfig.tableName} vd
      INNER JOIN tmp_latest_history h 
        ON vd.MpId = h.MpId AND vd.ChannelName = h.ChannelName
      SET 
        vd.OurLastPrice = h.ExistingPrice,
        vd.MarketStateUpdatedAt = h.RefTime
      WHERE vd.OurLastPrice IS NULL OR vd.MarketStateUpdatedAt IS NULL
    `,
      [],
    );

    const historyRowsAffected = historyUpdateResult[0]?.affectedRows || 0;
    console.log(`✅ Updated ${historyRowsAffected} rows with history data`);
  }

  // Cleanup
  await knex.raw(`DROP TEMPORARY TABLE IF EXISTS tmp_latest_product_info`);
  await knex.raw(`DROP TEMPORARY TABLE IF EXISTS tmp_latest_history`);

  console.log("✅ Migration completed successfully!");
}

export async function down(knex: Knex): Promise<void> {
  console.log("🔄 Reverting migration - clearing market state fields...");

  for (const vendorConfig of VENDOR_CONFIGS) {
    console.log(
      `📊 Clearing ${vendorConfig.channelName} (${vendorConfig.tableName})...`,
    );

    await knex(vendorConfig.tableName).update({
      CurrentInStock: null,
      CurrentInventory: null,
      OurLastPrice: null,
      MarketStateUpdatedAt: null,
    });

    console.log(
      `✅ Cleared market state fields for ${vendorConfig.channelName}`,
    );
  }

  console.log("✅ Rollback completed successfully!");
}
