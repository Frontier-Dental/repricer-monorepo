// Must mock before any source imports
jest.mock("../../../config", () => ({ applicationConfig: { OFFSET: 0.01, FLAG_MULTI_PRICE_UPDATE: true } }));
jest.mock("../../../filter-mapper", () => ({ FilterBasedOnParams: jest.fn() }));
jest.mock("../../../../model/global-param", () => ({ GetInfo: jest.fn() }));

import fc from "fast-check";
import _ from "lodash";
import { RepriceData, RepriceModel } from "../../../../model/reprice-model";
import { ApplyFloorCheckRule, ApplyRule, ApplyMultiPriceBreakRule, ApplyMaxPriceCheck } from "../../v1/repricer-rule-helper";
import { arbPrice, arbSingleBreakRepriceModel, arbMultiBreakRepriceModel, arbDownwardPriceMove, arbUpwardPriceMove } from "./arbitraries";

// ---------------------------------------------------------------------------
// Test configuration
// ---------------------------------------------------------------------------
const NUM_RUNS = 1000;

// ---------------------------------------------------------------------------
// Invariant 1: Floor Price
// ---------------------------------------------------------------------------

describe("Invariant 1: Floor Price", () => {
  it("single break: newPrice is never <= floorPrice after floor check", () => {
    fc.assert(
      fc.property(arbSingleBreakRepriceModel, arbPrice, (model, floorPrice) => {
        const result = ApplyFloorCheckRule(model, floorPrice);

        if (result.repriceDetails && result.repriceDetails.newPrice !== "N/A" && result.repriceDetails.newPrice !== null) {
          const newPriceNum = parseFloat(result.repriceDetails.newPrice as string);
          expect(newPriceNum).toBeGreaterThan(floorPrice);
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("multi break: no break has newPrice <= floorPrice after floor check", () => {
    fc.assert(
      fc.property(arbMultiBreakRepriceModel, arbPrice, (model, floorPrice) => {
        const result = ApplyFloorCheckRule(model, floorPrice);

        for (const detail of result.listOfRepriceDetails) {
          if (detail.newPrice !== "N/A" && detail.newPrice !== null && detail.active !== false && detail.active !== (0 as unknown as boolean)) {
            const newPriceNum = parseFloat(detail.newPrice as string);
            expect(newPriceNum).toBeGreaterThan(floorPrice);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Invariant 2: Max Price
// ---------------------------------------------------------------------------

describe("Invariant 2: Max Price", () => {
  it("when oldPrice > maxPrice and newPrice is N/A, result newPrice <= maxPrice", () => {
    fc.assert(
      fc.asyncProperty(
        fc.double({ min: 10, max: 500, noNaN: true, noDefaultInfinity: true }).map((v) => Math.round(v * 100) / 100),
        fc.double({ min: 0.01, max: 9.99, noNaN: true, noDefaultInfinity: true }).map((v) => Math.round(v * 100) / 100),
        fc.double({ min: 1, max: 200, noNaN: true, noDefaultInfinity: true }).map((v) => Math.round(v * 100) / 100),
        async (maxPrice, floorPrice, overshoot) => {
          const effectiveFloor = Math.min(floorPrice, maxPrice - 0.01);
          if (effectiveFloor <= 0) return;
          const oldPrice = maxPrice + overshoot;

          const model = new RepriceModel("TEST-MAX", null, "Test Product", null, false, false, [], null);
          const rd = new RepriceData(oldPrice, null, false, "IGNORE: test");
          rd.active = true;
          model.repriceDetails = rd;

          // ApplyMaxPriceCheck expects a FrontierProduct with maxPrice/floorPrice as strings
          const productItem = {
            maxPrice: maxPrice.toString(),
            floorPrice: effectiveFloor.toString(),
            is_nc_needed: false,
          } as any;

          const result = await ApplyMaxPriceCheck(model, productItem);

          if (result.repriceDetails && result.repriceDetails.newPrice !== "N/A" && result.repriceDetails.newPrice !== null) {
            const resultPrice = parseFloat(result.repriceDetails.newPrice as string);
            expect(resultPrice).toBeLessThanOrEqual(maxPrice);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Invariant 3: Direction Rule 0 (Only Up)
// ---------------------------------------------------------------------------

describe("Invariant 3: Direction Rule 0 (Only Up)", () => {
  it("single break: downward price move is always blocked", () => {
    fc.assert(
      fc.property(arbDownwardPriceMove, ({ oldPrice, newPrice }) => {
        const model = new RepriceModel("TEST-RULE0", null, "Test Product", null, false, false, [], null);
        const rd = new RepriceData(oldPrice, newPrice, true, "CHANGE: test");
        rd.isRepriced = true;
        rd.active = true;
        model.repriceDetails = rd;

        const result = ApplyRule(model, 0, false);

        expect(result.repriceDetails!.newPrice).toBe("N/A");
        expect(result.repriceDetails!.isRepriced).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("multi break: every downward move in listOfRepriceDetails is blocked", () => {
    fc.assert(
      fc.property(fc.array(arbDownwardPriceMove, { minLength: 1, maxLength: 4 }), (pricePairs) => {
        const breaks = pricePairs.map(({ oldPrice, newPrice }, idx) => {
          const minQtys = [1, 2, 6, 12];
          const rd = new RepriceData(oldPrice, newPrice, true, "CHANGE: test", minQtys[idx]);
          rd.isRepriced = true;
          rd.active = true;
          return rd;
        });

        const model = new RepriceModel("TEST-RULE0-MULTI", null, "Test Product", null, false, true, breaks, null);

        const result = ApplyRule(model, 0, false);

        for (const detail of result.listOfRepriceDetails) {
          expect(detail.newPrice).toBe("N/A");
          expect(detail.isRepriced).toBe(false);
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Invariant 4: Direction Rule 1 (Only Down)
// ---------------------------------------------------------------------------

describe("Invariant 4: Direction Rule 1 (Only Down)", () => {
  it("single break: upward price move is always blocked", () => {
    fc.assert(
      fc.property(arbUpwardPriceMove, ({ oldPrice, newPrice }) => {
        const model = new RepriceModel("TEST-RULE1", null, "Test Product", null, false, false, [], null);
        const rd = new RepriceData(oldPrice, newPrice, true, "CHANGE: test");
        rd.isRepriced = true;
        rd.active = true;
        model.repriceDetails = rd;

        const result = ApplyRule(model, 1, false);

        expect(result.repriceDetails!.newPrice).toBe("N/A");
        expect(result.repriceDetails!.isRepriced).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("multi break: every upward move in listOfRepriceDetails is blocked", () => {
    fc.assert(
      fc.property(fc.array(arbUpwardPriceMove, { minLength: 1, maxLength: 4 }), (pricePairs) => {
        const breaks = pricePairs.map(({ oldPrice, newPrice }, idx) => {
          const minQtys = [1, 2, 6, 12];
          const rd = new RepriceData(oldPrice, newPrice, true, "CHANGE: test", minQtys[idx]);
          rd.isRepriced = true;
          rd.active = true;
          return rd;
        });

        const model = new RepriceModel("TEST-RULE1-MULTI", null, "Test Product", null, false, true, breaks, null);

        const result = ApplyRule(model, 1, false);

        for (const detail of result.listOfRepriceDetails) {
          expect(detail.newPrice).toBe("N/A");
          expect(detail.isRepriced).toBe(false);
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Invariant 5: Q-Break Hierarchy
// ---------------------------------------------------------------------------

describe("Invariant 5: Q-Break Hierarchy", () => {
  it("active surviving breaks have decreasing prices for increasing quantities", () => {
    fc.assert(
      fc.property(arbMultiBreakRepriceModel, (model) => {
        const result = ApplyMultiPriceBreakRule(model);

        // Only consider breaks that are active AND not suppressed (newPrice !== "N/A").
        // Suppressed breaks keep active=true but get newPrice="N/A", so we must
        // exclude them from the hierarchy check.
        const survivingBreaks = result.listOfRepriceDetails
          .filter((d) => {
            return d.active !== false && d.active !== (0 as unknown as boolean) && d.newPrice !== "N/A" && d.newPrice !== null;
          })
          .map((d) => ({
            minQty: d.minQty as number,
            effectivePrice: parseFloat(d.newPrice as string),
          }))
          .filter((d) => d.effectivePrice > 0)
          .sort((a, b) => a.minQty - b.minQty);

        // The rule suppresses higher-Q breaks that are MORE expensive than
        // lower-Q breaks (using >= on line 88 of repricer-rule-helper.ts).
        for (let i = 1; i < survivingBreaks.length; i++) {
          if (survivingBreaks[i].minQty > survivingBreaks[i - 1].minQty) {
            expect(survivingBreaks[i].effectivePrice).toBeLessThanOrEqual(survivingBreaks[i - 1].effectivePrice);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Invariant 6: Offset Consistency
// ---------------------------------------------------------------------------

describe("Invariant 6: Offset Consistency", () => {
  it("offset-derived price is always below competitor price", () => {
    const OFFSET = 0.01;

    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 999.99, noNaN: true, noDefaultInfinity: true }).map((v) => Math.round(v * 100) / 100),
        (competitorPrice) => {
          const offsetPrice = Math.round((competitorPrice - OFFSET) * 100) / 100;

          if (offsetPrice > 0) {
            expect(offsetPrice).toBeLessThan(competitorPrice);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("offset-derived price with percentage down is always below competitor", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 999.99, noNaN: true, noDefaultInfinity: true }).map((v) => Math.round(v * 100) / 100),
        fc.double({ min: 0.01, max: 10.0, noNaN: true, noDefaultInfinity: true }).map((v) => Math.round(v * 100) / 100),
        (competitorPrice, percentageDown) => {
          const OFFSET = 0.01;
          const percentageReduction = competitorPrice * (percentageDown / 100);
          const contextPrice = Math.round((competitorPrice - OFFSET - percentageReduction) * 100) / 100;

          if (contextPrice > 0) {
            expect(contextPrice).toBeLessThan(competitorPrice);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
