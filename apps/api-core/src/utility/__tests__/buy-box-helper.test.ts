// Mock dependencies before imports
jest.mock("../../model/reprice-model", () => ({
  RepriceModel: jest.fn(),
}));

import { parseShippingBuyBox, parseBadgeBuyBox } from "../buy-box-helper";
import { RepriceModel } from "../../model/reprice-model";
import { RepriceRenewedMessageEnum } from "../../model/reprice-renewed-message";

describe("buy-box-helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("parseShippingBuyBox", () => {
    it("should return repriceResult when buyBoxVendor is not found", async () => {
      const repriceResult = {
        repriceDetails: { isRepriced: false },
      } as any;
      const net32Result: any[] = [{ vendorId: "123", inStock: false }];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBShippingValue: "5",
      } as any;

      const result = await parseShippingBuyBox(repriceResult, net32Result, productItem);
      expect(result).toBe(repriceResult);
    });

    it("should return repriceResult when ownVendorItem is not found", async () => {
      const repriceResult = {
        repriceDetails: { isRepriced: false },
      } as any;
      const net32Result: any[] = [{ vendorId: "456", inStock: true }];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBShippingValue: "5",
      } as any;

      const result = await parseShippingBuyBox(repriceResult, net32Result, productItem);
      expect(result).toBe(repriceResult);
    });

    it("should return new RepriceModel when buyBoxVendor is own vendor", async () => {
      const repriceResult = {
        repriceDetails: { isRepriced: false },
      } as any;
      const ownVendorItem = {
        vendorId: "123",
        inStock: true,
      };
      const net32Result: any[] = [ownVendorItem];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        productName: "Test Product",
        getBBShippingValue: "5",
      } as any;

      const mockRepriceModel = {
        repriceDetails: { isRepriced: false },
      };
      (RepriceModel as jest.Mock).mockReturnValue(mockRepriceModel);

      const result = await parseShippingBuyBox(repriceResult, net32Result, productItem);
      expect(RepriceModel).toHaveBeenCalledWith("123", ownVendorItem, "Test Product", "N/A", false, false, [], RepriceRenewedMessageEnum.DEFAULT);
    });

    it("should return repriceResult when getBBShippingValue is 0", async () => {
      const repriceResult = {
        repriceDetails: { isRepriced: false },
      } as any;
      const net32Result: any[] = [
        { vendorId: "456", inStock: true },
        { vendorId: "123", inStock: true },
      ];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBShippingValue: "0",
      } as any;

      const result = await parseShippingBuyBox(repriceResult, net32Result, productItem);
      expect(result).toBe(repriceResult);
    });

    it("should return repriceResult when shipping times are equal (both 1)", async () => {
      const repriceResult = {
        repriceDetails: { isRepriced: false },
      } as any;
      const net32Result: any[] = [
        { vendorId: "456", inStock: true, shippingTime: "1" },
        { vendorId: "123", inStock: true, shippingTime: "1" },
      ];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBShippingValue: "5",
      } as any;

      const result = await parseShippingBuyBox(repriceResult, net32Result, productItem);
      expect(result).toBe(repriceResult);
    });

    it("should return repriceResult when buyBox shipping is 1 and own is 2", async () => {
      const repriceResult = {
        repriceDetails: { isRepriced: false },
      } as any;
      const net32Result: any[] = [
        { vendorId: "456", inStock: true, shippingTime: "1" },
        { vendorId: "123", inStock: true, shippingTime: "2" },
      ];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBShippingValue: "5",
      } as any;

      const result = await parseShippingBuyBox(repriceResult, net32Result, productItem);
      expect(result).toBe(repriceResult);
    });

    it("should update price when buyBox shipping is faster", async () => {
      const repriceResult = {
        repriceDetails: {
          isRepriced: false,
          explained: "",
        },
        updateTriggeredBy: jest.fn(),
      } as any;
      const net32Result: any[] = [
        {
          vendorId: "456",
          inStock: true,
          shippingTime: "1",
          priceBreaks: [{ minQty: 1, unitPrice: 10 }],
          vendorName: "Competitor",
        },
        { vendorId: "123", inStock: true, shippingTime: "3" },
      ];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBShippingValue: "5", // 5% discount
      } as any;

      const result = await parseShippingBuyBox(repriceResult, net32Result, productItem);
      expect(result.repriceDetails.isRepriced).toBe(true);
      expect(result.repriceDetails.explained).toBe(RepriceRenewedMessageEnum.BB_SHIPPING);
      expect(result.repriceDetails.newPrice).toBeDefined();
      expect(result.updateTriggeredBy).toHaveBeenCalledWith("Competitor", "456", 1);
    });

    it("should handle error gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const repriceResult = {
        repriceDetails: {
          isRepriced: false,
          explained: "",
        },
        updateTriggeredBy: jest.fn().mockImplementation(() => {
          throw new Error("Test error");
        }),
      } as any;
      const net32Result: any[] = [
        {
          vendorId: "456",
          inStock: true,
          shippingTime: "1",
          priceBreaks: [{ minQty: 1, unitPrice: 10 }],
          vendorName: "Competitor",
        },
        { vendorId: "123", inStock: true, shippingTime: "3" },
      ];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBShippingValue: "5",
      } as any;

      const result = await parseShippingBuyBox(repriceResult, net32Result, productItem);
      expect(result).toBe(repriceResult);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("parseBadgeBuyBox", () => {
    it("should return repriceResult when buyBoxVendor is not found", async () => {
      const repriceResult = {
        repriceDetails: { isRepriced: false },
      } as any;
      const net32Result: any[] = [{ vendorId: "123", inStock: false }];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBBadgeValue: "5",
      } as any;

      const result = await parseBadgeBuyBox(repriceResult, net32Result, productItem);
      expect(result).toBe(repriceResult);
    });

    it("should return new RepriceModel when buyBoxVendor is own vendor", async () => {
      const repriceResult = {
        repriceDetails: { isRepriced: false },
      } as any;
      const ownVendorItem = {
        vendorId: "123",
        inStock: true,
      };
      const net32Result: any[] = [ownVendorItem];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        productName: "Test Product",
        getBBBadgeValue: "5",
      } as any;

      const mockRepriceModel = {
        repriceDetails: { isRepriced: false },
      };
      (RepriceModel as jest.Mock).mockReturnValue(mockRepriceModel);

      const result = await parseBadgeBuyBox(repriceResult, net32Result, productItem);
      expect(RepriceModel).toHaveBeenCalledWith("123", ownVendorItem, "Test Product", "N/A", false, false, [], RepriceRenewedMessageEnum.DEFAULT);
    });

    it("should return repriceResult when getBBBadgeValue is 0", async () => {
      const repriceResult = {
        repriceDetails: { isRepriced: false },
      } as any;
      const net32Result: any[] = [
        { vendorId: "456", inStock: true, badgeId: 1 },
        { vendorId: "123", inStock: true },
      ];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBBadgeValue: "0",
      } as any;

      const result = await parseBadgeBuyBox(repriceResult, net32Result, productItem);
      expect(result).toBe(repriceResult);
    });

    it("should return repriceResult when buyBoxVendor has no badge", async () => {
      const repriceResult = {
        repriceDetails: { isRepriced: false },
      } as any;
      const net32Result: any[] = [
        { vendorId: "456", inStock: true, badgeId: 0 },
        { vendorId: "123", inStock: true },
      ];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBBadgeValue: "5",
      } as any;

      const result = await parseBadgeBuyBox(repriceResult, net32Result, productItem);
      expect(result).toBe(repriceResult);
    });

    it("should update price when buyBoxVendor has badge", async () => {
      const repriceResult = {
        repriceDetails: {
          isRepriced: false,
          explained: "",
        },
        updateTriggeredBy: jest.fn(),
      } as any;
      const net32Result: any[] = [
        {
          vendorId: "456",
          inStock: true,
          badgeId: 1,
          priceBreaks: [{ minQty: 1, unitPrice: 10 }],
          vendorName: "Competitor",
        },
        { vendorId: "123", inStock: true },
      ];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBBadgeValue: "5", // 5% discount
      } as any;

      const result = await parseBadgeBuyBox(repriceResult, net32Result, productItem);
      expect(result.repriceDetails.isRepriced).toBe(true);
      expect(result.repriceDetails.explained).toBe(RepriceRenewedMessageEnum.BB_BADGE);
      expect(result.repriceDetails.newPrice).toBeDefined();
      expect(result.updateTriggeredBy).toHaveBeenCalledWith("Competitor", "456", 1);
    });

    it("should handle missing priceBreak gracefully", async () => {
      const repriceResult = {
        repriceDetails: {
          isRepriced: false,
          explained: "",
        },
        updateTriggeredBy: jest.fn(),
      } as any;
      const net32Result: any[] = [
        {
          vendorId: "456",
          inStock: true,
          badgeId: 1,
          priceBreaks: [], // No price breaks
          vendorName: "Competitor",
        },
        { vendorId: "123", inStock: true },
      ];
      const productItem = {
        mpid: "123",
        ownVendorId: "123",
        getBBBadgeValue: "5",
      } as any;

      const result = await parseBadgeBuyBox(repriceResult, net32Result, productItem);
      expect(result.repriceDetails.isRepriced).toBe(true);
      expect(result.repriceDetails.newPrice).toBe(0); // Default when priceBreak not found
    });
  });
});
