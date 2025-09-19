import type { Knex } from "knex";
import fs from "fs";
import path from "path";

interface VendorShipping {
  vendorId: number;
  vendorName: string;
  standardShipping: number;
  freeShippingThreshold: number;
}

export async function seed(knex: Knex): Promise<void> {
  try {
    console.log("Starting to seed vendor_shipping table...");

    // Use process.cwd() to get the project root and build path from there
    const projectRoot = process.cwd();
    const dataPath = path.join(projectRoot, "data", "vendor-shipping.json");

    console.log(`Looking for data file at: ${dataPath}`);

    const jsonData = fs.readFileSync(dataPath, "utf8");
    const vendorShippingData: VendorShipping[] = JSON.parse(jsonData);

    console.log(
      `Found ${vendorShippingData.length} vendor shipping records to insert`,
    );

    // Deletes ALL existing entries
    await knex("vendor_thresholds").del();
    console.log("Existing data cleared");

    // Prepare data for insertion (map to match table structure)
    const insertData = vendorShippingData.map((vendor) => ({
      vendor_id: vendor.vendorId,
      standard_shipping: vendor.standardShipping,
      threshold: vendor.freeShippingThreshold,
    }));

    // Inserts seed entries
    const insertedIds = await knex("vendor_thresholds").insert(insertData);
    console.log(`Successfully inserted ${insertedIds.length} records`);

    // Verify the insertion
    const finalCount = await knex("vendor_thresholds")
      .count("* as count")
      .first();
    console.log(`Final record count: ${finalCount ? finalCount.count : 0}`);

    console.log("✅ Vendor shipping data seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding vendor_thresholds:", error);
    throw error;
  }
}
