// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { ApplyPercentagePriceRule } from "../../../v1/repricer-rule-helper";
import { RepriceMessageEnum } from "../../../../../model/reprice-message";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("ApplyPercentagePriceRule", () => {
  describe("single-break model", () => {
    it("should allow when percentage increase meets threshold", () => {
      // oldPrice=10, newPrice=12 => 20% increase >= 10% threshold
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe(12);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it("should block when percentage increase is below threshold", () => {
      // oldPrice=10, newPrice=10.50 => 5% increase < 10% threshold
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10.5).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(10.5);
      expect(result.repriceDetails!.explained).toBe(RepriceMessageEnum.IGNORED_PERCENTAGE_CHECK);
    });

    it("should allow when percentage increase exactly equals threshold", () => {
      // oldPrice=10, newPrice=11 => 10% increase == 10% threshold
      const model = aRepriceModel().withOldPrice(10).withNewPrice(11).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe(11);
    });

    it("should skip price decreases (only checks increases)", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe(8);
    });

    it("should skip when newPrice equals oldPrice (no increase)", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe(10);
    });

    it("should skip when newPrice is N/A", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice("N/A").build();
      model.repriceDetails!.isRepriced = false;
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });

    it("should allow with percentage=0 (any increase is fine)", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10.01).build();
      const result = ApplyPercentagePriceRule(model, 0);
      expect(result.repriceDetails!.newPrice).toBe(10.01);
    });
  });

  describe("multi-break model", () => {
    it("should check each break independently", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 12, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8.5, isRepriced: true }).build();
      // Q1: 20% >= 10%, allowed
      // Q3: 6.25% < 10%, blocked
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(12);
      expect(result.listOfRepriceDetails[1].newPrice).toBe("N/A");
    });

    it("should skip breaks with oldPrice=0", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 0, newPrice: 5, isRepriced: true }).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(5);
    });
  });
});
