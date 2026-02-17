// Mock dependencies before imports
jest.mock("../../../../model/sql-models/knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
  destroyKnexInstance: jest.fn(),
}));

import { getVendorThresholds, VendorThreshold } from "../shipping-threshold";
import { getKnexInstance } from "../../../../model/sql-models/knex-wrapper";

describe("shipping-threshold", () => {
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
    };

    // Mock getKnexInstance to return the query builder directly
    (getKnexInstance as jest.Mock).mockReturnValue(mockQueryBuilder);
  });

  describe("getVendorThresholds", () => {
    it("should return vendor thresholds for multiple vendors", async () => {
      const mockVendorData = [
        {
          vendor_id: 1,
          standard_shipping: "5.99",
          threshold: "35.00",
        },
        {
          vendor_id: 2,
          standard_shipping: "7.50",
          threshold: "50.00",
        },
        {
          vendor_id: 3,
          standard_shipping: "0.00",
          threshold: "25.00",
        },
      ];

      // Mock the query chain to resolve with vendor data
      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const vendorIds = [1, 2, 3];
      const result = await getVendorThresholds(vendorIds);

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith("*");
      expect(mockQueryBuilder.from).toHaveBeenCalledWith("vendor_thresholds");
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("vendor_id", vendorIds);

      const expected: VendorThreshold[] = [
        {
          vendorId: 1,
          standardShipping: 5.99,
          threshold: 35.0,
        },
        {
          vendorId: 2,
          standardShipping: 7.5,
          threshold: 50.0,
        },
        {
          vendorId: 3,
          standardShipping: 0.0,
          threshold: 25.0,
        },
      ];

      expect(result).toEqual(expected);
    });

    it("should return vendor threshold for a single vendor", async () => {
      const mockVendorData = [
        {
          vendor_id: 10,
          standard_shipping: "10.00",
          threshold: "100.00",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const vendorIds = [10];
      const result = await getVendorThresholds(vendorIds);

      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("vendor_id", [10]);
      expect(result).toEqual([
        {
          vendorId: 10,
          standardShipping: 10.0,
          threshold: 100.0,
        },
      ]);
    });

    it("should return empty array when no vendors match", async () => {
      mockQueryBuilder.whereIn.mockResolvedValue([]);

      const vendorIds = [999, 1000];
      const result = await getVendorThresholds(vendorIds);

      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("vendor_id", vendorIds);
      expect(result).toEqual([]);
    });

    it("should return empty array when empty vendorIds array is provided", async () => {
      mockQueryBuilder.whereIn.mockResolvedValue([]);

      const vendorIds: number[] = [];
      const result = await getVendorThresholds(vendorIds);

      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("vendor_id", []);
      expect(result).toEqual([]);
    });

    it("should handle decimal values correctly", async () => {
      const mockVendorData = [
        {
          vendor_id: 5,
          standard_shipping: "12.345",
          threshold: "99.999",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([5]);

      expect(result).toEqual([
        {
          vendorId: 5,
          standardShipping: 12.345,
          threshold: 99.999,
        },
      ]);
    });

    it("should handle zero values correctly", async () => {
      const mockVendorData = [
        {
          vendor_id: 6,
          standard_shipping: "0",
          threshold: "0",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([6]);

      expect(result).toEqual([
        {
          vendorId: 6,
          standardShipping: 0,
          threshold: 0,
        },
      ]);
    });

    it("should handle negative values correctly", async () => {
      const mockVendorData = [
        {
          vendor_id: 7,
          standard_shipping: "-5.00",
          threshold: "-10.00",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([7]);

      expect(result).toEqual([
        {
          vendorId: 7,
          standardShipping: -5.0,
          threshold: -10.0,
        },
      ]);
    });

    it("should handle large numbers correctly", async () => {
      const mockVendorData = [
        {
          vendor_id: 8,
          standard_shipping: "999999.99",
          threshold: "9999999.99",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([8]);

      expect(result).toEqual([
        {
          vendorId: 8,
          standardShipping: 999999.99,
          threshold: 9999999.99,
        },
      ]);
    });

    it("should handle string numbers with whitespace", async () => {
      const mockVendorData = [
        {
          vendor_id: 9,
          standard_shipping: "  15.50  ",
          threshold: "  75.00  ",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([9]);

      // parseFloat should handle whitespace automatically
      expect(result).toEqual([
        {
          vendorId: 9,
          standardShipping: 15.5,
          threshold: 75.0,
        },
      ]);
    });

    it("should handle duplicate vendor IDs in input", async () => {
      const mockVendorData = [
        {
          vendor_id: 11,
          standard_shipping: "8.00",
          threshold: "40.00",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const vendorIds = [11, 11, 11];
      const result = await getVendorThresholds(vendorIds);

      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("vendor_id", vendorIds);
      expect(result).toEqual([
        {
          vendorId: 11,
          standardShipping: 8.0,
          threshold: 40.0,
        },
      ]);
    });

    it("should handle very large vendor ID arrays", async () => {
      const largeVendorIds = Array.from({ length: 1000 }, (_, i) => i + 1);
      const mockVendorData = largeVendorIds.map((id) => ({
        vendor_id: id,
        standard_shipping: `${id}.00`,
        threshold: `${id * 10}.00`,
      }));

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds(largeVendorIds);

      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("vendor_id", largeVendorIds);
      expect(result).toHaveLength(1000);
      expect(result[0]).toEqual({
        vendorId: 1,
        standardShipping: 1.0,
        threshold: 10.0,
      });
      expect(result[999]).toEqual({
        vendorId: 1000,
        standardShipping: 1000.0,
        threshold: 10000.0,
      });
    });

    it("should handle database errors gracefully", async () => {
      const dbError = new Error("Database connection failed");
      mockQueryBuilder.whereIn.mockRejectedValue(dbError);

      const vendorIds = [1, 2, 3];

      await expect(getVendorThresholds(vendorIds)).rejects.toThrow("Database connection failed");
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("vendor_id", vendorIds);
    });

    it("should handle null values in database response", async () => {
      const mockVendorData = [
        {
          vendor_id: 12,
          standard_shipping: null,
          threshold: null,
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([12]);

      expect(result).toEqual([
        {
          vendorId: 12,
          standardShipping: NaN,
          threshold: NaN,
        },
      ]);
    });

    it("should handle undefined values in database response", async () => {
      const mockVendorData = [
        {
          vendor_id: 13,
          standard_shipping: undefined,
          threshold: undefined,
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([13]);

      expect(result).toEqual([
        {
          vendorId: 13,
          standardShipping: NaN,
          threshold: NaN,
        },
      ]);
    });

    it("should handle empty string values", async () => {
      const mockVendorData = [
        {
          vendor_id: 14,
          standard_shipping: "",
          threshold: "",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([14]);

      expect(result).toEqual([
        {
          vendorId: 14,
          standardShipping: NaN,
          threshold: NaN,
        },
      ]);
    });

    it("should handle invalid number strings", async () => {
      const mockVendorData = [
        {
          vendor_id: 15,
          standard_shipping: "invalid",
          threshold: "not-a-number",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([15]);

      expect(result).toEqual([
        {
          vendorId: 15,
          standardShipping: NaN,
          threshold: NaN,
        },
      ]);
    });

    it("should correctly map vendor_id to vendorId", async () => {
      const mockVendorData = [
        {
          vendor_id: 100,
          standard_shipping: "5.00",
          threshold: "30.00",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([100]);

      expect(result[0]).toHaveProperty("vendorId");
      expect(result[0]).not.toHaveProperty("vendor_id");
      expect(result[0].vendorId).toBe(100);
    });

    it("should correctly map standard_shipping to standardShipping", async () => {
      const mockVendorData = [
        {
          vendor_id: 101,
          standard_shipping: "6.00",
          threshold: "35.00",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([101]);

      expect(result[0]).toHaveProperty("standardShipping");
      expect(result[0]).not.toHaveProperty("standard_shipping");
      expect(result[0].standardShipping).toBe(6.0);
    });

    it("should correctly map threshold field", async () => {
      const mockVendorData = [
        {
          vendor_id: 102,
          standard_shipping: "7.00",
          threshold: "40.00",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([102]);

      expect(result[0]).toHaveProperty("threshold");
      expect(result[0].threshold).toBe(40.0);
    });

    it("should handle mixed valid and invalid data", async () => {
      const mockVendorData = [
        {
          vendor_id: 16,
          standard_shipping: "10.00",
          threshold: "50.00",
        },
        {
          vendor_id: 17,
          standard_shipping: null,
          threshold: "60.00",
        },
        {
          vendor_id: 18,
          standard_shipping: "invalid",
          threshold: "70.00",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([16, 17, 18]);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        vendorId: 16,
        standardShipping: 10.0,
        threshold: 50.0,
      });
      expect(result[1]).toEqual({
        vendorId: 17,
        standardShipping: NaN,
        threshold: 60.0,
      });
      expect(result[2]).toEqual({
        vendorId: 18,
        standardShipping: NaN,
        threshold: 70.0,
      });
    });

    it("should maintain order of results from database", async () => {
      const mockVendorData = [
        {
          vendor_id: 20,
          standard_shipping: "1.00",
          threshold: "10.00",
        },
        {
          vendor_id: 21,
          standard_shipping: "2.00",
          threshold: "20.00",
        },
        {
          vendor_id: 22,
          standard_shipping: "3.00",
          threshold: "30.00",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([20, 21, 22]);

      expect(result[0].vendorId).toBe(20);
      expect(result[1].vendorId).toBe(21);
      expect(result[2].vendorId).toBe(22);
    });

    it("should handle scientific notation strings", async () => {
      const mockVendorData = [
        {
          vendor_id: 23,
          standard_shipping: "1e2",
          threshold: "2.5e3",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      const result = await getVendorThresholds([23]);

      expect(result).toEqual([
        {
          vendorId: 23,
          standardShipping: 100,
          threshold: 2500,
        },
      ]);
    });

    it("should verify query builder chain is called correctly", async () => {
      const mockVendorData = [
        {
          vendor_id: 24,
          standard_shipping: "5.00",
          threshold: "25.00",
        },
      ];

      mockQueryBuilder.whereIn.mockResolvedValue(mockVendorData);

      await getVendorThresholds([24]);

      // Verify all chain methods are called
      expect(mockQueryBuilder.select).toHaveBeenCalledWith("*");
      expect(mockQueryBuilder.from).toHaveBeenCalledWith("vendor_thresholds");
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("vendor_id", [24]);
      expect(mockQueryBuilder.select).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.from).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledTimes(1);
    });

    it("should handle query timeout errors", async () => {
      const timeoutError = new Error("Query timeout");
      timeoutError.name = "TimeoutError";
      mockQueryBuilder.whereIn.mockRejectedValue(timeoutError);

      const vendorIds = [1, 2, 3];

      await expect(getVendorThresholds(vendorIds)).rejects.toThrow("Query timeout");
    });

    it("should handle connection pool errors", async () => {
      const poolError = new Error("Connection pool exhausted");
      mockQueryBuilder.whereIn.mockRejectedValue(poolError);

      const vendorIds = [1];

      await expect(getVendorThresholds(vendorIds)).rejects.toThrow("Connection pool exhausted");
    });
  });
});
