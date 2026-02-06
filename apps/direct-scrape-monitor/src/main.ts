import "dotenv/config";
import http from "http";
import { config } from "./config";
import { getActiveProducts, destroyConnection } from "./db";
import { scrapeViaProxy, getOutboundIp } from "./scraper";
import { log } from "./logger";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomDelay(): number {
  const value = config.DELAY_BETWEEN_CALLS_MS - config.DELAY_JITTER_MS + Math.floor(Math.random() * config.DELAY_JITTER_MS * 2);
  return Math.max(0, value);
}

async function runCycle(cycleNumber: number): Promise<void> {
  const products = await getActiveProducts();
  const shuffled = shuffle(products);

  let successCount = 0;
  let errorCount = 0;
  let blockedCount = 0;
  let totalResponseTime = 0;
  const errorBreakdown: Record<string, number> = {};
  const cycleStart = Date.now();

  for (const product of shuffled) {
    const result = await scrapeViaProxy(product.MpId);
    totalResponseTime += result.responseTimeMs;

    if (result.error) {
      errorCount++;
      const key = String(result.httpStatus || "network");
      errorBreakdown[key] = (errorBreakdown[key] || 0) + 1;
    } else {
      successCount++;
    }

    if (result.blocked) blockedCount++;

    const level = result.blocked ? "warn" : result.error ? "warn" : "info";
    log[level]("scrape_result", {
      mpId: result.mpId,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      responseSizeBytes: result.responseSizeBytes,
      vendorCount: result.vendorCount,
      blocked: result.blocked,
      blockType: result.blockType,
      error: result.error,
      cycle: cycleNumber,
    });

    await delay(randomDelay());
  }

  const cycleDurationMin = parseFloat(((Date.now() - cycleStart) / 60000).toFixed(2));
  const avgResponseTimeMs = shuffled.length > 0 ? Math.round(totalResponseTime / shuffled.length) : 0;
  const nextCycleAt = new Date(Date.now() + config.CYCLE_INTERVAL_MS).toISOString();

  log.info("cycle_complete", {
    cycle: cycleNumber,
    totalProducts: shuffled.length,
    successCount,
    errorCount,
    blockedCount,
    errorBreakdown,
    avgResponseTimeMs,
    cycleDurationMin,
    nextCycleAt,
  });
}

function startHealthServer(): void {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  });
  server.listen(5002, () => {
    log.info("health_server", { port: 5002 });
  });
}

async function main(): Promise<void> {
  startHealthServer();

  const outboundIp = await getOutboundIp();
  const products = await getActiveProducts();

  log.info("monitor_start", {
    outboundIp,
    productCount: products.length,
    delayBetweenCallsMs: `${config.DELAY_BETWEEN_CALLS_MS - config.DELAY_JITTER_MS}-${config.DELAY_BETWEEN_CALLS_MS + config.DELAY_JITTER_MS}`,
    cycleIntervalMin: Math.round(config.CYCLE_INTERVAL_MS / 60000),
  });

  let cycle = 1;
  while (true) {
    try {
      await runCycle(cycle);
    } catch (err: any) {
      log.error("cycle_error", { cycle, error: err.message ?? String(err) });
      await destroyConnection();
    }
    cycle++;
    await delay(config.CYCLE_INTERVAL_MS);
  }
}

async function gracefulShutdown(reason: string): Promise<void> {
  log.info("shutdown", { reason });
  await Promise.race([destroyConnection(), delay(5000)]);
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

main().catch(async (err) => {
  log.error("fatal", { error: err.message ?? String(err) });
  await destroyConnection();
  process.exit(1);
});
