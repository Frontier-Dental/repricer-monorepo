// ============================================================
// POLYFILLS — Node 18 lacks Array.prototype.toSorted
// ============================================================
if (!Array.prototype.toSorted) {
  // eslint-disable-next-line no-extend-native
  (Array.prototype as any).toSorted = function <T>(this: T[], compareFn?: (a: T, b: T) => number): T[] {
    return [...this].sort(compareFn);
  };
}

// ============================================================
// MOCKS — must be before any source imports
// ============================================================

// 1. @repricer-monorepo/shared is ESM — mock it entirely with CJS values
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

// 2. config.ts — Zod parse at module level (via html-builder.ts)
jest.mock("../../../config", () => ({
  applicationConfig: {
    WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE: false,
  },
}));

// 3. knex-wrapper — imported by shipping-threshold.ts
jest.mock("../../../../model/sql-models/knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
}));

// 4. mySql-mapper — imported by utility.ts (types + @repricer-monorepo/shared)
jest.mock("../../../mysql/mySql-mapper", () => ({}));

// ============================================================
// IMPORTS
// ============================================================

import * as fs from "fs";
import * as path from "path";
import { AlgoBadgeIndicator, AlgoHandlingTimeGroup, AlgoPriceDirection, AlgoPriceStrategy } from "@repricer-monorepo/shared";
import { V2AlgoSettingsData } from "../../../mysql/v2-algo-settings";
import { repriceProductV2 } from "../../v2/algorithm";
import { VendorThreshold } from "../../v2/shipping-threshold";
import { Net32AlgoProduct } from "../../v2/types";

// ---------------------------------------------------------------------------
// Types for the JSON fixture files
// ---------------------------------------------------------------------------
interface ScenarioExpected {
  algoResult: string;
  suggestedPrice: number | null;
  commentContains?: string[];
  commentNotContains?: string[];
}

interface ScenarioInput {
  mpId: number;
  net32Products: Net32AlgoProduct[];
  vendorSettings: Partial<V2AlgoSettingsData>;
  ownVendorId: number;
  allOwnVendorIds: number[];
  nonBlocked422VendorIds: number[];
  isSlowCron: boolean;
  vendorThresholds?: VendorThreshold[];
}

interface ScenarioFile {
  name: string;
  description: string;
  tags: string[];
  input: ScenarioInput;
  expected: ScenarioExpected;
}

// ---------------------------------------------------------------------------
// Database defaults -- must stay in sync with createV2AlgoSettings()
// in apps/api-core/src/utility/mysql/v2-algo-settings.ts
// ---------------------------------------------------------------------------
const DEFAULT_VENDOR_SETTINGS: Omit<V2AlgoSettingsData, "id"> = {
  mp_id: 0,
  vendor_id: 0,
  suppress_price_break_if_Q1_not_updated: false,
  suppress_price_break: false,
  compete_on_price_break_only: false,
  up_down: AlgoPriceDirection.UP_DOWN,
  badge_indicator: AlgoBadgeIndicator.ALL,
  execution_priority: 0,
  reprice_up_percentage: -1,
  compare_q2_with_q1: false,
  compete_with_all_vendors: false,
  reprice_up_badge_percentage: -1,
  sister_vendor_ids: "",
  exclude_vendors: "",
  inactive_vendor_id: "",
  handling_time_group: AlgoHandlingTimeGroup.ALL,
  keep_position: false,
  max_price: 99999999.99,
  floor_price: 0,
  inventory_competition_threshold: 1,
  reprice_down_percentage: -1,
  reprice_down_badge_percentage: -1,
  floor_compete_with_next: false,
  own_vendor_threshold: 1,
  price_strategy: AlgoPriceStrategy.UNIT,
  enabled: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVendorSettings(mpId: number, vendorId: number, overrides: Partial<V2AlgoSettingsData>): V2AlgoSettingsData {
  return {
    ...DEFAULT_VENDOR_SETTINGS,
    mp_id: mpId,
    vendor_id: vendorId,
    enabled: true, // scenarios always assume the vendor is enabled
    ...overrides,
  } as V2AlgoSettingsData;
}

/**
 * Build a VendorThreshold[] from the scenario. If the scenario provides
 * explicit vendorThresholds, use them. Otherwise derive one per unique
 * vendorId from the net32Products array, using the product's own
 * freeShippingThreshold and standardShipping.
 */
function buildVendorThresholds(scenario: ScenarioFile): VendorThreshold[] {
  if (scenario.input.vendorThresholds && scenario.input.vendorThresholds.length > 0) {
    return scenario.input.vendorThresholds;
  }
  const seen = new Set<number>();
  const thresholds: VendorThreshold[] = [];
  for (const p of scenario.input.net32Products) {
    if (!seen.has(p.vendorId)) {
      seen.add(p.vendorId);
      thresholds.push({
        vendorId: p.vendorId,
        standardShipping: p.standardShipping,
        threshold: p.freeShippingThreshold,
      });
    }
  }
  return thresholds;
}

// ---------------------------------------------------------------------------
// Load every *.json file from the scenarios/ directory
// ---------------------------------------------------------------------------
const SCENARIOS_DIR = path.join(__dirname, "scenarios");

function loadScenarios(): { fileName: string; scenario: ScenarioFile }[] {
  if (!fs.existsSync(SCENARIOS_DIR)) {
    throw new Error(`Scenarios directory not found: ${SCENARIOS_DIR}. ` + `Create it and add at least one .json fixture.`);
  }
  const files = fs
    .readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .json scenario files found in ${SCENARIOS_DIR}. ` + `Add at least one fixture to run golden-file tests.`);
  }

  return files.map((fileName) => {
    const raw = fs.readFileSync(path.join(SCENARIOS_DIR, fileName), "utf-8");
    return { fileName, scenario: JSON.parse(raw) as ScenarioFile };
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe("Golden-file scenario tests", () => {
  const scenarios = loadScenarios();

  it.each(scenarios.map((s) => [s.fileName, s.scenario.name, s] as const))("%s -- %s", (_fileName, _name, { scenario }) => {
    const { mpId, net32Products, vendorSettings: partialSettings, ownVendorId, allOwnVendorIds, nonBlocked422VendorIds, isSlowCron } = scenario.input;

    // Build vendor settings for all own vendors.
    // V2 sister detection (algorithm.ts:495) requires sister vendors
    // to be in availableProducts, which means enabled: true in settings.
    // Non-own vendors are never in allOwnVendorIds so they are unaffected.
    const vendorSettings = allOwnVendorIds.map((vid) => buildVendorSettings(mpId, vid, partialSettings));

    const vendorThresholds = buildVendorThresholds(scenario);

    // Run the algorithm
    const results = repriceProductV2(mpId, net32Products, nonBlocked422VendorIds, allOwnVendorIds, vendorSettings, "golden-test-job", isSlowCron, `https://www.net32.com/ec/mp-${mpId}`, vendorThresholds);

    // We only care about Q1 results for the own vendor under test
    const q1Result = results.find((r) => r.vendor.vendorId === ownVendorId && r.quantity === 1);

    // Special case: scenario expects no result for this vendor
    if (scenario.expected.algoResult === "NO_RESULT") {
      expect(q1Result).toBeUndefined();
      return;
    }

    expect(q1Result).toBeDefined();
    if (!q1Result) return; // type guard for TS

    // -- algoResult
    expect(q1Result.algoResult).toBe(scenario.expected.algoResult);

    // -- suggestedPrice
    if (scenario.expected.suggestedPrice === null) {
      expect(q1Result.suggestedPrice).toBeNull();
    } else {
      expect(q1Result.suggestedPrice).toBeCloseTo(scenario.expected.suggestedPrice, 2);
    }

    // -- comment substring assertions
    if (scenario.expected.commentContains) {
      for (const fragment of scenario.expected.commentContains) {
        expect(q1Result.comment).toContain(fragment);
      }
    }
    if (scenario.expected.commentNotContains) {
      for (const fragment of scenario.expected.commentNotContains) {
        expect(q1Result.comment).not.toContain(fragment);
      }
    }
  });
});
