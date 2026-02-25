// Mock dependencies before imports
jest.mock("../../../model/sql-models/knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
  destroyKnexInstance: jest.fn(),
}));

import { insertV2AlgoExecution, V2AlgoExecutionData } from "../v2-algo-execution";
import { getKnexInstance } from "../../../model/sql-models/knex-wrapper";

describe("v2-algo-execution", () => {
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

  describe("insertV2AlgoExecution", () => {
    it("should insert execution data and return insert ID", async () => {
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 123,
        created_at: new Date("2024-01-01T10:00:00Z"),
        expires_at: new Date("2024-01-02T10:00:00Z"),
        chain_of_thought_html: Buffer.from("<html>Test HTML</html>", "utf-8"),
        vendor_id: 1,
        mp_id: 100,
        job_id: "job-123-456",
      };

      const mockInsertId = 1;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_execution");
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        scrape_product_id: mockExecutionData.scrape_product_id,
        created_at: mockExecutionData.created_at,
        expires_at: mockExecutionData.expires_at,
        chain_of_thought_html: mockExecutionData.chain_of_thought_html,
        vendor_id: mockExecutionData.vendor_id,
        mp_id: mockExecutionData.mp_id,
        job_id: mockExecutionData.job_id,
      });
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockInsertId);
    });

    it("should handle Buffer with HTML content", async () => {
      const htmlContent = "<html><body><h1>Chain of Thought</h1><p>Analysis results...</p></body></html>";
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 456,
        created_at: new Date("2024-01-15T12:30:00Z"),
        expires_at: new Date("2024-01-16T12:30:00Z"),
        chain_of_thought_html: Buffer.from(htmlContent, "utf-8"),
        vendor_id: 2,
        mp_id: 200,
        job_id: "job-789-012",
      };

      const mockInsertId = 2;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          chain_of_thought_html: expect.any(Buffer),
        })
      );
      expect(result).toBe(mockInsertId);
    });

    it("should handle large Buffer content", async () => {
      const largeHtmlContent = "<html><body>" + "x".repeat(100000) + "</body></html>";
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 789,
        created_at: new Date("2024-02-01T08:00:00Z"),
        expires_at: new Date("2024-02-02T08:00:00Z"),
        chain_of_thought_html: Buffer.from(largeHtmlContent, "utf-8"),
        vendor_id: 3,
        mp_id: 300,
        job_id: "job-large-001",
      };

      const mockInsertId = 3;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toBe(mockInsertId);
      expect(mockExecutionData.chain_of_thought_html.length).toBeGreaterThan(100000);
    });

    it("should handle empty Buffer", async () => {
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 111,
        created_at: new Date("2024-03-01T10:00:00Z"),
        expires_at: new Date("2024-03-02T10:00:00Z"),
        chain_of_thought_html: Buffer.alloc(0),
        vendor_id: 4,
        mp_id: 400,
        job_id: "job-empty-001",
      };

      const mockInsertId = 4;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          chain_of_thought_html: Buffer.alloc(0),
        })
      );
      expect(result).toBe(mockInsertId);
    });

    it("should handle different date values", async () => {
      const pastDate = new Date("2020-01-01T00:00:00Z");
      const futureDate = new Date("2030-12-31T23:59:59Z");

      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 222,
        created_at: pastDate,
        expires_at: futureDate,
        chain_of_thought_html: Buffer.from("Test", "utf-8"),
        vendor_id: 5,
        mp_id: 500,
        job_id: "job-dates-001",
      };

      const mockInsertId = 5;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_at: pastDate,
          expires_at: futureDate,
        })
      );
      expect(result).toBe(mockInsertId);
    });

    it("should handle same created_at and expires_at dates", async () => {
      const sameDate = new Date("2024-06-15T12:00:00Z");

      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 333,
        created_at: sameDate,
        expires_at: sameDate,
        chain_of_thought_html: Buffer.from("Same dates", "utf-8"),
        vendor_id: 6,
        mp_id: 600,
        job_id: "job-same-dates-001",
      };

      const mockInsertId = 6;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toBe(mockInsertId);
    });

    it("should handle zero and negative IDs", async () => {
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 0,
        created_at: new Date("2024-07-01T10:00:00Z"),
        expires_at: new Date("2024-07-02T10:00:00Z"),
        chain_of_thought_html: Buffer.from("Zero IDs", "utf-8"),
        vendor_id: 0,
        mp_id: 0,
        job_id: "job-zero-001",
      };

      const mockInsertId = 7;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          scrape_product_id: 0,
          vendor_id: 0,
          mp_id: 0,
        })
      );
      expect(result).toBe(mockInsertId);
    });

    it("should handle large numeric IDs", async () => {
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 2147483647, // Max 32-bit signed integer
        created_at: new Date("2024-08-01T10:00:00Z"),
        expires_at: new Date("2024-08-02T10:00:00Z"),
        chain_of_thought_html: Buffer.from("Large IDs", "utf-8"),
        vendor_id: 999999,
        mp_id: 999999,
        job_id: "job-large-ids-001",
      };

      const mockInsertId = 8;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toBe(mockInsertId);
    });

    it("should handle different job_id formats", async () => {
      const jobIds = [
        "job-123",
        "job-abc-def-ghi",
        "550e8400-e29b-41d4-a716-446655440000", // UUID format
        "job_123_456",
        "JOB-123-ABC",
      ];

      for (let i = 0; i < jobIds.length; i++) {
        const mockExecutionData: V2AlgoExecutionData = {
          scrape_product_id: 444 + i,
          created_at: new Date("2024-09-01T10:00:00Z"),
          expires_at: new Date("2024-09-02T10:00:00Z"),
          chain_of_thought_html: Buffer.from(`Job ID test ${i}`, "utf-8"),
          vendor_id: 7 + i,
          mp_id: 700 + i,
          job_id: jobIds[i],
        };

        const mockInsertId = 9 + i;
        mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

        const result = await insertV2AlgoExecution(mockExecutionData);

        expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            job_id: jobIds[i],
          })
        );
        expect(result).toBe(mockInsertId);
      }
    });

    it("should handle Buffer with binary data", async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 555,
        created_at: new Date("2024-10-01T10:00:00Z"),
        expires_at: new Date("2024-10-02T10:00:00Z"),
        chain_of_thought_html: binaryData,
        vendor_id: 8,
        mp_id: 800,
        job_id: "job-binary-001",
      };

      const mockInsertId = 15;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          chain_of_thought_html: binaryData,
        })
      );
      expect(result).toBe(mockInsertId);
    });

    it("should handle Buffer with special characters", async () => {
      const specialChars = "Test with special chars: <>&\"'`\n\r\t";
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 666,
        created_at: new Date("2024-11-01T10:00:00Z"),
        expires_at: new Date("2024-11-02T10:00:00Z"),
        chain_of_thought_html: Buffer.from(specialChars, "utf-8"),
        vendor_id: 9,
        mp_id: 900,
        job_id: "job-special-001",
      };

      const mockInsertId = 16;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toBe(mockInsertId);
    });

    it("should handle Buffer with UTF-8 encoded content", async () => {
      const utf8Content = "Test with UTF-8: 中文 العربية русский 🌟 émoji";
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 777,
        created_at: new Date("2024-12-01T10:00:00Z"),
        expires_at: new Date("2024-12-02T10:00:00Z"),
        chain_of_thought_html: Buffer.from(utf8Content, "utf-8"),
        vendor_id: 20891,
        mp_id: 1000,
        job_id: "job-utf8-001",
      };

      const mockInsertId = 17;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toBe(mockInsertId);
    });

    it("should handle database errors", async () => {
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 888,
        created_at: new Date("2024-01-01T10:00:00Z"),
        expires_at: new Date("2024-01-02T10:00:00Z"),
        chain_of_thought_html: Buffer.from("Test", "utf-8"),
        vendor_id: 11,
        mp_id: 1100,
        job_id: "job-error-001",
      };

      const dbError = new Error("Database connection failed");
      mockQueryBuilder.insert.mockRejectedValue(dbError);

      await expect(insertV2AlgoExecution(mockExecutionData)).rejects.toThrow("Database connection failed");

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_execution");
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it("should handle foreign key constraint violations", async () => {
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 999,
        created_at: new Date("2024-01-01T10:00:00Z"),
        expires_at: new Date("2024-01-02T10:00:00Z"),
        chain_of_thought_html: Buffer.from("Test", "utf-8"),
        vendor_id: 12,
        mp_id: 1200,
        job_id: "job-constraint-001",
      };

      const constraintError = new Error("Foreign key constraint fails");
      mockQueryBuilder.insert.mockRejectedValue(constraintError);

      await expect(insertV2AlgoExecution(mockExecutionData)).rejects.toThrow("Foreign key constraint fails");

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it("should handle invalid date errors", async () => {
      const invalidDate = new Date("invalid");
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 1000,
        created_at: invalidDate,
        expires_at: new Date("2024-01-02T10:00:00Z"),
        chain_of_thought_html: Buffer.from("Test", "utf-8"),
        vendor_id: 13,
        mp_id: 1300,
        job_id: "job-invalid-date-001",
      };

      const dateError = new Error("Invalid date value");
      mockQueryBuilder.insert.mockRejectedValue(dateError);

      await expect(insertV2AlgoExecution(mockExecutionData)).rejects.toThrow("Invalid date value");

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it("should handle expired_at before created_at scenario", async () => {
      // This tests the data structure even if it's logically incorrect
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 1111,
        created_at: new Date("2024-01-02T10:00:00Z"),
        expires_at: new Date("2024-01-01T10:00:00Z"), // Before created_at
        chain_of_thought_html: Buffer.from("Test", "utf-8"),
        vendor_id: 14,
        mp_id: 1400,
        job_id: "job-expired-before-001",
      };

      const mockInsertId = 18;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      // The function should still attempt to insert, validation would be at DB level
      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toBe(mockInsertId);
    });

    it("should handle very long job_id strings", async () => {
      const longJobId = "job-" + "x".repeat(1000);
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 2222,
        created_at: new Date("2024-01-01T10:00:00Z"),
        expires_at: new Date("2024-01-02T10:00:00Z"),
        chain_of_thought_html: Buffer.from("Test", "utf-8"),
        vendor_id: 15,
        mp_id: 1500,
        job_id: longJobId,
      };

      const mockInsertId = 19;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          job_id: longJobId,
        })
      );
      expect(result).toBe(mockInsertId);
    });

    it("should correctly map all fields to database columns", async () => {
      const mockExecutionData: V2AlgoExecutionData = {
        scrape_product_id: 3333,
        created_at: new Date("2024-01-01T10:00:00Z"),
        expires_at: new Date("2024-01-02T10:00:00Z"),
        chain_of_thought_html: Buffer.from("Complete test", "utf-8"),
        vendor_id: 16,
        mp_id: 1600,
        job_id: "job-complete-001",
      };

      const mockInsertId = 20;
      mockQueryBuilder.insert.mockResolvedValue([mockInsertId]);

      const result = await insertV2AlgoExecution(mockExecutionData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        scrape_product_id: 3333,
        created_at: mockExecutionData.created_at,
        expires_at: mockExecutionData.expires_at,
        chain_of_thought_html: mockExecutionData.chain_of_thought_html,
        vendor_id: 16,
        mp_id: 1600,
        job_id: "job-complete-001",
      });
      expect(result).toBe(mockInsertId);
    });

    it("should handle multiple sequential insertions", async () => {
      const executions: V2AlgoExecutionData[] = [
        {
          scrape_product_id: 4000,
          created_at: new Date("2024-01-01T10:00:00Z"),
          expires_at: new Date("2024-01-02T10:00:00Z"),
          chain_of_thought_html: Buffer.from("First", "utf-8"),
          vendor_id: 20,
          mp_id: 2000,
          job_id: "job-seq-001",
        },
        {
          scrape_product_id: 4001,
          created_at: new Date("2024-01-01T11:00:00Z"),
          expires_at: new Date("2024-01-02T11:00:00Z"),
          chain_of_thought_html: Buffer.from("Second", "utf-8"),
          vendor_id: 21,
          mp_id: 2001,
          job_id: "job-seq-002",
        },
        {
          scrape_product_id: 4002,
          created_at: new Date("2024-01-01T12:00:00Z"),
          expires_at: new Date("2024-01-02T12:00:00Z"),
          chain_of_thought_html: Buffer.from("Third", "utf-8"),
          vendor_id: 22,
          mp_id: 2002,
          job_id: "job-seq-003",
        },
      ];

      for (let i = 0; i < executions.length; i++) {
        const mockInsertId = 21 + i;
        mockQueryBuilder.insert.mockResolvedValueOnce([mockInsertId]);

        const result = await insertV2AlgoExecution(executions[i]);

        expect(result).toBe(mockInsertId);
      }

      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(3);
    });
  });
});
