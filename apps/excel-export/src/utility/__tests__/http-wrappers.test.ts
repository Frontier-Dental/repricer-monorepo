const axiosMock = jest.fn();

jest.mock("axios", () => ({
  __esModule: true,
  default: axiosMock,
}));

const BASE = "https://repricer-api.test";
const mockConfig = {
  NET32_UPDATE_PRICE_URL: "https://api.net32.example.com/products/offers/update",
  REPRICER_API_BASE_URL: BASE,
  CRON_RUN_ALL_ENDPOINT: "/schedule/StartCronV3",
  CRON_START_ENDPOINT: "/schedule/StartCron",
  CRON_STOP_ENDPOINT: "/schedule/StopCron",
  RECREATE_CRON_ENDPOINT: "/schedule/RecreateCron",
  MANUAL_PROD_UPDATE_ENDPOINT: "/product/updateManualProd/",
  STOP_ALL_CRON_ENDPOINT: "/1/schedule/StopAll",
  START_OVERRIDE_URL_ENDPOINT: "/schedule/startOverride",
  FEED_REPRICER_ENDPOINT: "/feed/RepriceProduct/",
  REPRICE_OWN_ENDPOINT: "/search/RepriceProduct/",
  FILTER_CRON_TOGGLE_STATUS_ENDPOINT: "/filter/toggleCronStatus",
  SCRAPE_CRON_TOGGLE_STATUS_ENDPOINT: "/scrape/toggleCronStatus",
  SLOW_CRON_TOGGLE_STATUS_ENDPOINT: "/slow_cron/toggleCronStatus",
  FILTER_CRON_RECREATE_ENDPOINT: "/filter/RecreateFilterCron",
  SLOW_CRON_RECREATE_ENDPOINT: "/slow_cron/RecreateSlowCron",
  SCRAPE_CRON_RECREATE_ENDPOINT: "/scrape/RecreateScrapeCron",
};

jest.mock("../config", () => ({
  applicationConfig: mockConfig,
}));

import * as http from "../http-wrappers";

const defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36";

const postHeaders = {
  "Content-Type": "application/json",
  "User-Agent": defaultUserAgent,
};

describe("http-wrappers", () => {
  beforeEach(() => {
    axiosMock.mockResolvedValue({ data: {}, status: 200 });
  });

  describe("updatePrice", () => {
    it("POSTs to NET32_UPDATE_PRICE_URL with secretKey and payload", async () => {
      const request = {
        secretKey: "sub-key-123",
        payload: { productId: 1, price: 9.99 },
      };
      const out = await http.updatePrice(request);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: mockConfig.NET32_UPDATE_PRICE_URL,
        headers: {
          "Subscription-Key": "sub-key-123",
          "Content-Type": "application/json",
          "User-Agent": defaultUserAgent,
        },
        data: JSON.stringify(request.payload),
      });
      expect(out).toEqual({});
    });

    it("returns response.data", async () => {
      axiosMock.mockResolvedValue({ data: { success: true } });
      const result = await http.updatePrice({
        secretKey: "k",
        payload: {},
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("runCron", () => {
    it("GETs CRON_RUN_ALL_ENDPOINT", async () => {
      await http.runCron();
      expect(axiosMock).toHaveBeenCalledWith({
        method: "get",
        url: BASE + mockConfig.CRON_RUN_ALL_ENDPOINT,
      });
    });
  });

  describe("runManualCron", () => {
    it("POSTs to FEED url when source is FEED", async () => {
      await http.runManualCron("mp99", { item: 1 }, "FEED");
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.FEED_REPRICER_ENDPOINT + "mp99",
        headers: postHeaders,
        data: JSON.stringify({ item: 1 }),
      });
    });

    it("POSTs to REPRICE_OWN url when source is not FEED", async () => {
      await http.runManualCron("mp42", { x: 2 }, "OTHER");
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.REPRICE_OWN_ENDPOINT + "mp42",
        headers: postHeaders,
        data: JSON.stringify({ x: 2 }),
      });
    });
  });

  describe("startCron", () => {
    it("POSTs to CRON_START_ENDPOINT with payload", async () => {
      const payload = { cronId: "c1" };
      await http.startCron(payload);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.CRON_START_ENDPOINT,
        headers: postHeaders,
        data: JSON.stringify(payload),
      });
    });
  });

  describe("stopCron", () => {
    it("POSTs to CRON_STOP_ENDPOINT with payload", async () => {
      const payload = { cronId: "c2" };
      await http.stopCron(payload);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.CRON_STOP_ENDPOINT,
        headers: postHeaders,
        data: JSON.stringify(payload),
      });
    });
  });

  describe("recreateCron", () => {
    it("POSTs to RECREATE_CRON_ENDPOINT with cronDetails", async () => {
      const cronDetails = { name: "cron", id: "id1" };
      await http.recreateCron(cronDetails);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.RECREATE_CRON_ENDPOINT,
        headers: postHeaders,
        data: JSON.stringify(cronDetails),
      });
    });
  });

  describe("updateProductManual", () => {
    it("POSTs to MANUAL_PROD_UPDATE_ENDPOINT + mpId with payload", async () => {
      await http.updateProductManual("123", { price: 10 });
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.MANUAL_PROD_UPDATE_ENDPOINT + "123",
        headers: postHeaders,
        data: JSON.stringify({ price: 10 }),
      });
    });
  });

  describe("stopAllCron", () => {
    it("GETs STOP_ALL_CRON_ENDPOINT", async () => {
      await http.stopAllCron();
      expect(axiosMock).toHaveBeenCalledWith({
        method: "get",
        url: BASE + mockConfig.STOP_ALL_CRON_ENDPOINT,
      });
    });
  });

  describe("StartOverride", () => {
    it("GETs START_OVERRIDE_URL_ENDPOINT", async () => {
      await http.StartOverride();
      expect(axiosMock).toHaveBeenCalledWith({
        method: "get",
        url: BASE + mockConfig.START_OVERRIDE_URL_ENDPOINT,
      });
    });
  });

  describe("native_get", () => {
    it("GETs given url with no extra headers", async () => {
      await http.native_get("https://example.com/api");
      expect(axiosMock).toHaveBeenCalledWith({
        method: "get",
        url: "https://example.com/api",
      });
    });
  });

  describe("toggleFilterCron", () => {
    it("POSTs to FILTER_CRON_TOGGLE_STATUS_ENDPOINT", async () => {
      const payload = { enabled: true };
      await http.toggleFilterCron(payload);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.FILTER_CRON_TOGGLE_STATUS_ENDPOINT,
        headers: postHeaders,
        data: JSON.stringify(payload),
      });
    });
  });

  describe("toggleScrapeCron", () => {
    it("POSTs to SCRAPE_CRON_TOGGLE_STATUS_ENDPOINT", async () => {
      const payload = { toggle: 1 };
      await http.toggleScrapeCron(payload);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.SCRAPE_CRON_TOGGLE_STATUS_ENDPOINT,
        headers: postHeaders,
        data: JSON.stringify(payload),
      });
    });
  });

  describe("toggleSlowCron", () => {
    it("POSTs to SLOW_CRON_TOGGLE_STATUS_ENDPOINT", async () => {
      const payload = { slow: true };
      await http.toggleSlowCron(payload);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.SLOW_CRON_TOGGLE_STATUS_ENDPOINT,
        headers: postHeaders,
        data: JSON.stringify(payload),
      });
    });
  });

  describe("recreateFilterCron", () => {
    it("POSTs to FILTER_CRON_RECREATE_ENDPOINT", async () => {
      const payload = { filterId: "f1" };
      await http.recreateFilterCron(payload);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.FILTER_CRON_RECREATE_ENDPOINT,
        headers: postHeaders,
        data: JSON.stringify(payload),
      });
    });
  });

  describe("native_post", () => {
    it("POSTs to given url with JSON payload and standard headers", async () => {
      await http.native_post("https://other.com/action", { body: 1 });
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: "https://other.com/action",
        headers: postHeaders,
        data: JSON.stringify({ body: 1 }),
      });
    });
  });

  describe("recreateSlowCron", () => {
    it("POSTs to SLOW_CRON_RECREATE_ENDPOINT", async () => {
      const payload = { cronName: "slow" };
      await http.recreateSlowCron(payload);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.SLOW_CRON_RECREATE_ENDPOINT,
        headers: postHeaders,
        data: JSON.stringify(payload),
      });
    });
  });

  describe("recreateScrapeCron", () => {
    it("POSTs to SCRAPE_CRON_RECREATE_ENDPOINT", async () => {
      const payload = { scrapeId: "s1" };
      await http.recreateScrapeCron(payload);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "post",
        url: BASE + mockConfig.SCRAPE_CRON_RECREATE_ENDPOINT,
        headers: postHeaders,
        data: JSON.stringify(payload),
      });
    });
  });

  describe("native_get_V2", () => {
    it("GETs given url with given headers", async () => {
      const url = "https://api.v2.example/data";
      const headers = { Authorization: "Bearer token" };
      await http.native_get_V2(url, headers);
      expect(axiosMock).toHaveBeenCalledWith({
        method: "get",
        url,
        headers,
      });
    });
  });

  describe("error propagation", () => {
    it("updatePrice propagates axios errors", async () => {
      axiosMock.mockRejectedValue(new Error("Network error"));
      await expect(http.updatePrice({ secretKey: "k", payload: {} })).rejects.toThrow("Network error");
    });

    it("runManualCron propagates axios errors", async () => {
      axiosMock.mockRejectedValue(new Error("Timeout"));
      await expect(http.runManualCron("1", {}, "FEED")).rejects.toThrow("Timeout");
    });
  });
});
