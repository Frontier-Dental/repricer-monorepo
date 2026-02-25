// Mock dependencies before imports
jest.mock("fs");
jest.mock("path");
jest.mock("../../../config", () => ({
  applicationConfig: {
    WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE: true,
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
  VendorId: {
    FRONTIER: 20722,
    MVP: 20755,
    TRADENT: 17357,
    FIRSTDENT: 20533,
    TOPDENT: 20727,
    TRIAD: 5,
    BITESUPPLY: 20891,
  },
  VendorNameLookup: {
    20722: "FRONTIER",
    20755: "MVP",
    17357: "TRADENT",
    20533: "FIRSTDENT",
    20727: "TOPDENT",
    5: "TRIAD",
    20891: "BITESUPPLY",
    999: "UNKNOWN_VENDOR",
  },
  AlgoPriceDirection: {
    UP: "UP",
    UP_DOWN: "UP/DOWN",
    DOWN: "DOWN",
  },
  AlgoBadgeIndicator: {
    ALL: "ALL",
    BADGE: "BADGE",
  },
  AlgoHandlingTimeGroup: {
    ALL: "ALL",
    FAST_SHIPPING: "FAST_SHIPPING",
    STOCKED: "STOCKED",
    LONG_HANDLING: "LONG_HANDLING",
  },
  AlgoPriceStrategy: {
    UNIT: "UNIT",
    TOTAL: "TOTAL",
    BUY_BOX: "BUY_BOX",
  },
}));

jest.mock("../algorithm", () => ({
  getHighestPriceBreakLessThanOrEqualTo: jest.fn(),
  getTotalCostForQuantity: jest.fn(),
  getTotalCostForQuantityWithUnitPriceOverride: jest.fn(),
  hasBadge: jest.fn(),
}));

import * as fs from "fs";
import * as path from "path";
import { createHtmlFileContent } from "../html-builder";
import { applicationConfig } from "../../../config";
import { Decimal } from "decimal.js";
import * as algorithm from "../algorithm";
import { AlgoPriceDirection, AlgoBadgeIndicator, AlgoHandlingTimeGroup, AlgoPriceStrategy } from "@repricer-monorepo/shared";
import { QbreakInvalidReason } from "../types";
import { Net32AlgoProduct } from "../types";
import { Net32AlgoSolutionWithQBreakValid } from "../algorithm";

const mockedAlgorithm = algorithm as jest.Mocked<typeof algorithm>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("html-builder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mocks
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    jest.spyOn(path, "resolve").mockReturnValue("/test/html");
    jest.spyOn(path, "join").mockReturnValue("/test/html/file.html");

    // Default algorithm mocks
    mockedAlgorithm.getHighestPriceBreakLessThanOrEqualTo.mockReturnValue({
      minQty: 1,
      unitPrice: 99.99,
    } as any);
    mockedAlgorithm.getTotalCostForQuantity.mockReturnValue(new Decimal(99.99));
    mockedAlgorithm.getTotalCostForQuantityWithUnitPriceOverride.mockReturnValue(new Decimal(99.99));
    mockedAlgorithm.hasBadge.mockReturnValue(false);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("createHtmlFileContent", () => {
    it("should return minimal HTML when solutions array is empty", () => {
      const mpId = 100;
      const net32Products: any[] = [
        {
          vendorId: 20722,
          vendorName: "FRONTIER",
          inStock: true,
          standardShipping: 5.99,
          shippingTime: 2,
          inventory: 100,
          badgeId: 0,
          badgeName: null,
          priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
          freeShippingGap: 50.0,
          freeShippingThreshold: 150.0,
        },
      ];
      const solutions: Net32AlgoSolutionWithQBreakValid[] = [];
      const net32url = "http://test.com/product";
      const jobId = "job-123";

      const result = createHtmlFileContent(mpId, net32Products, solutions, net32url, jobId);

      expect(result).toContain("Product ID: 100");
      expect(result).toContain("No Solutions");
      expect(result).toContain("http://test.com/product");
      expect(result).toContain("job-123");
      expect(result).toContain("net32Products (JSON)");
      expect(result).toContain(JSON.stringify(net32Products, null, 2));
    });

    it("should handle empty net32url when solutions are empty", () => {
      const mpId = 100;
      const net32Products: any[] = [];
      const solutions: Net32AlgoSolutionWithQBreakValid[] = [];
      const net32url = "";
      const jobId = "job-123";

      const result = createHtmlFileContent(mpId, net32Products, solutions, net32url, jobId);

      expect(result).not.toContain("http://");
      expect(result).toContain("Product ID: 100");
    });

    it("should create HTML with solutions and vendor info", () => {
      const mpId = 100;
      const net32Products: any[] = [
        {
          vendorId: 20722,
          vendorName: "FRONTIER",
          inStock: true,
          standardShipping: 5.99,
          shippingTime: 2,
          inventory: 100,
          badgeId: 0,
          badgeName: null,
          priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
          freeShippingGap: 50.0,
          freeShippingThreshold: 150.0,
        },
      ];

      const mockSolution: Net32AlgoSolutionWithQBreakValid = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          inStock: true,
          standardShipping: 5.99,
          shippingTime: 2,
          inventory: 100,
          badgeId: 0,
          badgeName: null,
          priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
          freeShippingGap: 50.0,
          freeShippingThreshold: 150.0,
          bestPrice: new Decimal(99.99),
        },
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: {
          id: 1,
          mp_id: 100,
          vendor_id: 20722,
          suppress_price_break_if_Q1_not_updated: false,
          suppress_price_break: false,
          compete_on_price_break_only: false,
          up_down: AlgoPriceDirection.UP_DOWN,
          badge_indicator: AlgoBadgeIndicator.BADGE,
          execution_priority: 1,
          reprice_up_percentage: 10,
          compare_q2_with_q1: false,
          compete_with_all_vendors: false,
          reprice_up_badge_percentage: 15,
          sister_vendor_ids: "20755;20533",
          exclude_vendors: "",
          inactive_vendor_id: "",
          handling_time_group: AlgoHandlingTimeGroup.ALL,
          keep_position: false,
          inventory_competition_threshold: 10,
          reprice_down_percentage: 5,
          reprice_down_badge_percentage: 8,
          floor_price: 50.0,
          max_price: 200.0,
          floor_compete_with_next: false,
          own_vendor_threshold: 5,
          price_strategy: AlgoPriceStrategy.BUY_BOX,
          enabled: true,
        },
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        lowestPrice: 89.99,
        lowestVendorId: 20755,
        lowestVendorPosition: 1,
        preJsonPosition: 2,
        algoResult: "CHANGE_UP" as any,
        comment: "Price increased",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
        qBreakInvalidReason: undefined,
      };

      const solutions = [mockSolution];
      const net32url = "http://test.com/product";
      const jobId = "job-123";

      const result = createHtmlFileContent(mpId, net32Products, solutions, net32url, jobId);

      expect(result).toContain("Product ID: 100");
      expect(result).toContain("Vendor ID: 20722");
      expect(result).toContain("Vendor Name: FRONTIER");
      expect(result).toContain("job-123");
      expect(result).toContain("Quantity: 10");
      expect(result).toContain("Vendor Settings");
    });

    it("should group solutions by quantity and sort quantities", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution1: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 20,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const mockSolution2: Partial<Net32AlgoSolutionWithQBreakValid> = {
        ...mockSolution1,
        solutionId: "sol-2",
        quantity: 10,
      };

      const solutions = [mockSolution1, mockSolution2] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      // Should sort quantities: 10 comes before 20
      const quantity10Index = result.indexOf("Quantity: 10");
      const quantity20Index = result.indexOf("Quantity: 20");
      expect(quantity10Index).toBeLessThan(quantity20Index);
    });

    it("should skip quantity 0", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 0,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).not.toContain("Quantity: 0");
    });

    it("should add divider between quantities", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution1: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const mockSolution2: Partial<Net32AlgoSolutionWithQBreakValid> = {
        ...mockSolution1,
        solutionId: "sol-2",
        quantity: 20,
      };

      const solutions = [mockSolution1, mockSolution2] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain('<hr style="margin: 40px 0; border: 2px solid #ccc;">');
    });

    it("should not add divider after last quantity", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      // Should not have divider for single quantity
      const hrCount = (result.match(/<hr/g) || []).length;
      expect(hrCount).toBe(0);
    });

    it("should build beforeLadder table when beforeLadder exists", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockProduct: Net32AlgoProduct = {
        vendorId: 20722,
        vendorName: "FRONTIER",
        inStock: true,
        standardShipping: 5.99,
        shippingTime: 2,
        inventory: 100,
        badgeId: 0,
        badgeName: null,
        priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
        freeShippingGap: 50.0,
        freeShippingThreshold: 150.0,
      };

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          ...mockProduct,
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [
          {
            product: mockProduct,
            totalCost: new Decimal(99.99),
            effectiveUnitPrice: new Decimal(99.99),
            hasBadge: false,
            shippingBucket: 1,
            priceStrategy: AlgoPriceStrategy.BUY_BOX,
            buyBoxRank: 1.5,
          },
        ],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("Existing Board");
      expect(result).toContain("FRONTIER");
      expect(mockedAlgorithm.getHighestPriceBreakLessThanOrEqualTo).toHaveBeenCalled();
      expect(mockedAlgorithm.getTotalCostForQuantity).toHaveBeenCalled();
    });

    it("should handle vendor name lookup fallback", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 99999, // Unknown vendor ID
          vendorName: "UNKNOWN",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("Vendor 99999");
    });

    it("should write HTML file when WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE is true", () => {
      (applicationConfig as any).WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE = true;
      jest.spyOn(fs, "existsSync").mockReturnValue(false);

      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should not write HTML file when WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE is false", () => {
      (applicationConfig as any).WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE = false;
      jest.spyOn(fs, "existsSync").mockReturnValue(true);

      const mpId = 100;
      const net32Products: any[] = [];
      const solutions: Net32AlgoSolutionWithQBreakValid[] = [];

      createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("should not create directory if it already exists", () => {
      (applicationConfig as any).WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE = true;
      jest.spyOn(fs, "existsSync").mockReturnValue(true);

      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it("should generate correct file name with timestamp", () => {
      (applicationConfig as any).WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE = true;
      jest.spyOn(fs, "existsSync").mockReturnValue(true);

      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(path.join).toHaveBeenCalled();
      const joinCall = (path.join as jest.Mock).mock.calls[0];
      expect(joinCall[1]).toContain("repriceProductV3_100_20722_");
      expect(joinCall[1]).toContain(".html");
    });

    it("should build solutions table with multiple solutions", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution1: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test 1",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const mockSolution2: Partial<Net32AlgoSolutionWithQBreakValid> = {
        ...mockSolution1,
        solutionId: "sol-2",
        buyBoxRank: 2.0,
      };

      const solutions = [mockSolution1, mockSolution2] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("Price Solutions");
      expect(result).toContain("sol-1");
      expect(result).toContain("sol-2");
      expect(result).toContain("Solution 1");
      expect(result).toContain("Solution 2");
    });

    it("should sort solutions by buyBoxRank", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution1: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 2.0,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const mockSolution2: Partial<Net32AlgoSolutionWithQBreakValid> = {
        ...mockSolution1,
        solutionId: "sol-2",
        buyBoxRank: 1.5,
      };

      const solutions = [mockSolution1, mockSolution2] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      // Solution 2 (buyBoxRank 1.5) should come before Solution 1 (buyBoxRank 2.0)
      const sol2Index = result.indexOf("sol-2");
      const sol1Index = result.indexOf("sol-1");
      expect(sol2Index).toBeLessThan(sol1Index);
    });

    it("should handle products with badges in beforeLadder", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockProduct: Net32AlgoProduct = {
        vendorId: 20722,
        vendorName: "FRONTIER",
        inStock: true,
        standardShipping: 5.99,
        shippingTime: 2,
        inventory: 100,
        badgeId: 1,
        badgeName: "Best Seller",
        priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
        freeShippingGap: 50.0,
        freeShippingThreshold: 150.0,
      };

      mockedAlgorithm.hasBadge.mockReturnValue(true);

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          ...mockProduct,
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [
          {
            product: mockProduct,
            totalCost: new Decimal(99.99),
            effectiveUnitPrice: new Decimal(99.99),
            hasBadge: true,
            shippingBucket: 1,
            priceStrategy: AlgoPriceStrategy.BUY_BOX,
            buyBoxRank: 1.5,
          },
        ],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("🏅");
      expect(mockedAlgorithm.hasBadge).toHaveBeenCalled();
    });

    it("should highlight our vendors in yellow in beforeLadder", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockProduct: Net32AlgoProduct = {
        vendorId: 20722, // FRONTIER - our vendor
        vendorName: "FRONTIER",
        inStock: true,
        standardShipping: 5.99,
        shippingTime: 2,
        inventory: 100,
        badgeId: 0,
        badgeName: null,
        priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
        freeShippingGap: 50.0,
        freeShippingThreshold: 150.0,
      };

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          ...mockProduct,
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [
          {
            product: mockProduct,
            totalCost: new Decimal(99.99),
            effectiveUnitPrice: new Decimal(99.99),
            hasBadge: false,
            shippingBucket: 1,
            priceStrategy: AlgoPriceStrategy.BUY_BOX,
            buyBoxRank: 1.5,
          },
        ],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain('style="background: #ffff99;"');
    });

    it("should display price breaks when more than one", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockProduct: Net32AlgoProduct = {
        vendorId: 20722,
        vendorName: "FRONTIER",
        inStock: true,
        standardShipping: 5.99,
        shippingTime: 2,
        inventory: 100,
        badgeId: 0,
        badgeName: null,
        priceBreaks: [
          { minQty: 1, unitPrice: 99.99 },
          { minQty: 10, unitPrice: 89.99 },
        ],
        freeShippingGap: 50.0,
        freeShippingThreshold: 150.0,
      };

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          ...mockProduct,
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [
          {
            product: mockProduct,
            totalCost: new Decimal(99.99),
            effectiveUnitPrice: new Decimal(99.99),
            hasBadge: false,
            shippingBucket: 1,
            priceStrategy: AlgoPriceStrategy.BUY_BOX,
            buyBoxRank: 1.5,
          },
        ],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("1@99.99, 10@89.99");
    });

    it("should not display price breaks when only one", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockProduct: Net32AlgoProduct = {
        vendorId: 20722,
        vendorName: "FRONTIER",
        inStock: true,
        standardShipping: 5.99,
        shippingTime: 2,
        inventory: 100,
        badgeId: 0,
        badgeName: null,
        priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
        freeShippingGap: 50.0,
        freeShippingThreshold: 150.0,
      };

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          ...mockProduct,
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [
          {
            product: mockProduct,
            totalCost: new Decimal(99.99),
            effectiveUnitPrice: new Decimal(99.99),
            hasBadge: false,
            shippingBucket: 1,
            priceStrategy: AlgoPriceStrategy.BUY_BOX,
            buyBoxRank: 1.5,
          },
        ],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      // Should not contain price breaks display when only one
      expect(result).not.toContain("1@99.99");
    });

    it("should build vendor view of board table", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockProduct: Net32AlgoProduct = {
        vendorId: 20722,
        vendorName: "FRONTIER",
        inStock: true,
        standardShipping: 5.99,
        shippingTime: 2,
        inventory: 100,
        badgeId: 0,
        badgeName: null,
        priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
        freeShippingGap: 50.0,
        freeShippingThreshold: 150.0,
      };

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          ...mockProduct,
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [
          {
            product: mockProduct,
            totalCost: new Decimal(99.99),
            effectiveUnitPrice: new Decimal(99.99),
            hasBadge: false,
            shippingBucket: 1,
            priceStrategy: AlgoPriceStrategy.BUY_BOX,
            buyBoxRank: 1.5,
          },
        ],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("Vendor View Of Board");
      expect(result).toContain("Buy Box Rank");
    });

    it("should handle empty vendor view of board", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("No competitors or sisters available");
    });

    it("should build source combinations table", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockProduct: Net32AlgoProduct = {
        vendorId: 20722,
        vendorName: "FRONTIER",
        inStock: true,
        standardShipping: 5.99,
        shippingTime: 2,
        inventory: 100,
        badgeId: 0,
        badgeName: null,
        priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
        freeShippingGap: 50.0,
        freeShippingThreshold: 150.0,
      };

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          ...mockProduct,
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [mockProduct as any],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("Local Post-Insert Board");
      expect(mockedAlgorithm.getHighestPriceBreakLessThanOrEqualTo).toHaveBeenCalled();
      expect(mockedAlgorithm.getTotalCostForQuantityWithUnitPriceOverride).toHaveBeenCalled();
    });

    it("should handle empty source combinations", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("No source combination available");
    });

    it("should use bestPrice when available in source combinations", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockProduct: Net32AlgoProduct = {
        vendorId: 20722,
        vendorName: "FRONTIER",
        inStock: true,
        standardShipping: 5.99,
        shippingTime: 2,
        inventory: 100,
        badgeId: 0,
        badgeName: null,
        priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
        freeShippingGap: 50.0,
        freeShippingThreshold: 150.0,
      };

      const mockProductWithBestPrice = {
        ...mockProduct,
        bestPrice: new Decimal(89.99),
      };

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          ...mockProduct,
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [mockProductWithBestPrice as any],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      // Should use bestPrice (89.99) instead of priceBreak unitPrice
      expect(mockedAlgorithm.getTotalCostForQuantityWithUnitPriceOverride).toHaveBeenCalled();
      const callArgs = mockedAlgorithm.getTotalCostForQuantityWithUnitPriceOverride.mock.calls[0];
      expect(callArgs[2].toNumber()).toBe(89.99);
    });

    it("should build results table with all fields", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Price increased",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP_RAW",
        qBreakValid: true,
        qBreakInvalidReason: undefined,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("CHANGE_UP");
      expect(result).toContain("Price increased");
      expect(result).toContain("99.99");
      expect(result).toContain("MVP");
      expect(result).toContain("MVP_RAW");
      expect(result).toContain("Yes");
      expect(result).toContain("N/A"); // qBreakInvalidReason
    });

    it("should handle null suggestedPrice in results", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: null,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("Suggested Price");
      expect(result).toContain("N/A");
    });

    it("should handle qBreakInvalidReason array", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: false,
        qBreakInvalidReason: [QbreakInvalidReason.SUPPRESS_BECAUSE_Q1_NOT_UPDATED, QbreakInvalidReason.UNNECESSARY],
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("SUPPRESS_BECAUSE_Q1_NOT_UPDATED, UNNECESSARY");
    });

    it("should build vendor settings table with all fields", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockVendorSettings = {
        id: 1,
        mp_id: 100,
        vendor_id: 20722,
        suppress_price_break_if_Q1_not_updated: true,
        suppress_price_break: false,
        compete_on_price_break_only: true,
        up_down: "BOTH",
        badge_indicator: "BADGE",
        execution_priority: 1,
        reprice_up_percentage: 10,
        compare_q2_with_q1: false,
        compete_with_all_vendors: true,
        reprice_up_badge_percentage: 15,
        sister_vendor_ids: "20755;20533",
        exclude_vendors: "999",
        inactive_vendor_id: "888",
        handling_time_group: "FAST",
        keep_position: false,
        inventory_competition_threshold: 10,
        reprice_down_percentage: 5,
        reprice_down_badge_percentage: 8,
        floor_price: 50.0,
        max_price: 200.0,
        floor_compete_with_next: true,
        own_vendor_threshold: 5,
        price_strategy: "COMPETE",
      };

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: mockVendorSettings as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("Vendor Settings");
      expect(result).toContain("Yes"); // for boolean true
      expect(result).toContain("No"); // for boolean false
      expect(result).toContain("BOTH");
      expect(result).toContain("BADGE");
      expect(result).toContain("1");
      expect(result).toContain("10");
    });

    it("should handle empty string values in vendor settings", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockVendorSettings = {
        id: 1,
        mp_id: 100,
        vendor_id: 20722,
        exclude_vendors: "",
        inactive_vendor_id: "",
        handling_time_group: AlgoHandlingTimeGroup.ALL,
      } as any;

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: mockVendorSettings,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("-"); // Empty strings should show as "-"
    });

    it("should handle null vendor settings", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: null as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("No vendor settings available");
    });

    it("should handle empty beforeLadder", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      // Empty array is truthy, so it will still try to build the table
      // but buildBeforeLadderTable will return "No existing products"
      expect(result).toContain("Existing Board");
      expect(result).toContain("No existing products");
    });

    it("should handle solutions with multiple vendors", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      const mockSolution1: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const mockSolution2: Partial<Net32AlgoSolutionWithQBreakValid> = {
        ...mockSolution1,
        solutionId: "sol-2",
        vendor: {
          vendorId: 20755,
          vendorName: "MVP",
          bestPrice: new Decimal(89.99),
        } as any,
        buyBoxRank: 2.0,
      };

      const solutions = [mockSolution1, mockSolution2] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      expect(result).toContain("FRONTIER");
      expect(result).toContain("MVP");
      expect(result).toContain("99.99");
      expect(result).toContain("89.99");
    });

    it("should handle empty solutions table", () => {
      const mpId = 100;
      const net32Products: any[] = [];

      // Create a solution but with empty solutions array for a quantity
      // This shouldn't happen in practice, but let's test the edge case
      const mockSolution: Partial<Net32AlgoSolutionWithQBreakValid> = {
        solutionId: "sol-1",
        vendor: {
          vendorId: 20722,
          vendorName: "FRONTIER",
          bestPrice: new Decimal(99.99),
        } as any,
        buyBoxRank: 1.5,
        quantity: 10,
        vendorSettings: { enabled: true } as any,
        postSolutionInsertBoard: [],
        everyoneFromViewOfOwnVendorRanked: [],
        everyoneIncludingOwnVendorBefore: [],
        beforeLadder: [],
        algoResult: "CHANGE_UP" as any,
        comment: "Test",
        suggestedPrice: 99.99,
        triggeredByVendor: "MVP",
        rawTriggeredByVendor: "MVP",
        qBreakValid: true,
      };

      const solutions = [mockSolution] as Net32AlgoSolutionWithQBreakValid[];

      const result = createHtmlFileContent(mpId, net32Products, solutions, "", "job-123");

      // Should still contain Price Solutions section
      expect(result).toContain("Price Solutions");
    });
  });
});
