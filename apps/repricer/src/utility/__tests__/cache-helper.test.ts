const mockAxios = jest.fn();

jest.mock("axios", () => ({
  __esModule: true,
  default: (config: unknown) => mockAxios(config),
}));

const REPRICER_API_BASE_URL = "http://test-api.example.com";

jest.mock("../config", () => ({
  applicationConfig: {
    REPRICER_API_BASE_URL,
  },
}));

import { Set, Has, Get, GetAllCache, DeleteCacheByKey, FlushCache, DeleteExternalCache } from "../cache-helper";

describe("cache-helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FlushCache();
  });

  describe("Set", () => {
    it("stores a value for a key", () => {
      Set("key1", { foo: "bar" });
      expect(Get("key1")).toEqual({ foo: "bar" });
    });

    it("overwrites existing value for same key", () => {
      Set("key1", "first");
      Set("key1", "second");
      expect(Get("key1")).toBe("second");
    });

    it("stores primitive values", () => {
      Set("num", 42);
      Set("str", "hello");
      Set("bool", true);
      Set("null", null);
      expect(Get("num")).toBe(42);
      expect(Get("str")).toBe("hello");
      expect(Get("bool")).toBe(true);
      expect(Get("null")).toBe(null);
    });

    it("stores array and object", () => {
      const arr = [1, 2, 3];
      const obj = { a: 1, b: 2 };
      Set("arr", arr);
      Set("obj", obj);
      expect(Get("arr")).toEqual(arr);
      expect(Get("obj")).toEqual(obj);
    });
  });

  describe("Has", () => {
    it("returns true when key exists", () => {
      Set("exists", "value");
      expect(Has("exists")).toBe(true);
    });

    it("returns false when key does not exist", () => {
      expect(Has("missing")).toBe(false);
    });

    it("returns false when key is empty string", () => {
      expect(Has("")).toBe(false);
    });

    it("returns false when key is falsy (undefined-like)", () => {
      expect(Has(undefined as unknown as string)).toBe(false);
    });
  });

  describe("Get", () => {
    it("returns stored value when key exists", () => {
      Set("k", "v");
      expect(Get("k")).toBe("v");
    });

    it("returns undefined when key does not exist (node-cache behavior)", () => {
      expect(Get("nonexistent")).toBeUndefined();
    });

    it("returns null when key is empty string", () => {
      expect(Get("")).toBe(null);
    });

    it("returns null when key is falsy", () => {
      expect(Get(undefined as unknown as string)).toBe(null);
    });
  });

  describe("GetAllCache", () => {
    it("returns empty array when cache is empty", () => {
      expect(GetAllCache()).toEqual([]);
    });

    it("returns all keys when cache has entries", () => {
      Set("a", 1);
      Set("b", 2);
      Set("c", 3);
      const keys = GetAllCache();
      expect(keys).toHaveLength(3);
      expect(keys).toContain("a");
      expect(keys).toContain("b");
      expect(keys).toContain("c");
    });
  });

  describe("DeleteCacheByKey", () => {
    it("deletes key and returns number of deleted keys (1)", () => {
      Set("toDelete", "x");
      const result = DeleteCacheByKey("toDelete");
      expect(result).toBe(1);
      expect(Has("toDelete")).toBe(false);
      expect(Get("toDelete")).toBeUndefined();
    });

    it("returns 0 when key did not exist", () => {
      const result = DeleteCacheByKey("neverExisted");
      expect(result).toBe(0);
    });

    it("returns empty string when key is empty/falsy", () => {
      const result = DeleteCacheByKey("");
      expect(result).toBe("");
    });

    it("returns empty string when key is falsy", () => {
      const result = DeleteCacheByKey(undefined as unknown as string);
      expect(result).toBe("");
    });
  });

  describe("FlushCache", () => {
    it("removes all keys", () => {
      Set("x", 1);
      Set("y", 2);
      FlushCache();
      expect(GetAllCache()).toEqual([]);
      expect(Get("x")).toBeUndefined();
      expect(Get("y")).toBeUndefined();
    });

    it("is idempotent", () => {
      FlushCache();
      FlushCache();
      expect(GetAllCache()).toEqual([]);
    });
  });

  describe("DeleteExternalCache", () => {
    it("calls GET on REPRICER_API_BASE_URL/cache/flush/:key", async () => {
      mockAxios.mockResolvedValueOnce({ status: 200 });

      await DeleteExternalCache("myKey");

      expect(mockAxios).toHaveBeenCalledTimes(1);
      expect(mockAxios).toHaveBeenCalledWith({
        method: "get",
        url: `${REPRICER_API_BASE_URL}/cache/flush/myKey`,
      });
    });

    it("resolves when axios succeeds", async () => {
      mockAxios.mockResolvedValueOnce({ data: "ok" });

      await expect(DeleteExternalCache("key")).resolves.toBeUndefined();
    });

    it("rejects when axios throws", async () => {
      const err = new Error("Network error");
      mockAxios.mockRejectedValueOnce(err);

      await expect(DeleteExternalCache("key")).rejects.toThrow("Network error");
    });

    it("uses correct URL for key with special characters", async () => {
      mockAxios.mockResolvedValueOnce({});

      await DeleteExternalCache("user:123:session");

      expect(mockAxios).toHaveBeenCalledWith({
        method: "get",
        url: `${REPRICER_API_BASE_URL}/cache/flush/user:123:session`,
      });
    });
  });
});
