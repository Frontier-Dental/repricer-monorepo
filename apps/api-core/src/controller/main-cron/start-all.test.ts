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
  },
}));

// Mock config BEFORE imports
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    CRON_NAME_422: "Cron-422",
    RUN_CRONS_ON_INIT: true,
    BATCH_SIZE: 700,
    _422_CACHE_VALID_PERIOD: 120,
  },
}));

import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { startAllCronHandler, startAllCronLogic } from "./start-all";
import * as shared from "./shared";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as sqlV2Service from "../../utility/mysql/mysql-v2";

// Mock all dependencies
jest.mock("./shared");
jest.mock("../../utility/mongo/db-helper");
jest.mock("../../utility/mysql/mysql-v2");

const mockStopAllMainCrons = shared.stopAllMainCrons as jest.MockedFunction<typeof shared.stopAllMainCrons>;
const mockSetCronAndStart = shared.setCronAndStart as jest.MockedFunction<typeof shared.setCronAndStart>;
const mockResetPendingCronLogs = dbHelper.ResetPendingCronLogs as jest.MockedFunction<typeof dbHelper.ResetPendingCronLogs>;
const mockGetCronSettingsList = sqlV2Service.GetCronSettingsList as jest.MockedFunction<typeof sqlV2Service.GetCronSettingsList>;

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("main-cron/start-all", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStatus: jest.Mock;
  let mockSend: jest.Mock;

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
      body: {},
    };

    // Default mock implementations
    mockResetPendingCronLogs.mockResolvedValue({ modifiedCount: 0 } as any);
    mockStopAllMainCrons.mockReturnValue(undefined);
    mockSetCronAndStart.mockReturnValue(undefined);
    mockGetCronSettingsList.mockResolvedValue([]);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("startAllCronHandler", () => {
    it("should start all crons and return success response", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
        {
          CronId: "2",
          CronName: "Cron-2",
          CronTimeUnit: "hours",
          CronTime: 2,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResetPendingCronLogs).toHaveBeenCalled();
      expect(mockStopAllMainCrons).toHaveBeenCalled();
      expect(mockGetCronSettingsList).toHaveBeenCalled();
      expect(mockSetCronAndStart).toHaveBeenCalledTimes(2);
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockSend).toHaveBeenCalledWith("Cron started.");
    });

    it("should handle errors in startAllCronLogic gracefully", async () => {
      const error = new Error("Database error");
      mockResetPendingCronLogs.mockRejectedValue(error);

      await expect(startAllCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Database error");

      expect(mockResetPendingCronLogs).toHaveBeenCalled();
    });

    it("should return correct response status and message", async () => {
      mockGetCronSettingsList.mockResolvedValue([]);

      await startAllCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledTimes(1);
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith("Cron started.");
    });
  });

  describe("startAllCronLogic", () => {
    it("should start all non-hidden crons successfully", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
        {
          CronId: "2",
          CronName: "Cron-2",
          CronTimeUnit: "hours",
          CronTime: 2,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
        {
          CronId: "3",
          CronName: "Cron-3",
          CronTimeUnit: "hours",
          CronTime: 3,
          Offset: "0",
          CronStatus: true,
          IsHidden: true, // This should be filtered out
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      expect(mockResetPendingCronLogs).toHaveBeenCalled();
      expect(mockStopAllMainCrons).toHaveBeenCalled();
      expect(mockGetCronSettingsList).toHaveBeenCalled();
      expect(mockSetCronAndStart).toHaveBeenCalledTimes(2); // Only non-hidden crons
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings[0]);
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-2", mockCronSettings[1]);
      expect(mockSetCronAndStart).not.toHaveBeenCalledWith("Cron-3", expect.anything());
    });

    it("should filter out hidden crons", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: true,
        },
        {
          CronId: "2",
          CronName: "Cron-2",
          CronTimeUnit: "hours",
          CronTime: 2,
          Offset: "0",
          CronStatus: true,
          IsHidden: true,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      expect(mockResetPendingCronLogs).toHaveBeenCalled();
      expect(mockStopAllMainCrons).toHaveBeenCalled();
      expect(mockGetCronSettingsList).toHaveBeenCalled();
      expect(mockSetCronAndStart).not.toHaveBeenCalled();
    });

    it("should handle empty cron settings list", async () => {
      mockGetCronSettingsList.mockResolvedValue([]);

      await startAllCronLogic();

      expect(mockResetPendingCronLogs).toHaveBeenCalled();
      expect(mockStopAllMainCrons).toHaveBeenCalled();
      expect(mockGetCronSettingsList).toHaveBeenCalled();
      expect(mockSetCronAndStart).not.toHaveBeenCalled();
    });

    it("should handle error in setCronAndStart and continue with other crons", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
        {
          CronId: "2",
          CronName: "Cron-2",
          CronTimeUnit: "hours",
          CronTime: 2,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);
      const error = new Error("Failed to set cron");
      mockSetCronAndStart
        .mockImplementationOnce(() => {
          throw error;
        })
        .mockImplementationOnce(() => {
          // Second call succeeds
        });

      await startAllCronLogic();

      expect(mockSetCronAndStart).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledWith(`Exception while initializing Cron : Cron-1 || ${error}`);
      // Second cron should still be processed
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-2", mockCronSettings[1]);
    });

    it("should handle multiple errors in setCronAndStart", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
        {
          CronId: "2",
          CronName: "Cron-2",
          CronTimeUnit: "hours",
          CronTime: 2,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
        {
          CronId: "3",
          CronName: "Cron-3",
          CronTimeUnit: "hours",
          CronTime: 3,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);
      const error1 = new Error("Error 1");
      const error2 = new Error("Error 2");
      mockSetCronAndStart
        .mockImplementationOnce(() => {
          throw error1;
        })
        .mockImplementationOnce(() => {
          throw error2;
        })
        .mockImplementationOnce(() => {
          // Third call succeeds
        });

      await startAllCronLogic();

      expect(mockSetCronAndStart).toHaveBeenCalledTimes(3);
      expect(console.error).toHaveBeenCalledWith(`Exception while initializing Cron : Cron-1 || ${error1}`);
      expect(console.error).toHaveBeenCalledWith(`Exception while initializing Cron : Cron-2 || ${error2}`);
      // Third cron should still be processed
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-3", mockCronSettings[2]);
    });

    it("should handle error in ResetPendingCronLogs", async () => {
      const error = new Error("Database error");
      mockResetPendingCronLogs.mockRejectedValue(error);

      await expect(startAllCronLogic()).rejects.toThrow("Database error");

      expect(mockResetPendingCronLogs).toHaveBeenCalled();
      expect(mockStopAllMainCrons).not.toHaveBeenCalled();
      expect(mockGetCronSettingsList).not.toHaveBeenCalled();
    });

    it("should handle error in GetCronSettingsList", async () => {
      const error = new Error("Failed to get cron settings");
      mockGetCronSettingsList.mockRejectedValue(error);

      await expect(startAllCronLogic()).rejects.toThrow("Failed to get cron settings");

      expect(mockResetPendingCronLogs).toHaveBeenCalled();
      expect(mockStopAllMainCrons).toHaveBeenCalled();
      expect(mockGetCronSettingsList).toHaveBeenCalled();
      expect(mockSetCronAndStart).not.toHaveBeenCalled();
    });

    it("should process crons in order", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
        {
          CronId: "2",
          CronName: "Cron-2",
          CronTimeUnit: "hours",
          CronTime: 2,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
        {
          CronId: "3",
          CronName: "Cron-3",
          CronTimeUnit: "hours",
          CronTime: 3,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      expect(mockSetCronAndStart).toHaveBeenCalledTimes(3);
      expect(mockSetCronAndStart).toHaveBeenNthCalledWith(1, "Cron-1", mockCronSettings[0]);
      expect(mockSetCronAndStart).toHaveBeenNthCalledWith(2, "Cron-2", mockCronSettings[1]);
      expect(mockSetCronAndStart).toHaveBeenNthCalledWith(3, "Cron-3", mockCronSettings[2]);
    });

    it("should handle mixed hidden and non-hidden crons", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
        {
          CronId: "2",
          CronName: "Cron-2",
          CronTimeUnit: "hours",
          CronTime: 2,
          Offset: "0",
          CronStatus: true,
          IsHidden: true, // Hidden
        },
        {
          CronId: "3",
          CronName: "Cron-3",
          CronTimeUnit: "hours",
          CronTime: 3,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
        {
          CronId: "4",
          CronName: "Cron-4",
          CronTimeUnit: "hours",
          CronTime: 4,
          Offset: "0",
          CronStatus: true,
          IsHidden: true, // Hidden
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      expect(mockSetCronAndStart).toHaveBeenCalledTimes(2);
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings[0]);
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-3", mockCronSettings[2]);
      expect(mockSetCronAndStart).not.toHaveBeenCalledWith("Cron-2", expect.anything());
      expect(mockSetCronAndStart).not.toHaveBeenCalledWith("Cron-4", expect.anything());
    });

    it("should handle cron settings with all properties", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
          SecretKey: [],
          CreatedTime: { $date: new Date().toISOString() },
          UpdatedTime: { $date: new Date().toISOString() },
          FixedIp: null,
          IpType: 1,
          ProxyProvider: 1,
          AlternateProxyProvider: [],
          AuditInfo: {
            UpdatedBy: "test",
            UpdatedOn: { $date: new Date().toISOString() },
          },
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings[0]);
    });

    it("should handle IsHidden as undefined (treat as not hidden)", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: undefined,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      // If IsHidden is undefined, !undefined is true, so it should be processed
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings[0]);
    });

    it("should handle IsHidden as null (treat as not hidden)", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: null,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      // If IsHidden is null, !null is true, so it should be processed
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings[0]);
    });

    it("should handle IsHidden as false explicitly", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings[0]);
    });

    it("should handle error with string exception message", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);
      const error = "String error message";
      mockSetCronAndStart.mockImplementationOnce(() => {
        throw error;
      });

      await startAllCronLogic();

      expect(console.error).toHaveBeenCalledWith(`Exception while initializing Cron : Cron-1 || ${error}`);
    });

    it("should handle error with Error object", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);
      const error = new Error("Error object");
      mockSetCronAndStart.mockImplementationOnce(() => {
        throw error;
      });

      await startAllCronLogic();

      expect(console.error).toHaveBeenCalledWith(`Exception while initializing Cron : Cron-1 || ${error}`);
    });

    it("should call ResetPendingCronLogs before other operations", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      const resetCallOrder = mockResetPendingCronLogs.mock.invocationCallOrder[0];
      const stopCallOrder = mockStopAllMainCrons.mock.invocationCallOrder[0];
      const getSettingsCallOrder = mockGetCronSettingsList.mock.invocationCallOrder[0];

      expect(resetCallOrder).toBeLessThan(stopCallOrder!);
      expect(stopCallOrder).toBeLessThan(getSettingsCallOrder!);
    });

    it("should call stopAllMainCrons before getting cron settings", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: true,
          IsHidden: false,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      const stopCallOrder = mockStopAllMainCrons.mock.invocationCallOrder[0];
      const getSettingsCallOrder = mockGetCronSettingsList.mock.invocationCallOrder[0];

      expect(stopCallOrder).toBeLessThan(getSettingsCallOrder!);
    });

    it("should handle large number of crons", async () => {
      const mockCronSettings = Array.from({ length: 100 }, (_, i) => ({
        CronId: `${i + 1}`,
        CronName: `Cron-${i + 1}`,
        CronTimeUnit: "hours",
        CronTime: 1,
        Offset: "0",
        CronStatus: true,
        IsHidden: false,
      }));

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      expect(mockSetCronAndStart).toHaveBeenCalledTimes(100);
      mockCronSettings.forEach((setting, index) => {
        expect(mockSetCronAndStart).toHaveBeenNthCalledWith(index + 1, setting.CronName, setting);
      });
    });

    it("should handle cron with CronStatus false", async () => {
      const mockCronSettings = [
        {
          CronId: "1",
          CronName: "Cron-1",
          CronTimeUnit: "hours",
          CronTime: 1,
          Offset: "0",
          CronStatus: false,
          IsHidden: false,
        },
      ];

      mockGetCronSettingsList.mockResolvedValue(mockCronSettings as any);

      await startAllCronLogic();

      // CronStatus doesn't affect filtering, only IsHidden does
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings[0]);
    });
  });
});
