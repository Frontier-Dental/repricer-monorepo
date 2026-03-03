// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { ApplyFloorCheckRule } from "../../../v1/repricer-rule-helper";
import { RepriceMessageEnum } from "../../../../../model/reprice-message";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("ApplyFloorCheckRule", () => {
  describe("single-break model", () => {
    it("should block when newPrice equals floorPrice", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(5).build();
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(5);
      expect(result.repriceDetails!.explained).toBe(RepriceMessageEnum.IGNORE_LOGIC_FAULT);
    });

    it("should block when newPrice is below floorPrice", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(3).build();
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
      expect(result.repriceDetails!.isRepriced).toBe(false);
    });

    it("should allow when newPrice is above floorPrice", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(6).build();
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.repriceDetails!.newPrice).toBe(6);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it("should allow when floorPrice is 0 and newPrice is positive", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(0.5).build();
      const result = ApplyFloorCheckRule(model, 0);
      expect(result.repriceDetails!.newPrice).toBe(0.5);
    });

    it("should block when floorPrice is 0 and newPrice is 0", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(0).build();
      const result = ApplyFloorCheckRule(model, 0);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });
  });

  describe("multi-break model", () => {
    it("should block only the break below floor", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 6, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 4, isRepriced: true }).build();
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(6);
      expect(result.listOfRepriceDetails[1].newPrice).toBe("N/A");
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(false);
    });

    it("should skip deactivated break (active=0)", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 3, isRepriced: true, active: false }).build();
      model.listOfRepriceDetails[0].active = 0 as unknown as boolean;
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(3);
    });

    it("should NOT skip break with active=false (boolean), only active=0 (numeric)", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 3, isRepriced: true, active: false }).build();
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.listOfRepriceDetails[0].newPrice).toBe("N/A");
    });
  });

  describe("edge cases", () => {
    it("should handle negative floor price", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(0.01).build();
      const result = ApplyFloorCheckRule(model, -1);
      expect(result.repriceDetails!.newPrice).toBe(0.01);
    });

    it("should handle when repriceDetails newPrice is already N/A (single break)", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice("N/A").build();
      model.repriceDetails!.isRepriced = false;
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });
  });
});
