/**
 * Unit tests for mysql service: query building, parameter binding, result transformation.
 * Dependencies (SqlConnectionPool, knex, config, SqlMapper, bcrypt, mysql2) are mocked.
 */

import bcrypt from "bcrypt";

const mockReleaseConnection = jest.fn();
const mockQuery = jest.fn();
const mockExecute = jest.fn();

const mockConnection = {
  query: mockQuery,
  execute: mockExecute,
  release: jest.fn(),
};

const mockGetConnection = jest.fn().mockResolvedValue(mockConnection);

jest.mock("../../models/sql-models/mysql-db", () => ({
  __esModule: true,
  default: {
    getConnection: mockGetConnection,
    releaseConnection: mockReleaseConnection,
  },
}));

jest.mock("../../utility/config", () => ({
  applicationConfig: {
    SQL_PASSWORD: "plainPasswordNoColon",
    REPRICER_ENCRYPTION_KEY: "test-key-32-bytes-long!!!!!!!!",
    SQL_SP_GETRUN_INFO: "sp_GetLatestRunInfo",
    SQL_SP_GETRUN_INFO_BY_CRON: "sp_GetLatestRunInfoForCron",
    SQL_SP_GET_SCRAPEPRODUCT_DETAILS: "sp_GetScrapeProductDetails",
    SQL_SP_GET_SCRAPEPRODUCT_DETAILS_FILTER: "sp_GetScrapeProductDetailsByFilter",
    SQL_SP_GET_ALL_SCRAPEPRODUCT_DETAILS: "sp_GetAllScrapeProducts",
    SQL_SCRAPEPRODUCTLIST: "table_scrapeProductList",
    SQL_SP_UPSERT_PRODUCT_DETAILS: "sp_UpsertProductDetails",
    SQL_SP_GETLASTSCRAPEDETAILSBYID: "sp_GetLastScrapeDetailsByID",
    SQL_SP_UPSERT_TRADENT: "sp_UpsertTradent",
    SQL_SP_UPSERT_FRONTIER: "sp_UpsertFrontier",
    SQL_SP_UPSERT_MVP: "sp_UpsertMvp",
    SQL_SP_UPSERT_TOPDENT: "sp_UpsertTopDent",
    SQL_SP_UPSERT_FIRSTDENT: "sp_UpsertFirstDent",
    SQL_SP_UPSERT_TRIAD: "sp_UpsertTriad",
    SQL_SP_UPSERT_BITESUPPLY: "sp_UpsertBiteSupply",
    SQL_SP_UPSERT_PRODUCT_DETAILSV4: "sp_UpsertProductDetailsV4",
    SQL_SP_GET_ALL_PRODUCT_DETAILS: "sp_GetFullProductDetailsList",
    SQL_SP_GET_FULL_PRODUCT_DETAILS_BY_ID: "sp_GetFullProductDetailsById",
    SQL_SP_UPDATE_TRADENT: "sp_UpdateTradent",
    SQL_SP_UPDATE_FRONTIER: "sp_UpdateFrontier",
    SQL_SP_UPDATE_MVP: "sp_UpdateMvp",
    SQL_SP_UPDATE_FIRSTDENT: "sp_UpdateFirstDent",
    SQL_SP_UPDATE_TOPDENT: "sp_UpdateTopDent",
    SQL_SP_UPDATE_TRIAD: "sp_UpdateTriad",
    SQL_SP_UPDATE_BITESUPPLY: "sp_UpdateBiteSupply",
    SQL_SP_GET_PRODUCT_BY_MPID: "sp_GetProductByMpid",
    SQL_SP_GET_PRODUCT_BY_CHANNEL_ID: "sp_GetProductsByChannelId",
  },
}));

const mockMapProductDetailsList = jest.fn();
const mockToCronSettingsModel = jest.fn();
jest.mock("../../utility/mapper/mysql-mapper", () => ({
  MapProductDetailsList: (...args: unknown[]) => mockMapProductDetailsList(...args),
  ToCronSettingsModel: (...args: unknown[]) => mockToCronSettingsModel(...args),
}));

const mockKnexRaw = jest.fn();

const createChain = (resolvedValue?: unknown) => {
  const first = jest.fn().mockResolvedValue(resolvedValue);
  const chain: Record<string, unknown> = {
    _resolveValue: undefined as unknown,
    count: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    union: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    first,
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockReturnThis(),
    map: jest.fn(function (this: { MpId: number }[], cb: (r: { MpId: number }) => number) {
      return (this || []).map(cb);
    }),
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      const p = (chain as any)._resolveValue !== undefined ? Promise.resolve((chain as any)._resolveValue) : first.mock.calls.length > 0 ? first() : Promise.resolve((chain as any)._resolveValue);
      return p.then(onFulfilled, onRejected);
    },
    catch: (fn: (e: unknown) => unknown) => Promise.resolve((chain as any)._resolveValue).catch(fn),
  };
  return chain as Record<string, jest.Mock> & { _resolveValue: unknown; then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>; catch: (fn: (e: unknown) => unknown) => Promise<unknown> };
};

let knexTableChain = createChain({ count: 0 });
const mockKnexInstance = Object.assign((table: string) => knexTableChain, {
  raw: mockKnexRaw,
  fn: { now: jest.fn(() => "NOW()") },
  union: jest.fn().mockReturnValue({
    orderBy: jest.fn().mockResolvedValue([{ ProductId: 1 }]),
  }),
});

jest.mock("../knex-wrapper", () => ({
  getKnexInstance: () => mockKnexInstance,
}));

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
}));

const mockQueryStream = jest.fn();
const mockDestroy = jest.fn();
const mockConnect = jest.fn();

jest.mock("mysql2", () => {
  const actual = jest.requireActual("mysql2");
  return {
    ...actual,
    createConnection: jest.fn(() => ({
      connect: mockConnect,
      query: mockQueryStream,
      destroy: mockDestroy,
    })),
  };
});

import * as mysqlService from "../mysql";

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockReset();
  mockExecute.mockReset();
  mockGetConnection.mockResolvedValue(mockConnection);
  mockMapProductDetailsList.mockImplementation((x: unknown) => x ?? []);
  mockToCronSettingsModel.mockResolvedValue({});
  knexTableChain._resolveValue = undefined;
});

describe("mysql service", () => {
  describe("tryDecrypt / module load", () => {
    it("uses plain password when SQL_PASSWORD has no colon", async () => {
      mockExecute.mockResolvedValue([[{ "count (Id)": 42 }]]);
      await mysqlService.GetNumberOfScrapeProducts();
      expect(mockGetConnection).toHaveBeenCalled();
    });
  });

  describe("GetLatestRunInfo", () => {
    it("calls knex raw with SP name and params", async () => {
      mockKnexRaw.mockResolvedValue([[{ runId: 1 }]]);
      const result = await mysqlService.GetLatestRunInfo(10, "2024-01-01", "2024-01-02");
      expect(mockKnexRaw).toHaveBeenCalledWith("CALL sp_GetLatestRunInfo(?,?,?)", [10, "2024-01-01", "2024-01-02"]);
      expect(result).toEqual([{ runId: 1 }]);
    });
  });

  describe("GetLatestRunInfoForCron", () => {
    it("calls knex raw with SP and cronId", async () => {
      mockKnexRaw.mockResolvedValue([[{ runId: 2 }]]);
      const result = await mysqlService.GetLatestRunInfoForCron(5, "2024-01-01", "2024-01-02", "cron-1");
      expect(mockKnexRaw).toHaveBeenCalledWith("CALL sp_GetLatestRunInfoForCron(?,?,?,?)", [5, "2024-01-01", "2024-01-02", "cron-1"]);
      expect(result).toEqual([{ runId: 2 }]);
    });
  });

  describe("GetNumberOfScrapeProducts", () => {
    it("builds count query and returns transformed result", async () => {
      mockExecute.mockResolvedValue([[{ "count (Id)": 42 }]]);
      const result = await mysqlService.GetNumberOfScrapeProducts();
      expect(mockGetConnection).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledWith("select count (Id) from table_scrapeProductList;");
      expect(mockReleaseConnection).toHaveBeenCalledWith(mockConnection);
      expect(result).toBe(42);
    });
  });

  describe("GetScrapeProductList", () => {
    it("calls SP with pageNumber and pageSize and returns first result set", async () => {
      const rows = [{ id: 1, name: "P1" }];
      mockQuery.mockResolvedValue([rows, undefined]);
      const result = await mysqlService.GetScrapeProductList(1, 10);
      expect(mockQuery).toHaveBeenCalledWith("CALL sp_GetScrapeProductDetails(?,?)", [1, 10]);
      expect(result).toEqual(rows[0]);
      expect(mockReleaseConnection).toHaveBeenCalledWith(mockConnection);
    });
  });

  describe("GetScrapeProductListByFilter", () => {
    it("calls filter SP with pageSize, filterText, pageNumber", async () => {
      const rows = [{ id: 2 }];
      mockQuery.mockResolvedValue([rows, undefined]);
      const result = await mysqlService.GetScrapeProductListByFilter("filter", 20, 0);
      expect(mockQuery).toHaveBeenCalledWith("CALL sp_GetScrapeProductDetailsByFilter(?,?, ?)", [20, "filter", 0]);
      expect(result).toEqual(rows[0]);
    });
  });

  describe("GetAllScrapeProductDetails", () => {
    it("calls get-all SP with no params and returns first result set", async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      mockQuery.mockResolvedValue([rows, undefined]);
      const result = await mysqlService.GetAllScrapeProductDetails();
      expect(mockQuery).toHaveBeenCalledWith("CALL sp_GetAllScrapeProducts()");
      expect(result).toEqual(rows[0]);
    });
  });

  describe("UpsertProductDetails", () => {
    it("calls SP with payload fields in correct order", async () => {
      const payload = {
        mpId: 100,
        isActive: true,
        net32Url: "https://example.com",
        linkedCron: "cron1",
        linkedCronId: 1,
        lastUpdatedBy: "user",
        lastUpdatedOn: "2024-01-01",
        isBadgeItem: false,
      };
      mockQuery.mockResolvedValue([{ insertId: 1 }]);
      const result = await mysqlService.UpsertProductDetails(payload);
      expect(mockQuery).toHaveBeenCalledWith("CALL sp_UpsertProductDetails(?,?,?,?,?,?,?,?)", [payload.mpId, payload.isActive, payload.net32Url, payload.linkedCron, payload.linkedCronId, payload.lastUpdatedBy, payload.lastUpdatedOn, payload.isBadgeItem]);
      expect(result).toEqual({ insertId: 1 });
    });
  });

  describe("DeleteScrapeProductById", () => {
    it("executes delete with MpId parameter", async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
      await mysqlService.DeleteScrapeProductById(999);
      expect(mockExecute).toHaveBeenCalledWith("delete from  table_scrapeProductList where MpId=?", [999]);
      expect(mockReleaseConnection).toHaveBeenCalledWith(mockConnection);
    });
  });

  describe("GetLastScrapeDetailsById", () => {
    it("calls SP with mpId and returns first result set", async () => {
      const rows = [{ lastScrape: "2024-01-01" }];
      mockQuery.mockResolvedValue([rows, undefined]);
      const result = await mysqlService.GetLastScrapeDetailsById(100);
      expect(mockQuery).toHaveBeenCalledWith("CALL sp_GetLastScrapeDetailsByID(?)", [100]);
      expect(result).toEqual(rows[0]);
    });
  });

  describe("UpsertVendorData", () => {
    const basePayload = {
      mpid: 1,
      channelName: "CH1",
      scrapeOn: true,
      allowReprice: true,
      activated: true,
      unitPrice: 10,
      focusId: "f1",
      requestInterval: 1,
      floorPrice: 5,
      maxPrice: 20,
      channelId: "cid1",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
      updatedBy: "u1",
      lastCronTime: "2024-01-01",
      lastUpdateTime: "2024-01-02",
      lastAttemptedTime: "2024-01-01",
      is_nc_needed: true,
      repricingRule: 1,
      requestIntervalUnit: "min",
      suppressPriceBreak: false,
      priority: 1,
      last_cron_message: "ok",
      lowest_vendor: "V1",
      lowest_vendor_price: "1.0",
      lastExistingPrice: "2.0",
      lastSuggestedPrice: "3.0",
      nextCronTime: "2024-01-03",
      beatQPrice: false,
      competeAll: false,
      percentageIncrease: 5,
      suppressPriceBreakForOne: false,
      compareWithQ1: false,
      wait_update_period: 0,
      lastCronRun: "reprice",
      abortDeactivatingQPriceBreak: false,
      badgeIndicator: "ALL_ZERO",
      badgePercentage: 10,
      lastUpdatedBy: "u1",
      inactiveVendorId: "",
      includeInactiveVendors: false,
      override_bulk_rule: 0,
      override_bulk_update: false,
      latest_price: 1,
      executionPriority: 1,
      applyBuyBoxLogic: false,
      applyNcForBuyBox: false,
      sisterVendorId: "",
      handlingTimeFilter: "FAST",
      keepPosition: false,
      excludedVendors: "",
      inventoryThreshold: 0,
      percentageDown: 0,
      badgePercentageDown: 0,
      competeWithNext: false,
      ignorePhantomQBreak: true,
      ownVendorThreshold: 1,
      getBBBadge: false,
      getBBShipping: false,
      getBBBadgeValue: 0,
      getBBShippingValue: 0,
    };

    it("uses TRADENT SP when vendorName is TRADENT", async () => {
      mockQuery.mockResolvedValue([[[{ updatedIdentifier: 101 }]]]);
      const result = await mysqlService.UpsertVendorData({ ...basePayload }, "TRADENT");
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("sp_UpsertTradent"), expect.any(Array));
      expect(result).toBe(101);
    });

    it("uses FRONTIER SP when vendorName is FRONTIER", async () => {
      mockQuery.mockResolvedValue([[{ 0: [{ updatedIdentifier: 102 }] }]]);
      await mysqlService.UpsertVendorData({ ...basePayload }, "FRONTIER");
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("sp_UpsertFrontier"), expect.any(Array));
    });

    it("uses MVP, TOPDENT, FIRSTDENT, TRIAD, BITESUPPLY SPs for respective vendor", async () => {
      const vendors = ["MVP", "TOPDENT", "FIRSTDENT", "TRIAD", "BITESUPPLY"] as const;
      const spNames: Record<string, string> = {
        MVP: "UpsertMvp",
        TOPDENT: "UpsertTopDent",
        FIRSTDENT: "UpsertFirstDent",
        TRIAD: "UpsertTriad",
        BITESUPPLY: "UpsertBiteSupply",
      };
      for (const v of vendors) {
        mockQuery.mockResolvedValue([[[{ updatedIdentifier: 1 }]]]);
        await mysqlService.UpsertVendorData({ ...basePayload }, v);
        expect(mockQuery).toHaveBeenLastCalledWith(expect.stringContaining(`sp_${spNames[v]}`), expect.any(Array));
      }
    });

    it("defaults payload and returns null when no contextSpName (unknown vendor)", async () => {
      const payload = { ...basePayload };
      delete (payload as any).inventoryThreshold;
      delete (payload as any).percentageDown;
      delete (payload as any).badgePercentageDown;
      delete (payload as any).competeWithNext;
      delete (payload as any).ignorePhantomQBreak;
      delete (payload as any).ownVendorThreshold;
      delete (payload as any).getBBBadge;
      delete (payload as any).getBBShipping;
      delete (payload as any).getBBBadgeValue;
      delete (payload as any).getBBShippingValue;
      mockQuery.mockResolvedValue([null]);
      const result = await mysqlService.UpsertVendorData(payload, "UNKNOWN_VENDOR");
      expect(result).toBeNull();
    });

    it("returns null when query result has no updatedIdentifier", async () => {
      mockQuery.mockResolvedValue([[[]]]);
      const result = await mysqlService.UpsertVendorData({ ...basePayload }, "TRADENT");
      expect(result).toBeNull();
    });

    it("returns null when rows[0][0] is null", async () => {
      mockQuery.mockResolvedValue([[null]]);
      const result = await mysqlService.UpsertVendorData({ ...basePayload }, "TRADENT");
      expect(result).toBeNull();
    });
  });

  describe("UpsertProductDetailsV2", () => {
    it("calls SP with payload and returns first element", async () => {
      const payload = {
        MpId: 1,
        IsActive: true,
        Net32Url: "u",
        LinkedCronName: "c",
        LinkedCronId: 1,
        LastUpdatedBy: "u",
        LastUpdatedAt: "d",
        ProductName: "P",
        RegularCronName: "r",
        RegularCronId: 1,
        SlowCronName: "s",
        SlowCronId: 1,
        LinkedTradentDetailsInfo: null,
        LinkedFrontiersDetailsInfo: null,
        LinkedMvpDetailsInfo: null,
        IsBadgeItem: false,
        LinkedTopDentDetailsInfo: null,
        LinkedFirstDentDetailsInfo: null,
        LinkedTriadDetailsInfo: null,
        LinkedBiteSupplyDetailsInfo: null,
      };
      mockQuery.mockResolvedValue([{ insertId: 1 }]);
      const result = await mysqlService.UpsertProductDetailsV2(payload);
      expect(mockQuery).toHaveBeenCalledWith("CALL sp_UpsertProductDetailsV4(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", expect.any(Array));
      expect(result).toEqual({ insertId: 1 });
    });
  });

  describe("GetCompleteProductDetails", () => {
    it("calls SP and maps result via SqlMapper.MapProductDetailsList", async () => {
      const rawRows = [{ ProductId: 1, ChannelName: "C1" }];
      mockQuery.mockResolvedValue([rawRows, undefined]);
      const mapped = [{ mpId: 1, channelName: "C1" }];
      mockMapProductDetailsList.mockReturnValue(mapped);
      const result = await mysqlService.GetCompleteProductDetails();
      expect(mockQuery).toHaveBeenCalledWith("CALL sp_GetFullProductDetailsList()");
      expect(mockMapProductDetailsList).toHaveBeenCalledWith(rawRows[0]);
      expect(result).toEqual(mapped);
      expect(mockReleaseConnection).toHaveBeenCalledWith(mockConnection);
    });

    it("passes null to mapper when rows[0] is null", async () => {
      mockQuery.mockResolvedValue([null]);
      mockMapProductDetailsList.mockReturnValue([]);
      const result = await mysqlService.GetCompleteProductDetails();
      expect(mockMapProductDetailsList).toHaveBeenCalledWith(null);
      expect(result).toEqual([]);
    });
  });

  describe("GetNumberOfRepriceEligibleProductCount", () => {
    it("returns totalCount - nullCount from knex", async () => {
      knexTableChain.first.mockResolvedValueOnce({ count: 100 }).mockResolvedValueOnce({ count: 10 });
      const result = await mysqlService.GetNumberOfRepriceEligibleProductCount();
      expect(result).toBe(90);
    });
  });

  describe("GetAllRepriceEligibleProductByFilter", () => {
    it("returns empty array when no MpIds from paginated query", async () => {
      knexTableChain._resolveValue = [];
      const result = await mysqlService.GetAllRepriceEligibleProductByFilter(0, 10);
      expect(result).toEqual([]);
      expect(mockMapProductDetailsList).not.toHaveBeenCalled();
    });

    it("builds union of vendor queries and maps result when MpIds exist", async () => {
      knexTableChain._resolveValue = [{ MpId: 1 }, { MpId: 2 }];
      (mockKnexInstance.union as jest.Mock).mockReturnValue({
        orderBy: jest.fn().mockResolvedValue([{ ProductId: 1 }]),
      });
      mockMapProductDetailsList.mockReturnValue([{ mpId: 1 }]);
      const result = await mysqlService.GetAllRepriceEligibleProductByFilter(1, 5);
      expect(mockMapProductDetailsList).toHaveBeenCalled();
      expect(result).toEqual([{ mpId: 1 }]);
    });
  });

  describe("GetAllRepriceEligibleProductByTag", () => {
    it("returns empty array when no matching MpIds", async () => {
      (mockKnexInstance.union as jest.Mock).mockReturnValue({
        distinct: jest.fn().mockResolvedValue([]),
      });
      const result = await mysqlService.GetAllRepriceEligibleProductByTag(null, null);
      expect(result).toEqual([]);
    });
  });

  describe("GetFullProductDetailsById", () => {
    it("calls SP with mpid and maps result", async () => {
      const raw = [{ ProductId: 1 }];
      mockQuery.mockResolvedValue([raw]);
      const mapped = [{ mpId: 1 }];
      mockMapProductDetailsList.mockReturnValue(mapped);
      const result = await mysqlService.GetFullProductDetailsById(100);
      expect(mockQuery).toHaveBeenCalledWith("CALL sp_GetFullProductDetailsById(?)", [100]);
      expect(result).toEqual(mapped);
    });
  });

  describe("UpdateVendorData", () => {
    it("uses UPDATE TRADENT SP and returns updatedIdentifier", async () => {
      mockQuery.mockResolvedValue([[[{ updatedIdentifier: 201 }]]]);
      const payload = {
        mpid: 1,
        channelName: "C",
        scrapeOn: true,
        allowReprice: true,
        activated: true,
        unitPrice: 10,
        focusId: "f",
        requestInterval: 1,
        floorPrice: 5,
        maxPrice: 20,
        channelId: "c",
        lastUpdatedOn: "d",
        lastUpdatedByUser: "u",
        lastCronTime: "t",
        lastUpdateTime: "t",
        lastAttemptedTime: "t",
        is_nc_needed: true,
        repricingRule: 1,
        requestIntervalUnit: "min",
        suppressPriceBreak: false,
        priority: 1,
        last_cron_message: "m",
        lowest_vendor: "v",
        lowest_vendor_price: "1",
        lastExistingPrice: "2",
        lastSuggestedPrice: "3",
        nextCronTime: "t",
        beatQPrice: false,
        competeAll: false,
        percentageIncrease: 5,
        suppressPriceBreakForOne: false,
        compareWithQ1: false,
        wait_update_period: 0,
        lastCronRun: "r",
        abortDeactivatingQPriceBreak: false,
        badgeIndicator: "ALL",
        badgePercentage: 10,
        lastUpdatedBy: "u",
        inactiveVendorId: "",
        includeInactiveVendors: false,
        override_bulk_rule: 0,
        override_bulk_update: false,
        latest_price: 1,
        executionPriority: 1,
        applyBuyBoxLogic: false,
        applyNcForBuyBox: false,
        sisterVendorId: "",
        handlingTimeFilter: "F",
        keepPosition: false,
        excludedVendors: "",
        inventoryThreshold: 0,
        percentageDown: 0,
        badgePercentageDown: 0,
        competeWithNext: false,
        ignorePhantomQBreak: true,
        ownVendorThreshold: 1,
        getBBBadge: false,
        getBBShipping: false,
        getBBBadgeValue: 0,
        getBBShippingValue: 0,
      };
      const result = await mysqlService.UpdateVendorData(payload, "TRADENT");
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("sp_UpdateTradent"), expect.any(Array));
      expect(result).toBe(201);
    });
  });

  describe("GetLinkedVendorDetails", () => {
    it("returns Id for TRADENT table", async () => {
      mockExecute.mockResolvedValue([[{ Id: 42 }]]);
      const result = await mysqlService.GetLinkedVendorDetails(1, "TRADENT");
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("table_tradentDetails"), [1]);
      expect(result).toBe(42);
    });

    it("uses correct table for FRONTIER, MVP, TOPDENT, FIRSTDENT, TRIAD, BITESUPPLY", async () => {
      const tables: [string, string][] = [
        ["FRONTIER", "table_frontierDetails"],
        ["MVP", "table_mvpDetails"],
        ["TOPDENT", "table_topDentDetails"],
        ["FIRSTDENT", "table_firstDentDetails"],
        ["TRIAD", "table_triadDetails"],
        ["BITESUPPLY", "table_biteSupplyDetails"],
      ];
      for (const [vendor, table] of tables) {
        mockExecute.mockResolvedValue([[{ Id: 1 }]]);
        await mysqlService.GetLinkedVendorDetails(1, vendor);
        expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining(table), [1]);
      }
    });
  });

  describe("UpdateProductV2", () => {
    it("executes update with itemData and ids", async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
      const itemData = {
        cronName: "c",
        cronId: 1,
        slowCronName: "s",
        slowCronId: 1,
        isSlowActivated: true,
      };
      await mysqlService.UpdateProductV2("100", itemData, 1, 2, 3);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("table_scrapeProductList"), ["c", 1, "s", 1, 1, 2, 3, true, 100]);
    });
  });

  describe("ChangeProductActivation", () => {
    it("updates all vendor tables with status and mpId", async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
      await mysqlService.ChangeProductActivation(50, true);
      expect(mockExecute).toHaveBeenCalledTimes(7);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("table_tradentDetails"), [true, 50]);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("table_biteSupplyDetails"), [true, 50]);
    });
  });

  describe("MapVendorToRoot", () => {
    let originalTrace: typeof console.trace;
    let originalError: typeof console.error;

    beforeEach(() => {
      originalTrace = console.trace;
      originalError = console.error;
      console.trace = jest.fn();
      console.error = jest.fn();
    });

    afterEach(() => {
      console.trace = originalTrace;
      console.error = originalError;
    });

    it("calls GetLinkedVendorDetails for TRADENT/FRONTIER/MVP then updates root table", async () => {
      mockExecute
        .mockResolvedValueOnce([[{ Id: 10 }]])
        .mockResolvedValueOnce([[{ Id: 20 }]])
        .mockResolvedValueOnce([[{ Id: 30 }]])
        .mockResolvedValueOnce([[{ affectedRows: 1 }]]);
      const data = { MPID: 1, CronName: " Cron ", CronId: 5 };
      const result = await mysqlService.MapVendorToRoot(data);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("UPDATE"), [10, 20, 30, "Cron", 5, 1]);
      expect(result).toBeDefined();
    });
  });

  describe("ToggleDataScrapeForId", () => {
    it("updates IsActive, LastUpdatedBy, LastUpdatedAt by MpId", async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
      await mysqlService.ToggleDataScrapeForId(99, true, {
        UpdatedBy: "u",
        UpdatedOn: "2024-01-01",
      });
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("IsActive"), [true, "u", "2024-01-01", 99]);
    });
  });

  describe("UpdateBranchDataForVendor", () => {
    it("updates TRADENT table with payload fields", async () => {
      mockExecute.mockResolvedValue([[{ updated: 1 }]]);
      const payLoad = {
        activated: "true",
        channelId: "c",
        is_nc_needed: "true",
        badgeIndicator: "ALL",
        repricingRule: "1",
        floorPrice: "5",
        maxPrice: "20",
        unitPrice: "10",
      };
      await mysqlService.UpdateBranchDataForVendor(1, "TRADENT", payLoad);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("table_tradentDetails"), [true, "c", true, "ALL", 1, 5, 20, 10, 1]);
    });

    it("updates FRONTIER table when vendorName is FRONTIER", async () => {
      mockExecute.mockResolvedValue([[{ updated: 1 }]]);
      const payLoad = {
        activated: "false",
        channelId: "ch2",
        is_nc_needed: "false",
        badgeIndicator: "BADGE",
        repricingRule: "2",
        floorPrice: "10",
        maxPrice: "30",
        unitPrice: "15",
      };
      await mysqlService.UpdateBranchDataForVendor(2, "FRONTIER", payLoad);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("table_frontierDetails"), [false, "ch2", false, "BADGE", 2, 10, 30, 15, 2]);
    });
  });

  describe("ExecuteQuery", () => {
    it("executes given query with params and returns result", async () => {
      mockExecute.mockResolvedValue([[{ id: 1 }]]);
      const result = await mysqlService.ExecuteQuery("SELECT 1", []);
      expect(mockExecute).toHaveBeenCalledWith("SELECT 1", []);
      expect(result).toEqual([[{ id: 1 }]]);
      expect(mockReleaseConnection).toHaveBeenCalledWith(mockConnection);
    });
  });

  describe("CreateUser", () => {
    it("inserts username and password and returns userId", async () => {
      (knexTableChain.insert as jest.Mock).mockReturnValue(Promise.resolve([99]));
      const result = await mysqlService.CreateUser("john", "hashed");
      expect(knexTableChain.insert).toHaveBeenCalledWith({ username: "john", password: "hashed" });
      expect(result).toBe(99);
    });
  });

  describe("AuthenticateUser", () => {
    it("returns null when user not found", async () => {
      (knexTableChain.first as jest.Mock).mockResolvedValue(null);
      const result = await mysqlService.AuthenticateUser("nobody", "pass");
      expect(result).toBeNull();
    });

    it("returns user without password when password valid", async () => {
      (knexTableChain.first as jest.Mock).mockResolvedValue({
        id: 1,
        username: "john",
        password: "$2b$10$hashed",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await mysqlService.AuthenticateUser("john", "secret");
      expect(result).toEqual({ id: 1, username: "john" });
    });

    it("returns null when password invalid", async () => {
      (knexTableChain.first as jest.Mock).mockResolvedValue({
        id: 1,
        username: "john",
        password: "$2b$10$hashed",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const result = await mysqlService.AuthenticateUser("john", "wrong");
      expect(result).toBeNull();
    });
  });

  describe("ChangePassword", () => {
    it("returns true when update affects rows", async () => {
      knexTableChain._resolveValue = 1;
      const result = await mysqlService.ChangePassword("john", "newPass");
      expect(result).toBe(true);
    });

    it("returns false when no rows updated", async () => {
      knexTableChain._resolveValue = 0;
      const result = await mysqlService.ChangePassword("john", "newPass");
      expect(result).toBe(false);
    });
  });

  describe("CheckUserExists", () => {
    it("returns user when found", async () => {
      (knexTableChain.first as jest.Mock).mockResolvedValue({ id: 1, username: "j" });
      const result = await mysqlService.CheckUserExists("j");
      expect(result).toEqual({ id: 1, username: "j" });
    });

    it("returns null when not found", async () => {
      (knexTableChain.first as jest.Mock).mockResolvedValue(null);
      const result = await mysqlService.CheckUserExists("x");
      expect(result).toBeNull();
    });
  });

  describe("GetAllRepriceEligibleProductByMpid", () => {
    it("calls SP and maps result", async () => {
      mockQuery.mockResolvedValue([[{ ProductId: 1 }]]);
      mockMapProductDetailsList.mockReturnValue([{ mpId: 1 }]);
      const result = await mysqlService.GetAllRepriceEligibleProductByMpid(100);
      expect(mockQuery).toHaveBeenCalledWith("CALL sp_GetProductByMpid(?)", [100]);
      expect(result).toEqual([{ mpId: 1 }]);
    });

    it("returns mapper result when rows is null (catch path still returns)", async () => {
      mockQuery.mockResolvedValue([null]);
      mockMapProductDetailsList.mockReturnValue([]);
      const result = await mysqlService.GetAllRepriceEligibleProductByMpid(100);
      expect(result).toEqual([]);
    });

    it("returns mapped list when query throws and catch runs", async () => {
      mockQuery.mockRejectedValue(new Error("Connection lost"));
      mockMapProductDetailsList.mockReturnValue([]);
      const result = await mysqlService.GetAllRepriceEligibleProductByMpid(100);
      expect(result).toEqual([]);
    });
  });

  describe("GetAllRepriceEligibleProductByChannelId", () => {
    it("calls SP with channelId and maps result", async () => {
      mockQuery.mockResolvedValue([[{ ProductId: 1 }]]);
      mockMapProductDetailsList.mockReturnValue([{ channelId: "c1" }]);
      const result = await mysqlService.GetAllRepriceEligibleProductByChannelId("c1");
      expect(mockQuery).toHaveBeenCalledWith("CALL sp_GetProductsByChannelId(?)", ["c1"]);
      expect(result).toEqual([{ channelId: "c1" }]);
    });

    it("returns mapped list when query throws", async () => {
      mockQuery.mockRejectedValue(new Error("DB error"));
      mockMapProductDetailsList.mockReturnValue([]);
      const result = await mysqlService.GetAllRepriceEligibleProductByChannelId("c1");
      expect(result).toEqual([]);
    });
  });

  describe("GetCronSettingsList", () => {
    it("calls raw GetRegularCronSettingsList and maps via ToCronSettingsModel", async () => {
      mockKnexRaw.mockResolvedValue([[{ settings: "x" }]]);
      mockToCronSettingsModel.mockResolvedValue({ cronName: "c" });
      const result = await mysqlService.GetCronSettingsList();
      expect(mockKnexRaw).toHaveBeenCalledWith("call GetRegularCronSettingsList()");
      expect(result).toEqual({ cronName: "c" });
    });

    it("returns null when result is empty", async () => {
      mockKnexRaw.mockResolvedValue([[]]);
      const result = await mysqlService.GetCronSettingsList();
      expect(result).toBeNull();
    });
  });

  describe("StreamCompleteProductDetailsAsync", () => {
    it("rejects when connect fails", async () => {
      mockConnect.mockImplementation((cb: (err: Error) => void) => cb(new Error("Connection refused")));
      await expect(mysqlService.StreamCompleteProductDetailsAsync()).rejects.toThrow("Connection failed");
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("resolves with stream and db when connect succeeds", async () => {
      const mockStream = {
        on: jest.fn(),
        pipe: jest.fn(),
      };
      mockQueryStream.mockReturnValue({
        stream: jest.fn().mockReturnValue(mockStream),
      });
      mockConnect.mockImplementation((cb: (err?: Error) => void) => cb());
      const result = await mysqlService.StreamCompleteProductDetailsAsync();
      expect(result).toHaveProperty("stream", mockStream);
      expect(result).toHaveProperty("db");
      expect(mockQueryStream).toHaveBeenCalledWith("CALL sp_GetFullProductDetailsList();");
    });
  });
});
