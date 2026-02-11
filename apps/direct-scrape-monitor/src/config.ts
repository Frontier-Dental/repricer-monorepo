import { z } from "zod";

const envSchema = z.object({
  // Database
  SQL_HOSTNAME: z.string(),
  SQL_PORT: z.coerce.number(),
  SQL_USERNAME: z.string(),
  SQL_PASSWORD: z.string(),
  SQL_DATABASE: z.string(),
  REPRICER_ENCRYPTION_KEY: z.string(),

  // Proxy
  PROXY_IP: z.string(),
  PROXY_PORT: z.coerce.number(),
  PROXY_USERNAME: z.string(),
  PROXY_PASSWORD: z.string(),

  // Scraping
  SCRAPE_URL: z.string().default("https://www.net32.com/rest/neo/pdp/{mpId}/vendor-options"),
  DELAY_BETWEEN_CALLS_MS: z.coerce.number().default(2000),
  DELAY_JITTER_MS: z.coerce.number().default(150),
  CYCLE_INTERVAL_MS: z.coerce.number().default(1800000),
  PRODUCT_TABLE: z.string().default("table_scrapeProductList"),
});

export type Config = z.infer<typeof envSchema>;

export const config = envSchema.parse(process.env);
