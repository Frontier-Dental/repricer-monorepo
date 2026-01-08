jest.mock("../utility/mysql/mysql-helper", () => ({
  GetWaitlistPendingItems: jest.fn(),
  UpdateVendorStock: jest.fn(),
  UpdateWaitlistStatus: jest.fn(),
}));

jest.mock("../utility/net32/updateProductQuantity", () => ({
  processUpdateProductQuantities: jest.fn(),
}));

jest.mock("../utility/reprice-algo/v1/shared", () => ({
  delay: jest.fn(),
}));

jest.mock("../utility/config", () => ({
  applicationConfig: {
    NET32_UPDATE_QUANTITY_DELAY: 1,
  },
}));

jest.mock("../utility/mini-erp/min-erp-helper", () => ({
  isCancelled: jest.fn(),
}));

import { updateNet32Stock } from "./net32-stock-update";
import { GetWaitlistPendingItems, UpdateVendorStock, UpdateWaitlistStatus } from "../utility/mysql/mysql-helper";
import { processUpdateProductQuantities } from "../utility/net32/updateProductQuantity";
import { delay } from "../utility/reprice-algo/v1/shared";
import { applicationConfig } from "../utility/config";
import { isCancelled } from "../utility/mini-erp/min-erp-helper";
import { WaitlistModel } from "../model/waitlist-model";

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("net32-stock-update", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mock implementations
    (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([]);
    (processUpdateProductQuantities as jest.Mock).mockResolvedValue([]);
    (delay as jest.Mock).mockResolvedValue(undefined);
    (isCancelled as jest.Mock).mockResolvedValue(false);
    (UpdateWaitlistStatus as jest.Mock).mockResolvedValue(undefined);
    (UpdateVendorStock as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("updateNet32Stock", () => {
    it("should return true when no items are in waitlist", async () => {
      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([]);

      const result = await updateNet32Stock();

      expect(result).toBe(true);
      expect(GetWaitlistPendingItems).toHaveBeenCalledTimes(1);
      expect(processUpdateProductQuantities).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Running net32 stock update cron"));
      expect(console.log).toHaveBeenCalledWith("Found 0 items in waitlist to update in net32 stock");
    });

    it("should successfully update stock for a single item", async () => {
      const item = new WaitlistModel(12345, "MVP", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "MVP",
          success: true,
          status: 200,
        },
      ]);

      const result = await updateNet32Stock();

      expect(result).toBe(true);
      expect(GetWaitlistPendingItems).toHaveBeenCalledTimes(1);
      expect(delay).toHaveBeenCalledWith(applicationConfig.NET32_UPDATE_QUANTITY_DELAY);
      expect(processUpdateProductQuantities).toHaveBeenCalledWith({
        mpid: 12345,
        vendorData: [
          {
            vendor: "mvp",
            quantity: 15,
          },
        ],
      });
      expect(UpdateWaitlistStatus).toHaveBeenCalledWith(1, "success");
      expect(UpdateVendorStock).toHaveBeenCalledWith("MVP", 12345, 20);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Updating net32 stock for item"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Net32 stock update status for item"));
    });

    it("should handle failed stock update for a single item", async () => {
      const item = new WaitlistModel(12345, "MVP", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "MVP",
          success: false,
          status: 500,
          data: {
            message: "Internal server error",
          },
        },
      ]);

      const result = await updateNet32Stock();

      expect(result).toBe(true);
      expect(UpdateWaitlistStatus).toHaveBeenCalledWith(1, "failed", "Internal server error");
      expect(UpdateVendorStock).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith("Failed to update net32 stock for item", item, "Internal server error");
    });

    it("should process multiple items successfully", async () => {
      const item1 = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);
      const item2 = new WaitlistModel(67890, "MVP", 5, 10, 8, "pending", undefined, new Date(), new Date(), 2);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item1, item2]);
      (processUpdateProductQuantities as jest.Mock)
        .mockResolvedValueOnce([
          {
            vendor: "TRADENT",
            success: true,
            status: 200,
          },
        ])
        .mockResolvedValueOnce([
          {
            vendor: "MVP",
            success: true,
            status: 200,
          },
        ]);

      const result = await updateNet32Stock();

      expect(result).toBe(true);
      expect(processUpdateProductQuantities).toHaveBeenCalledTimes(2);
      expect(UpdateWaitlistStatus).toHaveBeenCalledTimes(2);
      expect(UpdateWaitlistStatus).toHaveBeenNthCalledWith(1, 1, "success");
      expect(UpdateWaitlistStatus).toHaveBeenNthCalledWith(2, 2, "success");
      expect(UpdateVendorStock).toHaveBeenCalledTimes(2);
      expect(UpdateVendorStock).toHaveBeenNthCalledWith(1, "TRADENT", 12345, 20);
      expect(UpdateVendorStock).toHaveBeenNthCalledWith(2, "MVP", 67890, 10);
    });

    it("should handle mixed success and failure for multiple items", async () => {
      const item1 = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);
      const item2 = new WaitlistModel(67890, "MVP", 5, 10, 8, "pending", undefined, new Date(), new Date(), 2);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item1, item2]);
      (processUpdateProductQuantities as jest.Mock)
        .mockResolvedValueOnce([
          {
            vendor: "TRADENT",
            success: true,
            status: 200,
          },
        ])
        .mockResolvedValueOnce([
          {
            vendor: "MVP",
            success: false,
            status: 400,
            data: {
              message: "Invalid request",
            },
          },
        ]);

      const result = await updateNet32Stock();

      expect(result).toBe(true);
      expect(UpdateWaitlistStatus).toHaveBeenCalledTimes(2);
      expect(UpdateWaitlistStatus).toHaveBeenNthCalledWith(1, 1, "success");
      expect(UpdateWaitlistStatus).toHaveBeenNthCalledWith(2, 2, "failed", "Invalid request");
      expect(UpdateVendorStock).toHaveBeenCalledTimes(1);
      expect(UpdateVendorStock).toHaveBeenCalledWith("TRADENT", 12345, 20);
    });

    it("should stop processing when cancelled after first item", async () => {
      const item1 = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);
      const item2 = new WaitlistModel(67890, "MVP", 5, 10, 8, "pending", undefined, new Date(), new Date(), 2);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item1, item2]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "TRADENT",
          success: true,
          status: 200,
        },
      ]);
      // After item1 is processed, cancellation check returns true
      (isCancelled as jest.Mock).mockResolvedValueOnce(true);

      const result = await updateNet32Stock();

      expect(result).toBe(true);
      expect(processUpdateProductQuantities).toHaveBeenCalledTimes(1);
      expect(UpdateWaitlistStatus).toHaveBeenCalledTimes(1);
      expect(UpdateWaitlistStatus).toHaveBeenCalledWith(1, "success");
      expect(console.log).toHaveBeenCalledWith("Net32 stock update cron cancelled");
      // Item2 should not be processed
      expect(processUpdateProductQuantities).not.toHaveBeenCalledWith({
        mpid: 67890,
        vendorData: expect.any(Array),
      });
    });

    it("should continue processing when not cancelled after first item", async () => {
      const item1 = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);
      const item2 = new WaitlistModel(67890, "MVP", 5, 10, 8, "pending", undefined, new Date(), new Date(), 2);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item1, item2]);
      (processUpdateProductQuantities as jest.Mock)
        .mockResolvedValueOnce([
          {
            vendor: "TRADENT",
            success: true,
            status: 200,
          },
        ])
        .mockResolvedValueOnce([
          {
            vendor: "MVP",
            success: true,
            status: 200,
          },
        ]);
      // Not cancelled after item1, so should continue to item2
      (isCancelled as jest.Mock).mockResolvedValueOnce(false);

      const result = await updateNet32Stock();

      expect(result).toBe(true);
      expect(processUpdateProductQuantities).toHaveBeenCalledTimes(2);
      expect(UpdateWaitlistStatus).toHaveBeenCalledTimes(2);
    });

    it("should convert vendor name to lowercase in vendorData", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "TRADENT",
          success: true,
          status: 200,
        },
      ]);

      await updateNet32Stock();

      expect(processUpdateProductQuantities).toHaveBeenCalledWith({
        mpid: 12345,
        vendorData: [
          {
            vendor: "tradent",
            quantity: 15,
          },
        ],
      });
    });

    it("should use correct net32_inventory value in vendorData", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 20, 25, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "TRADENT",
          success: true,
          status: 200,
        },
      ]);

      await updateNet32Stock();

      expect(processUpdateProductQuantities).toHaveBeenCalledWith({
        mpid: 12345,
        vendorData: [
          {
            vendor: "tradent",
            quantity: 25,
          },
        ],
      });
    });

    it("should use correct new_inventory value when updating vendor stock", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 30, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "TRADENT",
          success: true,
          status: 200,
        },
      ]);

      await updateNet32Stock();

      expect(UpdateVendorStock).toHaveBeenCalledWith("TRADENT", 12345, 30);
    });

    it("should handle item without id gracefully", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date());

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "TRADENT",
          success: true,
          status: 200,
        },
      ]);

      await updateNet32Stock();

      expect(UpdateWaitlistStatus).toHaveBeenCalledWith(undefined, "success");
    });

    it("should handle failed update with no error message", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "TRADENT",
          success: false,
          status: 500,
        },
      ]);

      await updateNet32Stock();

      expect(UpdateWaitlistStatus).toHaveBeenCalledWith(1, "failed", undefined);
      expect(console.error).toHaveBeenCalledWith("Failed to update net32 stock for item", item, undefined);
    });

    it("should call delay with correct configuration value", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "TRADENT",
          success: true,
          status: 200,
        },
      ]);

      await updateNet32Stock();

      expect(delay).toHaveBeenCalledWith(1);
    });

    it("should log correct information for each item", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "TRADENT",
          success: true,
          status: 200,
        },
      ]);

      await updateNet32Stock();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Running net32 stock update cron"));
      expect(console.log).toHaveBeenCalledWith("Found 1 items in waitlist to update in net32 stock");
      expect(console.log).toHaveBeenCalledWith("Updating net32 stock for item 12345 TRADENT 15");
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Net32 stock update status for item"));
    });

    it("should handle empty results array from processUpdateProductQuantities", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([]);

      await expect(updateNet32Stock()).rejects.toThrow();

      expect(UpdateWaitlistStatus).not.toHaveBeenCalled();
      expect(UpdateVendorStock).not.toHaveBeenCalled();
    });

    it("should process items in sequence with delay between each", async () => {
      const item1 = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);
      const item2 = new WaitlistModel(67890, "MVP", 5, 10, 8, "pending", undefined, new Date(), new Date(), 2);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item1, item2]);
      (processUpdateProductQuantities as jest.Mock)
        .mockResolvedValueOnce([
          {
            vendor: "TRADENT",
            success: true,
            status: 200,
          },
        ])
        .mockResolvedValueOnce([
          {
            vendor: "MVP",
            success: true,
            status: 200,
          },
        ]);

      await updateNet32Stock();

      expect(delay).toHaveBeenCalledTimes(2);
      expect(delay).toHaveBeenNthCalledWith(1, 1);
      expect(delay).toHaveBeenNthCalledWith(2, 1);
    });

    it("should check cancellation status after each item", async () => {
      const item1 = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);
      const item2 = new WaitlistModel(67890, "MVP", 5, 10, 8, "pending", undefined, new Date(), new Date(), 2);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item1, item2]);
      (processUpdateProductQuantities as jest.Mock)
        .mockResolvedValueOnce([
          {
            vendor: "TRADENT",
            success: true,
            status: 200,
          },
        ])
        .mockResolvedValueOnce([
          {
            vendor: "MVP",
            success: true,
            status: 200,
          },
        ]);
      (isCancelled as jest.Mock).mockResolvedValue(false);

      await updateNet32Stock();

      expect(isCancelled).toHaveBeenCalledTimes(2);
      expect(isCancelled).toHaveBeenCalledWith("StockUpdateCron");
    });

    it("should handle GetWaitlistPendingItems throwing an error", async () => {
      const error = new Error("Database connection failed");
      (GetWaitlistPendingItems as jest.Mock).mockRejectedValue(error);

      await expect(updateNet32Stock()).rejects.toThrow("Database connection failed");

      expect(processUpdateProductQuantities).not.toHaveBeenCalled();
    });

    it("should handle processUpdateProductQuantities throwing an error", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      const error = new Error("API request failed");
      (processUpdateProductQuantities as jest.Mock).mockRejectedValue(error);

      await expect(updateNet32Stock()).rejects.toThrow("API request failed");

      expect(UpdateWaitlistStatus).not.toHaveBeenCalled();
      expect(UpdateVendorStock).not.toHaveBeenCalled();
    });

    it("should handle UpdateWaitlistStatus throwing an error", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "TRADENT",
          success: true,
          status: 200,
        },
      ]);
      const error = new Error("Database update failed");
      (UpdateWaitlistStatus as jest.Mock).mockRejectedValue(error);

      await expect(updateNet32Stock()).rejects.toThrow("Database update failed");
    });

    it("should handle UpdateVendorStock throwing an error", async () => {
      const item = new WaitlistModel(12345, "TRADENT", 10, 20, 15, "pending", undefined, new Date(), new Date(), 1);

      (GetWaitlistPendingItems as jest.Mock).mockResolvedValue([item]);
      (processUpdateProductQuantities as jest.Mock).mockResolvedValue([
        {
          vendor: "TRADENT",
          success: true,
          status: 200,
        },
      ]);
      const error = new Error("Vendor stock update failed");
      (UpdateVendorStock as jest.Mock).mockRejectedValue(error);

      await expect(updateNet32Stock()).rejects.toThrow("Vendor stock update failed");
    });
  });
});
