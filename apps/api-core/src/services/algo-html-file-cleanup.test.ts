jest.mock("node-cron", () => ({
  schedule: jest.fn(),
}));

jest.mock("../model/sql-models/knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
  destroyKnexInstance: jest.fn(),
}));

import { schedule, ScheduledTask } from "node-cron";
import { getKnexInstance, destroyKnexInstance } from "../model/sql-models/knex-wrapper";
import { startV2AlgoHtmlFileCleanupCron, stopCleanupCron, runCleanupManually, getExpiredRecordsCount, getTotalRecordsCount } from "./algo-html-file-cleanup";

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("algo-html-file-cleanup", () => {
  let mockKnex: any;
  let mockQueryBuilder: any;
  let mockScheduledTask: ScheduledTask;

  beforeEach(() => {
    jest.clearAllMocks();

    // Ensure cron is stopped before each test
    stopCleanupCron();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Create a mock query builder with chainable methods
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      del: jest.fn(),
      count: jest.fn().mockReturnThis(),
      first: jest.fn(),
    };

    // Create a mock knex instance
    mockKnex = jest.fn().mockReturnValue(mockQueryBuilder);

    // Mock getKnexInstance to return our mock knex
    (getKnexInstance as jest.Mock).mockReturnValue(mockKnex);

    // Mock ScheduledTask
    mockScheduledTask = {
      stop: jest.fn(),
      start: jest.fn(),
      destroy: jest.fn(),
      getStatus: jest.fn(),
    } as any;

    // Mock schedule to return our mock task
    (schedule as jest.Mock).mockReturnValue(mockScheduledTask);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clean up any running cron
    stopCleanupCron();
  });

  describe("startV2AlgoHtmlFileCleanupCron", () => {
    it("should start the cleanup cron job successfully", () => {
      startV2AlgoHtmlFileCleanupCron();

      expect(schedule).toHaveBeenCalledTimes(1);
      expect(schedule).toHaveBeenCalledWith("0 */2 * * *", expect.any(Function), {
        scheduled: true,
        timezone: "UTC",
        runOnInit: true,
      });
      expect(console.log).toHaveBeenCalledWith("Cleanup cron job started successfully. Running every 2 hours.");
    });

    it("should not start cron if already running", () => {
      startV2AlgoHtmlFileCleanupCron();
      jest.clearAllMocks();

      startV2AlgoHtmlFileCleanupCron();

      expect(schedule).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("Cleanup cron is already running");
    });

    it("should execute cleanup when cron callback is invoked", async () => {
      const mockDel = jest.fn().mockResolvedValue(5);
      mockQueryBuilder.del = mockDel;

      startV2AlgoHtmlFileCleanupCron();

      // Get the callback function passed to schedule
      const scheduleCall = (schedule as jest.Mock).mock.calls[0];
      const cronCallback = scheduleCall[1];

      // Execute the callback
      await cronCallback();

      expect(getKnexInstance).toHaveBeenCalled();
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_execution");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("expires_at", "<", expect.any(Date));
      expect(mockDel).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Starting cleanup of expired v2_algo_execution records"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Cleanup completed successfully"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Deleted 5 expired records"));
    });

    it("should handle errors during cron execution gracefully", async () => {
      const mockError = new Error("Database connection failed");
      const mockDel = jest.fn().mockRejectedValue(mockError);
      mockQueryBuilder.del = mockDel;

      startV2AlgoHtmlFileCleanupCron();

      // Get the callback function passed to schedule
      const scheduleCall = (schedule as jest.Mock).mock.calls[0];
      const cronCallback = scheduleCall[1];

      // Execute the callback
      await cronCallback();

      expect(console.error).toHaveBeenCalledWith("Error during cleanup cron execution:", mockError);
    });

    it("should use correct cron expression for every 2 hours", () => {
      startV2AlgoHtmlFileCleanupCron();

      const scheduleCall = (schedule as jest.Mock).mock.calls[0];
      expect(scheduleCall[0]).toBe("0 */2 * * *");
    });
  });

  describe("stopCleanupCron", () => {
    it("should stop the cron job when it is running", () => {
      startV2AlgoHtmlFileCleanupCron();
      jest.clearAllMocks();

      stopCleanupCron();

      expect(mockScheduledTask.stop).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith("Cleanup cron job stopped");
    });

    it("should not throw error when stopping non-existent cron", () => {
      expect(() => stopCleanupCron()).not.toThrow();
      expect(mockScheduledTask.stop).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should allow restarting cron after stopping", () => {
      startV2AlgoHtmlFileCleanupCron();
      stopCleanupCron();
      jest.clearAllMocks();

      startV2AlgoHtmlFileCleanupCron();

      expect(schedule).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith("Cleanup cron job started successfully. Running every 2 hours.");
    });
  });

  describe("runCleanupManually", () => {
    it("should successfully execute manual cleanup", async () => {
      const mockDel = jest.fn().mockResolvedValue(10);
      mockQueryBuilder.del = mockDel;

      await runCleanupManually();

      expect(getKnexInstance).toHaveBeenCalled();
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_execution");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("expires_at", "<", expect.any(Date));
      expect(mockDel).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("Starting manual cleanup of expired v2_algo_execution records");
      expect(console.log).toHaveBeenCalledWith("Manual cleanup completed successfully");
      expect(console.log).toHaveBeenCalledWith("Deleted 10 expired records from v2_algo_execution table");
    });

    it("should handle zero deleted records", async () => {
      const mockDel = jest.fn().mockResolvedValue(0);
      mockQueryBuilder.del = mockDel;

      await runCleanupManually();

      expect(mockDel).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("Deleted 0 expired records from v2_algo_execution table");
    });

    it("should throw error when cleanup fails", async () => {
      const mockError = new Error("Database error");
      const mockDel = jest.fn().mockRejectedValue(mockError);
      mockQueryBuilder.del = mockDel;

      await expect(runCleanupManually()).rejects.toThrow("Database error");

      expect(console.error).toHaveBeenCalledWith("Error during manual cleanup:", mockError);
    });

    it("should use current time for expiration check", async () => {
      const mockDel = jest.fn().mockResolvedValue(0);
      mockQueryBuilder.del = mockDel;
      const beforeTime = new Date();

      await runCleanupManually();

      const afterTime = new Date();
      const whereCall = mockQueryBuilder.where.mock.calls[0];
      const comparisonTime = whereCall[2];

      expect(comparisonTime).toBeInstanceOf(Date);
      expect(comparisonTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(comparisonTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("getExpiredRecordsCount", () => {
    it("should return count of expired records", async () => {
      const mockCount = { count: "15" };
      mockQueryBuilder.first = jest.fn().mockResolvedValue(mockCount);

      const result = await getExpiredRecordsCount();

      expect(result).toBe(15);
      expect(getKnexInstance).toHaveBeenCalled();
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_execution");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("expires_at", "<", expect.any(Date));
      expect(mockQueryBuilder.count).toHaveBeenCalledWith("* as count");
      expect(mockQueryBuilder.first).toHaveBeenCalled();
    });

    it("should return 0 when no expired records exist", async () => {
      mockQueryBuilder.first = jest.fn().mockResolvedValue({ count: "0" });

      const result = await getExpiredRecordsCount();

      expect(result).toBe(0);
    });

    it("should return 0 when count result is null", async () => {
      mockQueryBuilder.first = jest.fn().mockResolvedValue(null);

      const result = await getExpiredRecordsCount();

      expect(result).toBe(0);
    });

    it("should return 0 when count result is undefined", async () => {
      mockQueryBuilder.first = jest.fn().mockResolvedValue(undefined);

      const result = await getExpiredRecordsCount();

      expect(result).toBe(0);
    });

    it("should handle numeric count values", async () => {
      const mockCount = { count: 42 };
      mockQueryBuilder.first = jest.fn().mockResolvedValue(mockCount);

      const result = await getExpiredRecordsCount();

      expect(result).toBe(42);
    });

    it("should throw error when database query fails", async () => {
      const mockError = new Error("Query failed");
      mockQueryBuilder.first = jest.fn().mockRejectedValue(mockError);

      await expect(getExpiredRecordsCount()).rejects.toThrow("Query failed");

      expect(console.error).toHaveBeenCalledWith("Error getting expired records count:", mockError);
    });

    it("should use current time for expiration check", async () => {
      const mockCount = { count: "5" };
      mockQueryBuilder.first = jest.fn().mockResolvedValue(mockCount);
      const beforeTime = new Date();

      await getExpiredRecordsCount();

      const afterTime = new Date();
      const whereCall = mockQueryBuilder.where.mock.calls[0];
      const comparisonTime = whereCall[2];

      expect(comparisonTime).toBeInstanceOf(Date);
      expect(comparisonTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(comparisonTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("getTotalRecordsCount", () => {
    it("should return total count of records", async () => {
      const mockCount = { count: "100" };
      mockQueryBuilder.first = jest.fn().mockResolvedValue(mockCount);

      const result = await getTotalRecordsCount();

      expect(result).toBe(100);
      expect(getKnexInstance).toHaveBeenCalled();
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_execution");
      expect(mockQueryBuilder.count).toHaveBeenCalledWith("* as count");
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
    });

    it("should return 0 when no records exist", async () => {
      mockQueryBuilder.first = jest.fn().mockResolvedValue({ count: "0" });

      const result = await getTotalRecordsCount();

      expect(result).toBe(0);
    });

    it("should return 0 when count result is null", async () => {
      mockQueryBuilder.first = jest.fn().mockResolvedValue(null);

      const result = await getTotalRecordsCount();

      expect(result).toBe(0);
    });

    it("should return 0 when count result is undefined", async () => {
      mockQueryBuilder.first = jest.fn().mockResolvedValue(undefined);

      const result = await getTotalRecordsCount();

      expect(result).toBe(0);
    });

    it("should handle numeric count values", async () => {
      const mockCount = { count: 250 };
      mockQueryBuilder.first = jest.fn().mockResolvedValue(mockCount);

      const result = await getTotalRecordsCount();

      expect(result).toBe(250);
    });

    it("should throw error when database query fails", async () => {
      const mockError = new Error("Query execution failed");
      mockQueryBuilder.first = jest.fn().mockRejectedValue(mockError);

      await expect(getTotalRecordsCount()).rejects.toThrow("Query execution failed");

      expect(console.error).toHaveBeenCalledWith("Error getting total records count:", mockError);
    });
  });

  describe("integration scenarios", () => {
    it("should handle multiple sequential operations", async () => {
      // Start cron
      startV2AlgoHtmlFileCleanupCron();

      // Get expired count
      mockQueryBuilder.first = jest.fn().mockResolvedValue({ count: "5" });
      const expiredCount = await getExpiredRecordsCount();
      expect(expiredCount).toBe(5);

      // Get total count
      mockQueryBuilder.first = jest.fn().mockResolvedValue({ count: "100" });
      const totalCount = await getTotalRecordsCount();
      expect(totalCount).toBe(100);

      // Run manual cleanup
      const mockDel = jest.fn().mockResolvedValue(5);
      mockQueryBuilder.del = mockDel;
      await runCleanupManually();

      // Stop cron
      stopCleanupCron();

      expect(schedule).toHaveBeenCalledTimes(1);
      expect(mockScheduledTask.stop).toHaveBeenCalledTimes(1);
    });

    it("should handle cleanup with large number of deleted records", async () => {
      const mockDel = jest.fn().mockResolvedValue(10000);
      mockQueryBuilder.del = mockDel;

      await runCleanupManually();

      expect(mockDel).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("Deleted 10000 expired records from v2_algo_execution table");
    });
  });
});
