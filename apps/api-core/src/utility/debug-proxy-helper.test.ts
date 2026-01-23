// Mock dependencies before imports
jest.mock("axios");
jest.mock("lodash");
jest.mock("request-promise");
jest.mock("./proxy/bright-data-helper");
jest.mock("./proxy-helper");
jest.mock("./axios-helper");
jest.mock("xml2js");
jest.mock("./format-wrapper");
jest.mock("@repricer-monorepo/shared", () => ({
  CacheKey: {},
  VendorName: {},
  VendorNameLookup: {},
}));

jest.mock("./config", () => ({
  applicationConfig: {
    SCRAPINGBEE_WAIT_VALUE: 1000,
    SCRAPINGBEE_TIMEOUT_VALUE: 30000,
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

import axios from "axios";
import _ from "lodash";
import requestPromise from "request-promise";
import { GetData } from "./debug-proxy-helper";
import * as brightDataHelper from "./proxy/bright-data-helper";
import * as proxyHelper from "./proxy-helper";
import * as axiosHelper from "./axios-helper";
import xml2js from "xml2js";
import * as formatWrapper from "./format-wrapper";
import { applicationConfig } from "./config";

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLodash = _ as jest.Mocked<typeof _>;
const mockedRequestPromise = requestPromise as jest.MockedFunction<typeof requestPromise>;
const mockedBrightDataHelper = brightDataHelper as jest.Mocked<typeof brightDataHelper>;
const mockedProxyHelper = proxyHelper as jest.Mocked<typeof proxyHelper>;
const mockedAxiosHelper = axiosHelper as jest.Mocked<typeof axiosHelper>;
const mockedXml2js = xml2js as jest.Mocked<typeof xml2js>;
const mockedFormatWrapper = formatWrapper as jest.Mocked<typeof formatWrapper>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("debug-proxy-helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mocks for lodash
    mockedLodash.first = jest.fn((array: any) => (array && array.length > 0 ? array[0] : undefined));
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("GetData", () => {
    describe("proxyParam 0 (ScrapingBee without render)", () => {
      it("should handle JSON response", async () => {
        const mockResponse = JSON.stringify({ test: "data" });
        mockedRequestPromise.mockResolvedValue(mockResponse);

        const result = await GetData("http://test.com", { userName: "test-key" }, 0);

        expect(mockedRequestPromise).toHaveBeenCalledWith({
          uri: "https://app.scrapingbee.com/api/v1/",
          qs: {
            api_key: "test-key",
            url: "http://test.com",
            wait: applicationConfig.SCRAPINGBEE_WAIT_VALUE,
            render_js: "false",
          },
          timeout: applicationConfig.SCRAPINGBEE_TIMEOUT_VALUE,
        });
        expect(result.data).toEqual({ test: "data" });
        expect(result.request).toBeDefined();
      });

      it("should handle XML response with List xmlns", async () => {
        const mockXmlResponse = '<List xmlns=""><item><test>data</test></item></List>';
        mockedRequestPromise.mockResolvedValue(mockXmlResponse);
        mockedXml2js.parseStringPromise.mockResolvedValue({
          List: {
            item: [{ test: "data" }],
          },
        });
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue([{ test: "data" }]);

        const result = await GetData("http://test.com", { userName: "test-key" }, 0);

        expect(result.data).toEqual([{ test: "data" }]);
        expect(result.request).toBeDefined();
      });

      it("should handle XML response with List tag", async () => {
        const mockXmlResponse = "<List><item><test>data</test></item></List>";
        mockedRequestPromise.mockResolvedValue(mockXmlResponse);
        mockedXml2js.parseStringPromise.mockResolvedValue({
          List: {
            item: [{ test: "data" }],
          },
        });
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue([{ test: "data" }]);

        const result = await GetData("http://test.com", { userName: "test-key" }, 0);

        expect(result.data).toEqual([{ test: "data" }]);
      });
    });

    describe("proxyParam 2 (BrightData)", () => {
      it("should fetch data using BrightData helper", async () => {
        const mockResponse = { data: { product: "test" } };
        mockedBrightDataHelper.fetchDataForDebug.mockResolvedValue(mockResponse);

        const result = await GetData("http://test.com", { userName: "test-user" }, 2);

        expect(mockedBrightDataHelper.fetchDataForDebug).toHaveBeenCalledWith("http://test.com", { userName: "test-user" });
        expect(result.data).toEqual({ product: "test" });
        expect(result.request).toEqual({
          requestData: "Custom Puppeteer Framework Based Input Request",
          url: "http://test.com",
        });
      });
    });

    describe("proxyParam 3 (SmartProxy)", () => {
      it("should handle JSON response from SmartProxy", async () => {
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
        (mockedAxios as any).mockResolvedValue(mockResponse);

        const result = await GetData("http://test.com", { hostUrl: "http://smartproxy.com", userName: "test-user" }, 3);

        expect(mockedAxios).toHaveBeenCalledWith({
          method: "post",
          url: "http://smartproxy.com",
          data: {
            target: "universal",
            url: "http://test.com",
            locale: "en",
            geo: "United States",
            device_type: "desktop",
          },
          headers: {
            "Content-Type": "application/json",
            Authorization: "Basic test-user",
          },
        });
        expect(result.data).toEqual({ product: "test" });
        expect(result.request).toBeDefined();
      });

      it("should handle XML response from SmartProxy", async () => {
        const mockResponse = {
          status: 200,
          data: {
            results: [
              {
                content: "<List><item><test>data</test></item></List>",
              },
            ],
          },
        };
        (mockedAxios as any).mockResolvedValue(mockResponse);
        mockedXml2js.parseStringPromise.mockResolvedValue({
          List: {
            item: [{ test: "data" }],
          },
        });
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue([{ test: "data" }]);

        const result = await GetData("http://test.com", { hostUrl: "http://smartproxy.com", userName: "test-user" }, 3);

        expect(result.data).toEqual([{ test: "data" }]);
      });

      it("should handle response without results", async () => {
        const mockResponse = {
          status: 200,
          data: {},
        };
        (mockedAxios as any).mockResolvedValue(mockResponse);

        const result = await GetData("http://test.com", { hostUrl: "http://smartproxy.com", userName: "test-user" }, 3);

        expect(result.data).toEqual(mockResponse);
        expect(result.request).toBeDefined();
      });

      it("should handle non-200 status", async () => {
        const mockResponse = {
          status: 500,
          data: { error: "Internal Server Error" },
        };
        (mockedAxios as any).mockResolvedValue(mockResponse);

        const result = await GetData("http://test.com", { hostUrl: "http://smartproxy.com", userName: "test-user" }, 3);

        expect(result.data).toEqual(mockResponse);
      });
    });

    describe("proxyParam 5 (ScrapingBee with render)", () => {
      it("should handle JSON response", async () => {
        const mockResponse = JSON.stringify({ test: "data" });
        mockedRequestPromise.mockResolvedValue(mockResponse);

        const result = await GetData("http://test.com", { userName: "test-key" }, 5);

        expect(mockedRequestPromise).toHaveBeenCalledWith({
          uri: "https://app.scrapingbee.com/api/v1/",
          qs: {
            api_key: "test-key",
            url: "http://test.com",
            wait: applicationConfig.SCRAPINGBEE_WAIT_VALUE,
          },
          timeout: applicationConfig.SCRAPINGBEE_TIMEOUT_VALUE,
        });
        expect(result.data).toEqual({ test: "data" });
        expect(result.request).toBeDefined();
      });

      it("should handle XML response", async () => {
        const mockXmlResponse = '<List xmlns=""><item><test>data</test></item></List>';
        mockedRequestPromise.mockResolvedValue(mockXmlResponse);
        mockedXml2js.parseStringPromise.mockResolvedValue({
          List: {
            item: [{ test: "data" }],
          },
        });
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue([{ test: "data" }]);

        const result = await GetData("http://test.com", { userName: "test-key" }, 5);

        expect(result.data).toEqual([{ test: "data" }]);
      });

      it("should handle XML response without xmlns (fallback to List tag)", async () => {
        const mockXmlResponse = "<List><item><test>data</test></item></List>";
        mockedRequestPromise.mockResolvedValue(mockXmlResponse);
        mockedXml2js.parseStringPromise.mockResolvedValue({
          List: {
            item: [{ test: "data" }],
          },
        });
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue([{ test: "data" }]);

        const result = await GetData("http://test.com", { userName: "test-key" }, 5);

        expect(result.data).toEqual([{ test: "data" }]);
      });
    });

    describe("proxyParam 6 and 7 (Ant proxy)", () => {
      it("should handle proxyParam 6 with password", async () => {
        const mockResponse = { data: JSON.stringify({ test: "data" }) };
        (mockedAxios as any).mockResolvedValue(mockResponse);

        const result = await GetData("http://test.com", { hostUrl: "http://ant.com", userName: "test-key", password: "param=value" }, 6);

        expect(mockedAxios).toHaveBeenCalledWith("http://ant.com?url=http://test.com&x-api-key=test-key&param=value");
        expect(result.data).toEqual({ test: "data" });
        expect(result.request).toBe("http://ant.com?url=http://test.com&x-api-key=test-key&param=value");
      });

      it("should handle proxyParam 7 without password", async () => {
        const mockResponse = { data: JSON.stringify({ test: "data" }) };
        (mockedAxios as any).mockResolvedValue(mockResponse);

        const result = await GetData("http://test.com", { hostUrl: "http://ant.com", userName: "test-key", password: "param=value" }, 7);

        expect(mockedAxios).toHaveBeenCalledWith("http://ant.com?url=http://test.com&x-api-key=test-key");
        expect(result.data).toEqual({ test: "data" });
      });

      it("should handle XML response for proxyParam 6", async () => {
        const mockXmlResponse = '<List xmlns=""><item><test>data</test></item></List>';
        const mockResponse = { data: mockXmlResponse };
        (mockedAxios as any).mockResolvedValue(mockResponse);
        mockedXml2js.parseStringPromise.mockResolvedValue({
          List: {
            item: [{ test: "data" }],
          },
        });
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue([{ test: "data" }]);

        const result = await GetData("http://test.com", { hostUrl: "http://ant.com", userName: "test-key", password: "param=value" }, 6);

        expect(result.data).toEqual([{ test: "data" }]);
      });

      it("should handle XML response without xmlns for proxyParam 6", async () => {
        const mockXmlResponse = "<List><item><test>data</test></item></List>";
        const mockResponse = { data: mockXmlResponse };
        (mockedAxios as any).mockResolvedValue(mockResponse);
        mockedXml2js.parseStringPromise.mockResolvedValue({
          List: {
            item: [{ test: "data" }],
          },
        });
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue([{ test: "data" }]);

        const result = await GetData("http://test.com", { hostUrl: "http://ant.com", userName: "test-key", password: "param=value" }, 6);

        expect(result.data).toEqual([{ test: "data" }]);
      });

      it("should handle empty response", async () => {
        const mockResponse = { data: null };
        (mockedAxios as any).mockResolvedValue(mockResponse);
        mockedXml2js.parseStringPromise.mockResolvedValue({
          List: {
            item: [],
          },
        });
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue([]);

        const result = await GetData("http://test.com", { hostUrl: "http://ant.com", userName: "test-key" }, 7);

        // When data is null, antResponse is set to {}, then JSON.parse fails and goes to XML parsing
        expect(result.data).toBeDefined();
      });
    });

    describe("proxyParam 11 and 12 (Proxy with InitProxy)", () => {
      it("should handle proxyParam 11", async () => {
        const mockProxyDetails = { host: "proxy.com", port: 8080 };
        const mockAxiosResponse = { data: { product: "test" } };
        mockedProxyHelper.InitProxy.mockResolvedValue(mockProxyDetails);
        mockedAxiosHelper.fetchGetAsyncV2.mockResolvedValue(mockAxiosResponse);

        const result = await GetData("http://test.com", { userName: "test-user" }, 11);

        expect(mockedProxyHelper.InitProxy).toHaveBeenCalledWith({ userName: "test-user" });
        expect(mockedAxiosHelper.fetchGetAsyncV2).toHaveBeenCalledWith(mockProxyDetails, "http://test.com");
        expect(result.data).toEqual({ product: "test" });
        expect(result.request).toEqual({ proxyDetails: mockProxyDetails, _url: "http://test.com" });
      });

      it("should handle proxyParam 12", async () => {
        const mockProxyDetails = { host: "proxy.com", port: 8080 };
        const mockAxiosResponse = { data: { product: "test" } };
        mockedProxyHelper.InitProxy.mockResolvedValue(mockProxyDetails);
        mockedAxiosHelper.fetchGetAsyncV2.mockResolvedValue(mockAxiosResponse);

        const result = await GetData("http://test.com", { userName: "test-user" }, 12);

        expect(mockedProxyHelper.InitProxy).toHaveBeenCalledWith({ userName: "test-user" });
        expect(result.data).toEqual({ product: "test" });
      });
    });

    describe("proxyParam 99 (Native axios)", () => {
      it("should make native GET request", async () => {
        const mockResponse = { data: { product: "test" } };
        mockedAxios.get = jest.fn().mockResolvedValue(mockResponse) as any;

        const result = await GetData("http://test.com", {}, 99);

        expect(mockedAxios.get).toHaveBeenCalledWith("http://test.com");
        expect(result.data).toEqual({ product: "test" });
        expect(result.request).toBe("http://test.com");
      });
    });

    describe("default case", () => {
      it("should return null for unknown proxyParam", async () => {
        const result = await GetData("http://test.com", {}, 999);

        expect(result).toBeNull();
      });
    });
  });

  describe("convertFromXml (internal function)", () => {
    it("should handle XML with empty item array", async () => {
      mockedXml2js.parseStringPromise.mockResolvedValue({
        List: {
          item: [],
        },
      });
      mockedFormatWrapper.FormatScrapeResponse.mockReturnValue([]);

      // Test through GetData with proxyParam 0 and XML response
      const mockXmlResponse = '<List xmlns=""><item></item></List>';
      mockedRequestPromise.mockResolvedValue(mockXmlResponse);

      const result = await GetData("http://test.com", { userName: "test-key" }, 0);

      expect(result.data).toEqual([]);
    });

    it("should handle XML without List.item", async () => {
      mockedXml2js.parseStringPromise.mockResolvedValue({
        List: {},
      });

      // Test through GetData with proxyParam 0 and XML response
      const mockXmlResponse = '<List xmlns=""></List>';
      mockedRequestPromise.mockResolvedValue(mockXmlResponse);

      const result = await GetData("http://test.com", { userName: "test-key" }, 0);

      expect(result.data).toEqual([]);
    });
  });
});
