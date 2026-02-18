// Mock dependencies before imports
jest.mock("../config", () => ({
  applicationConfig: {
    MANAGED_MONGO_URL: "mongodb://test",
    MANAGED_MONGO_PASSWORD: "test-password",
    SQL_HOSTNAME: "localhost",
    SQL_PORT: 3306,
    SQL_USERNAME: "test-user",
    SQL_PASSWORD: "test-password",
    SQL_DATABASE: "test-db",
    SHIPPING_DATA_PROXY_SCRAPE_API_KEY: "test-api-key",
    CACHE_HOST_URL: "localhost",
    CACHE_USERNAME: "test-user",
    CACHE_PASSWORD: "test-password",
    CACHE_PORT: 6379,
    MINI_ERP_BASE_URL: "https://test-mini-erp.com",
    MINI_ERP_USERNAME: "test-user",
    MINI_ERP_PASSWORD: "test-password",
  },
}));

jest.mock("@repricer-monorepo/shared", () => ({
  CacheKey: {},
  VendorName: {},
  VendorNameLookup: {},
}));

jest.mock("lodash");
jest.mock("../mysql/mysql-v2");

import _ from "lodash";
import * as sqlV2Service from "../mysql/mysql-v2";
import { GetProxy, GetProxyDetailsByName, GetProxyDetailsById, InitProxy, GetProxyV2 } from "../proxy-helper";

const mockedLodash = _ as jest.Mocked<typeof _>;
const mockedSqlV2Service = sqlV2Service as jest.Mocked<typeof sqlV2Service>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("proxy-helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mock for lodash.first
    mockedLodash.first = jest.fn((array: any) => (array && array.length > 0 ? array[0] : undefined));
    // Default mock for lodash.concat
    mockedLodash.concat = jest.fn((...args: any[]) => {
      const result: any[] = [];
      args.forEach((arg) => {
        if (Array.isArray(arg)) {
          result.push(...arg);
        } else if (arg != null) {
          result.push(arg);
        }
      });
      return result;
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("GetProxy", () => {
    it("should return default proxy result when cron details are null", async () => {
      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(null);

      const result = await GetProxy("test-cron");

      expect(result).toEqual({ protocol: "http" });
      expect(mockedSqlV2Service.GetCronSettingsDetailsByName).toHaveBeenCalledWith("test-cron");
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).not.toHaveBeenCalled();
    });

    it("should return default proxy result when cron details are undefined", async () => {
      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(undefined);

      const result = await GetProxy("test-cron");

      expect(result).toEqual({ protocol: "http" });
      expect(mockedSqlV2Service.GetCronSettingsDetailsByName).toHaveBeenCalledWith("test-cron");
    });

    it("should handle empty array cron details (edge case - will throw)", async () => {
      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue([]);
      mockedLodash.first.mockReturnValue(undefined);

      // When cronDetails is empty array, _.first returns undefined
      // Accessing ProxyProvider on undefined will throw an error
      await expect(GetProxy("test-cron")).rejects.toThrow();
      expect(mockedSqlV2Service.GetCronSettingsDetailsByName).toHaveBeenCalledWith("test-cron");
    });

    it("should handle proxy provider 0 correctly", async () => {
      const mockCronDetails = [
        {
          ProxyProvider: 0,
        },
      ];
      const mockProxyDetails = [
        {
          hostUrl: "proxy.example.com",
          port: 8080,
          userName: "user1",
          password: "pass1",
        },
      ];

      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(mockCronDetails as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxy("test-cron");

      expect(result).toEqual({
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
        auth: {
          username: "user1",
          password: "pass1",
        },
      });
      expect(mockedSqlV2Service.GetCronSettingsDetailsByName).toHaveBeenCalledWith("test-cron");
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(0);
    });

    it("should handle proxy provider 1 with ipType 0 (FixedIp)", async () => {
      const mockCronDetails = [
        {
          ProxyProvider: 1,
          IpType: 0,
          FixedIp: "fixed-ip.example.com",
        },
      ];
      const mockProxyDetails = [
        {
          ipType: 0,
          hostUrl: "proxy.example.com",
          port: 8080,
          userName: "user1",
          password: "pass1",
          method: "GET",
        },
      ];

      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(mockCronDetails as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxy("test-cron");

      expect(result).toEqual({
        protocol: "http",
        host: "fixed-ip.example.com",
        port: 8080,
        auth: {
          username: "user1",
          password: "pass1",
        },
        dummyMethod: "GET",
      });
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(1);
    });

    it("should handle proxy provider 1 with ipType 1 (hostUrl)", async () => {
      const mockCronDetails = [
        {
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: "fixed-ip.example.com",
        },
      ];
      const mockProxyDetails = [
        {
          ipType: 1,
          hostUrl: "proxy.example.com",
          port: 8080,
          userName: "user1",
          password: "pass1",
          method: "POST",
        },
      ];

      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(mockCronDetails as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxy("test-cron");

      expect(result).toEqual({
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
        auth: {
          username: "user1",
          password: "pass1",
        },
        dummyMethod: "POST",
      });
    });

    it("should handle proxy provider 1 when contextProxy is not found", async () => {
      const mockCronDetails = [
        {
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: "fixed-ip.example.com",
        },
      ];
      const mockProxyDetails = [
        {
          ipType: 0, // Different ipType, so won't match
          hostUrl: "proxy.example.com",
          port: 8080,
          userName: "user1",
          password: "pass1",
        },
      ];

      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(mockCronDetails as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxy("test-cron");

      expect(result).toEqual({
        protocol: "http",
        host: undefined,
        port: undefined,
        auth: {
          username: undefined,
          password: undefined,
        },
        dummyMethod: undefined,
      });
    });

    it("should handle proxy provider 2 correctly", async () => {
      const mockCronDetails = [
        {
          ProxyProvider: 2,
        },
      ];
      const mockProxyDetails = [
        {
          hostUrl: "proxy2.example.com",
          port: 9090,
          userName: "user2",
          password: "pass2",
        },
      ];

      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(mockCronDetails as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxy("test-cron");

      expect(result).toEqual({
        protocol: "http",
        host: "proxy2.example.com",
        port: 9090,
        auth: {
          username: "user2",
          password: "pass2",
        },
      });
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(2);
    });

    it("should handle default case (unknown proxy provider)", async () => {
      const mockCronDetails = [
        {
          ProxyProvider: 99, // Unknown provider
        },
      ];
      const mockProxyDetails = [
        {
          hostUrl: "proxy.example.com",
          port: 8080,
        },
      ];

      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(mockCronDetails as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxy("test-cron");

      expect(result).toEqual({
        protocol: "http",
      });
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(99);
    });

    it("should handle empty proxy details array for provider 0", async () => {
      const mockCronDetails = [
        {
          ProxyProvider: 0,
        },
      ];

      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(mockCronDetails as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([]);

      const result = await GetProxy("test-cron");

      expect(result).toEqual({
        protocol: "http",
        host: undefined,
        port: undefined,
        auth: {
          username: undefined,
          password: undefined,
        },
      });
    });

    it("should handle null proxy details for provider 0", async () => {
      const mockCronDetails = [
        {
          ProxyProvider: 0,
        },
      ];

      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(mockCronDetails as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(null);

      const result = await GetProxy("test-cron");

      expect(result).toEqual({
        protocol: "http",
        host: undefined,
        port: undefined,
        auth: {
          username: undefined,
          password: undefined,
        },
      });
    });
  });

  describe("GetProxyDetailsByName", () => {
    it("should return cron settings details by name", async () => {
      const mockCronDetails = [
        {
          CronName: "test-cron",
          CronId: 1,
          ProxyProvider: 0,
        },
      ];

      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(mockCronDetails as any);

      const result = await GetProxyDetailsByName("test-cron");

      expect(result).toEqual(mockCronDetails);
      expect(mockedSqlV2Service.GetCronSettingsDetailsByName).toHaveBeenCalledWith("test-cron");
    });

    it("should return null when cron not found", async () => {
      mockedSqlV2Service.GetCronSettingsDetailsByName.mockResolvedValue(null);

      const result = await GetProxyDetailsByName("non-existent-cron");

      expect(result).toBeNull();
      expect(mockedSqlV2Service.GetCronSettingsDetailsByName).toHaveBeenCalledWith("non-existent-cron");
    });
  });

  describe("GetProxyDetailsById", () => {
    it("should find cron details by ID in regular cron list", async () => {
      const mockRegularCronDetails = [
        { CronId: 1, CronName: "cron-1" },
        { CronId: 2, CronName: "cron-2" },
        { CronId: 3, CronName: "cron-3" },
      ];
      const mockSlowCronDetails = [{ CronId: 4, CronName: "slow-cron-1" }];

      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue(mockRegularCronDetails as any);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue(mockSlowCronDetails as any);
      mockedLodash.concat.mockImplementation((...args) => {
        const result: any[] = [];
        args.forEach((arg) => {
          if (Array.isArray(arg)) {
            result.push(...arg);
          } else if (arg != null) {
            result.push(arg);
          }
        });
        return result;
      });

      const result = await GetProxyDetailsById(2);

      expect(result).toEqual([{ CronId: 2, CronName: "cron-2" }]);
      expect(mockedSqlV2Service.GetCronSettingsList).toHaveBeenCalled();
      expect(mockedSqlV2Service.GetSlowCronDetails).toHaveBeenCalled();
    });

    it("should find cron details by ID in slow cron list", async () => {
      const mockRegularCronDetails = [{ CronId: 1, CronName: "cron-1" }];
      const mockSlowCronDetails = [
        { CronId: 4, CronName: "slow-cron-1" },
        { CronId: 5, CronName: "slow-cron-2" },
      ];

      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue(mockRegularCronDetails as any);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue(mockSlowCronDetails as any);
      mockedLodash.concat.mockImplementation((...args) => {
        const result: any[] = [];
        args.forEach((arg) => {
          if (Array.isArray(arg)) {
            result.push(...arg);
          } else if (arg != null) {
            result.push(arg);
          }
        });
        return result;
      });

      const result = await GetProxyDetailsById(5);

      expect(result).toEqual([{ CronId: 5, CronName: "slow-cron-2" }]);
    });

    it("should return empty array when cron ID not found", async () => {
      const mockRegularCronDetails = [{ CronId: 1, CronName: "cron-1" }];
      const mockSlowCronDetails = [{ CronId: 4, CronName: "slow-cron-1" }];

      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue(mockRegularCronDetails as any);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue(mockSlowCronDetails as any);
      mockedLodash.concat.mockImplementation((...args) => {
        const result: any[] = [];
        args.forEach((arg) => {
          if (Array.isArray(arg)) {
            result.push(...arg);
          } else if (arg != null) {
            result.push(arg);
          }
        });
        return result;
      });

      const result = await GetProxyDetailsById(999);

      expect(result).toEqual([]);
    });

    it("should handle empty cron lists", async () => {
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue([]);
      mockedLodash.concat.mockReturnValue([]);

      const result = await GetProxyDetailsById(1);

      expect(result).toEqual([]);
    });

    it("should handle null cron lists (edge case - will throw)", async () => {
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue(null);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue(null);
      // When both are null, _.concat(null, null) returns [null, null] in lodash
      // The find method will try to access CronId on null, causing an error
      mockedLodash.concat.mockReturnValue([null, null] as any);

      await expect(GetProxyDetailsById(1)).rejects.toThrow();
    });

    it("should handle mixed null and empty arrays (edge case - will throw)", async () => {
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue(null);
      // When one is array and one is null, _.concat returns array with null
      // The find method will try to access CronId on null, causing an error
      mockedLodash.concat.mockReturnValue([null] as any);

      await expect(GetProxyDetailsById(1)).rejects.toThrow();
    });
  });

  describe("InitProxy", () => {
    it("should initialize proxy with all fields", async () => {
      const mockProxyConfigDetails = {
        hostUrl: "proxy.example.com",
        port: 8080,
        userName: "user1",
        password: "pass1",
        method: "GET",
      };

      const result = await InitProxy(mockProxyConfigDetails);

      expect(result).toEqual({
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
        auth: {
          username: "user1",
          password: "pass1",
        },
        dummyMethod: "GET",
      });
    });

    it("should initialize proxy with minimal fields", async () => {
      const mockProxyConfigDetails = {
        hostUrl: "proxy.example.com",
        port: 8080,
        userName: "user1",
        password: "pass1",
      };

      const result = await InitProxy(mockProxyConfigDetails);

      expect(result).toEqual({
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
        auth: {
          username: "user1",
          password: "pass1",
        },
        dummyMethod: undefined,
      });
    });

    it("should initialize proxy with undefined fields", async () => {
      const mockProxyConfigDetails = {
        hostUrl: undefined,
        port: undefined,
        userName: undefined,
        password: undefined,
        method: undefined,
      };

      const result = await InitProxy(mockProxyConfigDetails);

      expect(result).toEqual({
        protocol: "http",
        host: undefined,
        port: undefined,
        auth: {
          username: undefined,
          password: undefined,
        },
        dummyMethod: undefined,
      });
    });

    it("should initialize proxy with null fields", async () => {
      const mockProxyConfigDetails = {
        hostUrl: null,
        port: null,
        userName: null,
        password: null,
        method: null,
      };

      const result = await InitProxy(mockProxyConfigDetails);

      expect(result).toEqual({
        protocol: "http",
        host: null,
        port: null,
        auth: {
          username: null,
          password: null,
        },
        dummyMethod: null,
      });
    });
  });

  describe("GetProxyV2", () => {
    it("should return default proxy result when cronSettings is null", async () => {
      const result = await GetProxyV2(null, 0);

      expect(result).toEqual({ protocol: "http" });
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).not.toHaveBeenCalled();
    });

    it("should return default proxy result when cronSettings is undefined", async () => {
      const result = await GetProxyV2(undefined, 0);

      expect(result).toEqual({ protocol: "http" });
    });

    it("should handle proxy provider 0 correctly", async () => {
      const mockCronSettings = {
        ProxyProvider: 0,
      };
      const mockProxyDetails = [
        {
          hostUrl: "proxy.example.com",
          port: 8080,
          userName: "user1",
          password: "pass1",
        },
      ];

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxyV2(mockCronSettings, 0);

      expect(result).toEqual({
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
        auth: {
          username: "user1",
          password: "pass1",
        },
      });
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(0);
    });

    it("should handle proxy provider 1 with ipType 0 (FixedIp)", async () => {
      const mockCronSettings = {
        ProxyProvider: 1,
        IpType: 0,
        FixedIp: "fixed-ip.example.com",
      };
      const mockProxyDetails = [
        {
          ipType: 0,
          hostUrl: "proxy.example.com",
          port: 8080,
          userName: "user1",
          password: "pass1",
          method: "GET",
        },
      ];

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxyV2(mockCronSettings, 1);

      expect(result).toEqual({
        protocol: "http",
        host: "fixed-ip.example.com",
        port: 8080,
        auth: {
          username: "user1",
          password: "pass1",
        },
        dummyMethod: "GET",
      });
    });

    it("should handle proxy provider 1 with ipType 1 (hostUrl)", async () => {
      const mockCronSettings = {
        ProxyProvider: 1,
        IpType: 1,
        FixedIp: "fixed-ip.example.com",
      };
      const mockProxyDetails = [
        {
          ipType: 1,
          hostUrl: "proxy.example.com",
          port: 8080,
          userName: "user1",
          password: "pass1",
          method: "POST",
        },
      ];

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxyV2(mockCronSettings, 1);

      expect(result).toEqual({
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
        auth: {
          username: "user1",
          password: "pass1",
        },
        dummyMethod: "POST",
      });
    });

    it("should handle proxy provider 1 when contextProxy is not found", async () => {
      const mockCronSettings = {
        ProxyProvider: 1,
        IpType: 1,
        FixedIp: "fixed-ip.example.com",
      };
      const mockProxyDetails = [
        {
          ipType: 0, // Different ipType, so won't match
          hostUrl: "proxy.example.com",
          port: 8080,
          userName: "user1",
          password: "pass1",
        },
      ];

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxyV2(mockCronSettings, 1);

      expect(result).toEqual({
        protocol: "http",
        host: undefined,
        port: undefined,
        auth: {
          username: undefined,
          password: undefined,
        },
        dummyMethod: undefined,
      });
    });

    it("should handle proxy provider 2 correctly", async () => {
      const mockCronSettings = {
        ProxyProvider: 2,
      };
      const mockProxyDetails = [
        {
          hostUrl: "proxy2.example.com",
          port: 9090,
          userName: "user2",
          password: "pass2",
        },
      ];

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxyV2(mockCronSettings, 2);

      expect(result).toEqual({
        protocol: "http",
        host: "proxy2.example.com",
        port: 9090,
        auth: {
          username: "user2",
          password: "pass2",
        },
      });
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(2);
    });

    it("should handle default case (unknown proxy provider)", async () => {
      const mockCronSettings = {
        ProxyProvider: 99,
      };
      const mockProxyDetails = [
        {
          hostUrl: "proxy.example.com",
          port: 8080,
        },
      ];

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxyV2(mockCronSettings, 99);

      expect(result).toEqual({
        protocol: "http",
      });
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(99);
    });

    it("should handle empty proxy details array for provider 0", async () => {
      const mockCronSettings = {
        ProxyProvider: 0,
      };

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([]);

      const result = await GetProxyV2(mockCronSettings, 0);

      expect(result).toEqual({
        protocol: "http",
        host: undefined,
        port: undefined,
        auth: {
          username: undefined,
          password: undefined,
        },
      });
    });

    it("should handle null proxy details for provider 0", async () => {
      const mockCronSettings = {
        ProxyProvider: 0,
      };

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(null);

      const result = await GetProxyV2(mockCronSettings, 0);

      expect(result).toEqual({
        protocol: "http",
        host: undefined,
        port: undefined,
        auth: {
          username: undefined,
          password: undefined,
        },
      });
    });

    it("should use provided proxyProvider parameter instead of cronSettings.ProxyProvider", async () => {
      const mockCronSettings = {
        ProxyProvider: 0, // This should be ignored
      };
      const mockProxyDetails = [
        {
          hostUrl: "proxy.example.com",
          port: 8080,
          userName: "user1",
          password: "pass1",
        },
      ];

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue(mockProxyDetails as any);

      const result = await GetProxyV2(mockCronSettings, 2);

      expect(result).toEqual({
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
        auth: {
          username: "user1",
          password: "pass1",
        },
      });
      // Should use the provided proxyProvider parameter (2), not cronSettings.ProxyProvider (0)
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(2);
    });
  });
});
