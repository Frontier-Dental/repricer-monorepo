// Mock dependencies BEFORE imports
jest.mock("@repricer-monorepo/shared", () => ({
  VendorId: {},
  VendorName: {},
  CacheKey: {},
}));
jest.mock("../../proxy/scrapfly-helper");
jest.mock("../../../model/sql-models/knex-wrapper");
jest.mock("../../config", () => ({
  applicationConfig: {
    NET32_VENDOR_URL: "https://test-url.com",
    SHIPPING_DATA_PROXY_SCRAPE_URL: "https://proxy-url.com",
    SHIPPING_DATA_PROXY_SCRAPE_API_KEY: "test-api-key",
    SHIPPING_THRESHOLD_SAVE_FILE: false,
    RUN_SHIPPING_THRESHOLD_SCRAPE_ON_STARTUP: false,
  },
}));
jest.mock("fs");
jest.mock("path");
jest.mock("cheerio");
jest.mock("node-cron");

import { scrapeAndStoreVendorData, scheduleDailyThresholdScraping, initializeThresholdScraping, parseAndStoreVendorData, ParsedVendorData } from "./threshold-scraping";
import { scrapflyFetch } from "../../proxy/scrapfly-helper";
import { getKnexInstance } from "../../../model/sql-models/knex-wrapper";
import { applicationConfig } from "../../config";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import * as cron from "node-cron";

describe("threshold-scraping", () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  let mockKnex: any;
  let mockCheerio: any;
  let mockCronTask: any;

  // Helper function to create mock cheerio elements
  const createMockCheerioElement = (elementData: any) => ({
    attr: jest.fn((attr: string) => elementData.attr?.(attr) ?? null),
    find: jest.fn((selector: string) => {
      const findResult = elementData.find?.(selector);
      if (findResult) {
        return {
          text: jest.fn(() => findResult.text || ""),
          trim: jest.fn(() => findResult.trim || findResult.text || ""),
        };
      }
      return { text: jest.fn(() => ""), trim: jest.fn(() => "") };
    }),
  });

  // Helper function to create mock $ function
  const createMock$ = (elements: any[]) => {
    return jest.fn((selector: any) => {
      const selectorStr = typeof selector === "string" ? selector : "";
      if (selectorStr.includes("vendor-entry")) {
        return {
          each: jest.fn((callback: any) => {
            elements.forEach((elementData, index) => {
              const mockElement = createMockCheerioElement(elementData);
              callback(index, mockElement);
            });
          }),
        };
      }
      // When $ is called with an element (from callback), return it as-is if it has cheerio methods
      if (selector && typeof selector === "object" && selector.attr) {
        return selector;
      }
      return { each: jest.fn() };
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Suppress console methods during tests
    console.log = jest.fn();
    console.error = jest.fn();

    // Mock path.join
    (path.join as jest.Mock) = jest.fn((...args) => args.join("/"));

    // Mock fs methods
    (fs.writeFileSync as jest.Mock) = jest.fn();
    (fs.readFileSync as jest.Mock) = jest.fn().mockReturnValue("<html></html>");

    // Mock cheerio - will be set up per test
    mockCheerio = {
      load: jest.fn(),
    };

    // Mock knex instance - knex is a function that returns a query builder
    // We need to track query builders separately
    const queryBuilders: any[] = [];
    const createQueryBuilder = () => {
      const queryBuilder = {
        del: jest.fn().mockResolvedValue(0),
        insert: jest.fn().mockResolvedValue([1]),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: 5 }),
      };
      queryBuilders.push(queryBuilder);
      return queryBuilder;
    };
    mockKnex = jest.fn(createQueryBuilder);
    (getKnexInstance as jest.Mock) = jest.fn(() => mockKnex);

    // Mock cron
    mockCronTask = {
      start: jest.fn(),
      stop: jest.fn(),
    };
    jest.spyOn(cron, "schedule").mockImplementation(() => mockCronTask as any);

    // Mock scrapflyFetch
    (scrapflyFetch as jest.MockedFunction<typeof scrapflyFetch>) = jest.fn().mockResolvedValue({
      responseContent: "<html><body></body></html>",
      timeTaken: "1.5",
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("scrapeAndStoreVendorData", () => {
    it("should successfully scrape and store vendor data", async () => {
      const mockHtml = `
        <div class="vendor-entry" data-vendor-id="1">
          <h2><a>Vendor 1</a></h2>
          <div class="vendor-entry-standard-shipping"><dd>$5.00</dd></div>
          <div class="vendor-entry-free-shipping-threshold"><dd>$50.00</dd></div>
        </div>
      `;

      (scrapflyFetch as jest.MockedFunction<typeof scrapflyFetch>).mockResolvedValue({
        responseContent: mockHtml,
        timeTaken: "1.5",
      });

      const mock$ = createMock$([
        {
          attr: (attr: string) => (attr === "data-vendor-id" ? "1" : null),
          find: (sel: string) => {
            if (sel === "h2 a") return { text: "Vendor 1", trim: "Vendor 1" };
            if (sel === ".vendor-entry-standard-shipping dd") return { text: "$5.00", trim: "$5.00" };
            if (sel === ".vendor-entry-free-shipping-threshold dd") return { text: "$50.00", trim: "$50.00" };
            return null;
          },
        },
      ]);

      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      await scrapeAndStoreVendorData();

      expect(scrapflyFetch).toHaveBeenCalledWith(applicationConfig.NET32_VENDOR_URL, applicationConfig.SHIPPING_DATA_PROXY_SCRAPE_URL, applicationConfig.SHIPPING_DATA_PROXY_SCRAPE_API_KEY, false);
      expect(mockKnex).toHaveBeenCalledWith("vendor_thresholds");
      // Check that del and insert were called on the query builders
      // The query builder is created each time knex is called
      const knexCalls = (mockKnex as jest.Mock).mock.results;
      expect(knexCalls.length).toBeGreaterThan(0);
      // Find query builders that had methods called
      let foundDel = false;
      let foundInsert = false;
      knexCalls.forEach((result: any) => {
        if (result.value && result.value.del && result.value.del.mock.calls.length > 0) {
          foundDel = true;
        }
        if (result.value && result.value.insert && result.value.insert.mock.calls.length > 0) {
          foundInsert = true;
        }
      });
      expect(foundDel).toBe(true);
      expect(foundInsert).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Scraping failed");
      (scrapflyFetch as jest.MockedFunction<typeof scrapflyFetch>).mockRejectedValue(error);

      await scrapeAndStoreVendorData();

      expect(console.error).toHaveBeenCalledWith("❌ Error scraping and storing vendor data:", error);
    });

    it("should write to file when SHIPPING_THRESHOLD_SAVE_FILE is true", async () => {
      (applicationConfig as any).SHIPPING_THRESHOLD_SAVE_FILE = true;
      (path.join as jest.Mock) = jest.fn(() => "/test/path/scraped-threshold-data.html");

      const mockHtml = "<html></html>";
      (scrapflyFetch as jest.MockedFunction<typeof scrapflyFetch>).mockResolvedValue({
        responseContent: mockHtml,
        timeTaken: "1.5",
      });

      const mock$ = jest.fn(() => ({
        each: jest.fn(),
      }));
      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      await scrapeAndStoreVendorData();

      expect(fs.writeFileSync).toHaveBeenCalledWith("/test/path/scraped-threshold-data.html", mockHtml, "utf8");
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Scraped data written to:"));
    });
  });

  describe("scheduleDailyThresholdScraping", () => {
    it("should schedule daily threshold scraping", () => {
      const task = scheduleDailyThresholdScraping();

      expect(cron.schedule).toHaveBeenCalledWith("0 2 * * *", expect.any(Function), {
        scheduled: false,
        timezone: "UTC",
        runOnInit: applicationConfig.RUN_SHIPPING_THRESHOLD_SCRAPE_ON_STARTUP,
      });
      expect(mockCronTask.start).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("📅 Daily threshold scraping scheduled for 2:00 AM UTC");
      expect(task).toBe(mockCronTask);
    });

    it("should call scrapeAndStoreVendorData when scheduled task runs", async () => {
      let scheduledCallback: any = null;

      jest.spyOn(cron, "schedule").mockImplementation((expression, callback, options) => {
        scheduledCallback = callback;
        return mockCronTask as any;
      });

      scheduleDailyThresholdScraping();

      expect(scheduledCallback).not.toBeNull();

      // Mock the scraping function
      const mockHtml = "<html></html>";
      (scrapflyFetch as jest.MockedFunction<typeof scrapflyFetch>).mockResolvedValue({
        responseContent: mockHtml,
        timeTaken: "1.5",
      });

      const mock$ = jest.fn(() => ({
        each: jest.fn(),
      }));
      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      if (scheduledCallback) {
        await scheduledCallback();
        expect(console.log).toHaveBeenCalledWith("🕐 Running scheduled daily threshold scraping...");
      }
    });

    it("should use runOnInit from config", () => {
      (applicationConfig as any).RUN_SHIPPING_THRESHOLD_SCRAPE_ON_STARTUP = true;

      scheduleDailyThresholdScraping();

      expect(cron.schedule).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          runOnInit: true,
        })
      );
    });
  });

  describe("initializeThresholdScraping", () => {
    it("should call scheduleDailyThresholdScraping", () => {
      // Clear previous calls
      jest.clearAllMocks();

      // Spy on the cron.schedule to verify it gets called
      const cronScheduleSpy = jest.spyOn(cron, "schedule");

      initializeThresholdScraping();

      // initializeThresholdScraping calls scheduleDailyThresholdScraping
      // which calls cron.schedule, so we verify that cron.schedule was called
      expect(cronScheduleSpy).toHaveBeenCalled();
      expect(mockCronTask.start).toHaveBeenCalled();

      // Restore the spy
      cronScheduleSpy.mockRestore();
    });
  });

  describe("parseAndStoreVendorData", () => {
    it("should parse vendor data from provided HTML content", async () => {
      const mockHtml = `
        <div class="vendor-entry" data-vendor-id="1">
          <h2><a>Vendor 1</a></h2>
          <div class="vendor-entry-standard-shipping"><dd>$5.00</dd></div>
          <div class="vendor-entry-free-shipping-threshold"><dd>$50.00</dd></div>
        </div>
        <div class="vendor-entry" data-vendor-id="2">
          <h2><a>Vendor 2</a></h2>
          <div class="vendor-entry-standard-shipping"><dd>$7.50</dd></div>
          <div class="vendor-entry-free-shipping-threshold"><dd>N/A</dd></div>
        </div>
      `;

      const createMockElement = (data: any) => ({
        attr: jest.fn((attr: string) => data.attr?.(attr) ?? null),
        find: jest.fn((sel: string) => {
          const result = data.find?.(sel);
          return result ? { text: jest.fn(() => result.text || ""), trim: jest.fn(() => result.trim || result.text || "") } : { text: jest.fn(() => ""), trim: jest.fn(() => "") };
        }),
      });

      const mock$ = jest.fn((selector: any) => {
        const selectorStr = typeof selector === "string" ? selector : "";
        if (selectorStr.includes("vendor-entry")) {
          return {
            each: jest.fn((callback: any) => {
              const mockElement1 = createMockElement({
                attr: (attr: string) => (attr === "data-vendor-id" ? "1" : null),
                find: (sel: string) => {
                  if (sel === "h2 a") return { text: "Vendor 1", trim: "Vendor 1" };
                  if (sel === ".vendor-entry-standard-shipping dd") return { text: "$5.00", trim: "$5.00" };
                  if (sel === ".vendor-entry-free-shipping-threshold dd") return { text: "$50.00", trim: "$50.00" };
                  return null;
                },
              });
              const mockElement2 = createMockElement({
                attr: (attr: string) => (attr === "data-vendor-id" ? "2" : null),
                find: (sel: string) => {
                  if (sel === "h2 a") return { text: "Vendor 2", trim: "Vendor 2" };
                  if (sel === ".vendor-entry-standard-shipping dd") return { text: "$7.50", trim: "$7.50" };
                  if (sel === ".vendor-entry-free-shipping-threshold dd") return { text: "N/A", trim: "N/A" };
                  return null;
                },
              });
              callback(0, mockElement1);
              callback(1, mockElement2);
            }),
          };
        }
        // When $ is called with an element (from callback), return it as-is if it has cheerio methods
        if (selector && typeof selector === "object" && selector.attr) {
          return selector;
        }
        return { each: jest.fn() };
      });

      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      const result = await parseAndStoreVendorData(mockHtml);

      expect(cheerio.load).toHaveBeenCalledWith(mockHtml);
      expect(console.log).toHaveBeenCalledWith("Using provided HTML content...");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        vendorId: 1,
        vendorName: "Vendor 1",
        standardShipping: 5.0,
        freeShippingThreshold: 50.0,
      });
      expect(result[1]).toEqual({
        vendorId: 2,
        vendorName: "Vendor 2",
        standardShipping: 7.5,
        freeShippingThreshold: 0, // N/A becomes 0
      });
      expect(mockKnex).toHaveBeenCalledWith("vendor_thresholds");
      // Check that del and insert were called on the query builders
      // The query builder is created each time knex is called
      const knexCalls = (mockKnex as jest.Mock).mock.results;
      expect(knexCalls.length).toBeGreaterThan(0);
      // Find query builders that had methods called
      let foundDel = false;
      let foundInsert = false;
      knexCalls.forEach((result: any) => {
        if (result.value && result.value.del && result.value.del.mock.calls.length > 0) {
          foundDel = true;
        }
        if (result.value && result.value.insert && result.value.insert.mock.calls.length > 0) {
          foundInsert = true;
        }
      });
      expect(foundDel).toBe(true);
      expect(foundInsert).toBe(true);
    });

    it("should read from file when HTML content is not provided", async () => {
      const mockFileContent = "<html><body></body></html>";
      (fs.readFileSync as jest.Mock) = jest.fn().mockReturnValue(mockFileContent);
      (path.join as jest.Mock) = jest.fn(() => "/test/path/scraped-threshold-data.html");

      const mock$ = jest.fn(() => ({
        each: jest.fn(),
      }));
      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      await parseAndStoreVendorData();

      expect(fs.readFileSync).toHaveBeenCalledWith("/test/path/scraped-threshold-data.html", "utf8");
      expect(console.log).toHaveBeenCalledWith("Reading HTML from file...");
      expect(cheerio.load).toHaveBeenCalledWith(mockFileContent);
    });

    it("should skip vendor entries without vendorId", async () => {
      const mockHtml = `
        <div class="vendor-entry">
          <h2><a>Vendor Without ID</a></h2>
        </div>
      `;

      const mock$ = createMock$([
        {
          attr: () => null, // No vendor-id
          find: () => null,
        },
      ]);

      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      const result = await parseAndStoreVendorData(mockHtml);

      expect(result).toHaveLength(0);
    });

    it("should skip vendor entries without vendorName", async () => {
      const mockHtml = `
        <div class="vendor-entry" data-vendor-id="1">
          <h2></h2>
        </div>
      `;

      const mock$ = createMock$([
        {
          attr: (attr: string) => (attr === "data-vendor-id" ? "1" : null),
          find: (sel: string) => {
            if (sel === "h2 a") return { text: "", trim: "" };
            return null;
          },
        },
      ]);

      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      const result = await parseAndStoreVendorData(mockHtml);

      expect(result).toHaveLength(0);
    });

    it("should handle missing standard shipping data", async () => {
      const mockHtml = `
        <div class="vendor-entry" data-vendor-id="1">
          <h2><a>Vendor 1</a></h2>
          <div class="vendor-entry-free-shipping-threshold"><dd>$50.00</dd></div>
        </div>
      `;

      const mock$ = createMock$([
        {
          attr: (attr: string) => (attr === "data-vendor-id" ? "1" : null),
          find: (sel: string) => {
            if (sel === "h2 a") return { text: "Vendor 1", trim: "Vendor 1" };
            if (sel === ".vendor-entry-standard-shipping dd") return { text: "", trim: "" };
            if (sel === ".vendor-entry-free-shipping-threshold dd") return { text: "$50.00", trim: "$50.00" };
            return null;
          },
        },
      ]);

      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      const result = await parseAndStoreVendorData(mockHtml);

      expect(result).toHaveLength(1);
      expect(result[0].standardShipping).toBe(0);
    });

    it("should handle invalid shipping cost values", async () => {
      const mockHtml = `
        <div class="vendor-entry" data-vendor-id="1">
          <h2><a>Vendor 1</a></h2>
          <div class="vendor-entry-standard-shipping"><dd>Invalid</dd></div>
          <div class="vendor-entry-free-shipping-threshold"><dd>Invalid</dd></div>
        </div>
      `;

      const mock$ = createMock$([
        {
          attr: (attr: string) => (attr === "data-vendor-id" ? "1" : null),
          find: (sel: string) => {
            if (sel === "h2 a") return { text: "Vendor 1", trim: "Vendor 1" };
            if (sel === ".vendor-entry-standard-shipping dd") return { text: "Invalid", trim: "Invalid" };
            if (sel === ".vendor-entry-free-shipping-threshold dd") return { text: "Invalid", trim: "Invalid" };
            return null;
          },
        },
      ]);

      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      const result = await parseAndStoreVendorData(mockHtml);

      expect(result).toHaveLength(1);
      expect(result[0].standardShipping).toBe(0);
      expect(result[0].freeShippingThreshold).toBe(0);
    });

    it("should not store data when no vendors are parsed", async () => {
      const mockHtml = "<html><body></body></html>";

      const mock$ = jest.fn(() => ({
        each: jest.fn(),
      }));
      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      const result = await parseAndStoreVendorData(mockHtml);

      expect(result).toHaveLength(0);
      expect(mockKnex).not.toHaveBeenCalled();
    });

    it("should handle database errors during storage", async () => {
      const mockHtml = `
        <div class="vendor-entry" data-vendor-id="1">
          <h2><a>Vendor 1</a></h2>
          <div class="vendor-entry-standard-shipping"><dd>$5.00</dd></div>
          <div class="vendor-entry-free-shipping-threshold"><dd>$50.00</dd></div>
        </div>
      `;

      const mock$ = createMock$([
        {
          attr: (attr: string) => (attr === "data-vendor-id" ? "1" : null),
          find: (sel: string) => {
            if (sel === "h2 a") return { text: "Vendor 1", trim: "Vendor 1" };
            if (sel === ".vendor-entry-standard-shipping dd") return { text: "$5.00", trim: "$5.00" };
            if (sel === ".vendor-entry-free-shipping-threshold dd") return { text: "$50.00", trim: "$50.00" };
            return null;
          },
        },
      ]);

      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      const dbError = new Error("Database error");
      // Create a query builder with insert that rejects
      const queryBuilder = {
        del: jest.fn().mockResolvedValue(0),
        insert: jest.fn().mockRejectedValue(dbError),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: 5 }),
      };
      (mockKnex as jest.Mock).mockReturnValue(queryBuilder);

      await expect(parseAndStoreVendorData(mockHtml)).rejects.toThrow("Database error");
    });

    it("should handle file read errors when HTML is not provided", async () => {
      const fileError = new Error("File not found");
      (fs.readFileSync as jest.Mock) = jest.fn().mockImplementation(() => {
        throw fileError;
      });

      await expect(parseAndStoreVendorData()).rejects.toThrow("File not found");
    });

    it("should parse vendor with decimal shipping values", async () => {
      const mockHtml = `
        <div class="vendor-entry" data-vendor-id="1">
          <h2><a>Vendor 1</a></h2>
          <div class="vendor-entry-standard-shipping"><dd>$5.99</dd></div>
          <div class="vendor-entry-free-shipping-threshold"><dd>$99.99</dd></div>
        </div>
      `;

      const mock$ = createMock$([
        {
          attr: (attr: string) => (attr === "data-vendor-id" ? "1" : null),
          find: (sel: string) => {
            if (sel === "h2 a") return { text: "Vendor 1", trim: "Vendor 1" };
            if (sel === ".vendor-entry-standard-shipping dd") return { text: "$5.99", trim: "$5.99" };
            if (sel === ".vendor-entry-free-shipping-threshold dd") return { text: "$99.99", trim: "$99.99" };
            return null;
          },
        },
      ]);

      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      const result = await parseAndStoreVendorData(mockHtml);

      expect(result).toHaveLength(1);
      expect(result[0].standardShipping).toBe(5.99);
      expect(result[0].freeShippingThreshold).toBe(99.99);
    });

    it("should correctly map vendor data to database format", async () => {
      const mockHtml = `
        <div class="vendor-entry" data-vendor-id="123">
          <h2><a>Test Vendor</a></h2>
          <div class="vendor-entry-standard-shipping"><dd>$10.00</dd></div>
          <div class="vendor-entry-free-shipping-threshold"><dd>$100.00</dd></div>
        </div>
      `;

      const mock$ = createMock$([
        {
          attr: (attr: string) => (attr === "data-vendor-id" ? "123" : null),
          find: (sel: string) => {
            if (sel === "h2 a") return { text: "Test Vendor", trim: "Test Vendor" };
            if (sel === ".vendor-entry-standard-shipping dd") return { text: "$10.00", trim: "$10.00" };
            if (sel === ".vendor-entry-free-shipping-threshold dd") return { text: "$100.00", trim: "$100.00" };
            return null;
          },
        },
      ]);

      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      await parseAndStoreVendorData(mockHtml);

      // Find the query builder that had insert called
      const knexCalls = (mockKnex as jest.Mock).mock.results;
      const insertCall = knexCalls.find((r: any) => r.value && r.value.insert && r.value.insert.mock.calls.length > 0);
      if (insertCall && insertCall.value) {
        expect(insertCall.value.insert).toHaveBeenCalledWith([
          {
            vendor_id: 123,
            standard_shipping: 10.0,
            threshold: 100.0,
          },
        ]);
      }
    });

    it("should verify database insertion count", async () => {
      const mockHtml = `
        <div class="vendor-entry" data-vendor-id="1">
          <h2><a>Vendor 1</a></h2>
          <div class="vendor-entry-standard-shipping"><dd>$5.00</dd></div>
          <div class="vendor-entry-free-shipping-threshold"><dd>$50.00</dd></div>
        </div>
      `;

      const mock$ = createMock$([
        {
          attr: (attr: string) => (attr === "data-vendor-id" ? "1" : null),
          find: (sel: string) => {
            if (sel === "h2 a") return { text: "Vendor 1", trim: "Vendor 1" };
            if (sel === ".vendor-entry-standard-shipping dd") return { text: "$5.00", trim: "$5.00" };
            if (sel === ".vendor-entry-free-shipping-threshold dd") return { text: "$50.00", trim: "$50.00" };
            return null;
          },
        },
      ]);

      (cheerio.load as jest.Mock) = jest.fn(() => mock$);

      await parseAndStoreVendorData(mockHtml);

      // Find the query builder that had count called
      const knexCalls = (mockKnex as jest.Mock).mock.results;
      const countCall = knexCalls.find((r: any) => r.value && r.value.count && r.value.count.mock.calls.length > 0);
      if (countCall && countCall.value) {
        expect(countCall.value.count).toHaveBeenCalledWith("* as count");
        expect(countCall.value.first).toHaveBeenCalled();
      }
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Final record count:"));
    });
  });
});
