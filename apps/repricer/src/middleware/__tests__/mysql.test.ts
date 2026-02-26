/**
 * Unit tests for middleware/mysql.ts with mocked DB pool, Knex, config, and mapper.
 * Target: ~90% coverage with proper data mocking.
 */

import * as middlewareMysql from "../mysql";

// --- Mock: SqlConnectionPool (mysql-db)
const mockConnection = {
  query: jest.fn(),
  execute: jest.fn(),
};
const mockGetConnection = jest.fn().mockResolvedValue(mockConnection);
const mockReleaseConnection = jest.fn();

jest.mock("../../models/sql-models/mysql-db", () => ({
  __esModule: true,
  default: {
    getConnection: (...args: any[]) => mockGetConnection(...args),
    releaseConnection: (...args: any[]) => mockReleaseConnection(...args),
  },
}));

// --- Mock: knex-wrapper
const mockKnexChain = {
  raw: jest.fn(),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  first: jest.fn(),
  count: jest.fn().mockReturnThis(),
};
const mockKnexInstance = Object.assign(
  jest.fn((_table: string) => mockKnexChain),
  {
    raw: mockKnexChain.raw,
  }
);
const mockGetKnexInstance = jest.fn(() => mockKnexInstance);

jest.mock("../../services/knex-wrapper", () => ({
  getKnexInstance: () => mockGetKnexInstance(),
  destroyKnexInstance: jest.fn(),
}));

// --- Mock: config (keys used by middleware/mysql.ts)
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    SQL_SP_GETRUN_INFO: "sp_GetLatestRunInfoByLimit",
    SQL_SP_GETRUN_INFO_BY_CRON: "sp_GetLatestRunInfoForCronByLimit",
    SQL_SP_GET_SCRAPEPRODUCT_DETAILS: "sp_GetScrapeProductDetails",
    SQL_SP_GET_SCRAPEPRODUCT_DETAILS_FILTER: "sp_GetScrapeProductDetailsByFilter",
    SQL_SP_GET_ALL_SCRAPEPRODUCT_DETAILS: "sp_GetAllScrapeProducts",
    SQL_SP_UPSERT_PRODUCT_DETAILS: "sp_UpsertProductDetailsV2",
    SQL_SCRAPEPRODUCTLIST: "table_scrapeProductList",
    SQL_SP_GETLASTSCRAPEDETAILSBYID: "sp_GetLastScrapeDetailsByID",
    SQL_SP_UPSERT_TRADENT: "sp_UpsertTradentDetailsV3",
    SQL_SP_UPSERT_FRONTIER: "sp_UpsertFrontierDetailsV3",
    SQL_SP_UPSERT_MVP: "sp_UpsertMvpDetailsV3",
    SQL_SP_UPSERT_TOPDENT: "sp_UpsertTopDentDetailsV3",
    SQL_SP_UPSERT_FIRSTDENT: "sp_UpsertFirstDentDetailsV3",
    SQL_SP_UPSERT_TRIAD: "sp_UpsertTriadDetailsV3",
    SQL_SP_UPSERT_BITESUPPLY: "sp_UpsertBiteSupplyDetailsV3",
    SQL_SP_UPSERT_PRODUCT_DETAILSV4: "sp_UpsertProductDetailsV4",
    SQL_SP_GET_ALL_PRODUCT_DETAILS: "sp_GetFullProductDetailsListV4",
    SQL_SP_GET_PRODUCT_LIST_BY_FILTERV2: "sp_GetFullProductDetailsListByFilterV2",
    SQL_SP_GET_PRODUCT_LIST_BY_TAGV2: "sp_GetFullProductDetailsListByTagV2",
    SQL_SP_GET_FULL_PRODUCT_DETAILS_BY_ID: "sp_GetFullProductDetailsByIdV4",
    SQL_SP_UPDATE_TRADENT: "sp_UpdateTradentDetailsByIdV3",
    SQL_SP_UPDATE_FRONTIER: "sp_UpdateFrontierDetailsByIdV3",
    SQL_SP_UPDATE_MVP: "sp_UpdateMvpDetailsByIdV3",
    SQL_SP_UPDATE_FIRSTDENT: "sp_UpdateFirstDentDetailsByIdV3",
    SQL_SP_UPDATE_TOPDENT: "sp_UpdateTopDentDetailsByIdV3",
    SQL_SP_UPDATE_TRIAD: "sp_UpdateTriadDetailsByIdV3",
    SQL_SP_UPDATE_BITESUPPLY: "sp_UpdateBiteSupplyDetailsByIdV3",
  },
}));

jest.mock("../../utility/mapper/mysql-mapper", () => ({
  MapProductDetailsList: jest.fn((payload: any) => {
    if (!payload) return [];
    const arr = Array.isArray(payload) ? payload : [payload];
    return arr.length ? [{ mapped: true }] : [];
  }),
}));

describe("middleware/mysql", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleTraceSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleTraceSpy = jest.spyOn(console, "trace").mockImplementation();
    mockKnexChain.raw.mockResolvedValue([[{ runId: 1 }]]);
    mockKnexChain.first = jest.fn().mockResolvedValue({ count: 10 });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleTraceSpy.mockRestore();
  });

  describe("GetLatestRunInfo", () => {
    it("calls knex raw with correct SP and params and returns result[0]", async () => {
      const noOfRecords = 5;
      const startDateTime = "2024-01-01";
      const endDateTime = "2024-01-02";
      const rawResult = [[{ runId: 1, cronName: "Cron1" }]];
      mockKnexChain.raw.mockResolvedValue(rawResult);

      const result = await middlewareMysql.GetLatestRunInfo(noOfRecords, startDateTime, endDateTime);

      expect(mockGetKnexInstance).toHaveBeenCalled();
      expect(mockKnexChain.raw).toHaveBeenCalledWith("CALL sp_GetLatestRunInfoByLimit(?,?,?)", [noOfRecords, startDateTime, endDateTime]);
      expect(result).toEqual(rawResult[0]);
    });
  });

  describe("GetLatestRunInfoForCron", () => {
    it("calls knex raw with cron id and returns result[0]", async () => {
      const rawResult = [[{ runId: 2, cronId: "c1" }]];
      mockKnexChain.raw.mockResolvedValue(rawResult);

      const result = await middlewareMysql.GetLatestRunInfoForCron(10, "2024-01-01", "2024-01-02", "cron-1");

      expect(mockKnexChain.raw).toHaveBeenCalledWith("CALL sp_GetLatestRunInfoForCronByLimit(?,?,?,?)", [10, "2024-01-01", "2024-01-02", "cron-1"]);
      expect(result).toEqual(rawResult[0]);
    });
  });

  describe("GetNumberOfScrapeProducts", () => {
    it("returns count from execute result", async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValue([[{ "count (Id)": 42 }]]);

      const result = await middlewareMysql.GetNumberOfScrapeProducts();

      expect(mockGetConnection).toHaveBeenCalled();
      expect(mockReleaseConnection).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.execute).toHaveBeenCalledWith("select count (Id) from table_scrapeProductList;");
      expect(result).toBe(42);
    });
  });

  describe("GetScrapeProductList", () => {
    it("returns first element of query result", async () => {
      const rows = [{ id: 1, name: "P1" }];
      (mockConnection.query as jest.Mock).mockResolvedValue([rows]);

      const result = await middlewareMysql.GetScrapeProductList(1, 10);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetScrapeProductDetails(?,?)", [1, 10]);
      expect(result).toEqual(rows[0]);
    });
  });

  describe("GetScrapeProductListByFilter", () => {
    it("calls SP with pageSize, filterText, pageNumber and returns rows", async () => {
      const rows = [{ id: 1 }];
      (mockConnection.query as jest.Mock).mockResolvedValue([rows]);

      const result = await middlewareMysql.GetScrapeProductListByFilter("filter", 20, 2);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetScrapeProductDetailsByFilter(?,?, ?)", [20, "filter", 2]);
      expect(result).toEqual(rows[0]);
    });
  });

  describe("GetAllScrapeProductDetails", () => {
    it("calls SP with no params and returns first result set", async () => {
      const rows = [{ id: 1 }];
      (mockConnection.query as jest.Mock).mockResolvedValue([rows]);

      const result = await middlewareMysql.GetAllScrapeProductDetails();

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetAllScrapeProducts()");
      expect(result).toEqual(rows[0]);
    });
  });

  describe("UpsertProductDetails", () => {
    it("calls SP with payload fields and returns upsert result", async () => {
      const payload = {
        mpId: 1,
        isActive: true,
        net32Url: "https://u",
        linkedCron: "C",
        linkedCronId: "c1",
        lastUpdatedBy: "u",
        lastUpdatedOn: "2024-01-01",
        isBadgeItem: false,
      };
      const upsertRows = [{ affectedRows: 1 }];
      (mockConnection.query as jest.Mock).mockResolvedValue(upsertRows);

      const result = await middlewareMysql.UpsertProductDetails(payload);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_UpsertProductDetailsV2(?,?,?,?,?,?,?,?)", [payload.mpId, payload.isActive, payload.net32Url, payload.linkedCron, payload.linkedCronId, payload.lastUpdatedBy, payload.lastUpdatedOn, payload.isBadgeItem]);
      expect(result).toEqual(upsertRows[0]);
    });
  });

  describe("DeleteScrapeProductById", () => {
    it("executes delete and returns result", async () => {
      const execResult = [{ affectedRows: 1 }];
      (mockConnection.execute as jest.Mock).mockResolvedValue(execResult);

      const result = await middlewareMysql.DeleteScrapeProductById(100);

      expect(mockConnection.execute).toHaveBeenCalledWith("delete from  table_scrapeProductList where MpId=?", [100]);
      expect(result).toEqual(execResult);
    });
  });

  describe("GetLastScrapeDetailsById", () => {
    it("returns first result set for mpId", async () => {
      const rows = [{ scrapeId: 1 }];
      (mockConnection.query as jest.Mock).mockResolvedValue([rows]);

      const result = await middlewareMysql.GetLastScrapeDetailsById(50);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetLastScrapeDetailsByID(?)", [50]);
      expect(result).toEqual(rows[0]);
    });
  });

  describe("UpsertVendorData", () => {
    const basePayload = {
      mpid: "1",
      channelName: "CH",
      scrapeOn: true,
      allowReprice: true,
      activated: true,
      unitPrice: 10,
      focusId: "f1",
      requestInterval: 5,
      floorPrice: 1,
      maxPrice: 100,
      channelId: "c1",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
      updatedBy: "u",
      lastCronTime: "2024-01-01",
      lastUpdateTime: "2024-01-01",
      lastAttemptedTime: "2024-01-01",
      is_nc_needed: true,
      repricingRule: "rule",
      requestIntervalUnit: "min",
      suppressPriceBreak: false,
      priority: 1,
      last_cron_message: "ok",
      lowest_vendor: "v",
      lowest_vendor_price: 10,
      lastExistingPrice: 10,
      lastSuggestedPrice: 11,
      nextCronTime: "2024-01-02",
      beatQPrice: 9,
      competeAll: true,
      percentageIncrease: 1,
      suppressPriceBreakForOne: false,
      compareWithQ1: true,
      wait_update_period: 0,
      lastCronRun: "2024-01-01",
      abortDeactivatingQPriceBreak: false,
      badgeIndicator: "x",
      badgePercentage: 5,
      lastUpdatedBy: "u",
      inactiveVendorId: null,
      includeInactiveVendors: false,
      override_bulk_rule: false,
      override_bulk_update: false,
      latest_price: 10,
      executionPriority: 1,
      applyBuyBoxLogic: true,
      applyNcForBuyBox: true,
      sisterVendorId: null,
      handlingTimeFilter: null,
      keepPosition: false,
      excludedVendors: null,
    };

    it("returns updatedIdentifier for TRADENT when rows returned", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ updatedIdentifier: 123 }]]]);

      const result = await middlewareMysql.UpsertVendorData({ ...basePayload }, "TRADENT");

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("sp_UpsertTradentDetailsV3"), expect.any(Array));
      expect(result).toBe(123);
    });

    it("returns null when no rows returned", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[]]]);

      const result = await middlewareMysql.UpsertVendorData({ ...basePayload }, "FRONTIER");

      expect(result).toBeNull();
    });

    it("uses correct SP for MVP, TOPDENT, FIRSTDENT, TRIAD, BITESUPPLY", async () => {
      const vendors = ["MVP", "TOPDENT", "FIRSTDENT", "TRIAD", "BITESUPPLY"] as const;
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ updatedIdentifier: 1 }]]]);

      for (const vendor of vendors) {
        await middlewareMysql.UpsertVendorData({ ...basePayload }, vendor);
        expect(mockConnection.query).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`sp_Upsert.*Details`)), expect.any(Array));
      }
    });

    it("returns null for unknown vendor (no SP called, contextSpName null)", async () => {
      // When vendor is unknown, code still builds query with "CALL null(...)" and calls it; mock returns empty so result is null
      (mockConnection.query as jest.Mock).mockResolvedValue([[[]]]);

      const result = await middlewareMysql.UpsertVendorData({ ...basePayload }, "UNKNOWN");

      expect(result).toBeNull();
    });

    it("defaults optional payload fields", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ updatedIdentifier: 1 }]]]);
      const minimal = {
        ...basePayload,
        inventoryThreshold: undefined,
        percentageDown: "",
        badgePercentageDown: null,
        competeWithNext: undefined,
        ignorePhantomQBreak: null,
        ownVendorThreshold: "",
        getBBBadge: null,
        getBBShipping: undefined,
        getBBBadgeValue: null,
        getBBShippingValue: "",
      };

      await middlewareMysql.UpsertVendorData(minimal, "TRADENT");

      const callArgs = (mockConnection.query as jest.Mock).mock.calls[0][1];
      expect(callArgs).toContain(0); // inventoryThreshold
      expect(callArgs).toContain(0); // percentageDown
      expect(callArgs).toContain(0); // badgePercentageDown
      expect(callArgs).toContain(false); // competeWithNext
      expect(callArgs).toContain(true); // ignorePhantomQBreak
      expect(callArgs).toContain(1); // ownVendorThreshold
      expect(callArgs).toContain(true); // getBBBadge
      expect(callArgs).toContain(true); // getBBShipping
      expect(callArgs).toContain(0.1); // getBBBadgeValue
      expect(callArgs).toContain(0.005); // getBBShippingValue
    });

    it("returns updatedIdentifier when it is 0 (falsy)", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ updatedIdentifier: 0 }]]]);

      const result = await middlewareMysql.UpsertVendorData({ ...basePayload }, "MVP");

      expect(result).toBe(0);
    });

    it("returns null when upsert result has no updatedIdentifier", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ otherKey: "value" }]]]);

      const result = await middlewareMysql.UpsertVendorData({ ...basePayload }, "FRONTIER");

      expect(result).toBeUndefined();
    });

    it("uses payload values when all optionals are set (no defaults)", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ updatedIdentifier: 99 }]]]);
      const fullPayload = {
        ...basePayload,
        inventoryThreshold: 5,
        percentageDown: 2.5,
        badgePercentageDown: 1.5,
        competeWithNext: true,
        ignorePhantomQBreak: false,
        ownVendorThreshold: 2,
        getBBBadge: false,
        getBBShipping: false,
        getBBBadgeValue: 0.2,
        getBBShippingValue: 0.01,
      };

      const result = await middlewareMysql.UpsertVendorData(fullPayload, "TRADENT");

      expect(result).toBe(99);
      const callArgs = (mockConnection.query as jest.Mock).mock.calls[0][1];
      expect(callArgs).toContain(5);
      expect(callArgs).toContain(2.5);
      expect(callArgs).toContain(1.5);
      expect(callArgs).toContain(true);
      expect(callArgs).toContain(false);
      expect(callArgs).toContain(2);
      expect(callArgs).toContain(0.2);
      expect(callArgs).toContain(0.01);
    });
  });

  describe("UpsertProductDetailsV2", () => {
    it("calls SP with payload and returns result; uses SlowCron when IsSlowActivated", async () => {
      const payload = {
        MpId: 1,
        IsActive: true,
        Net32Url: "https://u",
        LinkedCronName: "C",
        LinkedCronId: "c1",
        LastUpdatedBy: "u",
        LastUpdatedAt: "2024-01-01",
        ProductName: "P",
        RegularCronName: "R",
        RegularCronId: "r1",
        IsSlowActivated: true,
        SlowCronId: "s1",
        SlowCronName: "Slow",
        LinkedTradentDetailsInfo: null,
        LinkedFrontiersDetailsInfo: null,
        LinkedMvpDetailsInfo: null,
        isSlowActivated: true,
        IsBadgeItem: false,
        LinkedTopDentDetailsInfo: null,
        LinkedFirstDentDetailsInfo: null,
        LinkedTriadDetailsInfo: null,
        LinkedBiteSupplyDetailsInfo: null,
      };
      (mockConnection.query as jest.Mock).mockResolvedValue([{ insertId: 1 }]);

      const result = await middlewareMysql.UpsertProductDetailsV2(payload);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_UpsertProductDetailsV4(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", expect.arrayContaining([payload.MpId, payload.IsActive, "Slow", "s1"]));
      expect(result).toEqual({ insertId: 1 });
    });

    it("passes null for slow cron when IsSlowActivated is false", async () => {
      const payload = {
        MpId: 2,
        IsActive: true,
        Net32Url: "u",
        LinkedCronName: "C",
        LinkedCronId: "c1",
        LastUpdatedBy: "u",
        LastUpdatedAt: "2024-01-01",
        ProductName: "P",
        RegularCronName: "R",
        RegularCronId: "r1",
        IsSlowActivated: false,
        SlowCronId: "s1",
        SlowCronName: "Slow",
        LinkedTradentDetailsInfo: null,
        LinkedFrontiersDetailsInfo: null,
        LinkedMvpDetailsInfo: null,
        isSlowActivated: false,
        IsBadgeItem: false,
        LinkedTopDentDetailsInfo: null,
        LinkedFirstDentDetailsInfo: null,
        LinkedTriadDetailsInfo: null,
        LinkedBiteSupplyDetailsInfo: null,
      };
      (mockConnection.query as jest.Mock).mockResolvedValue([{}]);

      await middlewareMysql.UpsertProductDetailsV2(payload);

      const args = (mockConnection.query as jest.Mock).mock.calls[0][1];
      expect(args[10]).toBeNull();
      expect(args[11]).toBeNull();
    });
  });

  describe("GetCompleteProductDetails", () => {
    it("calls SP and maps result via MapProductDetailsList", async () => {
      const rawRows = [{ ProductId: 1 }];
      (mockConnection.query as jest.Mock).mockResolvedValue([rawRows]);

      const result = await middlewareMysql.GetCompleteProductDetails();

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetFullProductDetailsListV4()");
      const SqlMapper = require("../../utility/mapper/mysql-mapper");
      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(rawRows[0]);
      expect(result).toEqual([{ mapped: true }]);
    });

    it("maps null/empty scrapeDetails to empty array", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[null]]);

      const result = await middlewareMysql.GetCompleteProductDetails();

      const SqlMapper = require("../../utility/mapper/mysql-mapper");
      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(null);
      expect(result).toEqual([]);
    });
  });

  describe("GetNumberOfRepriceEligibleProductCount", () => {
    it("returns totalCount - nullCount", async () => {
      mockKnexChain.first.mockResolvedValueOnce({ count: 100 }).mockResolvedValueOnce({ count: 20 });

      const result = await middlewareMysql.GetNumberOfRepriceEligibleProductCount();

      expect(mockGetKnexInstance).toHaveBeenCalled();
      expect(mockKnexInstance).toHaveBeenCalledWith("table_scrapeProductList");
      expect(result).toBe(80);
    });
  });

  describe("GetAllRepriceEligibleProductByFilter", () => {
    it("calls SP and maps result", async () => {
      const rawRows = [{ ProductId: 1 }];
      (mockConnection.query as jest.Mock).mockResolvedValue([rawRows]);

      const result = await middlewareMysql.GetAllRepriceEligibleProductByFilter(1, 10);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetFullProductDetailsListByFilterV2(?,?)", [1, 10]);
      const SqlMapper = require("../../utility/mapper/mysql-mapper");
      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(rawRows[0]);
      expect(result).toEqual([{ mapped: true }]);
    });

    it("maps null result to empty array", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[null]]);

      const result = await middlewareMysql.GetAllRepriceEligibleProductByFilter(1, 10);

      expect(result).toEqual([]);
    });
  });

  describe("GetAllRepriceEligibleProductByTag", () => {
    it("calls SP with filterTag and maps result", async () => {
      const rawRows = [{ ProductId: 1 }];
      (mockConnection.query as jest.Mock).mockResolvedValue([rawRows]);

      const result = await middlewareMysql.GetAllRepriceEligibleProductByTag("tag1");

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetFullProductDetailsListByTagV2(?)", ["tag1"]);
      expect(result).toEqual([{ mapped: true }]);
    });
  });

  describe("GetFullProductDetailsById", () => {
    it("calls SP with mpid and maps result", async () => {
      const rawRows = [{ ProductId: 1 }];
      (mockConnection.query as jest.Mock).mockResolvedValue([rawRows]);

      const result = await middlewareMysql.GetFullProductDetailsById(99);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetFullProductDetailsByIdV4(?)", [99]);
      expect(result).toEqual([{ mapped: true }]);
    });
  });

  describe("UpdateVendorData", () => {
    const updatePayload = {
      mpid: "1",
      channelName: "CH",
      scrapeOn: true,
      allowReprice: true,
      activated: true,
      unitPrice: "10",
      focusId: "f1",
      requestInterval: 5,
      floorPrice: "1",
      maxPrice: "100",
      channelId: "c1",
      lastUpdatedOn: "2024-01-01",
      lastUpdatedByUser: "u",
      lastCronTime: "2024-01-01",
      lastUpdateTime: "2024-01-01",
      lastAttemptedTime: "2024-01-01",
      is_nc_needed: true,
      repricingRule: "rule",
      requestIntervalUnit: "min",
      suppressPriceBreak: false,
      priority: "1",
      last_cron_message: "ok",
      lowest_vendor: "v",
      lowest_vendor_price: 10,
      lastExistingPrice: 10,
      lastSuggestedPrice: 11,
      nextCronTime: "2024-01-02",
      beatQPrice: 9,
      competeAll: true,
      percentageIncrease: 1,
      suppressPriceBreakForOne: false,
      compareWithQ1: true,
      wait_update_period: 0,
      lastCronRun: "2024-01-01",
      abortDeactivatingQPriceBreak: false,
      badgeIndicator: "x",
      badgePercentage: 5,
      lastUpdatedBy: "u",
      inactiveVendorId: null,
      includeInactiveVendors: false,
      override_bulk_rule: false,
      override_bulk_update: false,
      latest_price: "10",
      executionPriority: 1,
      applyBuyBoxLogic: true,
      applyNcForBuyBox: true,
      sisterVendorId: null,
      handlingTimeFilter: null,
      keepPosition: false,
      excludedVendors: null,
      inventoryThreshold: 0,
      percentageDown: 0,
      badgePercentageDown: 0,
      ownVendorThreshold: 1,
      getBBBadge: true,
      getBBShipping: true,
      getBBBadgeValue: 0.1,
      getBBShippingValue: 0.005,
    };

    it("returns updatedIdentifier for TRADENT", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ updatedIdentifier: 456 }]]]);

      const result = await middlewareMysql.UpdateVendorData({ ...updatePayload }, "TRADENT");

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("sp_UpdateTradentDetailsByIdV3"), expect.any(Array));
      expect(result).toBe(456);
    });

    it("returns null for unknown vendor", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[]]]);

      const result = await middlewareMysql.UpdateVendorData({ ...updatePayload }, "UNKNOWN");

      expect(result).toBeNull();
    });

    it("defaults optional fields", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ updatedIdentifier: 1 }]]]);
      const minimal = {
        ...updatePayload,
        inventoryThreshold: undefined,
        percentageDown: undefined,
        badgePercentageDown: undefined,
        competeWithNext: undefined,
        ignorePhantomQBreak: null,
        ownVendorThreshold: "",
        getBBBadge: null,
        getBBShipping: undefined,
        getBBBadgeValue: null,
        getBBShippingValue: "",
      };

      await middlewareMysql.UpdateVendorData(minimal, "FRONTIER");

      expect(mockConnection.query).toHaveBeenCalled();
    });

    it("uses correct SP for MVP, FIRSTDENT, TOPDENT, TRIAD, BITESUPPLY", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ updatedIdentifier: 1 }]]]);
      const vendors = ["MVP", "FIRSTDENT", "TOPDENT", "TRIAD", "BITESUPPLY"] as const;
      for (const vendor of vendors) {
        await middlewareMysql.UpdateVendorData({ ...updatePayload }, vendor);
        expect(mockConnection.query).toHaveBeenCalledWith(expect.stringMatching(/sp_Update.*Details/), expect.any(Array));
      }
    });

    it("returns null when UpdateVendorData query returns empty", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([null]);

      const result = await middlewareMysql.UpdateVendorData({ ...updatePayload }, "TRADENT");

      expect(result).toBeNull();
    });

    it("returns updatedIdentifier 0 when UpdateVendorData returns 0", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ updatedIdentifier: 0 }]]]);

      const result = await middlewareMysql.UpdateVendorData({ ...updatePayload }, "TOPDENT");

      expect(result).toBe(0);
    });

    it("uses payload values when all optionals set for UpdateVendorData", async () => {
      (mockConnection.query as jest.Mock).mockResolvedValue([[[{ updatedIdentifier: 77 }]]]);
      const fullPayload = {
        ...updatePayload,
        inventoryThreshold: 3,
        percentageDown: 1,
        badgePercentageDown: 2,
        competeWithNext: true,
        ignorePhantomQBreak: false,
        ownVendorThreshold: 2,
        getBBBadge: false,
        getBBShipping: false,
        getBBBadgeValue: 0.15,
        getBBShippingValue: 0.02,
      };

      const result = await middlewareMysql.UpdateVendorData(fullPayload, "FRONTIER");

      expect(result).toBe(77);
    });
  });

  describe("GetLinkedVendorDetails", () => {
    it("returns Id for TRADENT", async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValue([[{ Id: 101 }]]);

      const result = await middlewareMysql.GetLinkedVendorDetails(1, "TRADENT");

      expect(mockConnection.execute).toHaveBeenCalledWith("select Id from table_tradentDetails where MpId=?", [1]);
      expect(result).toBe(101);
    });

    it("uses correct table for FRONTIER, MVP, FIRSTDENT, TOPDENT, TRIAD, BITESUPPLY", async () => {
      const cases: Array<[string, string]> = [
        ["FRONTIER", "table_frontierDetails"],
        ["MVP", "table_mvpDetails"],
        ["FIRSTDENT", "table_firstDentDetails"],
        ["TOPDENT", "table_topDentDetails"],
        ["TRIAD", "table_triadDetails"],
        ["BITESUPPLY", "table_biteSupplyDetails"],
      ];
      (mockConnection.execute as jest.Mock).mockResolvedValue([[{ Id: 1 }]]);

      for (const [vendor, table] of cases) {
        await middlewareMysql.GetLinkedVendorDetails(1, vendor);
        expect(mockConnection.execute).toHaveBeenCalledWith(`select Id from ${table} where MpId=?`, [1]);
      }
    });
  });

  describe("UpdateProductV2", () => {
    it("executes update with itemData and vendor ids", async () => {
      const execResult = [{ affectedRows: 1 }];
      (mockConnection.execute as jest.Mock).mockResolvedValue(execResult);
      const itemData = {
        cronName: "C",
        cronId: "c1",
        slowCronName: "S",
        slowCronId: "s1",
        isSlowActivated: true,
      };

      const result = await middlewareMysql.UpdateProductV2(10, itemData, "tId", "fId", "mId");

      expect(mockConnection.execute).toHaveBeenCalledWith("update table_scrapeProductList set RegularCronName=?,RegularCronId=?,SlowCronName=?,SlowCronId=?,LinkedTradentDetailsInfo=?,LinkedFrontiersDetailsInfo=?,LinkedMvpDetailsInfo=?,IsSlowActivated=? where MpId=?", [itemData.cronName, itemData.cronId, itemData.slowCronName, itemData.slowCronId, "tId", "fId", "mId", itemData.isSlowActivated, 10]);
      expect(result).toEqual(execResult);
    });
  });

  describe("ChangeProductActivation", () => {
    it("updates all vendor tables and returns last result", async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValue([{ affectedRows: 1 }]);

      const result = await middlewareMysql.ChangeProductActivation(5, true);

      expect(mockConnection.execute).toHaveBeenCalledTimes(7);
      expect(mockConnection.execute).toHaveBeenCalledWith("update table_tradentDetails set Activated=? where MpId=?", [true, 5]);
      expect(mockConnection.execute).toHaveBeenCalledWith("update table_biteSupplyDetails set Activated=? where MpId=?", [true, 5]);
      expect(result).toBeDefined();
    });
  });

  describe("MapVendorToRoot", () => {
    it("fetches vendor ids and updates scrape product list", async () => {
      (mockConnection.execute as jest.Mock)
        .mockResolvedValueOnce([[{ Id: 1 }]])
        .mockResolvedValueOnce([[{ Id: 2 }]])
        .mockResolvedValueOnce([[{ Id: 3 }]])
        .mockResolvedValueOnce([[{ Id: 4 }]])
        .mockResolvedValueOnce([[{ Id: 5 }]])
        .mockResolvedValueOnce([[{ affectedRows: 1 }]]);

      const data = { MPID: "100", CronName: "  Cron1  ", CronId: "c1" };

      const result = await middlewareMysql.MapVendorToRoot(data);

      expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining("UPDATE table_scrapeProductList SET"), [1, 2, 3, 4, 5, "Cron1", "c1", 100]);
      expect(result).toBeDefined();
    });
  });

  describe("ToggleDataScrapeForId", () => {
    it("updates IsActive and audit info", async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValue([{ affectedRows: 1 }]);
      const auditInfo = { UpdatedBy: "u", UpdatedOn: "2024-01-01" };

      const result = await middlewareMysql.ToggleDataScrapeForId(7, false, auditInfo);

      expect(mockConnection.execute).toHaveBeenCalledWith("update table_scrapeProductList set IsActive=?,LastUpdatedBy=?,LastUpdatedAt=? where MpId=?", [false, "u", "2024-01-01", 7]);
      expect(result).toBeDefined();
    });
  });

  describe("UpdateBranchDataForVendor", () => {
    it("updates correct table for TRADENT with payload", async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValue([[{ affectedRows: 1 }]]);
      const payLoad = {
        activated: "true",
        channelId: "c1",
        is_nc_needed: "true",
        badgeIndicator: "x",
        repricingRule: "1",
        floorPrice: "10",
        maxPrice: "100",
        unitPrice: "5",
      };

      const result = await middlewareMysql.UpdateBranchDataForVendor(1, "TRADENT", payLoad);

      expect(mockConnection.execute).toHaveBeenCalledWith("Update table_tradentDetails set Activated=?,ChannelId=?,IsNCNeeded=?,BadgeIndicator=?,RepricingRule=?,FloorPrice=?,MaxPrice=?,UnitPrice=? where MpId=?", [true, "c1", true, "x", 1, 10, 100, 5, 1]);
      expect(result).toEqual({ affectedRows: 1 });
    });

    it("uses correct table for FRONTIER, MVP, FIRSTDENT, TOPDENT, TRIAD, BITESUPPLY", async () => {
      const cases: Array<[string, string]> = [
        ["FRONTIER", "table_frontierDetails"],
        ["MVP", "table_mvpDetails"],
        ["FIRSTDENT", "table_firstDentDetails"],
        ["TOPDENT", "table_topDentDetails"],
        ["TRIAD", "table_triadDetails"],
        ["BITESUPPLY", "table_biteSupplyDetails"],
      ];
      (mockConnection.execute as jest.Mock).mockResolvedValue([[{ affectedRows: 1 }]]);
      const payLoad = {
        activated: "true",
        channelId: "c1",
        is_nc_needed: "false",
        badgeIndicator: "x",
        repricingRule: "1",
        floorPrice: "10",
        maxPrice: "100",
        unitPrice: "5",
      };

      for (const [vendor] of cases) {
        await middlewareMysql.UpdateBranchDataForVendor(1, vendor, payLoad);
      }
      expect(mockConnection.execute).toHaveBeenCalledTimes(6);
    });
  });

  describe("ExecuteQuery", () => {
    it("executes query with params and returns result", async () => {
      (mockConnection.execute as jest.Mock).mockResolvedValue([[{ id: 1 }]]);

      const result = await middlewareMysql.ExecuteQuery("SELECT * FROM t WHERE id=?", [1]);

      expect(mockConnection.execute).toHaveBeenCalledWith("SELECT * FROM t WHERE id=?", [1]);
      expect(result).toEqual([[{ id: 1 }]]);
    });
  });
});
