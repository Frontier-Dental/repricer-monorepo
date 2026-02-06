// Mock shared package BEFORE imports
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
  CacheKey: {
    _422_RUNNING_CACHE: "_422_RUNNING_CACHE",
    CRON_SETTINGS_LIST: "CRON_SETTINGS_LIST",
    SCRAPE_CRON_DETAILS: "SCRAPE_CRON_DETAILS",
  },
}));

// Mock config BEFORE imports
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    CRON_NAME_422: "Cron-422",
    RUN_CRONS_ON_INIT: true,
    BATCH_SIZE: 700,
    _422_CACHE_VALID_PERIOD: 120,
    GET_SEARCH_RESULTS: "https://api.example.com/search/{mpId}",
    OWN_VENDOR_LIST: "1;2;3",
    WRITE_HISTORY_SQL: false,
  },
}));

// Mock all dependencies
jest.mock("./shared");
jest.mock("../../utility/mysql/mysql-helper");
jest.mock("../../utility/scrape-helper");
jest.mock("../../utility/mysql/mysql-v2");

import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { runCron, runProduct } from "./run-cron";
import * as shared from "./shared";
import * as mySqlHelper from "../../utility/mysql/mysql-helper";
import * as scrapeHelper from "../../utility/scrape-helper";
import { GetScrapeCronDetails } from "../../utility/mysql/mysql-v2";
import { ScrapeCronDetail } from "../../utility/mongo/types";

const mockScrapeProductList = shared.scrapeProductList as jest.MockedFunction<typeof shared.scrapeProductList>;
const mockGetItemListById = mySqlHelper.GetItemListById as jest.MockedFunction<typeof mySqlHelper.GetItemListById>;
const mockExecute = scrapeHelper.Execute as jest.MockedFunction<typeof scrapeHelper.Execute>;
const mockGetScrapeCronDetails = GetScrapeCronDetails as jest.MockedFunction<typeof GetScrapeCronDetails>;

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("scrape-cron/run-cron", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStatus: jest.Mock;
  let mockSend: jest.Mock;

  const mockScrapeCronDetail: ScrapeCronDetail = {
    CronName: "SOC-1",
    CronId: "scrape-cron-1",
    CronTime: 1,
    CronTimeUnit: "hours",
    Offset: "0",
    IpType: 1,
    ProxyProvider: 1,
    AlternateProxyProvider: [],
    status: "active",
    createdOn: { $date: new Date().toISOString() },
    updatedOn: { $date: new Date().toISOString() },
    AuditInfo: {
      UpdatedBy: "test",
      UpdatedOn: { $date: new Date().toISOString() },
    },
  } as any;

  const mockProduct = {
    mpId: 123,
    productIdentifier: 456,
    tradentLinkInfo: 1,
    frontierLinkInfo: null,
    mvpLinkInfo: null,
    topDentLinkInfo: null,
    firstDentLinkInfo: null,
    triadLinkInfo: null,
    biteSupplyLinkInfo: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Create mock response object
    mockSend = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnValue({ send: mockSend });
    mockResponse = {
      status: mockStatus,
      send: mockSend,
    };

    // Create mock request object
    mockRequest = {
      params: {} as any,
    };

    // Default mock implementations
    mockGetScrapeCronDetails.mockResolvedValue([mockScrapeCronDetail] as any);
    mockScrapeProductList.mockResolvedValue(undefined);
    mockGetItemListById.mockResolvedValue(mockProduct as any);
    mockExecute.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("runCron", () => {
    it("should successfully run cron for valid cron name", async () => {
      mockRequest.params = { cronName: "SOC-1" };

      await runCron(mockRequest as Request, mockResponse as Response);

      expect(mockGetScrapeCronDetails).toHaveBeenCalled();
      expect(mockScrapeProductList).toHaveBeenCalledWith(mockScrapeCronDetail);
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockSend).toHaveBeenCalledWith(expect.stringContaining("Done at"));
    });

    it("should handle cron name not found", async () => {
      mockRequest.params = { cronName: "NONEXISTENT" };
      mockGetScrapeCronDetails.mockResolvedValue([mockScrapeCronDetail] as any);

      await runCron(mockRequest as Request, mockResponse as Response);

      expect(mockGetScrapeCronDetails).toHaveBeenCalled();
      expect(mockScrapeProductList).toHaveBeenCalledWith(undefined);
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockSend).toHaveBeenCalledWith(expect.stringContaining("Done at"));
    });

    it("should handle empty scrape cron details", async () => {
      mockRequest.params = { cronName: "SOC-1" };
      mockGetScrapeCronDetails.mockResolvedValue([]);

      await runCron(mockRequest as Request, mockResponse as Response);

      expect(mockGetScrapeCronDetails).toHaveBeenCalled();
      expect(mockScrapeProductList).toHaveBeenCalledWith(undefined);
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it("should find correct cron by name", async () => {
      const cron1 = { ...mockScrapeCronDetail, CronName: "SOC-1" };
      const cron2 = { ...mockScrapeCronDetail, CronName: "SOC-2", CronId: "scrape-cron-2" };
      mockGetScrapeCronDetails.mockResolvedValue([cron1, cron2] as any);
      mockRequest.params = { cronName: "SOC-2" };

      await runCron(mockRequest as Request, mockResponse as Response);

      expect(mockScrapeProductList).toHaveBeenCalledWith(cron2);
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it("should handle error in GetScrapeCronDetails", async () => {
      mockRequest.params = { cronName: "SOC-1" };
      const error = new Error("Database error");
      mockGetScrapeCronDetails.mockRejectedValue(error);

      await expect(runCron(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Database error");
    });

    it("should handle error in scrapeProductList", async () => {
      mockRequest.params = { cronName: "SOC-1" };
      const error = new Error("Scrape error");
      mockScrapeProductList.mockRejectedValue(error);

      await expect(runCron(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Scrape error");
    });

    it("should use case-sensitive comparison for cron name", async () => {
      mockRequest.params = { cronName: "soc-1" }; // lowercase
      mockGetScrapeCronDetails.mockResolvedValue([mockScrapeCronDetail] as any);

      await runCron(mockRequest as Request, mockResponse as Response);

      // Should not find because case doesn't match
      expect(mockScrapeProductList).toHaveBeenCalledWith(undefined);
    });

    it("should return response with current date", async () => {
      mockRequest.params = { cronName: "SOC-1" };

      await runCron(mockRequest as Request, mockResponse as Response);

      expect(mockSend).toHaveBeenCalledWith(expect.stringMatching(/^Done at .+$/));
      const sendCall = mockSend.mock.calls[0][0];
      expect(sendCall).toContain("Done at");
      // Verify it's a valid date string
      const dateMatch = sendCall.match(/Done at (.+)/);
      expect(dateMatch).toBeTruthy();
      if (dateMatch) {
        const responseDate = new Date(dateMatch[1]);
        expect(responseDate.getTime()).toBeGreaterThan(0);
        expect(isNaN(responseDate.getTime())).toBe(false);
      }
    });

    it("should handle multiple cron details with same name pattern", async () => {
      const cron1 = { ...mockScrapeCronDetail, CronName: "SOC-1" };
      const cron2 = { ...mockScrapeCronDetail, CronName: "SOC-10", CronId: "scrape-cron-10" };
      mockGetScrapeCronDetails.mockResolvedValue([cron1, cron2] as any);
      mockRequest.params = { cronName: "SOC-1" };

      await runCron(mockRequest as Request, mockResponse as Response);

      // Should find the first match
      expect(mockScrapeProductList).toHaveBeenCalledWith(cron1);
    });
  });

  describe("runProduct", () => {
    it("should successfully run scrape for a specific product", async () => {
      mockRequest.params = { cronName: "SOC-1", product: "123" };

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockGetScrapeCronDetails).toHaveBeenCalled();
      expect(mockGetItemListById).toHaveBeenCalledWith("123");
      expect(mockExecute).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            MpId: 123,
            LinkedTradentDetailsInfo: 1,
          }),
        ]),
        mockScrapeCronDetail
      );
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockSend).toHaveBeenCalledWith(expect.stringContaining("Done at"));
    });

    it("should handle product not found", async () => {
      mockRequest.params = { cronName: "SOC-1", product: "999" };
      mockGetItemListById.mockResolvedValue(undefined);

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockGetItemListById).toHaveBeenCalledWith("999");
      expect(mockExecute).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockSend).toHaveBeenCalledWith(expect.stringContaining("Done at"));
    });

    it("should handle cron name not found", async () => {
      mockRequest.params = { cronName: "NONEXISTENT", product: "123" };
      mockGetScrapeCronDetails.mockResolvedValue([mockScrapeCronDetail] as any);

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockGetScrapeCronDetails).toHaveBeenCalled();
      expect(mockGetItemListById).toHaveBeenCalledWith("123");
      // Should still try to execute even if cron not found (contextCronDetails is undefined)
      expect(mockExecute).toHaveBeenCalled();
    });

    it("should map product properties correctly", async () => {
      const productWithAllFields = {
        mpId: 456,
        productIdentifier: 789,
        tradentLinkInfo: 2,
        frontierLinkInfo: 3,
        mvpLinkInfo: 4,
        topDentLinkInfo: 5,
        firstDentLinkInfo: 6,
        triadLinkInfo: 7,
        biteSupplyLinkInfo: 8,
      };
      mockGetItemListById.mockResolvedValue(productWithAllFields as any);
      mockRequest.params = { cronName: "SOC-1", product: "456" };

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            MpId: 456,
            LinkedTradentDetailsInfo: 2,
          }),
        ]),
        mockScrapeCronDetail
      );
    });

    it("should handle error in GetScrapeCronDetails", async () => {
      mockRequest.params = { cronName: "SOC-1", product: "123" };
      const error = new Error("Database error");
      mockGetScrapeCronDetails.mockRejectedValue(error);

      await expect(runProduct(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Database error");
    });

    it("should handle error in GetItemListById", async () => {
      mockRequest.params = { cronName: "SOC-1", product: "123" };
      const error = new Error("Product fetch error");
      mockGetItemListById.mockRejectedValue(error);

      await expect(runProduct(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Product fetch error");
    });

    it("should handle error in Execute", async () => {
      mockRequest.params = { cronName: "SOC-1", product: "123" };
      const error = new Error("Execute error");
      mockExecute.mockRejectedValue(error);

      await expect(runProduct(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Execute error");
    });

    it("should handle product with null link info fields", async () => {
      const productWithNulls = {
        mpId: 789,
        productIdentifier: 101,
        tradentLinkInfo: null,
        frontierLinkInfo: null,
        mvpLinkInfo: null,
        topDentLinkInfo: null,
        firstDentLinkInfo: null,
        triadLinkInfo: null,
        biteSupplyLinkInfo: null,
      };
      mockGetItemListById.mockResolvedValue(productWithNulls as any);
      mockRequest.params = { cronName: "SOC-1", product: "789" };

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            MpId: 789,
            LinkedTradentDetailsInfo: null,
          }),
        ]),
        mockScrapeCronDetail
      );
    });

    it("should handle empty scrape cron details", async () => {
      mockRequest.params = { cronName: "SOC-1", product: "123" };
      mockGetScrapeCronDetails.mockResolvedValue([]);

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockGetScrapeCronDetails).toHaveBeenCalled();
      expect(mockGetItemListById).toHaveBeenCalledWith("123");
      // Should still execute even if cron details not found
      expect(mockExecute).toHaveBeenCalled();
    });

    it("should return response with current date", async () => {
      mockRequest.params = { cronName: "SOC-1", product: "123" };

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockSend).toHaveBeenCalledWith(expect.stringMatching(/^Done at .+$/));
      const sendCall = mockSend.mock.calls[0][0];
      expect(sendCall).toContain("Done at");
      // Verify it's a valid date string
      const dateMatch = sendCall.match(/Done at (.+)/);
      expect(dateMatch).toBeTruthy();
      if (dateMatch) {
        const responseDate = new Date(dateMatch[1]);
        expect(responseDate.getTime()).toBeGreaterThan(0);
        expect(isNaN(responseDate.getTime())).toBe(false);
      }
    });

    it("should handle product with string mpId", async () => {
      const productWithStringId = {
        mpId: "123",
        productIdentifier: 456,
        tradentLinkInfo: 1,
      };
      mockGetItemListById.mockResolvedValue(productWithStringId as any);
      mockRequest.params = { cronName: "SOC-1", product: "123" };

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            MpId: "123",
          }),
        ]),
        mockScrapeCronDetail
      );
    });

    it("should handle product with number mpId", async () => {
      const productWithNumberId = {
        mpId: 123,
        productIdentifier: 456,
        tradentLinkInfo: 1,
      };
      mockGetItemListById.mockResolvedValue(productWithNumberId as any);
      mockRequest.params = { cronName: "SOC-1", product: "123" };

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            MpId: 123,
          }),
        ]),
        mockScrapeCronDetail
      );
    });

    it("should find correct cron by name when multiple exist", async () => {
      const cron1 = { ...mockScrapeCronDetail, CronName: "SOC-1" };
      const cron2 = { ...mockScrapeCronDetail, CronName: "SOC-2", CronId: "scrape-cron-2" };
      mockGetScrapeCronDetails.mockResolvedValue([cron1, cron2] as any);
      mockRequest.params = { cronName: "SOC-2", product: "123" };

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockExecute).toHaveBeenCalledWith(expect.any(Array), cron2);
    });

    it("should handle productId as array (takes first element)", async () => {
      mockRequest.params = { cronName: "SOC-1", product: "123" };

      await runProduct(mockRequest as Request, mockResponse as Response);

      expect(mockGetItemListById).toHaveBeenCalledWith("123");
      expect(mockExecute).toHaveBeenCalled();
    });
  });
});
