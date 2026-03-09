import * as mapper from "../mysql-mapper";
import AuditInfo from "../../../models/audit-info";
import CustomProduct from "../../../models/user-model/custom-product";
import _ from "lodash";

describe("mysql-mapper", () => {
  describe("MapProductDetailsList", () => {
    it("returns empty array for null payload", () => {
      expect(mapper.MapProductDetailsList(null)).toEqual([]);
    });

    it("returns empty array for undefined payload", () => {
      expect(mapper.MapProductDetailsList(undefined)).toEqual([]);
    });

    it("returns empty array for empty payload", () => {
      expect(mapper.MapProductDetailsList([])).toEqual([]);
    });

    it("returns empty array when groupBy returns null (defensive)", () => {
      const groupBySpy = jest.spyOn(_, "groupBy").mockReturnValue(null as any);
      expect(mapper.MapProductDetailsList([{ ProductId: 1 }])).toEqual([]);
      groupBySpy.mockRestore();
    });

    it("returns empty array when keys of groupedList is empty (defensive)", () => {
      const groupBySpy = jest.spyOn(_, "groupBy").mockReturnValue({});
      expect(mapper.MapProductDetailsList([{ ProductId: 1 }])).toEqual([]);
      groupBySpy.mockRestore();
    });

    it("maps single product with minimal fields and no vendor rows", () => {
      const payload = [
        {
          ProductId: 100,
          IsSlowActivated: 0,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          IsBadgeItem: 0,
          RegularCronId: "c1",
          Net32Url: "https://example.com",
          SlowCronId: "s1",
          algo_execution_mode: "V2_ONLY",
          ChannelName: null,
        },
      ];
      const result = mapper.MapProductDetailsList(payload);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        mpId: "100",
        isSlowActivated: false,
        isScrapeOnlyActivated: false,
        isBadgeItem: false,
        cronId: "c1",
        net32url: "https://example.com",
        slowCronId: "s1",
        algo_execution_mode: "V2_ONLY",
      });
      expect(result[0].tradentLinkInfo).toBeNull();
      expect(result[0].frontierLinkInfo).toBeNull();
      expect(result[0].tradentDetails).toBeNull();
      expect(result[0].frontierDetails).toBeNull();
    });

    it("maps IsSlowActivated and ScrapeOnlyActive and IsBadgeItem as true when 1", () => {
      const payload = [
        {
          ProductId: 200,
          IsSlowActivated: 1,
          ScrapeOnlyActive: 1,
          LinkedScrapeOnlyCronId: "sc1",
          LinkedScrapeOnlyCron: "ScrapeCron",
          IsBadgeItem: 1,
          RegularCronId: "c2",
          Net32Url: null,
          SlowCronId: null,
          algo_execution_mode: null,
          ChannelName: null,
        },
      ];
      const result = mapper.MapProductDetailsList(payload);
      expect(result[0].isSlowActivated).toBe(true);
      expect(result[0].isScrapeOnlyActivated).toBe(true);
      expect(result[0].scrapeOnlyCronId).toBe("sc1");
      expect(result[0].scrapeOnlyCronName).toBe("ScrapeCron");
      expect(result[0].isBadgeItem).toBe(true);
    });

    it("maps vendor link info and details when channel row present (TRADENT)", () => {
      const payload = [
        {
          ProductId: 300,
          IsSlowActivated: 0,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          IsBadgeItem: 0,
          RegularCronId: "c3",
          Net32Url: null,
          SlowCronId: null,
          algo_execution_mode: null,
          ChannelName: "TRADENT",
          Id: 999,
          Activated: 1,
          MpId: "300",
          ChannelId: "ch1",
          UnitPrice: 10,
          FloorPrice: 8,
          MaxPrice: 20,
        },
      ];
      const result = mapper.MapProductDetailsList(payload);
      expect(result[0].tradentLinkInfo).toBe(999);
      expect(result[0].tradentDetails).toBeInstanceOf(CustomProduct);
      expect(result[0].tradentDetails?.channelName).toBe("TRADENT");
    });

    it("maps multiple products and multiple vendor channels", () => {
      const payload = [
        { ProductId: 1, IsSlowActivated: 0, ScrapeOnlyActive: 0, LinkedScrapeOnlyCronId: null, LinkedScrapeOnlyCron: null, IsBadgeItem: 0, RegularCronId: "c1", Net32Url: null, SlowCronId: null, algo_execution_mode: null, ChannelName: "FRONTIER", Id: 11 },
        { ProductId: 1, IsSlowActivated: 0, ScrapeOnlyActive: 0, LinkedScrapeOnlyCronId: null, LinkedScrapeOnlyCron: null, IsBadgeItem: 0, RegularCronId: "c1", Net32Url: null, SlowCronId: null, algo_execution_mode: null, ChannelName: "MVP", Id: 22 },
        { ProductId: 2, IsSlowActivated: 1, ScrapeOnlyActive: 0, LinkedScrapeOnlyCronId: null, LinkedScrapeOnlyCron: null, IsBadgeItem: 0, RegularCronId: "c2", Net32Url: null, SlowCronId: null, algo_execution_mode: null, ChannelName: null },
      ];
      const result = mapper.MapProductDetailsList(payload);
      expect(result).toHaveLength(2);
      expect(result[0].mpId).toBe("1");
      expect(result[0].frontierLinkInfo).toBe(11);
      expect(result[0].mvpLinkInfo).toBe(22);
      expect(result[1].mpId).toBe("2");
      expect(result[1].isSlowActivated).toBe(true);
    });
  });

  describe("ToIpConfigModelList", () => {
    it("returns empty array for null", () => {
      expect(mapper.ToIpConfigModelList(null)).toEqual([]);
    });

    it("returns empty array for empty array", () => {
      expect(mapper.ToIpConfigModelList([])).toEqual([]);
    });

    it("maps one item with Active=1 and IsDummy=1", () => {
      const sql = [
        {
          ProxyProvider: 1,
          ProxyProviderName: "Provider1",
          UserName: "u",
          Password: "p",
          HostUrl: "http://host",
          Port: 8080,
          IpTypeName: "Residential",
          IpType: 1,
          Method: "GET",
          Active: 1,
          ProxyPriority: 1,
          IsDummy: 1,
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-01-01"),
        },
      ];
      const result = mapper.ToIpConfigModelList(sql) as any[];
      expect(result).toHaveLength(1);
      expect(result[0].active).toBe(true);
      expect(result[0].isDummy).toBe(true);
      expect(result[0].AuditInfo).toEqual({ UpdatedBy: "admin", UpdatedOn: new Date("2024-01-01") });
    });

    it("maps Active=0 and IsDummy=0 as false", () => {
      const sql = [{ Active: 0, IsDummy: 0, ProxyProvider: 0, ProxyProviderName: "", UserName: "", Password: "", HostUrl: "", Port: 0, IpTypeName: "", IpType: 0, Method: "", ProxyPriority: 0, UpdatedBy: "", UpdatedOn: new Date() }];
      const result = mapper.ToIpConfigModelList(sql) as any[];
      expect(result[0].active).toBe(false);
      expect(result[0].isDummy).toBe(false);
    });

    it("maps multiple items", () => {
      const sql = [
        { ProxyProvider: 1, ProxyProviderName: "A", UserName: "u1", Password: "p1", HostUrl: "h1", Port: 80, IpTypeName: "t1", IpType: 1, Method: "M", Active: 1, ProxyPriority: 1, IsDummy: 0, UpdatedBy: "x", UpdatedOn: new Date() },
        { ProxyProvider: 2, ProxyProviderName: "B", UserName: "u2", Password: "p2", HostUrl: "h2", Port: 443, IpTypeName: "t2", IpType: 2, Method: "M", Active: 0, ProxyPriority: 2, IsDummy: 1, UpdatedBy: "y", UpdatedOn: new Date() },
      ];
      const result = mapper.ToIpConfigModelList(sql) as any[];
      expect(result).toHaveLength(2);
      expect(result[0].proxyProviderName).toBe("A");
      expect(result[1].proxyProviderName).toBe("B");
    });
  });

  describe("ToEnvSettingsModel", () => {
    it("returns null for null input", () => {
      expect(mapper.ToEnvSettingsModel(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(mapper.ToEnvSettingsModel(undefined)).toBeNull();
    });

    it("maps single row with OverrideAll=1 and OverridePriority=1", () => {
      const sql = [
        {
          Delay: 5,
          Source: "db",
          OverrideAll: 1,
          FrontierApiKey: "fk",
          DevIntegrationKey: "dk",
          ExpressCronBatchSize: 10,
          ExpressCronOverlapThreshold: 2,
          ExpressCronInstanceLimit: 3,
          SlowCronBatchSize: 20,
          SlowCronInstanceLimit: 4,
          UpdatedBy: "user",
          UpdatedOn: new Date("2024-01-01"),
          OverridePriority: 1,
          EntityName: "TRADENT",
          Priority: 5,
        },
      ];
      const result = mapper.ToEnvSettingsModel(sql);
      expect(result).not.toBeNull();
      expect(result!.delay).toBe(5);
      expect(result!.source).toBe("db");
      expect(result!.override_all).toBe("true");
      expect(result!.override_execution_priority_details.override_priority).toBe("true");
      expect(result!.override_execution_priority_details.priority_settings.tradent_priority).toBe("5");
    });

    it("maps OverrideAll=0 and OverridePriority=0 as false", () => {
      const sql = [
        {
          Delay: 0,
          Source: "",
          OverrideAll: 0,
          FrontierApiKey: "",
          DevIntegrationKey: "",
          ExpressCronBatchSize: 0,
          ExpressCronOverlapThreshold: 0,
          ExpressCronInstanceLimit: 0,
          SlowCronBatchSize: 0,
          SlowCronInstanceLimit: 0,
          UpdatedBy: "",
          UpdatedOn: new Date(),
          OverridePriority: 0,
          EntityName: "FRONTIER",
          Priority: 1,
        },
      ];
      const result = mapper.ToEnvSettingsModel(sql);
      expect(result!.override_all).toBe("false");
      expect(result!.override_execution_priority_details.override_priority).toBe("false");
      expect(result!.override_execution_priority_details.priority_settings.frontier_priority).toBe("1");
    });

    it("getPriority returns null when entity not found for vendor", () => {
      const sql = [
        {
          Delay: 0,
          Source: "",
          OverrideAll: 0,
          FrontierApiKey: "",
          DevIntegrationKey: "",
          ExpressCronBatchSize: 0,
          ExpressCronOverlapThreshold: 0,
          ExpressCronInstanceLimit: 0,
          SlowCronBatchSize: 0,
          SlowCronInstanceLimit: 0,
          UpdatedBy: "",
          UpdatedOn: new Date(),
          OverridePriority: 0,
          EntityName: "UNKNOWN",
          Priority: 0,
        },
      ];
      const result = mapper.ToEnvSettingsModel(sql);
      expect(result!.override_execution_priority_details.priority_settings.tradent_priority).toBeNull();
    });
  });

  describe("mapCronSettingToEntity", () => {
    it("maps full cron setting and auditInfo to CronSettingsDto", () => {
      const auditInfo = { UpdatedBy: "admin", UpdatedOn: new Date("2024-01-15") } as AuditInfo;
      const cronSetting = {
        CronId: "c1",
        CronName: "Main",
        CronTimeUnit: "min",
        CronTime: "30",
        ProxyProvider: "1",
        IpType: "2",
        Offset: "5",
        FixedIp: null,
        SwitchSequence: "0",
        IsHidden: false,
        CronType: "DEFAULT",
        CronStatus: true,
      };
      const result = mapper.mapCronSettingToEntity(cronSetting, auditInfo);
      expect(result.CronId).toBe("c1");
      expect(result.CronName).toBe("Main");
      expect(result.CronTimeUnit).toBe("min");
      expect(result.CronTime).toBe(30);
      expect(result.ProxyProvider).toBe(1);
      expect(result.IpType).toBe(2);
      expect(result.Offset).toBe(5);
      expect(result.SwitchSequence).toBe(0);
      expect(result.UpdatedBy).toBe("admin");
      expect(result.UpdatedTime).toEqual(new Date("2024-01-15"));
    });

    it("uses 0 for missing optional numeric fields", () => {
      const auditInfo = { UpdatedBy: "u", UpdatedOn: new Date() } as AuditInfo;
      const cronSetting = {
        CronId: "c2",
        CronName: "Other",
        CronTimeUnit: "hour",
        CronTime: null,
        ProxyProvider: null,
        IpType: null,
        Offset: null,
        FixedIp: "1.2.3.4",
        SwitchSequence: null,
        IsHidden: true,
        CronType: "SLOW",
        CronStatus: false,
      };
      const result = mapper.mapCronSettingToEntity(cronSetting, auditInfo);
      expect(result.CronTime).toBe(0);
      expect(result.ProxyProvider).toBe(0);
      expect(result.IpType).toBe(0);
      expect(result.Offset).toBe(0);
      expect(result.SwitchSequence).toBe(0);
      expect(result.IsHidden).toBe(true);
      expect(result.CronStatus).toBe(false);
    });
  });

  describe("mapCronSettingSecretKeysToEntity", () => {
    it("returns empty array when SecretKey is missing", () => {
      expect(mapper.mapCronSettingSecretKeysToEntity({ CronId: "c1" })).toEqual([]);
    });

    it("returns empty array when SecretKey is empty array", () => {
      expect(mapper.mapCronSettingSecretKeysToEntity({ CronId: "c1", SecretKey: [] })).toEqual([]);
    });

    it("maps SecretKey array to SecretKeyDto list", () => {
      const cronSetting = {
        CronId: "c1",
        SecretKey: [
          { vendorName: "TRADENT", secretKey: "sk1" },
          { vendorName: "FRONTIER", secretKey: "sk2" },
        ],
      };
      const result = mapper.mapCronSettingSecretKeysToEntity(cronSetting);
      expect(result).toHaveLength(2);
      expect(result[0].CronId).toBe("c1");
      expect(result[0].VendorName).toBe("TRADENT");
      expect(result[0].SecretKey).toBe("sk1");
      expect(result[1].VendorName).toBe("FRONTIER");
      expect(result[1].SecretKey).toBe("sk2");
    });
  });

  describe("mapAlternateProxyProvidersToEntity", () => {
    it("returns empty array when AlternateProxyProvider is missing", () => {
      expect(mapper.mapAlternateProxyProvidersToEntity({ CronId: "c1" })).toEqual([]);
    });

    it("returns empty array when AlternateProxyProvider is empty", () => {
      expect(mapper.mapAlternateProxyProvidersToEntity({ CronId: "c1", AlternateProxyProvider: [] })).toEqual([]);
    });

    it("maps AlternateProxyProvider with parsed Sequence and ProxyProvider", () => {
      const cronSetting = {
        CronId: "c1",
        AlternateProxyProvider: [
          { Sequence: "1", ProxyProvider: "10" },
          { Sequence: "2", ProxyProvider: "20" },
        ],
      };
      const result = mapper.mapAlternateProxyProvidersToEntity(cronSetting);
      expect(result).toHaveLength(2);
      expect(result[0].CronId).toBe("c1");
      expect(result[0].Sequence).toBe(1);
      expect(result[0].ProxyProvider).toBe(10);
      expect(result[1].Sequence).toBe(2);
      expect(result[1].ProxyProvider).toBe(20);
    });

    it("uses 0 when Sequence or ProxyProvider missing", () => {
      const cronSetting = {
        CronId: "c1",
        AlternateProxyProvider: [{ Sequence: null, ProxyProvider: null }],
      };
      const result = mapper.mapAlternateProxyProvidersToEntity(cronSetting);
      expect(result[0].Sequence).toBe(0);
      expect(result[0].ProxyProvider).toBe(0);
    });
  });

  describe("ToCronSettingsModel", () => {
    it("returns empty array for null", () => {
      expect(mapper.ToCronSettingsModel(null)).toEqual([]);
    });

    it("returns empty array for empty array", () => {
      expect(mapper.ToCronSettingsModel([])).toEqual([]);
    });

    it("returns empty array when groupBy returns null (defensive)", () => {
      const groupBySpy = jest.spyOn(_, "groupBy").mockReturnValue(null as any);
      expect(mapper.ToCronSettingsModel([{ CronId: 1 }])).toEqual([]);
      groupBySpy.mockRestore();
    });

    it("maps one cron with secret keys and alternate proxy providers", () => {
      const sql = [
        {
          CronId: 1,
          CronName: "Cron1",
          CronTimeUnit: "min",
          CronTime: 15,
          CronStatus: 1,
          Offset: 0,
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: null,
          CreatedTime: new Date("2024-01-01"),
          SwitchSequence: 0,
          IsHidden: 0,
          UpdatedTime: new Date("2024-01-02"),
          CronType: "DEFAULT",
          UpdatedBy: "admin",
          VendorName: "TRADENT",
          SecretKey: "secret1",
          AltProxySequence: 1,
          AltProxyProvider: 10,
        },
        {
          CronId: 1,
          CronName: "Cron1",
          CronTimeUnit: "min",
          CronTime: 15,
          CronStatus: 1,
          Offset: 0,
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: null,
          CreatedTime: new Date("2024-01-01"),
          SwitchSequence: 0,
          IsHidden: 0,
          UpdatedTime: new Date("2024-01-02"),
          CronType: "DEFAULT",
          UpdatedBy: "admin",
          VendorName: "FRONTIER",
          SecretKey: "secret2",
          AltProxySequence: 2,
          AltProxyProvider: 20,
        },
      ];
      const result = mapper.ToCronSettingsModel(sql);
      expect(result).toHaveLength(1);
      expect(result[0].CronId).toBe(1);
      expect(result[0].CronName).toBe("Cron1");
      expect(result[0].CronStatus).toBe(true);
      expect(result[0].IsHidden).toBe(false);
      expect(result[0].SecretKey).toHaveLength(2);
      expect(result[0].SecretKey).toContainEqual({ vendorName: "TRADENT", secretKey: "secret1" });
      expect(result[0].SecretKey).toContainEqual({ vendorName: "FRONTIER", secretKey: "secret2" });
      expect(result[0].AlternateProxyProvider).toHaveLength(2);
      expect(result[0].AlternateProxyProvider).toContainEqual({ Sequence: 1, ProxyProvider: 10 });
      expect(result[0].AlternateProxyProvider).toContainEqual({ Sequence: 2, ProxyProvider: 20 });
      expect(result[0].AuditInfo).toEqual({ UpdatedBy: "admin", UpdatedOn: new Date("2024-01-02") });
    });

    it("maps cron with CronStatus=0 and IsHidden=1", () => {
      const sql = [
        {
          CronId: 2,
          CronName: "HiddenCron",
          CronTimeUnit: "hour",
          CronTime: 1,
          CronStatus: 0,
          Offset: 0,
          ProxyProvider: 0,
          IpType: 0,
          FixedIp: null,
          CreatedTime: new Date(),
          SwitchSequence: 0,
          IsHidden: 1,
          UpdatedTime: new Date(),
          CronType: "SLOW",
          UpdatedBy: "system",
          VendorName: "TRADENT",
          SecretKey: "s",
          AltProxySequence: 1,
          AltProxyProvider: 1,
        },
      ];
      const result = mapper.ToCronSettingsModel(sql);
      expect(result[0].CronStatus).toBe(false);
      expect(result[0].IsHidden).toBe(true);
    });

    it("toSecretKeysForCron returns null when groupBy returns null", () => {
      const sqlOneCron = [{ CronId: 1, CronName: "C", CronTimeUnit: "min", CronTime: 1, CronStatus: 1, Offset: 0, ProxyProvider: 1, IpType: 0, FixedIp: null, CreatedTime: new Date(), SwitchSequence: 0, IsHidden: 0, UpdatedTime: new Date(), CronType: "D", UpdatedBy: "u", VendorName: "TRADENT", SecretKey: "s", AltProxySequence: 1, AltProxyProvider: 1 }];
      const realGroupBy = _.groupBy;
      const groupBySpy = jest.spyOn(_, "groupBy").mockImplementation((...args: any[]) => {
        const [arr, keyFn] = args;
        if (typeof keyFn === "function" && keyFn.toString().includes("VendorName")) return null as any;
        return realGroupBy(arr, keyFn);
      });
      const result = mapper.ToCronSettingsModel([sqlOneCron[0]]);
      expect(result[0].SecretKey).toBeNull();
      groupBySpy.mockRestore();
    });

    it("toAlternateProxyProvidersForCron returns null when groupBy returns null", () => {
      const sqlOneCron = [{ CronId: 1, CronName: "C", CronTimeUnit: "min", CronTime: 1, CronStatus: 1, Offset: 0, ProxyProvider: 1, IpType: 0, FixedIp: null, CreatedTime: new Date(), SwitchSequence: 0, IsHidden: 0, UpdatedTime: new Date(), CronType: "D", UpdatedBy: "u", VendorName: "TRADENT", SecretKey: "s", AltProxySequence: 1, AltProxyProvider: 1 }];
      const realGroupBy = _.groupBy;
      const groupBySpy = jest.spyOn(_, "groupBy").mockImplementation((...args: any[]) => {
        const [arr, keyFn] = args;
        if (typeof keyFn === "function" && keyFn.toString().includes("AltProxySequence")) return null as any;
        return realGroupBy(arr, keyFn);
      });
      const result = mapper.ToCronSettingsModel([sqlOneCron[0]]);
      expect(result[0].AlternateProxyProvider).toBeNull();
      groupBySpy.mockRestore();
    });
  });

  describe("MapWithAuditInfo", () => {
    it("returns empty array for null input", () => {
      expect(mapper.MapWithAuditInfo(null)).toEqual([]);
    });

    it("maps rows moving updatedBy/updatedTime into AuditInfo (lowercase)", () => {
      const sql = [
        { id: 1, name: "A", updatedBy: "user1", updatedTime: new Date("2024-01-01") },
        { id: 2, name: "B", updatedBy: "user2", updatedTime: new Date("2024-01-02") },
      ];
      const result = mapper.MapWithAuditInfo(sql);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        name: "A",
        AuditInfo: { UpdatedBy: "user1", UpdatedOn: new Date("2024-01-01") },
      });
      expect(result[0]).not.toHaveProperty("updatedBy");
      expect(result[0]).not.toHaveProperty("updatedTime");
      expect(result[1].AuditInfo).toEqual({ UpdatedBy: "user2", UpdatedOn: new Date("2024-01-02") });
    });

    it("handles single row", () => {
      const sql = [{ foo: "bar", updatedBy: "u", updatedTime: new Date() }];
      const result = mapper.MapWithAuditInfo(sql);
      expect(result).toHaveLength(1);
      expect(result[0].foo).toBe("bar");
      expect(result[0].AuditInfo.UpdatedBy).toBe("u");
    });
  });
});
