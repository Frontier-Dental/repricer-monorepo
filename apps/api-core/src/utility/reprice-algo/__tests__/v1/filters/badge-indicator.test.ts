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

describe("FilterBasedOnParams - BADGE_INDICATOR", () => {
  // Own vendor has no badge
  const ownVendor = makeNet32Product({ vendorId: 100, badgeId: 0, badgeName: null, inStock: true });
  const badgedVendor = makeNet32Product({ vendorId: 1, badgeId: 5, badgeName: "Gold", inStock: true });
  const nonBadgedVendor = makeNet32Product({ vendorId: 2, badgeId: 0, badgeName: null, inStock: true });
  const badgedOutOfStock = makeNet32Product({ vendorId: 3, badgeId: 3, badgeName: "Silver", inStock: false });
  const nonBadgedOutOfStock = makeNet32Product({ vendorId: 4, badgeId: 0, badgeName: null, inStock: false });
  const allVendors = [ownVendor, badgedVendor, nonBadgedVendor, badgedOutOfStock, nonBadgedOutOfStock];

  describe("BADGE_ONLY", () => {
    describe("with includeInactiveVendors = true", () => {
      it("should keep only badged vendors (badgeId > 0 AND badgeName truthy)", async () => {
        const product = makeFrontierProduct({
          badgeIndicator: "BADGE_ONLY",
          includeInactiveVendors: true,
          ownVendorId: "100",
        });
        const result = await FilterBasedOnParams(allVendors, product, "BADGE_INDICATOR");
        const vendorIds = result.map((v) => v.vendorId);
        expect(vendorIds).toContain(1); // badged, in stock
        expect(vendorIds).toContain(3); // badged, out of stock (includeInactive=true)
        expect(vendorIds).not.toContain(2); // non-badged
        expect(vendorIds).not.toContain(4); // non-badged
      });

      it("should re-add own vendor even if not badged", async () => {
        const product = makeFrontierProduct({
          badgeIndicator: "BADGE_ONLY",
          includeInactiveVendors: true,
          ownVendorId: "100",
        });
        const result = await FilterBasedOnParams(allVendors, product, "BADGE_INDICATOR");
        expect(result.map((v) => v.vendorId)).toContain(100);
      });

      it("should not duplicate own vendor if already badged", async () => {
        const ownBadged = makeNet32Product({ vendorId: 100, badgeId: 2, badgeName: "Premium", inStock: true });
        const product = makeFrontierProduct({
          badgeIndicator: "BADGE_ONLY",
          includeInactiveVendors: true,
          ownVendorId: "100",
        });
        const result = await FilterBasedOnParams([ownBadged, badgedVendor], product, "BADGE_INDICATOR");
        const ownCount = result.filter((v) => v.vendorId == 100).length;
        expect(ownCount).toBe(1);
      });
    });

    describe("with includeInactiveVendors = false", () => {
      it("should keep only badged AND in-stock vendors", async () => {
        const product = makeFrontierProduct({
          badgeIndicator: "BADGE_ONLY",
          includeInactiveVendors: false,
          ownVendorId: "100",
        });
        const result = await FilterBasedOnParams(allVendors, product, "BADGE_INDICATOR");
        const vendorIds = result.map((v) => v.vendorId);
        expect(vendorIds).toContain(1); // badged + in stock
        expect(vendorIds).not.toContain(3); // badged but out of stock
      });

      it("should still re-add own vendor even if not badged", async () => {
        const product = makeFrontierProduct({
          badgeIndicator: "BADGE_ONLY",
          includeInactiveVendors: false,
          ownVendorId: "100",
        });
        const result = await FilterBasedOnParams(allVendors, product, "BADGE_INDICATOR");
        expect(result.map((v) => v.vendorId)).toContain(100);
      });
    });

    it("should filter out vendor with badgeId > 0 but badgeName is null", async () => {
      const badgeIdNoBadgeName = makeNet32Product({ vendorId: 5, badgeId: 3, badgeName: null, inStock: true });
      const product = makeFrontierProduct({
        badgeIndicator: "BADGE_ONLY",
        includeInactiveVendors: true,
        ownVendorId: "100",
      });
      const result = await FilterBasedOnParams([badgeIdNoBadgeName, ownVendor], product, "BADGE_INDICATOR");
      expect(result.map((v) => v.vendorId)).not.toContain(5);
    });

    it("should filter out vendor with badgeId = 0 and badgeName set", async () => {
      const zeroBadgeIdWithName = makeNet32Product({ vendorId: 6, badgeId: 0, badgeName: "Legacy", inStock: true });
      const product = makeFrontierProduct({
        badgeIndicator: "BADGE_ONLY",
        includeInactiveVendors: true,
        ownVendorId: "100",
      });
      const result = await FilterBasedOnParams([zeroBadgeIdWithName, ownVendor], product, "BADGE_INDICATOR");
      expect(result.map((v) => v.vendorId)).not.toContain(6);
    });
  });

  describe("NON_BADGE_ONLY", () => {
    describe("with includeInactiveVendors = true", () => {
      it("should keep only non-badged vendors (badgeId falsy or == 0)", async () => {
        const product = makeFrontierProduct({
          badgeIndicator: "NON_BADGE_ONLY",
          includeInactiveVendors: true,
          ownVendorId: "100",
        });
        const result = await FilterBasedOnParams(allVendors, product, "BADGE_INDICATOR");
        const vendorIds = result.map((v) => v.vendorId);
        expect(vendorIds).toContain(100); // own, non-badged
        expect(vendorIds).toContain(2); // non-badged, in stock
        expect(vendorIds).toContain(4); // non-badged, out of stock (includeInactive=true)
        expect(vendorIds).not.toContain(1); // badged
        expect(vendorIds).not.toContain(3); // badged
      });
    });

    describe("with includeInactiveVendors = false", () => {
      it("should keep only non-badged AND in-stock vendors", async () => {
        const product = makeFrontierProduct({
          badgeIndicator: "NON_BADGE_ONLY",
          includeInactiveVendors: false,
          ownVendorId: "100",
        });
        const result = await FilterBasedOnParams(allVendors, product, "BADGE_INDICATOR");
        const vendorIds = result.map((v) => v.vendorId);
        expect(vendorIds).toContain(100); // own, non-badged, in stock
        expect(vendorIds).toContain(2); // non-badged, in stock
        expect(vendorIds).not.toContain(4); // non-badged but out of stock
      });
    });

    it("should re-add own vendor even if own vendor is badged", async () => {
      const ownBadged = makeNet32Product({ vendorId: 100, badgeId: 5, badgeName: "Gold", inStock: true });
      const product = makeFrontierProduct({
        badgeIndicator: "NON_BADGE_ONLY",
        includeInactiveVendors: true,
        ownVendorId: "100",
      });
      const result = await FilterBasedOnParams([ownBadged, nonBadgedVendor], product, "BADGE_INDICATOR");
      expect(result.map((v) => v.vendorId)).toContain(100);
    });
  });

  describe("ALL_ZERO / ALL_PERCENTAGE / other values (no filtering)", () => {
    it("should return all vendors for ALL_ZERO", async () => {
      const product = makeFrontierProduct({ badgeIndicator: "ALL_ZERO", ownVendorId: "100" });
      const result = await FilterBasedOnParams(allVendors, product, "BADGE_INDICATOR");
      expect(result).toHaveLength(allVendors.length);
    });

    it("should return all vendors for ALL_PERCENTAGE", async () => {
      const product = makeFrontierProduct({ badgeIndicator: "ALL_PERCENTAGE", ownVendorId: "100" });
      const result = await FilterBasedOnParams(allVendors, product, "BADGE_INDICATOR");
      expect(result).toHaveLength(allVendors.length);
    });

    it("should return all vendors for unknown badge indicator", async () => {
      const product = makeFrontierProduct({ badgeIndicator: "SOMETHING_ELSE", ownVendorId: "100" });
      const result = await FilterBasedOnParams(allVendors, product, "BADGE_INDICATOR");
      expect(result).toHaveLength(allVendors.length);
    });
  });

  it("should return empty array when input is empty", async () => {
    const product = makeFrontierProduct({ badgeIndicator: "BADGE_ONLY", ownVendorId: "100" });
    const result = await FilterBasedOnParams([], product, "BADGE_INDICATOR");
    expect(result).toHaveLength(0);
  });
});
