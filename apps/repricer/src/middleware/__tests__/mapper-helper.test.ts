import { MapV2, MapBadgeIndicator, MapCronName, MapUserResponse, MapFormData, AlignCronName, MapScrapedFailedResults, AlignProducts, GetAlternateProxyProviderId, GetIsStepReached, MapAlternateProxyProviderDetails, MapSqlToCronLog, MapLatestPriceInfo, UpsertProductDetailsInSql, GetAlternateProxyProviderName } from "../mapper-helper";
import * as mySqlUtility from "../../services/mysql";
import * as SessionHelper from "../../utility/session-helper";
import { applicationConfig } from "../../utility/config";

jest.mock("../../services/mysql");
jest.mock("../../utility/session-helper");
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    ERROR_ONE: "Error: Invalid response found in Net32 Api",
    ERROR_TWO: "Error: Could not find own vendor Id",
  },
}));

describe("mapper-helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("MapV2", () => {
    it("returns empty array for empty productDetails", () => {
      expect(MapV2([])).toEqual([]);
    });

    it("maps product with minimal fields", () => {
      const input = [
        {
          mpId: 100,
          isScrapeOnlyActivated: true,
          isBadgeItem: false,
          algo_execution_mode: "auto",
        },
      ];
      const result = MapV2(input);
      expect(result).toHaveLength(1);
      expect(result[0].mpid).toBe(100);
      expect(result[0].isScrapeOnlyActive).toBe(true);
      expect(result[0].isBadgeItem).toBe(false);
      expect(result[0].algo_execution_mode).toBe("auto");
      expect(result[0].cronName).toBeNull();
      expect(result[0].cronId).toBeNull();
      expect(result[0].net32Url).toBeNull();
      expect(result[0].slowCronName).toBeNull();
    });

    it("maps tradentDetails and formats date fields", () => {
      const input = [
        {
          mpId: 1,
          tradentDetails: {
            cronName: "Cron A",
            cronId: "c1",
            net32url: "https://example.com",
            slowCronName: "Slow A",
            updatedAt: "2024-01-15T10:30:00Z",
            last_cron_time: "2024-01-15T09:00:00Z",
            last_update_time: "2024-01-14T12:00:00Z",
            last_attempted_time: "2024-01-15T08:00:00Z",
            marketStateUpdatedAt: "2024-01-13T00:00:00Z",
            tags: { key: "value\\with\\backslash" },
          },
        },
      ];
      const result = MapV2(input);
      expect(result[0].tradent).toBeDefined();
      expect(result[0].tradent.updatedAt).toMatch(/\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
      expect(result[0].tradent.lastCronTime).toBeDefined();
      expect(result[0].tradent.lastUpdateTime).toBeDefined();
      expect(result[0].tradent.lastAttemptedTime).toBeDefined();
      expect(result[0].tradent.marketStateUpdatedAt).toBeDefined();
      expect(result[0].tradent.tags.key).toBe("valuewithbackslash");
      expect(result[0].cronName).toBe("Cron A");
      expect(result[0].cronId).toBe("c1");
      expect(result[0].net32Url).toBe("https://example.com");
      expect(result[0].slowCronName).toBe("Slow A");
    });

    it("maps multiple vendor details (frontier, mvp, topDent, firstDent, triad, biteSupply)", () => {
      const input = [
        {
          mpId: 2,
          frontierDetails: {
            cronName: "F",
            updatedAt: "2024-01-01T00:00:00Z",
            last_cron_time: null,
            last_update_time: null,
            last_attempted_time: null,
            marketStateUpdatedAt: null,
            tags: null,
          },
          mvpDetails: { cronName: "M", updatedAt: null, last_cron_time: null, last_update_time: null, last_attempted_time: null, marketStateUpdatedAt: null, tags: null },
          topDentDetails: { cronName: "T", updatedAt: null, last_cron_time: null, last_update_time: null, last_attempted_time: null, marketStateUpdatedAt: null, tags: null },
          firstDentDetails: { cronName: "FD", updatedAt: null, last_cron_time: null, last_update_time: null, last_attempted_time: null, marketStateUpdatedAt: null, tags: null },
          triadDetails: { cronName: "Tr", updatedAt: null, last_cron_time: null, last_update_time: null, last_attempted_time: null, marketStateUpdatedAt: null, tags: null },
          biteSupplyDetails: { cronName: "B", updatedAt: null, last_cron_time: null, last_update_time: null, last_attempted_time: null, marketStateUpdatedAt: null, tags: null },
        },
      ];
      const result = MapV2(input);
      expect(result[0].frontier).toBeDefined();
      expect(result[0].mvp).toBeDefined();
      expect(result[0].topDent).toBeDefined();
      expect(result[0].firstDent).toBeDefined();
      expect(result[0].triad).toBeDefined();
      expect(result[0].biteSupply).toBeDefined();
      expect(result[0].cronName).toBe("F"); // first found with checkAll false is tradent, but we have no tradent so order is frontier first
      expect(result[0].net32Url).toBeNull(); // checkAll true looks for net32url in any; none set
    });

    it("getCommonEntityValue checkAll false uses first available vendor", () => {
      const input = [
        {
          mpId: 3,
          tradentDetails: { cronName: "TradentCron", cronId: "tc1" },
          frontierDetails: { cronName: "FrontierCron", cronId: "fc1" },
        },
      ];
      const result = MapV2(input);
      expect(result[0].cronName).toBe("TradentCron");
      expect(result[0].cronId).toBe("tc1");
    });

    it("getCommonEntityValue checkAll false uses frontier when tradent missing", () => {
      const input = [
        {
          mpId: 6,
          frontierDetails: { cronName: "FrontierOnly", cronId: "f1", net32url: "https://f.com" },
        },
      ];
      const result = MapV2(input);
      expect(result[0].cronName).toBe("FrontierOnly");
      expect(result[0].cronId).toBe("f1");
    });

    it("removeBackslashes skips falsy tag values without mutating", () => {
      const input = [
        {
          mpId: 7,
          tradentDetails: {
            cronName: "C",
            tags: { a: "x\\y", empty: "", nullKey: null },
          },
        },
      ];
      const result = MapV2(input);
      expect(result[0].tradent.tags.a).toBe("xy");
      expect(result[0].tradent.tags.empty).toBe("");
      expect(result[0].tradent.tags.nullKey).toBeNull();
    });

    it("getCommonEntityValue checkAll true returns net32url from any vendor", () => {
      const input = [
        {
          mpId: 4,
          mvpDetails: { cronName: "M", net32url: "https://mvp.net32.com" },
        },
      ];
      const result = MapV2(input);
      expect(result[0].net32Url).toBe("https://mvp.net32.com");
    });

    it("getCommonEntityValue checkAll true returns slowCronName from biteSupply when only biteSupply has it", () => {
      const input = [
        {
          mpId: 42,
          biteSupplyDetails: { cronName: "B", slowCronName: "SlowBite", net32url: "https://bite.com" },
        },
      ];
      const result = MapV2(input);
      expect(result[0].slowCronName).toBe("SlowBite");
      expect(result[0].net32Url).toBe("https://bite.com");
    });

    it("removeBackslashes recurses into nested objects", () => {
      const input = [
        {
          mpId: 5,
          tradentDetails: {
            cronName: "C",
            tags: { a: "x\\y", nested: { b: "z\\\\w" } },
          },
        },
      ];
      const result = MapV2(input);
      expect(result[0].tradent.tags.a).toBe("xy");
      expect(result[0].tradent.tags.nested.b).toBe("zw");
    });
  });

  describe("MapBadgeIndicator", () => {
    it("sets badge_indicator from badgeIndicator for each vendor (KEY lookup)", () => {
      const product = {
        tradentDetails: { badgeIndicator: "all_zero" },
        frontierDetails: { badgeIndicator: "badge_only" },
        mvpDetails: { badgeIndicator: "all_percentage" },
        firstDentDetails: { badgeIndicator: "non_badge_only  " },
        topDentDetails: { badgeIndicator: "ALL_ZERO" },
        triadDetails: { badgeIndicator: "BADGE_ONLY" },
        biteSupplyDetails: { badgeIndicator: "ALL_PERCENTAGE" },
      };
      const result = MapBadgeIndicator(product);
      expect(result.tradentDetails.badge_indicator).toBeDefined();
      expect(result.frontierDetails.badge_indicator).toBeDefined();
      expect(result.mvpDetails.badge_indicator).toBeDefined();
      expect(result.firstDentDetails.badge_indicator).toBeDefined();
      expect(result.topDentDetails.badge_indicator).toBeDefined();
      expect(result.triadDetails.badge_indicator).toBeDefined();
      expect(result.biteSupplyDetails.badge_indicator).toBeDefined();
    });

    it("does not mutate missing vendor details", () => {
      const product = { mpId: 1 };
      const result = MapBadgeIndicator(product);
      expect(result).toEqual({ mpId: 1 });
    });
  });

  describe("MapCronName", () => {
    it("maps cronName from cronSettings when cronId matches", async () => {
      const prod = {
        tradentDetails: { cronId: 1 },
        frontierDetails: { cronId: 2 },
        mvpDetails: { cronId: 3 },
      };
      const cronSettings = [
        { CronId: 1, CronName: "Cron One" },
        { CronId: 2, CronName: "Cron Two" },
        { CronId: 3, CronName: "Cron Three" },
      ];
      const result = await MapCronName(prod, cronSettings);
      expect(result.tradentDetails.cronName).toBe("Cron One");
      expect(result.frontierDetails.cronName).toBe("Cron Two");
      expect(result.mvpDetails.cronName).toBe("Cron Three");
    });

    it("sets N/A when cronId not found in cronSettings", async () => {
      const prod = { tradentDetails: { cronId: 99 } };
      const cronSettings = [{ CronId: 1, CronName: "Cron One" }];
      const result = await MapCronName(prod, cronSettings);
      expect(result.tradentDetails.cronName).toBe("N/A");
    });

    it("leaves product unchanged when no vendor details have cronId", async () => {
      const prod = { mpId: 1, tradentDetails: {} };
      const result = await MapCronName(prod, []);
      expect(result.tradentDetails.cronName).toBeUndefined();
    });
  });

  describe("MapUserResponse", () => {
    it("maps productDetails from updateDetails and parses booleans/numbers", async () => {
      const productDetails: any = {
        cronId: "c1",
        CronName: "MyCron",
        floorPrice: "10.5",
        net32_url: "https://u.com",
        mpid: 101,
        channelId: "ch1",
        unitPrice: "20",
        maxPrice: "50",
        activated: true,
        is_nc_needed: "true",
        repricingRule: "1",
        badgeIndicator: "ALL_ZERO",
      };
      const updateDetails = {
        channel_name: "Channel A",
        product_name: "Product A",
        Scrape_on_off: "on",
        Reprice_on_off: "off",
        requestInterval: 5,
        focus_id: "f1",
        secret_key: "sk",
        suppressPriceBreak: "on",
        request_interval_unit: "hr",
        priority: 10,
        competeAll: "off",
        suppressPriceBreakForOne: "on",
        beatQPrice: "on",
        percentageIncrease: "2.5",
        compareWithQ1: "on",
        badgePercentage: "5",
        ownVendorId: "v1",
        sisterVendorId: "v2",
        inactiveVendorId: "v3",
        includeInactiveVendors: "on",
        override_bulk_update: "on",
        override_bulk_rule_select: "3",
        latest_price: "99.99",
        executionPriority: "1",
        applyBuyBox: "on",
        applyNcForBuyBox: "off",
        handling_time_filter: "24",
        keepPosition: "on",
        excludedVendors: [],
        inventoryThreshold: "10",
        percentageDown: "1.5",
        badgePercentageDown: "0.5",
        competeWithNext: "on",
        ignorePhantomQBreak: "on",
        ownVendorThreshold: "2",
        getBBBadgeValue: "0.2",
        getBBShippingValue: "0.01",
        getBBBadge: "on",
        getBBShipping: "off",
      };
      const result = await MapUserResponse(productDetails, updateDetails, null);
      expect(result.cronName).toBe("MyCron");
      expect(result.channelName).toBe("Channel A");
      expect(result.productName).toBe("Product A");
      expect(result.scrapeOn).toBe(true);
      expect(result.allowReprice).toBe(false);
      expect(result.requestInterval).toBe(5);
      expect(result.floorPrice).toBe(10.5);
      expect(result.unitPrice).toBe(20);
      expect(result.maxPrice).toBe(50);
      expect(result.focusId).toBe("f1");
      expect(result.requestIntervalUnit).toBe("hr");
      expect(result.priority).toBe(10);
      expect(result.suppressPriceBreak).toBe(true);
      expect(result.percentageIncrease).toBe(2.5);
      expect(result.badgePercentage).toBe(5);
      expect(result.override_bulk_rule).toBe(3);
      expect(result.latest_price).toBe(99.99);
      expect(result.executionPriority).toBe(1);
      expect(result.applyBuyBoxLogic).toBe(true);
      expect(result.applyNcForBuyBox).toBe(false);
      expect(result.inventoryThreshold).toBe(10);
      expect(result.percentageDown).toBe(1.5);
      expect(result.badgePercentageDown).toBe(0.5);
      expect(result.ownVendorThreshold).toBe(2);
      expect(result.getBBBadgeValue).toBe(0.2);
      expect(result.getBBShippingValue).toBe(0.01);
      expect(result.getBBBadge).toBe(true);
      expect(result.getBBShipping).toBe(false);
      expect(result.is_nc_needed).toBe(true);
      expect(result.repricingRule).toBe(1);
    });

    it("uses defaults when updateDetails fields missing", async () => {
      const productDetails: any = { cronId: "c1", floorPrice: "0", unitPrice: "0", maxPrice: "0", mpid: 1, channelId: "c", activated: false, is_nc_needed: "false", repricingRule: "0", badgeIndicator: null };
      const updateDetails = { channel_name: "Ch", product_name: "P", Scrape_on_off: "off", Reprice_on_off: "off" };
      const result = await MapUserResponse(productDetails, updateDetails, null);
      expect(result.requestInterval).toBe(1);
      expect(result.focusId).toBeNull();
      expect(result.requestIntervalUnit).toBe("min");
      expect(result.priority).toBe(5);
      expect(result.percentageIncrease).toBe(0);
      expect(result.badgePercentage).toBe(0);
      expect(result.override_bulk_rule).toBe(2);
      expect(result.ownVendorThreshold).toBe(1);
      expect(result.getBBBadgeValue).toBe(0.1);
      expect(result.getBBShippingValue).toBe(0.005);
    });

    it("uses productDetails.cronName when CronName is not set", async () => {
      const productDetails: any = { cronId: "c1", cronName: "ExistingCron", CronName: undefined, floorPrice: "0", unitPrice: "0", maxPrice: "0", mpid: 1, channelId: "c", activated: false, is_nc_needed: "false", repricingRule: "0", badgeIndicator: null };
      const updateDetails = { channel_name: "Ch", product_name: "P", Scrape_on_off: "off", Reprice_on_off: "off" };
      const result = await MapUserResponse(productDetails, updateDetails, null);
      expect(result.cronName).toBe("ExistingCron");
    });

    it("sets excludedVendors from updateDetails", async () => {
      const productDetails: any = { cronId: "c1", floorPrice: "0", unitPrice: "0", maxPrice: "0", mpid: 1, channelId: "c", activated: false, is_nc_needed: "false", repricingRule: "0", badgeIndicator: null };
      const updateDetails = { channel_name: "Ch", product_name: "P", Scrape_on_off: "off", Reprice_on_off: "off", excludedVendors: ["v1", "v2"] };
      const result = await MapUserResponse(productDetails, updateDetails, null);
      expect(result.excludedVendors).toEqual(["v1", "v2"]);
    });

    it("uses productDetails.net32url when net32_url is missing", async () => {
      const productDetails: any = { cronId: "c1", net32url: "https://existing.com", floorPrice: "0", unitPrice: "0", maxPrice: "0", mpid: 1, channelId: "c", activated: false, is_nc_needed: "false", repricingRule: "0", badgeIndicator: null };
      const updateDetails = { channel_name: "Ch", product_name: "P", Scrape_on_off: "off", Reprice_on_off: "off" };
      const result = await MapUserResponse(productDetails, updateDetails, null);
      expect(result.net32url).toBe("https://existing.com");
    });

    it("uses default 0 or 0.1/0.005 when numeric updateDetails fields are NaN", async () => {
      const productDetails: any = { cronId: "c1", floorPrice: "0", unitPrice: "0", maxPrice: "0", mpid: 1, channelId: "c", activated: false, is_nc_needed: "false", repricingRule: "0", badgeIndicator: null };
      const updateDetails = {
        channel_name: "Ch",
        product_name: "P",
        Scrape_on_off: "off",
        Reprice_on_off: "off",
        inventoryThreshold: "not-a-number",
        percentageDown: "nope",
        badgePercentageDown: "nope",
        ownVendorThreshold: "nope",
        getBBBadgeValue: "x",
        getBBShippingValue: "y",
      };
      const result = await MapUserResponse(productDetails, updateDetails, null);
      expect(result.inventoryThreshold).toBe(0);
      expect(result.percentageDown).toBe(0);
      expect(result.badgePercentageDown).toBe(0);
      expect(result.ownVendorThreshold).toBe(1);
      expect(result.getBBBadgeValue).toBe(0.1);
      expect(result.getBBShippingValue).toBe(0.005);
    });

    it("uses updateDetails.executionPriority as-is when parseInt would fail or value is falsy", async () => {
      const productDetails: any = { cronId: "c1", floorPrice: "0", unitPrice: "0", maxPrice: "0", mpid: 1, channelId: "c", activated: false, is_nc_needed: "false", repricingRule: "0", badgeIndicator: null };
      const updateDetails = { channel_name: "Ch", product_name: "P", Scrape_on_off: "off", Reprice_on_off: "off", executionPriority: null };
      const result = await MapUserResponse(productDetails, updateDetails, null);
      expect(result.executionPriority).toBeNull();
    });
  });

  describe("MapFormData", () => {
    it("maps productDetails from formData and formVendorData", async () => {
      const productDetails: any = {};
      const formData = {
        cronGroup: "cg1",
        product_name: "Prod",
        net32_url: "https://f.com",
        mpid: 200,
        secret_key: "sk",
      };
      const formVendorData = {
        channel_name: "Ch",
        Scrape_on_off: "on",
        Reprice_on_off: "on",
        requestInterval: 2,
        floor_price: "5",
        focus_id: "fid",
        channel_Id: "cid",
        unit_price: "15",
        max_price: "40",
        activated: true,
        is_nc_needed: true,
        reprice_rule_select: "2",
        suppressPriceBreak: "off",
        request_interval_unit: "min",
        priority: 7,
        competeAll: "on",
        suppressPriceBreakForOne: "off",
        beatQPrice: "off",
        percentageIncrease: "1",
        compareWithQ1: "off",
        badgeIndicator: "BADGE_ONLY",
        badgePercentage: "10",
        ownVendorId: "o1",
        sisterVendorId: "s1",
        inactiveVendorId: "i1",
        includeInactiveVendors: "off",
        override_bulk_update: "off",
        override_bulk_rule_select: "1",
        latest_price: "50",
        executionPriority: 2,
        applyBuyBox: "off",
        applyNcForBuyBox: "on",
        handling_time_filter: "48",
        keepPosition: "off",
        ownVendorThreshold: "3",
        getBBBadgeValue: "0.15",
        getBBShippingValue: "0.02",
        getBBBadge: "on",
        getBBShipping: "on",
      };
      const result = await MapFormData(productDetails, formData, formVendorData);
      expect(result.cronId).toBe("cg1");
      expect(result.channelName).toBe("Ch");
      expect(result.productName).toBe("Prod");
      expect(result.scrapeOn).toBe(true);
      expect(result.allowReprice).toBe(true);
      expect(result.requestInterval).toBe(2);
      expect(result.floorPrice).toBe(5);
      expect(result.net32url).toBe("https://f.com");
      expect(result.mpid).toBe(200);
      expect(result.focusId).toBe("fid");
      expect(result.channelId).toBe("cid");
      expect(result.unitPrice).toBe(15);
      expect(result.maxPrice).toBe(40);
      expect(result.SecretKey).toBe("sk");
      expect(result.tags).toEqual([]);
      expect(result.repricingRule).toBe(2);
      expect(result.priority).toBe(7);
      expect(result.override_bulk_rule).toBe(1);
      expect(result.latest_price).toBe(50);
      expect(result.executionPriority).toBe(2);
      expect(result.ownVendorThreshold).toBe(3);
      expect(result.getBBBadgeValue).toBe(0.15);
      expect(result.getBBShippingValue).toBe(0.02);
    });

    it("uses null for optional formData.secret_key", async () => {
      const productDetails: any = {};
      const formData = { cronGroup: "c", product_name: "P", net32_url: "u", mpid: 1 };
      const formVendorData = { channel_name: "Ch", Scrape_on_off: "off", Reprice_on_off: "off", floor_price: "0", channel_Id: "c", unit_price: "0", max_price: "0", activated: false, is_nc_needed: false, reprice_rule_select: "0", suppressPriceBreak: "off", badgeIndicator: null, badgePercentage: "0", sisterVendorId: null, inactiveVendorId: null, includeInactiveVendors: "off", override_bulk_update: "off", latest_price: "0", applyBuyBox: "off", applyNcForBuyBox: "off", keepPosition: "off", getBBBadge: "off", getBBShipping: "off" };
      const result = await MapFormData(productDetails, formData, formVendorData);
      expect(result.SecretKey).toBeNull();
    });

    it("uses default override_bulk_rule 2 and default getBB values when formVendorData fields missing or NaN", async () => {
      const productDetails: any = {};
      const formData = { cronGroup: "c", product_name: "P", net32_url: "u", mpid: 1 };
      const formVendorData = {
        channel_name: "Ch",
        Scrape_on_off: "off",
        Reprice_on_off: "off",
        floor_price: "0",
        channel_Id: "c",
        unit_price: "0",
        max_price: "0",
        activated: false,
        is_nc_needed: false,
        reprice_rule_select: "0",
        suppressPriceBreak: "off",
        badgeIndicator: null,
        badgePercentage: "0",
        sisterVendorId: null,
        inactiveVendorId: null,
        includeInactiveVendors: "off",
        override_bulk_update: "off",
        latest_price: "0",
        executionPriority: null,
        applyBuyBox: "off",
        applyNcForBuyBox: "off",
        keepPosition: "off",
        getBBBadgeValue: "invalid",
        getBBShippingValue: "invalid",
        getBBBadge: "off",
        getBBShipping: "off",
      };
      const result = await MapFormData(productDetails, formData, formVendorData);
      expect(result.override_bulk_rule).toBe(2);
      expect(result.getBBBadgeValue).toBe(0.1);
      expect(result.getBBShippingValue).toBe(0.005);
      expect(result.executionPriority).toBeNull();
    });
  });

  describe("AlignCronName", () => {
    it("returns same list and deduplicates by mpid", async () => {
      const productList = [
        { mpid: 1, channelName: "A", cronName: "C1", cronId: "c1" },
        { mpid: 2, channelName: "B", cronName: "C2", cronId: "c2" },
      ];
      const result = await AlignCronName(productList);
      expect(result).toBe(productList);
      expect(result).toHaveLength(2);
    });

    it("handles empty list", async () => {
      const result = await AlignCronName([]);
      expect(result).toEqual([]);
    });

    it("handles single product", async () => {
      const productList = [{ mpid: 1, channelName: "A" }];
      const result = await AlignCronName(productList);
      expect(result).toHaveLength(1);
    });

    it("aligns cronName/cronId when same mpid has different channel (array-like related product)", async () => {
      const relatedProduct = { mpid: 1, channelName: "ChannelB", cronName: "C2", cronId: "c2" };
      const productList = [{ mpid: 1, channelName: "ChannelA", cronName: "C1", cronId: "c1" }, Object.assign([relatedProduct], { length: 1, mpid: 1, channelName: "ChannelB", cronName: "C2", cronId: "c2", 0: relatedProduct })];
      const result = await AlignCronName(productList);
      expect(result).toBe(productList);
      expect(result).toHaveLength(2);
    });
  });

  describe("MapScrapedFailedResults", () => {
    it("returns FailedReport entries for ERROR_ONE and ERROR_TWO", async () => {
      const errorOne = (applicationConfig as any).ERROR_ONE;
      const errorTwo = (applicationConfig as any).ERROR_TWO;
      const cronLogs = [
        {
          cronId: "cron1",
          time: "2024-01-15T10:00:00Z",
          logs: [
            [
              {
                productId: "p1",
                vendor: "TRADENT",
                logs: errorOne,
              },
              {
                productId: "p2",
                vendor: "FRONTIER",
                logs: errorTwo,
              },
            ],
          ],
        },
      ];
      const result = await MapScrapedFailedResults(cronLogs);
      expect(result).toHaveLength(2);
      expect(result[0].mpId).toBe("p1");
      expect(result[0].vendor).toBe("TRADENT");
      expect(result[0].error).toBe(errorOne);
      expect(result[0].cronRunId).toBe("cron1");
      expect(result[1].mpId).toBe("p2");
      expect(result[1].error).toBe(errorTwo);
    });

    it("returns empty array when no matching error logs", async () => {
      const cronLogs = [
        {
          cronId: "c1",
          time: new Date(),
          logs: [[{ productId: "p1", vendor: "V", logs: "Some other error" }]],
        },
      ];
      const result = await MapScrapedFailedResults(cronLogs);
      expect(result).toEqual([]);
    });

    it("handles empty logs", async () => {
      const result = await MapScrapedFailedResults([{ cronId: "c1", time: new Date(), logs: [] }]);
      expect(result).toEqual([]);
    });

    it("handles nested logs with empty inner array", async () => {
      const result = await MapScrapedFailedResults([{ cronId: "c1", time: new Date(), logs: [[]] }]);
      expect(result).toEqual([]);
    });

    it("ignores entries where logs is not ERROR_ONE or ERROR_TWO", async () => {
      const cronLogs = [
        {
          cronId: "c1",
          time: new Date(),
          logs: [
            [
              { productId: "p1", vendor: "V", logs: "Error: Invalid response" },
              { productId: "p2", vendor: "V", logs: [] },
              { productId: "p3", vendor: "V", logs: ["array not string"] },
            ],
            [{ productId: "p4", vendor: "V", logs: (applicationConfig as any).ERROR_ONE }],
          ],
        },
      ];
      const result = await MapScrapedFailedResults(cronLogs);
      expect(result).toHaveLength(1);
      expect(result[0].mpId).toBe("p4");
    });
  });

  describe("AlignProducts", () => {
    it("aligns cron ids/names from product to all vendor details and fetches slow cron from DB", async () => {
      const product: any = {
        mpId: 50,
        tradentDetails: { cronId: "curCron", cronName: "Current Cron" },
        frontierDetails: { cronId: null, cronName: null },
      };
      const dbProduct = {
        isSlowActivated: true,
        tradentDetails: { slowCronId: "slow1", slowCronName: "Slow Cron" },
        frontierDetails: { slowCronId: "slow1", slowCronName: "Slow Cron" },
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([dbProduct]);

      await AlignProducts(product, [], []);

      expect(product.tradentDetails.cronId).toBe("curCron");
      expect(product.tradentDetails.cronName).toBe("Current Cron");
      expect(product.tradentDetails.slowCronId).toBe("slow1");
      expect(product.tradentDetails.slowCronName).toBe("Slow Cron");
      expect(product.frontierDetails.cronId).toBe("curCron");
      expect(product.frontierDetails.cronName).toBe("Current Cron");
      expect(product.frontierDetails.slowCronId).toBe("slow1");
      expect(product.frontierDetails.slowCronName).toBe("Slow Cron");
      expect(mySqlUtility.GetFullProductDetailsById).toHaveBeenCalledWith(50);
    });

    it("does not set slow cron when isSlowActivated is false", async () => {
      const product: any = {
        mpId: 51,
        mvpDetails: { cronId: "c1", cronName: "C1" },
      };
      const dbProduct = {
        isSlowActivated: false,
        mvpDetails: {},
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([dbProduct]);

      await AlignProducts(product, [], []);

      expect(product.mvpDetails.cronId).toBe("c1");
      expect(product.mvpDetails.cronName).toBe("C1");
      expect(product.mvpDetails.slowCronId).toBeUndefined();
      expect(product.mvpDetails.slowCronName).toBeUndefined();
    });

    it("when no db product found, does not mutate vendor details", async () => {
      const product: any = {
        mpId: 52,
        firstDentDetails: { cronId: "x", cronName: "X" },
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([]);

      await AlignProducts(product, [], []);

      expect(product.firstDentDetails.cronId).toBe("x");
      expect(product.firstDentDetails.cronName).toBe("X");
    });

    it("aligns topDent, firstDent, triad, biteSupply when present", async () => {
      const product: any = {
        mpId: 53,
        topDentDetails: {},
        firstDentDetails: {},
        triadDetails: {},
        biteSupplyDetails: {},
      };
      const dbProduct = {
        isSlowActivated: false,
        topDentDetails: {},
        firstDentDetails: {},
        triadDetails: {},
        biteSupplyDetails: {},
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([dbProduct]);

      await AlignProducts(product, [], []);

      expect(product.topDentDetails.cronId).toBeUndefined();
      expect(product.firstDentDetails.cronId).toBeUndefined();
      expect(product.triadDetails.cronId).toBeUndefined();
      expect(product.biteSupplyDetails.cronId).toBeUndefined();
    });

    it("sets slowCronId/slowCronName on firstDent, topDent, triad, biteSupply when isSlowActivated", async () => {
      const product: any = {
        mpId: 54,
        firstDentDetails: { cronId: "c1", cronName: "C1" },
        topDentDetails: { cronId: "c1", cronName: "C1" },
        triadDetails: { cronId: "c1", cronName: "C1" },
        biteSupplyDetails: { cronId: "c1", cronName: "C1" },
      };
      const dbProduct = {
        isSlowActivated: true,
        firstDentDetails: { slowCronId: "slow2", slowCronName: "Slow Two" },
        topDentDetails: { slowCronId: "slow2", slowCronName: "Slow Two" },
        triadDetails: { slowCronId: "slow2", slowCronName: "Slow Two" },
        biteSupplyDetails: { slowCronId: "slow2", slowCronName: "Slow Two" },
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([dbProduct]);

      await AlignProducts(product, [], []);

      expect(product.firstDentDetails.slowCronId).toBe("slow2");
      expect(product.firstDentDetails.slowCronName).toBe("Slow Two");
      expect(product.topDentDetails.slowCronId).toBe("slow2");
      expect(product.topDentDetails.slowCronName).toBe("Slow Two");
      expect(product.triadDetails.slowCronId).toBe("slow2");
      expect(product.triadDetails.slowCronName).toBe("Slow Two");
      expect(product.biteSupplyDetails.slowCronId).toBe("slow2");
      expect(product.biteSupplyDetails.slowCronName).toBe("Slow Two");
    });

    it("getContextItem uses biteSupplyDetails when only vendor present", async () => {
      const product: any = {
        mpId: 55,
        biteSupplyDetails: { cronId: "biteCron", cronName: "Bite Cron" },
      };
      const dbProduct = {
        isSlowActivated: false,
        biteSupplyDetails: {},
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([dbProduct]);

      await AlignProducts(product, [], []);

      expect(product.biteSupplyDetails.cronId).toBe("biteCron");
      expect(product.biteSupplyDetails.cronName).toBe("Bite Cron");
    });

    it("getContextItem uses mvpDetails when tradent and frontier missing and sets slow cron on mvpDetails", async () => {
      const product: any = {
        mpId: 56,
        mvpDetails: { cronId: "mvpCron", cronName: "MVP Cron" },
      };
      const dbProduct = {
        isSlowActivated: true,
        mvpDetails: { slowCronId: "slowMvp", slowCronName: "Slow MVP" },
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([dbProduct]);

      await AlignProducts(product, [], []);

      expect(product.mvpDetails.cronId).toBe("mvpCron");
      expect(product.mvpDetails.cronName).toBe("MVP Cron");
      expect(product.mvpDetails.slowCronId).toBe("slowMvp");
      expect(product.mvpDetails.slowCronName).toBe("Slow MVP");
    });

    it("getContextItem uses firstDentDetails when tradent, frontier, mvp, topDent missing", async () => {
      const product: any = {
        mpId: 57,
        firstDentDetails: { cronId: "fdCron", cronName: "FirstDent Cron" },
      };
      const dbProduct = { isSlowActivated: false, firstDentDetails: {} };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([dbProduct]);

      await AlignProducts(product, [], []);

      expect(product.firstDentDetails.cronId).toBe("fdCron");
      expect(product.firstDentDetails.cronName).toBe("FirstDent Cron");
    });

    it("getContextItem uses topDentDetails when tradent, frontier, mvp missing", async () => {
      const product: any = {
        mpId: 58,
        topDentDetails: { cronId: "tdCron", cronName: "TopDent Cron" },
      };
      const dbProduct = { isSlowActivated: false, topDentDetails: {} };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([dbProduct]);

      await AlignProducts(product, [], []);

      expect(product.topDentDetails.cronId).toBe("tdCron");
      expect(product.topDentDetails.cronName).toBe("TopDent Cron");
    });

    it("getContextItem uses triadDetails when tradent, frontier, mvp, topDent, firstDent missing", async () => {
      const product: any = {
        mpId: 59,
        triadDetails: { cronId: "triadCron", cronName: "Triad Cron" },
      };
      const dbProduct = { isSlowActivated: false, triadDetails: {} };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([dbProduct]);

      await AlignProducts(product, [], []);

      expect(product.triadDetails.cronId).toBe("triadCron");
      expect(product.triadDetails.cronName).toBe("Triad Cron");
    });
  });

  describe("GetAlternateProxyProviderId", () => {
    it("returns ProxyProvider for matching Sequence", async () => {
      const details = {
        AlternateProxyProvider: [
          { Sequence: 1, ProxyProvider: 10 },
          { Sequence: 2, ProxyProvider: 20 },
        ],
      };
      expect(await GetAlternateProxyProviderId(details, 2)).toBe(20);
    });

    it("returns 99 when AlternateProxyProvider missing", async () => {
      expect(await GetAlternateProxyProviderId({}, 1)).toBe(99);
    });

    it("returns 99 when no matching Sequence", async () => {
      const details = { AlternateProxyProvider: [{ Sequence: 1, ProxyProvider: 10 }] };
      expect(await GetAlternateProxyProviderId(details, 5)).toBe(99);
    });
  });

  describe("GetIsStepReached", () => {
    it("returns true when step matches and ProxyProvider matches", async () => {
      const details = {
        AlternateProxyProvider: [{ Sequence: 2, ProxyProvider: 5 }],
        ProxyProvider: 5,
      };
      expect(await GetIsStepReached(details, 2)).toBe(true);
    });

    it("returns false when ProxyProvider does not match", async () => {
      const details = {
        AlternateProxyProvider: [{ Sequence: 2, ProxyProvider: 5 }],
        ProxyProvider: 10,
      };
      expect(await GetIsStepReached(details, 2)).toBe(false);
    });

    it("returns false when AlternateProxyProvider missing", async () => {
      expect(await GetIsStepReached({}, 1)).toBe(false);
    });
  });

  describe("MapAlternateProxyProviderDetails", () => {
    it("builds array of 6 entries with Sequence 1-6 and payload key proxy_provider_{idx}", async () => {
      const payload: any = {};
      for (let i = 1; i <= 6; i++) {
        payload[`proxy_provider_${i}`] = [10 + i, 20 + i, 30 + i];
      }
      const result = await MapAlternateProxyProviderDetails(0, payload);
      expect(result).toHaveLength(6);
      expect(result[0]).toEqual({ Sequence: 1, ProxyProvider: 11 });
      expect(result[1]).toEqual({ Sequence: 2, ProxyProvider: 12 });
      expect(result[5]).toEqual({ Sequence: 6, ProxyProvider: 16 });
    });

    it("uses proxy_provider_422_alternate_* when idx is 999", async () => {
      const payload: any = {};
      for (let i = 1; i <= 6; i++) {
        payload[`proxy_provider_422_alternate_${i}`] = 100 + i;
      }
      const result = await MapAlternateProxyProviderDetails(999, payload);
      expect(result[0].ProxyProvider).toBe(101);
      expect(result[5].ProxyProvider).toBe(106);
    });
  });

  describe("MapSqlToCronLog", () => {
    it("maps runInfo to cronLog shape", async () => {
      const runInfo = {
        RunStartTime: "2024-01-15 10:00:00",
        RunEndTime: "2024-01-15 10:05:00",
        KeyGenId: "key1",
        CronId: "c1",
        ProductCount: 100,
        RunType: "SCRAPE",
        RunId: "run1",
        CronName: "Cron A",
        EligibleCount: 80,
        ScrapedSuccessCount: 75,
        ScrapedFailureCount: 5,
      };
      const result = await MapSqlToCronLog(runInfo, 0);
      expect(result.index).toBe(0);
      expect(result.logTime).toBe("2024-01-15 10:00:00");
      expect(result.keyRef).toBe("key1");
      expect(result.cronId).toBe("c1");
      expect(result.productCount).toBe(100);
      expect(result.type).toBe("SCRAPE");
      expect(result.completionTime).toBe("2024-01-15 10:05:00");
      expect(result.EligibleCount).toBe(80);
      expect(result.logData._id).toBe("run1");
      expect(result.logData.type).toBe("SCRAPE");
      expect(result.cronName).toBe("Cron A");
      expect(result.successScrapeCount).toBe(75);
      expect(result.failureScrapeCount).toBe(5);
      expect(result.totalActiveCount).toBe(80);
    });

    it("uses '-' for missing RunStartTime and RunEndTime", async () => {
      const runInfo = { KeyGenId: "k", CronId: "c", ProductCount: 0, RunType: "RUN", RunId: "r", EligibleCount: 0, ScrapedSuccessCount: 0, ScrapedFailureCount: 0 };
      const result = await MapSqlToCronLog(runInfo as any, 1);
      expect(result.logTime).toBe("-");
      expect(result.completionTime).toBe("-");
    });
  });

  describe("MapLatestPriceInfo", () => {
    it("returns LatestScrapeInfo for MinQty 1 and non-own vendor, ordered by ItemRank", async () => {
      const scrapeList = [
        { MinQty: 2, IsOwnVendor: 0, ItemRank: 1 },
        { MinQty: 1, IsOwnVendor: 1, ItemRank: 2 },
        { MinQty: 1, IsOwnVendor: 0, ItemRank: 1, Mpid: "mp1", Net32Url: "u", UnitPrice: "10", FreeShippingGap: "0", InStock: 1, EndTime: new Date() },
      ];
      const result = await MapLatestPriceInfo(scrapeList, "focus1");
      expect(result).not.toBeNull();
      expect(result!.FocusId).toBe("focus1");
      expect(result!.MpId).toBe("mp1");
      expect(result!.MinQty).toBe(1);
    });

    it("returns null when no MinQty 1", async () => {
      const scrapeList = [{ MinQty: 2, IsOwnVendor: 0 }];
      expect(await MapLatestPriceInfo(scrapeList, "f")).toBeNull();
    });

    it("returns null when no competitor (all IsOwnVendor 1)", async () => {
      const scrapeList = [{ MinQty: 1, IsOwnVendor: 1 }];
      expect(await MapLatestPriceInfo(scrapeList, "f")).toBeNull();
    });

    it("returns null for empty list", async () => {
      expect(await MapLatestPriceInfo([], "f")).toBeNull();
    });
  });

  describe("GetAlternateProxyProviderName", () => {
    it("returns proxyProviderName when method missing", async () => {
      const details = [{ proxyProvider: 1, proxyProviderName: "Provider A" }];
      expect(await GetAlternateProxyProviderName(details, 1)).toBe("Provider A");
    });

    it("returns proxyProviderName - method when method present", async () => {
      const details = [{ proxyProvider: 1, proxyProviderName: "P", method: "M" }];
      expect(await GetAlternateProxyProviderName(details, 1)).toBe("P - M");
    });

    it("returns null when providerId not found", async () => {
      const details = [{ proxyProvider: 1, proxyProviderName: "P" }];
      expect(await GetAlternateProxyProviderName(details, 2)).toBeNull();
    });

    it("returns empty string when details empty", async () => {
      expect(await GetAlternateProxyProviderName([], 1)).toBe("");
    });

    it("returns empty string when details null/undefined", async () => {
      expect(await GetAlternateProxyProviderName(null as any, 1)).toBe("");
      expect(await GetAlternateProxyProviderName(undefined as any, 1)).toBe("");
    });
  });

  describe("UpsertProductDetailsInSql", () => {
    const mockReq = { session: { users_id: { userName: "testuser" } } };
    const auditInfo = { UpdatedBy: "testuser", UpdatedOn: new Date() };

    beforeEach(() => {
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue(auditInfo);
    });

    it("updates existing tradentDetails when sqlProductDetails has tradentDetails", async () => {
      const mpid = 100;
      const payload = {
        tradentDetails: {
          channelId: "c1",
          isSlowActivated: false,
        },
      };
      const sqlProductDetails = {
        tradentDetails: {
          last_cron_time: "2024-01-01 10:00:00",
          lastCronRun: "run1",
          last_update_time: "2024-01-02 10:00:00",
          lastUpdatedBy: "u",
          last_cron_message: "ok",
          lowest_vendor_price: 10,
          last_attempted_time: "2024-01-03 10:00:00",
          lowest_vendor: "V",
          lastExistingPrice: 5,
          lastSuggestedPrice: 6,
          next_cron_time: "2024-01-04 10:00:00",
          slowCronName: null,
          slowCronId: null,
          isSlowActivated: false,
        },
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([sqlProductDetails]);
      (mySqlUtility.UpdateVendorData as jest.Mock).mockResolvedValue(undefined);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.GetFullProductDetailsById).toHaveBeenCalledWith(mpid);
      expect(mySqlUtility.UpdateVendorData).toHaveBeenCalledWith(expect.any(Object), "TRADENT");
      expect(mySqlUtility.UpsertProductDetailsV2).toHaveBeenCalled();
    });

    it("inserts tradentDetails when sqlProductDetails has no tradentDetails", async () => {
      const mpid = 101;
      const payload: any = { tradentDetails: { channelId: "c1", isSlowActivated: false } };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([{}]);
      (mySqlUtility.UpsertVendorData as jest.Mock).mockResolvedValue(123);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.UpsertVendorData).toHaveBeenCalledWith(expect.any(Object), "TRADENT");
      expect(payload.tradentDetails.updatedBy).toBe("testuser");
      expect(payload.tradentDetails.updatedAt).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });

    it("updates frontierDetails when present", async () => {
      const mpid = 102;
      const payload = { frontierDetails: { channelId: "c2", isSlowActivated: false } };
      const sqlProductDetails = { frontierDetails: { last_cron_time: null, lastCronRun: null, last_update_time: null, lastUpdatedBy: null, last_cron_message: null, lowest_vendor_price: null, last_attempted_time: null, lowest_vendor: null, lastExistingPrice: null, lastSuggestedPrice: null, next_cron_time: null, slowCronName: null, slowCronId: null, isSlowActivated: false } };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([sqlProductDetails]);
      (mySqlUtility.UpdateVendorData as jest.Mock).mockResolvedValue(undefined);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.UpdateVendorData).toHaveBeenCalledWith(expect.any(Object), "FRONTIER");
    });

    it("inserts frontierDetails when sqlProductDetails has no frontierDetails", async () => {
      const mpid = 103;
      const payload = { frontierDetails: { channelId: "c", isSlowActivated: false } };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([{}]);
      (mySqlUtility.UpsertVendorData as jest.Mock).mockResolvedValue(456);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.UpsertVendorData).toHaveBeenCalledWith(expect.any(Object), "FRONTIER");
    });

    it("updates mvpDetails, firstDentDetails, topDentDetails, triadDetails, biteSupplyDetails", async () => {
      const mpid = 104;
      const payload = {
        mvpDetails: { channelId: "m", isSlowActivated: false },
        firstDentDetails: { channelId: "f", isSlowActivated: false },
        topDentDetails: { channelId: "t", isSlowActivated: false },
        triadDetails: { channelId: "tr", isSlowActivated: false },
        biteSupplyDetails: { channelId: "b", isSlowActivated: false },
      };
      const dbData = {
        last_cron_time: null,
        lastCronRun: null,
        last_update_time: null,
        lastUpdatedBy: null,
        last_cron_message: null,
        lowest_vendor_price: null,
        last_attempted_time: null,
        lowest_vendor: null,
        lastExistingPrice: null,
        lastSuggestedPrice: null,
        next_cron_time: null,
        slowCronName: null,
        slowCronId: null,
        isSlowActivated: false,
      };
      const sqlProductDetails = {
        mvpDetails: dbData,
        firstDentDetails: dbData,
        topDentDetails: dbData,
        triadDetails: dbData,
        biteSupplyDetails: dbData,
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([sqlProductDetails]);
      (mySqlUtility.UpdateVendorData as jest.Mock).mockResolvedValue(undefined);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.UpdateVendorData).toHaveBeenCalledWith(expect.any(Object), "MVP");
      expect(mySqlUtility.UpdateVendorData).toHaveBeenCalledWith(expect.any(Object), "FIRSTDENT");
      expect(mySqlUtility.UpdateVendorData).toHaveBeenCalledWith(expect.any(Object), "TOPDENT");
      expect(mySqlUtility.UpdateVendorData).toHaveBeenCalledWith(expect.any(Object), "TRIAD");
      expect(mySqlUtility.UpdateVendorData).toHaveBeenCalledWith(expect.any(Object), "BITESUPPLY");
    });

    it("inserts vendor details when sqlProductDetails is null (first product)", async () => {
      const mpid = 105;
      const payload: any = { triadDetails: { channelId: "c", isSlowActivated: false } };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([null]);
      (mySqlUtility.UpsertVendorData as jest.Mock).mockResolvedValue(789);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.UpsertVendorData).toHaveBeenCalledWith(expect.any(Object), "TRIAD");
    });

    it("inserts firstDentDetails and topDentDetails when missing in sqlProductDetails", async () => {
      const mpid = 106;
      const payload: any = {
        firstDentDetails: { channelId: "f", isSlowActivated: false },
        topDentDetails: { channelId: "t", isSlowActivated: false },
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([{}]);
      (mySqlUtility.UpsertVendorData as jest.Mock).mockResolvedValue(undefined);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.UpsertVendorData).toHaveBeenCalledWith(expect.any(Object), "FIRSTDENT");
      expect(mySqlUtility.UpsertVendorData).toHaveBeenCalledWith(expect.any(Object), "TOPDENT");
    });

    it("updates firstDentDetails via mapUserDataToDbData when sql has firstDentDetails", async () => {
      const mpid = 107;
      const payload: any = { firstDentDetails: { channelId: "f", isSlowActivated: false } };
      const sqlProductDetails = {
        firstDentDetails: {
          last_cron_time: "2024-01-01 10:00:00",
          lastCronRun: "r",
          last_update_time: "2024-01-02 10:00:00",
          lastUpdatedBy: "u",
          last_cron_message: "ok",
          lowest_vendor_price: 10,
          last_attempted_time: "2024-01-03 10:00:00",
          lowest_vendor: "V",
          lastExistingPrice: 5,
          lastSuggestedPrice: 6,
          next_cron_time: "2024-01-04 10:00:00",
          slowCronName: null,
          slowCronId: null,
          isSlowActivated: false,
        },
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([sqlProductDetails]);
      (mySqlUtility.UpdateVendorData as jest.Mock).mockResolvedValue(undefined);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.UpdateVendorData).toHaveBeenCalledWith(expect.any(Object), "FIRSTDENT");
      expect(payload.firstDentDetails.lastCronTime).toBeDefined();
      expect(payload.firstDentDetails.lastUpdatedByUser).toBe("testuser");
    });

    it("mapUserDataToDbData sets slowCronName/slowCronId and isSlowActivated when payload has isSlowActivated true", async () => {
      const mpid = 108;
      const payload: any = {
        tradentDetails: {
          channelId: "c1",
          isSlowActivated: true,
        },
      };
      const sqlProductDetails = {
        tradentDetails: {
          last_cron_time: null,
          lastCronRun: null,
          last_update_time: null,
          lastUpdatedBy: null,
          last_cron_message: null,
          lowest_vendor_price: null,
          last_attempted_time: null,
          lowest_vendor: null,
          lastExistingPrice: null,
          lastSuggestedPrice: null,
          next_cron_time: null,
          slowCronName: "Slow Cron",
          slowCronId: "slow1",
          isSlowActivated: true,
        },
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([sqlProductDetails]);
      (mySqlUtility.UpdateVendorData as jest.Mock).mockResolvedValue(undefined);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(payload.tradentDetails.slowCronName).toBe("Slow Cron");
      expect(payload.tradentDetails.slowCronId).toBe("slow1");
      expect(payload.tradentDetails.isSlowActivated).toBe(true);
    });

    it("inserts mvpDetails when sqlProductDetails has no mvpDetails", async () => {
      const mpid = 109;
      const payload: any = { mvpDetails: { channelId: "m", isSlowActivated: false } };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([{}]);
      (mySqlUtility.UpsertVendorData as jest.Mock).mockResolvedValue(999);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.UpsertVendorData).toHaveBeenCalledWith(expect.any(Object), "MVP");
    });

    it("inserts triadDetails when sqlProductDetails has no triadDetails", async () => {
      const mpid = 110;
      const payload: any = { triadDetails: { channelId: "t", isSlowActivated: false } };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([{}]);
      (mySqlUtility.UpsertVendorData as jest.Mock).mockResolvedValue(888);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.UpsertVendorData).toHaveBeenCalledWith(expect.any(Object), "TRIAD");
    });

    it("inserts biteSupplyDetails when sqlProductDetails has no biteSupplyDetails", async () => {
      const mpid = 111;
      const payload: any = { biteSupplyDetails: { channelId: "b", isSlowActivated: false } };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([{}]);
      (mySqlUtility.UpsertVendorData as jest.Mock).mockResolvedValue(777);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(mySqlUtility.UpsertVendorData).toHaveBeenCalledWith(expect.any(Object), "BITESUPPLY");
    });

    it("mapUserDataToDbData preserves isSlowActivated when false (uses userData.isSlowActivated)", async () => {
      const mpid = 112;
      const payload: any = {
        topDentDetails: { channelId: "t", isSlowActivated: false },
      };
      const sqlProductDetails = {
        topDentDetails: {
          last_cron_time: null,
          lastCronRun: null,
          last_update_time: null,
          lastUpdatedBy: null,
          last_cron_message: null,
          lowest_vendor_price: null,
          last_attempted_time: null,
          lowest_vendor: null,
          lastExistingPrice: null,
          lastSuggestedPrice: null,
          next_cron_time: null,
          slowCronName: "Slow",
          slowCronId: "s1",
          isSlowActivated: false,
        },
      };
      (mySqlUtility.GetFullProductDetailsById as jest.Mock).mockResolvedValue([sqlProductDetails]);
      (mySqlUtility.UpdateVendorData as jest.Mock).mockResolvedValue(undefined);
      (mySqlUtility.UpsertProductDetailsV2 as jest.Mock).mockResolvedValue(undefined);

      await UpsertProductDetailsInSql(payload, mpid, mockReq);

      expect(payload.topDentDetails.slowCronName).toBeNull();
      expect(payload.topDentDetails.slowCronId).toBeNull();
      expect(payload.topDentDetails.isSlowActivated).toBe(false);
    });
  });
});
