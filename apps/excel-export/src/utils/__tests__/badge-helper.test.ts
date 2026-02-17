import { parseBadgeIndicator } from "../badge-helper";

describe("badge-helper", () => {
  describe("parseBadgeIndicator", () => {
    it("should return empty string for undefined value", () => {
      expect(parseBadgeIndicator(undefined)).toBe("");
    });

    it("should return empty string for empty string", () => {
      expect(parseBadgeIndicator("")).toBe("");
    });

    it("should map badge key to value when format is KEY", () => {
      expect(parseBadgeIndicator("1", "KEY")).toBe("Best Seller");
      expect(parseBadgeIndicator("2", "KEY")).toBe("Choice");
      expect(parseBadgeIndicator("3", "KEY")).toBe("Prime");
      expect(parseBadgeIndicator("4", "KEY")).toBe("New");
      expect(parseBadgeIndicator("5", "KEY")).toBe("Limited Time Deal");
      expect(parseBadgeIndicator("6", "KEY")).toBe("Small Business");
      expect(parseBadgeIndicator("7", "KEY")).toBe("Climate Pledge Friendly");
      expect(parseBadgeIndicator("8", "KEY")).toBe("None");
    });

    it("should return value as-is for unknown key when format is KEY", () => {
      expect(parseBadgeIndicator("99", "KEY")).toBe("99");
      expect(parseBadgeIndicator("UNKNOWN", "KEY")).toBe("UNKNOWN");
    });

    it("should map badge value to key when format is VALUE", () => {
      expect(parseBadgeIndicator("Best Seller", "VALUE")).toBe("1");
      expect(parseBadgeIndicator("Prime", "VALUE")).toBe("3");
      expect(parseBadgeIndicator("None", "VALUE")).toBe("8");
    });

    it("should return value as-is for unknown value when format is VALUE", () => {
      expect(parseBadgeIndicator("Unknown Badge", "VALUE")).toBe("Unknown Badge");
    });

    it("should default to KEY format when format not specified", () => {
      expect(parseBadgeIndicator("1")).toBe("Best Seller");
    });

    it("should validate badge data structure for all keys", () => {
      const keys = ["1", "2", "3", "4", "5", "6", "7", "8"];
      keys.forEach((key) => {
        const value = parseBadgeIndicator(key, "KEY");
        expect(value).toBeTruthy();
        expect(parseBadgeIndicator(value, "VALUE")).toBe(key);
      });
    });
  });
});
