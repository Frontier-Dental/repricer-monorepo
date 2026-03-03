// Must mock before any source imports (filter-mapper.ts imports config, global-param, mongo/db-helper, mysql/mysql-helper)
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

describe("FilterBasedOnParams - EXCLUDED_VENDOR", () => {
  const vendorA = makeNet32Product({ vendorId: 10, vendorName: "Vendor A" });
  const vendorB = makeNet32Product({ vendorId: 20, vendorName: "Vendor B" });
  const vendorC = makeNet32Product({ vendorId: 30, vendorName: "Vendor C" });
  const allVendors = [vendorA, vendorB, vendorC];

  it("should remove vendors whose vendorId is in the exclusion list", async () => {
    const product = makeFrontierProduct({ excludedVendors: "10;30" });
    const result = await FilterBasedOnParams(allVendors, product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(1);
    expect(result[0].vendorId).toBe(20);
  });

  it("should return all vendors when excludedVendors is empty string", async () => {
    const product = makeFrontierProduct({ excludedVendors: "" });
    const result = await FilterBasedOnParams(allVendors, product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(3);
  });

  it("should return all vendors when excludedVendors is null", async () => {
    const product = makeFrontierProduct({ excludedVendors: null as any });
    const result = await FilterBasedOnParams(allVendors, product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(3);
  });

  it("should handle single excluded vendor", async () => {
    const product = makeFrontierProduct({ excludedVendors: "20" });
    const result = await FilterBasedOnParams(allVendors, product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.vendorId)).toEqual([10, 30]);
  });

  it("should handle excludedVendors with trailing semicolon", async () => {
    const product = makeFrontierProduct({ excludedVendors: "10;" });
    const result = await FilterBasedOnParams(allVendors, product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.vendorId)).toEqual([20, 30]);
  });

  it("should handle excludedVendors with leading semicolon", async () => {
    const product = makeFrontierProduct({ excludedVendors: ";20;" });
    const result = await FilterBasedOnParams(allVendors, product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.vendorId)).toEqual([10, 30]);
  });

  it("should handle vendorId that does not match any vendor", async () => {
    const product = makeFrontierProduct({ excludedVendors: "999" });
    const result = await FilterBasedOnParams(allVendors, product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(3);
  });

  it("should exclude all vendors if all are in the exclusion list", async () => {
    const product = makeFrontierProduct({ excludedVendors: "10;20;30" });
    const result = await FilterBasedOnParams(allVendors, product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(0);
  });

  it("should return empty array when input is empty", async () => {
    const product = makeFrontierProduct({ excludedVendors: "10" });
    const result = await FilterBasedOnParams([], product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(0);
  });

  it("should compare vendorId as string (vendorId is number, exclusion list is string)", async () => {
    const product = makeFrontierProduct({ excludedVendors: "10" });
    const numericVendor = makeNet32Product({ vendorId: 10 });
    const result = await FilterBasedOnParams([numericVendor], product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(0);
  });

  it("should handle vendorId as string type on the Net32Product", async () => {
    const stringVendor = makeNet32Product({ vendorId: "10" as any });
    const product = makeFrontierProduct({ excludedVendors: "10" });
    const result = await FilterBasedOnParams([stringVendor], product, "EXCLUDED_VENDOR");
    expect(result).toHaveLength(0);
  });
});
