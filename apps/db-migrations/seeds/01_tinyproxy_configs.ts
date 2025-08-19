import type { Knex } from "knex";
import fs from "fs";
import path from "path";

interface TinyProxyConfig {
  box: string;
  proxy_username: string;
  proxy_password: string;
  subscription_key: string;
  ip: string;
  port: number;
  vendor_id: number;
}

export async function seed(knex: Knex): Promise<void> {
  try {
    console.log("Starting to seed tinyproxy_configs table...");

    // Use process.cwd() to get the project root and build path from there
    const projectRoot = process.cwd();
    const dataPath = path.join(projectRoot, "data", "tinyproxy-configs.json");

    console.log(`Looking for data file at: ${dataPath}`);

    const jsonData = fs.readFileSync(dataPath, "utf8");
    const configs: TinyProxyConfig[] = JSON.parse(jsonData);

    console.log(`Found ${configs.length} configs to insert`);

    // Deletes ALL existing entries
    await knex("tinyproxy_configs").del();
    console.log("Existing data cleared");

    // Prepare data for insertion (map to match table structure)
    const insertData = configs.map((config) => ({
      proxy_username: config.proxy_username,
      proxy_password: config.proxy_password,
      subscription_key: config.subscription_key,
      ip: config.ip,
      port: config.port,
      vendor_id: config.vendor_id,
    }));

    // Inserts seed entries
    const insertedIds = await knex("tinyproxy_configs").insert(insertData);
    console.log(`Successfully inserted ${insertedIds.length} records`);

    // Verify the insertion
    const finalCount = await knex("tinyproxy_configs")
      .count("* as count")
      .first();
    console.log(`Final record count: ${finalCount ? finalCount.count : 0}`);

    console.log("✅ Tinyproxy configs seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding tinyproxy_configs:", error);
    throw error;
  }
}
