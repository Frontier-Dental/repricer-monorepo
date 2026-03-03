// Must mock before any source imports (filter-mapper.ts imports config, mongo/db-helper, mysql/mysql-helper)
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01 } }));
jest.mock("../../../../mongo/db-helper", () => ({}));
jest.mock("../../../../mysql/mysql-helper", () => ({}));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { subtractPercentage } from "../../../../filter-mapper";

describe("subtractPercentage", () => {
  it("should subtract 10% from 100", () => {
    expect(subtractPercentage(100, 0.1)).toBe(90.0);
  });

  it("should subtract 5% from 200", () => {
    expect(subtractPercentage(200, 0.05)).toBe(190.0);
  });

  it("should round down (floor) to 2 decimal places", () => {
    // 10 - 10 * 0.03 = 9.699999... (floating point)
    // Math.floor(969.999...) / 100 = 9.69
    expect(subtractPercentage(10, 0.03)).toBe(9.69);
  });

  it("should floor fractional cents down", () => {
    // 10.99 - 10.99 * 0.07 = 10.2207
    // Math.floor(10.2207 * 100) / 100 = 10.22
    expect(subtractPercentage(10.99, 0.07)).toBe(10.22);
  });

  it("should return original number when percentage is 0", () => {
    expect(subtractPercentage(50, 0)).toBe(50.0);
  });

  it("should return 0 when percentage is 1 (100%)", () => {
    expect(subtractPercentage(50, 1)).toBe(0.0);
  });

  it("should handle very small numbers", () => {
    // 0.01 - 0.01 * 0.10 = 0.009
    // Math.floor(0.009 * 100) / 100 = 0.00
    expect(subtractPercentage(0.01, 0.1)).toBe(0.0);
  });

  it("should handle percentage > 1 (more than 100%)", () => {
    // 100 - 100 * 1.5 = -50
    expect(subtractPercentage(100, 1.5)).toBe(-50.0);
  });

  it("should handle 0 as original number", () => {
    expect(subtractPercentage(0, 0.1)).toBe(0.0);
  });

  it("should handle typical repricing scenario", () => {
    // 24.99 - 24.99 * 0.03 = 24.2403
    // Math.floor(24.2403 * 100) / 100 = 24.24
    expect(subtractPercentage(24.99, 0.03)).toBe(24.24);
  });
});
