// Mock all dependencies BEFORE imports
jest.mock("./index", () => ({
  getMongoDb: jest.fn(),
}));

jest.mock("../config", () => ({
  applicationConfig: {
    CRON_STATUS_COLLECTION_NAME: "cronStatusLogs",
    CRON_LOGS_COLLECTION_NAME: "cronLogs",
    ERROR_ITEM_COLLECTION: "errorItems",
    MANAGED_MONGO_PRODUCT_COLLECTION: "products",
    GET_PRICE_LIST_COLLECTION_NAME: "items",
    FILTER_CRON_LOGS: "filterCronLogs",
    ERROR_422_CRON_LOGS: "422cronLogs",
    SCRAPE_ITEMS_COLLECTION_NAME: "scrapeItems",
    SCRAPE_PRODUCTS_COLLECTION_NAME: "scrapeProducts",
    SCRAPE_PRODUCTS_LOGS_COLLECTION_NAME: "scrapeCronLogs",
  },
}));

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

import { getMongoDb } from "./index";
import { applicationConfig } from "../config";
import { InitCronStatusAsync, UpdateCronStatusAsync, PushLogsAsync, UpdateProductAsync, ResetPendingCronLogs, UpsertErrorItemLog, FindErrorItemByIdAndStatus, FindProductById, GetListOfOverrideProducts, ExecuteProductQuery, ExecuteProductUpdate, GetErrorItemsByMpId, GetEligibleContextErrorItems, GetProductListByQuery, SaveFilterCronLogs, UpdateCronForProductAsync, Push422LogsAsync, GetScrapeProductList, InsertScrapeProduct, PushLogs, UpdateScrapeProducts, GetContextErrorItems } from "./db-helper";

describe("db-helper", () => {
  let mockDb: any;
  let mockCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console.log
    console.log = jest.fn();

    // Create mock collection with all MongoDB methods
    mockCollection = {
      insertOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      updateMany: jest.fn(),
      countDocuments: jest.fn(),
    };

    // Create mock database
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    // Mock getMongoDb to return mock database
    (getMongoDb as jest.Mock).mockResolvedValue(mockDb);
  });

  afterEach(async () => {
    console.log = originalConsoleLog;
    jest.clearAllMocks();
    // Wait for any pending promises to resolve
    await new Promise((resolve) => setImmediate(resolve));
  });

  afterAll(async () => {
    // Ensure all pending promises are resolved
    await new Promise((resolve) => setImmediate(resolve));
    // Clear all timers if any
    jest.clearAllTimers();
    // Restore console.log
    console.log = originalConsoleLog;
    // Clear all mocks one final time
    jest.clearAllMocks();
  });

  describe("InitCronStatusAsync", () => {
    it("should insert cron status and return insertedId", async () => {
      const payload = { cronTime: "2024-01-01", status: "running" };
      const mockInsertedId = { toString: () => "507f1f77bcf86cd799439011" };
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

      const result = await InitCronStatusAsync(payload);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.CRON_STATUS_COLLECTION_NAME);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(payload);
      expect(result).toBe(mockInsertedId);
    });

    it("should handle errors gracefully", async () => {
      const payload = { cronTime: "2024-01-01", status: "running" };
      mockCollection.insertOne.mockRejectedValue(createDbError());

      await expect(InitCronStatusAsync(payload)).rejects.toThrow("DB Error");
    });
  });

  describe("UpdateCronStatusAsync", () => {
    it("should update cron status successfully", async () => {
      const payload = {
        cronTime: "2024-01-01",
        keyGenId: "key-123",
        productsCount: 100,
        maximumProductCount: 200,
        status: "completed",
        cronId: "cron-123",
      };
      const mockResult = { value: payload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateCronStatusAsync(payload);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.CRON_STATUS_COLLECTION_NAME);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        {
          $and: [{ cronTime: payload.cronTime }, { keyGenId: payload.keyGenId }],
        },
        {
          $set: {
            cronTime: payload.cronTime,
            productsCount: payload.productsCount,
            maximumProductCount: payload.maximumProductCount,
            status: payload.status,
            cronId: payload.cronId,
          },
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should handle errors gracefully", async () => {
      const payload = {
        cronTime: "2024-01-01",
        keyGenId: "key-123",
        productsCount: 100,
        maximumProductCount: 200,
        status: "completed",
        cronId: "cron-123",
      };
      mockCollection.findOneAndUpdate.mockRejectedValue(createDbError());

      await expect(UpdateCronStatusAsync(payload)).rejects.toThrow("DB Error");
    });
  });

  describe("PushLogsAsync", () => {
    it("should insert log and return insertedId as string", async () => {
      const payload = { message: "Test log", timestamp: new Date() };
      const mockInsertedId = { toString: () => "507f1f77bcf86cd799439011" };
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

      const result = await PushLogsAsync(payload);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.CRON_LOGS_COLLECTION_NAME);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(payload);
      expect(result).toBe("507f1f77bcf86cd799439011");
    });

    it("should handle errors gracefully", async () => {
      const payload = { message: "Test log", timestamp: new Date() };
      mockCollection.insertOne.mockRejectedValue(createDbError());

      await expect(PushLogsAsync(payload)).rejects.toThrow("DB Error");
    });
  });

  describe("UpdateProductAsync", () => {
    const basePayload = {
      mpid: 123,
      last_cron_time: "2024-01-01",
      secretKey: "secret-123",
      last_attempted_time: "2024-01-01",
      lastCronRun: "run-123",
      lastUpdatedBy: "system",
      last_cron_message: "Success",
      lowest_vendor: "VENDOR1",
      lowest_vendor_price: "99.99",
      lastExistingPrice: "100.00",
      lastSuggestedPrice: "99.99",
      next_cron_time: "2024-01-02",
      last_update_time: "2024-01-01",
    };

    it("should update TRADENT product with price updated", async () => {
      const mockResult = { value: basePayload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateProductAsync(basePayload, true, "TRADENT");

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: basePayload.mpid },
        {
          $set: {
            "tradentDetails.last_cron_time": basePayload.last_cron_time,
            "tradentDetails.secretKey": basePayload.secretKey,
            "tradentDetails.last_attempted_time": basePayload.last_attempted_time,
            "tradentDetails.lastCronRun": basePayload.lastCronRun,
            "tradentDetails.last_update_time": basePayload.last_update_time,
            "tradentDetails.lastUpdatedBy": basePayload.lastUpdatedBy,
            "tradentDetails.next_cron_time": basePayload.next_cron_time,
            "tradentDetails.last_cron_message": basePayload.last_cron_message,
            "tradentDetails.lowest_vendor": basePayload.lowest_vendor,
            "tradentDetails.lowest_vendor_price": basePayload.lowest_vendor_price,
            "tradentDetails.lastExistingPrice": basePayload.lastExistingPrice,
            "tradentDetails.lastSuggestedPrice": basePayload.lastSuggestedPrice,
          },
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should update TRADENT product without price updated", async () => {
      const mockResult = { value: basePayload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateProductAsync(basePayload, false, "TRADENT");

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: basePayload.mpid },
        {
          $set: {
            "tradentDetails.last_cron_time": basePayload.last_cron_time,
            "tradentDetails.secretKey": basePayload.secretKey,
            "tradentDetails.last_attempted_time": basePayload.last_attempted_time,
            "tradentDetails.lastCronRun": basePayload.lastCronRun,
            "tradentDetails.lastUpdatedBy": basePayload.lastUpdatedBy,
            "tradentDetails.last_cron_message": basePayload.last_cron_message,
            "tradentDetails.lowest_vendor": basePayload.lowest_vendor,
            "tradentDetails.lowest_vendor_price": basePayload.lowest_vendor_price,
            "tradentDetails.lastExistingPrice": basePayload.lastExistingPrice,
            "tradentDetails.lastSuggestedPrice": basePayload.lastSuggestedPrice,
            "tradentDetails.next_cron_time": basePayload.next_cron_time,
          },
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should update FRONTIER product with price updated", async () => {
      const mockResult = { value: basePayload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateProductAsync(basePayload, true, "FRONTIER");

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: basePayload.mpid },
        {
          $set: {
            "frontierDetails.last_cron_time": basePayload.last_cron_time,
            "frontierDetails.secretKey": basePayload.secretKey,
            "frontierDetails.last_attempted_time": basePayload.last_attempted_time,
            "frontierDetails.lastCronRun": basePayload.lastCronRun,
            "frontierDetails.last_update_time": basePayload.last_update_time,
            "frontierDetails.lastUpdatedBy": basePayload.lastUpdatedBy,
            "frontierDetails.next_cron_time": basePayload.next_cron_time,
            "frontierDetails.last_cron_message": basePayload.last_cron_message,
            "frontierDetails.lowest_vendor": basePayload.lowest_vendor,
            "frontierDetails.lowest_vendor_price": basePayload.lowest_vendor_price,
            "frontierDetails.lastExistingPrice": basePayload.lastExistingPrice,
            "frontierDetails.lastSuggestedPrice": basePayload.lastSuggestedPrice,
          },
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should update FRONTIER product without price updated", async () => {
      const mockResult = { value: basePayload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateProductAsync(basePayload, false, "FRONTIER");

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: basePayload.mpid },
        {
          $set: expect.objectContaining({
            "frontierDetails.next_cron_time": basePayload.next_cron_time,
          }),
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should update MVP product with price updated", async () => {
      const mockResult = { value: basePayload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateProductAsync(basePayload, true, "MVP");

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: basePayload.mpid },
        {
          $set: expect.objectContaining({
            "mvpDetails.last_cron_time": basePayload.last_cron_time,
          }),
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should update MVP product without price updated", async () => {
      const mockResult = { value: basePayload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateProductAsync(basePayload, false, "MVP");

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: basePayload.mpid },
        {
          $set: expect.objectContaining({
            "mvpDetails.next_cron_time": basePayload.next_cron_time,
          }),
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should handle unknown vendor", async () => {
      const mockResult = { value: basePayload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateProductAsync(basePayload, true, "UNKNOWN");

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: basePayload.mpid },
        {
          $set: {},
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should handle errors gracefully", async () => {
      mockCollection.findOneAndUpdate.mockRejectedValue(createDbError());

      await expect(UpdateProductAsync(basePayload, true, "TRADENT")).rejects.toThrow("DB Error");
    });
  });

  describe("ResetPendingCronLogs", () => {
    it("should reset all pending cron logs", async () => {
      const mockResult = { modifiedCount: 5 };
      mockCollection.updateMany.mockResolvedValue(mockResult);

      const result = await ResetPendingCronLogs();

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.CRON_STATUS_COLLECTION_NAME);
      expect(mockCollection.updateMany).toHaveBeenCalledWith({}, { $set: { status: "Complete" } });
      expect(result).toBe(mockResult);
    });

    it("should handle errors gracefully", async () => {
      mockCollection.updateMany.mockRejectedValue(createDbError());

      await expect(ResetPendingCronLogs()).rejects.toThrow("DB Error");
    });
  });

  describe("UpsertErrorItemLog", () => {
    it("should update existing error item", async () => {
      const payload = {
        mpId: 123,
        vendorName: "TRADENT",
        nextCronTime: new Date(),
        active: true,
        insertReason: "Test reason",
      };
      const existingItem = { mpId: 123, vendorName: "TRADENT" };
      const mockUpdateResult = { value: payload };
      mockCollection.findOne.mockResolvedValue(existingItem);
      mockCollection.findOneAndUpdate.mockResolvedValue(mockUpdateResult);

      const result = await UpsertErrorItemLog(payload);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.ERROR_ITEM_COLLECTION);
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        $and: [{ mpId: payload.mpId }, { vendorName: payload.vendorName }],
      });
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        {
          $and: [{ mpId: payload.mpId }, { vendorName: payload.vendorName }],
        },
        {
          $set: {
            nextCronTime: payload.nextCronTime,
            active: payload.active,
            updatedOn: expect.any(Date),
            insertReason: payload.insertReason,
          },
        }
      );
      expect(result).toBe(mockUpdateResult);
    });

    it("should insert new error item when not found", async () => {
      const payload = {
        mpId: 123,
        vendorName: "TRADENT",
        nextCronTime: new Date(),
        active: true,
        insertReason: "Test reason",
      };
      const mockInsertResult = { insertedId: "507f1f77bcf86cd799439011" };
      mockCollection.findOne.mockResolvedValue(null);
      mockCollection.insertOne.mockResolvedValue(mockInsertResult);

      const result = await UpsertErrorItemLog(payload);

      expect(mockCollection.findOne).toHaveBeenCalled();
      expect(mockCollection.insertOne).toHaveBeenCalledWith(payload);
      expect(result).toBe(mockInsertResult);
    });

    it("should handle errors gracefully", async () => {
      const payload = {
        mpId: 123,
        vendorName: "TRADENT",
        nextCronTime: new Date(),
        active: true,
        insertReason: "Test reason",
      };
      mockCollection.findOne.mockRejectedValue(createDbError());

      await expect(UpsertErrorItemLog(payload)).rejects.toThrow("DB Error");
    });
  });

  describe("FindErrorItemByIdAndStatus", () => {
    it("should find error item by id and status", async () => {
      const mpId = "123";
      const status = true;
      const vendor = "TRADENT";
      const mockCount = 1;
      mockCollection.countDocuments.mockResolvedValue(mockCount);

      const result = await FindErrorItemByIdAndStatus(mpId, status, vendor);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.ERROR_ITEM_COLLECTION);
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        $and: [{ active: status }, { mpId: 123 }, { vendorName: vendor }],
      });
      expect(result).toBe(mockCount);
    });

    it("should handle errors gracefully", async () => {
      const mpId = "123";
      const status = true;
      const vendor = "TRADENT";
      mockCollection.countDocuments.mockRejectedValue(createDbError());

      await expect(FindErrorItemByIdAndStatus(mpId, status, vendor)).rejects.toThrow("DB Error");
    });
  });

  describe("FindProductById", () => {
    it("should find product by id", async () => {
      const mpid = 123;
      const mockProduct = { mpId: 123, name: "Test Product" };
      mockCollection.findOne.mockResolvedValue(mockProduct);

      const result = await FindProductById(mpid);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ mpId: mpid });
      expect(result).toBe(mockProduct);
    });

    it("should handle errors gracefully", async () => {
      const mpid = 123;
      mockCollection.findOne.mockRejectedValue(createDbError());

      await expect(FindProductById(mpid)).rejects.toThrow("DB Error");
    });
  });

  describe("GetListOfOverrideProducts", () => {
    it("should get list of override products", async () => {
      const mockProducts = [
        { mpId: 123, activated: true, override_bulk_update: true, scrapeOn: true },
        { mpId: 456, activated: true, override_bulk_update: true, scrapeOn: true },
      ];
      const mockFind = {
        toArray: jest.fn().mockResolvedValue(mockProducts),
      };
      mockCollection.find.mockReturnValue(mockFind);

      const result = await GetListOfOverrideProducts();

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.GET_PRICE_LIST_COLLECTION_NAME);
      expect(mockCollection.find).toHaveBeenCalledWith({
        $and: [{ activated: true }, { override_bulk_update: true }, { scrapeOn: true }],
      });
      expect(mockFind.toArray).toHaveBeenCalled();
      expect(result).toBe(mockProducts);
    });

    it("should handle errors gracefully", async () => {
      mockCollection.find.mockImplementation(() => {
        throw createDbError();
      });

      await expect(GetListOfOverrideProducts()).rejects.toThrow("DB Error");
    });
  });

  describe("ExecuteProductQuery", () => {
    it("should execute product query", async () => {
      const query = { mpId: 123 };
      const mockProducts = [{ mpId: 123, name: "Test Product" }];
      const mockFind = {
        toArray: jest.fn().mockResolvedValue(mockProducts),
      };
      mockCollection.find.mockReturnValue(mockFind);

      const result = await ExecuteProductQuery(query);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION);
      expect(mockCollection.find).toHaveBeenCalledWith(query);
      expect(mockFind.toArray).toHaveBeenCalled();
      expect(result).toBe(mockProducts);
    });

    it("should handle errors gracefully", async () => {
      const query = { mpId: 123 };
      mockCollection.find.mockImplementation(() => {
        throw createDbError();
      });

      await expect(ExecuteProductQuery(query)).rejects.toThrow("DB Error");
    });
  });

  describe("ExecuteProductUpdate", () => {
    it("should execute product update", async () => {
      const mpid = 123;
      const setVal = { name: "Updated Product" };
      const mockResult = { value: { mpId: mpid, ...setVal } };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await ExecuteProductUpdate(mpid, setVal);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: mpid },
        {
          $set: setVal,
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should handle errors gracefully", async () => {
      const mpid = 123;
      const setVal = { name: "Updated Product" };
      mockCollection.findOneAndUpdate.mockRejectedValue(createDbError());

      await expect(ExecuteProductUpdate(mpid, setVal)).rejects.toThrow("DB Error");
    });
  });

  describe("GetErrorItemsByMpId", () => {
    it("should get error items by mpId", async () => {
      const mpId = 123;
      const mockErrorItems = [
        { mpId: 123, vendorName: "TRADENT", active: true },
        { mpId: 123, vendorName: "FRONTIER", active: true },
      ];
      const mockFind = {
        toArray: jest.fn().mockResolvedValue(mockErrorItems),
      };
      mockCollection.find.mockReturnValue(mockFind);

      const result = await GetErrorItemsByMpId(mpId);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.ERROR_ITEM_COLLECTION);
      expect(mockCollection.find).toHaveBeenCalledWith({ mpId: mpId, active: true });
      expect(mockFind.toArray).toHaveBeenCalled();
      expect(result).toBe(mockErrorItems);
    });

    it("should handle errors gracefully", async () => {
      const mpId = 123;
      mockCollection.find.mockImplementation(() => {
        throw createDbError();
      });

      await expect(GetErrorItemsByMpId(mpId)).rejects.toThrow("DB Error");
    });
  });

  describe("GetEligibleContextErrorItems", () => {
    it("should get eligible context error items", async () => {
      const activeStatus = true;
      const mpId = "123";
      const contextVendor = "TRADENT";
      const mockErrorItems = [
        { mpId: 123, vendorName: "FRONTIER", active: true },
        { mpId: 123, vendorName: "MVP", active: true },
      ];
      const mockFind = {
        toArray: jest.fn().mockResolvedValue(mockErrorItems),
      };
      mockCollection.find.mockReturnValue(mockFind);

      const result = await GetEligibleContextErrorItems(activeStatus, mpId, contextVendor);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.ERROR_ITEM_COLLECTION);
      expect(mockCollection.find).toHaveBeenCalledWith({
        $and: [{ active: activeStatus }, { mpId: 123 }, { vendorName: { $ne: contextVendor } }],
      });
      expect(console.log).toHaveBeenCalledWith(`DB_HELPER: Fetching GetEligibleContextErrorItems for mpId: ${mpId} excluding vendor: ${contextVendor}`);
      expect(console.log).toHaveBeenCalledWith(`DB_HELPER: Retrieved ${mockErrorItems.length} eligible context error items for mpId: ${mpId} : ${JSON.stringify(mockErrorItems)}`);
      expect(result).toBe(mockErrorItems);
    });

    it("should handle errors gracefully", async () => {
      const activeStatus = true;
      const mpId = "123";
      const contextVendor = "TRADENT";
      mockCollection.find.mockImplementation(() => {
        throw createDbError();
      });

      await expect(GetEligibleContextErrorItems(activeStatus, mpId, contextVendor)).rejects.toThrow("DB Error");
    });
  });

  describe("GetProductListByQuery", () => {
    it("should get product list by query", async () => {
      const query = { mpId: { $in: [123, 456] } };
      const mockProducts = [
        { mpId: 123, name: "Product 1" },
        { mpId: 456, name: "Product 2" },
      ];
      const mockFind = {
        toArray: jest.fn().mockResolvedValue(mockProducts),
      };
      mockCollection.find.mockReturnValue(mockFind);

      const result = await GetProductListByQuery(query);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION);
      expect(mockCollection.find).toHaveBeenCalledWith(query);
      expect(mockFind.toArray).toHaveBeenCalled();
      expect(result).toBe(mockProducts);
    });

    it("should handle errors gracefully", async () => {
      const query = { mpId: { $in: [123, 456] } };
      mockCollection.find.mockImplementation(() => {
        throw createDbError();
      });

      await expect(GetProductListByQuery(query)).rejects.toThrow("DB Error");
    });
  });

  describe("SaveFilterCronLogs", () => {
    it("should save filter cron logs", async () => {
      const payload = { cronId: "cron-123", filterDate: new Date() };
      const mockResult = { insertedId: "507f1f77bcf86cd799439011" };
      mockCollection.insertOne.mockResolvedValue(mockResult);

      const result = await SaveFilterCronLogs(payload);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.FILTER_CRON_LOGS);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(payload);
      expect(result).toBe(mockResult);
    });

    it("should handle errors gracefully", async () => {
      const payload = { cronId: "cron-123", filterDate: new Date() };
      mockCollection.insertOne.mockRejectedValue(createDbError());

      await expect(SaveFilterCronLogs(payload)).rejects.toThrow("DB Error");
    });
  });

  describe("UpdateCronForProductAsync", () => {
    it("should update cron for product with tradent details", async () => {
      const payload = {
        mpId: 123,
        tradentDetails: {
          slowCronId: "slow-cron-123",
          slowCronName: "Slow Cron",
        },
        isSlowActivated: true,
      };
      const mockResult = { value: payload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateCronForProductAsync(payload);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: payload.mpId },
        {
          $set: {
            "tradentDetails.slowCronId": payload.tradentDetails.slowCronId,
            "tradentDetails.slowCronName": payload.tradentDetails.slowCronName,
            isSlowActivated: true,
          },
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should update cron for product with frontier details", async () => {
      const payload = {
        mpId: 123,
        frontierDetails: {
          slowCronId: "slow-cron-456",
          slowCronName: "Frontier Slow Cron",
        },
        isSlowActivated: false,
      };
      const mockResult = { value: payload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateCronForProductAsync(payload);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: payload.mpId },
        {
          $set: {
            "frontierDetails.slowCronId": payload.frontierDetails.slowCronId,
            "frontierDetails.slowCronName": payload.frontierDetails.slowCronName,
            isSlowActivated: false,
          },
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should update cron for product with mvp details", async () => {
      const payload = {
        mpId: 123,
        mvpDetails: {
          slowCronId: "slow-cron-789",
          slowCronName: "MVP Slow Cron",
        },
      };
      const mockResult = { value: payload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateCronForProductAsync(payload);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: payload.mpId },
        {
          $set: {
            "mvpDetails.slowCronId": payload.mvpDetails.slowCronId,
            "mvpDetails.slowCronName": payload.mvpDetails.slowCronName,
          },
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should update cron for product with all vendor details", async () => {
      const payload = {
        mpId: 123,
        tradentDetails: {
          slowCronId: "slow-cron-123",
          slowCronName: "Tradent Slow Cron",
        },
        frontierDetails: {
          slowCronId: "slow-cron-456",
          slowCronName: "Frontier Slow Cron",
        },
        mvpDetails: {
          slowCronId: "slow-cron-789",
          slowCronName: "MVP Slow Cron",
        },
        isSlowActivated: true,
      };
      const mockResult = { value: payload };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateCronForProductAsync(payload);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: payload.mpId },
        {
          $set: expect.objectContaining({
            "tradentDetails.slowCronId": payload.tradentDetails.slowCronId,
            "frontierDetails.slowCronId": payload.frontierDetails.slowCronId,
            "mvpDetails.slowCronId": payload.mvpDetails.slowCronId,
            isSlowActivated: true,
          }),
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should handle errors gracefully", async () => {
      const payload = {
        mpId: 123,
        tradentDetails: {
          slowCronId: "slow-cron-123",
          slowCronName: "Slow Cron",
        },
      };
      mockCollection.findOneAndUpdate.mockRejectedValue(createDbError());

      await expect(UpdateCronForProductAsync(payload)).rejects.toThrow("DB Error");
    });
  });

  describe("Push422LogsAsync", () => {
    it("should push 422 logs and return insertedId as string", async () => {
      const payload = { error: "422 Error", timestamp: new Date() };
      const mockInsertedId = { toString: () => "507f1f77bcf86cd799439011" };
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

      const result = await Push422LogsAsync(payload);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.ERROR_422_CRON_LOGS);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(payload);
      expect(result).toBe("507f1f77bcf86cd799439011");
    });

    it("should return null when insertedId is missing", async () => {
      const payload = { error: "422 Error", timestamp: new Date() };
      mockCollection.insertOne.mockResolvedValue({});

      const result = await Push422LogsAsync(payload);

      expect(result).toBeNull();
    });

    it("should return null when mongoResult is null", async () => {
      const payload = { error: "422 Error", timestamp: new Date() };
      mockCollection.insertOne.mockResolvedValue(null);

      const result = await Push422LogsAsync(payload);

      expect(result).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      const payload = { error: "422 Error", timestamp: new Date() };
      mockCollection.insertOne.mockRejectedValue(createDbError());

      await expect(Push422LogsAsync(payload)).rejects.toThrow("DB Error");
    });
  });

  describe("GetScrapeProductList", () => {
    it("should get scrape product list", async () => {
      const cronId = "cron-123";
      const isActive = true;
      const mockProducts = [
        { mpId: 123, linkedCronId: cronId, isActive: true },
        { mpId: 456, linkedCronId: cronId, isActive: true },
      ];
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(mockProducts),
      };
      mockCollection.find.mockReturnValue(mockFind);

      const result = await GetScrapeProductList(cronId, isActive);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.SCRAPE_ITEMS_COLLECTION_NAME);
      expect(mockCollection.find).toHaveBeenCalledWith({
        $and: [{ isActive: isActive }, { linkedCronId: cronId }],
      });
      expect(mockFind.sort).toHaveBeenCalledWith({ _id: 1 });
      expect(mockFind.toArray).toHaveBeenCalled();
      expect(result).toBe(mockProducts);
    });

    it("should handle errors gracefully", async () => {
      const cronId = "cron-123";
      const isActive = true;
      mockCollection.find.mockImplementation(() => {
        throw createDbError();
      });

      await expect(GetScrapeProductList(cronId, isActive)).rejects.toThrow("DB Error");
    });
  });

  describe("InsertScrapeProduct", () => {
    it("should insert scrape product", async () => {
      const payload = { mpId: 123, name: "Scrape Product" };
      const mockResult = { insertedId: "507f1f77bcf86cd799439011" };
      mockCollection.insertOne.mockResolvedValue(mockResult);

      const result = await InsertScrapeProduct(payload);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.SCRAPE_PRODUCTS_COLLECTION_NAME);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(payload);
      expect(result).toBe(mockResult);
    });

    it("should handle errors gracefully", async () => {
      const payload = { mpId: 123, name: "Scrape Product" };
      mockCollection.insertOne.mockRejectedValue(createDbError());

      await expect(InsertScrapeProduct(payload)).rejects.toThrow("DB Error");
    });
  });

  describe("PushLogs", () => {
    it("should push logs", async () => {
      const payload = { message: "Test log", timestamp: new Date() };
      const mockResult = { insertedId: "507f1f77bcf86cd799439011" };
      mockCollection.insertOne.mockResolvedValue(mockResult);

      const result = await PushLogs(payload);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.SCRAPE_PRODUCTS_LOGS_COLLECTION_NAME);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(payload);
      expect(result).toBe(mockResult);
    });

    it("should handle errors gracefully", async () => {
      const payload = { message: "Test log", timestamp: new Date() };
      mockCollection.insertOne.mockRejectedValue(createDbError());

      await expect(PushLogs(payload)).rejects.toThrow("DB Error");
    });
  });

  describe("UpdateScrapeProducts", () => {
    it("should update scrape products", async () => {
      const mpId = 123;
      const mockResult = { value: { mpId: mpId, last_scrape_time: new Date() } };
      mockCollection.findOneAndUpdate.mockResolvedValue(mockResult);

      const result = await UpdateScrapeProducts(mpId);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.SCRAPE_ITEMS_COLLECTION_NAME);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { mpId: mpId },
        {
          $set: {
            last_scrape_time: expect.any(Date),
          },
        }
      );
      expect(result).toBe(mockResult);
    });

    it("should handle errors gracefully", async () => {
      const mpId = 123;
      mockCollection.findOneAndUpdate.mockRejectedValue(createDbError());

      await expect(UpdateScrapeProducts(mpId)).rejects.toThrow("DB Error");
    });
  });

  describe("GetContextErrorItems", () => {
    it("should get context error items", async () => {
      const activeStatus = true;
      const mockErrorItems = [
        { mpId: 123, vendorName: "TRADENT", active: true, nextCronTime: new Date() },
        { mpId: 456, vendorName: "FRONTIER", active: true, nextCronTime: new Date() },
      ];
      const mockFind = {
        toArray: jest.fn().mockResolvedValue(mockErrorItems),
      };
      mockCollection.find.mockReturnValue(mockFind);

      const result = await GetContextErrorItems(activeStatus);

      expect(getMongoDb).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith(applicationConfig.ERROR_ITEM_COLLECTION);
      expect(mockCollection.find).toHaveBeenCalledWith({
        nextCronTime: {
          $lte: expect.any(Date),
        },
        active: activeStatus,
      });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("DB_HELPER: Fetching GetContextErrorItems with active status:"));
      expect(mockFind.toArray).toHaveBeenCalled();
      expect(result).toBe(mockErrorItems);
    });

    it("should handle errors gracefully", async () => {
      const activeStatus = true;
      mockCollection.find.mockImplementation(() => {
        throw createDbError();
      });

      await expect(GetContextErrorItems(activeStatus)).rejects.toThrow("DB Error");
    });
  });
});
