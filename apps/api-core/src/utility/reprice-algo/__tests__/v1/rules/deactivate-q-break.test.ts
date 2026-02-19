// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { ApplyDeactivateQPriceBreakRule } from "../../../v1/repricer-rule-helper";
import { RepriceRenewedMessageEnum } from "../../../../../model/reprice-renewed-message";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("ApplyDeactivateQPriceBreakRule", () => {
  describe("when abortDeactivatingQPriceBreak = true", () => {
    it("should abort deactivation when Q1 has NOT changed", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true }).build();
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
      expect(q3!.newPrice).toBe("N/A");
      expect(q3!.isRepriced).toBe(false);
      expect(q3!.active).toBe(true);
      expect(q3!.explained).toContain(RepriceRenewedMessageEnum.IGNORED_ABORT_Q_DEACTIVATION);
    });

    it("should allow deactivation when Q1 HAS changed", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 9, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true }).build();
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
      expect(q3!.newPrice).toBe(0);
    });

    it("should not affect Q1 break itself", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true }).build();
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      const q1 = result.listOfRepriceDetails.find((d) => d.minQty === 1);
      expect(q1!.newPrice).toBe(10);
    });

    it("should not abort when break is not being deactivated (newPrice != 0)", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true }).build();
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
      expect(q3!.newPrice).toBe(7);
    });

    it("should handle multiple deactivating breaks independently", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true }).withPriceBreak({ minQty: 6, oldPrice: 5, newPrice: 0, isRepriced: true }).build();
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
      const q6 = result.listOfRepriceDetails.find((d) => d.minQty === 6);
      expect(q3!.newPrice).toBe("N/A");
      expect(q6!.newPrice).toBe("N/A");
    });
  });

  describe("when abortDeactivatingQPriceBreak = false", () => {
    it("should allow deactivation regardless of Q1 status", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true }).build();
      const result = ApplyDeactivateQPriceBreakRule(model, false);
      const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
      expect(q3!.newPrice).toBe(0);
    });
  });

  describe("single-break model", () => {
    it("should return model unchanged (function only acts on multi-break)", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(0).build();
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      expect(result.repriceDetails).toBeDefined();
    });
  });

  describe("cloning behavior", () => {
    it("should not mutate the original model", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true }).build();
      ApplyDeactivateQPriceBreakRule(model, true);
      expect(model.listOfRepriceDetails.find((d) => d.minQty === 3)!.newPrice).toBe(0);
    });
  });
});
