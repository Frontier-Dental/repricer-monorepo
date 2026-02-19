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

// 2. config.ts — Zod parse at module level
jest.mock("../../../config", () => ({
  applicationConfig: {
    WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE: false,
  },
}));

// 3. knex-wrapper — imported by shipping-threshold.ts
jest.mock("../../../../model/sql-models/knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
}));

// 4. mySql-mapper — imported by utility.ts
jest.mock("../../../mysql/mySql-mapper", () => ({}));

// ============================================================
// IMPORTS
// ============================================================

import { V2Adapter } from "./v2-adapter";
import { V1Adapter, V1PrecomputedResult } from "./v1-adapter";
import { runSharedAlgoTests } from "./shared-suite";
import { AlgoInput, NormalizedDecision } from "./normalized-types";

// ---------------------------------------------------------------------------
// Run the shared universal test suite against V2
// ---------------------------------------------------------------------------

runSharedAlgoTests(new V2Adapter());

// ---------------------------------------------------------------------------
// V1 normalization tests (test the mapping logic itself)
// ---------------------------------------------------------------------------

describe("V1 Adapter: explained string normalization", () => {
  const { mapV1ExplainedToCategory } = require("./v1-adapter");

  it("should map floor-related IGNORE strings to IGNORE_FLOOR", () => {
    expect(mapV1ExplainedToCategory("IGNORE: #HitFloor", false, 10, "N/A")).toBe("IGNORE_FLOOR");
    expect(mapV1ExplainedToCategory("IGNORED : No Changes as Floor Price is hit #HitFloor", false, 10, "N/A")).toBe("IGNORE_FLOOR");
    expect(mapV1ExplainedToCategory("IGNORE : Logical Error.Suggested Price Below Floor #LOGICALERROR", false, 10, "N/A")).toBe("IGNORE_FLOOR");
    expect(mapV1ExplainedToCategory("IGNORE :#HitFloor", false, 10, "N/A")).toBe("IGNORE_FLOOR");
  });

  it("should map sister vendor IGNORE strings to IGNORE_SISTER", () => {
    expect(mapV1ExplainedToCategory("IGNORE: #Sister #DOWN", false, 10, "N/A")).toBe("IGNORE_SISTER");
    expect(mapV1ExplainedToCategory("IGNORE: #Sister", false, 10, "N/A")).toBe("IGNORE_SISTER");
    expect(mapV1ExplainedToCategory("IGNORED : Next lowest vendor is the sister vendor #DOWN", false, 10, "N/A")).toBe("IGNORE_SISTER");
    expect(mapV1ExplainedToCategory("IGNORED : Lowest vendor is the sister vendor", false, 10, "N/A")).toBe("IGNORE_SISTER");
  });

  it("should map buy box IGNORE to IGNORE_BUYBOX", () => {
    expect(mapV1ExplainedToCategory("IGNORE : #HasBuyBox", false, 10, "N/A")).toBe("IGNORE_BUYBOX");
  });

  it("should map lowest IGNORE strings to IGNORE_LOWEST", () => {
    expect(mapV1ExplainedToCategory("IGNORE: #Lowest", false, 10, "N/A")).toBe("IGNORE_LOWEST");
    expect(mapV1ExplainedToCategory("IGNORE:#Lowest", false, 10, "N/A")).toBe("IGNORE_LOWEST");
    expect(mapV1ExplainedToCategory("IGNORED : No change needed as vendor is already the lowest", false, 10, "N/A")).toBe("IGNORE_LOWEST");
  });

  it("should map direction rule IGNORE strings to IGNORE_SETTINGS", () => {
    expect(mapV1ExplainedToCategory("IGNORED: Price up only #DOWN", false, 10, "N/A")).toBe("IGNORE_SETTINGS");
    expect(mapV1ExplainedToCategory("IGNORED: Price down only #UP", false, 10, "N/A")).toBe("IGNORE_SETTINGS");
  });

  it("should map suppress/keep-position IGNORE strings to IGNORE_SETTINGS", () => {
    expect(mapV1ExplainedToCategory("IGNORE: #SupressQbreakrule", false, 10, "N/A")).toBe("IGNORE_SETTINGS");
    expect(mapV1ExplainedToCategory("IGNORE : #KeepPosition", false, 10, "N/A")).toBe("IGNORE_SETTINGS");
    expect(mapV1ExplainedToCategory("IGNORE: #CompeteonQbreaksonly", false, 10, "N/A")).toBe("IGNORE_SETTINGS");
  });

  it("should detect CHANGE_DOWN from price comparison", () => {
    expect(mapV1ExplainedToCategory("CHANGE: lowest validated", true, 10.0, 8.0)).toBe("CHANGE_DOWN");
  });

  it("should detect CHANGE_UP from price comparison", () => {
    expect(mapV1ExplainedToCategory("CHANGE: lowest validated", true, 10.0, 15.0)).toBe("CHANGE_UP");
  });

  it("should detect CHANGE_NEW", () => {
    expect(mapV1ExplainedToCategory("CHANGE: New Break created", true, 0, 10.0)).toBe("CHANGE_NEW");
  });

  it("should detect CHANGE_REMOVED", () => {
    expect(mapV1ExplainedToCategory("CHANGE: QBreak made Inactive -no competitor", true, 10.0, 0)).toBe("CHANGE_REMOVED");
    expect(mapV1ExplainedToCategory("CHANGE: QBreak made Inactive #Hitfloor", true, 10.0, 0)).toBe("CHANGE_REMOVED");
  });

  it("should handle concatenated explained strings", () => {
    expect(mapV1ExplainedToCategory("IGNORE :#HitFloor_IGNORED: Price up only #DOWN", false, 10, "N/A")).toBe("IGNORE_FLOOR");
  });

  it("should return ERROR for null explained", () => {
    expect(mapV1ExplainedToCategory(null, false, 10, "N/A")).toBe("ERROR");
  });
});

// ---------------------------------------------------------------------------
// Side-by-side comparison tests (V1 pre-computed vs V2 live)
// ---------------------------------------------------------------------------

describe("V1 vs V2: Side-by-side comparison", () => {
  const v2Runner = new V2Adapter();

  /**
   * Helper: Run a scenario through V2 and compare against pre-computed V1 results.
   */
  async function compareAlgos(
    input: AlgoInput,
    v1Results: V1PrecomputedResult[],
    options: {
      priceTolerance?: number;
      allowedCategoryDifferences?: string[];
    } = {}
  ) {
    const priceTolerance = options.priceTolerance ?? 0.02;
    const allowedDiffs = new Set(options.allowedCategoryDifferences ?? []);

    const v1Adapter = new V1Adapter(v1Results);
    const v1Decisions = await v1Adapter.run(input);
    const v2Decisions = await v2Runner.run(input);

    const v1Map = new Map<string, NormalizedDecision>();
    for (const d of v1Decisions) {
      v1Map.set(`${d.vendorId}-Q${d.quantity}`, d);
    }

    const v2Map = new Map<string, NormalizedDecision>();
    for (const d of v2Decisions) {
      v2Map.set(`${d.vendorId}-Q${d.quantity}`, d);
    }

    const commonKeys = [...v1Map.keys()].filter((k) => v2Map.has(k));
    const mismatches: string[] = [];

    for (const key of commonKeys) {
      const v1 = v1Map.get(key)!;
      const v2 = v2Map.get(key)!;

      if (v1.shouldChange !== v2.shouldChange && !allowedDiffs.has("shouldChange")) {
        mismatches.push(`${key}: shouldChange differs. V1=${v1.shouldChange} (${v1.category}), V2=${v2.shouldChange} (${v2.category})`);
      }

      if (v1.category !== v2.category && !allowedDiffs.has(v1.category) && !allowedDiffs.has(v2.category)) {
        mismatches.push(`${key}: category differs. V1=${v1.category}, V2=${v2.category}`);
      }

      if (v1.suggestedPrice !== null && v2.suggestedPrice !== null) {
        const diff = Math.abs(v1.suggestedPrice - v2.suggestedPrice);
        if (diff > priceTolerance) {
          mismatches.push(`${key}: price differs beyond tolerance. V1=$${v1.suggestedPrice}, V2=$${v2.suggestedPrice} (diff=$${diff.toFixed(4)})`);
        }
      }
    }

    return {
      v1Decisions,
      v2Decisions,
      commonKeys,
      mismatches,
      v1Only: [...v1Map.keys()].filter((k) => !v2Map.has(k)),
      v2Only: [...v2Map.keys()].filter((k) => !v1Map.has(k)),
    };
  }

  it("should agree on floor enforcement for a simple scenario", async () => {
    const input: AlgoInput = {
      mpId: 12345,
      net32Products: [
        {
          vendorId: 100,
          vendorName: "Our Vendor",
          inStock: true,
          standardShipping: 5,
          shippingTime: 2,
          inventory: 100,
          badgeId: 0,
          badgeName: null,
          priceBreaks: [{ minQty: 1, unitPrice: 8.0 }],
          freeShippingGap: 0,
          freeShippingThreshold: 100,
        },
        {
          vendorId: 9000,
          vendorName: "Competitor",
          inStock: true,
          standardShipping: 5,
          shippingTime: 2,
          inventory: 100,
          badgeId: 0,
          badgeName: null,
          priceBreaks: [{ minQty: 1, unitPrice: 3.0 }],
          freeShippingGap: 0,
          freeShippingThreshold: 100,
        },
      ],
      allOwnVendorIds: [100],
      non422VendorIds: [100],
      vendorConfigs: [
        {
          vendorId: 100,
          vendorName: "Our Vendor",
          floorPrice: 7.0,
          maxPrice: 50.0,
          direction: "UP_DOWN",
          priceStrategy: "UNIT",
          enabled: true,
          sisterVendorIds: "",
          excludeVendors: "",
          competeWithAllVendors: false,
          floorCompeteWithNext: false,
          ownVendorThreshold: 1,
          inventoryCompetitionThreshold: 1,
          standardShipping: 5,
          freeShippingThreshold: 100,
        },
      ],
      isSlowCron: false,
    };

    // V1 pre-computed: competitor at $3 with floor $7 -> IGNORE #HitFloor
    const v1Results: V1PrecomputedResult[] = [
      {
        vendorId: 100,
        minQty: 1,
        oldPrice: 8.0,
        newPrice: "N/A",
        isRepriced: false,
        explained: "IGNORE :#HitFloor",
      },
    ];

    const result = await compareAlgos(input, v1Results);

    expect(result.mismatches).toHaveLength(0);
  });

  it("should agree on max price capping", async () => {
    const input: AlgoInput = {
      mpId: 12345,
      net32Products: [
        {
          vendorId: 100,
          vendorName: "Our Vendor",
          inStock: true,
          standardShipping: 5,
          shippingTime: 2,
          inventory: 100,
          badgeId: 0,
          badgeName: null,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0 }],
          freeShippingGap: 0,
          freeShippingThreshold: 100,
        },
      ],
      allOwnVendorIds: [100],
      non422VendorIds: [100],
      vendorConfigs: [
        {
          vendorId: 100,
          vendorName: "Our Vendor",
          floorPrice: 5.0,
          maxPrice: 20.0,
          direction: "UP_DOWN",
          priceStrategy: "UNIT",
          enabled: true,
          sisterVendorIds: "",
          excludeVendors: "",
          competeWithAllVendors: false,
          floorCompeteWithNext: false,
          ownVendorThreshold: 1,
          inventoryCompetitionThreshold: 1,
          standardShipping: 5,
          freeShippingThreshold: 100,
        },
      ],
      isSlowCron: false,
    };

    // V1 pre-computed: no competitors -> CHANGE to max price
    const v1Results: V1PrecomputedResult[] = [
      {
        vendorId: 100,
        minQty: 1,
        oldPrice: 10.0,
        newPrice: 20.0,
        isRepriced: true,
        explained: "CHANGE: Price is MAXED",
      },
    ];

    const result = await compareAlgos(input, v1Results);

    // V2 should also suggest $20 (max price)
    const v2Q1 = result.v2Decisions.filter((d) => d.vendorId === 100 && d.quantity === 1);
    expect(v2Q1.length).toBeGreaterThan(0);
    expect(v2Q1[0].suggestedPrice).toBe(20.0);
  });
});
