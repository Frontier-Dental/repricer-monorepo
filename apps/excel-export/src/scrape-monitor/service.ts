import { applicationConfig } from "../utility/config";
import { getKnexInstance, destroyKnexInstance } from "../services/knex-wrapper";
import { scrapeViaProxy, getOutboundIp } from "./scraper";
import { log } from "./logger";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let scrapingEnabled = false;

export function isScrapingEnabled(): boolean {
  return scrapingEnabled;
}

export function setScrapingEnabled(enabled: boolean): void {
  scrapingEnabled = enabled;
  log.info("scraping_toggled", { enabled: scrapingEnabled });
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomDelay(): number {
  const value = applicationConfig.DIRECT_SCRAPE_CRON_DELAY_BETWEEN_CALLS_MS - applicationConfig.DIRECT_SCRAPE_CRON_JITTER_MS + Math.floor(Math.random() * applicationConfig.DIRECT_SCRAPE_CRON_JITTER_MS * 2);
  return Math.max(0, value);
}

async function getActiveProducts(): Promise<{ MpId: number }[]> {
  const db = getKnexInstance();
  return db(applicationConfig.SQL_SCRAPEPRODUCTLIST)
    .distinct("MpId")
    .where(function () {
      this.whereNotNull("RegularCronId").orWhereNotNull("LinkedCronId");
    })
    .where("IsActive", true)
    .orderBy("MpId");
}

async function runCycle(cycleNumber: number): Promise<void> {
  const products = await getActiveProducts();
  const shuffled = shuffle(products);
  let successCount = 0;
  let errorCount = 0;
  let blockedCount = 0;
  let consecutiveBlocks = 0;
  let totalResponseTime = 0;
  const errorBreakdown: Record<string, number> = {};
  const cycleStart = Date.now();

  for (const product of shuffled) {
    if (!scrapingEnabled) {
      log.info("cycle_aborted", { cycle: cycleNumber, reason: "scraping_disabled" });
      break;
    }
    const result = await scrapeViaProxy(product.MpId);
    totalResponseTime += result.responseTimeMs;

    if (result.error) {
      errorCount++;
      const key = String(result.httpStatus || "network");
      errorBreakdown[key] = (errorBreakdown[key] || 0) + 1;
    } else {
      successCount++;
    }

    if (result.blocked) {
      blockedCount++;
      consecutiveBlocks++;
    } else {
      consecutiveBlocks = 0;
    }

    console.log("direct-scrape-cron-result", {
      mpId: result.mpId,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      blocked: result.blocked,
      blockType: result.blockType,
      error: result.error,
      trimmedResponse: JSON.stringify(result.response).slice(0, 200),
    });

    if (consecutiveBlocks >= applicationConfig.DIRECT_SCRAPE_CRON_CONSECUTIVE_BLOCK_LIMIT) {
      log.warn("scraping_auto_stopped", {
        consecutiveBlocks,
        reason: "too_many_consecutive_blocks",
      });
      setScrapingEnabled(false);
      break;
    }

    await delay(randomDelay());
  }

  const cycleDurationMin = parseFloat(((Date.now() - cycleStart) / 60000).toFixed(2));
  const avgResponseTimeMs = shuffled.length > 0 ? Math.round(totalResponseTime / shuffled.length) : 0;

  log.info("cycle_complete", {
    totalProducts: shuffled.length,
    successCount,
    errorCount,
    blockedCount,
    errorBreakdown,
    avgResponseTimeMs,
    cycleDurationMin,
  });
}

export async function startScrapeLoop(): Promise<void> {
  if (!applicationConfig.DIRECT_SCRAPE_CRON_PROXY_IP || !applicationConfig.DIRECT_SCRAPE_CRON_PROXY_PORT) {
    log.warn("scrape_loop_skipped", { reason: "DIRECT_SCRAPE_CRON_PROXY_IP or DIRECT_SCRAPE_CRON_PROXY_PORT not configured" });
    return;
  }

  const outboundIp = await getOutboundIp();
  const products = await getActiveProducts();

  log.info("monitor_start", {
    outboundIp,
    productCount: products.length,
    delayBetweenCallsMs: `${applicationConfig.DIRECT_SCRAPE_CRON_DELAY_BETWEEN_CALLS_MS - applicationConfig.DIRECT_SCRAPE_CRON_JITTER_MS}-${applicationConfig.DIRECT_SCRAPE_CRON_DELAY_BETWEEN_CALLS_MS + applicationConfig.DIRECT_SCRAPE_CRON_JITTER_MS}`,
  });

  let cycle = 1;
  while (true) {
    if (!scrapingEnabled) {
      await delay(5000);
      continue;
    }
    try {
      await runCycle(cycle);
    } catch (err: any) {
      log.error("cycle_error", { cycle, error: err.message ?? String(err) });
      await destroyKnexInstance();
    }
    cycle++;
  }
}
