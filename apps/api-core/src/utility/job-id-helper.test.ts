import { Generate } from "./job-id-helper";

describe("job-id-helper", () => {
  describe("Generate", () => {
    it("should generate a UUID string", () => {
      const result = Generate();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should generate unique UUIDs", () => {
      const id1 = Generate();
      const id2 = Generate();
      expect(id1).not.toBe(id2);
    });

    it("should generate valid UUID format", () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const result = Generate();
      expect(result).toMatch(uuidRegex);
    });

    it("should generate multiple unique IDs", () => {
      const ids = Array.from({ length: 100 }, () => Generate());
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });
  });
});
