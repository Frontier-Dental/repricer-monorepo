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

jest.mock("lodash", () => {
  const actualLodash = jest.requireActual("lodash");
  return actualLodash;
});

jest.mock("../response-utility", () => ({
  MapOverrideExecutionPriority: jest.fn(),
}));

jest.mock("../../utility/mysql/mysql-v2", () => ({
  GetGlobalConfig: jest.fn(),
}));

jest.mock("../config", () => ({
  applicationConfig: {
    VENDOR_COUNT: 7,
  },
}));

import { GetProductItemListQuery, GetPrioritySequence } from "../request-generator";
import * as responseUtility from "../response-utility";
import * as sqlV2Service from "../../utility/mysql/mysql-v2";
import { applicationConfig } from "../config";
import { ProductDetailsListItem } from "../mysql/mySql-mapper";
import { ErrorItem } from "../../types/error-item";
import { GlobalConfig } from "../../types/global-config";

describe("request-generator", () => {
  // Helper function to create mock OwnVendorProductDetails
  const createMockVendorDetails = (overrides: any = {}) => ({
    channelName: "TestChannel",
    activated: true,
    mpid: 12345,
    channelId: "CH123",
    unitPrice: 10.5,
    floorPrice: 5.0,
    maxPrice: 20.0,
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: "1",
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: "none",
    badgePercentage: 0,
    productName: "Test Product",
    cronId: "1",
    cronName: "TestCron",
    requestInterval: 60,
    requestIntervalUnit: "MIN",
    scrapeOn: true,
    allowReprice: true,
    focusId: "F1",
    priority: 1,
    wait_update_period: false,
    net32url: "https://test.com",
    abortDeactivatingQPriceBreak: false,
    ownVendorId: null,
    sisterVendorId: "",
    tags: [],
    includeInactiveVendors: false,
    inactiveVendorId: "",
    override_bulk_update: false,
    override_bulk_rule: "0",
    latest_price: 0,
    executionPriority: 1,
    lastCronRun: "",
    lastExistingPrice: 0,
    lastSuggestedPrice: 0,
    lastUpdatedBy: "",
    last_attempted_time: "",
    last_cron_message: "",
    last_cron_time: "",
    lowest_vendor: "",
    lowest_vendor_price: 0,
    next_cron_time: null,
    slowCronId: "",
    slowCronName: "",
    last_update_time: "",
    skipReprice: false,
    ...overrides,
  });

  // Helper function to create mock ProductDetailsListItem
  const createMockProductDetails = (overrides: Partial<ProductDetailsListItem> = {}): ProductDetailsListItem => ({
    mpId: 12345,
    productIdentifier: 67890,
    isSlowActivated: false,
    isScrapeOnlyActivated: false,
    scrapeOnlyCronId: "",
    scrapeOnlyCronName: "",
    tradentLinkInfo: null,
    frontierLinkInfo: null,
    mvpLinkInfo: null,
    topDentLinkInfo: null,
    firstDentLinkInfo: null,
    tradentDetails: null,
    frontierDetails: null,
    mvpDetails: null,
    topDentDetails: null,
    firstDentDetails: null,
    triadDetails: null,
    biteSupplyDetails: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (applicationConfig as any).VENDOR_COUNT = 7;
    (sqlV2Service.GetGlobalConfig as jest.Mock).mockResolvedValue(null);
    (responseUtility.MapOverrideExecutionPriority as jest.Mock).mockImplementation((product) => product);
  });

  describe("GetProductItemListQuery", () => {
    it("should return product item list query object", async () => {
      const result = await GetProductItemListQuery();

      expect(result).toEqual({
        idRef: "PRODUCT_MASTER_LIST",
        active: true,
      });
    });
  });

  describe("GetPrioritySequence", () => {
    it("should return empty array when no vendors are activated", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ activated: false }),
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(result).toEqual([]);
    });

    it("should return vendors in priority order", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 2 }),
        mvpDetails: createMockVendorDetails({ executionPriority: 3 }),
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("TRADENT");
      expect(result[1].name).toBe("FRONTIER");
      expect(result[2].name).toBe("MVP");
    });

    it("should filter vendors by scrapeOn and skipReprice", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({
          executionPriority: 1,
          scrapeOn: true,
          skipReprice: false,
        }),
        frontierDetails: createMockVendorDetails({
          executionPriority: 2,
          scrapeOn: false, // Should be filtered out
          skipReprice: false,
        }),
        mvpDetails: createMockVendorDetails({
          executionPriority: 3,
          scrapeOn: true,
          skipReprice: true, // Should be filtered out
        }),
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("TRADENT");
    });

    it("should exclude vendors in error list when includeErrorItems is true", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 2 }),
      });

      const contextErrorDetails: ErrorItem[] = [
        {
          mpId: 12345,
          vendorName: "TRADENT",
          active: true,
        },
      ];

      const result = await GetPrioritySequence(productInfo, contextErrorDetails, true, false, null);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("FRONTIER");
    });

    it("should include all vendors when includeErrorItems is false", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 2 }),
      });

      const contextErrorDetails: ErrorItem[] = [
        {
          mpId: 12345,
          vendorName: "TRADENT",
          active: true,
        },
      ];

      const result = await GetPrioritySequence(productInfo, contextErrorDetails, false, false, null);

      expect(result).toHaveLength(2);
    });

    it("should include all vendors when contextErrorDetails is null", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 2 }),
      });

      const result = await GetPrioritySequence(productInfo, null, true, false, null);

      expect(result).toHaveLength(2);
    });

    it("should apply override execution priority when enabled", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 5 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 6 }),
      });

      const globalConfig: GlobalConfig = {
        source: "test",
        override_execution_priority_details: {
          override_priority: "true",
          priority_settings: {
            tradent_priority: "1",
            frontier_priority: "2",
            mvp_priority: "3",
            firstDent_priority: "4",
            topDent_priority: "5",
            triad_priority: "6",
            biteSupply_priority: "7",
          },
        },
      };

      (sqlV2Service.GetGlobalConfig as jest.Mock).mockResolvedValue(globalConfig);
      (responseUtility.MapOverrideExecutionPriority as jest.Mock).mockImplementation((product) => {
        product.tradentDetails.executionPriority = 1;
        product.frontierDetails.executionPriority = 2;
        return product;
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(responseUtility.MapOverrideExecutionPriority).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("TRADENT");
      expect(result[1].name).toBe("FRONTIER");
    });

    it("should not apply override when override_priority is false", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
      });

      const globalConfig: GlobalConfig = {
        source: "test",
        override_execution_priority_details: {
          override_priority: "false",
          priority_settings: {
            tradent_priority: "5",
            frontier_priority: "6",
            mvp_priority: "7",
            firstDent_priority: "1",
            topDent_priority: "2",
            triad_priority: "3",
            biteSupply_priority: "4",
          },
        },
      };

      (sqlV2Service.GetGlobalConfig as jest.Mock).mockResolvedValue(globalConfig);

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(responseUtility.MapOverrideExecutionPriority).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("should not apply override when globalConfig is null", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
      });

      (sqlV2Service.GetGlobalConfig as jest.Mock).mockResolvedValue(null);

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(responseUtility.MapOverrideExecutionPriority).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("should not apply override when override_execution_priority_details is missing", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
      });

      const globalConfig: GlobalConfig = {
        source: "test",
      };

      (sqlV2Service.GetGlobalConfig as jest.Mock).mockResolvedValue(globalConfig);

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(responseUtility.MapOverrideExecutionPriority).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("should handle all vendor types", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 2 }),
        mvpDetails: createMockVendorDetails({ executionPriority: 3 }),
        topDentDetails: createMockVendorDetails({ executionPriority: 4 }),
        firstDentDetails: createMockVendorDetails({ executionPriority: 5 }),
        triadDetails: createMockVendorDetails({ executionPriority: 6 }),
        biteSupplyDetails: createMockVendorDetails({ executionPriority: 7 }),
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(result).toHaveLength(7);
      expect(result.map((v) => v.name)).toEqual(["TRADENT", "FRONTIER", "MVP", "TOPDENT", "FIRSTDENT", "TRIAD", "BITESUPPLY"]);
    });

    it("should handle vendors with same priority", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 1 }),
        mvpDetails: createMockVendorDetails({ executionPriority: 2 }),
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      // Both TRADENT and FRONTIER have priority 1, so both should be included
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.some((v) => v.name === "TRADENT")).toBe(true);
      expect(result.some((v) => v.name === "FRONTIER")).toBe(true);
    });

    it("should handle missing vendor details", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: null,
        frontierDetails: createMockVendorDetails({ executionPriority: 1 }),
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("FRONTIER");
    });

    it("should handle scrapeOn as false", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({
          executionPriority: 1,
          scrapeOn: false,
        }),
        frontierDetails: createMockVendorDetails({
          executionPriority: 2,
          scrapeOn: true,
        }),
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("FRONTIER");
    });

    it("should handle skipReprice as true", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({
          executionPriority: 1,
          skipReprice: true,
        }),
        frontierDetails: createMockVendorDetails({
          executionPriority: 2,
          skipReprice: false,
        }),
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("FRONTIER");
    });

    it("should handle VENDOR_COUNT limit", async () => {
      (applicationConfig as any).VENDOR_COUNT = 3;

      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 2 }),
        mvpDetails: createMockVendorDetails({ executionPriority: 3 }),
        topDentDetails: createMockVendorDetails({ executionPriority: 4 }),
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      // Should only process up to VENDOR_COUNT (3)
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("should handle override with JSON parse error", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
      });

      const globalConfig: GlobalConfig = {
        source: "test",
        override_execution_priority_details: {
          override_priority: "invalid-json",
          priority_settings: {
            tradent_priority: "1",
            frontier_priority: "2",
            mvp_priority: "3",
            firstDent_priority: "4",
            topDent_priority: "5",
            triad_priority: "6",
            biteSupply_priority: "7",
          },
        },
      };

      (sqlV2Service.GetGlobalConfig as jest.Mock).mockResolvedValue(globalConfig);

      // JSON.parse will throw, so the function will throw an error
      await expect(GetPrioritySequence(productInfo, null, false, false, null)).rejects.toThrow();
    });

    it("should handle multiple error items", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 2 }),
        mvpDetails: createMockVendorDetails({ executionPriority: 3 }),
      });

      const contextErrorDetails: ErrorItem[] = [
        {
          mpId: 12345,
          vendorName: "TRADENT",
          active: true,
        },
        {
          mpId: 12345,
          vendorName: "FRONTIER",
          active: true,
        },
      ];

      const result = await GetPrioritySequence(productInfo, contextErrorDetails, true, false, null);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("MVP");
    });

    it("should handle error item with different mpId", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 2 }),
      });

      const contextErrorDetails: ErrorItem[] = [
        {
          mpId: 99999, // Different mpId
          vendorName: "TRADENT",
          active: true,
        },
      ];

      const result = await GetPrioritySequence(productInfo, contextErrorDetails, true, false, null);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("FRONTIER");
    });

    it("should handle override_priority as boolean string", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
      });

      const globalConfig: GlobalConfig = {
        source: "test",
        override_execution_priority_details: {
          override_priority: "true",
          priority_settings: {
            tradent_priority: "2",
            frontier_priority: "1",
            mvp_priority: "3",
            firstDent_priority: "4",
            topDent_priority: "5",
            triad_priority: "6",
            biteSupply_priority: "7",
          },
        },
      };

      (sqlV2Service.GetGlobalConfig as jest.Mock).mockResolvedValue(globalConfig);
      (responseUtility.MapOverrideExecutionPriority as jest.Mock).mockImplementation((product) => {
        product.tradentDetails.executionPriority = 2;
        return product;
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(responseUtility.MapOverrideExecutionPriority).toHaveBeenCalled();
    });

    it("should handle vendors with priority higher than VENDOR_COUNT", async () => {
      (applicationConfig as any).VENDOR_COUNT = 3;

      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
        frontierDetails: createMockVendorDetails({ executionPriority: 5 }), // Higher than VENDOR_COUNT
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      // Should only include priority 1 (TRADENT)
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("TRADENT");
    });

    it("should handle null vendor details gracefully", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: null,
        frontierDetails: null,
        mvpDetails: null,
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(result).toEqual([]);
    });

    it("should handle empty error details array", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
      });

      const result = await GetPrioritySequence(productInfo, [], true, false, null);

      expect(result).toHaveLength(1);
    });

    it("should preserve vendor object structure", async () => {
      const productInfo = createMockProductDetails({
        tradentDetails: createMockVendorDetails({ executionPriority: 1 }),
      });

      const result = await GetPrioritySequence(productInfo, null, false, false, null);

      expect(result[0]).toEqual({
        name: "TRADENT",
        value: "tradentDetails",
      });
    });
  });
});
