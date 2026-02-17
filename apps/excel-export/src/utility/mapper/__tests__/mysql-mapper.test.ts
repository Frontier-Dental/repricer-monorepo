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
import { MapProductDetailsList, ToCronSettingsModel } from "../mysql-mapper";

describe("mysql-mapper", () => {
  describe("MapProductDetailsList", () => {
    it("should return empty array for null payload", () => {
      expect(MapProductDetailsList(null)).toEqual([]);
    });

    it("should return empty array for undefined payload", () => {
      expect(MapProductDetailsList(undefined)).toEqual([]);
    });

    it("should return empty array for empty array payload", () => {
      expect(MapProductDetailsList([])).toEqual([]);
    });

    it("should group products by ProductId and map fields", () => {
      const payload = [
        {
          ProductId: 100,
          IsSlowActivated: 1,
          ScrapeOnlyActive: 1,
          LinkedScrapeOnlyCronId: 5,
          LinkedScrapeOnlyCron: "ScrapeCron",
          IsBadgeItem: 1,
          RegularCronId: 10,
          Net32Url: "https://example.com",
          SlowCronId: 2,
          algo_execution_mode: "default",
          ChannelName: "TRADENT",
          Id: 1,
          MpId: 100,
          ChannelId: "ch1",
          UnitPrice: 10,
          FloorPrice: 5,
          MaxPrice: 20,
          IsNCNeeded: 1,
          SuppressPriceBreakForOne: 0,
          RepricingRule: 1,
          SuppressPriceBreak: 0,
          BeatQPrice: 0,
          PercentageIncrease: 5,
          CompareWithQ1: 0,
          CompeteAll: 0,
          BadgeIndicator: "ALL_ZERO",
          BadgePercentage: 10,
          ProductName: "P1",
          RegularCronName: "Cron1",
          RequestInterval: 60,
          RequestIntervalUnit: "min",
          ScrapeOn: 1,
          AllowReprice: 1,
          FocusId: "f1",
          PriorityValue: 1,
          WaitUpdatePeriod: 0,
          AbortDeactivatingQPriceBreak: 0,
          SisterVendorId: "",
          IncludeInactiveVendors: 0,
          InactiveVendorId: "",
          OverrideBulkUpdate: 0,
          OverrideBulkRule: "0",
          LatestPrice: 10,
          ExecutionPriority: 1,
          LastCronRun: "2024-01-01",
          LastExistingPrice: 9,
          LastSuggestedPrice: 10,
          LastUpdatedBy: "u1",
          LastAttemptedTime: "2024-01-01",
          LastCronMessage: "ok",
          LastCronTime: "2024-01-01",
          LowestVendor: "V1",
          LowestVendorPrice: 8,
          NextCronTime: "2024-01-02",
          SlowCronName: "Slow1",
          LastUpdateTime: "2024-01-01",
          ApplyBuyBoxLogic: 0,
          ApplyNcForBuyBox: 0,
          UpdatedBy: "u1",
          UpdatedAt: "2024-01-01",
          HandlingTimeFilter: "FAST",
          KeepPosition: 0,
          ExcludedVendors: "",
          InventoryThreshold: 0,
          PercentageDown: 0,
          BadgePercentageDown: 0,
          CompeteWithNext: 0,
          TriggeredByVendor: "",
          IgnorePhantomBreak: 1,
          OwnVendorThreshold: 1,
          RepriceResult: null,
          GetBBBadgeValue: 0,
          GetBBShippingValue: 0,
          GetBBBadge: 0,
          GetBBShipping: 0,
          QBreakCount: 0,
          QBreakDetails: "",
        },
      ];
      const result = MapProductDetailsList(payload);
      expect(result).toHaveLength(1);
      expect(result[0].mpId).toBe("100");
      expect(result[0].isSlowActivated).toBe(true);
      expect(result[0].isScrapeOnlyActivated).toBe(true);
      expect(result[0].isBadgeItem).toBe(true);
      expect(result[0].scrapeOnlyCronName).toBe("ScrapeCron");
      expect(result[0].scrapeOnlyCronId).toBe(5);
      expect(result[0].tradentDetails).toBeDefined();
      expect(result[0].tradentDetails?.channelName).toBe("TRADENT");
    });

    it("should map boolean fields correctly (IsSlowActivated 0, ScrapeOnlyActive 0, IsBadgeItem 0)", () => {
      const payload = [
        {
          ProductId: 200,
          IsSlowActivated: 0,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          IsBadgeItem: 0,
          RegularCronId: null,
          Net32Url: null,
          SlowCronId: null,
          algo_execution_mode: null,
          ChannelName: "MVP",
          Id: 2,
          MpId: 200,
          ChannelId: "ch2",
          UnitPrice: 15,
          FloorPrice: 10,
          MaxPrice: 25,
          IsNCNeeded: 0,
          SuppressPriceBreakForOne: 1,
          RepricingRule: 2,
          SuppressPriceBreak: 1,
          BeatQPrice: 1,
          PercentageIncrease: 0,
          CompareWithQ1: 1,
          CompeteAll: 1,
          BadgeIndicator: "BADGE_ONLY",
          BadgePercentage: 0,
          ProductName: "P2",
          RegularCronName: "Cron2",
          RequestInterval: 30,
          RequestIntervalUnit: "min",
          ScrapeOn: 0,
          AllowReprice: 0,
          FocusId: "f2",
          PriorityValue: 2,
          WaitUpdatePeriod: 1,
          AbortDeactivatingQPriceBreak: 1,
          SisterVendorId: "",
          IncludeInactiveVendors: 1,
          InactiveVendorId: "",
          OverrideBulkUpdate: 1,
          OverrideBulkRule: "1",
          LatestPrice: 15,
          ExecutionPriority: 2,
          LastCronRun: null,
          LastExistingPrice: 0,
          LastSuggestedPrice: 0,
          LastUpdatedBy: "",
          LastAttemptedTime: null,
          LastCronMessage: "",
          LastCronTime: null,
          LowestVendor: "",
          LowestVendorPrice: 0,
          NextCronTime: null,
          SlowCronName: null,
          LastUpdateTime: null,
          ApplyBuyBoxLogic: 1,
          ApplyNcForBuyBox: 1,
          UpdatedBy: "",
          UpdatedAt: null,
          HandlingTimeFilter: null,
          KeepPosition: 1,
          ExcludedVendors: "",
          InventoryThreshold: 0,
          PercentageDown: 0,
          BadgePercentageDown: 0,
          CompeteWithNext: 1,
          TriggeredByVendor: "",
          IgnorePhantomBreak: 0,
          OwnVendorThreshold: 1,
          RepriceResult: null,
          GetBBBadgeValue: 0,
          GetBBShippingValue: 0,
          GetBBBadge: 1,
          GetBBShipping: 1,
          QBreakCount: 0,
          QBreakDetails: "",
        },
      ];
      const result = MapProductDetailsList(payload);
      expect(result).toHaveLength(1);
      expect(result[0].isSlowActivated).toBe(false);
      expect(result[0].isScrapeOnlyActivated).toBe(false);
      expect(result[0].isBadgeItem).toBe(false);
      expect(result[0].mvpDetails).toBeDefined();
    });

    it("should handle missing vendor details (null link info)", () => {
      const payload = [
        {
          ProductId: 300,
          IsSlowActivated: 0,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          IsBadgeItem: 0,
          RegularCronId: null,
          Net32Url: null,
          SlowCronId: null,
          algo_execution_mode: null,
          ChannelName: "UNKNOWN",
          Id: null,
          MpId: 300,
        },
      ];
      const result = MapProductDetailsList(payload);
      expect(result).toHaveLength(1);
      expect(result[0].tradentDetails).toBeNull();
      expect(result[0].frontierDetails).toBeNull();
    });

    it("should handle duplicate ProductIds by grouping", () => {
      const payload = [
        {
          ProductId: 1,
          IsSlowActivated: 0,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          IsBadgeItem: 0,
          RegularCronId: null,
          Net32Url: null,
          SlowCronId: null,
          algo_execution_mode: null,
          ChannelName: "TRADENT",
          Id: 1,
          MpId: 1,
          ChannelId: "c1",
          UnitPrice: 10,
          FloorPrice: 5,
          MaxPrice: 20,
          IsNCNeeded: 0,
          SuppressPriceBreakForOne: 0,
          RepricingRule: 1,
          SuppressPriceBreak: 0,
          BeatQPrice: 0,
          PercentageIncrease: 0,
          CompareWithQ1: 0,
          CompeteAll: 0,
          BadgeIndicator: "",
          BadgePercentage: 0,
          ProductName: "",
          RegularCronName: "",
          RequestInterval: 0,
          RequestIntervalUnit: "",
          ScrapeOn: 0,
          AllowReprice: 0,
          FocusId: "",
          PriorityValue: 0,
          WaitUpdatePeriod: 0,
          AbortDeactivatingQPriceBreak: 0,
          SisterVendorId: "",
          IncludeInactiveVendors: 0,
          InactiveVendorId: "",
          OverrideBulkUpdate: 0,
          OverrideBulkRule: "",
          LatestPrice: 0,
          ExecutionPriority: 0,
          LastCronRun: null,
          LastExistingPrice: 0,
          LastSuggestedPrice: 0,
          LastUpdatedBy: "",
          LastAttemptedTime: null,
          LastCronMessage: "",
          LastCronTime: null,
          LowestVendor: "",
          LowestVendorPrice: 0,
          NextCronTime: null,
          SlowCronName: null,
          LastUpdateTime: null,
          ApplyBuyBoxLogic: 0,
          ApplyNcForBuyBox: 0,
          UpdatedBy: "",
          UpdatedAt: null,
          HandlingTimeFilter: "",
          KeepPosition: 0,
          ExcludedVendors: "",
          InventoryThreshold: 0,
          PercentageDown: 0,
          BadgePercentageDown: 0,
          CompeteWithNext: 0,
          TriggeredByVendor: "",
          IgnorePhantomBreak: 0,
          OwnVendorThreshold: 0,
          RepriceResult: null,
          GetBBBadgeValue: 0,
          GetBBShippingValue: 0,
          GetBBBadge: 0,
          GetBBShipping: 0,
          QBreakCount: 0,
          QBreakDetails: "",
        },
        {
          ProductId: 1,
          IsSlowActivated: 0,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          IsBadgeItem: 0,
          RegularCronId: null,
          Net32Url: null,
          SlowCronId: null,
          algo_execution_mode: null,
          ChannelName: "FRONTIER",
          Id: 2,
          MpId: 1,
          ChannelId: "c2",
          UnitPrice: 11,
          FloorPrice: 5,
          MaxPrice: 22,
          IsNCNeeded: 0,
          SuppressPriceBreakForOne: 0,
          RepricingRule: 1,
          SuppressPriceBreak: 0,
          BeatQPrice: 0,
          PercentageIncrease: 0,
          CompareWithQ1: 0,
          CompeteAll: 0,
          BadgeIndicator: "",
          BadgePercentage: 0,
          ProductName: "",
          RegularCronName: "",
          RequestInterval: 0,
          RequestIntervalUnit: "",
          ScrapeOn: 0,
          AllowReprice: 0,
          FocusId: "",
          PriorityValue: 0,
          WaitUpdatePeriod: 0,
          AbortDeactivatingQPriceBreak: 0,
          SisterVendorId: "",
          IncludeInactiveVendors: 0,
          InactiveVendorId: "",
          OverrideBulkUpdate: 0,
          OverrideBulkRule: "",
          LatestPrice: 0,
          ExecutionPriority: 0,
          LastCronRun: null,
          LastExistingPrice: 0,
          LastSuggestedPrice: 0,
          LastUpdatedBy: "",
          LastAttemptedTime: null,
          LastCronMessage: "",
          LastCronTime: null,
          LowestVendor: "",
          LowestVendorPrice: 0,
          NextCronTime: null,
          SlowCronName: null,
          LastUpdateTime: null,
          ApplyBuyBoxLogic: 0,
          ApplyNcForBuyBox: 0,
          UpdatedBy: "",
          UpdatedAt: null,
          HandlingTimeFilter: "",
          KeepPosition: 0,
          ExcludedVendors: "",
          InventoryThreshold: 0,
          PercentageDown: 0,
          BadgePercentageDown: 0,
          CompeteWithNext: 0,
          TriggeredByVendor: "",
          IgnorePhantomBreak: 0,
          OwnVendorThreshold: 0,
          RepriceResult: null,
          GetBBBadgeValue: 0,
          GetBBShippingValue: 0,
          GetBBBadge: 0,
          GetBBShipping: 0,
          QBreakCount: 0,
          QBreakDetails: "",
        },
      ];
      const result = MapProductDetailsList(payload);
      expect(result).toHaveLength(1);
      expect(result[0].tradentDetails).toBeDefined();
      expect(result[0].frontierDetails).toBeDefined();
    });
  });

  describe("ToCronSettingsModel", () => {
    it("should return empty array for null", () => {
      expect(ToCronSettingsModel(null)).toEqual([]);
    });

    it("should return empty array for empty array", () => {
      expect(ToCronSettingsModel([])).toEqual([]);
    });

    it("should group by CronId and map cron settings", () => {
      const incomingSqlData = [
        {
          CronId: 1,
          CronName: "Morning",
          CronTimeUnit: "hours",
          CronTime: 8,
          CronStatus: 1,
          Offset: 0,
          ProxyProvider: "p1",
          IpType: "shared",
          FixedIp: null,
          CreatedTime: "2024-01-01",
          SwitchSequence: 1,
          IsHidden: 0,
          UpdatedTime: "2024-01-02",
          CronType: "regular",
          VendorName: "TRADENT",
          SecretKey: "sk1",
          AltProxySequence: 1,
          AltProxyProvider: "ap1",
          UpdatedBy: "admin",
        },
      ];
      const result = ToCronSettingsModel(incomingSqlData);
      expect(result).toHaveLength(1);
      expect(result[0].CronId).toBe(1);
      expect(result[0].CronName).toBe("Morning");
      expect(result[0].CronStatus).toBe(true);
      expect(result[0].IsHidden).toBe(false);
      expect(result[0].SecretKey).toHaveLength(1);
      expect(result[0].SecretKey[0]).toEqual({ vendorName: "TRADENT", secretKey: "sk1" });
      expect(result[0].AlternateProxyProvider).toHaveLength(1);
      expect(result[0].AlternateProxyProvider[0]).toEqual({ Sequence: 1, ProxyProvider: "ap1" });
    });

    it("should map CronStatus 0 to false and IsHidden 1 to true", () => {
      const incomingSqlData = [
        {
          CronId: 2,
          CronName: "Night",
          CronTimeUnit: "min",
          CronTime: 30,
          CronStatus: 0,
          Offset: 10,
          ProxyProvider: "p2",
          IpType: "dedicated",
          FixedIp: "1.2.3.4",
          CreatedTime: "2024-01-01",
          SwitchSequence: 2,
          IsHidden: 1,
          UpdatedTime: "2024-01-02",
          CronType: "slow",
          VendorName: "MVP",
          SecretKey: "sk2",
          AltProxySequence: 2,
          AltProxyProvider: "ap2",
          UpdatedBy: "user",
        },
      ];
      const result = ToCronSettingsModel(incomingSqlData);
      expect(result).toHaveLength(1);
      expect(result[0].CronStatus).toBe(false);
      expect(result[0].IsHidden).toBe(true);
    });
  });
});
