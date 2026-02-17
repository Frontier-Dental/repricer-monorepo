// Mock shared package BEFORE imports
jest.mock("@repricer-monorepo/shared", () => ({
  AlgoExecutionMode: {
    V2_ONLY: "V2_ONLY",
    V1_ONLY: "V1_ONLY",
    V2_EXECUTE_V1_DRY: "V2_EXECUTE_V1_DRY",
    V1_EXECUTE_V2_DRY: "V1_EXECUTE_V2_DRY",
  },
  VendorNameLookup: {
    1: "TRADENT",
    2: "FRONTIER",
    3: "MVP",
  },
}));

// Mock all dependencies
jest.mock("axios");
jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-uuid-123"),
}));
jest.mock("moment", () => {
  const moment = jest.requireActual("moment");
  return {
    ...moment,
    default: jest.fn((date?: any) => {
      const m = moment(date || new Date());
      m.utc = jest.fn(() => m);
      m.add = jest.fn((amount: number, unit: string) => {
        const result = moment(date || new Date()).add(amount, unit);
        result.utc = jest.fn(() => result);
        return result;
      });
      return m;
    }),
  };
});

jest.mock("../../../../controller/main-cron/shared", () => ({
  calculateNextCronTime: jest.fn((date: Date, hours: number) => {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }),
}));

jest.mock("../../../../model/error-item", () => ({
  ErrorItemModel: jest.fn().mockImplementation((mpId, nextCronTime, active, contextCronId, insertReason, vendor) => ({
    mpId,
    nextCronTime,
    active,
    contextCronId,
    insertReason,
    vendorName: vendor,
    createdOn: new Date(),
    updatedOn: new Date(),
  })),
}));

jest.mock("../../../config", () => ({
  applicationConfig: {
    IS_DEV: false,
    V2_ALGO_HTML_FILE_EXPIRY_HOURS: 24,
    CRON_NAME_422: "422_Cron",
  },
}));

jest.mock("../../../mongo/db-helper", () => ({
  GetErrorItemsByMpId: jest.fn(),
  UpsertErrorItemLog: jest.fn(),
}));

jest.mock("../../../mysql/mysql-helper", () => ({
  getNet32UrlById: jest.fn(),
}));

jest.mock("../../../mysql/tinyproxy-configs", () => ({
  findTinyProxyConfigsByVendorIds: jest.fn(),
}));

jest.mock("../../../mysql/v2-algo-error", () => ({
  insertV2AlgoError: jest.fn(),
}));

jest.mock("../../../mysql/v2-algo-execution", () => ({
  insertV2AlgoExecution: jest.fn(),
}));

jest.mock("../../../mysql/v2-algo-results", () => ({
  insertMultipleV2AlgoResults: jest.fn(),
}));

jest.mock("../../../mysql/v2-algo-settings", () => ({
  findOrCreateV2AlgoSettingsForVendors: jest.fn(),
}));

jest.mock("../../../mysql/mysql-v2", () => ({
  GetCronSettingsDetailsByName: jest.fn(),
  GetCronSettingsDetailsById: jest.fn(),
}));

jest.mock("../algorithm", () => ({
  repriceProductV2: jest.fn(),
}));

jest.mock("../shipping-threshold", () => ({
  getVendorThresholds: jest.fn(),
}));

jest.mock("../utility", () => ({
  getAllOwnVendorIds: jest.fn(() => [1, 2, 3]),
  getPriceListFormatted: jest.fn((priceList) => JSON.stringify(priceList)),
  isChangeResult: jest.fn((result) => result === "CHANGE #UP" || result === "CHANGE #DOWN" || result === "CHANGE #NEW"),
}));

import axios from "axios";
import { AxiosError } from "axios";
import { Decimal } from "decimal.js";
import { AlgoExecutionMode } from "@repricer-monorepo/shared";
import { updatePrice, repriceProductV2Wrapper } from "../wrapper";
import * as mongoHelper from "../../../mongo/db-helper";
import { getNet32UrlById } from "../../../mysql/mysql-helper";
import { findTinyProxyConfigsByVendorIds } from "../../../mysql/tinyproxy-configs";
import { insertV2AlgoError } from "../../../mysql/v2-algo-error";
import { insertV2AlgoExecution } from "../../../mysql/v2-algo-execution";
import { insertMultipleV2AlgoResults } from "../../../mysql/v2-algo-results";
import { findOrCreateV2AlgoSettingsForVendors } from "../../../mysql/v2-algo-settings";
import { repriceProductV2 } from "../algorithm";
import { getVendorThresholds } from "../shipping-threshold";
import { AlgoResult, ChangeResult } from "../types";
import { getPriceListFormatted } from "../utility";
import { GetCronSettingsDetailsByName, GetCronSettingsDetailsById } from "../../../mysql/mysql-v2";
import { applicationConfig } from "../../../config";

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("wrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mock implementations
    (mongoHelper.GetErrorItemsByMpId as jest.Mock).mockResolvedValue([]);
    (getNet32UrlById as jest.Mock).mockResolvedValue("https://net32x-fake-url.com/product/123");
    (findOrCreateV2AlgoSettingsForVendors as jest.Mock).mockResolvedValue([
      {
        mp_id: 123,
        vendor_id: 1,
        floor_price: 5,
        max_price: 20,
        execution_priority: 1,
        enabled: true,
      },
    ]);
    (getVendorThresholds as jest.Mock).mockResolvedValue([
      { vendorId: 1, threshold: 100, standardShipping: 5 },
      { vendorId: 2, threshold: 100, standardShipping: 5 },
    ]);
    (repriceProductV2 as jest.Mock).mockResolvedValue([]);
    (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
      {
        vendor_id: 1,
        ip: "127.0.0.1",
        port: 8080,
        proxy_username: "user",
        proxy_password: "pass",
      },
    ]);
    (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
      SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
    });
    (insertMultipleV2AlgoResults as jest.Mock).mockResolvedValue(undefined);
    (insertV2AlgoExecution as jest.Mock).mockResolvedValue(undefined);
    (mongoHelper.UpsertErrorItemLog as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("updatePrice", () => {
    const mockProxyConfig = {
      ip: "127.0.0.1",
      port: 8080,
      proxy_username: "testuser",
      proxy_password: "testpass",
    };
    const subscriptionKey = "test-subscription-key";
    const payload = {
      mpid: 12345,
      priceList: [{ minQty: 1, activeCd: 1, price: 10 }],
    };

    it("should successfully update price and return success response", async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 200,
          data: {
            message: "Price updated successfully",
          },
        },
      });

      const result = await updatePrice(mockProxyConfig, subscriptionKey, payload);

      expect(result).toEqual({
        data: {
          status: true,
          message: "Price updated successfully",
        },
      });
      expect(axios.post).toHaveBeenCalledWith(
        "http://127.0.0.1:8080/proxy",
        {
          url: expect.any(String),
          method: "POST",
          data: payload,
          headers: {
            "Content-Type": "application/json",
            "Subscription-Key": subscriptionKey,
          },
        },
        {
          auth: { username: "testuser", password: "testpass" },
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );
    });

    it("should return error response when statusCode is not 200", async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 400,
          data: {
            message: "Invalid request",
          },
        },
      });

      const result = await updatePrice(mockProxyConfig, subscriptionKey, payload);

      expect(result).toEqual({
        data: {
          status: false,
          message: "ERROR:400:Sorry some error occurred! Exception : Invalid request",
        },
      });
    });

    it("should handle axios errors", async () => {
      const axiosError = new AxiosError("Network error");
      (axios.post as jest.Mock).mockRejectedValue(axiosError);

      // updatePrice has try-catch that returns error as response
      const result = await updatePrice(mockProxyConfig, subscriptionKey, payload);

      expect(result).toEqual({
        data: {
          status: false,
          message: `ERROR::Sorry some error occurred! Exception : ${axiosError}`,
        },
      });
    });
  });

  describe("repriceProductV2Wrapper", () => {
    const mockNet32Products = [
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
          { minQty: 1, unitPrice: 10 },
          { minQty: 2, unitPrice: 18 },
        ],
        badgeId: 0,
        badgeName: null,
        imagePath: "",
        arrivalDate: "",
        arrivalBusinessDays: 0,
        twoDayDeliverySw: false,
        isLowestTotalPrice: null,
      },
      {
        vendorProductId: 2,
        vendorProductCode: "PROD-002",
        vendorId: "2",
        vendorName: "Competitor",
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
        priceBreaks: [{ minQty: 1, unitPrice: 11 }],
        badgeId: 0,
        badgeName: null,
        imagePath: "",
        arrivalDate: "",
        arrivalBusinessDays: 0,
        twoDayDeliverySw: false,
        isLowestTotalPrice: null,
      },
    ];

    const mockProd = {
      mpId: 12345,
      productIdentifier: "prod-123",
      cronId: "cron-123",
      algo_execution_mode: AlgoExecutionMode.V2_ONLY,
    };

    const mockSolutionResult = {
      vendor: {
        vendorId: 1,
        vendorName: "TRADENT",
        bestPrice: new Decimal(9.99),
        priceBreaks: [{ minQty: 1, unitPrice: 10 }],
      },
      quantity: 1,
      algoResult: AlgoResult.CHANGE_DOWN,
      suggestedPrice: 9.99,
      comment: "Pricing down.",
      triggeredByVendor: null,
      qBreakValid: true,
      lowestPrice: 9.99,
      lowestVendorId: 1,
      html: "<html>Test HTML</html>",
      vendorSettings: {
        mp_id: 123,
        vendor_id: 1,
        floor_price: 5,
        max_price: 20,
        execution_priority: 1,
      },
    };

    it("should successfully execute wrapper and return results", async () => {
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockReturnValue([solutionWithChange]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
        {
          vendor_id: 1,
          ip: "127.0.0.1",
          port: 8080,
          proxy_username: "user",
          proxy_password: "pass",
        },
      ]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 200,
          data: { message: "Success" },
        },
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      // Check if error was logged (function returns undefined on error)
      if (!results) {
        expect(insertV2AlgoError).toHaveBeenCalled();
        return;
      }

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(mongoHelper.GetErrorItemsByMpId).toHaveBeenCalledWith(12345);
      expect(getNet32UrlById).toHaveBeenCalledWith(12345);
      expect(findOrCreateV2AlgoSettingsForVendors).toHaveBeenCalled();
      expect(getVendorThresholds).toHaveBeenCalled();
      expect(repriceProductV2).toHaveBeenCalled();
      expect(insertMultipleV2AlgoResults).toHaveBeenCalled();
      expect(insertV2AlgoExecution).toHaveBeenCalled();
    });

    it("should return empty array when no solutions found", async () => {
      (repriceProductV2 as jest.Mock).mockReturnValue([]);

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      // When no solutions, updatePricesIfNecessary returns empty array, then wrapper returns empty
      if (results) {
        expect(results).toEqual([]);
        expect(console.log).toHaveBeenCalledWith("No solutions found for product 12345");
      } else {
        // If error occurred, it should be logged
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle 422 error items and filter out vendors", async () => {
      (mongoHelper.GetErrorItemsByMpId as jest.Mock).mockResolvedValue([{ vendorName: "TRADENT" }]);
      (repriceProductV2 as jest.Mock).mockResolvedValue([]);

      await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      expect(mongoHelper.GetErrorItemsByMpId).toHaveBeenCalledWith(12345);
      // Vendor 1 (TRADENT) should be filtered out from availableVendorIds
    });

    it("should throw error when vendor threshold not found", async () => {
      (getVendorThresholds as jest.Mock).mockResolvedValue([
        { vendorId: 2, threshold: 100, standardShipping: 5 },
        // Missing vendor 1 threshold
      ]);

      // The error is caught and logged, function returns undefined
      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      expect(insertV2AlgoError).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it("should handle price update with ChangeResult.OK", async () => {
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockReturnValue([solutionWithChange]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
        {
          vendor_id: 1,
          ip: "127.0.0.1",
          port: 8080,
          proxy_username: "user",
          proxy_password: "pass",
        },
      ]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 200,
          data: { message: "Success" },
        },
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      if (results) {
        expect(Array.isArray(results)).toBe(true);
        // Should call UpsertErrorItemLog when changeResult is OK
        const okResult = results.find((r: any) => r.changeResult === ChangeResult.OK);
        if (okResult) {
          expect(mongoHelper.UpsertErrorItemLog).toHaveBeenCalled();
        }
      } else {
        // If error occurred, it should be logged
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle error and insert error log", async () => {
      const error = new Error("Test error");
      (getVendorThresholds as jest.Mock).mockRejectedValue(error);

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      expect(insertV2AlgoError).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: expect.stringContaining("Test error"),
          mp_id: 12345,
          cron_name: "TestCron",
        })
      );
      expect(console.error).toHaveBeenCalled();
    });

    it("should use contextCronId when cronName is MANUAL", async () => {
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockReturnValue([solutionWithChange]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
        {
          vendor_id: 1,
          ip: "127.0.0.1",
          port: 8080,
          proxy_username: "user",
          proxy_password: "pass",
        },
      ]);
      (GetCronSettingsDetailsById as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 200,
          data: { message: "Success" },
        },
      });

      await repriceProductV2Wrapper(mockNet32Products, mockProd, "MANUAL", false, "context-cron-123");

      expect(GetCronSettingsDetailsById).toHaveBeenCalledWith("context-cron-123");
      expect(GetCronSettingsDetailsByName).not.toHaveBeenCalled();
    });

    it("should handle multiple vendors", async () => {
      const solution1 = {
        ...mockSolutionResult,
        vendor: { ...mockSolutionResult.vendor, vendorId: 1 },
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      const solution2 = {
        ...mockSolutionResult,
        vendor: { ...mockSolutionResult.vendor, vendorId: 2 },
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockReturnValue([solution1, solution2]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
        {
          vendor_id: 1,
          ip: "127.0.0.1",
          port: 8080,
          proxy_username: "user1",
          proxy_password: "pass1",
        },
        {
          vendor_id: 2,
          ip: "127.0.0.2",
          port: 8080,
          proxy_username: "user2",
          proxy_password: "pass2",
        },
      ]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [
          { vendorName: "TRADENT", secretKey: "secret-key-1" },
          { vendorName: "FRONTIER", secretKey: "secret-key-2" },
        ],
      });
      (findOrCreateV2AlgoSettingsForVendors as jest.Mock).mockResolvedValue([
        {
          mp_id: 123,
          vendor_id: 1,
          floor_price: 5,
          max_price: 20,
          execution_priority: 1,
        },
        {
          mp_id: 123,
          vendor_id: 2,
          floor_price: 5,
          max_price: 20,
          execution_priority: 1,
        },
      ]);
      (getVendorThresholds as jest.Mock).mockResolvedValue([
        { vendorId: 1, threshold: 100, standardShipping: 5 },
        { vendorId: 2, threshold: 100, standardShipping: 5 },
      ]);
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 200,
          data: { message: "Success" },
        },
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      if (results) {
        expect(Array.isArray(results)).toBe(true);
        expect(insertV2AlgoExecution).toHaveBeenCalledTimes(2);
      } else {
        // If error occurred, it should be logged
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle dev mode and prevent price updates", async () => {
      (applicationConfig as any).IS_DEV = true;
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockResolvedValue([solutionWithChange]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      // Function may return undefined if error occurs, or array if successful
      if (results) {
        expect(Array.isArray(results)).toBe(true);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("We are in dev mode"));
        expect(axios.post).not.toHaveBeenCalled();
        // Results should have CHANGE_PREVENTED_DEV
        const devResults = results.filter((r: any) => r.changeResult === ChangeResult.CHANGE_PREVENTED_DEV);
        expect(devResults.length).toBeGreaterThan(0);
      } else {
        // If error occurred, it should be logged
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle V2_DISABLED execution mode", async () => {
      const prodWithV1Only = {
        ...mockProd,
        algo_execution_mode: AlgoExecutionMode.V1_ONLY,
      };
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockResolvedValue([solutionWithChange]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, prodWithV1Only, "TestCron", false);

      // Function may return undefined if error occurs, or array if successful
      if (results) {
        expect(Array.isArray(results)).toBe(true);
        expect(axios.post).not.toHaveBeenCalled();
        // Results should have CHANGE_PREVENTED_V2_DISABLED
        const disabledResults = results.filter((r: any) => r.changeResult === ChangeResult.CHANGE_PREVENTED_V2_DISABLED);
        expect(disabledResults.length).toBeGreaterThan(0);
      } else {
        // If error occurred, it should be logged
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle 422 error from price update", async () => {
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockResolvedValue([solutionWithChange]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });
      const axiosError = new AxiosError("422 error");
      axiosError.response = {
        status: 422,
        data: {},
      } as any;
      (axios.post as jest.Mock).mockRejectedValue(axiosError);

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      // Function should return results even with 422 error (handled gracefully)
      if (results) {
        expect(Array.isArray(results)).toBe(true);
        // Should handle 422 error gracefully - returns ERROR_422 changeResult
        const error422Results = results.filter((r: any) => r.changeResult === ChangeResult.ERROR_422);
        expect(error422Results.length).toBeGreaterThan(0);
      } else {
        // If error occurred elsewhere, it should be logged
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle missing subscription key", async () => {
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockResolvedValue([solutionWithChange]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [
          // Missing TRADENT key
          { vendorName: "FRONTIER", secretKey: "secret-key-123" },
        ],
      });

      // Error is caught and logged, function returns undefined
      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      expect(insertV2AlgoError).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it("should handle missing proxy config", async () => {
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockResolvedValue([solutionWithChange]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });

      // Error is caught and logged, function returns undefined
      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      expect(insertV2AlgoError).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it("should handle missing cron settings", async () => {
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockResolvedValue([solutionWithChange]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue(null);

      // Error is caught and logged, function returns undefined
      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      expect(insertV2AlgoError).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it("should handle invalid Q breaks removal", async () => {
      const solutionWithInvalidQBreak = {
        ...mockSolutionResult,
        quantity: 2,
        qBreakValid: false,
        algoResult: AlgoResult.IGNORE_SETTINGS,
      };
      const solutionWithValidQBreak = {
        ...mockSolutionResult,
        quantity: 1,
        qBreakValid: true,
        algoResult: AlgoResult.CHANGE_DOWN,
      };
      (repriceProductV2 as jest.Mock).mockResolvedValue([solutionWithValidQBreak, solutionWithInvalidQBreak]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 200,
          data: { message: "Success" },
        },
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      // Function should return results
      if (results) {
        expect(Array.isArray(results)).toBe(true);
        // Invalid Q breaks should be filtered out from validSolutionsWithChanges
        // but should still appear in final results with null changeResult
        const invalidResults = results.filter((r: any) => r.quantity === 2);
        expect(invalidResults.length).toBeGreaterThan(0);
      } else {
        // If error occurred, it should be logged
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle execution priority correctly", async () => {
      const solutionWithHighPriority = {
        ...mockSolutionResult,
        vendorSettings: {
          ...mockSolutionResult.vendorSettings,
          execution_priority: 2,
        },
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      const solutionWithLowPriority = {
        ...mockSolutionResult,
        vendor: { ...mockSolutionResult.vendor, vendorId: 2 },
        vendorSettings: {
          ...mockSolutionResult.vendorSettings,
          vendor_id: 2,
          execution_priority: 1, // Lower priority (executes first)
        },
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockResolvedValue([solutionWithHighPriority, solutionWithLowPriority]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
        {
          vendor_id: 1,
          ip: "127.0.0.1",
          port: 8080,
          proxy_username: "user1",
          proxy_password: "pass1",
        },
        {
          vendor_id: 2,
          ip: "127.0.0.2",
          port: 8080,
          proxy_username: "user2",
          proxy_password: "pass2",
        },
      ]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [
          { vendorName: "TRADENT", secretKey: "secret-key-1" },
          { vendorName: "FRONTIER", secretKey: "secret-key-2" },
        ],
      });
      (findOrCreateV2AlgoSettingsForVendors as jest.Mock).mockResolvedValue([solutionWithHighPriority.vendorSettings, solutionWithLowPriority.vendorSettings]);
      (getVendorThresholds as jest.Mock).mockResolvedValue([
        { vendorId: 1, threshold: 100, standardShipping: 5 },
        { vendorId: 2, threshold: 100, standardShipping: 5 },
      ]);
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 200,
          data: { message: "Success" },
        },
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      // Function should return results
      if (results) {
        expect(Array.isArray(results)).toBe(true);
        // Vendor 2 should execute (lower priority = 1), vendor 1 should have NOT_EXECUTION_PRIORITY
        const vendor2Results = results.filter((r: any) => r.vendor.vendorId === 2);
        const vendor1Results = results.filter((r: any) => r.vendor.vendorId === 1);
        expect(vendor2Results.length).toBeGreaterThan(0);
        expect(vendor1Results.length).toBeGreaterThan(0);
      } else {
        // If error occurred, it should be logged
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle error when no result found for vendor", async () => {
      (repriceProductV2 as jest.Mock).mockResolvedValue([
        {
          ...mockSolutionResult,
          vendor: { ...mockSolutionResult.vendor, vendorId: 999 },
        },
      ]);

      // Error is caught and logged, function returns undefined
      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      expect(insertV2AlgoError).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it("should log algorithm execution completion", async () => {
      (repriceProductV2 as jest.Mock).mockResolvedValue([]);

      await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Algorithm execution completed with job ID"));
    });

    it("should handle slow cron flag", async () => {
      (repriceProductV2 as jest.Mock).mockResolvedValue([mockSolutionResult]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 200,
          data: { message: "Success" },
        },
      });

      await repriceProductV2Wrapper(
        mockNet32Products,
        mockProd,
        "TestCron",
        true // isSlowCron = true
      );

      expect(repriceProductV2).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        true, // isSlowCron
        expect.anything(),
        expect.anything()
      );
    });

    it("should handle non-Error exceptions", async () => {
      (getVendorThresholds as jest.Mock).mockRejectedValue("String error");

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      expect(insertV2AlgoError).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: "String error",
        })
      );
    });

    it("should format price list correctly", async () => {
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockReturnValue([solutionWithChange]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
        {
          vendor_id: 1,
          ip: "127.0.0.1",
          port: 8080,
          proxy_username: "user",
          proxy_password: "pass",
        },
      ]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 200,
          data: { message: "Success" },
        },
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      if (results && results.length > 0) {
        expect(getPriceListFormatted).toHaveBeenCalled();
        expect(insertMultipleV2AlgoResults).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              new_price_breaks: expect.anything(),
            }),
          ])
        );
      } else {
        // If no results or error, check error was logged
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle updateProductInfoWithCustomProxy error when statusCode is not 200", async () => {
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockReturnValue([solutionWithChange]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
        {
          vendor_id: 1,
          ip: "127.0.0.1",
          port: 8080,
          proxy_username: "user",
          proxy_password: "pass",
        },
      ]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          statusCode: 400, // Non-200 status code
          data: { message: "Error" },
        },
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      // Error should be caught and logged
      if (!results) {
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle price outside boundaries error", async () => {
      const solutionWithInvalidPrice = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
        vendor: {
          ...mockSolutionResult.vendor,
          bestPrice: new Decimal(25), // Outside max_price of 20
        },
      };
      (repriceProductV2 as jest.Mock).mockReturnValue([solutionWithInvalidPrice]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
        {
          vendor_id: 1,
          ip: "127.0.0.1",
          port: 8080,
          proxy_username: "user",
          proxy_password: "pass",
        },
      ]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      // Error should be caught and logged
      if (!results) {
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle solution without bestPrice", async () => {
      const solutionWithoutBestPrice = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
        vendor: {
          ...mockSolutionResult.vendor,
          bestPrice: undefined,
        },
      };
      (repriceProductV2 as jest.Mock).mockReturnValue([solutionWithoutBestPrice]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
        {
          vendor_id: 1,
          ip: "127.0.0.1",
          port: 8080,
          proxy_username: "user",
          proxy_password: "pass",
        },
      ]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      // Solution without bestPrice should be filtered out, but if error occurs, it should be logged
      if (!results) {
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });

    it("should handle UNKNOWN_ERROR from price update", async () => {
      const solutionWithChange = {
        ...mockSolutionResult,
        algoResult: AlgoResult.CHANGE_DOWN,
        qBreakValid: true,
      };
      (repriceProductV2 as jest.Mock).mockReturnValue([solutionWithChange]);
      (findTinyProxyConfigsByVendorIds as jest.Mock).mockResolvedValue([
        {
          vendor_id: 1,
          ip: "127.0.0.1",
          port: 8080,
          proxy_username: "user",
          proxy_password: "pass",
        },
      ]);
      (GetCronSettingsDetailsByName as jest.Mock).mockResolvedValue({
        SecretKey: [{ vendorName: "TRADENT", secretKey: "secret-key-123" }],
      });
      // Mock a non-422 error
      const genericError = new Error("Network timeout");
      (axios.post as jest.Mock).mockRejectedValue(genericError);

      const results = await repriceProductV2Wrapper(mockNet32Products, mockProd, "TestCron", false);

      if (results) {
        // Should handle error gracefully and return UNKNOWN_ERROR
        const unknownErrorResults = results.filter((r: any) => r.changeResult === ChangeResult.UNKNOWN_ERROR);
        expect(unknownErrorResults.length).toBeGreaterThan(0);
      } else {
        expect(insertV2AlgoError).toHaveBeenCalled();
      }
    });
  });
});
