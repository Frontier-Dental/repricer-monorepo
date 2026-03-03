// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01 } }));
jest.mock("../../../../mongo/db-helper", () => ({}));
jest.mock("../../../../mysql/mysql-helper", () => ({}));
jest.mock("../../../../../model/global-param", () => ({
  GetInfo: jest.fn().mockImplementation(async (_mpId: any, productDet: any) => {
    return {
      VENDOR_ID: productDet?.ownVendorId || "100",
      EXCLUDED_VENDOR_ID: productDet?.sisterVendorId || "",
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

describe("FilterBasedOnParams - SISTER_VENDOR_EXCLUSION", () => {
  const vendorA = makeNet32Product({ vendorId: 100, vendorName: "Own Vendor" });
  const vendorB = makeNet32Product({ vendorId: 200, vendorName: "Sister 1" });
  const vendorC = makeNet32Product({ vendorId: 201, vendorName: "Sister 2" });
  const vendorD = makeNet32Product({ vendorId: 300, vendorName: "Competitor" });
  const allVendors = [vendorA, vendorB, vendorC, vendorD];

  it("should remove sister vendors from the list", async () => {
    const product = makeFrontierProduct({ sisterVendorId: "200;201" });
    const result = await FilterBasedOnParams(allVendors, product, "SISTER_VENDOR_EXCLUSION");
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.vendorId)).toEqual([100, 300]);
  });

  it("should not filter any vendors when sisterVendorId is empty", async () => {
    const product = makeFrontierProduct({ sisterVendorId: "" });
    const result = await FilterBasedOnParams(allVendors, product, "SISTER_VENDOR_EXCLUSION");
    expect(result).toHaveLength(4);
  });

  it("should handle single sister vendor", async () => {
    const product = makeFrontierProduct({ sisterVendorId: "200" });
    const result = await FilterBasedOnParams(allVendors, product, "SISTER_VENDOR_EXCLUSION");
    expect(result).toHaveLength(3);
    expect(result.map((v) => v.vendorId)).toEqual([100, 201, 300]);
  });

  it("should handle trailing semicolon in sisterVendorId", async () => {
    const product = makeFrontierProduct({ sisterVendorId: "200;" });
    const result = await FilterBasedOnParams(allVendors, product, "SISTER_VENDOR_EXCLUSION");
    expect(result).toHaveLength(3);
    expect(result.map((v) => v.vendorId)).toEqual([100, 201, 300]);
  });

  it("should handle sisterVendorId with IDs not in the input list", async () => {
    const product = makeFrontierProduct({ sisterVendorId: "999;888" });
    const result = await FilterBasedOnParams(allVendors, product, "SISTER_VENDOR_EXCLUSION");
    expect(result).toHaveLength(4);
  });

  it("should exclude own vendor if own vendor is in the sister list", async () => {
    const product = makeFrontierProduct({ sisterVendorId: "100;200" });
    const result = await FilterBasedOnParams(allVendors, product, "SISTER_VENDOR_EXCLUSION");
    expect(result.map((v) => v.vendorId)).not.toContain(100);
    expect(result.map((v) => v.vendorId)).not.toContain(200);
  });

  it("should return empty when all vendors are sisters", async () => {
    const product = makeFrontierProduct({ sisterVendorId: "100;200;201;300" });
    const result = await FilterBasedOnParams(allVendors, product, "SISTER_VENDOR_EXCLUSION");
    expect(result).toHaveLength(0);
  });

  it("should return empty array when input is empty", async () => {
    const product = makeFrontierProduct({ sisterVendorId: "200" });
    const result = await FilterBasedOnParams([], product, "SISTER_VENDOR_EXCLUSION");
    expect(result).toHaveLength(0);
  });

  it("should compare vendorId as string via .toString()", async () => {
    const numericVendor = makeNet32Product({ vendorId: 200 });
    const product = makeFrontierProduct({ sisterVendorId: "200" });
    const result = await FilterBasedOnParams([numericVendor], product, "SISTER_VENDOR_EXCLUSION");
    expect(result).toHaveLength(0);
  });
});
