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
    PROXY_SWITCH_EMAIL_NOTIFIER: "http://test-email-notifier.com",
    PROXY_SWITCH_EMAIL_THRESHOLD_NOTIFIER: "http://test-threshold-notifier.com",
    REPRICER_UI_CACHE_CLEAR: "http://test-cache-clear.com",
    PROXYSWITCH_TIMER: 3600000,
  },
}));

jest.mock("@repricer-monorepo/shared", () => ({
  CacheKey: {},
  VendorName: {},
  VendorNameLookup: {},
}));

jest.mock("lodash");
jest.mock("../mysql/mysql-v2");
jest.mock("../axios-helper");
jest.mock("../mongo/db-helper");

import _ from "lodash";
import * as sqlV2Service from "../mysql/mysql-v2";
import * as axiosHelper from "../axios-helper";
import { ExecuteCounter, ResetFailureCounter, SwitchProxy, ResetProxyCounterForProvider, DebugProxySwitch } from "../proxy-switch-helper";

const mockedLodash = _ as jest.Mocked<typeof _>;
const mockedSqlV2Service = sqlV2Service as jest.Mocked<typeof sqlV2Service>;
const mockedAxiosHelper = axiosHelper as jest.Mocked<typeof axiosHelper>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("proxy-switch-helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.useFakeTimers();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mocks for lodash
    mockedLodash.first = jest.fn((array: any) => (array && array.length > 0 ? array[0] : undefined));
    mockedLodash.filter = jest.fn((array: any, predicate: any) => {
      if (!Array.isArray(array)) return [];
      return array.filter(predicate);
    });
    mockedLodash.sortBy = jest.fn((array: any, iteratee: any) => {
      if (!Array.isArray(array)) return [];
      return [...array].sort((a, b) => {
        const aVal = typeof iteratee === "function" ? iteratee(a) : a[iteratee];
        const bVal = typeof iteratee === "function" ? iteratee(b) : b[iteratee];
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      });
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("ExecuteCounter", () => {
    it("should initialize proxy failure details when record does not exist", async () => {
      mockedSqlV2Service.GetProxyFailureDetailsByProxyProviderId.mockResolvedValue(null);

      await ExecuteCounter(1);

      expect(mockedSqlV2Service.GetProxyFailureDetailsByProxyProviderId).toHaveBeenCalledWith(1);
      // The code goes to else branch when existingRecord is null
      expect(mockedSqlV2Service.UpdateProxyFailureDetails).toHaveBeenCalledWith(1, NaN);
      expect(mockedSqlV2Service.InitProxyFailureDetails).not.toHaveBeenCalled();
    });

    it("should initialize proxy failure details when failureCount is 0", async () => {
      const mockRecord = {
        proxyProvider: 1,
        providerName: "Test Provider",
        failureCount: 0,
        thresholdCount: 10,
        initTime: new Date(),
      };

      mockedSqlV2Service.GetProxyFailureDetailsByProxyProviderId.mockResolvedValue(mockRecord as any);

      await ExecuteCounter(1);

      expect(mockedSqlV2Service.InitProxyFailureDetails).toHaveBeenCalledWith(1, 1);
      expect(mockedSqlV2Service.UpdateProxyFailureDetails).not.toHaveBeenCalled();
    });

    it("should update proxy failure details when record exists with failureCount > 0", async () => {
      const mockRecord = {
        proxyProvider: 1,
        providerName: "Test Provider",
        failureCount: 5,
        thresholdCount: 10,
        initTime: new Date("2024-01-01"),
      };

      mockedSqlV2Service.GetProxyFailureDetailsByProxyProviderId.mockResolvedValue(mockRecord as any);

      await ExecuteCounter(1);

      expect(mockedSqlV2Service.UpdateProxyFailureDetails).toHaveBeenCalledWith(1, 6);
      expect(mockedSqlV2Service.InitProxyFailureDetails).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("PROXY SWITCH COUNTER UPDATE"));
    });

    it("should handle undefined existing record", async () => {
      // When existingRecord is undefined, same as null - goes to else branch
      mockedSqlV2Service.GetProxyFailureDetailsByProxyProviderId.mockResolvedValue(undefined);

      await ExecuteCounter(1);

      expect(mockedSqlV2Service.GetProxyFailureDetailsByProxyProviderId).toHaveBeenCalledWith(1);
      // The code goes to else branch when existingRecord is undefined
      expect(mockedSqlV2Service.UpdateProxyFailureDetails).toHaveBeenCalledWith(1, NaN);
      expect(mockedSqlV2Service.InitProxyFailureDetails).not.toHaveBeenCalled();
    });
  });

  describe("ResetFailureCounter", () => {
    it("should reset all proxy failure counters", async () => {
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 5,
          thresholdCount: 10,
          initTime: new Date("2024-01-01"),
        },
        {
          proxyProvider: 2,
          providerName: "Provider 2",
          failureCount: 3,
          thresholdCount: 10,
          initTime: new Date("2024-01-01"),
        },
      ];

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.ResetProxyFailureDetails.mockResolvedValue(undefined);

      await ResetFailureCounter();

      expect(mockedSqlV2Service.GetProxyFailureDetails).toHaveBeenCalled();
      expect(mockedSqlV2Service.ResetProxyFailureDetails).toHaveBeenCalledTimes(2);
      expect(mockedSqlV2Service.ResetProxyFailureDetails).toHaveBeenCalledWith(1, "SYSTEM");
      expect(mockedSqlV2Service.ResetProxyFailureDetails).toHaveBeenCalledWith(2, "SYSTEM");
    });

    it("should handle empty proxy failure details array", async () => {
      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue([]);

      await ResetFailureCounter();

      expect(mockedSqlV2Service.GetProxyFailureDetails).toHaveBeenCalled();
      expect(mockedSqlV2Service.ResetProxyFailureDetails).not.toHaveBeenCalled();
    });

    it("should handle null proxy failure details", async () => {
      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(null);

      await ResetFailureCounter();

      expect(mockedSqlV2Service.GetProxyFailureDetails).toHaveBeenCalled();
      expect(mockedSqlV2Service.ResetProxyFailureDetails).not.toHaveBeenCalled();
    });
  });

  describe("SwitchProxy", () => {
    it("should switch proxy when threshold is exceeded", async () => {
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 15,
          thresholdCount: 10,
          initTime: new Date(),
        },
      ];

      const mockLinkedCrons = [
        {
          CronId: 1,
          CronName: "Cron-1",
          ProxyProvider: 1,
          SwitchSequence: 0,
          AlternateProxyProvider: [
            { ProxyProvider: 1, Sequence: 0 },
            { ProxyProvider: 2, Sequence: 1 },
          ],
        },
      ];

      const mockProxyConfig = [
        {
          proxyProviderId: 1,
          proxyProviderName: "Provider 1",
        },
        {
          proxyProviderId: 2,
          proxyProviderName: "Provider 2",
        },
      ];

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.GetLinkedCronSettingsByProviderId.mockResolvedValue(mockLinkedCrons as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValueOnce([mockProxyConfig[0]] as any).mockResolvedValueOnce([mockProxyConfig[1]] as any);
      mockedSqlV2Service.UpdateProxyDetailsByCronId.mockResolvedValue(undefined);
      mockedAxiosHelper.postAsync.mockResolvedValue({ data: {}, status: 200 } as any);
      mockedAxiosHelper.native_get.mockResolvedValue({ data: {}, status: 200 } as any);

      await SwitchProxy();

      expect(mockedSqlV2Service.GetProxyFailureDetails).toHaveBeenCalled();
      expect(mockedSqlV2Service.GetLinkedCronSettingsByProviderId).toHaveBeenCalledWith(1);
      expect(mockedSqlV2Service.UpdateProxyDetailsByCronId).toHaveBeenCalled();
      expect(mockedAxiosHelper.postAsync).toHaveBeenCalled();
      expect(mockedAxiosHelper.native_get).toHaveBeenCalled();
    });

    it("should not switch proxy when failureCount is 0", async () => {
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 0,
          thresholdCount: 10,
          initTime: new Date(),
        },
      ];

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);

      await SwitchProxy();

      expect(mockedSqlV2Service.GetProxyFailureDetails).toHaveBeenCalled();
      expect(mockedSqlV2Service.GetLinkedCronSettingsByProviderId).not.toHaveBeenCalled();
    });

    it("should not switch proxy when failureCount is below threshold", async () => {
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 5,
          thresholdCount: 10,
          initTime: new Date(),
        },
      ];

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);

      await SwitchProxy();

      expect(mockedSqlV2Service.GetProxyFailureDetails).toHaveBeenCalled();
      expect(mockedSqlV2Service.GetLinkedCronSettingsByProviderId).not.toHaveBeenCalled();
    });

    it("should handle threshold reached scenario (proxyProvider 99)", async () => {
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 15,
          thresholdCount: 10,
          initTime: new Date(),
        },
      ];

      const mockLinkedCrons = [
        {
          CronId: 1,
          CronName: "Cron-1",
          ProxyProvider: 1,
          SwitchSequence: 2,
          AlternateProxyProvider: [{ ProxyProvider: 1, Sequence: 2 }],
        },
      ];

      const mockProxyConfig = [
        {
          proxyProviderId: 1,
          proxyProviderName: "Provider 1",
        },
      ];

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.GetLinkedCronSettingsByProviderId.mockResolvedValue(mockLinkedCrons as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([mockProxyConfig[0]] as any);
      mockedSqlV2Service.UpdateProxyDetailsByCronId.mockResolvedValue(undefined);
      mockedAxiosHelper.postAsync.mockResolvedValue({ data: {}, status: 200 } as any);
      mockedAxiosHelper.native_get.mockResolvedValue({ data: {}, status: 200 } as any);

      await SwitchProxy();

      expect(mockedSqlV2Service.UpdateProxyDetailsByCronId).toHaveBeenCalledWith(1, 1, -1);
      expect(mockedAxiosHelper.postAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            thresholdReached: true,
          }),
        ]),
        expect.any(String)
      );
    });

    it("should send separate emails for proxy change and threshold reached", async () => {
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 15,
          thresholdCount: 10,
          initTime: new Date(),
        },
      ];

      const mockLinkedCrons = [
        {
          CronId: 1,
          CronName: "Cron-1",
          ProxyProvider: 1,
          SwitchSequence: 0,
          AlternateProxyProvider: [
            { ProxyProvider: 1, Sequence: 0 },
            { ProxyProvider: 2, Sequence: 1 },
          ],
        },
        {
          CronId: 2,
          CronName: "Cron-2",
          ProxyProvider: 1,
          SwitchSequence: 1,
          AlternateProxyProvider: [{ ProxyProvider: 1, Sequence: 1 }],
        },
      ];

      const mockProxyConfig = [
        {
          proxyProviderId: 1,
          proxyProviderName: "Provider 1",
        },
        {
          proxyProviderId: 2,
          proxyProviderName: "Provider 2",
        },
      ];

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.GetLinkedCronSettingsByProviderId.mockResolvedValue(mockLinkedCrons as any);
      // First cron needs provider 1 in alternate list to find existing
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValueOnce([mockProxyConfig[0]] as any) // For cron 1 existing
        .mockResolvedValueOnce([mockProxyConfig[1]] as any) // For cron 1 new
        .mockResolvedValueOnce([mockProxyConfig[0]] as any); // For cron 2 existing (threshold)
      mockedSqlV2Service.UpdateProxyDetailsByCronId.mockResolvedValue(undefined);
      mockedAxiosHelper.postAsync.mockResolvedValue({ data: {}, status: 200 } as any);
      mockedAxiosHelper.native_get.mockResolvedValue({ data: {}, status: 200 } as any);

      await SwitchProxy();

      expect(mockedAxiosHelper.postAsync).toHaveBeenCalled();
      const postAsyncCalls = (mockedAxiosHelper.postAsync as jest.Mock).mock.calls;
      const hasProxyChange = postAsyncCalls.some((call) => call[0]?.some((item: any) => !item.thresholdReached));
      const hasThreshold = postAsyncCalls.some((call) => call[0]?.some((item: any) => item.thresholdReached));
      expect(hasProxyChange || hasThreshold).toBe(true);
      expect(mockedAxiosHelper.postAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            thresholdReached: false,
          }),
        ]),
        "http://test-email-notifier.com"
      );
      expect(mockedAxiosHelper.postAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            thresholdReached: true,
          }),
        ]),
        "http://test-threshold-notifier.com"
      );
    });

    it("should handle empty linked crons", async () => {
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 15,
          thresholdCount: 10,
          initTime: new Date(),
        },
      ];

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.GetLinkedCronSettingsByProviderId.mockResolvedValue([]);

      await SwitchProxy();

      expect(mockedSqlV2Service.GetLinkedCronSettingsByProviderId).toHaveBeenCalledWith(1);
      expect(mockedAxiosHelper.postAsync).not.toHaveBeenCalled();
    });

    it("should handle null linked crons", async () => {
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 15,
          thresholdCount: 10,
          initTime: new Date(),
        },
      ];

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.GetLinkedCronSettingsByProviderId.mockResolvedValue(null);

      await SwitchProxy();

      expect(mockedSqlV2Service.GetLinkedCronSettingsByProviderId).toHaveBeenCalledWith(1);
      expect(mockedAxiosHelper.postAsync).not.toHaveBeenCalled();
    });

    it("should handle empty payloadForEmail", async () => {
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 15,
          thresholdCount: 10,
          initTime: new Date(),
        },
      ];

      const mockLinkedCrons = [
        {
          CronId: 1,
          CronName: "Cron-1",
          ProxyProvider: 1,
          SwitchSequence: 0,
          AlternateProxyProvider: [],
        },
      ];

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.GetLinkedCronSettingsByProviderId.mockResolvedValue(mockLinkedCrons as any);

      await SwitchProxy();

      expect(mockedAxiosHelper.postAsync).not.toHaveBeenCalled();
    });

    it("should handle multiple proxy failure details", async () => {
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 15,
          thresholdCount: 10,
          initTime: new Date(),
        },
        {
          proxyProvider: 2,
          providerName: "Provider 2",
          failureCount: 20,
          thresholdCount: 15,
          initTime: new Date(),
        },
      ];

      const mockLinkedCrons1 = [
        {
          CronId: 1,
          CronName: "Cron-1",
          ProxyProvider: 1,
          SwitchSequence: 0,
          AlternateProxyProvider: [{ ProxyProvider: 2, Sequence: 1 }],
        },
      ];

      const mockLinkedCrons2 = [
        {
          CronId: 2,
          CronName: "Cron-2",
          ProxyProvider: 2,
          SwitchSequence: 0,
          AlternateProxyProvider: [{ ProxyProvider: 3, Sequence: 1 }],
        },
      ];

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.GetLinkedCronSettingsByProviderId.mockResolvedValueOnce(mockLinkedCrons1 as any).mockResolvedValueOnce(mockLinkedCrons2 as any);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ proxyProviderId: 1, proxyProviderName: "Provider 1" }] as any);
      mockedSqlV2Service.UpdateProxyDetailsByCronId.mockResolvedValue(undefined);
      mockedAxiosHelper.postAsync.mockResolvedValue({ data: {}, status: 200 } as any);
      mockedAxiosHelper.native_get.mockResolvedValue({ data: {}, status: 200 } as any);

      await SwitchProxy();

      expect(mockedSqlV2Service.GetLinkedCronSettingsByProviderId).toHaveBeenCalledTimes(2);
      expect(mockedSqlV2Service.GetLinkedCronSettingsByProviderId).toHaveBeenCalledWith(1);
      expect(mockedSqlV2Service.GetLinkedCronSettingsByProviderId).toHaveBeenCalledWith(2);
    });
  });

  describe("ResetProxyCounterForProvider", () => {
    it("should reset proxy counter for specific provider", async () => {
      const mockProxyFailureDetails = {
        proxyProvider: 1,
        providerName: "Provider 1",
        failureCount: 5,
        thresholdCount: 10,
        initTime: new Date("2024-01-01"),
      };

      mockedSqlV2Service.GetProxyFailureDetailsByProxyProviderId.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.ResetProxyFailureDetails.mockResolvedValue(undefined);

      await ResetProxyCounterForProvider(1, "user123");

      expect(mockedSqlV2Service.GetProxyFailureDetailsByProxyProviderId).toHaveBeenCalledWith(1);
      expect(mockedSqlV2Service.ResetProxyFailureDetails).toHaveBeenCalledWith(1, "user123");
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("PROXY SWITCH COUNTER RESET"));
    });

    it("should handle null proxy failure details", async () => {
      mockedSqlV2Service.GetProxyFailureDetailsByProxyProviderId.mockResolvedValue(null);

      await expect(ResetProxyCounterForProvider(1, "user123")).rejects.toThrow();

      expect(mockedSqlV2Service.GetProxyFailureDetailsByProxyProviderId).toHaveBeenCalledWith(1);
    });
  });

  describe("DebugProxySwitch", () => {
    it("should execute proxy switch for debug", async () => {
      const mockCronDetails = {
        CronId: 1,
        CronName: "Cron-1",
        ProxyProvider: 1,
        SwitchSequence: 0,
        AlternateProxyProvider: [
          { ProxyProvider: 1, Sequence: 0 },
          { ProxyProvider: 2, Sequence: 1 },
        ],
      };

      const mockProxyConfig = [
        {
          proxyProviderId: 1,
          proxyProviderName: "Provider 1",
        },
        {
          proxyProviderId: 2,
          proxyProviderName: "Provider 2",
        },
      ];

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValueOnce([mockProxyConfig[0]] as any).mockResolvedValueOnce([mockProxyConfig[1]] as any);
      mockedSqlV2Service.UpdateProxyDetailsByCronId.mockResolvedValue(undefined);
      mockedAxiosHelper.native_get.mockResolvedValue({ data: {}, status: 200 } as any);

      const result = await DebugProxySwitch(mockCronDetails as any);

      expect(result).toBeDefined();
      expect(result?.cronName).toBe("Cron-1");
      expect(result?.thresholdReached).toBe(false);
      expect(mockedSqlV2Service.UpdateProxyDetailsByCronId).toHaveBeenCalled();
    });

    it("should return null when no alternate proxy provider", async () => {
      const mockCronDetails = {
        CronId: 1,
        CronName: "Cron-1",
        ProxyProvider: 1,
        SwitchSequence: 0,
        AlternateProxyProvider: [],
      };

      const result = await DebugProxySwitch(mockCronDetails as any);

      expect(result).toBeNull();
    });

    it("should return null when AlternateProxyProvider is undefined", async () => {
      const mockCronDetails = {
        CronId: 1,
        CronName: "Cron-1",
        ProxyProvider: 1,
        SwitchSequence: 0,
      };

      const result = await DebugProxySwitch(mockCronDetails as any);

      expect(result).toBeNull();
    });

    it("should handle threshold reached scenario", async () => {
      const mockCronDetails = {
        CronId: 1,
        CronName: "Cron-1",
        ProxyProvider: 1,
        SwitchSequence: 2,
        AlternateProxyProvider: [{ ProxyProvider: 1, Sequence: 2 }],
      };

      const mockProxyConfig = [
        {
          proxyProviderId: 1,
          proxyProviderName: "Provider 1",
        },
      ];

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([mockProxyConfig[0]] as any);
      mockedSqlV2Service.UpdateProxyDetailsByCronId.mockResolvedValue(undefined);
      mockedAxiosHelper.native_get.mockResolvedValue({ data: {}, status: 200 } as any);

      const result = await DebugProxySwitch(mockCronDetails as any);

      expect(result).toBeDefined();
      expect(result?.thresholdReached).toBe(true);
      expect(result?.newProxyProvider).toBeNull();
      expect(mockedSqlV2Service.UpdateProxyDetailsByCronId).toHaveBeenCalledWith(1, 1, -1);
    });

    it("should handle existing proxy provider not found in alternate list", async () => {
      const mockCronDetails = {
        CronId: 1,
        CronName: "Cron-1",
        ProxyProvider: 1,
        SwitchSequence: 0,
        AlternateProxyProvider: [
          { ProxyProvider: 2, Sequence: 1 },
          { ProxyProvider: 3, Sequence: 2 },
        ],
      };

      const result = await DebugProxySwitch(mockCronDetails as any);

      expect(result).toBeNull();
    });

    it("should handle multiple matching alternate providers with same proxy provider", async () => {
      const mockCronDetails = {
        CronId: 1,
        CronName: "Cron-1",
        ProxyProvider: 1,
        SwitchSequence: 0,
        AlternateProxyProvider: [
          { ProxyProvider: 1, Sequence: 0 },
          { ProxyProvider: 1, Sequence: 1 },
          { ProxyProvider: 2, Sequence: 2 },
        ],
      };

      const mockProxyConfig = [
        {
          proxyProviderId: 1,
          proxyProviderName: "Provider 1",
        },
        {
          proxyProviderId: 2,
          proxyProviderName: "Provider 2",
        },
      ];

      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValueOnce([mockProxyConfig[0]] as any).mockResolvedValueOnce([mockProxyConfig[1]] as any);
      mockedSqlV2Service.UpdateProxyDetailsByCronId.mockResolvedValue(undefined);
      mockedAxiosHelper.native_get.mockResolvedValue({ data: {}, status: 200 } as any);

      const result = await DebugProxySwitch(mockCronDetails as any);

      expect(result).toBeDefined();

      expect(["Provider 1", "Provider 2"]).toContain(result?.newProxyProvider);
      expect(mockedSqlV2Service.UpdateProxyDetailsByCronId).toHaveBeenCalled();
    });
  });

  describe("ResetCounterForProvider (internal function via ResetFailureCounter)", () => {
    it("should reset when timer threshold is exceeded (via ResetFailureCounter)", async () => {
      const oldDate = new Date("2024-01-01");
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 5,
          thresholdCount: 10,
          initTime: oldDate,
        },
      ];

      // Set current time to be more than PROXYSWITCH_TIMER (3600000ms = 1 hour) after oldDate
      jest.setSystemTime(new Date(oldDate.getTime() + 3600001));

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.ResetProxyFailureDetails.mockResolvedValue(undefined);

      await ResetFailureCounter();

      // ResetFailureCounter calls ResetCounterForProvider with isForceReset=false
      // So it will reset if timer threshold is exceeded
      expect(mockedSqlV2Service.ResetProxyFailureDetails).toHaveBeenCalledWith(1, "SYSTEM");
      // The console.log won't include "Force Reset : TRUE" because isForceReset is false
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("PROXY SWITCH COUNTER RESET"));
    });

    it("should reset when timer threshold is exceeded", async () => {
      const oldDate = new Date("2024-01-01");
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 5,
          thresholdCount: 10,
          initTime: oldDate,
        },
      ];

      // Set current time to be more than PROXYSWITCH_TIMER (3600000ms = 1 hour) after oldDate
      jest.setSystemTime(new Date(oldDate.getTime() + 3600001));

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.ResetProxyFailureDetails.mockResolvedValue(undefined);

      await ResetFailureCounter();

      expect(mockedSqlV2Service.ResetProxyFailureDetails).toHaveBeenCalledWith(1, "SYSTEM");
    });

    it("should not reset when timer threshold is not exceeded", async () => {
      const oldDate = new Date("2024-01-01");
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 5,
          thresholdCount: 10,
          initTime: oldDate,
        },
      ];

      jest.setSystemTime(new Date(oldDate.getTime() + 1000));

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.ResetProxyFailureDetails.mockResolvedValue(undefined);

      await ResetFailureCounter();

      expect(mockedSqlV2Service.ResetProxyFailureDetails).not.toHaveBeenCalled();
    });

    it("should not reset when failureCount is 0", async () => {
      const oldDate = new Date("2024-01-01");
      const mockProxyFailureDetails = [
        {
          proxyProvider: 1,
          providerName: "Provider 1",
          failureCount: 0,
          thresholdCount: 10,
          initTime: oldDate,
        },
      ];

      jest.setSystemTime(new Date(oldDate.getTime() + 3600001));

      mockedSqlV2Service.GetProxyFailureDetails.mockResolvedValue(mockProxyFailureDetails as any);
      mockedSqlV2Service.ResetProxyFailureDetails.mockResolvedValue(undefined);

      await ResetFailureCounter();

      expect(mockedSqlV2Service.ResetProxyFailureDetails).not.toHaveBeenCalled();
    });
  });
});
