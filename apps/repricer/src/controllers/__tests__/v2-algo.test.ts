import { Request, Response } from "express";
import { AlgoExecutionMode } from "@repricer-monorepo/shared";
import * as errorsService from "../../services/algo_v2/errors";
import * as productsService from "../../services/algo_v2/products";
import * as resultsService from "../../services/algo_v2/results";
import * as settingsService from "../../services/algo_v2/settings";
import { getAlgoResultsWithExecution, getV2AlgoSettings, updateV2AlgoSettings, getAllV2AlgoErrorsController, updateAlgoExecutionModeController, getAlgoExecutionModeController, syncVendorSettings, getAllProductsWithAlgoDataController, toggleV2AlgoEnabledController, getNet32UrlController, syncAllVendorSettingsController } from "../v2-algo";

jest.mock("../../services/algo_v2/errors");
jest.mock("../../services/algo_v2/products");
jest.mock("../../services/algo_v2/results");
jest.mock("../../services/algo_v2/settings");

describe("V2 Algorithm Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
    mockReq = {
      params: {},
      body: {},
      query: {},
    };
  });

  describe("getAlgoResultsWithExecution", () => {
    it("should return algo results for valid mpId", async () => {
      const mockResults = [{ mp_id: 123, vendor_id: 20533, result: "OK", suggested_price: 99.99 }];
      (resultsService.getAlgoResultsWithExecutionData as jest.Mock).mockResolvedValue(mockResults);
      mockReq.params = { mpId: "123" };

      await getAlgoResultsWithExecution(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(resultsService.getAlgoResultsWithExecutionData).toHaveBeenCalledWith(123);
      expect(jsonMock).toHaveBeenCalledWith({
        data: mockResults,
        mp_id: 123,
        count: 1,
      });
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid mpId (non-numeric)", async () => {
      mockReq.params = { mpId: "invalid" };

      await getAlgoResultsWithExecution(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(resultsService.getAlgoResultsWithExecutionData).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid mp_id parameter. Must be a valid number.",
      });
    });

    it("should return 400 for mpId that parses to NaN", async () => {
      mockReq.params = { mpId: "" };

      await getAlgoResultsWithExecution(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid mp_id parameter. Must be a valid number.",
      });
    });

    it("should return empty array when no results", async () => {
      (resultsService.getAlgoResultsWithExecutionData as jest.Mock).mockResolvedValue([]);
      mockReq.params = { mpId: "456" };

      await getAlgoResultsWithExecution(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        data: [],
        mp_id: 456,
        count: 0,
      });
    });
  });

  describe("getV2AlgoSettings", () => {
    it("should return formatted settings for valid mpId", async () => {
      const rawSettings = [
        {
          mp_id: 123,
          vendor_id: 20533,
          reprice_up_percentage: "10",
          reprice_down_percentage: "5",
          reprice_up_badge_percentage: "3",
          reprice_down_badge_percentage: "2",
          max_price: "199.99",
          floor_price: "50.00",
          suppress_price_break: 1,
          floor_compete_with_next: 1,
          keep_position: 1,
          compare_q2_with_q1: 1,
          compete_on_price_break_only: 0,
          suppress_price_break_if_Q1_not_updated: 0,
          compete_with_all_vendors: 1,
          enabled: 1,
        },
      ];
      (settingsService.getV2AlgoSettingsByMpId as jest.Mock).mockResolvedValue(rawSettings);
      mockReq.params = { mpId: "123" };

      await getV2AlgoSettings(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(settingsService.getV2AlgoSettingsByMpId).toHaveBeenCalledWith(123);
      expect(jsonMock).toHaveBeenCalledWith({
        data: [
          {
            ...rawSettings[0],
            reprice_up_percentage: 10,
            reprice_down_percentage: 5,
            reprice_up_badge_percentage: 3,
            reprice_down_badge_percentage: 2,
            max_price: 199.99,
            floor_price: 50,
            suppress_price_break: true,
            floor_compete_with_next: true,
            keep_position: true,
            compare_q2_with_q1: true,
            compete_on_price_break_only: false,
            suppress_price_break_if_Q1_not_updated: false,
            compete_with_all_vendors: true,
            enabled: true,
          },
        ],
        mp_id: 123,
        count: 1,
      });
    });

    it("should return 400 for invalid mpId", async () => {
      mockReq.params = { mpId: "not-a-number" };

      await getV2AlgoSettings(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(settingsService.getV2AlgoSettingsByMpId).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid mp_id parameter. Must be a valid number.",
      });
    });
  });

  describe("updateV2AlgoSettings", () => {
    it("should update settings and return success for valid payload", async () => {
      (settingsService.updateV2AlgoSettings as jest.Mock).mockResolvedValue(42);
      mockReq.params = { mpId: "123" };
      mockReq.body = { mp_id: 123, vendor_id: 20533, enabled: true };

      await updateV2AlgoSettings(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(settingsService.updateV2AlgoSettings).toHaveBeenCalledWith({
        mp_id: 123,
        vendor_id: 20533,
        enabled: true,
      });
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        id: 42,
        message: "Settings updated successfully",
      });
    });

    it("should return 400 for invalid mpId", async () => {
      mockReq.params = { mpId: "abc" };
      mockReq.body = { mp_id: 123, vendor_id: 20533 };

      await updateV2AlgoSettings(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(settingsService.updateV2AlgoSettings).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid mp_id parameter. Must be a valid number.",
      });
    });

    it("should return 400 when vendor_id is missing", async () => {
      mockReq.params = { mpId: "123" };
      mockReq.body = { mp_id: 123 };

      await updateV2AlgoSettings(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(settingsService.updateV2AlgoSettings).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "vendor_id is required in request body",
      });
    });

    it("should return 400 when mp_id in body does not match URL", async () => {
      mockReq.params = { mpId: "123" };
      mockReq.body = { mp_id: 456, vendor_id: 20533 };

      await updateV2AlgoSettings(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(settingsService.updateV2AlgoSettings).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "mp_id in body must match mp_id in URL",
      });
    });
  });

  describe("getAllV2AlgoErrorsController", () => {
    it("should return all algo errors", async () => {
      const mockErrors = [{ id: 1, mp_id: 123, error_message: "Test error", created_at: "2025-01-01" }];
      (errorsService.getAllV2AlgoErrors as jest.Mock).mockResolvedValue(mockErrors);
      mockReq.params = {};
      mockReq.body = {};

      await getAllV2AlgoErrorsController(mockReq as Request, mockRes as Response);

      expect(errorsService.getAllV2AlgoErrors).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        data: mockErrors,
        count: 1,
      });
    });

    it("should return count 0 when no errors", async () => {
      (errorsService.getAllV2AlgoErrors as jest.Mock).mockResolvedValue([]);

      await getAllV2AlgoErrorsController(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        data: [],
        count: 0,
      });
    });
  });

  describe("updateAlgoExecutionModeController", () => {
    it("should update execution mode and return success", async () => {
      (productsService.updateAlgoExecutionMode as jest.Mock).mockResolvedValue(1);
      mockReq.params = { mpId: "123" };
      mockReq.body = { algo_execution_mode: AlgoExecutionMode.V2_ONLY };

      await updateAlgoExecutionModeController(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(productsService.updateAlgoExecutionMode).toHaveBeenCalledWith(123, AlgoExecutionMode.V2_ONLY);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "algo_execution_mode field updated successfully",
        mp_id: 123,
        algo_execution_mode: AlgoExecutionMode.V2_ONLY,
        updated_rows: 1,
      });
    });

    it("should return 400 for invalid mpId", async () => {
      mockReq.params = { mpId: "invalid" };
      mockReq.body = { algo_execution_mode: AlgoExecutionMode.V2_ONLY };

      await updateAlgoExecutionModeController(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(productsService.updateAlgoExecutionMode).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid mp_id parameter. Must be a valid number.",
      });
    });

    it("should return 400 for invalid algo_execution_mode", async () => {
      mockReq.params = { mpId: "123" };
      mockReq.body = { algo_execution_mode: "INVALID_MODE" };

      await updateAlgoExecutionModeController(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(productsService.updateAlgoExecutionMode).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: expect.stringContaining("algo_execution_mode must be one of:"),
      });
    });

    it("should return 404 when product not found (0 rows updated)", async () => {
      (productsService.updateAlgoExecutionMode as jest.Mock).mockResolvedValue(0);
      mockReq.params = { mpId: "999" };
      mockReq.body = { algo_execution_mode: AlgoExecutionMode.V1_ONLY };

      await updateAlgoExecutionModeController(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Product not found with the specified mp_id.",
      });
    });

    it("should accept all valid AlgoExecutionMode values", async () => {
      const modes = [AlgoExecutionMode.V2_ONLY, AlgoExecutionMode.V1_ONLY, AlgoExecutionMode.V2_EXECUTE_V1_DRY, AlgoExecutionMode.V1_EXECUTE_V2_DRY];
      (productsService.updateAlgoExecutionMode as jest.Mock).mockResolvedValue(1);

      for (const mode of modes) {
        jest.clearAllMocks();
        mockReq.params = { mpId: "123" };
        mockReq.body = { algo_execution_mode: mode };

        await updateAlgoExecutionModeController(mockReq as Request<{ mpId: string }>, mockRes as Response);

        expect(productsService.updateAlgoExecutionMode).toHaveBeenCalledWith(123, mode);
      }
    });
  });

  describe("getAlgoExecutionModeController", () => {
    it("should return execution mode for valid mpId", async () => {
      (productsService.getAlgoExecutionMode as jest.Mock).mockResolvedValue(AlgoExecutionMode.V2_ONLY);
      mockReq.params = { mpId: "123" };

      await getAlgoExecutionModeController(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(productsService.getAlgoExecutionMode).toHaveBeenCalledWith(123);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        mp_id: 123,
        algo_execution_mode: AlgoExecutionMode.V2_ONLY,
      });
    });

    it("should return 400 for invalid mpId", async () => {
      mockReq.params = { mpId: "x" };

      await getAlgoExecutionModeController(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(productsService.getAlgoExecutionMode).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid mp_id parameter. Must be a valid number.",
      });
    });
  });

  describe("syncVendorSettings", () => {
    it("should sync vendor settings for valid mpId and return result", async () => {
      const mockResult = {
        insertedCount: 5,
        updatedCount: 2,
        vendorResults: [],
      };
      (settingsService.syncVendorSettingsForMpId as jest.Mock).mockResolvedValue(mockResult);
      mockReq.params = { mpId: "123" };

      await syncVendorSettings(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(settingsService.syncVendorSettingsForMpId).toHaveBeenCalledWith(123);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        mp_id: 123,
        message: "Successfully synced vendor settings for MP ID 123",
        data: mockResult,
      });
    });

    it("should return 400 for invalid mpId", async () => {
      mockReq.params = { mpId: "abc" };

      await syncVendorSettings(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(settingsService.syncVendorSettingsForMpId).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid mp_id parameter. Must be a valid number.",
      });
    });
  });

  describe("getAllProductsWithAlgoDataController", () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it("should fetch fresh products when no cache", async () => {
      const mockProducts = [{ mp_id: 123, vendor_id: 20533, channel_name: "FirstDent" }];
      (settingsService.getAllProductsWithAlgoData as jest.Mock).mockResolvedValue(mockProducts);
      mockReq.query = {};

      await getAllProductsWithAlgoDataController(mockReq as Request, mockRes as Response);

      expect(settingsService.getAllProductsWithAlgoData).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        data: mockProducts,
        cacheTimestamp: expect.any(String),
        isCached: false,
      });
    });

    it("should return cached data when ignoreCache is not set and cache is fresh", async () => {
      const mockProducts = [{ mp_id: 1, channel_name: "Test" }];
      (settingsService.getAllProductsWithAlgoData as jest.Mock).mockResolvedValue(mockProducts);

      await getAllProductsWithAlgoDataController(mockReq as Request, mockRes as Response);
      const firstCallTimestamp = (jsonMock.mock.calls[0][0] as any).cacheTimestamp;
      const firstCallData = (jsonMock.mock.calls[0][0] as any).data;

      jsonMock.mockClear();
      (settingsService.getAllProductsWithAlgoData as jest.Mock).mockClear();

      await getAllProductsWithAlgoDataController(mockReq as Request, mockRes as Response);

      expect(settingsService.getAllProductsWithAlgoData).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        data: firstCallData,
        cacheTimestamp: firstCallTimestamp,
        isCached: true,
      });
    });

    it("should bypass cache when ignoreCache is true", async () => {
      const mockProducts = [{ mp_id: 2, channel_name: "Fresh" }];
      (settingsService.getAllProductsWithAlgoData as jest.Mock).mockResolvedValue(mockProducts);
      mockReq.query = { ignoreCache: "true" };

      await getAllProductsWithAlgoDataController(mockReq as Request, mockRes as Response);

      expect(settingsService.getAllProductsWithAlgoData).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        data: mockProducts,
        cacheTimestamp: expect.any(String),
        isCached: false,
      });
    });

    it("should fetch fresh data when cache is expired", async () => {
      const oldProducts = [{ mp_id: 1, channel_name: "Old" }];
      const freshProducts = [{ mp_id: 2, channel_name: "Fresh" }];
      (settingsService.getAllProductsWithAlgoData as jest.Mock).mockResolvedValueOnce(oldProducts).mockResolvedValueOnce(freshProducts);

      mockReq.query = { ignoreCache: "true" };
      await getAllProductsWithAlgoDataController(mockReq as Request, mockRes as Response);
      expect(settingsService.getAllProductsWithAlgoData).toHaveBeenCalledTimes(1);

      jest.useFakeTimers();
      jest.advanceTimersByTime(11 * 60 * 1000); // 11 minutes
      jsonMock.mockClear();
      (settingsService.getAllProductsWithAlgoData as jest.Mock).mockClear();

      mockReq.query = {};
      await getAllProductsWithAlgoDataController(mockReq as Request, mockRes as Response);

      expect(settingsService.getAllProductsWithAlgoData).toHaveBeenCalledTimes(1);
      expect(jsonMock).toHaveBeenCalledWith({
        data: freshProducts,
        cacheTimestamp: expect.any(String),
        isCached: false,
      });

      jest.useRealTimers();
    });
  });

  describe("toggleV2AlgoEnabledController", () => {
    it("should toggle enabled and return result", async () => {
      (settingsService.toggleV2AlgoEnabled as jest.Mock).mockResolvedValue({ enabled: true });
      mockReq.params = { mpId: "123", vendorId: "20533" };

      await toggleV2AlgoEnabledController(mockReq as Request<{ mpId: string; vendorId: string }>, mockRes as Response);

      expect(settingsService.toggleV2AlgoEnabled).toHaveBeenCalledWith(123, 20533);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        mp_id: 123,
        vendor_id: 20533,
        enabled: true,
        message: "Successfully toggled enabled status to true",
      });
    });

    it("should return 400 for invalid mpId", async () => {
      mockReq.params = { mpId: "invalid", vendorId: "20533" };

      await toggleV2AlgoEnabledController(mockReq as Request<{ mpId: string; vendorId: string }>, mockRes as Response);

      expect(settingsService.toggleV2AlgoEnabled).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid mp_id parameter. Must be a valid number.",
      });
    });

    it("should return 400 for invalid vendorId", async () => {
      mockReq.params = { mpId: "123", vendorId: "bad" };

      await toggleV2AlgoEnabledController(mockReq as Request<{ mpId: string; vendorId: string }>, mockRes as Response);

      expect(settingsService.toggleV2AlgoEnabled).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid vendor_id parameter. Must be a valid number.",
      });
    });
  });

  describe("getNet32UrlController", () => {
    it("should return net32 URL for valid mpId", async () => {
      (settingsService.getNet32Url as jest.Mock).mockResolvedValue("https://net32.example.com/product/123");
      mockReq.params = { mpId: "123" };

      await getNet32UrlController(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(settingsService.getNet32Url).toHaveBeenCalledWith(123);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        mp_id: 123,
        net32_url: "https://net32.example.com/product/123",
      });
    });

    it("should return 400 for invalid mpId", async () => {
      mockReq.params = { mpId: "x" };

      await getNet32UrlController(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(settingsService.getNet32Url).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid mp_id parameter. Must be a valid number.",
      });
    });

    it("should return 500 when getNet32Url throws", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      (settingsService.getNet32Url as jest.Mock).mockRejectedValue(new Error("DB error"));
      mockReq.params = { mpId: "123" };

      await getNet32UrlController(mockReq as Request<{ mpId: string }>, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Internal server error while fetching net32 URL",
      });
      consoleErrorSpy.mockRestore();
    });
  });

  describe("syncAllVendorSettingsController", () => {
    it("should call syncAllVendorSettings and return result", async () => {
      const mockResult = {
        totalInserted: 10,
        totalUpdated: 0,
        vendorResults: [],
        channelIdResults: { totalInserted: 5, totalUpdated: 0, totalSkipped: 0, vendorResults: [] },
      };
      (settingsService.syncAllVendorSettings as jest.Mock).mockResolvedValue(mockResult);
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      await syncAllVendorSettingsController(mockReq as Request, mockRes as Response);

      expect(settingsService.syncAllVendorSettings).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Successfully synced all vendor settings and channel IDs",
        data: mockResult,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith("🚀 Starting sync of all vendor settings and channel IDs...");
      consoleLogSpy.mockRestore();
    });
  });
});
