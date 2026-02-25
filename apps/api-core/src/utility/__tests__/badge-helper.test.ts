// Mock dependencies before imports
jest.mock("../../model/global-param", () => ({
  GetInfo: jest.fn(),
}));

import * as globalParam from "../../model/global-param";
import { ReCalculatePrice, ReCalculatePriceForNc } from "../badge-helper";
import { RepriceModel, RepriceData } from "../../model/reprice-model";
import { RepriceRenewedMessageEnum } from "../../model/reprice-renewed-message";
import { FrontierProduct } from "../../types/frontier";
import { Net32Product, Net32PriceBreak } from "../../types/net32";

describe("badge-helper", () => {
  const mockGetInfo = globalParam.GetInfo as jest.MockedFunction<typeof globalParam.GetInfo>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInfo.mockResolvedValue({
      VENDOR_ID: "123",
    } as any);
  });

  describe("ReCalculatePrice", () => {
    const mockProduct = {
      priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
    } as any;

    it("should return repriceModel unchanged when repriceDetails is null", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "N/A", false, false, [], "");
      repriceModel.repriceDetails = null;

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 5,
        badgePercentage: "10",
      } as any;

      const result = await ReCalculatePrice(repriceModel, productItem, [], 1);
      expect(result).toBe(repriceModel);
    });

    it("should return repriceModel unchanged when newPrice is N/A", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "N/A", false, false, [], "");
      repriceModel.repriceDetails = new RepriceData(10, "N/A", false, "", 1);

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 5,
        badgePercentage: "10",
      } as any;

      const result = await ReCalculatePrice(repriceModel, productItem, [], 1);
      expect(result).toBe(repriceModel);
    });

    it("should return repriceModel unchanged when no badged items", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "10.00", false, false, [], "");
      repriceModel.repriceDetails = new RepriceData(10, "10.00", true, "", 1);

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 5,
        badgePercentage: "10",
      } as any;

      const eligibleList: Net32Product[] = [{ vendorId: "456", badgeId: 0, badgeName: null } as any, { vendorId: "789", badgeId: 0 } as any];

      const result = await ReCalculatePrice(repriceModel, productItem, eligibleList, 1);
      expect(result).toBe(repriceModel);
    });

    it("should filter out own vendor from badged items", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "10.00", false, false, [], "");
      repriceModel.repriceDetails = new RepriceData(10, "10.00", true, "", 1);

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 5,
        badgePercentage: "10",
      } as any;

      // After filtering out own vendor, no badged items remain, so function returns early
      const eligibleList: Net32Product[] = [
        { vendorId: "123", badgeId: 1, badgeName: "Best Seller", priceBreaks: [] } as any, // Own vendor - will be filtered out
        { vendorId: "456", badgeId: 0, badgeName: null } as any, // No badge - won't be in badged items
      ];

      const result = await ReCalculatePrice(repriceModel, productItem, eligibleList, 1);
      expect(result).toBe(repriceModel);
    });

    it("should update price when allowedPrice >= floorPrice", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "10.00", false, false, [], "");
      repriceModel.repriceDetails = new RepriceData(10, "10.00", true, "Original", 1);

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 5,
        badgePercentage: "10", // 10% discount
      } as any;

      const priceBreak: Net32PriceBreak = {
        minQty: 1,
        unitPrice: 10,
        active: true,
      } as any;

      const eligibleList: Net32Product[] = [
        {
          vendorId: "456",
          badgeId: 1,
          badgeName: "Best Seller",
          priceBreaks: [priceBreak],
        } as any,
      ];

      const result = await ReCalculatePrice(repriceModel, productItem, eligibleList, 1);
      expect(result.repriceDetails?.newPrice).toBe("9.00"); // 10 * (1 - 0.1) = 9
      expect(result.repriceDetails?.goToPrice).toBe("10.00");
      expect(result.repriceDetails?.explained).toContain(RepriceRenewedMessageEnum.PRICE_CHANGE_BADGE_PERCENTAGE);
    });

    it("should mark floor hit when allowedPrice < floorPrice", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "10.00", false, false, [], "");
      repriceModel.repriceDetails = new RepriceData(10, "10.00", true, "Original", 1);

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 10, // High floor price
        badgePercentage: "50", // 50% discount
      } as any;

      const priceBreak: Net32PriceBreak = {
        minQty: 1,
        unitPrice: 10,
        active: true,
      } as any;

      const eligibleList: Net32Product[] = [
        {
          vendorId: "456",
          badgeId: 1,
          badgeName: "Best Seller",
          priceBreaks: [priceBreak],
        } as any,
      ];

      const result = await ReCalculatePrice(repriceModel, productItem, eligibleList, 1);
      expect(result.repriceDetails?.explained).toContain("Can't match the price. #PriceTooLow");
    });

    it("should not update when calculatedNewPrice < allowedPrice", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "8.00", false, false, [], "");
      repriceModel.repriceDetails = new RepriceData(10, "8.00", true, "Original", 1);

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 5,
        badgePercentage: "10",
      } as any;

      const priceBreak: Net32PriceBreak = {
        minQty: 1,
        unitPrice: 10,
        active: true,
      } as any;

      const eligibleList: Net32Product[] = [
        {
          vendorId: "456",
          badgeId: 1,
          badgeName: "Best Seller",
          priceBreaks: [priceBreak],
        } as any,
      ];

      const result = await ReCalculatePrice(repriceModel, productItem, eligibleList, 1);
      expect(result.repriceDetails?.newPrice).toBe("8.00"); // Unchanged
    });

    it("should handle multiple badged items and use lowest price", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "10.00", false, false, [], "");
      repriceModel.repriceDetails = new RepriceData(10, "10.00", true, "Original", 1);

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 5,
        badgePercentage: "10",
      } as any;

      const eligibleList: Net32Product[] = [
        {
          vendorId: "456",
          badgeId: 1,
          badgeName: "Best Seller",
          priceBreaks: [{ minQty: 1, unitPrice: 12, active: true }] as any,
        } as any,
        {
          vendorId: "789",
          badgeId: 1,
          badgeName: "Best Seller",
          priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }] as any,
        } as any,
      ];

      const result = await ReCalculatePrice(repriceModel, productItem, eligibleList, 1);
      expect(result.repriceDetails?.newPrice).toBe("9.00"); // Based on lowest (10 * 0.9)
    });
  });

  describe("ReCalculatePriceForNc", () => {
    const mockProduct = {
      priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
    } as any;

    it("should return repriceModel unchanged when repriceDetails is null", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "N/A", false, false, [], "");
      repriceModel.repriceDetails = null;

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 5,
        badgePercentage: "10",
      } as any;

      const result = await ReCalculatePriceForNc(repriceModel, productItem, [], 1);
      expect(result).toBe(repriceModel);
    });

    it("should update price with shipping calculation when allowedPrice >= floorPrice", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "10.00", false, false, [], "");
      repriceModel.repriceDetails = new RepriceData(10, "10.00", true, "Original", 1);

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 5,
        badgePercentage: "10",
      } as any;

      const ownVendorProduct: Net32Product = {
        vendorId: "123",
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }] as any,
        standardShipping: "5.00",
        freeShippingThreshold: 50,
      } as any;

      const competitorPriceBreak: Net32PriceBreak = {
        minQty: 1,
        unitPrice: 10,
        active: true,
      } as any;

      const eligibleList: Net32Product[] = [
        ownVendorProduct,
        {
          vendorId: "456",
          badgeId: 1,
          badgeName: "Best Seller",
          priceBreaks: [competitorPriceBreak],
          standardShipping: "5.00",
          freeShippingThreshold: 50,
        } as any,
      ];

      const result = await ReCalculatePriceForNc(repriceModel, productItem, eligibleList, 1);
      expect(result.repriceDetails?.goToPrice).toBe("10.00");
      expect(result.repriceDetails?.explained).toContain(RepriceRenewedMessageEnum.PRICE_CHANGE_BADGE_PERCENTAGE);
    });

    it("should set newPrice to N/A when allowedPrice < floorPrice", async () => {
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "10.00", false, false, [], "");
      repriceModel.repriceDetails = new RepriceData(10, "10.00", true, "Original", 1);

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 20, // High floor
        badgePercentage: "50",
      } as any;

      const ownVendorProduct: Net32Product = {
        vendorId: "123",
        priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }] as any,
        standardShipping: "5.00",
        freeShippingThreshold: 50,
      } as any;

      const eligibleList: Net32Product[] = [
        ownVendorProduct,
        {
          vendorId: "456",
          badgeId: 1,
          badgeName: "Best Seller",
          priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }] as any,
          standardShipping: "5.00",
          freeShippingThreshold: 50,
        } as any,
      ];

      const result = await ReCalculatePriceForNc(repriceModel, productItem, eligibleList, 1);
      expect(result.repriceDetails?.newPrice).toBe("N/A");
      expect(result.repriceDetails?.explained).toContain(RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED);
    });

    it("should handle free shipping threshold correctly", async () => {
      // Set calculatedNewPrice high enough to trigger update
      const repriceModel = new RepriceModel("123", mockProduct, "Product", "60.00", false, false, [], "");
      repriceModel.repriceDetails = new RepriceData(10, "60.00", true, "Original", 1);

      const productItem: FrontierProduct = {
        mpid: "123",
        floorPrice: 5,
        badgePercentage: "10",
      } as any;

      const ownVendorProduct: Net32Product = {
        vendorId: "123",
        priceBreaks: [{ minQty: 1, unitPrice: 60, active: true }] as any, // Above threshold
        standardShipping: "5.00",
        freeShippingThreshold: 50,
      } as any;

      const competitorPriceBreak: Net32PriceBreak = {
        minQty: 1,
        unitPrice: 60,
        active: true,
      } as any;

      const eligibleList: Net32Product[] = [
        ownVendorProduct,
        {
          vendorId: "456",
          badgeId: 1,
          badgeName: "Best Seller",
          priceBreaks: [competitorPriceBreak],
          standardShipping: "5.00",
          freeShippingThreshold: 50, // Above threshold, so shipping is 0
        } as any,
      ];

      const result = await ReCalculatePriceForNc(repriceModel, productItem, eligibleList, 1);
      // calculatedNewPrice (60) >= allowedPrice (54 - 5 = 49), so update should happen
      expect(result.repriceDetails?.goToPrice).toBe("60.00");
      expect(result.repriceDetails?.explained).toContain(RepriceRenewedMessageEnum.PRICE_CHANGE_BADGE_PERCENTAGE);
    });
  });
});
