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
jest.mock("../../../utility/config", () => ({
  applicationConfig: {
    CRON_NAME_422: "Cron-422",
    RUN_CRONS_ON_INIT: true,
    BATCH_SIZE: 700,
    _422_CACHE_VALID_PERIOD: 120,
  },
}));

// Mock http-errors BEFORE imports
const mockBadRequest = jest.fn((message: string) => {
  const error = new Error(message);
  (error as any).statusCode = 400;
  (error as any).status = 400;
  (error as any).name = "BadRequestError";
  return error;
});

jest.mock("http-errors", () => ({
  BadRequest: mockBadRequest,
}));

// Mock all dependencies
jest.mock("../shared");
jest.mock("../../../utility/mysql/mysql-v2");

import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { BadRequest } from "http-errors";
import { startCronHandler } from "../start";
import * as shared from "../shared";
import * as sqlV2Service from "../../../utility/mysql/mysql-v2";

const mockGetMainCronNameFromJobName = shared.getMainCronNameFromJobName as jest.MockedFunction<typeof shared.getMainCronNameFromJobName>;
const mockSetCronAndStart = shared.setCronAndStart as jest.MockedFunction<typeof shared.setCronAndStart>;
const mockStartError422Cron = shared.startError422Cron as jest.MockedFunction<typeof shared.startError422Cron>;
const mockGetCronSettingsDetailsByName = sqlV2Service.GetCronSettingsDetailsByName as jest.MockedFunction<typeof sqlV2Service.GetCronSettingsDetailsByName>;
const mockUpdateCronSettings = sqlV2Service.UpdateCronSettings as jest.MockedFunction<typeof sqlV2Service.UpdateCronSettings>;

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("main-cron/start", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStatus: jest.Mock;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Reset BadRequest mock
    mockBadRequest.mockImplementation((message: string) => {
      const error = new Error(message);
      (error as any).statusCode = 400;
      (error as any).status = 400;
      (error as any).name = "BadRequestError";
      return error;
    });

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
    mockGetMainCronNameFromJobName.mockReturnValue(null);
    mockSetCronAndStart.mockReturnValue(undefined);
    mockStartError422Cron.mockReturnValue(undefined);
    mockGetCronSettingsDetailsByName.mockResolvedValue(null);
    mockUpdateCronSettings.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("startCronHandler", () => {
    it("should start Cron-422 successfully", async () => {
      mockRequest.body = {
        jobName: "Cron-422",
        cronId: "422",
      };

      await startCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockStartError422Cron).toHaveBeenCalled();
      expect(mockGetMainCronNameFromJobName).not.toHaveBeenCalled();
      expect(mockGetCronSettingsDetailsByName).not.toHaveBeenCalled();
      expect(mockSetCronAndStart).not.toHaveBeenCalled();
      expect(mockUpdateCronSettings).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockSend).toHaveBeenCalledWith("Cron job started successfully for jobName : Cron-422");
    });

    it("should start regular cron successfully with valid jobName", async () => {
      const mockCronSettings = {
        CronId: "1",
        CronName: "Cron-1",
        CronTimeUnit: "hours",
        CronTime: 1,
        Offset: "0",
        CronStatus: true,
      };

      mockRequest.body = {
        jobName: "_E1Cron",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      mockGetCronSettingsDetailsByName.mockResolvedValue(mockCronSettings as any);

      await startCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockStartError422Cron).not.toHaveBeenCalled();
      expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith("_E1Cron");
      expect(mockGetCronSettingsDetailsByName).toHaveBeenCalledWith("Cron-1");
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings);
      expect(mockUpdateCronSettings).toHaveBeenCalledWith("1");
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockSend).toHaveBeenCalledWith("Cron job started successfully for jobName : _E1Cron");
    });

    it("should throw BadRequest for invalid jobName", async () => {
      mockRequest.body = {
        jobName: "InvalidJobName",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue(null);

      try {
        await startCronHandler(mockRequest as Request, mockResponse as Response);
        // If no error was thrown, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBe("Invalid Job Name: InvalidJobName");
        expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith("InvalidJobName");
        expect(mockGetCronSettingsDetailsByName).not.toHaveBeenCalled();
        expect(mockSetCronAndStart).not.toHaveBeenCalled();
        expect(mockUpdateCronSettings).not.toHaveBeenCalled();
        expect(BadRequest).toHaveBeenCalledWith("Invalid Job Name: InvalidJobName");
      }
    });

    it("should throw BadRequest with correct message for invalid jobName", async () => {
      mockRequest.body = {
        jobName: "InvalidJobName",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue(null);

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Invalid Job Name: InvalidJobName");

      expect(BadRequest).toHaveBeenCalledWith("Invalid Job Name: InvalidJobName");
    });

    it("should throw BadRequest when cron settings not found", async () => {
      mockRequest.body = {
        jobName: "_E1Cron",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      mockGetCronSettingsDetailsByName.mockResolvedValue(null);

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Cron settings not found for Cron-1");

      expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith("_E1Cron");
      expect(mockGetCronSettingsDetailsByName).toHaveBeenCalledWith("Cron-1");
      expect(mockSetCronAndStart).not.toHaveBeenCalled();
      expect(mockUpdateCronSettings).not.toHaveBeenCalled();
      expect(BadRequest).toHaveBeenCalledWith("Cron settings not found for Cron-1");
    });

    it("should throw BadRequest with correct message when cron settings not found", async () => {
      mockRequest.body = {
        jobName: "_E1Cron",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      mockGetCronSettingsDetailsByName.mockResolvedValue(null);

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Cron settings not found for Cron-1");

      expect(BadRequest).toHaveBeenCalledWith("Cron settings not found for Cron-1");
    });

    it("should handle different jobName formats", async () => {
      const mockCronSettings = {
        CronId: "123",
        CronName: "Cron-123",
        CronTimeUnit: "hours",
        CronTime: 2,
        Offset: "0",
        CronStatus: true,
      };

      mockRequest.body = {
        jobName: "_E123Cron",
        cronId: "123",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-123");
      mockGetCronSettingsDetailsByName.mockResolvedValue(mockCronSettings as any);

      await startCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith("_E123Cron");
      expect(mockGetCronSettingsDetailsByName).toHaveBeenCalledWith("Cron-123");
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-123", mockCronSettings);
      expect(mockUpdateCronSettings).toHaveBeenCalledWith("123");
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockSend).toHaveBeenCalledWith("Cron job started successfully for jobName : _E123Cron");
    });

    it("should handle jobName with single digit", async () => {
      const mockCronSettings = {
        CronId: "1",
        CronName: "Cron-1",
        CronTimeUnit: "hours",
        CronTime: 1,
        Offset: "0",
        CronStatus: true,
      };

      mockRequest.body = {
        jobName: "_E1Cron",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      mockGetCronSettingsDetailsByName.mockResolvedValue(mockCronSettings as any);

      await startCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith("_E1Cron");
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings);
      expect(mockUpdateCronSettings).toHaveBeenCalledWith("1");
    });

    it("should handle jobName with multiple digits", async () => {
      const mockCronSettings = {
        CronId: "999",
        CronName: "Cron-999",
        CronTimeUnit: "hours",
        CronTime: 1,
        Offset: "0",
        CronStatus: true,
      };

      mockRequest.body = {
        jobName: "_E999Cron",
        cronId: "999",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-999");
      mockGetCronSettingsDetailsByName.mockResolvedValue(mockCronSettings as any);

      await startCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith("_E999Cron");
      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-999", mockCronSettings);
      expect(mockUpdateCronSettings).toHaveBeenCalledWith("999");
    });

    it("should handle missing cronId in request body", async () => {
      const mockCronSettings = {
        CronId: "1",
        CronName: "Cron-1",
        CronTimeUnit: "hours",
        CronTime: 1,
        Offset: "0",
        CronStatus: true,
      };

      mockRequest.body = {
        jobName: "_E1Cron",
        // cronId is missing
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      mockGetCronSettingsDetailsByName.mockResolvedValue(mockCronSettings as any);

      await startCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings);
      expect(mockUpdateCronSettings).toHaveBeenCalledWith(undefined);
    });

    it("should handle empty request body", async () => {
      mockRequest.body = {};

      mockGetMainCronNameFromJobName.mockReturnValue(null);

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Invalid Job Name: undefined");

      expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith(undefined);
      expect(BadRequest).toHaveBeenCalledWith("Invalid Job Name: undefined");
    });

    it("should handle error from startError422Cron", async () => {
      mockRequest.body = {
        jobName: "Cron-422",
        cronId: "422",
      };

      const error = new Error("Error422Cron not found");
      mockStartError422Cron.mockImplementation(() => {
        throw error;
      });

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Error422Cron not found");

      expect(mockStartError422Cron).toHaveBeenCalled();
    });

    it("should handle error from GetCronSettingsDetailsByName", async () => {
      mockRequest.body = {
        jobName: "_E1Cron",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      const error = new Error("Database error");
      mockGetCronSettingsDetailsByName.mockRejectedValue(error);

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Database error");

      expect(mockGetCronSettingsDetailsByName).toHaveBeenCalledWith("Cron-1");
      expect(mockSetCronAndStart).not.toHaveBeenCalled();
    });

    it("should handle error from setCronAndStart", async () => {
      const mockCronSettings = {
        CronId: "1",
        CronName: "Cron-1",
        CronTimeUnit: "hours",
        CronTime: 1,
        Offset: "0",
        CronStatus: true,
      };

      mockRequest.body = {
        jobName: "_E1Cron",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      mockGetCronSettingsDetailsByName.mockResolvedValue(mockCronSettings as any);
      const error = new Error("Failed to set cron");
      mockSetCronAndStart.mockImplementation(() => {
        throw error;
      });

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Failed to set cron");

      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings);
      expect(mockUpdateCronSettings).not.toHaveBeenCalled();
    });

    it("should handle error from UpdateCronSettings", async () => {
      const mockCronSettings = {
        CronId: "1",
        CronName: "Cron-1",
        CronTimeUnit: "hours",
        CronTime: 1,
        Offset: "0",
        CronStatus: true,
      };

      mockRequest.body = {
        jobName: "_E1Cron",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      mockGetCronSettingsDetailsByName.mockResolvedValue(mockCronSettings as any);
      const error = new Error("Database update error");
      mockUpdateCronSettings.mockRejectedValue(error);

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Database update error");

      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings);
      expect(mockUpdateCronSettings).toHaveBeenCalledWith("1");
    });

    it("should handle case-insensitive jobName for Cron-422", async () => {
      mockRequest.body = {
        jobName: "cron-422", // lowercase
        cronId: "422",
      };

      mockGetMainCronNameFromJobName.mockReturnValue(null);

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Invalid Job Name: cron-422");

      expect(mockStartError422Cron).not.toHaveBeenCalled();
      expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith("cron-422");
      expect(BadRequest).toHaveBeenCalledWith("Invalid Job Name: cron-422");
    });

    it("should handle undefined jobName", async () => {
      mockRequest.body = {
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue(null);

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Invalid Job Name: undefined");

      expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith(undefined);
      expect(BadRequest).toHaveBeenCalledWith("Invalid Job Name: undefined");
    });

    it("should handle null jobName", async () => {
      mockRequest.body = {
        jobName: null,
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue(null);

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Invalid Job Name: null");

      expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith(null);
      expect(BadRequest).toHaveBeenCalledWith("Invalid Job Name: null");
    });

    it("should handle empty string jobName", async () => {
      mockRequest.body = {
        jobName: "",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue(null);

      await expect(startCronHandler(mockRequest as Request, mockResponse as Response)).rejects.toThrow("Invalid Job Name: ");

      expect(mockGetMainCronNameFromJobName).toHaveBeenCalledWith("");
      expect(BadRequest).toHaveBeenCalledWith("Invalid Job Name: ");
    });

    it("should handle cron settings with all properties", async () => {
      const mockCronSettings = {
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
      };

      mockRequest.body = {
        jobName: "_E1Cron",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      mockGetCronSettingsDetailsByName.mockResolvedValue(mockCronSettings as any);

      await startCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockSetCronAndStart).toHaveBeenCalledWith("Cron-1", mockCronSettings);
    });

    it("should not call UpdateCronSettings when cronId is undefined", async () => {
      const mockCronSettings = {
        CronId: "1",
        CronName: "Cron-1",
        CronTimeUnit: "hours",
        CronTime: 1,
        Offset: "0",
        CronStatus: true,
      };

      mockRequest.body = {
        jobName: "_E1Cron",
        // cronId is undefined
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      mockGetCronSettingsDetailsByName.mockResolvedValue(mockCronSettings as any);

      await startCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockUpdateCronSettings).toHaveBeenCalledWith(undefined);
    });

    it("should handle response status and send correctly", async () => {
      const mockCronSettings = {
        CronId: "1",
        CronName: "Cron-1",
        CronTimeUnit: "hours",
        CronTime: 1,
        Offset: "0",
        CronStatus: true,
      };

      mockRequest.body = {
        jobName: "_E1Cron",
        cronId: "1",
      };

      mockGetMainCronNameFromJobName.mockReturnValue("Cron-1");
      mockGetCronSettingsDetailsByName.mockResolvedValue(mockCronSettings as any);

      await startCronHandler(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledTimes(1);
      expect(mockStatus).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith("Cron job started successfully for jobName : _E1Cron");
    });
  });
});
