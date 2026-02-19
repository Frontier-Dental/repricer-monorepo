// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { OverrideRepriceResultForExpressCron } from "../../../v1/repricer-rule-helper";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("OverrideRepriceResultForExpressCron", () => {
  describe("multi-break model", () => {
    it("should override all breaks to N/A and append #INEXPRESSCRON", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 9, isRepriced: true, explained: "CHANGE: test" }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true, explained: "CHANGE: test2" }).build();

      const result = OverrideRepriceResultForExpressCron(model);

      result.listOfRepriceDetails.forEach((detail: any) => {
        expect(detail.newPrice).toBe("N/A");
        expect(detail.isRepriced).toBe(false);
        expect(detail.explained).toContain("_#INEXPRESSCRON");
      });
      expect(result.listOfRepriceDetails[0].goToPrice).toBe(9);
      expect(result.listOfRepriceDetails[1].goToPrice).toBe(7);
    });

    it("should override even already-ignored breaks", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: "N/A", isRepriced: false, explained: "IGNORE: test" }).build();

      const result = OverrideRepriceResultForExpressCron(model);

      expect(result.listOfRepriceDetails[0].goToPrice).toBe("N/A");
      expect(result.listOfRepriceDetails[0].newPrice).toBe("N/A");
      expect(result.listOfRepriceDetails[0].explained).toBe("IGNORE: test_#INEXPRESSCRON");
    });
  });

  describe("single-break model", () => {
    it("should override repriceDetails", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).withExplained("CHANGE: validated").build();

      const result = OverrideRepriceResultForExpressCron(model);

      expect(result.repriceDetails!.goToPrice).toBe(9);
      expect(result.repriceDetails!.newPrice).toBe("N/A");
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.explained).toBe("CHANGE: validated_#INEXPRESSCRON");
    });
  });

  describe("mutation behavior", () => {
    it("should mutate the input model directly (no clone)", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).withExplained("CHANGE").build();

      OverrideRepriceResultForExpressCron(model);

      expect(model.repriceDetails!.newPrice).toBe("N/A");
    });
  });
});
