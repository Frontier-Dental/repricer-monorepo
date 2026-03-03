// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01 } }));
jest.mock("../../../../mongo/db-helper", () => ({}));
jest.mock("../../../../mysql/mysql-helper", () => ({}));
jest.mock("../../../../../model/global-param", () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: "100",
    EXCLUDED_VENDOR_ID: "200;201",
  }),
}));

import { FilterBasedOnParams } from "../../../../filter-mapper";
import { Net32Product } from "../../../../../types/net32";
import { FrontierProduct } from "../../../../../types/frontier";

function makeNet32Product(overrides: Partial<Net32Product> = {}): Net32Product {
  return {
    vendorProductId: 1,
    vendorProductCode: "VP001",
    vendorId: 100,
    vendorName: "Test Vendor",
    vendorRegion: "US",
    inStock: true,
    standardShipping: 5.99,
    standardShippingStatus: "ACTIVE",
    freeShippingGap: 10,
    heavyShippingStatus: "NONE",
    heavyShipping: 0,
    shippingTime: 3,
    inventory: 50,
    isFulfillmentPolicyStock: false,
    vdrGeneralAverageRatingSum: 4.5,
    vdrNumberOfGeneralRatings: 100,
    isBackordered: false,
    vendorProductLevelLicenseRequiredSw: false,
    vendorVerticalLevelLicenseRequiredSw: false,
    priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
    badgeId: 0,
    badgeName: null,
    imagePath: "",
    arrivalDate: "",
    arrivalBusinessDays: 3,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    ...overrides,
  };
}

function makeFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: "TRADENT",
    activated: true,
    mpid: 12345,
    channelId: "CH1",
    unitPrice: "10.00",
    floorPrice: "5.00",
    maxPrice: "99.00",
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: "ALL_ZERO",
    badgePercentage: 0,
    productName: "Test Product",
    cronId: "cron1",
    cronName: "Regular",
    requestInterval: 60,
    requestIntervalUnit: "MINUTES",
    scrapeOn: true,
    allowReprice: true,
    focusId: "",
    priority: 1,
    wait_update_period: false,
    net32url: "https://net32.com/test",
    abortDeactivatingQPriceBreak: false,
    ownVendorId: "100",
    sisterVendorId: "200;201",
    tags: [],
    includeInactiveVendors: true,
    inactiveVendorId: "",
    override_bulk_update: false,
    override_bulk_rule: 0,
    latest_price: 10.0,
    executionPriority: 1,
    lastCronRun: "",
    lastExistingPrice: "10.00",
    lastSuggestedPrice: "9.99",
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
    handlingTimeFilter: "ALL",
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
    contextCronName: "",
    contextMinQty: 1,
    ...overrides,
  } as FrontierProduct;
}

describe("FilterBasedOnParams - PHANTOM_PRICE_BREAK", () => {
  const highInvVendor = makeNet32Product({ vendorId: 1, inventory: 100, inStock: true });
  const medInvVendor = makeNet32Product({ vendorId: 2, inventory: 5, inStock: true });
  const lowInvVendor = makeNet32Product({ vendorId: 3, inventory: 1, inStock: true });
  const outOfStockVendor = makeNet32Product({ vendorId: 4, inventory: 50, inStock: false });
  const zeroInvVendor = makeNet32Product({ vendorId: 5, inventory: 0, inStock: true });
  const allVendors = [highInvVendor, medInvVendor, lowInvVendor, outOfStockVendor, zeroInvVendor];

  describe("when contextMinQty == 1 (no filtering)", () => {
    it("should return all vendors unfiltered", async () => {
      const product = makeFrontierProduct({ contextMinQty: 1 });
      const result = await FilterBasedOnParams(allVendors, product, "PHANTOM_PRICE_BREAK");
      expect(result).toHaveLength(5);
    });

    it("should return empty array when input is empty", async () => {
      const product = makeFrontierProduct({ contextMinQty: 1 });
      const result = await FilterBasedOnParams([], product, "PHANTOM_PRICE_BREAK");
      expect(result).toHaveLength(0);
    });
  });

  describe("when contextMinQty != 1", () => {
    it("should keep only in-stock vendors with inventory >= contextMinQty", async () => {
      const product = makeFrontierProduct({ contextMinQty: 5 });
      const result = await FilterBasedOnParams(allVendors, product, "PHANTOM_PRICE_BREAK");
      expect(result).toHaveLength(2);
      expect(result.map((v) => v.vendorId)).toEqual([1, 2]);
    });

    it("should filter out vendors not in stock even with sufficient inventory", async () => {
      const product = makeFrontierProduct({ contextMinQty: 2 });
      const result = await FilterBasedOnParams([outOfStockVendor], product, "PHANTOM_PRICE_BREAK");
      expect(result).toHaveLength(0);
    });

    it("should filter out vendors with zero inventory (falsy)", async () => {
      const product = makeFrontierProduct({ contextMinQty: 0 as any });
      const result = await FilterBasedOnParams([zeroInvVendor], product, "PHANTOM_PRICE_BREAK");
      expect(result).toHaveLength(0);
    });

    it("should handle contextMinQty = 2 at exact boundary", async () => {
      const exactVendor = makeNet32Product({ vendorId: 6, inventory: 2, inStock: true });
      const product = makeFrontierProduct({ contextMinQty: 2 });
      const result = await FilterBasedOnParams([exactVendor], product, "PHANTOM_PRICE_BREAK");
      expect(result).toHaveLength(1);
    });

    it("should handle contextMinQty = 2 just below boundary", async () => {
      const belowVendor = makeNet32Product({ vendorId: 7, inventory: 1, inStock: true });
      const product = makeFrontierProduct({ contextMinQty: 2 });
      const result = await FilterBasedOnParams([belowVendor], product, "PHANTOM_PRICE_BREAK");
      expect(result).toHaveLength(0);
    });

    it("should handle large contextMinQty filtering out everything", async () => {
      const product = makeFrontierProduct({ contextMinQty: 9999 });
      const result = await FilterBasedOnParams(allVendors, product, "PHANTOM_PRICE_BREAK");
      expect(result).toHaveLength(0);
    });
  });

  it("should handle contextMinQty undefined (parseInt(undefined) is NaN)", async () => {
    const product = makeFrontierProduct({ contextMinQty: undefined });
    // parseInt(undefined as unknown as string) => NaN, NaN != 1 is true
    // So filtering IS applied. item.inventory >= NaN is always false.
    const result = await FilterBasedOnParams(allVendors, product, "PHANTOM_PRICE_BREAK");
    expect(result).toHaveLength(0);
  });
});
