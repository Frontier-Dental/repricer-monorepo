// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { AppendNewPriceBreakActivation } from "../../../v1/repricer-rule-helper";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("AppendNewPriceBreakActivation", () => {
  describe("multi-break model", () => {
    it("should append #NEW when oldPrice=0 and newPrice > 0", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 9, isRepriced: true, explained: "CHANGE: test" }).withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 5, isRepriced: true, explained: "CHANGE: new break" }).build();

      const result = AppendNewPriceBreakActivation(model);

      expect(result.listOfRepriceDetails[0].explained).toBe("CHANGE: test");
      expect(result.listOfRepriceDetails[1].explained).toContain("#NEW");
    });

    it("should replace #UP with #NEW when explained contains #UP", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 5, isRepriced: true, explained: "CHANGE: validated #UP" }).build();

      const result = AppendNewPriceBreakActivation(model);

      expect(result.listOfRepriceDetails[0].explained).toContain("#NEW");
      expect(result.listOfRepriceDetails[0].explained).not.toContain("#UP");
    });

    it("should not modify breaks where oldPrice is not 0", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 12, isRepriced: true, explained: "CHANGE: #UP" }).build();

      const result = AppendNewPriceBreakActivation(model);

      expect(result.listOfRepriceDetails[0].explained).toBe("CHANGE: #UP");
    });

    it("should not modify breaks where newPrice is N/A", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: "N/A", isRepriced: false, explained: "IGNORE: reason" }).build();

      const result = AppendNewPriceBreakActivation(model);

      expect(result.listOfRepriceDetails[0].explained).toBe("IGNORE: reason");
    });

    it("should not modify breaks where newPrice is 0 (deactivation)", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 0, isRepriced: true, explained: "CHANGE: test" }).build();

      const result = AppendNewPriceBreakActivation(model);

      expect(result.listOfRepriceDetails[0].explained).toBe("CHANGE: test");
    });
  });

  describe("single-break model", () => {
    it("should append #NEW when oldPrice=0 and newPrice > 0", () => {
      const model = aRepriceModel().withOldPrice(0).withNewPrice(5).withExplained("CHANGE: test").build();
      model.repriceDetails!.oldPrice = 0;

      const result = AppendNewPriceBreakActivation(model);

      expect(result.repriceDetails!.explained).toContain("#NEW");
    });

    it("should replace #UP with #NEW in single-break explained", () => {
      const model = aRepriceModel().withOldPrice(0).withNewPrice(5).withExplained("CHANGE: validated #UP").build();
      model.repriceDetails!.oldPrice = 0;

      const result = AppendNewPriceBreakActivation(model);

      expect(result.repriceDetails!.explained).toContain("#NEW");
      expect(result.repriceDetails!.explained).not.toContain("#UP");
    });

    it("should not modify when oldPrice is not 0", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).withExplained("CHANGE: #UP").build();

      const result = AppendNewPriceBreakActivation(model);

      expect(result.repriceDetails!.explained).toBe("CHANGE: #UP");
    });
  });

  describe("mutation behavior", () => {
    it("should mutate the input model directly (no clone)", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 5, isRepriced: true, explained: "CHANGE: test" }).build();

      AppendNewPriceBreakActivation(model);

      expect(model.listOfRepriceDetails[0].explained).toContain("#NEW");
    });
  });
});
