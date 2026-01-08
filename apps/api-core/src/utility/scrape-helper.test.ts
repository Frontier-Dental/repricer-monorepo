// Mock all dependencies BEFORE imports
jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-uuid-123-456-789"),
}));

jest.mock("moment", () => {
  const actualMoment = jest.requireActual("moment");
  const momentFn = (date?: any) => {
    if (date) {
      return actualMoment(date);
    }
    return actualMoment("2024-01-01 12:00:00");
  };
  momentFn.default = momentFn;
  return momentFn;
});

jest.mock("lodash", () => {
  const actualLodash = jest.requireActual("lodash");
  return actualLodash;
});

jest.mock("./axios-helper", () => ({
  getAsyncProxy: jest.fn(),
}));

jest.mock("./mysql/mysql-helper", () => ({
  InsertRunCompletionStatus: jest.fn(),
  UpdateRunCompletionStatus: jest.fn(),
  InsertRunInfo: jest.fn(),
  UpdateRunInfo: jest.fn(),
  InsertProductInfo: jest.fn(),
  InsertPriceBreakInfo: jest.fn(),
  UpdateLastScrapeInfo: jest.fn(),
  InsertHistoricalApiResponse: jest.fn(),
  InsertHistory: jest.fn(),
  UpdateMarketStateOnly: jest.fn(),
}));

jest.mock("./job-id-helper", () => ({
  Generate: jest.fn(() => "test-keygen-123"),
}));

jest.mock("./config", () => ({
  applicationConfig: {
    OWN_VENDOR_LIST: "17357;20722;20755;20727;20533;5;10",
    GET_SEARCH_RESULTS: "https://api.test.com/search/{mpId}",
    SCRAPE_ONLY_LOGGING: true,
    SCRAPE_RUN_LOGGING: true,
  },
}));

import { Execute } from "./scrape-helper";
import * as axiosHelper from "./axios-helper";
import * as mySqlHelper from "./mysql/mysql-helper";
import { Generate } from "./job-id-helper";
import { applicationConfig } from "./config";
import _ from "lodash";
import { v4 as uuid } from "uuid";

// Suppress console.log during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("scrape-helper", () => {
  let mockCronSetting: any;

  // Helper function to create a complete vendor response
  const createMockVendorResponse = (overrides: any = {}) => ({
    vendorId: "99999",
    vendorName: "TestVendor",
    vendorProductId: "VP123",
    vendorProductCode: "VPC123",
    vendorRegion: "US",
    inStock: true,
    inventory: "100",
    standardShipping: 5.99,
    standardShippingStatus: "available",
    freeShippingGap: 50,
    heavyShippingStatus: "available",
    heavyShipping: 10.99,
    shippingTime: "2-3 days",
    isFulfillmentPolicyStock: true,
    isBackordered: false,
    badgeId: 1,
    badgeName: "Best Seller",
    arrivalDate: "2024-01-05",
    arrivalBusinessDays: 3,
    isLowestTotalPrice: true,
    priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default cron setting
    mockCronSetting = {
      CronName: "TestCron",
      CronId: 1,
      ProxyProvider: 1,
    };

    // Default mocks
    (Generate as jest.Mock).mockReturnValue("test-keygen-123");
    (uuid as jest.Mock).mockReturnValue("test-uuid-123");
    (mySqlHelper.InsertRunCompletionStatus as jest.Mock).mockResolvedValue(true);
    (mySqlHelper.UpdateRunCompletionStatus as jest.Mock).mockResolvedValue(true);
    (mySqlHelper.InsertRunInfo as jest.Mock).mockResolvedValue([{ insertId: 100 }]);
    (mySqlHelper.UpdateRunInfo as jest.Mock).mockResolvedValue(true);
    (mySqlHelper.InsertProductInfo as jest.Mock).mockResolvedValue([{ insertId: 200 }]);
    (mySqlHelper.InsertPriceBreakInfo as jest.Mock).mockResolvedValue(true);
    (mySqlHelper.UpdateLastScrapeInfo as jest.Mock).mockResolvedValue(true);
    (mySqlHelper.InsertHistoricalApiResponse as jest.Mock).mockResolvedValue(300);
    (mySqlHelper.InsertHistory as jest.Mock).mockResolvedValue(true);
    (mySqlHelper.UpdateMarketStateOnly as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("Execute", () => {
    it("should return early if productList is empty", async () => {
      await Execute([], mockCronSetting);

      expect(Generate).not.toHaveBeenCalled();
      expect(mySqlHelper.InsertRunCompletionStatus).not.toHaveBeenCalled();
    });

    it("should return early if productList is null", async () => {
      await Execute(null as any, mockCronSetting);

      expect(Generate).not.toHaveBeenCalled();
      expect(mySqlHelper.InsertRunCompletionStatus).not.toHaveBeenCalled();
    });

    it("should execute scrape logic for small list without chunking", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [createMockVendorResponse()],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(Generate).toHaveBeenCalled();
      expect(mySqlHelper.InsertRunCompletionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          KeyGenId: "test-keygen-123",
          RunType: "SCRAPE_ONLY",
          IsCompleted: false,
        })
      );
      expect(mySqlHelper.UpdateRunCompletionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          KeyGenId: "test-keygen-123",
          RunType: "SCRAPE_ONLY",
          IsCompleted: true,
        })
      );
      expect(axiosHelper.getAsyncProxy).toHaveBeenCalled();
    });

    it("should chunk large product list and execute multiple times", async () => {
      // Create a list with 2500 products to trigger chunking
      const productList = Array.from({ length: 2500 }, (_, i) => ({
        MpId: `MP${i}`,
        LinkedTradentDetailsInfo: 0,
        LinkedFrontiersDetailsInfo: 0,
        LinkedMvpDetailsInfo: 0,
        LinkedTopDentDetailsInfo: 0,
        LinkedFirstDentDetailsInfo: 0,
        LinkedTriadDetailsInfo: 0,
        LinkedBiteSupplyDetailsInfo: 0,
      }));

      const mockApiResponse = {
        data: [createMockVendorResponse()],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      // Verify chunking occurred (2500 products should be split into 2 chunks of 2000 and 500)
      expect(axiosHelper.getAsyncProxy).toHaveBeenCalledTimes(2500);
    });

    it("should handle API response with no data", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: null,
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateLastScrapeInfo).not.toHaveBeenCalled();
      expect(mySqlHelper.InsertProductInfo).not.toHaveBeenCalled();
    });

    it("should handle API response with empty data array", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateLastScrapeInfo).toHaveBeenCalled();
      expect(mySqlHelper.InsertProductInfo).not.toHaveBeenCalled();
    });

    it("should handle API errors gracefully", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      (axiosHelper.getAsyncProxy as jest.Mock).mockRejectedValue(new Error("API Error"));

      // The function will throw, and UpdateRunCompletionStatus won't be called since there's no try-finally
      try {
        await Execute(productList, mockCronSetting);
      } catch (error) {
        // Expected to throw
      }

      // UpdateRunCompletionStatus is not called when errors occur (no try-finally in implementation)
      expect(mySqlHelper.UpdateRunCompletionStatus).not.toHaveBeenCalled();
    });
  });

  describe("executeScrapeLogic - History Logging", () => {
    it("should log history for TRADENT vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 1,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            priceBreaks: [
              { minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" },
              { minQty: 5, unitPrice: 9.5, pmId: "PM2", promoAddlDescr: "Bulk" },
            ],
          }),
          createMockVendorResponse({
            vendorId: "99999",
            vendorName: "OtherVendor",
            inventory: "50",
            priceBreaks: [{ minQty: 1, unitPrice: 11.0, pmId: "PM3", promoAddlDescr: "None" }],
            isFulfillmentPolicyStock: false,
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistoricalApiResponse).toHaveBeenCalled();
      expect(mySqlHelper.InsertHistory).toHaveBeenCalled();
    });

    it("should log history for FRONTIER vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 1,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "20722",
            vendorName: "FRONTIER",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).toHaveBeenCalled();
    });

    it("should log history for MVP vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 1,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "20755",
            vendorName: "MVP",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).toHaveBeenCalled();
    });

    it("should log history for TOPDENT vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 1,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "20533",
            vendorName: "TOPDENT",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).toHaveBeenCalled();
    });

    it("should log history for FIRSTDENT vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 1,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "20727",
            vendorName: "FIRSTDENT",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).toHaveBeenCalled();
    });

    it("should log history for TRIAD vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 1,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "5",
            vendorName: "TRIAD",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).toHaveBeenCalled();
    });

    it("should log history for BITESUPPLY vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 1,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "10",
            vendorName: "BITESUPPLY",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).toHaveBeenCalled();
    });

    it("should log history for multiple vendors", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 1,
          LinkedFrontiersDetailsInfo: 1,
          LinkedMvpDetailsInfo: 1,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
          createMockVendorResponse({
            vendorId: "20722",
            vendorName: "FRONTIER",
            inventory: "50",
            priceBreaks: [{ minQty: 1, unitPrice: 11.0, pmId: "PM2", promoAddlDescr: "None" }],
            isFulfillmentPolicyStock: false,
          }),
          createMockVendorResponse({
            vendorId: "20755",
            vendorName: "MVP",
            inventory: "75",
            priceBreaks: [{ minQty: 1, unitPrice: 10.8, pmId: "PM3", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).toHaveBeenCalledTimes(3);
    });

    it("should not log history when own vendor not found in API response", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 1,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "99999",
            vendorName: "OtherVendor",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).not.toHaveBeenCalled();
    });

    it("should not log history when history logging is disabled", async () => {
      (applicationConfig as any).SCRAPE_ONLY_LOGGING = false;

      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 1,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistoricalApiResponse).not.toHaveBeenCalled();
      expect(mySqlHelper.InsertHistory).not.toHaveBeenCalled();

      // Reset
      (applicationConfig as any).SCRAPE_ONLY_LOGGING = true;
    });
  });

  describe("executeScrapeLogic - Run Info Logging", () => {
    it("should insert product info and price breaks", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          {
            vendorId: "99999",
            vendorName: "TestVendor",
            vendorProductId: "VP123",
            vendorProductCode: "VPC123",
            vendorRegion: "US",
            inStock: true,
            inventory: "100",
            standardShipping: 5.99,
            standardShippingStatus: "available",
            freeShippingGap: 50,
            heavyShippingStatus: "available",
            heavyShipping: 10.99,
            shippingTime: "2-3 days",
            isFulfillmentPolicyStock: true,
            isBackordered: false,
            badgeId: 1,
            badgeName: "Best Seller",
            arrivalDate: "2024-01-05",
            arrivalBusinessDays: 3,
            isLowestTotalPrice: true,
            priceBreaks: [
              { minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" },
              { minQty: 5, unitPrice: 9.5, pmId: "PM2", promoAddlDescr: "Bulk discount" },
            ],
          },
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertProductInfo).toHaveBeenCalled();
      expect(mySqlHelper.InsertPriceBreakInfo).toHaveBeenCalledTimes(2);
    });

    it("should handle isFulfillmentPolicyStock as string 'true'", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            isFulfillmentPolicyStock: "true",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertProductInfo).toHaveBeenCalled();
      const productInfoCall = (mySqlHelper.InsertProductInfo as jest.Mock).mock.calls[0][0];
      expect(productInfoCall.IsFulfillmentPolicyStock).toBe(1);
    });

    it("should handle isFulfillmentPolicyStock as string 'false'", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            isFulfillmentPolicyStock: "false",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertProductInfo).toHaveBeenCalled();
      const productInfoCall = (mySqlHelper.InsertProductInfo as jest.Mock).mock.calls[0][0];
      expect(productInfoCall.IsFulfillmentPolicyStock).toBe(0);
    });

    it("should not insert product info when run info logging is disabled", async () => {
      (applicationConfig as any).SCRAPE_RUN_LOGGING = false;

      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          {
            vendorId: "99999",
            vendorName: "TestVendor",
            inStock: true,
            inventory: "100",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5 }],
            isFulfillmentPolicyStock: true,
          },
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertProductInfo).not.toHaveBeenCalled();

      // Reset
      (applicationConfig as any).SCRAPE_RUN_LOGGING = true;
    });

    it("should not insert price breaks when productInfoResult is invalid", async () => {
      (mySqlHelper.InsertProductInfo as jest.Mock).mockResolvedValue(null);

      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertPriceBreakInfo).not.toHaveBeenCalled();
    });

    it("should not insert price breaks when priceBreaks is missing", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            priceBreaks: undefined,
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertPriceBreakInfo).not.toHaveBeenCalled();
    });
  });

  describe("executeScrapeLogic - Own Vendor Market State Updates", () => {
    it("should update market state for TRADENT vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).toHaveBeenCalledWith(
        "12345",
        "TRADENT",
        expect.objectContaining({
          inStock: true,
          inventory: 100,
          ourPrice: 10.5,
        })
      );
    });

    it("should update market state for FRONTIER vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "20722",
            vendorName: "FRONTIER",
            inventory: "50",
            priceBreaks: [{ minQty: 1, unitPrice: 15.75, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).toHaveBeenCalledWith(
        "12345",
        "FRONTIER",
        expect.objectContaining({
          inStock: true,
          inventory: 50,
          ourPrice: 15.75,
        })
      );
    });

    it("should update market state for MVP vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "20755",
            vendorName: "MVP",
            inventory: "75",
            priceBreaks: [{ minQty: 1, unitPrice: 12.25, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).toHaveBeenCalledWith(
        "12345",
        "MVP",
        expect.objectContaining({
          inStock: true,
          inventory: 75,
          ourPrice: 12.25,
        })
      );
    });

    it("should update market state for TOPDENT vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "20727",
            vendorName: "TOPDENT",
            inventory: "200",
            priceBreaks: [{ minQty: 1, unitPrice: 8.99, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).toHaveBeenCalledWith(
        "12345",
        "TOPDENT",
        expect.objectContaining({
          inStock: true,
          inventory: 200,
          ourPrice: 8.99,
        })
      );
    });

    it("should update market state for FIRSTDENT vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "20533",
            vendorName: "FIRSTDENT",
            inventory: "150",
            priceBreaks: [{ minQty: 1, unitPrice: 9.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).toHaveBeenCalledWith(
        "12345",
        "FIRSTDENT",
        expect.objectContaining({
          inStock: true,
          inventory: 150,
          ourPrice: 9.5,
        })
      );
    });

    it("should update market state for TRIAD vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "5",
            vendorName: "TRIAD",
            inventory: "80",
            priceBreaks: [{ minQty: 1, unitPrice: 11.0, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).toHaveBeenCalledWith(
        "12345",
        "TRIAD",
        expect.objectContaining({
          inStock: true,
          inventory: 80,
          ourPrice: 11.0,
        })
      );
    });

    it("should update market state for BITESUPPLY vendor", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "10",
            vendorName: "BITESUPPLY",
            inventory: "90",
            priceBreaks: [{ minQty: 1, unitPrice: 10.25, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).toHaveBeenCalledWith(
        "12345",
        "BITESUPPLY",
        expect.objectContaining({
          inStock: true,
          inventory: 90,
          ourPrice: 10.25,
        })
      );
    });

    it("should handle market state update errors gracefully", async () => {
      (mySqlHelper.UpdateMarketStateOnly as jest.Mock).mockRejectedValue(new Error("DB Error"));

      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(console.error).toHaveBeenCalled();
      expect(mySqlHelper.InsertProductInfo).toHaveBeenCalled(); // Should continue processing
    });

    it("should handle missing base price in price breaks", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            priceBreaks: [{ minQty: 5, unitPrice: 9.5, pmId: "PM1", promoAddlDescr: "None" }], // No minQty=1
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).toHaveBeenCalledWith(
        "12345",
        "TRADENT",
        expect.objectContaining({
          inStock: true,
          inventory: 100,
          ourPrice: undefined,
        })
      );
    });

    it("should handle invalid inventory value", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            inventory: "invalid",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).toHaveBeenCalledWith(
        "12345",
        "TRADENT",
        expect.objectContaining({
          inventory: 0,
        })
      );
    });

    it("should not update market state for non-own vendors", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "99999",
            vendorName: "OtherVendor",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).not.toHaveBeenCalled();
    });
  });

  describe("GetHistoryModel - Edge Cases", () => {
    it("should handle vendor with no price breaks", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 1,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            priceBreaks: [],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).not.toHaveBeenCalled();
    });

    it("should handle multiple price breaks with same minQty", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 1,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            priceBreaks: [
              { minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" },
              { minQty: 1, unitPrice: 10.0, pmId: "PM2", promoAddlDescr: "None" }, // Duplicate minQty
              { minQty: 5, unitPrice: 9.5, pmId: "PM3", promoAddlDescr: "None" },
            ],
          }),
          createMockVendorResponse({
            vendorId: "99999",
            vendorName: "OtherVendor",
            inventory: "50",
            priceBreaks: [{ minQty: 1, unitPrice: 11.0, pmId: "PM4", promoAddlDescr: "None" }],
            isFulfillmentPolicyStock: false,
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).toHaveBeenCalled();
    });

    it("should handle vendors with different price break quantities", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 1,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            priceBreaks: [
              { minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" },
              { minQty: 5, unitPrice: 9.5, pmId: "PM2", promoAddlDescr: "None" },
              { minQty: 10, unitPrice: 8.5, pmId: "PM3", promoAddlDescr: "None" },
            ],
          }),
          createMockVendorResponse({
            vendorId: "99999",
            vendorName: "OtherVendor1",
            inventory: "50",
            priceBreaks: [
              { minQty: 1, unitPrice: 11.0, pmId: "PM4", promoAddlDescr: "None" },
              { minQty: 5, unitPrice: 10.0, pmId: "PM5", promoAddlDescr: "None" },
            ],
            isFulfillmentPolicyStock: false,
          }),
          createMockVendorResponse({
            vendorId: "88888",
            vendorName: "OtherVendor2",
            inventory: "75",
            priceBreaks: [{ minQty: 1, unitPrice: 12.0, pmId: "PM6", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertHistory).toHaveBeenCalledTimes(3); // One for each price break
    });
  });

  describe("RunInfo Updates", () => {
    it("should update run info with success and failure counts", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
        {
          MpId: "67890",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [createMockVendorResponse()],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateRunInfo).toHaveBeenCalled();
      const updateCalls = (mySqlHelper.UpdateRunInfo as jest.Mock).mock.calls;
      expect(updateCalls.some((call) => call[0].includes("ScrapedSuccessCount"))).toBe(true);
      expect(updateCalls.some((call) => call[0].includes("ScrapedFailureCount"))).toBe(true);
      expect(updateCalls.some((call) => call[0].includes("RunEndTime"))).toBe(true);
    });

    it("should update completed product count for each product", async () => {
      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
        {
          MpId: "67890",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [createMockVendorResponse()],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      const updateCalls = (mySqlHelper.UpdateRunInfo as jest.Mock).mock.calls;
      const completedCountCalls = updateCalls.filter((call) => call[0].includes("CompletedProductCount"));
      expect(completedCountCalls.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty OWN_VENDOR_LIST", async () => {
      (applicationConfig as any).OWN_VENDOR_LIST = "";

      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [
          createMockVendorResponse({
            vendorId: "17357",
            vendorName: "TRADENT",
            priceBreaks: [{ minQty: 1, unitPrice: 10.5, pmId: "PM1", promoAddlDescr: "None" }],
          }),
        ],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.UpdateMarketStateOnly).not.toHaveBeenCalled();

      // Reset
      (applicationConfig as any).OWN_VENDOR_LIST = "17357;20722;20755;20727;20533;5;10";
    });

    it("should handle runInfoResult as object with insertId", async () => {
      (mySqlHelper.InsertRunInfo as jest.Mock).mockResolvedValue({ insertId: 100 });

      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [createMockVendorResponse()],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertProductInfo).toHaveBeenCalled();
    });

    it("should handle runInfoResult as null", async () => {
      (mySqlHelper.InsertRunInfo as jest.Mock).mockResolvedValue(null);

      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [createMockVendorResponse()],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(axiosHelper.getAsyncProxy).not.toHaveBeenCalled();
    });

    it("should handle productInfoResult as array without insertId", async () => {
      (mySqlHelper.InsertProductInfo as jest.Mock).mockResolvedValue(null);

      const productList = [
        {
          MpId: "12345",
          LinkedTradentDetailsInfo: 0,
          LinkedFrontiersDetailsInfo: 0,
          LinkedMvpDetailsInfo: 0,
          LinkedTopDentDetailsInfo: 0,
          LinkedFirstDentDetailsInfo: 0,
          LinkedTriadDetailsInfo: 0,
          LinkedBiteSupplyDetailsInfo: 0,
        },
      ];

      const mockApiResponse = {
        data: [createMockVendorResponse()],
      };

      (axiosHelper.getAsyncProxy as jest.Mock).mockResolvedValue(mockApiResponse);

      await Execute(productList, mockCronSetting);

      expect(mySqlHelper.InsertPriceBreakInfo).not.toHaveBeenCalled();
    });
  });
});
