// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { AlignIsRepriced } from "../../../v1/repricer-rule-helper";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("AlignIsRepriced", () => {
  describe("multi-break model", () => {
    it("should set isRepriced=false when newPrice equals oldPrice", async () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true }).build();

      const result = await AlignIsRepriced(model);

      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[0].explained).toContain("_IGNORED_#SAMEPRICESUGGESTED");
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(true);
    });

    it("should not modify breaks where newPrice is N/A", async () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: "N/A", isRepriced: false }).build();

      const result = await AlignIsRepriced(model);

      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[0].explained).not.toContain("_IGNORED_#SAMEPRICESUGGESTED");
    });

    it("should skip deactivated breaks (active=0)", async () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).build();
      model.listOfRepriceDetails[0].active = 0 as unknown as boolean;

      const result = await AlignIsRepriced(model);

      expect(result.listOfRepriceDetails[0].isRepriced).toBe(true);
    });

    it("should handle multiple same-price breaks", async () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8, isRepriced: true }).build();

      const result = await AlignIsRepriced(model);

      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(false);
    });
  });

  describe("single-break model", () => {
    it("should not trigger due to property access bug ($eval.newPrice is undefined)", async () => {
      // The code checks $eval.newPrice and $eval.oldPrice (top-level),
      // but RepriceModel only has repriceDetails.newPrice/oldPrice.
      // parseFloat(undefined) => NaN; NaN == NaN => false
      // So the single-break branch effectively never fires.
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10).build();

      const result = await AlignIsRepriced(model);

      expect(result.repriceDetails!.isRepriced).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should catch exceptions and still return the model", async () => {
      const model = null as any;
      const result = await AlignIsRepriced(model);
      expect(result).toBeNull();
    });
  });
});
