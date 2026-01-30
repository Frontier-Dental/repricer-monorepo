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

jest.mock("puppeteer-core");
jest.mock("request-promise");
jest.mock("../proxy-switch-helper");
jest.mock("../config", () => ({
  applicationConfig: {
    PROXY_SWITCH_EMAIL_NOTIFIER: "http://test-email-notifier.com",
    PROXY_SWITCH_EMAIL_THRESHOLD_NOTIFIER: "http://test-threshold-notifier.com",
    REPRICER_UI_CACHE_CLEAR: "http://test-cache-clear.com",
    PROXYSWITCH_TIMER: 3600000,
  },
}));

import puppeteer from "puppeteer-core";
import requestPromise from "request-promise";
import * as proxySwitchHelper from "../proxy-switch-helper";
import { fetchData, fetchDataV2, fetchDataForDebug } from "./bright-data-helper";

const mockedPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;
const mockedRequestPromise = requestPromise as jest.MockedFunction<typeof requestPromise>;
const mockedProxySwitchHelper = proxySwitchHelper as jest.Mocked<typeof proxySwitchHelper>;

// Suppress console.log during tests
const originalConsoleLog = console.log;

describe("bright-data-helper", () => {
  const mockProxyDetails = {
    userName: "test-username",
    password: "test-password",
    hostUrl: "wss://test-proxy.brightdata.com",
    port: "9222",
    proxyProvider: "1",
  };

  const mockUrl = "https://example.com/product";

  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console.log
    console.log = jest.fn();

    // Create mock page object
    mockPage = {
      evaluate: jest.fn(),
    };

    // Create mock browser object
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Mock puppeteer.connect
    mockedPuppeteer.connect = jest.fn().mockResolvedValue(mockBrowser);

    // Mock proxy switch helper - ExecuteCounter is already mocked by jest.mock
    (mockedProxySwitchHelper.ExecuteCounter as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe("fetchData", () => {
    describe("successful responses", () => {
      it("should successfully fetch data and parse JSON from page body", async () => {
        const mockJsonData = { product: "test-product", price: 99.99 };
        mockPage.evaluate.mockResolvedValue(mockJsonData);

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({ data: mockJsonData });
        expect(mockedPuppeteer.connect).toHaveBeenCalledWith({
          browserWSEndpoint: `${mockProxyDetails.userName}:${mockProxyDetails.password}@${mockProxyDetails.hostUrl}:${mockProxyDetails.port}`,
        });
        expect(mockBrowser.newPage).toHaveBeenCalled();
        expect(mockPage.evaluate).toHaveBeenCalled();
        expect(mockBrowser.close).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("SCRAPE : BrightData :"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("TimeTaken"));
      });

      it("should handle empty JSON response", async () => {
        mockPage.evaluate.mockResolvedValue(null);

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockBrowser.close).toHaveBeenCalled();
      });

      it("should handle undefined JSON response", async () => {
        mockPage.evaluate.mockResolvedValue(undefined);

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockBrowser.close).toHaveBeenCalled();
      });

      it("should correctly construct WebSocket endpoint with all proxy details", async () => {
        const customProxyDetails = {
          userName: "custom-user",
          password: "custom-pass",
          hostUrl: "wss://custom-host.com",
          port: "8080",
          proxyProvider: "2",
        };
        mockPage.evaluate.mockResolvedValue({ data: "test" });

        await fetchData(mockUrl, customProxyDetails);

        expect(mockedPuppeteer.connect).toHaveBeenCalledWith({
          browserWSEndpoint: "custom-user:custom-pass@wss://custom-host.com:8080",
        });
      });
    });

    describe("error handling", () => {
      it("should handle puppeteer connection errors", async () => {
        const connectionError = new Error("Connection failed");
        mockedPuppeteer.connect.mockRejectedValueOnce(connectionError);

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("BRIGHTDATA - Fetch Response Exception"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining(mockUrl));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("ERROR"));
      });

      it("should handle page creation errors", async () => {
        const pageError = new Error("Page creation failed");
        mockBrowser.newPage.mockRejectedValueOnce(pageError);

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
        expect(mockBrowser.close).toHaveBeenCalled();
      });

      it("should handle page.evaluate errors", async () => {
        const evaluateError = new Error("Evaluation failed");
        mockPage.evaluate.mockRejectedValueOnce(evaluateError);

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
        expect(mockBrowser.close).toHaveBeenCalled();
      });

      it("should handle JSON parsing errors in evaluate", async () => {
        const parseError = new SyntaxError("Unexpected token");
        mockPage.evaluate.mockRejectedValueOnce(parseError);

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
        expect(mockBrowser.close).toHaveBeenCalled();
      });

      it("should call ExecuteCounter with correct proxyProvider when error occurs", async () => {
        const error = new Error("Test error");
        mockedPuppeteer.connect.mockRejectedValueOnce(error);

        await fetchData(mockUrl, { ...mockProxyDetails, proxyProvider: "5" });

        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(5);
      });

      it("should ensure browser is closed even when error occurs", async () => {
        const error = new Error("Test error");
        mockPage.evaluate.mockRejectedValueOnce(error);

        await fetchData(mockUrl, mockProxyDetails);

        expect(mockBrowser.close).toHaveBeenCalled();
      });

      it("should handle browser close errors gracefully", async () => {
        const closeError = new Error("Close failed");
        mockBrowser.close.mockRejectedValueOnce(closeError);
        mockPage.evaluate.mockResolvedValue({ data: "test" });

        // Browser close errors in finally block will propagate
        await expect(fetchData(mockUrl, mockProxyDetails)).rejects.toThrow("Close failed");
      });
    });

    describe("browser context evaluation", () => {
      it("should evaluate function in browser context with document parameter", async () => {
        const mockJsonData = { test: "data" };
        mockPage.evaluate.mockResolvedValue(mockJsonData);

        await fetchData(mockUrl, mockProxyDetails);

        expect(mockPage.evaluate).toHaveBeenCalled();
        const evaluateFunction = mockPage.evaluate.mock.calls[0][0];
        expect(typeof evaluateFunction).toBe("function");

        // Simulate browser context with document
        const mockDocument = {
          querySelector: jest.fn().mockReturnValue({
            innerText: JSON.stringify(mockJsonData),
          }),
        };

        const result = evaluateFunction(mockDocument);
        expect(result).toEqual(mockJsonData);
      });

      it("should handle complex JSON structures", async () => {
        const complexData = {
          products: [
            { id: 1, name: "Product 1" },
            { id: 2, name: "Product 2" },
          ],
          metadata: { total: 2, page: 1 },
        };
        mockPage.evaluate.mockResolvedValue(complexData);

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({ data: complexData });
      });
    });

    describe("timing and logging", () => {
      it("should log timing information after successful fetch", async () => {
        mockPage.evaluate.mockResolvedValue({ data: "test" });

        await fetchData(mockUrl, mockProxyDetails);

        expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/SCRAPE : BrightData : .* \|\| TimeTaken  :  \d+\.\d{3} seconds/));
      });

      it("should include URL in log message", async () => {
        const customUrl = "https://custom-url.com/test";
        mockPage.evaluate.mockResolvedValue({ data: "test" });

        await fetchData(customUrl, mockProxyDetails);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining(customUrl));
      });
    });
  });

  describe("fetchDataV2", () => {
    describe("successful responses", () => {
      it("should successfully fetch data using request-promise", async () => {
        const mockResponse = '{"product": "test", "price": 99.99}';
        mockedRequestPromise.mockResolvedValueOnce(mockResponse);

        const result = await fetchDataV2(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockedRequestPromise).toHaveBeenCalledWith({
          url: mockUrl,
          proxy: `${mockProxyDetails.userName}:${mockProxyDetails.password}@${mockProxyDetails.hostUrl}:${mockProxyDetails.port}`,
          rejectUnauthorized: false,
        });
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("SCRAPE : BrightData - Residential :"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("TimeTaken"));
      });

      it("should correctly construct proxy endpoint for request-promise", async () => {
        const customProxyDetails = {
          userName: "v2-user",
          password: "v2-pass",
          hostUrl: "https://v2-proxy.com",
          port: "3128",
          proxyProvider: "3",
        };
        mockedRequestPromise.mockResolvedValueOnce("response");

        await fetchDataV2(mockUrl, customProxyDetails);

        expect(mockedRequestPromise).toHaveBeenCalledWith({
          url: mockUrl,
          proxy: "v2-user:v2-pass@https://v2-proxy.com:3128",
          rejectUnauthorized: false,
        });
      });

      it("should handle empty response", async () => {
        mockedRequestPromise.mockResolvedValueOnce("");

        const result = await fetchDataV2(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
      });

      it("should handle null response", async () => {
        mockedRequestPromise.mockResolvedValueOnce(null as any);

        const result = await fetchDataV2(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
      });

      it("should always set rejectUnauthorized to false", async () => {
        mockedRequestPromise.mockResolvedValueOnce("response");

        await fetchDataV2(mockUrl, mockProxyDetails);

        expect(mockedRequestPromise).toHaveBeenCalledWith(
          expect.objectContaining({
            rejectUnauthorized: false,
          })
        );
      });
    });

    describe("error handling", () => {
      it("should handle request-promise errors", async () => {
        const requestError = new Error("Request failed");
        mockedRequestPromise.mockRejectedValueOnce(requestError);

        const result = await fetchDataV2(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("BRIGHTDATA - Fetch Response Exception"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining(mockUrl));
      });

      it("should handle network timeout errors", async () => {
        const timeoutError = { code: "ETIMEDOUT", message: "Request timeout" };
        mockedRequestPromise.mockRejectedValueOnce(timeoutError);

        const result = await fetchDataV2(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
      });

      it("should handle proxy authentication errors", async () => {
        const authError = { statusCode: 407, message: "Proxy authentication required" };
        mockedRequestPromise.mockRejectedValueOnce(authError);

        const result = await fetchDataV2(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
      });

      it("should call ExecuteCounter with correct proxyProvider when error occurs", async () => {
        const error = new Error("Test error");
        mockedRequestPromise.mockRejectedValueOnce(error);

        await fetchDataV2(mockUrl, { ...mockProxyDetails, proxyProvider: "7" });

        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(7);
      });

      it("should log error details in exception handler", async () => {
        const error = new Error("Detailed error message");
        mockedRequestPromise.mockRejectedValueOnce(error);

        await fetchDataV2(mockUrl, mockProxyDetails);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("BRIGHTDATA - Fetch Response Exception"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("ERROR"));
      });
    });

    describe("timing and logging", () => {
      it("should log timing information after successful fetch", async () => {
        mockedRequestPromise.mockResolvedValueOnce("response");

        await fetchDataV2(mockUrl, mockProxyDetails);

        expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/SCRAPE : BrightData - Residential : .* \|\| TimeTaken  :  \d+\.\d{3} seconds/));
      });

      it("should include URL in log message", async () => {
        const customUrl = "https://custom-v2-url.com/test";
        mockedRequestPromise.mockResolvedValueOnce("response");

        await fetchDataV2(customUrl, mockProxyDetails);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining(customUrl));
      });
    });
  });

  describe("fetchDataForDebug", () => {
    describe("successful responses", () => {
      it("should successfully fetch data and parse JSON from page body", async () => {
        const mockJsonData = { product: "test-product", price: 99.99 };
        mockPage.evaluate.mockResolvedValue(mockJsonData);

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(result).toEqual({ data: mockJsonData });
        expect(mockedPuppeteer.connect).toHaveBeenCalledWith({
          browserWSEndpoint: `${mockProxyDetails.userName}:${mockProxyDetails.password}@${mockProxyDetails.hostUrl}:${mockProxyDetails.port}`,
        });
        expect(mockBrowser.newPage).toHaveBeenCalled();
        expect(mockPage.evaluate).toHaveBeenCalled();
        expect(mockBrowser.close).toHaveBeenCalled();
      });

      it("should handle empty JSON response", async () => {
        mockPage.evaluate.mockResolvedValue(null);

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(result).toEqual({});
        expect(mockBrowser.close).toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      it("should handle errors and return error details in response data", async () => {
        const error = new Error("Test error");
        error.stack = "Error stack trace";
        mockPage.evaluate.mockRejectedValueOnce(error);

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(result).toEqual({
          data: {
            message: undefined, // error.error?.message is undefined when error is direct
            stack: undefined, // error.error?.stack is undefined when error is direct
          },
        });
        expect(mockBrowser.close).toHaveBeenCalled();
        expect(mockedProxySwitchHelper.ExecuteCounter).not.toHaveBeenCalled();
      });

      it("should handle errors with error.error property", async () => {
        const innerError = {
          message: "Inner error message",
          stack: "Inner error stack",
        };
        const error: any = { error: innerError };
        mockPage.evaluate.mockRejectedValueOnce(error);

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(result).toEqual({
          data: {
            message: "Inner error message",
            stack: "Inner error stack",
          },
        });
        expect(mockBrowser.close).toHaveBeenCalled();
      });

      it("should handle errors with partial error.error object", async () => {
        const innerError = {
          message: "Partial error",
        };
        const error: any = { error: innerError };
        mockPage.evaluate.mockRejectedValueOnce(error);

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(result).toEqual({
          data: {
            message: "Partial error",
            stack: undefined,
          },
        });
      });

      it("should handle puppeteer connection errors in debug mode", async () => {
        const connectionError = new Error("Connection failed");
        mockedPuppeteer.connect.mockRejectedValueOnce(connectionError);

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(result).toEqual({
          data: {
            message: undefined,
            stack: undefined,
          },
        });
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("BRIGHTDATA - Fetch Response Exception"));
        expect(mockedProxySwitchHelper.ExecuteCounter).not.toHaveBeenCalled();
      });

      it("should ensure browser is closed even when error occurs", async () => {
        const error = new Error("Test error");
        mockPage.evaluate.mockRejectedValueOnce(error);

        await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(mockBrowser.close).toHaveBeenCalled();
      });

      it("should not call ExecuteCounter on errors in debug mode", async () => {
        const error = new Error("Test error");
        mockPage.evaluate.mockRejectedValueOnce(error);

        await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(mockedProxySwitchHelper.ExecuteCounter).not.toHaveBeenCalled();
      });

      it("should handle browser close errors gracefully", async () => {
        const closeError = new Error("Close failed");
        mockBrowser.close.mockRejectedValueOnce(closeError);
        mockPage.evaluate.mockResolvedValue({ data: "test" });

        // Browser close errors in finally block will propagate
        await expect(fetchDataForDebug(mockUrl, mockProxyDetails)).rejects.toThrow("Close failed");
      });
    });

    describe("logging", () => {
      it("should log timing information after successful fetch", async () => {
        mockPage.evaluate.mockResolvedValue({ data: "test" });

        await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/SCRAPE : BrightData : .* \|\| TimeTaken  :  \d+\.\d{3} seconds/));
      });

      it("should log error information when exception occurs", async () => {
        const error = new Error("Test error");
        mockPage.evaluate.mockRejectedValueOnce(error);

        await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("BRIGHTDATA - Fetch Response Exception"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining(mockUrl));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("ERROR"));
      });
    });

    describe("differences from fetchData", () => {
      it("should return error details in response instead of calling ExecuteCounter", async () => {
        const error: any = {
          error: {
            message: "Debug error",
            stack: "Debug stack",
          },
        };
        mockPage.evaluate.mockRejectedValueOnce(error);

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(result.data).toBeDefined();
        expect(result.data.message).toBe("Debug error");
        expect(result.data.stack).toBe("Debug stack");
        expect(mockedProxySwitchHelper.ExecuteCounter).not.toHaveBeenCalled();
      });
    });
  });

  describe("parseHrtimeToSeconds (indirect testing)", () => {
    it("should format timing correctly in fetchData", async () => {
      mockPage.evaluate.mockResolvedValue({ data: "test" });

      await fetchData(mockUrl, mockProxyDetails);

      const logCall = (console.log as jest.Mock).mock.calls.find((call) => call[0].includes("TimeTaken"));
      expect(logCall).toBeDefined();
      if (logCall) {
        const timeMatch = logCall[0].match(/TimeTaken  :  (\d+\.\d{3}) seconds/);
        expect(timeMatch).toBeTruthy();
        if (timeMatch) {
          const timeValue = parseFloat(timeMatch[1]);
          expect(timeValue).toBeGreaterThanOrEqual(0);
          expect(timeValue).toBeLessThan(100); // Reasonable upper bound
        }
      }
    });

    it("should format timing correctly in fetchDataV2", async () => {
      mockedRequestPromise.mockResolvedValueOnce("response");

      await fetchDataV2(mockUrl, mockProxyDetails);

      const logCall = (console.log as jest.Mock).mock.calls.find((call) => call[0].includes("TimeTaken"));
      expect(logCall).toBeDefined();
      if (logCall) {
        const timeMatch = logCall[0].match(/TimeTaken  :  (\d+\.\d{3}) seconds/);
        expect(timeMatch).toBeTruthy();
        if (timeMatch) {
          const timeValue = parseFloat(timeMatch[1]);
          expect(timeValue).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should format timing correctly in fetchDataForDebug", async () => {
      mockPage.evaluate.mockResolvedValue({ data: "test" });

      await fetchDataForDebug(mockUrl, mockProxyDetails);

      const logCall = (console.log as jest.Mock).mock.calls.find((call) => call[0].includes("TimeTaken"));
      expect(logCall).toBeDefined();
      if (logCall) {
        const timeMatch = logCall[0].match(/TimeTaken  :  (\d+\.\d{3}) seconds/);
        expect(timeMatch).toBeTruthy();
        expect(timeMatch[1]).toMatch(/^\d+\.\d{3}$/); // Format: number.3digits
      }
    });
  });

  describe("edge cases", () => {
    it("should handle proxy details with special characters in credentials", async () => {
      const specialProxyDetails = {
        userName: "user@name",
        password: "pass:word",
        hostUrl: "wss://test.com",
        port: "9222",
        proxyProvider: "1",
      };
      mockPage.evaluate.mockResolvedValue({ data: "test" });

      await fetchData(mockUrl, specialProxyDetails);

      expect(mockedPuppeteer.connect).toHaveBeenCalledWith({
        browserWSEndpoint: "user@name:pass:word@wss://test.com:9222",
      });
    });

    it("should handle very long URLs", async () => {
      const longUrl = "https://example.com/" + "a".repeat(1000);
      mockPage.evaluate.mockResolvedValue({ data: "test" });

      await fetchData(longUrl, mockProxyDetails);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(longUrl));
    });

    it("should handle numeric proxyProvider as string", async () => {
      const error = new Error("Test error");
      mockPage.evaluate.mockRejectedValueOnce(error);

      await fetchData(mockUrl, { ...mockProxyDetails, proxyProvider: "123" });

      expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(123);
    });

    it("should handle multiple sequential calls", async () => {
      mockPage.evaluate.mockResolvedValueOnce({ data: "first" }).mockResolvedValueOnce({ data: "second" });

      const result1 = await fetchData(mockUrl, mockProxyDetails);
      const result2 = await fetchData(mockUrl, mockProxyDetails);

      expect(result1).toEqual({ data: { data: "first" } });
      expect(result2).toEqual({ data: { data: "second" } });
      expect(mockBrowser.close).toHaveBeenCalledTimes(2);
    });
  });
});
