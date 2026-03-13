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
jest.mock("../../proxy-switch-helper");
jest.mock("../../config", () => ({
  applicationConfig: {
    PROXY_SWITCH_EMAIL_NOTIFIER: "http://test-email-notifier.com",
    PROXY_SWITCH_EMAIL_THRESHOLD_NOTIFIER: "http://test-threshold-notifier.com",
    REPRICER_UI_CACHE_CLEAR: "http://test-cache-clear.com",
    PROXYSWITCH_TIMER: 3600000,
    FORMAT_RESPONSE_CUSTOM: false,
    NO_OF_RETRIES: 3,
    RETRY_INTERVAL: 10,
  },
}));

jest.mock("../../logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import puppeteer from "puppeteer-core";
import logger from "../../logger";
import requestPromise from "request-promise";
import * as proxySwitchHelper from "../../proxy-switch-helper";
import { fetchData, fetchDataForDebug } from "../bright-data-helper";

const mockedPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;
const mockedRequestPromise = requestPromise as jest.MockedFunction<typeof requestPromise>;
const mockedProxySwitchHelper = proxySwitchHelper as jest.Mocked<typeof proxySwitchHelper>;

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

    // Implementation uses fetch(), not puppeteer - mock global fetch
    (global as any).fetch = jest.fn().mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ product: "test-product", price: 99.99 })),
    });

    // Create mock page object (kept for any remaining references)
    mockPage = { evaluate: jest.fn() };
    mockBrowser = { newPage: jest.fn().mockResolvedValue(mockPage), close: jest.fn().mockResolvedValue(undefined) };
    mockedPuppeteer.connect = jest.fn().mockResolvedValue(mockBrowser);

    (mockedProxySwitchHelper.ExecuteCounter as jest.Mock).mockResolvedValue(undefined);
  });

  describe("fetchData", () => {
    describe("successful responses", () => {
      it("should successfully fetch data and parse JSON from page body", async () => {
        const mockJsonData = { product: "test-product", price: 99.99 };
        (global as any).fetch = jest.fn().mockResolvedValue({
          status: 200,
          text: jest.fn().mockResolvedValue(JSON.stringify(mockJsonData)),
        });

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({ data: mockJsonData });
        expect((global as any).fetch).toHaveBeenCalledWith(mockProxyDetails.hostUrl, expect.any(Object));
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("SCRAPE STARTED : BrightData :"));
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("SCRAPE COMPLETED : BrightData :"));
      });

      it("should handle empty JSON response", async () => {
        (global as any).fetch = jest.fn().mockResolvedValue({
          status: 200,
          text: jest.fn().mockResolvedValue(JSON.stringify(null)),
        });

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({ data: null });
        expect((global as any).fetch).toHaveBeenCalled();
      });

      it("should handle undefined JSON response", async () => {
        (global as any).fetch = jest.fn().mockResolvedValue({
          status: 200,
          text: jest.fn().mockResolvedValue(JSON.stringify({})),
        });

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toEqual({ data: {} });
        expect((global as any).fetch).toHaveBeenCalled();
      });

      it("should correctly call fetch with proxy hostUrl", async () => {
        const customProxyDetails = {
          userName: "custom-user",
          password: "custom-pass",
          hostUrl: "https://custom-api.brightdata.com",
          port: "8080",
          proxyProvider: "2",
        };

        await fetchData(mockUrl, customProxyDetails);

        expect((global as any).fetch).toHaveBeenCalledWith(
          customProxyDetails.hostUrl,
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({ Authorization: "Bearer custom-user" }),
          })
        );
      });
    });

    describe("error handling", () => {
      it("should handle fetch errors and call ExecuteCounter", async () => {
        (global as any).fetch = jest.fn().mockRejectedValueOnce(new Error("Connection failed"));

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toBeNull();
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("BrightData Exception"));
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(mockUrl));
      });

      it("should handle fetch rejection and retry path", async () => {
        (global as any).fetch = jest.fn().mockRejectedValueOnce(new Error("Page creation failed"));

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toBeNull();
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
      });

      it("should handle fetch rejection and call ExecuteCounter", async () => {
        (global as any).fetch = jest.fn().mockRejectedValueOnce(new Error("Evaluation failed"));

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toBeNull();
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
      });

      it("should handle fetch rejection on parse error", async () => {
        (global as any).fetch = jest.fn().mockRejectedValueOnce(new SyntaxError("Unexpected token"));

        const result = await fetchData(mockUrl, mockProxyDetails);

        expect(result).toBeNull();
        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(1);
      });

      it("should call ExecuteCounter with correct proxyProvider when error occurs", async () => {
        (global as any).fetch = jest.fn().mockRejectedValueOnce(new Error("Test error"));

        await fetchData(mockUrl, { ...mockProxyDetails, proxyProvider: "5" });

        expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(5);
      });
    });

    describe("timing and logging", () => {
      it("should log timing information after successful fetch", async () => {
        await fetchData(mockUrl, mockProxyDetails);

        expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/SCRAPE COMPLETED : BrightData : .* \|\| TimeTaken/));
      });

      it("should include URL in log message", async () => {
        const customUrl = "https://custom-url.com/test";

        await fetchData(customUrl, mockProxyDetails);

        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(customUrl));
      });
    });
  });

  describe("fetchDataForDebug", () => {
    describe("successful responses", () => {
      it("should successfully fetch data and parse JSON from page body", async () => {
        const mockJsonData = { product: "test-product", price: 99.99 };
        (global as any).fetch = jest.fn().mockResolvedValue({
          status: 200,
          text: jest.fn().mockResolvedValue(JSON.stringify(mockJsonData)),
        });

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(result).toEqual({ data: mockJsonData });
        expect((global as any).fetch).toHaveBeenCalledWith(mockProxyDetails.hostUrl, expect.any(Object));
      });

      it("should handle empty JSON response", async () => {
        (global as any).fetch = jest.fn().mockResolvedValue({
          status: 200,
          text: jest.fn().mockResolvedValue(JSON.stringify(null)),
        });

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        // responseContent null is falsy, so implementation returns {} without setting data
        expect(result).toEqual({});
      });
    });

    describe("error handling", () => {
      it("should handle errors and return error details in response data", async () => {
        const error = new Error("Test error");
        error.stack = "Error stack trace";
        (global as any).fetch = jest.fn().mockRejectedValueOnce(error);

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(result.data).toBeDefined();
        expect(result.data.message).toBe("Test error");
        expect(result.data.stack).toBe("Error stack trace");
        expect(mockedProxySwitchHelper.ExecuteCounter).not.toHaveBeenCalled();
      });

      it("should log error information when exception occurs", async () => {
        (global as any).fetch = jest.fn().mockRejectedValueOnce(new Error("Test error"));

        await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("BRIGHTDATA - Fetch Response Exception"));
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(mockUrl));
      });
    });

    describe("differences from fetchData", () => {
      it("should return error details in response instead of calling ExecuteCounter", async () => {
        (global as any).fetch = jest.fn().mockRejectedValueOnce(new Error("Debug error"));

        const result = await fetchDataForDebug(mockUrl, mockProxyDetails);

        expect(result.data).toBeDefined();
        expect(result.data.message).toBe("Debug error");
        expect(mockedProxySwitchHelper.ExecuteCounter).not.toHaveBeenCalled();
      });
    });
  });

  describe("parseHrtimeToSeconds (indirect testing)", () => {
    it("should format timing correctly in fetchData", async () => {
      await fetchData(mockUrl, mockProxyDetails);

      const logCall = (logger.info as jest.Mock).mock.calls.find((call) => call[0] && String(call[0]).includes("TimeTaken"));
      expect(logCall).toBeDefined();
      if (logCall) {
        const timeMatch = String(logCall[0]).match(/TimeTaken\s*:\s*([\d.]+)/);
        expect(timeMatch).toBeTruthy();
        if (timeMatch) {
          const timeValue = parseFloat(timeMatch[1]);
          expect(timeValue).toBeGreaterThanOrEqual(0);
          expect(timeValue).toBeLessThan(100);
        }
      }
    });

    it("should format timing correctly in fetchDataForDebug", async () => {
      await fetchDataForDebug(mockUrl, mockProxyDetails);

      const logCall = (logger.info as jest.Mock).mock.calls.find((call) => call[0] && String(call[0]).includes("TimeTaken"));
      expect(logCall).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should call fetch with proxy hostUrl and Authorization header", async () => {
      const specialProxyDetails = {
        userName: "user@name",
        password: "pass:word",
        hostUrl: "https://api.special.com",
        port: "9222",
        proxyProvider: "1",
      };

      await fetchData(mockUrl, specialProxyDetails);

      expect((global as any).fetch).toHaveBeenCalledWith(
        specialProxyDetails.hostUrl,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer user@name" }),
        })
      );
    });

    it("should handle very long URLs", async () => {
      const longUrl = "https://example.com/" + "a".repeat(1000);

      await fetchData(longUrl, mockProxyDetails);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(longUrl));
    });

    it("should handle numeric proxyProvider as string", async () => {
      (global as any).fetch = jest.fn().mockRejectedValueOnce(new Error("Test error"));

      await fetchData(mockUrl, { ...mockProxyDetails, proxyProvider: "123" });

      expect(mockedProxySwitchHelper.ExecuteCounter).toHaveBeenCalledWith(123);
    });

    it("should handle multiple sequential calls", async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce({
          status: 200,
          text: jest.fn().mockResolvedValue(JSON.stringify({ data: "first" })),
        })
        .mockResolvedValueOnce({
          status: 200,
          text: jest.fn().mockResolvedValue(JSON.stringify({ data: "second" })),
        });

      const result1 = await fetchData(mockUrl, mockProxyDetails);
      const result2 = await fetchData(mockUrl, mockProxyDetails);

      expect(result1).toEqual({ data: { data: "first" } });
      expect(result2).toEqual({ data: { data: "second" } });
      expect((global as any).fetch).toHaveBeenCalledTimes(2);
    });
  });
});
