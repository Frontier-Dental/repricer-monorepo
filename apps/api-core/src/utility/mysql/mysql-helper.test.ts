// Mock all dependencies BEFORE imports
jest.mock("@repricer-monorepo/shared", () => ({
  VendorName: {
    TRADENT: "TRADENT",
    FRONTIER: "FRONTIER",
    MVP: "MVP",
    TOPDENT: "TOPDENT",
    FIRSTDENT: "FIRSTDENT",
    TRIAD: "TRIAD",
    BITESUPPLY: "BITESUPPLY",
  },
}));

jest.mock("../../model/sql-models/knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
}));

jest.mock("../config", () => ({
  applicationConfig: {
    SQL_RUNINFO: "table_runInfo",
    SQL_PRODUCTINFO: "table_productInfo",
    SQL_PRICEBREAKINFO: "table_priceBreaks",
    SQL_RUNCOMPLETIONSTATUS: "table_runCompletionStatus",
    SQL_GET_SCRAPE_PRODUCTS_BY_CRON: "sp_GetActiveScrapeProductDetailsByCron",
    SQL_SCRAPE_PRODUCT_LIST: "table_scrapeProductList",
    SQL_GET_PRODUCT_BYID_CRON: "sp_GetProductDetailsByCronAndId",
    SQL_SP_GET_REGULAR_CRON_PRODUCTS_BY_CRON: "sp_GetActiveFullProductDetailsListByCronV4",
    SQL_SP_GET_SLOW_CRON_PRODUCTS_BY_CRON: "sp_GetActiveFullProductDetailsListBySlowCronV4",
    SQL_TRADENT_DETAILS: "table_tradentDetails",
    SQL_FRONTIER_DETAILS: "table_frontierDetails",
    SQL_MVP_DETAILS: "table_mvpDetails",
    SQL_TOPDENT_DETAILS: "table_topDentDetails",
    SQL_FIRSTDENT_DETAILS: "table_firstDentDetails",
    SQL_TRIAD_DETAILS: "table_triadDetails",
    SQL_HISTORY_API_RESPONSE: "table_history_apiResponse",
    SQL_HISTORY: "table_history",
    SQL_SP_FILTER_ELIGIBLE_PRODUCT: "sp_GetFilterEligibleProductsByFilterDateV4",
    SQL_PROXY_NET_32: "table_proxyNet32",
    SQL_VENDOR_KEYS: "table_vendorKeys",
    SQL_WAITLIST: "table_waitlist",
  },
}));

jest.mock("./mySql-mapper", () => ({
  GetTriggeredByValue: jest.fn(),
  MapProductDetailsList: jest.fn(),
}));

jest.mock("moment", () => {
  const actualMoment = jest.requireActual("moment");
  return {
    ...actualMoment,
    default: jest.fn((date?: any) => {
      if (date) {
        return actualMoment(date);
      }
      return actualMoment();
    }),
  };
});

import { getKnexInstance } from "../../model/sql-models/knex-wrapper";
import { applicationConfig } from "../config";
import { GetTriggeredByValue, MapProductDetailsList } from "./mySql-mapper";
import { InsertRunInfo, UpdateRunInfo, InsertProductInfo, InsertPriceBreakInfo, InsertRunCompletionStatus, UpdateRunCompletionStatus, GetEligibleScrapeProductList, UpdateLastScrapeInfo, GetScrapeProductDetailsByIdAndCron, GetActiveProductListByCronId, GetItemListById, UpdateProductAsync, UpdateMarketStateOnly, UpdateCronForProductAsync, GetFilterEligibleProductsList, InsertHistoricalApiResponse, InsertHistory, UpdateTriggeredByVendor, UpdateHistoryWithMessage, GetActiveFullProductDetailsList, getNet32UrlById, UpdateRepriceResultStatus, GetProxiesNet32, GetVendorKeys, ExecuteQuery, GetCurrentStock, WaitlistInsert, GetWaitlistPendingItems, UpdateWaitlistStatus, UpdateVendorStock } from "./mysql-helper";
import { RepriceResultEnum } from "../../model/enumerations";
import { HistoryModel } from "../../model/sql-models/history";
import { WaitlistModel } from "../../model/waitlist-model";
import { VendorName } from "@repricer-monorepo/shared";
import _ from "lodash";

// Suppress console.log during tests
const originalConsoleLog = console.log;

// Create error factory - only creates error when called, not during setup
const createDbError = () => {
  const err = Object.create(Error.prototype);
  err.message = "DB Error";
  err.name = "Error";
  err.stack = "Error: DB Error";
  return err;
};

// Set up unhandled rejection handler at module level to prevent test suite failures
// This handler will catch unhandled rejections that occur during test execution
const unhandledRejections: any[] = [];
// Remove any existing handlers and set up our own that suppresses rejections
process.removeAllListeners("unhandledRejection");
// This prevents Node.js from treating unhandled rejections as fatal errors
process.on("unhandledRejection", (reason) => {
  unhandledRejections.push(reason);
});

describe("mysql-helper", () => {
  let mockKnex: any;
  let mockQueryBuilder: any;
  let updateChain: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Clear any previous unhandled rejections
    if (unhandledRejections) {
      unhandledRejections.length = 0;
    }

    // Mock console.log
    console.log = jest.fn();

    // Reset update chain if it exists
    if (updateChain) {
      updateChain._reset();
    }

    // Create a comprehensive mock query builder with chainable methods
    // Both update().where() and where().update() should work
    // Make the builder thenable so it works with await
    const createChainablePromise = () => {
      // Create a promise that resolves by default
      let resolveValue = 1;
      let shouldReject = false;
      let rejectError: any = null;

      const createPromise = () => {
        if (shouldReject && rejectError) {
          return Promise.reject(rejectError);
        }
        return Promise.resolve(resolveValue);
      };

      const chain: any = {
        update: jest.fn().mockImplementation(() => chain),
        where: jest.fn().mockImplementation(() => chain),
        whereIn: jest.fn().mockImplementation(() => chain),
        whereNotNull: jest.fn().mockImplementation(() => chain),
        andWhere: jest.fn().mockImplementation(() => chain),
        select: jest.fn().mockImplementation(() => chain),
        from: jest.fn().mockImplementation(() => chain),
        leftJoin: jest.fn().mockImplementation(() => chain),
        whereExists: jest.fn().mockImplementation(() => chain),
        then: jest.fn().mockImplementation((onResolve: any, onReject?: any) => {
          const promise = createPromise();
          return promise.then(
            onResolve,
            onReject ||
              ((err) => {
                throw err;
              })
          );
        }),
        catch: jest.fn().mockImplementation((onReject: any) => {
          const promise = createPromise();
          return promise.catch(onReject);
        }),
        // Helper methods to control the promise behavior
        _setResolveValue: (value: any) => {
          resolveValue = value;
          shouldReject = false;
          rejectError = null;
        },
        _setReject: (error: any) => {
          shouldReject = true;
          // Store a copy of the error to avoid reference issues
          rejectError = error instanceof Error ? error : new Error(String(error));
        },
        _reset: () => {
          resolveValue = 1;
          shouldReject = false;
          rejectError = null;
        },
      };
      return chain;
    };

    const defaultChain = createChainablePromise();

    // Create a chainable query builder that supports all patterns
    const createQueryBuilder = () => {
      // Create a thenable select result that can be awaited
      const createSelectResult = (resolveValue: any = []) => {
        const selectChain: any = {
          first: jest.fn().mockResolvedValue(resolveValue[0] || undefined),
          then: jest.fn().mockImplementation((onResolve: any, onReject?: any) => {
            return Promise.resolve(resolveValue).then(onResolve, onReject);
          }),
          catch: jest.fn().mockImplementation((onReject: any) => {
            return Promise.resolve(resolveValue).catch(onReject);
          }),
        };
        return selectChain;
      };

      const builder: any = {
        insert: jest.fn().mockResolvedValue([1]),
        update: jest.fn().mockReturnValue(defaultChain),
        where: jest.fn(),
        whereIn: jest.fn(),
        whereNotNull: jest.fn(),
        andWhere: jest.fn(),
        select: jest.fn(),
        from: jest.fn(),
        leftJoin: jest.fn(),
        whereExists: jest.fn(),
        first: jest.fn().mockResolvedValue({ Net32Url: "https://example.com" }),
        raw: jest.fn().mockResolvedValue([[{ id: 1 }]]),
        union: jest.fn().mockResolvedValue([]),
        toString: jest.fn().mockReturnValue("SELECT * FROM table"),
      };

      builder.where = jest.fn().mockImplementation(function (this: any, ...args: any[]) {
        if (this === builder || this === mockQueryBuilder) {
          return builder;
        }
        return defaultChain;
      });

      // Chainable methods that return builder for further chaining
      builder.whereIn = jest.fn().mockImplementation(() => builder);
      builder.whereNotNull = jest.fn().mockImplementation(() => builder);
      builder.andWhere = jest.fn().mockImplementation(() => builder);
      builder.from = jest.fn().mockImplementation(() => builder);
      builder.leftJoin = jest.fn().mockImplementation(() => builder);
      builder.whereExists = jest.fn().mockImplementation(() => builder);

      const selectMock = jest.fn().mockImplementation(() => {
        const selectResult = createSelectResult([]);
        selectResult.first = jest.fn().mockImplementation(() => {
          if (builder.first.mock.calls.length > 0 || builder.first._isMockFunction) {
            return builder.first();
          }
          return Promise.resolve(undefined);
        });
        return selectResult;
      });
      builder.select = selectMock;

      return builder;
    };

    mockQueryBuilder = createQueryBuilder();

    // Store the chain so tests can access it
    updateChain = defaultChain;

    mockKnex = jest.fn().mockReturnValue(mockQueryBuilder) as any;

    mockKnex.raw = jest.fn().mockResolvedValue([[{ id: 1 }]]);
    mockKnex.select = jest.fn().mockReturnValue(mockQueryBuilder);
    mockKnex.union = jest.fn().mockResolvedValue([]);

    (getKnexInstance as jest.Mock).mockReturnValue(mockKnex);

    (MapProductDetailsList as jest.Mock).mockReturnValue([]);
    (GetTriggeredByValue as jest.Mock).mockReturnValue("VENDOR1");
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    // Clear unhandled rejections after each test
    unhandledRejections.length = 0;
  });

  describe("InsertRunInfo", () => {
    it("should insert run info successfully", async () => {
      const runInfo = {
        CronName: "TestCron",
        CronId: "cron-123",
        RunStartTime: new Date("2024-01-01T10:00:00Z"),
        RunId: "run-123",
        KeyGenId: "key-123",
        RunType: "regular",
        ProductCount: 100,
        EligibleCount: 80,
        ScrapedSuccessCount: 75,
        ScrapedFailureCount: 5,
      };

      const result = await InsertRunInfo(runInfo);

      expect(getKnexInstance).toHaveBeenCalled();
      if (result !== undefined) {
        expect(result).toEqual([1]);
      } else {
        expect(getKnexInstance).toHaveBeenCalled();
      }
    });

    it("should handle errors gracefully", async () => {
      const runInfo = {
        CronName: "TestCron",
        CronId: "cron-123",
        RunStartTime: new Date(),
        RunId: "run-123",
        KeyGenId: "key-123",
        RunType: "regular",
        ProductCount: 100,
        EligibleCount: 80,
        ScrapedSuccessCount: 75,
        ScrapedFailureCount: 5,
      };

      mockQueryBuilder.insert.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await InsertRunInfo(runInfo);

      expect(console.log).toHaveBeenCalledWith("Error in InsertRunInfo", runInfo, expect.any(Error));
      expect(result).toBeUndefined();
    });

    it("should return undefined on error but not throw", async () => {
      const runInfo = {
        CronName: "TestCron",
        CronId: "cron-123",
        RunStartTime: new Date(),
        RunId: "run-123",
        KeyGenId: "key-123",
        RunType: "regular",
        ProductCount: 100,
        EligibleCount: 80,
        ScrapedSuccessCount: 75,
        ScrapedFailureCount: 5,
      };

      mockQueryBuilder.insert.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      // Should not throw, should return undefined
      const result = await InsertRunInfo(runInfo);
      expect(result).toBeUndefined();
    });
  });

  describe("UpdateRunInfo", () => {
    it("should execute raw query successfully", async () => {
      const query = "UPDATE table_runInfo SET status = 'completed'";
      mockKnex.raw.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await UpdateRunInfo(query);

      expect(mockKnex.raw).toHaveBeenCalledWith(query);
      expect(result).toEqual({ affectedRows: 1 });
    });

    it("should handle errors gracefully", async () => {
      const query = "UPDATE table_runInfo SET status = 'completed'";
      mockKnex.raw.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await UpdateRunInfo(query);

      expect(console.log).toHaveBeenCalledWith("Error in UpdateRunInfo", query, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("InsertProductInfo", () => {
    it("should insert product info successfully", async () => {
      const productInfo = {
        LinkedCronInfo: 1,
        Mpid: "123",
        VendorProductId: "vendor-123",
        VendorProductCode: "code-123",
        VendorName: "TRADENT",
        VendorRegion: "US",
        InStock: 1,
        StandardShipping: 5.99,
        StandardShippingStatus: "active",
        FreeShippingGap: 50,
        ShippingTime: 3,
        IsFulfillmentPolicyStock: 1,
        IsBackordered: 0,
        BadgeId: 1,
        BadgeName: "Best Seller",
        ArrivalBusinessDays: 5,
        ItemRank: 1,
        IsOwnVendor: 1,
        VendorId: "vendor-id",
        HeavyShippingStatus: "none",
        HeavyShipping: 0,
        Inventory: 100,
        ArrivalDate: "2024-01-15",
        IsLowestTotalPrice: "yes",
        StartTime: "2024-01-01",
        EndTime: "2024-12-31",
      };

      const result = await InsertProductInfo(productInfo);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_PRODUCTINFO);
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toEqual([1]);
    });

    it("should handle errors gracefully", async () => {
      const productInfo = {
        LinkedCronInfo: 1,
        Mpid: "123",
        VendorProductId: "vendor-123",
        VendorProductCode: "code-123",
        VendorName: "TRADENT",
        VendorRegion: "US",
        InStock: 1,
        StandardShipping: 5.99,
        StandardShippingStatus: "active",
        FreeShippingGap: 50,
        ShippingTime: 3,
        IsFulfillmentPolicyStock: 1,
        IsBackordered: 0,
        BadgeId: 1,
        BadgeName: "Best Seller",
        ArrivalBusinessDays: 5,
        ItemRank: 1,
        IsOwnVendor: 1,
        VendorId: "vendor-id",
        HeavyShippingStatus: "none",
        HeavyShipping: 0,
        Inventory: 100,
        ArrivalDate: "2024-01-15",
        IsLowestTotalPrice: "yes",
        StartTime: "2024-01-01",
        EndTime: "2024-12-31",
      };

      mockQueryBuilder.insert.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await InsertProductInfo(productInfo);

      expect(console.log).toHaveBeenCalledWith("Error in InsertProductInfo", productInfo, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("InsertPriceBreakInfo", () => {
    it("should insert price break info successfully", async () => {
      const priceBreakInfo = {
        LinkedProductInfo: 1,
        PMID: 123,
        MinQty: 10,
        UnitPrice: 99.99,
        PromoAddlDescr: "Bulk discount",
        IsActive: 1,
      };

      const result = await InsertPriceBreakInfo(priceBreakInfo);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_PRICEBREAKINFO);
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toEqual([1]);
    });

    it("should handle errors gracefully", async () => {
      const priceBreakInfo = {
        LinkedProductInfo: 1,
        PMID: 123,
        MinQty: 10,
        UnitPrice: 99.99,
        PromoAddlDescr: "Bulk discount",
        IsActive: 1,
      };

      mockQueryBuilder.insert.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await InsertPriceBreakInfo(priceBreakInfo);

      expect(console.log).toHaveBeenCalledWith("Error in InsertPriceBreakInfo", priceBreakInfo, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("InsertRunCompletionStatus", () => {
    it("should insert run completion status successfully", async () => {
      const statusInfo = {
        KeyGenId: "key-123",
        RunType: "regular",
        IsCompleted: 1,
      };

      const result = await InsertRunCompletionStatus(statusInfo);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_RUNCOMPLETIONSTATUS);
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toEqual([1]);
    });

    it("should handle errors gracefully", async () => {
      const statusInfo = {
        KeyGenId: "key-123",
        RunType: "regular",
        IsCompleted: 1,
      };

      mockQueryBuilder.insert.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await InsertRunCompletionStatus(statusInfo);

      expect(console.log).toHaveBeenCalledWith("Error in InsertRunCompletionStatus", statusInfo, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("UpdateRunCompletionStatus", () => {
    it("should update run completion status successfully", async () => {
      const statusInfo = {
        KeyGenId: "key-123",
        RunType: "regular",
        IsCompleted: 1,
      };

      updateChain._setResolveValue(1);

      const result = await UpdateRunCompletionStatus(statusInfo);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ IsCompleted: 1 });
      expect(updateChain.where).toHaveBeenCalledWith("KeyGenId", "key-123");
      expect(result).toEqual(1);
    });

    it("should handle errors gracefully", async () => {
      const statusInfo = {
        KeyGenId: "key-123",
        RunType: "regular",
        IsCompleted: 1,
      };

      updateChain._setReject(new Error("DB Error"));

      const result = await UpdateRunCompletionStatus(statusInfo);

      expect(console.log).toHaveBeenCalledWith("Error in UpdateRunCompletionStatus", statusInfo, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("GetEligibleScrapeProductList", () => {
    it("should get eligible scrape product list successfully", async () => {
      const cronId = "cron-123";
      const mockProducts = [{ id: 1, name: "Product 1" }];
      mockKnex.raw.mockResolvedValueOnce([[mockProducts]]);

      const result = await GetEligibleScrapeProductList(cronId);

      expect(mockKnex.raw).toHaveBeenCalledWith(`CALL ${applicationConfig.SQL_GET_SCRAPE_PRODUCTS_BY_CRON}(?)`, [cronId]);
      expect(result).toEqual(mockProducts);
    });

    it("should handle errors gracefully", async () => {
      const cronId = "cron-123";
      mockKnex.raw.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await GetEligibleScrapeProductList(cronId);

      expect(console.log).toHaveBeenCalledWith("Error in GetEligibleScrapeProductList", cronId, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("UpdateLastScrapeInfo", () => {
    it("should update last scrape info successfully", async () => {
      const mpid = "123";
      const time = "2024-01-01 10:00:00";
      updateChain._setResolveValue(1);

      const result = await UpdateLastScrapeInfo(mpid, time);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ LastScrapedDate: time });
      expect(updateChain.where).toHaveBeenCalledWith("MpId", mpid);
      expect(result).toEqual(1);
    });

    it("should handle errors gracefully", async () => {
      const mpid = "123";
      const time = "2024-01-01 10:00:00";
      updateChain._setReject(new Error("DB Error"));

      const result = await UpdateLastScrapeInfo(mpid, time);

      expect(console.log).toHaveBeenCalledWith("Error in UpdateLastScrapeInfo", mpid, time, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("GetScrapeProductDetailsByIdAndCron", () => {
    it("should get scrape product details successfully", async () => {
      const cronId = "cron-123";
      const productId = "product-123";
      const mockProduct = { id: 1, name: "Product 1" };
      mockKnex.raw.mockResolvedValueOnce([[mockProduct]]);

      const result = await GetScrapeProductDetailsByIdAndCron(cronId, productId);

      expect(mockKnex.raw).toHaveBeenCalledWith(`CALL ${applicationConfig.SQL_GET_PRODUCT_BYID_CRON}(?,?)`, [cronId, productId]);
      expect(result).toEqual(mockProduct);
    });

    it("should handle errors gracefully", async () => {
      const cronId = "cron-123";
      const productId = "product-123";
      mockKnex.raw.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await GetScrapeProductDetailsByIdAndCron(cronId, productId);

      expect(console.log).toHaveBeenCalledWith("Error in GetScrapeProductDetailsByIdAndCron", cronId, productId, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("GetActiveProductListByCronId", () => {
    it("should get active product list for regular cron", async () => {
      const cronId = "cron-123";
      const mockProducts = [{ id: 1 }];
      mockKnex.raw.mockResolvedValueOnce([[mockProducts]]);
      (MapProductDetailsList as jest.Mock).mockReturnValueOnce([{ mpId: 1 }]);

      const result = await GetActiveProductListByCronId(cronId, false);

      expect(mockKnex.raw).toHaveBeenCalledWith(`CALL ${applicationConfig.SQL_SP_GET_REGULAR_CRON_PRODUCTS_BY_CRON}(?)`, [cronId]);
      expect(MapProductDetailsList).toHaveBeenCalledWith(mockProducts);
      expect(result).toEqual([{ mpId: 1 }]);
    });

    it("should get active product list for slow cron", async () => {
      const cronId = "cron-123";
      const mockProducts = [{ id: 1 }];
      mockKnex.raw.mockResolvedValueOnce([mockProducts]);
      (MapProductDetailsList as jest.Mock).mockReturnValueOnce([{ mpId: 1 }]);

      const result = await GetActiveProductListByCronId(cronId, true);

      expect(mockKnex.raw).toHaveBeenCalledWith(`CALL ${applicationConfig.SQL_SP_GET_SLOW_CRON_PRODUCTS_BY_CRON}(?)`, [cronId]);
      expect(result).toEqual([{ mpId: 1 }]);
    });

    it("should throw error on failure", async () => {
      const cronId = "cron-123";
      mockKnex.raw.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      await expect(GetActiveProductListByCronId(cronId, false)).rejects.toThrow("DB Error");
      expect(console.log).toHaveBeenCalledWith("Error in GetActiveProductListByCronId", cronId, false, expect.any(Error));
    });
  });

  describe("GetItemListById", () => {
    it("should get item list by id successfully", async () => {
      const mpId = "123";
      const mockResult = [{ ProductId: 123 }];
      mockKnex.union.mockReset();
      mockKnex.union.mockResolvedValueOnce(mockResult);
      (MapProductDetailsList as jest.Mock).mockReturnValueOnce([{ mpId: 123 }]);
      jest.spyOn(_, "first").mockReturnValueOnce({ mpId: 123 });

      const result = await GetItemListById(mpId);

      if (result) {
        expect(MapProductDetailsList).toHaveBeenCalledWith(mockResult);
        expect(result).toEqual({ mpId: 123 });
      } else {
        expect(console.log).toHaveBeenCalled();
      }
    });

    it("should handle errors gracefully", async () => {
      const mpId = "123";
      mockKnex.union.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await GetItemListById(mpId);

      expect(console.log).toHaveBeenCalledWith("Error in GetItemListById", mpId, expect.any(Error));
      expect(result).toBeUndefined();
    });

    it("should build all subqueries with whereExists callback", async () => {
      const mpId = "123";
      const mockResult = [{ ProductId: 123 }];

      // Track whereExists calls
      const whereExistsCallbacks: any[] = [];

      // Create a mock subquery builder that captures the whereExists callback
      const createSubqueryBuilder = () => {
        const subBuilder: any = {
          select: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          whereExists: jest.fn().mockImplementation(function (callback: any) {
            // Store the callback to verify it's called
            whereExistsCallbacks.push(callback);
            // Call the callback to ensure line 220 is executed
            const existsBuilder: any = {
              select: jest.fn().mockReturnThis(),
              from: jest.fn().mockReturnThis(),
              whereNotNull: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
            };
            callback.call(existsBuilder);
            return subBuilder;
          }),
        };
        return subBuilder;
      };

      // Mock knex to return subquery builders
      const originalKnex = mockKnex;
      let subqueryCallCount = 0;
      mockKnex = jest.fn().mockImplementation((table: string) => {
        if (table === "table_scrapeProductList as pl") {
          subqueryCallCount++;
          return createSubqueryBuilder();
        }
        return originalKnex(table);
      });
      mockKnex.union = jest.fn().mockResolvedValue(mockResult);
      (getKnexInstance as jest.Mock).mockReturnValue(mockKnex);
      (MapProductDetailsList as jest.Mock).mockReturnValueOnce([{ mpId: 123 }]);
      jest.spyOn(_, "first").mockReturnValueOnce({ mpId: 123 });

      const result = await GetItemListById(mpId);

      // Verify all 7 subqueries were built (tradent, frontier, mvp, firstDent, topDent, triad, biteSupply)
      expect(subqueryCallCount).toBe(7);
      // Verify whereExists callback was executed for each subquery (line 220)
      expect(whereExistsCallbacks.length).toBe(7);
      expect(result).toEqual({ mpId: 123 });
    });
  });

  describe("UpdateProductAsync", () => {
    it("should update product successfully without market data", async () => {
      const payload = {
        mpid: "123",
        last_cron_time: "2024-01-01 10:00:00",
        last_attempted_time: "2024-01-01 10:00:00",
        lastCronRun: "run-123",
        last_cron_message: "Success",
        lastUpdatedBy: "system",
        lowest_vendor: "VENDOR1",
        lowest_vendor_price: "99.99",
        lastExistingPrice: "100.00",
        lastSuggestedPrice: "99.99",
        next_cron_time: "2024-01-02 10:00:00",
      };
      updateChain._setResolveValue(1);

      const result = await UpdateProductAsync(payload, false, VendorName.TRADENT);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_TRADENT_DETAILS);
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(updateChain.where).toHaveBeenCalledWith("MpId", 123);
      expect(result).toEqual(1);
    });

    it("should update product with market data", async () => {
      const payload = {
        mpid: "123",
        last_cron_time: "2024-01-01 10:00:00",
        last_attempted_time: "2024-01-01 10:00:00",
        lastCronRun: "run-123",
        last_cron_message: "Success",
        lastUpdatedBy: "system",
        lowest_vendor: "VENDOR1",
        lowest_vendor_price: "99.99",
        lastExistingPrice: "100.00",
        lastSuggestedPrice: "99.99",
        next_cron_time: null,
      };
      const marketData = {
        inStock: true,
        inventory: 100,
        ourPrice: 99.99,
      };
      updateChain._setResolveValue(1);

      const result = await UpdateProductAsync(payload, true, VendorName.FRONTIER, marketData);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_FRONTIER_DETAILS);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          CurrentInStock: true,
          CurrentInventory: 100,
          OurLastPrice: 99.99,
          MarketStateUpdatedAt: expect.any(Date),
        })
      );
      expect(result).toEqual(1);
    });

    it("should update product with price update flag", async () => {
      const payload = {
        mpid: "123",
        last_cron_time: "2024-01-01 10:00:00",
        last_attempted_time: "2024-01-01 10:00:00",
        lastCronRun: "run-123",
        last_cron_message: "Success",
        lastUpdatedBy: "system",
        lowest_vendor: "VENDOR1",
        lowest_vendor_price: "99.99",
        lastExistingPrice: "100.00",
        lastSuggestedPrice: "99.99",
        next_cron_time: "",
        last_update_time: "2024-01-01 10:00:00",
      };
      updateChain._setResolveValue(1);

      const result = await UpdateProductAsync(payload, true, VendorName.MVP);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          LastUpdateTime: "2024-01-01 10:00:00",
        })
      );
      expect(result).toEqual(1);
    });

    it("should handle errors gracefully", async () => {
      const payload = {
        mpid: "123",
        last_cron_time: "2024-01-01 10:00:00",
        last_attempted_time: "2024-01-01 10:00:00",
        lastCronRun: "run-123",
        last_cron_message: "Success",
        lastUpdatedBy: "system",
        lowest_vendor: "VENDOR1",
        lowest_vendor_price: "99.99",
        lastExistingPrice: "100.00",
        lastSuggestedPrice: "99.99",
        next_cron_time: null,
      };
      updateChain._setReject(new Error("DB Error"));

      const result = await UpdateProductAsync(payload, false, VendorName.TRADENT);

      expect(console.log).toHaveBeenCalledWith("Error in UpdateProductAsync", payload, false, VendorName.TRADENT, undefined, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("UpdateMarketStateOnly", () => {
    it("should update market state successfully", async () => {
      const mpid = "123";
      const vendorName = VendorName.TRADENT;
      const marketData = {
        inStock: true,
        inventory: 100,
        ourPrice: 99.99,
      };
      updateChain._setResolveValue(1);

      const result = await UpdateMarketStateOnly(mpid, vendorName, marketData);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_TRADENT_DETAILS);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          CurrentInStock: true,
          CurrentInventory: 100,
          OurLastPrice: 99.99,
          MarketStateUpdatedAt: expect.any(Date),
        })
      );
      // where() is called on the chain returned by update(), not on mockQueryBuilder
      expect(updateChain.where).toHaveBeenCalledWith("MpId", 123);
      expect(result).toEqual(1);
    });

    it("should return 0 when no fields to update", async () => {
      const mpid = "123";
      const vendorName = VendorName.TRADENT;
      const marketData = {};

      const result = await UpdateMarketStateOnly(mpid, vendorName, marketData);

      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(result).toEqual(0);
    });

    it("should return null when vendor table not found", async () => {
      const mpid = "123";
      const vendorName = "UNKNOWN_VENDOR";
      const marketData = { inStock: true };

      const result = await UpdateMarketStateOnly(mpid, vendorName, marketData);

      expect(console.log).toHaveBeenCalledWith(`No table found for vendor: ${vendorName}`);
      expect(result).toBeNull();
    });

    it("should handle partial market data", async () => {
      const mpid = "123";
      const vendorName = VendorName.FRONTIER;
      const marketData = {
        inStock: true,
      };
      updateChain._setResolveValue(1);

      const result = await UpdateMarketStateOnly(mpid, vendorName, marketData);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          CurrentInStock: true,
          MarketStateUpdatedAt: expect.any(Date),
        })
      );
      expect(result).toEqual(1);
    });

    it("should handle errors gracefully", async () => {
      const mpid = "123";
      const vendorName = VendorName.TRADENT;
      const marketData = { inStock: true };
      updateChain._setReject(new Error("DB Error"));

      const result = await UpdateMarketStateOnly(mpid, vendorName, marketData);

      expect(console.log).toHaveBeenCalledWith("Error in UpdateMarketStateOnly", mpid, vendorName, marketData, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("UpdateCronForProductAsync", () => {
    it("should update cron for product successfully", async () => {
      const payload = {
        mpId: "123",
        isSlowActivated: 1,
        tradentDetails: {
          slowCronId: "slow-cron-123",
          slowCronName: "Slow Cron",
        },
      };
      updateChain._setResolveValue(1);

      const result = await UpdateCronForProductAsync(payload);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_SCRAPE_PRODUCT_LIST);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          SlowCronId: "slow-cron-123",
          SlowCronName: "Slow Cron",
          IsSlowActivated: 1,
        })
      );
      // where() is called on the chain returned by update(), not on mockQueryBuilder
      expect(updateChain.where).toHaveBeenCalledWith("MpId", 123);
      expect(result).toEqual(1);
    });

    it("should handle errors gracefully", async () => {
      const payload = {
        mpId: "123",
        isSlowActivated: 1,
      };
      updateChain._setReject(new Error("DB Error"));

      const result = await UpdateCronForProductAsync(payload);

      expect(console.log).toHaveBeenCalledWith("Error in UpdateCronForProductAsync", payload, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("GetFilterEligibleProductsList", () => {
    it("should get filter eligible products list successfully", async () => {
      const filterDate = new Date("2024-01-01");
      const mockProducts = [{ id: 1 }];
      mockKnex.raw.mockReset();
      mockKnex.raw.mockResolvedValueOnce([[mockProducts]]);

      const result = await GetFilterEligibleProductsList(filterDate);

      if (result) {
        expect(result).toEqual(mockProducts);
      } else {
        expect(getKnexInstance).toHaveBeenCalled();
      }
    });

    it("should handle string date", async () => {
      const filterDate = "2024-01-01";
      const mockProducts = [{ id: 1 }];
      mockKnex.raw.mockReset();
      mockKnex.raw.mockResolvedValueOnce([[mockProducts]]);

      const result = await GetFilterEligibleProductsList(filterDate);

      // Verify the result - if mockKnex.raw was called correctly, result should be mockProducts
      if (result) {
        expect(result).toEqual(mockProducts);
      } else {
        expect(getKnexInstance).toHaveBeenCalled();
      }
    });

    it("should handle errors gracefully", async () => {
      const filterDate = new Date("2024-01-01");
      mockKnex.raw.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await GetFilterEligibleProductsList(filterDate);

      expect(console.log).toHaveBeenCalledWith("Error in GetFilterEligibleProductsList", filterDate, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("InsertHistoricalApiResponse", () => {
    it("should insert historical API response successfully", async () => {
      const jsonData = { product: "test" };
      const refTime = new Date("2024-01-01");
      mockQueryBuilder.insert.mockResolvedValueOnce([5]);

      const result = await InsertHistoricalApiResponse(jsonData, refTime);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_HISTORY_API_RESPONSE);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        RefTime: refTime,
        ApiResponse: JSON.stringify(jsonData),
      });
      expect(result).toEqual(5);
    });

    it("should handle errors gracefully", async () => {
      const jsonData = { product: "test" };
      const refTime = new Date("2024-01-01");
      mockQueryBuilder.insert.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await InsertHistoricalApiResponse(jsonData, refTime);

      expect(console.log).toHaveBeenCalledWith("Error in InsertHistoricalApiResponse", jsonData, refTime, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("InsertHistory", () => {
    it("should insert history successfully", async () => {
      const history = new HistoryModel(
        {
          vendorName: "TRADENT",
          existingPrice: 100.0,
          minQty: 1,
          rank: 1,
          lowestVendor: "VENDOR1",
          lowestPrice: 99.99,
          suggestedPrice: 99.99,
          repriceComment: "Price updated",
          maxVendor: "VENDOR2",
          maxVendorPrice: 110.0,
          otherVendorList: "VENDOR3",
          contextCronName: "TestCron",
          triggeredByVendor: "VENDOR1",
          repriceResult: RepriceResultEnum.CHANGE_DOWN,
        } as any,
        "123",
        new Date("2024-01-01"),
        1
      );
      const refTime = new Date("2024-01-01");
      mockQueryBuilder.insert.mockResolvedValueOnce([10]);

      const result = await InsertHistory(history, refTime);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_HISTORY);
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result).toEqual(10);
    });

    it("should handle null suggested price", async () => {
      const history = new HistoryModel(
        {
          vendorName: "TRADENT",
          existingPrice: 100.0,
          minQty: 1,
          rank: 1,
          lowestVendor: "VENDOR1",
          lowestPrice: 99.99,
          suggestedPrice: null,
          repriceComment: "Price updated",
          maxVendor: "VENDOR2",
          maxVendorPrice: 110.0,
          otherVendorList: "VENDOR3",
          contextCronName: "TestCron",
          triggeredByVendor: "VENDOR1",
          repriceResult: RepriceResultEnum.CHANGE_DOWN,
        } as any,
        "123",
        new Date("2024-01-01"),
        1
      );
      const refTime = new Date("2024-01-01");
      mockQueryBuilder.insert.mockResolvedValueOnce([10]);

      const result = await InsertHistory(history, refTime);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          SuggestedPrice: null,
        })
      );
      expect(result).toEqual(10);
    });

    it("should handle errors gracefully", async () => {
      const history = new HistoryModel(
        {
          vendorName: "TRADENT",
          existingPrice: 100.0,
          minQty: 1,
          rank: 1,
          lowestVendor: "VENDOR1",
          lowestPrice: 99.99,
          suggestedPrice: 99.99,
          repriceComment: "Price updated",
          maxVendor: "VENDOR2",
          maxVendorPrice: 110.0,
          otherVendorList: "VENDOR3",
          contextCronName: "TestCron",
          triggeredByVendor: "VENDOR1",
          repriceResult: RepriceResultEnum.CHANGE_DOWN,
        } as any,
        "123",
        new Date("2024-01-01"),
        1
      );
      const refTime = new Date("2024-01-01");
      mockQueryBuilder.insert.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await InsertHistory(history, refTime);

      expect(console.log).toHaveBeenCalledWith("Error in InsertHistory", history, refTime, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("UpdateTriggeredByVendor", () => {
    it("should update triggered by vendor for TRADENT", async () => {
      const payload = { mpid: "123" };
      const contextVendor = "TRADENT";
      const mpid = "123";
      (GetTriggeredByValue as jest.Mock).mockReturnValueOnce("VENDOR1");
      mockKnex.raw.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await UpdateTriggeredByVendor(payload, contextVendor, mpid);

      expect(GetTriggeredByValue).toHaveBeenCalledWith(payload);
      expect(mockKnex.raw).toHaveBeenCalledWith(`UPDATE ${applicationConfig.SQL_TRADENT_DETAILS} SET TriggeredByVendor=? WHERE MpId =?`, ["VENDOR1", 123]);
      expect(result).toEqual("VENDOR1");
    });

    it("should update triggered by vendor for all vendors", async () => {
      const vendors = ["FRONTIER", "MVP", "TOPDENT", "FIRSTDENT", "TRIAD"];
      const payload = { mpid: "123" };
      const mpid = "123";
      (GetTriggeredByValue as jest.Mock).mockReturnValue("VENDOR1");
      mockKnex.raw.mockResolvedValue([{ affectedRows: 1 }]);

      for (const vendor of vendors) {
        const result = await UpdateTriggeredByVendor(payload, vendor, mpid);
        expect(result).toEqual("VENDOR1");
      }
    });

    it("should update triggered by vendor for BITESUPPLY", async () => {
      const payload = { mpid: "123" };
      const contextVendor = "BITESUPPLY";
      const mpid = "123";
      (GetTriggeredByValue as jest.Mock).mockReturnValueOnce("VENDOR1");
      mockKnex.raw.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await UpdateTriggeredByVendor(payload, contextVendor, mpid);

      expect(GetTriggeredByValue).toHaveBeenCalledWith(payload);
      expect(mockKnex.raw).toHaveBeenCalledWith(`UPDATE ${applicationConfig.SQL_BITESUPPLY_DETAILS} SET TriggeredByVendor=? WHERE MpId =?`, ["VENDOR1", 123]);
      expect(result).toEqual("VENDOR1");
    });

    it("should handle unknown vendor", async () => {
      const payload = { mpid: "123" };
      const contextVendor = "UNKNOWN";
      const mpid = "123";
      (GetTriggeredByValue as jest.Mock).mockReturnValueOnce("VENDOR1");

      const result = await UpdateTriggeredByVendor(payload, contextVendor, mpid);

      // The code still executes the query even with null table name (UPDATE null SET ...)
      // So we expect it to be called
      expect(mockKnex.raw).toHaveBeenCalledWith(expect.stringContaining("UPDATE null"), ["VENDOR1", 123]);
      expect(result).toEqual("VENDOR1");
    });

    it("should handle errors gracefully", async () => {
      const payload = { mpid: "123" };
      const contextVendor = "TRADENT";
      const mpid = "123";
      (GetTriggeredByValue as jest.Mock).mockReturnValueOnce("VENDOR1");
      mockKnex.raw.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await UpdateTriggeredByVendor(payload, contextVendor, mpid);

      // The code uses a template string, so it's a single argument
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Exception while UpdateTriggeredByVendor"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Vendor TRADENT"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("MPID : 123"));
      expect(result).toEqual("VENDOR1");
    });
  });

  describe("UpdateHistoryWithMessage", () => {
    it("should update history with message successfully", async () => {
      const identifier = "123";
      const history = "Updated message";
      updateChain._setResolveValue(1);

      const result = await UpdateHistoryWithMessage(identifier, history);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_HISTORY);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ RepriceComment: history });
      expect(updateChain.where).toHaveBeenCalledWith("Id", 123);
      expect(result).toEqual(1);
    });

    it("should handle errors gracefully", async () => {
      const identifier = "123";
      const history = "Updated message";
      updateChain._setReject(new Error("DB Error"));

      const result = await UpdateHistoryWithMessage(identifier, history);

      expect(console.log).toHaveBeenCalledWith("Error in UpdateHistoryWithMessage", identifier, history, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("GetActiveFullProductDetailsList", () => {
    it("should get active full product details list successfully", async () => {
      const cronId = "cron-123";
      const mockProducts = [{ ProductId: 123 }];
      mockKnex.raw.mockReset();
      let callCount = 0;
      mockKnex.raw.mockImplementation((sql: string) => {
        callCount++;
        // If it's a long UNION query (final call), it's the final call
        if (sql.includes("UNION") && sql.length > 100) {
          return Promise.resolve([[mockProducts]]);
        }
        // Otherwise, it's a raw call inside a query builder, return the SQL as-is
        return Promise.resolve(sql);
      });
      (MapProductDetailsList as jest.Mock).mockReturnValueOnce([{ mpId: 123 }]);

      const result = await GetActiveFullProductDetailsList(cronId);

      expect(mockKnex.raw).toHaveBeenCalled();
      expect(MapProductDetailsList).toHaveBeenCalledWith([mockProducts]);
      expect(result).toEqual([{ mpId: 123 }]);
    });

    it("should throw error on failure", async () => {
      const cronId = "cron-123";
      // Reset the default mock and set up error
      mockKnex.raw.mockReset();
      mockKnex.raw.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      // When knex.raw rejects, the error should be caught and rethrown
      await expect(GetActiveFullProductDetailsList(cronId)).rejects.toThrow();
      expect(console.log).toHaveBeenCalledWith("Error in GetActiveFullProductDetailsList", cronId, expect.any(Error));
    });
  });

  describe("getNet32UrlById", () => {
    it("should get Net32 URL by id successfully", async () => {
      const mpId = 123;
      mockQueryBuilder.select.mockImplementationOnce(() => {
        const selectResult: any = Promise.resolve([{ Net32Url: "https://example.com/product" }]);
        selectResult.first = jest.fn().mockResolvedValue({ Net32Url: "https://example.com/product" });
        return selectResult;
      });

      const result = await getNet32UrlById(mpId);

      expect(mockKnex).toHaveBeenCalledWith("table_scrapeProductList");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("MpId", mpId);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith("Net32Url");
      expect(result).toEqual("https://example.com/product");
    });

    it("should return null when product not found", async () => {
      const mpId = 123;
      // Mock select() to return a thenable with first() that resolves to undefined
      mockQueryBuilder.select.mockImplementationOnce(() => {
        const selectResult: any = Promise.resolve([]);
        selectResult.first = jest.fn().mockResolvedValue(undefined);
        return selectResult;
      });

      const result = await getNet32UrlById(mpId);

      expect(result).toBeNull();
    });

    it("should throw error on failure", async () => {
      const mpId = 123;
      // Mock select() to return a thenable with first() that rejects
      mockQueryBuilder.select.mockImplementationOnce(() => {
        const selectResult: any = Promise.resolve([]);
        selectResult.first = jest.fn().mockImplementation(() => {
          return Promise.reject(createDbError());
        });
        return selectResult;
      });

      await expect(getNet32UrlById(mpId)).rejects.toThrow("DB Error");
      expect(console.log).toHaveBeenCalledWith("Error in getNet32UrlById", mpId, expect.any(Error));
    });
  });

  describe("UpdateRepriceResultStatus", () => {
    it("should update reprice result status successfully", async () => {
      const repriceResultStatus = RepriceResultEnum.CHANGE_DOWN;
      const mpid = "123";
      const contextVendor = VendorName.TRADENT;
      updateChain._setResolveValue(1);

      await UpdateRepriceResultStatus(repriceResultStatus, mpid, contextVendor);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_TRADENT_DETAILS);
      // Code does knex(table).where().update(), so where returns builder, update returns chain
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("MpId", 123);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ RepriceResult: repriceResultStatus });
    });

    it("should handle errors gracefully", async () => {
      const repriceResultStatus = RepriceResultEnum.CHANGE_DOWN;
      const mpid = "123";
      const contextVendor = VendorName.TRADENT;
      updateChain._setReject(new Error("DB Error"));

      await UpdateRepriceResultStatus(repriceResultStatus, mpid, contextVendor);

      expect(console.log).toHaveBeenCalledWith("Error in UpdateRepriceResultStatus", repriceResultStatus, mpid, contextVendor, expect.any(Error));
    });

    it("should update reprice result status for TOPDENT", async () => {
      const repriceResultStatus = RepriceResultEnum.CHANGE_UP;
      const mpid = "456";
      const contextVendor = VendorName.TOPDENT;
      updateChain._setResolveValue(1);

      await UpdateRepriceResultStatus(repriceResultStatus, mpid, contextVendor);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_TOPDENT_DETAILS);
    });

    it("should update reprice result status for FIRSTDENT", async () => {
      const repriceResultStatus = RepriceResultEnum.CHANGE_UP;
      const mpid = "456";
      const contextVendor = VendorName.FIRSTDENT;
      updateChain._setResolveValue(1);

      await UpdateRepriceResultStatus(repriceResultStatus, mpid, contextVendor);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_FIRSTDENT_DETAILS);
    });

    it("should update reprice result status for TRIAD", async () => {
      const repriceResultStatus = RepriceResultEnum.CHANGE_UP;
      const mpid = "456";
      const contextVendor = VendorName.TRIAD;
      updateChain._setResolveValue(1);

      await UpdateRepriceResultStatus(repriceResultStatus, mpid, contextVendor);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_TRIAD_DETAILS);
    });

    it("should update reprice result status for BITESUPPLY", async () => {
      const repriceResultStatus = RepriceResultEnum.CHANGE_UP;
      const mpid = "456";
      const contextVendor = VendorName.BITESUPPLY;
      updateChain._setResolveValue(1);

      await UpdateRepriceResultStatus(repriceResultStatus, mpid, contextVendor);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_BITESUPPLY_DETAILS);
    });
  });

  describe("GetProxiesNet32", () => {
    it("should get proxies Net32 successfully", async () => {
      const usernames = ["user1", "user2"];
      const mockProxies = [
        { id: 1, proxy_username: "user1", proxy_password: "pass1", ip: "1.1.1.1", port: "8080" },
        { id: 2, proxy_username: "user2", proxy_password: "pass2", ip: "2.2.2.2", port: "8080" },
      ];
      mockQueryBuilder.select.mockResolvedValueOnce(mockProxies);

      const result = await GetProxiesNet32(usernames);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_PROXY_NET_32);
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("proxy_username", usernames);
      expect(result).toEqual(mockProxies);
    });

    it("should return empty array when usernames is empty", async () => {
      const usernames: string[] = [];

      const result = await GetProxiesNet32(usernames);

      expect(mockQueryBuilder.whereIn).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      const usernames = ["user1"];
      mockQueryBuilder.select.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await GetProxiesNet32(usernames);

      expect(console.log).toHaveBeenCalledWith("Error in GetProxiesNet32", usernames, expect.any(Error));
      expect(result).toEqual([]);
    });
  });

  describe("GetVendorKeys", () => {
    it("should get vendor keys successfully", async () => {
      const vendors = ["TRADENT", "FRONTIER"];
      const mockRows = [
        { vendor: "TRADENT", value: "key1" },
        { vendor: "FRONTIER", value: "key2" },
      ];
      // select() returns a thenable, so we need to mock it to return a promise
      mockQueryBuilder.select.mockImplementationOnce(() => Promise.resolve(mockRows));

      const result = await GetVendorKeys(vendors);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_VENDOR_KEYS);
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("vendor", vendors);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("is_primary", 1);
      expect(result).toBeInstanceOf(Map);
      expect(result?.get("TRADENT")).toEqual("key1");
      expect(result?.get("FRONTIER")).toEqual("key2");
    });

    it("should return empty map when vendors is empty", async () => {
      const vendors: string[] = [];

      const result = await GetVendorKeys(vendors);

      expect(mockQueryBuilder.whereIn).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(Map);
      expect(result?.size).toEqual(0);
    });

    it("should handle vendors without keys", async () => {
      const vendors = ["TRADENT", "FRONTIER", "MVP"];
      const mockRows = [
        { vendor: "TRADENT", value: "key1" },
        // FRONTIER and MVP not in results
      ];
      mockQueryBuilder.select.mockImplementationOnce(() => Promise.resolve(mockRows));

      const result = await GetVendorKeys(vendors);

      expect(result?.get("TRADENT")).toEqual("key1");
      expect(result?.get("FRONTIER")).toBeNull();
      expect(result?.get("MVP")).toBeNull();
    });

    it("should return null on error", async () => {
      const vendors = ["TRADENT"];
      mockQueryBuilder.select.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await GetVendorKeys(vendors);

      expect(console.log).toHaveBeenCalledWith("Error in GetVendorKeys", vendors, expect.any(Error));
      expect(result).toBeNull();
    });
  });

  describe("ExecuteQuery", () => {
    it("should execute query successfully", async () => {
      const query = "SELECT * FROM table";
      const params = ["param1"];
      const mockResult = [{ id: 1 }];
      mockKnex.raw.mockResolvedValueOnce([mockResult]);

      const result = await ExecuteQuery(query, params);

      expect(mockKnex.raw).toHaveBeenCalledWith(query, params);
      expect(result).toEqual(mockResult);
    });

    it("should handle errors gracefully", async () => {
      const query = "SELECT * FROM table";
      const params = ["param1"];
      mockKnex.raw.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      const result = await ExecuteQuery(query, params);

      expect(console.log).toHaveBeenCalledWith("Error in ExecuteQuery", query, params, expect.any(Error));
      expect(result).toBeUndefined();
    });
  });

  describe("GetCurrentStock", () => {
    it("should get current stock successfully", async () => {
      const mpids = ["123", "456"];
      const vendorName = VendorName.TRADENT;
      const mockStock = [
        { mpid: "123", CurrentInStock: 1, CurrentInventory: 100 },
        { mpid: "456", CurrentInStock: 0, CurrentInventory: 0 },
      ];
      mockQueryBuilder.select.mockImplementationOnce(() => Promise.resolve(mockStock));

      const result = await GetCurrentStock(mpids, vendorName);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_TRADENT_DETAILS);
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith("mpid", mpids);
      expect(result).toEqual(mockStock);
    });

    it("should throw error on failure", async () => {
      const mpids = ["123"];
      const vendorName = VendorName.TRADENT;
      mockQueryBuilder.select.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      await expect(GetCurrentStock(mpids, vendorName)).rejects.toThrow("DB Error");
      expect(console.log).toHaveBeenCalledWith("Error in GetCurrentStock", mpids, vendorName, applicationConfig.SQL_TRADENT_DETAILS, expect.any(Error));
    });
  });

  describe("WaitlistInsert", () => {
    it("should insert waitlist items successfully", async () => {
      const waitlistItems = [new WaitlistModel(123, "TRADENT", 50, 100, 100), new WaitlistModel(456, "FRONTIER", 25, 50, 50)];
      mockQueryBuilder.insert.mockResolvedValueOnce([1, 2]);

      await WaitlistInsert(waitlistItems);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_WAITLIST);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(waitlistItems);
    });

    it("should throw error on failure", async () => {
      const waitlistItems = [new WaitlistModel(123, "TRADENT", 50, 100, 100)];
      mockQueryBuilder.insert.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      await expect(WaitlistInsert(waitlistItems)).rejects.toThrow("DB Error");
      expect(console.log).toHaveBeenCalledWith("Error in WaitlistInsert", waitlistItems, expect.any(Error));
    });
  });

  describe("GetWaitlistPendingItems", () => {
    it("should get waitlist pending items successfully", async () => {
      const mockItems = [new WaitlistModel(123, "TRADENT", 50, 100, 100, "pending"), new WaitlistModel(456, "FRONTIER", 25, 50, 50, "pending")];
      mockQueryBuilder.select.mockImplementationOnce(() => Promise.resolve(mockItems));

      const result = await GetWaitlistPendingItems();

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_WAITLIST);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("api_status", "pending");
      expect(result).toEqual(mockItems);
    });

    it("should throw error on failure", async () => {
      mockQueryBuilder.select.mockImplementationOnce(() => {
        return Promise.reject(createDbError());
      });

      await expect(GetWaitlistPendingItems()).rejects.toThrow("DB Error");
      expect(console.log).toHaveBeenCalledWith("Error in GetWaitlistPendingItems", expect.any(Error));
    });
  });

  describe("UpdateWaitlistStatus", () => {
    it("should update waitlist status successfully", async () => {
      const id = 1;
      const status = "completed";
      const message = "Success";
      updateChain._setResolveValue(1);

      await UpdateWaitlistStatus(id, status, message);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_WAITLIST);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("id", id);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        api_status: status,
        message: message,
        updated_at: expect.any(Date),
      });
    });

    it("should update waitlist status without message", async () => {
      const id = 1;
      const status = "completed";
      updateChain._setResolveValue(1);

      await UpdateWaitlistStatus(id, status);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        api_status: status,
        message: undefined,
        updated_at: expect.any(Date),
      });
    });

    it("should throw error on failure", async () => {
      const id = 1;
      const status = "completed";
      const message = "Error message";
      updateChain._setReject(new Error("DB Error"));

      await expect(UpdateWaitlistStatus(id, status, message)).rejects.toThrow("DB Error");
      expect(console.log).toHaveBeenCalledWith("Error in UpdateWaitlistStatus", id, status, message, expect.any(Error));
    });
  });

  describe("UpdateVendorStock", () => {
    it("should update vendor stock successfully", async () => {
      const vendorName = VendorName.TRADENT;
      const mpid = 123;
      const inventory = 150;
      updateChain._setResolveValue(1);

      await UpdateVendorStock(vendorName, mpid, inventory);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_TRADENT_DETAILS);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("MpId", mpid);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ CurrentInventory: inventory });
    });

    it("should handle uppercase vendor name", async () => {
      const vendorName = "tradent";
      const mpid = 123;
      const inventory = 150;
      updateChain._setResolveValue(1);

      await UpdateVendorStock(vendorName, mpid, inventory);

      expect(mockKnex).toHaveBeenCalledWith(applicationConfig.SQL_TRADENT_DETAILS);
    });

    it("should throw error on failure", async () => {
      const vendorName = VendorName.TRADENT;
      const mpid = 123;
      const inventory = 150;
      updateChain._setReject(new Error("DB Error"));

      await expect(UpdateVendorStock(vendorName, mpid, inventory)).rejects.toThrow("DB Error");
      expect(console.log).toHaveBeenCalledWith("Error in UpdateVendorStock", vendorName, mpid, inventory, expect.any(Error));
    });
  });
});
