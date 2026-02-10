import net32Products from "./fixtures/sample-net32-response.json";
import vendorConfigs from "./fixtures/vendor-configs.json";

// Mock the shared package before any imports that use it
jest.mock("@repricer-monorepo/shared", () => ({
  AlgoExecutionMode: {
    V1_ONLY: "V1_ONLY",
    V2_ONLY: "V2_ONLY",
    V1_EXECUTE_V2_DRY: "V1_EXECUTE_V2_DRY",
    V2_EXECUTE_V1_DRY: "V2_EXECUTE_V1_DRY",
  },
  VendorName: {
    TRADENT: "TRADENT",
    FRONTIER: "FRONTIER",
    MVP: "MVP",
    TOPDENT: "TOPDENT",
    FIRSTDENT: "FIRSTDENT",
    TRIAD: "TRIAD",
    BITESUPPLY: "BITESUPPLY",
  },
  VendorIdLookup: {
    TRADENT: 17357,
    FRONTIER: 20722,
    MVP: 20755,
    TOPDENT: 20727,
    FIRSTDENT: 20533,
    TRIAD: 5,
    BITESUPPLY: 10,
  },
}));

jest.mock("../../config", () => ({
  applicationConfig: {
    IS_DEBUG: true,
    IS_DEV: true,
    FILE_PATH: "./fixtures/sample-net32-response.json",
    FLAG_MULTI_PRICE_UPDATE: true,
    CRON_NAME_422: "Cron-422",
    OWN_VENDOR_LIST: "17357;20722;20755;20533;20727;5;10",
    PRICE_UPDATE_V2_ENABLED: false,
    OFFSET: 0.01,
    VENDOR_COUNT: 7,
  },
}));

jest.mock("../../mysql/mysql-helper", () => ({
  UpdateTriggeredByVendor: jest.fn().mockResolvedValue(undefined),
  UpdateRepriceResultStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../mysql/mysql-v2", () => ({
  GetCronSettingsDetailsById: jest.fn().mockResolvedValue({
    SecretKey: [
      { vendorName: "TRADENT", secretKey: "test-tradent-secret" },
      { vendorName: "FRONTIER", secretKey: "test-frontier-secret" },
    ],
  }),
  GetFullCronSettingsList: jest.fn().mockResolvedValue([]),
  GetGlobalConfig: jest.fn().mockResolvedValue({ override_all: "false" }),
}));

jest.mock("../../history-helper", () => ({
  Execute: jest.fn().mockResolvedValue([{ historyIdentifier: "test-history-id", minQty: 1 }]),
}));

jest.mock("../../../utility/repriceResultParser", () => ({
  Parse: jest.fn().mockReturnValue({ status: "SUCCESS" }),
}));

jest.mock("../../../utility/filter-mapper", () => ({
  IsWaitingForNextRun: jest.fn().mockResolvedValue(false),
  GetLastCronMessageSimple: jest.fn().mockReturnValue("Test message"),
  FilterBasedOnParams: jest.fn().mockImplementation((list) => Promise.resolve(list)),
  GetProductDetailsByVendor: jest.fn().mockImplementation((details, _vendor) => details),
  GetContextPrice: jest.fn().mockImplementation((price, offset, _floor, _percDown, _minQty, _heavyShip) => ({
    Price: price - offset,
    Type: "OFFSET",
  })),
  IsVendorFloorPrice: jest.fn().mockResolvedValue(false),
  VerifyFloorWithSister: jest.fn().mockReturnValue(false),
  AppendPriceFactorTag: jest.fn().mockImplementation((msg, _type) => msg),
}));

jest.mock("../../../utility/buy-box-helper", () => ({
  parseShippingBuyBox: jest.fn().mockImplementation((result) => result),
  parseBadgeBuyBox: jest.fn().mockImplementation((result) => result),
}));

jest.mock("../../mysql/tinyproxy-configs", () => ({
  findTinyProxyConfigByVendorId: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../axios-helper", () => ({
  postAsync: jest.fn().mockResolvedValue({ data: { status: "SUCCESS" } }),
}));

jest.mock("../v2/wrapper", () => ({
  updatePrice: jest.fn().mockResolvedValue({ data: { status: "SUCCESS" } }),
}));

jest.mock("../../../resources/api-mapping", () => ({
  apiMapping: [
    { vendor: "TRADENT", priceUpdateUrl: "https://test.com/update" },
    { vendor: "FRONTIER", priceUpdateUrl: "https://test.com/update" },
  ],
}));

const mockGetInfo = jest.fn();
jest.mock("../../../model/global-param", () => ({
  GetInfo: (...args: any[]) => mockGetInfo(...args),
}));

// Import after mocks are set up
import { repriceProduct } from "./algo-v1";
import { GetPrioritySequence } from "../../request-generator";

// ─── Helpers ───

function makeNet32Product(overrides: Record<string, any> = {}) {
  return {
    vendorProductId: 1,
    vendorProductCode: "PROD-001",
    vendorId: "99999",
    vendorName: "Test Vendor",
    vendorRegion: "US",
    inStock: true,
    standardShipping: 6.99,
    standardShippingStatus: "STANDARD_SHIPPING",
    freeShippingGap: 50.0,
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
    priceBreaks: [{ minQty: 1, unitPrice: 15.0, active: true }],
    badgeId: 0,
    badgeName: null,
    imagePath: "",
    arrivalDate: "2026-02-15",
    arrivalBusinessDays: 2,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    freeShippingThreshold: 65.0,
    ...overrides,
  };
}

function makeInternalProduct(overrides: Record<string, any> = {}) {
  return {
    channelName: "Net32",
    activated: true,
    mpid: 12345,
    channelId: "net32-channel",
    productName: "Test Product",
    cronId: "cron-123",
    cronName: "TestCron",
    requestInterval: 30,
    requestIntervalUnit: "min",
    scrapeOn: true,
    allowReprice: true,
    ownVendorId: "17357",
    sisterVendorId: "20722;20755;20533;20727;5;10",
    unitPrice: "15.00",
    floorPrice: "8.00",
    maxPrice: "25.00",
    latest_price: 15.0,
    contextCronName: "TestCron",
    algo_execution_mode: "V1_ONLY",
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 0,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: "",
    badgePercentage: 0,
    focusId: "",
    priority: 1,
    wait_update_period: false,
    net32url: "https://www.net32.com/product/12345",
    abortDeactivatingQPriceBreak: false,
    tags: [],
    includeInactiveVendors: false,
    inactiveVendorId: "",
    override_bulk_update: false,
    override_bulk_rule: 0,
    executionPriority: 1,
    lastCronRun: "",
    lastExistingPrice: "",
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
    percentageDown: "",
    badgePercentageDown: "",
    competeWithNext: false,
    triggeredByVendor: "",
    ignorePhantomQBreak: false,
    ownVendorThreshold: 0,
    skipReprice: false,
    secretKey: [],
    ...overrides,
  };
}

function setGlobalInfoForTradent() {
  mockGetInfo.mockResolvedValue({
    VENDOR_ID: "17357",
    EXCLUDED_VENDOR_ID: "20722;20755;20533;20727;5;10",
    OWN_VENDOR_LIST: "17357;20722;20755;20533;20727;5;10",
    OFFSET: 0.01,
  });
}

// ─── Upstream helpers ───

const VENDOR_DEFAULTS: Record<string, { ownVendorId: string; key: string }> = {
  tradent: { ownVendorId: "17357", key: "tradentDetails" },
  frontier: { ownVendorId: "20722", key: "frontierDetails" },
  mvp: { ownVendorId: "20755", key: "mvpDetails" },
  topDent: { ownVendorId: "20727", key: "topDentDetails" },
  firstDent: { ownVendorId: "20533", key: "firstDentDetails" },
  triad: { ownVendorId: "5", key: "triadDetails" },
  biteSupply: { ownVendorId: "10", key: "biteSupplyDetails" },
};

const ALL_OWN_VENDOR_IDS = Object.values(VENDOR_DEFAULTS).map((v) => v.ownVendorId);

function getSisterIds(ownVendorId: string) {
  return ALL_OWN_VENDOR_IDS.filter((id) => id !== ownVendorId).join(";");
}

function makeFullProduct(vendors: Partial<Record<keyof typeof VENDOR_DEFAULTS, Record<string, any>>> = {}) {
  const buildVendor = (vendorKey: string, overrides?: Record<string, any>) => {
    if (!overrides) return null;
    const { ownVendorId } = VENDOR_DEFAULTS[vendorKey];
    return makeInternalProduct({
      ownVendorId,
      sisterVendorId: getSisterIds(ownVendorId),
      ...overrides,
    });
  };

  return {
    mpId: 12345,
    algo_execution_mode: "V1_ONLY",
    productIdentifier: 1,
    isSlowActivated: false,
    isScrapeOnlyActivated: false,
    scrapeOnlyCronId: "",
    scrapeOnlyCronName: "",
    tradentLinkInfo: null,
    frontierLinkInfo: null,
    mvpLinkInfo: null,
    topDentLinkInfo: null,
    firstDentLinkInfo: null,
    tradentDetails: buildVendor("tradent", vendors.tradent),
    frontierDetails: buildVendor("frontier", vendors.frontier),
    mvpDetails: buildVendor("mvp", vendors.mvp),
    topDentDetails: buildVendor("topDent", vendors.topDent),
    firstDentDetails: buildVendor("firstDent", vendors.firstDent),
    triadDetails: buildVendor("triad", vendors.triad),
    biteSupplyDetails: buildVendor("biteSupply", vendors.biteSupply),
  };
}

function setDynamicGlobalInfo() {
  mockGetInfo.mockImplementation((_mpid: any, productDet: any) => {
    if (productDet && productDet.ownVendorId && productDet.sisterVendorId) {
      return Promise.resolve({
        VENDOR_ID: productDet.ownVendorId,
        EXCLUDED_VENDOR_ID: productDet.sisterVendorId,
      });
    }
    return Promise.resolve({
      VENDOR_ID: "17357",
      EXCLUDED_VENDOR_ID: "20722;20755;20533;20727;5;10",
    });
  });
}

// ─── Tests ───

describe("V1 Reprice Algorithm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDynamicGlobalInfo();
  });

  it.only("should return the repriced vendor and new price", async () => {
    const mpid = "123";

    const net32Products = [
      // ── Own vendors ──
      makeNet32Product({ vendorId: "17357", vendorName: "Tradent Supply", vendorRegion: "MD", inStock: true, standardShipping: 0, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 1, inventory: 999, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 10231, vdrNumberOfGeneralRatings: 2290, badgeId: 0, badgeName: null, priceBreaks: [{ minQty: 1, unitPrice: 42.46, active: true }], arrivalDate: "2026-02-13", arrivalBusinessDays: 4 }),
      makeNet32Product({ vendorId: "20722", vendorName: "Frontier Dental Supply", vendorRegion: "MD", inStock: true, standardShipping: 0, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 2, inventory: 496, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 3262, vdrNumberOfGeneralRatings: 707, badgeId: 0, badgeName: null, priceBreaks: [{ minQty: 1, unitPrice: 44.58, active: true }], arrivalDate: "2026-02-17", arrivalBusinessDays: 5 }),
      makeNet32Product({ vendorId: "20755", vendorName: "MVP Dental Supply", vendorRegion: "NJ", inStock: true, standardShipping: 0, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 2, inventory: 27, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 2694, vdrNumberOfGeneralRatings: 565, badgeId: 0, badgeName: null, priceBreaks: [{ minQty: 1, unitPrice: 42.47, active: true }], arrivalDate: "2026-02-17", arrivalBusinessDays: 5 }),
      makeNet32Product({ vendorId: "5", vendorName: "Carolina Dental Supply", vendorRegion: "NC", inStock: true, standardShipping: 0, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 1, inventory: 3, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 1049, vdrNumberOfGeneralRatings: 241, badgeId: 1, badgeName: "3M", priceBreaks: [{ minQty: 1, unitPrice: 67.74, active: true }], arrivalDate: "2026-02-11", arrivalBusinessDays: 2, vendorProductLevelLicenseRequiredSw: true }),
      // ── External competitors (in stock) ──
      makeNet32Product({ vendorId: "130", vendorName: "PA Dental", vendorRegion: "MD", inStock: true, standardShipping: 5.95, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 1, inventory: 7, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 5981, vdrNumberOfGeneralRatings: 1291, badgeId: 1, badgeName: "3M", priceBreaks: [{ minQty: 1, unitPrice: 42.48, active: true }], arrivalDate: "2026-02-13", arrivalBusinessDays: 4, vendorProductLevelLicenseRequiredSw: true }),
      makeNet32Product({
        vendorId: "20772",
        vendorName: "IQ Dental Supply",
        vendorRegion: "NJ",
        inStock: true,
        standardShipping: 0,
        standardShippingStatus: "FREE_SHIPPING",
        freeShippingGap: 0,
        shippingTime: 5,
        inventory: 7,
        isFulfillmentPolicyStock: true,
        vdrGeneralAverageRatingSum: 293,
        vdrNumberOfGeneralRatings: 61,
        badgeId: 1,
        badgeName: "3M",
        priceBreaks: [
          { minQty: 1, unitPrice: 42.49, active: true },
          { minQty: 10, unitPrice: 41.31, active: true },
        ],
        arrivalDate: "2026-02-20",
        arrivalBusinessDays: 8,
      }),
      makeNet32Product({ vendorId: "18127", vendorName: "Shine Dental", vendorRegion: "FL", inStock: true, standardShipping: 5.99, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 4, inventory: 16, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 638, vdrNumberOfGeneralRatings: 146, badgeId: 0, badgeName: null, priceBreaks: [{ minQty: 1, unitPrice: 22.18, active: true }], arrivalDate: "2026-02-26", arrivalBusinessDays: 12 }),
      makeNet32Product({
        vendorId: "16992",
        vendorName: "Hey Dental",
        vendorRegion: "MD",
        inStock: true,
        standardShipping: 5.95,
        standardShippingStatus: "FREE_SHIPPING",
        freeShippingGap: 0,
        shippingTime: 1,
        inventory: 7,
        isFulfillmentPolicyStock: true,
        vdrGeneralAverageRatingSum: 2899,
        vdrNumberOfGeneralRatings: 619,
        badgeId: 0,
        badgeName: null,
        priceBreaks: [
          { minQty: 1, unitPrice: 45.95, active: true },
          { minQty: 20, unitPrice: 42.45, active: true },
        ],
        arrivalDate: "2026-02-13",
        arrivalBusinessDays: 4,
      }),
      makeNet32Product({ vendorId: "17396", vendorName: "DDI Supply", vendorRegion: "IA", inStock: true, standardShipping: 0, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 3, inventory: 7, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 3416, vdrNumberOfGeneralRatings: 773, badgeId: 0, badgeName: null, priceBreaks: [{ minQty: 1, unitPrice: 63.5, active: true }], arrivalDate: "2026-02-17", arrivalBusinessDays: 5 }),
      // ── External competitors (out of stock) ──
      makeNet32Product({ vendorId: "20721", vendorName: "Supply Doc", vendorRegion: "CA", inStock: false, standardShipping: 10.99, standardShippingStatus: "STANDARD_SHIPPING", freeShippingGap: 454.01, shippingTime: 3, inventory: 0, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 282, vdrNumberOfGeneralRatings: 64, badgeId: 1, badgeName: "3M", priceBreaks: [{ minQty: 1, unitPrice: 44.99, active: true }], arrivalDate: "2026-02-20", arrivalBusinessDays: 8 }),
      makeNet32Product({ vendorId: "20130", vendorName: "River Dental Supplies", vendorRegion: "NJ", inStock: false, standardShipping: 0, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 2, inventory: 0, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 4625, vdrNumberOfGeneralRatings: 1046, badgeId: 0, badgeName: null, priceBreaks: [{ minQty: 1, unitPrice: 31.8, active: true }], arrivalDate: "2026-02-18", arrivalBusinessDays: 6 }),
      makeNet32Product({ vendorId: "20718", vendorName: "Dentify", vendorRegion: "FL", inStock: false, standardShipping: 3.0, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 2, inventory: 0, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 288, vdrNumberOfGeneralRatings: 61, badgeId: 0, badgeName: null, priceBreaks: [{ minQty: 1, unitPrice: 32.6, active: true }], arrivalDate: "2026-02-17", arrivalBusinessDays: 5 }),
      makeNet32Product({ vendorId: "20816", vendorName: "Starcona Dental Solutions", vendorRegion: "NY", inStock: false, standardShipping: 0, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 2, inventory: 0, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 5, vdrNumberOfGeneralRatings: 1, badgeId: 0, badgeName: null, priceBreaks: [{ minQty: 1, unitPrice: 33.39, active: true }], arrivalDate: "2026-02-13", arrivalBusinessDays: 4 }),
      makeNet32Product({ vendorId: "18522", vendorName: "US Dental Supplies", vendorRegion: "NY", inStock: false, standardShipping: 0, standardShippingStatus: "FREE_SHIPPING", freeShippingGap: 0, shippingTime: 2, inventory: 0, isFulfillmentPolicyStock: true, vdrGeneralAverageRatingSum: 121, vdrNumberOfGeneralRatings: 27, badgeId: 0, badgeName: null, priceBreaks: [{ minQty: 1, unitPrice: 34.19, active: true }], arrivalDate: "2026-02-18", arrivalBusinessDays: 6 }),
    ];

    // Product config from sp_GetFullProductDetailsByIdV4 for MPID 123
    const sharedConfig = {
      mpid: "123",
      cronId: "78691bb865f24729b9501177384e31be",
      cronName: "Cron-10",
      slowCronId: "a9d4e1de6e864b7f9edf9cd202559774",
      slowCronName: "SCG-2",
      requestInterval: 1,
      requestIntervalUnit: "min",
      scrapeOn: true,
      allowReprice: true,
      is_nc_needed: false,
      repricingRule: 1,
      suppressPriceBreak: false,
      suppressPriceBreakForOne: true,
      beatQPrice: false,
      competeAll: false,
      percentageIncrease: 0,
      compareWithQ1: false,
      wait_update_period: true,
      abortDeactivatingQPriceBreak: true,
      override_bulk_update: true,
      override_bulk_rule: 2,
      applyBuyBoxLogic: false,
      applyNcForBuyBox: false,
      keepPosition: false,
      inventoryThreshold: 0,
      competeWithNext: false,
      ignorePhantomQBreak: true,
      ownVendorThreshold: 1,
      handlingTimeFilter: "ALL",
      includeInactiveVendors: false,
      latest_price: 0,
      algo_execution_mode: "V1_ONLY",
    };

    const product = makeFullProduct({
      frontier: { ...sharedConfig, executionPriority: 1, unitPrice: "22.48", floorPrice: "22.29", maxPrice: "50.18", badgeIndicator: "ALL_ZERO", badgePercentageDown: "0.030", percentageDown: "0.000", getBBBadgeValue: 0.1, getBBShippingValue: 0.01, getBBBadge: 0, getBBShipping: 0 },
      tradent: { ...sharedConfig, executionPriority: 2, unitPrice: "32.95", floorPrice: "22.29", maxPrice: "50.18", badgeIndicator: "ALL_ZERO", badgePercentageDown: "0.030", percentageDown: "0.000", inactiveVendorId: "N/A", getBBBadgeValue: 0.1, getBBShippingValue: 0.005, getBBBadge: 0, getBBShipping: 0 },
      mvp: { ...sharedConfig, executionPriority: 3, unitPrice: "36.98", floorPrice: "22.29", maxPrice: "50.18", badgeIndicator: "ALL_ZERO", badgePercentageDown: "0.030", percentageDown: "0.000", getBBBadgeValue: 0.1, getBBShippingValue: 0.005, getBBBadge: 0, getBBShipping: 0 },
      triad: { ...sharedConfig, executionPriority: 6, unitPrice: "48.95", floorPrice: "22.29", maxPrice: "67.74", badgeIndicator: "BADGE_ONLY", badgePercentageDown: "0.000", percentageDown: "0.000", getBBBadgeValue: 0.1, getBBShippingValue: 0.005, getBBBadge: 0, getBBShipping: 0 },
    });

    const prioritySequence = await GetPrioritySequence(product as any, null, false, false, null);

    const results: { vendor: string; oldPrice: any; newPrice: any; isRepriced: boolean; explained: string }[] = [];
    for (const seq of prioritySequence) {
      const vendorDetails = (product as any)[seq.value];
      if (vendorDetails && vendorDetails.activated && vendorDetails.scrapeOn && !vendorDetails.skipReprice) {
        const result = await repriceProduct(mpid, net32Products as any, vendorDetails as any, seq.name);
        const details = result.cronResponse.repriceData.listOfRepriceDetails?.[0] ?? result.cronResponse.repriceData.repriceDetails;
        results.push({
          vendor: seq.name,
          oldPrice: details?.oldPrice,
          newPrice: details?.newPrice,
          isRepriced: details?.isRepriced ?? false,
          explained: details?.explained ?? "",
        });
      }
    }

    console.log("\n========== REPRICE RESULTS ==========");
    for (const r of results) {
      console.log(`${r.vendor}: $${r.oldPrice} → $${r.newPrice} (repriced: ${r.isRepriced}) | ${r.explained}`);
    }
    console.log("=====================================\n");

    expect(results.length).toBeGreaterThan(0);
  });
});
