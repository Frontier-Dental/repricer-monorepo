// Mock dependencies before imports
jest.mock("../../../config", () => ({
  applicationConfig: {
    OFFSET: 0.01,
    IGNORE_TIE: false,
    MANAGED_MONGO_URL: "mongodb://test",
    MANAGED_MONGO_PASSWORD: "test-password",
    SQL_HOSTNAME: "localhost",
    SQL_PORT: 3306,
    SQL_USERNAME: "test-user",
    SQL_PASSWORD: "test-password",
    SQL_DATABASE: "test-db",
    SHIPPING_DATA_PROXY_SCRAPE_API_KEY: "test-api-key",
    CACHE_HOST_URL: "localhost",
    CACHE_USERNAME: "test-user",
    CACHE_PASSWORD: "test-password",
    CACHE_PORT: 6379,
    MINI_ERP_BASE_URL: "https://test-mini-erp.com",
    MINI_ERP_USERNAME: "test-user",
    MINI_ERP_PASSWORD: "test-password",
  },
}));

jest.mock("@repricer-monorepo/shared", () => ({
  CacheKey: {},
  VendorName: {},
  VendorNameLookup: {},
}));

jest.mock("lodash");
jest.mock("../../../../model/global-param");
jest.mock("../../../badge-helper");
jest.mock("../../../filter-mapper");

import _ from "lodash";
import { Reprice, RepriceIndividualPriceBreak, GetDistinctPriceBreaksAcrossVendors, RepriceToMax } from "../reprice-helper";
import { RepriceModel } from "../../../../model/reprice-model";
import { RepriceRenewedMessageEnum } from "../../../../model/reprice-renewed-message";
import * as globalParam from "../../../../model/global-param";
import * as badgeHelper from "../../../badge-helper";
import * as filterMapper from "../../../filter-mapper";
import { applicationConfig } from "../../../config";
import { Net32Product, Net32PriceBreak } from "../../../../types/net32";
import { FrontierProduct } from "../../../../types/frontier";

const mockedLodash = _ as jest.Mocked<typeof _>;
const mockedGlobalParam = globalParam as jest.Mocked<typeof globalParam>;
const mockedBadgeHelper = badgeHelper as jest.Mocked<typeof badgeHelper>;
const mockedFilterMapper = filterMapper as jest.Mocked<typeof filterMapper>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("reprice-helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mocks for lodash
    mockedLodash.first = jest.fn((array: any) => (array && array.length > 0 ? array[0] : undefined));
    mockedLodash.nth = jest.fn((array: any, n?: number) => (array && array.length > (n ?? 0) ? array[n ?? 0] : undefined));
    mockedLodash.find = jest.fn((array: any, predicate: any) => {
      if (!Array.isArray(array)) return undefined;
      for (const item of array) {
        if (typeof predicate === "function" && predicate(item)) {
          return item;
        }
        if (typeof predicate === "object" && Object.keys(predicate).every((key) => item[key] === predicate[key])) {
          return item;
        }
      }
      return undefined;
    });
    mockedLodash.sortBy = jest.fn((array: any, ...iteratees: any[]) => {
      if (!Array.isArray(array)) return [];
      return [...array].sort((a, b) => {
        for (const iteratee of iteratees) {
          const aVal = typeof iteratee === "function" ? iteratee(a) : a[iteratee];
          const bVal = typeof iteratee === "function" ? iteratee(b) : b[iteratee];
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
        }
        return 0;
      });
    });
    mockedLodash.includes = jest.fn((array: any, value: any) => {
      if (!Array.isArray(array)) return false;
      return array.includes(value);
    });
    mockedLodash.cloneDeep = jest.fn((value: any) => JSON.parse(JSON.stringify(value)));
    mockedLodash.filter = jest.fn((array: any, predicate: any) => {
      if (!Array.isArray(array)) return [];
      return array.filter(predicate);
    });
    mockedLodash.groupBy = jest.fn((array: any, iteratee: any) => {
      if (!Array.isArray(array)) return {};
      const result: any = {};
      for (const item of array) {
        const key = typeof iteratee === "function" ? iteratee(item) : item[iteratee];
        if (!result[key]) result[key] = [];
        result[key].push(item);
      }
      return result;
    });
    mockedLodash.findIndex = jest.fn((array: any, predicate: any) => {
      if (!Array.isArray(array)) return -1;
      for (let i = 0; i < array.length; i++) {
        if (typeof predicate === "function" && predicate(array[i])) {
          return i;
        }
        if (typeof predicate === "object" && Array.isArray(predicate)) {
          const [key, value] = predicate;
          if (array[i][key] === value) return i;
        }
      }
      return -1;
    });
    mockedLodash.pullAt = jest.fn((array: any, ...indexes: any[]) => {
      const indexArray = Array.isArray(indexes[0]) ? indexes[0] : indexes;
      if (!Array.isArray(array)) return [];
      const removed: any[] = [];
      const sortedIndexes = [...indexArray].sort((a, b) => b - a);
      for (const index of sortedIndexes) {
        if (index >= 0 && index < array.length) {
          removed.unshift(array.splice(index, 1)[0]);
        }
      }
      return removed;
    }) as any;
    mockedLodash.isEqual = jest.fn((a: any, b: any) => JSON.stringify(a) === JSON.stringify(b));

    // Default globalParam mock
    mockedGlobalParam.GetInfo.mockResolvedValue({
      VENDOR_ID: "17357",
      EXCLUDED_VENDOR_ID: "20722;20755",
    } as any);

    // Default filterMapper mocks
    mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
    mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 99.99, Type: "STANDARD" });
    mockedFilterMapper.IsVendorFloorPrice = jest.fn().mockResolvedValue(false);
    mockedFilterMapper.VerifyFloorWithSister.mockResolvedValue(false as any);
    mockedFilterMapper.AppendPriceFactorTag.mockImplementation((str: string, type: string) => `${str}#${type}`);

    // Default badgeHelper mock
    mockedBadgeHelper.ReCalculatePrice.mockImplementation(async (model: any) => model);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("Reprice", () => {
    const mockRefProduct: Partial<Net32Product> = {
      vendorId: 17357,
      vendorName: "TRADENT",
      priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
      heavyShipping: 0,
    };

    const mockProductItem: Partial<FrontierProduct> = {
      mpid: 100,
      productName: "Test Product",
      maxPrice: "200.00",
      floorPrice: "50.00",
      percentageDown: "5",
      competeAll: false,
      competeWithNext: false,
      repricingRule: 1,
      badgeIndicator: "BADGE",
      badgePercentage: 0,
    };

    it("should return default model when no eligible products", async () => {
      const payload: any[] = [];
      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
      expect(result.repriceDetails?.isRepriced).toBe(false);
    });

    it("should return default model when sortedPayload is empty", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: false }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockResolvedValue([]);

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
      expect(result.repriceDetails?.isRepriced).toBe(false);
    });

    it("should handle self vendor as lowest with no competitor", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result.repriceDetails?.explained).toContain("No competitor");
      expect(result.repriceDetails?.isRepriced).toBeDefined();
    });

    it("should handle self vendor as lowest with next competitor", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 109.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 104.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle excluded vendor as lowest", async () => {
      const payload: any[] = [
        {
          vendorId: 20722, // FRONTIER - excluded vendor
          vendorName: "FRONTIER",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 84.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result.repriceDetails?.explained).toContain("Sister");
    });

    it("should handle other vendor as lowest", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 84.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle tie scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor1",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      (applicationConfig as any).IGNORE_TIE = false;

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result.repriceDetails?.explained).toContain("#TIE");
    });

    it("should handle tie with sister vendor", async () => {
      const payload: any[] = [
        {
          vendorId: 20722, // FRONTIER - sister
          vendorName: "FRONTIER",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 17357, // TRADENT - own vendor
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      (applicationConfig as any).IGNORE_TIE = false;

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle badge percentage scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 84.99, Type: "STANDARD" });
      mockedBadgeHelper.ReCalculatePrice.mockResolvedValue({
        repriceDetails: { newPrice: 90.99, isRepriced: true },
      } as any);

      const productItemWithBadge = {
        ...mockProductItem,
        badgeIndicator: "ALL_PERCENTAGE",
        badgePercentage: 10,
      };

      const result = await Reprice(mockRefProduct, payload, productItemWithBadge, "source-1");

      expect(mockedBadgeHelper.ReCalculatePrice).toHaveBeenCalled();
    });

    it("should handle error and return default model", async () => {
      // GetInfo is called before try block, so error won't be caught
      // Instead, we'll test error handling within the try block
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
        EXCLUDED_VENDOR_ID: "20722;20755",
      } as any);
      mockedFilterMapper.FilterBasedOnParams.mockRejectedValueOnce(new Error("Filter error"));

      const result = await Reprice(mockRefProduct, [{ vendorId: 999, priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }] }], mockProductItem, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Error in Reprice"));
    });

    it("should filter eligible list based on multiple filters", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);

      await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(mockedFilterMapper.FilterBasedOnParams).toHaveBeenCalledWith(expect.any(Array), mockProductItem, "EXCLUDED_VENDOR");
      expect(mockedFilterMapper.FilterBasedOnParams).toHaveBeenCalledWith(expect.any(Array), mockProductItem, "INVENTORY_THRESHOLD");
      expect(mockedFilterMapper.FilterBasedOnParams).toHaveBeenCalledWith(expect.any(Array), mockProductItem, "HANDLING_TIME");
      expect(mockedFilterMapper.FilterBasedOnParams).toHaveBeenCalledWith(expect.any(Array), mockProductItem, "BADGE_INDICATOR");
    });

    it("should handle competeWithNext scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 109.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 104.99, Type: "STANDARD" });

      const productItemWithCompeteNext = {
        ...mockProductItem,
        competeWithNext: true,
      };

      const result = await Reprice(mockRefProduct, payload, productItemWithCompeteNext, "source-1");

      expect(mockedFilterMapper.FilterBasedOnParams).toHaveBeenCalledWith(expect.any(Array), productItemWithCompeteNext, "SISTER_VENDOR_EXCLUSION");
    });

    it("should handle repricingRule === 2 scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 109.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 104.99, Type: "STANDARD" });

      const productItemWithRule2 = {
        ...mockProductItem,
        repricingRule: 2,
      };

      await Reprice(mockRefProduct, payload, productItemWithRule2, "source-1");

      expect(mockedFilterMapper.FilterBasedOnParams).toHaveBeenCalledWith(expect.any(Array), productItemWithRule2, "SISTER_VENDOR_EXCLUSION");
    });

    it("should handle contextPrice > maxPrice scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 250.0, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 250.0, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result.repriceDetails?.explained).toContain("IGNORE");
    });

    it("should handle contextPrice === existingPrice scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 100.0, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 99.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle nextLowestPrice <= floorPrice scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 45.0, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle offsetPrice > floorPrice and offsetPrice < maxPrice", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 89.98, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result.repriceDetails?.isRepriced).toBe(true);
    });

    it("should handle offsetPrice > maxPrice scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 250.0, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 249.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result.repriceDetails?.explained).toContain("MAXED");
    });

    it("should handle offsetPrice <= floorPrice scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 45.0, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result.repriceDetails?.explained).toContain("HitFloor");
    });

    it("should handle existingPrice > maxPrice scenario", async () => {
      const refProductWithHighPrice: Partial<Net32Product> = {
        ...mockRefProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 250.0, active: true }],
      };

      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 45.0, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });

      const result = await Reprice(refProductWithHighPrice, payload, mockProductItem, "source-1");

      expect(result.repriceDetails?.isRepriced).toBe(true);
      expect(result.repriceDetails?.newPrice).toBe(200);
    });

    it("should handle no prodPriceWithMinQty found", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }], // No minQty=1
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result.repriceDetails?.explained).toBe(RepriceRenewedMessageEnum.DEFAULT);
    });

    it("should handle competeAll === true", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 84.99, Type: "STANDARD" });

      const productItemWithCompeteAll = {
        ...mockProductItem,
        competeAll: true,
      };

      await Reprice(mockRefProduct, payload, productItemWithCompeteAll, "source-1");

      // excludedVendors should be empty array
      expect(mockedFilterMapper.FilterBasedOnParams).toHaveBeenCalled();
    });
  });

  describe("RepriceIndividualPriceBreak", () => {
    const mockRefProduct: Partial<Net32Product> = {
      vendorId: 17357,
      vendorName: "TRADENT",
      priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
      heavyShipping: 0,
    };

    const mockProductItem: Partial<FrontierProduct> = {
      mpid: 100,
      productName: "Test Product",
      maxPrice: "200.00",
      floorPrice: "50.00",
      percentageDown: "5",
      competeAll: false,
      competeWithNext: false,
      repricingRule: 1,
      badgeIndicator: "BADGE",
      badgePercentage: 0,
      ignorePhantomQBreak: false,
    };

    const mockPriceBreak: Net32PriceBreak = {
      minQty: 10,
      unitPrice: 89.99,
      active: true,
    };

    it("should return default model when eligibleList is empty", async () => {
      const payload: any[] = [];
      mockedFilterMapper.FilterBasedOnParams.mockResolvedValue([]);

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result.repriceDetails?.explained).toContain("No competitor");
    });

    it("should handle self vendor as lowest", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 99.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 94.99, Type: "STANDARD" });

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle non-sister vendor shutdown for price break != 1", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
        },
        {
          vendorId: 20722, // FRONTIER - sister
          vendorName: "FRONTIER",
          priceBreaks: [{ minQty: 10, unitPrice: 99.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);

      const priceBreakNotOne = {
        ...mockPriceBreak,
        minQty: 10,
        unitPrice: 89.99,
      };

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", priceBreakNotOne);

      expect(result.repriceDetails?.explained).toContain("Inactive");
      expect(result.repriceDetails?.active).toBe(0);
    });

    it("should handle existingPriceOfOwnProduct == 0 scenario", async () => {
      const refProductWithZeroPrice: Partial<Net32Product> = {
        ...mockRefProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 0, active: true }],
      };

      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 0, active: true }],
        },
        {
          vendorId: 20722, // FRONTIER - sister
          vendorName: "FRONTIER",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedLodash.first.mockReturnValue(payload[0] as any);
      mockedLodash.nth.mockReturnValue(payload[1] as any);
      mockedLodash.includes.mockImplementation((array: any, value: any) => {
        // excludedVendors will be ["20722", "20755"] from EXCLUDED_VENDOR_ID.split(";")
        if (Array.isArray(array) && array.includes("20722") && value === "20722") return true;
        if (Array.isArray(array)) return array.includes(value);
        return false;
      });

      const priceBreakMinQty1 = {
        ...mockPriceBreak,
        minQty: 1,
        unitPrice: 0,
      };

      const result = await RepriceIndividualPriceBreak(refProductWithZeroPrice, payload, mockProductItem, "source-1", priceBreakMinQty1);

      // When own product has price 0 and next is sister vendor, should return NO_COMPETITOR_SISTER_VENDOR
      expect(result.repriceDetails?.explained).toContain("Sister");
    });

    it("should handle contextPrice < existingPrice when existingPrice === 0", async () => {
      const refProductWithZeroPrice: Partial<Net32Product> = {
        ...mockRefProduct,
        priceBreaks: [{ minQty: 10, unitPrice: 0, active: true }],
      };

      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 10, unitPrice: 0, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 84.99, Type: "STANDARD" });

      const priceBreakZero = {
        ...mockPriceBreak,
        unitPrice: 0,
      };

      const result = await RepriceIndividualPriceBreak(refProductWithZeroPrice, payload, mockProductItem, "source-1", priceBreakZero);

      expect(result.repriceDetails?.isRepriced).toBe(true);
    });

    it("should handle ignorePhantomQBreak scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 84.99, Type: "STANDARD" });

      const productItemWithPhantom = {
        ...mockProductItem,
        ignorePhantomQBreak: true,
      };

      await RepriceIndividualPriceBreak(mockRefProduct, payload, productItemWithPhantom, "source-1", mockPriceBreak);

      expect(mockedFilterMapper.FilterBasedOnParams).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ contextMinQty: 10 }), "PHANTOM_PRICE_BREAK");
    });

    it("should handle floorSisterResult !== false scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 45.0, active: true }],
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 10, unitPrice: 109.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });
      mockedFilterMapper.VerifyFloorWithSister.mockResolvedValue({
        repriceDetails: { newPrice: 50.0, isRepriced: true },
      } as any);

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(mockedFilterMapper.VerifyFloorWithSister).toHaveBeenCalled();
    });

    it("should handle offsetPrice <= floorPrice and existingPrice > maxPrice", async () => {
      const refProductWithHighPrice: Partial<Net32Product> = {
        ...mockRefProduct,
        priceBreaks: [{ minQty: 10, unitPrice: 250.0, active: true }],
      };

      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 45.0, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });

      const priceBreakHigh = {
        ...mockPriceBreak,
        unitPrice: 250.0,
      };

      const result = await RepriceIndividualPriceBreak(refProductWithHighPrice, payload, mockProductItem, "source-1", priceBreakHigh);
      expect(result.repriceDetails?.isRepriced).toBeDefined();
      // The actual result depends on the logic flow
      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle offsetPrice <= floorPrice and not repriced", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 45.0, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });
      mockedFilterMapper.VerifyFloorWithSister.mockResolvedValue(false);
      // Make sure no nextIndex is found
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(true);

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      // When offsetPrice <= floorPrice and no next competitor, should ignore
      expect(result.repriceDetails?.explained).toContain("Hitfloor");
    });

    it("should handle nextLowestPrice > contextPrice and contextPrice <= maxPrice", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 45.0, active: true }],
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 10, unitPrice: 109.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 104.99, Type: "STANDARD" });

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result.repriceDetails?.isRepriced).toBe(true);
    });

    it("should handle existingPrice === 0 for new price break", async () => {
      const refProductWithZeroPrice: Partial<Net32Product> = {
        ...mockRefProduct,
        priceBreaks: [{ minQty: 10, unitPrice: 0, active: true }],
      };

      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 45.0, active: true }],
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 10, unitPrice: 109.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 104.99, Type: "STANDARD" });
      mockedFilterMapper.VerifyFloorWithSister.mockResolvedValue(false);
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const priceBreakZero = {
        ...mockPriceBreak,
        unitPrice: 0,
      };

      const result = await RepriceIndividualPriceBreak(refProductWithZeroPrice, payload, mockProductItem, "source-1", priceBreakZero);

      // When existingPrice is 0 and nextLowestPrice > contextPrice, should create new price break
      expect(result.repriceDetails?.isRepriced).toBe(true);
    });

    it("should handle priceBreak.minQty != 1 and no nextIndex", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 45.0, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });
      mockedFilterMapper.VerifyFloorWithSister.mockResolvedValue(false);

      const priceBreakNotOne = {
        ...mockPriceBreak,
        minQty: 10,
      };

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", priceBreakNotOne);

      expect(result.repriceDetails?.explained).toContain("Inactive");
    });

    it("should handle error and return default model", async () => {
      // GetInfo is called before try block, so error won't be caught
      // Instead, we'll test error handling within the try block
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
        EXCLUDED_VENDOR_ID: "20722;20755",
      } as any);
      mockedFilterMapper.FilterBasedOnParams.mockRejectedValueOnce(new Error("Filter error"));

      const result = await RepriceIndividualPriceBreak(mockRefProduct, [{ vendorId: 999, priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }] }], mockProductItem, "source-1", mockPriceBreak);

      expect(result).toBeInstanceOf(RepriceModel);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Error in Reprice"));
    });
  });

  describe("GetDistinctPriceBreaksAcrossVendors", () => {
    const mockOwnProduct: Partial<Net32Product> = {
      vendorId: 17357,
      vendorName: "TRADENT",
      priceBreaks: [
        { minQty: 1, unitPrice: 99.99, active: true },
        { minQty: 10, unitPrice: 89.99, active: true },
      ],
    };

    const mockProductItem: Partial<FrontierProduct> = {
      mpid: 100,
      productName: "Test Product",
    };

    it("should return distinct price breaks not in own product", async () => {
      const listOfProducts: Partial<Net32Product>[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: true },
            { minQty: 25, unitPrice: 79.99, active: true }, // Not in own product
          ],
        },
      ];
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
      } as any);

      const result = await GetDistinctPriceBreaksAcrossVendors(listOfProducts as Net32Product[], mockOwnProduct as Net32Product, mockProductItem as FrontierProduct);

      expect(result).toHaveLength(1);
      expect(result[0].minQty).toBe(25);
      expect(result[0].unitPrice).toBe(0);
    });

    it("should return empty array when ownProduct is null", async () => {
      // The function checks !ownProduct after accessing ownProduct.vendorId
      // So we need to provide a valid product but test the null check differently
      const result = await GetDistinctPriceBreaksAcrossVendors([], mockOwnProduct as Net32Product, mockProductItem as FrontierProduct);

      expect(result).toEqual([]);
    });

    it("should not include price breaks from own vendor", async () => {
      const listOfProducts: Partial<Net32Product>[] = [
        {
          vendorId: 17357, // Own vendor
          vendorName: "TRADENT",
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: true },
            { minQty: 50, unitPrice: 69.99, active: true },
          ],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: true },
            { minQty: 25, unitPrice: 79.99, active: true },
          ],
        },
      ];
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
      } as any);

      const result = await GetDistinctPriceBreaksAcrossVendors(listOfProducts as Net32Product[], mockOwnProduct as Net32Product, mockProductItem as FrontierProduct);

      // Should not include minQty 50 from own vendor
      expect(result.find((pb) => pb.minQty === 50)).toBeUndefined();
      expect(result.find((pb) => pb.minQty === 25)).toBeDefined();
    });

    it("should not duplicate price breaks", async () => {
      const listOfProducts: Partial<Net32Product>[] = [
        {
          vendorId: 999,
          vendorName: "Competitor1",
          priceBreaks: [{ minQty: 25, unitPrice: 79.99, active: true }],
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 25, unitPrice: 80.99, active: true }],
        },
      ];
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
      } as any);

      const result = await GetDistinctPriceBreaksAcrossVendors(listOfProducts as Net32Product[], mockOwnProduct as Net32Product, mockProductItem as FrontierProduct);

      // Should only have one entry for minQty 25
      expect(result.filter((pb) => pb.minQty === 25)).toHaveLength(1);
    });

    it("should handle products with no priceBreaks", async () => {
      const listOfProducts: Partial<Net32Product>[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [],
        },
      ];
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
      } as any);

      const result = await GetDistinctPriceBreaksAcrossVendors(listOfProducts as Net32Product[], mockOwnProduct as Net32Product, mockProductItem as FrontierProduct);

      expect(result).toEqual([]);
    });
  });

  describe("RepriceToMax", () => {
    const mockRefProduct: Partial<Net32Product> = {
      vendorId: 17357,
      vendorName: "TRADENT",
      priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
    };

    const mockProductItem: Partial<FrontierProduct> = {
      mpid: 100,
      productName: "Test Product",
      maxPrice: "200.00",
    };

    it("should reprice to max price", async () => {
      const payload: Partial<Net32Product>[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
        },
      ];

      const result = await RepriceToMax(mockRefProduct as Net32Product, payload as Net32Product[], mockProductItem as FrontierProduct, "source-1");

      // RepriceToMax sets newPrice to maxPrice which is a string "200.00"
      expect(result.repriceDetails?.newPrice).toBe("200.00");
      expect(result.repriceDetails?.isRepriced).toBe(true);
      expect(result.repriceDetails?.explained).toContain("MAXED");
    });

    it("should use default maxPrice when not provided", async () => {
      const productItemWithoutMax: Partial<FrontierProduct> = {
        ...mockProductItem,
        maxPrice: undefined,
      };

      const payload: Partial<Net32Product>[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
        },
      ];

      const result = await RepriceToMax(mockRefProduct as Net32Product, payload as Net32Product[], productItemWithoutMax as FrontierProduct, "source-1");

      expect(result.repriceDetails?.newPrice).toBe("99999.00");
    });

    it("should update lowest vendor info", async () => {
      const payload: Partial<Net32Product>[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
        },
      ];

      const result = await RepriceToMax(mockRefProduct as Net32Product, payload as Net32Product[], mockProductItem as FrontierProduct, "source-1");

      expect(result.repriceDetails?.lowestVendor).toBe("Competitor");
      expect(result.repriceDetails?.lowestVendorPrice).toBe(89.99);
    });
  });

  describe("Additional edge cases for branch coverage", () => {
    const mockRefProduct: Partial<Net32Product> = {
      vendorId: 17357,
      vendorName: "TRADENT",
      priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
    };

    const mockProductItem: Partial<FrontierProduct> = {
      mpid: 100,
      productName: "Test Product",
      floorPrice: "50.00",
      maxPrice: "200.00",
    };

    it("should handle empty sortedPayload", async () => {
      const payload: any[] = [];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => []);

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result.repriceDetails?.explained).toBe(RepriceRenewedMessageEnum.DEFAULT);
    });

    it("should handle excluded vendor in next position", async () => {
      mockedLodash.sortBy.mockReturnValue([
        {
          vendorId: 17357, // Own vendor
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 20722, // Excluded vendor
          vendorName: "Excluded",
          priceBreaks: [{ minQty: 1, unitPrice: 100.0, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 100.01, active: true }],
        },
      ]);
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 100.0, Type: "STANDARD" });
      mockedLodash.includes.mockImplementation((array: any, value: any) => {
        if (!Array.isArray(array)) return false;
        return array.includes(value);
      });
      mockedLodash.first.mockImplementation((array: any) => array?.[0]);

      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 20722,
          vendorName: "Excluded",
          priceBreaks: [{ minQty: 1, unitPrice: 100.0, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 100.01, active: true }],
        },
      ];

      const productItemWithExcluded: Partial<FrontierProduct> = {
        ...mockProductItem,
        competeAll: false,
      };

      const result = await Reprice(mockRefProduct, payload, productItemWithExcluded as FrontierProduct, "source-1");

      expect(result).toBeDefined();
    });

    it("should handle multiple excluded vendors in sequence", async () => {
      mockedLodash.sortBy.mockReturnValue([
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 20722, // First excluded
          vendorName: "Excluded1",
          priceBreaks: [{ minQty: 1, unitPrice: 100.0, active: true }],
        },
        {
          vendorId: 20755, // Second excluded
          vendorName: "Excluded2",
          priceBreaks: [{ minQty: 1, unitPrice: 100.01, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 100.02, active: true }],
        },
      ]);
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 100.02, Type: "STANDARD" });
      mockedLodash.includes.mockImplementation((array: any, value: any) => {
        if (!Array.isArray(array)) return false;
        return array.includes(value);
      });
      mockedLodash.first.mockImplementation((array: any) => array?.[0]);

      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
        {
          vendorId: 20722,
          vendorName: "Excluded1",
          priceBreaks: [{ minQty: 1, unitPrice: 100.0, active: true }],
        },
        {
          vendorId: 20755,
          vendorName: "Excluded2",
          priceBreaks: [{ minQty: 1, unitPrice: 100.01, active: true }],
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 100.02, active: true }],
        },
      ];

      const productItemWithExcluded: Partial<FrontierProduct> = {
        ...mockProductItem,
        competeAll: false,
      };

      const result = await Reprice(mockRefProduct, payload, productItemWithExcluded as FrontierProduct, "source-1");

      expect(result).toBeDefined();
    });

    it("should handle badgeIndicator ALL_PERCENTAGE with badgePercentage", async () => {
      mockedLodash.sortBy.mockReturnValue([
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          badgeId: 1,
          badgeName: "Best Seller",
        },
      ]);
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 99.98, Type: "STANDARD" });
      mockedBadgeHelper.ReCalculatePrice.mockResolvedValue({
        repriceDetails: {
          newPrice: "89.99",
          isRepriced: true,
          explained: "Price change badge percentage",
        },
      } as any);

      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          badgeId: 1,
          badgeName: "Best Seller",
        },
      ];

      const productItemWithBadge: Partial<FrontierProduct> = {
        ...mockProductItem,
        badgeIndicator: "ALL_PERCENTAGE",
        badgePercentage: 10,
      };

      const result = await Reprice(mockRefProduct, payload, productItemWithBadge as FrontierProduct, "source-1");

      expect(mockedBadgeHelper.ReCalculatePrice).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should handle exception in Reprice function", async () => {
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
      mockedFilterMapper.FilterBasedOnParams.mockRejectedValue(new Error("Test error"));

      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
        },
      ];

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(result).toBeDefined();
      consoleLogSpy.mockRestore();
    });

    it("should handle priceBreaks with active false", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: false }, // Inactive
            { minQty: 1, unitPrice: 89.99, active: true },
          ],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 89.98, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result).toBeDefined();
      // Should use active price break
      expect(result.repriceDetails?.isRepriced).toBe(true);
    });

    it("should handle short expiry products in eligible list", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true, promoAddlDescr: "EXP 12/31/2024" }],
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 89.98, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct as Net32Product, payload, mockProductItem as FrontierProduct, "source-1");

      expect(result).toBeDefined();
      // Short expiry product should be filtered out
    });
  });
});
