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

jest.mock("node-fetch");
jest.mock("../proxy-switch-helper");
jest.mock("../format-wrapper");
jest.mock("xml2js");
jest.mock("../config", () => ({
  applicationConfig: {
    NO_OF_RETRIES: 3,
    RETRY_INTERVAL: 1000,
    FORMAT_RESPONSE_CUSTOM: true,
    PROXY_SWITCH_EMAIL_NOTIFIER: "http://test-email-notifier.com",
    PROXY_SWITCH_EMAIL_THRESHOLD_NOTIFIER: "http://test-threshold-notifier.com",
    REPRICER_UI_CACHE_CLEAR: "http://test-cache-clear.com",
    PROXYSWITCH_TIMER: 3600000,
  },
}));

import fetch from "node-fetch";
import * as proxySwitchHelper from "../proxy-switch-helper";
import * as formatWrapper from "../format-wrapper";
import xml2js from "xml2js";
import { scrapflyFetchData, scrapflyFetch } from "./scrapfly-helper";

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockedProxySwitchHelper = proxySwitchHelper as jest.Mocked<typeof proxySwitchHelper>;
const mockedFormatWrapper = formatWrapper as jest.Mocked<typeof formatWrapper>;
const mockedXml2js = xml2js as jest.Mocked<typeof xml2js>;

// Suppress console.log during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("scrapfly-helper", () => {
  const mockProxyDetails = {
    hostUrl: "https://api.scrapfly.io/v1/scrape?",
    userName: "test-api-key",
    proxyProvider: "8",
  };

  const mockUrl = "https://example.com/product";
  const mockSeqString = "test-seq-123";

  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Create mock response object
    mockResponse = {
      status: 200,
      json: jest.fn().mockResolvedValue({
        result: {
          content: '{"product": "test", "price": 99.99}',
        },
      }),
    };

    // Mock fetch to return response by default
    mockedFetch.mockResolvedValue(mockResponse as any);

    // Mock proxy switch helper
    (mockedProxySwitchHelper.ExecuteCounter as jest.Mock).mockResolvedValue(undefined);
    (mockedProxySwitchHelper.SwitchProxy as jest.Mock).mockResolvedValue(undefined);

    // Mock format wrapper
    mockedFormatWrapper.FormatScrapeResponse = jest.fn().mockReturnValue([{ formatted: "data" }]);
    mockedFormatWrapper.FormatSingleScrapeResponse = jest.fn().mockReturnValue({ formatted: "data" });

    // Mock xml2js
    mockedXml2js.parseStringPromise = jest.fn().mockResolvedValue({
      List: {
        item: [{ vendorProductId: "123" }],
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("scrapflyFetchData", () => {
    describe("successful responses", () => {
      it("should successfully fetch data with JS rendering enabled", async () => {
        // When FORMAT_RESPONSE_CUSTOM is true, it expects XML content
        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

        expect(result).toEqual({ data: [{ formatted: "data" }] });
        expect(mockedFetch).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("SCRAPE STARTED : Scrapfly - JS Rendering"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("SCRAPE COMPLETED : Scrapfly - JS Rendering"));
      });

      it("should successfully fetch data with JS rendering disabled", async () => {
        // When FORMAT_RESPONSE_CUSTOM is true, it expects XML content
        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, false);

        expect(result).toEqual({ data: [{ formatted: "data" }] });
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("SCRAPE STARTED : Scrapfly - Non JS Rendering"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("SCRAPE COMPLETED : Scrapfly - Non JS Rendering"));
      });

      it("should handle null seqString", async () => {
        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        const result = await scrapflyFetchData(mockUrl, mockProxyDetails, null, true);

        expect(result).toEqual({ data: [{ formatted: "data" }] });
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("SCRAPE STARTED"));
      });

      it("should include retry count in log", async () => {
        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 2);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("|| 2"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("retry count : 2"));
      });

      it("should return formatted response when FORMAT_RESPONSE_CUSTOM is true", async () => {
        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

        expect(mockedXml2js.parseStringPromise).toHaveBeenCalled();
        expect(mockedFormatWrapper.FormatScrapeResponse).toHaveBeenCalled();
        expect(result).toEqual({ data: [{ formatted: "data" }] });
      });

      it("should handle formatted response with single item (non-array)", async () => {
        const xmlContent = "<List><item><vendorProductId>123</vendorProductId></item></List>";
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: { vendorProductId: "123" }, // Single object, not array
          },
        });

        const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

        expect(mockedFormatWrapper.FormatSingleScrapeResponse).toHaveBeenCalled();
        expect(result).toEqual({ data: { formatted: "data" } });
      });

      it("should handle formatted response with List xmlns attribute", async () => {
        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

        expect(mockedXml2js.parseStringPromise).toHaveBeenCalledWith(expect.stringContaining('<List xmlns="">'), { mergeAttrs: true, explicitArray: false });
      });

      it("should handle formatted response without xmlns attribute", async () => {
        const xmlContent = "<List><item><vendorProductId>123</vendorProductId></item></List>";
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

        expect(mockedXml2js.parseStringPromise).toHaveBeenCalledWith(expect.stringContaining("<List>"), { mergeAttrs: true, explicitArray: false });
      });
    });

    describe("error handling and retry logic", () => {
      it("should retry on 300 status code", async () => {
        const error300 = new Error("Multiple Choices") as any;
        error300.response = { statusCode: 300 };

        mockedFetch.mockRejectedValueOnce(error300).mockResolvedValueOnce(mockResponse as any);

        (mockedProxySwitchHelper.ExecuteCounter as jest.Mock).mockResolvedValue(undefined);

        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);
        await jest.advanceTimersByTimeAsync(1000);
        const result = await promise;

        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(8);
        expect(mockedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ data: [{ formatted: "data" }] });
      });

      it("should retry on 500 status code", async () => {
        const error500 = new Error("Internal Server Error") as any;
        error500.response = { statusCode: 500 };

        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        mockedFetch.mockRejectedValueOnce(error500).mockResolvedValueOnce(mockResponse as any);

        const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);
        await jest.advanceTimersByTimeAsync(1000);
        const result = await promise;

        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalled();
        expect(mockedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ data: [{ formatted: "data" }] });
      });

      it("should retry on ESOCKETTIMEDOUT error", async () => {
        const timeoutError = new Error("Error: ESOCKETTIMEDOUT");

        mockedFetch.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce(mockResponse as any);

        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);
        await jest.advanceTimersByTimeAsync(1000);
        const result = await promise;

        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalled();
        expect(mockedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ data: [{ formatted: "data" }] });
      });

      it("should not retry on 422 status code", async () => {
        const error422 = new Error("Unprocessable Entity") as any;
        error422.response = { statusCode: 422 };

        mockedFetch.mockRejectedValueOnce(error422);

        const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);

        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalled();
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(result).toBeNull();
      });

      it("should not retry when retry count exceeds NO_OF_RETRIES", async () => {
        const error = new Error("Test error") as any;
        error.response = { statusCode: 500 };

        mockedFetch.mockRejectedValueOnce(error);

        const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 3);

        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalled();
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(result).toBeNull();
      });

      it("should call SwitchProxy when retryCount > 1", async () => {
        const error = new Error("Test error") as any;
        error.response = { statusCode: 500 };

        mockedFetch.mockRejectedValueOnce(error).mockResolvedValueOnce(mockResponse as any);

        const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 2);
        await jest.advanceTimersByTimeAsync(1000);
        await promise;

        expect(mockedProxySwitchHelper.SwitchProxy).toHaveBeenCalled();
        expect(mockedFetch).toHaveBeenCalledTimes(2);
      });

      it("should not call SwitchProxy when retryCount <= 1", async () => {
        const error = new Error("Test error") as any;
        error.response = { statusCode: 500 };

        mockedFetch.mockRejectedValueOnce(error).mockResolvedValueOnce(mockResponse as any);

        const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 1);
        await jest.advanceTimersByTimeAsync(1000);
        await promise;

        expect(mockedProxySwitchHelper.SwitchProxy).not.toHaveBeenCalled();
        expect(mockedFetch).toHaveBeenCalledTimes(2);
      });

      it("should delay before retry", async () => {
        const error = new Error("Test error") as any;
        error.response = { statusCode: 500 };

        mockedFetch.mockRejectedValueOnce(error).mockResolvedValueOnce(mockResponse as any);

        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);

        // Fast-forward timers to skip delay
        await jest.advanceTimersByTimeAsync(1000);

        const result = await promise;

        expect(result).toEqual({ data: [{ formatted: "data" }] });
      });

      it("should call ExecuteCounter with correct proxyProvider", async () => {
        const error = new Error("Test error") as any;
        error.response = { statusCode: 422 }; // Use 422 so it doesn't retry

        mockedFetch.mockRejectedValueOnce(error);

        await scrapflyFetchData(mockUrl, { ...mockProxyDetails, proxyProvider: "9" }, mockSeqString, true, 0);

        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(9);
      });

      it("should handle proxyProvider as undefined (defaults to 0)", async () => {
        const error = new Error("Test error") as any;
        error.response = { statusCode: 422 }; // Use 422 so it doesn't retry

        mockedFetch.mockRejectedValueOnce(error);

        await scrapflyFetchData(mockUrl, { ...mockProxyDetails, proxyProvider: undefined }, mockSeqString, true, 0);

        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(0);
      });

      it("should log error details on exception", async () => {
        const error = new Error("Test error message") as any;
        error.response = { statusCode: 422 }; // Use 422 so it doesn't retry

        mockedFetch.mockRejectedValueOnce(error);

        await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Scrapfly Exception"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining(mockUrl));
      });

      it("should log retry attempt details", async () => {
        const error = new Error("Test error") as any;
        error.response = { statusCode: 500 };

        mockedFetch.mockRejectedValueOnce(error).mockResolvedValueOnce(mockResponse as any);

        const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);
        await jest.advanceTimersByTimeAsync(1000);
        await promise;

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("REPRICER CORE | SCRAPFLY | : ERROR (WITH RETRY)"));
        // The retry attempt log uses two arguments
        const retryLogCall = (console.log as jest.Mock).mock.calls.find((call) => call[0] && typeof call[0] === "string" && call[0].includes("RETRY ATTEMPT : 1"));
        expect(retryLogCall).toBeDefined();
      });
    });
  });

  describe("scrapflyFetch", () => {
    describe("successful requests", () => {
      it("should successfully fetch data and return response content", async () => {
        const result = await scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true);

        expect(result.responseContent).toBe('{"product": "test", "price": 99.99}');
        expect(result.timeTaken).toMatch(/^\d+\.\d{3}$/);
        expect(mockedFetch).toHaveBeenCalledWith(expect.stringContaining("render_js=true"), { method: "GET" });
      });

      it("should encode URL properly", async () => {
        const urlWithSpaces = "https://example.com/product?name=test product";
        await scrapflyFetch(urlWithSpaces, mockProxyDetails.hostUrl, mockProxyDetails.userName, true);

        expect(mockedFetch).toHaveBeenCalledWith(expect.stringContaining(encodeURI(urlWithSpaces)), { method: "GET" });
      });

      it("should construct fetch URL correctly with render_js=true", async () => {
        await scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true);

        expect(mockedFetch).toHaveBeenCalledWith(expect.stringMatching(/render_js=true&key=test-api-key&url=/), { method: "GET" });
      });

      it("should construct fetch URL correctly with render_js=false", async () => {
        await scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, false);

        expect(mockedFetch).toHaveBeenCalledWith(expect.stringMatching(/render_js=false&key=test-api-key&url=/), { method: "GET" });
      });

      it("should include hostUrl in fetch URL", async () => {
        const customHostUrl = "https://custom.scrapfly.io/v1/scrape?";
        await scrapflyFetch(mockUrl, customHostUrl, mockProxyDetails.userName, true);

        expect(mockedFetch).toHaveBeenCalledWith(expect.stringContaining(customHostUrl), { method: "GET" });
      });

      it("should include apiKey in fetch URL", async () => {
        const customApiKey = "custom-api-key-123";
        await scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, customApiKey, true);

        expect(mockedFetch).toHaveBeenCalledWith(expect.stringContaining(`key=${customApiKey}`), { method: "GET" });
      });

      it("should calculate time taken correctly", async () => {
        const result = await scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true);

        expect(result.timeTaken).toMatch(/^\d+\.\d{3}$/);
        const timeValue = parseFloat(result.timeTaken);
        expect(timeValue).toBeGreaterThanOrEqual(0);
      });
    });

    describe("response validation", () => {
      it("should throw error when response data is null", async () => {
        mockResponse.json.mockResolvedValueOnce(null);

        await expect(scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true)).rejects.toThrow("Scrapfly response did not return any data");
      });

      it("should throw error when response data is undefined", async () => {
        mockResponse.json.mockResolvedValueOnce(undefined);

        await expect(scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true)).rejects.toThrow("Scrapfly response did not return any data");
      });

      it("should throw error when HTTP status is not 200", async () => {
        mockResponse.status = 404;
        mockResponse.json.mockResolvedValueOnce({
          result: {
            error: {
              message: "Not Found",
            },
          },
        });

        const error = await scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true).catch((e) => e);

        expect(error.message).toBe("Not Found");
        expect(error.response.statusCode).toBe(404);
      });

      it("should throw error with JSON stringified data when error message is missing", async () => {
        mockResponse.status = 500;
        const errorData = { result: { error: {} } };
        mockResponse.json.mockResolvedValueOnce(errorData);

        const error = await scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true).catch((e) => e);

        expect(error.message).toContain(JSON.stringify(errorData));
        expect(error.response.statusCode).toBe(500);
      });

      it("should throw error when result.content is missing", async () => {
        mockResponse.json.mockResolvedValueOnce({
          result: {},
        });

        await expect(scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true)).rejects.toThrow("Scrapfly response did not return the result.content parameter");
      });

      it("should throw error when result is missing", async () => {
        mockResponse.json.mockResolvedValueOnce({
          data: "some data",
        });

        await expect(scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true)).rejects.toThrow("Scrapfly response did not return the result.content parameter");
      });
    });

    describe("edge cases", () => {
      it("should handle URLs with special characters", async () => {
        const specialUrl = "https://example.com/product?q=test&id=123#section";
        await scrapflyFetch(specialUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true);

        expect(mockedFetch).toHaveBeenCalledWith(expect.stringContaining(encodeURI(specialUrl)), { method: "GET" });
      });

      it("should handle very long URLs", async () => {
        const longUrl = "https://example.com/" + "a".repeat(1000);
        await scrapflyFetch(longUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true);

        expect(mockedFetch).toHaveBeenCalledWith(expect.stringContaining(encodeURI(longUrl)), { method: "GET" });
      });

      it("should handle fetch errors", async () => {
        const fetchError = new Error("Network error");
        mockedFetch.mockRejectedValueOnce(fetchError);

        await expect(scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true)).rejects.toThrow("Network error");
      });

      it("should handle JSON parsing errors", async () => {
        mockResponse.json.mockRejectedValueOnce(new Error("Invalid JSON"));

        await expect(scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true)).rejects.toThrow("Invalid JSON");
      });
    });
  });

  describe("getFormattedResponse (indirect testing)", () => {
    it("should handle XML with multiple items", async () => {
      const xmlContent = '<List xmlns=""><item><id>1</id></item><item><id>2</id></item></List>';
      mockResponse.json.mockResolvedValueOnce({
        result: {
          content: xmlContent,
        },
      });
      mockedXml2js.parseStringPromise.mockResolvedValueOnce({
        List: {
          item: [{ id: "1" }, { id: "2" }], // Array
        },
      });

      const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

      expect(mockedFormatWrapper.FormatScrapeResponse).toHaveBeenCalledWith([{ id: "1" }, { id: "2" }]);
      expect(result).toEqual({ data: [{ formatted: "data" }] });
    });

    it("should handle XML with single item", async () => {
      const xmlContent = "<List><item><id>1</id></item></List>";
      mockResponse.json.mockResolvedValueOnce({
        result: {
          content: xmlContent,
        },
      });
      mockedXml2js.parseStringPromise.mockResolvedValueOnce({
        List: {
          item: { id: "1" }, // Single object
        },
      });

      const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

      expect(mockedFormatWrapper.FormatSingleScrapeResponse).toHaveBeenCalledWith({ id: "1" });
      expect(result).toEqual({ data: { formatted: "data" } });
    });

    it("should handle XML without List.item", async () => {
      const xmlContent = "<List><other>data</other></List>";
      mockResponse.json.mockResolvedValueOnce({
        result: {
          content: xmlContent,
        },
      });
      mockedXml2js.parseStringPromise.mockResolvedValueOnce({
        List: {
          other: "data",
        },
      });

      const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

      expect(result).toBeUndefined();
      expect(mockedFormatWrapper.FormatScrapeResponse).not.toHaveBeenCalled();
      expect(mockedFormatWrapper.FormatSingleScrapeResponse).not.toHaveBeenCalled();
    });

    it("should handle XML without List", async () => {
      const xmlContent = "<OtherRoot><item>data</item></OtherRoot>";
      mockResponse.json.mockResolvedValueOnce({
        result: {
          content: xmlContent,
        },
      });
      mockedXml2js.parseStringPromise.mockResolvedValueOnce({
        OtherRoot: {
          item: "data",
        },
      });

      const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

      expect(result).toBeUndefined();
      expect(mockedFormatWrapper.FormatScrapeResponse).not.toHaveBeenCalled();
      expect(mockedFormatWrapper.FormatSingleScrapeResponse).not.toHaveBeenCalled();
    });

    it("should extract List section correctly", async () => {
      const xmlContent = 'Some prefix text<List xmlns=""><item>test</item></List>Some suffix text';
      mockResponse.json.mockResolvedValueOnce({
        result: {
          content: xmlContent,
        },
      });

      await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

      const parseCall = mockedXml2js.parseStringPromise.mock.calls[0][0];
      expect(parseCall).toContain("<List");
      expect(parseCall).toContain("</List>");
      expect(parseCall).not.toContain("Some prefix text");
      expect(parseCall).not.toContain("Some suffix text");
    });
  });

  describe("retryCondition (indirect testing)", () => {
    it("should retry on status codes >= 300 except 422", async () => {
      const statusCodes = [300, 301, 400, 401, 403, 404, 500, 502, 503];
      for (const statusCode of statusCodes) {
        const error = new Error("Test error") as any;
        error.response = { statusCode };

        mockedFetch.mockClear();
        (mockedProxySwitchHelper.ExecuteCounter as jest.Mock).mockClear();
        mockedFetch.mockRejectedValueOnce(error).mockResolvedValueOnce(mockResponse as any);

        const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
        mockResponse.json.mockResolvedValueOnce({
          result: {
            content: xmlContent,
          },
        });
        mockedXml2js.parseStringPromise.mockResolvedValueOnce({
          List: {
            item: [{ vendorProductId: "123" }],
          },
        });

        const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);
        await jest.advanceTimersByTimeAsync(1000);
        const result = await promise;

        expect(result).toEqual({ data: [{ formatted: "data" }] });
      }
    });

    it("should not retry on 422 status code", async () => {
      const error422 = new Error("Unprocessable Entity") as any;
      error422.response = { statusCode: 422 };

      mockedFetch.mockRejectedValueOnce(error422);

      const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);

      expect(result).toBeNull();
    });

    it("should retry on ESOCKETTIMEDOUT error message", async () => {
      const timeoutError = new Error("Error: ESOCKETTIMEDOUT");

      mockedFetch.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce(mockResponse as any);

      const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
      mockResponse.json.mockResolvedValueOnce({
        result: {
          content: xmlContent,
        },
      });
      mockedXml2js.parseStringPromise.mockResolvedValueOnce({
        List: {
          item: [{ vendorProductId: "123" }],
        },
      });

      const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toEqual({ data: [{ formatted: "data" }] });
    });

    it("should not retry on other error messages", async () => {
      const otherError = new Error("Some other error");

      mockedFetch.mockRejectedValueOnce(otherError);

      const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);

      expect(result).toBeNull();
      expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalled();
    });

    it("should not retry when error has no response", async () => {
      const error = new Error("Error without response");

      mockedFetch.mockRejectedValueOnce(error);

      const result = await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);

      expect(result).toBeNull();
      expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalled();
    });
  });

  describe("parseHrtimeToSeconds (indirect testing)", () => {
    it("should format timing correctly in scrapflyFetchData", async () => {
      await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);

      const logCalls = (console.log as jest.Mock).mock.calls;
      const timeTakenCall = logCalls.find((call) => call[0] && typeof call[0] === "string" && call[0].includes("TimeTaken"));
      expect(timeTakenCall).toBeDefined();
      if (timeTakenCall) {
        const timeMatch = timeTakenCall[0].match(/TimeTaken  :  (\d+\.\d{3}) seconds/);
        expect(timeMatch).toBeTruthy();
        if (timeMatch) {
          const timeValue = parseFloat(timeMatch[1]);
          expect(timeValue).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should format timing correctly in scrapflyFetch", async () => {
      const result = await scrapflyFetch(mockUrl, mockProxyDetails.hostUrl, mockProxyDetails.userName, true);

      expect(result.timeTaken).toMatch(/^\d+\.\d{3}$/);
      const timeValue = parseFloat(result.timeTaken);
      expect(timeValue).toBeGreaterThanOrEqual(0);
    });
  });

  describe("edge cases and integration", () => {
    it("should handle multiple sequential calls", async () => {
      await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true);
      await scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, false);

      expect(mockedFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle retry with incrementing retry count", async () => {
      const error = new Error("Test error") as any;
      error.response = { statusCode: 500 };

      mockedFetch
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse as any);

      const xmlContent = '<List xmlns=""><item><vendorProductId>123</vendorProductId></item></List>';
      mockResponse.json.mockResolvedValueOnce({
        result: {
          content: xmlContent,
        },
      });
      mockedXml2js.parseStringPromise.mockResolvedValueOnce({
        List: {
          item: [{ vendorProductId: "123" }],
        },
      });

      const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);
      await jest.advanceTimersByTimeAsync(2000); // Advance for 2 retries
      const result = await promise;

      expect(mockedFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: [{ formatted: "data" }] });
    }, 10000);

    it("should handle max retries reached", async () => {
      const error = new Error("Test error") as any;
      error.response = { statusCode: 500 };

      mockedFetch.mockRejectedValue(error);

      const promise = scrapflyFetchData(mockUrl, mockProxyDetails, mockSeqString, true, 0);
      await jest.advanceTimersByTimeAsync(4000); // Advance for all retries
      const result = await promise;

      expect(mockedFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(result).toBeNull();
    }, 10000);
  });
});
