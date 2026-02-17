// Mock dependencies before imports
jest.mock("../../../model/sql-models/knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
  destroyKnexInstance: jest.fn(),
}));

import { insertV2AlgoError, V2AlgoError } from "../v2-algo-error";
import { getKnexInstance } from "../../../model/sql-models/knex-wrapper";
import { Net32Product } from "../../../types/net32";

describe("v2-algo-error", () => {
  let mockKnex: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock query builder with chainable methods
    mockQueryBuilder = {
      insert: jest.fn(),
    };

    // Create a mock knex instance that returns the query builder
    mockKnex = jest.fn().mockReturnValue(mockQueryBuilder);

    // Mock getKnexInstance to return our mock knex
    (getKnexInstance as jest.Mock).mockReturnValue(mockKnex);
  });

  describe("insertV2AlgoError", () => {
    it("should insert error data and return insert ID", async () => {
      const mockNet32Product: Net32Product = {
        vendorProductId: 123,
        vendorProductCode: "PROD-123",
        vendorId: 1,
        vendorName: "Vendor A",
        vendorRegion: "US",
        inStock: true,
        standardShipping: 5.99,
        standardShippingStatus: "available",
        freeShippingGap: 50.0,
        heavyShippingStatus: "available",
        heavyShipping: 10.99,
        shippingTime: 2,
        inventory: 100,
        isFulfillmentPolicyStock: true,
        vdrGeneralAverageRatingSum: 4.5,
        vdrNumberOfGeneralRatings: 100,
        isBackordered: false,
        vendorProductLevelLicenseRequiredSw: false,
        vendorVerticalLevelLicenseRequiredSw: false,
        priceBreaks: [],
        badgeId: 1,
        badgeName: "Best Seller",
        imagePath: "/images/product.jpg",
        arrivalDate: "2024-01-15",
        arrivalBusinessDays: 2,
        twoDayDeliverySw: true,
        isLowestTotalPrice: "Y",
        freeShippingThreshold: 50.0,
      };

      const mockErrorData: V2AlgoError = {
        error_message: "Test error message",
        net32_products: [mockNet32Product],
        mp_id: 100,
        cron_name: "Cron-1",
        created_at: new Date("2024-01-01T10:00:00Z"),
      };

      const mockInsertId = 1;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoError(mockErrorData);

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_error");
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        created_at: mockErrorData.created_at,
        error: mockErrorData.error_message,
        net32_json: JSON.stringify(mockErrorData.net32_products),
        mp_id: mockErrorData.mp_id,
        cron_name: mockErrorData.cron_name,
      });
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockInsertId);
    });

    it("should handle empty net32_products array", async () => {
      const mockErrorData: V2AlgoError = {
        error_message: "Error with no products",
        net32_products: [],
        mp_id: 200,
        cron_name: "Cron-2",
        created_at: new Date("2024-01-02T10:00:00Z"),
      };

      const mockInsertId = 2;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoError(mockErrorData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        created_at: mockErrorData.created_at,
        error: mockErrorData.error_message,
        net32_json: JSON.stringify([]),
        mp_id: mockErrorData.mp_id,
        cron_name: mockErrorData.cron_name,
      });
      expect(result).toBe(mockInsertId);
    });

    it("should handle multiple net32_products", async () => {
      const mockNet32Products: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
          heavyShippingStatus: "available",
          heavyShipping: 10.99,
          shippingTime: 2,
          inventory: 100,
          isFulfillmentPolicyStock: true,
          vdrGeneralAverageRatingSum: 4.5,
          vdrNumberOfGeneralRatings: 100,
          isBackordered: false,
          vendorProductLevelLicenseRequiredSw: false,
          vendorVerticalLevelLicenseRequiredSw: false,
          priceBreaks: [],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product1.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
        {
          vendorProductId: 456,
          vendorProductCode: "PROD-456",
          vendorId: 2,
          vendorName: "Vendor B",
          vendorRegion: "CA",
          inStock: false,
          standardShipping: 7.99,
          standardShippingStatus: "unavailable",
          freeShippingGap: 75.0,
          heavyShippingStatus: "unavailable",
          heavyShipping: 15.99,
          shippingTime: 5,
          inventory: 0,
          isFulfillmentPolicyStock: false,
          vdrGeneralAverageRatingSum: 3.8,
          vdrNumberOfGeneralRatings: 50,
          isBackordered: true,
          vendorProductLevelLicenseRequiredSw: true,
          vendorVerticalLevelLicenseRequiredSw: false,
          priceBreaks: [
            {
              minQty: 10,
              unitPrice: 9.99,
              promoAddlDescr: "Bulk discount",
              active: true,
            },
          ],
          badgeId: 2,
          badgeName: null,
          imagePath: "/images/product2.jpg",
          arrivalDate: "2024-01-20",
          arrivalBusinessDays: 5,
          twoDayDeliverySw: false,
          isLowestTotalPrice: null,
        },
      ];

      const mockErrorData: V2AlgoError = {
        error_message: "Error with multiple products",
        net32_products: mockNet32Products,
        mp_id: 300,
        cron_name: "Cron-3",
        created_at: new Date("2024-01-03T10:00:00Z"),
      };

      const mockInsertId = 3;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoError(mockErrorData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        created_at: mockErrorData.created_at,
        error: mockErrorData.error_message,
        net32_json: JSON.stringify(mockNet32Products),
        mp_id: mockErrorData.mp_id,
        cron_name: mockErrorData.cron_name,
      });
      expect(result).toBe(mockInsertId);
    });

    it("should handle error messages with special characters", async () => {
      const mockErrorData: V2AlgoError = {
        error_message: "Error with special chars: <>&\"'`\n\r\t",
        net32_products: [],
        mp_id: 400,
        cron_name: "Cron-4",
        created_at: new Date("2024-01-04T10:00:00Z"),
      };

      const mockInsertId = 4;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoError(mockErrorData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Error with special chars: <>&\"'`\n\r\t",
        })
      );
      expect(result).toBe(mockInsertId);
    });

    it("should handle very long error messages", async () => {
      const longErrorMessage = "Error: " + "x".repeat(10000);
      const mockErrorData: V2AlgoError = {
        error_message: longErrorMessage,
        net32_products: [],
        mp_id: 500,
        cron_name: "Cron-5",
        created_at: new Date("2024-01-05T10:00:00Z"),
      };

      const mockInsertId = 5;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoError(mockErrorData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          error: longErrorMessage,
        })
      );
      expect(result).toBe(mockInsertId);
    });

    it("should handle error messages with JSON-like content", async () => {
      const jsonLikeError = '{"error": "Invalid JSON", "details": {"code": 500}}';
      const mockErrorData: V2AlgoError = {
        error_message: jsonLikeError,
        net32_products: [],
        mp_id: 600,
        cron_name: "Cron-6",
        created_at: new Date("2024-01-06T10:00:00Z"),
      };

      const mockInsertId = 6;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoError(mockErrorData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          error: jsonLikeError,
        })
      );
      expect(result).toBe(mockInsertId);
    });

    it("should handle different date values", async () => {
      const pastDate = new Date("2020-01-01T00:00:00Z");
      const futureDate = new Date("2030-12-31T23:59:59Z");

      const mockErrorDataPast: V2AlgoError = {
        error_message: "Past error",
        net32_products: [],
        mp_id: 700,
        cron_name: "Cron-7",
        created_at: pastDate,
      };

      const mockErrorDataFuture: V2AlgoError = {
        error_message: "Future error",
        net32_products: [],
        mp_id: 800,
        cron_name: "Cron-8",
        created_at: futureDate,
      };

      mockQueryBuilder.insert.mockResolvedValueOnce([7]).mockResolvedValueOnce([8]);

      const result1 = await insertV2AlgoError(mockErrorDataPast);
      const result2 = await insertV2AlgoError(mockErrorDataFuture);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_at: pastDate,
        })
      );
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_at: futureDate,
        })
      );
      expect(result1).toBe(7);
      expect(result2).toBe(8);
    });

    it("should handle zero and negative mp_id values", async () => {
      const mockErrorDataZero: V2AlgoError = {
        error_message: "Error with zero mp_id",
        net32_products: [],
        mp_id: 0,
        cron_name: "Cron-9",
        created_at: new Date("2024-01-07T10:00:00Z"),
      };

      const mockErrorDataNegative: V2AlgoError = {
        error_message: "Error with negative mp_id",
        net32_products: [],
        mp_id: -1,
        cron_name: "Cron-10",
        created_at: new Date("2024-01-08T10:00:00Z"),
      };

      mockQueryBuilder.insert.mockResolvedValueOnce([9]).mockResolvedValueOnce([10]);

      const result1 = await insertV2AlgoError(mockErrorDataZero);
      const result2 = await insertV2AlgoError(mockErrorDataNegative);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          mp_id: 0,
        })
      );
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          mp_id: -1,
        })
      );
      expect(result1).toBe(9);
      expect(result2).toBe(10);
    });

    it("should handle large mp_id values", async () => {
      const mockErrorData: V2AlgoError = {
        error_message: "Error with large mp_id",
        net32_products: [],
        mp_id: 2147483647, // Max 32-bit signed integer
        cron_name: "Cron-11",
        created_at: new Date("2024-01-09T10:00:00Z"),
      };

      const mockInsertId = 11;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoError(mockErrorData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          mp_id: 2147483647,
        })
      );
      expect(result).toBe(mockInsertId);
    });

    it("should handle different cron_name formats", async () => {
      const cronNames = ["Cron-1", "cron-2", "CRON-3", "Cron_4", "Cron.5", "Cron-123-ABC", "Very-Long-Cron-Name-With-Many-Parts"];

      for (let i = 0; i < cronNames.length; i++) {
        const mockErrorData: V2AlgoError = {
          error_message: `Error for cron ${i}`,
          net32_products: [],
          mp_id: 900 + i,
          cron_name: cronNames[i],
          created_at: new Date("2024-01-10T10:00:00Z"),
        };

        const mockInsertId = 12 + i;
        mockQueryBuilder.insert.mockResolvedValueOnce([mockInsertId]);

        const result = await insertV2AlgoError(mockErrorData);

        expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            cron_name: cronNames[i],
          })
        );
        expect(result).toBe(mockInsertId);
      }
    });

    it("should handle net32_products with null and undefined fields", async () => {
      const mockNet32Product: Net32Product = {
        vendorProductId: 789,
        vendorProductCode: "PROD-789",
        vendorId: 3,
        vendorName: "Vendor C",
        vendorRegion: "EU",
        inStock: true,
        standardShipping: 8.99,
        standardShippingStatus: "available",
        freeShippingGap: 100.0,
        heavyShippingStatus: "available",
        heavyShipping: 20.99,
        shippingTime: 3,
        inventory: 50,
        isFulfillmentPolicyStock: false,
        vdrGeneralAverageRatingSum: 0,
        vdrNumberOfGeneralRatings: 0,
        isBackordered: false,
        vendorProductLevelLicenseRequiredSw: false,
        vendorVerticalLevelLicenseRequiredSw: false,
        priceBreaks: [],
        badgeId: 0,
        badgeName: null,
        imagePath: "",
        arrivalDate: "",
        arrivalBusinessDays: 0,
        twoDayDeliverySw: false,
        isLowestTotalPrice: null,
      };

      const mockErrorData: V2AlgoError = {
        error_message: "Error with null fields",
        net32_products: [mockNet32Product],
        mp_id: 1000,
        cron_name: "Cron-12",
        created_at: new Date("2024-01-11T10:00:00Z"),
      };

      const mockInsertId = 20;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoError(mockErrorData);

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toBe(mockInsertId);
      // Verify JSON stringification handles null values correctly
      const insertedData = (mockQueryBuilder.insert as jest.Mock).mock.calls[0][0];
      expect(insertedData.net32_json).toBe(JSON.stringify([mockNet32Product]));
    });

    it("should handle net32_products with complex priceBreaks", async () => {
      const mockNet32Product: Net32Product = {
        vendorProductId: 999,
        vendorProductCode: "PROD-999",
        vendorId: 4,
        vendorName: "Vendor D",
        vendorRegion: "US",
        inStock: true,
        standardShipping: 6.99,
        standardShippingStatus: "available",
        freeShippingGap: 60.0,
        heavyShippingStatus: "available",
        heavyShipping: 12.99,
        shippingTime: 1,
        inventory: 200,
        isFulfillmentPolicyStock: true,
        vdrGeneralAverageRatingSum: 4.8,
        vdrNumberOfGeneralRatings: 200,
        isBackordered: false,
        vendorProductLevelLicenseRequiredSw: false,
        vendorVerticalLevelLicenseRequiredSw: false,
        priceBreaks: [
          {
            pmId: "PM-001",
            minQty: 1,
            unitPrice: 19.99,
            promoAddlDescr: "Regular price",
            active: true,
            vendorId: "4",
            vendorName: "Vendor D",
          },
          {
            pmId: "PM-002",
            minQty: 10,
            unitPrice: 17.99,
            promoAddlDescr: "10+ discount",
            active: true,
            vendorId: "4",
            vendorName: "Vendor D",
          },
          {
            pmId: "PM-003",
            minQty: 50,
            unitPrice: 15.99,
            promoAddlDescr: "50+ bulk discount",
            active: true,
            vendorId: "4",
            vendorName: "Vendor D",
          },
        ],
        badgeId: 3,
        badgeName: "Top Rated",
        imagePath: "/images/product999.jpg",
        arrivalDate: "2024-01-25",
        arrivalBusinessDays: 1,
        twoDayDeliverySw: true,
        isLowestTotalPrice: "Y",
        freeShippingThreshold: 60.0,
      };

      const mockErrorData: V2AlgoError = {
        error_message: "Error with complex price breaks",
        net32_products: [mockNet32Product],
        mp_id: 1100,
        cron_name: "Cron-13",
        created_at: new Date("2024-01-12T10:00:00Z"),
      };

      const mockInsertId = 21;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoError(mockErrorData);

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toBe(mockInsertId);
      // Verify JSON stringification handles complex nested objects
      const insertedData = (mockQueryBuilder.insert as jest.Mock).mock.calls[0][0];
      expect(insertedData.net32_json).toBe(JSON.stringify([mockNet32Product]));
    });

    it("should handle large net32_products arrays", async () => {
      const largeProductArray: Net32Product[] = Array.from({ length: 100 }, (_, i) => ({
        vendorProductId: 1000 + i,
        vendorProductCode: `PROD-${1000 + i}`,
        vendorId: (i % 10) + 1,
        vendorName: `Vendor ${(i % 10) + 1}`,
        vendorRegion: i % 2 === 0 ? "US" : "CA",
        inStock: i % 2 === 0,
        standardShipping: 5.99 + i,
        standardShippingStatus: i % 2 === 0 ? "available" : "unavailable",
        freeShippingGap: 50.0 + i,
        heavyShippingStatus: i % 2 === 0 ? "available" : "unavailable",
        heavyShipping: 10.99 + i,
        shippingTime: i % 7,
        inventory: i * 10,
        isFulfillmentPolicyStock: i % 3 === 0,
        vdrGeneralAverageRatingSum: 3.0 + (i % 20) / 10,
        vdrNumberOfGeneralRatings: i * 5,
        isBackordered: i % 4 === 0,
        vendorProductLevelLicenseRequiredSw: i % 5 === 0,
        vendorVerticalLevelLicenseRequiredSw: i % 6 === 0,
        priceBreaks: [],
        badgeId: (i % 5) + 1,
        badgeName: i % 3 === 0 ? `Badge ${i}` : null,
        imagePath: `/images/product${i}.jpg`,
        arrivalDate: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
        arrivalBusinessDays: i % 7,
        twoDayDeliverySw: i % 2 === 0,
        isLowestTotalPrice: i % 3 === 0 ? "Y" : null,
      }));

      const mockErrorData: V2AlgoError = {
        error_message: "Error with large product array",
        net32_products: largeProductArray,
        mp_id: 1200,
        cron_name: "Cron-14",
        created_at: new Date("2024-01-13T10:00:00Z"),
      };

      const mockInsertId = 22;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoError(mockErrorData);

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toBe(mockInsertId);
      // Verify JSON stringification handles large arrays
      const insertedData = (mockQueryBuilder.insert as jest.Mock).mock.calls[0][0];
      expect(insertedData.net32_json).toBe(JSON.stringify(largeProductArray));
      expect(JSON.parse(insertedData.net32_json).length).toBe(100);
    });

    it("should handle database errors", async () => {
      const mockErrorData: V2AlgoError = {
        error_message: "Test error",
        net32_products: [],
        mp_id: 1300,
        cron_name: "Cron-15",
        created_at: new Date("2024-01-14T10:00:00Z"),
      };

      const dbError = new Error("Database connection failed");
      mockQueryBuilder.insert.mockRejectedValue(dbError);

      await expect(insertV2AlgoError(mockErrorData)).rejects.toThrow("Database connection failed");

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_error");
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it("should handle constraint violation errors", async () => {
      const mockErrorData: V2AlgoError = {
        error_message: "Test error",
        net32_products: [],
        mp_id: 1400,
        cron_name: "Cron-16",
        created_at: new Date("2024-01-15T10:00:00Z"),
      };

      const constraintError = new Error("Foreign key constraint fails");
      mockQueryBuilder.insert.mockRejectedValue(constraintError);

      await expect(insertV2AlgoError(mockErrorData)).rejects.toThrow("Foreign key constraint fails");

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it("should handle JSON stringification errors for circular references", async () => {
      const circularProduct: any = {
        vendorProductId: 2000,
        vendorProductCode: "PROD-2000",
        vendorId: 5,
        vendorName: "Vendor E",
        vendorRegion: "US",
        inStock: true,
        standardShipping: 5.99,
        standardShippingStatus: "available",
        freeShippingGap: 50.0,
        heavyShippingStatus: "available",
        heavyShipping: 10.99,
        shippingTime: 2,
        inventory: 100,
        isFulfillmentPolicyStock: true,
        vdrGeneralAverageRatingSum: 4.5,
        vdrNumberOfGeneralRatings: 100,
        isBackordered: false,
        vendorProductLevelLicenseRequiredSw: false,
        vendorVerticalLevelLicenseRequiredSw: false,
        priceBreaks: [],
        badgeId: 1,
        badgeName: "Test",
        imagePath: "/images/test.jpg",
        arrivalDate: "2024-01-15",
        arrivalBusinessDays: 2,
        twoDayDeliverySw: true,
        isLowestTotalPrice: "Y",
      };

      // Create circular reference
      circularProduct.self = circularProduct;

      const mockErrorData: V2AlgoError = {
        error_message: "Error with circular reference",
        net32_products: [circularProduct as Net32Product],
        mp_id: 1500,
        cron_name: "Cron-17",
        created_at: new Date("2024-01-16T10:00:00Z"),
      };

      // JSON.stringify will throw for circular references
      await expect(insertV2AlgoError(mockErrorData)).rejects.toThrow();

      // The function should not reach the insert call
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    it("should correctly map error_message to error column", async () => {
      const mockErrorData: V2AlgoError = {
        error_message: "Custom error message",
        net32_products: [],
        mp_id: 1600,
        cron_name: "Cron-18",
        created_at: new Date("2024-01-17T10:00:00Z"),
      };

      const mockInsertId = 23;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      await insertV2AlgoError(mockErrorData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Custom error message", // Should map error_message to error
        })
      );
    });

    it("should correctly stringify net32_products to net32_json", async () => {
      const mockNet32Product: Net32Product = {
        vendorProductId: 3000,
        vendorProductCode: "PROD-3000",
        vendorId: 6,
        vendorName: "Vendor F",
        vendorRegion: "US",
        inStock: true,
        standardShipping: 5.99,
        standardShippingStatus: "available",
        freeShippingGap: 50.0,
        heavyShippingStatus: "available",
        heavyShipping: 10.99,
        shippingTime: 2,
        inventory: 100,
        isFulfillmentPolicyStock: true,
        vdrGeneralAverageRatingSum: 4.5,
        vdrNumberOfGeneralRatings: 100,
        isBackordered: false,
        vendorProductLevelLicenseRequiredSw: false,
        vendorVerticalLevelLicenseRequiredSw: false,
        priceBreaks: [],
        badgeId: 1,
        badgeName: "Test",
        imagePath: "/images/test.jpg",
        arrivalDate: "2024-01-15",
        arrivalBusinessDays: 2,
        twoDayDeliverySw: true,
        isLowestTotalPrice: "Y",
      };

      const mockErrorData: V2AlgoError = {
        error_message: "Test error",
        net32_products: [mockNet32Product],
        mp_id: 1700,
        cron_name: "Cron-19",
        created_at: new Date("2024-01-18T10:00:00Z"),
      };

      const mockInsertId = 24;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      await insertV2AlgoError(mockErrorData);

      const insertedData = (mockQueryBuilder.insert as jest.Mock).mock.calls[0][0];
      expect(insertedData.net32_json).toBe(JSON.stringify([mockNet32Product]));
      // Verify it's valid JSON
      expect(() => JSON.parse(insertedData.net32_json)).not.toThrow();
      const parsed = JSON.parse(insertedData.net32_json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].vendorProductId).toBe(3000);
    });
  });
});
