// Must mock before any source imports (shared.ts imports config, mysql-v2, global-param)
jest.mock("../../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../../mysql/mysql-v2", () => ({ GetCronSettingsDetailsById: jest.fn(), GetGlobalConfig: jest.fn() }));
jest.mock("../../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import { isPriceUpdateRequired, notQ2VsQ1, MinQtyPricePresent, getIsFloorReached, getPriceStepValue } from "../../../v1/shared";
import { Net32PriceBreak } from "../../../../../types/net32";
import { aRepriceModel, makeRepriceData } from "../../infrastructure/builders/reprice-model.builder";

describe("isPriceUpdateRequired", () => {
  describe("when isRepriceOn = false", () => {
    it("should return false regardless of model state", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      expect(isPriceUpdateRequired(model, false)).toBe(false);
    });
  });

  describe("single-break model", () => {
    it("should return true when newPrice differs from oldPrice", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      expect(isPriceUpdateRequired(model, true)).toBe(true);
    });

    it("should return false when newPrice equals oldPrice", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10).build();
      expect(isPriceUpdateRequired(model, true)).toBe(false);
    });

    it("should return false when newPrice is N/A", () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice("N/A").build();
      model.repriceDetails!.isRepriced = false;
      expect(isPriceUpdateRequired(model, true)).toBe(false);
    });
  });

  describe("multi-break model", () => {
    it("should return true when any break has newPrice different from oldPrice", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true }).build();
      model.isMultiplePriceBreakAvailable = true;
      expect(isPriceUpdateRequired(model, true)).toBe(true);
    });

    it("should return true when any break has active=false (deactivation)", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8, isRepriced: true, active: false }).build();
      model.isMultiplePriceBreakAvailable = true;
      expect(isPriceUpdateRequired(model, true)).toBe(true);
    });

    it("should return false when all breaks have same price and are active", () => {
      const model = aRepriceModel().withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true }).withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8, isRepriced: true }).build();
      model.isMultiplePriceBreakAvailable = true;
      expect(isPriceUpdateRequired(model, true)).toBe(false);
    });
  });
});

describe("notQ2VsQ1", () => {
  it("should return false when minQty=2 and compareWithQ1=true", () => {
    expect(notQ2VsQ1(2, true)).toBe(false);
  });

  it("should return true when minQty=2 and compareWithQ1=false", () => {
    expect(notQ2VsQ1(2, false)).toBe(true);
  });

  it("should return true when minQty=1 and compareWithQ1=true", () => {
    expect(notQ2VsQ1(1, true)).toBe(true);
  });

  it("should return true when minQty=3 and compareWithQ1=true", () => {
    expect(notQ2VsQ1(3, true)).toBe(true);
  });
});

describe("MinQtyPricePresent", () => {
  it("should return true when a price break with matching minQty exists", () => {
    const breaks: Net32PriceBreak[] = [
      { minQty: 1, unitPrice: 10, active: true },
      { minQty: 3, unitPrice: 8, active: true },
    ];
    expect(MinQtyPricePresent(breaks, 3)).toBe(true);
  });

  it("should return false when no price break with matching minQty exists", () => {
    const breaks: Net32PriceBreak[] = [{ minQty: 1, unitPrice: 10, active: true }];
    expect(MinQtyPricePresent(breaks, 3)).toBe(false);
  });

  it("should return false when priceBreaks is null", () => {
    expect(MinQtyPricePresent(null as any, 1)).toBe(false);
  });

  it("should return false when priceBreaks is empty", () => {
    expect(MinQtyPricePresent([], 1)).toBe(false);
  });

  it("should match even inactive price breaks", () => {
    const breaks: Net32PriceBreak[] = [{ minQty: 1, unitPrice: 10, active: false }];
    expect(MinQtyPricePresent(breaks, 1)).toBe(true);
  });
});

describe("getIsFloorReached", () => {
  it("should return true when explained contains #HitFloor (case-insensitive)", async () => {
    const detail = makeRepriceData({
      oldPrice: 10,
      newPrice: 5,
      isRepriced: false,
      explained: "IGNORE: #HitFloor",
    });
    expect(await getIsFloorReached(detail)).toBe(true);
  });

  it("should return true when explained contains #HITFLOOR (uppercase)", async () => {
    const detail = makeRepriceData({
      oldPrice: 10,
      newPrice: 5,
      isRepriced: false,
      explained: "SOMETHING #HITFLOOR",
    });
    expect(await getIsFloorReached(detail)).toBe(true);
  });

  it("should return false when explained does not contain #HitFloor", async () => {
    const detail = makeRepriceData({
      oldPrice: 10,
      newPrice: 9,
      isRepriced: true,
      explained: "CHANGE: validated",
    });
    expect(await getIsFloorReached(detail)).toBe(false);
  });

  it("should throw when explained is null", async () => {
    const detail = makeRepriceData({
      oldPrice: 10,
      newPrice: 9,
      isRepriced: true,
    });
    detail.explained = null;
    await expect(getIsFloorReached(detail)).rejects.toThrow("Reprice details explained is null");
  });
});

describe("getPriceStepValue", () => {
  it("should return $DOWN when oldPrice > newPrice", async () => {
    const detail = makeRepriceData({ oldPrice: 10, newPrice: 8 });
    expect(await getPriceStepValue(detail)).toBe("$DOWN");
  });

  it("should return $UP when oldPrice < newPrice", async () => {
    const detail = makeRepriceData({ oldPrice: 10, newPrice: 12 });
    expect(await getPriceStepValue(detail)).toBe("$UP");
  });

  it("should return $SAME when oldPrice equals newPrice", async () => {
    const detail = makeRepriceData({ oldPrice: 10, newPrice: 10 });
    expect(await getPriceStepValue(detail)).toBe("$SAME");
  });

  it("should treat N/A as 0 for comparison", async () => {
    const detail = makeRepriceData({ oldPrice: 10, newPrice: "N/A" });
    expect(await getPriceStepValue(detail)).toBe("$DOWN");
  });

  it("should return $DOWN when oldPrice > 0 and newPrice is 0", async () => {
    const detail = makeRepriceData({ oldPrice: 10, newPrice: 0 });
    expect(await getPriceStepValue(detail)).toBe("$DOWN");
  });
});
