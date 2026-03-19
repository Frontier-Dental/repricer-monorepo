interface RedisMock {
  isOpen: boolean;
  connect: jest.Mock;
  set: jest.Mock;
  setEx: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
  exists: jest.Mock;
  flushAll: jest.Mock;
  on: jest.Mock;
  scan: jest.Mock;
}

let mockRedisClient: RedisMock;

jest.mock("redis", () => ({
  createClient: jest.fn((opts?: unknown) => mockRedisClient),
}));

const mockDecrypt = jest.fn();
jest.mock("../../utility/encrypto", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    decrypt: mockDecrypt,
  })),
}));

import CacheClient from "../cacheClient";
import { GetCacheClientOptions } from "../cacheClient";

function createMockRedisClient(): RedisMock {
  return {
    isOpen: true,
    connect: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    setEx: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(0),
    exists: jest.fn().mockResolvedValue(0),
    flushAll: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    scan: jest.fn().mockResolvedValue({ cursor: "0", keys: [] }),
  };
}

describe("CacheClient", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeAll(() => {
    mockRedisClient = createMockRedisClient();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.isOpen = true;
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.set.mockResolvedValue(undefined);
    mockRedisClient.setEx.mockResolvedValue(undefined);
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.del.mockResolvedValue(0);
    mockRedisClient.exists.mockResolvedValue(0);
    mockRedisClient.flushAll.mockResolvedValue(undefined);
    mockRedisClient.scan.mockResolvedValue({ cursor: "0", keys: [] });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("getInstance", () => {
    it("returns the same singleton instance on multiple calls", () => {
      const a = CacheClient.getInstance();
      const b = CacheClient.getInstance();
      expect(a).toBe(b);
    });

    it("creates client with default options when option is null", () => {
      (CacheClient as any).instance = undefined;
      const { createClient } = require("redis");
      (createClient as jest.Mock).mockClear();
      CacheClient.getInstance(null);
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          socket: expect.objectContaining({
            host: "localhost",
            port: 25061,
            tls: true,
            connectTimeout: 20000,
          }),
          username: undefined,
          password: undefined,
        })
      );
    });

    it("creates client with provided options when option is passed", () => {
      const { createClient } = require("redis");
      (CacheClient as any).instance = undefined;
      CacheClient.getInstance({
        host: "redis.example.com",
        port: 6380,
        username: "user",
        password: "secret",
        useTLS: false,
      });
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          socket: expect.objectContaining({
            host: "redis.example.com",
            port: 6380,
          }),
          username: "user",
          password: "secret",
        })
      );
    });

    it("registers error handler on the client", () => {
      (CacheClient as any).instance = undefined;
      const { createClient } = require("redis");
      (createClient as jest.Mock).mockClear();
      CacheClient.getInstance();
      expect(mockRedisClient.on).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });

  describe("set", () => {
    it("serializes value and calls set when connected and no TTL", async () => {
      const cache = CacheClient.getInstance();
      await cache.set("k1", { foo: "bar" });
      expect(mockRedisClient.set).toHaveBeenCalledWith("k1", JSON.stringify({ foo: "bar" }));
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });

    it("calls setEx when ttlInSeconds is provided", async () => {
      const cache = CacheClient.getInstance();
      await cache.set("k2", "value", 3600);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith("k2", 3600, JSON.stringify("value"));
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it("skips set and logs when not connected", async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.connect.mockRejectedValue(new Error("connect failed"));
      const cache = CacheClient.getInstance();
      await cache.set("k", "v");
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Redis set skipped"));
    });

    it("logs and swallows error when set throws", async () => {
      mockRedisClient.set.mockRejectedValueOnce(new Error("set failed"));
      const cache = CacheClient.getInstance();
      await cache.set("k", "v");
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Redis set error"), expect.any(Error));
    });
  });

  describe("get", () => {
    it("returns parsed value when key exists", async () => {
      const data = { id: 1, name: "test" };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(data));
      const cache = CacheClient.getInstance();
      const result = await cache.get<typeof data>("key");
      expect(result).toEqual(data);
      expect(mockRedisClient.get).toHaveBeenCalledWith("key");
    });

    it("returns null when key does not exist", async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      const cache = CacheClient.getInstance();
      const result = await cache.get("missing");
      expect(result).toBeNull();
    });

    it("returns null when not connected", async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.connect.mockRejectedValue(new Error("fail"));
      const cache = CacheClient.getInstance();
      const result = await cache.get("key");
      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it("returns null and logs when get throws", async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error("get failed"));
      const cache = CacheClient.getInstance();
      const result = await cache.get("key");
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Redis get error"), expect.any(Error));
    });
  });

  describe("delete", () => {
    it("returns number of deleted keys when connected", async () => {
      mockRedisClient.del.mockResolvedValueOnce(1);
      const cache = CacheClient.getInstance();
      const result = await cache.delete("key");
      expect(result).toBe(1);
      expect(mockRedisClient.del).toHaveBeenCalledWith("key");
    });

    it("returns 0 when not connected", async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.connect.mockRejectedValue(new Error("fail"));
      const cache = CacheClient.getInstance();
      const result = await cache.delete("key");
      expect(result).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it("returns 0 and logs when delete throws", async () => {
      mockRedisClient.del.mockRejectedValueOnce(new Error("del failed"));
      const cache = CacheClient.getInstance();
      const result = await cache.delete("key");
      expect(result).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Redis delete error"), expect.any(Error));
    });
  });

  describe("exists", () => {
    it("returns true when key exists", async () => {
      mockRedisClient.exists.mockResolvedValueOnce(1);
      const cache = CacheClient.getInstance();
      const result = await cache.exists("key");
      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith("key");
    });

    it("returns false when key does not exist", async () => {
      mockRedisClient.exists.mockResolvedValueOnce(0);
      const cache = CacheClient.getInstance();
      const result = await cache.exists("key");
      expect(result).toBe(false);
    });

    it("returns false when not connected", async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.connect.mockRejectedValue(new Error("fail"));
      const cache = CacheClient.getInstance();
      const result = await cache.exists("key");
      expect(result).toBe(false);
      expect(mockRedisClient.exists).not.toHaveBeenCalled();
    });

    it("returns false and logs when exists throws", async () => {
      mockRedisClient.exists.mockRejectedValueOnce(new Error("exists failed"));
      const cache = CacheClient.getInstance();
      const result = await cache.exists("key");
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Redis exists error"), expect.any(Error));
    });
  });

  describe("flushAll", () => {
    it("calls flushAll when connected", async () => {
      const cache = CacheClient.getInstance();
      await cache.flushAll();
      expect(mockRedisClient.flushAll).toHaveBeenCalledTimes(1);
    });

    it("does nothing when not connected", async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.connect.mockRejectedValue(new Error("fail"));
      const cache = CacheClient.getInstance();
      await cache.flushAll();
      expect(mockRedisClient.flushAll).not.toHaveBeenCalled();
    });
  });

  describe("ensureConnected", () => {
    it("reconnects and returns true when isOpen was false and connect succeeds", async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      const cache = CacheClient.getInstance();
      const result = await cache.get("key");
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("reconnecting"));
      mockRedisClient.get.mockResolvedValue(null);
      expect(result).toBeNull();
    });

    it("returns false when isOpen is false and connect fails", async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.connect.mockRejectedValue(new Error("connection failed"));
      const cache = CacheClient.getInstance();
      const result = await cache.get("key");
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Redis connection failed"), expect.any(Error));
    });
  });

  describe("getAllKeys", () => {
    it("returns keys only when withValues is false", async () => {
      mockRedisClient.scan.mockResolvedValueOnce({ cursor: "1", keys: ["a", "b"] }).mockResolvedValueOnce({ cursor: "0", keys: ["c"] });
      const cache = CacheClient.getInstance();
      const result = await cache.getAllKeys(false);
      expect(result).toEqual(["a", "b", "c"]);
      expect(mockRedisClient.scan).toHaveBeenCalledWith("0", { COUNT: 100 });
      expect(mockRedisClient.scan).toHaveBeenCalledWith("1", { COUNT: 100 });
    });

    it("returns empty array when not connected and withValues is false", async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.connect.mockRejectedValue(new Error("fail"));
      const cache = CacheClient.getInstance();
      const result = await cache.getAllKeys(false);
      expect(result).toEqual([]);
    });

    it("returns record of key-value when withValues is true", async () => {
      mockRedisClient.scan.mockResolvedValue({ cursor: "0", keys: ["k1", "k2"] });
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ v: 1 })).mockResolvedValueOnce(JSON.stringify("two"));
      const cache = CacheClient.getInstance();
      const result = await cache.getAllKeys(true);
      expect(result).toEqual({
        k1: { v: 1 },
        k2: "two",
      });
      expect(mockRedisClient.get).toHaveBeenCalledWith("k1");
      expect(mockRedisClient.get).toHaveBeenCalledWith("k2");
    });

    it("parses null value as null in getAllKeys with values", async () => {
      mockRedisClient.scan.mockResolvedValue({ cursor: "0", keys: ["empty"] });
      mockRedisClient.get.mockResolvedValueOnce(null);
      const cache = CacheClient.getInstance();
      const result = await cache.getAllKeys(true);
      expect(result).toEqual({ empty: null });
    });

    it("returns empty object when not connected and withValues is true", async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.connect.mockRejectedValue(new Error("fail"));
      const cache = CacheClient.getInstance();
      const result = await cache.getAllKeys(true);
      expect(result).toEqual({});
    });

    it("returns empty array/object and logs when getAllKeys throws", async () => {
      mockRedisClient.scan.mockRejectedValueOnce(new Error("scan failed"));
      const cache = CacheClient.getInstance();
      const resultNoValues = await cache.getAllKeys(false);
      expect(resultNoValues).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("getAllKeys error"), expect.any(Error));

      mockRedisClient.scan.mockRejectedValueOnce(new Error("scan failed again"));
      const resultWithValues = await cache.getAllKeys(true);
      expect(resultWithValues).toEqual({});
    });
  });

  describe("disconnect", () => {
    it("resolves without doing anything (no-op)", async () => {
      const cache = CacheClient.getInstance();
      await expect(cache.disconnect()).resolves.toBeUndefined();
    });
  });
});

describe("GetCacheClientOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecrypt.mockReturnValue("decrypted-password");
  });

  it("returns options with decrypted password and config values", () => {
    const applicationConfig = {
      REPRICER_ENCRYPTION_KEY: "enc-key",
      CACHE_PASSWORD: "encrypted-val",
      CACHE_HOST_URL: "cache.host.com",
      CACHE_PORT: "6380",
      CACHE_USERNAME: "cacheuser",
    };
    const result = GetCacheClientOptions(applicationConfig);
    expect(mockDecrypt).toHaveBeenCalledWith("encrypted-val");
    expect(result).toEqual({
      host: "cache.host.com",
      port: 6380,
      username: "cacheuser",
      password: "decrypted-password",
      useTLS: false,
    });
  });

  it("uses Number for port", () => {
    const result = GetCacheClientOptions({
      REPRICER_ENCRYPTION_KEY: "k",
      CACHE_PASSWORD: "p",
      CACHE_HOST_URL: "h",
      CACHE_PORT: "12345",
    });
    expect(result.port).toBe(12345);
    expect(typeof result.port).toBe("number");
  });
});
