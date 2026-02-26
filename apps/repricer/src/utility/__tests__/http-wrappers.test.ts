import * as httpWrappers from "../http-wrappers";

const mockAxios = jest.fn();
jest.mock("axios", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockAxios(...args),
}));

const mockApplicationConfig = {
  NET32_UPDATE_PRICE_URL: "https://api.net32.com/products/offers/update",
  REPRICER_API_BASE_URL: "http://localhost:3000",
  CRON_RUN_ALL_ENDPOINT: "/schedule/StartCronV3",
  FEED_REPRICER_ENDPOINT: "/feed/RepriceProduct/",
  REPRICE_OWN_ENDPOINT: "/search/RepriceProduct/",
  CRON_START_ENDPOINT: "/schedule/StartCron",
  CRON_STOP_ENDPOINT: "/schedule/StopCron",
  RECREATE_CRON_ENDPOINT: "/schedule/RecreateCron",
  MANUAL_PROD_UPDATE_ENDPOINT: "/product/updateManualProd/",
  STOP_ALL_CRON_ENDPOINT: "/schedule/StopAll",
  START_OVERRIDE_URL_ENDPOINT: "/schedule/startOverride",
  FILTER_CRON_TOGGLE_STATUS_ENDPOINT: "/filter/toggleCronStatus",
  FILTER_CRON_RECREATE_ENDPOINT: "/filter/RecreateFilterCron",
  SLOW_CRON_TOGGLE_STATUS_ENDPOINT: "/slow_cron/toggleCronStatus",
  SLOW_CRON_RECREATE_ENDPOINT: "/slow_cron/RecreateSlowCron",
  SCRAPE_CRON_TOGGLE_STATUS_ENDPOINT: "/scrape/toggleCronStatus",
  SCRAPE_CRON_RECREATE_ENDPOINT: "/scrape/RecreateScrapeCron",
  MINI_ERP_CRON_RECREATE_ENDPOINT: "/mini_erp/recreate",
  MINI_ERP_CRON_TOGGLE_STATUS_ENDPOINT: "/mini_erp/toggleCronStatus",
};

jest.mock("../config", () => ({
  applicationConfig: {
    NET32_UPDATE_PRICE_URL: "https://api.net32.com/products/offers/update",
    REPRICER_API_BASE_URL: "http://localhost:3000",
    CRON_RUN_ALL_ENDPOINT: "/schedule/StartCronV3",
    FEED_REPRICER_ENDPOINT: "/feed/RepriceProduct/",
    REPRICE_OWN_ENDPOINT: "/search/RepriceProduct/",
    CRON_START_ENDPOINT: "/schedule/StartCron",
    CRON_STOP_ENDPOINT: "/schedule/StopCron",
    RECREATE_CRON_ENDPOINT: "/schedule/RecreateCron",
    MANUAL_PROD_UPDATE_ENDPOINT: "/product/updateManualProd/",
    STOP_ALL_CRON_ENDPOINT: "/schedule/StopAll",
    START_OVERRIDE_URL_ENDPOINT: "/schedule/startOverride",
    FILTER_CRON_TOGGLE_STATUS_ENDPOINT: "/filter/toggleCronStatus",
    FILTER_CRON_RECREATE_ENDPOINT: "/filter/RecreateFilterCron",
    SLOW_CRON_TOGGLE_STATUS_ENDPOINT: "/slow_cron/toggleCronStatus",
    SLOW_CRON_RECREATE_ENDPOINT: "/slow_cron/RecreateSlowCron",
    SCRAPE_CRON_TOGGLE_STATUS_ENDPOINT: "/scrape/toggleCronStatus",
    SCRAPE_CRON_RECREATE_ENDPOINT: "/scrape/RecreateScrapeCron",
    MINI_ERP_CRON_RECREATE_ENDPOINT: "/mini_erp/recreate",
    MINI_ERP_CRON_TOGGLE_STATUS_ENDPOINT: "/mini_erp/toggleCronStatus",
  },
}));

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36";

describe("http-wrappers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("updatePrice", () => {
    it("sends POST to NET32_UPDATE_PRICE_URL with secretKey and payload, returns response.data", async () => {
      const request = {
        secretKey: "sub-key-123",
        payload: { sku: "SKU1", price: 9.99 },
      };
      const mockData = { success: true };
      mockAxios.mockResolvedValueOnce({ data: mockData } as any);

      const result = await httpWrappers.updatePrice(request);

      expect(result).toBe(mockData);
      expect(mockAxios).toHaveBeenCalledTimes(1);
      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.NET32_UPDATE_PRICE_URL,
        headers: {
          "Subscription-Key": request.secretKey,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        data: JSON.stringify(request.payload),
      });
    });

    it("propagates axios errors", async () => {
      const request = { secretKey: "key", payload: {} };
      const err = new Error("Network error");
      mockAxios.mockRejectedValueOnce(err);

      await expect(httpWrappers.updatePrice(request)).rejects.toThrow("Network error");
    });
  });

  describe("runCron", () => {
    it("sends GET to CRON_RUN_ALL_ENDPOINT and returns axios response", async () => {
      const mockResponse = { data: {}, status: 200 };
      mockAxios.mockResolvedValueOnce(mockResponse as any);

      const result = await httpWrappers.runCron();

      expect(result).toBe(mockResponse);
      expect(mockAxios).toHaveBeenCalledWith({
        method: "get",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.CRON_RUN_ALL_ENDPOINT,
      });
    });

    it("propagates axios errors", async () => {
      mockAxios.mockRejectedValueOnce(new Error("Cron failed"));

      await expect(httpWrappers.runCron()).rejects.toThrow("Cron failed");
    });
  });

  describe("runManualCron", () => {
    it("uses FEED_REPRICER_ENDPOINT when source is FEED", async () => {
      const mpId = "mp-123";
      const itemDetails = { itemId: "i1" };
      const source = "FEED";
      mockAxios.mockResolvedValueOnce({ data: { ok: true } } as any);

      await httpWrappers.runManualCron(mpId, itemDetails, source);

      const expectedUrl = mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.FEED_REPRICER_ENDPOINT + mpId;
      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: expectedUrl,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(itemDetails),
      });
    });

    it("uses REPRICE_OWN_ENDPOINT when source is not FEED", async () => {
      const mpId = "mp-456";
      const itemDetails = { itemId: "i2" };
      const source = "OWN";
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.runManualCron(mpId, itemDetails, source);

      const expectedUrl = mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.REPRICE_OWN_ENDPOINT + mpId;
      expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({ url: expectedUrl }));
    });

    it("propagates axios errors", async () => {
      mockAxios.mockRejectedValueOnce(new Error("Manual cron failed"));

      await expect(httpWrappers.runManualCron("mp", {}, "FEED")).rejects.toThrow("Manual cron failed");
    });
  });

  describe("startCron", () => {
    it("sends POST to CRON_START_ENDPOINT with payload", async () => {
      const payload = { cronId: "c1" };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.startCron(payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.CRON_START_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("stopCron", () => {
    it("sends POST to CRON_STOP_ENDPOINT with payload", async () => {
      const payload = { cronId: "c1" };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.stopCron(payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.CRON_STOP_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("recreateCron", () => {
    it("sends POST to RECREATE_CRON_ENDPOINT and logs", async () => {
      const consoleSpy = jest.spyOn(console, "info").mockImplementation();
      const cronDetails = { name: "main" };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.recreateCron(cronDetails);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.RECREATE_CRON_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(cronDetails),
      });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Recreating cron at"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(mockApplicationConfig.REPRICER_API_BASE_URL));
      consoleSpy.mockRestore();
    });
  });

  describe("updateProductManual", () => {
    it("sends POST to MANUAL_PROD_UPDATE_ENDPOINT + mpId with payload", async () => {
      const mpId = "mp-99";
      const payload = { field: "value" };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.updateProductManual(mpId, payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.MANUAL_PROD_UPDATE_ENDPOINT + mpId,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("stopAllCron", () => {
    it("sends GET to STOP_ALL_CRON_ENDPOINT", async () => {
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.stopAllCron();

      expect(mockAxios).toHaveBeenCalledWith({
        method: "get",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.STOP_ALL_CRON_ENDPOINT,
      });
    });
  });

  describe("StartOverride", () => {
    it("sends GET to START_OVERRIDE_URL_ENDPOINT", async () => {
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.StartOverride();

      expect(mockAxios).toHaveBeenCalledWith({
        method: "get",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.START_OVERRIDE_URL_ENDPOINT,
      });
    });
  });

  describe("native_get", () => {
    it("sends GET to given URL", async () => {
      const url = "https://example.com/api";
      mockAxios.mockResolvedValueOnce({ data: { result: 1 } } as any);

      const result = await httpWrappers.native_get(url);

      expect(mockAxios).toHaveBeenCalledWith({ method: "get", url });
      expect(result).toEqual({ data: { result: 1 } });
    });
  });

  describe("toggleFilterCron", () => {
    it("sends POST to FILTER_CRON_TOGGLE_STATUS_ENDPOINT", async () => {
      const payload = { enabled: true };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.toggleFilterCron(payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.FILTER_CRON_TOGGLE_STATUS_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("toggleScrapeCron", () => {
    it("sends POST to SCRAPE_CRON_TOGGLE_STATUS_ENDPOINT", async () => {
      const payload = { enabled: false };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.toggleScrapeCron(payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.SCRAPE_CRON_TOGGLE_STATUS_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("toggleSlowCron", () => {
    it("sends POST to SLOW_CRON_TOGGLE_STATUS_ENDPOINT", async () => {
      const payload = { enabled: true };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.toggleSlowCron(payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.SLOW_CRON_TOGGLE_STATUS_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("recreateFilterCron", () => {
    it("sends POST to FILTER_CRON_RECREATE_ENDPOINT", async () => {
      const payload = { filterId: "f1" };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.recreateFilterCron(payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.FILTER_CRON_RECREATE_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("native_post", () => {
    it("sends POST to given URL with payload and standard headers", async () => {
      const url = "https://api.example.com/action";
      const payload = { key: "value" };
      mockAxios.mockResolvedValueOnce({ data: { id: 1 } } as any);

      await httpWrappers.native_post(url, payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("recreateSlowCron", () => {
    it("sends POST to SLOW_CRON_RECREATE_ENDPOINT", async () => {
      const payload = { slowCronId: "s1" };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.recreateSlowCron(payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.SLOW_CRON_RECREATE_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("recreateScrapeCron", () => {
    it("sends POST to SCRAPE_CRON_RECREATE_ENDPOINT", async () => {
      const payload = { scrapeCronId: "sc1" };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.recreateScrapeCron(payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.SCRAPE_CRON_RECREATE_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("native_get_V2", () => {
    it("sends GET to given URL with custom headers", async () => {
      const url = "https://api.example.com/v2/resource";
      const headers = { Authorization: "Bearer token", "X-Custom": "value" };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.native_get_V2(url, headers);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "get",
        url,
        headers,
      });
    });
  });

  describe("recreateMiniErpCron", () => {
    it("sends POST to MINI_ERP_CRON_RECREATE_ENDPOINT", async () => {
      const payload = { miniErpId: "e1" };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.recreateMiniErpCron(payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.MINI_ERP_CRON_RECREATE_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });

  describe("toggleMiniErpCron", () => {
    it("sends POST to MINI_ERP_CRON_TOGGLE_STATUS_ENDPOINT", async () => {
      const payload = { enabled: true };
      mockAxios.mockResolvedValueOnce({ data: {} } as any);

      await httpWrappers.toggleMiniErpCron(payload);

      expect(mockAxios).toHaveBeenCalledWith({
        method: "post",
        url: mockApplicationConfig.REPRICER_API_BASE_URL + mockApplicationConfig.MINI_ERP_CRON_TOGGLE_STATUS_ENDPOINT,
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        data: JSON.stringify(payload),
      });
    });
  });
});
