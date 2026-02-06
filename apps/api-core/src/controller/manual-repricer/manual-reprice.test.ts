// Mock shared package BEFORE imports
jest.mock("@repricer-monorepo/shared", () => ({
  AlgoExecutionMode: {
    V2_ONLY: "V2_ONLY",
    V1_ONLY: "V1_ONLY",
    V2_EXECUTE_V1_DRY: "V2_EXECUTE_V1_DRY",
    V1_EXECUTE_V2_DRY: "V1_EXECUTE_V2_DRY",
  },
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

// Mock config BEFORE imports
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    GET_SEARCH_RESULTS: "https://api.example.com/search/{mpId}",
  },
}));

// Mock uuid BEFORE imports
const mockV4 = jest.fn(() => "test-uuid-123");
jest.mock("uuid", () => ({
  v4: mockV4,
}));

// Mock all dependencies
jest.mock("./shared");
jest.mock("../../utility/axios-helper");
jest.mock("../../utility/feed-helper");
jest.mock("../../utility/mongo/db-helper");
jest.mock("../../utility/mysql/mysql-helper");
jest.mock("../../utility/reprice-algo/reprice-base");
jest.mock("../../utility/reprice-algo/v2/wrapper");
jest.mock("../../utility/request-generator");
jest.mock("../../utility/mysql/mysql-v2");

import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AxiosResponse } from "axios";
import { AlgoExecutionMode, VendorName } from "@repricer-monorepo/shared";
import { manualRepriceHandler } from "./manual-reprice";
import * as shared from "./shared";
import * as axiosHelper from "../../utility/axios-helper";
import * as feedHelper from "../../utility/feed-helper";
import * as mongoHelper from "../../utility/mongo/db-helper";
import * as sqlHelper from "../../utility/mysql/mysql-helper";
import * as repriceBase from "../../utility/reprice-algo/reprice-base";
import { repriceProductV2Wrapper } from "../../utility/reprice-algo/v2/wrapper";
import * as requestGenerator from "../../utility/request-generator";
import { GetCronSettingsDetailsById } from "../../utility/mysql/mysql-v2";
import { ProductDetailsListItem } from "../../utility/mysql/mySql-mapper";
import { Net32Product } from "../../types/net32";

const mockGetContextCronId = shared.getContextCronId as jest.MockedFunction<typeof shared.getContextCronId>;
const mockProceedNext = shared.proceedNext as jest.MockedFunction<typeof shared.proceedNext>;
const mockGetAsync = axiosHelper.getAsync as jest.MockedFunction<typeof axiosHelper.getAsync>;
const mockSetSkipReprice = feedHelper.SetSkipReprice as jest.MockedFunction<typeof feedHelper.SetSkipReprice>;
const mockGetEligibleContextErrorItems = mongoHelper.GetEligibleContextErrorItems as jest.MockedFunction<typeof mongoHelper.GetEligibleContextErrorItems>;
const mockPushLogsAsync = mongoHelper.PushLogsAsync as jest.MockedFunction<typeof mongoHelper.PushLogsAsync>;
const mockGetItemListById = sqlHelper.GetItemListById as jest.MockedFunction<typeof sqlHelper.GetItemListById>;
const mockRepriceWrapper = repriceBase.repriceWrapper as jest.MockedFunction<typeof repriceBase.repriceWrapper>;
const mockRepriceProductV2Wrapper = repriceProductV2Wrapper as jest.MockedFunction<typeof repriceProductV2Wrapper>;
const mockGetPrioritySequence = requestGenerator.GetPrioritySequence as jest.MockedFunction<typeof requestGenerator.GetPrioritySequence>;
const mockGetCronSettingsDetailsById = GetCronSettingsDetailsById as jest.MockedFunction<typeof GetCronSettingsDetailsById>;

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("manual-repricer/manual-reprice", () => {
  let mockRequest: Partial<Request<{ id: string }>>;
  let mockResponse: Partial<Response>;
  let mockStatus: jest.Mock;
  let mockJson: jest.Mock;
  let mockSend: jest.Mock;

  const mockProduct: ProductDetailsListItem = {
    mpId: 123,
    productIdentifier: 456,
    isSlowActivated: false,
    isScrapeOnlyActivated: false,
    scrapeOnlyCronId: "",
    scrapeOnlyCronName: "",
    tradentLinkInfo: null,
    frontierLinkInfo: null,
    mvpLinkInfo: null,
    topDentLinkInfo: null,
    firstDentLinkInfo: null,
    tradentDetails: {
      activated: true,
      scrapeOn: true,
      skipReprice: false,
      cronId: "cron-1",
      slowCronId: "slow-cron-1",
      executionPriority: 1,
    } as any,
    frontierDetails: null,
    mvpDetails: null,
    topDentDetails: null,
    firstDentDetails: null,
    triadDetails: null,
    biteSupplyDetails: null,
    algo_execution_mode: AlgoExecutionMode.V1_ONLY,
  };

  const mockNet32Response: AxiosResponse<Net32Product[]> = {
    data: [
      {
        vendorProductId: 1,
        vendorProductCode: "CODE123",
        vendorId: 1,
        vendorName: "TRADENT",
        vendorRegion: "US",
        inStock: true,
        standardShipping: 5.99,
        standardShippingStatus: "active",
        freeShippingGap: 0,
        heavyShippingStatus: "active",
        heavyShipping: 0,
        shippingTime: 1,
        inventory: 100,
        isFulfillmentPolicyStock: false,
        vdrGeneralAverageRatingSum: 0,
        vdrNumberOfGeneralRatings: 0,
        isBackordered: false,
        vendorProductLevelLicenseRequiredSw: false,
        vendorVerticalLevelLicenseRequiredSw: false,
        priceBreaks: [],
        badgeId: 0,
        badgeName: null,
        imagePath: "",
        arrivalDate: "",
        arrivalBusinessDays: 0,
        twoDayDeliverySw: false,
        isLowestTotalPrice: null,
      } as Net32Product,
    ],
    status: 200,
    statusText: "OK",
    headers: {},
    config: {} as any,
  };

  const mockCronSetting = {
    CronId: "cron-1",
    CronName: "Cron-1",
    CronTimeUnit: "hours",
    CronTime: 1,
    Offset: "0",
    CronStatus: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Reset uuid mock
    mockV4.mockReturnValue("test-uuid-123");

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Create mock response object
    mockJson = jest.fn().mockReturnThis();
    mockSend = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson, send: mockSend });
    mockResponse = {
      status: mockStatus,
      json: mockJson,
      send: mockSend,
    };

    // Create mock request object
    mockRequest = {
      params: {
        id: "123",
      },
    };

    // Default mock implementations
    mockGetItemListById.mockResolvedValue(mockProduct);
    mockGetContextCronId.mockReturnValue("cron-1");
    // SetSkipReprice returns the product with skipReprice set
    mockSetSkipReprice.mockImplementation((products) => {
      return products.map((p) => ({
        ...p,
        tradentDetails: p.tradentDetails ? { ...p.tradentDetails, skipReprice: false } : p.tradentDetails,
        frontierDetails: p.frontierDetails ? { ...p.frontierDetails, skipReprice: false } : p.frontierDetails,
        mvpDetails: p.mvpDetails ? { ...p.mvpDetails, skipReprice: false } : p.mvpDetails,
        topDentDetails: p.topDentDetails ? { ...p.topDentDetails, skipReprice: false } : p.topDentDetails,
        firstDentDetails: p.firstDentDetails ? { ...p.firstDentDetails, skipReprice: false } : p.firstDentDetails,
        triadDetails: p.triadDetails ? { ...p.triadDetails, skipReprice: false } : p.triadDetails,
        biteSupplyDetails: p.biteSupplyDetails ? { ...p.biteSupplyDetails, skipReprice: false } : p.biteSupplyDetails,
      })) as any;
    });
    mockGetEligibleContextErrorItems.mockResolvedValue([]);
    mockGetPrioritySequence.mockResolvedValue([{ name: VendorName.TRADENT, value: "tradentDetails" }]);
    mockGetCronSettingsDetailsById.mockResolvedValue(mockCronSetting as any);
    mockGetAsync.mockResolvedValue(mockNet32Response);
    mockRepriceProductV2Wrapper.mockResolvedValue(undefined);
    mockRepriceWrapper.mockResolvedValue({
      prod: mockProduct,
      cronLogs: { message: "Repriced successfully" },
      skipNextVendor: false,
    } as any);
    mockPushLogsAsync.mockResolvedValue("log-id-123");
    mockProceedNext.mockReturnValue(true);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("manualRepriceHandler", () => {
    it("should return BAD_REQUEST when product is not found", async () => {
      mockGetItemListById.mockResolvedValue(undefined);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockGetItemListById).toHaveBeenCalledWith("123");
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith("No product found");
      expect(mockGetContextCronId).not.toHaveBeenCalled();
    });

    it("should successfully execute V2_ONLY mode", async () => {
      const v2Product = { ...mockProduct, algo_execution_mode: AlgoExecutionMode.V2_ONLY };
      mockGetItemListById.mockResolvedValue(v2Product);
      mockSetSkipReprice.mockImplementation((products) => products as any);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockGetItemListById).toHaveBeenCalledWith("123");
      expect(mockGetContextCronId).toHaveBeenCalledWith(v2Product);
      expect(mockGetCronSettingsDetailsById).toHaveBeenCalledWith("cron-1");
      expect(mockGetEligibleContextErrorItems).toHaveBeenCalledWith(true, "123", null);
      expect(mockGetPrioritySequence).toHaveBeenCalledWith(v2Product, [], true, false, null);
      expect(mockGetAsync).toHaveBeenCalled();
      expect(mockRepriceProductV2Wrapper).toHaveBeenCalledWith(mockNet32Response.data, v2Product, "MANUAL", false, "cron-1");
      expect(mockRepriceWrapper).not.toHaveBeenCalled();
      expect(mockPushLogsAsync).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockJson).toHaveBeenCalledWith({ success: true, logId: "log-id-123" });
    });

    it("should successfully execute V1_ONLY mode", async () => {
      const v1Product = { ...mockProduct, algo_execution_mode: AlgoExecutionMode.V1_ONLY };
      mockGetItemListById.mockResolvedValue(v1Product);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockRepriceProductV2Wrapper).not.toHaveBeenCalled();
      expect(mockRepriceWrapper).toHaveBeenCalled();
      expect(mockPushLogsAsync).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it("should successfully execute V2_EXECUTE_V1_DRY mode", async () => {
      const mixedProduct = { ...mockProduct, algo_execution_mode: AlgoExecutionMode.V2_EXECUTE_V1_DRY };
      mockGetItemListById.mockResolvedValue(mixedProduct);
      mockSetSkipReprice.mockImplementation((products) => products as any);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockRepriceProductV2Wrapper).toHaveBeenCalled();
      expect(mockRepriceWrapper).toHaveBeenCalled();
      expect(mockPushLogsAsync).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it("should successfully execute V1_EXECUTE_V2_DRY mode", async () => {
      const mixedProduct = { ...mockProduct, algo_execution_mode: AlgoExecutionMode.V1_EXECUTE_V2_DRY };
      mockGetItemListById.mockResolvedValue(mixedProduct);
      mockSetSkipReprice.mockImplementation((products) => products as any);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockRepriceProductV2Wrapper).toHaveBeenCalled();
      expect(mockRepriceWrapper).toHaveBeenCalled();
      expect(mockPushLogsAsync).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it("should handle empty priority sequence", async () => {
      mockGetPrioritySequence.mockResolvedValue([]);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockGetAsync).not.toHaveBeenCalled();
      expect(mockRepriceProductV2Wrapper).not.toHaveBeenCalled();
      expect(mockRepriceWrapper).not.toHaveBeenCalled();
      expect(mockPushLogsAsync).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it("should handle multiple vendors in priority sequence", async () => {
      const multiVendorProduct = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails!,
          activated: true,
          skipReprice: false,
        },
        frontierDetails: {
          activated: true,
          scrapeOn: true,
          skipReprice: false,
          cronId: "cron-2",
          slowCronId: "slow-cron-2",
          executionPriority: 2,
        } as any,
      };
      mockGetItemListById.mockResolvedValue(multiVendorProduct);
      mockSetSkipReprice.mockImplementation((products) => {
        return products.map((p) => ({
          ...p,
          tradentDetails: p.tradentDetails ? { ...p.tradentDetails, skipReprice: false } : p.tradentDetails,
          frontierDetails: p.frontierDetails ? { ...p.frontierDetails, skipReprice: false } : p.frontierDetails,
        })) as any;
      });
      mockGetPrioritySequence.mockResolvedValue([
        { name: VendorName.TRADENT, value: "tradentDetails" },
        { name: VendorName.FRONTIER, value: "frontierDetails" },
      ]);
      mockProceedNext.mockReturnValue(true);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockRepriceWrapper).toHaveBeenCalledTimes(2);
    });

    it("should skip vendor when proceedNext returns false", async () => {
      mockProceedNext.mockReturnValue(false);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockProceedNext).toHaveBeenCalledWith(mockProduct, "tradentDetails");
      expect(mockRepriceWrapper).not.toHaveBeenCalled();
    });

    it("should skip vendor when isVendorActivated is false", async () => {
      const inactiveProduct = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails!,
          activated: false,
          skipReprice: false,
        },
      };
      mockGetItemListById.mockResolvedValue(inactiveProduct);
      mockSetSkipReprice.mockImplementation((products) => products as any);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockRepriceWrapper).not.toHaveBeenCalled();
    });

    it("should break loop when skipNextVendor is true", async () => {
      mockRepriceWrapper.mockResolvedValue({
        prod: mockProduct,
        cronLogs: { message: "Repriced successfully" },
        skipNextVendor: true,
      } as any);
      mockGetPrioritySequence.mockResolvedValue([
        { name: VendorName.TRADENT, value: "tradentDetails" },
        { name: VendorName.FRONTIER, value: "frontierDetails" },
      ]);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockRepriceWrapper).toHaveBeenCalledTimes(1);
    });

    it("should handle slow cron run", async () => {
      const slowProduct = {
        ...mockProduct,
        isSlowActivated: true,
        algo_execution_mode: AlgoExecutionMode.V2_EXECUTE_V1_DRY,
        tradentDetails: {
          ...mockProduct.tradentDetails!,
          slowCronId: "slow-cron-1",
          skipReprice: false,
        },
      };
      mockGetItemListById.mockResolvedValue(slowProduct);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockGetAsync).toHaveBeenCalledWith("https://api.example.com/search/123", "slow-cron-1", "123", "SEQ : TRADENT");
      expect(mockRepriceProductV2Wrapper).toHaveBeenCalled();
      expect(mockRepriceWrapper).toHaveBeenCalled();
    });

    it("should use regular cronId when isSlowCronRun is false", async () => {
      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockGetAsync).toHaveBeenCalledWith("https://api.example.com/search/123", expect.any(String), "123", "SEQ : TRADENT");
      // Verify it uses cronId from tradentDetails
      const getAsyncCall = mockGetAsync.mock.calls[0];
      expect(getAsyncCall[1]).toBe("cron-1");
    });

    it("should handle repriceWrapper returning undefined", async () => {
      // Need to ensure prioritySequence is not empty and proceedNext returns true
      mockGetPrioritySequence.mockResolvedValue([{ name: VendorName.TRADENT, value: "tradentDetails" }]);
      mockProceedNext.mockReturnValue(true);
      mockRepriceWrapper.mockResolvedValue(undefined as any);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockRepriceWrapper).toHaveBeenCalled();
      expect(mockPushLogsAsync).toHaveBeenCalled();
      const cronLogsCall = mockPushLogsAsync.mock.calls[0][0];
      expect(cronLogsCall.logs).toEqual([]);
    });

    it("should accumulate logs from multiple repriceWrapper calls", async () => {
      const multiVendorProduct = {
        ...mockProduct,
        tradentDetails: { ...mockProduct.tradentDetails!, activated: true, skipReprice: false },
        frontierDetails: {
          activated: true,
          scrapeOn: true,
          skipReprice: false,
          cronId: "cron-2",
          slowCronId: "slow-cron-2",
          executionPriority: 2,
        } as any,
      };
      mockGetItemListById.mockResolvedValue(multiVendorProduct);
      mockSetSkipReprice.mockImplementation((products) => {
        return products.map((p) => ({
          ...p,
          tradentDetails: p.tradentDetails ? { ...p.tradentDetails, skipReprice: false } : p.tradentDetails,
          frontierDetails: p.frontierDetails ? { ...p.frontierDetails, skipReprice: false } : p.frontierDetails,
        })) as any;
      });
      mockGetPrioritySequence.mockResolvedValue([
        { name: VendorName.TRADENT, value: "tradentDetails" },
        { name: VendorName.FRONTIER, value: "frontierDetails" },
      ]);
      mockProceedNext.mockReturnValue(true);
      mockRepriceWrapper
        .mockResolvedValueOnce({
          prod: multiVendorProduct,
          cronLogs: { message: "First vendor" },
          skipNextVendor: false,
        } as any)
        .mockResolvedValueOnce({
          prod: multiVendorProduct,
          cronLogs: { message: "Second vendor" },
          skipNextVendor: false,
        } as any);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockPushLogsAsync).toHaveBeenCalled();
      const cronLogsCall = mockPushLogsAsync.mock.calls[0][0];
      expect(cronLogsCall.logs).toHaveLength(2);
      expect(cronLogsCall.logs[0]).toEqual({ message: "First vendor" });
      expect(cronLogsCall.logs[1]).toEqual({ message: "Second vendor" });
    });

    it("should log success message when logInDb is returned", async () => {
      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Successfully logged Cron Logs in DB"));
    });

    it("should not log success message when logInDb is empty string", async () => {
      mockPushLogsAsync.mockResolvedValue("");

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("Successfully logged Cron Logs in DB"));
    });

    it("should create cronLogs with correct structure", async () => {
      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockPushLogsAsync).toHaveBeenCalled();
      const cronLogsCall = mockPushLogsAsync.mock.calls[0][0];
      expect(cronLogsCall).toHaveProperty("time");
      expect(cronLogsCall).toHaveProperty("keyGen");
      expect(cronLogsCall).toHaveProperty("logs");
      expect(cronLogsCall).toHaveProperty("cronId", "cron-1");
      expect(cronLogsCall).toHaveProperty("type", "Manual");
      expect(cronLogsCall).toHaveProperty("completionTime");
      expect(cronLogsCall.time).toBeInstanceOf(Date);
      expect(cronLogsCall.completionTime).toBeInstanceOf(Date);
      expect(Array.isArray(cronLogsCall.logs)).toBe(true);
    });

    it("should handle error in GetItemListById", async () => {
      const error = new Error("Database error");
      mockGetItemListById.mockRejectedValue(error);

      await expect(manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response)).rejects.toThrow("Database error");
    });

    it("should handle error in GetCronSettingsDetailsById", async () => {
      const error = new Error("Cron settings error");
      mockGetCronSettingsDetailsById.mockRejectedValue(error);

      await expect(manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response)).rejects.toThrow("Cron settings error");
    });

    it("should handle error in GetEligibleContextErrorItems", async () => {
      const error = new Error("Context error items error");
      mockGetEligibleContextErrorItems.mockRejectedValue(error);

      await expect(manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response)).rejects.toThrow("Context error items error");
    });

    it("should handle error in GetPrioritySequence", async () => {
      const error = new Error("Priority sequence error");
      mockGetPrioritySequence.mockRejectedValue(error);

      await expect(manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response)).rejects.toThrow("Priority sequence error");
    });

    it("should handle error in getAsync", async () => {
      const error = new Error("Axios error");
      mockGetAsync.mockRejectedValue(error);

      await expect(manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response)).rejects.toThrow("Axios error");
    });

    it("should handle error in repriceProductV2Wrapper", async () => {
      const v2Product = { ...mockProduct, algo_execution_mode: AlgoExecutionMode.V2_ONLY };
      mockGetItemListById.mockResolvedValue(v2Product);
      mockSetSkipReprice.mockImplementation((products) => products as any);
      const error = new Error("V2 wrapper error");
      mockRepriceProductV2Wrapper.mockRejectedValue(error);

      await expect(manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response)).rejects.toThrow("V2 wrapper error");
    });

    it("should handle error in repriceWrapper", async () => {
      // Ensure we have a priority sequence so repriceWrapper gets called
      mockGetPrioritySequence.mockResolvedValue([{ name: VendorName.TRADENT, value: "tradentDetails" }]);
      mockProceedNext.mockReturnValue(true);
      const error = new Error("Reprice wrapper error");
      mockRepriceWrapper.mockRejectedValue(error);

      await expect(manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response)).rejects.toThrow("Reprice wrapper error");
    });

    it("should handle error in PushLogsAsync", async () => {
      const error = new Error("Push logs error");
      mockPushLogsAsync.mockRejectedValue(error);

      await expect(manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response)).rejects.toThrow("Push logs error");
    });

    it("should update product with repriceResponse.prod", async () => {
      const updatedProduct = { ...mockProduct, mpId: 999 };
      mockRepriceWrapper.mockResolvedValue({
        prod: updatedProduct,
        cronLogs: { message: "Updated" },
        skipNextVendor: false,
      } as any);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      // Verify that repriceWrapper was called
      expect(mockRepriceWrapper).toHaveBeenCalled();
      expect(mockPushLogsAsync).toHaveBeenCalled();
    });

    it("should log running manual reprice message", async () => {
      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Running Manual Reprice for 123"));
    });

    it("should handle product with multiple algo execution modes", async () => {
      const testCases = [AlgoExecutionMode.V2_ONLY, AlgoExecutionMode.V1_ONLY, AlgoExecutionMode.V2_EXECUTE_V1_DRY, AlgoExecutionMode.V1_EXECUTE_V2_DRY];

      for (const mode of testCases) {
        jest.clearAllMocks();
        const product = { ...mockProduct, algo_execution_mode: mode };
        mockGetItemListById.mockResolvedValue(product);
        mockSetSkipReprice.mockImplementation((products) => products as any);

        await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
        expect(mockJson).toHaveBeenCalledWith({ success: true, logId: "log-id-123" });
      }
    });

    it("should handle contextErrorDetails with items", async () => {
      const contextErrorDetails = [
        {
          mpId: "123",
          vendorName: "TRADENT",
          active: true,
        },
      ];
      mockGetEligibleContextErrorItems.mockResolvedValue(contextErrorDetails as any);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockGetPrioritySequence).toHaveBeenCalledWith(expect.any(Object), contextErrorDetails, true, false, null);
    });

    it("should handle empty contextErrorDetails", async () => {
      mockGetEligibleContextErrorItems.mockResolvedValue([]);
      const modifiedProduct = { ...mockProduct, tradentDetails: { ...mockProduct.tradentDetails!, skipReprice: false } };
      mockSetSkipReprice.mockImplementation(() => [modifiedProduct] as any);

      await manualRepriceHandler(mockRequest as Request<{ id: string }>, mockResponse as Response);

      expect(mockGetPrioritySequence).toHaveBeenCalledWith(expect.any(Object), [], true, false, null);
    });
  });
});
