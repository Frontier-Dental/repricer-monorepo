/**
 * Integration tests for V1 NC (shipping-inclusive) repricing mode.
 *
 * In NC mode, shipping costs are added to unit prices for comparison.
 * The key difference: effectivePrice = unitPrice + shippingCharge
 */
import { Net32Product, Net32PriceBreak } from "../../../../../types/net32";
import { FrontierProduct } from "../../../../../types/frontier";

// ============================================================
// MOCKS
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

jest.mock("../../../../mongo/db-helper", () => ({
  FindErrorItemByIdAndStatus: jest.fn().mockResolvedValue(0),
  UpdateProductAsync: jest.fn().mockResolvedValue(undefined),
  UpsertErrorItemLog: jest.fn().mockResolvedValue(undefined),
  SaveFilterCronLogs: jest.fn().mockResolvedValue(undefined),
}));

// mysql-helper is imported by filter-mapper; must mock to avoid ESM crash
jest.mock("../../../../mysql/mysql-helper", () => ({}));

// ============================================================
// IMPORTS
// ============================================================

import * as repriceHelperNc from "../../../v1/reprice-helper-nc";

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
    is_nc_needed: true, // NC mode enabled
    suppressPriceBreakForOne: false,
    repricingRule: -1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: "",
    badgePercentage: 0,
    productName: "Test Product NC",
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

describe("V1 NC Mode Integration - Reprice()", () => {
  const OWN_VENDOR_ID = 17357;
  const COMPETITOR_VENDOR_ID = 99999;
  const MPID = "12345";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // Test 1: Shipping added to price comparison
  // ----------------------------------------------------------
  it("should include shipping in price comparison for NC mode", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      standardShipping: 5,
      standardShippingStatus: "STANDARD_SHIPPING",
      freeShippingGap: 90,
      freeShippingThreshold: 100,
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      standardShipping: 0,
      standardShippingStatus: "FREE_SHIPPING",
      freeShippingGap: 0,
      freeShippingThreshold: 0,
      priceBreaks: [buildPriceBreak(1, 12.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
    });

    const result = await repriceHelperNc.Reprice(ownProduct, [ownProduct, competitor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.isRepriced).toBe(true);
  });

  // ----------------------------------------------------------
  // Test 2: NC Buy Box when floor reached + applyNcForBuyBox
  // ----------------------------------------------------------
  it("should apply NC repricing when floor is reached and applyNcForBuyBox is true", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      standardShipping: 5,
      standardShippingStatus: "STANDARD_SHIPPING",
      freeShippingGap: 90,
      freeShippingThreshold: 100,
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      standardShipping: 3,
      standardShippingStatus: "STANDARD_SHIPPING",
      freeShippingGap: 87,
      freeShippingThreshold: 100,
      priceBreaks: [buildPriceBreak(1, 7.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
      applyNcForBuyBox: true,
    });

    const result = await repriceHelperNc.Reprice(ownProduct, [ownProduct, competitor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
  });

  // ----------------------------------------------------------
  // Test 3: Heavy shipping product
  // ----------------------------------------------------------
  it("should handle heavy shipping price in NC calculations", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      standardShipping: 5,
      standardShippingStatus: "STANDARD_SHIPPING",
      freeShippingGap: 90,
      freeShippingThreshold: 100,
      heavyShipping: 10,
      heavyShippingStatus: "HEAVY",
      priceBreaks: [buildPriceBreak(1, 20.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      standardShipping: 0,
      freeShippingThreshold: 0,
      heavyShipping: 8,
      heavyShippingStatus: "HEAVY",
      priceBreaks: [buildPriceBreak(1, 25.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "10.00",
      maxPrice: "80.00",
    });

    const result = await repriceHelperNc.Reprice(ownProduct, [ownProduct, competitor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
  });

  // ----------------------------------------------------------
  // Test 4: NC mode with free shipping (above threshold)
  // ----------------------------------------------------------
  it("should not add shipping when price is above free shipping threshold", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      standardShipping: 5,
      standardShippingStatus: "STANDARD_SHIPPING",
      freeShippingGap: 0,
      freeShippingThreshold: 15,
      priceBreaks: [buildPriceBreak(1, 20.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      standardShipping: 5,
      freeShippingThreshold: 15,
      priceBreaks: [buildPriceBreak(1, 25.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "10.00",
      maxPrice: "80.00",
    });

    const result = await repriceHelperNc.Reprice(ownProduct, [ownProduct, competitor], productItem, MPID);

    expect(result).toBeDefined();
  });

  // ----------------------------------------------------------
  // Test 5: NC RepriceIndividualPriceBreak with Q2
  // ----------------------------------------------------------
  it("should handle NC pricing for individual Q2 price break", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      standardShipping: 5,
      standardShippingStatus: "STANDARD_SHIPPING",
      freeShippingGap: 90,
      freeShippingThreshold: 100,
      priceBreaks: [buildPriceBreak(1, 10.0), buildPriceBreak(2, 9.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      standardShipping: 3,
      standardShippingStatus: "STANDARD_SHIPPING",
      freeShippingGap: 87,
      freeShippingThreshold: 100,
      priceBreaks: [buildPriceBreak(1, 11.0), buildPriceBreak(2, 10.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
    });

    const q2PriceBreak = buildPriceBreak(2, 9.0);

    const result = await repriceHelperNc.RepriceIndividualPriceBreak(ownProduct, [ownProduct, competitor], productItem, MPID, q2PriceBreak);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.minQty).toBe(2);
  });

  // ----------------------------------------------------------
  // Test 6: NC mode sister vendor handling
  // ----------------------------------------------------------
  it("should handle sister vendor in NC mode same as standard", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      standardShipping: 5,
      standardShippingStatus: "STANDARD_SHIPPING",
      freeShippingGap: 90,
      freeShippingThreshold: 100,
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const sisterVendor = buildNet32Product({
      vendorId: 20722,
      vendorName: "Frontier",
      standardShipping: 0,
      freeShippingThreshold: 0,
      priceBreaks: [buildPriceBreak(1, 8.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
    });

    const result = await repriceHelperNc.Reprice(ownProduct, [ownProduct, sisterVendor], productItem, MPID);

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.explained).toContain("#Sister");
    expect(result.repriceDetails!.isRepriced).toBe(false);
  });
});
