// Mock dependencies before imports
jest.mock("../../../utility/config", () => ({
  applicationConfig: {
    MANAGED_MONGO_URL: "mongodb://test",
    MANAGED_MONGO_PASSWORD: "test-password",
    SQL_HOSTNAME: "localhost",
    SQL_PORT: 3306,
    SQL_USERNAME: "test-user",
    SQL_PASSWORD: "test-password",
    SQL_DATABASE: "test-db",
    SHIPPING_DATA_PROXY_SCRAPE_API_KEY: "test-api-key",
    CACHE_HOST_URL: "localhost",
    CACHE_USERNAME: "test-user",
    CACHE_PASSWORD: "test-password",
    CACHE_PORT: 6379,
    MINI_ERP_BASE_URL: "https://test-mini-erp.com",
    MINI_ERP_USERNAME: "test-user",
    MINI_ERP_PASSWORD: "test-password",
  },
}));

jest.mock("@repricer-monorepo/shared", () => ({
  CacheKey: {},
  VendorName: {},
  VendorNameLookup: {},
}));

jest.mock("../../../utility/mysql/mysql-v2");
jest.mock("../../../utility/response-utility");
jest.mock("node-cron");
jest.mock("../../../utility/mini-erp/min-erp-helper");
jest.mock("../../../services/net32-stock-update");
jest.mock("../shared", () => ({
  miniErpCrons: {},
}));

import { Request, Response } from "express";
import { startMiniErpCron, startMiniErpCronLogic } from "../start-cron";
import { GetMiniErpCronDetails } from "../../../utility/mysql/mysql-v2";
import * as _codes from "http-status-codes";
import * as responseUtility from "../../../utility/response-utility";
import cron from "node-cron";
import { getProductsFromMiniErp } from "../../../utility/mini-erp/min-erp-helper";
import { updateNet32Stock } from "../../../services/net32-stock-update";
import { miniErpCrons } from "../shared";

const mockedGetMiniErpCronDetails = GetMiniErpCronDetails as jest.MockedFunction<typeof GetMiniErpCronDetails>;
const mockedResponseUtility = responseUtility as jest.Mocked<typeof responseUtility>;
const mockedCron = cron as jest.Mocked<typeof cron>;
const mockedGetProductsFromMiniErp = getProductsFromMiniErp as jest.MockedFunction<typeof getProductsFromMiniErp>;
const mockedUpdateNet32Stock = updateNet32Stock as jest.MockedFunction<typeof updateNet32Stock>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("mini-erp-cron/start-cron", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockScheduledTask: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Clear miniErpCrons object
    Object.keys(miniErpCrons).forEach((key) => delete miniErpCrons[key]);

    // Mock ScheduledTask
    mockScheduledTask = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
    };

    // Mock cron.schedule to return a ScheduledTask
    mockedCron.schedule = jest.fn().mockReturnValue(mockScheduledTask as any) as any;

    // Mock Express request and response
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("startMiniErpCron", () => {
    it("should start mini ERP cron and return OK response", async () => {
      mockedGetMiniErpCronDetails.mockResolvedValue([]);

      await startMiniErpCron(mockRequest as Request, mockResponse as Response);

      expect(mockedGetMiniErpCronDetails).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(_codes.StatusCodes.OK);
      expect(mockResponse.send).toHaveBeenCalledWith("Cron started successfully");
    });

    it("should handle errors and still return OK response", async () => {
      mockedGetMiniErpCronDetails.mockRejectedValue(new Error("Database error"));

      await expect(startMiniErpCron(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Database error");
    });
  });

  describe("startMiniErpCronLogic", () => {
    it("should log start message", async () => {
      mockedGetMiniErpCronDetails.mockResolvedValue([]);

      await startMiniErpCronLogic();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Starting mini erp cron logic at"), expect.any(Date));
    });

    it("should schedule crons for all mini ERP cron details", async () => {
      const mockCronDetails = [
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "true",
        },
        {
          CronName: "StockUpdateCron",
          CronTimeUnit: "HOURS",
          CronTime: 2,
          Offset: "1",
          CronStatus: "true",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("0 * * * *");
      mockedGetProductsFromMiniErp.mockResolvedValue(true);
      mockedUpdateNet32Stock.mockResolvedValue(true);

      await startMiniErpCronLogic();

      expect(mockedGetMiniErpCronDetails).toHaveBeenCalled();
      expect(mockedCron.schedule).toHaveBeenCalledTimes(2);
      expect(mockedResponseUtility.GetCronGeneric).toHaveBeenCalledWith("MIN", 30, 0);
      expect(mockedResponseUtility.GetCronGeneric).toHaveBeenCalledWith("HOURS", 2, 1);
      expect(miniErpCrons["MiniErpFetchCron"]).toBe(mockScheduledTask);
      expect(miniErpCrons["StockUpdateCron"]).toBe(mockScheduledTask);
    });

    it("should call GetCronGeneric with parsed Offset", async () => {
      const mockCronDetails = [
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "5",
          CronStatus: "true",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedGetProductsFromMiniErp.mockResolvedValue(true);

      await startMiniErpCronLogic();

      expect(mockedResponseUtility.GetCronGeneric).toHaveBeenCalledWith("MIN", 30, 5);
    });

    it("should handle MiniErpFetchCron case", async () => {
      const mockCronDetails = [
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "true",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedGetProductsFromMiniErp.mockResolvedValue(true);

      await startMiniErpCronLogic();

      // Get the callback function passed to schedule
      const scheduleCall = mockedCron.schedule.mock.calls[0];
      const cronCallback = scheduleCall[1] as Function;

      // Execute the callback to simulate cron execution
      await cronCallback();

      expect(mockedGetProductsFromMiniErp).toHaveBeenCalled();
      expect(mockedUpdateNet32Stock).not.toHaveBeenCalled();
    });

    it("should handle StockUpdateCron case", async () => {
      const mockCronDetails = [
        {
          CronName: "StockUpdateCron",
          CronTimeUnit: "HOURS",
          CronTime: 2,
          Offset: "1",
          CronStatus: "true",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("0 */2 * * *");
      mockedUpdateNet32Stock.mockResolvedValue(true);

      await startMiniErpCronLogic();

      // Get the callback function passed to schedule
      const scheduleCall = mockedCron.schedule.mock.calls[0];
      const cronCallback = scheduleCall[1] as Function;

      // Execute the callback to simulate cron execution
      await cronCallback();

      expect(mockedUpdateNet32Stock).toHaveBeenCalled();
      expect(mockedGetProductsFromMiniErp).not.toHaveBeenCalled();
    });

    it("should handle default case for unknown cron name", async () => {
      const mockCronDetails = [
        {
          CronName: "UnknownCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "true",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");

      await startMiniErpCronLogic();

      // Get the callback function passed to schedule
      const scheduleCall = mockedCron.schedule.mock.calls[0];
      const cronCallback = scheduleCall[1] as Function;

      // Execute the callback to simulate cron execution
      await cronCallback();

      expect(console.error).toHaveBeenCalledWith("Cron UnknownCron not found");
      expect(mockedGetProductsFromMiniErp).not.toHaveBeenCalled();
      expect(mockedUpdateNet32Stock).not.toHaveBeenCalled();
    });

    it("should handle errors during cron execution", async () => {
      const mockCronDetails = [
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "true",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedGetProductsFromMiniErp.mockRejectedValue(new Error("Mini ERP error"));

      await startMiniErpCronLogic();

      // Get the callback function passed to schedule
      const scheduleCall = mockedCron.schedule.mock.calls[0];
      const cronCallback = scheduleCall[1] as Function;

      // Execute the callback to simulate cron execution
      await cronCallback();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error running MiniErpFetchCron:"), expect.any(Error));
    });

    it("should log when cron is started with status true", async () => {
      const mockCronDetails = [
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "true",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedGetProductsFromMiniErp.mockResolvedValue(true);

      await startMiniErpCronLogic();

      expect(console.log).toHaveBeenCalledWith("Started MiniErpFetchCron");
    });

    it("should not log when cron status is false", async () => {
      const mockCronDetails = [
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "false",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedGetProductsFromMiniErp.mockResolvedValue(true);

      await startMiniErpCronLogic();

      expect(mockedCron.schedule).toHaveBeenCalledWith("*/30 * * * *", expect.any(Function), { scheduled: false });
      expect(console.log).not.toHaveBeenCalledWith("Started MiniErpFetchCron");
    });

    it("should handle empty cron details array", async () => {
      mockedGetMiniErpCronDetails.mockResolvedValue([]);

      await startMiniErpCronLogic();

      expect(mockedGetMiniErpCronDetails).toHaveBeenCalled();
      expect(mockedCron.schedule).not.toHaveBeenCalled();
      expect(Object.keys(miniErpCrons)).toHaveLength(0);
    });

    it("should handle null cron details", async () => {
      mockedGetMiniErpCronDetails.mockResolvedValue(null as any);

      await startMiniErpCronLogic();

      expect(mockedGetMiniErpCronDetails).toHaveBeenCalled();
      expect(mockedCron.schedule).not.toHaveBeenCalled();
    });

    it("should handle null/undefined cronDetail in array", async () => {
      const mockCronDetails = [
        null,
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "true",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails as any);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedGetProductsFromMiniErp.mockResolvedValue(true);

      await startMiniErpCronLogic();

      // Should only schedule the non-null cron
      expect(mockedCron.schedule).toHaveBeenCalledTimes(1);
      expect(miniErpCrons["MiniErpFetchCron"]).toBe(mockScheduledTask);
    });

    it("should handle multiple crons with mixed status values", async () => {
      const mockCronDetails = [
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "true",
        },
        {
          CronName: "StockUpdateCron",
          CronTimeUnit: "HOURS",
          CronTime: 2,
          Offset: "1",
          CronStatus: "false",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("0 * * * *");
      mockedGetProductsFromMiniErp.mockResolvedValue(true);
      mockedUpdateNet32Stock.mockResolvedValue(true);

      await startMiniErpCronLogic();

      expect(mockedCron.schedule).toHaveBeenCalledTimes(2);
      expect(mockedCron.schedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function), { scheduled: true });
      expect(mockedCron.schedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function), { scheduled: false });
      expect(console.log).toHaveBeenCalledTimes(2); // Start message + one "Started" log
    });

    it("should parse CronStatus as JSON boolean", async () => {
      const mockCronDetails = [
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "true", // String "true" should be parsed as boolean
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedGetProductsFromMiniErp.mockResolvedValue(true);

      await startMiniErpCronLogic();

      expect(mockedCron.schedule).toHaveBeenCalledWith("*/30 * * * *", expect.any(Function), { scheduled: true });
    });

    it("should handle status as string false", async () => {
      const mockCronDetails = [
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "false",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedGetProductsFromMiniErp.mockResolvedValue(true);

      await startMiniErpCronLogic();

      expect(mockedCron.schedule).toHaveBeenCalledWith("*/30 * * * *", expect.any(Function), { scheduled: false });
    });

    it("should handle successful execution of both cron types", async () => {
      const mockCronDetails = [
        {
          CronName: "MiniErpFetchCron",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: "0",
          CronStatus: "true",
        },
        {
          CronName: "StockUpdateCron",
          CronTimeUnit: "HOURS",
          CronTime: 2,
          Offset: "1",
          CronStatus: "true",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("0 * * * *");
      mockedGetProductsFromMiniErp.mockResolvedValue(true);
      mockedUpdateNet32Stock.mockResolvedValue(true);

      await startMiniErpCronLogic();

      // Execute both callbacks
      const scheduleCalls = mockedCron.schedule.mock.calls;
      const miniErpCallback = scheduleCalls[0][1] as Function;
      const stockUpdateCallback = scheduleCalls[1][1] as Function;

      await miniErpCallback();
      await stockUpdateCallback();

      expect(mockedGetProductsFromMiniErp).toHaveBeenCalled();
      expect(mockedUpdateNet32Stock).toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should handle errors in StockUpdateCron execution", async () => {
      const mockCronDetails = [
        {
          CronName: "StockUpdateCron",
          CronTimeUnit: "HOURS",
          CronTime: 2,
          Offset: "1",
          CronStatus: "true",
        },
      ];

      mockedGetMiniErpCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("0 */2 * * *");
      mockedUpdateNet32Stock.mockRejectedValue(new Error("Stock update error"));

      await startMiniErpCronLogic();

      // Get the callback function passed to schedule
      const scheduleCall = mockedCron.schedule.mock.calls[0];
      const cronCallback = scheduleCall[1] as Function;

      // Execute the callback to simulate cron execution
      await cronCallback();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error running StockUpdateCron:"), expect.any(Error));
    });
  });
});
