// Must mock before any source imports
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { ApplyMultiPriceBreakRule } from "../../../v1/repricer-rule-helper";
import { RepriceRenewedMessageEnum } from "../../../../../model/reprice-renewed-message";
import { aRepriceModel } from "../../infrastructure/builders/reprice-model.builder";
import "../../infrastructure/matchers/pricing.matchers";

describe("ApplyMultiPriceBreakRule", () => {
  it("should keep all breaks when higher-Q breaks have lower prices", () => {
    const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8, isRepriced: true }).withPriceBreak({ minQty: 6, oldPrice: 6, newPrice: 6, isRepriced: true }).build();
    const result = ApplyMultiPriceBreakRule(model);
    expect(result.listOfRepriceDetails).toHaveLength(3);
    expect(result.listOfRepriceDetails[0].newPrice).toBe(10);
    expect(result.listOfRepriceDetails[1].newPrice).toBe(8);
    expect(result.listOfRepriceDetails[2].newPrice).toBe(6);
  });

  it("should suppress higher-Q break when its price >= lower-Q break price", () => {
    const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 9, newPrice: 9, isRepriced: true }).build();
    const result = ApplyMultiPriceBreakRule(model);
    expect(result.listOfRepriceDetails).toHaveLength(2);
    const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
    expect(q3!.newPrice).toBe("N/A");
    expect(q3!.isRepriced).toBe(false);
  });

  it("should deactivate break when explained is PRICE_UP_SECOND and price is violated", () => {
    const model = aRepriceModel()
      .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true })
      .withPriceBreak({
        minQty: 3,
        oldPrice: 9,
        newPrice: 9,
        isRepriced: true,
        explained: RepriceRenewedMessageEnum.PRICE_UP_SECOND,
      })
      .build();
    const result = ApplyMultiPriceBreakRule(model);
    const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
    expect(q3!.newPrice).toBe(0);
    expect(q3!.active).toBe(0);
    expect(q3!.isRepriced).toBe(true);
    expect(q3!.explained).toContain(RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED);
  });

  it("should always keep Q1 break regardless of price", () => {
    const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 50, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 6, isRepriced: true }).build();
    const result = ApplyMultiPriceBreakRule(model);
    const q1 = result.listOfRepriceDetails.find((d) => d.minQty === 1);
    expect(q1!.newPrice).toBe(50);
  });

  it("should use oldPrice when newPrice is N/A for comparison", () => {
    const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: "N/A", isRepriced: false }).withPriceBreak({ minQty: 3, oldPrice: 11, newPrice: "N/A", isRepriced: false }).build();
    const result = ApplyMultiPriceBreakRule(model);
    const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
    expect(q3!.explained).toContain(RepriceRenewedMessageEnum.IGNORE_LOWEST_PRICE_BREAK);
  });

  it("should remove breaks with oldPrice=0 and newPrice=N/A after suppression", () => {
    const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: "N/A", isRepriced: false }).build();
    const result = ApplyMultiPriceBreakRule(model);
    expect(result.listOfRepriceDetails.every((d) => d.minQty !== 3 || d.oldPrice !== 0 || d.newPrice !== "N/A")).toBe(true);
  });

  it("should keep new break activation (oldPrice=0, newPrice != N/A)", () => {
    const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 5, isRepriced: true }).build();
    const result = ApplyMultiPriceBreakRule(model);
    const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
    expect(q3).toBeDefined();
    expect(q3!.newPrice).toBe(5);
  });

  it("should sort output by minQty ascending", () => {
    const model = aRepriceModel().withPriceBreak({ minQty: 6, oldPrice: 5, newPrice: 5, isRepriced: true }).withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 7, newPrice: 7, isRepriced: true }).build();
    const result = ApplyMultiPriceBreakRule(model);
    const qtys = result.listOfRepriceDetails.map((d) => d.minQty);
    expect(qtys).toEqual([1, 3, 6]);
  });

  it("should not mutate the original model", () => {
    const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 9, newPrice: 9, isRepriced: true }).build();
    const originalQ3Price = model.listOfRepriceDetails.find((d) => d.minQty === 3)!.newPrice;
    ApplyMultiPriceBreakRule(model);
    expect(model.listOfRepriceDetails.find((d) => d.minQty === 3)!.newPrice).toBe(originalQ3Price);
  });

  it("should handle single-break model (no listOfRepriceDetails)", () => {
    const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
    const result = ApplyMultiPriceBreakRule(model);
    expect(result.repriceDetails).toBeDefined();
  });

  it("should skip comparison with lower breaks that have price 0", () => {
    const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 0, newPrice: "N/A", isRepriced: false }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true }).build();
    const result = ApplyMultiPriceBreakRule(model);
    const q3 = result.listOfRepriceDetails.find((d) => d.minQty === 3);
    expect(q3!.newPrice).toBe(7);
  });
});
