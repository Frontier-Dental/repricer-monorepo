// Must mock before any source imports (filter-mapper.ts imports config, mongo/db-helper, mysql/mysql-helper)
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01 } }));
jest.mock("../../../../mongo/db-helper", () => ({}));
jest.mock("../../../../mysql/mysql-helper", () => ({}));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { GetContextPrice } from "../../../../filter-mapper";

describe("GetContextPrice", () => {
  describe("default OFFSET behavior (percentageDown = 0 or minQty != 1)", () => {
    it("should return OFFSET type with price = nextLowestPrice - processOffset", async () => {
      const result = await GetContextPrice(10.0, 0.01, 5.0, 0, 1);
      expect(result.Type).toBe("OFFSET");
      expect(result.Price).toBeCloseTo(9.99, 2);
    });

    it("should return OFFSET when percentageDown is 0 even if minQty is 1", async () => {
      const result = await GetContextPrice(20.0, 0.01, 5.0, 0, 1);
      expect(result.Type).toBe("OFFSET");
      expect(result.Price).toBeCloseTo(19.99, 2);
    });

    it("should return OFFSET when minQty != 1 even if percentageDown > 0", async () => {
      const result = await GetContextPrice(10.0, 0.01, 5.0, 0.1, 2);
      expect(result.Type).toBe("OFFSET");
      expect(result.Price).toBeCloseTo(9.99, 2);
    });

    it("should handle large offset", async () => {
      const result = await GetContextPrice(100.0, 5.0, 50.0, 0, 1);
      expect(result.Price).toBeCloseTo(95.0, 2);
      expect(result.Type).toBe("OFFSET");
    });

    it("should handle zero offset", async () => {
      const result = await GetContextPrice(10.0, 0, 5.0, 0, 1);
      expect(result.Price).toBeCloseTo(10.0, 2);
      expect(result.Type).toBe("OFFSET");
    });
  });

  describe("PERCENTAGE behavior (percentageDown != 0 AND minQty == 1, result > floor)", () => {
    it("should return PERCENTAGE type when percentage result > floor", async () => {
      // subtractPercentage(100 + 0, 0.10) - 0 = 90.00
      // 90.00 > 5.00 => PERCENTAGE
      const result = await GetContextPrice(100.0, 0.01, 5.0, 0.1, 1, 0);
      expect(result.Type).toBe("PERCENTAGE");
      expect(result.Price).toBeCloseTo(90.0, 2);
    });

    it("should account for heavyShippingPrice in percentage calculation", async () => {
      // subtractPercentage(100 + 10, 0.10) - 10 = subtractPercentage(110, 0.10) - 10
      // = 99.00 - 10 = 89.00 > 5.00 => PERCENTAGE
      const result = await GetContextPrice(100.0, 0.01, 5.0, 0.1, 1, 10);
      expect(result.Type).toBe("PERCENTAGE");
      expect(result.Price).toBeCloseTo(89.0, 2);
    });

    it('should use loose equality for minQty (string "1" matches)', async () => {
      const result = await GetContextPrice(100.0, 0.01, 5.0, 0.1, "1", 0);
      expect(result.Type).toBe("PERCENTAGE");
    });
  });

  describe("FLOOR_OFFSET behavior (percentageDown != 0 AND minQty == 1, result <= floor)", () => {
    it("should return FLOOR_OFFSET type when percentage result <= floor", async () => {
      // subtractPercentage(10, 0.10) = 9.00
      // 9.00 <= 9.50 => FLOOR_OFFSET
      // Price stays as OFFSET = 10 - 0.01 = 9.99
      const result = await GetContextPrice(10.0, 0.01, 9.5, 0.1, 1, 0);
      expect(result.Type).toBe("FLOOR_OFFSET");
      expect(result.Price).toBeCloseTo(9.99, 2);
    });

    it("should return FLOOR_OFFSET when percentage result exactly equals floor", async () => {
      // subtractPercentage(10, 0.05) = 9.50
      // 9.50 <= 9.50 => FLOOR_OFFSET
      const result = await GetContextPrice(10.0, 0.01, 9.5, 0.05, 1, 0);
      expect(result.Type).toBe("FLOOR_OFFSET");
      expect(result.Price).toBeCloseTo(9.99, 2);
    });

    it("should keep OFFSET price (not percentage price) when FLOOR_OFFSET", async () => {
      const result = await GetContextPrice(50.0, 0.01, 48.0, 0.1, 1, 0);
      // subtractPercentage(50, 0.10) = 45.00, 45.00 <= 48.00 => FLOOR_OFFSET
      // Price = 50 - 0.01 = 49.99 (OFFSET price, NOT the percentage price)
      expect(result.Type).toBe("FLOOR_OFFSET");
      expect(result.Price).toBeCloseTo(49.99, 2);
    });
  });

  describe("edge cases", () => {
    it("should handle nextLowestPrice of 0", async () => {
      const result = await GetContextPrice(0, 0.01, 0, 0, 1);
      expect(result.Price).toBeCloseTo(-0.01, 2);
      expect(result.Type).toBe("OFFSET");
    });

    it("should handle heavyShippingPrice default (0)", async () => {
      const result = await GetContextPrice(10.0, 0.01, 5.0, 0.1, 1);
      // heavyShippingPrice defaults to 0
      expect(result.Type).toBe("PERCENTAGE");
    });

    it("should handle very small percentageDown", async () => {
      // subtractPercentage(100, 0.001) = floor((100-0.1)*100)/100 = 99.90
      // 99.90 > 5 => PERCENTAGE
      const result = await GetContextPrice(100.0, 0.01, 5.0, 0.001, 1, 0);
      expect(result.Type).toBe("PERCENTAGE");
      expect(result.Price).toBeCloseTo(99.9, 2);
    });
  });
});
