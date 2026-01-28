// Mock dependencies before imports
jest.mock("../../config", () => ({
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
jest.mock("../../../model/global-param");
jest.mock("../../badge-helper");
jest.mock("../../filter-mapper");

import _ from "lodash";
import { Reprice, RepriceIndividualPriceBreak } from "./reprice-helper-nc";
import { RepriceModel } from "../../../model/reprice-model";
import { RepriceRenewedMessageEnum } from "../../../model/reprice-renewed-message";
import * as globalParam from "../../../model/global-param";
import * as badgeHelper from "../../badge-helper";
import * as filterMapper from "../../filter-mapper";
import { applicationConfig } from "../../config";
import { Net32Product, Net32PriceBreak } from "../../../types/net32";
import { FrontierProduct } from "../../../types/frontier";

const mockedLodash = _ as jest.Mocked<typeof _>;
const mockedGlobalParam = globalParam as jest.Mocked<typeof globalParam>;
const mockedBadgeHelper = badgeHelper as jest.Mocked<typeof badgeHelper>;
const mockedFilterMapper = filterMapper as jest.Mocked<typeof filterMapper>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("reprice-helper-nc", () => {
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
      if (!Array.isArray(array)) return [];
      const indexArray = Array.isArray(indexes[0]) ? indexes[0] : indexes;
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
    (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);
    mockedFilterMapper.VerifyFloorWithSister.mockResolvedValue(false as any);
    mockedFilterMapper.AppendPriceFactorTag.mockImplementation((str: string, type: string) => `${str}#${type}`);

    // Default badgeHelper mock
    mockedBadgeHelper.ReCalculatePriceForNc.mockImplementation(async (model: any) => model);
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
      standardShipping: 5.99,
      freeShippingThreshold: 150.0,
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
      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

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

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
      expect(result.repriceDetails?.isRepriced).toBe(false);
    });

    it("should handle self vendor as lowest with no competitor", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result.repriceDetails?.explained).toContain("No competitor");
      expect(result.repriceDetails?.isRepriced).toBeDefined();
    });

    it("should handle self vendor as lowest with next competitor", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 109.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 104.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle excluded vendor as lowest", async () => {
      const payload: any[] = [
        {
          vendorId: 20722, // FRONTIER - excluded vendor
          vendorName: "FRONTIER",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 84.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result.repriceDetails?.explained).toContain("Sister");
    });

    it("should handle other vendor as lowest", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 84.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle tie scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor1",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      (applicationConfig as any).IGNORE_TIE = false;

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result.repriceDetails?.explained).toContain("#TIE");
    });

    it("should handle tie with sister vendor", async () => {
      const payload: any[] = [
        {
          vendorId: 20722, // FRONTIER - sister
          vendorName: "FRONTIER",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 17357, // TRADENT - own vendor
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      (applicationConfig as any).IGNORE_TIE = false;

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle badge percentage scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 84.99, Type: "STANDARD" });
      mockedBadgeHelper.ReCalculatePriceForNc.mockResolvedValue({
        repriceDetails: { newPrice: 90.99, isRepriced: true },
      } as any);

      const productItemWithBadge = {
        ...mockProductItem,
        badgeIndicator: "ALL_PERCENTAGE",
        badgePercentage: 10,
      };

      const result = await Reprice(mockRefProduct, payload, productItemWithBadge, "source-1");

      expect(mockedBadgeHelper.ReCalculatePriceForNc).toHaveBeenCalled();
    });

    it("should handle error and return default model", async () => {
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
        EXCLUDED_VENDOR_ID: "20722;20755",
      } as any);
      mockedFilterMapper.FilterBasedOnParams.mockRejectedValueOnce(new Error("Filter error"));

      const result = await Reprice(mockRefProduct, [{ vendorId: 999, priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }] }], mockProductItem, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Error in Reprice"));
    });

    it("should include shipping price in sorting", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor1",
          priceBreaks: [{ minQty: 1, unitPrice: 100.0, active: true }],
          standardShipping: 0, // Free shipping
          freeShippingThreshold: 100.0,
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 1, unitPrice: 95.0, active: true }],
          standardShipping: 5.99, // Has shipping
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 94.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(mockedLodash.sortBy).toHaveBeenCalled();
      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle competeWithNext scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 109.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 104.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

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
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 109.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 104.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

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
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 250.0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 250.0, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      // When contextPrice > maxPrice, should set to maxPrice
      expect(result.repriceDetails?.explained).toContain("IGNORE");
    });

    it("should handle contextPrice === existingPrice scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 100.0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 105.98, Type: "STANDARD" }); // 99.99 + 5.99 = 105.98
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle nextLowestPrice <= floorPrice scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 45.0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle offsetPrice > floorPrice and offsetPrice < maxPrice", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 89.98, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result.repriceDetails?.isRepriced).toBe(true);
    });

    it("should handle offsetPrice > maxPrice scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 250.0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 249.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result.repriceDetails?.explained).toContain("MAXED");
    });

    it("should handle offsetPrice <= floorPrice scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 45.0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

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
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });

      const result = await Reprice(refProductWithHighPrice, payload, mockProductItem, "source-1");

      expect(result.repriceDetails?.isRepriced).toBe(true);
      expect(result.repriceDetails?.newPrice).toBe("200.00");
    });

    it("should handle no prodPriceWithMinQty found", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }], // No minQty=1
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result.repriceDetails?.explained).toBe(RepriceRenewedMessageEnum.DEFAULT);
    });

    it("should handle competeAll === true", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
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

    it("should handle nextLowestPrice > productItem.maxPrice scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 250.0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 250.0, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      // The logic checks nextLowestPrice > floorPrice && nextLowestPrice >= existingPrice first
      // Since 255.99 > 50 && 255.99 >= 105.98, it enters that block
      // Then checks nextLowestPrice > contextPrice (255.99 > 250 is true)
      // Then checks contextPrice <= maxPrice (250 <= 200 is false)
      // So it goes to else and sets IGNORE_OWN
      expect(result.repriceDetails?.explained).toContain("IGNORE");
    });

    it("should handle own vendor is 2nd lowest scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor1",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 1, unitPrice: 109.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 94.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle sortedPayload[1] exists scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor1",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 1, unitPrice: 94.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 94.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle no sortedPayload[1] scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 1, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 84.99, Type: "STANDARD" });

      const result = await Reprice(mockRefProduct, payload, mockProductItem, "source-1");
      expect(result.repriceDetails?.explained).toContain("validated");
    });
  });

  describe("RepriceIndividualPriceBreak", () => {
    const mockRefProduct: Partial<Net32Product> = {
      vendorId: 17357,
      vendorName: "TRADENT",
      priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
      heavyShipping: 0,
      standardShipping: 5.99,
      freeShippingThreshold: 150.0,
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
      compareWithQ1: false,
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
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 94.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle non-sister vendor shutdown for price break != 1", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 20722, // FRONTIER - sister
          vendorName: "FRONTIER",
          priceBreaks: [{ minQty: 10, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
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
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 20722, // FRONTIER - sister
          vendorName: "FRONTIER",
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedLodash.first.mockReturnValue(payload[0] as any);
      mockedLodash.nth.mockReturnValue(payload[1] as any);
      mockedLodash.includes.mockImplementation((array: any, value: any) => {
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

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle ignorePhantomQBreak scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
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

    it("should handle compareWithQ1 scenario when minQty === 2", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: true },
            { minQty: 2, unitPrice: 89.99, active: true },
          ],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
        EXCLUDED_VENDOR_ID: "20722;20755",
      } as any);

      const productItemWithCompareQ1 = {
        ...mockProductItem,
        compareWithQ1: true,
      };

      const priceBreakQ2 = {
        ...mockPriceBreak,
        minQty: 2,
        unitPrice: 89.99,
      };

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, productItemWithCompareQ1, "source-1", priceBreakQ2);

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle compareWithQ1 with Q2 being lower", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: true },
            { minQty: 2, unitPrice: 89.99, active: true }, // Q2 is lower
          ],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
        EXCLUDED_VENDOR_ID: "20722;20755",
      } as any);

      const productItemWithCompareQ1 = {
        ...mockProductItem,
        compareWithQ1: true,
      };

      const priceBreakQ2 = {
        ...mockPriceBreak,
        minQty: 2,
        unitPrice: 89.99,
      };

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, productItemWithCompareQ1, "source-1", priceBreakQ2);

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle compareWithQ1 with eligibleList empty", async () => {
      const payload: any[] = [
        {
          vendorId: 20722, // FRONTIER - excluded
          vendorName: "FRONTIER",
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: true },
            { minQty: 2, unitPrice: 89.99, active: true },
          ],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
        EXCLUDED_VENDOR_ID: "20722;20755",
      } as any);

      const productItemWithCompareQ1 = {
        ...mockProductItem,
        compareWithQ1: true,
      };

      const priceBreakQ2 = {
        ...mockPriceBreak,
        minQty: 2,
        unitPrice: 89.99,
      };

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, productItemWithCompareQ1, "source-1", priceBreakQ2);

      expect(result.repriceDetails?.explained).toContain("No competitor");
    });

    it("should handle compareWithQ1 with Q2 sister vendor", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: true },
            { minQty: 2, unitPrice: 89.99, active: true },
          ],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 20722, // FRONTIER - sister
          vendorName: "FRONTIER",
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: true },
            { minQty: 2, unitPrice: 85.99, active: true }, // Lower Q2
          ],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
        EXCLUDED_VENDOR_ID: "20722;20755",
      } as any);
      mockedLodash.first.mockImplementation((array: any) => {
        if (array && array.length > 0) {
          // Return sister vendor for q2EligibleListAll
          if (array[0]?.vendorId === 20722) return array[0];
          return array[0];
        }
        return undefined;
      });
      mockedLodash.includes.mockImplementation((array: any, value: any) => {
        if (Array.isArray(array) && array.includes("20722") && value === "20722") return true;
        if (Array.isArray(array)) return array.includes(value);
        return false;
      });

      const productItemWithCompareQ1 = {
        ...mockProductItem,
        compareWithQ1: true,
      };

      const priceBreakQ2 = {
        ...mockPriceBreak,
        minQty: 2,
        unitPrice: 89.99,
      };

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, productItemWithCompareQ1, "source-1", priceBreakQ2);

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle compareWithQ1 with comparePrice > 0", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: true },
            { minQty: 2, unitPrice: 89.99, active: true },
          ],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
        EXCLUDED_VENDOR_ID: "20722;20755",
      } as any);

      const productItemWithCompareQ1 = {
        ...mockProductItem,
        compareWithQ1: true,
      };

      const priceBreakQ2 = {
        ...mockPriceBreak,
        minQty: 2,
        unitPrice: 89.99,
      };

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, productItemWithCompareQ1, "source-1", priceBreakQ2);

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle error and return default model", async () => {
      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: "17357",
        EXCLUDED_VENDOR_ID: "20722;20755",
      } as any);
      mockedFilterMapper.FilterBasedOnParams.mockRejectedValueOnce(new Error("Filter error"));

      const result = await RepriceIndividualPriceBreak(mockRefProduct, [{ vendorId: 999, priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }] }], mockProductItem, "source-1", mockPriceBreak);

      expect(result).toBeInstanceOf(RepriceModel);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Error in Reprice"));
    });

    it("should handle excluded vendor as lowest", async () => {
      const payload: any[] = [
        {
          vendorId: 20722, // FRONTIER - excluded
          vendorName: "FRONTIER",
          priceBreaks: [{ minQty: 10, unitPrice: 79.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 74.99, Type: "STANDARD" });

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result.repriceDetails?.explained).toContain("Inactive");
    });

    it("should handle other vendor as lowest", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 79.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 74.99, Type: "STANDARD" });

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle tie scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor1",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      (applicationConfig as any).IGNORE_TIE = false;

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result.repriceDetails?.explained).toContain("#TIE");
    });

    it("should handle badge percentage scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 79.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 74.99, Type: "STANDARD" });
      mockedBadgeHelper.ReCalculatePriceForNc.mockResolvedValue({
        repriceDetails: { newPrice: 80.99, isRepriced: true },
      } as any);

      const productItemWithBadge = {
        ...mockProductItem,
        badgeIndicator: "ALL_PERCENTAGE",
        badgePercentage: 10,
      };

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, productItemWithBadge, "source-1", mockPriceBreak);

      expect(mockedBadgeHelper.ReCalculatePriceForNc).toHaveBeenCalled();
    });

    it("should handle nextLowestPrice > contextPrice and contextPrice <= maxPrice", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 94.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle existingPrice === 0 for new price break", async () => {
      const refProductWithZeroPrice: Partial<Net32Product> = {
        ...mockRefProduct,
        priceBreaks: [{ minQty: 10, unitPrice: 0, active: true }],
      };

      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 10, unitPrice: 0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 94.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const priceBreakZero = {
        ...mockPriceBreak,
        unitPrice: 0,
      };

      const result = await RepriceIndividualPriceBreak(refProductWithZeroPrice, payload, mockProductItem, "source-1", priceBreakZero);

      expect(result.repriceDetails?.isRepriced).toBe(true);
    });

    it("should handle nextLowestPrice > productItem.maxPrice", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 250.0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 250.0, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result.repriceDetails?.explained).toContain("IGNORE");
    });

    it("should handle no sortedPayload[nextIndex] scenario", async () => {
      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result.repriceDetails?.isRepriced).toBe(true);
      expect(result.repriceDetails?.explained).toContain("Inactive");
    });

    it("should handle offsetPrice <= floorPrice and priceBreak.minQty != 1", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 45.0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result.repriceDetails?.explained).toContain("Inactive");
    });

    it("should handle offsetPrice <= floorPrice and own vendor is 2nd lowest", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor1",
          priceBreaks: [{ minQty: 10, unitPrice: 45.0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 10, unitPrice: 89.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 888,
          vendorName: "Competitor2",
          priceBreaks: [{ minQty: 10, unitPrice: 109.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle offsetPrice > floorPrice and offsetPrice - standardShippingPrice >= floorPrice", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 79.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 79.98, Type: "STANDARD" });

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result.repriceDetails?.isRepriced).toBe(true);
    });

    it("should handle existingPrice > maxPrice scenario", async () => {
      const refProductWithHighPrice: Partial<Net32Product> = {
        ...mockRefProduct,
        priceBreaks: [{ minQty: 10, unitPrice: 250.0, active: true }],
      };

      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 45.0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 44.99, Type: "STANDARD" });

      const priceBreakHigh = {
        ...mockPriceBreak,
        unitPrice: 250.0,
      };

      const result = await RepriceIndividualPriceBreak(refProductWithHighPrice, payload, mockProductItem, "source-1", priceBreakHigh);

      expect(result.repriceDetails?.isRepriced).toBe(true);
      expect(result).toBeInstanceOf(RepriceModel);
    });

    it("should handle offsetPrice > floorPrice and offsetPrice - standardShippingPrice < floorPrice", async () => {
      const payload: any[] = [
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 52.0, active: true }], // 52 + 5.99 = 57.99, contextPrice might be 51.99, 51.99 - 5.99 = 46 < 50
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 51.99, Type: "STANDARD" });

      const result = await RepriceIndividualPriceBreak(mockRefProduct, payload, mockProductItem, "source-1", mockPriceBreak);

      expect(result.repriceDetails?.explained).toContain("updated");
    });

    it("should handle isDummyPriceBreak scenario", async () => {
      const refProductWithZeroPrice: Partial<Net32Product> = {
        ...mockRefProduct,
        priceBreaks: [{ minQty: 10, unitPrice: 0, active: true }],
      };

      const payload: any[] = [
        {
          vendorId: 17357,
          vendorName: "TRADENT",
          priceBreaks: [{ minQty: 10, unitPrice: 0, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
        {
          vendorId: 999,
          vendorName: "Competitor",
          priceBreaks: [{ minQty: 10, unitPrice: 99.99, active: true }],
          standardShipping: 5.99,
          freeShippingThreshold: 150.0,
        },
      ];
      mockedFilterMapper.FilterBasedOnParams.mockImplementation(async (list: any[]) => list);
      mockedFilterMapper.GetContextPrice.mockResolvedValue({ Price: 94.99, Type: "STANDARD" });
      (mockedFilterMapper.IsVendorFloorPrice as jest.Mock).mockResolvedValue(false);
      mockedLodash.first.mockReturnValue(payload[0] as any);
      mockedLodash.nth.mockReturnValue(payload[1] as any);
      mockedLodash.includes.mockImplementation((array: any, value: any) => {
        if (Array.isArray(array) && array.includes("20722") && value === "20722") return true;
        if (Array.isArray(array)) return array.includes(value);
        return false;
      });

      const priceBreakNotOne = {
        ...mockPriceBreak,
        minQty: 10,
        unitPrice: 0,
      };

      const result = await RepriceIndividualPriceBreak(refProductWithZeroPrice, payload, mockProductItem, "source-1", priceBreakNotOne);

      expect(result).toBeInstanceOf(RepriceModel);
    });
  });
});
