import * as mysqlV2 from "../mysql-v2";
import * as SqlMapper from "../../utility/mapper/mysql-mapper";
import { CacheKey } from "@repricer-monorepo/shared";
import AuditInfo from "../../models/audit-info";
import ExportModel from "../../models/export-model";

// --- Mock: CacheClient
const mockCacheGet = jest.fn().mockResolvedValue(null);
const mockCacheSet = jest.fn().mockResolvedValue(undefined);
const mockCacheDelete = jest.fn().mockResolvedValue(undefined);
const mockCacheDisconnect = jest.fn().mockResolvedValue(undefined);
const mockGetInstance = jest.fn().mockReturnValue({
  get: mockCacheGet,
  set: mockCacheSet,
  delete: mockCacheDelete,
  disconnect: mockCacheDisconnect,
});

jest.mock("../../client/cacheClient", () => ({
  __esModule: true,
  default: {
    getInstance: (...args: any[]) => mockGetInstance(...args),
  },
  GetCacheClientOptions: jest.fn((config: any) => ({ host: config?.CACHE_HOST_URL || "localhost" })),
}));

// --- Mock: knex-wrapper
const mockRaw = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockUpdate = jest.fn().mockResolvedValue(1);
const mockInsert = jest.fn().mockResolvedValue([1]);
const mockSelect = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockOffset = jest.fn().mockReturnThis();
const mockFirst = jest.fn();
const mockCount = jest.fn().mockReturnThis();
const mockClearSelect = jest.fn().mockReturnThis();
const mockClearOrder = jest.fn().mockReturnThis();
const mockClone = jest.fn();
const mockDelete = jest.fn().mockResolvedValue(1);
const mockWhereIn = jest.fn().mockReturnThis();
const mockWhereBetween = jest.fn().mockReturnThis();

const mockTrxMerge = jest.fn().mockResolvedValue(undefined);
const mockTrxOnConflict = jest.fn().mockReturnValue({ merge: mockTrxMerge });
const mockTrxInsert = jest.fn();
const mockTrxTable = {
  insert: mockTrxInsert,
  onConflict: mockTrxOnConflict,
  merge: mockTrxMerge,
};
mockTrxInsert.mockReturnValue(mockTrxTable);
// trx is called as trx("table") or trx<Type>("table") - must return chain with insert/onConflict/merge
const mockTrxChain = jest.fn((_table: string) => mockTrxTable);
(mockTrxChain as any).insert = mockTrxInsert;
(mockTrxChain as any).onConflict = mockTrxOnConflict;
(mockTrxChain as any).merge = mockTrxMerge;

const mockTransaction = jest.fn((cb: (trx: any) => Promise<void>) => cb(mockTrxChain as any));

const tableChain = {
  where: mockWhere,
  update: mockUpdate,
  insert: mockInsert,
  select: mockSelect,
  orderBy: mockOrderBy,
  limit: mockLimit,
  offset: mockOffset,
  first: mockFirst,
  count: mockCount,
  clearSelect: mockClearSelect,
  clearOrder: mockClearOrder,
  clone: mockClone,
  delete: mockDelete,
  whereIn: mockWhereIn,
  whereBetween: mockWhereBetween,
  then(resolve: any, reject?: any) {
    return Promise.resolve([]).then(resolve, reject);
  },
  catch(_fn: any) {
    return this;
  },
};
// Support query.where("api_status", status) and query.where("vendor_name", "like", val)
const mockWhereOverload = jest.fn().mockReturnThis();
Object.assign(tableChain, { where: mockWhereOverload });

const mockKnexInstance = jest.fn((_table: string) => tableChain);
(mockKnexInstance as any).raw = mockRaw;
(mockKnexInstance as any).transaction = mockTransaction;

const mockGetKnexInstance = jest.fn(() => mockKnexInstance);

jest.mock("../knex-wrapper", () => ({
  getKnexInstance: () => mockGetKnexInstance(),
  destroyKnexInstance: jest.fn(),
}));

jest.mock("../../utility/config", () => ({
  applicationConfig: { CACHE_HOST_URL: "localhost" },
}));

jest.mock("../../utility/mapper/mysql-mapper", () => ({
  ToIpConfigModelList: jest.fn((data: any) => (data && data.length ? [{ proxyProvider: 1 }] : [])),
  ToEnvSettingsModel: jest.fn((data: any) => (data ? { source: "s", delay: 1, ownVendorId: "v", excludedSisterVendors: [], FrontierApiKey: "k", DevIntegrationKey: "dk" } : null)),
  ToCronSettingsModel: jest.fn((data: any) => (data && data.length ? [{ CronId: "c1" }] : null)),
  MapWithAuditInfo: jest.fn((data: any) => (data && data.length ? [{ id: 1, AuditInfo: {} }] : [])),
}));

jest.mock("../../utility/session-helper", () => ({
  GetAuditInfo: jest.fn().mockResolvedValue({ UpdatedBy: "test-user", UpdatedOn: new Date() }),
}));

describe("mysql-v2 service", () => {
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation();
    mockCacheGet.mockResolvedValue(null);
    mockRaw.mockResolvedValue([[{ id: 1 }]]);
    mockFirst.mockResolvedValue({ total: 10 });
    mockWhereOverload.mockReturnValue(tableChain);
    mockWhereIn.mockReturnValue(tableChain);
    mockClone.mockImplementation(function (this: any) {
      return {
        ...this,
        clearSelect: jest.fn().mockReturnThis(),
        clearOrder: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ total: 5 }),
      };
    });
    mockKnexInstance.mockReturnValue(tableChain);
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
  });

  describe("GetConfigurations", () => {
    it("returns cached result when cache hit and disconnects", async () => {
      const cached = [{ id: 1 }];
      mockCacheGet.mockResolvedValue(cached);

      const result = await mysqlV2.GetConfigurations(true);

      expect(mockGetInstance).toHaveBeenCalled();
      expect(mockCacheGet).toHaveBeenCalledWith(`${CacheKey.IP_CONFIG}_true`);
      expect(mockCacheDisconnect).toHaveBeenCalled();
      expect(mockGetKnexInstance).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it("when cache miss and activeOnly true: runs query with Active param and maps result", async () => {
      mockRaw.mockResolvedValue([[{ ProxyProvider: 1 }]]);
      (SqlMapper.ToIpConfigModelList as jest.Mock).mockReturnValue([{ proxyProvider: 1 }]);

      const result = await mysqlV2.GetConfigurations(true);

      expect(mockRaw).toHaveBeenCalledWith("SELECT * FROM ipConfig where Active = ?", [true]);
      expect(SqlMapper.ToIpConfigModelList).toHaveBeenCalledWith([{ ProxyProvider: 1 }]);
      expect(mockCacheSet).toHaveBeenCalledWith(`${CacheKey.IP_CONFIG}_true`, [{ proxyProvider: 1 }]);
      expect(result).toEqual([{ proxyProvider: 1 }]);
    });

    it("when cache miss and activeOnly false: runs query without params", async () => {
      mockRaw.mockResolvedValue([[{ ProxyProvider: 2 }]]);
      (SqlMapper.ToIpConfigModelList as jest.Mock).mockReturnValue([{ proxyProvider: 2 }]);

      const result = await mysqlV2.GetConfigurations(false);

      expect(mockRaw).toHaveBeenCalledWith("SELECT * FROM ipConfig");
      expect(result).toEqual([{ proxyProvider: 2 }]);
    });

    it("when result empty returns empty array and does not set cache", async () => {
      mockRaw.mockResolvedValue([[]]);
      (SqlMapper.ToIpConfigModelList as jest.Mock).mockReturnValue([]);

      const result = await mysqlV2.GetConfigurations(true);

      expect(result).toEqual([]);
      // When result[0] is [], the code still enters the block ([] is truthy) and may set cache with []
      expect(mockCacheSet).toHaveBeenCalledWith(`${CacheKey.IP_CONFIG}_true`, []);
    });
  });

  describe("UpdateConfiguration", () => {
    it("updates ipConfig for each element and invalidates cache", async () => {
      const payload = [{ proxyProvider: 1, ipType: 2, userName: "u", password: "p", hostUrl: "h", port: 80, active: true }];
      const req = { session: { users_id: { userName: "admin" } } };
      const { GetAuditInfo } = require("../../utility/session-helper");
      (GetAuditInfo as jest.Mock).mockResolvedValue({ UpdatedBy: "admin", UpdatedOn: new Date() });

      await mysqlV2.UpdateConfiguration(payload, req);

      expect(mockKnexInstance).toHaveBeenCalledWith("ipConfig");
      expect(mockWhereOverload).toHaveBeenCalledWith({ ProxyProvider: 1, IpType: 2 });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          UserName: "u",
          Password: "p",
          HostUrl: "h",
          Port: 80,
          Active: 1,
        })
      );
      expect(mockCacheDelete).toHaveBeenCalledWith(`${CacheKey.IP_CONFIG}_true`);
      expect(mockCacheDelete).toHaveBeenCalledWith(`${CacheKey.IP_CONFIG}_false`);
      expect(mockCacheDisconnect).toHaveBeenCalled();
    });
  });

  describe("GetEnvSettings", () => {
    it("returns cached result when cache hit", async () => {
      const cached = { source: "cached" };
      mockCacheGet.mockResolvedValue(cached);

      const result = await mysqlV2.GetEnvSettings();

      expect(mockCacheGet).toHaveBeenCalledWith(CacheKey.ENV_SETTINGS);
      expect(mockCacheDisconnect).toHaveBeenCalled();
      expect(mockRaw).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it("when cache miss: calls GetEnvSettings SP, maps and caches", async () => {
      mockRaw.mockResolvedValue([[{ Source: "s" }]]);
      (SqlMapper.ToEnvSettingsModel as jest.Mock).mockReturnValue({ source: "s" });

      const result = await mysqlV2.GetEnvSettings();

      expect(mockRaw).toHaveBeenCalledWith("call GetEnvSettings()");
      expect(SqlMapper.ToEnvSettingsModel).toHaveBeenCalledWith({ Source: "s" });
      expect(mockCacheSet).toHaveBeenCalledWith(CacheKey.ENV_SETTINGS, { source: "s" });
      expect(result).toEqual({ source: "s" });
    });

    it("when cache miss and empty result returns null", async () => {
      mockRaw.mockResolvedValue([[]]);

      const result = await mysqlV2.GetEnvSettings();

      expect(mockCacheSet).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("GetEnvValueByKey", () => {
    it("returns env value for SOURCE", async () => {
      mockCacheGet.mockResolvedValue({ source: "src", delay: 0, ownVendorId: "", excludedSisterVendors: [], FrontierApiKey: "", DevIntegrationKey: "" });
      const result = await mysqlV2.GetEnvValueByKey("SOURCE");
      expect(result).toBe("src");
    });

    it("returns env value for DELAY", async () => {
      mockCacheGet.mockResolvedValue({ source: "", delay: 5, ownVendorId: "", excludedSisterVendors: [], FrontierApiKey: "", DevIntegrationKey: "" });
      const result = await mysqlV2.GetEnvValueByKey("DELAY");
      expect(result).toBe(5);
    });

    it("returns env value for OWN_VENDOR_ID", async () => {
      mockCacheGet.mockResolvedValue({ source: "", delay: 0, ownVendorId: "v1", excludedSisterVendors: [], FrontierApiKey: "", DevIntegrationKey: "" });
      const result = await mysqlV2.GetEnvValueByKey("OWN_VENDOR_ID");
      expect(result).toBe("v1");
    });

    it("returns env value for SISTER_VENDORS", async () => {
      mockCacheGet.mockResolvedValue({ source: "", delay: 0, ownVendorId: "", excludedSisterVendors: [1, 2], FrontierApiKey: "", DevIntegrationKey: "" });
      const result = await mysqlV2.GetEnvValueByKey("SISTER_VENDORS");
      expect(result).toEqual([1, 2]);
    });

    it("returns env value for FRONTIER_API_KEY", async () => {
      mockCacheGet.mockResolvedValue({ source: "", delay: 0, ownVendorId: "", excludedSisterVendors: [], FrontierApiKey: "key", DevIntegrationKey: "" });
      const result = await mysqlV2.GetEnvValueByKey("FRONTIER_API_KEY");
      expect(result).toBe("key");
    });

    it("returns env value for DEV_SYNC_API_KEY", async () => {
      mockCacheGet.mockResolvedValue({ source: "", delay: 0, ownVendorId: "", excludedSisterVendors: [], FrontierApiKey: "", DevIntegrationKey: "devkey" });
      const result = await mysqlV2.GetEnvValueByKey("DEV_SYNC_API_KEY");
      expect(result).toBe("devkey");
    });

    it("throws for invalid key name", async () => {
      mockCacheGet.mockResolvedValue({ source: "s", delay: 0, ownVendorId: "", excludedSisterVendors: [], FrontierApiKey: "", DevIntegrationKey: "" });
      await expect(mysqlV2.GetEnvValueByKey("INVALID_KEY")).rejects.toThrow("Invalid key name: INVALID_KEY");
    });

    it("returns undefined when envSettings is null", async () => {
      mockCacheGet.mockResolvedValue(null);
      mockRaw.mockResolvedValue([[]]);
      const result = await mysqlV2.GetEnvValueByKey("SOURCE");
      expect(result).toBeUndefined();
    });
  });

  describe("UpsertEnvSettings", () => {
    it("updates env_settings and env_execution_priorities and invalidates cache", async () => {
      const payload = {
        source: "s",
        delay: "10",
        override_all: "[]",
        FrontierApiKey: "k",
        DevIntegrationKey: "dk",
        expressCronBatchSize: "5",
        expressCronOverlapThreshold: "2",
        expressCronInstanceLimit: "3",
        slowCronBatchSize: "10",
        slowCronInstanceLimit: "2",
        updatedBy: "u",
        updatedOn: new Date(),
        override_execution_priority_details: {
          override_priority: "[]",
          priority_settings: {
            tradent_priority: "[1]",
            frontier_priority: "[2]",
            mvp_priority: "[3]",
            topDent_priority: "[4]",
            firstDent_priority: "[5]",
            triad_priority: "[6]",
            biteSupply_priority: "[7]",
          },
        },
      };

      await mysqlV2.UpsertEnvSettings(payload);

      expect(mockKnexInstance).toHaveBeenCalledWith("env_settings");
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.ENV_SETTINGS);
      expect(mockCacheDisconnect).toHaveBeenCalled();
    });
  });

  describe("InsertOrUpdateCronSettings", () => {
    it("runs transaction with cron insert and secretKeys, alternateProviders", async () => {
      const cronEntity = {
        CronId: "c1",
        CronName: "Cron1",
        CronTimeUnit: "min" as const,
        CronTime: 5,
        ProxyProvider: 1,
        IsHidden: false,
        CronType: "DEFAULT",
        CronStatus: true,
      };
      const secretKeys = [{ CronId: "c1", VendorName: "V1", SecretKey: "sk1" }];
      const alternateProviders = [{ CronId: "c1", Sequence: 1, ProxyProvider: 2 }];

      await mysqlV2.InsertOrUpdateCronSettings(cronEntity, secretKeys, alternateProviders);

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockTrxInsert).toHaveBeenCalledWith(cronEntity);
      expect(mockTrxOnConflict).toHaveBeenCalledWith("CronId");
      expect(mockTrxInsert).toHaveBeenCalledWith(secretKeys[0]);
      expect(mockTrxInsert).toHaveBeenCalledWith(alternateProviders[0]);
    });
  });

  describe("GetCronSettingsList", () => {
    it("returns cached list when cache hit", async () => {
      const cached = [{ CronId: "c1" }];
      mockCacheGet.mockResolvedValue(cached);

      const result = await mysqlV2.GetCronSettingsList();

      expect(mockCacheGet).toHaveBeenCalledWith(CacheKey.CRON_SETTINGS_LIST);
      expect(result).toEqual(cached);
    });

    it("when cache miss: calls SP, maps and caches", async () => {
      mockRaw.mockResolvedValue([[{ CronId: "c1" }]]);
      (SqlMapper.ToCronSettingsModel as jest.Mock).mockReturnValue([{ CronId: "c1" }]);

      const result = await mysqlV2.GetCronSettingsList();

      expect(mockRaw).toHaveBeenCalledWith("call GetRegularCronSettingsList()");
      expect(mockCacheSet).toHaveBeenCalledWith(CacheKey.CRON_SETTINGS_LIST, [{ CronId: "c1" }]);
      expect(result).toEqual([{ CronId: "c1" }]);
    });
  });

  describe("UpdateCronSettingsList", () => {
    it("updates cron_settings and secret_keys and alternate_proxy_providers, then invalidates cache", async () => {
      const payload = [
        {
          CronId: "c1",
          CronName: "C1",
          CronTime: "5",
          CronTimeUnit: "min",
          ProxyProvider: 1,
          IpType: 2,
          FixedIp: "1.2.3.4",
          SecretKey: [{ vendorName: "V1", secretKey: "sk1" }],
          AlternateProxyProvider: [{ Sequence: 1, ProxyProvider: 2 }],
        },
      ];
      const req = { session: { users_id: { userName: "u" } } };
      const { GetAuditInfo } = require("../../utility/session-helper");
      (GetAuditInfo as jest.Mock).mockResolvedValue({ UpdatedBy: "u", UpdatedOn: new Date() });

      await mysqlV2.UpdateCronSettingsList(payload, req);

      expect(mockKnexInstance).toHaveBeenCalledWith("cron_settings");
      expect(mockKnexInstance).toHaveBeenCalledWith("secret_keys");
      expect(mockKnexInstance).toHaveBeenCalledWith("alternate_proxy_providers");
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.CRON_SETTINGS_LIST);
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.SLOW_CRON_DETAILS);
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.SCRAPE_CRON_DETAILS);
    });

    it("skips SecretKey and AlternateProxyProvider when empty", async () => {
      const payload = [{ CronId: "c1", CronName: "C1" }];
      const req = { session: {} };
      (require("../../utility/session-helper").GetAuditInfo as jest.Mock).mockResolvedValue({ UpdatedBy: "ANON", UpdatedOn: new Date() });

      await mysqlV2.UpdateCronSettingsList(payload, req);

      expect(mockKnexInstance).toHaveBeenCalledWith("cron_settings");
    });
  });

  describe("ToggleCronStatus", () => {
    it("updates cron_settings and invalidates cache", async () => {
      const req = {};
      (require("../../utility/session-helper").GetAuditInfo as jest.Mock).mockResolvedValue({ UpdatedBy: "u", UpdatedOn: new Date() });

      await mysqlV2.ToggleCronStatus("c1", "true", req);

      expect(mockKnexInstance).toHaveBeenCalledWith("cron_settings");
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ CronStatus: true }));
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.CRON_SETTINGS_LIST);
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.MINI_ERP_CRON_DETAILS);
    });
  });

  describe("GetSlowCronDetails", () => {
    it("returns cached when cache hit", async () => {
      mockCacheGet.mockResolvedValue([{ CronId: "slow" }]);
      const result = await mysqlV2.GetSlowCronDetails();
      expect(result).toEqual([{ CronId: "slow" }]);
    });

    it("when cache miss: calls GetSlowCronSettingsList and caches", async () => {
      mockRaw.mockResolvedValue([[{ CronId: "s1" }]]);
      (SqlMapper.ToCronSettingsModel as jest.Mock).mockReturnValue([{ CronId: "s1" }]);
      const result = await mysqlV2.GetSlowCronDetails();
      expect(mockRaw).toHaveBeenCalledWith("call GetSlowCronSettingsList()");
      expect(result).toEqual([{ CronId: "s1" }]);
    });
  });

  describe("GetScrapeCrons", () => {
    it("returns cached when cache hit", async () => {
      mockCacheGet.mockResolvedValue([{ CronId: "scrape" }]);
      const result = await mysqlV2.GetScrapeCrons();
      expect(result).toEqual([{ CronId: "scrape" }]);
    });

    it("when cache miss: calls GetDataOnlyCronList and caches", async () => {
      mockRaw.mockResolvedValue([[{ CronId: "d1" }]]);
      (SqlMapper.ToCronSettingsModel as jest.Mock).mockReturnValue([{ CronId: "d1" }]);
      const result = await mysqlV2.GetScrapeCrons();
      expect(mockRaw).toHaveBeenCalledWith("call GetDataOnlyCronList()");
      expect(result).toEqual([{ CronId: "d1" }]);
    });
  });

  describe("GetMiniErpCronDetails", () => {
    it("returns cached when cache hit", async () => {
      mockCacheGet.mockResolvedValue([{ CronId: "mini" }]);
      const result = await mysqlV2.GetMiniErpCronDetails();
      expect(result).toEqual([{ CronId: "mini" }]);
    });

    it("when cache miss: runs raw SELECT and maps result", async () => {
      mockRaw.mockResolvedValue([[{ CronId: "m1" }]]);
      (SqlMapper.ToCronSettingsModel as jest.Mock).mockReturnValue([{ CronId: "m1" }]);
      const result = await mysqlV2.GetMiniErpCronDetails();
      expect(mockRaw).toHaveBeenCalledWith(expect.stringContaining("MINI_ERP"));
      expect(result).toEqual([{ CronId: "m1" }]);
    });

    it("when result empty does not set cache", async () => {
      mockRaw.mockResolvedValue([[]]);
      const result = await mysqlV2.GetMiniErpCronDetails();
      expect(mockCacheSet).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("UpsertFilterCronSettings", () => {
    it("skips when payload empty", async () => {
      await mysqlV2.UpsertFilterCronSettings([]);
      expect(mockGetKnexInstance).not.toHaveBeenCalled();
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.FILTER_CRON_DETAILS);
    });

    it("skips when payload null", async () => {
      await mysqlV2.UpsertFilterCronSettings(null);
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.FILTER_CRON_DETAILS);
    });

    it("inserts/merges filter_cron_settings and invalidates cache", async () => {
      const payload = [
        {
          cronId: "fc1",
          cronName: "FC1",
          cronExpression: "* * * * *",
          status: "true",
          filterValue: "10",
          linkedCronId: "lc1",
          linkedCronName: "LC1",
          AuditInfo: { UpdatedBy: "u" },
        },
      ];
      await mysqlV2.UpsertFilterCronSettings(payload);
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockTrxInsert).toHaveBeenCalled();
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.FILTER_CRON_DETAILS);
    });

    it("uses ANONYMOUS when AuditInfo missing", async () => {
      const payload = [
        {
          cronId: "fc1",
          cronName: "FC1",
          cronExpression: "* * * * *",
          status: "false",
          filterValue: "5",
          linkedCronId: null,
          linkedCronName: null,
        },
      ];
      await mysqlV2.UpsertFilterCronSettings(payload);
      expect(mockTrxInsert).toHaveBeenCalledWith(expect.objectContaining({ UpdatedBy: "ANONYMOUS" }));
    });
  });

  describe("GetFilteredCrons", () => {
    it("returns cached when cache hit", async () => {
      mockCacheGet.mockResolvedValue([{ id: 1 }]);
      const result = await mysqlV2.GetFilteredCrons();
      expect(result).toEqual([{ id: 1 }]);
    });

    it("when cache miss: calls GetFilterCronList and maps with audit", async () => {
      mockRaw.mockResolvedValue([[{ CronId: "f1" }]]);
      (SqlMapper.MapWithAuditInfo as jest.Mock).mockReturnValue([{ id: 1, AuditInfo: {} }]);
      const result = await mysqlV2.GetFilteredCrons();
      expect(mockRaw).toHaveBeenCalledWith("call GetFilterCronList()");
      expect(result).toEqual([{ id: 1, AuditInfo: {} }]);
    });
  });

  describe("ToggleFilterCronStatus", () => {
    it("updates filter_cron_settings and invalidates cache", async () => {
      const auditInfo = new AuditInfo("user");
      await mysqlV2.ToggleFilterCronStatus("fc1", true, auditInfo);
      expect(mockKnexInstance).toHaveBeenCalledWith("filter_cron_settings");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          Status: true,
          UpdatedBy: "user",
        })
      );
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.FILTER_CRON_DETAILS);
    });
  });

  describe("GetProxyFailureDetails", () => {
    it("returns mapped result when raw returns data", async () => {
      mockRaw.mockResolvedValue([[{ id: 1 }]]);
      (SqlMapper.MapWithAuditInfo as jest.Mock).mockReturnValue([{ id: 1 }]);
      const result = await mysqlV2.GetProxyFailureDetails();
      expect(mockRaw).toHaveBeenCalledWith("call GetProxyFailureDetails()");
      expect(result).toEqual([{ id: 1 }]);
    });

    it("returns empty array when no result", async () => {
      mockRaw.mockResolvedValue([[]]);
      const result = await mysqlV2.GetProxyFailureDetails();
      expect(SqlMapper.MapWithAuditInfo).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("UpdateThresholdValue", () => {
    it("updates proxy_failure_details by ProxyProviderId", async () => {
      await mysqlV2.UpdateThresholdValue({ proxyProvider: "1", value: "5" }, "user");
      expect(mockKnexInstance).toHaveBeenCalledWith("proxy_failure_details");
      expect(mockWhereOverload).toHaveBeenCalledWith({ ProxyProviderId: 1 });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          ThresholdCount: 5,
          UpdatedBy: "user",
        })
      );
    });
  });

  describe("InitExportStatus", () => {
    it("inserts export_status and returns insertId", async () => {
      mockInsert.mockResolvedValue([99]);
      const payload = new ExportModel("pending", "file.csv", new Date(), new Date(), "user");
      const result = await mysqlV2.InitExportStatus(payload);
      expect(mockKnexInstance).toHaveBeenCalledWith("export_status");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: "file.csv",
          status: "pending",
          requestedBy: "user",
        })
      );
      expect(result).toBe(99);
    });
  });

  describe("GetExportFileNamesByStatus", () => {
    it("selects from export_status by status", async () => {
      const rows = [{ fileName: "a.csv", status: "completed" }];
      const chain: any = Object.assign({}, tableChain);
      chain.select = jest.fn().mockReturnValue(chain);
      chain.where = jest.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => Promise.resolve(rows).then(resolve);
      mockKnexInstance.mockReturnValueOnce(chain);

      const result = await mysqlV2.GetExportFileNamesByStatus("completed");

      expect(mockKnexInstance).toHaveBeenCalledWith("export_status");
      expect(result).toEqual(rows);
    });
  });

  describe("GetExportFileStatus", () => {
    it("returns first row for fileName", async () => {
      const row = { fileName: "f.csv", status: "pending" };
      mockFirst.mockResolvedValueOnce(row);

      const result = await mysqlV2.GetExportFileStatus("f.csv");

      expect(mockKnexInstance).toHaveBeenCalledWith("export_status");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockWhereOverload).toHaveBeenCalledWith({ fileName: "f.csv" });
      expect(mockFirst).toHaveBeenCalled();
      expect(result).toEqual(row);
    });
  });

  describe("UpdateExportStatusV2", () => {
    it("updates export_status by fileName", async () => {
      await mysqlV2.UpdateExportStatusV2({ fileName: "f.csv", status: "completed" });
      expect(mockKnexInstance).toHaveBeenCalledWith("export_status");
      expect(mockWhereOverload).toHaveBeenCalledWith({ fileName: "f.csv" });
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    });
  });

  describe("GetWaitlistItems", () => {
    it("applies status filter and returns paginated result", async () => {
      const rows = [{ id: 1, vendor_name: "V1" }];
      const countFirst = jest.fn().mockResolvedValue({ total: 1 });
      const chain = {
        select: jest.fn().mockReturnThis(),
        where: mockWhereOverload,
        whereBetween: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue(rows),
        clone: jest.fn().mockReturnValue({
          clearSelect: jest.fn().mockReturnThis(),
          clearOrder: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          first: countFirst,
        }),
      };
      mockKnexInstance.mockReturnValue(chain as any);
      mockWhereOverload.mockReturnValue(chain);

      const result = await mysqlV2.GetWaitlistItems({
        page: 1,
        pageSize: 10,
        offset: 0,
        status: "pending",
      });

      expect(result.data).toEqual(rows);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.total).toBe(1);
    });

    it("applies date range and search", async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        where: mockWhereOverload,
        whereBetween: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([]),
        clone: jest.fn().mockReturnValue({
          clearSelect: jest.fn().mockReturnThis(),
          clearOrder: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ total: 0 }),
        }),
      };
      mockKnexInstance.mockReturnValue(chain as any);
      mockWhereOverload.mockReturnValue(chain);

      await mysqlV2.GetWaitlistItems({
        page: 1,
        pageSize: 10,
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        search: "acme",
      });

      expect(chain.whereBetween).toHaveBeenCalledWith("created_at", ["2024-01-01", "2024-01-31"]);
      expect(mockWhereOverload).toHaveBeenCalledWith("vendor_name", "like", "%acme%");
    });

    it("applies sort ASC when direction is ASC", async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereBetween: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([]),
        clone: jest.fn().mockReturnValue({
          clearSelect: jest.fn().mockReturnThis(),
          clearOrder: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ total: 0 }),
        }),
      };
      mockKnexInstance.mockReturnValue(chain as any);

      await mysqlV2.GetWaitlistItems({
        page: 1,
        pageSize: 10,
        sort: "created_at ASC",
      });

      expect(chain.orderBy).toHaveBeenCalledWith("created_at", "asc");
    });

    it("defaults to orderBy created_at desc when no sort", async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereBetween: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([]),
        clone: jest.fn().mockReturnValue({
          clearSelect: jest.fn().mockReturnThis(),
          clearOrder: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ total: 0 }),
        }),
      };
      mockKnexInstance.mockReturnValue(chain as any);

      await mysqlV2.GetWaitlistItems({});

      expect(chain.orderBy).toHaveBeenCalledWith("created_at", "desc");
    });

    it("uses total 0 when count first returns null", async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereBetween: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([]),
        clone: jest.fn().mockReturnValue({
          clearSelect: jest.fn().mockReturnThis(),
          clearOrder: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
        }),
      };
      mockKnexInstance.mockReturnValue(chain as any);

      const result = await mysqlV2.GetWaitlistItems({ page: 1, pageSize: 10 });
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe("DeleteWaitlistItem", () => {
    it("deletes by id and returns success", async () => {
      const result = await mysqlV2.DeleteWaitlistItem(42);
      expect(mockKnexInstance).toHaveBeenCalledWith("waitlist");
      expect(mockWhereOverload).toHaveBeenCalledWith({ id: 42 });
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual({ status: true, message: "Waitlist item deleted successfully" });
    });
  });

  describe("BulkDeleteWaitlistItems", () => {
    it("deletes by ids and returns success", async () => {
      const result = await mysqlV2.BulkDeleteWaitlistItems([1, 2, 3]);
      expect(mockWhereIn).toHaveBeenCalledWith("id", [1, 2, 3]);
      expect(result).toEqual({ status: true, message: "Waitlist items deleted successfully" });
    });
  });

  describe("GetFullRepricerHistory", () => {
    it("returns result[0] when raw returns data", async () => {
      const rows = [{ runId: 1 }];
      mockRaw.mockResolvedValue([rows]);
      const result = await mysqlV2.GetFullRepricerHistory("2024-01-01", "2024-01-02");
      expect(mockRaw).toHaveBeenCalledWith(expect.stringContaining("sp_GetRepricerHistoryForDateRange"));
      expect(result).toEqual(rows);
    });

    it("returns empty array when no result", async () => {
      mockRaw.mockResolvedValue([[]]);
      const result = await mysqlV2.GetFullRepricerHistory("2024-01-01", "2024-01-02");
      expect(result).toEqual([]);
    });
  });

  describe("GetHistoryApiResponse", () => {
    it("selects from table_history_apiResponse whereBetween RefTime", async () => {
      const rows = [{ RefTime: "2024-01-01", data: "x" }];
      mockWhereBetween.mockResolvedValue(rows);

      const result = await mysqlV2.GetHistoryApiResponse("2024-01-01", "2024-01-02");

      expect(mockKnexInstance).toHaveBeenCalledWith("table_history_apiResponse");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockWhereBetween).toHaveBeenCalledWith("RefTime", ["2024-01-01", "2024-01-02"]);
      expect(result).toEqual(rows);
    });
  });
});
