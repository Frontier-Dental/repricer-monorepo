// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { ApplySuppressPriceBreakRule } from "../../../v1/repricer-rule-helper";
import { RepriceMessageEnum } from "../../../../../model/reprice-message";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("ApplySuppressPriceBreakRule", () => {
  describe("when Q1 has changed", () => {
    it("should allow all breaks when Q1 changed", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 9, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true }).build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(9);
      expect(result.listOfRepriceDetails[1].newPrice).toBe(7);
    });
  });

  describe("when Q1 has NOT changed", () => {
    it("should suppress other breaks that changed", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true }).build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(10);
      expect(result.listOfRepriceDetails[1].newPrice).toBe("N/A");
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[1].explained).toBe(RepriceMessageEnum.IGNORED_ONE_QTY_SETTING);
    });

    it("should allow other breaks that did NOT change", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8, isRepriced: true }).build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      expect(result.listOfRepriceDetails[1].newPrice).toBe(8);
    });

    it("should not suppress already-ignored breaks (newPrice = N/A)", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: "N/A", isRepriced: false }).build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      expect(result.listOfRepriceDetails[1].newPrice).toBe("N/A");
    });

    it("should set goToPrice when suppressing", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 6, isRepriced: true }).build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      expect(result.listOfRepriceDetails[1].goToPrice).toBe(6);
    });
  });

  describe("isOverrideEnabled = true", () => {
    it("should remove breaks with oldPrice=0 and allow all others", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 5, isRepriced: true }).withPriceBreak({ minQty: 6, oldPrice: 7, newPrice: 6, isRepriced: true }).build();
      const result = ApplySuppressPriceBreakRule(model, 1, true);
      const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
      expect(q3).toBeUndefined();
      const q6 = result.listOfRepriceDetails.find((d) => d.minQty === 6);
      expect(q6!.newPrice).toBe(6);
    });
  });

  describe("cleanup of orphaned breaks", () => {
    it("should remove breaks with newPrice=N/A and oldPrice=0 after suppression", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: "N/A", isRepriced: false }).build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
      expect(q3).toBeUndefined();
    });
  });

  describe("cloning behavior", () => {
    it("should not mutate the original model", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true }).build();
      ApplySuppressPriceBreakRule(model, 1, false);
      expect(model.listOfRepriceDetails[1].newPrice).toBe(7);
    });
  });
});
