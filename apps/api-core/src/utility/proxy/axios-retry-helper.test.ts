// Mock dependencies before imports
jest.mock("@repricer-monorepo/shared", () => ({
  VendorName: {
    FRONTIER: "FRONTIER",
    TRADENT: "TRADENT",
    MVP: "MVP",
    TOPDENT: "TOPDENT",
    FIRSTDENT: "FIRSTDENT",
    TRIAD: "TRIAD",
  },
}));

jest.mock("axios");
jest.mock("axios-retry");
jest.mock("request-promise");
jest.mock("xml2js");
jest.mock("../proxy-switch-helper");
jest.mock("../format-wrapper");
jest.mock("../config", () => ({
  applicationConfig: {
    NO_OF_RETRIES: 3,
    RETRY_INTERVAL: 1000,
    FORMAT_RESPONSE_CUSTOM: true,
    SCRAPINGBEE_WAIT_VALUE: 1000,
    SCRAPINGBEE_TIMEOUT_VALUE: 30000,
  },
}));

import axios from "axios";
import axiosRetry from "axios-retry";
import requestPromise from "request-promise";
import xml2js from "xml2js";
import * as proxySwitchHelper from "../proxy-switch-helper";
import * as formatWrapper from "../format-wrapper";
import { getScrappingResponse, getScrapingBeeResponse } from "./axios-retry-helper";

const mockedAxios = axios as jest.MockedFunction<typeof axios>;
const mockedRequestPromise = requestPromise as jest.MockedFunction<typeof requestPromise>;
const mockedXml2js = xml2js as jest.Mocked<typeof xml2js>;
const mockedProxySwitchHelper = proxySwitchHelper as jest.Mocked<typeof proxySwitchHelper>;
const mockedFormatWrapper = formatWrapper as jest.Mocked<typeof formatWrapper>;

// Suppress console.log during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleDebug = console.debug;

describe("axios-retry-helper", () => {
  const mockProxyDetails = {
    hostUrl: "https://api.testproxy.com/v1",
    userName: "test-username",
    proxyProvider: "1",
  };

  const mockSeqString = "test-seq-123";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.debug = jest.fn();

    // Mock axios-retry
    (axiosRetry as unknown as jest.Mock).mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.debug = originalConsoleDebug;
  });

  describe("getScrappingResponse", () => {
    const testUrl = "https://example.com/product";

    describe("successful responses", () => {
      it("should return JSON response when formatResponse is false", async () => {
        const mockResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/json" },
                content: '{"product": "test"}',
              },
            ],
          },
        };

        mockedAxios.mockResolvedValueOnce(mockResponse as any);

        const result = await getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        expect(result).toEqual({ data: { product: "test" } });
        expect(mockedAxios).toHaveBeenCalledWith({
          method: "post",
          url: mockProxyDetails.hostUrl,
          data: {
            target: "universal",
            url: testUrl,
            locale: "en",
            geo: "United States",
            device_type: "desktop",
          },
          headers: {
            "Content-Type": "application/json",
            Accept: "application/xml",
            Authorization: `Basic ${mockProxyDetails.userName}`,
          },
        });
      });

      it("should return formatted XML response when formatResponse is true and content-type is not JSON", async () => {
        const mockXmlContent = "<List><item><vendorProductId>123</vendorProductId></item></List>";
        const mockParsedXml = {
          List: {
            item: [{ vendorProductId: "123" }],
          },
        };
        const mockFormattedData = [{ vendorProductId: 123 }];

        const mockResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/xml" },
                content: mockXmlContent,
              },
            ],
          },
        };

        mockedAxios.mockResolvedValueOnce(mockResponse as any);
        mockedXml2js.parseStringPromise.mockResolvedValue(mockParsedXml);
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue(mockFormattedData);

        const result = await getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        expect(result).toEqual({ data: mockFormattedData });
        expect(mockedXml2js.parseStringPromise).toHaveBeenCalledWith(mockXmlContent, {
          mergeAttrs: true,
          explicitArray: false,
        });
        expect(mockedFormatWrapper.FormatScrapeResponse).toHaveBeenCalledWith([{ vendorProductId: "123" }]);
      });

      it("should return empty array when XML response has no items", async () => {
        const mockXmlContent = "<List></List>";
        const mockParsedXml = {
          List: {},
        };

        const mockResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/xml" },
                content: mockXmlContent,
              },
            ],
          },
        };

        mockedAxios.mockResolvedValueOnce(mockResponse as any);
        mockedXml2js.parseStringPromise.mockResolvedValue(mockParsedXml);

        const result = await getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        expect(result).toEqual({ data: [] });
        expect(mockedFormatWrapper.FormatScrapeResponse).not.toHaveBeenCalled();
      });

      it("should fall back to JSON parsing when XML parsing fails", async () => {
        const mockXmlContent = "<List><item>invalid</item></List>";
        const mockJsonContent = '{"product": "test"}';

        const mockResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/xml" },
                content: mockXmlContent,
              },
            ],
          },
        };

        mockedAxios.mockResolvedValueOnce(mockResponse as any);
        mockedXml2js.parseStringPromise.mockRejectedValue(new Error("Parse error"));
        // Mock JSON.parse to return the parsed content
        const originalJsonParse = JSON.parse;
        JSON.parse = jest.fn().mockReturnValue({ product: "test" });

        const result = await getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        expect(result).toEqual({ data: { product: "test" } });
        expect(console.debug).toHaveBeenCalled();

        JSON.parse = originalJsonParse;
      });

      it("should return null when response has no results", async () => {
        const mockResponse = {
          status: 200,
          data: {
            results: [],
          },
        };

        mockedAxios.mockResolvedValueOnce(mockResponse as any);

        const result = await getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        expect(result).toBeUndefined();
      });

      it("should return undefined when response.data is missing", async () => {
        const mockResponse = {
          status: 200,
          data: null,
        };

        mockedAxios.mockResolvedValueOnce(mockResponse as any);

        const result = await getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        expect(result).toBeUndefined();
      });
    });

    describe("error handling and retries", () => {
      it("should retry on 503 error and eventually succeed", async () => {
        const mockError = {
          response: { status: 503 },
          message: "Service Unavailable",
          stack: "Error stack",
        };

        const mockSuccessResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/json" },
                content: '{"product": "test"}',
              },
            ],
          },
        };

        mockedAxios
          .mockRejectedValueOnce(mockError)
          .mockRejectedValueOnce(mockError)
          .mockResolvedValueOnce(mockSuccessResponse as any);

        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);
        mockedProxySwitchHelper.SwitchProxy.mockResolvedValue(undefined);

        const resultPromise = getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        // Fast-forward timers for each retry attempt
        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
        expect(mockedAxios).toHaveBeenCalledTimes(3);
      });

      it("should retry on 500 error", async () => {
        const mockError = {
          response: { status: 500 },
          message: "Internal Server Error",
          stack: "Error stack",
        };

        const mockSuccessResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/json" },
                content: '{"product": "test"}',
              },
            ],
          },
        };

        mockedAxios.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse as any);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
      });

      it("should retry on 429 error", async () => {
        const mockError = {
          response: { status: 429 },
          message: "Too Many Requests",
          stack: "Error stack",
        };

        const mockSuccessResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/json" },
                content: '{"product": "test"}',
              },
            ],
          },
        };

        mockedAxios.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse as any);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should retry on 408 error", async () => {
        const mockError = {
          response: { status: 408 },
          message: "Request Timeout",
          stack: "Error stack",
        };

        const mockSuccessResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/json" },
                content: '{"product": "test"}',
              },
            ],
          },
        };

        mockedAxios.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse as any);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should retry on 400 error", async () => {
        const mockError = {
          response: { status: 400 },
          message: "Bad Request",
          stack: "Error stack",
        };

        const mockSuccessResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/json" },
                content: '{"product": "test"}',
              },
            ],
          },
        };

        mockedAxios.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse as any);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should retry on 401 error", async () => {
        const mockError = {
          response: { status: 401 },
          message: "Unauthorized",
          stack: "Error stack",
        };

        const mockSuccessResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/json" },
                content: '{"product": "test"}',
              },
            ],
          },
        };

        mockedAxios.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse as any);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should switch proxy when retryCount > 1", async () => {
        const mockError = {
          response: { status: 503 },
          message: "Service Unavailable",
          stack: "Error stack",
        };

        const mockSuccessResponse = {
          status: 200,
          data: {
            results: [
              {
                task_id: "task-123",
                headers: { "content-type": "application/json" },
                content: '{"product": "test"}',
              },
            ],
          },
        };

        mockedAxios.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse as any);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);
        mockedProxySwitchHelper.SwitchProxy.mockResolvedValue(undefined);

        const resultPromise = getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 2);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
        expect(mockedProxySwitchHelper.SwitchProxy).toHaveBeenCalled();
      });

      it("should return null when max retries exceeded", async () => {
        const mockError = {
          response: { status: 503 },
          message: "Service Unavailable",
          stack: "Error stack",
        };

        mockedAxios.mockRejectedValueOnce(mockError);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const result = await getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 3);

        expect(result).toBeNull();
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalled();
      });

      it("should return null when error is not retryable", async () => {
        const mockError = {
          response: { status: 404 },
          message: "Not Found",
          stack: "Error stack",
        };

        mockedAxios.mockRejectedValueOnce(mockError);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toBeNull();
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalled();
      });

      it("should handle error without response object", async () => {
        const mockError = {
          message: "Network Error",
          stack: "Error stack",
        };

        mockedAxios.mockRejectedValueOnce(mockError);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        // retryConditionForAxios will throw when error.response is undefined
        // So we expect the function to throw
        await expect(getScrappingResponse(testUrl, mockProxyDetails, mockSeqString, 0)).rejects.toThrow();
      });
    });
  });

  describe("getScrapingBeeResponse", () => {
    const testUrl = "https://example.com/product";

    describe("successful responses", () => {
      it("should return JSON response when formatResponse is false", async () => {
        const mockResponse = '{"product": "test"}';

        mockedRequestPromise.mockResolvedValueOnce(mockResponse);
        // When formatResponse is true but no List tag found, xml2js will parse invalid XML
        // Mock it to return object without expected structure so it falls through to JSON parsing
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({});

        const result = await getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        expect(result).toEqual({ data: { product: "test" } });
        expect(mockedRequestPromise).toHaveBeenCalledWith({
          uri: "https://app.scrapingbee.com/api/v1/",
          qs: {
            api_key: mockProxyDetails.userName,
            url: testUrl,
            wait: 1000,
            render_js: false,
          },
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
          },
        });
      });

      it("should return JSON response when formatResponse is false and renderJs is true", async () => {
        const mockResponse = '{"product": "test"}';

        mockedRequestPromise.mockResolvedValueOnce(mockResponse);
        // When formatResponse is true but no List tag found, xml2js will parse invalid XML
        // Mock it to return object without expected structure so it falls through to JSON parsing
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({});

        const result = await getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, true, 0);

        expect(result).toEqual({ data: { product: "test" } });
        expect(mockedRequestPromise).toHaveBeenCalledWith({
          uri: "https://app.scrapingbee.com/api/v1/",
          qs: {
            api_key: mockProxyDetails.userName,
            url: testUrl,
            wait: 1000,
          },
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
          },
        });
      });

      it("should return formatted XML response when formatResponse is true and List tag exists", async () => {
        const mockResponse = 'Some prefix <List xmlns=""><item><vendorProductId>123</vendorProductId></item></List> Some suffix';
        const mockParsedXml = {
          List: {
            item: [{ vendorProductId: "123" }],
          },
        };
        const mockFormattedData = [{ vendorProductId: 123 }];

        mockedRequestPromise.mockResolvedValue(mockResponse);
        mockedXml2js.parseStringPromise.mockResolvedValue(mockParsedXml);
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue(mockFormattedData);

        const result = await getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        expect(result).toEqual({ data: mockFormattedData });
        expect(mockedXml2js.parseStringPromise).toHaveBeenCalledWith('<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>', { mergeAttrs: true, explicitArray: false });
        expect(mockedFormatWrapper.FormatScrapeResponse).toHaveBeenCalledWith([{ vendorProductId: "123" }]);
      });

      it("should handle List tag without xmlns attribute", async () => {
        const mockResponse = "Some prefix <List><item><vendorProductId>123</vendorProductId></item></List> Some suffix";
        const mockParsedXml = {
          List: {
            item: [{ vendorProductId: "123" }],
          },
        };
        const mockFormattedData = [{ vendorProductId: 123 }];

        mockedRequestPromise.mockResolvedValue(mockResponse);
        mockedXml2js.parseStringPromise.mockResolvedValue(mockParsedXml);
        mockedFormatWrapper.FormatScrapeResponse.mockReturnValue(mockFormattedData);

        const result = await getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        expect(result).toEqual({ data: mockFormattedData });
        expect(mockedXml2js.parseStringPromise).toHaveBeenCalledWith("<List><item><vendorProductId>123</vendorProductId></item></List>", { mergeAttrs: true, explicitArray: false });
      });

      it("should return single item formatted response when item is not an array", async () => {
        const mockResponse = "Some prefix <List><item><vendorProductId>123</vendorProductId></item></List> Some suffix";
        const mockParsedXml = {
          List: {
            item: { vendorProductId: "123" },
          },
        };
        const mockFormattedData = [{ vendorProductId: 123 }];

        mockedRequestPromise.mockResolvedValueOnce(mockResponse);
        mockedXml2js.parseStringPromise.mockResolvedValueOnce(mockParsedXml);
        mockedFormatWrapper.FormatSingleScrapeResponse.mockReturnValue(mockFormattedData);

        const result = await getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        expect(result).toEqual({ data: mockFormattedData });
        expect(mockedFormatWrapper.FormatSingleScrapeResponse).toHaveBeenCalledWith({ vendorProductId: "123" });
        expect(mockedFormatWrapper.FormatScrapeResponse).not.toHaveBeenCalled();
      });

      it("should return JSON when formatResponse is true but no List tag found", async () => {
        const mockResponse = '{"product": "test"}';

        mockedRequestPromise.mockResolvedValue(mockResponse);
        // When List tag is not found, xml2js will parse an invalid string
        // Mock it to return an object without the expected structure so it falls through to JSON parsing
        mockedXml2js.parseStringPromise.mockResolvedValue({});

        const result = await getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        expect(result).toEqual({ data: { product: "test" } });
        expect(mockedXml2js.parseStringPromise).toHaveBeenCalled();
      });

      it("should handle null seqString", async () => {
        const mockResponse = '{"product": "test"}';

        mockedRequestPromise.mockResolvedValueOnce(mockResponse);
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({});

        const result = await getScrapingBeeResponse(testUrl, mockProxyDetails, null, false, 0);

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should handle undefined seqString", async () => {
        const mockResponse = '{"product": "test"}';

        mockedRequestPromise.mockResolvedValueOnce(mockResponse);
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({});

        const result = await getScrapingBeeResponse(testUrl, mockProxyDetails, undefined, false, 0);

        expect(result).toEqual({ data: { product: "test" } });
      });
    });

    describe("error handling and retries", () => {
      it("should retry on 503 error and eventually succeed", async () => {
        const mockError = {
          response: { statusCode: 503 },
          message: "Service Unavailable",
        };

        const mockSuccessResponse = '{"product": "test"}';

        mockedRequestPromise.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
        expect(mockedRequestPromise).toHaveBeenCalledTimes(2);
      });

      it("should retry on 500 error", async () => {
        const mockError = {
          response: { statusCode: 500 },
          message: "Internal Server Error",
        };

        const mockSuccessResponse = '{"product": "test"}';

        mockedRequestPromise.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should retry on 429 error", async () => {
        const mockError = {
          response: { statusCode: 429 },
          message: "Too Many Requests",
        };

        const mockSuccessResponse = '{"product": "test"}';

        mockedRequestPromise.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should retry on 408 error", async () => {
        const mockError = {
          response: { statusCode: 408 },
          message: "Request Timeout",
        };

        const mockSuccessResponse = '{"product": "test"}';

        mockedRequestPromise.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should retry on 400 error", async () => {
        const mockError = {
          response: { statusCode: 400 },
          message: "Bad Request",
        };

        const mockSuccessResponse = '{"product": "test"}';

        mockedRequestPromise.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should retry on 401 error", async () => {
        const mockError = {
          response: { statusCode: 401 },
          message: "Unauthorized",
        };

        const mockSuccessResponse = '{"product": "test"}';

        mockedRequestPromise.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should retry on ESOCKETTIMEDOUT error", async () => {
        const mockError = {
          message: "Error: ESOCKETTIMEDOUT",
        };

        const mockSuccessResponse = '{"product": "test"}';

        mockedRequestPromise.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
      });

      it("should switch proxy when retryCount > 1", async () => {
        const mockError = {
          response: { statusCode: 503 },
          message: "Service Unavailable",
        };

        const mockSuccessResponse = '{"product": "test"}';

        mockedRequestPromise.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccessResponse);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);
        mockedProxySwitchHelper.SwitchProxy.mockResolvedValue(undefined);

        const resultPromise = getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 2);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toEqual({ data: { product: "test" } });
        expect(mockedProxySwitchHelper.SwitchProxy).toHaveBeenCalled();
      });

      it("should return null when max retries exceeded", async () => {
        const mockError = {
          response: { statusCode: 503 },
          message: "Service Unavailable",
        };

        mockedRequestPromise.mockRejectedValue(mockError);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const result = await getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 3);

        expect(result).toBeNull();
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalled();
      });

      it("should return null when error is not retryable", async () => {
        const mockError = {
          response: { statusCode: 404 },
          message: "Not Found",
        };

        mockedRequestPromise.mockRejectedValue(mockError);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toBeNull();
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalled();
      });

      it("should handle error without response object and non-retryable message", async () => {
        const mockError = {
          message: "Network Error",
        };

        mockedRequestPromise.mockRejectedValue(mockError);
        mockedProxySwitchHelper.ExecuteCounter.mockResolvedValue(undefined);

        const resultPromise = getScrapingBeeResponse(testUrl, mockProxyDetails, mockSeqString, false, 0);

        await jest.runAllTimersAsync();

        const result = await resultPromise;

        expect(result).toBeNull();
      });
    });
  });
});
