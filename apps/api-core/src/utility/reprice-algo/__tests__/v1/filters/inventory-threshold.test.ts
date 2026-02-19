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

describe("FilterBasedOnParams - INVENTORY_THRESHOLD", () => {
  const highInventory = makeNet32Product({ vendorId: 1, inventory: 100, inStock: true });
  const medInventory = makeNet32Product({ vendorId: 2, inventory: 10, inStock: true });
  const lowInventory = makeNet32Product({ vendorId: 3, inventory: 2, inStock: true });
  const zeroInventory = makeNet32Product({ vendorId: 4, inventory: 0, inStock: false });
  const allVendors = [highInventory, medInventory, lowInventory, zeroInventory];

  describe("when includeInactiveVendors is true", () => {
    it("should filter by inventory >= threshold only (ignoring inStock)", async () => {
      const product = makeFrontierProduct({
        inventoryThreshold: 10,
        includeInactiveVendors: true,
      });
      const result = await FilterBasedOnParams(allVendors, product, "INVENTORY_THRESHOLD");
      expect(result).toHaveLength(2);
      expect(result.map((v) => v.vendorId)).toEqual([1, 2]);
    });

    it("should include out-of-stock vendors if inventory meets threshold", async () => {
      const outOfStockHighInv = makeNet32Product({ vendorId: 5, inventory: 50, inStock: false });
      const product = makeFrontierProduct({
        inventoryThreshold: 10,
        includeInactiveVendors: true,
      });
      const result = await FilterBasedOnParams([outOfStockHighInv], product, "INVENTORY_THRESHOLD");
      expect(result).toHaveLength(1);
    });

    it("should return all when threshold is 0", async () => {
      const product = makeFrontierProduct({
        inventoryThreshold: 0,
        includeInactiveVendors: true,
      });
      const result = await FilterBasedOnParams(allVendors, product, "INVENTORY_THRESHOLD");
      expect(result).toHaveLength(4);
    });
  });

  describe("when includeInactiveVendors is false", () => {
    it("should filter by inStock AND inventory >= threshold", async () => {
      const product = makeFrontierProduct({
        inventoryThreshold: 5,
        includeInactiveVendors: false,
      });
      const result = await FilterBasedOnParams(allVendors, product, "INVENTORY_THRESHOLD");
      expect(result).toHaveLength(2);
      expect(result.map((v) => v.vendorId)).toEqual([1, 2]);
    });

    it("should exclude out-of-stock vendors even with sufficient inventory", async () => {
      const outOfStockHighInv = makeNet32Product({ vendorId: 5, inventory: 50, inStock: false });
      const product = makeFrontierProduct({
        inventoryThreshold: 5,
        includeInactiveVendors: false,
      });
      const result = await FilterBasedOnParams([outOfStockHighInv], product, "INVENTORY_THRESHOLD");
      expect(result).toHaveLength(0);
    });

    it("should return all in-stock vendors when threshold is 0", async () => {
      const product = makeFrontierProduct({
        inventoryThreshold: 0,
        includeInactiveVendors: false,
      });
      const result = await FilterBasedOnParams(allVendors, product, "INVENTORY_THRESHOLD");
      expect(result).toHaveLength(3);
    });
  });

  it("should return empty array when input is empty", async () => {
    const product = makeFrontierProduct({ inventoryThreshold: 0 });
    const result = await FilterBasedOnParams([], product, "INVENTORY_THRESHOLD");
    expect(result).toHaveLength(0);
  });

  it("should handle exact threshold boundary (inventory equals threshold)", async () => {
    const exactVendor = makeNet32Product({ vendorId: 1, inventory: 10, inStock: true });
    const product = makeFrontierProduct({
      inventoryThreshold: 10,
      includeInactiveVendors: true,
    });
    const result = await FilterBasedOnParams([exactVendor], product, "INVENTORY_THRESHOLD");
    expect(result).toHaveLength(1);
  });

  it("should handle inventory just below threshold", async () => {
    const belowVendor = makeNet32Product({ vendorId: 1, inventory: 9, inStock: true });
    const product = makeFrontierProduct({
      inventoryThreshold: 10,
      includeInactiveVendors: true,
    });
    const result = await FilterBasedOnParams([belowVendor], product, "INVENTORY_THRESHOLD");
    expect(result).toHaveLength(0);
  });
});
