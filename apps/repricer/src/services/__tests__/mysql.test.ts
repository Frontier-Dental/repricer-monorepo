import * as mysqlService from "../mysql";
import * as SqlMapper from "../../utility/mapper/mysql-mapper";
import bcrypt from "bcrypt";

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
  whereNotNull: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockResolvedValue([]),
  leftJoin: jest.fn().mockReturnThis(),
  first: jest.fn(),
  count: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue([1]),
  update: jest.fn().mockResolvedValue(1),
  union: jest.fn().mockReturnThis(),
  distinct: jest.fn().mockResolvedValue([]),
  fn: { now: jest.fn().mockReturnValue("NOW()") },
};
const mockKnexInstance = Object.assign(
  jest.fn((_table: string) => mockKnexChain),
  {
    raw: mockKnexChain.raw,
    union: mockKnexChain.union,
    fn: mockKnexChain.fn,
  }
);
const mockGetKnexInstance = jest.fn(() => mockKnexInstance);

jest.mock("../knex-wrapper", () => ({
  getKnexInstance: () => mockGetKnexInstance(),
  destroyKnexInstance: jest.fn(),
}));

// --- Mock: config (only the keys used by mysql.ts)
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    SQL_SP_GETRUN_INFO: "sp_GetLatestRunInfoByLimit",
    SQL_SP_GETRUN_INFO_BY_CRON: "sp_GetLatestRunInfoForCronByLimit",
    SQL_SP_GET_RECENT_INPROGRESS_SCRAPE_RUNS: "sp_GetRecentInProgressScrapeOnlyRuns",
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
    SQL_SP_GET_ALL_PRODUCT_DETAILS: "sp_GetFullProductDetailsListV4",
    SQL_SP_UPSERT_PRODUCT_DETAILSV4: "sp_UpsertProductDetailsV4",
    SQL_SP_GET_FULL_PRODUCT_DETAILS_BY_ID: "sp_GetFullProductDetailsByIdV4",
    SQL_SP_UPDATE_TRADENT: "sp_UpdateTradentDetailsByIdV3",
    SQL_SP_UPDATE_FRONTIER: "sp_UpdateFrontierDetailsByIdV3",
    SQL_SP_UPDATE_MVP: "sp_UpdateMvpDetailsByIdV3",
    SQL_SP_UPDATE_FIRSTDENT: "sp_UpdateFirstDentDetailsByIdV3",
    SQL_SP_UPDATE_TOPDENT: "sp_UpdateTopDentDetailsByIdV3",
    SQL_SP_UPDATE_TRIAD: "sp_UpdateTriadDetailsByIdV3",
    SQL_SP_UPDATE_BITESUPPLY: "sp_UpdateBiteSupplyDetailsByIdV3",
    SQL_SP_GET_PRODUCT_BY_MPID: "sp_GetProductByMpid",
    SQL_SP_GET_PRODUCT_BY_CHANNEL_ID: "sp_GetProductsByChannelId",
  },
}));

jest.mock("../../utility/mapper/mysql-mapper", () => ({
  MapProductDetailsList: jest.fn((payload: any) => (payload && payload.length ? [{ mapped: true }] : [])),
}));

jest.mock("bcrypt", () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

describe("mysql service", () => {
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
    it("calls knex raw with SP and params, returns result[0]", async () => {
      const out = [[{ runId: 1, start: "2024-01-01" }]];
      mockKnexChain.raw.mockResolvedValue(out);

      const result = await mysqlService.GetLatestRunInfo(5, "2024-01-01", "2024-01-02");

      expect(mockGetKnexInstance).toHaveBeenCalled();
      expect(mockKnexChain.raw).toHaveBeenCalledWith("CALL sp_GetLatestRunInfoByLimit(?,?,?)", [5, "2024-01-01", "2024-01-02"]);
      expect(result).toEqual(out[0]);
    });
  });

  describe("GetLatestRunInfoForCron", () => {
    it("calls knex raw with cron SP and params", async () => {
      const out = [[{ runId: 1 }]];
      mockKnexChain.raw.mockResolvedValue(out);

      const result = await mysqlService.GetLatestRunInfoForCron(5, "2024-01-01", "2024-01-02", "cron-1");

      expect(mockKnexChain.raw).toHaveBeenCalledWith("CALL sp_GetLatestRunInfoForCronByLimit(?,?,?,?)", [5, "2024-01-01", "2024-01-02", "cron-1"]);
      expect(result).toEqual(out[0]);
    });
  });

  describe("GetRecentInProgressScrapeOnlyRuns", () => {
    it("calls knex raw with in-progress SP, no params", async () => {
      const out = [[{ id: 1 }]];
      mockKnexChain.raw.mockResolvedValue(out);

      const result = await mysqlService.GetRecentInProgressScrapeOnlyRuns();

      expect(mockKnexChain.raw).toHaveBeenCalledWith("CALL sp_GetRecentInProgressScrapeOnlyRuns()");
      expect(result).toEqual(out[0]);
    });
  });

  describe("GetNumberOfScrapeProducts", () => {
    it("gets connection, executes count query, returns count, releases connection", async () => {
      mockConnection.execute.mockResolvedValue([[{ "count (Id)": 42 }]]);

      const result = await mysqlService.GetNumberOfScrapeProducts();

      expect(mockGetConnection).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalledWith("select count (Id) from table_scrapeProductList;");
      expect(mockReleaseConnection).toHaveBeenCalledWith(mockConnection);
      expect(result).toBe(42);
    });
  });

  describe("GetScrapeProductList", () => {
    it("calls SP with pageNumber and pageSize, returns first result set", async () => {
      const rows = [{ id: 1, name: "p1" }];
      mockConnection.query.mockResolvedValue([rows]);

      const result = await mysqlService.GetScrapeProductList(1, 10);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetScrapeProductDetails(?,?)", [1, 10]);
      expect(result).toEqual(rows[0]);
      expect(mockReleaseConnection).toHaveBeenCalledWith(mockConnection);
    });
  });

  describe("GetScrapeProductListByFilter", () => {
    it("calls filter SP with pageSize, filterText, pageNumber", async () => {
      const rows = [{ id: 1 }];
      mockConnection.query.mockResolvedValue([rows]);

      const result = await mysqlService.GetScrapeProductListByFilter("filter", 20, 2);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetScrapeProductDetailsByFilter(?,?, ?)", [20, "filter", 2]);
      expect(result).toEqual(rows[0]);
    });
  });

  describe("GetAllScrapeProductDetails", () => {
    it("calls get-all SP and returns first result set", async () => {
      const rows = [{ id: 1 }];
      mockConnection.query.mockResolvedValue([rows]);

      const result = await mysqlService.GetAllScrapeProductDetails();

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetAllScrapeProducts()");
      expect(result).toEqual(rows[0]);
    });
  });

  describe("UpsertProductDetails", () => {
    it("calls upsert SP with payload fields and returns first result", async () => {
      const payload = {
        mpId: "mp1",
        isActive: 1,
        net32Url: "https://u",
        linkedCron: "cron",
        linkedCronId: 2,
        lastUpdatedBy: "u",
        lastUpdatedOn: "2024-01-01",
        isBadgeItem: 0,
      };
      const resultRows = [{ updated: 1 }];
      mockConnection.query.mockResolvedValue([resultRows]);

      const result = await mysqlService.UpsertProductDetails(payload);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_UpsertProductDetailsV2(?,?,?,?,?,?,?,?)", [payload.mpId, payload.isActive, payload.net32Url, payload.linkedCron, payload.linkedCronId, payload.lastUpdatedBy, payload.lastUpdatedOn, payload.isBadgeItem]);
      expect(result).toEqual(resultRows);
    });
  });

  describe("DeleteScrapeProductById", () => {
    it("executes delete by MpId and returns result", async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await mysqlService.DeleteScrapeProductById("mp-123");

      expect(mockConnection.execute).toHaveBeenCalledWith("delete from  table_scrapeProductList where MpId=?", ["mp-123"]);
      expect(result).toEqual([{ affectedRows: 1 }]);
    });
  });

  describe("GetLastScrapeDetailsById", () => {
    it("calls SP with mpId and returns first result set", async () => {
      const rows = [{ mpId: "mp1", lastScrape: "2024-01-01" }];
      mockConnection.query.mockResolvedValue([rows]);

      const result = await mysqlService.GetLastScrapeDetailsById("mp1");

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetLastScrapeDetailsByID(?)", ["mp1"]);
      expect(result).toEqual(rows[0]);
    });
  });

  describe("UpsertVendorData", () => {
    const basePayload = {
      mpid: "123",
      channelName: "TRADENT",
      scrapeOn: 1,
      allowReprice: 1,
      activated: 1,
      unitPrice: 10,
      focusId: "f1",
      requestInterval: 5,
      floorPrice: 1,
      maxPrice: 100,
      channelId: "ch1",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
      updatedBy: "u",
      lastCronTime: "2024-01-03",
      lastUpdateTime: "2024-01-04",
      lastAttemptedTime: "2024-01-05",
      is_nc_needed: 1,
      repricingRule: 1,
      requestIntervalUnit: "min",
      suppressPriceBreak: 0,
      priority: 1,
      last_cron_message: "ok",
      lowest_vendor: "v",
      lowest_vendor_price: 50,
      lastExistingPrice: 50,
      lastSuggestedPrice: 49,
      nextCronTime: "2024-01-06",
      beatQPrice: 0,
      competeAll: 0,
      percentageIncrease: 0,
      suppressPriceBreakForOne: 0,
      compareWithQ1: 0,
      wait_update_period: 0,
      lastCronRun: "2024-01-07",
      abortDeactivatingQPriceBreak: 0,
      badgeIndicator: 0,
      badgePercentage: 0,
      lastUpdatedBy: "u",
      inactiveVendorId: null,
      includeInactiveVendors: 0,
      override_bulk_rule: 0,
      override_bulk_update: 0,
      latest_price: 50,
      executionPriority: 0,
      applyBuyBoxLogic: 0,
      applyNcForBuyBox: 0,
      sisterVendorId: null,
      handlingTimeFilter: null,
      keepPosition: 0,
      excludedVendors: null,
    };

    it("TRADENT: sets contextSpName and returns updatedIdentifier", async () => {
      mockConnection.query.mockResolvedValue([[{ 0: { updatedIdentifier: 999 } }]]);

      const result = await mysqlService.UpsertVendorData({ ...basePayload }, "TRADENT");

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("sp_UpsertTradentDetailsV3"), expect.any(Array));
      expect(result).toBe(999);
    });

    it("FRONTIER: uses FRONTIER SP", async () => {
      mockConnection.query.mockResolvedValue([[{ 0: { updatedIdentifier: 2 } }]]);

      const result = await mysqlService.UpsertVendorData({ ...basePayload }, "FRONTIER");

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("sp_UpsertFrontierDetailsV3"), expect.any(Array));
      expect(result).toBe(2);
    });

    it("MVP, TOPDENT, FIRSTDENT, TRIAD, BITESUPPLY: use correct SP names", async () => {
      const vendors: Array<"MVP" | "TOPDENT" | "FIRSTDENT" | "TRIAD" | "BITESUPPLY"> = ["MVP", "TOPDENT", "FIRSTDENT", "TRIAD", "BITESUPPLY"];
      const spNames = ["sp_UpsertMvpDetailsV3", "sp_UpsertTopDentDetailsV3", "sp_UpsertFirstDentDetailsV3", "sp_UpsertTriadDetailsV3", "sp_UpsertBiteSupplyDetailsV3"];
      for (let i = 0; i < vendors.length; i++) {
        mockConnection.query.mockResolvedValue([[{ 0: { updatedIdentifier: i } }]]);
        const result = await mysqlService.UpsertVendorData({ ...basePayload }, vendors[i]);
        expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining(spNames[i]), expect.any(Array));
        expect(result).toBe(i);
      }
    });

    it("defaults missing payload fields", async () => {
      const minimal = { ...basePayload } as any;
      delete minimal.inventoryThreshold;
      delete minimal.percentageDown;
      delete minimal.badgePercentageDown;
      minimal.competeWithNext = undefined;
      minimal.ignorePhantomQBreak = null;
      minimal.ownVendorThreshold = "";
      minimal.getBBBadge = null;
      minimal.getBBShipping = undefined;
      delete minimal.getBBBadgeValue;
      delete minimal.getBBShippingValue;
      delete minimal.qBreakCount;
      delete minimal.qBreakDetails;
      minimal.badge = undefined;
      mockConnection.query.mockResolvedValue([[{ 0: { updatedIdentifier: 1 } }]]);

      const result = await mysqlService.UpsertVendorData(minimal, "TRADENT");

      expect(result).toBe(1);
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("sp_UpsertTradentDetailsV3"), expect.any(Array));
      const callArgs = mockConnection.query.mock.calls[0][1] as any[];
      expect(callArgs.length).toBeGreaterThanOrEqual(50);
      expect(callArgs.some((v) => v === 0)).toBe(true);
      expect(callArgs.some((v) => v === false)).toBe(true);
      expect(callArgs.some((v) => v === true)).toBe(true);
      expect(callArgs.some((v) => v === null)).toBe(true);
    });

    it("returns null when SP returns no updatedIdentifier", async () => {
      mockConnection.query.mockResolvedValue([[[]]]);

      const result = await mysqlService.UpsertVendorData({ ...basePayload }, "TRADENT");

      expect(result).toBeNull();
    });

    it("returns null when rows[0][0] is null", async () => {
      mockConnection.query.mockResolvedValue([[null]]);

      const result = await mysqlService.UpsertVendorData({ ...basePayload }, "TRADENT");

      expect(result).toBeNull();
    });

    it("unknown vendor: still runs query and release", async () => {
      mockConnection.query.mockResolvedValue([[{ 0: { updatedIdentifier: 0 } }]]);

      await mysqlService.UpsertVendorData({ ...basePayload }, "UNKNOWN");

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("CALL null("), expect.any(Array));
      expect(mockReleaseConnection).toHaveBeenCalledWith(mockConnection);
    });
  });

  describe("UpsertProductDetailsV2", () => {
    it("calls V4 SP with payload and returns first result", async () => {
      const payload = {
        MpId: "mp1",
        IsActive: 1,
        Net32Url: "https://u",
        LinkedCronName: "c",
        LinkedCronId: 1,
        LastUpdatedBy: "u",
        LastUpdatedAt: "2024-01-01",
        ProductName: "P",
        RegularCronName: "r",
        RegularCronId: 2,
        SlowCronName: "s",
        SlowCronId: 3,
        LinkedTradentDetailsInfo: null,
        LinkedFrontiersDetailsInfo: null,
        LinkedMvpDetailsInfo: null,
        IsBadgeItem: 0,
        LinkedTopDentDetailsInfo: null,
        LinkedFirstDentDetailsInfo: null,
        LinkedTriadDetailsInfo: null,
        LinkedBiteSupplyDetailsInfo: null,
      };
      mockConnection.query.mockResolvedValue([[{ ok: 1 }]]);

      const result = await mysqlService.UpsertProductDetailsV2(payload);

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_UpsertProductDetailsV4(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [payload.MpId, payload.IsActive, payload.Net32Url, payload.LinkedCronName, payload.LinkedCronId, payload.LastUpdatedBy, payload.LastUpdatedAt, payload.ProductName, payload.RegularCronName, payload.RegularCronId, payload.SlowCronName, payload.SlowCronId, payload.LinkedTradentDetailsInfo, payload.LinkedFrontiersDetailsInfo, payload.LinkedMvpDetailsInfo, false, payload.IsBadgeItem, payload.LinkedTopDentDetailsInfo, payload.LinkedFirstDentDetailsInfo, payload.LinkedTriadDetailsInfo, payload.LinkedBiteSupplyDetailsInfo]);
      expect(result).toEqual([{ ok: 1 }]);
    });
  });

  describe("GetCompleteProductDetails", () => {
    it("calls get-all SP and maps result with SqlMapper", async () => {
      const rows = [{ ProductId: "1", ChannelName: "TRADENT" }];
      mockConnection.query.mockResolvedValue([rows]);
      (SqlMapper.MapProductDetailsList as jest.Mock).mockReturnValue([{ mapped: true }]);

      const result = await mysqlService.GetCompleteProductDetails();

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetFullProductDetailsListV4()");
      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(rows[0]);
      expect(result).toEqual([{ mapped: true }]);
    });

    it("passes null to mapper when rows[0] is null", async () => {
      mockConnection.query.mockResolvedValue([[null]]);
      (SqlMapper.MapProductDetailsList as jest.Mock).mockReturnValue([]);

      const result = await mysqlService.GetCompleteProductDetails();

      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(null);
      expect(result).toEqual([]);
    });
  });

  describe("GetNumberOfRepriceEligibleProductCount", () => {
    it("returns totalCount - nullCount from knex", async () => {
      mockKnexChain.first.mockResolvedValueOnce({ count: 100 }).mockResolvedValueOnce({ count: 10 });

      const result = await mysqlService.GetNumberOfRepriceEligibleProductCount();

      expect(mockKnexInstance).toHaveBeenCalledWith("table_scrapeProductList");
      expect(result).toBe(90);
    });
  });

  describe("GetAllRepriceEligibleProductByFilter", () => {
    it("returns empty array when no paginated MpIds", async () => {
      mockKnexChain.offset.mockResolvedValue([]);

      const result = await mysqlService.GetAllRepriceEligibleProductByFilter(0, 10);

      expect(result).toEqual([]);
    });

    it("fetches paginated MpIds, builds union, maps result", async () => {
      mockKnexChain.offset.mockResolvedValue([{ MpId: "mp1" }, { MpId: "mp2" }]);
      mockKnexChain.union.mockImplementation(() => mockKnexChain);
      mockKnexChain.orderBy.mockImplementation((col: string) => (col === "ProductId" ? Promise.resolve([{ ProductId: "mp1" }, { ProductId: "mp2" }]) : mockKnexChain));
      (SqlMapper.MapProductDetailsList as jest.Mock).mockReturnValue([{ mpId: "mp1" }, { mpId: "mp2" }]);

      const result = await mysqlService.GetAllRepriceEligibleProductByFilter(1, 5);

      expect(mockKnexChain.offset).toHaveBeenCalledWith(5);
      expect(mockKnexChain.limit).toHaveBeenCalledWith(5);
      expect(mockKnexChain.union).toHaveBeenCalled();
      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith([{ ProductId: "mp1" }, { ProductId: "mp2" }]);
      expect(result).toEqual([{ mpId: "mp1" }, { mpId: "mp2" }]);
    });
  });

  describe("GetAllRepriceEligibleProductByTag", () => {
    it("returns empty array when no matching MpIds", async () => {
      mockKnexChain.union.mockImplementation(() => mockKnexChain);
      mockKnexChain.distinct.mockResolvedValue([]);

      const result = await mysqlService.GetAllRepriceEligibleProductByTag(null, null);

      expect(result).toEqual([]);
    });

    it("with mpId and channelId builds union and maps", async () => {
      mockKnexChain.union.mockImplementation(() => mockKnexChain);
      mockKnexChain.distinct.mockResolvedValue([{ MpId: "mp1" }]);
      mockKnexChain.orderBy.mockResolvedValue([{ ProductId: "mp1" }]);
      (SqlMapper.MapProductDetailsList as jest.Mock).mockReturnValue([{ mpId: "mp1" }]);

      const result = await mysqlService.GetAllRepriceEligibleProductByTag("mp1", "ch1");

      expect(result).toEqual([{ mpId: "mp1" }]);
    });
  });

  describe("GetFullProductDetailsById", () => {
    it("calls SP with mpid and maps result", async () => {
      const rows = [{ ProductId: "mp1" }];
      mockConnection.query.mockResolvedValue([rows]);
      (SqlMapper.MapProductDetailsList as jest.Mock).mockReturnValue([{ mpId: "mp1" }]);

      const result = await mysqlService.GetFullProductDetailsById("mp1");

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetFullProductDetailsByIdV4(?)", ["mp1"]);
      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(rows[0]);
      expect(result).toEqual([{ mpId: "mp1" }]);
    });

    it("passes null to mapper when rows[0] is null", async () => {
      mockConnection.query.mockResolvedValue([[null]]);
      (SqlMapper.MapProductDetailsList as jest.Mock).mockReturnValue([]);

      const result = await mysqlService.GetFullProductDetailsById("mp1");

      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(null);
      expect(result).toEqual([]);
    });
  });

  describe("UpdateVendorData", () => {
    const updatePayload = {
      mpid: "123",
      channelName: "TRADENT",
      scrapeOn: 1,
      allowReprice: 1,
      activated: 1,
      unitPrice: "10",
      focusId: "f1",
      requestInterval: 5,
      floorPrice: "1",
      maxPrice: "100",
      channelId: "ch1",
      lastUpdatedOn: "2024-01-01",
      lastUpdatedByUser: "u",
      lastCronTime: "2024-01-02",
      lastUpdateTime: "2024-01-03",
      lastAttemptedTime: "2024-01-04",
      is_nc_needed: 1,
      repricingRule: 1,
      requestIntervalUnit: "min",
      suppressPriceBreak: 0,
      priority: "1",
      last_cron_message: "ok",
      lowest_vendor: "v",
      lowest_vendor_price: 50,
      lastExistingPrice: 50,
      lastSuggestedPrice: 49,
      nextCronTime: "2024-01-05",
      beatQPrice: 0,
      competeAll: 0,
      percentageIncrease: 0,
      suppressPriceBreakForOne: 0,
      compareWithQ1: 0,
      wait_update_period: 0,
      lastCronRun: "2024-01-06",
      abortDeactivatingQPriceBreak: 0,
      badgeIndicator: 0,
      badgePercentage: 0,
      lastUpdatedBy: "u",
      inactiveVendorId: null,
      includeInactiveVendors: 0,
      override_bulk_rule: 0,
      override_bulk_update: 0,
      latest_price: "50",
      executionPriority: 0,
      applyBuyBoxLogic: 0,
      applyNcForBuyBox: 0,
      sisterVendorId: null,
      handlingTimeFilter: null,
      keepPosition: 0,
      excludedVendors: null,
    };

    it("TRADENT: calls update SP and returns updatedIdentifier", async () => {
      mockConnection.query.mockResolvedValue([[{ 0: { updatedIdentifier: 5 } }]]);

      const result = await mysqlService.UpdateVendorData(updatePayload, "TRADENT");

      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("sp_UpdateTradentDetailsByIdV3"), expect.any(Array));
      expect(result).toBe(5);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/UPDATE_RESULT : 123 :/));
    });

    it("all vendor names use correct update SP", async () => {
      const vendors: Array<"FRONTIER" | "MVP" | "FIRSTDENT" | "TOPDENT" | "TRIAD" | "BITESUPPLY"> = ["FRONTIER", "MVP", "FIRSTDENT", "TOPDENT", "TRIAD", "BITESUPPLY"];
      const spNames = ["sp_UpdateFrontierDetailsByIdV3", "sp_UpdateMvpDetailsByIdV3", "sp_UpdateFirstDentDetailsByIdV3", "sp_UpdateTopDentDetailsByIdV3", "sp_UpdateTriadDetailsByIdV3", "sp_UpdateBiteSupplyDetailsByIdV3"];
      for (let i = 0; i < vendors.length; i++) {
        mockConnection.query.mockResolvedValue([[{ 0: { updatedIdentifier: i } }]]);
        const result = await mysqlService.UpdateVendorData(updatePayload, vendors[i]);
        expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining(spNames[i]), expect.any(Array));
        expect(result).toBe(i);
      }
    });

    it("defaults missing fields and returns null when no result", async () => {
      const minimal = { ...updatePayload } as any;
      delete minimal.inventoryThreshold;
      delete minimal.percentageDown;
      minimal.competeWithNext = null;
      minimal.ownVendorThreshold = null;
      mockConnection.query.mockResolvedValue([[[]]]);

      const result = await mysqlService.UpdateVendorData(minimal, "TRADENT");

      expect(result).toBeNull();
    });
  });

  describe("GetLinkedVendorDetails", () => {
    it("TRADENT: queries table_tradentDetails and returns Id", async () => {
      mockConnection.execute.mockResolvedValue([[{ Id: 42 }]]);

      const result = await mysqlService.GetLinkedVendorDetails("mp1", "TRADENT");

      expect(mockConnection.execute).toHaveBeenCalledWith("select Id from table_tradentDetails where MpId=?", ["mp1"]);
      expect(result).toBe(42);
    });

    it("FRONTIER, MVP, TOPDENT, FIRSTDENT, TRIAD, BITESUPPLY: correct table", async () => {
      const cases: Array<[string, string]> = [
        ["FRONTIER", "table_frontierDetails"],
        ["MVP", "table_mvpDetails"],
        ["TOPDENT", "table_topDentDetails"],
        ["FIRSTDENT", "table_firstDentDetails"],
        ["TRIAD", "table_triadDetails"],
        ["BITESUPPLY", "table_biteSupplyDetails"],
      ];
      for (const [vendor, table] of cases) {
        mockConnection.execute.mockResolvedValue([[{ Id: 1 }]]);
        await mysqlService.GetLinkedVendorDetails("mp1", vendor);
        expect(mockConnection.execute).toHaveBeenCalledWith(`select Id from ${table} where MpId=?`, ["mp1"]);
      }
    });
  });

  describe("UpdateProductV2", () => {
    it("executes update with itemData and vendor ids", async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);
      const itemData = {
        cronName: "cron",
        cronId: 1,
        slowCronName: "slow",
        slowCronId: 2,
        isSlowActivated: 1,
      };

      const result = await mysqlService.UpdateProductV2("1", itemData, 10, 20, 30);

      expect(mockConnection.execute).toHaveBeenCalledWith("update table_scrapeProductList set RegularCronName=?,RegularCronId=?,SlowCronName=?,SlowCronId=?,LinkedTradentDetailsInfo=?,LinkedFrontiersDetailsInfo=?,LinkedMvpDetailsInfo=?,IsSlowActivated=? where MpId=?", ["cron", 1, "slow", 2, 10, 20, 30, 1, 1]);
      expect(result).toEqual([{ affectedRows: 1 }]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Updated in DB for 1/));
    });
  });

  describe("ChangeProductActivation", () => {
    it("updates all vendor tables and returns last result", async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await mysqlService.ChangeProductActivation("1", 1);

      expect(mockConnection.execute).toHaveBeenCalledTimes(7);
      expect(mockConnection.execute).toHaveBeenCalledWith("update table_tradentDetails set Activated=? where MpId=?", [1, 1]);
      expect(mockConnection.execute).toHaveBeenCalledWith("update table_biteSupplyDetails set Activated=? where MpId=?", [1, 1]);
      expect(result).toEqual([{ affectedRows: 1 }]);
    });
  });

  describe("MapVendorToRoot", () => {
    it("fetches vendor ids, then updates scrape product list", async () => {
      mockConnection.execute
        .mockResolvedValueOnce([[{ Id: 1 }]])
        .mockResolvedValueOnce([[{ Id: 2 }]])
        .mockResolvedValueOnce([[{ Id: 3 }]])
        .mockResolvedValueOnce([[{ affectedRows: 1 }]]);

      const result = await mysqlService.MapVendorToRoot({
        MPID: "123",
        CronName: " CronName ",
        CronId: 5,
      });

      expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining("LinkedTradentDetailsInfo"), [1, 2, 3, "CronName", 5, 123]);
      expect((result as any).affectedRows).toBe(1);
      expect(consoleTraceSpy).toHaveBeenCalled();
    });
  });

  describe("ToggleDataScrapeForId", () => {
    it("updates IsActive, LastUpdatedBy, LastUpdatedAt by MpId", async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await mysqlService.ToggleDataScrapeForId("1", 1, {
        UpdatedBy: "user",
        UpdatedOn: "2024-01-01",
      });

      expect(mockConnection.execute).toHaveBeenCalledWith("update table_scrapeProductList set IsActive=?,LastUpdatedBy=?,LastUpdatedAt=? where MpId=?", [1, "user", "2024-01-01", 1]);
      expect(result).toEqual([{ affectedRows: 1 }]);
    });
  });

  describe("UpdateBranchDataForVendor", () => {
    it("TRADENT: updates table_tradentDetails with payload", async () => {
      mockConnection.execute.mockResolvedValue([[{ affectedRows: 1 }]]);
      const payLoad = {
        activated: "true",
        channelId: "ch1",
        is_nc_needed: "true",
        badgeIndicator: "B",
        repricingRule: "1",
        floorPrice: "10",
        maxPrice: "100",
        unitPrice: "50",
      };

      const result = await mysqlService.UpdateBranchDataForVendor("1", "TRADENT", payLoad);

      expect(mockConnection.execute).toHaveBeenCalledWith("Update table_tradentDetails set Activated=?,ChannelId=?,IsNCNeeded=?,BadgeIndicator=?,RepricingRule=?,FloorPrice=?,MaxPrice=?,UnitPrice=? where MpId=?", [true, "ch1", true, "B", 1, 10, 100, 50, 1]);
      expect(result).toEqual({ affectedRows: 1 });
    });

    it("FRONTIER, MVP, FIRSTDENT, TOPDENT, TRIAD, BITESUPPLY: correct table", async () => {
      const vendors = ["FRONTIER", "MVP", "FIRSTDENT", "TOPDENT", "TRIAD", "BITESUPPLY"] as const;
      const tables = ["table_frontierDetails", "table_mvpDetails", "table_firstDentDetails", "table_topDentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      const payLoad = {
        activated: "false",
        channelId: "ch",
        is_nc_needed: "false",
        badgeIndicator: "",
        repricingRule: "0",
        floorPrice: "0",
        maxPrice: "0",
        unitPrice: "0",
      };
      for (let i = 0; i < vendors.length; i++) {
        mockConnection.execute.mockResolvedValue([[{ affectedRows: 1 }]]);
        await mysqlService.UpdateBranchDataForVendor("1", vendors[i], payLoad);
        expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining(tables[i]), expect.any(Array));
      }
    });
  });

  describe("ExecuteQuery", () => {
    it("gets connection, executes query with params, releases", async () => {
      mockConnection.execute.mockResolvedValue([[{ id: 1 }]]);

      const result = await mysqlService.ExecuteQuery("SELECT 1", [1]);

      expect(mockConnection.execute).toHaveBeenCalledWith("SELECT 1", [1]);
      expect(mockReleaseConnection).toHaveBeenCalledWith(mockConnection);
      expect(result).toEqual([[{ id: 1 }]]);
    });
  });

  describe("CreateUser", () => {
    it("inserts username and password into users and returns userId", async () => {
      mockKnexChain.insert.mockResolvedValue([42]);

      const result = await mysqlService.CreateUser("alice", "hashed");

      expect(mockGetKnexInstance).toHaveBeenCalled();
      expect(mockKnexChain.insert).toHaveBeenCalledWith({
        username: "alice",
        password: "hashed",
      });
      expect(result).toBe(42);
    });
  });

  describe("AuthenticateUser", () => {
    it("returns user without password when password matches", async () => {
      mockKnexChain.select.mockReturnValue(mockKnexChain);
      mockKnexChain.where.mockReturnValue(mockKnexChain);
      mockKnexChain.first.mockResolvedValue({
        id: 1,
        username: "alice",
        password: "$2b$10$hashed",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await mysqlService.AuthenticateUser("alice", "secret");

      expect(mockKnexChain.where).toHaveBeenCalledWith("username", "alice");
      expect(bcrypt.compare).toHaveBeenCalledWith("secret", "$2b$10$hashed");
      expect(result).toEqual({ id: 1, username: "alice" });
    });

    it("returns null when user not found", async () => {
      mockKnexChain.select.mockReturnValue(mockKnexChain);
      mockKnexChain.where.mockReturnValue(mockKnexChain);
      mockKnexChain.first.mockResolvedValue(undefined);

      const result = await mysqlService.AuthenticateUser("nobody", "pwd");

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("returns null when password invalid", async () => {
      mockKnexChain.select.mockReturnValue(mockKnexChain);
      mockKnexChain.where.mockReturnValue(mockKnexChain);
      mockKnexChain.first.mockResolvedValue({
        id: 1,
        username: "alice",
        password: "$2b$10$hashed",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await mysqlService.AuthenticateUser("alice", "wrong");

      expect(result).toBeNull();
    });
  });

  describe("ChangePassword", () => {
    it("returns true when update affects rows", async () => {
      mockKnexChain.where.mockReturnValue(mockKnexChain);
      mockKnexChain.update.mockResolvedValue(1);

      const result = await mysqlService.ChangePassword("alice", "newhash");

      expect(mockKnexChain.where).toHaveBeenCalledWith("username", "alice");
      expect(mockKnexChain.update).toHaveBeenCalledWith({
        password: "newhash",
        updated_at: mockKnexChain.fn.now(),
      });
      expect(result).toBe(true);
    });

    it("returns false when no rows updated", async () => {
      mockKnexChain.where.mockReturnValue(mockKnexChain);
      mockKnexChain.update.mockResolvedValue(0);

      const result = await mysqlService.ChangePassword("alice", "newhash");

      expect(result).toBe(false);
    });
  });

  describe("CheckUserExists", () => {
    it("returns user when found", async () => {
      mockKnexChain.select.mockReturnValue(mockKnexChain);
      mockKnexChain.where.mockReturnValue(mockKnexChain);
      mockKnexChain.first.mockResolvedValue({ id: 1, username: "alice" });

      const result = await mysqlService.CheckUserExists("alice");

      expect(result).toEqual({ id: 1, username: "alice" });
    });

    it("returns null when not found", async () => {
      mockKnexChain.select.mockReturnValue(mockKnexChain);
      mockKnexChain.where.mockReturnValue(mockKnexChain);
      mockKnexChain.first.mockResolvedValue(undefined);

      const result = await mysqlService.CheckUserExists("nobody");

      expect(result).toBeNull();
    });
  });

  describe("GetAllRepriceEligibleProductByMpid", () => {
    it("calls SP, maps result and returns", async () => {
      const rows = [{ ProductId: "mp1" }];
      mockConnection.query.mockResolvedValue([rows]);
      (SqlMapper.MapProductDetailsList as jest.Mock).mockResolvedValue([{ mpId: "mp1" }]);

      const result = await mysqlService.GetAllRepriceEligibleProductByMpid("mp1");

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetProductByMpid(?)", ["mp1"]);
      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(rows[0]);
      expect(await result).toEqual([{ mpId: "mp1" }]);
    });

    it("on exception logs and still returns mapper result for null", async () => {
      mockConnection.query.mockRejectedValue(new Error("DB error"));
      (SqlMapper.MapProductDetailsList as jest.Mock).mockResolvedValue([]);

      const result = await mysqlService.GetAllRepriceEligibleProductByMpid("mp1");

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Exception while GetAllRepriceEligibleProductByMpid/));
      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(null);
      expect(await result).toEqual([]);
    });
  });

  describe("GetAllRepriceEligibleProductByChannelId", () => {
    it("calls SP by channel id and maps result", async () => {
      const rows = [{ ProductId: "mp1" }];
      mockConnection.query.mockResolvedValue([rows]);
      (SqlMapper.MapProductDetailsList as jest.Mock).mockResolvedValue([{ mpId: "mp1" }]);

      const result = await mysqlService.GetAllRepriceEligibleProductByChannelId("ch1");

      expect(mockConnection.query).toHaveBeenCalledWith("CALL sp_GetProductsByChannelId(?)", ["ch1"]);
      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(rows[0]);
      expect(await result).toEqual([{ mpId: "mp1" }]);
    });

    it("on exception logs and returns mapper result for null", async () => {
      mockConnection.query.mockRejectedValue(new Error("DB error"));
      (SqlMapper.MapProductDetailsList as jest.Mock).mockResolvedValue([]);

      await mysqlService.GetAllRepriceEligibleProductByChannelId("ch1");

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Exception while GetAllRepriceEligibleProductByChannelId/));
      expect(SqlMapper.MapProductDetailsList).toHaveBeenCalledWith(null);
    });
  });
});
