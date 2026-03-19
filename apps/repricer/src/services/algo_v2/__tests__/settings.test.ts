import { getV2AlgoSettingsByMpId, updateV2AlgoSettings, syncVendorSettingsForMpId, getAllProductsWithAlgoData, toggleV2AlgoEnabled, getNet32Url, syncAllVendorSettings, type V2AlgoSettings, type V2AlgoSettingsDb } from "../settings";
import { AlgoBadgeIndicator, AlgoHandlingTimeGroup, AlgoPriceDirection, AlgoPriceStrategy } from "@repricer-monorepo/shared";

const returnQueue: unknown[] = [];
const returnQueuesByTable: Record<string, unknown[]> = {};

function createChain(tableName?: string) {
  const queue = tableName ? (returnQueuesByTable[tableName] ??= []) : returnQueue;
  let resolvedValue: unknown = undefined;
  let terminalCalled = false;
  const chain = {
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    first: jest.fn().mockImplementation(function (this: typeof chain) {
      terminalCalled = true;
      resolvedValue = queue.shift();
      return this;
    }),
    update: jest.fn().mockImplementation(function (this: typeof chain) {
      terminalCalled = true;
      resolvedValue = queue.shift();
      return this;
    }),
    insert: jest.fn().mockImplementation(function (this: typeof chain) {
      terminalCalled = true;
      resolvedValue = queue.shift();
      return this;
    }),
    del: jest.fn().mockImplementation(function (this: typeof chain) {
      terminalCalled = true;
      resolvedValue = queue.shift();
      return this;
    }),
    then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
      const val = terminalCalled ? resolvedValue : queue.shift();
      return Promise.resolve(val).then(resolve, reject);
    },
  };
  return chain;
}

let mockKnex: jest.Mock;
let mockSchema: { hasTable: jest.Mock; hasColumn: jest.Mock };
let mockTransaction: jest.Mock;

jest.mock("../../knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
  destroyKnexInstance: jest.fn(),
}));

const { getKnexInstance } = jest.requireMock("../../knex-wrapper") as {
  getKnexInstance: jest.Mock;
};

beforeEach(() => {
  returnQueue.length = 0;
  Object.keys(returnQueuesByTable).forEach((k) => delete returnQueuesByTable[k]);
  mockSchema = {
    hasTable: jest.fn().mockResolvedValue(true),
    hasColumn: jest.fn().mockResolvedValue(true),
  };
  mockKnex = jest.fn((table: string) => {
    const chain = createChain(table);
    (chain as any).schema = mockSchema;
    return chain;
  });
  mockTransaction = jest.fn().mockImplementation((fn: (trx: unknown) => Promise<unknown>) => {
    return fn(mockKnex);
  });
  (mockKnex as any).schema = mockSchema;
  (mockKnex as any).transaction = mockTransaction;
  (mockKnex as any).raw = jest.fn().mockResolvedValue([]);
  getKnexInstance.mockReturnValue(mockKnex);
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("settings", () => {
  describe("getV2AlgoSettingsByMpId", () => {
    it("returns settings for mp_id ordered by vendor_id", async () => {
      const rows: V2AlgoSettingsDb[] = [{ id: 1, mp_id: 100, vendor_id: 5, enabled: 1 } as V2AlgoSettingsDb, { id: 2, mp_id: 100, vendor_id: 10, enabled: 0 } as V2AlgoSettingsDb];
      returnQueuesByTable["v2_algo_settings"] = [rows];

      const result = await getV2AlgoSettingsByMpId(100);

      expect(result).toEqual(rows);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_settings");
      const chain = mockKnex.mock.results[0].value;
      expect(chain.where).toHaveBeenCalledWith("mp_id", 100);
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.orderBy).toHaveBeenCalledWith("vendor_id");
    });

    it("returns empty array when no settings exist", async () => {
      returnQueuesByTable["v2_algo_settings"] = [[]];

      const result = await getV2AlgoSettingsByMpId(999);

      expect(result).toEqual([]);
    });
  });

  describe("updateV2AlgoSettings", () => {
    const baseSettings: V2AlgoSettings = {
      mp_id: 100,
      vendor_id: 5,
      suppress_price_break_if_Q1_not_updated: false,
      suppress_price_break: false,
      compete_on_price_break_only: false,
      up_down: AlgoPriceDirection.DOWN,
      badge_indicator: AlgoBadgeIndicator.ALL,
      execution_priority: 0,
      reprice_up_percentage: 0,
      compare_q2_with_q1: false,
      compete_with_all_vendors: false,
      reprice_up_badge_percentage: 0,
      sister_vendor_ids: "",
      exclude_vendors: "",
      inactive_vendor_id: "",
      handling_time_group: AlgoHandlingTimeGroup.ALL,
      keep_position: false,
      inventory_competition_threshold: 1,
      reprice_down_percentage: 0,
      max_price: 100,
      floor_price: 10,
      reprice_down_badge_percentage: 0,
      floor_compete_with_next: false,
      own_vendor_threshold: 1,
      price_strategy: AlgoPriceStrategy.UNIT,
    };

    it("updates existing settings and returns existing id", async () => {
      returnQueuesByTable["v2_algo_settings"] = [{ id: 42 }, undefined];

      const id = await updateV2AlgoSettings(baseSettings);

      expect(id).toBe(42);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_settings");
      const chains = mockKnex.mock.results.map((r: { value: unknown }) => r.value) as Array<ReturnType<typeof createChain>>;
      expect(chains[1].update).toHaveBeenCalledWith(baseSettings);
    });

    it("inserts new settings and returns insert id", async () => {
      returnQueuesByTable["v2_algo_settings"] = [undefined, [99]];

      const id = await updateV2AlgoSettings(baseSettings);

      expect(id).toBe(99);
      const chains = mockKnex.mock.results.map((r: { value: unknown }) => r.value) as Array<ReturnType<typeof createChain>>;
      expect(chains[1].insert).toHaveBeenCalledWith(baseSettings);
    });

    it("returns -1 on error and logs", async () => {
      const err = new Error("DB error");
      returnQueuesByTable["v2_algo_settings"] = [Promise.reject(err)];
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const id = await updateV2AlgoSettings(baseSettings);

      expect(id).toBe(-1);
      expect(consoleSpy).toHaveBeenCalledWith("Error updating V2 algo settings:", err);
    });
  });

  describe("getNet32Url", () => {
    it("returns Net32Url when row exists", async () => {
      returnQueuesByTable["table_scrapeProductList"] = [{ Net32Url: "https://example.com/product" }];

      const url = await getNet32Url(100);

      expect(url).toBe("https://example.com/product");
      expect(mockKnex).toHaveBeenCalledWith("table_scrapeProductList");
      const chain = mockKnex.mock.results[0].value;
      expect(chain.where).toHaveBeenCalledWith("MpId", 100);
    });

    it("returns null when no row", async () => {
      returnQueuesByTable["table_scrapeProductList"] = [undefined];

      const url = await getNet32Url(999);

      expect(url).toBeNull();
    });
  });

  describe("toggleV2AlgoEnabled", () => {
    it("creates new settings with enabled true when none exist", async () => {
      returnQueuesByTable["v2_algo_settings"] = [undefined];

      const result = await toggleV2AlgoEnabled(100, 5);

      expect(result).toEqual({ enabled: true });
      const chain = mockKnex.mock.results[1].value;
      expect(chain.insert).toHaveBeenCalledWith({
        mp_id: 100,
        vendor_id: 5,
        enabled: true,
      });
    });

    it("toggles enabled when settings exist", async () => {
      returnQueuesByTable["v2_algo_settings"] = [{ enabled: 1 }, undefined];

      const result = await toggleV2AlgoEnabled(100, 5);

      expect(result).toEqual({ enabled: false });
      const chain = mockKnex.mock.results[1].value;
      expect(chain.update).toHaveBeenCalledWith({ enabled: false });
    });

    it("toggles from false to true", async () => {
      returnQueuesByTable["v2_algo_settings"] = [{ enabled: 0 }, undefined];

      const result = await toggleV2AlgoEnabled(100, 5);

      expect(result).toEqual({ enabled: true });
      const chain = mockKnex.mock.results[1].value;
      expect(chain.update).toHaveBeenCalledWith({ enabled: true });
    });
  });

  describe("syncVendorSettingsForMpId", () => {
    it("returns error when vendor table does not exist", async () => {
      (getKnexInstance() as any).schema = { hasTable: jest.fn().mockResolvedValue(false) };
      mockKnex.mockImplementation((table: string) => {
        const chain = createChain();
        (chain as any).schema = table === "v2_algo_settings" ? mockSchema : { hasTable: jest.fn().mockResolvedValue(false) };
        return chain;
      });
      (mockKnex as any).schema = { hasTable: jest.fn().mockResolvedValue(false) };

      const result = await syncVendorSettingsForMpId(100);

      expect(result.vendorResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            vendorName: "FirstDent",
            insertedCount: 0,
            updatedCount: 0,
            error: "Table table_firstDentDetails does not exist",
          }),
        ])
      );
      expect(result.insertedCount).toBe(0);
      expect(result.updatedCount).toBe(0);
    });

    it("returns empty counts when vendor has no settings for mpId", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      const vendorTables = ["table_firstDentDetails", "table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      vendorTables.forEach((t) => (returnQueuesByTable[t] = [[]]));

      const result = await syncVendorSettingsForMpId(100);

      expect(result.vendorResults.length).toBe(7);
      expect(result.vendorResults.every((r) => r.insertedCount === 0 && r.updatedCount === 0)).toBe(true);
    });

    it("transforms vendor settings and inserts new records", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      const vendorRows = [
        {
          MpId: 100,
          Activated: 1,
          SuppressPriceBreakForOne: 1,
          SuppressPriceBreak: 0,
          BeatQPrice: 0,
          RepricingRule: 2,
          BadgeIndicator: "BADGE_ONLY",
          ExecutionPriority: 10,
          PercentageIncrease: 5,
          CompareWithQ1: 1,
          CompeteAll: 0,
          BadgePercentage: 3,
          SisterVendorId: "1;2",
          ExcludedVendors: "9;10",
          InactiveVendorId: "",
          HandlingTimeFilter: "FAST_SHIPPING",
          KeepPosition: 1,
          InventoryThreshold: 2,
          PercentageDown: 0.05,
          FloorPrice: 10,
          MaxPrice: 200,
          BadgePercentageDown: 0.02,
          CompeteWithNext: 1,
          OwnVendorThreshold: 1,
          IsNCNeeded: 1,
        },
      ];
      returnQueuesByTable["table_firstDentDetails"] = [vendorRows];
      returnQueuesByTable["v2_algo_settings"] = [undefined, undefined];
      const otherTables = ["table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      otherTables.forEach((t) => (returnQueuesByTable[t] = [[]]));

      const result = await syncVendorSettingsForMpId(100);

      expect(result.insertedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
      expect(result.vendorResults[0].insertedCount).toBe(1);
      expect(result.vendorResults[0].updatedCount).toBe(0);
    });

    it("updates existing records when they exist", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      const vendorRows = [{ MpId: 100, Activated: 1, SuppressPriceBreakForOne: 0, SuppressPriceBreak: 0, BeatQPrice: 0, RepricingRule: 1, BadgeIndicator: "ALL", ExecutionPriority: 0, PercentageIncrease: -1, CompareWithQ1: 0, CompeteAll: 0, BadgePercentage: -1, SisterVendorId: "", ExcludedVendors: "", InactiveVendorId: "", HandlingTimeFilter: "ALL", KeepPosition: 0, InventoryThreshold: 1, PercentageDown: 0, FloorPrice: 0, MaxPrice: 99999999.99, BadgePercentageDown: 0, CompeteWithNext: 0, OwnVendorThreshold: 1, IsNCNeeded: 0 }];
      returnQueuesByTable["table_firstDentDetails"] = [vendorRows];
      returnQueuesByTable["v2_algo_settings"] = [{ id: 1 }, undefined];
      const otherTables = ["table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      otherTables.forEach((t) => (returnQueuesByTable[t] = [[]]));

      const result = await syncVendorSettingsForMpId(100);

      expect(result.insertedCount).toBe(0);
      expect(result.updatedCount).toBe(1);
    });

    it("catches and returns error message per vendor", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      returnQueuesByTable["table_firstDentDetails"] = [Promise.reject(new Error("Connection refused"))];
      const otherTables = ["table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      otherTables.forEach((t) => (returnQueuesByTable[t] = [[]]));

      const result = await syncVendorSettingsForMpId(100);

      expect(result.vendorResults[0].error).toBe("Connection refused");
      expect(result.vendorResults[0].insertedCount).toBe(0);
      expect(result.vendorResults[0].updatedCount).toBe(0);
    });

    it("uses Unknown error for non-Error throws", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      returnQueuesByTable["table_firstDentDetails"] = [Promise.reject("string error")];
      const otherTables = ["table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      otherTables.forEach((t) => (returnQueuesByTable[t] = [[]]));

      const result = await syncVendorSettingsForMpId(100);

      expect(result.vendorResults[0].error).toBe("Unknown error");
    });
  });

  describe("getAllProductsWithAlgoData", () => {
    it("returns products with channel_name from VendorNameLookup", async () => {
      const rows = [
        { vendor_id: 20722, mp_id: 1, floor_price: "10", max_price: "100", price_strategy: "UNIT", enabled: 1 },
        { vendor_id: 999, mp_id: 2, floor_price: "5", max_price: "50", price_strategy: "TOTAL", enabled: 0 },
      ];
      returnQueuesByTable["v2_algo_settings as vas"] = [rows];

      const result = await getAllProductsWithAlgoData();

      expect(result).toHaveLength(2);
      expect(result[0].channel_name).toBe("FRONTIER");
      expect(result[1].channel_name).toBe("Vendor 999");
    });

    it("returns empty array when no products", async () => {
      returnQueuesByTable["v2_algo_settings as vas"] = [[]];

      const result = await getAllProductsWithAlgoData();

      expect(result).toEqual([]);
    });
  });

  describe("syncAllVendorSettings", () => {
    it("skips vendor when table does not exist", async () => {
      mockSchema.hasTable.mockResolvedValue(false);

      const result = await syncAllVendorSettings();

      expect(result.vendorResults).toContainEqual(
        expect.objectContaining({
          vendorName: "FirstDent",
          insertedCount: 0,
          updatedCount: 0,
          success: false,
        })
      );
      expect(result.totalInserted).toBe(0);
      expect(result.totalUpdated).toBe(0);
    });

    it("skips vendor when no settings and marks success true", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      const vendorTables = ["table_firstDentDetails", "table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      vendorTables.forEach((t) => {
        returnQueuesByTable[t] = [[], []]; // main select("*") then channel ID select
      });

      const result = await syncAllVendorSettings();

      expect(result.vendorResults.every((r) => r.success === true)).toBe(true);
      expect(result.totalInserted).toBe(0);
    });

    it("transforms and inserts settings via batch delete-then-insert", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      const vendorRows = [
        {
          MpId: 100,
          Activated: 1,
          SuppressPriceBreakForOne: 0,
          SuppressPriceBreak: 0,
          BeatQPrice: 0,
          RepricingRule: 1,
          BadgeIndicator: "ALL",
          ExecutionPriority: 0,
          PercentageIncrease: -1,
          CompareWithQ1: 0,
          CompeteAll: 0,
          BadgePercentage: -1,
          SisterVendorId: "",
          ExcludedVendors: "",
          InactiveVendorId: "",
          HandlingTimeFilter: "ALL",
          KeepPosition: 0,
          InventoryThreshold: 1,
          PercentageDown: 0,
          FloorPrice: 0,
          MaxPrice: 100,
          BadgePercentageDown: 0,
          CompeteWithNext: 0,
          OwnVendorThreshold: 1,
          IsNCNeeded: 0,
          UnitPrice: null,
        },
      ];
      returnQueuesByTable["table_firstDentDetails"] = [vendorRows, []]; // main select, then channel ID select
      returnQueuesByTable["v2_algo_settings"] = [1, undefined]; // del count, insert
      const otherTables = ["table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      otherTables.forEach((t) => (returnQueuesByTable[t] = [[], []]));

      const result = await syncAllVendorSettings();

      expect(result.totalInserted).toBe(1);
      expect(result.vendorResults[0].success).toBe(true);
      expect(result.vendorResults[0].insertedCount).toBe(1);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it("syncs channel IDs when column exists and has rows", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      mockSchema.hasColumn.mockResolvedValue(true);
      const vendorTables = ["table_firstDentDetails", "table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      vendorTables.forEach((t, i) => {
        returnQueuesByTable[t] = [
          [], // main select("*")
          i === 0 ? [{ MpId: 1, ChannelId: "ch-1" }] : [], // channel ID select for first vendor
        ];
      });
      returnQueuesByTable["channel_ids"] = [undefined]; // insert (via trx in performChannelIdBatchDeleteThenInsert)

      const result = await syncAllVendorSettings();

      expect(result.channelIdResults.totalInserted).toBeGreaterThanOrEqual(0);
      expect(result.channelIdResults.vendorResults.length).toBe(7);
    });

    it("skips channel ID sync when table has no ChannelId column", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      mockSchema.hasColumn.mockResolvedValue(false);
      const vendorTables = ["table_firstDentDetails", "table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      vendorTables.forEach((t) => (returnQueuesByTable[t] = [[]])); // main select only; channel sync returns early

      const result = await syncAllVendorSettings();

      expect(result.channelIdResults.vendorResults.every((r) => r.success === true)).toBe(true);
    });

    it("skips channel ID sync when vendor table does not exist", async () => {
      mockSchema.hasTable.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false); // channel ID phase: table does not exist
      mockSchema.hasColumn.mockResolvedValue(true);
      const vendorTables = ["table_firstDentDetails", "table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      vendorTables.forEach((t) => (returnQueuesByTable[t] = [[]])); // main select only

      const result = await syncAllVendorSettings();

      expect(result.channelIdResults.vendorResults.length).toBe(7);
    });

    it("propagates error when batch delete-then-insert transaction fails", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      const vendorRows = [{ MpId: 1, Activated: 1, SuppressPriceBreakForOne: 0, SuppressPriceBreak: 0, BeatQPrice: 0, RepricingRule: 1, BadgeIndicator: "ALL", ExecutionPriority: 0, PercentageIncrease: -1, CompareWithQ1: 0, CompeteAll: 0, BadgePercentage: -1, SisterVendorId: "", ExcludedVendors: "", InactiveVendorId: "", HandlingTimeFilter: "ALL", KeepPosition: 0, InventoryThreshold: 1, PercentageDown: 0, FloorPrice: 0, MaxPrice: 100, BadgePercentageDown: 0, CompeteWithNext: 0, OwnVendorThreshold: 1, IsNCNeeded: 0, UnitPrice: null }];
      returnQueuesByTable["table_firstDentDetails"] = [vendorRows, []];
      returnQueuesByTable["v2_algo_settings"] = [1, undefined];
      const otherTables = ["table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      otherTables.forEach((t) => (returnQueuesByTable[t] = [[], []]));
      mockTransaction.mockRejectedValueOnce(new Error("Transaction failed"));

      await expect(syncAllVendorSettings()).rejects.toThrow("Transaction failed");
    });

    it("propagates error when channel ID sync throws", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      mockSchema.hasColumn.mockResolvedValue(true);
      const vendorTables = ["table_firstDentDetails", "table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      vendorTables.forEach((t, i) => (returnQueuesByTable[t] = [[], i === 0 ? [{ MpId: 1, ChannelId: "ch-1" }] : []]));
      returnQueuesByTable["channel_ids"] = [undefined];
      mockTransaction.mockRejectedValueOnce(new Error("Channel ID transaction failed"));

      await expect(syncAllVendorSettings()).rejects.toThrow("Channel ID transaction failed");
    });

    it("propagates error when channel ID select fails", async () => {
      mockSchema.hasTable.mockResolvedValue(true);
      mockSchema.hasColumn.mockResolvedValue(true);
      const vendorTables = ["table_firstDentDetails", "table_frontierDetails", "table_mvpDetails", "table_topDentDetails", "table_tradentDetails", "table_triadDetails", "table_biteSupplyDetails"];
      vendorTables.forEach((t, i) => (returnQueuesByTable[t] = [[], i === 0 ? Promise.reject(new Error("Select failed")) : []]));

      await expect(syncAllVendorSettings()).rejects.toThrow("Select failed");
    });
  });
});
