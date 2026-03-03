// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { ApplyKeepPositionLogic } from "../../../v1/repricer-rule-helper";
import { RepriceRenewedMessageEnum } from "../../../../../model/reprice-renewed-message";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import { aNet32Product } from "../../infrastructure/builders/net32-product.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("ApplyKeepPositionLogic", () => {
  describe("single-break model", () => {
    it("should block when lowest vendor is ranked below own vendor", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      model.repriceDetails!.lowestVendor = "CheapVendor";

      // Use string vendorIds — _.findIndex does strict equality matching
      const net32 = [aNet32Product().vendorId("17357").vendorName("Tradent").unitPrice(10).build(), aNet32Product().vendorId("99999").vendorName("CheapVendor").unitPrice(7).build()];
      const result = ApplyKeepPositionLogic(model, net32, "17357");

      expect(result.repriceDetails!.newPrice).toBe("N/A");
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(8);
      expect(result.repriceDetails!.explained).toBe(RepriceRenewedMessageEnum.IGNORE_KEEP_POSITION);
    });

    it("should allow when lowest vendor is ranked above own vendor", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      model.repriceDetails!.lowestVendor = "TopVendor";

      const net32 = [aNet32Product().vendorId("88888").vendorName("TopVendor").unitPrice(7).build(), aNet32Product().vendorId("17357").vendorName("Tradent").unitPrice(10).build()];
      // ownVendorIndex=1, evalVendorIndex=0 => 0 > 1 is false => allow
      const result = ApplyKeepPositionLogic(model, net32, "17357");

      expect(result.repriceDetails!.newPrice).toBe(8);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it("should allow price increase regardless of position", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      model.repriceDetails!.lowestVendor = "CheapVendor";

      const net32 = [aNet32Product().vendorId("17357").vendorName("Tradent").build(), aNet32Product().vendorId("99999").vendorName("CheapVendor").build()];
      const result = ApplyKeepPositionLogic(model, net32, "17357");

      expect(result.repriceDetails!.newPrice).toBe(12);
    });

    it("should skip when newPrice is N/A", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice("N/A").build();
      model.repriceDetails!.isRepriced = false;

      const net32 = [aNet32Product().vendorId("17357").build()];
      const result = ApplyKeepPositionLogic(model, net32, "17357");

      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });

    it("should skip when oldPrice is 0", () => {
      const model = aRepriceModel().withOldPrice(0).withNewPrice(5).build();
      model.repriceDetails!.oldPrice = 0;

      const net32 = [aNet32Product().vendorId("17357").build()];
      const result = ApplyKeepPositionLogic(model, net32, "17357");

      expect(result.repriceDetails!.newPrice).toBe(5);
    });

    it("should handle own vendor not found in net32 list (ownVendorIndex = -1)", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      model.repriceDetails!.lowestVendor = "SomeVendor";

      const net32 = [aNet32Product().vendorId(99999).vendorName("SomeVendor").build()];
      const result = ApplyKeepPositionLogic(model, net32, "17357");

      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });
  });

  describe("multi-break model", () => {
    it("should block only decreasing breaks where vendor is ranked below", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 9, isRepriced: true }).build();
      model.listOfRepriceDetails[0].lowestVendor = "LowerVendor";
      model.listOfRepriceDetails[1].lowestVendor = "LowerVendor";

      const net32 = [aNet32Product().vendorId("17357").vendorName("Tradent").build(), aNet32Product().vendorId("99999").vendorName("LowerVendor").build()];

      const result = ApplyKeepPositionLogic(model, net32, "17357");
      expect(result.listOfRepriceDetails[0].newPrice).toBe("N/A");
      expect(result.listOfRepriceDetails[1].newPrice).toBe(9);
    });
  });

  describe("cloning behavior", () => {
    it("should not mutate the original model", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      model.repriceDetails!.lowestVendor = "CheapVendor";
      const net32 = [aNet32Product().vendorId("17357").vendorName("Tradent").build(), aNet32Product().vendorId("99999").vendorName("CheapVendor").build()];
      ApplyKeepPositionLogic(model, net32, "17357");
      expect(model.repriceDetails!.newPrice).toBe(8);
    });
  });
});
