// Mock dependencies before imports
jest.mock("../../utility/config", () => ({
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

jest.mock("../../utility/response-utility");
jest.mock("../main-cron/shared");
jest.mock("./shared", () => ({
  slowCrons: {},
  getCronNameByJobName: jest.fn(),
}));
jest.mock("node-cron");
jest.mock("../../utility/mysql/mysql-v2");

import { Request, Response } from "express";
import cron from "node-cron";
import { startAllSlowCronHandler, startSlowCronLogic } from "./start";
import * as responseUtility from "../../utility/response-utility";
import * as _codes from "http-status-codes";
import { runCoreCronLogic } from "../main-cron/shared";
import { slowCrons, getCronNameByJobName } from "./shared";
import { GetSlowCronDetails } from "../../utility/mysql/mysql-v2";

const mockedResponseUtility = responseUtility as jest.Mocked<typeof responseUtility>;
const mockedRunCoreCronLogic = runCoreCronLogic as jest.MockedFunction<typeof runCoreCronLogic>;
const mockedGetCronNameByJobName = getCronNameByJobName as jest.MockedFunction<typeof getCronNameByJobName>;
const mockedCron = cron as jest.Mocked<typeof cron>;
const mockedGetSlowCronDetails = GetSlowCronDetails as jest.MockedFunction<typeof GetSlowCronDetails>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("slow-cron-group/start", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockScheduledTask: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Clear slowCrons object
    Object.keys(slowCrons).forEach((key) => delete slowCrons[key]);

    // Mock ScheduledTask
    mockScheduledTask = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
    };

    // Mock cron.schedule to return a ScheduledTask
    mockedCron.schedule = jest.fn().mockReturnValue(mockScheduledTask as any) as any;

    // Mock getCronNameByJobName
    mockedGetCronNameByJobName.mockImplementation((jobName: string) => {
      switch (jobName) {
        case "_SCG1Cron":
          return "SCG-1";
        case "_SCG2Cron":
          return "SCG-2";
        case "_SCG3Cron":
          return "SCG-3";
        default:
          throw new Error(`Invalid job name: ${jobName}`);
      }
    });

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

  describe("startAllSlowCronHandler", () => {
    it("should start slow cron and return OK response", async () => {
      mockedGetSlowCronDetails.mockResolvedValue([]);

      await startAllSlowCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockedGetSlowCronDetails).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(_codes.StatusCodes.OK);
      expect(mockResponse.send).toHaveBeenCalledWith("Slow cron started successfully");
    });

    it("should handle errors and still return OK response", async () => {
      mockedGetSlowCronDetails.mockRejectedValue(new Error("Database error"));

      await expect(startAllSlowCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Database error");
    });
  });

  describe("startSlowCronLogic", () => {
    it("should schedule crons for all slow cron details", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
        {
          CronName: "SCG-2",
          CronTimeUnit: "HOURS",
          CronTime: 2,
          Offset: 1,
          CronStatus: "true",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("0 * * * *");
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      expect(mockedGetSlowCronDetails).toHaveBeenCalled();
      expect(mockedCron.schedule).toHaveBeenCalledTimes(2);
      expect(mockedGetCronNameByJobName).toHaveBeenCalledWith("_SCG1Cron");
      expect(mockedGetCronNameByJobName).toHaveBeenCalledWith("_SCG2Cron");
      expect(slowCrons["SCG-1"]).toBe(mockScheduledTask);
      expect(slowCrons["SCG-2"]).toBe(mockScheduledTask);
    });

    it("should call GetCronGeneric with correct parameters", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 5,
          CronStatus: "true",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      expect(mockedResponseUtility.GetCronGeneric).toHaveBeenCalledWith("MIN", 30, 5);
    });

    it("should log when cron is started with status true", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Started SCG-1"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("*/30 * * * *"));
    });

    it("should not log when cron status is false", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "false",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      expect(mockedCron.schedule).toHaveBeenCalledWith("*/30 * * * *", expect.any(Function), { scheduled: false });
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("Started SCG-1"));
    });

    it("should handle empty slow cron details array", async () => {
      mockedGetSlowCronDetails.mockResolvedValue([]);

      await startSlowCronLogic();

      expect(mockedGetSlowCronDetails).toHaveBeenCalled();
      expect(mockedCron.schedule).not.toHaveBeenCalled();
      expect(Object.keys(slowCrons)).toHaveLength(0);
    });

    it("should handle null slow cron details", async () => {
      mockedGetSlowCronDetails.mockResolvedValue(null as any);

      await startSlowCronLogic();

      expect(mockedGetSlowCronDetails).toHaveBeenCalled();
      expect(mockedCron.schedule).not.toHaveBeenCalled();
    });

    it("should handle errors during cron initialization", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("invalid-expression");
      mockedCron.schedule.mockImplementation(() => {
        throw new Error("Invalid cron expression");
      });

      await startSlowCronLogic();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error running SCG-1:"), expect.any(Error));
    });

    it("should handle errors during cron execution", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedRunCoreCronLogic.mockRejectedValue(new Error("Core cron error"));

      await startSlowCronLogic();

      // Get the callback function passed to schedule
      const scheduleCall = mockedCron.schedule.mock.calls[0];
      const cronCallback = scheduleCall[1] as Function;

      // Execute the callback to simulate cron execution
      await cronCallback();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error running SCG-1:"), expect.any(Error));
    });

    it("should handle successful cron execution", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      // Get the callback function passed to schedule
      const scheduleCall = mockedCron.schedule.mock.calls[0];
      const cronCallback = scheduleCall[1] as Function;

      // Execute the callback to simulate cron execution
      await cronCallback();

      expect(mockedRunCoreCronLogic).toHaveBeenCalledWith(mockCronDetails[0], true);
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should handle null/undefined cronDetail", async () => {
      const mockCronDetails = [
        null,
        {
          CronName: "SCG-2",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails as any);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      // Should only schedule the non-null cron
      expect(mockedCron.schedule).toHaveBeenCalledTimes(1);
      expect(mockedGetCronNameByJobName).toHaveBeenCalledWith("_SCG2Cron");
      expect(slowCrons["SCG-2"]).toBe(mockScheduledTask);
    });

    it("should handle multiple crons with mixed status values", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
        {
          CronName: "SCG-2",
          CronTimeUnit: "HOURS",
          CronTime: 2,
          Offset: 1,
          CronStatus: "false",
        },
        {
          CronName: "SCG-3",
          CronTimeUnit: "MIN",
          CronTime: 15,
          Offset: 0,
          CronStatus: "true",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("0 * * * *");
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      expect(mockedCron.schedule).toHaveBeenCalledTimes(3);
      expect(mockedCron.schedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function), { scheduled: true });
      expect(mockedCron.schedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function), { scheduled: false });
      expect(console.log).toHaveBeenCalledTimes(2); // Only for status "true" crons
    });

    it("should continue processing other crons when one fails", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
        {
          CronName: "SCG-2",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedCron.schedule
        .mockImplementationOnce(() => {
          throw new Error("Invalid expression");
        })
        .mockReturnValueOnce(mockScheduledTask as any);
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      expect(mockedCron.schedule).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error running SCG-1:"), expect.any(Error));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Started SCG-2"));
      expect(slowCrons["SCG-2"]).toBe(mockScheduledTask);
    });

    it("should parse CronStatus as JSON boolean", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true", // String "true" should be parsed as boolean
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      expect(mockedCron.schedule).toHaveBeenCalledWith("*/30 * * * *", expect.any(Function), { scheduled: true });
    });

    it("should handle status as string false", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "false",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      expect(mockedCron.schedule).toHaveBeenCalledWith("*/30 * * * *", expect.any(Function), { scheduled: false });
    });

    it("should generate correct job names for each index", async () => {
      const mockCronDetails = [
        {
          CronName: "SCG-1",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
        {
          CronName: "SCG-2",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
        {
          CronName: "SCG-3",
          CronTimeUnit: "MIN",
          CronTime: 30,
          Offset: 0,
          CronStatus: "true",
        },
      ];

      mockedGetSlowCronDetails.mockResolvedValue(mockCronDetails);
      mockedResponseUtility.GetCronGeneric.mockReturnValue("*/30 * * * *");
      mockedRunCoreCronLogic.mockResolvedValue(undefined);

      await startSlowCronLogic();

      expect(mockedGetCronNameByJobName).toHaveBeenCalledWith("_SCG1Cron");
      expect(mockedGetCronNameByJobName).toHaveBeenCalledWith("_SCG2Cron");
      expect(mockedGetCronNameByJobName).toHaveBeenCalledWith("_SCG3Cron");
    });
  });
});
