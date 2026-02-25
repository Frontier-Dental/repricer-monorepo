// Mock dependencies before imports
jest.mock("axios");
jest.mock("fs");
jest.mock("https-proxy-agent");
jest.mock("lodash");
jest.mock("node-fetch");
jest.mock("../../resources/api-mapping", () => ({
  apiMapping: [
    {
      vendorId: "17357",
      apiUrl: "http://test.com/ProductDetails/{mpid}",
      vendor: "TRADENT",
    },
    {
      vendorId: "20722",
      apiUrl: "http://test2.com/ProductDetails/{mpid}",
      vendor: "FRONTIER",
    },
  ],
}));

jest.mock("../config", () => ({
  applicationConfig: {
    IS_DEBUG: false,
    FILE_PATH: "/test/path/file.json",
    CRON_RUN_FEED_URL: "http://test.com/feed",
    CRON_RUN_PRODUCT_URL: "http://test.com/product",
    MINI_ERP_DATA_HOURS_SINCE_UPDATE: 24,
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

jest.mock("../proxy/axios-retry-helper");
jest.mock("../proxy/bright-data-helper");
jest.mock("../proxy/scrapfly-helper");
jest.mock("../proxy-helper");
jest.mock("../response-utility");
jest.mock("../mysql/mysql-v2");

import axios from "axios";
import fs from "fs";
import httpsProxyAgent from "https-proxy-agent";
import _ from "lodash";
import nodeFetch from "node-fetch";
import { postAsync, getAsync, getAsyncProxy, GetSisterVendorItemDetails, runFeedCron, getProduct, runProductCron, asyncProductData, native_get, fetch_product_data, fetchGetAsync, fetchGetAsyncV2, getProductsFromMiniErp } from "../axios-helper";
import { applicationConfig } from "../config";
import * as axiosRetryHelper from "../proxy/axios-retry-helper";
import * as brightDataHelper from "../proxy/bright-data-helper";
import * as scrapflyHelper from "../proxy/scrapfly-helper";
import * as ProxyHelper from "../proxy-helper";
import * as responseUtility from "../response-utility";
import * as sqlV2Service from "../mysql/mysql-v2";
import { CronSettings } from "../../types/cron-settings";

const mockedAxios = axios as jest.MockedFunction<typeof axios> & {
  get: jest.MockedFunction<typeof axios.get>;
};
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedHttpsProxyAgent = httpsProxyAgent as jest.MockedFunction<typeof httpsProxyAgent>;
const mockedLodash = _ as jest.Mocked<typeof _>;
const mockedNodeFetch = nodeFetch as jest.MockedFunction<typeof nodeFetch>;
const mockedAxiosRetryHelper = axiosRetryHelper as jest.Mocked<typeof axiosRetryHelper>;
const mockedBrightDataHelper = brightDataHelper as jest.Mocked<typeof brightDataHelper>;
const mockedScrapflyHelper = scrapflyHelper as jest.Mocked<typeof scrapflyHelper>;
const mockedProxyHelper = ProxyHelper as jest.Mocked<typeof ProxyHelper>;
const mockedResponseUtility = responseUtility as jest.Mocked<typeof responseUtility>;
const mockedSqlV2Service = sqlV2Service as jest.Mocked<typeof sqlV2Service>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("axios-helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mocks for lodash
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
    mockedLodash.first = jest.fn((array: any) => (array && array.length > 0 ? array[0] : undefined));
    mockedLodash.remove = jest.fn((array: any, predicate: any) => {
      if (!Array.isArray(array)) return [];
      const removed: any[] = [];
      const arrayCopy = [...array];
      for (let i = arrayCopy.length - 1; i >= 0; i--) {
        if (predicate(arrayCopy[i])) {
          removed.unshift(arrayCopy[i]);
        }
      }
      return removed;
    });

    // Default axios mock
    (mockedAxios as any).mockResolvedValue({ data: {}, status: 200 } as any);
    mockedAxios.get = jest.fn().mockResolvedValue({ data: {}, status: 200 } as any) as any;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("postAsync", () => {
    it("should make POST request with correct config", async () => {
      const payload = { test: "data" };
      const url = "http://test.com/api";
      const mockResponse = { data: { success: true }, status: 200 };

      (mockedAxios as any).mockResolvedValue(mockResponse as any);

      const result = await postAsync(payload, url);

      expect(mockedAxios).toHaveBeenCalledWith({
        method: "POST",
        url: url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
          "Content-Type": "application/json",
        },
        data: JSON.stringify(payload),
      });
      expect(result).toEqual(mockResponse);
    });

    it("should handle complex payload objects", async () => {
      const payload = { nested: { data: [1, 2, 3] }, timestamp: Date.now() };
      const url = "http://test.com/api";

      await postAsync(payload, url);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: JSON.stringify(payload),
        })
      );
    });
  });

  describe("getAsync", () => {
    it("should return morphed response when IS_DEBUG is true", async () => {
      const originalIsDebug = applicationConfig.IS_DEBUG;
      (applicationConfig as any).IS_DEBUG = true;
      const mockFileData = { test: "data" };
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockFileData));

      const result = await getAsync("http://test.com", 1, "100");

      expect(result.data).toEqual(mockFileData);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(applicationConfig.FILE_PATH, "utf8");
      (applicationConfig as any).IS_DEBUG = originalIsDebug;
    });

    it("should handle proxy provider 0 (ScrapingBee without render)", async () => {
      (applicationConfig as any).IS_DEBUG = false;
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([{ CronId: 1, CronName: "TestCron" }]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue([]);
      mockedProxyHelper.GetProxyDetailsById.mockResolvedValue([{ ProxyProvider: 0 }]);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ config: "test" }]);
      mockedAxiosRetryHelper.getScrapingBeeResponse.mockResolvedValue({ data: {} } as any);
      mockedSqlV2Service.UpdateQBreakDetails.mockResolvedValue(undefined);

      const result = await getAsync("http://test.com", 1, "100");

      expect(mockedAxiosRetryHelper.getScrapingBeeResponse).toHaveBeenCalled();
      const callArgs = mockedAxiosRetryHelper.getScrapingBeeResponse.mock.calls[0];
      expect(callArgs[0]).toBe("http://test.com");
      expect(callArgs[1]).toEqual({ config: "test" });
      expect(callArgs[2]).toBeUndefined(); // seqString is undefined when not provided
      expect(callArgs[3]).toBe(false);
      expect(result).toBeDefined();
    });

    it("should handle proxy provider 2 (BrightData)", async () => {
      (applicationConfig as any).IS_DEBUG = false;
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([{ CronId: 1, CronName: "TestCron" }]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue([]);
      mockedProxyHelper.GetProxyDetailsById.mockResolvedValue([{ ProxyProvider: 2 }]);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ config: "test" }]);
      mockedBrightDataHelper.fetchData.mockResolvedValue({ data: {} } as any);
      mockedSqlV2Service.UpdateQBreakDetails.mockResolvedValue(undefined);

      await getAsync("http://test.com", 1, "100");

      expect(mockedBrightDataHelper.fetchData).toHaveBeenCalled();
    });

    it("should handle proxy provider 3 (SmartProxy)", async () => {
      (applicationConfig as any).IS_DEBUG = false;
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([{ CronId: 1, CronName: "TestCron" }]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue([]);
      mockedProxyHelper.GetProxyDetailsById.mockResolvedValue([{ ProxyProvider: 3 }]);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ config: "test" }]);
      mockedAxiosRetryHelper.getScrappingResponse.mockResolvedValue({ data: {} } as any);
      mockedSqlV2Service.UpdateQBreakDetails.mockResolvedValue(undefined);

      await getAsync("http://test.com", 1, "100", "seq123");

      expect(mockedAxiosRetryHelper.getScrappingResponse).toHaveBeenCalled();
    });

    it("should handle proxy provider 5 (ScrapingBee with render)", async () => {
      (applicationConfig as any).IS_DEBUG = false;
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([{ CronId: 1, CronName: "TestCron" }]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue([]);
      mockedProxyHelper.GetProxyDetailsById.mockResolvedValue([{ ProxyProvider: 5 }]);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ config: "test" }]);
      mockedAxiosRetryHelper.getScrapingBeeResponse.mockResolvedValue({ data: {} } as any);
      mockedSqlV2Service.UpdateQBreakDetails.mockResolvedValue(undefined);

      await getAsync("http://test.com", 1, "100");

      expect(mockedAxiosRetryHelper.getScrapingBeeResponse).toHaveBeenCalledWith("http://test.com", expect.any(Object), undefined, true);
    });

    it("should handle proxy provider 8 (Scrapfly with render)", async () => {
      (applicationConfig as any).IS_DEBUG = false;
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([{ CronId: 1, CronName: "TestCron" }]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue([]);
      mockedProxyHelper.GetProxyDetailsById.mockResolvedValue([{ ProxyProvider: 8 }]);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ config: "test" }]);
      mockedScrapflyHelper.scrapflyFetchData.mockResolvedValue({ data: {} } as any);
      mockedSqlV2Service.UpdateQBreakDetails.mockResolvedValue(undefined);

      await getAsync("http://test.com", 1, "100");

      expect(mockedScrapflyHelper.scrapflyFetchData).toHaveBeenCalledWith("http://test.com", expect.any(Object), null, true);
    });

    it("should handle proxy provider 9 (Scrapfly without render)", async () => {
      (applicationConfig as any).IS_DEBUG = false;
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([{ CronId: 1, CronName: "TestCron" }]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue([]);
      mockedProxyHelper.GetProxyDetailsById.mockResolvedValue([{ ProxyProvider: 9 }]);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ config: "test" }]);
      mockedScrapflyHelper.scrapflyFetchData.mockResolvedValue({ data: {} } as any);
      mockedSqlV2Service.UpdateQBreakDetails.mockResolvedValue(undefined);

      await getAsync("http://test.com", 1, "100");

      expect(mockedScrapflyHelper.scrapflyFetchData).toHaveBeenCalledWith("http://test.com", expect.any(Object), null, false);
    });

    it("should handle default proxy provider with rotating proxy", async () => {
      (applicationConfig as any).IS_DEBUG = false;
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([{ CronId: 1, CronName: "TestCron" }]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue([]);
      mockedProxyHelper.GetProxyDetailsById.mockResolvedValue([{ ProxyProvider: 1 }]);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ proxyProviderName: "TestProvider" }]);
      mockedProxyHelper.GetProxy.mockResolvedValue({
        host: "rotating-proxy.com",
        auth: { username: "user", password: "pass" },
        port: 8080,
      } as any);
      mockedSqlV2Service.GetRotatingProxyUrl.mockResolvedValue("rotating-proxy.com");
      mockedNodeFetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ data: "test" }),
      } as any);
      mockedSqlV2Service.UpdateQBreakDetails.mockResolvedValue(undefined);

      await getAsync("http://test.com", 1, "100");

      expect(mockedProxyHelper.GetProxy).toHaveBeenCalledWith("TestCron");
      expect(mockedNodeFetch).toHaveBeenCalled();
    });

    it("should handle default proxy provider without rotating proxy", async () => {
      (applicationConfig as any).IS_DEBUG = false;
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([{ CronId: 1, CronName: "TestCron" }]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue([]);
      mockedProxyHelper.GetProxyDetailsById.mockResolvedValue([{ ProxyProvider: 1 }]);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ proxyProviderName: "TestProvider" }]);
      mockedProxyHelper.GetProxy.mockResolvedValue({
        host: "regular-proxy.com",
        auth: { username: "user", password: "pass" },
        port: 8080,
      } as any);
      mockedSqlV2Service.GetRotatingProxyUrl.mockResolvedValue("rotating-proxy.com");
      (mockedAxios.get as jest.Mock).mockResolvedValue({ data: {} } as any);
      mockedSqlV2Service.UpdateQBreakDetails.mockResolvedValue(undefined);

      await getAsync("http://test.com", 1, "100", "seq123");

      expect(mockedAxios.get).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("SCRAPE : TestProvider"));
    });

    it("should handle slow cron details", async () => {
      (applicationConfig as any).IS_DEBUG = false;
      mockedSqlV2Service.GetCronSettingsList.mockResolvedValue([{ CronId: 1, CronName: "RegularCron" }]);
      mockedSqlV2Service.GetSlowCronDetails.mockResolvedValue([{ CronId: 2, CronName: "SlowCron" }]);
      mockedProxyHelper.GetProxyDetailsById.mockResolvedValue([{ ProxyProvider: 0 }]);
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ config: "test" }]);
      mockedAxiosRetryHelper.getScrapingBeeResponse.mockResolvedValue({ data: {} } as any);
      mockedSqlV2Service.UpdateQBreakDetails.mockResolvedValue(undefined);

      await getAsync("http://test.com", 2, "100");

      expect(mockedLodash.concat).toHaveBeenCalled();
    });
  });

  describe("getAsyncProxy", () => {
    const mockCronSetting: Partial<CronSettings> = {
      CronId: "1",
      CronName: "TestCron",
      ProxyProvider: 0,
    };

    it("should handle proxy provider 0", async () => {
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ config: "test" }]);
      mockedAxiosRetryHelper.getScrapingBeeResponse.mockResolvedValue({ data: {} } as any);

      await getAsyncProxy("http://test.com", { ...mockCronSetting, ProxyProvider: 0 } as CronSettings, "100");

      expect(mockedAxiosRetryHelper.getScrapingBeeResponse).toHaveBeenCalledWith("http://test.com", expect.any(Object), null, false);
    });

    it("should handle proxy provider 11 (mapped to 1)", async () => {
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ proxyProviderName: "TestProvider" }]);
      mockedProxyHelper.GetProxyV2.mockResolvedValue({
        host: "regular-proxy.com",
        auth: { username: "user", password: "pass" },
        port: 8080,
      } as any);
      mockedSqlV2Service.GetRotatingProxyUrl.mockResolvedValue("other-proxy.com");
      (mockedAxios.get as jest.Mock).mockResolvedValue({ data: {} } as any);

      await getAsyncProxy("http://test.com", { ...mockCronSetting, ProxyProvider: 11 } as CronSettings, "100");

      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(1);
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it("should handle proxy provider 12 (mapped to 1)", async () => {
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ proxyProviderName: "TestProvider" }]);
      mockedProxyHelper.GetProxyV2.mockResolvedValue({
        host: "regular-proxy.com",
        auth: { username: "user", password: "pass" },
        port: 8080,
      } as any);
      mockedSqlV2Service.GetRotatingProxyUrl.mockResolvedValue("other-proxy.com");
      (mockedAxios.get as jest.Mock).mockResolvedValue({ data: {} } as any);

      await getAsyncProxy("http://test.com", { ...mockCronSetting, ProxyProvider: 12 } as CronSettings, "100");

      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(1);
    });

    it("should handle null proxyProvider", async () => {
      const result = await getAsyncProxy("http://test.com", { ...mockCronSetting, ProxyProvider: undefined } as CronSettings, "100");

      expect(result).toBeNull();
      expect(mockedSqlV2Service.GetProxyConfigByProviderId).not.toHaveBeenCalled();
    });

    it("should handle rotating proxy in default case", async () => {
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([{ proxyProviderName: "TestProvider" }]);
      mockedProxyHelper.GetProxyV2.mockResolvedValue({
        host: "rotating-proxy.com",
        auth: { username: "user", password: "pass" },
        port: 8080,
        dummyMethod: "FETCH",
      } as any);
      mockedSqlV2Service.GetRotatingProxyUrl.mockResolvedValue("rotating-proxy.com");
      mockedNodeFetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ data: "test" }),
      } as any);

      await getAsyncProxy("http://test.com", { ...mockCronSetting, ProxyProvider: 1 } as CronSettings, "100");

      expect(mockedNodeFetch).toHaveBeenCalled();
    });
  });

  describe("GetSisterVendorItemDetails", () => {
    it("should fetch sister vendor details and format response", async () => {
      const mpid = "100";
      const globalParamInfo = { VENDOR_ID: "17357" };
      const mockApiResponse = {
        data: {
          message: [
            {
              latest_price: 99.99,
              lastExistingPrice: 89.99,
            },
          ],
        },
      };

      (mockedAxios as any).mockResolvedValue(mockApiResponse as any);
      mockedResponseUtility.GetLastExistingPrice.mockResolvedValue(99.99);

      const result = await GetSisterVendorItemDetails(mpid, globalParamInfo);

      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe("20722");
      expect(result[0].mpid).toBe(mpid);
      expect(result[0].unitPrice).toBe(99.99);
      expect(mockedResponseUtility.GetLastExistingPrice).toHaveBeenCalled();
    });

    it("should handle empty message array", async () => {
      const mpid = "100";
      const globalParamInfo = { VENDOR_ID: "17357" };
      const mockApiResponse = {
        data: {
          message: [],
        },
      };

      (mockedAxios as any).mockResolvedValue(mockApiResponse as any);

      const result = await GetSisterVendorItemDetails(mpid, globalParamInfo);

      expect(result).toHaveLength(0);
    });

    it("should handle missing message property", async () => {
      const mpid = "100";
      const globalParamInfo = { VENDOR_ID: "17357" };
      const mockApiResponse = {
        data: {},
      };

      (mockedAxios as any).mockResolvedValue(mockApiResponse as any);

      const result = await GetSisterVendorItemDetails(mpid, globalParamInfo);

      expect(result).toHaveLength(0);
    });

    it("should handle multiple APIs", async () => {
      const mpid = "100";
      const globalParamInfo = { VENDOR_ID: "17357" };
      const mockApiResponse = {
        data: {
          message: [
            {
              latest_price: 99.99,
            },
          ],
        },
      };

      // Mock axios to return different responses for each API call
      (mockedAxios as any).mockResolvedValue(mockApiResponse as any);
      mockedResponseUtility.GetLastExistingPrice.mockResolvedValue(99.99);

      const result = await GetSisterVendorItemDetails(mpid, globalParamInfo);

      // Should have at least one result (one API that doesn't match VENDOR_ID)
      expect(result.length).toBeGreaterThan(0);
      // Verify that axios was called (for the non-matching vendor API)
      expect(mockedAxios).toHaveBeenCalled();
    });
  });

  describe("runFeedCron", () => {
    it("should make GET request to feed cron URL", async () => {
      const mockResponse = { data: {}, status: 200 };
      (mockedAxios as any).mockResolvedValue(mockResponse as any);

      await runFeedCron();

      expect(mockedAxios).toHaveBeenCalledWith({
        method: "get",
        url: applicationConfig.CRON_RUN_FEED_URL,
      });
    });
  });

  describe("getProduct", () => {
    it("should make GET request with correct headers", async () => {
      const url = "http://test.com/product";
      const mockResponse = { data: { product: "test" }, status: 200 };
      (mockedAxios as any).mockResolvedValue(mockResponse as any);

      const result = await getProduct(url);

      expect(mockedAxios).toHaveBeenCalledWith({
        method: "get",
        url: url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
          "Content-Type": "application/json",
        },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe("runProductCron", () => {
    it("should make GET request to product cron URL", async () => {
      const mockResponse = { data: {}, status: 200 };
      (mockedAxios as any).mockResolvedValue(mockResponse as any);

      await runProductCron();

      expect(mockedAxios).toHaveBeenCalledWith({
        method: "get",
        url: applicationConfig.CRON_RUN_PRODUCT_URL,
      });
    });
  });

  describe("asyncProductData", () => {
    it("should make GET request to provided URL", async () => {
      const url = "http://test.com/data";
      const mockResponse = { data: { items: [] }, status: 200 };
      (mockedAxios as any).mockResolvedValue(mockResponse as any);

      const result = await asyncProductData(url);

      expect(mockedAxios).toHaveBeenCalledWith({
        method: "get",
        url: url,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe("native_get", () => {
    it("should make GET request to provided URL", async () => {
      const url = "http://test.com/api";
      const mockResponse = { data: { result: "test" }, status: 200 };
      (mockedAxios as any).mockResolvedValue(mockResponse as any);

      const result = await native_get(url);

      expect(mockedAxios).toHaveBeenCalledWith({
        method: "get",
        url: url,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe("fetch_product_data", () => {
    it("should fetch product data using SmartProxy", async () => {
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([
        {
          hostUrl: "http://smartproxy.com",
          userName: "test-user",
        },
      ]);
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              content: JSON.stringify({ product: "test" }),
            },
          ],
        },
      };
      (mockedAxios as any).mockResolvedValue(mockResponse as any);

      const result = await fetch_product_data("http://test.com/product");

      expect(mockedSqlV2Service.GetProxyConfigByProviderId).toHaveBeenCalledWith(3);
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "http://smartproxy.com",
        })
      );
      expect(result).toBeDefined();
    });

    it("should handle response without results", async () => {
      mockedSqlV2Service.GetProxyConfigByProviderId.mockResolvedValue([
        {
          hostUrl: "http://smartproxy.com",
          userName: "test-user",
        },
      ]);
      const mockResponse = {
        status: 200,
        data: {},
      };
      (mockedAxios as any).mockResolvedValue(mockResponse as any);

      const result = await fetch_product_data("http://test.com/product");

      expect(result).toBeUndefined();
    });
  });

  describe("fetchGetAsync", () => {
    it("should use AXIOS dummyMethod", async () => {
      const proxy = {
        host: "proxy.com",
        port: 8080,
        auth: { username: "user", password: "pass" },
        dummyMethod: "AXIOS",
      };
      const mockProxyAgent = {};
      mockedHttpsProxyAgent.mockReturnValue(mockProxyAgent as any);
      (mockedAxios.get as jest.Mock).mockResolvedValue({ data: {} } as any);

      const result = await fetchGetAsync(proxy, "http://test.com");

      expect(mockedHttpsProxyAgent).toHaveBeenCalledWith("http://user:pass@proxy.com:8080");
      expect(mockedAxios.get).toHaveBeenCalledWith("http://test.com", { proxyAgent: mockProxyAgent });
      expect(result).toBeDefined();
    });

    it("should use FETCH dummyMethod", async () => {
      const proxy = {
        host: "proxy.com",
        port: 8080,
        auth: { username: "user", password: "pass" },
        dummyMethod: "FETCH",
      };
      const mockProxyAgent = {};
      mockedHttpsProxyAgent.mockReturnValue(mockProxyAgent as any);
      mockedNodeFetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ data: "test" }),
      } as any);

      const result = await fetchGetAsync(proxy, "http://test.com");

      expect(mockedNodeFetch).toHaveBeenCalledWith("http://test.com", { agent: mockProxyAgent });
      expect(result.data).toEqual({ data: "test" });
    });
  });

  describe("fetchGetAsyncV2", () => {
    it("should use AXIOS dummyMethod", async () => {
      const proxy = {
        host: "proxy.com",
        port: 8080,
        auth: { username: "user", password: "pass" },
        dummyMethod: "AXIOS",
      };
      const mockProxyAgent = {};
      mockedHttpsProxyAgent.mockReturnValue(mockProxyAgent as any);
      (mockedAxios.get as jest.Mock).mockResolvedValue({ data: {} } as any);

      const result = await fetchGetAsyncV2(proxy, "http://test.com");

      expect(mockedAxios.get).toHaveBeenCalledWith("http://test.com", { proxyAgent: mockProxyAgent });
      expect(result).toBeDefined();
    });

    it("should use FETCH dummyMethod", async () => {
      const proxy = {
        host: "proxy.com",
        port: 8080,
        auth: { username: "user", password: "pass" },
        dummyMethod: "FETCH",
      };
      const mockProxyAgent = {};
      mockedHttpsProxyAgent.mockReturnValue(mockProxyAgent as any);
      mockedNodeFetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ data: "test" }),
      } as any);

      const result = await fetchGetAsyncV2(proxy, "http://test.com");

      expect(mockedNodeFetch).toHaveBeenCalled();
      expect(result.data).toEqual({ data: "test" });
    });
  });

  describe("getProductsFromMiniErp", () => {
    it("should make GraphQL POST request with correct config", async () => {
      const url = "http://test.com/graphql";
      const accessToken = "test-token";
      const queryData = { page: 1, pageSize: 10 };
      const mockResponse = { data: { items: [] }, status: 200 };
      (mockedAxios as any).mockResolvedValue(mockResponse as any);

      const result = await getProductsFromMiniErp(url, accessToken, queryData);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: url,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          data: expect.objectContaining({
            query: expect.stringContaining("getUpdatedProductsWithOffsetPagination"),
            variables: {
              hoursSinceUpdate: applicationConfig.MINI_ERP_DATA_HOURS_SINCE_UPDATE,
              page: 1,
              pageSize: 10,
            },
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle different page and pageSize values", async () => {
      const url = "http://test.com/graphql";
      const accessToken = "test-token";
      const queryData = { page: 5, pageSize: 50 };
      mockedAxios.mockResolvedValue({ data: {} } as any);

      await getProductsFromMiniErp(url, accessToken, queryData);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            variables: {
              hoursSinceUpdate: applicationConfig.MINI_ERP_DATA_HOURS_SINCE_UPDATE,
              page: 5,
              pageSize: 50,
            },
          }),
        })
      );
    });
  });
});
