import { applicationConfig } from "../../config";
import { scrapflyFetch } from "../../proxy/scrapfly-helper";
import {
  getKnexInstance,
  destroyKnexInstance,
} from "../../../model/sql-models/knex-wrapper";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import * as cron from "node-cron";

export interface ParsedVendorData {
  vendorId: number;
  vendorName: string;
  standardShipping: number;
  freeShippingThreshold: number;
}

async function scrapeThresholdData() {
  const url = applicationConfig.NET32_VENDOR_URL;
  const { responseContent } = await scrapflyFetch(
    url,
    applicationConfig.SHIPPING_DATA_PROXY_SCRAPE_URL,
    applicationConfig.SHIPPING_DATA_PROXY_SCRAPE_API_KEY,
    false,
  );

  // Write the scraped HTML to a file in the same directory for debugging
  if (applicationConfig.SHIPPING_THRESHOLD_SAVE_FILE) {
    const filePath = path.join(__dirname, "scraped-threshold-data.html");
    fs.writeFileSync(filePath, responseContent, "utf8");

    console.log(`Scraped data written to: ${filePath}`);
  }

  return responseContent;
}

export async function scrapeAndStoreVendorData() {
  try {
    console.log("Scraping and parsing vendor data...");

    // Scrape the data
    const htmlContent = await scrapeThresholdData();

    // Parse and store the data directly from the scraped content
    await parseAndStoreVendorData(htmlContent);
  } catch (error) {
    console.error("❌ Error scraping and storing vendor data:", error);
  }
}

export function scheduleDailyThresholdScraping() {
  // Schedule to run every day at 2:00 AM
  const cronExpression = "0 2 * * *";

  const task = cron.schedule(
    cronExpression,
    async () => {
      console.log("🕐 Running scheduled daily threshold scraping...");
      await scrapeAndStoreVendorData();
    },
    {
      scheduled: false, // Don't start immediately
      timezone: "UTC",
      runOnInit: applicationConfig.RUN_SHIPPING_THRESHOLD_SCRAPE_ON_STARTUP,
    },
  );

  // Start the scheduled task
  task.start();
  console.log("📅 Daily threshold scraping scheduled for 2:00 AM UTC");

  return task;
}

export function initializeThresholdScraping() {
  // Always schedule for daily runs
  scheduleDailyThresholdScraping();
}

export async function parseAndStoreVendorData(htmlContent?: string) {
  console.log("Starting to parse vendor data...");

  let content = htmlContent;

  // If no HTML content provided, read from file (for backward compatibility)
  if (!content) {
    const filePath = path.join(__dirname, "scraped-threshold-data.html");
    content = fs.readFileSync(filePath, "utf8");
    console.log("Reading HTML from file...");
  } else {
    console.log("Using provided HTML content...");
  }

  // Load HTML into Cheerio
  const $ = cheerio.load(content);

  const vendorData: ParsedVendorData[] = [];

  // Find all vendor-entry elements
  $('[class*="vendor-entry"]').each((index, element) => {
    const $element = $(element);

    // Check if this is a vendor-entry container with data-vendor-id
    const vendorId = $element.attr("data-vendor-id");
    if (!vendorId) return;

    // Find the vendor name from the h2 link
    const vendorName = $element.find("h2 a").text().trim();
    if (!vendorName) return;

    // Extract standard shipping cost
    const standardShippingText = $element
      .find(".vendor-entry-standard-shipping dd")
      .text()
      .trim();
    const standardShipping =
      parseFloat(standardShippingText.replace("$", "")) || 0;

    // Extract free shipping threshold
    const freeShippingText = $element
      .find(".vendor-entry-free-shipping-threshold dd")
      .text()
      .trim();
    const freeShippingThreshold =
      freeShippingText === "N/A"
        ? 0
        : parseFloat(freeShippingText.replace("$", "")) || 0;

    vendorData.push({
      vendorId: parseInt(vendorId),
      vendorName,
      standardShipping,
      freeShippingThreshold,
    });
  });

  console.log(`Parsed ${vendorData.length} vendor records`);

  // Store in database
  if (vendorData.length > 0) {
    await storeVendorData(vendorData);
  }

  return vendorData;
}

async function storeVendorData(vendorData: ParsedVendorData[]) {
  console.log("Storing vendor data in database...");

  const knex = getKnexInstance();

  // Clear existing data
  await knex("vendor_thresholds").del();
  console.log("Existing vendor_thresholds data cleared");

  // Prepare data for insertion
  const insertData = vendorData.map((vendor) => ({
    vendor_id: vendor.vendorId,
    standard_shipping: vendor.standardShipping,
    threshold: vendor.freeShippingThreshold,
  }));

  console.log(insertData);

  // Insert new data
  await knex("vendor_thresholds").insert(insertData);
  console.log(`Successfully inserted ${insertData.length} vendor records`);

  // Verify insertion
  const count = await knex("vendor_thresholds").count("* as count").first();
  console.log(`Final record count: ${count ? count.count : 0}`);
  destroyKnexInstance();
  console.log("✅ Vendor data stored successfully!");
}
