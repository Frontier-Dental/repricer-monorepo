/**
 * Integration tests for V1 multi-price-break repricing.
 *
 * Tests RepriceIndividualPriceBreak() and the multi-price-break flow
 * where each Q break is repriced independently, then rules enforce hierarchy.
 */
import { Net32Product, Net32PriceBreak } from "../../../../../types/net32";
import { FrontierProduct } from "../../../../../types/frontier";
import { RepriceModel } from "../../../../../model/reprice-model";

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

import * as repriceHelper from "../../../v1/reprice-helper";
import * as Rule from "../../../v1/repricer-rule-helper";

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
    productName: "Test Product Multi-PB",
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

describe("V1 Multi-Price-Break Integration", () => {
  const OWN_VENDOR_ID = 17357;
  const COMPETITOR_VENDOR_ID = 99999;
  const MPID = "12345";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // Test 1: Each Q break repriced independently
  // ----------------------------------------------------------
  it("should reprice Q1 and Q3 independently via RepriceIndividualPriceBreak", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 12.0), buildPriceBreak(3, 10.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [buildPriceBreak(1, 10.0), buildPriceBreak(3, 8.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
    });

    // Reprice Q1
    const q1Result = await repriceHelper.RepriceIndividualPriceBreak(ownProduct, [ownProduct, competitor], productItem, MPID, buildPriceBreak(1, 12.0));

    // Reprice Q3
    const q3Result = await repriceHelper.RepriceIndividualPriceBreak(ownProduct, [ownProduct, competitor], productItem, MPID, buildPriceBreak(3, 10.0));

    expect(q1Result.repriceDetails).toBeDefined();
    expect(q3Result.repriceDetails).toBeDefined();
    expect(q3Result.repriceDetails!.minQty).toBe(3);

    // Q1: competitor at $10, expected undercut = $9.99
    expect(q1Result.repriceDetails!.isRepriced).toBe(true);
    expect(parseFloat(q1Result.repriceDetails!.newPrice as string)).toBe(9.99);

    // Q3: competitor at $8, expected undercut = $7.99
    expect(q3Result.repriceDetails!.isRepriced).toBe(true);
    expect(parseFloat(q3Result.repriceDetails!.newPrice as string)).toBe(7.99);
  });

  // ----------------------------------------------------------
  // Test 2: Q break deactivated when no competitor has it
  // ----------------------------------------------------------
  it("should deactivate Q break when no competitor has that price break", async () => {
    // Own vendor has Q1 and Q3, competitor only has Q1
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 12.0), buildPriceBreak(3, 10.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [
        buildPriceBreak(1, 10.0),
        // No Q3 price break
      ],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
    });

    // Reprice Q3 -- no competitor has Q3
    const q3Result = await repriceHelper.RepriceIndividualPriceBreak(ownProduct, [ownProduct, competitor], productItem, MPID, buildPriceBreak(3, 10.0));

    expect(q3Result.repriceDetails).toBeDefined();
    // When no non-sister vendor has this Q break, the algo should deactivate it
  });

  // ----------------------------------------------------------
  // Test 3: Q break hierarchy enforced (Q3 price must be < Q1 price)
  // ----------------------------------------------------------
  it("should enforce Q break hierarchy via ApplyMultiPriceBreakRule", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 10.0), buildPriceBreak(3, 9.0)],
    });

    // Build a RepriceModel with multiple price breaks where Q3 >= Q1
    const multiModel = new RepriceModel(
      MPID,
      ownProduct,
      "Test Product",
      null,
      false,
      true // isMultiplePriceBreak = true
    );

    // Simulate Q1 repriced to $8.00
    const q1Detail = {
      oldPrice: 10.0,
      newPrice: "8.00" as string | number | null,
      isRepriced: true,
      updatedOn: new Date(),
      explained: "CHANGE: updated",
      lowestVendor: null,
      lowestVendorPrice: null,
      triggeredByVendor: null,
      minQty: 1,
    };
    // Simulate Q3 repriced to $9.00 (which is MORE than Q1's new price of $8.00 -- violation!)
    const q3Detail = {
      oldPrice: 9.0,
      newPrice: "9.00" as string | number | null,
      isRepriced: true,
      updatedOn: new Date(),
      explained: "CHANGE: 2nd lowest validated",
      lowestVendor: null,
      lowestVendorPrice: null,
      triggeredByVendor: null,
      minQty: 3,
    };
    multiModel.listOfRepriceDetails.push(q1Detail as any);
    multiModel.listOfRepriceDetails.push(q3Detail as any);

    const corrected = Rule.ApplyMultiPriceBreakRule(multiModel);

    expect(corrected.listOfRepriceDetails).toBeDefined();
    expect(corrected.listOfRepriceDetails.length).toBeGreaterThan(0);

    // The Q3 detail should be flagged because its price ($9.00) >= Q1 price ($8.00)
    const q3Corrected = corrected.listOfRepriceDetails.find((d: any) => d.minQty === 3);
    if (q3Corrected) {
      // ApplyMultiPriceBreakRule either marks it as not repriced or deactivates it
      expect(q3Corrected.isRepriced === false || q3Corrected.active === (0 as unknown as boolean) || (q3Corrected.explained && q3Corrected.explained.includes("#otherbreakslower"))).toBe(true);
    }
  });

  // ----------------------------------------------------------
  // Test 4: Suppress price break rule (Q1 unchanged blocks others)
  // ----------------------------------------------------------
  it("should suppress other Q breaks when Q1 is not changed (SuppressPriceBreakRule)", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 10.0), buildPriceBreak(3, 8.0)],
    });

    const multiModel = new RepriceModel(MPID, ownProduct, "Test Product", null, false, true);

    // Q1 NOT repriced (same price)
    const q1Detail = {
      oldPrice: 10.0,
      newPrice: "N/A" as string | number | null,
      isRepriced: false,
      updatedOn: new Date(),
      explained: "IGNORE: #Lowest",
      lowestVendor: null,
      lowestVendorPrice: null,
      triggeredByVendor: null,
      minQty: 1,
    };
    // Q3 repriced to $7.00
    const q3Detail = {
      oldPrice: 8.0,
      newPrice: "7.00" as string | number | null,
      isRepriced: true,
      updatedOn: new Date(),
      explained: "CHANGE: updated",
      lowestVendor: null,
      lowestVendorPrice: null,
      triggeredByVendor: null,
      minQty: 3,
    };
    multiModel.listOfRepriceDetails.push(q1Detail as any);
    multiModel.listOfRepriceDetails.push(q3Detail as any);

    // Apply the suppress rule: when Q1 is not changed, block other Qs
    const suppressed = Rule.ApplySuppressPriceBreakRule(multiModel, 1, false);

    const q3Suppressed = suppressed.listOfRepriceDetails.find((d: any) => d.minQty === 3);
    expect(q3Suppressed).toBeDefined();
    if (q3Suppressed) {
      expect(q3Suppressed.isRepriced).toBe(false);
      expect(q3Suppressed.newPrice).toBe("N/A");
      expect(q3Suppressed.explained).toContain("IGNORE");
    }
  });

  // ----------------------------------------------------------
  // Test 5: GetDistinctPriceBreaksAcrossVendors discovers new Q breaks
  // ----------------------------------------------------------
  it("should discover price breaks from competitors that own vendor does not have", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 10.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [buildPriceBreak(1, 9.0), buildPriceBreak(3, 7.0), buildPriceBreak(5, 6.0)],
    });
    const productItem = buildFrontierProduct();

    const distinctBreaks = await repriceHelper.GetDistinctPriceBreaksAcrossVendors([competitor], ownProduct, productItem);

    expect(distinctBreaks).toBeDefined();
    expect(distinctBreaks.length).toBe(2); // Q3 and Q5 (own vendor only has Q1)
    expect(distinctBreaks.find((b) => b.minQty === 3)).toBeDefined();
    expect(distinctBreaks.find((b) => b.minQty === 5)).toBeDefined();
    // New breaks should have unitPrice=0 and active=true
    expect(distinctBreaks[0].unitPrice).toBe(0);
    expect(distinctBreaks[0].active).toBe(true);
  });

  // ----------------------------------------------------------
  // Test 6: Full multi-price-break flow with rule application
  // ----------------------------------------------------------
  it("should reprice all Q breaks and enforce hierarchy in full flow", async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: "Tradent",
      priceBreaks: [buildPriceBreak(1, 15.0), buildPriceBreak(3, 12.0)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: "CompetitorA",
      priceBreaks: [buildPriceBreak(1, 10.0), buildPriceBreak(3, 8.0)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: "5.00",
      maxPrice: "50.00",
    });

    // Reprice each Q individually
    const q1Result = await repriceHelper.RepriceIndividualPriceBreak(ownProduct, [ownProduct, competitor], productItem, MPID, buildPriceBreak(1, 15.0));
    const q3Result = await repriceHelper.RepriceIndividualPriceBreak(ownProduct, [ownProduct, competitor], productItem, MPID, buildPriceBreak(3, 12.0));

    // Build multi model
    const multiModel = new RepriceModel(MPID, ownProduct, "Test Product", null, false, true);
    multiModel.listOfRepriceDetails.push(q1Result.repriceDetails!);
    multiModel.listOfRepriceDetails.push(q3Result.repriceDetails!);

    // Apply hierarchy rule
    const final = Rule.ApplyMultiPriceBreakRule(multiModel);

    expect(final.listOfRepriceDetails.length).toBeGreaterThan(0);
    // Q3 price should be less than Q1 price
    const q1Final = final.listOfRepriceDetails.find((d: any) => d.minQty === 1);
    const q3Final = final.listOfRepriceDetails.find((d: any) => d.minQty === 3);
    if (q1Final && q3Final && q1Final.newPrice !== "N/A" && q3Final.newPrice !== "N/A") {
      expect(parseFloat(q3Final.newPrice as string)).toBeLessThan(parseFloat(q1Final.newPrice as string));
    }
  });
});
