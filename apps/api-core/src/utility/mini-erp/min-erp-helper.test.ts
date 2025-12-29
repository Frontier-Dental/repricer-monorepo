// Mock all dependencies BEFORE imports
jest.mock("../config", () => ({
  applicationConfig: {
    MINI_ERP_BASE_URL: "https://test-mini-erp.com",
    MINI_ERP_USERNAME: "test-user",
    MINI_ERP_PASSWORD: "test-password",
    MINI_ERP_DATA_PAGE_SIZE: 100,
    SQL_WAITLIST: "waitlist",
  },
}));

jest.mock("@repricer-monorepo/shared", () => ({
  CacheKey: {
    MINI_ERP_LOGIN_RESPONSE: "MINI_ERP_LOGIN_RESPONSE",
    MINI_ERP_CRON_DETAILS: "MINI_ERP_CRON_DETAILS",
  },
}));

jest.mock("../axios-helper");
jest.mock("../../client/cacheClient");
jest.mock("../mysql/mysql-helper");
jest.mock("../mysql/mysql-v2");
jest.mock("../../model/waitlist-model");

import { getProductsFromMiniErp, getRandomizedNet32Quantity, isCancelled } from "./min-erp-helper";
import * as axiosHelper from "../axios-helper";
import CacheClient, { GetCacheClientOptions } from "../../client/cacheClient";
import { GetCurrentStock, WaitlistInsert } from "../mysql/mysql-helper";
import { GetMiniErpCronDetails } from "../mysql/mysql-v2";
import { WaitlistModel } from "../../model/waitlist-model";
import { applicationConfig } from "../config";
import { CacheKey } from "@repricer-monorepo/shared";
import type { MiniErpLoginResponse, MiniErpProduct } from "./types";

// Suppress console.log during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe("min-erp-helper", () => {
  let mockCacheClient: {
    get: jest.Mock;
    set: jest.Mock;
    disconnect: jest.Mock;
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();

    // Mock applicationConfig
    (applicationConfig as any) = {
      MINI_ERP_BASE_URL: "https://test-mini-erp.com",
      MINI_ERP_USERNAME: "test-user",
      MINI_ERP_PASSWORD: "test-password",
      MINI_ERP_DATA_PAGE_SIZE: 100,
      SQL_WAITLIST: "waitlist",
    };

    // Mock CacheClient
    mockCacheClient = {
      get: jest.fn(),
      set: jest.fn(),
      disconnect: jest.fn(),
    };

    (CacheClient.getInstance as jest.Mock) = jest.fn(() => mockCacheClient);
    (GetCacheClientOptions as jest.Mock) = jest.fn(() => ({}));

    // Default mock for GetMiniErpCronDetails (not cancelled)
    (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe("getRandomizedNet32Quantity", () => {
    it("should return a value within the default range for inventory > 1000", () => {
      const result = getRandomizedNet32Quantity(2000);
      expect(result).toBeGreaterThanOrEqual(5000);
      expect(result).toBeLessThanOrEqual(9999);
    });

    it("should return a value within range [250, 349] for inventory <= 99", () => {
      const result = getRandomizedNet32Quantity(50);
      expect(result).toBeGreaterThanOrEqual(250);
      expect(result).toBeLessThanOrEqual(349);
    });

    it("should return a value within range [350, 599] for inventory = 100", () => {
      const result = getRandomizedNet32Quantity(100);
      expect(result).toBeGreaterThanOrEqual(350);
      expect(result).toBeLessThanOrEqual(599);
    });

    it("should return a value within range [600, 1999] for inventory <= 500", () => {
      const result = getRandomizedNet32Quantity(300);
      expect(result).toBeGreaterThanOrEqual(600);
      expect(result).toBeLessThanOrEqual(1999);
    });

    it("should return a value within range [5000, 9999] for inventory <= 1000", () => {
      const result = getRandomizedNet32Quantity(800);
      expect(result).toBeGreaterThanOrEqual(5000);
      expect(result).toBeLessThanOrEqual(9999);
    });

    it("should handle zero inventory", () => {
      const result = getRandomizedNet32Quantity(0);
      expect(result).toBeGreaterThanOrEqual(250);
      expect(result).toBeLessThanOrEqual(349);
    });

    it("should handle negative inventory by normalizing to 0", () => {
      const result = getRandomizedNet32Quantity(-10);
      expect(result).toBeGreaterThanOrEqual(250);
      expect(result).toBeLessThanOrEqual(349);
    });

    it("should handle decimal inventory by flooring", () => {
      const result = getRandomizedNet32Quantity(99.9);
      expect(result).toBeGreaterThanOrEqual(250);
      expect(result).toBeLessThanOrEqual(349);
    });

    it("should return different values on multiple calls (randomness)", () => {
      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(getRandomizedNet32Quantity(50));
      }
      // With randomness, we should get at least 2 different values
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe("isCancelled", () => {
    it("should return true when cron status is false", async () => {
      const mockCronDetails = [
        { CronName: "MiniErpFetchCron", CronStatus: false },
        { CronName: "OtherCron", CronStatus: true },
      ];

      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue(mockCronDetails);

      const result = await isCancelled("MiniErpFetchCron");
      expect(result).toBe(true);
      expect(GetMiniErpCronDetails).toHaveBeenCalledTimes(1);
    });

    it("should return false when cron status is true", async () => {
      const mockCronDetails = [{ CronName: "MiniErpFetchCron", CronStatus: true }];

      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue(mockCronDetails);

      const result = await isCancelled("MiniErpFetchCron");
      expect(result).toBe(false);
    });

    it("should return false when cron is not found", async () => {
      const mockCronDetails = [{ CronName: "OtherCron", CronStatus: false }];

      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue(mockCronDetails);

      const result = await isCancelled("MiniErpFetchCron");
      expect(result).toBe(false);
    });

    it("should return false when cron details is empty array", async () => {
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([]);

      const result = await isCancelled("MiniErpFetchCron");
      expect(result).toBe(false);
    });

    it("should handle undefined cron details", async () => {
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // The function will throw an error when trying to call .find() on undefined
      await expect(isCancelled("MiniErpFetchCron")).rejects.toThrow();
    });
  });

  describe("getProductsFromMiniErp", () => {
    const mockAccessToken = "test-access-token";
    const mockLoginResponse: MiniErpLoginResponse = {
      access_token: mockAccessToken,
    };

    const createMockProduct = (mpid: string, vendorName: string, quantityAvailable: number): MiniErpProduct => ({
      mpid,
      vendorName,
      quantityAvailable,
    });

    // axiosHelper.getProductsFromMiniErp returns an axios response object
    // which has a 'data' property containing the GraphQL response
    const createMockGraphQLResponse = (items: MiniErpProduct[], hasMore: boolean) => ({
      data: {
        data: {
          getUpdatedProductsWithOffsetPagination: {
            items,
            hasMore,
          },
        },
      },
    });

    beforeEach(() => {
      // Default mock for WaitlistModel
      (WaitlistModel as any) = jest.fn().mockImplementation((mp_id, vendor_name, old_inventory, new_inventory, net32_inventory) => ({
        mp_id,
        vendor_name,
        old_inventory,
        new_inventory,
        net32_inventory,
      }));
    });

    it("should successfully fetch products when login succeeds", async () => {
      // Mock cache miss for login
      mockCacheClient.get.mockResolvedValue(null);

      // Mock successful login
      (axiosHelper.postAsync as jest.Mock) = jest.fn().mockResolvedValue({
        status: 200,
        data: mockLoginResponse,
      });

      // Mock products response
      const mockProducts = [createMockProduct("20", "MVP", 10), createMockProduct("7956", "TRADENT", 0)];

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      // Mock GetCurrentStock
      (GetCurrentStock as jest.Mock) = jest.fn().mockResolvedValue([
        {
          mpid: "20",
          CurrentInStock: 5,
          CurrentInventory: 5,
        },
        {
          mpid: "7956",
          CurrentInStock: 0,
          CurrentInventory: 0,
        },
      ]);

      // Mock WaitlistInsert
      (WaitlistInsert as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      expect(axiosHelper.postAsync).toHaveBeenCalled();
      expect(axiosHelper.getProductsFromMiniErp).toHaveBeenCalled();
      expect(mockCacheClient.set).toHaveBeenCalledWith(CacheKey.MINI_ERP_LOGIN_RESPONSE, mockLoginResponse, expect.any(Number));
    });

    it("should return false when login fails", async () => {
      mockCacheClient.get.mockResolvedValue(null);
      (axiosHelper.postAsync as jest.Mock) = jest.fn().mockRejectedValue(new Error("Login failed"));

      const result = await getProductsFromMiniErp();

      expect(result).toBe(false);
      expect(axiosHelper.getProductsFromMiniErp).not.toHaveBeenCalled();
    });

    it("should return false when access token is missing", async () => {
      mockCacheClient.get.mockResolvedValue(null);
      (axiosHelper.postAsync as jest.Mock) = jest.fn().mockResolvedValue({
        status: 200,
        data: {}, // Missing access_token
      });

      const result = await getProductsFromMiniErp();

      expect(result).toBe(false);
    });

    it("should use cached login response when available", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const mockProducts = [createMockProduct("20", "MVP", 10)];
      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      (GetCurrentStock as jest.Mock) = jest.fn().mockResolvedValue([{ mpid: "20", CurrentInStock: 5, CurrentInventory: 5 }]);

      (WaitlistInsert as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      expect(axiosHelper.postAsync).not.toHaveBeenCalled();
      expect(axiosHelper.getProductsFromMiniErp).toHaveBeenCalled();
    });

    it("should handle pagination correctly", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const page1Products = [createMockProduct("20", "MVP", 10), createMockProduct("7956", "TRADENT", 0)];
      const page2Products = [createMockProduct("7092", "MVP", 5)];

      (axiosHelper.getProductsFromMiniErp as jest.Mock).mockResolvedValueOnce(createMockGraphQLResponse(page1Products, true)).mockResolvedValueOnce(createMockGraphQLResponse(page2Products, false));

      // GetCurrentStock is called once per vendor per page
      // Page 1 has products from 2 vendors (MVP and TRADENT), so GetCurrentStock is called twice
      // Page 2 has 1 product from MVP, so GetCurrentStock is called once
      // Total: 3 calls (2 for page 1, 1 for page 2)
      (GetCurrentStock as jest.Mock) = jest
        .fn()
        .mockResolvedValueOnce([{ mpid: "20", CurrentInStock: 0, CurrentInventory: 0 }])
        .mockResolvedValueOnce([{ mpid: "7956", CurrentInStock: 5, CurrentInventory: 5 }])
        .mockResolvedValueOnce([{ mpid: "7092", CurrentInStock: 0, CurrentInventory: 0 }]);

      (WaitlistInsert as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // Mock isCancelled - it's called after each page is processed
      // We need to return not cancelled for both calls so pagination continues
      let isCancelledCallCount = 0;
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockImplementation(async () => {
        isCancelledCallCount++;
        // Return not cancelled (CronStatus: true) for all calls
        return [{ CronName: "MiniErpFetchCron", CronStatus: true }];
      });

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      // Should fetch both pages
      expect(axiosHelper.getProductsFromMiniErp).toHaveBeenCalledTimes(2);
      // GetCurrentStock should be called once per vendor per page
      // Page 1: MVP (1 call) + TRADENT (1 call) = 2 calls
      // Page 2: MVP (1 call) = 1 call
      // Total: 3 calls
      expect(GetCurrentStock).toHaveBeenCalledTimes(3);
      expect(GetCurrentStock).toHaveBeenCalledWith(["20"], "MVP");
      expect(GetCurrentStock).toHaveBeenCalledWith(["7956"], "TRADENT");
      expect(GetCurrentStock).toHaveBeenCalledWith(["7092"], "MVP");
      // Both pages should process products and call WaitlistInsert
      expect(WaitlistInsert).toHaveBeenCalledTimes(2);
    });

    it("should stop pagination when cancelled", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const page1Products = [createMockProduct("20", "MVP", 10)];
      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(page1Products, true));

      (GetCurrentStock as jest.Mock) = jest.fn().mockResolvedValue([{ mpid: "20", CurrentInStock: 0, CurrentInventory: 0 }]);

      (WaitlistInsert as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // Mock isCancelled by mocking GetMiniErpCronDetails
      // isCancelled is called AFTER each page is processed
      // First call (after page 1): not cancelled, so loop continues
      // Second call (after page 1 processing, before page 2): cancelled, so loop breaks
      // But wait - if hasMore=true, it will try to fetch page 2
      // So we need to return cancelled on the first call to stop after page 1
      let callCount = 0;
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockImplementation(async () => {
        callCount++;
        // First call (after page 1): cancelled (CronStatus: false means cancelled)
        // This will set shouldContinue = false, so loop breaks on next iteration
        return [{ CronName: "MiniErpFetchCron", CronStatus: false }];
      });

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      // Should only fetch first page before cancellation
      // Page 1 is fetched and processed, then isCancelled returns true (cancelled)
      // This sets shouldContinue = false, so the loop breaks before fetching page 2
      expect(axiosHelper.getProductsFromMiniErp).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid response structure", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue({ data: {} }); // Invalid structure

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true); // Function returns true even on error
    });

    it("should handle empty items array", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse([], false));

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      expect(GetCurrentStock).not.toHaveBeenCalled();
      expect(WaitlistInsert).not.toHaveBeenCalled();
    });

    it("should skip products without mpid or vendorName", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const mockProducts = [
        createMockProduct("", "MVP", 10), // Missing mpid - should be skipped
        createMockProduct("7956", "", 0), // Missing vendorName - should be skipped
        createMockProduct("7092", "MVP", 5), // Valid - but needs matching inventory condition
      ];

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      // Set up stock so mpid3 meets the condition: repricer=0, miniErp=5
      // GetCurrentStock is called with all mpids for a vendor at once
      (GetCurrentStock as jest.Mock) = jest.fn().mockResolvedValue([{ mpid: "7092", CurrentInStock: 0, CurrentInventory: 0 }]);

      (WaitlistInsert as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // Mock isCancelled by mocking GetMiniErpCronDetails
      // isCancelled is called AFTER processing, so we need to return not cancelled
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      // Should only process valid product (mpid3)
      // Products are grouped by vendor, so GetCurrentStock is called with all mpids for Vendor1
      expect(GetCurrentStock).toHaveBeenCalledWith(["7092"], "MVP");
      expect(WaitlistInsert).toHaveBeenCalled();
    });

    it("should skip products without stock data", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const mockProducts = [createMockProduct("20", "MVP", 10)];

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      (GetCurrentStock as jest.Mock) = jest.fn().mockResolvedValue([]); // No stock data

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      expect(WaitlistInsert).not.toHaveBeenCalled();
    });

    it("should create waitlist items when repricer inventory > 0 and miniErp inventory = 0", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const mockProducts = [createMockProduct("20", "MVP", 0)];

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      (GetCurrentStock as jest.Mock) = jest.fn().mockResolvedValue([{ mpid: "20", CurrentInStock: 5, CurrentInventory: 5 }]);

      (WaitlistInsert as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      expect(WaitlistInsert).toHaveBeenCalled();
      const waitlistCall = (WaitlistInsert as jest.Mock).mock.calls[0][0];
      expect(waitlistCall).toHaveLength(1);
      expect(waitlistCall[0].mp_id).toBe(Number("20"));
      expect(waitlistCall[0].old_inventory).toBe(5);
      expect(waitlistCall[0].new_inventory).toBe(0);
      expect(waitlistCall[0].net32_inventory).toBe(0);
    });

    it("should create waitlist items when repricer inventory = 0 and miniErp inventory > 0", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const mockProducts = [createMockProduct("20", "MVP", 50)];

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      (GetCurrentStock as jest.Mock) = jest.fn().mockResolvedValue([{ mpid: "20", CurrentInStock: 0, CurrentInventory: 0 }]);

      (WaitlistInsert as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      expect(WaitlistInsert).toHaveBeenCalled();
      const waitlistCall = (WaitlistInsert as jest.Mock).mock.calls[0][0];
      expect(waitlistCall).toHaveLength(1);
      expect(waitlistCall[0].mp_id).toBe(Number("20"));
      expect(waitlistCall[0].old_inventory).toBe(0);
      expect(waitlistCall[0].new_inventory).toBe(50);
      expect(waitlistCall[0].net32_inventory).toBeGreaterThanOrEqual(250);
      expect(waitlistCall[0].net32_inventory).toBeLessThanOrEqual(349);
    });

    it("should skip products when inventory states match", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const mockProducts = [createMockProduct("20", "MVP", 5)];

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      (GetCurrentStock as jest.Mock) = jest.fn().mockResolvedValue([{ mpid: "20", CurrentInStock: 5, CurrentInventory: 5 }]);

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      expect(WaitlistInsert).not.toHaveBeenCalled();
    });

    it("should handle multiple vendors correctly", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const mockProducts = [createMockProduct("20", "MVP", 0), createMockProduct("7956", "TRADENT", 10)];

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      (GetCurrentStock as jest.Mock).mockResolvedValueOnce([{ mpid: "20", CurrentInStock: 5, CurrentInventory: 5 }]).mockResolvedValueOnce([{ mpid: "7956", CurrentInStock: 0, CurrentInventory: 0 }]);

      (WaitlistInsert as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      expect(GetCurrentStock).toHaveBeenCalledTimes(2);
      expect(GetCurrentStock).toHaveBeenCalledWith(["20"], "MVP");
      expect(GetCurrentStock).toHaveBeenCalledWith(["7956"], "TRADENT");
    });

    it("should handle GetCurrentStock errors gracefully", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const mockProducts = [createMockProduct("20", "MVP", 10)];

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      (GetCurrentStock as jest.Mock) = jest.fn().mockRejectedValue(new Error("Database error"));

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      expect(WaitlistInsert).not.toHaveBeenCalled();
    });

    it("should handle WaitlistInsert errors gracefully", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const mockProducts = [createMockProduct("20", "MVP", 0)];

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      (GetCurrentStock as jest.Mock) = jest.fn().mockResolvedValue([{ mpid: "20", CurrentInStock: 5, CurrentInventory: 5 }]);

      (WaitlistInsert as jest.Mock) = jest.fn().mockRejectedValue(new Error("Insert failed"));

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      // Should continue processing despite error
    });

    it("should handle axios error with response data", async () => {
      mockCacheClient.get.mockResolvedValue(null);

      const axiosError = {
        response: {
          data: {
            message: "Invalid credentials",
          },
        },
        message: "Request failed",
      };

      (axiosHelper.postAsync as jest.Mock) = jest.fn().mockRejectedValue(axiosError);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(false);
    });

    it("should handle axios error without response data", async () => {
      mockCacheClient.get.mockResolvedValue(null);

      (axiosHelper.postAsync as jest.Mock) = jest.fn().mockRejectedValue(new Error("Network error"));

      const result = await getProductsFromMiniErp();

      expect(result).toBe(false);
    });

    it("should handle GraphQL error response", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const graphqlError = {
        response: {
          data: {
            errors: [{ message: "GraphQL error" }],
          },
        },
        message: "GraphQL request failed",
      };

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockRejectedValue(graphqlError);

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true); // Function returns true even on error
    });

    it("should handle missing MINI_ERP_BASE_URL", async () => {
      // Temporarily override the mocked config
      const originalConfig = (applicationConfig as any).MINI_ERP_BASE_URL;
      (applicationConfig as any).MINI_ERP_BASE_URL = undefined;

      mockCacheClient.get.mockResolvedValue(null);
      (axiosHelper.postAsync as jest.Mock) = jest.fn().mockResolvedValue({
        status: 200,
        data: mockLoginResponse,
      });

      // The function should return false when baseUrl is missing (caught in try-catch)
      const result = await getProductsFromMiniErp();
      expect(result).toBe(false);

      // Restore original config
      (applicationConfig as any).MINI_ERP_BASE_URL = originalConfig;
    });

    it("should handle items not being an array in response", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue({
        data: {
          getUpdatedProductsWithOffsetPagination: {
            items: "not-an-array",
            hasMore: false,
          },
        },
      });

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
    });

    it("should handle null products array", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse([], false));

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
    });

    it("should process products with zero inventory correctly", async () => {
      mockCacheClient.get.mockResolvedValue(mockLoginResponse);

      const mockProducts = [createMockProduct("20", "MVP", 0), createMockProduct("7956", "TRADENT", 0)];

      (axiosHelper.getProductsFromMiniErp as jest.Mock) = jest.fn().mockResolvedValue(createMockGraphQLResponse(mockProducts, false));

      (GetCurrentStock as jest.Mock) = jest.fn().mockResolvedValue([
        { mpid: "20", CurrentInStock: 10, CurrentInventory: 10 },
        { mpid: "7956", CurrentInStock: 0, CurrentInventory: 0 },
      ]);

      (WaitlistInsert as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // Mock isCancelled by mocking GetMiniErpCronDetails
      (GetMiniErpCronDetails as jest.Mock) = jest.fn().mockResolvedValue([{ CronName: "MiniErpFetchCron", CronStatus: true }]);

      const result = await getProductsFromMiniErp();

      expect(result).toBe(true);
      // Should only insert mpid1 (repricer has stock, miniErp doesn't)
      expect(WaitlistInsert).toHaveBeenCalledTimes(1);
      const waitlistCall = (WaitlistInsert as jest.Mock).mock.calls[0][0];
      expect(waitlistCall).toHaveLength(1);
      expect(waitlistCall[0].mp_id).toBe(Number("20"));
    });
  });
});
