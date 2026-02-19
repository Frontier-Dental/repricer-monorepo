// Must mock before any source imports
jest.mock("../../../../../model/global-param", () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: "17357",
    EXCLUDED_VENDOR_ID: "20722;20755",
  }),
}));
jest.mock("../../../../filter-mapper", () => ({
  FilterBasedOnParams: jest.fn(),
}));
jest.mock("../../../../config", () => ({
  applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true },
}));

import { ApplyRepriceDownBadgeCheckRule } from "../../../v1/repricer-rule-helper";
import * as filterMapper from "../../../../filter-mapper";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import { aNet32Product } from "../../infrastructure/builders/net32-product.builder";
import { aProduct } from "../../infrastructure/builders/frontier-product.builder";
import "../../infrastructure/matchers/pricing.matchers";

const mockedFilterBasedOnParams = filterMapper.FilterBasedOnParams as jest.MockedFunction<typeof filterMapper.FilterBasedOnParams>;

describe("ApplyRepriceDownBadgeCheckRule", () => {
  const ownVendor = aNet32Product().vendorId(17357).vendorName("Tradent").unitPrice(10).build();

  describe("early return when badgePercentageDown = 0", () => {
    it("should return model unchanged", async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      const product = aProduct().badgePercentageDown(0).build();
      const result = await ApplyRepriceDownBadgeCheckRule(model, [ownVendor], product, 0);
      expect(result.repriceDetails!.newPrice).toBe(9);
    });
  });

  describe("when badged vendor has lower effective price", () => {
    it("should not override when suggested price is already below effective price", async () => {
      const badgedVendor = aNet32Product().vendorId(55555).vendorName("BadgedVendor").unitPrice(9.0).badge(1, "Gold").build();

      mockedFilterBasedOnParams.mockResolvedValue([badgedVendor]);

      // suggestedPrice for Q1 = 8.00
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const product = aProduct().ownVendorId("17357").sisterVendorId("20722;20755").badgePercentageDown(0.05).floor(5).build();

      // effectivePrice = subtractPercentage(9.00, 0.05) = 8.55
      // suggestedPrice=8 <= effectivePrice=8.55 => do nothing
      const result = await ApplyRepriceDownBadgeCheckRule(model, [ownVendor, badgedVendor], product, 0.05);
      expect(result.repriceDetails!.newPrice).toBe(8);
    });

    it("should override when suggested price exceeds effective price and effective > floor", async () => {
      const badgedVendor = aNet32Product().vendorId(55555).vendorName("BadgedVendor").unitPrice(9.0).badge(1, "Gold").build();

      mockedFilterBasedOnParams.mockResolvedValue([badgedVendor]);

      // suggestedPrice for Q1 = 9.50 (higher than effective)
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9.5).build();
      const product = aProduct().ownVendorId("17357").sisterVendorId("20722;20755").badgePercentageDown(0.05).floor(5).build();

      // effectivePrice = subtractPercentage(9.00, 0.05) = 8.55
      // 9.50 > 8.55, and 8.55 > 5 (floor), and 8.55 != 10 (existingPrice)
      const result = await ApplyRepriceDownBadgeCheckRule(model, [ownVendor, badgedVendor], product, 0.05);

      expect(result.repriceDetails!.newPrice).toBe(8.55);
      expect(result.repriceDetails!.explained).toContain("#RepriceDownBadge%");
    });
  });

  describe("when no badged vendors found", () => {
    it("should return model unchanged", async () => {
      mockedFilterBasedOnParams.mockResolvedValue([]);

      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      const product = aProduct().ownVendorId("17357").sisterVendorId("20722;20755").badgePercentageDown(0.05).build();

      const result = await ApplyRepriceDownBadgeCheckRule(model, [ownVendor], product, 0.05);
      expect(result.repriceDetails!.newPrice).toBe(9);
    });
  });

  describe("when first badged vendor is a sister vendor", () => {
    it("should return model unchanged (sister excluded)", async () => {
      const sisterVendor = aNet32Product().vendorId(20722).vendorName("Frontier").unitPrice(8.0).badge(1, "Gold").build();

      mockedFilterBasedOnParams.mockResolvedValue([sisterVendor]);

      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      const product = aProduct().ownVendorId("17357").sisterVendorId("20722;20755").badgePercentageDown(0.05).competeAll(false).build();

      const result = await ApplyRepriceDownBadgeCheckRule(model, [ownVendor, sisterVendor], product, 0.05);

      expect(result.repriceDetails!.newPrice).toBe(9);
    });
  });

  describe("effective price at or below floor", () => {
    it("should not override to a price below floor", async () => {
      const badgedVendor = aNet32Product().vendorId(55555).vendorName("BadgedVendor").unitPrice(5.0).badge(1, "Gold").build();

      mockedFilterBasedOnParams.mockResolvedValue([badgedVendor]);

      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      const product = aProduct().ownVendorId("17357").sisterVendorId("20722;20755").badgePercentageDown(0.05).floor(8).build();

      // effectivePrice = subtractPercentage(5.00, 0.05) = 4.75; 4.75 <= 8 (floor)
      // Then effectivePrice = suggestedPrice = 9, and 9 > 8 (floor)
      // So newPrice = 9 with badge tag appended
      const result = await ApplyRepriceDownBadgeCheckRule(model, [ownVendor, badgedVendor], product, 0.05);

      expect(result.repriceDetails!.newPrice).toBe(9);
      expect(result.repriceDetails!.explained).toContain("#RepriceDownBadge%");
    });
  });
});
