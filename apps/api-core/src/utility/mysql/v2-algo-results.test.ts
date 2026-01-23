// Mock dependencies before imports
jest.mock("../../model/sql-models/knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
  destroyKnexInstance: jest.fn(),
}));

import { insertMultipleV2AlgoResults, V2AlgoResultData } from "./v2-algo-results";
import { getKnexInstance } from "../../model/sql-models/knex-wrapper";

describe("v2-algo-results", () => {
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

  describe("insertMultipleV2AlgoResults", () => {
    it("should insert a single result and return insert IDs", async () => {
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: 99.99,
        comment: "Test comment",
        triggered_by_vendor: "Vendor A",
        result: "SUCCESS",
        quantity: 10,
        vendor_id: 1,
        mp_id: 100,
        cron_name: "Cron-1",
        q_break_valid: true,
        price_update_result: "UPDATED",
        new_price_breaks: '{"q1": 10, "q2": 20}',
        lowest_price: 89.99,
        lowest_vendor_id: 2,
      };

      const mockInsertIds = [1];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults([mockResult]);

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_results");
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockInsertIds);
    });

    it("should insert multiple results and return insert IDs", async () => {
      const mockResults: V2AlgoResultData[] = [
        {
          job_id: "job-123",
          suggested_price: 99.99,
          comment: "Test comment 1",
          triggered_by_vendor: "Vendor A",
          result: "SUCCESS",
          quantity: 10,
          vendor_id: 1,
          mp_id: 100,
          cron_name: "Cron-1",
          q_break_valid: true,
          price_update_result: "UPDATED",
          new_price_breaks: null,
          lowest_price: 89.99,
          lowest_vendor_id: 2,
        },
        {
          job_id: "job-124",
          suggested_price: 109.99,
          comment: "Test comment 2",
          triggered_by_vendor: "Vendor B",
          result: "FAILED",
          quantity: 5,
          vendor_id: 2,
          mp_id: 101,
          cron_name: "Cron-2",
          q_break_valid: false,
          price_update_result: null,
          new_price_breaks: '{"q1": 5}',
          lowest_price: null,
          lowest_vendor_id: null,
        },
        {
          job_id: "job-125",
          suggested_price: null,
          comment: "Test comment 3",
          triggered_by_vendor: null,
          result: "PENDING",
          quantity: 0,
          vendor_id: 3,
          mp_id: 102,
          cron_name: "Cron-3",
          q_break_valid: true,
          price_update_result: "ERROR",
          new_price_breaks: null,
          lowest_price: 79.99,
          lowest_vendor_id: 1,
        },
      ];

      const mockInsertIds = [1, 2, 3];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults(mockResults);

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_results");
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(mockResults);
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle empty array", async () => {
      const mockInsertIds: number[] = [];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults([]);

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_results");
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([]);
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle results with all optional fields as null", async () => {
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: null,
        comment: "Minimal result",
        triggered_by_vendor: null,
        result: "SUCCESS",
        quantity: 0,
        vendor_id: 1,
        mp_id: 100,
        cron_name: "Cron-1",
        q_break_valid: false,
        price_update_result: null,
        new_price_breaks: null,
        lowest_price: null,
        lowest_vendor_id: null,
      };

      const mockInsertIds = [1];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults([mockResult]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle results with all optional fields as undefined", async () => {
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: undefined,
        comment: "Minimal result",
        triggered_by_vendor: undefined,
        result: "SUCCESS",
        quantity: 0,
        vendor_id: 1,
        mp_id: 100,
        cron_name: "Cron-1",
        q_break_valid: false,
        price_update_result: undefined,
        new_price_breaks: undefined,
        lowest_price: null,
        lowest_vendor_id: null,
      };

      const mockInsertIds = [1];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults([mockResult]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle results with date fields", async () => {
      const now = new Date();
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: 99.99,
        comment: "Test comment",
        triggered_by_vendor: "Vendor A",
        result: "SUCCESS",
        quantity: 10,
        vendor_id: 1,
        mp_id: 100,
        cron_name: "Cron-1",
        created_at: now,
        updated_at: now,
        q_break_valid: true,
        price_update_result: "UPDATED",
        new_price_breaks: '{"q1": 10}',
        lowest_price: 89.99,
        lowest_vendor_id: 2,
      };

      const mockInsertIds = [1];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults([mockResult]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle large batch of results", async () => {
      const mockResults: V2AlgoResultData[] = Array.from({ length: 100 }, (_, i) => ({
        job_id: `job-${i}`,
        suggested_price: 99.99 + i,
        comment: `Test comment ${i}`,
        triggered_by_vendor: `Vendor ${i % 5}`,
        result: i % 2 === 0 ? "SUCCESS" : "FAILED",
        quantity: i,
        vendor_id: (i % 10) + 1,
        mp_id: 100 + i,
        cron_name: `Cron-${i % 3}`,
        q_break_valid: i % 2 === 0,
        price_update_result: i % 3 === 0 ? "UPDATED" : null,
        new_price_breaks: i % 4 === 0 ? `{"q1": ${i}}` : null,
        lowest_price: i % 5 === 0 ? 89.99 : null,
        lowest_vendor_id: i % 6 === 0 ? 2 : null,
      }));

      const mockInsertIds = Array.from({ length: 100 }, (_, i) => i + 1);
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults(mockResults);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(mockResults);
      expect(result).toEqual(mockInsertIds);
      expect(result.length).toBe(100);
    });

    it("should handle results with special characters in strings", async () => {
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: 99.99,
        comment: "Test comment with 'quotes' and \"double quotes\" and \n newlines",
        triggered_by_vendor: "Vendor & Co.",
        result: "SUCCESS",
        quantity: 10,
        vendor_id: 1,
        mp_id: 100,
        cron_name: "Cron-1",
        q_break_valid: true,
        price_update_result: "UPDATED",
        new_price_breaks: '{"q1": 10, "q2": 20, "note": "Special chars: <>&"\'"}',
        lowest_price: 89.99,
        lowest_vendor_id: 2,
      };

      const mockInsertIds = [1];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults([mockResult]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle results with zero and negative values", async () => {
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: 0,
        comment: "Test comment",
        triggered_by_vendor: "Vendor A",
        result: "SUCCESS",
        quantity: 0,
        vendor_id: 0,
        mp_id: 0,
        cron_name: "Cron-1",
        q_break_valid: false,
        price_update_result: "UPDATED",
        new_price_breaks: null,
        lowest_price: -10.99,
        lowest_vendor_id: -1,
      };

      const mockInsertIds = [1];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults([mockResult]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle database errors", async () => {
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: 99.99,
        comment: "Test comment",
        triggered_by_vendor: "Vendor A",
        result: "SUCCESS",
        quantity: 10,
        vendor_id: 1,
        mp_id: 100,
        cron_name: "Cron-1",
        q_break_valid: true,
        price_update_result: "UPDATED",
        new_price_breaks: null,
        lowest_price: 89.99,
        lowest_vendor_id: 2,
      };

      const dbError = new Error("Database connection failed");
      mockQueryBuilder.insert.mockRejectedValue(dbError);

      await expect(insertMultipleV2AlgoResults([mockResult])).rejects.toThrow("Database connection failed");

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_results");
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
    });

    it("should handle constraint violation errors", async () => {
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: 99.99,
        comment: "Test comment",
        triggered_by_vendor: "Vendor A",
        result: "SUCCESS",
        quantity: 10,
        vendor_id: 1,
        mp_id: 100,
        cron_name: "Cron-1",
        q_break_valid: true,
        price_update_result: "UPDATED",
        new_price_breaks: null,
        lowest_price: 89.99,
        lowest_vendor_id: 2,
      };

      const constraintError = new Error("Duplicate entry for key 'PRIMARY'");
      mockQueryBuilder.insert.mockRejectedValue(constraintError);

      await expect(insertMultipleV2AlgoResults([mockResult])).rejects.toThrow("Duplicate entry for key 'PRIMARY'");

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
    });

    it("should handle results with very long strings", async () => {
      const longString = "a".repeat(10000);
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: 99.99,
        comment: longString,
        triggered_by_vendor: "Vendor A",
        result: "SUCCESS",
        quantity: 10,
        vendor_id: 1,
        mp_id: 100,
        cron_name: "Cron-1",
        q_break_valid: true,
        price_update_result: "UPDATED",
        new_price_breaks: `{"data": "${longString}"}`,
        lowest_price: 89.99,
        lowest_vendor_id: 2,
      };

      const mockInsertIds = [1];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults([mockResult]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle results with floating point precision", async () => {
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: 99.999999999,
        comment: "Test comment",
        triggered_by_vendor: "Vendor A",
        result: "SUCCESS",
        quantity: 10,
        vendor_id: 1,
        mp_id: 100,
        cron_name: "Cron-1",
        q_break_valid: true,
        price_update_result: "UPDATED",
        new_price_breaks: null,
        lowest_price: 89.123456789,
        lowest_vendor_id: 2,
      };

      const mockInsertIds = [1];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults([mockResult]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle results with boolean edge cases", async () => {
      const mockResults: V2AlgoResultData[] = [
        {
          job_id: "job-123",
          suggested_price: 99.99,
          comment: "Test comment",
          triggered_by_vendor: "Vendor A",
          result: "SUCCESS",
          quantity: 10,
          vendor_id: 1,
          mp_id: 100,
          cron_name: "Cron-1",
          q_break_valid: true,
          price_update_result: "UPDATED",
          new_price_breaks: null,
          lowest_price: 89.99,
          lowest_vendor_id: 2,
        },
        {
          job_id: "job-124",
          suggested_price: 109.99,
          comment: "Test comment 2",
          triggered_by_vendor: "Vendor B",
          result: "FAILED",
          quantity: 5,
          vendor_id: 2,
          mp_id: 101,
          cron_name: "Cron-2",
          q_break_valid: false,
          price_update_result: null,
          new_price_breaks: null,
          lowest_price: null,
          lowest_vendor_id: null,
        },
      ];

      const mockInsertIds = [1, 2];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults(mockResults);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(mockResults);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle results with JSON strings in new_price_breaks", async () => {
      const mockResult: V2AlgoResultData = {
        job_id: "job-123",
        suggested_price: 99.99,
        comment: "Test comment",
        triggered_by_vendor: "Vendor A",
        result: "SUCCESS",
        quantity: 10,
        vendor_id: 1,
        mp_id: 100,
        cron_name: "Cron-1",
        q_break_valid: true,
        price_update_result: "UPDATED",
        new_price_breaks: JSON.stringify({
          q1: { price: 99.99, quantity: 10 },
          q2: { price: 89.99, quantity: 20 },
          q3: { price: 79.99, quantity: 50 },
        }),
        lowest_price: 89.99,
        lowest_vendor_id: 2,
      };

      const mockInsertIds = [1];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults([mockResult]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([mockResult]);
      expect(result).toEqual(mockInsertIds);
    });

    it("should handle results with different result statuses", async () => {
      const mockResults: V2AlgoResultData[] = [
        {
          job_id: "job-123",
          suggested_price: 99.99,
          comment: "Success result",
          triggered_by_vendor: "Vendor A",
          result: "SUCCESS",
          quantity: 10,
          vendor_id: 1,
          mp_id: 100,
          cron_name: "Cron-1",
          q_break_valid: true,
          price_update_result: "UPDATED",
          new_price_breaks: null,
          lowest_price: 89.99,
          lowest_vendor_id: 2,
        },
        {
          job_id: "job-124",
          suggested_price: 109.99,
          comment: "Failed result",
          triggered_by_vendor: "Vendor B",
          result: "FAILED",
          quantity: 5,
          vendor_id: 2,
          mp_id: 101,
          cron_name: "Cron-2",
          q_break_valid: false,
          price_update_result: null,
          new_price_breaks: null,
          lowest_price: null,
          lowest_vendor_id: null,
        },
        {
          job_id: "job-125",
          suggested_price: null,
          comment: "Pending result",
          triggered_by_vendor: null,
          result: "PENDING",
          quantity: 0,
          vendor_id: 3,
          mp_id: 102,
          cron_name: "Cron-3",
          q_break_valid: true,
          price_update_result: "ERROR",
          new_price_breaks: null,
          lowest_price: 79.99,
          lowest_vendor_id: 1,
        },
      ];

      const mockInsertIds = [1, 2, 3];
      mockQueryBuilder.insert.mockResolvedValue(mockInsertIds);

      const result = await insertMultipleV2AlgoResults(mockResults);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(mockResults);
      expect(result).toEqual(mockInsertIds);
    });
  });
});
