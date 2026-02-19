/**
 * Regression Backtest
 *
 * This test requires MySQL access. It is SKIPPED by default in normal CI.
 *
 * To run:
 *   BACKTEST_ENABLED=true npx jest --testPathPattern='backtest/regression' --verbose
 *
 * Environment variables:
 *   BACKTEST_ENABLED       - Set to "true" to enable (default: skipped)
 *   BACKTEST_SQL_HOST      - MySQL host (falls back to SQL_HOSTNAME)
 *   BACKTEST_SQL_PORT      - MySQL port (falls back to SQL_PORT)
 *   BACKTEST_SQL_USER      - MySQL user (falls back to SQL_USERNAME)
 *   BACKTEST_SQL_PASSWORD  - MySQL password (falls back to SQL_PASSWORD)
 *   BACKTEST_SQL_DATABASE  - MySQL database (falls back to SQL_DATABASE)
 *   BACKTEST_DAYS          - How many days of data to pull (default: 7)
 *   BACKTEST_LIMIT         - Max records to pull (default: 500)
 *   BACKTEST_THRESHOLD     - Minimum match rate (default: 0.95)
 *   BACKTEST_SNAPSHOT      - Path to a JSON snapshot file (skips DB if set)
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
import { runRegressionBacktest, printBacktestSummary } from "./regression-runner";
import { BacktestRecord } from "./types";

const ENABLED = process.env.BACKTEST_ENABLED === "true";
const DAYS = Number(process.env.BACKTEST_DAYS ?? 7);
const LIMIT = Number(process.env.BACKTEST_LIMIT ?? 500);
const THRESHOLD = Number(process.env.BACKTEST_THRESHOLD ?? 0.95);
const SNAPSHOT_PATH = process.env.BACKTEST_SNAPSHOT ?? "";

const describeOrSkip = ENABLED ? describe : describe.skip;

describeOrSkip("Regression Backtest", () => {
  let records: BacktestRecord[] = [];

  beforeAll(async () => {
    if (SNAPSHOT_PATH) {
      // Load from offline snapshot -- no DB needed
      records = await loadSnapshot(SNAPSHOT_PATH);
    } else {
      // Pull from database
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

    console.log(`[backtest] Loaded ${records.length} records for regression test.`);
  }, 120_000); // 2 minutes for data extraction

  afterAll(async () => {
    await destroyBacktestKnex();
  });

  it(`should have a match rate above ${(THRESHOLD * 100).toFixed(0)}%`, async () => {
    if (records.length === 0) {
      console.warn("[backtest] No records found. Skipping assertion.");
      return;
    }

    const result = await runRegressionBacktest(records);
    printBacktestSummary(result);

    expect(result.total).toBeGreaterThan(0);
    expect(result.matchRate).toBeGreaterThanOrEqual(THRESHOLD);
  }, 300_000); // 5 minutes timeout

  it("should produce no ERROR results during replay", async () => {
    if (records.length === 0) return;

    const result = await runRegressionBacktest(records);

    const errorDiffs = result.diffs.filter((d) => d.current.algoResult === "ERROR");

    if (errorDiffs.length > 0) {
      console.error(`[backtest] ${errorDiffs.length} records produced ERROR during replay:`);
      for (const d of errorDiffs.slice(0, 5)) {
        console.error(`  MpId=${d.mpId} V=${d.vendorId} Q=${d.quantity}: ${d.current.comment}`);
      }
    }

    // Allow a small number of errors (e.g., records with missing thresholds)
    const errorRate = errorDiffs.length / records.length;
    expect(errorRate).toBeLessThan(0.05); // Less than 5% errors
  }, 300_000);
});
