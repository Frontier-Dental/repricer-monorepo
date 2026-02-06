import { Set, Get, Has, GetAllCache, DeleteCacheByKey, FlushCache, Override } from "./cache-helper";

describe("cache-helper", () => {
  beforeEach(() => {
    FlushCache();
  });

  describe("Set", () => {
    it("should set a value in cache", () => {
      Set("test-key", "test-value");
      expect(Get("test-key")).toBe("test-value");
    });

    it("should set an object value in cache", () => {
      const obj = { name: "test", value: 123 };
      Set("test-obj", obj);
      expect(Get("test-obj")).toEqual(obj);
    });

    it("should set a number value in cache", () => {
      Set("test-number", 42);
      expect(Get("test-number")).toBe(42);
    });

    it("should overwrite existing value", () => {
      Set("test-key", "old-value");
      Set("test-key", "new-value");
      expect(Get("test-key")).toBe("new-value");
    });
  });

  describe("Get", () => {
    it("should return the cached value when key exists", () => {
      Set("test-key", "test-value");
      expect(Get("test-key")).toBe("test-value");
    });

    it("should return undefined when key does not exist", () => {
      expect(Get("non-existent-key")).toBeUndefined();
    });

    it("should return null when key is empty string", () => {
      expect(Get("")).toBeNull();
    });

    it("should return null when key is falsy", () => {
      expect(Get(null as any)).toBeNull();
      expect(Get(undefined as any)).toBeNull();
    });
  });

  describe("Has", () => {
    it("should return true when key exists", () => {
      Set("test-key", "test-value");
      expect(Has("test-key")).toBe(true);
    });

    it("should return false when key does not exist", () => {
      expect(Has("non-existent-key")).toBe(false);
    });

    it("should return false when key is empty string", () => {
      expect(Has("")).toBe(false);
    });

    it("should return false when key is falsy", () => {
      expect(Has(null as any)).toBe(false);
      expect(Has(undefined as any)).toBe(false);
    });
  });

  describe("GetAllCache", () => {
    it("should return empty array when cache is empty", () => {
      expect(GetAllCache()).toEqual([]);
    });

    it("should return all cache keys", () => {
      Set("key1", "value1");
      Set("key2", "value2");
      Set("key3", "value3");
      const keys = GetAllCache();
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
      expect(keys.length).toBe(3);
    });
  });

  describe("DeleteCacheByKey", () => {
    it("should delete a key from cache and return number", () => {
      Set("test-key", "test-value");
      const result = DeleteCacheByKey("test-key");
      expect(typeof result).toBe("number");
      expect(Has("test-key")).toBe(false);
      expect(Get("test-key")).toBeUndefined();
    });

    it("should return 0 when key does not exist", () => {
      const result = DeleteCacheByKey("non-existent-key");
      expect(result).toBe(0); // NodeCache.del returns number of keys deleted (0 if key doesn't exist)
    });

    it("should return empty string when key is empty", () => {
      const result = DeleteCacheByKey("");
      expect(result).toBe("");
    });

    it("should return empty string when key is falsy", () => {
      expect(DeleteCacheByKey(null as any)).toBe("");
      expect(DeleteCacheByKey(undefined as any)).toBe("");
    });
  });

  describe("FlushCache", () => {
    it("should clear all cache entries", () => {
      Set("key1", "value1");
      Set("key2", "value2");
      Set("key3", "value3");
      expect(GetAllCache().length).toBe(3);

      FlushCache();

      expect(GetAllCache()).toEqual([]);
      expect(Get("key1")).toBeUndefined();
      expect(Get("key2")).toBeUndefined();
      expect(Get("key3")).toBeUndefined();
    });
  });

  describe("Override", () => {
    it("should set a new key when it does not exist", () => {
      Override("new-key", "new-value");
      expect(Get("new-key")).toBe("new-value");
    });

    it("should delete and set when key exists", () => {
      Set("existing-key", "old-value");
      Override("existing-key", "new-value");
      expect(Get("existing-key")).toBe("new-value");
    });

    it("should not set when key is empty", () => {
      Override("", "value");
      expect(Has("")).toBe(false);
    });

    it("should not set when key is falsy", () => {
      Override(null as any, "value");
      Override(undefined as any, "value");
      // Should not throw, but also should not set anything
    });
  });
});
