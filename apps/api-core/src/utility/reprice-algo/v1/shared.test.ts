// Mock dependencies before imports
jest.mock("../../../model/global-param");
jest.mock("../../config", () => ({
  applicationConfig: {
    FLAG_MULTI_PRICE_UPDATE: true,
  },
}));
jest.mock("../../../utility/mysql/mysql-v2", () => ({
  GetCronSettingsDetailsById: jest.fn(),
  GetGlobalConfig: jest.fn(),
}));

import * as globalParam from "../../../model/global-param";
import { isPriceUpdateRequired, getSamePriceBreakDetails, notQ2VsQ1, getSecretKey, isOverrideEnabledForProduct, delay, MinQtyPricePresent, getIsFloorReached, getPriceStepValue } from "./shared";
import { GetCronSettingsDetailsById, GetGlobalConfig } from "../../../utility/mysql/mysql-v2";
import { RepriceModel, RepriceData } from "../../../model/reprice-model";
import { Net32Product, Net32PriceBreak } from "../../../types/net32";
import { FrontierProduct } from "../../../types/frontier";

describe("reprice-algo/v1/shared", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isPriceUpdateRequired", () => {
    it("should return true when reprice is on and new price differs from old price", () => {
      const repriceResult: RepriceModel = {
        repriceDetails: {
          newPrice: "10.00",
          oldPrice: "9.00",
        },
        isMultiplePriceBreakAvailable: false,
        listOfRepriceDetails: [],
      } as any;

      expect(isPriceUpdateRequired(repriceResult, true)).toBe(true);
    });

    it("should return false when reprice is off", () => {
      const repriceResult: RepriceModel = {
        repriceDetails: {
          newPrice: "10.00",
          oldPrice: "9.00",
        },
      } as any;

      expect(isPriceUpdateRequired(repriceResult, false)).toBe(false);
    });

    it("should return false when new price is N/A", () => {
      const repriceResult: RepriceModel = {
        repriceDetails: {
          newPrice: "N/A",
          oldPrice: "9.00",
        },
      } as any;

      expect(isPriceUpdateRequired(repriceResult, true)).toBe(false);
    });

    it("should return false when new price equals old price", () => {
      const repriceResult: RepriceModel = {
        repriceDetails: {
          newPrice: "9.00",
          oldPrice: "9.00",
        },
      } as any;

      expect(isPriceUpdateRequired(repriceResult, true)).toBe(false);
    });

    it("should return true when multiple price breaks available and price changed", () => {
      const repriceResult: RepriceModel = {
        repriceDetails: null,
        isMultiplePriceBreakAvailable: true,
        listOfRepriceDetails: [
          {
            newPrice: "10.00",
            oldPrice: "9.00",
            active: true,
          },
        ],
      } as any;

      expect(isPriceUpdateRequired(repriceResult, true)).toBe(true);
    });

    it("should return true when multiple price breaks available and active is false", () => {
      const repriceResult: RepriceModel = {
        repriceDetails: null,
        isMultiplePriceBreakAvailable: true,
        listOfRepriceDetails: [
          {
            newPrice: "9.00",
            oldPrice: "9.00",
            active: false,
          },
        ],
      } as any;

      expect(isPriceUpdateRequired(repriceResult, true)).toBe(true);
    });

    it("should return false when multiple price breaks available but no changes", () => {
      const repriceResult: RepriceModel = {
        repriceDetails: null,
        isMultiplePriceBreakAvailable: true,
        listOfRepriceDetails: [
          {
            newPrice: "9.00",
            oldPrice: "9.00",
            active: true,
          },
        ],
      } as any;

      expect(isPriceUpdateRequired(repriceResult, true)).toBe(false);
    });

    it("should return false when multiple price breaks available but list is empty", () => {
      const repriceResult: RepriceModel = {
        repriceDetails: null,
        isMultiplePriceBreakAvailable: true,
        listOfRepriceDetails: [],
      } as any;

      expect(isPriceUpdateRequired(repriceResult, true)).toBe(false);
    });
  });

  describe("getSamePriceBreakDetails", () => {
    const mockGetInfo = globalParam.GetInfo as jest.MockedFunction<typeof globalParam.GetInfo>;

    beforeEach(() => {
      mockGetInfo.mockResolvedValue({
        VENDOR_ID: "123",
        EXCLUDED_VENDOR_ID: "456;789",
      } as any);
    });

    // Note: FLAG_MULTI_PRICE_UPDATE is mocked at module level, so we test the true case
    // The false case would require module reset which is complex in Jest
    it("should process products when FLAG_MULTI_PRICE_UPDATE is true", async () => {
      const outputList: Net32Product[] = [{ vendorId: "123", priceBreaks: [] } as any, { vendorId: "456", priceBreaks: [] } as any];
      const priceBreak: Net32PriceBreak = { minQty: 1, price: 10 } as any;
      const productItem: FrontierProduct = {
        competeAll: true,
      } as any;

      const result = await getSamePriceBreakDetails(outputList, priceBreak, productItem);
      expect(result).toBeDefined();
    });

    it("should return outputList when length is 1", async () => {
      const outputList: Net32Product[] = [{ vendorId: "123", priceBreaks: [] } as any];
      const priceBreak: Net32PriceBreak = { minQty: 1, price: 10 } as any;
      const productItem: FrontierProduct = {} as any;

      const result = await getSamePriceBreakDetails(outputList, priceBreak, productItem);
      expect(result).toBe(outputList);
    });

    it("should filter products with same price break minQty", async () => {
      const outputList: Net32Product[] = [
        {
          vendorId: "456",
          priceBreaks: [{ minQty: 1, price: 10 }],
        },
        {
          vendorId: "789",
          priceBreaks: [{ minQty: 2, price: 9 }],
        },
        {
          vendorId: "999",
          priceBreaks: [{ minQty: 1, price: 8 }],
        },
      ] as any;

      const priceBreak: Net32PriceBreak = { minQty: 1, price: 10 } as any;
      const productItem: FrontierProduct = {
        competeAll: false,
      } as any;

      const result = await getSamePriceBreakDetails(outputList, priceBreak, productItem);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should exclude vendors in excluded list", async () => {
      const outputList: Net32Product[] = [
        {
          vendorId: "456",
          priceBreaks: [{ minQty: 1, price: 10 }],
        },
        {
          vendorId: "789",
          priceBreaks: [{ minQty: 1, price: 9 }],
        },
      ] as any;

      const priceBreak: Net32PriceBreak = { minQty: 1, price: 10 } as any;
      const productItem: FrontierProduct = {
        competeAll: false,
      } as any;

      const result = await getSamePriceBreakDetails(outputList, priceBreak, productItem);
      // Should not include excluded vendors
      expect(result.every((r) => r.vendorId !== "456" && r.vendorId !== "789")).toBe(true);
    });

    it("should handle competeAll true", async () => {
      const outputList: Net32Product[] = [
        {
          vendorId: "456",
          priceBreaks: [{ minQty: 1, price: 10 }],
        },
      ] as any;

      const priceBreak: Net32PriceBreak = { minQty: 1, price: 10 } as any;
      const productItem: FrontierProduct = {
        competeAll: true,
      } as any;

      const result = await getSamePriceBreakDetails(outputList, priceBreak, productItem);
      expect(result).toBeDefined();
    });
  });

  describe("notQ2VsQ1", () => {
    it("should return true when minQty is not 2", () => {
      expect(notQ2VsQ1(1, true)).toBe(true);
      expect(notQ2VsQ1(3, true)).toBe(true);
      expect(notQ2VsQ1(2, false)).toBe(true);
    });

    it("should return false when minQty is 2 and compareWithQ1 is true", () => {
      expect(notQ2VsQ1(2, true)).toBe(false);
    });
  });

  describe("getSecretKey", () => {
    const mockGetCronSettingsDetailsById = GetCronSettingsDetailsById as jest.MockedFunction<typeof GetCronSettingsDetailsById>;

    it("should return secret key when found", async () => {
      mockGetCronSettingsDetailsById.mockResolvedValue({
        SecretKey: [
          { vendorName: "vendor1", secretKey: "key1" },
          { vendorName: "vendor2", secretKey: "key2" },
        ],
      } as any);

      const result = await getSecretKey("cron1", "vendor1");
      expect(result).toBe("key1");
    });

    it("should throw error when cron setting details not found", async () => {
      mockGetCronSettingsDetailsById.mockResolvedValue(null);

      await expect(getSecretKey("cron1", "vendor1")).rejects.toThrow("Cron setting details not found for cron1");
    });

    it("should throw error when secret key not found", async () => {
      mockGetCronSettingsDetailsById.mockResolvedValue({
        SecretKey: [{ vendorName: "vendor1", secretKey: "key1" }],
      } as any);

      await expect(getSecretKey("cron1", "vendor2")).rejects.toThrow("Secret key not found for cron1 and vendor2");
    });

    it("should throw error when SecretKey array is empty", async () => {
      mockGetCronSettingsDetailsById.mockResolvedValue({
        SecretKey: [],
      } as any);

      await expect(getSecretKey("cron1", "vendor1")).rejects.toThrow("Secret key not found for cron1 and vendor1");
    });
  });

  describe("isOverrideEnabledForProduct", () => {
    const mockGetGlobalConfig = GetGlobalConfig as jest.MockedFunction<typeof GetGlobalConfig>;

    it("should return true when is_slow_cron_run is true", async () => {
      const result = await isOverrideEnabledForProduct(false, true);
      expect(result).toBe(true);
      expect(mockGetGlobalConfig).not.toHaveBeenCalled();
    });

    it("should return false when override_bulk_update is false", async () => {
      const result = await isOverrideEnabledForProduct(false, false);
      expect(result).toBe(false);
      expect(mockGetGlobalConfig).not.toHaveBeenCalled();
    });

    it("should return true when override_bulk_update is true and globalConfig.override_all is true", async () => {
      mockGetGlobalConfig.mockResolvedValue({
        override_all: "true",
      } as any);

      const result = await isOverrideEnabledForProduct(true, false);
      expect(result).toBe(true);
      expect(mockGetGlobalConfig).toHaveBeenCalled();
    });

    it("should return false when override_bulk_update is true and globalConfig.override_all is false", async () => {
      mockGetGlobalConfig.mockResolvedValue({
        override_all: "false",
      } as any);

      const result = await isOverrideEnabledForProduct(true, false);
      expect(result).toBe(false);
    });

    it("should return false when globalConfig is null", async () => {
      mockGetGlobalConfig.mockResolvedValue(null);

      const result = await isOverrideEnabledForProduct(true, false);
      expect(result).toBe(false);
    });

    it("should return false when globalConfig.override_all is null", async () => {
      mockGetGlobalConfig.mockResolvedValue({
        override_all: null,
      } as any);

      const result = await isOverrideEnabledForProduct(true, false);
      expect(result).toBe(false);
    });
  });

  describe("delay", () => {
    it("should delay for specified seconds", async () => {
      const start = Date.now();
      await delay(0.1); // 100ms
      const end = Date.now();
      const diff = end - start;
      expect(diff).toBeGreaterThanOrEqual(90); // Allow some margin
      expect(diff).toBeLessThan(200);
    });
  });

  describe("MinQtyPricePresent", () => {
    it("should return false when priceBreaks is null", () => {
      expect(MinQtyPricePresent(null as any, 1)).toBe(false);
    });

    it("should return false when priceBreaks is empty", () => {
      expect(MinQtyPricePresent([], 1)).toBe(false);
    });

    it("should return true when minQty is present", () => {
      const priceBreaks: Net32PriceBreak[] = [{ minQty: 1, price: 10 } as any, { minQty: 2, price: 9 } as any, { minQty: 3, price: 8 } as any];
      expect(MinQtyPricePresent(priceBreaks, 2)).toBe(true);
    });

    it("should return false when minQty is not present", () => {
      const priceBreaks: Net32PriceBreak[] = [{ minQty: 1, price: 10 } as any, { minQty: 2, price: 9 } as any];
      expect(MinQtyPricePresent(priceBreaks, 5)).toBe(false);
    });
  });

  describe("getIsFloorReached", () => {
    it("should return true when explained contains #HITFLOOR", async () => {
      const repricerDetails: RepriceData = {
        explained: "Some text #HITFLOOR more text",
      } as any;

      const result = await getIsFloorReached(repricerDetails);
      expect(result).toBe(true);
    });

    it("should return true when explained contains #hitfloor (case insensitive)", async () => {
      const repricerDetails: RepriceData = {
        explained: "Some text #hitfloor more text",
      } as any;

      const result = await getIsFloorReached(repricerDetails);
      expect(result).toBe(true);
    });

    it("should return false when explained does not contain #HITFLOOR", async () => {
      const repricerDetails: RepriceData = {
        explained: "Some text without floor",
      } as any;

      const result = await getIsFloorReached(repricerDetails);
      expect(result).toBe(false);
    });

    it("should throw error when explained is null", async () => {
      const repricerDetails: RepriceData = {
        explained: null,
      } as any;

      await expect(getIsFloorReached(repricerDetails)).rejects.toThrow("Reprice details explained is null");
    });

    it("should throw error when explained is undefined", async () => {
      const repricerDetails: RepriceData = {
        explained: undefined,
      } as any;

      await expect(getIsFloorReached(repricerDetails)).rejects.toThrow("Reprice details explained is null");
    });
  });

  describe("getPriceStepValue", () => {
    it("should return $DOWN when oldPrice > newPrice", async () => {
      const repricerDetails = {
        oldPrice: "10.00",
        newPrice: "9.00",
      };

      const result = await getPriceStepValue(repricerDetails);
      expect(result).toBe("$DOWN");
    });

    it("should return $UP when oldPrice < newPrice", async () => {
      const repricerDetails = {
        oldPrice: "9.00",
        newPrice: "10.00",
      };

      const result = await getPriceStepValue(repricerDetails);
      expect(result).toBe("$UP");
    });

    it("should return $SAME when oldPrice equals newPrice", async () => {
      const repricerDetails = {
        oldPrice: "10.00",
        newPrice: "10.00",
      };

      const result = await getPriceStepValue(repricerDetails);
      expect(result).toBe("$SAME");
    });

    it("should return $DOWN when newPrice is N/A (treated as 0) and oldPrice is greater", async () => {
      const repricerDetails = {
        oldPrice: "10.00",
        newPrice: "N/A",
      };

      const result = await getPriceStepValue(repricerDetails);
      expect(result).toBe("$DOWN"); // oldPrice (10) > newPrice (0), so price goes down
    });

    it("should handle decimal prices", async () => {
      const repricerDetails = {
        oldPrice: "9.99",
        newPrice: "10.01",
      };

      const result = await getPriceStepValue(repricerDetails);
      expect(result).toBe("$UP");
    });
  });
});
