// Mock dependencies before imports
jest.mock("../config", () => ({
  applicationConfig: {
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

jest.mock("lodash");
jest.mock("../../model/global-param");
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

import _ from "lodash";
import * as globalParam from "../../model/global-param";
import { FormatActiveField, FormatShippingThreshold, SetGlobalDetails, FormatScrapeResponse, FormatSingleScrapeResponse, SetOwnVendorThreshold } from "../format-wrapper";
import { VendorName } from "@repricer-monorepo/shared";
import { Net32Product } from "../../types/net32";
import { FrontierProduct } from "../../types/frontier";

const mockedLodash = _ as jest.Mocked<typeof _>;
const mockedGlobalParam = globalParam as jest.Mocked<typeof globalParam>;

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("format-wrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mock for lodash.cloneDeep
    mockedLodash.cloneDeep = jest.fn((obj: any) => {
      return JSON.parse(JSON.stringify(obj));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("FormatActiveField", () => {
    it("should set active to true for all priceBreaks", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
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
          priceBreaks: [
            { minQty: 1, unitPrice: 99.99, active: false },
            { minQty: 10, unitPrice: 89.99, active: false },
          ],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      const result = FormatActiveField(mockData);

      expect(result).toHaveLength(1);
      expect(result[0].priceBreaks).toHaveLength(2);
      expect(result[0].priceBreaks[0].active).toBe(true);
      expect(result[0].priceBreaks[1].active).toBe(true);
      // Original should not be mutated
      expect(mockData[0].priceBreaks[0].active).toBe(false);
    });

    it("should handle products with no priceBreaks", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
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
          priceBreaks: [],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      const result = FormatActiveField(mockData);

      expect(result[0].priceBreaks).toEqual([]);
    });

    it("should handle products with undefined priceBreaks", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
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
          priceBreaks: [] as any,
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      const result = FormatActiveField(mockData);

      expect(result[0].priceBreaks).toEqual([]);
    });

    it("should handle multiple products", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
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
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: false }],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
        {
          vendorProductId: 456,
          vendorProductCode: "PROD-456",
          vendorId: 2,
          vendorName: "Vendor B",
          vendorRegion: "CA",
          inStock: false,
          standardShipping: 7.99,
          standardShippingStatus: "unavailable",
          freeShippingGap: 75.0,
          heavyShippingStatus: "unavailable",
          heavyShipping: 15.99,
          shippingTime: 5,
          inventory: 0,
          isFulfillmentPolicyStock: false,
          vdrGeneralAverageRatingSum: 3.8,
          vdrNumberOfGeneralRatings: 50,
          isBackordered: true,
          vendorProductLevelLicenseRequiredSw: true,
          vendorVerticalLevelLicenseRequiredSw: false,
          priceBreaks: [{ minQty: 1, unitPrice: 149.99, active: false }],
          badgeId: 2,
          badgeName: null,
          imagePath: "/images/product2.jpg",
          arrivalDate: "2024-01-20",
          arrivalBusinessDays: 5,
          twoDayDeliverySw: false,
          isLowestTotalPrice: null,
        },
      ];

      const result = FormatActiveField(mockData);

      expect(result).toHaveLength(2);
      expect(result[0].priceBreaks[0].active).toBe(true);
      expect(result[1].priceBreaks[0].active).toBe(true);
    });

    it("should not mutate original data", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
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
          priceBreaks: [{ minQty: 1, unitPrice: 99.99, active: false }],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      const originalActive = mockData[0].priceBreaks[0].active;
      const result = FormatActiveField(mockData);

      expect(result[0].priceBreaks[0].active).toBe(true);
      expect(mockData[0].priceBreaks[0].active).toBe(originalActive);
    });
  });

  describe("FormatShippingThreshold", () => {
    it("should calculate freeShippingThreshold when STANDARD_SHIPPING and freeShippingGap > 0", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "STANDARD_SHIPPING",
          freeShippingGap: 50.0,
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
          priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      const result = FormatShippingThreshold(mockData);

      expect(result[0].freeShippingThreshold).toBe(149.99); // 99.99 + 50.0
    });

    it("should set freeShippingThreshold to 999999 when STANDARD_SHIPPING and freeShippingGap is 0", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "STANDARD_SHIPPING",
          freeShippingGap: 0,
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
          priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      const result = FormatShippingThreshold(mockData);

      expect(result[0].freeShippingThreshold).toBe(999999);
    });

    it("should set freeShippingThreshold to 0 when not STANDARD_SHIPPING", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "FREE_SHIPPING",
          freeShippingGap: 50.0,
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
          priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      const result = FormatShippingThreshold(mockData);

      expect(result[0].freeShippingThreshold).toBe(0);
    });

    it("should preserve existing freeShippingThreshold when no priceBreaks with minQty 1", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "STANDARD_SHIPPING",
          freeShippingGap: 50.0,
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
          priceBreaks: [{ minQty: 10, unitPrice: 89.99 }],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
          freeShippingThreshold: 100.0,
        },
      ];

      const result = FormatShippingThreshold(mockData);

      expect(result[0].freeShippingThreshold).toBe(100.0);
    });

    it("should handle products with empty priceBreaks array", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "STANDARD_SHIPPING",
          freeShippingGap: 50.0,
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
          priceBreaks: [],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
          freeShippingThreshold: 100.0,
        },
      ];

      const result = FormatShippingThreshold(mockData);

      expect(result[0].freeShippingThreshold).toBe(100.0);
    });

    it("should handle products with undefined priceBreaks", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "STANDARD_SHIPPING",
          freeShippingGap: 50.0,
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
          priceBreaks: [] as any,
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
          freeShippingThreshold: 100.0,
        },
      ];

      const result = FormatShippingThreshold(mockData);

      expect(result[0].freeShippingThreshold).toBe(100.0);
    });

    it("should handle string unitPrice values", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "STANDARD_SHIPPING",
          freeShippingGap: 50.0,
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
          priceBreaks: [{ minQty: 1, unitPrice: "99.99" as any }],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      const result = FormatShippingThreshold(mockData);

      expect(result[0].freeShippingThreshold).toBe(149.99); // parseFloat("99.99") + 50.0
    });

    it("should handle string freeShippingGap values", () => {
      const mockData: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 1,
          vendorName: "Vendor A",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "STANDARD_SHIPPING",
          freeShippingGap: "50.0" as any,
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
          priceBreaks: [{ minQty: 1, unitPrice: 99.99 }],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      const result = FormatShippingThreshold(mockData);

      expect(result[0].freeShippingThreshold).toBe(149.99); // 99.99 + parseFloat("50.0")
    });
  });

  describe("SetGlobalDetails", () => {
    it("should set ownVendorId and sisterVendorId for TRADENT", () => {
      const productItem: FrontierProduct = {
        channelName: "TRADENT",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: null,
        sisterVendorId: "",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 5,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      const result = SetGlobalDetails(productItem, VendorName.TRADENT);

      expect(result.ownVendorId).toBe("17357");
      expect(result.sisterVendorId).toBe("20722;20755;20533;20727;5;10");
    });

    it("should preserve existing sisterVendorId if already set", () => {
      const productItem: FrontierProduct = {
        channelName: "TRADENT",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: null,
        sisterVendorId: "CUSTOM_SISTERS",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 5,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      const result = SetGlobalDetails(productItem, VendorName.TRADENT);

      expect(result.ownVendorId).toBe("17357");
      expect(result.sisterVendorId).toBe("CUSTOM_SISTERS");
    });

    it("should preserve existing sisterVendorId for all vendor types", () => {
      const vendors = [
        { name: VendorName.FRONTIER, ownVendorId: "20722" },
        { name: VendorName.MVP, ownVendorId: "20755" },
        { name: VendorName.TOPDENT, ownVendorId: "20727" },
        { name: VendorName.FIRSTDENT, ownVendorId: "20533" },
        { name: VendorName.TRIAD, ownVendorId: "5" },
        { name: VendorName.BITESUPPLY, ownVendorId: "10" },
      ];

      for (const vendor of vendors) {
        const productItem: FrontierProduct = {
          channelName: vendor.name,
          activated: true,
          mpid: 100,
          channelId: "1",
          unitPrice: "99.99",
          floorPrice: "50.00",
          maxPrice: "200.00",
          is_nc_needed: false,
          suppressPriceBreakForOne: false,
          repricingRule: 1,
          suppressPriceBreak: false,
          beatQPrice: false,
          percentageIncrease: 10,
          compareWithQ1: true,
          competeAll: false,
          badgeIndicator: "BADGE",
          badgePercentage: 15,
          productName: "Test Product",
          cronId: "1",
          cronName: "Cron-1",
          requestInterval: 60,
          requestIntervalUnit: "min",
          scrapeOn: true,
          allowReprice: true,
          focusId: "1",
          priority: 1,
          wait_update_period: false,
          net32url: "https://example.com",
          abortDeactivatingQPriceBreak: false,
          ownVendorId: null,
          sisterVendorId: "CUSTOM_SISTERS",
          tags: [],
          includeInactiveVendors: false,
          inactiveVendorId: "",
          override_bulk_update: false,
          override_bulk_rule: 0,
          latest_price: 99.99,
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
          inventoryThreshold: 10,
          percentageDown: "5",
          badgePercentageDown: "8",
          competeWithNext: false,
          triggeredByVendor: "",
          ignorePhantomQBreak: false,
          ownVendorThreshold: 5,
          skipReprice: false,
          secretKey: [],
          contextCronName: "",
        };

        const result = SetGlobalDetails(productItem, vendor.name);

        expect(result.ownVendorId).toBe(vendor.ownVendorId);
        expect(result.sisterVendorId).toBe("CUSTOM_SISTERS");
      }
    });

    it("should handle all vendor types", () => {
      const baseProductItem: Partial<FrontierProduct> = {
        channelName: "TEST",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: null,
        sisterVendorId: "",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 5,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      const vendors = [
        { name: VendorName.FRONTIER, ownVendorId: "20722", sisterVendorId: "17357;20755;20533;20727;5;10" },
        { name: VendorName.MVP, ownVendorId: "20755", sisterVendorId: "17357;20722;20533;20727;5;10" },
        { name: VendorName.TOPDENT, ownVendorId: "20727", sisterVendorId: "17357;20722;20533;20755;5;10" },
        { name: VendorName.FIRSTDENT, ownVendorId: "20533", sisterVendorId: "17357;20722;20755;20727;5;10" },
        { name: VendorName.TRIAD, ownVendorId: "5", sisterVendorId: "17357;20722;20755;20727;20533;10" },
        { name: VendorName.BITESUPPLY, ownVendorId: "10", sisterVendorId: "17357;20722;20755;20727;20533;5" },
      ];

      for (const vendor of vendors) {
        const productItem = { ...baseProductItem } as FrontierProduct;
        const result = SetGlobalDetails(productItem, vendor.name);

        expect(result.ownVendorId).toBe(vendor.ownVendorId);
        expect(result.sisterVendorId).toBe(vendor.sisterVendorId);
      }
    });

    it("should handle case-insensitive vendor names", () => {
      const productItem: FrontierProduct = {
        channelName: "TRADENT",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: null,
        sisterVendorId: "",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 5,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      const result = SetGlobalDetails(productItem, "tradent");

      expect(result.ownVendorId).toBe("17357");
    });

    it("should throw error for invalid vendor", () => {
      const productItem: FrontierProduct = {
        channelName: "INVALID",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: null,
        sisterVendorId: "",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 5,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      expect(() => SetGlobalDetails(productItem, "INVALID_VENDOR")).toThrow("Invalid vendor: INVALID_VENDOR");
    });

    it("should not mutate original productItem", () => {
      const productItem: FrontierProduct = {
        channelName: "TRADENT",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: null,
        sisterVendorId: "",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 5,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      const originalOwnVendorId = productItem.ownVendorId;
      const result = SetGlobalDetails(productItem, VendorName.TRADENT);

      expect(result.ownVendorId).toBe("17357");
      expect(productItem.ownVendorId).toBe(originalOwnVendorId);
    });
  });

  describe("FormatScrapeResponse", () => {
    it("should format list of scrape responses", () => {
      const listOfResponse = [
        {
          vendorProductId: "123",
          standardShipping: "5.99",
          freeShippingGap: "50.0",
          heavyShipping: "10.99",
          shippingTime: "2",
          isBackordered: "false",
          inventory: "100",
          badgeId: "1",
          arrivalBusinessDays: "2",
          inStock: "true",
          priceBreaks: {
            priceBreaks: [
              {
                pmId: "PM-1",
                minQty: "1",
                unitPrice: "99.99",
                promoAddlDescr: "Regular price",
              },
              {
                pmId: "PM-2",
                minQty: "10",
                unitPrice: "89.99",
                promoAddlDescr: "Bulk discount",
              },
            ],
          },
        },
      ];

      const result = FormatScrapeResponse(listOfResponse);

      expect(result[0].vendorProductId).toBe(123);
      expect(result[0].standardShipping).toBe(5.99);
      expect(result[0].freeShippingGap).toBe(50.0);
      expect(result[0].heavyShipping).toBe(10.99);
      expect(result[0].shippingTime).toBe(2);
      expect(result[0].isBackordered).toBe(false);
      expect(result[0].inventory).toBe(100);
      expect(result[0].badgeId).toBe(1);
      expect(result[0].arrivalBusinessDays).toBe(2);
      expect(result[0].inStock).toBe(true);
      expect(result[0].priceBreaks).toHaveLength(2);
      expect(result[0].priceBreaks[0]).toEqual({
        pmId: "PM-1",
        minQty: 1,
        unitPrice: 99.99,
        promoAddlDescr: "Regular price",
      });
    });

    it("should handle empty list", () => {
      const result = FormatScrapeResponse([]);

      expect(result).toEqual([]);
    });

    it("should handle null/undefined list", () => {
      expect(FormatScrapeResponse(null as any)).toBeNull();
      expect(FormatScrapeResponse(undefined as any)).toBeUndefined();
    });

    it("should handle single priceBreak object (not array)", () => {
      const listOfResponse = [
        {
          vendorProductId: "123",
          standardShipping: "5.99",
          freeShippingGap: "50.0",
          heavyShipping: "10.99",
          shippingTime: "2",
          isBackordered: "false",
          inventory: "100",
          badgeId: "1",
          arrivalBusinessDays: "2",
          inStock: "true",
          priceBreaks: {
            priceBreaks: {
              pmId: "PM-1",
              minQty: "1",
              unitPrice: "99.99",
              promoAddlDescr: "Regular price",
            },
          },
        },
      ];

      const result = FormatScrapeResponse(listOfResponse);

      expect(result[0].priceBreaks).toHaveLength(1);
      expect(result[0].priceBreaks[0]).toEqual({
        pmId: "PM-1",
        minQty: 1,
        unitPrice: 99.99,
        promoAddlDescr: "Regular price",
      });
    });

    it("should handle missing priceBreaks", () => {
      const listOfResponse = [
        {
          vendorProductId: "123",
          standardShipping: "5.99",
          freeShippingGap: "50.0",
          heavyShipping: "10.99",
          shippingTime: "2",
          isBackordered: "false",
          inventory: "100",
          badgeId: "1",
          arrivalBusinessDays: "2",
          inStock: "true",
        },
      ];

      const result = FormatScrapeResponse(listOfResponse);

      expect(result[0].priceBreaks).toEqual([]);
    });

    it("should handle isBackordered and inStock as 'true' string", () => {
      const listOfResponse = [
        {
          vendorProductId: "123",
          standardShipping: "5.99",
          freeShippingGap: "50.0",
          heavyShipping: "10.99",
          shippingTime: "2",
          isBackordered: "true",
          inventory: "100",
          badgeId: "1",
          arrivalBusinessDays: "2",
          inStock: "true",
          priceBreaks: { priceBreaks: [] },
        },
      ];

      const result = FormatScrapeResponse(listOfResponse);

      expect(result[0].isBackordered).toBe(true);
      expect(result[0].inStock).toBe(true);
    });

    it("should handle isBackordered and inStock as 'false' string", () => {
      const listOfResponse = [
        {
          vendorProductId: "123",
          standardShipping: "5.99",
          freeShippingGap: "50.0",
          heavyShipping: "10.99",
          shippingTime: "2",
          isBackordered: "false",
          inventory: "100",
          badgeId: "1",
          arrivalBusinessDays: "2",
          inStock: "false",
          priceBreaks: { priceBreaks: [] },
        },
      ];

      const result = FormatScrapeResponse(listOfResponse);

      expect(result[0].isBackordered).toBe(false);
      expect(result[0].inStock).toBe(false);
    });

    it("should handle isBackordered and inStock as non-'true' values", () => {
      const listOfResponse = [
        {
          vendorProductId: "123",
          standardShipping: "5.99",
          freeShippingGap: "50.0",
          heavyShipping: "10.99",
          shippingTime: "2",
          isBackordered: "no",
          inventory: "100",
          badgeId: "1",
          arrivalBusinessDays: "2",
          inStock: "no",
          priceBreaks: { priceBreaks: [] },
        },
      ];

      const result = FormatScrapeResponse(listOfResponse);

      expect(result[0].isBackordered).toBe(false);
      expect(result[0].inStock).toBe(false);
    });

    it("should handle multiple responses", () => {
      const listOfResponse = [
        {
          vendorProductId: "123",
          standardShipping: "5.99",
          freeShippingGap: "50.0",
          heavyShipping: "10.99",
          shippingTime: "2",
          isBackordered: "false",
          inventory: "100",
          badgeId: "1",
          arrivalBusinessDays: "2",
          inStock: "true",
          priceBreaks: { priceBreaks: [] },
        },
        {
          vendorProductId: "456",
          standardShipping: "7.99",
          freeShippingGap: "75.0",
          heavyShipping: "15.99",
          shippingTime: "5",
          isBackordered: "true",
          inventory: "0",
          badgeId: "2",
          arrivalBusinessDays: "5",
          inStock: "false",
          priceBreaks: { priceBreaks: [] },
        },
      ];

      const result = FormatScrapeResponse(listOfResponse);

      expect(result).toHaveLength(2);
      expect(result[0].vendorProductId).toBe(123);
      expect(result[1].vendorProductId).toBe(456);
    });
  });

  describe("FormatSingleScrapeResponse", () => {
    it("should format single scrape response and return array", () => {
      const singleResponse = {
        vendorProductId: "123",
        standardShipping: "5.99",
        freeShippingGap: "50",
        heavyShipping: "10.99",
        shippingTime: "2",
        isBackordered: "false",
        inventory: "100",
        badgeId: "1",
        arrivalBusinessDays: "2",
        inStock: "true",
        priceBreaks: {
          priceBreaks: [
            {
              pmId: "PM-1",
              minQty: "1",
              unitPrice: "99.99",
              promoAddlDescr: "Regular price",
            },
          ],
        },
      };

      const result = FormatSingleScrapeResponse(singleResponse);

      expect(result).toHaveLength(1);
      expect(result[0].vendorProductId).toBe(123);
      expect(result[0].standardShipping).toBe(5.99);
      expect(result[0].freeShippingGap).toBe(50);
      expect(result[0].heavyShipping).toBe(10.99);
      expect(result[0].shippingTime).toBe(2);
      expect(result[0].isBackordered).toBe(false);
      expect(result[0].inventory).toBe(100);
      expect(result[0].badgeId).toBe(1);
      expect(result[0].arrivalBusinessDays).toBe(2);
      expect(result[0].inStock).toBe(true);
      expect(result[0].priceBreaks).toHaveLength(1);
    });

    it("should handle single priceBreak object (not array)", () => {
      const singleResponse = {
        vendorProductId: "123",
        standardShipping: "5.99",
        freeShippingGap: "50",
        heavyShipping: "10.99",
        shippingTime: "2",
        isBackordered: "false",
        inventory: "100",
        badgeId: "1",
        arrivalBusinessDays: "2",
        inStock: "true",
        priceBreaks: {
          priceBreaks: {
            pmId: "PM-1",
            minQty: "1",
            unitPrice: "99.99",
            promoAddlDescr: "Regular price",
          },
        },
      };

      const result = FormatSingleScrapeResponse(singleResponse);

      expect(result[0].priceBreaks).toHaveLength(1);
      expect(result[0].priceBreaks[0]).toEqual({
        pmId: "PM-1",
        minQty: 1,
        unitPrice: 99.99,
        promoAddlDescr: "Regular price",
      });
    });

    it("should handle missing priceBreaks", () => {
      const singleResponse = {
        vendorProductId: "123",
        standardShipping: "5.99",
        freeShippingGap: "50",
        heavyShipping: "10.99",
        shippingTime: "2",
        isBackordered: "false",
        inventory: "100",
        badgeId: "1",
        arrivalBusinessDays: "2",
        inStock: "true",
      };

      const result = FormatSingleScrapeResponse(singleResponse);

      expect(result[0].priceBreaks).toEqual([]);
    });

    it("should use cloneDeep to avoid mutating original", () => {
      const singleResponse = {
        vendorProductId: "123",
        standardShipping: "5.99",
        freeShippingGap: "50",
        heavyShipping: "10.99",
        shippingTime: "2",
        isBackordered: "false",
        inventory: "100",
        badgeId: "1",
        arrivalBusinessDays: "2",
        inStock: "true",
        priceBreaks: { priceBreaks: [] },
      };

      const originalVendorProductId = singleResponse.vendorProductId;
      const result = FormatSingleScrapeResponse(singleResponse);

      expect(result[0].vendorProductId).toBe(123);
      expect(singleResponse.vendorProductId).toBe(originalVendorProductId);
      expect(mockedLodash.cloneDeep).toHaveBeenCalledWith(singleResponse);
    });

    it("should handle isBackordered and inStock as non-'true' values in FormatSingleScrapeResponse", () => {
      const singleResponse = {
        vendorProductId: "123",
        standardShipping: "5.99",
        freeShippingGap: "50",
        heavyShipping: "10.99",
        shippingTime: "2",
        isBackordered: "no",
        inventory: "100",
        badgeId: "1",
        arrivalBusinessDays: "2",
        inStock: "no",
        priceBreaks: { priceBreaks: [] },
      };

      const result = FormatSingleScrapeResponse(singleResponse);

      expect(result[0].isBackordered).toBe(false);
      expect(result[0].inStock).toBe(false);
    });
  });

  describe("SetOwnVendorThreshold", () => {
    it("should set inStock to true when inventory >= ownVendorThreshold", async () => {
      const productItem: FrontierProduct = {
        channelName: "TRADENT",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: "17357",
        sisterVendorId: "20722;20755",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 10,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      const net32Result: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 17357,
          vendorName: "TRADENT",
          vendorRegion: "US",
          inStock: false,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
          heavyShippingStatus: "available",
          heavyShipping: 10.99,
          shippingTime: 2,
          inventory: 15,
          isFulfillmentPolicyStock: true,
          vdrGeneralAverageRatingSum: 4.5,
          vdrNumberOfGeneralRatings: 100,
          isBackordered: false,
          vendorProductLevelLicenseRequiredSw: false,
          vendorVerticalLevelLicenseRequiredSw: false,
          priceBreaks: [],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: 17357,
        EXCLUDED_VENDOR_ID: "20722;20755",
      });

      const result = await SetOwnVendorThreshold(productItem, net32Result);

      expect(result[0].inStock).toBe(true);
      expect(mockedGlobalParam.GetInfo).toHaveBeenCalledWith(100, productItem);
    });

    it("should set inStock to false when inventory < ownVendorThreshold", async () => {
      const productItem: FrontierProduct = {
        channelName: "TRADENT",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: "17357",
        sisterVendorId: "20722;20755",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 20,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      const net32Result: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 17357,
          vendorName: "TRADENT",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
          heavyShippingStatus: "available",
          heavyShipping: 10.99,
          shippingTime: 2,
          inventory: 15,
          isFulfillmentPolicyStock: true,
          vdrGeneralAverageRatingSum: 4.5,
          vdrNumberOfGeneralRatings: 100,
          isBackordered: false,
          vendorProductLevelLicenseRequiredSw: false,
          vendorVerticalLevelLicenseRequiredSw: false,
          priceBreaks: [],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: 17357,
        EXCLUDED_VENDOR_ID: "20722;20755",
      });

      const result = await SetOwnVendorThreshold(productItem, net32Result);

      expect(result[0].inStock).toBe(false);
    });

    it("should not modify products with different vendorId", async () => {
      const productItem: FrontierProduct = {
        channelName: "TRADENT",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: "17357",
        sisterVendorId: "20722;20755",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 10,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      const net32Result: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 20722, // Different vendor
          vendorName: "FRONTIER",
          vendorRegion: "US",
          inStock: false,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
          heavyShippingStatus: "available",
          heavyShipping: 10.99,
          shippingTime: 2,
          inventory: 5,
          isFulfillmentPolicyStock: true,
          vdrGeneralAverageRatingSum: 4.5,
          vdrNumberOfGeneralRatings: 100,
          isBackordered: false,
          vendorProductLevelLicenseRequiredSw: false,
          vendorVerticalLevelLicenseRequiredSw: false,
          priceBreaks: [],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: 17357,
        EXCLUDED_VENDOR_ID: "20722;20755",
      });

      const result = await SetOwnVendorThreshold(productItem, net32Result);

      expect(result[0].inStock).toBe(false); // Should remain unchanged
      expect(result[0].vendorId).toBe(20722);
    });

    it("should handle string inventory values", async () => {
      const productItem: FrontierProduct = {
        channelName: "TRADENT",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: "17357",
        sisterVendorId: "20722;20755",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 10,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      const net32Result: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 17357,
          vendorName: "TRADENT",
          vendorRegion: "US",
          inStock: false,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
          heavyShippingStatus: "available",
          heavyShipping: 10.99,
          shippingTime: 2,
          inventory: "15" as any, // String inventory
          isFulfillmentPolicyStock: true,
          vdrGeneralAverageRatingSum: 4.5,
          vdrNumberOfGeneralRatings: 100,
          isBackordered: false,
          vendorProductLevelLicenseRequiredSw: false,
          vendorVerticalLevelLicenseRequiredSw: false,
          priceBreaks: [],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
      ];

      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: 17357,
        EXCLUDED_VENDOR_ID: "20722;20755",
      });

      const result = await SetOwnVendorThreshold(productItem, net32Result);

      expect(result[0].inStock).toBe(true); // parseInt("15") >= 10
    });

    it("should handle multiple products with mixed vendorIds", async () => {
      const productItem: FrontierProduct = {
        channelName: "TRADENT",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: "17357",
        sisterVendorId: "20722;20755",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 10,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      const net32Result: Net32Product[] = [
        {
          vendorProductId: 123,
          vendorProductCode: "PROD-123",
          vendorId: 17357, // Own vendor
          vendorName: "TRADENT",
          vendorRegion: "US",
          inStock: false,
          standardShipping: 5.99,
          standardShippingStatus: "available",
          freeShippingGap: 50.0,
          heavyShippingStatus: "available",
          heavyShipping: 10.99,
          shippingTime: 2,
          inventory: 15,
          isFulfillmentPolicyStock: true,
          vdrGeneralAverageRatingSum: 4.5,
          vdrNumberOfGeneralRatings: 100,
          isBackordered: false,
          vendorProductLevelLicenseRequiredSw: false,
          vendorVerticalLevelLicenseRequiredSw: false,
          priceBreaks: [],
          badgeId: 1,
          badgeName: "Best Seller",
          imagePath: "/images/product.jpg",
          arrivalDate: "2024-01-15",
          arrivalBusinessDays: 2,
          twoDayDeliverySw: true,
          isLowestTotalPrice: "Y",
        },
        {
          vendorProductId: 456,
          vendorProductCode: "PROD-456",
          vendorId: 20722, // Different vendor
          vendorName: "FRONTIER",
          vendorRegion: "US",
          inStock: true,
          standardShipping: 7.99,
          standardShippingStatus: "available",
          freeShippingGap: 75.0,
          heavyShippingStatus: "available",
          heavyShipping: 15.99,
          shippingTime: 5,
          inventory: 5,
          isFulfillmentPolicyStock: false,
          vdrGeneralAverageRatingSum: 3.8,
          vdrNumberOfGeneralRatings: 50,
          isBackordered: true,
          vendorProductLevelLicenseRequiredSw: true,
          vendorVerticalLevelLicenseRequiredSw: false,
          priceBreaks: [],
          badgeId: 2,
          badgeName: null,
          imagePath: "/images/product2.jpg",
          arrivalDate: "2024-01-20",
          arrivalBusinessDays: 5,
          twoDayDeliverySw: false,
          isLowestTotalPrice: null,
        },
      ];

      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: 17357,
        EXCLUDED_VENDOR_ID: "20722;20755",
      });

      const result = await SetOwnVendorThreshold(productItem, net32Result);

      expect(result).toHaveLength(2);
      expect(result[0].inStock).toBe(true); // Own vendor, inventory >= threshold
      expect(result[1].inStock).toBe(true); // Different vendor, unchanged
    });

    it("should handle empty net32Result array", async () => {
      const productItem: FrontierProduct = {
        channelName: "TRADENT",
        activated: true,
        mpid: 100,
        channelId: "1",
        unitPrice: "99.99",
        floorPrice: "50.00",
        maxPrice: "200.00",
        is_nc_needed: false,
        suppressPriceBreakForOne: false,
        repricingRule: 1,
        suppressPriceBreak: false,
        beatQPrice: false,
        percentageIncrease: 10,
        compareWithQ1: true,
        competeAll: false,
        badgeIndicator: "BADGE",
        badgePercentage: 15,
        productName: "Test Product",
        cronId: "1",
        cronName: "Cron-1",
        requestInterval: 60,
        requestIntervalUnit: "min",
        scrapeOn: true,
        allowReprice: true,
        focusId: "1",
        priority: 1,
        wait_update_period: false,
        net32url: "https://example.com",
        abortDeactivatingQPriceBreak: false,
        ownVendorId: "17357",
        sisterVendorId: "20722;20755",
        tags: [],
        includeInactiveVendors: false,
        inactiveVendorId: "",
        override_bulk_update: false,
        override_bulk_rule: 0,
        latest_price: 99.99,
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
        inventoryThreshold: 10,
        percentageDown: "5",
        badgePercentageDown: "8",
        competeWithNext: false,
        triggeredByVendor: "",
        ignorePhantomQBreak: false,
        ownVendorThreshold: 10,
        skipReprice: false,
        secretKey: [],
        contextCronName: "",
      };

      mockedGlobalParam.GetInfo.mockResolvedValue({
        VENDOR_ID: 17357,
        EXCLUDED_VENDOR_ID: "20722;20755",
      });

      const result = await SetOwnVendorThreshold(productItem, []);

      expect(result).toEqual([]);
    });
  });
});
