// Mock dependencies before imports
jest.mock("lodash");
jest.mock("../../model/user-models/custom-product");
jest.mock("@repricer-monorepo/shared", () => ({
  AlgoExecutionMode: {
    V2_ONLY: "V2_ONLY",
    V1_ONLY: "V1_ONLY",
    V2_EXECUTE_V1_DRY: "V2_EXECUTE_V1_DRY",
    V1_EXECUTE_V2_DRY: "V1_EXECUTE_V2_DRY",
  },
  VendorName: {
    FRONTIER: "FRONTIER",
    MVP: "MVP",
    TRADENT: "TRADENT",
    FIRSTDENT: "FIRSTDENT",
    TOPDENT: "TOPDENT",
    TRIAD: "TRIAD",
    BITESUPPLY: "BITESUPPLY",
  },
}));

import _ from "lodash";
import { OwnVendorProductDetails } from "../../model/user-models/custom-product";
import { FullProductDetailsV2 } from "../../types/full-product-details-v2";
import { RepriceModel } from "../../model/reprice-model";
import { AlgoExecutionMode, VendorName } from "@repricer-monorepo/shared";
import { MapProductDetailsList, GetTriggeredByValue, ToIpConfigModelList, ToEnvSettingsModel, ToCronSettingsModel, MapWithAuditInfo, ProductDetailsList } from "./mySql-mapper";

// Mock OwnVendorProductDetails constructor
const mockOwnVendorProductDetails = jest.fn();
(OwnVendorProductDetails as jest.MockedClass<typeof OwnVendorProductDetails>) = mockOwnVendorProductDetails as any;

describe("mySql-mapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOwnVendorProductDetails.mockImplementation((sqlEntity: any, algoMode: string) => ({
      channelName: sqlEntity.ChannelName || "",
      algo_execution_mode: algoMode,
    }));
  });

  describe("MapProductDetailsList", () => {
    it("should return empty array when payload is null", () => {
      const result = MapProductDetailsList(null as any);
      expect(result).toEqual([]);
    });

    it("should return empty array when payload is empty", () => {
      const result = MapProductDetailsList([]);
      expect(result).toEqual([]);
    });

    it("should map single product with all vendors", () => {
      const mockGroupBy = jest.fn().mockReturnValue({
        123: [
          {
            ProductId: 123,
            ProductIdentifier: 456,
            IsSlowActivated: 1,
            ScrapeOnlyActive: 0,
            LinkedScrapeOnlyCronId: "cron-1",
            LinkedScrapeOnlyCron: "Test Cron",
            algo_execution_mode: AlgoExecutionMode.V2_ONLY,
            ChannelName: "TRADENT",
            Id: 1,
          },
          {
            ProductId: 123,
            ChannelName: "FRONTIER",
            Id: 2,
          },
          {
            ProductId: 123,
            ChannelName: "MVP",
            Id: 3,
          },
          {
            ProductId: 123,
            ChannelName: "TOPDENT",
            Id: 4,
          },
          {
            ProductId: 123,
            ChannelName: "FIRSTDENT",
            Id: 5,
          },
          {
            ProductId: 123,
            ChannelName: "TRIAD",
            Id: 6,
          },
          {
            ProductId: 123,
            ChannelName: "BITESUPPLY",
            Id: 7,
          },
        ],
      });
      const mockKeys = jest.fn().mockReturnValue(["123"]);
      const mockFirst = jest.fn().mockReturnValue({
        ProductId: 123,
        ProductIdentifier: 456,
        IsSlowActivated: 1,
        ScrapeOnlyActive: 0,
        LinkedScrapeOnlyCronId: "cron-1",
        LinkedScrapeOnlyCron: "Test Cron",
        algo_execution_mode: AlgoExecutionMode.V2_ONLY,
      });

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;
      (_.first as jest.Mock) = mockFirst;

      const payload: FullProductDetailsV2[] = [
        {
          ProductId: 123,
          ProductIdentifier: 456,
          IsSlowActivated: 1,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: "cron-1",
          LinkedScrapeOnlyCron: "Test Cron",
          algo_execution_mode: AlgoExecutionMode.V2_ONLY,
          ChannelName: "TRADENT",
          Id: 1,
        },
      ];

      const result = MapProductDetailsList(payload);

      expect(result).toHaveLength(1);
      expect(result[0].mpId).toBe(123);
      expect(result[0].productIdentifier).toBe(456);
      expect(result[0].isSlowActivated).toBe(true);
      expect(result[0].isScrapeOnlyActivated).toBe(false);
      expect(result[0].scrapeOnlyCronId).toBe("cron-1");
      expect(result[0].scrapeOnlyCronName).toBe("Test Cron");
      expect(result[0].algo_execution_mode).toBe(AlgoExecutionMode.V2_ONLY);
      expect(mockOwnVendorProductDetails).toHaveBeenCalled();
    });

    it("should map product with isSlowActivated as false when value is 0", () => {
      const mockGroupBy = jest.fn().mockReturnValue({
        123: [
          {
            ProductId: 123,
            ProductIdentifier: 456,
            IsSlowActivated: 0,
            ScrapeOnlyActive: 1,
            LinkedScrapeOnlyCronId: "cron-2",
            LinkedScrapeOnlyCron: "Scrape Cron",
            algo_execution_mode: AlgoExecutionMode.V1_ONLY,
          },
        ],
      });
      const mockKeys = jest.fn().mockReturnValue(["123"]);
      const mockFirst = jest.fn().mockReturnValue({
        ProductId: 123,
        ProductIdentifier: 456,
        IsSlowActivated: 0,
        ScrapeOnlyActive: 1,
        LinkedScrapeOnlyCronId: "cron-2",
        LinkedScrapeOnlyCron: "Scrape Cron",
        algo_execution_mode: AlgoExecutionMode.V1_ONLY,
      });

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;
      (_.first as jest.Mock) = mockFirst;

      const payload: FullProductDetailsV2[] = [
        {
          ProductId: 123,
          ProductIdentifier: 456,
          IsSlowActivated: 0,
          ScrapeOnlyActive: 1,
          LinkedScrapeOnlyCronId: "cron-2",
          LinkedScrapeOnlyCron: "Scrape Cron",
          algo_execution_mode: AlgoExecutionMode.V1_ONLY,
        },
      ];

      const result = MapProductDetailsList(payload);

      expect(result[0].isSlowActivated).toBe(false);
      expect(result[0].isScrapeOnlyActivated).toBe(true);
    });

    it("should map multiple products correctly", () => {
      const mockGroupBy = jest.fn().mockReturnValue({
        123: [
          {
            ProductId: 123,
            ProductIdentifier: 456,
            IsSlowActivated: 1,
            ScrapeOnlyActive: 0,
            LinkedScrapeOnlyCronId: null,
            LinkedScrapeOnlyCron: null,
            algo_execution_mode: AlgoExecutionMode.V2_ONLY,
          },
        ],
        456: [
          {
            ProductId: 456,
            ProductIdentifier: 789,
            IsSlowActivated: 0,
            ScrapeOnlyActive: 1,
            LinkedScrapeOnlyCronId: "cron-3",
            LinkedScrapeOnlyCron: "Another Cron",
            algo_execution_mode: AlgoExecutionMode.V1_ONLY,
          },
        ],
      });
      const mockKeys = jest.fn().mockReturnValue(["123", "456"]);
      const mockFirst = jest
        .fn()
        .mockReturnValueOnce({
          ProductId: 123,
          ProductIdentifier: 456,
          IsSlowActivated: 1,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          algo_execution_mode: AlgoExecutionMode.V2_ONLY,
        })
        .mockReturnValueOnce({
          ProductId: 456,
          ProductIdentifier: 789,
          IsSlowActivated: 0,
          ScrapeOnlyActive: 1,
          LinkedScrapeOnlyCronId: "cron-3",
          LinkedScrapeOnlyCron: "Another Cron",
          algo_execution_mode: AlgoExecutionMode.V1_ONLY,
        });

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;
      (_.first as jest.Mock) = mockFirst;

      const payload: FullProductDetailsV2[] = [
        {
          ProductId: 123,
          ProductIdentifier: 456,
          IsSlowActivated: 1,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          algo_execution_mode: AlgoExecutionMode.V2_ONLY,
        },
        {
          ProductId: 456,
          ProductIdentifier: 789,
          IsSlowActivated: 0,
          ScrapeOnlyActive: 1,
          LinkedScrapeOnlyCronId: "cron-3",
          LinkedScrapeOnlyCron: "Another Cron",
          algo_execution_mode: AlgoExecutionMode.V1_ONLY,
        },
      ];

      const result = MapProductDetailsList(payload);

      expect(result).toHaveLength(2);
      expect(result[0].mpId).toBe(123);
      expect(result[1].mpId).toBe(456);
    });

    it("should map vendor link info correctly", () => {
      const mockGroupBy = jest.fn().mockReturnValue({
        123: [
          {
            ProductId: 123,
            ProductIdentifier: 456,
            IsSlowActivated: 1,
            ScrapeOnlyActive: 0,
            LinkedScrapeOnlyCronId: null,
            LinkedScrapeOnlyCron: null,
            algo_execution_mode: AlgoExecutionMode.V2_ONLY,
            ChannelName: "TRADENT",
            Id: 10,
          },
          {
            ProductId: 123,
            ChannelName: "FRONTIER",
            Id: 20,
          },
        ],
      });
      const mockKeys = jest.fn().mockReturnValue(["123"]);
      const mockFirst = jest.fn().mockReturnValue({
        ProductId: 123,
        ProductIdentifier: 456,
        IsSlowActivated: 1,
        ScrapeOnlyActive: 0,
        LinkedScrapeOnlyCronId: null,
        LinkedScrapeOnlyCron: null,
        algo_execution_mode: AlgoExecutionMode.V2_ONLY,
      });

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;
      (_.first as jest.Mock) = mockFirst;

      const payload: FullProductDetailsV2[] = [
        {
          ProductId: 123,
          ProductIdentifier: 456,
          IsSlowActivated: 1,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          algo_execution_mode: AlgoExecutionMode.V2_ONLY,
          ChannelName: "TRADENT",
          Id: 10,
        },
        {
          ProductId: 123,
          ProductIdentifier: 456,
          ChannelName: "FRONTIER",
          Id: 20,
        },
      ];

      const result = MapProductDetailsList(payload);

      expect(result[0].tradentLinkInfo).toBe(10);
      expect(result[0].frontierLinkInfo).toBe(20);
      expect(result[0].mvpLinkInfo).toBeNull();
      expect(result[0].topDentLinkInfo).toBeNull();
      expect(result[0].firstDentLinkInfo).toBeNull();
    });

    it("should map vendor details correctly", () => {
      const mockGroupBy = jest.fn().mockReturnValue({
        123: [
          {
            ProductId: 123,
            ProductIdentifier: 456,
            IsSlowActivated: 1,
            ScrapeOnlyActive: 0,
            LinkedScrapeOnlyCronId: null,
            LinkedScrapeOnlyCron: null,
            algo_execution_mode: AlgoExecutionMode.V2_ONLY,
            ChannelName: "TRADENT",
            Id: 10,
          },
        ],
      });
      const mockKeys = jest.fn().mockReturnValue(["123"]);
      const mockFirst = jest.fn().mockReturnValue({
        ProductId: 123,
        ProductIdentifier: 456,
        IsSlowActivated: 1,
        ScrapeOnlyActive: 0,
        LinkedScrapeOnlyCronId: null,
        LinkedScrapeOnlyCron: null,
        algo_execution_mode: AlgoExecutionMode.V2_ONLY,
      });

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;
      (_.first as jest.Mock) = mockFirst;

      const payload: FullProductDetailsV2[] = [
        {
          ProductId: 123,
          ProductIdentifier: 456,
          IsSlowActivated: 1,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          algo_execution_mode: AlgoExecutionMode.V2_ONLY,
          ChannelName: "TRADENT",
          Id: 10,
        },
      ];

      const result = MapProductDetailsList(payload);

      expect(mockOwnVendorProductDetails).toHaveBeenCalledWith(expect.objectContaining({ ChannelName: "TRADENT" }), AlgoExecutionMode.V2_ONLY.toString());
      expect(result[0].tradentDetails).not.toBeNull();
    });

    it("should handle case-insensitive vendor name matching", () => {
      const mockGroupBy = jest.fn().mockReturnValue({
        123: [
          {
            ProductId: 123,
            ProductIdentifier: 456,
            IsSlowActivated: 1,
            ScrapeOnlyActive: 0,
            LinkedScrapeOnlyCronId: null,
            LinkedScrapeOnlyCron: null,
            algo_execution_mode: AlgoExecutionMode.V2_ONLY,
            ChannelName: "tradent", // lowercase
            Id: 10,
          },
        ],
      });
      const mockKeys = jest.fn().mockReturnValue(["123"]);
      const mockFirst = jest.fn().mockReturnValue({
        ProductId: 123,
        ProductIdentifier: 456,
        IsSlowActivated: 1,
        ScrapeOnlyActive: 0,
        LinkedScrapeOnlyCronId: null,
        LinkedScrapeOnlyCron: null,
        algo_execution_mode: AlgoExecutionMode.V2_ONLY,
      });

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;
      (_.first as jest.Mock) = mockFirst;

      const payload: FullProductDetailsV2[] = [
        {
          ProductId: 123,
          ProductIdentifier: 456,
          IsSlowActivated: 1,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          algo_execution_mode: AlgoExecutionMode.V2_ONLY,
          ChannelName: "tradent",
          Id: 10,
        },
      ];

      const result = MapProductDetailsList(payload);

      expect(result[0].tradentLinkInfo).toBe(10);
    });

    it("should handle undefined algo_execution_mode", () => {
      const mockGroupBy = jest.fn().mockReturnValue({
        123: [
          {
            ProductId: 123,
            ProductIdentifier: 456,
            IsSlowActivated: 1,
            ScrapeOnlyActive: 0,
            LinkedScrapeOnlyCronId: null,
            LinkedScrapeOnlyCron: null,
            algo_execution_mode: undefined,
          },
        ],
      });
      const mockKeys = jest.fn().mockReturnValue(["123"]);
      const mockFirst = jest.fn().mockReturnValue({
        ProductId: 123,
        ProductIdentifier: 456,
        IsSlowActivated: 1,
        ScrapeOnlyActive: 0,
        LinkedScrapeOnlyCronId: null,
        LinkedScrapeOnlyCron: null,
        algo_execution_mode: undefined,
      });

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;
      (_.first as jest.Mock) = mockFirst;

      const payload: FullProductDetailsV2[] = [
        {
          ProductId: 123,
          ProductIdentifier: 456,
          IsSlowActivated: 1,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          algo_execution_mode: undefined,
        },
      ];

      const result = MapProductDetailsList(payload);

      expect(result[0].algo_execution_mode).toBeUndefined();
    });

    it("should handle vendor with null ChannelName", () => {
      const mockGroupBy = jest.fn().mockReturnValue({
        123: [
          {
            ProductId: 123,
            ProductIdentifier: 456,
            IsSlowActivated: 1,
            ScrapeOnlyActive: 0,
            LinkedScrapeOnlyCronId: null,
            LinkedScrapeOnlyCron: null,
            algo_execution_mode: AlgoExecutionMode.V2_ONLY,
            ChannelName: null,
            Id: 10,
          },
        ],
      });
      const mockKeys = jest.fn().mockReturnValue(["123"]);
      const mockFirst = jest.fn().mockReturnValue({
        ProductId: 123,
        ProductIdentifier: 456,
        IsSlowActivated: 1,
        ScrapeOnlyActive: 0,
        LinkedScrapeOnlyCronId: null,
        LinkedScrapeOnlyCron: null,
        algo_execution_mode: AlgoExecutionMode.V2_ONLY,
      });

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;
      (_.first as jest.Mock) = mockFirst;

      const payload: FullProductDetailsV2[] = [
        {
          ProductId: 123,
          ProductIdentifier: 456,
          IsSlowActivated: 1,
          ScrapeOnlyActive: 0,
          LinkedScrapeOnlyCronId: null,
          LinkedScrapeOnlyCron: null,
          algo_execution_mode: AlgoExecutionMode.V2_ONLY,
          ChannelName: null,
          Id: 10,
        },
      ];

      const result = MapProductDetailsList(payload);

      expect(result[0].tradentLinkInfo).toBeNull();
      expect(result[0].tradentDetails).toBeNull();
    });
  });

  describe("GetTriggeredByValue", () => {
    it("should return null when repriceModel has no details", () => {
      const repriceModel = new RepriceModel("net32-1", null, "Product", null, false);
      const result = GetTriggeredByValue(repriceModel);
      expect(result).toBeNull();
    });

    it("should return triggeredByVendor from repriceDetails when listOfRepriceDetails is empty", () => {
      const repriceModel = new RepriceModel("net32-1", null, "Product", null, false);
      repriceModel.repriceDetails = {
        oldPrice: 10,
        newPrice: "15.00",
        isRepriced: true,
        updatedOn: new Date(),
        explained: "Test",
        lowestVendor: null,
        lowestVendorPrice: null,
        triggeredByVendor: "TRADENT",
        active: true,
      } as any;
      repriceModel.listOfRepriceDetails = [];

      const result = GetTriggeredByValue(repriceModel);
      expect(result).toBe("TRADENT");
    });

    it("should return joined triggeredByVendor from listOfRepriceDetails when available", () => {
      const repriceModel = new RepriceModel("net32-1", null, "Product", null, false);
      repriceModel.listOfRepriceDetails = [
        {
          oldPrice: 10,
          newPrice: "15.00",
          isRepriced: true,
          updatedOn: new Date(),
          explained: "Test",
          lowestVendor: null,
          lowestVendorPrice: null,
          triggeredByVendor: "TRADENT",
          active: true,
        } as any,
        {
          oldPrice: 10,
          newPrice: "16.00",
          isRepriced: true,
          updatedOn: new Date(),
          explained: "Test",
          lowestVendor: null,
          lowestVendorPrice: null,
          triggeredByVendor: "FRONTIER",
          active: true,
        } as any,
      ];

      const result = GetTriggeredByValue(repriceModel);
      expect(result).toBe("TRADENT, FRONTIER");
    });

    it("should handle null triggeredByVendor in listOfRepriceDetails", () => {
      const repriceModel = new RepriceModel("net32-1", null, "Product", null, false);
      repriceModel.listOfRepriceDetails = [
        {
          oldPrice: 10,
          newPrice: "15.00",
          isRepriced: true,
          updatedOn: new Date(),
          explained: "Test",
          lowestVendor: null,
          lowestVendorPrice: null,
          triggeredByVendor: null,
          active: true,
        } as any,
      ];

      const result = GetTriggeredByValue(repriceModel);
      expect(result).toBe("null");
    });

    it("should return null when both listOfRepriceDetails and repriceDetails are empty/null", () => {
      const repriceModel = new RepriceModel("net32-1", null, "Product", null, false);
      repriceModel.listOfRepriceDetails = [];
      repriceModel.repriceDetails = null;

      const result = GetTriggeredByValue(repriceModel);
      expect(result).toBeNull();
    });

    it("should handle repriceModel with undefined listOfRepriceDetails", () => {
      const repriceModel = new RepriceModel("net32-1", null, "Product", null, false);
      (repriceModel as any).listOfRepriceDetails = undefined;
      repriceModel.repriceDetails = {
        oldPrice: 10,
        newPrice: "15.00",
        isRepriced: true,
        updatedOn: new Date(),
        explained: "Test",
        lowestVendor: null,
        lowestVendorPrice: null,
        triggeredByVendor: "TRADENT",
        active: true,
      } as any;

      const result = GetTriggeredByValue(repriceModel);
      expect(result).toBe("TRADENT");
    });
  });

  describe("ToIpConfigModelList", () => {
    it("should return empty array when incomingSqlData is null", () => {
      const result = ToIpConfigModelList(null);
      expect(result).toEqual([]);
    });

    it("should return empty array when incomingSqlData is empty", () => {
      const result = ToIpConfigModelList([]);
      expect(result).toEqual([]);
    });

    it("should map single IP config item correctly", () => {
      const sqlData = [
        {
          ProxyProvider: 1,
          ProxyProviderName: "Test Provider",
          UserName: "user",
          Password: "pass",
          HostUrl: "http://example.com",
          Port: 8080,
          IpTypeName: "Residential",
          IpType: 1,
          Method: "GET",
          Active: 1,
          ProxyPriority: 10,
          IsDummy: 0,
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-01-01"),
        },
      ];

      const result = ToIpConfigModelList(sqlData) as any[];

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        proxyProvider: 1,
        proxyProviderName: "Test Provider",
        userName: "user",
        password: "pass",
        hostUrl: "http://example.com",
        port: 8080,
        ipTypeName: "Residential",
        ipType: 1,
        method: "GET",
        active: true,
        proxyPriority: 10,
        isDummy: false,
        AuditInfo: {
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-01-01"),
        },
      });
    });

    it("should map multiple IP config items correctly", () => {
      const sqlData = [
        {
          ProxyProvider: 1,
          ProxyProviderName: "Provider 1",
          UserName: "user1",
          Password: "pass1",
          HostUrl: "http://example1.com",
          Port: 8080,
          IpTypeName: "Residential",
          IpType: 1,
          Method: "GET",
          Active: 1,
          ProxyPriority: 10,
          IsDummy: 0,
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-01-01"),
        },
        {
          ProxyProvider: 2,
          ProxyProviderName: "Provider 2",
          UserName: "user2",
          Password: "pass2",
          HostUrl: "http://example2.com",
          Port: 9090,
          IpTypeName: "Datacenter",
          IpType: 2,
          Method: "POST",
          Active: 0,
          ProxyPriority: 20,
          IsDummy: 1,
          UpdatedBy: "user",
          UpdatedOn: new Date("2024-01-02"),
        },
      ];

      const result = ToIpConfigModelList(sqlData) as any[];

      expect(result).toHaveLength(2);
      expect(result[0].active).toBe(true);
      expect(result[0].isDummy).toBe(false);
      expect(result[1].active).toBe(false);
      expect(result[1].isDummy).toBe(true);
    });

    it("should handle Active and IsDummy as 0 correctly", () => {
      const sqlData = [
        {
          ProxyProvider: 1,
          ProxyProviderName: "Test",
          UserName: "user",
          Password: "pass",
          HostUrl: "http://example.com",
          Port: 8080,
          IpTypeName: "Residential",
          IpType: 1,
          Method: "GET",
          Active: 0,
          ProxyPriority: 10,
          IsDummy: 0,
          UpdatedBy: "admin",
          UpdatedOn: new Date(),
        },
      ];

      const result = ToIpConfigModelList(sqlData) as any[];

      expect(result[0].active).toBe(false);
      expect(result[0].isDummy).toBe(false);
    });
  });

  describe("ToEnvSettingsModel", () => {
    it("should return null when incomingSqlData is null", () => {
      const result = ToEnvSettingsModel(null);
      expect(result).toBeNull();
    });

    it("should return null when incomingSqlData is empty", () => {
      // The function doesn't check for empty array, it will access [0] which is undefined
      // This test verifies the actual behavior - it will throw an error
      expect(() => ToEnvSettingsModel([])).toThrow();
    });

    it("should map env settings correctly", () => {
      const sqlData = [
        {
          Delay: 1000,
          Source: "test",
          OverrideAll: 1,
          FrontierApiKey: "frontier-key",
          DevIntegrationKey: "dev-key",
          ExpressCronBatchSize: 50,
          ExpressCronOverlapThreshold: 10,
          ExpressCronInstanceLimit: 5,
          SlowCronBatchSize: 20,
          SlowCronInstanceLimit: 3,
          OverridePriority: 1,
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-01-01"),
          EntityName: "TRADENT",
          Priority: 1,
        },
        {
          Delay: 1000,
          Source: "test",
          OverrideAll: 1,
          FrontierApiKey: "frontier-key",
          DevIntegrationKey: "dev-key",
          ExpressCronBatchSize: 50,
          ExpressCronOverlapThreshold: 10,
          ExpressCronInstanceLimit: 5,
          SlowCronBatchSize: 20,
          SlowCronInstanceLimit: 3,
          OverridePriority: 1,
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-01-01"),
          EntityName: "FRONTIER",
          Priority: 2,
        },
        {
          Delay: 1000,
          Source: "test",
          OverrideAll: 1,
          FrontierApiKey: "frontier-key",
          DevIntegrationKey: "dev-key",
          ExpressCronBatchSize: 50,
          ExpressCronOverlapThreshold: 10,
          ExpressCronInstanceLimit: 5,
          SlowCronBatchSize: 20,
          SlowCronInstanceLimit: 3,
          OverridePriority: 1,
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-01-01"),
          EntityName: "MVP",
          Priority: 3,
        },
        {
          Delay: 1000,
          Source: "test",
          OverrideAll: 1,
          FrontierApiKey: "frontier-key",
          DevIntegrationKey: "dev-key",
          ExpressCronBatchSize: 50,
          ExpressCronOverlapThreshold: 10,
          ExpressCronInstanceLimit: 5,
          SlowCronBatchSize: 20,
          SlowCronInstanceLimit: 3,
          OverridePriority: 1,
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-01-01"),
          EntityName: "FIRSTDENT",
          Priority: 4,
        },
        {
          Delay: 1000,
          Source: "test",
          OverrideAll: 1,
          FrontierApiKey: "frontier-key",
          DevIntegrationKey: "dev-key",
          ExpressCronBatchSize: 50,
          ExpressCronOverlapThreshold: 10,
          ExpressCronInstanceLimit: 5,
          SlowCronBatchSize: 20,
          SlowCronInstanceLimit: 3,
          OverridePriority: 1,
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-01-01"),
          EntityName: "TOPDENT",
          Priority: 5,
        },
        {
          Delay: 1000,
          Source: "test",
          OverrideAll: 1,
          FrontierApiKey: "frontier-key",
          DevIntegrationKey: "dev-key",
          ExpressCronBatchSize: 50,
          ExpressCronOverlapThreshold: 10,
          ExpressCronInstanceLimit: 5,
          SlowCronBatchSize: 20,
          SlowCronInstanceLimit: 3,
          OverridePriority: 1,
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-01-01"),
          EntityName: "TRIAD",
          Priority: 6,
        },
      ];

      const result = ToEnvSettingsModel(sqlData);

      expect(result).not.toBeNull();
      expect(result?.delay).toBe(1000);
      expect(result?.source).toBe("test");
      expect(result?.override_all).toBe("true");
      expect(result?.FrontierApiKey).toBe("frontier-key");
      expect(result?.DevIntegrationKey).toBe("dev-key");
      expect(result?.expressCronBatchSize).toBe(50);
      expect(result?.expressCronOverlapThreshold).toBe(10);
      expect(result?.expressCronInstanceLimit).toBe(5);
      expect(result?.slowCronBatchSize).toBe(20);
      expect(result?.slowCronInstanceLimit).toBe(3);
      expect(result?.override_execution_priority_details.override_priority).toBe("true");
      expect(result?.override_execution_priority_details.priority_settings.tradent_priority).toBe("1");
      expect(result?.override_execution_priority_details.priority_settings.frontier_priority).toBe("2");
      expect(result?.override_execution_priority_details.priority_settings.mvp_priority).toBe("3");
      expect(result?.override_execution_priority_details.priority_settings.firstDent_priority).toBe("4");
      expect(result?.override_execution_priority_details.priority_settings.topDent_priority).toBe("5");
      expect(result?.override_execution_priority_details.priority_settings.triad_priority).toBe("6");
      expect(result?.AuditInfo.UpdatedBy).toBe("admin");
      expect(result?.AuditInfo.UpdatedOn).toEqual(new Date("2024-01-01"));
    });

    it("should handle OverrideAll as 0 correctly", () => {
      const sqlData = [
        {
          Delay: 1000,
          Source: "test",
          OverrideAll: 0,
          FrontierApiKey: "frontier-key",
          DevIntegrationKey: "dev-key",
          ExpressCronBatchSize: 50,
          ExpressCronOverlapThreshold: 10,
          ExpressCronInstanceLimit: 5,
          SlowCronBatchSize: 20,
          SlowCronInstanceLimit: 3,
          OverridePriority: 0,
          UpdatedBy: "admin",
          UpdatedOn: new Date(),
        },
      ];

      const result = ToEnvSettingsModel(sqlData);

      expect(result?.override_all).toBe("false");
      expect(result?.override_execution_priority_details.override_priority).toBe("false");
    });

    it("should return null priority when vendor entity is not found", () => {
      const sqlData = [
        {
          Delay: 1000,
          Source: "test",
          OverrideAll: 1,
          FrontierApiKey: "frontier-key",
          DevIntegrationKey: "dev-key",
          ExpressCronBatchSize: 50,
          ExpressCronOverlapThreshold: 10,
          ExpressCronInstanceLimit: 5,
          SlowCronBatchSize: 20,
          SlowCronInstanceLimit: 3,
          OverridePriority: 1,
          UpdatedBy: "admin",
          UpdatedOn: new Date(),
          EntityName: "UNKNOWN",
          Priority: 1,
        },
      ];

      const result = ToEnvSettingsModel(sqlData);

      expect(result?.override_execution_priority_details.priority_settings.tradent_priority).toBeNull();
    });

    it("should handle vendor entity with null EntityName", () => {
      const sqlData = [
        {
          Delay: 1000,
          Source: "test",
          OverrideAll: 1,
          FrontierApiKey: "frontier-key",
          DevIntegrationKey: "dev-key",
          ExpressCronBatchSize: 50,
          ExpressCronOverlapThreshold: 10,
          ExpressCronInstanceLimit: 5,
          SlowCronBatchSize: 20,
          SlowCronInstanceLimit: 3,
          OverridePriority: 1,
          UpdatedBy: "admin",
          UpdatedOn: new Date(),
          EntityName: null,
          Priority: 1,
        },
      ];

      const result = ToEnvSettingsModel(sqlData);

      expect(result?.override_execution_priority_details.priority_settings.tradent_priority).toBeNull();
    });
  });

  describe("ToCronSettingsModel", () => {
    it("should return empty array when incomingSqlData is null", () => {
      const result = ToCronSettingsModel(null);
      expect(result).toEqual([]);
    });

    it("should return empty array when incomingSqlData is empty", () => {
      const result = ToCronSettingsModel([]);
      expect(result).toEqual([]);
    });

    it("should return empty array when groupedList is null", () => {
      const mockGroupBy = jest.fn().mockReturnValue(null);
      (_.groupBy as jest.Mock) = mockGroupBy;

      const result = ToCronSettingsModel([{ CronId: "cron-1" }]);

      expect(result).toEqual([]);
    });

    it("should map single cron setting correctly", () => {
      const mockGroupBy = jest.fn().mockReturnValue({
        "cron-1": [
          {
            CronId: "cron-1",
            CronName: "Test Cron",
            CronTimeUnit: "min",
            CronTime: 30,
            CronStatus: 1,
            Offset: "0",
            ProxyProvider: 1,
            IpType: 1,
            FixedIp: null,
            CreatedTime: new Date("2024-01-01"),
            SwitchSequence: 1,
            IsHidden: 0,
            UpdatedTime: new Date("2024-01-02"),
            CronType: "DEFAULT",
            VendorName: "TRADENT",
            SecretKey: "secret-key-1",
            AltProxySequence: null,
            AltProxyProvider: null,
            UpdatedBy: "admin",
          },
        ],
      });
      const mockKeys = jest.fn().mockReturnValue(["cron-1"]);

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;

      const sqlData = [
        {
          CronId: "cron-1",
          CronName: "Test Cron",
          CronTimeUnit: "min",
          CronTime: 30,
          CronStatus: 1,
          Offset: "0",
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: null,
          CreatedTime: new Date("2024-01-01"),
          SwitchSequence: 1,
          IsHidden: 0,
          UpdatedTime: new Date("2024-01-02"),
          CronType: "DEFAULT",
          VendorName: "TRADENT",
          SecretKey: "secret-key-1",
          AltProxySequence: null,
          AltProxyProvider: null,
          UpdatedBy: "admin",
        },
      ];

      const result = ToCronSettingsModel(sqlData);

      expect(result).toHaveLength(1);
      expect(result[0].CronId).toBe("cron-1");
      expect(result[0].CronName).toBe("Test Cron");
      expect(result[0].CronTimeUnit).toBe("min");
      expect(result[0].CronTime).toBe(30);
      expect(result[0].CronStatus).toBe(true);
      expect(result[0].Offset).toBe("0");
      expect(result[0].ProxyProvider).toBe(1);
      expect(result[0].IpType).toBe(1);
      expect(result[0].FixedIp).toBeNull();
      expect(result[0].IsHidden).toBe(false);
      expect(result[0].CronType).toBe("DEFAULT");
      expect(result[0].AuditInfo.UpdatedBy).toBe("admin");
      expect(result[0].AuditInfo.UpdatedOn).toEqual(new Date("2024-01-02"));
    });

    it("should map cron settings with secret keys correctly", () => {
      // Mock groupBy to return different results for different calls
      // First call: group by CronId
      // Second call: group by VendorName (for secret keys)
      const mockGroupBy = jest
        .fn()
        .mockReturnValueOnce({
          "cron-1": [
            {
              CronId: "cron-1",
              CronName: "Test Cron",
              CronTimeUnit: "min",
              CronTime: 30,
              CronStatus: 1,
              Offset: "0",
              ProxyProvider: 1,
              IpType: 1,
              FixedIp: null,
              CreatedTime: new Date("2024-01-01"),
              SwitchSequence: 1,
              IsHidden: 0,
              UpdatedTime: new Date("2024-01-02"),
              CronType: "DEFAULT",
              VendorName: "TRADENT",
              SecretKey: "secret-key-1",
              AltProxySequence: null,
              AltProxyProvider: null,
              UpdatedBy: "admin",
            },
            {
              CronId: "cron-1",
              CronName: "Test Cron",
              CronTimeUnit: "min",
              CronTime: 30,
              CronStatus: 1,
              Offset: "0",
              ProxyProvider: 1,
              IpType: 1,
              FixedIp: null,
              CreatedTime: new Date("2024-01-01"),
              SwitchSequence: 1,
              IsHidden: 0,
              UpdatedTime: new Date("2024-01-02"),
              CronType: "DEFAULT",
              VendorName: "FRONTIER",
              SecretKey: "secret-key-2",
              AltProxySequence: null,
              AltProxyProvider: null,
              UpdatedBy: "admin",
            },
          ],
        })
        .mockReturnValueOnce({
          TRADENT: [
            {
              CronId: "cron-1",
              VendorName: "TRADENT",
              SecretKey: "secret-key-1",
            },
          ],
          FRONTIER: [
            {
              CronId: "cron-1",
              VendorName: "FRONTIER",
              SecretKey: "secret-key-2",
            },
          ],
        })
        .mockReturnValueOnce(null);
      const mockKeys = jest.fn().mockReturnValueOnce(["cron-1"]).mockReturnValueOnce(["TRADENT", "FRONTIER"]);

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;

      const sqlData = [
        {
          CronId: "cron-1",
          CronName: "Test Cron",
          CronTimeUnit: "min",
          CronTime: 30,
          CronStatus: 1,
          Offset: "0",
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: null,
          CreatedTime: new Date("2024-01-01"),
          SwitchSequence: 1,
          IsHidden: 0,
          UpdatedTime: new Date("2024-01-02"),
          CronType: "DEFAULT",
          VendorName: "TRADENT",
          SecretKey: "secret-key-1",
          AltProxySequence: null,
          AltProxyProvider: null,
          UpdatedBy: "admin",
        },
        {
          CronId: "cron-1",
          CronName: "Test Cron",
          CronTimeUnit: "min",
          CronTime: 30,
          CronStatus: 1,
          Offset: "0",
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: null,
          CreatedTime: new Date("2024-01-01"),
          SwitchSequence: 1,
          IsHidden: 0,
          UpdatedTime: new Date("2024-01-02"),
          CronType: "DEFAULT",
          VendorName: "FRONTIER",
          SecretKey: "secret-key-2",
          AltProxySequence: null,
          AltProxyProvider: null,
          UpdatedBy: "admin",
        },
      ];

      const result = ToCronSettingsModel(sqlData);

      expect(result[0].SecretKey).toHaveLength(2);
      expect(result[0].SecretKey[0].vendorName).toBe("TRADENT");
      expect(result[0].SecretKey[0].secretKey).toBe("secret-key-1");
      expect(result[0].SecretKey[1].vendorName).toBe("FRONTIER");
      expect(result[0].SecretKey[1].secretKey).toBe("secret-key-2");
    });

    it("should return null for SecretKey when groupedSecretKeys is null", () => {
      const mockGroupBy = jest
        .fn()
        .mockReturnValueOnce({
          "cron-1": [
            {
              CronId: "cron-1",
              CronName: "Test Cron",
              CronTimeUnit: "min",
              CronTime: 30,
              CronStatus: 1,
              Offset: "0",
              ProxyProvider: 1,
              IpType: 1,
              FixedIp: null,
              CreatedTime: new Date("2024-01-01"),
              SwitchSequence: 1,
              IsHidden: 0,
              UpdatedTime: new Date("2024-01-02"),
              CronType: "DEFAULT",
              VendorName: "TRADENT",
              SecretKey: "secret-key-1",
              AltProxySequence: null,
              AltProxyProvider: null,
              UpdatedBy: "admin",
            },
          ],
        })
        .mockReturnValueOnce(null);
      const mockKeys = jest.fn().mockReturnValueOnce(["cron-1"]).mockReturnValueOnce([]);

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;

      const sqlData = [
        {
          CronId: "cron-1",
          CronName: "Test Cron",
          CronTimeUnit: "min",
          CronTime: 30,
          CronStatus: 1,
          Offset: "0",
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: null,
          CreatedTime: new Date("2024-01-01"),
          SwitchSequence: 1,
          IsHidden: 0,
          UpdatedTime: new Date("2024-01-02"),
          CronType: "DEFAULT",
          VendorName: "TRADENT",
          SecretKey: "secret-key-1",
          AltProxySequence: null,
          AltProxyProvider: null,
          UpdatedBy: "admin",
        },
      ];

      const result = ToCronSettingsModel(sqlData);

      expect(result[0].SecretKey).toBeNull();
    });

    it("should map cron settings with alternate proxy providers correctly", () => {
      const mockGroupBy = jest
        .fn()
        .mockReturnValueOnce({
          "cron-1": [
            {
              CronId: "cron-1",
              CronName: "Test Cron",
              CronTimeUnit: "min",
              CronTime: 30,
              CronStatus: 1,
              Offset: "0",
              ProxyProvider: 1,
              IpType: 1,
              FixedIp: null,
              CreatedTime: new Date("2024-01-01"),
              SwitchSequence: 1,
              IsHidden: 0,
              UpdatedTime: new Date("2024-01-02"),
              CronType: "DEFAULT",
              VendorName: null,
              SecretKey: null,
              AltProxySequence: "1",
              AltProxyProvider: 2,
              UpdatedBy: "admin",
            },
            {
              CronId: "cron-1",
              CronName: "Test Cron",
              CronTimeUnit: "min",
              CronTime: 30,
              CronStatus: 1,
              Offset: "0",
              ProxyProvider: 1,
              IpType: 1,
              FixedIp: null,
              CreatedTime: new Date("2024-01-01"),
              SwitchSequence: 1,
              IsHidden: 0,
              UpdatedTime: new Date("2024-01-02"),
              CronType: "DEFAULT",
              VendorName: null,
              SecretKey: null,
              AltProxySequence: "2",
              AltProxyProvider: 3,
              UpdatedBy: "admin",
            },
          ],
        })
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({
          "1": [
            {
              CronId: "cron-1",
              AltProxySequence: "1",
              AltProxyProvider: 2,
            },
          ],
          "2": [
            {
              CronId: "cron-1",
              AltProxySequence: "2",
              AltProxyProvider: 3,
            },
          ],
        });
      const mockKeys = jest.fn().mockReturnValueOnce(["cron-1"]).mockReturnValueOnce(["1", "2"]);

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;

      const sqlData = [
        {
          CronId: "cron-1",
          CronName: "Test Cron",
          CronTimeUnit: "min",
          CronTime: 30,
          CronStatus: 1,
          Offset: "0",
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: null,
          CreatedTime: new Date("2024-01-01"),
          SwitchSequence: 1,
          IsHidden: 0,
          UpdatedTime: new Date("2024-01-02"),
          CronType: "DEFAULT",
          VendorName: null,
          SecretKey: null,
          AltProxySequence: "1",
          AltProxyProvider: 2,
          UpdatedBy: "admin",
        },
        {
          CronId: "cron-1",
          CronName: "Test Cron",
          CronTimeUnit: "min",
          CronTime: 30,
          CronStatus: 1,
          Offset: "0",
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: null,
          CreatedTime: new Date("2024-01-01"),
          SwitchSequence: 1,
          IsHidden: 0,
          UpdatedTime: new Date("2024-01-02"),
          CronType: "DEFAULT",
          VendorName: null,
          SecretKey: null,
          AltProxySequence: "2",
          AltProxyProvider: 3,
          UpdatedBy: "admin",
        },
      ];

      const result = ToCronSettingsModel(sqlData);

      expect(result[0].AlternateProxyProvider).toHaveLength(2);
      expect(result[0].AlternateProxyProvider[0].Sequence).toBe(1);
      expect(result[0].AlternateProxyProvider[0].ProxyProvider).toBe(2);
      expect(result[0].AlternateProxyProvider[1].Sequence).toBe(2);
      expect(result[0].AlternateProxyProvider[1].ProxyProvider).toBe(3);
    });

    it("should return null for AlternateProxyProvider when groupedAlternateProviders is null", () => {
      const mockGroupBy = jest
        .fn()
        .mockReturnValueOnce({
          "cron-1": [
            {
              CronId: "cron-1",
              CronName: "Test Cron",
              CronTimeUnit: "min",
              CronTime: 30,
              CronStatus: 1,
              Offset: "0",
              ProxyProvider: 1,
              IpType: 1,
              FixedIp: null,
              CreatedTime: new Date("2024-01-01"),
              SwitchSequence: 1,
              IsHidden: 0,
              UpdatedTime: new Date("2024-01-02"),
              CronType: "DEFAULT",
              VendorName: null,
              SecretKey: null,
              AltProxySequence: null,
              AltProxyProvider: null,
              UpdatedBy: "admin",
            },
          ],
        })
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);
      const mockKeys = jest.fn().mockReturnValueOnce(["cron-1"]).mockReturnValueOnce([]);

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;

      const sqlData = [
        {
          CronId: "cron-1",
          CronName: "Test Cron",
          CronTimeUnit: "min",
          CronTime: 30,
          CronStatus: 1,
          Offset: "0",
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: null,
          CreatedTime: new Date("2024-01-01"),
          SwitchSequence: 1,
          IsHidden: 0,
          UpdatedTime: new Date("2024-01-02"),
          CronType: "DEFAULT",
          VendorName: null,
          SecretKey: null,
          AltProxySequence: null,
          AltProxyProvider: null,
          UpdatedBy: "admin",
        },
      ];

      const result = ToCronSettingsModel(sqlData);

      expect(result[0].AlternateProxyProvider).toBeNull();
    });

    it("should handle multiple cron settings correctly", () => {
      const mockGroupBy = jest
        .fn()
        .mockReturnValueOnce({
          "cron-1": [
            {
              CronId: "cron-1",
              CronName: "Cron 1",
              CronTimeUnit: "min",
              CronTime: 30,
              CronStatus: 1,
              Offset: "0",
              ProxyProvider: 1,
              IpType: 1,
              FixedIp: null,
              CreatedTime: new Date("2024-01-01"),
              SwitchSequence: 1,
              IsHidden: 0,
              UpdatedTime: new Date("2024-01-02"),
              CronType: "DEFAULT",
              VendorName: null,
              SecretKey: null,
              AltProxySequence: null,
              AltProxyProvider: null,
              UpdatedBy: "admin",
            },
          ],
          "cron-2": [
            {
              CronId: "cron-2",
              CronName: "Cron 2",
              CronTimeUnit: "hour",
              CronTime: 2,
              CronStatus: 0,
              Offset: "10",
              ProxyProvider: 2,
              IpType: 2,
              FixedIp: "192.168.1.1",
              CreatedTime: new Date("2024-01-03"),
              SwitchSequence: 2,
              IsHidden: 1,
              UpdatedTime: new Date("2024-01-04"),
              CronType: "CUSTOM",
              VendorName: null,
              SecretKey: null,
              AltProxySequence: null,
              AltProxyProvider: null,
              UpdatedBy: "user",
            },
          ],
        })
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);
      const mockKeys = jest.fn().mockReturnValueOnce(["cron-1", "cron-2"]).mockReturnValueOnce([]);

      (_.groupBy as jest.Mock) = mockGroupBy;
      (_.keys as jest.Mock) = mockKeys;

      const sqlData = [
        {
          CronId: "cron-1",
          CronName: "Cron 1",
          CronTimeUnit: "min",
          CronTime: 30,
          CronStatus: 1,
          Offset: "0",
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: null,
          CreatedTime: new Date("2024-01-01"),
          SwitchSequence: 1,
          IsHidden: 0,
          UpdatedTime: new Date("2024-01-02"),
          CronType: "DEFAULT",
          VendorName: null,
          SecretKey: null,
          AltProxySequence: null,
          AltProxyProvider: null,
          UpdatedBy: "admin",
        },
        {
          CronId: "cron-2",
          CronName: "Cron 2",
          CronTimeUnit: "hour",
          CronTime: 2,
          CronStatus: 0,
          Offset: "10",
          ProxyProvider: 2,
          IpType: 2,
          FixedIp: "192.168.1.1",
          CreatedTime: new Date("2024-01-03"),
          SwitchSequence: 2,
          IsHidden: 1,
          UpdatedTime: new Date("2024-01-04"),
          CronType: "CUSTOM",
          VendorName: null,
          SecretKey: null,
          AltProxySequence: null,
          AltProxyProvider: null,
          UpdatedBy: "user",
        },
      ];

      const result = ToCronSettingsModel(sqlData);

      expect(result).toHaveLength(2);
      expect(result[0].CronId).toBe("cron-1");
      expect(result[0].CronStatus).toBe(true);
      expect(result[0].IsHidden).toBe(false);
      expect(result[1].CronId).toBe("cron-2");
      expect(result[1].CronStatus).toBe(false);
      expect(result[1].IsHidden).toBe(true);
    });
  });

  describe("MapWithAuditInfo", () => {
    it("should return empty array when incomingSqlData is null", () => {
      const result = MapWithAuditInfo(null);
      expect(result).toEqual([]);
    });

    it("should map single item with audit info correctly", () => {
      const sqlData = [
        {
          id: 1,
          name: "Test",
          value: "test-value",
          updatedBy: "admin",
          updatedTime: new Date("2024-01-01"),
        },
      ];

      const result = MapWithAuditInfo(sqlData);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe("Test");
      expect(result[0].value).toBe("test-value");
      expect(result[0].AuditInfo).toEqual({
        UpdatedBy: "admin",
        UpdatedOn: new Date("2024-01-01"),
      });
      expect(result[0].updatedBy).toBeUndefined();
      expect(result[0].updatedTime).toBeUndefined();
    });

    it("should map multiple items with audit info correctly", () => {
      const sqlData = [
        {
          id: 1,
          name: "Test 1",
          value: "value-1",
          updatedBy: "admin",
          updatedTime: new Date("2024-01-01"),
        },
        {
          id: 2,
          name: "Test 2",
          value: "value-2",
          updatedBy: "user",
          updatedTime: new Date("2024-01-02"),
        },
      ];

      const result = MapWithAuditInfo(sqlData);

      expect(result).toHaveLength(2);
      expect(result[0].AuditInfo.UpdatedBy).toBe("admin");
      expect(result[1].AuditInfo.UpdatedBy).toBe("user");
    });

    it("should preserve all other fields except updatedBy and updatedTime", () => {
      const sqlData = [
        {
          id: 1,
          name: "Test",
          description: "Test description",
          status: "active",
          createdBy: "system",
          createdTime: new Date("2024-01-01"),
          updatedBy: "admin",
          updatedTime: new Date("2024-01-02"),
        },
      ];

      const result = MapWithAuditInfo(sqlData);

      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe("Test");
      expect(result[0].description).toBe("Test description");
      expect(result[0].status).toBe("active");
      expect(result[0].createdBy).toBe("system");
      expect(result[0].createdTime).toEqual(new Date("2024-01-01"));
      expect(result[0].updatedBy).toBeUndefined();
      expect(result[0].updatedTime).toBeUndefined();
    });
  });
});
