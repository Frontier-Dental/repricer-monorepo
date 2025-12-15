import { z } from "zod";

// Define the schema for all required environment variables, with defaults
const envSchema = z.object({
  // Database
  MANAGED_MONGO_URL: z.string(),
  MANAGED_MONGO_PASSWORD: z.string(),
  GET_PRICE_LIST_DBNAME: z.string().default("repricer"),
  GET_PRICE_LIST_COLLECTION_NAME: z.string().default("items"),
  CRON_LOGS_COLLECTION_NAME: z.string().default("cronLogs"),
  CRON_SETTINGS_COLLECTION_NAME: z.string().default("cronSettings"),
  CRON_STATUS_COLLECTION_NAME: z.string().default("cronStatusLogs"),
  ERROR_ITEM_COLLECTION: z.string().default("errorItems"),
  OPPORTUNITY_ITEM_COLLECTION: z.string().default("opportunityItems"),
  MANAGED_MONGO_PRODUCT_COLLECTION: z.string().default("products"),
  MANAGED_MONGO_COLLECTION: z.string().default("results"),
  IP_CONFIG: z.string().default("ipConfig"),
  HISTORY_DB: z.string().default("historyData"),
  ENV_SETTINGS: z.string().default("envsettings"),
  SCRAPE_PRODUCTS_COLLECTION_NAME: z.string().default("scrapeProducts"),
  SCRAPE_PRODUCTS_LOGS_COLLECTION_NAME: z.string().default("scrapeCronLogs"),
  SCRAPE_ITEMS_COLLECTION_NAME: z.string().default("scrapeItems"),
  FILTER_CRON_COLLECTION_NAME: z.string().default("filterCronSettings"),
  FILTER_CRON_LOGS: z.string().default("filterCronLogs"),
  ERROR_422_CRON_LOGS: z.string().default("422cronLogs"),
  PROXY_SWITCHER_CRON_COLLECTION_NAME: z
    .string()
    .default("proxySwitcherCronSettings"),
  // SQL
  SQL_HOSTNAME: z.string(),
  SQL_PORT: z.coerce.number(),
  SQL_USERNAME: z.string(),
  SQL_PASSWORD: z.string(),
  SQL_DATABASE: z.string(),
  SQL_RUNINFO: z.string().default("table_runInfo"),
  SQL_PRODUCTINFO: z.string().default("table_productInfo"),
  SQL_PRICEBREAKINFO: z.string().default("table_priceBreaks"),
  SQL_RUNCOMPLETIONSTATUS: z.string().default("table_runCompletionStatus"),
  SQL_GET_SCRAPE_PRODUCTS_BY_CRON: z
    .string()
    .default("sp_GetActiveScrapeProductDetailsByCron"),
  SQL_SCRAPE_PRODUCT_LIST: z.string().default("table_scrapeProductList"),
  SQL_GET_PRODUCT_BYID_CRON: z
    .string()
    .default("sp_GetProductDetailsByCronAndId"),
  SQL_SP_GET_REGULAR_CRON_PRODUCTS_BY_CRON: z
    .string()
    .default("sp_GetActiveFullProductDetailsListByCronV3"),
  SQL_SP_GET_SLOW_CRON_PRODUCTS_BY_CRON: z
    .string()
    .default("sp_GetActiveFullProductDetailsListBySlowCronV3"),
  SQL_SP_GET_FULL_PRODUCT_DETAILS_BY_ID: z
    .string()
    .default("sp_GetFullProductDetailsByIdV3"),
  SQL_TRADENT_DETAILS: z.string().default("table_tradentDetails"),
  SQL_FRONTIER_DETAILS: z.string().default("table_frontierDetails"),
  SQL_MVP_DETAILS: z.string().default("table_mvpDetails"),
  SQL_TOPDENT_DETAILS: z.string().default("table_topDentDetails"),
  SQL_FIRSTDENT_DETAILS: z.string().default("table_firstDentDetails"),
  SQL_HISTORY_API_RESPONSE: z.string().default("table_history_apiResponse"),
  SQL_HISTORY: z.string().default("table_history"),
  SQL_SP_FILTER_ELIGIBLE_PRODUCT: z
    .string()
    .default("sp_GetFilterEligibleProductsByFilterDateV3"),
  // App
  PORT: z.coerce.number().default(5001),
  OFFSET: z.coerce.number().default(0.01),
  IGNORE_TIE: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  WRITE_HISTORY_SQL: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  APP_LOG_PATH: z.string().default("logs/app.log"),
  IS_DEBUG: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  FILE_PATH: z.string().default("../test"),
  DEFAULT_DELAY: z.coerce.number().default(1500),
  FLAG_MULTI_PRICE_UPDATE: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  FORMAT_RESPONSE_CUSTOM: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  ROTATING_PROXY_URL: z.string().default("gate.smartproxy.com"),
  SCHEDULE_CRONS_ON_STARTUP: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  REPRICER_UI_CACHE_CLEAR: z
    .string()
    .default("http://localhost:3000/cache/flush_repricer_all"),
  MANAGED_SERVICE_CRON_RUN_URL: z
    .string()
    .default("http://localhost:5001/schedule/startManagedServiceCron"),
  CRON_RUN_PRODUCT_URL: z
    .string()
    .default("http://localhost:5001/schedule/startProductCron"),
  CRON_RUN_FEED_URL: z
    .string()
    .default("http://localhost:5001/schedule/startFeedCron"),
  // Misc
  PROXY_SWITCH_EMAIL_NOTIFIER: z
    .string()
    .default("http://localhost:5421/notify/proxy_switch_email"),
  PROXY_SWITCH_EMAIL_THRESHOLD_NOTIFIER: z
    .string()
    .default("http://localhost:5421/notify/proxy_switch_threshold_email"),
  PROXYSWITCH_TIMER: z.coerce.number().default(3600000),
  PROXYSWITCH_COUNTER_MAXLIMIT: z.coerce.number().default(200),
  BATCH_SIZE: z.coerce.number().default(700),
  GET_SEARCH_RESULTS: z
    .string()
    .default("https://www.net32.com/rest/neo/pdp/{mpId}/vendor-options"),
  REPRICE_OWN_URL: z
    .string()
    .default("http://localhost:5001/search/RepriceProduct/{mpId}"),
  UPDATE_TO_MAX_OWN_URL: z
    .string()
    .default("http://localhost:5001/search/RepriceProductToMax/{mpId}"),
  GET_PRODUCT_RESULTS: z
    .string()
    .default("https://www.net32.com/feeds/vendors/Net32.json"),
  FEED_FILE_NAME: z.string().default("feed.json"),
  FEED_FILE_PATH: z.string().default("/root/repricer/feed/"),
  PRODUCT_LOCAL_PATH: z.string().default("../../product"),
  FEED_REPRICER_OWN_URL: z
    .string()
    .default("http://localhost:5001/feed/RepriceProduct/{mpId}"),
  PRODUCT_REPRICER_URL: z
    .string()
    .default("http://localhost:5001/data/GetProductList"),
  FEED_CRON_EXP: z.string().default("15 */4 * * *"),
  PRODUCT_CRON_EXP: z.string().default("0 */4 * * *"),
  MANAGED_CRON_EXP: z.string().default("0 */2 * * *"),
  COLLATE_DATA_URL: z
    .string()
    .default("http://localhost:5001/data/collate_feed"),
  IS_SCRAPER: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  IGNORE_CACHE: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  NO_OF_RETRIES: z.coerce.number().default(2),
  RETRY_INTERVAL: z.coerce.number().default(2000),
  _422_CACHE_VALID_PERIOD: z.coerce.number().default(59),
  CRON_NAME_422: z.string().default("Cron-422"),
  CRON_NAME_OPPORTUNITY: z.string().default("Cron-Opportunity"),
  VENDOR_ID: z.coerce.number().default(17357),
  VENDOR_COUNT: z.coerce.number().default(6),
  SQL_VENDOR_KEYS: z.string().default("table_vendorKeys"),
  OWN_VENDOR_LIST: z.string().default("17357;20722;20755;20533;20727;5"),
  EXCLUDED_VENDOR_ID: z.string().default("20722;20755"),
  OVERRIDE_DELAY: z.coerce.number().default(15000),
  SCRAPINGBEE_TIMEOUT_VALUE: z.coerce.number().default(15000),
  SCRAPINGBEE_WAIT_VALUE: z.coerce.number().default(1500),
  SCRAPFLY_TIMEOUT_VALUE: z.coerce.number().default(15000),
  SCRAPFLY_WAIT_VALUE: z.coerce.number().default(1500),
  IS_DEV: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  SCRAPE_ONLY_LOGGING: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  SCRAPE_RUN_LOGGING: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  NET32_UPDATE_QUANTITY_URL: z
    .string()
    .default("https://api.net32.com/inventory/products/update"),
  SQL_TRIAD_DETAILS: z.string().default("table_triadDetails"),
  SQL_PROXY_NET_32: z.string().default("tinyproxy_configs"),
  ENABLE_SLOW_CRON_FEATURE: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  REQUEST_LOGGING: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  V2_ALGO_HTML_FILE_EXPIRY_HOURS: z.coerce.number().default(24),
  RUN_CRONS_ON_INIT: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  NET32_VENDOR_URL: z.string().default("https://www.net32.com/vendor"),
  SHIPPING_THRESHOLD_SAVE_FILE: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  SHIPPING_DATA_PROXY_SCRAPE_URL: z
    .string()
    .default(
      "https://api.scrapfly.io/scrape?tags=player%2Cproject%3Adefault&asp=true&country=US",
    ),
  SHIPPING_DATA_PROXY_SCRAPE_API_KEY: z.string(),
  RUN_SHIPPING_THRESHOLD_SCRAPE_ON_STARTUP: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  CACHE_HOST_URL: z.string(),
  CACHE_USERNAME: z.string(),
  CACHE_PASSWORD: z.string(),
  CACHE_PORT: z.coerce.number(),
  REPRICER_ENCRYPTION_KEY: z
    .string()
    .default("3v9sKkLZ2z1Yq9eU8 + XgJk1YbZ9n3vLQ0mF9ZkQhJxgE="),
  MINI_ERP_BASE_URL: z.string(),
  MINI_ERP_USERNAME: z.string(),
  MINI_ERP_PASSWORD: z.string(),
  SQL_WAITLIST: z.string().default("waitlist"),
  MINI_ERP_DATA_PAGE_SIZE: z.coerce.number().default(1000),
  MINI_ERP_DATA_HOURS_SINCE_UPDATE: z.coerce.number().default(4),
  NET32_UPDATE_QUANTITY_DELAY: z.coerce.number().default(3),
});

export function validateConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      "Invalid or missing environment variables:\n" +
        JSON.stringify(parsed.error.format(), null, 2),
    );
  }

  return parsed.data;
}

export const applicationConfig = envSchema.parse(process.env);
