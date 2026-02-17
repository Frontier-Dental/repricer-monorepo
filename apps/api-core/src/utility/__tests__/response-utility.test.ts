// Mock all dependencies BEFORE imports
jest.mock("../../model/global-param", () => ({
  GetInfo: jest.fn(),
}));

jest.mock("lodash", () => {
  const actualLodash = jest.requireActual("lodash");
  return actualLodash;
});

import { FilterActiveResponse, GetOwnProduct, GetCronGeneric, IsEligibleForReprice, GetLastExistingPrice, MapOverrideExecutionPriority } from "../response-utility";
import * as globalParam from "../../model/global-param";
import { Net32Product } from "../../types/net32";
import { FrontierProduct } from "../../types/frontier";

describe("response-utility", () => {
  // Helper function to create mock Net32Product
  const createMockNet32Product = (overrides: Partial<Net32Product> = {}): Net32Product => ({
    vendorProductId: 12345,
    vendorProductCode: "VPC123",
    vendorId: 99999,
    vendorName: "TestVendor",
    vendorRegion: "US",
    inStock: true,
    standardShipping: 5.99,
    standardShippingStatus: "available",
    freeShippingGap: 50,
    heavyShippingStatus: "available",
    heavyShipping: 10.99,
    shippingTime: 2,
    inventory: 100,
    isFulfillmentPolicyStock: true,
    vdrGeneralAverageRatingSum: 4.5,
    vdrNumberOfGeneralRatings: 100,
    isBackordered: false,
    vendorProductLevelLicenseRequiredSw: false,
    vendorVerticalLevelLicenseRequiredSw: false,
    priceBreaks: [{ minQty: 1, unitPrice: 10.5, active: true }],
    badgeId: 1,
    badgeName: "Best Seller",
    imagePath: "/image.jpg",
    arrivalDate: "2024-01-05",
    arrivalBusinessDays: 3,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    ...overrides,
  });

  // Helper function to create mock FrontierProduct
  const createMockFrontierProduct = (overrides: Partial<FrontierProduct> = {}): FrontierProduct => ({
    channelName: "TestChannel",
    activated: true,
    mpid: 12345,
    channelId: "CH123",
    unitPrice: "10.50",
    floorPrice: "5.00",
    maxPrice: "20.00",
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 1,
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
    override_bulk_rule: 0,
    latest_price: 0,
    executionPriority: 1,
    lastCronRun: "",
    lastExistingPrice: "",
    lastSuggestedPrice: "",
    lastUpdatedBy: "",
    last_attempted_time: "",
    last_cron_message: "",
    last_cron_time: "",
    lowest_vendor: "",
    lowest_vendor_price: "",
    next_cron_time: "",
    slowCronId: "",
    slowCronName: "",
    last_update_time: "",
    applyBuyBoxLogic: false,
    applyNcForBuyBox: false,
    isSlowActivated: false,
    lastUpdatedByUser: "",
    lastUpdatedOn: "",
    handlingTimeFilter: "",
    keepPosition: false,
    excludedVendors: "",
    inventoryThreshold: 0,
    percentageDown: "",
    badgePercentageDown: "",
    competeWithNext: false,
    triggeredByVendor: "",
    ignorePhantomQBreak: false,
    ownVendorThreshold: 0,
    skipReprice: false,
    secretKey: [],
    contextCronName: "",
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("FilterActiveResponse", () => {
    it("should filter out inactive products when includeInactiveVendors is false", () => {
      const payload: Net32Product[] = [createMockNet32Product({ vendorId: 1, inStock: true }), createMockNet32Product({ vendorId: 2, inStock: false }), createMockNet32Product({ vendorId: 3, inStock: true })];

      const productItem = createMockFrontierProduct({ includeInactiveVendors: false });

      const result = FilterActiveResponse(payload, productItem);

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.inStock !== false)).toBe(true);
    });

    it("should filter out inactive products when productItem is null", () => {
      const payload: Net32Product[] = [createMockNet32Product({ vendorId: 1, inStock: true }), createMockNet32Product({ vendorId: 2, inStock: false })];

      const result = FilterActiveResponse(payload, null as any);

      expect(result).toHaveLength(1);
      expect(result[0].inStock).toBe(true);
    });

    it("should filter out inactive products when includeInactiveVendors is undefined", () => {
      const payload: Net32Product[] = [createMockNet32Product({ vendorId: 1, inStock: true }), createMockNet32Product({ vendorId: 2, inStock: false })];

      const productItem = createMockFrontierProduct({ includeInactiveVendors: undefined as any });

      const result = FilterActiveResponse(payload, productItem);

      expect(result).toHaveLength(1);
      expect(result[0].inStock).toBe(true);
    });

    it("should include one inactive vendor when includeInactiveVendors is true and inactiveVendorId is specified", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          inStock: true,
          isBackordered: false,
        }),
        createMockNet32Product({
          vendorId: 2,
          inStock: false,
          isBackordered: false,
          priceBreaks: [{ minQty: 1, unitPrice: 8.5, active: true }],
        }),
        createMockNet32Product({
          vendorId: 2,
          inStock: false,
          isBackordered: false,
          priceBreaks: [{ minQty: 1, unitPrice: 9.5, active: true }],
        }),
        createMockNet32Product({
          vendorId: 3,
          inStock: false,
          isBackordered: false,
          priceBreaks: [{ minQty: 1, unitPrice: 7.5, active: true }],
        }),
      ];

      const productItem = createMockFrontierProduct({
        includeInactiveVendors: true,
        inactiveVendorId: "2;3",
      });

      const result = FilterActiveResponse(payload, productItem);

      // Should have 1 active + 1 inactive (lowest price)
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((p) => p.inStock === false)).toBe(true);
      // Should include the cheapest inactive vendor (vendorId 3 with price 7.5)
      const inactiveInResult = result.find((p) => p.inStock === false);
      expect(inactiveInResult?.vendorId).toBe(3);
    });

    it("should not include inactive vendor when inactiveVendorId doesn't match", () => {
      const payload: Net32Product[] = [createMockNet32Product({ vendorId: 1, inStock: true }), createMockNet32Product({ vendorId: 2, inStock: false })];

      const productItem = createMockFrontierProduct({
        includeInactiveVendors: true,
        inactiveVendorId: "999",
      });

      const result = FilterActiveResponse(payload, productItem);

      expect(result).toHaveLength(1);
      expect(result[0].inStock).toBe(true);
    });

    it("should filter out backordered products", () => {
      const payload: Net32Product[] = [createMockNet32Product({ vendorId: 1, inStock: true, isBackordered: false }), createMockNet32Product({ vendorId: 2, inStock: true, isBackordered: true }), createMockNet32Product({ vendorId: 3, inStock: true, isBackordered: false })];

      const productItem = createMockFrontierProduct();

      const result = FilterActiveResponse(payload, productItem);

      expect(result).toHaveLength(2);
      expect(result.every((p) => !p.isBackordered)).toBe(true);
    });

    it("should handle inactive vendors with no matching price breaks", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          inStock: true,
        }),
        createMockNet32Product({
          vendorId: 2,
          inStock: false,
          priceBreaks: [{ minQty: 5, unitPrice: 8.5, active: true }], // No minQty=1
        }),
      ];

      const productItem = createMockFrontierProduct({
        includeInactiveVendors: true,
        inactiveVendorId: "2",
      });

      const result = FilterActiveResponse(payload, productItem);

      // Inactive vendor is still included even without minQty=1 (sorted with Infinity price)
      expect(result.length).toBe(2);
      expect(result.some((p) => p.vendorId === 2)).toBe(true);
    });

    it("should handle inactive vendors with inactive price breaks", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          inStock: true,
        }),
        createMockNet32Product({
          vendorId: 2,
          inStock: false,
          priceBreaks: [{ minQty: 1, unitPrice: 8.5, active: false }], // active=false
        }),
      ];

      const productItem = createMockFrontierProduct({
        includeInactiveVendors: true,
        inactiveVendorId: "2",
      });

      const result = FilterActiveResponse(payload, productItem);

      // Inactive vendor is still included even with inactive price break (sorted with Infinity price)
      expect(result.length).toBe(2);
      expect(result.some((p) => p.vendorId === 2)).toBe(true);
    });

    it("should handle empty payload", () => {
      const payload: Net32Product[] = [];
      const productItem = createMockFrontierProduct();

      const result = FilterActiveResponse(payload, productItem);

      expect(result).toHaveLength(0);
    });

    it("should handle multiple inactive vendors and select the cheapest", () => {
      const payload: Net32Product[] = [
        createMockNet32Product({
          vendorId: 1,
          inStock: true,
        }),
        createMockNet32Product({
          vendorId: 2,
          inStock: false,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
        }),
        createMockNet32Product({
          vendorId: 3,
          inStock: false,
          priceBreaks: [{ minQty: 1, unitPrice: 8.0, active: true }],
        }),
        createMockNet32Product({
          vendorId: 4,
          inStock: false,
          priceBreaks: [{ minQty: 1, unitPrice: 9.0, active: true }],
        }),
      ];

      const productItem = createMockFrontierProduct({
        includeInactiveVendors: true,
        inactiveVendorId: "2;3;4",
      });

      const result = FilterActiveResponse(payload, productItem);

      const inactiveInResult = result.find((p) => p.inStock === false);
      expect(inactiveInResult?.vendorId).toBe(3); // Cheapest one
      expect(inactiveInResult?.priceBreaks[0].unitPrice).toBe(8.0);
    });
  });

  describe("GetOwnProduct", () => {
    it("should return own product when found", async () => {
      const products: Net32Product[] = [createMockNet32Product({ vendorId: 1 }), createMockNet32Product({ vendorId: 2 }), createMockNet32Product({ vendorId: 3 })];

      const frontierProduct = createMockFrontierProduct({ mpid: 12345 });
      (globalParam.GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 2 });

      const result = await GetOwnProduct(products, frontierProduct);

      expect(result).toBeDefined();
      expect(result?.vendorId).toBe(2);
      expect(globalParam.GetInfo).toHaveBeenCalledWith(12345, frontierProduct);
    });

    it("should return undefined when own product not found", async () => {
      const products: Net32Product[] = [createMockNet32Product({ vendorId: 1 }), createMockNet32Product({ vendorId: 2 })];

      const frontierProduct = createMockFrontierProduct({ mpid: 12345 });
      (globalParam.GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 999 });

      const result = await GetOwnProduct(products, frontierProduct);

      expect(result).toBeUndefined();
    });

    it("should handle empty products array", async () => {
      const products: Net32Product[] = [];
      const frontierProduct = createMockFrontierProduct({ mpid: 12345 });
      (globalParam.GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 1 });

      const result = await GetOwnProduct(products, frontierProduct);

      expect(result).toBeUndefined();
    });

    it("should handle vendorId as string in products", async () => {
      const products: Net32Product[] = [createMockNet32Product({ vendorId: "2" as any })];

      const frontierProduct = createMockFrontierProduct({ mpid: 12345 });
      (globalParam.GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: 2 });

      const result = await GetOwnProduct(products, frontierProduct);

      expect(result).toBeDefined();
      expect(result?.vendorId).toBe("2");
    });

    it("should handle vendorId as number in products", async () => {
      const products: Net32Product[] = [createMockNet32Product({ vendorId: 2 })];

      const frontierProduct = createMockFrontierProduct({ mpid: 12345 });
      (globalParam.GetInfo as jest.Mock).mockResolvedValue({ VENDOR_ID: "2" });

      const result = await GetOwnProduct(products, frontierProduct);

      expect(result).toBeDefined();
      expect(result?.vendorId).toBe(2);
    });
  });

  describe("GetCronGeneric", () => {
    it("should generate cron expression for MIN time unit", () => {
      const result = GetCronGeneric("MIN", 5, 1);

      expect(result).toMatch(/^\d+(,\d+)* \* \* \* \*$/);
      expect(result).toContain("1");
    });

    it("should generate cron expression for MIN with different offset", () => {
      const result = GetCronGeneric("MIN", 10, 3);

      expect(result).toMatch(/^\d+(,\d+)* \* \* \* \*$/);
      expect(result).toContain("3");
    });

    it("should generate cron expression for MIN with null offset", () => {
      const result = GetCronGeneric("MIN", 5, null as any);

      expect(result).toMatch(/^1(,\d+)* \* \* \* \*$/);
    });

    it("should generate cron expression for HOURS time unit", () => {
      const result = GetCronGeneric("HOURS", 2, 1);

      expect(result).toBe("0 1-23/2 * * *");
    });

    it("should generate cron expression for HOURS with offset >= 23", () => {
      const result = GetCronGeneric("HOURS", 2, 23);

      expect(result).toBe("0 1-23/2 * * *");
    });

    it("should generate cron expression for HOURS with offset > 23", () => {
      const result = GetCronGeneric("HOURS", 2, 25);

      expect(result).toBe("0 1-23/2 * * *");
    });

    it("should generate cron expression for DAYS time unit", () => {
      const result = GetCronGeneric("DAYS", 3, 1);

      expect(result).toBe("0 0 1-31/3 * *");
    });

    it("should generate cron expression for DAYS with offset >= 31", () => {
      const result = GetCronGeneric("DAYS", 3, 31);

      expect(result).toBe("0 0 1-31/3 * *");
    });

    it("should generate cron expression for DAYS with offset > 31", () => {
      const result = GetCronGeneric("DAYS", 3, 35);

      expect(result).toBe("0 0 1-31/3 * *");
    });

    it("should generate cron expression for SEC time unit", () => {
      const result = GetCronGeneric("SEC", 30, 0);

      expect(result).toBe("*/30 * * * * *");
    });

    it("should return empty string for unknown time unit", () => {
      const result = GetCronGeneric("UNKNOWN", 5, 1);

      expect(result).toBe("");
    });

    it("should handle case-insensitive time unit", () => {
      const result1 = GetCronGeneric("min", 5, 1);
      const result2 = GetCronGeneric("Min", 5, 1);
      const result3 = GetCronGeneric("MIN", 5, 1);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe("IsEligibleForReprice", () => {
    it("should return true when mpid is not in error list", async () => {
      const contextErrorItemsList = [{ mpId: 11111 }, { mpId: 22222 }];

      const result = await IsEligibleForReprice(contextErrorItemsList, 12345);

      expect(result).toBe(true);
    });

    it("should return false when mpid is in error list", async () => {
      const contextErrorItemsList = [{ mpId: 11111 }, { mpId: 12345 }, { mpId: 22222 }];

      const result = await IsEligibleForReprice(contextErrorItemsList, 12345);

      expect(result).toBe(false);
    });

    it("should return true when error list is empty", async () => {
      const contextErrorItemsList: any[] = [];

      const result = await IsEligibleForReprice(contextErrorItemsList, 12345);

      expect(result).toBe(true);
    });

    it("should handle string mpid", async () => {
      const contextErrorItemsList = [{ mpId: "12345" }];

      const result = await IsEligibleForReprice(contextErrorItemsList, "12345");

      expect(result).toBe(false);
    });

    it("should handle number mpid", async () => {
      const contextErrorItemsList = [{ mpId: 12345 }];

      const result = await IsEligibleForReprice(contextErrorItemsList, 12345);

      expect(result).toBe(false);
    });
  });

  describe("GetLastExistingPrice", () => {
    it("should return price from latest_price when available and not zero", async () => {
      const productDetails = {
        latest_price: "15.50",
        lastExistingPrice: "10.00",
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(15.5);
    });

    it("should return price from lastExistingPrice when latest_price is zero", async () => {
      const productDetails = {
        latest_price: 0,
        lastExistingPrice: "12.75",
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(12.75);
    });

    it("should return price from lastExistingPrice when latest_price is not set", async () => {
      const productDetails = {
        lastExistingPrice: "9.99",
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(9.99);
    });

    it("should parse price breaks string and extract price for minQty 1", async () => {
      const productDetails = {
        latest_price: "1@10.50/5@9.50/10@8.50",
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(10.5);
    });

    it("should handle price breaks with whitespace", async () => {
      const productDetails = {
        latest_price: "1@ 10.50 /5@9.50",
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(10.5);
    });

    it("should return 0 when no price information available", async () => {
      const productDetails = {};

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(0);
    });

    it("should return 0 when lastExistingPrice is null", async () => {
      const productDetails = {
        latest_price: null,
        lastExistingPrice: null,
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(0);
    });

    it("should return 0 when lastExistingPrice is undefined", async () => {
      const productDetails = {
        latest_price: undefined,
        lastExistingPrice: undefined,
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(0);
    });

    it("should handle price breaks without minQty 1", async () => {
      const productDetails = {
        latest_price: "5@9.50/10@8.50",
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(0);
    });

    it("should handle empty price breaks string", async () => {
      const productDetails = {
        latest_price: "",
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(0);
    });

    it("should handle price breaks with empty segments", async () => {
      const productDetails = {
        latest_price: "1@10.50//5@9.50",
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(10.5);
    });

    it("should handle price breaks with whitespace-only segments", async () => {
      const productDetails = {
        latest_price: "1@10.50/  /5@9.50",
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(10.5);
    });

    it("should parse simple numeric string", async () => {
      const productDetails = {
        lastExistingPrice: "25.99",
      };

      const result = await GetLastExistingPrice(productDetails);

      expect(result).toBe(25.99);
    });
  });

  describe("MapOverrideExecutionPriority", () => {
    it("should map priority for tradentDetails", () => {
      const productDetails = {
        tradentDetails: { executionPriority: 0 },
      };
      const priorityList = {
        tradent_priority: "5",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.tradentDetails.executionPriority).toBe(5);
    });

    it("should map priority for frontierDetails", () => {
      const productDetails = {
        frontierDetails: { executionPriority: 0 },
      };
      const priorityList = {
        frontier_priority: "10",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.frontierDetails.executionPriority).toBe(10);
    });

    it("should map priority for mvpDetails", () => {
      const productDetails = {
        mvpDetails: { executionPriority: 0 },
      };
      const priorityList = {
        mvp_priority: "15",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.mvpDetails.executionPriority).toBe(15);
    });

    it("should map priority for topDentDetails", () => {
      const productDetails = {
        topDentDetails: { executionPriority: 0 },
      };
      const priorityList = {
        topDent_priority: "20",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.topDentDetails.executionPriority).toBe(20);
    });

    it("should map firstDentDetails to mvpDetails.firstDentDetails", () => {
      const productDetails = {
        mvpDetails: { executionPriority: 0 },
      };
      const priorityList = {
        firstDent_priority: "25",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.mvpDetails.firstDentDetails).toBe(25);
    });

    it("should map priority for triadDetails", () => {
      const productDetails = {
        triadDetails: { executionPriority: 0 },
      };
      const priorityList = {
        triad_priority: "30",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.triadDetails.executionPriority).toBe(30);
    });

    it("should map priority for biteSupplyDetails", () => {
      const productDetails = {
        biteSupplyDetails: { executionPriority: 0 },
      };
      const priorityList = {
        biteSupply_priority: "35",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.biteSupplyDetails.executionPriority).toBe(35);
    });

    it("should map all priorities when all details exist", () => {
      const productDetails = {
        tradentDetails: { executionPriority: 0 },
        frontierDetails: { executionPriority: 0 },
        mvpDetails: { executionPriority: 0 },
        topDentDetails: { executionPriority: 0 },
        triadDetails: { executionPriority: 0 },
        biteSupplyDetails: { executionPriority: 0 },
      };
      const priorityList = {
        tradent_priority: "1",
        frontier_priority: "2",
        mvp_priority: "3",
        topDent_priority: "4",
        firstDent_priority: "5",
        triad_priority: "6",
        biteSupply_priority: "7",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.tradentDetails.executionPriority).toBe(1);
      expect(result.frontierDetails.executionPriority).toBe(2);
      expect(result.mvpDetails.executionPriority).toBe(3);
      expect(result.topDentDetails.executionPriority).toBe(4);
      expect(result.mvpDetails.firstDentDetails).toBe(5);
      expect(result.triadDetails.executionPriority).toBe(6);
      expect(result.biteSupplyDetails.executionPriority).toBe(7);
    });

    it("should not modify details that don't exist", () => {
      const productDetails = {
        tradentDetails: { executionPriority: 0 },
      };
      const priorityList = {
        tradent_priority: "5",
        frontier_priority: "10",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.tradentDetails.executionPriority).toBe(5);
      expect(result.frontierDetails).toBeUndefined();
    });

    it("should handle string priority values", () => {
      const productDetails = {
        tradentDetails: { executionPriority: 0 },
      };
      const priorityList = {
        tradent_priority: "100",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.tradentDetails.executionPriority).toBe(100);
    });

    it("should handle invalid priority values", () => {
      const productDetails = {
        tradentDetails: { executionPriority: 0 },
      };
      const priorityList = {
        tradent_priority: "invalid",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result.tradentDetails.executionPriority).toBeNaN();
    });

    it("should return the same productDetails object", () => {
      const productDetails = {
        tradentDetails: { executionPriority: 0 },
      };
      const priorityList = {
        tradent_priority: "5",
      };

      const result = MapOverrideExecutionPriority(productDetails, priorityList);

      expect(result).toBe(productDetails);
    });
  });

  describe("getMinuteString (indirectly tested via GetCronGeneric)", () => {
    it("should generate minute string with offset 1 and duration 5", () => {
      const result = GetCronGeneric("MIN", 5, 1);
      const minutes = result.split(" ")[0];

      expect(minutes).toContain("1");
      expect(minutes).toContain("6");
      expect(minutes).toContain("11");
    });

    it("should generate minute string with offset 3 and duration 10", () => {
      const result = GetCronGeneric("MIN", 10, 3);
      const minutes = result.split(" ")[0];

      expect(minutes).toContain("3");
      expect(minutes).toContain("13");
      expect(minutes).toContain("23");
    });

    it("should handle duration that exceeds 60 minutes", () => {
      const result = GetCronGeneric("MIN", 70, 1);
      const minutes = result.split(" ")[0];

      // Should only contain offset since duration + offset >= 60
      expect(minutes).toBe("1");
    });

    it("should handle offset + duration >= 60", () => {
      const result = GetCronGeneric("MIN", 50, 15);
      const minutes = result.split(" ")[0];

      // Should only contain offset since 15 + 50 >= 60
      expect(minutes).toBe("15");
    });

    it("should generate multiple minute values when possible", () => {
      const result = GetCronGeneric("MIN", 15, 5);
      const minutes = result.split(" ")[0];
      const minuteArray = minutes.split(",");

      expect(minuteArray.length).toBeGreaterThan(1);
      expect(minuteArray).toContain("5");
      expect(minuteArray).toContain("20");
      expect(minuteArray).toContain("35");
      expect(minuteArray).toContain("50");
    });
  });
});
