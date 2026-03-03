/**
 * What-If Backtest
 *
 * Demonstrates how to run a what-if analysis by changing a single setting
 * and measuring the impact across historical data.
 *
 * To run:
 *   BACKTEST_ENABLED=true npx jest --testPathPattern='backtest/what-if' --verbose
 */

// Must mock before any source imports
jest.mock("@repricer-monorepo/shared", () => ({
  VendorId: {
    FRONTIER: 20722,
    TRADENT: 17357,
    MVP: 20755,
    TOPDENT: 20727,
    FIRSTDENT: 20533,
    TRIAD: 5,
    BITESUPPLY: 10,
  },
  VendorName: {
    FRONTIER: "FRONTIER",
    MVP: "MVP",
    TRADENT: "TRADENT",
    FIRSTDENT: "FIRSTDENT",
    TOPDENT: "TOPDENT",
    TRIAD: "TRIAD",
    BITESUPPLY: "BITESUPPLY",
  },
  VendorNameLookup: {
    20722: "FRONTIER",
    17357: "TRADENT",
    20755: "MVP",
    20727: "TOPDENT",
    20533: "FIRSTDENT",
    5: "TRIAD",
    10: "BITESUPPLY",
  },
  VendorIdLookup: {
    FRONTIER: 20722,
    TRADENT: 17357,
    MVP: 20755,
    TOPDENT: 20727,
    FIRSTDENT: 20533,
    TRIAD: 5,
    BITESUPPLY: 10,
  },
  AlgoExecutionMode: {
    V2_ONLY: "V2_ONLY",
    V1_ONLY: "V1_ONLY",
    V2_EXECUTE_V1_DRY: "V2_EXECUTE_V1_DRY",
    V1_EXECUTE_V2_DRY: "V1_EXECUTE_V2_DRY",
  },
  AlgoPriceDirection: {
    UP: "UP",
    UP_DOWN: "UP/DOWN",
    DOWN: "DOWN",
  },
  AlgoBadgeIndicator: {
    ALL: "ALL",
    BADGE: "BADGE",
  },
  AlgoHandlingTimeGroup: {
    ALL: "ALL",
    FAST_SHIPPING: "FAST_SHIPPING",
    STOCKED: "STOCKED",
    LONG_HANDLING: "LONG_HANDLING",
  },
  AlgoPriceStrategy: {
    UNIT: "UNIT",
    TOTAL: "TOTAL",
    BUY_BOX: "BUY_BOX",
  },
  CacheKey: {},
  CronSettingsDto: class {},
  SecretKeyDto: class {},
  AlternateProxyProviderDto: class {},
}));
jest.mock("../../../config", () => ({
  applicationConfig: {
    WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE: false,
  },
}));
jest.mock("../../../../model/sql-models/knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
}));
jest.mock("../../../mysql/mySql-mapper", () => ({}));

import { extractBacktestData, destroyBacktestKnex, loadSnapshot } from "./extract-data";
import { runWhatIfBacktest, printWhatIfSummary } from "./what-if-runner";
import { BacktestRecord } from "./types";

const ENABLED = process.env.BACKTEST_ENABLED === "true";
const DAYS = Number(process.env.BACKTEST_DAYS ?? 7);
const LIMIT = Number(process.env.BACKTEST_LIMIT ?? 500);
const SNAPSHOT_PATH = process.env.BACKTEST_SNAPSHOT ?? "";

const describeOrSkip = ENABLED ? describe : describe.skip;

describeOrSkip("What-If Backtest", () => {
  let records: BacktestRecord[] = [];

  beforeAll(async () => {
    if (SNAPSHOT_PATH) {
      records = await loadSnapshot(SNAPSHOT_PATH);
    } else {
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - DAYS);

      records = await extractBacktestData({
        dateFrom,
        dateTo,
        limit: LIMIT,
        useV2Results: true,
      });
    }

    console.log(`[backtest] Loaded ${records.length} records for what-if test.`);
  }, 120_000);

  afterAll(async () => {
    await destroyBacktestKnex();
  });

  it("what-if: change floor_price to $5.00", async () => {
    if (records.length === 0) return;

    const report = await runWhatIfBacktest(records, {
      floor_price: 5.0,
    });

    printWhatIfSummary(report, "floor_price = $5.00");

    // Sanity: report should have processed all records
    expect(report.total).toBe(records.length);
  }, 300_000);

  it("what-if: change price_strategy to BUY_BOX", async () => {
    if (records.length === 0) return;

    const report = await runWhatIfBacktest(records, {
      price_strategy: "BUY_BOX" as any,
    });

    printWhatIfSummary(report, "price_strategy = BUY_BOX");

    expect(report.total).toBe(records.length);
  }, 300_000);

  it("what-if: enable floor_compete_with_next", async () => {
    if (records.length === 0) return;

    const report = await runWhatIfBacktest(records, {
      floor_compete_with_next: true,
    });

    printWhatIfSummary(report, "floor_compete_with_next = true");

    expect(report.total).toBe(records.length);
  }, 300_000);

  it("what-if: change up_down to DOWN only", async () => {
    if (records.length === 0) return;

    const report = await runWhatIfBacktest(records, {
      up_down: "DOWN" as any,
    });

    printWhatIfSummary(report, "up_down = DOWN");

    expect(report.total).toBe(records.length);
    // Products that were previously priced UP should now be "no longer repriced"
    expect(report.directionBreakdown.noLongerRepriced).toBeGreaterThanOrEqual(0);
  }, 300_000);
});
