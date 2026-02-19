// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { ApplyMaxPriceCheck } from "../../../v1/repricer-rule-helper";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import { aProduct } from "../../infrastructure/builders/frontier-product.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("ApplyMaxPriceCheck", () => {
  describe("when repriceDetails.newPrice is N/A", () => {
    it("should apply max price when existing price exceeds max and max > floor", async () => {
      const model = aRepriceModel().withOldPrice(25).withNewPrice("N/A").withExplained("IGNORE: some reason").build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.newPrice).toBe("20.00");
      expect(result.repriceDetails!.explained).toContain("CHANGE");
      expect(result.repriceDetails!.explained).toContain("_#MAXPRICEAPPLIED");
    });

    it("should replace IGNORE with CHANGE in explained", async () => {
      const model = aRepriceModel().withOldPrice(25).withNewPrice("N/A").withExplained("IGNORE: too high").build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.explained).not.toContain("IGNORE");
      expect(result.repriceDetails!.explained).toContain("CHANGE");
    });

    it("should NOT apply when existing price is below max", async () => {
      const model = aRepriceModel().withOldPrice(15).withNewPrice("N/A").withExplained("IGNORE: some reason").build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });

    it("should NOT apply when max price is below floor price", async () => {
      const model = aRepriceModel().withOldPrice(25).withNewPrice("N/A").withExplained("IGNORE: some reason").build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(3).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });

    it("should NOT apply when max price equals floor price", async () => {
      const model = aRepriceModel().withOldPrice(25).withNewPrice("N/A").withExplained("IGNORE: some reason").build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(5).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });
  });

  describe("when repriceDetails.newPrice is NOT N/A", () => {
    it("should not modify the result (function only acts on N/A)", async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).withExplained("CHANGE: something").build();
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.newPrice).toBe(8);
    });
  });

  describe("when repriceDetails is null (multi-break model)", () => {
    it("should return unmodified (function only checks repriceDetails)", async () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 25, newPrice: "N/A", isRepriced: false }).build();
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.listOfRepriceDetails[0].newPrice).toBe("N/A");
    });
  });

  describe("cloning behavior", () => {
    it("should not mutate the original model", async () => {
      const model = aRepriceModel().withOldPrice(25).withNewPrice("N/A").withExplained("IGNORE: test").build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(model.repriceDetails!.newPrice).toBe("N/A");
      expect(result.repriceDetails!.newPrice).toBe("20.00");
    });
  });
});
