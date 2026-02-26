import { ObjectId } from "mongodb";
import * as mongoService from "../mongo";

// --- Mock collection chain (find/sort/skip/limit/toArray, aggregate().toArray())
function createMockCollection() {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn().mockResolvedValue([]),
  };
  return {
    find: jest.fn().mockReturnValue(chain),
    findOne: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
    insertOne: jest.fn().mockResolvedValue({ insertedId: new ObjectId() }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    countDocuments: jest.fn().mockResolvedValue(0),
    estimatedDocumentCount: jest.fn().mockResolvedValue(0),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    aggregate: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
  };
}

const mockCollection = createMockCollection();
const productsCollection = createMockCollection();
const mockDb = {
  collection: jest.fn((name: string) => (name === "products" ? productsCollection : mockCollection)),
};

const mockClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  db: jest.fn(() => mockDb),
};

jest.mock("mongodb", () => ({
  MongoClient: jest.fn(() => mockClient),
  ObjectId: class MockObjectId {
    constructor(public id?: string) {}
  },
}));

jest.mock("../../utility/config", () => ({
  applicationConfig: {
    GET_REPRICER_DBNAME: "repricer",
    GET_CRON_LOGS_COLLECTION_NAME: "cronLogs",
    ERROR_422_CRON_LOGS: "422cronLogs",
    CRON_PAGESIZE: 10,
    USERS_COLLECTION: "users",
    ITEMS_COLLECTION_NAME: "items",
    PRODUCT_COLLECTION: "products",
    CRON_STATUS_COLLECTION_NAME: "cronStatusLogs",
    CRON_SETTINGS_COLLECTION_NAME: "cronSettings",
    ERROR_ITEM_COLLECTION: "errorItems",
    HISTORY_DB: "historyData",
    HISTORY_LIMIT: 50,
    FILTER_CRON_COLLECTION_NAME: "filterCronSettings",
    SLOW_CRON_GROUP_COLLECTION_NAME: "slowCronSettings",
    FILTER_CRON_LOGS: "filterCronLogs",
    SCRAPE_ITEMS_COLLECTION: "scrapeItems",
    SCRAPE_CRON_SETTINGS_COLLECTION_NAME: "scrapeCronSettings",
    SCRAPE_LOGS_COLLECTION: "scrapeCronLogs",
    MANAGED_MONGO_URL: "mongodb://localhost:27017/repricer?password={{password}}",
    MANAGED_MONGO_PASSWORD: "encrypted",
    REPRICER_ENCRYPTION_KEY: "key",
    CACHE_HOST_URL: "localhost",
    CACHE_PORT: "6379",
    CACHE_USERNAME: "u",
    CACHE_PASSWORD: "p",
  },
}));

jest.mock("../../utility/encrypto", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    decrypt: jest.fn().mockReturnValue("decrypted-password"),
  })),
}));

const mockCacheGet = jest.fn().mockResolvedValue(null);
const mockCacheSet = jest.fn().mockResolvedValue(undefined);
const mockCacheDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock("../../client/cacheClient", () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      get: mockCacheGet,
      set: mockCacheSet,
      disconnect: mockCacheDisconnect,
    })),
  },
  GetCacheClientOptions: jest.fn(() => ({})),
}));

const mockGetAuditInfo = jest.fn().mockResolvedValue({ UpdatedBy: "test", UpdatedOn: new Date() });

jest.mock("../../utility/session-helper", () => ({
  GetAuditInfo: (...args: any[]) => mockGetAuditInfo(...args),
}));

describe("mongo service", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    mockDb.collection.mockImplementation((name: string) => (name === "products" ? productsCollection : mockCollection));
    mockCollection.findOne.mockResolvedValue(null);
    productsCollection.findOne.mockResolvedValue(null);
    mockCollection.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
    });
    mockCollection.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    mockCacheGet.mockResolvedValue(null);
    productsCollection.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("GetCronLogsV2", () => {
    const dateRange = { fromDate: "2024-01-01", toDate: "2024-01-02" };

    it("builds Manual type query and returns paginated result", async () => {
      mockCollection.estimatedDocumentCount.mockResolvedValue(25);
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ _id: "1", type: "Manual" }]),
      });

      const result = await mongoService.GetCronLogsV2(0, "Manual", "", dateRange, 10);

      expect(result.totalDocs).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.pageNumber).toBe(0);
      expect(result.pageSize).toBe(10);
      expect(mockCollection.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              type: "Manual",
              time: { $gt: dateRange.fromDate, $lt: dateRange.toDate },
            }),
          }),
          expect.objectContaining({ $sort: { time: -1 } }),
          expect.objectContaining({ $skip: 0 }),
          expect.objectContaining({ $limit: 10 }),
        ])
      );
    });

    it("builds Regular type query with $nin", async () => {
      mockCollection.estimatedDocumentCount.mockResolvedValue(5);
      mockCollection.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });

      await mongoService.GetCronLogsV2(0, "Regular", "cron-1", { fromDate: "", toDate: "" }, 10);

      expect(mockCollection.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              type: { $nin: ["Manual", "422Error", "OVERRIDE_RUN", "FEED_RUN", "SLOWCRON"] },
              cronId: "cron-1",
            }),
          }),
        ])
      );
    });

    it("422Error type: counts 422 collection and returns error logs", async () => {
      mockCollection.countDocuments.mockResolvedValue(3);
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ type: "422Error" }]),
      });

      const result = await mongoService.GetCronLogsV2(0, "422Error", "", dateRange, 10);

      expect(result.mongoResult).toEqual([{ type: "422Error" }]);
      expect(result.totalDocs).toBe(3);
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({ cronId: "DUMMY-422-Error" });
    });

    it("All type: sums 422 count and estimatedDocumentCount", async () => {
      mockCollection.countDocuments.mockResolvedValue(2);
      mockCollection.estimatedDocumentCount.mockResolvedValue(8);
      mockCollection.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ type: "422Error" }]),
      });

      const result = await mongoService.GetCronLogsV2(0, "All", "", dateRange, 10);

      expect(result.totalDocs).toBe(10);
      expect(result.mongoResult).toEqual([{ type: "422Error" }]);
    });

    it("Override and FeedRun and default type", async () => {
      mockCollection.estimatedDocumentCount.mockResolvedValue(1);
      mockCollection.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([{ type: "OVERRIDE_RUN" }]) });

      const r1 = await mongoService.GetCronLogsV2(0, "Override", "", dateRange, 10);
      expect(r1.mongoResult).toEqual([{ type: "OVERRIDE_RUN" }]);

      mockCollection.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([{ type: "FEED_RUN" }]) });
      const r2 = await mongoService.GetCronLogsV2(0, "FeedRun", "", dateRange, 10);
      expect(r2.mongoResult).toEqual([{ type: "FEED_RUN" }]);

      mockCollection.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([{ type: "Custom" }]) });
      const r3 = await mongoService.GetCronLogsV2(0, "Custom", "", dateRange, 10);
      expect(r3.mongoResult).toEqual([{ type: "Custom" }]);
    });

    it("ALL_EXCEPT_422: uses find on cron logs with time and optional cronId", async () => {
      mockCollection.estimatedDocumentCount.mockResolvedValue(5);
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ type: "Regular" }]),
      };
      mockCollection.find.mockReturnValue(findChain);

      const result = await mongoService.GetCronLogsV2(0, "ALL_EXCEPT_422", "cron-1", dateRange, 10);

      expect(result.mongoResult).toEqual([{ type: "Regular" }]);
      expect(mockCollection.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: expect.arrayContaining([{ time: { $gt: dateRange.fromDate, $lt: dateRange.toDate } }, { cronId: "cron-1" }]),
        })
      );
    });

    it("uses date range in query when fromDate and toDate present", async () => {
      mockCollection.estimatedDocumentCount.mockResolvedValue(0);
      mockCollection.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });

      await mongoService.GetCronLogsV2(0, "Manual", "", dateRange, 10);

      expect(mockCollection.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              type: "Manual",
              time: { $gt: dateRange.fromDate, $lt: dateRange.toDate },
            }),
          }),
        ])
      );
    });

    it("defaults pageSize to config CRON_PAGESIZE when pgLimit invalid", async () => {
      mockCollection.estimatedDocumentCount.mockResolvedValue(0);
      mockCollection.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });

      await mongoService.GetCronLogsV2(0, "Manual", "", { fromDate: "", toDate: "" }, NaN as any);

      expect(mockCollection.aggregate).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ $limit: 10 })]));
    });
  });

  describe("GetCronLogs", () => {
    it("builds query by type and returns paginated result", async () => {
      mockCollection.countDocuments.mockResolvedValue(15);
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ _id: "1" }]),
      };
      mockCollection.find.mockReturnValue(findChain);

      const result = await mongoService.GetCronLogs(0, "Manual", "cron-1", {
        fromDate: "2024-01-01",
        toDate: "2024-01-02",
      });

      expect(result.totalDocs).toBe(15);
      expect(result.totalPages).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.mongoResult).toEqual([{ _id: "1" }]);
      expect(mockCollection.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "Manual",
          cronId: "cron-1",
          time: { $gt: expect.any(Date), $lt: expect.any(Date) },
        })
      );
    });

    it("when pgNo is undefined uses find without skip/limit", async () => {
      mockCollection.countDocuments.mockResolvedValue(1);
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ a: 1 }]),
      });

      const result = await mongoService.GetCronLogs(undefined as any, "All", "", { fromDate: "", toDate: "" });

      expect(result.mongoResult).toEqual([{ a: 1 }]);
      expect(mockCollection.find().sort).toHaveBeenCalledWith({ $natural: -1 });
    });

    it("Regular type uses $nin", async () => {
      mockCollection.countDocuments.mockResolvedValue(0);
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([]),
      });

      await mongoService.GetCronLogs(0, "Regular", "", { fromDate: "", toDate: "" });

      expect(mockCollection.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: { $nin: ["Manual", "422Error", "OVERRIDE_RUN", "FEED_RUN", "SLOWCRON"] },
        })
      );
    });
  });

  describe("GetUserLogin", () => {
    it("calls users collection findOne with query", async () => {
      mockCollection.findOne.mockResolvedValue({ userName: "alice", userPassword: "hash" });

      const result = await mongoService.GetUserLogin({ userName: "alice" });

      expect(mockDb.collection).toHaveBeenCalledWith("users");
      expect(mockCollection.findOne).toHaveBeenCalledWith({ userName: "alice" });
      expect(result).toEqual({ userName: "alice", userPassword: "hash" });
    });
  });

  describe("GetItemList", () => {
    it("finds items by mpid and returns array", async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ mpid: "mp1" }, { mpid: "mp1" }]),
      });

      const result = await mongoService.GetItemList("mp1");

      expect(mockCollection.find).toHaveBeenCalledWith({ mpid: "mp1" });
      expect(result).toEqual([{ mpid: "mp1" }, { mpid: "mp1" }]);
    });
  });

  describe("UpdateCronLogPostPriceUpdate", () => {
    it("findOneAndUpdates cron log by _id with logs", async () => {
      mockCollection.findOneAndUpdate.mockResolvedValue({ _id: "id1", logs: ["a"] });

      const result = await mongoService.UpdateCronLogPostPriceUpdate({ _id: "id1", logs: ["a"] });

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith({ _id: "id1" }, { $set: { logs: ["a"] } });
      expect(result).toEqual({ _id: "id1", logs: ["a"] });
    });
  });

  describe("GetLogsById", () => {
    it("returns cron log when found in main collection", async () => {
      const doc = { _id: new ObjectId("507f1f77bcf86cd799439011"), cronId: "c1" };
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([doc]),
      });

      const result = await mongoService.GetLogsById("507f1f77bcf86cd799439011");

      expect(result).toEqual([doc]);
      expect(mockCollection.find).toHaveBeenCalledWith({
        _id: expect.any(ObjectId),
      });
    });

    it("falls back to ERROR_422_CRON_LOGS when main collection returns empty", async () => {
      mockCollection.find.mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([]) }).mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([{ type: "422Error" }]) });

      const result = await mongoService.GetLogsById("507f1f77bcf86cd799439011");

      expect(result).toEqual([{ type: "422Error" }]);
      expect(mockDb.collection).toHaveBeenCalledWith("422cronLogs");
    });
  });

  describe("FindOneProductModel", () => {
    it("returns product from PRODUCT_COLLECTION", async () => {
      productsCollection.findOne.mockResolvedValue({ mpId: "mp1", name: "P1" });

      const result = await mongoService.FindOneProductModel({ mpId: "mp1" });

      expect(productsCollection.findOne).toHaveBeenCalledWith({ mpId: "mp1" });
      expect(result).toEqual({ mpId: "mp1", name: "P1" });
    });
  });

  describe("GetLatestCronStatus", () => {
    it("finds In-Progress status sorted by _id -1", async () => {
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ status: "In-Progress" }]),
      });

      const result = await mongoService.GetLatestCronStatus();

      expect(mockCollection.find).toHaveBeenCalledWith({ status: "In-Progress" });
      expect(result).toEqual([{ status: "In-Progress" }]);
    });
  });

  describe("PushManualCronLogAsync", () => {
    it("inserts payload into cron logs", async () => {
      mockCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() });

      const payload = { type: "Manual", cronId: "c1", time: new Date() };
      const result = await mongoService.PushManualCronLogAsync(payload);

      expect(mockCollection.insertOne).toHaveBeenCalledWith(payload);
      expect(result).toHaveProperty("insertedId");
    });
  });

  describe("GetCronSettingsList", () => {
    it("returns cached list when cache has value", async () => {
      const cached = [{ CronId: "c1", CronName: "Cron 1" }];
      mockCacheGet.mockResolvedValue(cached);

      const result = await mongoService.GetCronSettingsList();

      expect(result).toEqual(cached);
      expect(mockCacheDisconnect).toHaveBeenCalled();
      expect(mockDb.collection).not.toHaveBeenCalledWith("cronSettings");
    });

    it("fetches from DB and sets cache when cache miss", async () => {
      mockCacheGet.mockResolvedValue(null);
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ CronId: "c1" }]),
      });

      const result = await mongoService.GetCronSettingsList();

      expect(mockDb.collection).toHaveBeenCalledWith("cronSettings");
      expect(mockCacheSet).toHaveBeenCalledWith("CRON_SETTINGS_LIST", [{ CronId: "c1" }]);
      expect(result).toEqual([{ CronId: "c1" }]);
    });
  });

  describe("PurgeCronBasedOnId", () => {
    it("deleteMany by cronId", async () => {
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 5 });

      const result = await mongoService.PurgeCronBasedOnId("cron-1");

      expect(mockCollection.deleteMany).toHaveBeenCalledWith({ cronId: "cron-1" });
      expect(result).toEqual({ deletedCount: 5 });
    });
  });

  describe("PurgeCronBasedOnDate", () => {
    it("deleteMany with time $lte dateString", async () => {
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 10 });

      const result = await mongoService.PurgeCronBasedOnDate("2024-01-01");

      expect(mockCollection.deleteMany).toHaveBeenCalledWith({
        time: { $lte: new Date("2024-01-01") },
      });
      expect(result).toEqual({ deletedCount: 10 });
    });
  });

  describe("deleteById", () => {
    it("deleteOne product by mpId", async () => {
      productsCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await mongoService.deleteById("mp123");

      expect(productsCollection.deleteOne).toHaveBeenCalledWith({ mpId: "mp123" });
      expect(result).toEqual({ deletedCount: 1 });
    });
  });

  describe("CheckInProgressExport", () => {
    it("finds exports with status In Progress", async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ status: "In Progress" }]),
      });

      const result = await mongoService.CheckInProgressExport();

      expect(mockDb.collection).toHaveBeenCalledWith("exports");
      expect(mockCollection.find).toHaveBeenCalledWith({ status: "In Progress" });
      expect(result).toEqual([{ status: "In Progress" }]);
    });
  });

  describe("FetchQueuedExport", () => {
    it("findOne with $or Queued/Batched", async () => {
      mockCollection.findOne.mockResolvedValue({ status: "Queued" });

      const result = await mongoService.FetchQueuedExport();

      expect(mockCollection.findOne).toHaveBeenCalledWith({
        $or: [{ status: "Queued" }, { status: "Batched" }],
      });
      expect(result).toEqual({ status: "Queued" });
    });
  });

  describe("UpdateExportStatus", () => {
    it("findOneAndUpdate with id, status and info", async () => {
      mockCollection.findOneAndUpdate.mockResolvedValue({ _id: "id1", status: "Done" });

      const result = await mongoService.UpdateExportStatus("id1", "Done", { url: "x" });

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith({ _id: "id1" }, { $set: { url: "x", status: "Done" } });
      expect(result).toEqual({ _id: "id1", status: "Done" });
    });
  });

  describe("FetchExports", () => {
    it("finds all exports", async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ _id: "1" }, { _id: "2" }]),
      });

      const result = await mongoService.FetchExports();

      expect(mockCollection.find).toHaveBeenCalledWith({});
      expect(result).toEqual([{ _id: "1" }, { _id: "2" }]);
    });
  });

  describe("Get422ProductCountByType", () => {
    it("returns count for active and insertReason", async () => {
      mockCollection.countDocuments.mockResolvedValue(7);

      const result = await mongoService.Get422ProductCountByType("someType");

      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        $and: [{ active: true }, { insertReason: "someType" }],
      });
      expect(result).toBe(7);
    });
  });

  describe("GetContextErrorItemsCount", () => {
    it("returns count with nextCronTime and active", async () => {
      mockCollection.countDocuments.mockResolvedValue(3);

      const result = await mongoService.GetContextErrorItemsCount(true);

      expect(mockCollection.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          nextCronTime: { $lte: expect.any(Date) },
          active: true,
        })
      );
      expect(result).toBe(3);
    });
  });

  describe("GetHistoryDetailsForId", () => {
    it("findOne history by mpId (parsed as int)", async () => {
      mockCollection.findOne.mockResolvedValue({ mpId: 123, data: "x" });

      const result = await mongoService.GetHistoryDetailsForId("123");

      expect(mockCollection.findOne).toHaveBeenCalledWith({ mpId: 123 });
      expect(result).toEqual({ mpId: 123, data: "x" });
    });
  });

  describe("GetHistoryDetailsForDateRange", () => {
    it("finds with date range and filters historicalLogs", async () => {
      const startDate = "2024-01-01";
      const endDate = "2024-01-31";
      const doc = {
        mpId: 1,
        historicalLogs: [{ refTime: new Date("2024-01-15") }, { refTime: new Date("2024-02-01") }, { refTime: new Date("2023-12-31") }],
      };
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([doc]),
      });

      const result = await mongoService.GetHistoryDetailsForDateRange(startDate, endDate, "1");

      expect(mockCollection.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: expect.arrayContaining([{ mpId: { $gte: 1 } }, { "historicalLogs.refTime": { $gte: new Date(startDate) } }, { "historicalLogs.refTime": { $lte: new Date(endDate) } }]),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].historicalLogs).toEqual([{ refTime: new Date("2024-01-15") }]);
    });
  });

  describe("GetHistoryDetailsForIdByDate", () => {
    it("findOne and filters historicalLogs", async () => {
      const startDate = "2024-01-01";
      const endDate = "2024-01-31";
      const doc = {
        mpId: 1,
        historicalLogs: [{ refTime: new Date("2024-01-10") }, { refTime: new Date("2024-02-01") }],
      };
      mockCollection.findOne.mockResolvedValue(doc);

      const result = await mongoService.GetHistoryDetailsForIdByDate("1", startDate, endDate);

      expect(mockCollection.findOne).toHaveBeenCalledWith({
        $and: [{ mpId: 1 }, { "historicalLogs.refTime": { $gte: new Date(startDate) } }, { "historicalLogs.refTime": { $lte: new Date(endDate) } }],
      });
      expect(result!.historicalLogs).toEqual([{ refTime: new Date("2024-01-10") }]);
    });

    it("returns doc as-is when no historicalLogs", async () => {
      mockCollection.findOne.mockResolvedValue({ mpId: 1 });

      const result = await mongoService.GetHistoryDetailsForIdByDate("1", "2024-01-01", "2024-01-31");

      expect(result).toEqual({ mpId: 1 });
    });
  });

  describe("GetTotalHistoryCount", () => {
    it("returns countDocuments", async () => {
      mockCollection.countDocuments.mockResolvedValue(100);

      const result = await mongoService.GetTotalHistoryCount();

      expect(mockCollection.countDocuments).toHaveBeenCalledWith();
      expect(result).toBe(100);
    });
  });

  describe("Get422ProductDetailsByType", () => {
    it("finds error items by type", async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ mpId: "1", insertReason: "type1" }]),
      });

      const result = await mongoService.Get422ProductDetailsByType("type1");

      expect(mockCollection.find).toHaveBeenCalledWith({
        $and: [{ active: true }, { insertReason: "type1" }],
      });
      expect(result).toEqual([{ mpId: "1", insertReason: "type1" }]);
    });
  });

  describe("InsertOrUpdateProduct", () => {
    it("inserts when product not found", async () => {
      productsCollection.findOne.mockResolvedValue(null);
      productsCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() } as any);

      const payload = { mpId: "mp1", name: "P1" };
      const result = await mongoService.InsertOrUpdateProduct(payload, {});

      expect(productsCollection.insertOne).toHaveBeenCalledWith(payload);
      expect(result).toHaveProperty("insertedId");
    });

    it("updates tradentDetails when product exists", async () => {
      productsCollection.findOne.mockResolvedValueOnce({ mpId: "mp1" }).mockResolvedValueOnce({ mpId: "mp1", tradentDetails: {} });
      productsCollection.findOneAndUpdate.mockResolvedValue({ mpId: "mp1" });

      const payload = { mpId: "mp1", tradentDetails: { floorPrice: 10 } };
      const req = { session: { users_id: { userName: "u" } } };
      await mongoService.InsertOrUpdateProduct(payload, req);

      expect(mockGetAuditInfo).toHaveBeenCalledWith(req);
      expect(productsCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: "mp1" },
        expect.objectContaining({
          $set: expect.objectContaining({ tradentDetails: expect.any(Object) }),
        })
      );
    });

    it("updates frontierDetails and mvpDetails when product exists", async () => {
      productsCollection.findOne.mockResolvedValueOnce({ mpId: "mp1" }).mockResolvedValueOnce({ mpId: "mp1" }).mockResolvedValueOnce({ mpId: "mp1" });
      productsCollection.findOneAndUpdate.mockResolvedValue({ mpId: "mp1" });

      const payload = {
        mpId: "mp1",
        frontierDetails: { floorPrice: 20 },
        mvpDetails: { floorPrice: 30 },
      };
      const req = { session: { users_id: { userName: "u" } } };
      await mongoService.InsertOrUpdateProduct(payload, req);

      expect(productsCollection.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe("GetAllProductDetails", () => {
    it("finds all products sorted by _id -1", async () => {
      productsCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ mpId: "1" }, { mpId: "2" }]),
      });

      const result = await mongoService.GetAllProductDetails();

      expect(productsCollection.find).toHaveBeenCalledWith();
      expect(result).toEqual([{ mpId: "1" }, { mpId: "2" }]);
    });
  });

  describe("GetAllProductDetailsV2", () => {
    it("find with query, skip, sort, limit", async () => {
      productsCollection.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ mpId: "1" }]),
      });

      const result = await mongoService.GetAllProductDetailsV2({ active: true }, 1, 10);

      expect(productsCollection.find).toHaveBeenCalledWith({ active: true });
      expect(result).toEqual([{ mpId: "1" }]);
    });
  });

  describe("GetProductCount", () => {
    it("returns countDocuments", async () => {
      productsCollection.countDocuments.mockResolvedValue(42);

      const result = await mongoService.GetProductCount({});

      expect(productsCollection.countDocuments).toHaveBeenCalledWith({});
      expect(result).toBe(42);
    });
  });

  describe("FindProductById", () => {
    it("finds products by mpId", async () => {
      productsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ mpId: "mp1" }]),
      });

      const result = await mongoService.FindProductById("mp1");

      expect(productsCollection.find).toHaveBeenCalledWith({ mpId: "mp1" });
      expect(result).toEqual([{ mpId: "mp1" }]);
    });
  });

  describe("InsertOrUpdateProductWithCronName", () => {
    it("inserts when product not found", async () => {
      productsCollection.findOne.mockReset();
      productsCollection.findOne.mockResolvedValue(null);
      productsCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() } as any);

      const result = await mongoService.InsertOrUpdateProductWithCronName({ mpId: "mp1" }, {});

      expect(productsCollection.findOne).toHaveBeenCalledWith({ mpId: "mp1" });
      expect(productsCollection.insertOne).toHaveBeenCalledWith({ mpId: "mp1" });
      expect(result).toEqual(expect.objectContaining({ insertedId: expect.anything() }));
    });

    it("setSelectiveDetails when product has existing tradentDetails", async () => {
      productsCollection.findOne.mockResolvedValue({
        mpId: "mp1",
        tradentDetails: { floorPrice: 5 },
        frontierDetails: null,
        mvpDetails: null,
      });
      productsCollection.findOneAndUpdate.mockResolvedValue({});

      const payload = {
        mpId: "mp1",
        tradentDetails: { floorPrice: 10, maxPrice: 100 },
      };
      const req = { session: { users_id: { userName: "u" } } };
      await mongoService.InsertOrUpdateProductWithCronName(payload, req);

      const updateCall = productsCollection.findOneAndUpdate.mock.calls[0];
      const setArg = updateCall[1].$set;
      const hasDotted = setArg["tradentDetails.floorPrice"] === 10 && setArg["tradentDetails.maxPrice"] === 100;
      const hasNested = setArg.tradentDetails && setArg.tradentDetails.floorPrice === 10 && setArg.tradentDetails.maxPrice === 100;
      expect(hasDotted || hasNested).toBe(true);
      expect(updateCall[0]).toEqual({ mpId: "mp1" });
    });

    it("sets full tradentDetails when product has no existing tradentDetails", async () => {
      productsCollection.findOne.mockResolvedValue({
        mpId: "mp1",
        tradentDetails: null,
        frontierDetails: null,
        mvpDetails: null,
      });
      productsCollection.findOneAndUpdate.mockResolvedValue({});

      await mongoService.InsertOrUpdateProductWithCronName({ mpId: "mp1", tradentDetails: { floorPrice: 10 } }, { session: {} });

      expect(productsCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: "mp1" },
        expect.objectContaining({
          $set: expect.objectContaining({ tradentDetails: expect.objectContaining({ floorPrice: 10 }) }),
        })
      );
    });
  });

  describe("ActivateProductModel", () => {
    it("sets activated true for tradentDetails, frontierDetails, mvpDetails", async () => {
      productsCollection.findOne.mockResolvedValue({
        mpId: "mp1",
        tradentDetails: {},
        frontierDetails: {},
        mvpDetails: {},
      });
      productsCollection.findOneAndUpdate.mockResolvedValue({});

      const req = { session: { users_id: { userName: "u" } } };
      const result = await mongoService.ActivateProductModel("mp1", req);

      expect(productsCollection.findOne).toHaveBeenCalledWith({ mpId: "mp1" });
      expect(productsCollection.findOneAndUpdate).toHaveBeenCalledTimes(3);
      expect(productsCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: "mp1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            "tradentDetails.activated": true,
            "tradentDetails.AuditInfo": expect.anything(),
          }),
        })
      );
      expect(result).toBeDefined();
    });

    it("returns product when no details to update", async () => {
      productsCollection.findOne.mockResolvedValue({ mpId: "mp1" });

      const result = await mongoService.ActivateProductModel("mp1", {});

      expect(productsCollection.findOneAndUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({ mpId: "mp1" });
    });
  });

  describe("DeactivateProductModel", () => {
    it("sets activated false for all details", async () => {
      productsCollection.findOne.mockResolvedValue({
        mpId: "mp1",
        tradentDetails: {},
        frontierDetails: {},
        mvpDetails: {},
      });
      productsCollection.findOneAndUpdate.mockResolvedValue({});

      await mongoService.DeactivateProductModel("mp1", { session: {} });

      expect(productsCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: "mp1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            "tradentDetails.activated": false,
          }),
        })
      );
    });
  });

  describe("GetDefaultUserLogin", () => {
    it("findOne empty query on users", async () => {
      mockCollection.findOne.mockResolvedValue({ userName: "default" });

      const result = await mongoService.GetDefaultUserLogin();

      expect(mockCollection.findOne).toHaveBeenCalledWith({});
      expect(result).toEqual({ userName: "default" });
    });
  });

  describe("UpdateExecutionPriority", () => {
    it("updates tradentDetails when id is 0", async () => {
      productsCollection.findOneAndUpdate.mockResolvedValue({});

      await mongoService.UpdateExecutionPriority("mp1", 0, 5, { session: {} });

      expect(productsCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: "mp1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            "tradentDetails.executionPriority": 5,
          }),
        })
      );
    });

    it("updates frontierDetails when id is 1, mvpDetails when id is 2", async () => {
      productsCollection.findOneAndUpdate.mockResolvedValue({});

      await mongoService.UpdateExecutionPriority("mp1", 1, 10, { session: {} });
      expect(productsCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: "mp1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            "frontierDetails.executionPriority": 10,
          }),
        })
      );

      await mongoService.UpdateExecutionPriority("mp1", 2, 20, { session: {} });
      expect(productsCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: "mp1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            "mvpDetails.executionPriority": 20,
          }),
        })
      );
    });
  });

  describe("GetLogsBasedOnQuery", () => {
    it("finds cron logs by query", async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ cronId: "c1" }]),
      });

      const result = await mongoService.GetLogsBasedOnQuery({ cronId: "c1" });

      expect(mockCollection.find).toHaveBeenCalledWith({ cronId: "c1" });
      expect(result).toEqual([{ cronId: "c1" }]);
    });
  });

  describe("GetFilteredCrons", () => {
    it("returns cached filter cron details when present", async () => {
      const cached = [{ CronId: "f1" }];
      mockCacheGet.mockResolvedValue(cached);

      const result = await mongoService.GetFilteredCrons();

      expect(result).toEqual(cached);
      expect(mockCacheDisconnect).toHaveBeenCalled();
    });

    it("fetches from DB and sets cache when cache miss", async () => {
      mockCacheGet.mockResolvedValue(null);
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ CronId: "f1" }]),
      });

      const result = await mongoService.GetFilteredCrons();

      expect(mockDb.collection).toHaveBeenCalledWith("filterCronSettings");
      expect(mockCacheSet).toHaveBeenCalledWith("FILTER_CRON_DETAILS", [{ CronId: "f1" }]);
      expect(result).toEqual([{ CronId: "f1" }]);
    });
  });

  describe("GetSlowCronDetails", () => {
    it("returns cached slow cron when present", async () => {
      mockCacheGet.mockResolvedValue([{ CronId: "slow1" }]);

      const result = await mongoService.GetSlowCronDetails();

      expect(result).toEqual([{ CronId: "slow1" }]);
    });

    it("fetches from DB and sets cache when cache miss", async () => {
      mockCacheGet.mockResolvedValue(null);
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ CronId: "s1" }]),
      });

      const result = await mongoService.GetSlowCronDetails();

      expect(mockDb.collection).toHaveBeenCalledWith("slowCronSettings");
      expect(mockCacheSet).toHaveBeenCalledWith("SLOW_CRON_DETAILS", [{ CronId: "s1" }]);
      expect(result).toEqual([{ CronId: "s1" }]);
    });
  });

  describe("GetFilterCronLogsByLimit", () => {
    it("finds filter cron logs with limit and sort", async () => {
      mockCollection.find.mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ key: "k1" }]),
      });

      const result = await mongoService.GetFilterCronLogsByLimit(5);

      expect(mockCollection.find).toHaveBeenCalledWith();
      expect(result).toEqual([{ key: "k1" }]);
    });
  });

  describe("GetFilterCronLogByKey", () => {
    it("findOne by cronKey", async () => {
      mockCollection.findOne.mockResolvedValue({ cronKey: "key1", data: "x" });

      const result = await mongoService.GetFilterCronLogByKey("key1");

      expect(mockCollection.findOne).toHaveBeenCalledWith({ cronKey: "key1" });
      expect(result).toEqual({ cronKey: "key1", data: "x" });
    });
  });

  describe("GetProductListByQuery", () => {
    it("finds products by query", async () => {
      productsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ mpId: "1" }, { mpId: "2" }]),
      });

      const result = await mongoService.GetProductListByQuery({ active: true });

      expect(productsCollection.find).toHaveBeenCalledWith({ active: true });
      expect(result).toEqual([{ mpId: "1" }, { mpId: "2" }]);
    });
  });

  describe("InsertOrUpdateProductWithQuery", () => {
    it("findOneAndUpdate with mpId and query", async () => {
      productsCollection.findOneAndUpdate.mockResolvedValue({ mpId: "mp1", updated: true });

      const result = await mongoService.InsertOrUpdateProductWithQuery("mp1", { $set: { active: false } });

      expect(productsCollection.findOneAndUpdate).toHaveBeenCalledWith({ mpId: "mp1" }, { $set: { active: false } });
      expect(result).toEqual({ mpId: "mp1", updated: true });
    });
  });

  describe("InsertUserLogin", () => {
    it("insertOne user details", async () => {
      mockCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() } as any);

      const userDetails = { userName: "u", userPassword: "hash" };
      const result = await mongoService.InsertUserLogin(userDetails);

      expect(mockCollection.insertOne).toHaveBeenCalledWith(userDetails);
      expect(result).toHaveProperty("insertedId");
    });
  });

  describe("UpdateUserPassword", () => {
    it("findOneAndUpdate userPassword by userName", async () => {
      mockCollection.findOneAndUpdate.mockResolvedValue({ userName: "u" });

      const result = await mongoService.UpdateUserPassword("u", "newHash");

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith({ userName: "u" }, { $set: { userPassword: "newHash" } });
      expect(result).toEqual({ userName: "u" });
    });
  });

  describe("InsertOrUpdateScrapeOnlyProduct", () => {
    it("insertOne into scrape items", async () => {
      mockCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() } as any);

      const payload = { mpId: "mp1", net32Url: "https://u" };
      const result = await mongoService.InsertOrUpdateScrapeOnlyProduct(payload);

      expect(mockDb.collection).toHaveBeenCalledWith("scrapeItems");
      expect(mockCollection.insertOne).toHaveBeenCalledWith(payload);
    });
  });

  describe("GetScrapeCrons", () => {
    it("returns cached scrape cron when present", async () => {
      mockCacheGet.mockResolvedValue([{ CronId: "sc1" }]);

      const result = await mongoService.GetScrapeCrons();

      expect(result).toEqual([{ CronId: "sc1" }]);
    });

    it("fetches from DB and sets cache when cache miss", async () => {
      mockCacheGet.mockResolvedValue(null);
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ CronId: "sc1" }]),
      });

      const result = await mongoService.GetScrapeCrons();

      expect(mockDb.collection).toHaveBeenCalledWith("scrapeCronSettings");
      expect(mockCacheSet).toHaveBeenCalledWith("SCRAPE_CRON_DETAILS", [{ CronId: "sc1" }]);
      expect(result).toEqual([{ CronId: "sc1" }]);
    });
  });

  describe("GetScrapeProducts", () => {
    it("find with query, skip, sort, limit", async () => {
      mockCollection.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ mpId: "mp1" }]),
      });

      const result = await mongoService.GetScrapeProducts({ active: true }, 1, 10);

      expect(mockCollection.find).toHaveBeenCalledWith({ active: true });
      expect(result).toEqual([{ mpId: "mp1" }]);
    });
  });

  describe("GetScrapeProductCount", () => {
    it("countDocuments with query", async () => {
      mockCollection.countDocuments.mockResolvedValue(25);

      const result = await mongoService.GetScrapeProductCount({ active: true });

      expect(mockCollection.countDocuments).toHaveBeenCalledWith({ active: true });
      expect(result).toBe(25);
    });
  });

  describe("deleteScrapeProductById", () => {
    it("deleteOne by mpId", async () => {
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await mongoService.deleteScrapeProductById("mp1");

      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ mpId: "mp1" });
      expect(result).toEqual({ deletedCount: 1 });
    });
  });

  describe("GetAllScrapeProductDetails", () => {
    it("find sort _id -1 toArray", async () => {
      mockCollection.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ mpId: "1" }]),
      });

      const result = await mongoService.GetAllScrapeProductDetails();

      expect(result).toEqual([{ mpId: "1" }]);
    });
  });

  describe("InsertOrUpdateScrapeProduct", () => {
    it("updates when existResult found", async () => {
      mockCollection.findOne.mockResolvedValue({ mpId: "mp1" });
      mockCollection.findOneAndUpdate.mockResolvedValue({ mpId: "mp1" });

      const payload = {
        mpId: "mp1",
        isActive: true,
        net32Url: "https://u",
        linkedCron: "c",
        linkedCronId: "cid",
      };
      const req = { session: { users_id: { userName: "u" } } };
      const result = await mongoService.InsertOrUpdateScrapeProduct(payload, req);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: "mp1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            isActive: true,
            net32Url: "https://u",
            linkedCron: "c",
            linkedCronId: "cid",
          }),
        })
      );
      expect(result).toEqual({ mpId: "mp1" });
    });

    it("inserts with AuditInfo when not found", async () => {
      mockCollection.findOne.mockResolvedValue(null);
      mockCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() } as any);

      const payload = { mpId: "mp1" };
      await mongoService.InsertOrUpdateScrapeProduct(payload, { session: {} });

      expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({ mpId: "mp1", AuditInfo: expect.anything() }));
    });
  });

  describe("GetScrapeLogs", () => {
    it("find skip sort limit toArray", async () => {
      mockCollection.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([{ _id: "1" }]),
      });

      const result = await mongoService.GetScrapeLogs(0, 10);

      expect(result).toEqual([{ _id: "1" }]);
    });
  });

  describe("GetScrapeLogsCount", () => {
    it("countDocuments", async () => {
      mockCollection.countDocuments.mockResolvedValue(50);

      const result = await mongoService.GetScrapeLogsCount();

      expect(result).toBe(50);
    });
  });

  describe("FindScrapeProductById", () => {
    it("find by mpId toArray", async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ mpId: "mp1" }]),
      });

      const result = await mongoService.FindScrapeProductById("mp1");

      expect(mockCollection.find).toHaveBeenCalledWith({ mpId: "mp1" });
      expect(result).toEqual([{ mpId: "mp1" }]);
    });
  });

  describe("GetScrapeLogsList", () => {
    it("find by _id ObjectId", async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ _id: "id1", log: "x" }]),
      });

      const result = await mongoService.GetScrapeLogsList("507f1f77bcf86cd799439011");

      expect(mockCollection.find).toHaveBeenCalledWith({
        _id: expect.any(ObjectId),
      });
      expect(result).toEqual([{ _id: "id1", log: "x" }]);
    });
  });

  describe("IgnoreCronStatusLog", () => {
    it("findOneAndUpdate status to IGNORE by keyGenId and cronId", async () => {
      mockCollection.findOneAndUpdate.mockResolvedValue({ status: "IGNORE" });

      const result = await mongoService.IgnoreCronStatusLog("cron1", "key1");

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith({ $and: [{ keyGenId: "key1" }, { cronId: "cron1" }] }, { $set: { status: "IGNORE" } });
      expect(result).toEqual({ status: "IGNORE" });
    });
  });

  describe("Update422StatusById", () => {
    it("updateMany by mpId when isBulk false", async () => {
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 2 });

      const result = await mongoService.Update422StatusById("mp1", false);

      expect(mockCollection.updateMany).toHaveBeenCalledWith({ mpId: "mp1" }, { $set: { active: false } });
      expect(result).toEqual({ modifiedCount: 2 });
    });

    it("updateMany empty filter when isBulk true", async () => {
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 10 });

      const result = await mongoService.Update422StatusById(undefined, true);

      expect(mockCollection.updateMany).toHaveBeenCalledWith({}, { $set: { active: false } });
      expect(result).toEqual({ modifiedCount: 10 });
    });
  });

  describe("DeleteCronLogsPast15Days", () => {
    it("deleteMany on both cron logs and error logs for past 15 days", async () => {
      mockCollection.deleteMany.mockResolvedValueOnce({ deletedCount: 5 }).mockResolvedValueOnce({ deletedCount: 2 });

      const result = await mongoService.DeleteCronLogsPast15Days();

      expect(result).toEqual([{ deletedCount: 5 }, { deletedCount: 2 }]);
      expect(mockDb.collection).toHaveBeenCalledWith("cronLogs");
      expect(mockDb.collection).toHaveBeenCalledWith("422cronLogs");
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/CRON_LOGS_DELETION_CRON/));
    });
  });
});
