// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01 } }));
jest.mock("../../../../mongo/db-helper", () => ({}));
jest.mock("../../../../mysql/mysql-helper", () => ({}));
jest.mock("../../../../../model/global-param", () => ({
  GetInfo: jest.fn().mockImplementation(async (_mpId: any, productDet: any) => {
    return {
      VENDOR_ID: productDet?.ownVendorId || "100",
      EXCLUDED_VENDOR_ID: productDet?.sisterVendorId || "200;201",
    };
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

describe("FilterBasedOnParams - HANDLING_TIME", () => {
  // Own vendor (vendorId 100) with shippingTime 10 (long handling)
  const ownVendor = makeNet32Product({ vendorId: 100, vendorName: "Own", shippingTime: 10 });
  const fastVendor = makeNet32Product({ vendorId: 1, vendorName: "Fast", shippingTime: 1 });
  const medVendor = makeNet32Product({ vendorId: 2, vendorName: "Medium", shippingTime: 4 });
  const slowVendor = makeNet32Product({ vendorId: 3, vendorName: "Slow", shippingTime: 7 });
  const allVendors = [ownVendor, fastVendor, medVendor, slowVendor];

  describe("FAST_SHIPPING (shippingTime <= 2)", () => {
    it("should keep only vendors with shippingTime <= 2", async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: "FAST_SHIPPING", ownVendorId: "100" });
      const result = await FilterBasedOnParams(allVendors, product, "HANDLING_TIME");
      const vendorIds = result.map((v) => v.vendorId);
      expect(vendorIds).toContain(1);
      expect(vendorIds).not.toContain(2);
      expect(vendorIds).not.toContain(3);
    });

    it("should always include own vendor even if shippingTime > 2", async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: "FAST_SHIPPING", ownVendorId: "100" });
      const result = await FilterBasedOnParams(allVendors, product, "HANDLING_TIME");
      expect(result.map((v) => v.vendorId)).toContain(100);
    });

    it("should not duplicate own vendor if already in filtered set", async () => {
      const ownFast = makeNet32Product({ vendorId: 100, shippingTime: 1 });
      const product = makeFrontierProduct({ handlingTimeFilter: "FAST_SHIPPING", ownVendorId: "100" });
      const result = await FilterBasedOnParams([ownFast, fastVendor], product, "HANDLING_TIME");
      const ownCount = result.filter((v) => v.vendorId == 100).length;
      expect(ownCount).toBe(1);
    });

    it("should filter out vendors with shippingTime = 0 (falsy)", async () => {
      const zeroShipping = makeNet32Product({ vendorId: 5, shippingTime: 0 });
      const product = makeFrontierProduct({ handlingTimeFilter: "FAST_SHIPPING", ownVendorId: "100" });
      const result = await FilterBasedOnParams([zeroShipping, ownVendor], product, "HANDLING_TIME");
      expect(result.map((v) => v.vendorId)).not.toContain(5);
    });

    it("should include vendor with shippingTime exactly 2", async () => {
      const boundary = makeNet32Product({ vendorId: 6, shippingTime: 2 });
      const product = makeFrontierProduct({ handlingTimeFilter: "FAST_SHIPPING", ownVendorId: "100" });
      const result = await FilterBasedOnParams([boundary], product, "HANDLING_TIME");
      expect(result.map((v) => v.vendorId)).toContain(6);
    });
  });

  describe("STOCKED (shippingTime <= 5)", () => {
    it("should keep vendors with shippingTime <= 5", async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: "STOCKED", ownVendorId: "100" });
      const result = await FilterBasedOnParams(allVendors, product, "HANDLING_TIME");
      const vendorIds = result.map((v) => v.vendorId);
      expect(vendorIds).toContain(1); // shippingTime 1
      expect(vendorIds).toContain(2); // shippingTime 4
      expect(vendorIds).not.toContain(3); // shippingTime 7 (excluded)
    });

    it("should always include own vendor even if shippingTime > 5", async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: "STOCKED", ownVendorId: "100" });
      const result = await FilterBasedOnParams(allVendors, product, "HANDLING_TIME");
      expect(result.map((v) => v.vendorId)).toContain(100);
    });

    it("should include vendor with shippingTime exactly 5", async () => {
      const boundary = makeNet32Product({ vendorId: 7, shippingTime: 5 });
      const product = makeFrontierProduct({ handlingTimeFilter: "STOCKED", ownVendorId: "100" });
      const result = await FilterBasedOnParams([boundary], product, "HANDLING_TIME");
      expect(result.map((v) => v.vendorId)).toContain(7);
    });
  });

  describe("LONG_HANDLING (shippingTime >= 6)", () => {
    it("should keep only vendors with shippingTime >= 6", async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: "LONG_HANDLING", ownVendorId: "100" });
      const result = await FilterBasedOnParams(allVendors, product, "HANDLING_TIME");
      const vendorIds = result.map((v) => v.vendorId);
      expect(vendorIds).toContain(100); // shippingTime 10
      expect(vendorIds).toContain(3); // shippingTime 7
      expect(vendorIds).not.toContain(1); // shippingTime 1
      expect(vendorIds).not.toContain(2); // shippingTime 4
    });

    it("should include vendor with shippingTime exactly 6", async () => {
      const boundary = makeNet32Product({ vendorId: 8, shippingTime: 6 });
      const product = makeFrontierProduct({ handlingTimeFilter: "LONG_HANDLING", ownVendorId: "100" });
      const result = await FilterBasedOnParams([boundary], product, "HANDLING_TIME");
      expect(result.map((v) => v.vendorId)).toContain(8);
    });

    it("should exclude vendor with shippingTime 5", async () => {
      const boundary = makeNet32Product({ vendorId: 9, shippingTime: 5 });
      const product = makeFrontierProduct({ handlingTimeFilter: "LONG_HANDLING", ownVendorId: "100" });
      const result = await FilterBasedOnParams([boundary, ownVendor], product, "HANDLING_TIME");
      expect(result.map((v) => v.vendorId)).not.toContain(9);
    });
  });

  describe("ALL / default (no handling time filtering)", () => {
    it("should return all vendors for handlingTimeFilter = ALL", async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: "ALL", ownVendorId: "100" });
      const result = await FilterBasedOnParams(allVendors, product, "HANDLING_TIME");
      expect(result).toHaveLength(4);
    });

    it("should return all vendors for unknown handlingTimeFilter value", async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: "UNKNOWN_VALUE", ownVendorId: "100" });
      const result = await FilterBasedOnParams(allVendors, product, "HANDLING_TIME");
      expect(result).toHaveLength(4);
    });
  });

  it("should return empty plus own vendor re-add attempt on empty input", async () => {
    const product = makeFrontierProduct({ handlingTimeFilter: "FAST_SHIPPING", ownVendorId: "100" });
    const result = await FilterBasedOnParams([], product, "HANDLING_TIME");
    expect(result).toHaveLength(0);
  });
});
