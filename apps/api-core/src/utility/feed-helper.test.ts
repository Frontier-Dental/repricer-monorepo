// Mock dependencies before imports
jest.mock("fs");
jest.mock("lodash");
jest.mock("./config", () => ({
  applicationConfig: {
    FEED_FILE_PATH: "/test/feed/",
    FEED_FILE_NAME: "feed.json",
    ERROR_ITEM_COLLECTION: "errorItems",
    IS_DEBUG: false,
  },
}));

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

jest.mock("./mongo", () => ({
  getMongoDb: jest.fn(),
}));

import fs from "fs";
import _ from "lodash";
import { GetContextDetails, FilterEligibleProducts, SetSkipReprice } from "./feed-helper";
import { applicationConfig } from "./config";
import { VendorName } from "@repricer-monorepo/shared";
import { getMongoDb } from "./mongo";
import { ProductDetailsListItem } from "./mysql/mySql-mapper";

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedLodash = _ as jest.Mocked<typeof _>;
const mockedGetMongoDb = getMongoDb as jest.MockedFunction<typeof getMongoDb>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("feed-helper", () => {
  let mockDb: any;
  let mockCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.useFakeTimers();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Mock MongoDB
    mockCollection = {
      find: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    mockedGetMongoDb.mockResolvedValue(mockDb as any);

    // Note: lodash.find is not used in GetContextDetails, it uses array.find directly
  });

  afterEach(() => {
    jest.useRealTimers();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("GetContextDetails", () => {
    it("should read feed file and find item by mpid", async () => {
      const mockFeedData = [
        { mpid: "100", name: "Product 1", price: 99.99 },
        { mpid: "200", name: "Product 2", price: 149.99 },
        { mpid: "300", name: "Product 3", price: 199.99 },
      ];

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockFeedData));

      const result = await GetContextDetails("200");

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(`${applicationConfig.FEED_FILE_PATH}${applicationConfig.FEED_FILE_NAME}`, "utf8");
      expect(result).toEqual(mockFeedData[1]);
    });

    it("should return undefined when mpid not found", async () => {
      const mockFeedData = [
        { mpid: "100", name: "Product 1" },
        { mpid: "200", name: "Product 2" },
      ];

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockFeedData));

      const result = await GetContextDetails("999");

      expect(result).toBeUndefined();
    });

    it("should handle empty feed file", async () => {
      mockedFs.readFileSync.mockReturnValue(JSON.stringify([]));

      const result = await GetContextDetails("100");

      expect(result).toBeUndefined();
    });

    it("should handle invalid JSON in feed file", async () => {
      mockedFs.readFileSync.mockReturnValue("invalid json");

      await expect(GetContextDetails("100")).rejects.toThrow();
    });

    it("should handle file read errors", async () => {
      const fileError = new Error("File not found");
      mockedFs.readFileSync.mockImplementation(() => {
        throw fileError;
      });

      await expect(GetContextDetails("100")).rejects.toThrow("File not found");
    });

    it("should handle feed file with single item", async () => {
      const mockFeedData = [{ mpid: "100", name: "Product 1" }];

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockFeedData));

      const result = await GetContextDetails("100");

      expect(result).toEqual(mockFeedData[0]);
    });
  });

  describe("FilterEligibleProducts", () => {
    it("should throw error when productItemList is empty", async () => {
      mockCollection.toArray.mockResolvedValue([]);

      await expect(FilterEligibleProducts([], 1, false)).rejects.toThrow("No products found");
    });

    it("should set skipReprice for tradentDetails when matching cronId", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            cronId: 1,
            last_cron_time: new Date("2024-01-01T10:00:00Z"),
          },
        },
      ];

      jest.setSystemTime(new Date("2024-01-01T11:00:00Z"));

      const result = await FilterEligibleProducts(productItemList, 1, false);

      expect(result[0].tradentDetails.skipReprice).toBeDefined();
    });

    it("should set skipReprice for all vendor details", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: { mpid: 100, cronId: 1, last_cron_time: null },
          frontierDetails: { mpid: 100, cronId: 1, last_cron_time: null },
          mvpDetails: { mpid: 100, cronId: 1, last_cron_time: null },
          topDentDetails: { mpid: 100, cronId: 1, last_cron_time: null },
          firstDentDetails: { mpid: 100, cronId: 1, last_cron_time: null },
          triadDetails: { mpid: 100, cronId: 1, last_cron_time: null },
          biteSupplyDetails: { mpid: 100, cronId: 1, last_cron_time: null },
        },
      ];

      jest.setSystemTime(new Date("2024-01-01T10:00:00Z"));

      const result = await FilterEligibleProducts(productItemList, 1, false);

      expect(result[0].tradentDetails.skipReprice).toBeDefined();
      expect(result[0].frontierDetails.skipReprice).toBeDefined();
      expect(result[0].mvpDetails.skipReprice).toBeDefined();
      expect(result[0].topDentDetails.skipReprice).toBeDefined();
      expect(result[0].firstDentDetails.skipReprice).toBeDefined();
      expect(result[0].triadDetails.skipReprice).toBeDefined();
      expect(result[0].biteSupplyDetails.skipReprice).toBeDefined();
    });

    it("should handle products with missing vendor details", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: null,
          frontierDetails: { mpid: 100, cronId: 1, last_cron_time: null },
        },
      ];

      const result = await FilterEligibleProducts(productItemList, 1, false);

      expect(result[0].tradentDetails).toBeNull();
      expect(result[0].frontierDetails.skipReprice).toBeDefined();
    });

    it("should set skipReprice to true when product is in error items", async () => {
      const mockErrorItems = [
        {
          mpId: 100,
          vendorName: VendorName.TRADENT,
          active: true,
        },
      ];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            cronId: 1,
            last_cron_time: new Date("2024-01-01T10:00:00Z"),
          },
        },
      ];

      jest.setSystemTime(new Date("2024-01-01T11:00:00Z"));

      const result = await FilterEligibleProducts(productItemList, 1, false);

      expect(result[0].tradentDetails.skipReprice).toBe(true);
    });

    it("should handle slow cron with slowCronId", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            slowCronId: 2,
            last_cron_time: null,
          },
        },
      ];

      const result = await FilterEligibleProducts(productItemList, 2, true);

      expect(result[0].tradentDetails.skipReprice).toBeDefined();
    });

    it("should return false when last_cron_time is null and not in debug mode", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            cronId: 1,
            last_cron_time: null,
          },
        },
      ];

      const result = await FilterEligibleProducts(productItemList, 1, false);

      expect(result[0].tradentDetails.skipReprice).toBe(false);
    });

    it("should handle requestIntervalUnit as 'min'", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const lastCronTime = new Date("2024-01-01T10:00:00Z");
      jest.setSystemTime(new Date("2024-01-01T10:05:00Z")); // 5 minutes later

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            cronId: 1,
            last_cron_time: lastCronTime,
            requestInterval: "3",
            requestIntervalUnit: "min",
            next_cron_time: null,
          },
        },
      ];

      const result = await FilterEligibleProducts(productItemList, 1, false);

      // 5 minutes >= 3 minutes, so should return false (don't skip)
      expect(result[0].tradentDetails.skipReprice).toBe(false);
    });

    it("should handle requestIntervalUnit as 'sec'", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const lastCronTime = new Date("2024-01-01T10:00:00Z");
      jest.setSystemTime(new Date("2024-01-01T10:00:05Z")); // 5 seconds later

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            cronId: 1,
            last_cron_time: lastCronTime,
            requestInterval: "3",
            requestIntervalUnit: "sec",
            next_cron_time: null,
          },
        },
      ];

      const result = await FilterEligibleProducts(productItemList, 1, false);

      // 5 seconds >= 3 seconds, so should return false (don't skip)
      expect(result[0].tradentDetails.skipReprice).toBe(false);
    });

    it("should return true when time difference is less than requestInterval", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const lastCronTime = new Date("2024-01-01T10:00:00Z");
      jest.setSystemTime(new Date("2024-01-01T10:00:02Z")); // 2 seconds later

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            cronId: 1,
            last_cron_time: lastCronTime,
            requestInterval: "5",
            requestIntervalUnit: "sec",
            next_cron_time: null,
          },
        },
      ];

      const result = await FilterEligibleProducts(productItemList, 1, false);

      // 2 seconds < 5 seconds, so should return true (skip)
      expect(result[0].tradentDetails.skipReprice).toBe(true);
    });

    it("should return false when requestInterval is invalid (NaN) for min", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            cronId: 1,
            last_cron_time: new Date("2024-01-01T10:00:00Z"),
            requestInterval: "invalid",
            requestIntervalUnit: "min",
            next_cron_time: null,
          },
        },
      ];

      jest.setSystemTime(new Date("2024-01-01T11:00:00Z"));

      const result = await FilterEligibleProducts(productItemList, 1, false);

      expect(result[0].tradentDetails.skipReprice).toBe(false);
    });

    it("should return false when requestInterval is invalid (NaN) for sec", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            cronId: 1,
            last_cron_time: new Date("2024-01-01T10:00:00Z"),
            requestInterval: "invalid",
            requestIntervalUnit: "sec",
            next_cron_time: null,
          },
        },
      ];

      jest.setSystemTime(new Date("2024-01-01T10:00:05Z"));

      const result = await FilterEligibleProducts(productItemList, 1, false);

      expect(result[0].tradentDetails.skipReprice).toBe(false);
    });

    it("should return true when next_cron_time is in the future", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const futureTime = new Date("2024-01-01T12:00:00Z");
      jest.setSystemTime(new Date("2024-01-01T10:00:00Z"));

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            cronId: 1,
            last_cron_time: new Date("2024-01-01T09:00:00Z"),
            requestInterval: "60",
            requestIntervalUnit: "min",
            next_cron_time: futureTime,
          },
        },
      ];

      const result = await FilterEligibleProducts(productItemList, 1, false);

      expect(result[0].tradentDetails.skipReprice).toBe(true);
    });

    it("should return true when cronId doesn't match", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: {
            mpid: 100,
            cronId: 2, // Different from cronId parameter (1)
            last_cron_time: null,
          },
        },
      ];

      const result = await FilterEligibleProducts(productItemList, 1, false);

      expect(result[0].tradentDetails.skipReprice).toBe(true);
    });

    it("should handle multiple products", async () => {
      const mockErrorItems: any[] = [];
      mockCollection.toArray.mockResolvedValue(mockErrorItems);

      const productItemList = [
        {
          mpId: 100,
          tradentDetails: { mpid: 100, cronId: 1, last_cron_time: null },
        },
        {
          mpId: 200,
          frontierDetails: { mpid: 200, cronId: 1, last_cron_time: null },
        },
        {
          mpId: 300,
          mvpDetails: { mpid: 300, cronId: 1, last_cron_time: null },
        },
      ];

      const result = await FilterEligibleProducts(productItemList, 1, false);

      expect(result).toHaveLength(3);
      expect(result[0].tradentDetails.skipReprice).toBeDefined();
      expect(result[1].frontierDetails.skipReprice).toBeDefined();
      expect(result[2].mvpDetails.skipReprice).toBeDefined();
    });
  });

  describe("SetSkipReprice", () => {
    it("should throw error when productItemList is empty", () => {
      expect(() => SetSkipReprice([], true)).toThrow("No product items found");
    });

    it("should throw error when productItemList is null", () => {
      expect(() => SetSkipReprice(null as any, true)).toThrow("No product items found");
    });

    it("should set skipReprice to true for all vendor details", () => {
      const productItemList: ProductDetailsListItem[] = [
        {
          mpId: 100,
          productIdentifier: 1,
          isSlowActivated: false,
          isScrapeOnlyActivated: false,
          scrapeOnlyCronId: "",
          scrapeOnlyCronName: "",
          tradentLinkInfo: 1,
          frontierLinkInfo: 1,
          mvpLinkInfo: 1,
          topDentLinkInfo: 1,
          firstDentLinkInfo: 1,
          tradentDetails: { mpid: 100, skipReprice: false } as any,
          frontierDetails: { mpid: 100, skipReprice: false } as any,
          mvpDetails: { mpid: 100, skipReprice: false } as any,
          topDentDetails: { mpid: 100, skipReprice: false } as any,
          firstDentDetails: { mpid: 100, skipReprice: false } as any,
          triadDetails: { mpid: 100, skipReprice: false } as any,
          biteSupplyDetails: { mpid: 100, skipReprice: false } as any,
        },
      ];

      const result = SetSkipReprice(productItemList, true);

      expect(result[0].tradentDetails?.skipReprice).toBe(true);
      expect(result[0].frontierDetails?.skipReprice).toBe(true);
      expect(result[0].mvpDetails?.skipReprice).toBe(true);
      expect(result[0].topDentDetails?.skipReprice).toBe(true);
      expect(result[0].firstDentDetails?.skipReprice).toBe(true);
      expect(result[0].triadDetails?.skipReprice).toBe(true);
      expect(result[0].biteSupplyDetails?.skipReprice).toBe(true);
    });

    it("should set skipReprice to false for all vendor details", () => {
      const productItemList: ProductDetailsListItem[] = [
        {
          mpId: 100,
          productIdentifier: 1,
          isSlowActivated: false,
          isScrapeOnlyActivated: false,
          scrapeOnlyCronId: "",
          scrapeOnlyCronName: "",
          tradentLinkInfo: 1,
          frontierLinkInfo: 1,
          mvpLinkInfo: 1,
          topDentLinkInfo: 1,
          firstDentLinkInfo: 1,
          tradentDetails: { mpid: 100, skipReprice: true } as any,
          frontierDetails: { mpid: 100, skipReprice: true } as any,
          mvpDetails: { mpid: 100, skipReprice: true } as any,
          topDentDetails: { mpid: 100, skipReprice: true } as any,
          firstDentDetails: { mpid: 100, skipReprice: true } as any,
          triadDetails: { mpid: 100, skipReprice: true } as any,
          biteSupplyDetails: { mpid: 100, skipReprice: true } as any,
        },
      ];

      const result = SetSkipReprice(productItemList, false);

      expect(result[0].tradentDetails?.skipReprice).toBe(false);
      expect(result[0].frontierDetails?.skipReprice).toBe(false);
      expect(result[0].mvpDetails?.skipReprice).toBe(false);
      expect(result[0].topDentDetails?.skipReprice).toBe(false);
      expect(result[0].firstDentDetails?.skipReprice).toBe(false);
      expect(result[0].triadDetails?.skipReprice).toBe(false);
      expect(result[0].biteSupplyDetails?.skipReprice).toBe(false);
    });

    it("should handle products with null vendor details", () => {
      const productItemList: ProductDetailsListItem[] = [
        {
          mpId: 100,
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
          tradentDetails: null,
          frontierDetails: null,
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
        },
      ];

      const result = SetSkipReprice(productItemList, true);

      expect(result[0].tradentDetails).toBeNull();
      expect(result[0].frontierDetails).toBeNull();
      expect(result[0].mvpDetails).toBeNull();
      expect(result[0].topDentDetails).toBeNull();
      expect(result[0].firstDentDetails).toBeNull();
      expect(result[0].triadDetails).toBeNull();
      expect(result[0].biteSupplyDetails).toBeNull();
    });

    it("should handle products with mixed null and defined vendor details", () => {
      const productItemList: ProductDetailsListItem[] = [
        {
          mpId: 100,
          productIdentifier: 1,
          isSlowActivated: false,
          isScrapeOnlyActivated: false,
          scrapeOnlyCronId: "",
          scrapeOnlyCronName: "",
          tradentLinkInfo: 1,
          frontierLinkInfo: null,
          mvpLinkInfo: 1,
          topDentLinkInfo: null,
          firstDentLinkInfo: 1,
          tradentDetails: { mpid: 100, skipReprice: false } as any,
          frontierDetails: null,
          mvpDetails: { mpid: 100, skipReprice: false } as any,
          topDentDetails: null,
          firstDentDetails: { mpid: 100, skipReprice: false } as any,
          triadDetails: null,
          biteSupplyDetails: null,
        },
      ];

      const result = SetSkipReprice(productItemList, true);

      expect(result[0].tradentDetails?.skipReprice).toBe(true);
      expect(result[0].frontierDetails).toBeNull();
      expect(result[0].mvpDetails?.skipReprice).toBe(true);
      expect(result[0].topDentDetails).toBeNull();
      expect(result[0].firstDentDetails?.skipReprice).toBe(true);
      expect(result[0].triadDetails).toBeNull();
      expect(result[0].biteSupplyDetails).toBeNull();
    });

    it("should not mutate original productItemList", () => {
      const productItemList: ProductDetailsListItem[] = [
        {
          mpId: 100,
          productIdentifier: 1,
          isSlowActivated: false,
          isScrapeOnlyActivated: false,
          scrapeOnlyCronId: "",
          scrapeOnlyCronName: "",
          tradentLinkInfo: 1,
          frontierLinkInfo: 1,
          mvpLinkInfo: 1,
          topDentLinkInfo: 1,
          firstDentLinkInfo: 1,
          tradentDetails: { mpid: 100, skipReprice: false } as any,
          frontierDetails: { mpid: 100, skipReprice: false } as any,
          mvpDetails: { mpid: 100, skipReprice: false } as any,
          topDentDetails: { mpid: 100, skipReprice: false } as any,
          firstDentDetails: { mpid: 100, skipReprice: false } as any,
          triadDetails: { mpid: 100, skipReprice: false } as any,
          biteSupplyDetails: { mpid: 100, skipReprice: false } as any,
        },
      ];

      const originalSkipReprice = productItemList[0].tradentDetails?.skipReprice;
      const result = SetSkipReprice(productItemList, true);

      expect(result[0].tradentDetails?.skipReprice).toBe(true);
      expect(productItemList[0].tradentDetails?.skipReprice).toBe(originalSkipReprice);
    });

    it("should handle multiple products", () => {
      const productItemList: ProductDetailsListItem[] = [
        {
          mpId: 100,
          productIdentifier: 1,
          isSlowActivated: false,
          isScrapeOnlyActivated: false,
          scrapeOnlyCronId: "",
          scrapeOnlyCronName: "",
          tradentLinkInfo: 1,
          frontierLinkInfo: null,
          mvpLinkInfo: null,
          topDentLinkInfo: null,
          firstDentLinkInfo: null,
          tradentDetails: { mpid: 100, skipReprice: false } as any,
          frontierDetails: null,
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
        },
        {
          mpId: 200,
          productIdentifier: 2,
          isSlowActivated: false,
          isScrapeOnlyActivated: false,
          scrapeOnlyCronId: "",
          scrapeOnlyCronName: "",
          tradentLinkInfo: null,
          frontierLinkInfo: 1,
          mvpLinkInfo: null,
          topDentLinkInfo: null,
          firstDentLinkInfo: null,
          tradentDetails: null,
          frontierDetails: { mpid: 200, skipReprice: false } as any,
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
        },
      ];

      const result = SetSkipReprice(productItemList, true);

      expect(result).toHaveLength(2);
      expect(result[0].tradentDetails?.skipReprice).toBe(true);
      expect(result[1].frontierDetails?.skipReprice).toBe(true);
    });
  });
});
