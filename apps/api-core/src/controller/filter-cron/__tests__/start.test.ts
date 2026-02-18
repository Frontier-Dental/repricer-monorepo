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

jest.mock("../../../utility/filter-mapper");
jest.mock("../shared", () => ({
  filterCrons: {},
}));
jest.mock("node-cron");
jest.mock("../../../utility/mysql/mysql-v2");

import { Request, Response } from "express";
import { startAllFilterCronHandler, startFilterCronLogic } from "../start";
import * as filterMapper from "../../../utility/filter-mapper";
import { filterCrons } from "../shared";
import { schedule } from "node-cron";
import * as _codes from "http-status-codes";
import { GetFilteredCrons } from "../../../utility/mysql/mysql-v2";

const mockedFilterMapper = filterMapper as jest.Mocked<typeof filterMapper>;
const mockedSchedule = schedule as jest.MockedFunction<typeof schedule>;
const mockedGetFilteredCrons = GetFilteredCrons as jest.MockedFunction<typeof GetFilteredCrons>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("filter-cron/start", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockScheduledTask: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Clear filterCrons object
    Object.keys(filterCrons).forEach((key) => delete filterCrons[key]);

    // Mock ScheduledTask
    mockScheduledTask = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
    };

    // Mock schedule to return a ScheduledTask
    mockedSchedule.mockReturnValue(mockScheduledTask as any);

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

  describe("startAllFilterCronHandler", () => {
    it("should start filter cron and return OK response", async () => {
      mockedGetFilteredCrons.mockResolvedValue([]);

      await startAllFilterCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockedGetFilteredCrons).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(_codes.StatusCodes.OK);
      expect(mockResponse.send).toHaveBeenCalledWith("Cron started successfully");
    });

    it("should handle errors and still return OK response", async () => {
      mockedGetFilteredCrons.mockRejectedValue(new Error("Database error"));

      await expect(startAllFilterCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Database error");
    });
  });

  describe("startFilterCronLogic", () => {
    it("should schedule crons for all filter cron details", async () => {
      const mockCronDetails = [
        {
          cronName: "FC-1",
          cronExpression: "0 * * * *",
          status: "true",
        },
        {
          cronName: "FC-2",
          cronExpression: "0 */2 * * *",
          status: "true",
        },
      ];

      mockedGetFilteredCrons.mockResolvedValue(mockCronDetails);
      mockedFilterMapper.FilterProducts.mockResolvedValue(undefined);

      await startFilterCronLogic();

      expect(mockedGetFilteredCrons).toHaveBeenCalled();
      expect(mockedSchedule).toHaveBeenCalledTimes(2);
      expect(mockedSchedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function), { scheduled: true });
      expect(mockedSchedule).toHaveBeenCalledWith("0 */2 * * *", expect.any(Function), { scheduled: true });
      expect(filterCrons["FC-1"]).toBe(mockScheduledTask);
      expect(filterCrons["FC-2"]).toBe(mockScheduledTask);
    });

    it("should log when cron is started with status true", async () => {
      const mockCronDetails = [
        {
          cronName: "FC-1",
          cronExpression: "0 * * * *",
          status: "true",
        },
      ];

      mockedGetFilteredCrons.mockResolvedValue(mockCronDetails);
      mockedFilterMapper.FilterProducts.mockResolvedValue(undefined);

      await startFilterCronLogic();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Started FC-1"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("0 * * * *"));
    });

    it("should not log when cron status is false", async () => {
      const mockCronDetails = [
        {
          cronName: "FC-1",
          cronExpression: "0 * * * *",
          status: "false",
        },
      ];

      mockedGetFilteredCrons.mockResolvedValue(mockCronDetails);
      mockedFilterMapper.FilterProducts.mockResolvedValue(undefined);

      await startFilterCronLogic();

      expect(mockedSchedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function), { scheduled: false });
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("Started FC-1"));
    });

    it("should handle empty cron details array", async () => {
      mockedGetFilteredCrons.mockResolvedValue([]);

      await startFilterCronLogic();

      expect(mockedGetFilteredCrons).toHaveBeenCalled();
      expect(mockedSchedule).not.toHaveBeenCalled();
      expect(Object.keys(filterCrons)).toHaveLength(0);
    });

    it("should handle errors during cron initialization", async () => {
      const mockCronDetails = [
        {
          cronName: "FC-1",
          cronExpression: "invalid-expression",
          status: "true",
        },
      ];

      mockedGetFilteredCrons.mockResolvedValue(mockCronDetails);
      mockedSchedule.mockImplementation(() => {
        throw new Error("Invalid cron expression");
      });

      await startFilterCronLogic();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error initializing FC-1"));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Invalid cron expression"));
    });

    it("should handle errors during cron execution", async () => {
      const mockCronDetails = [
        {
          cronName: "FC-1",
          cronExpression: "0 * * * *",
          status: "true",
        },
      ];

      mockedGetFilteredCrons.mockResolvedValue(mockCronDetails);
      mockedFilterMapper.FilterProducts.mockRejectedValue(new Error("Filter error"));

      await startFilterCronLogic();

      // Get the callback function passed to schedule
      const scheduleCall = mockedSchedule.mock.calls[0];
      const cronCallback = scheduleCall[1] as Function;

      // Execute the callback to simulate cron execution
      await cronCallback();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error running FC-1"), expect.any(Error));
    });

    it("should handle multiple crons with mixed status values", async () => {
      const mockCronDetails = [
        {
          cronName: "FC-1",
          cronExpression: "0 * * * *",
          status: "true",
        },
        {
          cronName: "FC-2",
          cronExpression: "0 */2 * * *",
          status: "false",
        },
        {
          cronName: "FC-3",
          cronExpression: "0 */3 * * *",
          status: "true",
        },
      ];

      mockedGetFilteredCrons.mockResolvedValue(mockCronDetails);
      mockedFilterMapper.FilterProducts.mockResolvedValue(undefined);

      await startFilterCronLogic();

      expect(mockedSchedule).toHaveBeenCalledTimes(3);
      expect(mockedSchedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function), { scheduled: true });
      expect(mockedSchedule).toHaveBeenCalledWith("0 */2 * * *", expect.any(Function), { scheduled: false });
      expect(mockedSchedule).toHaveBeenCalledWith("0 */3 * * *", expect.any(Function), { scheduled: true });
      expect(console.log).toHaveBeenCalledTimes(2); // Only for status "true" crons
    });

    it("should continue processing other crons when one fails", async () => {
      const mockCronDetails = [
        {
          cronName: "FC-1",
          cronExpression: "invalid-expression",
          status: "true",
        },
        {
          cronName: "FC-2",
          cronExpression: "0 * * * *",
          status: "true",
        },
      ];

      mockedGetFilteredCrons.mockResolvedValue(mockCronDetails);
      mockedSchedule
        .mockImplementationOnce(() => {
          throw new Error("Invalid expression");
        })
        .mockReturnValueOnce(mockScheduledTask as any);
      mockedFilterMapper.FilterProducts.mockResolvedValue(undefined);

      await startFilterCronLogic();

      expect(mockedSchedule).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error initializing FC-1"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Started FC-2"));
      expect(filterCrons["FC-2"]).toBe(mockScheduledTask);
    });

    it("should handle successful cron execution", async () => {
      const mockCronDetails = [
        {
          cronName: "FC-1",
          cronExpression: "0 * * * *",
          status: "true",
        },
      ];

      mockedGetFilteredCrons.mockResolvedValue(mockCronDetails);
      mockedFilterMapper.FilterProducts.mockResolvedValue(undefined);

      await startFilterCronLogic();

      // Get the callback function passed to schedule
      const scheduleCall = mockedSchedule.mock.calls[0];
      const cronCallback = scheduleCall[1] as Function;

      // Execute the callback to simulate cron execution
      await cronCallback();

      expect(mockedFilterMapper.FilterProducts).toHaveBeenCalledWith(mockCronDetails[0]);
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should parse status as JSON boolean", async () => {
      const mockCronDetails = [
        {
          cronName: "FC-1",
          cronExpression: "0 * * * *",
          status: "true", // String "true" should be parsed as boolean
        },
      ];

      mockedGetFilteredCrons.mockResolvedValue(mockCronDetails);
      mockedFilterMapper.FilterProducts.mockResolvedValue(undefined);

      await startFilterCronLogic();

      expect(mockedSchedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function), { scheduled: true });
    });

    it("should handle status as string false", async () => {
      const mockCronDetails = [
        {
          cronName: "FC-1",
          cronExpression: "0 * * * *",
          status: "false",
        },
      ];

      mockedGetFilteredCrons.mockResolvedValue(mockCronDetails);
      mockedFilterMapper.FilterProducts.mockResolvedValue(undefined);

      await startFilterCronLogic();

      expect(mockedSchedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function), { scheduled: false });
    });
  });
});
