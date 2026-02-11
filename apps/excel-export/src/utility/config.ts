import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default("development"),
  GET_REPRICER_DBNAME: z.string().default("repricer"),
  GET_CRON_LOGS_COLLECTION_NAME: z.string().default("cronLogs"),
  ITEMS_COLLECTION_NAME: z.string().default("items"),
  CRON_PAGESIZE: z.coerce.number().default(10),
  CRON_RUN_ALL_ENDPOINT: z.string().default("/schedule/StartCronV3"),
  NET32_UPDATE_PRICE_URL: z.string().default("https://api.net32.com/products/offers/update"),
  CRON_STATUS_COLLECTION_NAME: z.string().default("cronStatusLogs"),
  IP_CONFIG: z.string().default("ipConfig"),
  REPRICE_OWN_ENDPOINT: z.string().default("/search/RepriceProduct/"),
  CRON_START_ENDPOINT: z.string().default("/schedule/StartCron"),
  CRON_STOP_ENDPOINT: z.string().default("/schedule/StopCron"),
  RECREATE_CRON_ENDPOINT: z.string().default("/schedule/RecreateCron"),
  ERROR_ITEM_COLLECTION: z.string().default("errorItems"),
  MANUAL_PROD_UPDATE_ENDPOINT: z.string().default("/product/updateManualProd/"),
  HISTORY_DB: z.string().default("historyData"),
  ENV_SETTINGS: z.string().default("envsettings"),
  HISTORY_LIMIT: z.coerce.number().default(50),
  STOP_ALL_CRON_ENDPOINT: z.string().default("1/schedule/StopAll"),
  START_OVERRIDE_URL_ENDPOINT: z.string().default("/schedule/startOverride"),
  HISTORY_BASE_PATH: z.string().default("/repricer-api-core/history/"),
  FILE_DELIMITER: z.string().default("/"),
  FEED_REPRICER_ENDPOINT: z.string().default("/feed/RepriceProduct/"),
  PRODUCT_COLLECTION: z.string().default("products"),
  MANAGED_MONGO_URL: z.string(),
  MANAGED_MONGO_PASSWORD: z.string(),
  USERS_COLLECTION: z.string().default("users"),
  DEFAULT_PRODUCT_STATUS: z.string().default("true"),
  SIMULATE_REPRICER_ENDPOINT: z.string().default("/repricer/V2AlgoTest"),
  MANUAL_REPRICER_ENDPOINT: z.string().default("/repricer/ManualUpdate"),
  RUN_SPECIFIC_CRON_ENDPOINT: z.string().default("/schedule/start_specific_cron"),
  ERROR_ONE: z.string().default("Error: Invalid response found in Net32 Api"),
  ERROR_TWO: z.string().default("Error: Could not find own vendor Id"),
  FILTER_CRON_LOGS: z.string().default("filterCronLogs"),
  FILTER_CRON_LOGS_LIMIT: z.coerce.number().default(10),
  FILTER_CRON_TOGGLE_STATUS_ENDPOINT: z.string().default("/filter/toggleCronStatus"),
  FILTER_CRON_RECREATE_ENDPOINT: z.string().default("/filter/RecreateFilterCron"),
  GET_422_BELOW_PRODUCTS_ENDPOINT: z.string().default("/debug/filterProductsWithFloor/6e2fe8965f5040748912bb90080a2de5"),
  SLOW_CRON_TOGGLE_STATUS_ENDPOINT: z.string().default("/slow_cron/toggleCronStatus"),
  SLOW_CRON_RECREATE_ENDPOINT: z.string().default("/slow_cron/RecreateSlowCron"),
  GET_DATA_URL_ENDPOINT: z.string().default("/debug/get-data"),
  USER_CREATION_EMAIL_TRIGGER_URL: z.string().default("http://localhost:5421/notify/user_creation_email"),
  APP_LOG_PATH_ENDPOINT: z.string().default("/app/logs"),
  CLEAR_LOG_PATH_ENDPOINT: z.string().default("/app/clear-logs"),
  SCRAPE_ITEMS_COLLECTION: z.string().default("scrapeItems"),
  ERROR_422_CRON_LOGS: z.string().default("422cronLogs"),
  SCRAPE_LOGS_COLLECTION: z.string().default("scrapeCronLogs"),
  SCRAPE_CRON_TOGGLE_STATUS_ENDPOINT: z.string().default("/scrape/toggleCronStatus"),
  SCRAPE_CRON_RECREATE_ENDPOINT: z.string().default("/scrape/RecreateScrapeCron"),
  SQL_HOSTNAME: z.string(),
  SQL_USERNAME: z.string(),
  SQL_PASSWORD: z.string(),
  SQL_PORT: z.coerce.number(),
  SQL_SCRAPEPRODUCTLIST: z.string().default("table_scrapeProductList"),
  SQL_DATABASE: z.string(),
  SQL_SP_GETRUN_INFO: z.string().default("sp_GetLatestRunInfoByLimit"),
  SQL_SP_GETRUN_INFO_BY_CRON: z.string().default("sp_GetLatestRunInfoForCronByLimit"),
  SQL_SP_GET_SCRAPEPRODUCT_DETAILS: z.string().default("sp_GetScrapeProductDetails"),
  SQL_SP_GET_SCRAPEPRODUCT_DETAILS_FILTER: z.string().default("sp_GetScrapeProductDetailsByFilter"),
  SQL_SP_GET_ALL_SCRAPEPRODUCT_DETAILS: z.string().default("sp_GetAllScrapeProducts"),
  SQL_SP_UPSERT_PRODUCT_DETAILS: z.string().default("sp_UpsertProductDetailsV2"),
  SQL_SP_GETLASTSCRAPEDETAILSBYID: z.string().default("sp_GetLastScrapeDetailsByID"),
  SQL_SP_UPSERT_TRADENT: z.string().default("sp_UpsertTradentDetailsV2"),
  SQL_SP_UPSERT_FRONTIER: z.string().default("sp_UpsertFrontierDetailsV2"),
  SQL_SP_UPSERT_MVP: z.string().default("sp_UpsertMvpDetailsV2"),
  USE_MYSQL: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  SQL_SP_GET_FULL_PRODUCT_DETAILS_BY_ID: z.string().default("sp_GetFullProductDetailsByIdV4"),
  SQL_SP_UPDATE_TRADENT: z.string().default("sp_UpdateTradentDetailsByIdV2"),
  SQL_SP_UPDATE_FRONTIER: z.string().default("sp_UpdateFrontierDetailsByIdV2"),
  SQL_SP_UPDATE_MVP: z.string().default("sp_UpdateMvpDetailsByIdV2"),
  DOWNTIME_ON: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  SQL_SP_UPDATE_FIRSTDENT: z.string().default("sp_UpdateFirstDentDetailsByIdV2"),
  SQL_SP_UPDATE_TOPDENT: z.string().default("sp_UpdateTopDentDetailsByIdV2"),
  SQL_SP_UPDATE_TRIAD: z.string().default("sp_UpdateTriadDetailsByIdV2"),
  SQL_SP_UPDATE_BITESUPPLY: z.string().default("sp_UpdateBiteSupplyDetailsByIdV2"),
  SQL_SP_UPSERT_TOPDENT: z.string().default("sp_UpsertTopDentDetailsV2"),
  SQL_SP_UPSERT_FIRSTDENT: z.string().default("sp_UpsertFirstDentDetailsV2"),
  SQL_SP_UPSERT_TRIAD: z.string().default("sp_UpsertTriadDetailsV2"),
  SQL_SP_UPSERT_BITESUPPLY: z.string().default("sp_UpsertBiteSupplyDetailsV2"),
  SQL_SP_UPSERT_PRODUCT_DETAILSV4: z.string().default("sp_UpsertProductDetailsV4"),
  SQL_SP_GET_PRODUCT_LIST_BY_TAGV2: z.string().default("sp_GetFullProductDetailsListByTagV2"),
  SQL_SP_GET_PRODUCT_LIST_BY_FILTERV2: z.string().default("sp_GetFullProductDetailsListByFilterV2"),
  SQL_SP_GET_ALL_PRODUCT_DETAILS: z.string().default("sp_GetFullProductDetailsListV4"),
  HISTORY_EXPORT_URL_BY_ID: z.string().default("http://localhost:5421/debug/history-export/exportAndSave/{productId}"),
  HISTORY_EXPORT_URL_FOR_ALL: z.string().default("http://localhost:5421/debug/history-export/exportAndSaveAll"),
  PROD_SYNC_URL: z.string().default("http://159.89.121.57:3000/help/getProductDetailsById/{productId}"),
  MANUAL_PRODUCT_SYNC_PROCESS: z.string().default("http://localhost:5421/schedule/on-demand/mysql-sync"),
  MAX_UPDATE_REPRICER_ENDPOINT: z.string().default("/repricer/UpdateToMax"),
  SESSION_SECRET: z.string(),
  REPRICER_API_BASE_URL: z.string(),
  AUTHENTICATION_DISABLED: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  REQUEST_LOGGING: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  SMTP_USER: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(25),
  SMTP_PWD: z.string(),
  EMAIL_ID: z.string().default("storage-sense@frontierdental.com"),
  TO_EMAIL: z.string().default("eliyahu@focusglobalsupply.com,Akshoy@voyantcs.com,repricer.support@voyantcs.com,tj@focusglobalsupply.com"),
  ENV_NAME: z.string().default("Scraper"),
  EMAIL_SUBJECT: z.string().default("Storage is freed"),
  ENV_IP: z.string().default("159.89.121.57"),
  CRON_IP_SCHEDULE: z.string().default("*/5 * * * *"),
  START_IP_HEALTH_CRON: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  STORAGE_SENSE_CRON_URL: z.string().default("http://localhost:5421/schedule/storage-sense"),
  HISTORY_PURGE_CRON_URL: z.string().default("http://localhost:5421/schedule/history-purger"),

  STORAGE_SENSE_CRON_SCHEDULE: z.string().default("0 1 * * *"),
  FREE_THRESHOLD: z.coerce.number().default(25),
  DAYS_TO_KEEP: z.coerce.number().default(15),
  IS_DEBUG: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(false),
  STORAGE_SENSE_FILE_DELIMITER: z.string().default("/"),
  HISTORY_PURGE_CRON_SCHEDULE: z.string().default("0 0 * * *"),
  STORAGE_SENSE_SHELL_PATH: z.string().default("~/free-space.sh"),
  HISTORY_ROOT_PATH: z.string().default("/root/repricer/"),
  MONITOR_EMAIL_ID: z.string().default("monitor-health@frontierdental.com"),
  DEBUG_IP: z.string().default("http://localhost:3000/help/check_ip_status"),
  START_CRON_PROGRESS_SCHEDULE: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  CRON_PROGRESS_SCHEDULE: z.string().default("*/30 * * * *"),
  IP_HEALTH_EMAIL_ID: z.string().default("ip-health@frontierdental.com"),
  HISTORY_PURGER_EMAIL_ID: z.string().default("history-purger@frontierdental.com"),
  START_422_ERROR_CRON_SCHEDULE: z
    .string()
    .toLowerCase()
    .transform(JSON.parse as any)
    .pipe(z.boolean())
    .default(true),
  SQL_SP_GET_PRODUCT_BY_MPID: z.string().default("sp_GetProductByMpid"),
  SQL_SP_GET_PRODUCT_BY_CHANNEL_ID: z.string().default("sp_GetProductsByChannelId"),
  _422_ERROR_CRON_SCHEDULE: z.string().default("*/30 * * * *"),
  EXPORT_SAVE_CRON_SCHEDULE: z.string().default("0 1 * * *"),
  CRON_PROGRESS_MAX_COUNT: z.coerce.number().default(25),
  CRON_PROGRESS_EXTERNAL_ENDPOINT: z.string().default("http://159.89.121.57:3000/monitor/get_cron_details"),
  _422_ERROR_CRON_EXTERNAL_ENDPOINT: z.string().default("http://159.89.121.57:3000/monitor/get_422_product"),
  _422_ERROR_MAX_COUNT: z.coerce.number().default(100),
  _422_ERROR_ELIGIBLE_MAX_COUNT: z.coerce.number().default(500),
  REPRICER_ENCRYPTION_KEY: z.string(),

  // Scrape monitor (proxy)
  PROXY_IP: z.string().optional(),
  PROXY_PORT: z.coerce.number().optional(),
  PROXY_USERNAME: z.string().optional(),
  PROXY_PASSWORD: z.string().optional(),
  SCRAPE_URL: z.string().default("https://www.net32.com/rest/neo/pdp/{mpId}/vendor-options"),
  DIRECT_SCRAPE_CRON_DELAY_BETWEEN_CALLS_MS: z.coerce.number().default(200),
  DIRECT_SCRAPE_CRON_JITTER_MS: z.coerce.number().default(75),
  DIRECT_SCRAPE_CRON_CONSECUTIVE_BLOCK_LIMIT: z.coerce.number().default(3),
});

export function validateConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error("Invalid or missing environment variables:\n" + JSON.stringify(parsed.error.format(), null, 2));
  }

  return parsed.data;
}

export const applicationConfig = envSchema.parse(process.env);
