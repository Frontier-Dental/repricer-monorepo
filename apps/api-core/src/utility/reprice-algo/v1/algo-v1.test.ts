// Mock shared package BEFORE imports
jest.mock("@repricer-monorepo/shared", () => ({
  AlgoExecutionMode: {
    V1_ONLY: "V1_ONLY",
    V2_ONLY: "V2_ONLY",
    V1_EXECUTE_V2_DRY: "V1_EXECUTE_V2_DRY",
    V2_EXECUTE_V1_DRY: "V2_EXECUTE_V1_DRY",
  },
}));

// Mock all dependencies
jest.mock("../../axios-helper");
jest.mock("../../config", () => ({
  applicationConfig: {
    FLAG_MULTI_PRICE_UPDATE: false,
    IS_DEV: false,
    PRICE_UPDATE_V2_ENABLED: false,
  },
}));
jest.mock("../../format-wrapper");
jest.mock("../../history-helper");
jest.mock("../../mysql/mysql-helper");
jest.mock("./reprice-helper");
jest.mock("./reprice-helper-nc");
jest.mock("./repricer-rule-helper");
jest.mock("../../response-utility");
jest.mock("./shared");
jest.mock("../../../utility/repriceResultParser");
jest.mock("../../../utility/filter-mapper");
jest.mock("../../../utility/buy-box-helper");
jest.mock("../../mysql/tinyproxy-configs");
jest.mock("../v2/wrapper");
jest.mock("../../../resources/api-mapping", () => ({
  apiMapping: [
    {
      vendor: "TRADENT",
      priceUpdateUrl: "https://api.net32-fake-url.com/products/offers/update",
    },
  ],
}));

import { AlgoExecutionMode } from "@repricer-monorepo/shared";
import { repriceProduct, repriceProductToMax } from "./algo-v1";
import * as axiosHelper from "../../axios-helper";
import { applicationConfig } from "../../config";
import * as formatter from "../../format-wrapper";
import * as HistoryHelper from "../../history-helper";
import * as mySqlHelper from "../../mysql/mysql-helper";
import * as repriceHelper from "./reprice-helper";
import * as repriceHelperNc from "./reprice-helper-nc";
import * as Rule from "./repricer-rule-helper";
import * as responseUtility from "../../response-utility";
import * as shared from "./shared";
import * as ResultParser from "../../../utility/repriceResultParser";
import * as filterMapper from "../../../utility/filter-mapper";
import * as buyBoxHelper from "../../../utility/buy-box-helper";
import { findTinyProxyConfigByVendorId } from "../../mysql/tinyproxy-configs";
import { updatePrice } from "../v2/wrapper";
import { RepriceModel, RepriceData } from "../../../model/reprice-model";
import { Net32Product } from "../../../types/net32";

// Suppress console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("algo-v1", () => {
  const mockMpid = "12345";
  const mockContextVendor = "TRADENT";

  const mockNet32Products: Net32Product[] = [
    {
      vendorProductId: 1,
      vendorProductCode: "PROD-001",
      vendorId: "1",
      vendorName: "TRADENT",
      vendorRegion: "US",
      inStock: true,
      standardShipping: 5,
      standardShippingStatus: "ACTIVE",
      freeShippingGap: 0,
      heavyShippingStatus: "NONE",
      heavyShipping: 0,
      shippingTime: 2,
      inventory: 100,
      isFulfillmentPolicyStock: false,
      vdrGeneralAverageRatingSum: 0,
      vdrNumberOfGeneralRatings: 0,
      isBackordered: false,
      vendorProductLevelLicenseRequiredSw: false,
      vendorVerticalLevelLicenseRequiredSw: false,
      priceBreaks: [
        { minQty: 1, unitPrice: 10, active: true },
        { minQty: 2, unitPrice: 18, active: true },
      ],
      badgeId: 0,
      badgeName: null,
      imagePath: "",
      arrivalDate: "",
      arrivalBusinessDays: 0,
      twoDayDeliverySw: false,
      isLowestTotalPrice: null,
    },
    {
      vendorProductId: 2,
      vendorProductCode: "PROD-002",
      vendorId: "2",
      vendorName: "Competitor",
      vendorRegion: "US",
      inStock: true,
      standardShipping: 5,
      standardShippingStatus: "ACTIVE",
      freeShippingGap: 0,
      heavyShippingStatus: "NONE",
      heavyShipping: 0,
      shippingTime: 2,
      inventory: 100,
      isFulfillmentPolicyStock: false,
      vdrGeneralAverageRatingSum: 0,
      vdrNumberOfGeneralRatings: 0,
      isBackordered: false,
      vendorProductLevelLicenseRequiredSw: false,
      vendorVerticalLevelLicenseRequiredSw: false,
      priceBreaks: [{ minQty: 1, unitPrice: 11, active: true }],
      badgeId: 0,
      badgeName: null,
      imagePath: "",
      arrivalDate: "",
      arrivalBusinessDays: 0,
      twoDayDeliverySw: false,
      isLowestTotalPrice: null,
    },
  ];

  const mockInternalProduct = {
    productName: "Test Product",
    unitPrice: 10,
    ownVendorId: "1",
    cronId: "cron-123",
    cronName: "TestCron",
    contextCronName: "TestCron",
    is_nc_needed: false,
    suppressPriceBreak: false,
    compareWithQ1: false,
    applyNcForBuyBox: false,
    override_bulk_update: false,
    isSlowCronRun: false,
    repricingRule: null,
    abortDeactivatingQPriceBreak: false,
    beatQPrice: null,
    percentageIncrease: null,
    applyBuyBoxLogic: false,
    keepPosition: false,
    suppressPriceBreakForOne: null,
    floorPrice: "5",
    inventoryThreshold: null,
    badgePercentageDown: null,
    scrapeOn: true,
    allowReprice: true,
    algo_execution_mode: AlgoExecutionMode.V1_ONLY,
    getBBShipping: false,
    getBBBadge: false,
  };

  const mockOwnProduct: Net32Product = {
    ...mockNet32Products[0],
  };

  const mockRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 9.99, true, false, [], "Price updated");

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mock implementations
    (formatter.FormatActiveField as jest.Mock).mockReturnValue(mockNet32Products);
    (formatter.FormatShippingThreshold as jest.Mock).mockReturnValue(mockNet32Products);
    (formatter.SetGlobalDetails as jest.Mock).mockReturnValue(mockInternalProduct);
    (formatter.SetOwnVendorThreshold as jest.Mock).mockResolvedValue(mockNet32Products);
    (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(mockOwnProduct);
    (responseUtility.FilterActiveResponse as jest.Mock).mockReturnValue(mockNet32Products);
    (repriceHelper.GetDistinctPriceBreaksAcrossVendors as jest.Mock).mockResolvedValue(null);
    (shared.MinQtyPricePresent as jest.Mock).mockReturnValue(true);
    (repriceHelper.Reprice as jest.Mock).mockResolvedValue(mockRepriceResult);
    (repriceHelper.RepriceIndividualPriceBreak as jest.Mock).mockResolvedValue(mockRepriceResult);
    (repriceHelperNc.Reprice as jest.Mock).mockResolvedValue(mockRepriceResult);
    (repriceHelperNc.RepriceIndividualPriceBreak as jest.Mock).mockResolvedValue(mockRepriceResult);
    (shared.getIsFloorReached as jest.Mock).mockResolvedValue(false);
    (shared.getSamePriceBreakDetails as jest.Mock).mockResolvedValue([]);
    (shared.notQ2VsQ1 as jest.Mock).mockReturnValue(true);
    (shared.isOverrideEnabledForProduct as jest.Mock).mockResolvedValue(false);
    (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
    (shared.getSecretKey as jest.Mock).mockResolvedValue("secret-key-123");
    // Rule functions should return the result as-is by default, but can be overridden in specific tests
    (Rule.ApplyRule as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.ApplyDeactivateQPriceBreakRule as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.ApplyMultiPriceBreakRule as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.ApplyBeatQPriceRule as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.ApplyPercentagePriceRule as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.ApplyBuyBoxRule as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.ApplyKeepPositionLogic as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.ApplySuppressPriceBreakRule as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.ApplyFloorCheckRule as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.ApplyRepriceDownBadgeCheckRule as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.AppendNewPriceBreakActivation as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (Rule.ApplySisterComparisonCheck as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    // AlignIsRepriced might modify isRepriced flag, so we need to preserve it
    (Rule.AlignIsRepriced as jest.Mock).mockImplementation((result) => {
      // Preserve the original isRepriced values
      if (result.listOfRepriceDetails && result.listOfRepriceDetails.length > 0) {
        result.listOfRepriceDetails.forEach((detail: any) => {
          // Keep original isRepriced value
        });
      }
      return Promise.resolve(result);
    });
    (Rule.OverrideRepriceResultForExpressCron as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (mySqlHelper.UpdateTriggeredByVendor as jest.Mock).mockResolvedValue(undefined);
    (HistoryHelper.Execute as jest.Mock).mockResolvedValue("history-id-123");
    (ResultParser.Parse as jest.Mock).mockReturnValue({ status: "SUCCESS" });
    (mySqlHelper.UpdateRepriceResultStatus as jest.Mock).mockResolvedValue(undefined);
    (filterMapper.IsWaitingForNextRun as jest.Mock).mockResolvedValue(false);
    (findTinyProxyConfigByVendorId as jest.Mock).mockResolvedValue({
      vendor_id: 1,
      ip: "127.0.0.1",
      port: 8080,
      proxy_username: "user",
      proxy_password: "pass",
    });
    (updatePrice as jest.Mock).mockResolvedValue({
      data: { status: true, message: "Success" },
    });
    (axiosHelper.postAsync as jest.Mock).mockResolvedValue({
      data: { status: "SUCCESS", message: "Price updated" },
    });
    (buyBoxHelper.parseShippingBuyBox as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (buyBoxHelper.parseBadgeBuyBox as jest.Mock).mockImplementation((result) => Promise.resolve(result));
    (shared.getPriceStepValue as jest.Mock).mockResolvedValue("$UP");
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("repriceProduct", () => {
    it("should throw error when net32Products is empty", async () => {
      await expect(repriceProduct(mockMpid, [], mockInternalProduct, mockContextVendor)).rejects.toThrow("Invalid response found in Net32 Api");
    });

    it("should return IGNORE_NOT_FOUND_API when ownProduct is not found", async () => {
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(null);

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);
      expect(result.cronResponse.repriceData.repriceDetails).toBeNull();
      expect(result.cronResponse.repriceData.net32id).toBe(mockMpid);
      expect(result.priceUpdateResponse).toBeNull();
      expect(result.historyIdentifier).toBeNull();
    });

    it("should handle single price break repricing", async () => {
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(repriceHelper.Reprice).toHaveBeenCalled();
      expect(result.cronResponse).toBeDefined();
      expect(result.historyIdentifier).toBeDefined();
    });

    it("should handle multiple price breaks repricing", async () => {
      // Create individual results for each price break
      const result1 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 9.99, true, false, [], "Price down");
      result1.repriceDetails = new RepriceData(10, 9.99, true, "Price down", 1);
      const result2 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 17.99, true, false, [], "Price down");
      result2.repriceDetails = new RepriceData(18, 17.99, true, "Price down", 2);
      (repriceHelper.RepriceIndividualPriceBreak as jest.Mock).mockResolvedValueOnce(result1).mockResolvedValueOnce(result2);

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(repriceHelper.RepriceIndividualPriceBreak).toHaveBeenCalled();
      expect(result.cronResponse.repriceData.isMultiplePriceBreakAvailable).toBe(true);
    });

    it("should handle product not in stock", async () => {
      const outOfStockProduct = {
        ...mockOwnProduct,
        inStock: false,
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(outOfStockProduct);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      (shared.getPriceStepValue as jest.Mock).mockResolvedValue("");

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      // The message is "The product is no longer available for vendor or Scrapping is OFF"
      // which is RepriceMessageEnum.IGNORE_PRODUCT_INACTIVE
      const explained = result.cronResponse.repriceData.repriceDetails?.explained || "";
      expect(explained).toContain("The product is no longer available");
    });

    it("should handle FLAG_MULTI_PRICE_UPDATE", async () => {
      (applicationConfig as any).FLAG_MULTI_PRICE_UPDATE = true;
      (repriceHelper.GetDistinctPriceBreaksAcrossVendors as jest.Mock).mockResolvedValue([{ minQty: 3, unitPrice: 25, active: true }]);

      await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(repriceHelper.GetDistinctPriceBreaksAcrossVendors).toHaveBeenCalled();
    });

    it("should add Q2 price break when compareWithQ1 is true and Q2 doesn't exist", async () => {
      const productWithoutQ2 = {
        ...mockInternalProduct,
        compareWithQ1: true,
      };
      const ownProductWithoutQ2 = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(ownProductWithoutQ2);
      (shared.MinQtyPricePresent as jest.Mock).mockReturnValue(false);

      await repriceProduct(mockMpid, mockNet32Products, productWithoutQ2, mockContextVendor);

      expect(shared.MinQtyPricePresent).toHaveBeenCalledWith(expect.anything(), 2);
    });

    it("should handle NC Buy Box application when floor is reached", async () => {
      const productWithNcBuyBox = {
        ...mockInternalProduct,
        applyNcForBuyBox: true,
      };
      // Create a result with repriceDetails for individual price break
      const resultWithDetails = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 5, true, false, [], "Price down");
      resultWithDetails.repriceDetails = new RepriceData(10, 5, true, "Price down", 1);
      resultWithDetails.repriceDetails.minQty = 1;
      // Need multiple price breaks to trigger the listOfRepriceDetails path
      const multipleRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", null, false, true, [new RepriceData(10, 5, true, "Price down", 1)]);
      multipleRepriceResult.listOfRepriceDetails[0].minQty = 1;
      (repriceHelper.RepriceIndividualPriceBreak as jest.Mock).mockResolvedValue(resultWithDetails);
      (shared.getIsFloorReached as jest.Mock).mockResolvedValue(true);
      const ncResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 4.99, true, false, [], "Price down");
      ncResult.repriceDetails = new RepriceData(10, 4.99, true, "Price down #NCBuyBox", 1);
      (repriceHelperNc.RepriceIndividualPriceBreak as jest.Mock).mockResolvedValue(ncResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves the product settings
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      await repriceProduct(mockMpid, mockNet32Products, productWithNcBuyBox, mockContextVendor);

      expect(shared.getIsFloorReached).toHaveBeenCalled();
      expect(repriceHelperNc.RepriceIndividualPriceBreak).toHaveBeenCalled();
    });

    it("should handle NC Buy Box for single repriceDetails", async () => {
      const productWithNcBuyBox = {
        ...mockInternalProduct,
        applyNcForBuyBox: true,
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      const singleRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 5, true, false, [], "Price down");
      singleRepriceResult.repriceDetails = new RepriceData(10, 5, true, "Price down", 1);
      // Ensure listOfRepriceDetails is empty so it goes to the repriceDetails path
      singleRepriceResult.listOfRepriceDetails = [];
      (repriceHelper.Reprice as jest.Mock).mockResolvedValue(singleRepriceResult);
      (shared.getIsFloorReached as jest.Mock).mockResolvedValue(true);
      const ncResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 4.99, true, false, [], "Price down");
      ncResult.repriceDetails = new RepriceData(10, 4.99, true, "Price down #NCBuyBox", 1);
      (repriceHelperNc.Reprice as jest.Mock).mockResolvedValue(ncResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves the product settings
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      await repriceProduct(mockMpid, mockNet32Products, productWithNcBuyBox, mockContextVendor);

      expect(repriceHelperNc.Reprice).toHaveBeenCalled();
    });

    it("should apply override rule when override_bulk_update is enabled", async () => {
      const productWithOverride = {
        ...mockInternalProduct,
        override_bulk_update: true,
        override_bulk_rule: "RULE_1",
      };
      (shared.isOverrideEnabledForProduct as jest.Mock).mockResolvedValue(true);
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves the override_bulk_rule
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => {
        // Preserve override_bulk_rule
        return productItem;
      });

      await repriceProduct(mockMpid, mockNet32Products, productWithOverride, mockContextVendor);

      expect(Rule.ApplyRule).toHaveBeenCalledWith(expect.anything(), "RULE_1", expect.anything(), expect.anything());
    });

    it("should apply repricingRule when override is not enabled", async () => {
      const productWithRule = {
        ...mockInternalProduct,
        repricingRule: "RULE_2",
      };
      (shared.isOverrideEnabledForProduct as jest.Mock).mockResolvedValue(false);
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves the repricingRule
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => {
        // Preserve repricingRule
        return productItem;
      });

      await repriceProduct(mockMpid, mockNet32Products, productWithRule, mockContextVendor);

      expect(Rule.ApplyRule).toHaveBeenCalledWith(expect.anything(), "RULE_2", expect.anything(), expect.anything());
    });

    it("should apply beatQPrice rule when enabled", async () => {
      const productWithBeatQ = {
        ...mockInternalProduct,
        beatQPrice: true,
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves beatQPrice
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      await repriceProduct(mockMpid, mockNet32Products, productWithBeatQ, mockContextVendor);

      expect(Rule.ApplyBeatQPriceRule).toHaveBeenCalled();
    });

    it("should apply percentageIncrease rule when value is greater than 0", async () => {
      const productWithPercentage = {
        ...mockInternalProduct,
        percentageIncrease: 10,
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves percentageIncrease
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      await repriceProduct(mockMpid, mockNet32Products, productWithPercentage, mockContextVendor);

      expect(Rule.ApplyPercentagePriceRule).toHaveBeenCalledWith(expect.anything(), 10);
    });

    it("should apply buyBoxLogic when enabled", async () => {
      const productWithBuyBox = {
        ...mockInternalProduct,
        applyBuyBoxLogic: true,
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves applyBuyBoxLogic
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      await repriceProduct(mockMpid, mockNet32Products, productWithBuyBox, mockContextVendor);

      expect(Rule.ApplyBuyBoxRule).toHaveBeenCalled();
    });

    it("should apply keepPosition logic when enabled", async () => {
      const productWithKeepPosition = {
        ...mockInternalProduct,
        keepPosition: true,
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves keepPosition
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      await repriceProduct(mockMpid, mockNet32Products, productWithKeepPosition, mockContextVendor);

      expect(Rule.ApplyKeepPositionLogic).toHaveBeenCalled();
    });

    it("should apply suppressPriceBreakForOne when enabled", async () => {
      const productWithSuppress = {
        ...mockInternalProduct,
        suppressPriceBreakForOne: true,
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves suppressPriceBreakForOne
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      await repriceProduct(mockMpid, mockNet32Products, productWithSuppress, mockContextVendor);

      expect(Rule.ApplySuppressPriceBreakRule).toHaveBeenCalled();
    });

    it("should append #InvThreshold when inventoryThreshold is set", async () => {
      const productWithInventory = {
        ...mockInternalProduct,
        inventoryThreshold: 50,
      };
      const result1 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 9.99, true, false, [], "Price down");
      result1.repriceDetails = new RepriceData(10, 9.99, true, "Price down", 1);
      const result2 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 17.99, true, false, [], "Price down");
      result2.repriceDetails = new RepriceData(18, 17.99, true, "Price down", 2);
      (repriceHelper.RepriceIndividualPriceBreak as jest.Mock).mockResolvedValueOnce(result1).mockResolvedValueOnce(result2);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Mock Rule functions to return the result as-is so #InvThreshold is appended
      (Rule.ApplyRepriceDownBadgeCheckRule as jest.Mock).mockImplementation((result) => Promise.resolve(result));
      (Rule.AppendNewPriceBreakActivation as jest.Mock).mockImplementation((result) => Promise.resolve(result));
      // Ensure formatter.SetGlobalDetails preserves inventoryThreshold
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      const result = await repriceProduct(mockMpid, mockNet32Products, productWithInventory, mockContextVendor);

      expect(result.cronResponse.repriceData.listOfRepriceDetails[0].explained).toContain("#InvThreshold");
    });

    it("should apply shipping buyBox when getBBShipping is enabled", async () => {
      const productWithBBShipping = {
        ...mockInternalProduct,
        getBBShipping: true,
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      const singleRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 9.99, true, false, [], "Price down");
      singleRepriceResult.repriceDetails = new RepriceData(10, 9.99, true, "Price down", 1);
      // Make listOfRepriceDetails empty so the buyBox condition is met (line 196)
      singleRepriceResult.listOfRepriceDetails = [];
      (repriceHelper.Reprice as jest.Mock).mockResolvedValue(singleRepriceResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves getBBShipping
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      await repriceProduct(mockMpid, mockNet32Products, productWithBBShipping, mockContextVendor);

      expect(buyBoxHelper.parseShippingBuyBox).toHaveBeenCalled();
    });

    it("should apply badge buyBox when getBBBadge is enabled", async () => {
      const productWithBBBadge = {
        ...mockInternalProduct,
        getBBBadge: true,
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      const singleRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 9.99, true, false, [], "Price down");
      singleRepriceResult.repriceDetails = new RepriceData(10, 9.99, true, "Price down", 1);
      // Make listOfRepriceDetails empty so the buyBox condition is met (line 201)
      singleRepriceResult.listOfRepriceDetails = [];
      (repriceHelper.Reprice as jest.Mock).mockResolvedValue(singleRepriceResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves getBBBadge
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      await repriceProduct(mockMpid, mockNet32Products, productWithBBBadge, mockContextVendor);

      expect(buyBoxHelper.parseBadgeBuyBox).toHaveBeenCalled();
    });

    it("should return early when reprice is not needed", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(result.priceUpdateResponse).toBeNull();
      expect(axiosHelper.postAsync).not.toHaveBeenCalled();
      expect(updatePrice).not.toHaveBeenCalled();
    });

    it("should handle waiting for next run", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (filterMapper.IsWaitingForNextRun as jest.Mock).mockResolvedValue(true);

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(result.priceUpdateResponse).toBeNull();
      expect(Rule.OverrideRepriceResultForExpressCron).toHaveBeenCalled();
    });

    it("should update price for single price break when V2 is disabled", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).PRICE_UPDATE_V2_ENABLED = false;
      (applicationConfig as any).IS_DEV = false;

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(axiosHelper.postAsync).toHaveBeenCalled();
      expect(result.priceUpdateResponse).toBeDefined();
    });

    it("should update price for single price break when V2 is enabled", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).PRICE_UPDATE_V2_ENABLED = true;
      (applicationConfig as any).IS_DEV = false;

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(updatePrice).toHaveBeenCalled();
      expect(result.priceUpdateResponse).toBeDefined();
    });

    it("should return dummy response in dev mode", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).IS_DEV = true;

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(result.priceUpdateResponse?.status).toBe("SUCCESS");
      expect(result.priceUpdateResponse?.type).toBe("dummy");
    });

    it("should handle multiple price breaks update", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).IS_DEV = false;
      (applicationConfig as any).PRICE_UPDATE_V2_ENABLED = false;

      const result1 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 9.99, true, false, [], "Price down");
      result1.repriceDetails = new RepriceData(10, 9.99, true, "Price down", 1);
      const result2 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 17.99, true, false, [], "Price down");
      result2.repriceDetails = new RepriceData(18, 17.99, true, "Price down", 2);
      (repriceHelper.RepriceIndividualPriceBreak as jest.Mock).mockResolvedValueOnce(result1).mockResolvedValueOnce(result2);

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(axiosHelper.postAsync).toHaveBeenCalled();
    });

    it("should handle deactivating price breaks in multiple price break scenario", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).IS_DEV = false;
      (applicationConfig as any).PRICE_UPDATE_V2_ENABLED = false;

      const result1 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 9.99, true, false, [], "Price down");
      result1.repriceDetails = new RepriceData(10, 9.99, true, "Price down", 1);
      const result2 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 0, true, false, [], "Deactivate");
      result2.repriceDetails = new RepriceData(18, 0, true, "Deactivate", 2);
      result2.repriceDetails.active = false;
      (repriceHelper.RepriceIndividualPriceBreak as jest.Mock).mockResolvedValueOnce(result1).mockResolvedValueOnce(result2);

      await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(axiosHelper.postAsync).toHaveBeenCalled();
    });

    it("should handle ERROR:422 in price update response", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).IS_DEV = false;
      (applicationConfig as any).PRICE_UPDATE_V2_ENABLED = false;
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      (axiosHelper.postAsync as jest.Mock).mockResolvedValue({
        data: { message: "ERROR:422:Invalid request" },
      });

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(result.cronResponse.repriceData.repriceDetails?.explained).toContain("FAILED");
      expect(result.cronResponse.repriceData.repriceDetails?.isRepriced).toBe(false);
    });

    it("should handle ERROR:429 in price update response", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).IS_DEV = false;
      (axiosHelper.postAsync as jest.Mock).mockResolvedValue({
        data: { message: "ERROR:429:Rate limit exceeded" },
      });

      await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(axiosHelper.postAsync).toHaveBeenCalled();
    });

    it("should add price step value on successful update", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).IS_DEV = false;
      (axiosHelper.postAsync as jest.Mock).mockResolvedValue({
        data: { status: "SUCCESS", message: "Updated" },
      });

      const result = await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);

      expect(shared.getPriceStepValue).toHaveBeenCalled();
    });

    it("should handle V1_EXECUTE_V2_DRY execution mode", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).IS_DEV = false;
      const productWithV1Dry = {
        ...mockInternalProduct,
        algo_execution_mode: AlgoExecutionMode.V1_EXECUTE_V2_DRY,
      };

      await repriceProduct(mockMpid, mockNet32Products, productWithV1Dry, mockContextVendor);

      expect(axiosHelper.postAsync).toHaveBeenCalled();
    });

    it("should not update price when V2_ONLY mode", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).IS_DEV = false;
      (applicationConfig as any).PRICE_UPDATE_V2_ENABLED = false;
      const productWithV2Only = {
        ...mockInternalProduct,
        algo_execution_mode: AlgoExecutionMode.V2_ONLY,
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      // Ensure repriceResult has repriceDetails with newPrice
      const singleRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 9.99, true, false, [], "Price updated");
      singleRepriceResult.repriceDetails = new RepriceData(10, 9.99, true, "Price updated", 1);
      (repriceHelper.Reprice as jest.Mock).mockResolvedValue(singleRepriceResult);
      // Ensure formatter.SetGlobalDetails preserves the algo_execution_mode
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);

      const result = await repriceProduct(mockMpid, mockNet32Products, productWithV2Only, mockContextVendor);

      expect(result.priceUpdateResponse).toBeDefined();
      expect(result.priceUpdateResponse?.status).toBe("SUCCESS");
      expect(result.priceUpdateResponse?.type).toBe("dummy");
      expect(axiosHelper.postAsync).not.toHaveBeenCalled();
      expect(updatePrice).not.toHaveBeenCalled();
    });

    it("should handle scrapeOn false", async () => {
      const productWithScrapeOff = {
        ...mockInternalProduct,
        scrapeOn: false,
      };
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      // Mock FilterActiveResponse to return empty array when scrapeOn is false
      (responseUtility.FilterActiveResponse as jest.Mock).mockReturnValue([]);

      const result = await repriceProduct(mockMpid, mockNet32Products, productWithScrapeOff, mockContextVendor);

      // When scrapeOn is false, output is set to empty array (line 221)
      expect(result.cronResponse.sourceResult).toEqual([]);
    });

    it("should handle suppressPriceBreak flag", async () => {
      const productWithSuppress = {
        ...mockInternalProduct,
        suppressPriceBreak: true,
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);

      await repriceProduct(mockMpid, mockNet32Products, productWithSuppress, mockContextVendor);

      expect(repriceHelper.Reprice).toHaveBeenCalled();
    });

    it("should handle is_nc_needed flag", async () => {
      const productWithNc = {
        ...mockInternalProduct,
        is_nc_needed: true,
        suppressPriceBreak: false, // Ensure suppressPriceBreak is false so single price break path is taken
      };
      const singlePriceBreakProduct = {
        ...mockOwnProduct,
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(singlePriceBreakProduct);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Ensure formatter.SetGlobalDetails preserves is_nc_needed
      (formatter.SetGlobalDetails as jest.Mock).mockImplementation((productItem) => productItem);
      // Reset the mock to ensure it's called - need to reset before setting up new mocks
      (repriceHelperNc.Reprice as jest.Mock).mockReset();
      (repriceHelper.Reprice as jest.Mock).mockReset();
      // Mock the NC Reprice to return a result
      const ncRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 9.99, true, false, [], "Price updated");
      (repriceHelperNc.Reprice as jest.Mock).mockResolvedValue(ncRepriceResult);
      // Ensure Reprice is not called by not setting it up
      (repriceHelper.Reprice as jest.Mock).mockImplementation(() => {
        throw new Error("Reprice should not be called when is_nc_needed is true");
      });

      await repriceProduct(mockMpid, mockNet32Products, productWithNc, mockContextVendor);

      // When is_nc_needed is true and single price break, it should call repriceHelperNc.Reprice instead of repriceHelper.Reprice
      // Line 78: repriceResult = productItem.is_nc_needed == true ? await repriceHelperNc.Reprice(...) : await repriceHelper.Reprice(...)
      expect(repriceHelperNc.Reprice).toHaveBeenCalled();
      expect(repriceHelper.Reprice).not.toHaveBeenCalled();
    });

    it("should handle toggle price point when no other vendor found for Q2", async () => {
      const productWithCompareQ1 = {
        ...mockInternalProduct,
        compareWithQ1: true,
      };
      (shared.getSamePriceBreakDetails as jest.Mock).mockResolvedValue([]);
      (shared.notQ2VsQ1 as jest.Mock).mockReturnValue(true);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);

      const result1 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 9.99, true, false, [], "Price down");
      result1.repriceDetails = new RepriceData(10, 9.99, true, "Price down", 1);
      const result2 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 17.99, true, false, [], "Price down");
      result2.repriceDetails = new RepriceData(18, 17.99, true, "Price down", 2);
      (repriceHelper.RepriceIndividualPriceBreak as jest.Mock).mockResolvedValueOnce(result1).mockResolvedValueOnce(result2);

      await repriceProduct(mockMpid, mockNet32Products, productWithCompareQ1, mockContextVendor);

      expect(shared.getSamePriceBreakDetails).toHaveBeenCalled();
    });

    it("should handle multiple price breaks with empty priceList", async () => {
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).IS_DEV = false;
      (applicationConfig as any).PRICE_UPDATE_V2_ENABLED = false;

      const repriceData1 = new RepriceData(10, "N/A", false, "No change", 1);
      const repriceData2 = new RepriceData(18, "N/A", false, "No change", 2);
      // Ensure active is set to true (default) so the code doesn't treat them as inactive
      repriceData1.active = true;
      repriceData2.active = true;

      const result1 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", null, false, false, [], "No change");
      result1.repriceDetails = repriceData1;
      const result2 = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", null, false, false, [], "No change");
      result2.repriceDetails = repriceData2;
      (repriceHelper.RepriceIndividualPriceBreak as jest.Mock).mockResolvedValueOnce(result1).mockResolvedValueOnce(result2);
      // Clear previous calls
      (axiosHelper.postAsync as jest.Mock).mockClear();
      (Rule.AlignIsRepriced as jest.Mock).mockImplementation((result) => {
        if (result.listOfRepriceDetails && result.listOfRepriceDetails.length > 0) {
          result.listOfRepriceDetails.forEach((detail: any) => {
            // Force isRepriced to stay false - AlignIsRepriced won't modify it if newPrice = "N/A"
            detail.isRepriced = false;
          });
        }
        return Promise.resolve(result);
      });

      await repriceProduct(mockMpid, mockNet32Products, mockInternalProduct, mockContextVendor);
      expect(axiosHelper.postAsync).not.toHaveBeenCalled();
    });
  });

  describe("repriceProductToMax", () => {
    it("should return undefined when net32Products is empty", async () => {
      const result = await repriceProductToMax(mockMpid, [], mockInternalProduct as any, mockContextVendor);

      expect(result).toBeUndefined();
    });

    it("should return undefined when ownProduct is not found", async () => {
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(null);

      const result = await repriceProductToMax(mockMpid, mockNet32Products, mockInternalProduct as any, mockContextVendor);

      expect(result).toBeUndefined();
    });

    it("should handle reprice to max successfully", async () => {
      const maxRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 20, true, false, [], "Price maxed");
      (repriceHelper.RepriceToMax as jest.Mock).mockResolvedValue(maxRepriceResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      (applicationConfig as any).IS_DEV = false;
      process.env.IS_DEV = "false";

      const result = await repriceProductToMax(mockMpid, mockNet32Products, mockInternalProduct as any, mockContextVendor);

      expect(repriceHelper.RepriceToMax).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.cronResponse).toBeDefined();
    });

    it("should return dummy response in dev mode", async () => {
      const maxRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 20, true, false, [], "Price maxed");
      (repriceHelper.RepriceToMax as jest.Mock).mockResolvedValue(maxRepriceResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      process.env.IS_DEV = "true";

      const result = await repriceProductToMax(mockMpid, mockNet32Products, mockInternalProduct as any, mockContextVendor);

      expect(result?.priceUpdateResponse?.status).toBe("SUCCESS");
      expect(result?.priceUpdateResponse?.type).toBe("dummy");
    });

    it("should handle product not in stock", async () => {
      const outOfStockProduct = {
        ...mockOwnProduct,
        inStock: false,
      };
      (responseUtility.GetOwnProduct as jest.Mock).mockReturnValue(outOfStockProduct);

      const result = await repriceProductToMax(mockMpid, mockNet32Products, mockInternalProduct as any, mockContextVendor);

      expect(repriceHelper.RepriceToMax).not.toHaveBeenCalled();
    });

    it("should handle ERROR:422 in price update response", async () => {
      const maxRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 20, true, false, [], "Price maxed");
      (repriceHelper.RepriceToMax as jest.Mock).mockResolvedValue(maxRepriceResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      process.env.IS_DEV = "false";
      (axiosHelper.postAsync as jest.Mock).mockResolvedValue({
        data: { message: "ERROR:422:Invalid request" },
      });

      const result = await repriceProductToMax(mockMpid, mockNet32Products, mockInternalProduct as any, mockContextVendor);

      expect(result?.cronResponse.repriceData.repriceDetails?.explained).toContain("FAILED");
      expect(result?.cronResponse.repriceData.repriceDetails?.isRepriced).toBe(false);
    });

    it("should add price step value on successful update", async () => {
      const maxRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 20, true, false, [], "Price maxed");
      (repriceHelper.RepriceToMax as jest.Mock).mockResolvedValue(maxRepriceResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      process.env.IS_DEV = "false";
      (axiosHelper.postAsync as jest.Mock).mockResolvedValue({
        data: { status: "SUCCESS", message: "Updated" },
      });

      await repriceProductToMax(mockMpid, mockNet32Products, mockInternalProduct as any, mockContextVendor);

      expect(shared.getPriceStepValue).toHaveBeenCalled();
    });

    it("should handle exception during execution", async () => {
      (formatter.FormatActiveField as jest.Mock).mockRejectedValue(new Error("Format error"));

      const result = await repriceProductToMax(mockMpid, mockNet32Products, mockInternalProduct as any, mockContextVendor);

      expect(console.error).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should handle scrapeOn false", async () => {
      const productWithScrapeOff = {
        ...mockInternalProduct,
        scrapeOn: false,
      };
      const maxRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 20, true, false, [], "Price maxed");
      (repriceHelper.RepriceToMax as jest.Mock).mockResolvedValue(maxRepriceResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);
      // Mock FilterActiveResponse to return empty array when scrapeOn is false
      (responseUtility.FilterActiveResponse as jest.Mock).mockReturnValue([]);

      const result = await repriceProductToMax(mockMpid, mockNet32Products, productWithScrapeOff as any, mockContextVendor);

      expect(result?.cronResponse.sourceResult).toEqual([]);
    });

    it("should return null priceUpdateResponse when reprice not needed", async () => {
      const maxRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", 20, true, false, [], "Price maxed");
      (repriceHelper.RepriceToMax as jest.Mock).mockResolvedValue(maxRepriceResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(false);

      const result = await repriceProductToMax(mockMpid, mockNet32Products, mockInternalProduct as any, mockContextVendor);

      expect(result?.priceUpdateResponse).toBeNull();
    });

    it("should handle multiple price break scenario", async () => {
      const maxRepriceResult = new RepriceModel(mockMpid, mockOwnProduct, "Test Product", null, false, true, [new RepriceData(10, 20, true, "Price maxed", 1)]);
      (repriceHelper.RepriceToMax as jest.Mock).mockResolvedValue(maxRepriceResult);
      (shared.isPriceUpdateRequired as jest.Mock).mockReturnValue(true);
      process.env.IS_DEV = "false";

      const result = await repriceProductToMax(mockMpid, mockNet32Products, mockInternalProduct as any, mockContextVendor);

      // Should not update price for multiple price breaks in repriceProductToMax
      expect(axiosHelper.postAsync).not.toHaveBeenCalled();
    });
  });
});
