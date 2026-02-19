// Must mock before any source imports
jest.mock("../../../../../model/global-param", () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: "17357",
    EXCLUDED_VENDOR_ID: "20722;20755",
  }),
}));
jest.mock("../../../../config", () => ({
  applicationConfig: { OFFSET: 0.01 },
}));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));

import { ApplySisterComparisonCheck } from "../../../v1/repricer-rule-helper";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import { aNet32Product } from "../../infrastructure/builders/net32-product.builder";
import { aProduct } from "../../infrastructure/builders/frontier-product.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("ApplySisterComparisonCheck", () => {
  const defaultProduct = aProduct().ownVendorId("17357").sisterVendorId("20722;20755").build();

  describe("single-break model", () => {
    it("should lower price by OFFSET when suggested price matches sister vendor Q1", async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8.0).build();
      const net32 = [aNet32Product().vendorId(17357).vendorName("Tradent").unitPrice(10).build(), aNet32Product().vendorId(20722).vendorName("Frontier").unitPrice(8.0).inStock(true).build()];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(parseFloat(result.repriceDetails!.newPrice as string)).toBeCloseTo(7.99, 2);
      expect(result.repriceDetails!.explained).toContain("#SISTERSAMEPRICE");
    });

    it("should not modify when suggested price does not match any sister vendor", async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8.5).build();
      const net32 = [aNet32Product().vendorId(17357).vendorName("Tradent").unitPrice(10).build(), aNet32Product().vendorId(20722).vendorName("Frontier").unitPrice(9.0).inStock(true).build()];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(result.repriceDetails!.newPrice).toBe(8.5);
      expect(result.repriceDetails!.explained).not.toContain("#SISTERSAMEPRICE");
    });

    it("should skip when newPrice is N/A", async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice("N/A").build();
      model.repriceDetails!.isRepriced = false;
      const net32 = [aNet32Product().vendorId(20722).unitPrice(10).inStock(true).build()];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(result.repriceDetails!.newPrice).toBe("N/A");
    });

    it("should handle cascade: if OFFSET-adjusted price also matches another sister", async () => {
      // Suggested = 8.00, Sister1 = 8.00, Sister2 = 7.99
      // First offset => 7.99, matches Sister2 => second offset => 7.98
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8.0).build();
      const net32 = [aNet32Product().vendorId(20722).vendorName("Frontier").unitPrice(8.0).inStock(true).build(), aNet32Product().vendorId(20755).vendorName("MVP").unitPrice(7.99).inStock(true).build()];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(parseFloat(result.repriceDetails!.newPrice as string)).toBeCloseTo(7.98, 2);
    });

    it("should ignore out-of-stock sister vendors", async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8.0).build();
      const net32 = [aNet32Product().vendorId(20722).vendorName("Frontier").unitPrice(8.0).outOfStock().build()];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(result.repriceDetails!.newPrice).toBe(8.0);
    });
  });

  describe("multi-break model", () => {
    it("should check each break against sister vendors at matching minQty", async () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 6, isRepriced: true }).build();
      const net32 = [
        aNet32Product()
          .vendorId(20722)
          .vendorName("Frontier")
          .priceBreaks([
            { minQty: 1, unitPrice: 8, active: true },
            { minQty: 3, unitPrice: 7, active: true },
          ])
          .inStock(true)
          .build(),
      ];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      // Q1: 8 matches sister Q1=8 => lowered to 7.99
      expect(parseFloat(result.listOfRepriceDetails[0].newPrice as string)).toBeCloseTo(7.99, 2);
      expect(result.listOfRepriceDetails[0].explained).toContain("#SISTERSAMEPRICE");
      // Q3: 6 does not match sister Q3=7 => unchanged
      expect(result.listOfRepriceDetails[1].newPrice).toBe(6);
    });
  });

  describe("cloning behavior", () => {
    it("should not mutate the original model", async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8.0).build();
      const net32 = [aNet32Product().vendorId(20722).vendorName("Frontier").unitPrice(8.0).inStock(true).build()];

      await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(model.repriceDetails!.newPrice).toBe(8.0);
    });
  });
});
