// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { ApplyBeatQPriceRule } from "../../../v1/repricer-rule-helper";
import { RepriceMessageEnum } from "../../../../../model/reprice-message";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("ApplyBeatQPriceRule", () => {
  describe("multi-break model", () => {
    it("should suppress Q1 and leave other breaks untouched", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 9, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true }).withPriceBreak({ minQty: 6, oldPrice: 6, newPrice: 5, isRepriced: true }).build();

      const result = ApplyBeatQPriceRule(model);

      expect(result.listOfRepriceDetails[0].newPrice).toBe("N/A");
      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[0].goToPrice).toBe(9);
      expect(result.listOfRepriceDetails[0].explained).toBe(RepriceMessageEnum.BEAT_Q_PRICE);
      expect(result.listOfRepriceDetails[1].newPrice).toBe(7);
      expect(result.listOfRepriceDetails[2].newPrice).toBe(5);
    });

    it("should suppress Q1 even when Q1 newPrice is N/A", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: "N/A", isRepriced: false }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true }).build();

      const result = ApplyBeatQPriceRule(model);

      expect(result.listOfRepriceDetails[0].explained).toBe(RepriceMessageEnum.BEAT_Q_PRICE);
    });
  });

  describe("single-break model", () => {
    it("should suppress the single break with BEAT_Q_PRICE_1", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();

      const result = ApplyBeatQPriceRule(model);

      expect(result.repriceDetails!.newPrice).toBe("N/A");
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(9);
      expect(result.repriceDetails!.explained).toBe(RepriceMessageEnum.BEAT_Q_PRICE_1);
    });
  });

  describe("mutation behavior", () => {
    it("should mutate the input model directly (no clone)", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      ApplyBeatQPriceRule(model);
      expect(model.repriceDetails!.newPrice).toBe("N/A");
    });
  });
});
