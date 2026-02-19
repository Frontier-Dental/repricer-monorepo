// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { ApplyRule } from "../../../v1/repricer-rule-helper";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import { RepriceMessageEnum } from "../../../../../model/reprice-message";
import { RepriceRenewedMessageEnum } from "../../../../../model/reprice-renewed-message";

describe("ApplyRule (direction rule)", () => {
  describe("rule -1 (Please Select) and rule 2 (Both)", () => {
    it("should not modify repriceDetails for rule -1", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyRule(model, -1, false);
      expect(result.repriceDetails!.newPrice).toBe(8);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it("should not modify repriceDetails for rule 2", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      const result = ApplyRule(model, 2, false);
      expect(result.repriceDetails!.newPrice).toBe(12);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it("should not modify listOfRepriceDetails for rule 2", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8 }).withPriceBreak({ minQty: 5, oldPrice: 8, newPrice: 6 }).build();
      const result = ApplyRule(model, 2, false);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(8);
      expect(result.listOfRepriceDetails[1].newPrice).toBe(6);
    });
  });

  describe("rule 0 (Only Up)", () => {
    it("should ignore price DOWN for single break", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyRule(model, 0, false);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(8);
      expect(result.repriceDetails!.explained).toBe(RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_UP);
    });

    it("should allow price UP for single break", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      const result = ApplyRule(model, 0, false);
      expect(result.repriceDetails!.newPrice).toBe(12);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it("should not modify already N/A prices", () => {
      const model = aRepriceModel().withNewPrice("N/A").build();
      model.repriceDetails!.isRepriced = false;
      const result = ApplyRule(model, 0, false);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });

    it("should ignore price DOWN for multi-break entries", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8 }).withPriceBreak({ minQty: 5, oldPrice: 8, newPrice: 10 }).build();
      const result = ApplyRule(model, 0, false);
      expect(result.listOfRepriceDetails[0].newPrice).toBe("N/A");
      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[1].newPrice).toBe(10);
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(true);
    });

    it("should append to existing floor explanation", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).withExplained(RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED).build();
      const result = ApplyRule(model, 0, false);
      expect(result.repriceDetails!.explained).toContain(RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED);
      expect(result.repriceDetails!.explained).toContain(RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_UP);
    });
  });

  describe("rule 1 (Only Down)", () => {
    it("should ignore price UP for single break", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      const result = ApplyRule(model, 1, false);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(12);
    });

    it("should allow price DOWN for single break", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyRule(model, 1, false);
      expect(result.repriceDetails!.newPrice).toBe(8);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it("should ignore SHUT_DOWN_NO_COMPETITOR messages in multi-break", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, explained: RepriceRenewedMessageEnum.SHUT_DOWN_NO_COMPETITOR }).build();
      const result = ApplyRule(model, 1, false);
      expect(result.listOfRepriceDetails[0].newPrice).toBe("N/A");
      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
    });

    it("should handle multi-break: ignore UP, keep DOWN", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 12 }).withPriceBreak({ minQty: 5, oldPrice: 8, newPrice: 6 }).build();
      const result = ApplyRule(model, 1, false);
      expect(result.listOfRepriceDetails[0].newPrice).toBe("N/A");
      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[1].newPrice).toBe(6);
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(true);
    });

    it("should skip entries with oldPrice 0", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 0, newPrice: 5 }).build();
      const result = ApplyRule(model, 1, false);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(5);
    });

    it("should allow same price for single break", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10).build();
      const result = ApplyRule(model, 1, false);
      expect(result.repriceDetails!.newPrice).toBe(10);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });
  });
});
