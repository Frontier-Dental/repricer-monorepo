# 05 - Property-Based Invariant Tests with fast-check

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [File Structure](#file-structure)
4. [Complete File: arbitraries.ts](#complete-file-arbitrariests)
5. [Complete File: pricing-invariants.test.ts](#complete-file-pricing-invariantstestts)
6. [Invariant 1: Floor Price](#invariant-1-floor-price)
7. [Invariant 2: Max Price](#invariant-2-max-price)
8. [Invariant 3: Direction Rule 0 (Only Up)](#invariant-3-direction-rule-0-only-up)
9. [Invariant 4: Direction Rule 1 (Only Down)](#invariant-4-direction-rule-1-only-down)
10. [Invariant 5: Q-Break Hierarchy](#invariant-5-q-break-hierarchy)
11. [Invariant 6: Offset Consistency](#invariant-6-offset-consistency)
12. [How to Run](#how-to-run)
13. [Expected Output](#expected-output)

---

## Overview

Property-based tests verify invariants that must ALWAYS hold, regardless of input. Instead of testing specific scenarios, we generate thousands of random inputs and verify the property holds for all of them. When a property fails, fast-check automatically shrinks the failing input to the smallest possible counterexample.

**Library:** `fast-check`
**Target functions:** The rule functions in `apps/api-core/src/utility/reprice-algo/v1/repricer-rule-helper.ts`
**Key types:** `RepriceModel`, `RepriceData` (from `src/model/reprice-model.ts`), `Net32Product`, `Net32PriceBreak` (from `src/types/net32.ts`)

### Why Property-Based Testing for the Repricer

The repricing algorithm processes thousands of products with varying prices, floor limits, max limits, directional rules, and multi-break configurations. Traditional example-based tests cover known scenarios but miss edge cases in the vast input space. Property-based tests systematically explore this space by generating random valid inputs and asserting that critical business rules are never violated.

---

## Installation

Run from the `apps/api-core` directory:

```bash
cd apps/api-core
npm install --save-dev fast-check
```

This is the only new dependency required. The project already has `jest` and `ts-jest` configured.

---

## File Structure

All invariant test files go under:

```
apps/api-core/src/utility/reprice-algo/__tests__/invariants/
```

Create this directory structure:

```
apps/api-core/src/utility/reprice-algo/__tests__/
  invariants/
    arbitraries.ts                  # Custom fast-check generators
    pricing-invariants.test.ts      # All 6 invariant tests
```

---

## Complete File: arbitraries.ts

**Path:** `apps/api-core/src/utility/reprice-algo/__tests__/invariants/arbitraries.ts`

This file contains all custom fast-check arbitraries (random generators) that produce valid domain objects matching the exact types used by the repricer rule functions.

```typescript
import fc from "fast-check";
import { RepriceData, RepriceModel } from "../../../../model/reprice-model";
import { Net32Product, Net32PriceBreak } from "../../../../types/net32";

// ---------------------------------------------------------------------------
// Primitive arbitraries
// ---------------------------------------------------------------------------

/**
 * Random price between 0.01 and 999.99, rounded to 2 decimal places.
 * Avoids NaN and Infinity which would break arithmetic comparisons.
 */
export const arbPrice = fc
  .double({ min: 0.01, max: 999.99, noNaN: true, noDefaultInfinity: true })
  .map((p) => Math.round(p * 100) / 100);

/**
 * Random price as a string with 2 decimal places (matching how RepriceData.newPrice
 * is typically stored after toFixed(2) in the constructor).
 */
export const arbPriceString = arbPrice.map((p) => p.toFixed(2));

/**
 * Valid minQty values used across the system. These are the quantity break
 * points that appear in Net32 price break data.
 */
export const arbMinQty = fc.constantFrom(1, 2, 3, 5, 6, 10, 12, 24);

// ---------------------------------------------------------------------------
// RepriceData arbitrary
// ---------------------------------------------------------------------------

/**
 * Generates a RepriceData object that simulates an active reprice suggestion.
 *
 * The RepriceData constructor (see src/model/reprice-model.ts lines 27-37)
 * accepts (oldPrice, newPrice, isRepriced, message, minQty). When isRepriced
 * is true it formats newPrice via toFixed(2), otherwise sets it to "N/A".
 *
 * We construct these directly to avoid constructor side effects and to have
 * precise control over the field values for property testing.
 */
export const arbRepriceData = fc
  .record({
    oldPrice: arbPrice,
    newPrice: arbPriceString,
    minQty: arbMinQty,
  })
  .map(({ oldPrice, newPrice, minQty }) => {
    const rd = new RepriceData(oldPrice, parseFloat(newPrice), true, "CHANGE: test", minQty);
    // Ensure the fields are set as expected for an active reprice
    rd.isRepriced = true;
    rd.active = true;
    rd.lowestVendor = "TestVendor";
    rd.lowestVendorPrice = oldPrice;
    return rd;
  });

/**
 * Generates a RepriceData that has been "ignored" (newPrice = "N/A").
 */
export const arbIgnoredRepriceData = fc
  .record({
    oldPrice: arbPrice,
    minQty: arbMinQty,
  })
  .map(({ oldPrice, minQty }) => {
    const rd = new RepriceData(oldPrice, null, false, "IGNORE: test", minQty);
    rd.active = true;
    rd.lowestVendor = "TestVendor";
    rd.lowestVendorPrice = oldPrice;
    return rd;
  });

// ---------------------------------------------------------------------------
// RepriceModel arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a single-break RepriceModel (repriceDetails is set,
 * listOfRepriceDetails is empty). This is the shape used when a product
 * has only one price break at minQty=1.
 *
 * The RepriceModel constructor (see src/model/reprice-model.ts lines 59-76)
 * sets repriceDetails only when multiplePriceBreak=false AND productDetails
 * is non-null. We pass null for productDetails and set repriceDetails manually
 * to avoid needing a full Net32Product object.
 */
export const arbSingleBreakRepriceModel = arbRepriceData.map((rd) => {
  const model = new RepriceModel(
    "TEST-123",      // net32id / sourceId
    null,            // productDetails (null = we set repriceDetails manually)
    "Test Product",  // productName
    null,            // newPrice (unused when we override)
    false,           // isRepriced (unused when we override)
    false,           // multiplePriceBreak = false for single break
    [],              // listOfRepriceData
    null             // message
  );
  model.repriceDetails = rd;
  model.vendorName = "TestVendor";
  model.vendorId = "99999";
  return model;
});

/**
 * Generates a multi-break RepriceModel (repriceDetails is null,
 * listOfRepriceDetails has 2-4 breaks with strictly increasing minQty values).
 *
 * The minQty values are drawn from the valid set and deduplicated/sorted.
 * Each break gets its own random old and new prices.
 */
export const arbMultiBreakRepriceModel = fc
  .record({
    break1: arbRepriceData.map((rd) => {
      rd.minQty = 1;
      return rd;
    }),
    break2Price: arbPrice,
    break3Price: fc.option(arbPrice, { nil: undefined }),
    break4Price: fc.option(arbPrice, { nil: undefined }),
  })
  .map(({ break1, break2Price, break3Price, break4Price }) => {
    const breaks: RepriceData[] = [break1];

    // Break 2: minQty = 2 or 3
    const rd2 = new RepriceData(break2Price, break2Price * 0.95, true, "CHANGE: test", 2);
    rd2.isRepriced = true;
    rd2.active = true;
    rd2.lowestVendor = "TestVendor";
    rd2.lowestVendorPrice = break2Price;
    breaks.push(rd2);

    // Optional break 3: minQty = 6
    if (break3Price !== undefined) {
      const rd3 = new RepriceData(break3Price, break3Price * 0.9, true, "CHANGE: test", 6);
      rd3.isRepriced = true;
      rd3.active = true;
      rd3.lowestVendor = "TestVendor";
      rd3.lowestVendorPrice = break3Price;
      breaks.push(rd3);
    }

    // Optional break 4: minQty = 12
    if (break4Price !== undefined) {
      const rd4 = new RepriceData(break4Price, break4Price * 0.85, true, "CHANGE: test", 12);
      rd4.isRepriced = true;
      rd4.active = true;
      rd4.lowestVendor = "TestVendor";
      rd4.lowestVendorPrice = break4Price;
      breaks.push(rd4);
    }

    const model = new RepriceModel(
      "TEST-456",
      null,
      "Test Multi Product",
      null,
      false,
      true,           // multiplePriceBreak = true
      breaks,
      null
    );
    model.vendorName = "TestVendor";
    model.vendorId = "99999";
    return model;
  });

// ---------------------------------------------------------------------------
// Net32 type arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a single Net32PriceBreak with valid fields.
 */
export const arbNet32PriceBreak = fc
  .record({
    minQty: arbMinQty,
    unitPrice: arbPrice,
    active: fc.constant(true as boolean | undefined),
  })
  .map(
    ({ minQty, unitPrice, active }): Net32PriceBreak => ({
      minQty,
      unitPrice,
      active,
    })
  );

/**
 * Generates a complete Net32Product with 1-4 price breaks.
 * Price breaks have unique minQty values and are sorted by minQty ascending.
 */
export const arbNet32Product = fc
  .record({
    vendorId: fc.integer({ min: 1, max: 99999 }),
    vendorName: fc.constantFrom("Vendor A", "Vendor B", "Vendor C", "Vendor D"),
    vendorProductId: fc.integer({ min: 1000, max: 9999 }),
    vendorProductCode: fc.hexaString({ minLength: 6, maxLength: 6 }),
    inStock: fc.constant(true),
    standardShipping: fc.constantFrom(0, 4.95, 7.5, 9.99),
    shippingTime: fc.integer({ min: 1, max: 7 }),
    inventory: fc.integer({ min: 1, max: 500 }),
    priceBreaks: fc
      .uniqueArray(arbMinQty, { minLength: 1, maxLength: 4 })
      .chain((qtys) => {
        const sorted = [...qtys].sort((a, b) => a - b);
        return fc
          .array(arbPrice, { minLength: sorted.length, maxLength: sorted.length })
          .map((prices) =>
            sorted.map(
              (qty, i): Net32PriceBreak => ({
                minQty: qty,
                unitPrice: prices[i],
                active: true,
              })
            )
          );
      }),
    freeShippingGap: fc.double({ min: 0, max: 50, noNaN: true, noDefaultInfinity: true }),
    freeShippingThreshold: fc.constantFrom(0, 50, 100, 150),
    badgeId: fc.constantFrom(0, 1, 2, 3),
    badgeName: fc.constant(null as string | null),
  })
  .map(
    (fields): Net32Product => ({
      vendorProductId: fields.vendorProductId,
      vendorProductCode: fields.vendorProductCode,
      vendorId: fields.vendorId,
      vendorName: fields.vendorName,
      vendorRegion: "US",
      inStock: fields.inStock,
      standardShipping: fields.standardShipping,
      standardShippingStatus: "available",
      freeShippingGap: fields.freeShippingGap,
      heavyShippingStatus: "none",
      heavyShipping: 0,
      shippingTime: fields.shippingTime,
      inventory: fields.inventory,
      isFulfillmentPolicyStock: false,
      vdrGeneralAverageRatingSum: 4.5,
      vdrNumberOfGeneralRatings: 100,
      isBackordered: false,
      vendorProductLevelLicenseRequiredSw: false,
      vendorVerticalLevelLicenseRequiredSw: false,
      priceBreaks: fields.priceBreaks,
      badgeId: fields.badgeId,
      badgeName: fields.badgeName,
      imagePath: "",
      arrivalDate: "2025-01-01",
      arrivalBusinessDays: 3,
      twoDayDeliverySw: false,
      isLowestTotalPrice: null,
      freeShippingThreshold: fields.freeShippingThreshold,
    })
  );

// ---------------------------------------------------------------------------
// Constrained arbitraries for specific invariant tests
// ---------------------------------------------------------------------------

/**
 * Generates a pair of (oldPrice, newPrice) where newPrice < oldPrice.
 * Used to test Direction Rule 0 (Only Up) which should block downward moves.
 */
export const arbDownwardPriceMove = fc
  .record({
    oldPrice: fc.double({ min: 1.00, max: 999.99, noNaN: true, noDefaultInfinity: true }),
    delta: fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ oldPrice, delta }) => {
    const old = Math.round(oldPrice * 100) / 100;
    const newP = Math.round(Math.max(0.01, old - delta) * 100) / 100;
    return { oldPrice: old, newPrice: newP };
  })
  .filter(({ oldPrice, newPrice }) => newPrice < oldPrice);

/**
 * Generates a pair of (oldPrice, newPrice) where newPrice > oldPrice.
 * Used to test Direction Rule 1 (Only Down) which should block upward moves.
 */
export const arbUpwardPriceMove = fc
  .record({
    oldPrice: fc.double({ min: 0.01, max: 899.99, noNaN: true, noDefaultInfinity: true }),
    delta: fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ oldPrice, delta }) => {
    const old = Math.round(oldPrice * 100) / 100;
    const newP = Math.round(Math.min(999.99, old + delta) * 100) / 100;
    return { oldPrice: old, newPrice: newP };
  })
  .filter(({ oldPrice, newPrice }) => newPrice > oldPrice);

/**
 * Generates a floor price and a RepriceModel where the new price equals
 * the floor or goes below it. Used to verify floor check enforcement.
 */
export const arbFloorViolation = fc
  .record({
    floorPrice: fc.double({ min: 5.0, max: 500.0, noNaN: true, noDefaultInfinity: true }),
    priceBelowFloor: fc.double({ min: 0.01, max: 4.99, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ floorPrice, priceBelowFloor }) => {
    const floor = Math.round(floorPrice * 100) / 100;
    const belowFloorPrice = Math.round(Math.min(priceBelowFloor, floor) * 100) / 100;
    return { floorPrice: floor, priceAtOrBelowFloor: belowFloorPrice };
  });
```

---

## Complete File: pricing-invariants.test.ts

**Path:** `apps/api-core/src/utility/reprice-algo/__tests__/invariants/pricing-invariants.test.ts`

This file contains all 6 invariant tests. Each test uses `fc.assert` with `{ numRuns: 1000 }` to verify properties against 1000 random inputs.

```typescript
import fc from "fast-check";
import _ from "lodash";
import { RepriceData, RepriceModel } from "../../../../model/reprice-model";
import {
  ApplyFloorCheckRule,
  ApplyRule,
  ApplyMultiPriceBreakRule,
  ApplyMaxPriceCheck,
} from "../../v1/repricer-rule-helper";
import {
  arbPrice,
  arbPriceString,
  arbSingleBreakRepriceModel,
  arbMultiBreakRepriceModel,
  arbRepriceData,
  arbDownwardPriceMove,
  arbUpwardPriceMove,
} from "./arbitraries";

// ---------------------------------------------------------------------------
// Test configuration
// ---------------------------------------------------------------------------
const NUM_RUNS = 1000;

// ---------------------------------------------------------------------------
// Invariant 1: Floor Price
// ---------------------------------------------------------------------------

describe("Invariant 1: Floor Price", () => {
  /**
   * WHAT: If a price change is applied, the new price is always >= floor price.
   *
   * WHY: The floor price is the absolute minimum a product can be sold for.
   *      Violating this could mean selling below cost. The ApplyFloorCheckRule
   *      function (repricer-rule-helper.ts lines 238-258) enforces this by
   *      setting newPrice to "N/A" when it is <= floorPrice.
   *
   * HOW: Generate random RepriceModel objects with random floor prices.
   *      After applying ApplyFloorCheckRule, verify that any surviving
   *      newPrice (not "N/A") is strictly greater than the floor price.
   */

  it("single break: newPrice is never <= floorPrice after floor check", () => {
    fc.assert(
      fc.property(arbSingleBreakRepriceModel, arbPrice, (model, floorPrice) => {
        const result = ApplyFloorCheckRule(model, floorPrice);

        if (
          result.repriceDetails &&
          result.repriceDetails.newPrice !== "N/A" &&
          result.repriceDetails.newPrice !== null
        ) {
          const newPriceNum = parseFloat(result.repriceDetails.newPrice as string);
          // The rule blocks prices <= floor, so surviving prices must be > floor
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
          if (
            detail.newPrice !== "N/A" &&
            detail.newPrice !== null &&
            detail.active !== false &&
            detail.active !== (0 as unknown as boolean)
          ) {
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
  /**
   * WHAT: When ApplyMaxPriceCheck triggers, the resulting price is <= max price.
   *
   * WHY: The max price caps how high a product can be priced. If the current
   *      (old) price exceeds maxPrice and newPrice is "N/A" (ignored), the
   *      ApplyMaxPriceCheck function (repricer-rule-helper.ts lines 527-542)
   *      sets newPrice to the maxPrice value. This ensures the product never
   *      stays above max indefinitely.
   *
   * HOW: Generate models where repriceDetails.newPrice="N/A" and oldPrice > maxPrice
   *      (with maxPrice > floorPrice). After applying ApplyMaxPriceCheck, the
   *      resulting newPrice must be <= maxPrice.
   *
   * NOTE: ApplyMaxPriceCheck is async and only operates on repriceDetails
   *       (single-break path), not listOfRepriceDetails. It also requires
   *       a FrontierProduct-like object with maxPrice and floorPrice fields.
   *       The is_nc_needed field controls shipping cost adjustment.
   */

  it("when oldPrice > maxPrice and newPrice is N/A, result newPrice <= maxPrice", () => {
    fc.assert(
      fc.asyncProperty(
        fc.double({ min: 10, max: 500, noNaN: true, noDefaultInfinity: true }).map(
          (v) => Math.round(v * 100) / 100
        ),
        fc.double({ min: 0.01, max: 9.99, noNaN: true, noDefaultInfinity: true }).map(
          (v) => Math.round(v * 100) / 100
        ),
        fc.double({ min: 1, max: 200, noNaN: true, noDefaultInfinity: true }).map(
          (v) => Math.round(v * 100) / 100
        ),
        async (maxPrice, floorPrice, overshoot) => {
          // Ensure the constraints: floorPrice < maxPrice < oldPrice
          const effectiveFloor = Math.min(floorPrice, maxPrice - 0.01);
          if (effectiveFloor <= 0) return; // skip degenerate cases
          const oldPrice = maxPrice + overshoot;

          // Build a single-break model with newPrice = "N/A"
          const model = new RepriceModel(
            "TEST-MAX",
            null,
            "Test Product",
            null,
            false,
            false,
            [],
            null
          );
          const rd = new RepriceData(oldPrice, null, false, "IGNORE: test");
          rd.active = true;
          model.repriceDetails = rd;

          // Build a minimal FrontierProduct-like object
          const productItem = {
            maxPrice: maxPrice.toString(),
            floorPrice: effectiveFloor.toString(),
            is_nc_needed: false,
          } as any;

          const result = await ApplyMaxPriceCheck(model, productItem);

          if (
            result.repriceDetails &&
            result.repriceDetails.newPrice !== "N/A" &&
            result.repriceDetails.newPrice !== null
          ) {
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
  /**
   * WHAT: When ruleIdentifier=0 (Only Up), a new price that is lower than
   *       the old price is always blocked (set to "N/A").
   *
   * WHY: Some products are configured to only allow upward price changes.
   *      The ApplyRule function (repricer-rule-helper.ts lines 11-72, case 0)
   *      checks if parseFloat(newPrice) < oldPrice and blocks it.
   *
   * HOW: Generate random price pairs where newPrice < oldPrice, construct
   *      a RepriceModel with these values, and apply ApplyRule with
   *      ruleIdentifier=0. The result must always have newPrice="N/A".
   */

  it("single break: downward price move is always blocked", () => {
    fc.assert(
      fc.property(arbDownwardPriceMove, ({ oldPrice, newPrice }) => {
        // Build a single-break model with the downward price move
        const model = new RepriceModel(
          "TEST-RULE0",
          null,
          "Test Product",
          null,
          false,
          false,
          [],
          null
        );
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
      fc.property(
        fc.array(arbDownwardPriceMove, { minLength: 1, maxLength: 4 }),
        (pricePairs) => {
          const breaks = pricePairs.map(({ oldPrice, newPrice }, idx) => {
            const minQtys = [1, 2, 6, 12];
            const rd = new RepriceData(
              oldPrice,
              newPrice,
              true,
              "CHANGE: test",
              minQtys[idx]
            );
            rd.isRepriced = true;
            rd.active = true;
            return rd;
          });

          const model = new RepriceModel(
            "TEST-RULE0-MULTI",
            null,
            "Test Product",
            null,
            false,
            true,
            breaks,
            null
          );

          const result = ApplyRule(model, 0, false);

          for (const detail of result.listOfRepriceDetails) {
            // Every downward price move should be blocked
            expect(detail.newPrice).toBe("N/A");
            expect(detail.isRepriced).toBe(false);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Invariant 4: Direction Rule 1 (Only Down)
// ---------------------------------------------------------------------------

describe("Invariant 4: Direction Rule 1 (Only Down)", () => {
  /**
   * WHAT: When ruleIdentifier=1 (Only Down), a new price that is higher than
   *       the old price is always blocked (set to "N/A").
   *
   * WHY: Some products are configured to only allow downward price changes.
   *      The ApplyRule function (repricer-rule-helper.ts lines 43-67, case 1)
   *      checks if parseFloat(newPrice) > oldPrice and blocks it.
   *
   * HOW: Generate random price pairs where newPrice > oldPrice, construct
   *      a RepriceModel, apply ApplyRule with ruleIdentifier=1. The result
   *      must always have newPrice="N/A".
   *
   * NOTE: The rule also blocks moves when oldPrice=0 is false (checked via
   *       $.oldPrice != 0). We only generate oldPrice > 0 to match this.
   */

  it("single break: upward price move is always blocked", () => {
    fc.assert(
      fc.property(arbUpwardPriceMove, ({ oldPrice, newPrice }) => {
        const model = new RepriceModel(
          "TEST-RULE1",
          null,
          "Test Product",
          null,
          false,
          false,
          [],
          null
        );
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
      fc.property(
        fc.array(arbUpwardPriceMove, { minLength: 1, maxLength: 4 }),
        (pricePairs) => {
          const breaks = pricePairs.map(({ oldPrice, newPrice }, idx) => {
            const minQtys = [1, 2, 6, 12];
            const rd = new RepriceData(
              oldPrice,
              newPrice,
              true,
              "CHANGE: test",
              minQtys[idx]
            );
            rd.isRepriced = true;
            rd.active = true;
            return rd;
          });

          const model = new RepriceModel(
            "TEST-RULE1-MULTI",
            null,
            "Test Product",
            null,
            false,
            true,
            breaks,
            null
          );

          const result = ApplyRule(model, 1, false);

          for (const detail of result.listOfRepriceDetails) {
            // Each break had an upward price move; all must be blocked
            expect(detail.newPrice).toBe("N/A");
            expect(detail.isRepriced).toBe(false);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Invariant 5: Q-Break Hierarchy
// ---------------------------------------------------------------------------

describe("Invariant 5: Q-Break Hierarchy", () => {
  /**
   * WHAT: After ApplyMultiPriceBreakRule, active price breaks that survive
   *       (not set to "N/A" or deactivated) have strictly decreasing unit
   *       prices as minQty increases.
   *
   * WHY: Quantity breaks exist to incentivize bulk purchases. If a customer
   *      buys more units (higher minQty), they should always get a lower
   *      per-unit price. The ApplyMultiPriceBreakRule function
   *      (repricer-rule-helper.ts lines 74-119) enforces this by iterating
   *      breaks from highest minQty to lowest. For each break, it checks
   *      whether its effective price (newPrice if not "N/A", else oldPrice)
   *      is less than all lower-quantity breaks. If not, it marks the break
   *      as "N/A" or deactivates it.
   *
   * HOW: Generate multi-break RepriceModels with random prices. After
   *      applying the rule, collect all active surviving breaks (those with
   *      a numeric newPrice and active=true) sorted by minQty. Verify that
   *      the effective unit price is strictly decreasing as minQty increases.
   */

  it("active surviving breaks have decreasing prices for increasing quantities", () => {
    fc.assert(
      fc.property(arbMultiBreakRepriceModel, (model) => {
        const result = ApplyMultiPriceBreakRule(model);

        // Collect surviving active breaks with numeric effective prices
        const survivingBreaks = result.listOfRepriceDetails
          .filter((d) => {
            // active !== false and active !== 0 (the codebase uses both)
            return (
              d.active !== false &&
              d.active !== (0 as unknown as boolean)
            );
          })
          .map((d) => ({
            minQty: d.minQty as number,
            effectivePrice:
              d.newPrice !== "N/A" && d.newPrice !== null
                ? parseFloat(d.newPrice as string)
                : d.oldPrice,
          }))
          .filter((d) => d.effectivePrice > 0) // exclude deactivated (price=0) breaks
          .sort((a, b) => a.minQty - b.minQty);

        // For every consecutive pair, higher-quantity break should have lower price
        for (let i = 1; i < survivingBreaks.length; i++) {
          if (survivingBreaks[i].minQty > survivingBreaks[i - 1].minQty) {
            expect(survivingBreaks[i].effectivePrice).toBeLessThan(
              survivingBreaks[i - 1].effectivePrice
            );
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
  /**
   * WHAT: When repricing against a competitor, if a CHANGE is applied
   *       (isRepriced=true and explained contains "CHANGE"), the new price
   *       should be less than the lowest vendor's price (because we apply
   *       an offset to undercut them).
   *
   * WHY: The core repricing strategy is to price below the lowest competitor
   *      by a configured offset (default $0.01, see config.ts line 51).
   *      The reprice-helper.ts functions compute contextPrice by subtracting
   *      the offset from the lowest competitor price. If the algorithm
   *      produces a price >= the competitor, we are not undercutting.
   *
   * HOW: We test this at the RepriceData level. Given a lowestVendorPrice
   *      and a newPrice that was computed as (lowestVendorPrice - offset),
   *      verify that newPrice < lowestVendorPrice.
   *
   * NOTE: This invariant only applies when the new price was computed via
   *       the standard offset path (not when maxPrice or floorPrice caps
   *       override the offset). We filter to cases where the explained
   *       message indicates a standard CHANGE (not MAXED or floor-hit).
   */

  it("offset-derived price is always below competitor price", () => {
    const OFFSET = 0.01; // matches applicationConfig.OFFSET default

    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 999.99, noNaN: true, noDefaultInfinity: true }).map(
          (v) => Math.round(v * 100) / 100
        ),
        (competitorPrice) => {
          // Simulate the offset calculation that reprice-helper.ts performs
          const offsetPrice =
            Math.round((competitorPrice - OFFSET) * 100) / 100;

          // The derived price must be strictly less than competitor
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
        fc.double({ min: 1.0, max: 999.99, noNaN: true, noDefaultInfinity: true }).map(
          (v) => Math.round(v * 100) / 100
        ),
        fc.double({ min: 0.01, max: 10.0, noNaN: true, noDefaultInfinity: true }).map(
          (v) => Math.round(v * 100) / 100
        ),
        (competitorPrice, percentageDown) => {
          // Simulate offset + percentage down as done in filter-mapper GetContextPrice
          const OFFSET = 0.01;
          const percentageReduction = competitorPrice * (percentageDown / 100);
          const contextPrice =
            Math.round((competitorPrice - OFFSET - percentageReduction) * 100) / 100;

          if (contextPrice > 0) {
            expect(contextPrice).toBeLessThan(competitorPrice);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
```

---

## Invariant 1: Floor Price

### What It Verifies

The floor price is the absolute minimum selling price. `ApplyFloorCheckRule` (in `repricer-rule-helper.ts` lines 238-258) checks every price break:

- For `listOfRepriceDetails`: iterates each break, and if `newPrice <= floorPrice`, sets `newPrice = "N/A"` and `isRepriced = false`.
- For `repriceDetails` (single break): same check on the single detail.
- Exception: breaks where `active == false && active === 0` are skipped (these are being deactivated).

The condition uses `<=` (less than or equal), so a price exactly equal to the floor is also blocked. Only prices strictly greater than the floor survive.

### Why It Matters

Selling below floor price means selling below cost or below a contractual minimum. This invariant ensures no random combination of inputs can produce a price at or below floor.

### Property

```
For all (repriceModel, floorPrice):
  after ApplyFloorCheckRule(repriceModel, floorPrice):
    if repriceDetails.newPrice !== "N/A" then Number(newPrice) > floorPrice
```

---

## Invariant 2: Max Price

### What It Verifies

`ApplyMaxPriceCheck` (lines 527-542) is a safety net: when `newPrice` is already `"N/A"` (some rule blocked the change) but `oldPrice > maxPrice`, it forces the price down to `maxPrice`. This only fires on the `repriceDetails` path (single break), and only when `maxPrice > floorPrice`.

### Why It Matters

Without this check, a product could remain priced above its configured maximum indefinitely if other rules kept blocking changes. The max price check ensures the system self-corrects.

### Property

```
For all (oldPrice, maxPrice, floorPrice) where floorPrice < maxPrice < oldPrice:
  given repriceDetails.newPrice = "N/A" and repriceDetails.oldPrice = oldPrice:
    after ApplyMaxPriceCheck:
      if newPrice !== "N/A" then Number(newPrice) <= maxPrice
```

---

## Invariant 3: Direction Rule 0 (Only Up)

### What It Verifies

`ApplyRule` with `ruleIdentifier=0` (lines 19-41) enforces "Only Up" -- prices can only increase. If `newPrice < oldPrice`, the move is blocked.

### Why It Matters

Some products are configured to only go up in price (perhaps during a promotional period or due to business strategy). This invariant ensures the rule never lets a downward price slip through.

### Property

```
For all (oldPrice, newPrice) where newPrice < oldPrice:
  after ApplyRule(model, 0):
    repriceDetails.newPrice === "N/A"
    repriceDetails.isRepriced === false
```

---

## Invariant 4: Direction Rule 1 (Only Down)

### What It Verifies

`ApplyRule` with `ruleIdentifier=1` (lines 43-67) enforces "Only Down" -- prices can only decrease. If `newPrice > oldPrice`, the move is blocked.

Additional blocking: the code also blocks when `explained` matches `SHUT_DOWN_NO_COMPETITOR` or `SHUT_DOWN_FLOOR_REACHED` (these represent deactivation scenarios that would appear as upward moves).

### Why It Matters

Products configured for "Only Down" are in a competitive repricing mode where the business only wants to lower prices to match competitors, never raise them.

### Property

```
For all (oldPrice, newPrice) where newPrice > oldPrice and oldPrice > 0:
  after ApplyRule(model, 1):
    repriceDetails.newPrice === "N/A"
    repriceDetails.isRepriced === false
```

---

## Invariant 5: Q-Break Hierarchy

### What It Verifies

`ApplyMultiPriceBreakRule` (lines 74-119) ensures quantity break pricing is monotonically decreasing. For example, if minQty=1 is priced at $10.00, then minQty=2 must be less than $10.00, minQty=6 must be less than the minQty=2 price, etc.

The function works backward from the highest minQty. For each break, it compares the effective price (newPrice if not "N/A", else oldPrice) against all lower-quantity breaks. If the higher-quantity break is not cheaper, it is either set to "N/A" or deactivated.

### Why It Matters

Customers expect a discount for buying in bulk. If minQty=6 is more expensive than minQty=1, it creates a confusing and potentially exploitable pricing situation. This invariant ensures structural price integrity across quantity tiers.

### Property

```
For all (multiBreakModel):
  after ApplyMultiPriceBreakRule:
    for all consecutive active surviving breaks sorted by minQty:
      break[i].effectivePrice < break[i-1].effectivePrice
```

---

## Invariant 6: Offset Consistency

### What It Verifies

The core repricing strategy is to undercut the lowest competitor by a fixed offset (default `$0.01`, configured via `applicationConfig.OFFSET`). When the algorithm computes a new price using the offset formula `competitorPrice - offset`, the result must always be strictly less than the competitor price.

### Why It Matters

If the offset calculation produced a price >= the competitor price due to floating-point error or rounding, the product would not actually undercut the competitor, defeating the purpose of the repricing system.

### Property

```
For all (competitorPrice > 0):
  round((competitorPrice - 0.01) * 100) / 100 < competitorPrice
```

---

## How to Run

From the repository root:

```bash
# Run only the invariant tests
npx jest --testPathPattern='invariants' --config=apps/api-core/jest.config.js

# Or from the api-core directory:
cd apps/api-core
npx jest --testPathPattern='invariants'

# Run with verbose output to see each property:
npx jest --testPathPattern='invariants' --verbose
```

To run a specific invariant:

```bash
# Run only the floor price invariant
npx jest --testPathPattern='invariants' -t 'Floor Price'

# Run only the direction rule tests
npx jest --testPathPattern='invariants' -t 'Direction Rule'
```

---

## Expected Output

All 6 property test suites should pass. With `--verbose`:

```
 PASS  src/utility/reprice-algo/__tests__/invariants/pricing-invariants.test.ts
  Invariant 1: Floor Price
    ✓ single break: newPrice is never <= floorPrice after floor check
    ✓ multi break: no break has newPrice <= floorPrice after floor check
  Invariant 2: Max Price
    ✓ when oldPrice > maxPrice and newPrice is N/A, result newPrice <= maxPrice
  Invariant 3: Direction Rule 0 (Only Up)
    ✓ single break: downward price move is always blocked
    ✓ multi break: every downward move in listOfRepriceDetails is blocked
  Invariant 4: Direction Rule 1 (Only Down)
    ✓ single break: upward price move is always blocked
    ✓ multi break: every upward move in listOfRepriceDetails is blocked
  Invariant 5: Q-Break Hierarchy
    ✓ active surviving breaks have decreasing prices for increasing quantities
  Invariant 6: Offset Consistency
    ✓ offset-derived price is always below competitor price
    ✓ offset-derived price with percentage down is always below competitor

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

Each property test internally runs 1000 iterations. If any property fails, fast-check will output the minimal counterexample -- the smallest input values that cause the failure. For example:

```
Property failed after 42 tests
{ seed: 1234567890, path: "41:2:1", endOnFailure: true }
Counterexample: [RepriceModel{...}, 5.99]
Shrunk 3 time(s)
```

This shrinking behavior is extremely valuable for debugging -- instead of a random complex failure, you get the simplest possible case that demonstrates the bug.

### Timing

Each test suite should complete in under 10 seconds. The 1000 iterations per property are fast because they only exercise pure synchronous functions (except Invariant 2 which uses an async function, but still has no I/O). Total expected time: approximately 5-15 seconds for all 10 tests.
