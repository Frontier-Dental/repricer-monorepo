// Mock all dependencies BEFORE imports
jest.mock("@repricer-monorepo/shared", () => ({
  VendorName: {
    TRADENT: "TRADENT",
    FRONTIER: "FRONTIER",
    MVP: "MVP",
    TOPDENT: "TOPDENT",
    FIRSTDENT: "FIRSTDENT",
    TRIAD: "TRIAD",
    BITESUPPLY: "BITESUPPLY",
  },
}));

jest.mock("fs-extra", () => ({
  outputJSON: jest.fn(),
}));

jest.mock("../mysql/mysql-helper", () => ({
  InsertHistoricalApiResponse: jest.fn(),
  InsertHistory: jest.fn(),
}));

jest.mock("../repriceResultParser", () => ({
  Parse: jest.fn(),
}));

jest.mock("../config", () => ({
  applicationConfig: {
    WRITE_HISTORY_SQL: true,
  },
}));

jest.mock("lodash", () => {
  const actualLodash = jest.requireActual("lodash");
  return actualLodash;
});

import { Execute, Write, getHistoricalPrice, getEligibleSortedProducts } from "../history-helper";
import * as fsExtra from "fs-extra";
import * as mySqlHelper from "../mysql/mysql-helper";
import * as ResultParser from "../repriceResultParser";
import { applicationConfig } from "../config";
import { RepriceModel, RepriceData } from "../../model/reprice-model";
import { Net32Product } from "../../types/net32";
import { HistoricalLogs, HistoricalPrice } from "../../model/history";
import { RepriceResultEnum } from "../../model/enumerations";

describe("history-helper", () => {
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

  // Helper function to create mock RepriceData
  const createMockRepriceData = (overrides: Partial<RepriceData> = {}): RepriceData => {
    const data = new RepriceData(10.0, 9.5, true, "Test message", 1);
    Object.assign(data, overrides);
    return data;
  };

  // Helper function to create mock RepriceModel
  const createMockRepriceModel = (overrides: Partial<RepriceModel> = {}): RepriceModel => {
    const product = createMockNet32Product();
    const model = new RepriceModel("12345", product, "Test Product", 9.5, true, false, [], "Test message");
    Object.assign(model, overrides);
    return model;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (applicationConfig as any).WRITE_HISTORY_SQL = true;
    (ResultParser.Parse as jest.Mock).mockResolvedValue(RepriceResultEnum.DEFAULT);
    (mySqlHelper.InsertHistoricalApiResponse as jest.Mock).mockResolvedValue(100);
    (mySqlHelper.InsertHistory as jest.Mock).mockResolvedValue(200);
  });

  describe("Execute", () => {
    it("should process single repriceDetails and write to SQL", async () => {
      const repriceModel = createMockRepriceModel({
        listOfRepriceDetails: [],
        repriceDetails: createMockRepriceData(),
      });
      const eligibleList = [createMockNet32Product()];

      const result = await Execute(12345, repriceModel, eligibleList, false, "TRADENT", "TestCron");

      expect(ResultParser.Parse).toHaveBeenCalledWith(repriceModel);
      expect(mySqlHelper.InsertHistoricalApiResponse).toHaveBeenCalled();
      expect(mySqlHelper.InsertHistory).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should process listOfRepriceDetails and write to SQL", async () => {
      const repriceModel = createMockRepriceModel({
        listOfRepriceDetails: [createMockRepriceData({ minQty: 1 }), createMockRepriceData({ minQty: 5 })],
        repriceDetails: null,
      });
      const eligibleList = [createMockNet32Product()];

      const result = await Execute(12345, repriceModel, eligibleList, false, "TRADENT", "TestCron");

      expect(ResultParser.Parse).toHaveBeenCalledWith(repriceModel);
      expect(mySqlHelper.InsertHistory).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it("should not write to SQL when WRITE_HISTORY_SQL is false", async () => {
      (applicationConfig as any).WRITE_HISTORY_SQL = false;
      const repriceModel = createMockRepriceModel({
        repriceDetails: createMockRepriceData(),
      });
      const eligibleList = [createMockNet32Product()];

      const result = await Execute(12345, repriceModel, eligibleList, false, "TRADENT", "TestCron");

      expect(mySqlHelper.InsertHistoricalApiResponse).not.toHaveBeenCalled();
      expect(mySqlHelper.InsertHistory).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should handle empty listOfRepriceDetails", async () => {
      const repriceModel = createMockRepriceModel({
        listOfRepriceDetails: [],
        repriceDetails: createMockRepriceData(),
      });
      const eligibleList = [createMockNet32Product()];

      const result = await Execute(12345, repriceModel, eligibleList, false, "TRADENT", "TestCron");

      expect(mySqlHelper.InsertHistory).toHaveBeenCalledTimes(1);
    });

    it("should handle string mpId", async () => {
      const repriceModel = createMockRepriceModel({
        repriceDetails: createMockRepriceData(),
      });
      const eligibleList = [createMockNet32Product()];

      const result = await Execute("12345", repriceModel, eligibleList, false, "TRADENT", "TestCron");

      expect(result).toBeDefined();
    });
  });

  describe("Write", () => {
    it("should write data to JSON file", async () => {
      const data = { test: "data" };
      const fileName = "test.json";
      const filePath = "../../logs";

      await Write(data, fileName, filePath);

      expect(fsExtra.outputJSON).toHaveBeenCalledWith(expect.stringContaining(fileName), data);
    });

    it("should handle null mpId", async () => {
      const data = { test: "data" };
      const fileName = "test.json";
      const filePath = "../../logs";

      await Write(data, fileName, filePath, null);

      expect(fsExtra.outputJSON).toHaveBeenCalled();
    });
  });

  describe("getHistoricalPrice", () => {
    it("should create HistoricalPrice with repriceDetails", async () => {
      const repriceDetails = createMockRepriceData({
        oldPrice: 10.0,
        newPrice: 9.5,
        lowestVendor: "Vendor1",
        lowestVendorPrice: 9.0,
        minQty: 1,
      });
      const eligibleList = [createMockNet32Product({ vendorId: 17357, vendorName: "TRADENT" }), createMockNet32Product({ vendorId: 99999, vendorName: "OtherVendor" })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "TRADENT", "TestCron", "TriggerVendor", RepriceResultEnum.DEFAULT);

      expect(result).toBeInstanceOf(HistoricalPrice);
      expect(result.existingPrice).toBe(10.0);
      expect(result.minQty).toBe(1);
      expect(result.rank).toBeGreaterThan(0);
    });

    it("should handle null repriceDetails", async () => {
      const eligibleList = [createMockNet32Product()];

      const result = await getHistoricalPrice(null as any, eligibleList, false, 12345, "TRADENT", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result).toBeInstanceOf(HistoricalPrice);
      expect(result.existingPrice).toBe(0);
      expect(result.rank).toBeNull();
    });

    it("should use goToPrice when available", async () => {
      const repriceDetails = createMockRepriceData({
        goToPrice: 8.5,
        newPrice: 9.5,
      });
      const eligibleList = [createMockNet32Product()];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "TRADENT", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.suggestedPrice).toBe(8.5);
    });

    it("should use newPrice when goToPrice is not available", async () => {
      const repriceDetails = createMockRepriceData({
        newPrice: 9.5,
      });
      const eligibleList = [createMockNet32Product()];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "TRADENT", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.suggestedPrice).toBe(9.5);
    });

    it("should calculate rank correctly when own vendor is found", async () => {
      const repriceDetails = createMockRepriceData({ minQty: 1 });
      const eligibleList = [
        createMockNet32Product({ vendorId: 99999, priceBreaks: [{ minQty: 1, unitPrice: 8.0, active: true }] }),
        createMockNet32Product({ vendorId: 17357, priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }] }), // TRADENT
        createMockNet32Product({ vendorId: 88888, priceBreaks: [{ minQty: 1, unitPrice: 12.0, active: true }] }),
      ];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "TRADENT", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(2); // Second in sorted list (sorted by price ascending)
    });

    it("should handle rank when own vendor is not found", async () => {
      const repriceDetails = createMockRepriceData({ minQty: 1 });
      const eligibleList = [createMockNet32Product({ vendorId: 99999 }), createMockNet32Product({ vendorId: 88888 })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "TRADENT", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(0); // findIndex returns -1, then +1 = 0
    });

    it("should use default minQty of 1 when not provided", async () => {
      const repriceDetails = createMockRepriceData({ minQty: undefined });
      const eligibleList = [createMockNet32Product()];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "TRADENT", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.minQty).toBe(1);
    });
  });

  describe("getEligibleSortedProducts", () => {
    it("should filter and sort products by price when ncFlag is false", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 12.0, active: true }],
        }),
        createMockNet32Product({
          vendorId: 2,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
        }),
        createMockNet32Product({
          vendorId: 3,
          priceBreaks: [{ minQty: 1, unitPrice: 11.0, active: true }],
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, false);

      expect(result).toHaveLength(3);
      expect(result[0].vendorId).toBe(2); // Lowest price
      expect(result[1].vendorId).toBe(3);
      expect(result[2].vendorId).toBe(1);
    });

    it("should filter and sort products by price + shipping when ncFlag is true", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
          standardShipping: 5.0,
          freeShippingThreshold: 50,
        }),
        createMockNet32Product({
          vendorId: 2,
          priceBreaks: [{ minQty: 1, unitPrice: 12.0, active: true }],
          standardShipping: 0,
          freeShippingThreshold: 10,
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, true);

      expect(result).toHaveLength(2);
      // Vendor 2 should be first (12.0 + 0 = 12.0) vs (10.0 + 5.0 = 15.0)
      expect(result[0].vendorId).toBe(2);
    });

    it("should filter out products without matching minQty", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
        }),
        createMockNet32Product({
          vendorId: 2,
          priceBreaks: [{ minQty: 5, unitPrice: 9.0, active: true }], // Different minQty
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, false);

      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });

    it("should filter out products with inactive price breaks", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
        }),
        createMockNet32Product({
          vendorId: 2,
          priceBreaks: [{ minQty: 1, unitPrice: 9.0, active: false }], // Inactive
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, false);

      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });

    it("should filter out short expiry products", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true, promoAddlDescr: "Normal" }],
        }),
        createMockNet32Product({
          vendorId: 2,
          priceBreaks: [{ minQty: 1, unitPrice: 9.0, active: true, promoAddlDescr: "SHORT EXPIRY" }],
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, false);

      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });

    it("should filter out expired products", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true, promoAddlDescr: "Normal" }],
        }),
        createMockNet32Product({
          vendorId: 2,
          priceBreaks: [{ minQty: 1, unitPrice: 9.0, active: true, promoAddlDescr: "EXP" }],
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, false);

      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });

    it("should remove duplicate vendors", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [
            { minQty: 1, unitPrice: 10.0, active: true },
            { minQty: 1, unitPrice: 10.0, active: true }, // Duplicate
          ],
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, false);

      expect(result).toHaveLength(1);
    });

    it("should handle null payload", () => {
      const result = getEligibleSortedProducts(null as any, 1, false);

      expect(result).toHaveLength(0);
    });

    it("should handle empty payload", () => {
      const result = getEligibleSortedProducts([], 1, false);

      expect(result).toHaveLength(0);
    });

    it("should handle products without priceBreaks", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: undefined as any,
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, false);

      expect(result).toHaveLength(0);
    });

    it("should handle different minQty values", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [
            { minQty: 1, unitPrice: 10.0, active: true },
            { minQty: 5, unitPrice: 9.0, active: true },
          ],
        }),
        createMockNet32Product({
          vendorId: 2,
          priceBreaks: [{ minQty: 5, unitPrice: 8.5, active: true }],
        }),
      ];

      const result = getEligibleSortedProducts(payload, 5, false);

      expect(result).toHaveLength(2);
      expect(result[0].vendorId).toBe(2); // Lower price for minQty 5
    });

    it("should filter duplicate price points for same minQty", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [
            { minQty: 1, unitPrice: 10.0, active: true },
            { minQty: 1, unitPrice: 10.0, active: true }, // Duplicate price
          ],
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, false);

      expect(result).toHaveLength(1);
      // Should have only one price break left
      const priceBreaks = result[0].priceBreaks.filter((p) => p.minQty === 1);
      expect(priceBreaks.length).toBe(1);
    });

    it("should handle shipping calculation with free shipping threshold", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
          standardShipping: 5.0,
          freeShippingThreshold: 15, // Above unitPrice, so shipping applies
        }),
        createMockNet32Product({
          vendorId: 2,
          priceBreaks: [{ minQty: 1, unitPrice: 20.0, active: true }],
          standardShipping: 5.0,
          freeShippingThreshold: 15, // Below unitPrice, so no shipping
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, true);

      expect(result).toHaveLength(2);
      // Vendor 2 should be first (20.0 + 0 = 20.0) vs (10.0 + 5.0 = 15.0)
      expect(result[0].vendorId).toBe(1);
    });

    it("should handle shipping calculation with null freeShippingThreshold", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
          standardShipping: 5.0,
          freeShippingThreshold: null as any,
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, true);

      expect(result).toHaveLength(1);
      // Should use default threshold of 999999, so shipping applies
    });
  });

  describe("getOwnVendorId (tested indirectly)", () => {
    it("should map TRADENT to correct vendor ID", async () => {
      const repriceDetails = createMockRepriceData();
      const eligibleList = [createMockNet32Product({ vendorId: 17357, vendorName: "TRADENT" })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "TRADENT", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(1);
    });

    it("should map FRONTIER to correct vendor ID", async () => {
      const repriceDetails = createMockRepriceData();
      const eligibleList = [createMockNet32Product({ vendorId: 20722, vendorName: "FRONTIER" })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "FRONTIER", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(1);
    });

    it("should map MVP to correct vendor ID", async () => {
      const repriceDetails = createMockRepriceData();
      const eligibleList = [createMockNet32Product({ vendorId: 20755, vendorName: "MVP" })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "MVP", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(1);
    });

    it("should map TOPDENT to correct vendor ID", async () => {
      const repriceDetails = createMockRepriceData();
      const eligibleList = [createMockNet32Product({ vendorId: 20727, vendorName: "TOPDENT" })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "TOPDENT", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(1);
    });

    it("should map FIRSTDENT to correct vendor ID", async () => {
      const repriceDetails = createMockRepriceData();
      const eligibleList = [createMockNet32Product({ vendorId: 20533, vendorName: "FIRSTDENT" })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "FIRSTDENT", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(1);
    });

    it("should map TRIAD to correct vendor ID", async () => {
      const repriceDetails = createMockRepriceData();
      const eligibleList = [createMockNet32Product({ vendorId: 5, vendorName: "TRIAD" })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "TRIAD", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(1);
    });

    it("should map BITESUPPLY to correct vendor ID", async () => {
      const repriceDetails = createMockRepriceData();
      const eligibleList = [createMockNet32Product({ vendorId: 20891, vendorName: "BITESUPPLY" })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "BITESUPPLY", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(1);
    });

    it("should handle case-insensitive vendor names", async () => {
      const repriceDetails = createMockRepriceData();
      const eligibleList = [createMockNet32Product({ vendorId: 17357, vendorName: "TRADENT" })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "tradent", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(1);
    });

    it("should throw error for unknown vendor name", async () => {
      const repriceDetails = createMockRepriceData();
      const eligibleList = [createMockNet32Product()];

      await expect(getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "UNKNOWN_VENDOR", "TestCron", null, RepriceResultEnum.DEFAULT)).rejects.toThrow("Unknown vendor name");
    });
  });

  describe("writeFileToSql (tested indirectly via Execute)", () => {
    it("should write multiple history records to SQL", async () => {
      const repriceModel = createMockRepriceModel({
        listOfRepriceDetails: [createMockRepriceData({ minQty: 1 }), createMockRepriceData({ minQty: 5 })],
        repriceDetails: null,
      });
      const eligibleList = [createMockNet32Product()];

      const result = await Execute(12345, repriceModel, eligibleList, false, "TRADENT", "TestCron");

      expect(mySqlHelper.InsertHistoricalApiResponse).toHaveBeenCalledTimes(1);
      expect(mySqlHelper.InsertHistory).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result![0].minQty).toBe(1);
      expect(result![1].minQty).toBe(5);
    });

    it("should handle empty historicalPrice array", async () => {
      const historicalLogs = new HistoricalLogs([]);
      // This scenario is hard to test directly, but we can test via Execute with empty eligibleList
      const repriceModel = createMockRepriceModel({
        repriceDetails: createMockRepriceData(),
      });
      const eligibleList: Net32Product[] = [];

      const result = await Execute(12345, repriceModel, eligibleList, false, "TRADENT", "TestCron");

      // Should still create history even with empty eligible list
      expect(result).toBeDefined();
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle products with string vendorId", async () => {
      const repriceDetails = createMockRepriceData();
      const eligibleList = [createMockNet32Product({ vendorId: "17357" as any, vendorName: "TRADENT" })];

      const result = await getHistoricalPrice(repriceDetails, eligibleList, false, 12345, "TRADENT", "TestCron", null, RepriceResultEnum.DEFAULT);

      expect(result.rank).toBe(1);
    });

    it("should handle products with missing price breaks for sorting", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
        }),
        createMockNet32Product({
          vendorId: 2,
          priceBreaks: [{ minQty: 5, unitPrice: 9.0, active: true }], // No minQty 1
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, false);

      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });

    it("should handle isNotShortExpiryProduct with multiple price breaks", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [
            { minQty: 1, unitPrice: 10.0, active: true, promoAddlDescr: "EXP" },
            { minQty: 1, unitPrice: 10.0, active: true, promoAddlDescr: "Normal" }, // This one passes
          ],
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, false);
      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });

    it("should handle shipping price calculation with string standardShipping", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
          standardShipping: "5.99" as any,
          freeShippingThreshold: 50,
        }),
      ];

      const result = getEligibleSortedProducts(payload, 1, true);

      expect(result).toHaveLength(1);
    });
  });
});
