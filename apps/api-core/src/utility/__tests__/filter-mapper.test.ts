// Mock all dependencies BEFORE imports
jest.mock("lodash", () => {
  const actualLodash = jest.requireActual("lodash");
  return actualLodash;
});

jest.mock("moment", () => {
  const actualMoment = jest.requireActual("moment");
  return actualMoment;
});

jest.mock("../mongo/db-helper", () => ({
  SaveFilterCronLogs: jest.fn(),
  FindErrorItemByIdAndStatus: jest.fn(),
}));

jest.mock("../mysql/mysql-helper", () => ({
  GetFilterEligibleProductsList: jest.fn(),
  UpdateCronForProductAsync: jest.fn(),
  GetItemListById: jest.fn(),
}));

jest.mock("../job-id-helper", () => ({
  Generate: jest.fn(() => "test-keygen-123"),
}));

jest.mock("../../model/global-param", () => ({
  GetInfo: jest.fn(),
}));

jest.mock("../config", () => ({
  applicationConfig: {
    ENABLE_SLOW_CRON_FEATURE: true,
    OFFSET: 0.01,
    CRON_NAME_422: "EXPRESS_CRON",
  },
}));

// Suppress console.log during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

import { FilterProducts, GetLastCronMessageSimple, FilterBasedOnParams, GetContextPrice, AppendPriceFactorTag, IsVendorFloorPrice, VerifyFloorWithSister, IsWaitingForNextRun, subtractPercentage, GetProductDetailsByVendor, GetTriggeredByVendor, GetLastCronMessage } from "../filter-mapper";
import * as dbHelper from "../mongo/db-helper";
import * as sqlHelper from "../mysql/mysql-helper";
import { Generate } from "../job-id-helper";
import { GetInfo } from "../../model/global-param";
import { applicationConfig } from "../config";
import { Net32Product } from "../../types/net32";
import { FrontierProduct } from "../../types/frontier";
import { RepriceRenewedMessageEnum } from "../../model/reprice-renewed-message";

describe("filter-mapper", () => {
  // Helper function to create mock Net32Product
  const createMockNet32Product = (overrides: Partial<Net32Product> = {}): Net32Product => ({
    vendorProductId: 12345,
    vendorProductCode: "VPC123",
    vendorId: 99999,
    vendorName: "TestVendor",
    vendorRegion: "US",
    inStock: true,
    standardShipping: 5.99,
    standardShippingStatus: "available",
    freeShippingGap: 50,
    heavyShippingStatus: "available",
    heavyShipping: 10.99,
    shippingTime: 2,
    inventory: 100,
    isFulfillmentPolicyStock: true,
    vdrGeneralAverageRatingSum: 4.5,
    vdrNumberOfGeneralRatings: 100,
    isBackordered: false,
    vendorProductLevelLicenseRequiredSw: false,
    vendorVerticalLevelLicenseRequiredSw: false,
    priceBreaks: [{ minQty: 1, unitPrice: 10.5, active: true }],
    badgeId: 1,
    badgeName: "Best Seller",
    imagePath: "/image.jpg",
    arrivalDate: "2024-01-05",
    arrivalBusinessDays: 3,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    ...overrides,
  });

  // Helper function to create mock FrontierProduct
  const createMockFrontierProduct = (overrides: Partial<FrontierProduct> = {}): FrontierProduct => ({
    channelName: "TestChannel",
    activated: true,
    mpid: 12345,
    channelId: "CH123",
    unitPrice: "10.50",
    floorPrice: "5.00",
    maxPrice: "20.00",
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: "none",
    badgePercentage: 0,
    productName: "Test Product",
    cronId: "1",
    cronName: "TestCron",
    requestInterval: 60,
    requestIntervalUnit: "MIN",
    scrapeOn: true,
    allowReprice: true,
    focusId: "F1",
    priority: 1,
    wait_update_period: false,
    net32url: "https://test.com",
    abortDeactivatingQPriceBreak: false,
    ownVendorId: null,
    sisterVendorId: "",
    tags: [],
    includeInactiveVendors: false,
    inactiveVendorId: "",
    override_bulk_update: false,
    override_bulk_rule: 0,
    latest_price: 0,
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
    contextCronName: "",
    contextMinQty: undefined,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    (applicationConfig as any).ENABLE_SLOW_CRON_FEATURE = true;
    (applicationConfig as any).OFFSET = 0.01;
    (applicationConfig as any).CRON_NAME_422 = "EXPRESS_CRON";
    (Generate as jest.Mock).mockReturnValue("test-keygen-123");
    (GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 17357, EXCLUDED_VENDOR_ID: "99999;88888" });
    (sqlHelper.GetFilterEligibleProductsList as jest.Mock).mockResolvedValue([]);
    (sqlHelper.UpdateCronForProductAsync as jest.Mock).mockResolvedValue(true);
    (dbHelper.SaveFilterCronLogs as jest.Mock).mockResolvedValue(true);
    (dbHelper.FindErrorItemByIdAndStatus as jest.Mock).mockResolvedValue(0);
    (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("FilterProducts", () => {
    it("should filter products and create log when products are found", async () => {
      const filterCronDetails = {
        cronId: "CRON1",
        cronName: "TestFilterCron",
        filterValue: "24",
        linkedCronId: "SLOW_CRON1",
        linkedCronName: "SlowCron",
      };

      const mockProducts = [
        {
          MpId: 12345,
          RegularCronId: "REG1",
          RegularCronName: "RegularCron",
          T_LUT: new Date("2024-01-01"),
          F_LUT: null,
          M_LUT: new Date("2024-01-02"),
        },
      ];

      (sqlHelper.GetFilterEligibleProductsList as jest.Mock).mockResolvedValue(mockProducts);

      await FilterProducts(filterCronDetails);

      expect(Generate).toHaveBeenCalled();
      expect(sqlHelper.GetFilterEligibleProductsList).toHaveBeenCalled();
      expect(sqlHelper.UpdateCronForProductAsync).toHaveBeenCalled();
      expect(dbHelper.SaveFilterCronLogs).toHaveBeenCalled();
    });

    it("should not process when no products are found", async () => {
      const filterCronDetails = {
        cronId: "CRON1",
        cronName: "TestFilterCron",
        filterValue: "24",
        linkedCronId: "SLOW_CRON1",
        linkedCronName: "SlowCron",
      };

      (sqlHelper.GetFilterEligibleProductsList as jest.Mock).mockResolvedValue([]);

      await FilterProducts(filterCronDetails);

      expect(sqlHelper.GetFilterEligibleProductsList).toHaveBeenCalled();
      expect(dbHelper.SaveFilterCronLogs).not.toHaveBeenCalled();
    });

    it("should not update cron when ENABLE_SLOW_CRON_FEATURE is false", async () => {
      (applicationConfig as any).ENABLE_SLOW_CRON_FEATURE = false;
      const filterCronDetails = {
        cronId: "CRON1",
        cronName: "TestFilterCron",
        filterValue: "24",
        linkedCronId: "SLOW_CRON1",
        linkedCronName: "SlowCron",
      };

      const mockProducts = [
        {
          MpId: 12345,
          RegularCronId: "REG1",
          RegularCronName: "RegularCron",
          T_LUT: null,
          F_LUT: null,
          M_LUT: null,
        },
      ];

      (sqlHelper.GetFilterEligibleProductsList as jest.Mock).mockResolvedValue(mockProducts);

      await FilterProducts(filterCronDetails);

      expect(sqlHelper.UpdateCronForProductAsync).not.toHaveBeenCalled();
      expect(dbHelper.SaveFilterCronLogs).toHaveBeenCalled();
    });

    it("should handle null last update times", async () => {
      const filterCronDetails = {
        cronId: "CRON1",
        cronName: "TestFilterCron",
        filterValue: "12",
        linkedCronId: "SLOW_CRON1",
        linkedCronName: "SlowCron",
      };

      const mockProducts = [
        {
          MpId: 12345,
          RegularCronId: "REG1",
          RegularCronName: "RegularCron",
          T_LUT: null,
          F_LUT: null,
          M_LUT: null,
        },
      ];

      (sqlHelper.GetFilterEligibleProductsList as jest.Mock).mockResolvedValue(mockProducts);

      await FilterProducts(filterCronDetails);

      expect(dbHelper.SaveFilterCronLogs).toHaveBeenCalled();
    });
  });

  describe("GetLastCronMessageSimple", () => {
    it("should return message from listOfRepriceDetails", () => {
      const repriceResult = {
        cronResponse: {
          repriceData: {
            listOfRepriceDetails: [
              { minQty: 1, explained: "Message1" },
              { minQty: 5, explained: "Message2" },
            ],
          },
        },
      };

      const result = GetLastCronMessageSimple(repriceResult);

      expect(result).toBe("1@Message1/5@Message2/");
    });

    it("should return message from repriceDetails", () => {
      const repriceResult = {
        cronResponse: {
          repriceData: {
            repriceDetails: {
              explained: "Single message",
            },
          },
        },
      };

      const result = GetLastCronMessageSimple(repriceResult);

      expect(result).toBe("Single message");
    });

    it("should return empty message when repriceData is empty", () => {
      const repriceResult = {
        cronResponse: {
          repriceData: {},
        },
      };

      const result = GetLastCronMessageSimple(repriceResult);

      expect(result).toBe("Reprice Result is empty");
    });

    it("should return empty string when repriceResult is null", () => {
      const result = GetLastCronMessageSimple(null);

      expect(result).toBe("");
    });

    it("should return empty string when cronResponse is missing", () => {
      const repriceResult = {
        cronResponse: null,
      };

      const result = GetLastCronMessageSimple(repriceResult);

      expect(result).toBe("");
    });
  });

  describe("FilterBasedOnParams", () => {
    it("should filter by EXCLUDED_VENDOR", async () => {
      const inputResult = [createMockNet32Product({ vendorId: 1 }), createMockNet32Product({ vendorId: 2 }), createMockNet32Product({ vendorId: 3 })];

      const productItem = createMockFrontierProduct({
        excludedVendors: "2;3",
      });

      const result = await FilterBasedOnParams(inputResult, productItem, "EXCLUDED_VENDOR");

      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });

    it("should handle empty excludedVendors", async () => {
      const inputResult = [createMockNet32Product({ vendorId: 1 })];
      const productItem = createMockFrontierProduct({ excludedVendors: "" });

      const result = await FilterBasedOnParams(inputResult, productItem, "EXCLUDED_VENDOR");

      expect(result).toHaveLength(1);
    });

    it("should filter by INVENTORY_THRESHOLD with includeInactiveVendors", async () => {
      const inputResult = [createMockNet32Product({ inventory: 100 }), createMockNet32Product({ inventory: 50 }), createMockNet32Product({ inventory: 200 })];

      const productItem = createMockFrontierProduct({
        includeInactiveVendors: true,
        inventoryThreshold: 100,
      });

      const result = await FilterBasedOnParams(inputResult, productItem, "INVENTORY_THRESHOLD");

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((p) => parseInt(p.inventory as unknown as string) >= 100)).toBe(true);
    });

    it("should filter by INVENTORY_THRESHOLD without includeInactiveVendors", async () => {
      const inputResult = [createMockNet32Product({ inventory: 100, inStock: true }), createMockNet32Product({ inventory: 50, inStock: true }), createMockNet32Product({ inventory: 200, inStock: false })];

      const productItem = createMockFrontierProduct({
        includeInactiveVendors: false,
        inventoryThreshold: 100,
      });

      const result = await FilterBasedOnParams(inputResult, productItem, "INVENTORY_THRESHOLD");

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((p) => p.inStock && parseInt(p.inventory as unknown as string) >= 100)).toBe(true);
    });

    it("should filter by HANDLING_TIME - FAST_SHIPPING", async () => {
      const inputResult = [createMockNet32Product({ shippingTime: 1 }), createMockNet32Product({ shippingTime: 2 }), createMockNet32Product({ shippingTime: 3 })];

      const productItem = createMockFrontierProduct({
        handlingTimeFilter: "FAST_SHIPPING",
      });

      (GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 99999 });

      const result = await FilterBasedOnParams(inputResult, productItem, "HANDLING_TIME");

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((p) => p.shippingTime && p.shippingTime <= 2)).toBe(true);
    });

    it("should filter by HANDLING_TIME - STOCKED", async () => {
      const inputResult = [createMockNet32Product({ shippingTime: 3 }), createMockNet32Product({ shippingTime: 5 }), createMockNet32Product({ shippingTime: 6 })];

      const productItem = createMockFrontierProduct({
        handlingTimeFilter: "STOCKED",
      });

      (GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 99999 });

      const result = await FilterBasedOnParams(inputResult, productItem, "HANDLING_TIME");

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((p) => p.shippingTime && p.shippingTime <= 5)).toBe(true);
    });

    it("should filter by HANDLING_TIME - LONG_HANDLING", async () => {
      const inputResult = [createMockNet32Product({ shippingTime: 5 }), createMockNet32Product({ shippingTime: 6 }), createMockNet32Product({ shippingTime: 7 })];

      const productItem = createMockFrontierProduct({
        handlingTimeFilter: "LONG_HANDLING",
      });

      (GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 99999 });

      const result = await FilterBasedOnParams(inputResult, productItem, "HANDLING_TIME");

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((p) => p.shippingTime && p.shippingTime >= 6)).toBe(true);
    });

    it("should add own vendor to HANDLING_TIME result if not present", async () => {
      const inputResult = [
        createMockNet32Product({ vendorId: 1, shippingTime: 3 }),
        createMockNet32Product({ vendorId: 17357, shippingTime: 10 }), // Own vendor
      ];

      const productItem = createMockFrontierProduct({
        handlingTimeFilter: "FAST_SHIPPING",
      });

      (GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 17357 });

      const result = await FilterBasedOnParams(inputResult, productItem, "HANDLING_TIME");

      expect(result.some((p) => p.vendorId === 17357)).toBe(true);
    });

    it("should filter by BADGE_INDICATOR - BADGE_ONLY with includeInactiveVendors", async () => {
      const inputResult = [createMockNet32Product({ badgeId: 1, badgeName: "Badge1", inStock: false }), createMockNet32Product({ badgeId: 0 }), createMockNet32Product({ badgeId: 2, badgeName: "Badge2" })];

      const productItem = createMockFrontierProduct({
        badgeIndicator: "BADGE_ONLY",
        includeInactiveVendors: true,
      });

      (GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 99999 });

      const result = await FilterBasedOnParams(inputResult, productItem, "BADGE_INDICATOR");

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((p) => p.badgeId && p.badgeId > 0 && p.badgeName)).toBe(true);
    });

    it("should filter by BADGE_INDICATOR - BADGE_ONLY without includeInactiveVendors", async () => {
      const inputResult = [createMockNet32Product({ badgeId: 1, badgeName: "Badge1", inStock: true }), createMockNet32Product({ badgeId: 0, inStock: true }), createMockNet32Product({ badgeId: 2, badgeName: "Badge2", inStock: false })];

      const productItem = createMockFrontierProduct({
        badgeIndicator: "BADGE_ONLY",
        includeInactiveVendors: false,
      });

      (GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 99999 });

      const result = await FilterBasedOnParams(inputResult, productItem, "BADGE_INDICATOR");

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((p) => p.badgeId && p.badgeId > 0 && p.badgeName && p.inStock)).toBe(true);
    });

    it("should filter by BADGE_INDICATOR - NON_BADGE_ONLY", async () => {
      const inputResult = [createMockNet32Product({ badgeId: 0, inStock: true }), createMockNet32Product({ badgeId: 1, badgeName: "Badge1", inStock: true }), createMockNet32Product({ badgeId: null as any, inStock: true })];

      const productItem = createMockFrontierProduct({
        badgeIndicator: "NON_BADGE_ONLY",
        includeInactiveVendors: false,
      });

      (GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 99999 });

      const result = await FilterBasedOnParams(inputResult, productItem, "BADGE_INDICATOR");

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((p) => !p.badgeId || p.badgeId === 0)).toBe(true);
    });

    it("should filter by PHANTOM_PRICE_BREAK when contextMinQty != 1", async () => {
      const inputResult = [createMockNet32Product({ inStock: true, inventory: 10 }), createMockNet32Product({ inStock: true, inventory: 5 }), createMockNet32Product({ inStock: false, inventory: 15 })];

      const productItem = createMockFrontierProduct({
        contextMinQty: 10,
      });

      const result = await FilterBasedOnParams(inputResult, productItem, "PHANTOM_PRICE_BREAK");

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((p) => p.inStock && p.inventory && p.inventory >= 10)).toBe(true);
    });

    it("should return all products for PHANTOM_PRICE_BREAK when contextMinQty == 1", async () => {
      const inputResult = [createMockNet32Product()];
      const productItem = createMockFrontierProduct({
        contextMinQty: 1,
      });

      const result = await FilterBasedOnParams(inputResult, productItem, "PHANTOM_PRICE_BREAK");

      expect(result).toHaveLength(1);
    });

    it("should filter by SISTER_VENDOR_EXCLUSION", async () => {
      const inputResult = [createMockNet32Product({ vendorId: 1 }), createMockNet32Product({ vendorId: 99999 }), createMockNet32Product({ vendorId: 88888 })];

      const productItem = createMockFrontierProduct();

      (GetInfo as jest.Mock).mockResolvedValue({
        VENDOR_ID: 17357,
        EXCLUDED_VENDOR_ID: "99999;88888",
      });

      const result = await FilterBasedOnParams(inputResult, productItem, "SISTER_VENDOR_EXCLUSION");

      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });

    it("should return empty array for unknown filter type", async () => {
      const inputResult = [createMockNet32Product()];
      const productItem = createMockFrontierProduct();

      const result = await FilterBasedOnParams(inputResult, productItem, "UNKNOWN_FILTER");

      expect(result).toHaveLength(0);
    });
  });

  describe("GetContextPrice", () => {
    it("should return OFFSET type when percentageDown is 0", async () => {
      const result = await GetContextPrice(10.0, 0.01, 5.0, 0, 1);

      expect(result.Type).toBe("OFFSET");
      expect(result.Price).toBeCloseTo(9.99, 2);
    });

    it("should return PERCENTAGE type when percentageDown > 0 and minQty == 1", async () => {
      const result = await GetContextPrice(10.0, 0.01, 5.0, 0.05, 1);

      expect(result.Type).toBe("PERCENTAGE");
      expect(result.Price).toBeLessThan(10.0);
    });

    it("should return FLOOR_OFFSET type when percentageDown price <= floorPrice", async () => {
      const result = await GetContextPrice(10.0, 0.01, 9.5, 0.1, 1);

      expect(result.Type).toBe("FLOOR_OFFSET");
    });

    it("should return OFFSET type when minQty != 1", async () => {
      const result = await GetContextPrice(10.0, 0.01, 5.0, 0.05, 5);

      expect(result.Type).toBe("OFFSET");
    });

    it("should handle heavyShippingPrice", async () => {
      const result = await GetContextPrice(10.0, 0.01, 5.0, 0.05, 1, 2.0);

      expect(result.Type).toBe("PERCENTAGE");
    });

    it("should handle exceptions gracefully", async () => {
      // The Decimal constructor throws before try-catch, so we test with invalid percentageDown calculation
      // that would cause an exception in the try block
      const result = await GetContextPrice(10.0, 0.01, 5.0, "invalid" as any, 1);

      expect(result.Type).toBe("OFFSET");
    });
  });

  describe("AppendPriceFactorTag", () => {
    it("should append #%Down for PERCENTAGE type", () => {
      const result = AppendPriceFactorTag("10.50", "PERCENTAGE");

      expect(result).toBe("10.50 #%Down");
    });

    it("should append #Floor-MovedFrom%to$ for FLOOR_OFFSET type", () => {
      const result = AppendPriceFactorTag("10.50", "FLOOR_OFFSET");

      expect(result).toBe("10.50 #Floor-MovedFrom%to$");
    });

    it("should return original string for other types", () => {
      const result = AppendPriceFactorTag("10.50", "OFFSET");

      expect(result).toBe("10.50");
    });
  });

  describe("IsVendorFloorPrice", () => {
    it("should return true when price is at or below floor", () => {
      const priceBreakList = [{ minQty: 1, unitPrice: 5.0 }];
      const result = IsVendorFloorPrice(priceBreakList, 1, 5.0, 0, false);

      expect(result).toBe(true);
    });

    it("should return false when price is above floor", () => {
      const priceBreakList = [{ minQty: 1, unitPrice: 10.0 }];
      const result = IsVendorFloorPrice(priceBreakList, 1, 5.0, 0, false);

      expect(result).toBe(false);
    });

    it("should include shipping when isNc is true", () => {
      const priceBreakList = [{ minQty: 1, unitPrice: 3.0 }];
      const result = IsVendorFloorPrice(priceBreakList, 1, 5.0, 2.0, true);

      expect(result).toBe(true); // 3.0 + 2.0 = 5.0 <= 5.0
    });

    it("should return false when price break not found", () => {
      const priceBreakList = [{ minQty: 5, unitPrice: 10.0 }];
      const result = IsVendorFloorPrice(priceBreakList, 1, 5.0, 0, false);

      expect(result).toBe(false);
    });
  });

  describe("VerifyFloorWithSister", () => {
    it("should return RepriceModel when sister vendor is above floor", async () => {
      const productItem = {
        floorPrice: 5.0,
        percentageDown: 0.05,
        productName: "Test Product",
      };

      const refProduct = {
        priceBreaks: [{ minQty: 1, unitPrice: 10.0 }],
      };

      // sortedPayload is an object with numeric keys, and the loop goes from 1 to length
      const sortedPayload: any = {
        length: 1,
        1: {
          vendorId: 99999,
          vendorName: "SisterVendor",
          priceBreaks: [{ minQty: 1, unitPrice: 8.0, active: true }],
          heavyShipping: 0,
        },
      };

      const excludedVendors = ["99999"];
      const ownVendorId = 17357;
      const minQty = 1;
      const sourceId = "12345";

      (applicationConfig as any).OFFSET = 0.01;

      const result = await VerifyFloorWithSister(productItem, refProduct, sortedPayload, excludedVendors, ownVendorId, minQty, sourceId);

      expect(result).not.toBe(false);
      expect(result).toBeDefined();
      if (result !== false) {
        expect(result.repriceDetails).toBeDefined();
      }
    });

    it("should return false when no sister vendor above floor", async () => {
      const productItem = {
        floorPrice: 5.0,
        percentageDown: 0.05,
        productName: "Test Product",
      };

      const refProduct = {
        priceBreaks: [{ minQty: 1, unitPrice: 10.0 }],
      };

      const sortedPayload: any = {
        1: {
          vendorId: 99999,
          vendorName: "OtherVendor",
          priceBreaks: [{ minQty: 1, unitPrice: 2.0, active: true }],
          heavyShipping: 0,
        },
      };

      const excludedVendors = ["99999"];
      const ownVendorId = 17357;
      const minQty = 1;
      const sourceId = "12345";

      const result = await VerifyFloorWithSister(productItem, refProduct, sortedPayload, excludedVendors, ownVendorId, minQty, sourceId);

      expect(result).toBe(false);
    });

    it("should skip own vendor in sortedPayload", async () => {
      const productItem = {
        floorPrice: 5.0,
        percentageDown: 0.05,
        productName: "Test Product",
      };

      const refProduct = {
        priceBreaks: [{ minQty: 1, unitPrice: 10.0 }],
      };

      const sortedPayload: any = {
        1: {
          vendorId: 17357, // Own vendor
          vendorName: "OwnVendor",
          priceBreaks: [{ minQty: 1, unitPrice: 8.0, active: true }],
          heavyShipping: 0,
        },
      };

      const excludedVendors: any[] = [];
      const ownVendorId = 17357;
      const minQty = 1;
      const sourceId = "12345";

      const result = await VerifyFloorWithSister(productItem, refProduct, sortedPayload, excludedVendors, ownVendorId, minQty, sourceId);

      expect(result).toBe(false);
    });
  });

  describe("IsWaitingForNextRun", () => {
    it("should return false for EXPRESS_CRON", async () => {
      const prod = { cronName: "EXPRESS_CRON" };
      const result = await IsWaitingForNextRun(12345, "TRADENT", prod);

      expect(result).toBe(false);
      expect(dbHelper.FindErrorItemByIdAndStatus).not.toHaveBeenCalled();
    });

    it("should return true when error item found", async () => {
      (dbHelper.FindErrorItemByIdAndStatus as jest.Mock).mockResolvedValue(1);
      const prod = { cronName: "REGULAR_CRON" };
      const result = await IsWaitingForNextRun(12345, "TRADENT", prod);

      expect(result).toBe(true);
      expect(dbHelper.FindErrorItemByIdAndStatus).toHaveBeenCalledWith(12345, true, "TRADENT");
    });

    it("should return false when no error item found", async () => {
      (dbHelper.FindErrorItemByIdAndStatus as jest.Mock).mockResolvedValue(0);
      const prod = { cronName: "REGULAR_CRON" };
      const result = await IsWaitingForNextRun(12345, "TRADENT", prod);

      expect(result).toBe(false);
    });
  });

  describe("subtractPercentage", () => {
    it("should subtract percentage correctly", () => {
      const result = subtractPercentage(100, 0.1);

      expect(result).toBe(90.0);
    });

    it("should handle decimal results", () => {
      const result = subtractPercentage(10.5, 0.05);

      expect(result).toBe(9.97);
    });

    it("should floor the result", () => {
      const result = subtractPercentage(10.99, 0.01);

      expect(result).toBe(10.88);
    });
  });

  describe("GetProductDetailsByVendor", () => {
    it("should return tradentDetails for TRADENT", async () => {
      const details = {
        tradentDetails: { cronId: "1" },
        frontierDetails: { cronId: "2" },
      };

      const result = await GetProductDetailsByVendor(details, "TRADENT");

      expect(result).toEqual({ cronId: "1" });
    });

    it("should return frontierDetails for FRONTIER", async () => {
      const details = {
        frontierDetails: { cronId: "2" },
      };

      const result = await GetProductDetailsByVendor(details, "FRONTIER");

      expect(result).toEqual({ cronId: "2" });
    });

    it("should return mvpDetails for MVP", async () => {
      const details = {
        mvpDetails: { cronId: "3" },
      };

      const result = await GetProductDetailsByVendor(details, "MVP");

      expect(result).toEqual({ cronId: "3" });
    });

    it("should return topDentDetails for TOPDENT", async () => {
      const details = {
        topDentDetails: { cronId: "4" },
      };

      const result = await GetProductDetailsByVendor(details, "TOPDENT");

      expect(result).toEqual({ cronId: "4" });
    });

    it("should return firstDentDetails for FIRSTDENT", async () => {
      const details = {
        firstDentDetails: { cronId: "5" },
      };

      const result = await GetProductDetailsByVendor(details, "FIRSTDENT");

      expect(result).toEqual({ cronId: "5" });
    });

    it("should return triadDetails for TRIAD", async () => {
      const details = {
        triadDetails: { cronId: "6" },
      };

      const result = await GetProductDetailsByVendor(details, "TRIAD");

      expect(result).toEqual({ cronId: "6" });
    });

    it("should return biteSupplyDetails for BITESUPPLY", async () => {
      const details = {
        biteSupplyDetails: { cronId: "7" },
      };

      const result = await GetProductDetailsByVendor(details, "BITESUPPLY");

      expect(result).toEqual({ cronId: "7" });
    });

    it("should return undefined for unknown vendor", async () => {
      const details = {};
      const result = await GetProductDetailsByVendor(details, "UNKNOWN");

      expect(result).toBeUndefined();
    });
  });

  describe("GetTriggeredByVendor", () => {
    it("should return triggeredByVendor from repriceDetails when isRepriced", async () => {
      const repriceResult = {
        repriceDetails: {
          isRepriced: true,
          triggeredByVendor: "Vendor1",
        },
      };

      const productDetails = {
        tradentDetails: {
          triggeredByVendor: "OldVendor",
        },
      };

      (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(productDetails);

      const result = await GetTriggeredByVendor(repriceResult, "12345", "TRADENT");

      expect(result.resultStr).toBe("Vendor1");
      expect(result.updateRequired).toBe(true);
    });

    it("should return existing triggeredByVendor when not repriced", async () => {
      const repriceResult = {
        repriceDetails: {
          isRepriced: false,
          triggeredByVendor: "Vendor1",
        },
      };

      const productDetails = {
        tradentDetails: {
          triggeredByVendor: "OldVendor",
        },
      };

      (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(productDetails);

      const result = await GetTriggeredByVendor(repriceResult, "12345", "TRADENT");

      expect(result.resultStr).toBe("OldVendor");
      expect(result.updateRequired).toBe(false);
    });

    it("should handle listOfRepriceDetails with existing messages", async () => {
      const repriceResult = {
        listOfRepriceDetails: [
          { minQty: 1, isRepriced: true, triggeredByVendor: "1@Vendor1" },
          { minQty: 5, isRepriced: false, triggeredByVendor: "5@Vendor2" },
        ],
      };

      const productDetails = {
        tradentDetails: {
          triggeredByVendor: "1 @ OldVendor, 5 @ OldVendor2,",
        },
      };

      (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(productDetails);

      const result = await GetTriggeredByVendor(repriceResult, "12345", "TRADENT");

      expect(result.resultStr).toContain("1 @");
      expect(result.updateRequired).toBe(true);
    });

    it("should handle empty existing triggeredByVendor", async () => {
      const repriceResult = {
        repriceDetails: {
          isRepriced: true,
          triggeredByVendor: "Vendor1",
        },
      };

      const productDetails = {
        tradentDetails: {
          triggeredByVendor: null,
        },
      };

      (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(productDetails);

      const result = await GetTriggeredByVendor(repriceResult, "12345", "TRADENT");

      // When existingTriggeredByVendorValue is null, the condition is true
      // If isRepriced is true, it uses repriceResult.repriceDetails.triggeredByVendor
      expect(result.resultStr).toBe("Vendor1");
    });

    it("should return empty message when no reprice details", async () => {
      const repriceResult = {};
      const productDetails = {
        tradentDetails: {
          triggeredByVendor: null,
        },
      };

      (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(productDetails);

      const result = await GetTriggeredByVendor(repriceResult, "12345", "TRADENT");

      expect(result.resultStr).toBe("TriggeredByVendorValue is empty");
    });
  });

  describe("GetLastCronMessage", () => {
    it("should return explained from repriceDetails when isRepriced", async () => {
      const repriceResult = {
        data: {
          cronResponse: {
            repriceData: {
              repriceDetails: {
                isRepriced: true,
                explained: "New message",
              },
            },
          },
        },
      };

      const productDetails = {
        tradentDetails: {
          last_cron_message: "Old message",
        },
      };

      (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(productDetails);

      const result = await GetLastCronMessage(repriceResult, "12345", "TRADENT");

      expect(result).toBe("New message");
    });

    it("should return existing message when not repriced", async () => {
      const repriceResult = {
        data: {
          cronResponse: {
            repriceData: {
              repriceDetails: {
                isRepriced: false,
                explained: "New message",
              },
            },
          },
        },
      };

      const productDetails = {
        tradentDetails: {
          last_cron_message: "Old message",
        },
      };

      (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(productDetails);

      const result = await GetLastCronMessage(repriceResult, "12345", "TRADENT");

      expect(result).toBe("Old message");
    });

    it("should handle listOfRepriceDetails", async () => {
      const repriceResult = {
        data: {
          cronResponse: {
            repriceData: {
              listOfRepriceDetails: [
                { minQty: 1, isRepriced: true, explained: "Message1" },
                { minQty: 5, isRepriced: true, explained: "Message2" },
              ],
            },
          },
        },
      };

      const productDetails = {
        tradentDetails: {
          last_cron_message: "1@OldMessage1/",
        },
      };

      (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(productDetails);

      const result = await GetLastCronMessage(repriceResult, "12345", "TRADENT");

      expect(result).toContain("1@");
      expect(result).toContain("5@");
    });

    it("should return empty message when repriceData is empty", async () => {
      const repriceResult = {
        data: {
          cronResponse: {
            repriceData: {},
          },
        },
      };

      const productDetails = {
        tradentDetails: {
          last_cron_message: "Old message",
        },
      };

      (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(productDetails);

      const result = await GetLastCronMessage(repriceResult, "12345", "TRADENT");

      expect(result).toBe("Reprice Result is empty");
    });

    it("should return empty string when productDetails is null", async () => {
      (sqlHelper.GetItemListById as jest.Mock).mockResolvedValue(null);
      const repriceResult = {
        data: {
          cronResponse: {
            repriceData: {
              repriceDetails: {
                explained: "Message",
              },
            },
          },
        },
      };

      const result = await GetLastCronMessage(repriceResult, "12345", "TRADENT");

      expect(result).toBe("");
    });
  });
});
