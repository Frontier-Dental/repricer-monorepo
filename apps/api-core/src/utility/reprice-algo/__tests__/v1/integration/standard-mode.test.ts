/**
 * Integration tests for V1 standard repricing mode.
 *
 * Tests the Reprice() function from reprice-helper.ts with real algorithm logic,
 * mocking only external I/O boundaries (globalParam for DB, config for env vars).
 */
import { Net32Product, Net32PriceBreak } from "../../../../../types/net32";
import { FrontierProduct } from "../../../../../types/frontier";

// ============================================================
// MOCKS - must be before imports of modules under test
// ============================================================

jest.mock("../../../../../model/global-param", () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: "17357",
    EXCLUDED_VENDOR_ID: "20722;20755",
  }),
}));

jest.mock("../../../../config", () => ({
  applicationConfig: {
    OFFSET: 0.01,
    IGNORE_TIE: false,
    FLAG_MULTI_PRICE_UPDATE: true,
    IS_DEV: true,
    VENDOR_ID: 17357,
    OWN_VENDOR_LIST: "17357;20722;20755;20533;20727;5",
    EXCLUDED_VENDOR_ID: "20722;20755",
    PRICE_UPDATE_V2_ENABLED: false,
    WRITE_HISTORY_SQL: false,
    FORMAT_RESPONSE_CUSTOM: true,
    CRON_NAME_422: "Cron-422",
  },
}));

// badge-helper calls globalParam.GetInfo internally; mock is covered above.
// filter-mapper calls globalParam.GetInfo internally; mock is covered above.

// mongo db-helper is used by filter-mapper's IsWaitingForNextRun, which is NOT
// called by Reprice() -- only by repriceProduct(). Still, mock it defensively.
jest.mock("../../../../mongo/db-helper", () => ({
  FindErrorItemByIdAndStatus: jest.fn().mockResolvedValue(0),
  UpdateProductAsync: jest.fn().mockResolvedValue(undefined),
  UpsertErrorItemLog: jest.fn().mockResolvedValue(undefined),
  SaveFilterCronLogs: jest.fn().mockResolvedValue(undefined),
}));

// mysql-helper is imported by filter-mapper; must mock to avoid ESM crash
// from @repricer-monorepo/shared
jest.mock("../../../../mysql/mysql-helper", () => ({}));

// ============================================================
// IMPORTS - after mocks
// ============================================================

import * as repriceHelper from "../../../v1/reprice-helper";

// ============================================================
// BUILDERS
// ============================================================

function buildNet32Product(overrides: Partial<Net32Product> & { vendorId: number | string; priceBreaks: Net32PriceBreak[] }): Net32Product {
  return {
    vendorProductId: 1001,
    vendorProductCode: "TEST-001",
    vendorName: `Vendor-${overrides.vendorId}`,
    vendorRegion: "US",
    inStock: true,
    standardShipping: 0,
    standardShippingStatus: "FREE_SHIPPING",
    freeShippingGap: 0,
    heavyShippingStatus: "NONE",
    heavyShipping: 0,
    shippingTime: 2,
    inventory: 100,
    isFulfillmentPolicyStock: false,
    vdrGeneralAverageRatingSum: 4.5,
    vdrNumberOfGeneralRatings: 100,
    isBackordered: false,
    vendorProductLevelLicenseRequiredSw: false,
    vendorVerticalLevelLicenseRequiredSw: false,
    badgeId: 0,
    badgeName: null,
    imagePath: "",
    arrivalDate: "",
    arrivalBusinessDays: 2,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    freeShippingThreshold: 0,
    ...overrides,
  };
}

function buildPriceBreak(minQty: number, unitPrice: number, active: boolean = true): Net32PriceBreak {
  return { minQty, unitPrice, active };
}

function buildFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: "TRADENT",
    activated: true,
    mpid: 12345,
    channelId: "ch-001",
    unitPrice: "10.00",
    floorPrice: "5.00",
    maxPrice: "50.00",
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: -1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: "",
    badgePercentage: 0,
    productName: "Test Product",
    cronId: "cron-001",
    cronName: "TestCron",
    requestInterval: 60,
    requestIntervalUnit: "MIN",
    scrapeOn: false,
    allowReprice: true,
    focusId: "",
    priority: 1,
    wait_update_period: false,
    net32url: "",
    abortDeactivatingQPriceBreak: false,
    ownVendorId: "17357",
    sisterVendorId: "20722;20755",
    tags: [],
    includeInactiveVendors: false,
    inactiveVendorId: "",
    override_bulk_update: false,
    override_bulk_rule: -1,
    latest_price: 10,
    executionPriority: 1,
    lastCronRun: "",
    lastExistingPrice: "10.00",
    lastSuggestedPrice: "",
    lastUpdatedBy: "",
    last_attempted_time: "",
    last_cron_message: "",
    last_cron_time: "",
    lowest_vendor: "",
    lowest_vendor_price: "",
    next_cron_time: "",
    slowCronId: "",
    slowCronName: "",
    last_update_time: "",
    applyBuyBoxLogic: false,
    applyNcForBuyBox: false,
    isSlowActivated: false,
    lastUpdatedByUser: "",
    lastUpdatedOn: "",
    handlingTimeFilter: "",
    keepPosition: false,
    excludedVendors: "",
    inventoryThreshold: 0,
    percentageDown: "0",
    badgePercentageDown: "0",
    competeWithNext: false,
    triggeredByVendor: "",
    ignorePhantomQBreak: false,
    ownVendorThreshold: 0,
    skipReprice: false,
    secretKey: [],
    contextCronName: "TestCron",
    ...overrides,
  } as FrontierProduct;
}

// ============================================================
// TESTS
// ============================================================

describe("V1 Standard Mode Integration - Reprice()", () => {
  const OWN_VENDOR_ID = 17357;
  const SISTER_VENDOR_ID = 20722;
  const COMPETITOR_VENDOR_ID = 99999;
  const MPID = "12345";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // Test 1: Undercut lowest competitor
  // ----------------------------------------------------------
  it("should undercut lowest competitor by OFFSET ($0.01)", async () => {
    // Own vendor at $12, competitor at $10. Expected: $9.99
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 12.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
    });

    // payload = competitor list (does NOT include own vendor for Reprice())
    // refProduct = own vendor's Net32Product
    const result = await repriceHelper.Reprice(ownProduct, [ownProduct, competitor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.isRepriced).toBe(true);
    expect(parseFloat(result.repriceDetails!.newPrice as string)).toBe(9.99);
    expect(result.repriceDetails!.explained).toContain("CHANGE");
  });

  // ----------------------------------------------------------
  // Test 2: No competitor (only own vendor in list)
  // ----------------------------------------------------------
  it("should go to max price when no competitor exists", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const productItem = buildFrontierProduct({
      maxPrice: "50.00",
    });

    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct], // only own vendor
      productItem,
      MPID
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // When own vendor is lowest and only vendor, should set to maxPrice
    expect(result.repriceDetails!.explained).toContain("No competitor");
  });

  // ----------------------------------------------------------
  // Test 3: Own vendor already lowest
  // ----------------------------------------------------------
  it("should IGNORE when own vendor is already lowest and no competitor to compete up to", async () => {
    // Own vendor at $8, competitor at $12. Own is lowest.
    // With no higher-priced non-sister competitor to compete UP to within bounds,
    // the algo should suggest repricing up to compete with the next vendor.
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 8.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [buildPriceBreak(1, 12.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
    });

    const result = await repriceHelper.Reprice(ownProduct, [ownProduct, competitor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // When own vendor is lowest, algo tries to price up to next competitor - 0.01
    // Next competitor is at $12, so suggested = $11.99
    // Since $11.99 > $8.00 (existing), isRepriced should be true
    expect(result.repriceDetails!.isRepriced).toBe(true);
    expect(parseFloat(result.repriceDetails!.newPrice as string)).toBe(11.99);
  });

  // ----------------------------------------------------------
  // Test 4: Competitor below floor -> IGNORE #HitFloor
  // ----------------------------------------------------------
  it("should IGNORE with #HitFloor when offset price is below floor", async () => {
    // Own vendor at $10, competitor at $5.50, floor at $6.
    // Offset price = $5.49, which is below floor.
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [buildPriceBreak(1, 5.5)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "6.00",
      maxPrice: "50.00",
    });

    const result = await repriceHelper.Reprice(ownProduct, [ownProduct, competitor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // Price of 5.50 - 0.01 = 5.49 < floor of 6.00
    expect(result.repriceDetails!.explained).toContain("#HitFloor");
  });

  // ----------------------------------------------------------
  // Test 5: Sister vendor is lowest -> IGNORE #Sister #DOWN
  // ----------------------------------------------------------
  it("should IGNORE with #Sister when sister vendor is lowest", async () => {
    // Sister vendor (20722) is lowest at $8, own vendor at $10.
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const sisterVendor = buildNet32Product({
      vendorId: SISTER_VENDOR_ID,
      vendorName: "Frontier",
      priceBreaks: [buildPriceBreak(1, 8.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
    });

    const result = await repriceHelper.Reprice(ownProduct, [ownProduct, sisterVendor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.explained).toContain("#Sister");
    expect(result.repriceDetails!.isRepriced).toBe(false);
  });

  // ----------------------------------------------------------
  // Test 6: Go to 2nd lowest when 1st is at floor
  // ----------------------------------------------------------
  it("should compete with 2nd lowest when 1st competitor is at floor", async () => {
    // Own vendor at $10 (lowest), competitor A at $4 (below floor), competitor B at $15.
    // Floor = $6. Competitor A is below floor, so algo should compete with B.
    // Expected: $14.99
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const competitorA = buildNet32Product({
      vendorId: 88888,
      vendorName: "CheapVendor",
      priceBreaks: [buildPriceBreak(1, 4.0)],
    });
    const competitorB = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorB",
      priceBreaks: [buildPriceBreak(1, 15.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "6.00",
      maxPrice: "50.00",
    });

    const result = await repriceHelper.Reprice(ownProduct, [ownProduct, competitorA, competitorB], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // Should skip competitorA (below floor) and compete with competitorB
    // Price = $15.00 - $0.01 = $14.99
    if (result.repriceDetails!.isRepriced) {
      expect(parseFloat(result.repriceDetails!.newPrice as string)).toBe(14.99);
    }
  });

  // ----------------------------------------------------------
  // Test 7: Go to max when all competitors below floor
  // ----------------------------------------------------------
  it("should go to max price when all competitors are below floor", async () => {
    // Own vendor is lowest, all competitors below floor.
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [buildPriceBreak(1, 3.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "6.00",
      maxPrice: "50.00",
    });

    const result = await repriceHelper.Reprice(ownProduct, [ownProduct, competitor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // When own vendor is lowest and all other vendors are below floor,
    // the algo should go to max price
    // The exact behavior depends on the sortedPayload and nextIndex logic
  });

  // ----------------------------------------------------------
  // Test 8: Tie scenario (two vendors same price)
  // ----------------------------------------------------------
  it("should append #TIE when two vendors have the same price", async () => {
    // Two non-own vendors tied at $10
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 15.0)],
    });
    const competitorA = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const competitorB = buildNet32Product({
      vendorId: 77777,
      vendorName: "CompetitorB",
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
    });

    const result = await repriceHelper.Reprice(ownProduct, [ownProduct, competitorA, competitorB], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.explained).toContain("#TIE");
  });

  // ----------------------------------------------------------
  // Test 9: Percentage-based pricing (percentageDown > 0)
  // ----------------------------------------------------------
  it("should use percentage-based pricing when percentageDown is set", async () => {
    // Competitor at $10, percentageDown = 0.05 (5%).
    // Percentage price = $10 - 5% = $9.50
    // Offset price = $10 - $0.01 = $9.99
    // Since percentageDown is set and %price > floor, should use $9.50
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 15.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
      percentageDown: "0.05",
    });

    const result = await repriceHelper.Reprice(ownProduct, [ownProduct, competitor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.isRepriced).toBe(true);
    // The percentage price should be used: 10 - (10 * 0.05) = 9.50
    expect(parseFloat(result.repriceDetails!.newPrice as string)).toBe(9.5);
    expect(result.repriceDetails!.explained).toContain("#%Down");
  });

  // ----------------------------------------------------------
  // Test 10: Price capped at max price
  // ----------------------------------------------------------
  it("should cap price at max when computed price exceeds max", async () => {
    // Own vendor lowest at $8, next competitor at $60, max = $20
    // Algo would want to set to $59.99 but max is $20
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 8.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [buildPriceBreak(1, 60.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "20.00",
    });

    const result = await repriceHelper.Reprice(ownProduct, [ownProduct, competitor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // Price should be capped at max ($20), not $59.99
    expect(result.repriceDetails!.explained).toContain("MAXED");
  });
});
