/**
 * Unit tests for cache-helper: in-memory cache (Set, Get, Has, etc.) and external cache flush.
 * node-cache, config, and axios are mocked.
 */

const mockInstance = {
  set: jest.fn(),
  has: jest.fn(),
  get: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
  flushAll: jest.fn(),
};

jest.mock("node-cache", () => ({
  __esModule: true,
  default: jest.fn(() => mockInstance),
}));

jest.mock("../config", () => ({
  applicationConfig: {
    REPRICER_API_BASE_URL: "https://repricer-api.test",
  },
}));

const axiosMock = jest.fn();
jest.mock("axios", () => ({
  __esModule: true,
  default: axiosMock,
}));

import * as cacheHelper from "../cache-helper";

describe("cache-helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Set", () => {
    it("calls cache set with key and value", () => {
      cacheHelper.Set("key1", { foo: "bar" });
      expect(mockInstance.set).toHaveBeenCalledTimes(1);
      expect(mockInstance.set).toHaveBeenCalledWith("key1", { foo: "bar" });
    });

    it("accepts string value", () => {
      cacheHelper.Set("key2", "value");
      expect(mockInstance.set).toHaveBeenCalledWith("key2", "value");
    });

    it("accepts primitive values", () => {
      cacheHelper.Set("num", 42);
      cacheHelper.Set("flag", true);
      expect(mockInstance.set).toHaveBeenCalledWith("num", 42);
      expect(mockInstance.set).toHaveBeenCalledWith("flag", true);
    });
  });

  describe("Has", () => {
    it("returns result of cache.has when key is truthy", () => {
      mockInstance.has.mockReturnValue(true);
      expect(cacheHelper.Has("some-key")).toBe(true);
      expect(mockInstance.has).toHaveBeenCalledWith("some-key");

      mockInstance.has.mockReturnValue(false);
      expect(cacheHelper.Has("other")).toBe(false);
    });

    it("returns false when key is empty string", () => {
      expect(cacheHelper.Has("")).toBe(false);
      expect(mockInstance.has).not.toHaveBeenCalled();
    });
  });

  describe("Get", () => {
    it("returns result of cache.get when key is truthy", () => {
      const value = { data: 1 };
      mockInstance.get.mockReturnValue(value);
      expect(cacheHelper.Get("key")).toBe(value);
      expect(mockInstance.get).toHaveBeenCalledWith("key");
    });

    it("returns null when key is empty string", () => {
      expect(cacheHelper.Get("")).toBeNull();
      expect(mockInstance.get).not.toHaveBeenCalled();
    });

    it("returns whatever cache.get returns (including undefined)", () => {
      mockInstance.get.mockReturnValue(undefined);
      expect(cacheHelper.Get("missing")).toBeUndefined();
    });
  });

  describe("GetAllCache", () => {
    it("returns cache.keys()", () => {
      const keys = ["a", "b", "c"];
      mockInstance.keys.mockReturnValue(keys);
      expect(cacheHelper.GetAllCache()).toEqual(keys);
      expect(mockInstance.keys).toHaveBeenCalledTimes(1);
    });
  });

  describe("DeleteCacheByKey", () => {
    it("calls cache.del and returns its result when key is truthy", () => {
      mockInstance.del.mockReturnValue(1);
      expect(cacheHelper.DeleteCacheByKey("to-delete")).toBe(1);
      expect(mockInstance.del).toHaveBeenCalledWith("to-delete");
    });

    it("returns empty string when key is empty", () => {
      expect(cacheHelper.DeleteCacheByKey("")).toBe("");
      expect(mockInstance.del).not.toHaveBeenCalled();
    });
  });

  describe("FlushCache", () => {
    it("calls cache.flushAll and returns its result", () => {
      mockInstance.flushAll.mockReturnValue(undefined);
      expect(cacheHelper.FlushCache()).toBeUndefined();
      expect(mockInstance.flushAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("DeleteExternalCache", () => {
    it("calls axios GET with URL built from config and key", async () => {
      axiosMock.mockResolvedValue({ status: 200 });

      await cacheHelper.DeleteExternalCache("my-key");

      expect(axiosMock).toHaveBeenCalledTimes(1);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "get",
        url: "https://repricer-api.test/cache/flush/my-key",
      });
    });

    it("uses key in URL path", async () => {
      axiosMock.mockResolvedValue(undefined);

      await cacheHelper.DeleteExternalCache("session-123");

      expect(axiosMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://repricer-api.test/cache/flush/session-123",
        })
      );
    });

    it("propagates axios errors", async () => {
      const err = new Error("Network error");
      axiosMock.mockRejectedValue(err);

      await expect(cacheHelper.DeleteExternalCache("key")).rejects.toThrow("Network error");
    });
  });
});
