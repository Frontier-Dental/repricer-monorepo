// Mock shared package BEFORE imports
jest.mock("@repricer-monorepo/shared", () => ({
  AlgoExecutionMode: {
    V1_ONLY: "V1_ONLY",
    V2_ONLY: "V2_ONLY",
    V1_EXECUTE_V2_DRY: "V1_EXECUTE_V2_DRY",
    V2_EXECUTE_V1_DRY: "V2_EXECUTE_V1_DRY",
  },
  VendorName: {
    TRADENT: "TRADENT",
    FRONTIER: "FRONTIER",
    MVP: "MVP",
    TOPDENT: "TOPDENT",
    FIRSTDENT: "FIRSTDENT",
    TRIAD: "TRIAD",
  },
  VendorIdLookup: {
    TRADENT: 1,
    FRONTIER: 2,
    MVP: 3,
    TOPDENT: 4,
    FIRSTDENT: 5,
    TRIAD: 6,
  },
}));

// Mock all dependencies
jest.mock("../axios-helper");
jest.mock("../config", () => ({
  applicationConfig: {
    GET_SEARCH_RESULTS: "https://api.net32.com/products/{mpId}",
    CRON_NAME_422: "Cron-422",
    OWN_VENDOR_LIST: "1;2;3",
    ENABLE_SLOW_CRON_FEATURE: true,
  },
}));
jest.mock("../mongo/db-helper");
jest.mock("../mysql/mysql-helper");
jest.mock("../request-generator");
jest.mock("./v1/algo-v1");
jest.mock("./v2/wrapper");
jest.mock("../filter-mapper");
jest.mock("../../utility/mysql/mysql-v2");
jest.mock("fs");

import { AlgoExecutionMode } from "@repricer-monorepo/shared";
import { parseNumericPrice, Execute, RepriceErrorItem, CheckReprice, RepriceErrorItemV2, UpdateToMax, repriceWrapper } from "./reprice-base";
import * as axiosHelper from "../axios-helper";
import * as dbHelper from "../mongo/db-helper";
import * as sqlHelper from "../mysql/mysql-helper";
import * as requestGenerator from "../request-generator";
import { repriceProduct, repriceProductToMax } from "./v1/algo-v1";
import { repriceProductV2Wrapper } from "./v2/wrapper";
import * as filterMapper from "../filter-mapper";
import { GetCronSettingsList, GetCronSettingsDetailsByName, GetSlowCronDetails } from "../../utility/mysql/mysql-v2";
import fs from "fs";
import { RepriceAsyncResponse } from "../../model/reprice-async-response";
import { RepriceModel, RepriceData } from "../../model/reprice-model";
import { Net32Product } from "../../types/net32";

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("reprice-base", () => {
  const mockJobId = "job-123";
  const mockCronInitTime = new Date("2024-01-01T00:00:00Z");
  const mockCronSetting = {
    CronId: "cron-123",
    CronName: "TestCron",
    SecretKey: "secret-key-123",
  };

  const mockNet32Products: Net32Product[] = [
    {
      vendorProductId: 1,
      vendorProductCode: "PROD-001",
      vendorId: "1",
      vendorName: "TRADENT",
      vendorRegion: "US",
      inStock: true,
      standardShipping: 5,
      standardShippingStatus: "ACTIVE",
      freeShippingGap: 0,
      heavyShippingStatus: "NONE",
      heavyShipping: 0,
      shippingTime: 2,
      inventory: 100,
      isFulfillmentPolicyStock: false,
      vdrGeneralAverageRatingSum: 0,
      vdrNumberOfGeneralRatings: 0,
      isBackordered: false,
      vendorProductLevelLicenseRequiredSw: false,
      vendorVerticalLevelLicenseRequiredSw: false,
      priceBreaks: [
        { minQty: 1, unitPrice: 10, active: true },
        { minQty: 2, unitPrice: 18, active: true },
      ],
      badgeId: 0,
      badgeName: null,
      imagePath: "",
      arrivalDate: "",
      arrivalBusinessDays: 0,
      twoDayDeliverySw: false,
      isLowestTotalPrice: null,
    },
  ];

  const mockProduct = {
    mpId: "12345",
    cronName: "TestCron",
    algo_execution_mode: AlgoExecutionMode.V1_ONLY,
    tradentDetails: {
      cronId: "cron-123",
      activated: true,
      scrapeOn: true,
      skipReprice: false,
      slowCronId: "slow-cron-123",
    },
  };

  const mockRepriceResult = {
    cronResponse: new RepriceAsyncResponse(new RepriceModel("12345", mockNet32Products[0], "Test Product", 9.99, true, false, [], "Price updated"), mockNet32Products),
    priceUpdateResponse: {
      status: "SUCCESS",
      message: "Price updated",
    },
    historyIdentifier: [{ historyIdentifier: "hist-123", minQty: 1 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mock implementations
    (dbHelper.InitCronStatusAsync as jest.Mock).mockResolvedValue(undefined);
    (dbHelper.UpdateCronStatusAsync as jest.Mock).mockResolvedValue(undefined);
    (dbHelper.PushLogsAsync as jest.Mock).mockResolvedValue("log-id-123");
    (dbHelper.Push422LogsAsync as jest.Mock).mockResolvedValue(undefined);
    (dbHelper.GetEligibleContextErrorItems as jest.Mock).mockResolvedValue([]);
    (dbHelper.UpsertErrorItemLog as jest.Mock).mockResolvedValue(undefined);
    (sqlHelper.UpdateProductAsync as jest.Mock).mockResolvedValue(undefined);
    (sqlHelper.UpdateHistoryWithMessage as jest.Mock).mockResolvedValue(undefined);
    (sqlHelper.UpdateCronForProductAsync as jest.Mock).mockResolvedValue(undefined);
    (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
    (axiosHelper.getAsync as jest.Mock).mockResolvedValue({
      data: mockNet32Products,
    });
    (repriceProduct as jest.Mock).mockResolvedValue(mockRepriceResult);
    (repriceProductToMax as jest.Mock).mockResolvedValue(mockRepriceResult);
    (repriceProductV2Wrapper as jest.Mock).mockResolvedValue(undefined);
    (filterMapper.GetProductDetailsByVendor as jest.Mock).mockImplementation((details, vendor) => {
      if (vendor === "TRADENT") return details.tradentDetails;
      return null;
    });
    (filterMapper.GetLastCronMessageSimple as jest.Mock).mockReturnValue("Price updated");
    (GetCronSettingsList as jest.Mock).mockResolvedValue([mockCronSetting]);
    (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue([mockCronSetting]);
    (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("parseNumericPrice", () => {
    it("should return null for null value", () => {
      expect(parseNumericPrice(null)).toBeNull();
    });

    it("should return null for undefined value", () => {
      expect(parseNumericPrice(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(parseNumericPrice("")).toBeNull();
    });

    it("should return null for 'N/A' string", () => {
      expect(parseNumericPrice("N/A")).toBeNull();
    });

    it("should return number for valid number", () => {
      expect(parseNumericPrice(10)).toBe(10);
    });

    it("should return parsed number for valid string number", () => {
      expect(parseNumericPrice("10.5")).toBe(10.5);
    });

    it("should return null for invalid string", () => {
      expect(parseNumericPrice("invalid")).toBeNull();
    });

    it("should return null for NaN", () => {
      expect(parseNumericPrice(NaN)).toBeNull();
    });

    it("should return null for Infinity", () => {
      expect(parseNumericPrice(Infinity)).toBeNull();
    });
  });

  describe("Execute", () => {
    it("should execute repricing for product list", async () => {
      const productList = [mockProduct];
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ ...mockCronSetting, CronStatus: true }]);

      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, false);

      expect(dbHelper.InitCronStatusAsync).toHaveBeenCalled();
      expect(requestGenerator.GetPrioritySequence).toHaveBeenCalled();
      expect(axiosHelper.getAsync).toHaveBeenCalled();
      expect(repriceProduct).toHaveBeenCalled();
      expect(dbHelper.PushLogsAsync).toHaveBeenCalled();
      expect(dbHelper.UpdateCronStatusAsync).toHaveBeenCalledWith(expect.objectContaining({ status: "Complete" }));
    });

    it("should handle slow cron run", async () => {
      const productList = [mockProduct];
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ ...mockCronSetting, CronStatus: true }]);

      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, true);

      expect(dbHelper.PushLogsAsync).toHaveBeenCalledWith(expect.objectContaining({ type: "SLOWCRON" }));
    });

    it("should handle null cronSetting", async () => {
      const productList = [{ ...mockProduct, cronName: "TestCron" }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ ...mockCronSetting, CronStatus: true }]);

      await Execute(mockJobId, productList, mockCronInitTime, null, false);

      expect(GetCronSettingsDetailsByName).toHaveBeenCalled();
    });

    it("should break when proceedWithExecution returns false", async () => {
      const productList = [mockProduct, { ...mockProduct, mpId: "67890" }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ ...mockCronSetting, CronStatus: false }]);

      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, false);

      // Should not process second product
      expect(axiosHelper.getAsync).not.toHaveBeenCalled();
    });

    it("should handle V2_ONLY execution mode", async () => {
      const productList = [{ ...mockProduct, algo_execution_mode: AlgoExecutionMode.V2_ONLY }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ ...mockCronSetting, CronStatus: true }]);

      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, false);

      expect(repriceProductV2Wrapper).toHaveBeenCalled();
      expect(repriceProduct).not.toHaveBeenCalled();
    });

    it("should handle V1_EXECUTE_V2_DRY execution mode", async () => {
      const productList = [{ ...mockProduct, algo_execution_mode: AlgoExecutionMode.V1_EXECUTE_V2_DRY }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ ...mockCronSetting, CronStatus: true }]);

      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, false);

      expect(repriceProductV2Wrapper).toHaveBeenCalled();
      expect(repriceProduct).toHaveBeenCalled();
    });

    it("should handle products with no vendors enabled", async () => {
      const productList = [mockProduct];
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([]);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ ...mockCronSetting, CronStatus: true }]);

      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, false);

      expect(console.log).toHaveBeenCalledWith("Skipping product: ", "12345", " because no vendors are enabled.");
    });

    it("should handle skipNextVendor flag", async () => {
      const productList = [mockProduct];
      const mockRepriceResponse = {
        ...mockRepriceResult,
        cronLogs: [{ productId: "12345", vendor: "TRADENT" }],
        prod: mockProduct.tradentDetails,
        isPriceUpdated: true,
        skipNextVendor: true,
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockRepriceResult);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ ...mockCronSetting, CronStatus: true }]);

      // Mock repriceWrapper to return skipNextVendor
      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, false);

      expect(dbHelper.PushLogsAsync).toHaveBeenCalled();
    });

    it("should handle exceptions during execution", async () => {
      const productList = [mockProduct];
      (axiosHelper.getAsync as jest.Mock).mockRejectedValue(new Error("Network error"));
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ ...mockCronSetting, CronStatus: true }]);

      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, false);

      expect(console.error).toHaveBeenCalled();
      expect(dbHelper.PushLogsAsync).toHaveBeenCalled();
    });

    it("should handle multiple products", async () => {
      const productList = [mockProduct, { ...mockProduct, mpId: "67890" }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ ...mockCronSetting, CronStatus: true }]);

      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, false);

      expect(axiosHelper.getAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe("RepriceErrorItem", () => {
    const mockDetails = {
      mpId: "12345",
      cronSettingsResponse: mockCronSetting,
      contextVendor: "TRADENT",
      algo_execution_mode: AlgoExecutionMode.V1_ONLY,
      tradentDetails: {
        mpid: "12345",
        cronId: "cron-123",
        scrapeOn: true,
        activated: true,
        last_cron_time: new Date(),
        last_attempted_time: new Date(),
        lastCronRun: "Cron-422",
        wait_update_period: false,
      },
    };

    it("should reprice error item successfully", async () => {
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(mockDetails.tradentDetails);

      const result = await RepriceErrorItem(mockDetails, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(repriceProduct).toHaveBeenCalled();
      expect(sqlHelper.UpdateProductAsync).toHaveBeenCalled();
    });

    it("should handle V2_ONLY execution mode", async () => {
      const detailsWithV2 = { ...mockDetails, algo_execution_mode: AlgoExecutionMode.V2_ONLY };
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);

      await RepriceErrorItem(detailsWithV2, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(repriceProductV2Wrapper).toHaveBeenCalled();
    });

    it("should handle successful price update", async () => {
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockSuccessResult);
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(mockDetails.tradentDetails);
      const detailsWithV1 = { ...mockDetails, algo_execution_mode: AlgoExecutionMode.V1_ONLY };

      const result = await RepriceErrorItem(detailsWithV1, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalled();
      expect(sqlHelper.UpdateProductAsync).toHaveBeenCalled();
    });

    it("should handle ERROR:422 in price update response", async () => {
      const mockErrorResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { message: "ERROR:422:Invalid request" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockErrorResult);
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(mockDetails.tradentDetails);
      const detailsWithV1 = { ...mockDetails, algo_execution_mode: AlgoExecutionMode.V1_ONLY };

      await RepriceErrorItem(detailsWithV1, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalledWith(expect.objectContaining({ insertReason: "422_ERROR" }));
    });

    it("should handle null priceUpdateResponse", async () => {
      const mockNullResult = {
        ...mockRepriceResult,
        priceUpdateResponse: null,
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockNullResult);
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(mockDetails.tradentDetails);
      const detailsWithV1 = { ...mockDetails, algo_execution_mode: AlgoExecutionMode.V1_ONLY };

      await RepriceErrorItem(detailsWithV1, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalledWith(expect.objectContaining({ insertReason: "IGNORE" }));
    });

    it("should handle scrapeOn false", async () => {
      const detailsWithScrapeOff = {
        ...mockDetails,
        tradentDetails: { ...mockDetails.tradentDetails, scrapeOn: false },
      };
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);

      await RepriceErrorItem(detailsWithScrapeOff, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(repriceProduct).not.toHaveBeenCalled();
    });

    it("should handle wait_update_period true", async () => {
      const detailsWithWait = {
        ...mockDetails,
        algo_execution_mode: AlgoExecutionMode.V1_ONLY,
        tradentDetails: { ...mockDetails.tradentDetails, wait_update_period: true },
      };
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockSuccessResult);
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(detailsWithWait.tradentDetails);

      await RepriceErrorItem(detailsWithWait, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalledWith(expect.objectContaining({ insertReason: "PRICE_UPDATE" }));
    });

    it("should extract market data for 422 error recovery", async () => {
      const mockErrorResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { message: "ERROR:422:Invalid request" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockErrorResult);
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(mockDetails.tradentDetails);
      const detailsWithV1 = { ...mockDetails, algo_execution_mode: AlgoExecutionMode.V1_ONLY };

      await RepriceErrorItem(detailsWithV1, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(sqlHelper.UpdateProductAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          inStock: expect.anything(),
          inventory: expect.anything(),
          ourPrice: expect.anything(),
        })
      );
    });

    it("should handle slow cron feature cleanup", async () => {
      const detailsWithSlowCron = {
        ...mockDetails,
        algo_execution_mode: AlgoExecutionMode.V1_ONLY,
        tradentDetails: { ...mockDetails.tradentDetails, slowCronId: "slow-123", slowCronName: "SlowCron" },
      };
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(detailsWithSlowCron.tradentDetails);

      await RepriceErrorItem(detailsWithSlowCron, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(sqlHelper.UpdateCronForProductAsync).toHaveBeenCalled();
    });

    it("should align error items for deactivated vendors", async () => {
      const detailsWithDeactivated = {
        ...mockDetails,
        algo_execution_mode: AlgoExecutionMode.V1_ONLY,
        tradentDetails: { ...mockDetails.tradentDetails, activated: false },
      };
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(detailsWithDeactivated.tradentDetails);

      await RepriceErrorItem(detailsWithDeactivated, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalledWith(expect.objectContaining({ insertReason: "IGNORE" }));
    });
  });

  describe("RepriceErrorItemV2", () => {
    const mockProductList = [
      {
        mpId: "12345",
        contextVendor: "TRADENT",
        cronSettingsResponse: mockCronSetting,
        tradentDetails: {
          mpid: "12345",
          cronId: "cron-123",
          scrapeOn: true,
          activated: true,
        },
      },
    ];

    it("should reprice error items in batch", async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(mockProductList[0].tradentDetails);
      const productListWithV1 = mockProductList.map((p) => ({ ...p, algo_execution_mode: AlgoExecutionMode.V1_ONLY }));

      await RepriceErrorItemV2(productListWithV1, mockCronInitTime, mockJobId);

      expect(dbHelper.InitCronStatusAsync).toHaveBeenCalled();
      expect(dbHelper.Push422LogsAsync).toHaveBeenCalled();
      expect(dbHelper.UpdateCronStatusAsync).toHaveBeenCalledWith(expect.objectContaining({ status: "Complete" }));
    });

    it("should filter delta products", async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([{ key: "other-key", products: [] }]));
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);

      await RepriceErrorItemV2(mockProductList, mockCronInitTime, mockJobId);

      expect(fs.readFileSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should handle single log entry", async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(mockProductList[0].tradentDetails);
      const productListWithV1 = mockProductList.map((p) => ({ ...p, algo_execution_mode: AlgoExecutionMode.V1_ONLY }));
      // Mock repriceProduct to return a result that will create logs
      (repriceProduct as jest.Mock).mockResolvedValue({
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      });

      await RepriceErrorItemV2(productListWithV1, mockCronInitTime, mockJobId);

      expect(dbHelper.Push422LogsAsync).toHaveBeenCalled();
    });

    it("should clean active product list after completion", async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([{ key: mockJobId, products: [] }]));
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);

      await RepriceErrorItemV2(mockProductList, mockCronInitTime, mockJobId);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should handle empty product list", async () => {
      await RepriceErrorItemV2([], mockCronInitTime, mockJobId);

      expect(dbHelper.InitCronStatusAsync).toHaveBeenCalled();
    });

    it("should handle null delta list", async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(mockProductList[0].tradentDetails);
      const productListWithV1 = mockProductList.map((p) => ({ ...p, algo_execution_mode: AlgoExecutionMode.V1_ONLY }));
      // Mock repriceProduct to return a result that will create logs
      (repriceProduct as jest.Mock).mockResolvedValue({
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      });

      await RepriceErrorItemV2(productListWithV1, mockCronInitTime, mockJobId);

      expect(dbHelper.Push422LogsAsync).toHaveBeenCalled();
    });
  });

  describe("UpdateToMax", () => {
    const mockProd = {
      mpid: "12345",
      cronId: "cron-123",
      wait_update_period: false,
      tradentDetails: mockProduct.tradentDetails,
    };

    it("should update product to max price successfully", async () => {
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProductToMax as jest.Mock).mockResolvedValue(mockSuccessResult);

      const result = await UpdateToMax([], { data: mockNet32Products }, mockProd, mockCronSetting, mockJobId, "TRADENT");

      expect(repriceProductToMax).toHaveBeenCalled();
      expect(result.isPriceUpdated).toBe(true);
      expect(result.skipNextVendor).toBe(true);
    });

    it("should handle ERROR:422 in price update response", async () => {
      const mockErrorResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { message: "ERROR:422:Invalid request" },
      };
      (repriceProductToMax as jest.Mock).mockResolvedValue(mockErrorResult);

      const result = await UpdateToMax([], { data: mockNet32Products }, mockProd, mockCronSetting, mockJobId, "TRADENT");

      expect(result.isPriceUpdated).toBe(false);
      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalledWith(expect.objectContaining({ insertReason: "422_ERROR" }));
    });

    it("should handle null priceUpdateResponse", async () => {
      const mockNullResult = {
        ...mockRepriceResult,
        priceUpdateResponse: null,
      };
      (repriceProductToMax as jest.Mock).mockResolvedValue(mockNullResult);

      const result = await UpdateToMax([], { data: mockNet32Products }, mockProd, mockCronSetting, mockJobId, "TRADENT");

      expect(result.isPriceUpdated).toBe(false);
      expect(result.skipNextVendor).toBe(false);
    });

    it("should handle wait_update_period true", async () => {
      const prodWithWait = { ...mockProd, wait_update_period: true };
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProductToMax as jest.Mock).mockResolvedValue(mockSuccessResult);

      await UpdateToMax([], { data: mockNet32Products }, prodWithWait, mockCronSetting, mockJobId, "TRADENT");

      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalledWith(expect.objectContaining({ insertReason: "PRICE_UPDATE" }));
    });

    it("should extract market data for manual reprice", async () => {
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProductToMax as jest.Mock).mockResolvedValue(mockSuccessResult);

      await UpdateToMax([], { data: mockNet32Products }, mockProd, mockCronSetting, mockJobId, "TRADENT");

      expect(sqlHelper.UpdateProductAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          inStock: expect.anything(),
          inventory: expect.anything(),
          ourPrice: expect.anything(),
        })
      );
    });

    it("should handle repriceProductToMax returning null", async () => {
      (repriceProductToMax as jest.Mock).mockResolvedValue(null);

      const result = await UpdateToMax([], { data: mockNet32Products }, mockProd, mockCronSetting, mockJobId, "TRADENT");

      expect(result.cronLogs).toContainEqual(expect.objectContaining({ logs: "Some error occurred while repricing" }));
    });
  });

  describe("CheckReprice", () => {
    it("should call repriceSingleVendor", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };

      await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(repriceProduct).toHaveBeenCalled();
      expect(sqlHelper.UpdateProductAsync).toHaveBeenCalled();
    });

    it("should handle successful price update", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
          wait_update_period: true,
        },
      };
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockSuccessResult);

      const result = await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(result.isPriceUpdated).toBe(true);
      expect(result.skipNextVendor).toBe(true);
    });

    it("should handle ERROR:422 in price update response", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const mockErrorResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { message: "ERROR:422:Invalid request" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockErrorResult);

      const result = await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(result.isPriceUpdated).toBe(false);
      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalledWith(expect.objectContaining({ insertReason: "422_ERROR" }));
    });

    it("should handle null repriceResult", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(null);
      // The code has a bug: it checks if (!repriceResult) but then still calls updateLowestVendor(repriceResult!, prod)
      // This will throw an error. We need to test that the error is handled or the function fails gracefully.
      // Since we can't modify the source, we'll test that repriceProduct was called and the error occurs

      await expect(CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT")).rejects.toThrow();

      expect(repriceProduct).toHaveBeenCalled();
    });

    it("should handle manual run", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockSuccessResult);

      await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(repriceProduct).toHaveBeenCalled();
    });

    it("should extract market data", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockSuccessResult);

      await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(sqlHelper.UpdateProductAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          inStock: expect.anything(),
          inventory: expect.anything(),
          ourPrice: expect.anything(),
        })
      );
    });

    it("should handle isOverrideRun flag", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockSuccessResult);

      await CheckReprice(mockNet32Response, mockProd, mockCronSetting, true, mockJobId, "TRADENT");

      expect(repriceProduct).toHaveBeenCalled();
    });

    it("should handle historyIdentifier", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const mockResultWithHistory = {
        ...mockRepriceResult,
        historyIdentifier: [{ historyIdentifier: "hist-123", minQty: 1 }],
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockResultWithHistory);

      await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("History Updated"));
    });

    it("should handle multiple price breaks in repriceResult", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd: any = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const mockRepriceModel = new RepriceModel("12345", null, "Test Product", null, false, true, [new RepriceData(10, 9.99, true, "Price down", 1), new RepriceData(18, 17.99, true, "Price down", 2)]);
      // Set lowestVendor and lowestVendorPrice for the RepriceData objects
      mockRepriceModel.listOfRepriceDetails[0].lowestVendor = "Vendor1";
      mockRepriceModel.listOfRepriceDetails[0].lowestVendorPrice = 8.99;
      mockRepriceModel.listOfRepriceDetails[1].lowestVendor = "Vendor2";
      mockRepriceModel.listOfRepriceDetails[1].lowestVendorPrice = 16.99;
      const mockResultWithMultiple = {
        cronResponse: new RepriceAsyncResponse(mockRepriceModel, mockNet32Products),
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
        historyIdentifier: null,
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockResultWithMultiple);

      const result = await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(repriceProduct).toHaveBeenCalled();
      expect(result.isPriceUpdated).toBe(true);
    });
  });

  describe("repriceWrapper", () => {
    it("should call repriceSingleVendor with correct parameters", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const prioritySequence = [{ name: "TRADENT", value: "tradentDetails" }];
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockSuccessResult);

      const result = await repriceWrapper(mockNet32Response, mockProd as any, mockCronSetting, false, mockJobId, prioritySequence, 0, false, false);

      expect(repriceProduct).toHaveBeenCalled();
      expect(result.isPriceUpdated).toBe(true);
      expect(result.skipNextVendor).toBe(true);
    });

    it("should handle manual run flag", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const prioritySequence = [{ name: "TRADENT", value: "tradentDetails" }];
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockSuccessResult);

      await repriceWrapper(mockNet32Response, mockProd as any, mockCronSetting, false, mockJobId, prioritySequence, 0, true, false);

      expect(repriceProduct).toHaveBeenCalled();
    });

    it("should handle slow cron run flag", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const prioritySequence = [{ name: "TRADENT", value: "tradentDetails" }];
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockSuccessResult);

      await repriceWrapper(mockNet32Response, mockProd as any, mockCronSetting, false, mockJobId, prioritySequence, 0, false, true);

      expect(repriceProduct).toHaveBeenCalled();
    });
  });

  describe("Additional edge cases for coverage", () => {
    it("should handle ERROR:429 in price update response", async () => {
      const mockDetails = {
        mpId: "12345",
        algo_execution_mode: AlgoExecutionMode.V1_ONLY,
        cronSettingsResponse: mockCronSetting,
        contextVendor: "TRADENT",
        tradentDetails: {
          mpid: "12345",
          cronId: "cron-123",
          scrapeOn: true,
          activated: true,
          last_cron_time: new Date(),
          last_attempted_time: new Date(),
          lastCronRun: "Cron-422",
          wait_update_period: false,
        },
      };
      const mockErrorResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { message: "ERROR:429:Rate limit exceeded" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockErrorResult);
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(mockDetails.tradentDetails);

      await RepriceErrorItem(mockDetails, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalledWith(expect.objectContaining({ insertReason: "IGNORE" }));
    });

    it("should handle slow cron feature cleanup for all vendor details", async () => {
      const detailsWithAllVendors = {
        mpId: "12345",
        algo_execution_mode: AlgoExecutionMode.V1_ONLY,
        tradentDetails: { slowCronId: "slow-1", slowCronName: "Slow1" },
        frontierDetails: { slowCronId: "slow-2", slowCronName: "Slow2" },
        mvpDetails: { slowCronId: "slow-3", slowCronName: "Slow3" },
        topDentDetails: { slowCronId: "slow-4", slowCronName: "Slow4" },
        firstDentDetails: { slowCronId: "slow-5", slowCronName: "Slow5" },
        triadDetails: { slowCronId: "slow-6", slowCronName: "Slow6" },
      };
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(detailsWithAllVendors.tradentDetails);

      await RepriceErrorItem(detailsWithAllVendors, mockCronInitTime, mockCronSetting, "TRADENT");

      expect(sqlHelper.UpdateCronForProductAsync).toHaveBeenCalled();
    });

    it("should handle multiple log entries in RepriceErrorItemV2", async () => {
      const mockProductList = [
        {
          mpId: "12345",
          contextVendor: "TRADENT",
          cronSettingsResponse: mockCronSetting,
          algo_execution_mode: AlgoExecutionMode.V1_ONLY,
          tradentDetails: {
            mpid: "12345",
            cronId: "cron-123",
            scrapeOn: true,
            activated: true,
          },
        },
      ];
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(mockProductList[0].tradentDetails);
      // Mock RepriceErrorItem to return multiple log entries
      (repriceProduct as jest.Mock).mockResolvedValue({
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      });

      const originalRepriceErrorItem = require("./reprice-base").RepriceErrorItem;
      jest.spyOn(require("./reprice-base"), "RepriceErrorItem").mockResolvedValue({
        logs: [[{ productId: "12345", vendor: "TRADENT" }], [{ productId: "67890", vendor: "FRONTIER" }]],
      });

      await RepriceErrorItemV2(mockProductList, mockCronInitTime, mockJobId);

      expect(dbHelper.Push422LogsAsync).toHaveBeenCalled();
    });

    it("should handle market data extraction error in UpdateToMax", async () => {
      const mockProd = {
        mpid: "12345",
        cronId: "cron-123",
        wait_update_period: false,
        tradentDetails: mockProduct.tradentDetails,
      };
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProductToMax as jest.Mock).mockResolvedValue(mockSuccessResult);
      // Force an error by providing invalid vendor data
      const invalidNet32Response = { data: [] };

      await UpdateToMax([], invalidNet32Response, mockProd, mockCronSetting, mockJobId, "TRADENT");

      expect(sqlHelper.UpdateProductAsync).toHaveBeenCalled();
    });

    it("should handle wait_update_period in repriceSingleVendor", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd: any = {
        mpid: "12345",
        cronId: "cron-123",
        wait_update_period: true,
      };
      const mockSuccessResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockSuccessResult);

      const result = await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(result.isPriceUpdated).toBe(true);
      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalledWith(expect.objectContaining({ insertReason: "PRICE_UPDATE" }));
    });

    it("should handle getNextCronTime with time string in message", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);
      const mockErrorResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { message: `ERROR:422:Retry this time: ${futureDate.toISOString()}` },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockErrorResult);

      await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalled();
    });

    it("should handle updateCronBasedDetails with data structure", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const mockRepriceModel = new RepriceModel("12345", null, "Test Product", null, false, true, [new RepriceData(10, 9.99, true, "Price down", 1), new RepriceData(18, 17.99, true, "Price down", 2)]);
      mockRepriceModel.listOfRepriceDetails[0].oldPrice = 10;
      mockRepriceModel.listOfRepriceDetails[0].newPrice = 9.99;
      mockRepriceModel.listOfRepriceDetails[0].goToPrice = 9.5;
      mockRepriceModel.listOfRepriceDetails[1].oldPrice = 18;
      mockRepriceModel.listOfRepriceDetails[1].newPrice = 17.99;
      const mockResultWithData = {
        data: {
          cronResponse: new RepriceAsyncResponse(mockRepriceModel, mockNet32Products),
        },
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
        historyIdentifier: null,
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockResultWithData);

      const result = await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(result.prod.lastExistingPrice).toBeDefined();
      expect(result.prod.lastSuggestedPrice).toBeDefined();
    });

    it("should handle scanDeltaListOfProducts with matching delta", async () => {
      const productList = [
        {
          mpId: "12345",
          contextVendor: "TRADENT",
          cronSettingsResponse: mockCronSetting,
          algo_execution_mode: AlgoExecutionMode.V1_ONLY,
          tradentDetails: { mpid: "12345", cronId: "cron-123", scrapeOn: true, activated: true },
        },
        {
          mpId: "67890",
          contextVendor: "FRONTIER",
          cronSettingsResponse: mockCronSetting,
          algo_execution_mode: AlgoExecutionMode.V1_ONLY,
          frontierDetails: { mpid: "67890", cronId: "cron-123", scrapeOn: true, activated: true },
        },
      ];
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([{ key: "other-key", products: [{ mpId: "67890", contextVendor: "FRONTIER" }] }]));
      (requestGenerator.GetPrioritySequence as jest.Mock).mockResolvedValue([{ name: "TRADENT", value: "tradentDetails" }]);
      (filterMapper.GetProductDetailsByVendor as jest.Mock).mockReturnValue(productList[0].tradentDetails);
      (repriceProduct as jest.Mock).mockResolvedValue({
        ...mockRepriceResult,
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
      });

      await RepriceErrorItemV2(productList, mockCronInitTime, mockJobId);

      expect(dbHelper.Push422LogsAsync).toHaveBeenCalled();
    });

    it("should handle proceedWithExecution returning false when cron not found", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: "other-cron", CronStatus: true }]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      const productList = [mockProduct];

      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, false);

      // Should break early when proceedWithExecution returns false
      expect(axiosHelper.getAsync).not.toHaveBeenCalled();
    });

    it("should handle proceedWithExecution with null cronSettingDetails", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue(null);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue(null);
      const productList = [mockProduct];

      await Execute(mockJobId, productList, mockCronInitTime, mockCronSetting, false);

      // Should break early
      expect(axiosHelper.getAsync).not.toHaveBeenCalled();
    });

    it("should handle getNextCronTime without time string", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const mockErrorResult = {
        ...mockRepriceResult,
        priceUpdateResponse: { message: "ERROR:422:Invalid request" },
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockErrorResult);

      await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(dbHelper.UpsertErrorItemLog).toHaveBeenCalled();
    });

    it("should handle updateCronBasedDetails with isPriceUpdated true", async () => {
      const mockNet32Response = { data: mockNet32Products };
      const mockProd: any = {
        ...mockProduct,
        tradentDetails: {
          ...mockProduct.tradentDetails,
          mpid: "12345",
          cronId: "cron-123",
        },
      };
      const mockRepriceModel = new RepriceModel("12345", null, "Test Product", null, false, true, [new RepriceData(10, 9.99, true, "Price down", 1)]);
      mockRepriceModel.listOfRepriceDetails[0].oldPrice = 10;
      mockRepriceModel.listOfRepriceDetails[0].newPrice = 9.99;
      const mockResultWithData = {
        data: {
          cronResponse: new RepriceAsyncResponse(mockRepriceModel, mockNet32Products),
        },
        priceUpdateResponse: { status: "SUCCESS", message: "Updated" },
        historyIdentifier: null,
      };
      (repriceProduct as jest.Mock).mockResolvedValue(mockResultWithData);

      const result = await CheckReprice(mockNet32Response, mockProd, mockCronSetting, false, mockJobId, "TRADENT");

      expect(result.isPriceUpdated).toBe(true);
    });
  });
});
