// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { ApplyBuyBoxRule } from "../../../v1/repricer-rule-helper";
import { RepriceRenewedMessageEnum } from "../../../../../model/reprice-renewed-message";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import { aNet32Product } from "../../infrastructure/builders/net32-product.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("ApplyBuyBoxRule", () => {
  const ownVendorIds = ["17357", "20722", "20755", "20533", "20727", "5"];

  describe("single-break model", () => {
    it("should block price decrease when first vendor is own vendor (17357)", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const net32 = [aNet32Product().vendorId(17357).unitPrice(10).build(), aNet32Product().vendorId(99999).unitPrice(7).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(8);
      expect(result.repriceDetails!.explained).toBe(RepriceRenewedMessageEnum.IGNORE_BUY_BOX);
    });

    it("should block price decrease when first vendor is sister vendor (20722)", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const net32 = [aNet32Product().vendorId(20722).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });

    it("should allow price decrease when first vendor is external", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const net32 = [aNet32Product().vendorId(99999).unitPrice(7).build(), aNet32Product().vendorId(17357).unitPrice(10).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe(8);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it("should allow price increase even when first vendor is own vendor", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      const net32 = [aNet32Product().vendorId(17357).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe(12);
    });

    it("should skip when newPrice is N/A", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice("N/A").build();
      model.repriceDetails!.isRepriced = false;
      const net32 = [aNet32Product().vendorId(17357).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });

    it("should skip when oldPrice is 0", () => {
      const model = aRepriceModel().withOldPrice(0).withNewPrice(5).build();
      model.repriceDetails!.oldPrice = 0;
      const net32 = [aNet32Product().vendorId(17357).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe(5);
    });

    it("should handle empty net32 result list", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyBuyBoxRule(model, []);
      expect(result.repriceDetails!.newPrice).toBe(8);
    });
  });

  describe("multi-break model", () => {
    it("should block only decreasing breaks when first vendor is own vendor", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 9, isRepriced: true }).build();
      const net32 = [aNet32Product().vendorId(17357).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.listOfRepriceDetails[0].newPrice).toBe("N/A");
      expect(result.listOfRepriceDetails[1].newPrice).toBe(9);
    });
  });

  describe("vendor ID matching", () => {
    it.each(ownVendorIds.map((id) => [id]))("should block when first vendor ID is %s", (vendorId) => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const net32 = [aNet32Product().vendorId(parseInt(vendorId)).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });
  });

  describe("cloning behavior", () => {
    it("should not mutate the original model", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const net32 = [aNet32Product().vendorId(17357).build()];
      ApplyBuyBoxRule(model, net32);
      expect(model.repriceDetails!.newPrice).toBe(8);
    });
  });
});
