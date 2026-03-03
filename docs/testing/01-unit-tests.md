# Layer 1: Unit Tests for V1 Rule Functions

This document provides everything needed to implement unit tests for every exported rule function in the V1 repricing algorithm. All source code references, type signatures, business logic explanations, and complete test files are included. No additional codebase exploration is required.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Source Files Under Test](#2-source-files-under-test)
3. [Shared Setup](#3-shared-setup)
4. [Test File: direction-rule.test.ts](#4-test-file-direction-ruletestts)
5. [Test File: floor-check.test.ts](#5-test-file-floor-checktestts)
6. [Test File: max-price-check.test.ts](#6-test-file-max-price-checktestts)
7. [Test File: multi-price-break.test.ts](#7-test-file-multi-price-breaktestts)
8. [Test File: buy-box.test.ts](#8-test-file-buy-boxtestts)
9. [Test File: keep-position.test.ts](#9-test-file-keep-positiontestts)
10. [Test File: suppress-price-break.test.ts](#10-test-file-suppress-price-breaktestts)
11. [Test File: beat-q-price.test.ts](#11-test-file-beat-q-pricetestts)
12. [Test File: percentage-price.test.ts](#12-test-file-percentage-pricetestts)
13. [Test File: deactivate-q-break.test.ts](#13-test-file-deactivate-q-breaktestts)
14. [Test File: sister-comparison.test.ts](#14-test-file-sister-comparisontestts)
15. [Test File: badge-percentage-down.test.ts](#15-test-file-badge-percentage-downtestts)
16. [Test File: align-is-repriced.test.ts](#16-test-file-align-is-repricedtestts)
17. [Test File: new-break-activation.test.ts](#17-test-file-new-break-activationtestts)
18. [Test File: express-cron-override.test.ts](#18-test-file-express-cron-overridetestts)
19. [Shared Utility Tests (shared.ts)](#19-shared-utility-tests-sharedts)
20. [Summary Table](#20-summary-table)

---

## 1. Overview

Layer 1 tests cover every exported rule function in `repricer-rule-helper.ts` plus the pure utility functions in `shared.ts`. Each rule function is tested in isolation with builder-constructed inputs.

**Test location:** `apps/api-core/src/utility/reprice-algo/__tests__/v1/rules/`

**How to run:**
```bash
cd apps/api-core
npx jest --testPathPattern='__tests__/v1/rules' --verbose
```

**Expected test count:** ~120 tests across 15 test files plus shared utility tests.

**Key principle:** Most rule functions are pure or near-pure -- they take a `RepriceModel`, mutate or clone it, and return the result. Mocking is only needed for functions that call `globalParam.GetInfo()` or `filterMapper.FilterBasedOnParams()`. Specifically, `ApplyRepriceDownBadgeCheckRule` and `ApplySisterComparisonCheck` call `globalParam.GetInfo()` and need mocks. All other functions are fully pure.

---

## 2. Source Files Under Test

### Primary: repricer-rule-helper.ts

**Path:** `apps/api-core/src/utility/reprice-algo/v1/repricer-rule-helper.ts`

| Function | Line | Sync/Async | Clones Input? | Parameters |
|----------|------|------------|---------------|------------|
| `ApplyRule` | 11 | sync | No (mutates) | `(repriceResult: any, ruleIdentifier: number, isNcNeeded?: boolean, net32Details?: Net32Product)` |
| `ApplyMultiPriceBreakRule` | 74 | sync | Yes (cloneDeep) | `(repriceResult: RepriceModel)` |
| `ApplySuppressPriceBreakRule` | 121 | sync | Yes (cloneDeep) | `(repriceResult: RepriceModel, minQty: number, isOverrideEnabled: boolean)` |
| `ApplyBeatQPriceRule` | 141 | sync | No (mutates) | `(repriceResult: RepriceModel)` |
| `ApplyPercentagePriceRule` | 161 | sync | No (mutates) | `(repriceResult: RepriceModel, percentage: number)` |
| `ApplyDeactivateQPriceBreakRule` | 189 | sync | Yes (cloneDeep) | `(repriceResult: RepriceModel, abortDeactivatingQPriceBreak: boolean)` |
| `ApplyBuyBoxRule` | 209 | sync | Yes (cloneDeep) | `(repriceResult: RepriceModel, net32Result: Net32Product[])` |
| `ApplyFloorCheckRule` | 238 | sync | No (mutates) | `(repriceResult: RepriceModel, floorPrice: number)` |
| `ApplyKeepPositionLogic` | 260 | sync | Yes (cloneDeep) | `(repriceResult: RepriceModel, net32Result: Net32Product[], ownVendorId: string)` |
| `AppendNewPriceBreakActivation` | 308 | sync | No (mutates) | `(repriceResult: RepriceModel): RepriceModel` |
| `ApplyRepriceDownBadgeCheckRule` | 329 | **async** | No (mutates) | `(repriceResult: RepriceModel, net32Result: any[], productItem: FrontierProduct, badgePercentageDown: number): Promise<RepriceModel>` |
| `ApplySisterComparisonCheck` | 416 | **async** | Yes (cloneDeep) | `(repriceResult: any, net32Result: Net32Product[], productItem: FrontierProduct): Promise<RepriceModel>` |
| `OverrideRepriceResultForExpressCron` | 489 | sync | No (mutates) | `(repriceResult: any): any` |
| `AlignIsRepriced` | 507 | **async** | No (mutates) | `(repriceResult: any)` |
| `ApplyMaxPriceCheck` | 527 | **async** | Yes (cloneDeep) | `(repriceResult: any, productItem: FrontierProduct): Promise<RepriceModel>` |

### Secondary: shared.ts

**Path:** `apps/api-core/src/utility/reprice-algo/v1/shared.ts`

| Function | Line | Sync/Async | Parameters |
|----------|------|------------|------------|
| `isPriceUpdateRequired` | 10 | sync | `(repriceResult: RepriceModel, isRepriceOn: boolean)` |
| `notQ2VsQ1` | 45 | sync | `(minQty: number, compareWithQ1: boolean)` |
| `MinQtyPricePresent` | 74 | sync | `(priceBreaks: Net32PriceBreak[], minQty: number)` |
| `getIsFloorReached` | 85 | async | `(repricerDetails: RepriceData)` |
| `getPriceStepValue` | 92 | async | `(repricerDetails: any)` |

### Enums Referenced in Tests

**RepriceMessageEnum** (`apps/api-core/src/model/reprice-message.ts`):
- `IGNORED_PRODUCT_SETTING_RULE_ONLY_UP` = `"IGNORED: Price up only #DOWN"`
- `IGNORED_PRODUCT_SETTING_RULE_ONLY_DOWN` = `"IGNORED: Price down only #UP"`
- `IGNORE_LOGIC_FAULT` = `"IGNORE : Logical Error.Suggested Price Below Floor #LOGICALERROR"`
- `IGNORED_ONE_QTY_SETTING` = `"IGNORED: Suggested Price is Ignored for Other Price Break as there is no Change to MinQty #1 price break"`
- `BEAT_Q_PRICE` = `"Suggested Price is Ignored for MinQty #1 & Repricing logic applied to Other Price Break as BEAT_Q_PRICE is Set to True"`
- `BEAT_Q_PRICE_1` = `"Suggested Price is Ignored for MinQty #1 as BEAT_Q_PRICE is Set to True"`
- `IGNORED_PERCENTAGE_CHECK` = `"IGNORED: Suggested Price is less than the Percentage Price Up Allowed"`

**RepriceRenewedMessageEnum** (`apps/api-core/src/model/reprice-renewed-message.ts`):
- `IGNORED_FLOOR_REACHED` = `"IGNORE :#HitFloor"`
- `PRICE_UP_SECOND_FLOOR_HIT` = `"CHANGE: #HitFloor Competed to 2nd lowest"`
- `IGNORE_BUY_BOX` = `"IGNORE : #HasBuyBox"`
- `IGNORE_KEEP_POSITION` = `"IGNORE : #KeepPosition"`
- `SHUT_DOWN_NO_COMPETITOR` = `"CHANGE: QBreak made Inactive -no competitor"`
- `SHUT_DOWN_FLOOR_REACHED` = `"CHANGE: QBreak made Inactive #Hitfloor"`
- `IGNORE_LOWEST_PRICE_BREAK` = `"IGNORE :#otherbreakslower"`
- `PRICE_UP_SECOND` = `"CHANGE: 2nd lowest validated"`
- `IGNORED_ABORT_Q_DEACTIVATION` = `"IGNORE: Deactivate IGNORE #SupressQbreakrule"`

### Constants

**OFFSET** (from `apps/api-core/src/utility/config.ts`): Default `0.01`. Used in `ApplySisterComparisonCheck`.

---

## 3. Shared Setup

### Import Paths

All test files live at:
```
apps/api-core/src/utility/reprice-algo/__tests__/v1/rules/
```

Relative import paths from that directory:

```typescript
// Rule functions under test
import {
  ApplyRule,
  ApplyMultiPriceBreakRule,
  ApplySuppressPriceBreakRule,
  ApplyBeatQPriceRule,
  ApplyPercentagePriceRule,
  ApplyDeactivateQPriceBreakRule,
  ApplyBuyBoxRule,
  ApplyFloorCheckRule,
  ApplyKeepPositionLogic,
  AppendNewPriceBreakActivation,
  ApplyRepriceDownBadgeCheckRule,
  ApplySisterComparisonCheck,
  OverrideRepriceResultForExpressCron,
  AlignIsRepriced,
  ApplyMaxPriceCheck,
} from '../../../v1/repricer-rule-helper';

// Models
import { RepriceModel, RepriceData } from '../../../../../../model/reprice-model';

// Enums
import { RepriceMessageEnum } from '../../../../../../model/reprice-message';
import { RepriceRenewedMessageEnum } from '../../../../../../model/reprice-renewed-message';

// Types
import { Net32Product, Net32PriceBreak } from '../../../../../../types/net32';
import { FrontierProduct } from '../../../../../../types/frontier';

// Shared utilities
import {
  isPriceUpdateRequired,
  notQ2VsQ1,
  MinQtyPricePresent,
  getIsFloorReached,
  getPriceStepValue,
} from '../../../v1/shared';

// Builders (from Layer 0)
import { aRepriceModel, makeRepriceData } from '../../infrastructure/builders/reprice-model.builder';
import { aNet32Product } from '../../infrastructure/builders/net32-product.builder';
import { aProduct } from '../../infrastructure/builders/frontier-product.builder';

// Custom matchers (from Layer 0)
import '../../infrastructure/matchers/pricing.matchers';
```

### Mocking Strategy

**Pure functions (no mocks needed):** `ApplyRule`, `ApplyMultiPriceBreakRule`, `ApplySuppressPriceBreakRule`, `ApplyBeatQPriceRule`, `ApplyPercentagePriceRule`, `ApplyDeactivateQPriceBreakRule`, `ApplyBuyBoxRule`, `ApplyFloorCheckRule`, `ApplyKeepPositionLogic`, `AppendNewPriceBreakActivation`, `OverrideRepriceResultForExpressCron`, `AlignIsRepriced`.

**Needs mock for `globalParam.GetInfo`:** `ApplyRepriceDownBadgeCheckRule`, `ApplySisterComparisonCheck`.

**Needs mock for `applicationConfig`:** `ApplySisterComparisonCheck` (uses `applicationConfig.OFFSET`).

**Needs mock for `filterMapper.FilterBasedOnParams`:** `ApplyRepriceDownBadgeCheckRule` (calls it internally).

**`ApplyMaxPriceCheck`** is pure despite being async -- it does not call any external services.

Mock declarations for files that need them:

```typescript
// For sister-comparison.test.ts and badge-percentage-down.test.ts
jest.mock('../../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '17357',
    EXCLUDED_VENDOR_ID: '20722;20755',
  }),
}));

// For badge-percentage-down.test.ts only
jest.mock('../../../../filter-mapper', () => ({
  FilterBasedOnParams: jest.fn(),
}));

// For sister-comparison.test.ts only
jest.mock('../../../../config', () => ({
  applicationConfig: {
    OFFSET: 0.01,
  },
}));
```

### Builder Quick Reference

From Layer 0 (see `docs/testing/00-setup.md`), the builders provide:

- `aRepriceModel()` -- builds `RepriceModel`. Key methods: `.withOldPrice(n)`, `.withNewPrice(n)`, `.withExplained(s)`, `.withGoToPrice(n)`, `.withPriceBreak({minQty, oldPrice, newPrice, isRepriced, active, explained, goToPrice})`, `.build()`
- `aNet32Product()` -- builds `Net32Product`. Key methods: `.vendorId(n)`, `.vendorName(s)`, `.unitPrice(price, minQty)`, `.priceBreaks([...])`, `.badge(id, name)`, `.shipping(cost)`, `.threshold(value)`, `.asOwnVendor()`, `.asSister()`, `.build()`
- `aProduct()` -- builds `FrontierProduct`. Key methods: `.floor(n)`, `.maxPrice(n)`, `.unitPrice(n)`, `.rule(n)`, `.ncMode()`, `.ownVendorId(s)`, `.sisterVendorId(s)`, `.badgePercentageDown(n)`, `.build()`
- `makeRepriceData({oldPrice, newPrice, isRepriced, explained, minQty, active, goToPrice})` -- builds a `RepriceData` with exact control over field values (bypasses constructor formatting).

---

## 4. Test File: direction-rule.test.ts

**File:** `__tests__/v1/rules/direction-rule.test.ts`

**Function under test:** `ApplyRule` (line 11 of `repricer-rule-helper.ts`)

**Signature:** `ApplyRule(repriceResult: any, ruleIdentifier: number, isNcNeeded?: boolean, net32Details?: Net32Product)`

**Business logic:** Enforces directional repricing constraints.
- `ruleIdentifier = -1` or `2` (Both): No-op, returns as-is.
- `ruleIdentifier = 0` (Only Up): If `newPrice < oldPrice`, blocks the reprice (sets `newPrice="N/A"`, `isRepriced=false`). For NC mode (`isNcNeeded=true`), compares against the NC-calculated price (unit price + shipping if below threshold) instead of `oldPrice`.
- `ruleIdentifier = 1` (Only Down): If `newPrice > oldPrice` OR explained is `SHUT_DOWN_NO_COMPETITOR` or `SHUT_DOWN_FLOOR_REACHED`, blocks the reprice. Same NC mode adjustment.

**Note on a bug:** In the Only Down branch (case 1), line 52 has the condition `$.explained == RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED || RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT`. The second part is always truthy (it is a non-empty string, not a comparison). This means the `explained` append path is always taken for Only Down. Tests should reflect this actual behavior.

**Sync:** Yes.

**Clones input:** No -- mutates the input directly.

```typescript
import {
  ApplyRule,
} from '../../../v1/repricer-rule-helper';
import { RepriceModel, RepriceData } from '../../../../../../model/reprice-model';
import { RepriceMessageEnum } from '../../../../../../model/reprice-message';
import { RepriceRenewedMessageEnum } from '../../../../../../model/reprice-renewed-message';
import { aRepriceModel, makeRepriceData } from '../../infrastructure/builders/reprice-model.builder';
import { aNet32Product } from '../../infrastructure/builders/net32-product.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplyRule (direction rule)', () => {
  // ---------------------------------------------------------------
  // ruleIdentifier = -1 and 2 => no-op
  // ---------------------------------------------------------------
  describe('ruleIdentifier = -1 (Please Select) -- no-op', () => {
    it('should not modify single-break model when rule is -1', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyRule(model, -1);
      expect(result.repriceDetails!.newPrice).toBe(8);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it('should not modify multi-break model when rule is -1', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 6, isRepriced: true })
        .build();
      const result = ApplyRule(model, -1);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(8);
      expect(result.listOfRepriceDetails[1].newPrice).toBe(6);
    });
  });

  describe('ruleIdentifier = 2 (Both) -- no-op', () => {
    it('should not modify the model when rule is 2 (both directions allowed)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      const result = ApplyRule(model, 2);
      expect(result.repriceDetails!.newPrice).toBe(12);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // ruleIdentifier = 0 => Only Up
  // ---------------------------------------------------------------
  describe('ruleIdentifier = 0 (Only Up)', () => {
    it('should allow price increase (single break)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      const result = ApplyRule(model, 0);
      expect(result.repriceDetails!.newPrice).toBe(12);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it('should block price decrease (single break)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyRule(model, 0);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(8);
      expect(result.repriceDetails!.explained).toBe(
        RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_UP
      );
    });

    it('should allow equal price (single break)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10).build();
      const result = ApplyRule(model, 0);
      expect(result.repriceDetails!.newPrice).toBe(10);
    });

    it('should skip already-ignored breaks (newPrice = N/A)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice('N/A').build();
      model.repriceDetails!.isRepriced = false;
      const result = ApplyRule(model, 0);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });

    it('should block price decrease on multi-break model', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 9, isRepriced: true })
        .build();
      const result = ApplyRule(model, 0);
      // minQty=1: 8 < 10, blocked
      expect(result.listOfRepriceDetails[0].newPrice).toBe('N/A');
      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[0].goToPrice).toBe(8);
      // minQty=3: 9 > 8, allowed
      expect(result.listOfRepriceDetails[1].newPrice).toBe(9);
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(true);
    });

    it('should append to IGNORED_FLOOR_REACHED if that is the existing explained', () => {
      const model = aRepriceModel()
        .withOldPrice(10)
        .withNewPrice(8)
        .withExplained(RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED)
        .build();
      const result = ApplyRule(model, 0);
      expect(result.repriceDetails!.explained).toBe(
        RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED +
          '_' +
          RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_UP
      );
    });

    describe('NC mode (isNcNeeded = true)', () => {
      it('should compare against NC-calculated price when below threshold', () => {
        // net32Details: unitPrice=10, standardShipping=5, freeShippingThreshold=50
        // NC-calculated price = 10 + 5 = 15 (since 10 < 50)
        // newPrice=12 < 15, so block
        const net32 = aNet32Product()
          .unitPrice(10)
          .shipping(5)
          .threshold(50)
          .build();
        const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
        const result = ApplyRule(model, 0, true, net32);
        expect(result.repriceDetails!.newPrice).toBe('N/A');
        expect(result.repriceDetails!.isRepriced).toBe(false);
      });

      it('should compare against unit price when above threshold', () => {
        // net32Details: unitPrice=60, standardShipping=5, freeShippingThreshold=50
        // NC-calculated price = 60 (since 60 >= 50, no shipping added)
        // newPrice=65 > 60, allowed
        const net32 = aNet32Product()
          .unitPrice(60)
          .shipping(5)
          .threshold(50)
          .build();
        const model = aRepriceModel().withOldPrice(60).withNewPrice(65).build();
        const result = ApplyRule(model, 0, true, net32);
        expect(result.repriceDetails!.newPrice).toBe(65);
        expect(result.repriceDetails!.isRepriced).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------
  // ruleIdentifier = 1 => Only Down
  // ---------------------------------------------------------------
  describe('ruleIdentifier = 1 (Only Down)', () => {
    it('should allow price decrease (single break)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyRule(model, 1);
      expect(result.repriceDetails!.newPrice).toBe(8);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it('should block price increase (single break)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      const result = ApplyRule(model, 1);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(12);
    });

    it('should skip breaks with oldPrice = 0 (new break activations)', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 0, newPrice: 5, isRepriced: true })
        .build();
      const result = ApplyRule(model, 1);
      // oldPrice == 0 is skipped in Only Down
      expect(result.listOfRepriceDetails[0].newPrice).toBe(5);
    });

    it('should block SHUT_DOWN_NO_COMPETITOR explained on multi-break', () => {
      const model = aRepriceModel()
        .withPriceBreak({
          minQty: 1,
          oldPrice: 10,
          newPrice: 8,
          isRepriced: true,
          explained: RepriceRenewedMessageEnum.SHUT_DOWN_NO_COMPETITOR,
        })
        .build();
      const result = ApplyRule(model, 1);
      expect(result.listOfRepriceDetails[0].newPrice).toBe('N/A');
      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
    });

    it('should block SHUT_DOWN_FLOOR_REACHED explained on multi-break', () => {
      const model = aRepriceModel()
        .withPriceBreak({
          minQty: 1,
          oldPrice: 10,
          newPrice: 8,
          isRepriced: true,
          explained: RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED,
        })
        .build();
      const result = ApplyRule(model, 1);
      expect(result.listOfRepriceDetails[0].newPrice).toBe('N/A');
    });

    it('should allow equal price (single break)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10).build();
      const result = ApplyRule(model, 1);
      expect(result.repriceDetails!.newPrice).toBe(10);
    });

    it('should block multiple breaks independently', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 12, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 6, isRepriced: true })
        .build();
      const result = ApplyRule(model, 1);
      // minQty=1: 12 > 10, blocked
      expect(result.listOfRepriceDetails[0].newPrice).toBe('N/A');
      // minQty=3: 6 < 8, allowed
      expect(result.listOfRepriceDetails[1].newPrice).toBe(6);
    });

    describe('NC mode (isNcNeeded = true)', () => {
      it('should compare against NC-calculated price and block if increase', () => {
        const net32 = aNet32Product()
          .unitPrice(10)
          .shipping(5)
          .threshold(50)
          .build();
        // NC price = 10 + 5 = 15; newPrice=16 > 15, block
        const model = aRepriceModel().withOldPrice(10).withNewPrice(16).build();
        const result = ApplyRule(model, 1, true, net32);
        expect(result.repriceDetails!.newPrice).toBe('N/A');
      });

      it('should allow when newPrice is below NC-calculated price', () => {
        const net32 = aNet32Product()
          .unitPrice(10)
          .shipping(5)
          .threshold(50)
          .build();
        // NC price = 15; newPrice=12 < 15, allow
        const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
        const result = ApplyRule(model, 1, true, net32);
        expect(result.repriceDetails!.newPrice).toBe(12);
      });
    });
  });

  // ---------------------------------------------------------------
  // Default case
  // ---------------------------------------------------------------
  describe('unknown ruleIdentifier', () => {
    it('should do nothing for unrecognized rule values', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyRule(model, 99);
      expect(result.repriceDetails!.newPrice).toBe(8);
    });
  });
});
```

---

## 5. Test File: floor-check.test.ts

**File:** `__tests__/v1/rules/floor-check.test.ts`

**Function under test:** `ApplyFloorCheckRule` (line 238)

**Signature:** `ApplyFloorCheckRule(repriceResult: RepriceModel, floorPrice: number)`

**Business logic:** Blocks any repricing where the suggested `newPrice` is at or below the `floorPrice`. Sets `newPrice="N/A"`, `isRepriced=false`, and `explained=IGNORE_LOGIC_FAULT`. Skips entries where `active === false && active === 0` (deactivated price breaks). Works on both single-break and multi-break models.

**Sync:** Yes. **Clones:** No (mutates input directly).

**Important detail:** The condition `$.active == false && $.active === 0` requires BOTH to be true. Due to JS coercion, `false == false` is true and `false === 0` is false, so a break with `active = false` (boolean) is NOT skipped. Only `active = 0` (numeric zero) satisfies both conditions. This matters for test design.

```typescript
import { ApplyFloorCheckRule } from '../../../v1/repricer-rule-helper';
import { RepriceMessageEnum } from '../../../../../../model/reprice-message';
import { aRepriceModel, makeRepriceData } from '../../infrastructure/builders/reprice-model.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplyFloorCheckRule', () => {
  describe('single-break model', () => {
    it('should block when newPrice equals floorPrice', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(5).build();
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(5);
      expect(result.repriceDetails!.explained).toBe(RepriceMessageEnum.IGNORE_LOGIC_FAULT);
    });

    it('should block when newPrice is below floorPrice', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(3).build();
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
      expect(result.repriceDetails!.isRepriced).toBe(false);
    });

    it('should allow when newPrice is above floorPrice', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(6).build();
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.repriceDetails!.newPrice).toBe(6);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it('should allow when floorPrice is 0 and newPrice is positive', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(0.50).build();
      const result = ApplyFloorCheckRule(model, 0);
      expect(result.repriceDetails!.newPrice).toBe(0.50);
    });

    it('should block when floorPrice is 0 and newPrice is 0', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(0).build();
      const result = ApplyFloorCheckRule(model, 0);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });
  });

  describe('multi-break model', () => {
    it('should block only the break below floor', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 6, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 4, isRepriced: true })
        .build();
      const result = ApplyFloorCheckRule(model, 5);
      // minQty=1: 6 > 5, allowed
      expect(result.listOfRepriceDetails[0].newPrice).toBe(6);
      // minQty=3: 4 < 5, blocked
      expect(result.listOfRepriceDetails[1].newPrice).toBe('N/A');
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(false);
    });

    it('should skip deactivated break (active=0)', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 3, isRepriced: true, active: false })
        .build();
      // Set active to numeric 0 to satisfy the `$.active == false && $.active === 0` condition
      model.listOfRepriceDetails[0].active = 0 as unknown as boolean;
      const result = ApplyFloorCheckRule(model, 5);
      // Should be skipped (deactivated), not blocked
      expect(result.listOfRepriceDetails[0].newPrice).toBe(3);
    });

    it('should NOT skip break with active=false (boolean), only active=0 (numeric)', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 3, isRepriced: true, active: false })
        .build();
      // active is boolean false, not numeric 0
      // The condition `$.active == false && $.active === 0` => (true && false) => false
      // So the break is NOT skipped; it gets checked against floor
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.listOfRepriceDetails[0].newPrice).toBe('N/A');
    });
  });

  describe('edge cases', () => {
    it('should handle negative floor price', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(0.01).build();
      const result = ApplyFloorCheckRule(model, -1);
      expect(result.repriceDetails!.newPrice).toBe(0.01);
    });

    it('should handle when repriceDetails newPrice is already N/A (single break)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice('N/A').build();
      model.repriceDetails!.isRepriced = false;
      // 'N/A' <= 5 is false (string comparison), so it should not be blocked again
      const result = ApplyFloorCheckRule(model, 5);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });
  });
});
```

---

## 6. Test File: max-price-check.test.ts

**File:** `__tests__/v1/rules/max-price-check.test.ts`

**Function under test:** `ApplyMaxPriceCheck` (line 527)

**Signature:** `async ApplyMaxPriceCheck(repriceResult: any, productItem: FrontierProduct): Promise<RepriceModel>`

**Business logic:** Only applies to **single-break** models where `repriceDetails.newPrice === "N/A"` (i.e., the reprice was previously blocked). If the existing price (adjusted for NC shipping) exceeds the max allowed price AND the max price is above the floor price, it sets `newPrice` to the max price (adjusted for NC). Replaces "IGNORE" with "CHANGE" in the explained string and appends `_#MAXPRICEAPPLIED`.

**Async:** Yes (but no external calls -- safe to test without mocks).

**Clones:** Yes (`_.cloneDeep`).

**Internal helper used:** `calculatePriceWithNcContext(contextPrice, productItem, type)` -- adds or subtracts shipping if `productItem.is_nc_needed` is true. `GetShippingPrice(item)` returns shipping charge only if unit price is below `freeShippingThreshold`.

**Important:** The function calls `GetShippingPrice(productItem)` which expects `productItem` to have `priceBreaks` and `freeShippingThreshold`. Since `FrontierProduct` does not have these fields, `GetShippingPrice` returns 0, meaning `calculatePriceWithNcContext` effectively returns the input price for non-NC products. For NC mode, tests would need to set these properties on the `productItem`.

```typescript
import { ApplyMaxPriceCheck } from '../../../v1/repricer-rule-helper';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import { aProduct } from '../../infrastructure/builders/frontier-product.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplyMaxPriceCheck', () => {
  describe('when repriceDetails.newPrice is N/A', () => {
    it('should apply max price when existing price exceeds max and max > floor', async () => {
      const model = aRepriceModel()
        .withOldPrice(25)
        .withNewPrice('N/A')
        .withExplained('IGNORE: some reason')
        .build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.newPrice).toBe('20.00');
      expect(result.repriceDetails!.explained).toContain('CHANGE');
      expect(result.repriceDetails!.explained).toContain('_#MAXPRICEAPPLIED');
    });

    it('should replace IGNORE with CHANGE in explained', async () => {
      const model = aRepriceModel()
        .withOldPrice(25)
        .withNewPrice('N/A')
        .withExplained('IGNORE: too high')
        .build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.explained).not.toContain('IGNORE');
      expect(result.repriceDetails!.explained).toContain('CHANGE');
    });

    it('should NOT apply when existing price is below max', async () => {
      const model = aRepriceModel()
        .withOldPrice(15)
        .withNewPrice('N/A')
        .withExplained('IGNORE: some reason')
        .build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });

    it('should NOT apply when max price is below floor price', async () => {
      const model = aRepriceModel()
        .withOldPrice(25)
        .withNewPrice('N/A')
        .withExplained('IGNORE: some reason')
        .build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(3).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });

    it('should NOT apply when max price equals floor price', async () => {
      const model = aRepriceModel()
        .withOldPrice(25)
        .withNewPrice('N/A')
        .withExplained('IGNORE: some reason')
        .build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(5).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });
  });

  describe('when repriceDetails.newPrice is NOT N/A', () => {
    it('should not modify the result (function only acts on N/A)', async () => {
      const model = aRepriceModel()
        .withOldPrice(10)
        .withNewPrice(8)
        .withExplained('CHANGE: something')
        .build();
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(result.repriceDetails!.newPrice).toBe(8);
    });
  });

  describe('when repriceDetails is null (multi-break model)', () => {
    it('should return unmodified (function only checks repriceDetails)', async () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 25, newPrice: 'N/A', isRepriced: false })
        .build();
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      // repriceDetails is null for multi-break, so function returns early
      expect(result.listOfRepriceDetails[0].newPrice).toBe('N/A');
    });
  });

  describe('cloning behavior', () => {
    it('should not mutate the original model', async () => {
      const model = aRepriceModel()
        .withOldPrice(25)
        .withNewPrice('N/A')
        .withExplained('IGNORE: test')
        .build();
      model.repriceDetails!.isRepriced = false;
      const product = aProduct().maxPrice(20).floor(5).build();

      const result = await ApplyMaxPriceCheck(model, product);

      expect(model.repriceDetails!.newPrice).toBe('N/A');
      expect(result.repriceDetails!.newPrice).toBe('20.00');
    });
  });
});
```

---

## 7. Test File: multi-price-break.test.ts

**File:** `__tests__/v1/rules/multi-price-break.test.ts`

**Function under test:** `ApplyMultiPriceBreakRule` (line 74)

**Signature:** `ApplyMultiPriceBreakRule(repriceResult: RepriceModel)`

**Business logic:** Enforces the invariant that higher-quantity breaks must have lower prices than lower-quantity breaks. Iterates from highest minQty to lowest. For each non-Q1 break, compares its effective price (newPrice if not N/A, else oldPrice) against all lower-minQty breaks. If the higher-Q break price >= any lower-Q break price (and the lower break price is not 0), the break is suppressed:
- If the break's `explained` is `PRICE_UP_SECOND`: deactivates it (sets `newPrice=0`, `active=0`, appends `SHUT_DOWN_FLOOR_REACHED`).
- Otherwise: ignores it (`newPrice="N/A"`, `isRepriced=false`, appends `IGNORE_LOWEST_PRICE_BREAK`).
- Breaks with `oldPrice=0` and `newPrice="N/A"` are removed entirely.
- Q1 breaks are always kept.

**Sync:** Yes. **Clones:** Yes (`_.cloneDeep`).

```typescript
import { ApplyMultiPriceBreakRule } from '../../../v1/repricer-rule-helper';
import { RepriceRenewedMessageEnum } from '../../../../../../model/reprice-renewed-message';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplyMultiPriceBreakRule', () => {
  it('should keep all breaks when higher-Q breaks have lower prices', () => {
    const model = aRepriceModel()
      .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
      .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8, isRepriced: true })
      .withPriceBreak({ minQty: 6, oldPrice: 6, newPrice: 6, isRepriced: true })
      .build();
    const result = ApplyMultiPriceBreakRule(model);
    expect(result.listOfRepriceDetails).toHaveLength(3);
    expect(result.listOfRepriceDetails[0].newPrice).toBe(10);
    expect(result.listOfRepriceDetails[1].newPrice).toBe(8);
    expect(result.listOfRepriceDetails[2].newPrice).toBe(6);
  });

  it('should suppress higher-Q break when its price >= lower-Q break price', () => {
    const model = aRepriceModel()
      .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true })
      .withPriceBreak({ minQty: 3, oldPrice: 9, newPrice: 9, isRepriced: true })
      .build();
    // Q3 newPrice=9 >= Q1 newPrice=8, so Q3 is suppressed
    const result = ApplyMultiPriceBreakRule(model);
    expect(result.listOfRepriceDetails).toHaveLength(2);
    const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
    expect(q3!.newPrice).toBe('N/A');
    expect(q3!.isRepriced).toBe(false);
  });

  it('should deactivate break when explained is PRICE_UP_SECOND and price is violated', () => {
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
    const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
    expect(q3!.newPrice).toBe(0);
    expect(q3!.active).toBe(0);
    expect(q3!.isRepriced).toBe(true);
    expect(q3!.explained).toContain(RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED);
  });

  it('should always keep Q1 break regardless of price', () => {
    const model = aRepriceModel()
      .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 50, isRepriced: true })
      .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 6, isRepriced: true })
      .build();
    const result = ApplyMultiPriceBreakRule(model);
    const q1 = result.listOfRepriceDetails.find(d => d.minQty === 1);
    expect(q1!.newPrice).toBe(50);
  });

  it('should use oldPrice when newPrice is N/A for comparison', () => {
    const model = aRepriceModel()
      .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 'N/A', isRepriced: false })
      .withPriceBreak({ minQty: 3, oldPrice: 11, newPrice: 'N/A', isRepriced: false })
      .build();
    // Q3 oldPrice=11 >= Q1 oldPrice=10, so Q3 is suppressed
    const result = ApplyMultiPriceBreakRule(model);
    const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
    expect(q3!.explained).toContain(RepriceRenewedMessageEnum.IGNORE_LOWEST_PRICE_BREAK);
  });

  it('should remove breaks with oldPrice=0 and newPrice=N/A after suppression', () => {
    const model = aRepriceModel()
      .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true })
      .withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 'N/A', isRepriced: false })
      .build();
    const result = ApplyMultiPriceBreakRule(model);
    // The Q3 break with oldPrice=0 should not appear in the result
    // since it fails the oldPrice !== 0 check
    expect(result.listOfRepriceDetails.every(d => d.minQty !== 3 || d.oldPrice !== 0 || d.newPrice !== 'N/A')).toBe(true);
  });

  it('should keep new break activation (oldPrice=0, newPrice != N/A)', () => {
    const model = aRepriceModel()
      .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
      .withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 5, isRepriced: true })
      .build();
    const result = ApplyMultiPriceBreakRule(model);
    const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
    expect(q3).toBeDefined();
    expect(q3!.newPrice).toBe(5);
  });

  it('should sort output by minQty ascending', () => {
    const model = aRepriceModel()
      .withPriceBreak({ minQty: 6, oldPrice: 5, newPrice: 5, isRepriced: true })
      .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
      .withPriceBreak({ minQty: 3, oldPrice: 7, newPrice: 7, isRepriced: true })
      .build();
    const result = ApplyMultiPriceBreakRule(model);
    const qtys = result.listOfRepriceDetails.map(d => d.minQty);
    expect(qtys).toEqual([1, 3, 6]);
  });

  it('should not mutate the original model', () => {
    const model = aRepriceModel()
      .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true })
      .withPriceBreak({ minQty: 3, oldPrice: 9, newPrice: 9, isRepriced: true })
      .build();
    const originalQ3Price = model.listOfRepriceDetails.find(d => d.minQty === 3)!.newPrice;
    ApplyMultiPriceBreakRule(model);
    expect(model.listOfRepriceDetails.find(d => d.minQty === 3)!.newPrice).toBe(originalQ3Price);
  });

  it('should handle single-break model (no listOfRepriceDetails)', () => {
    const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
    const result = ApplyMultiPriceBreakRule(model);
    // Should return cloned model unchanged
    expect(result.repriceDetails).toBeDefined();
  });

  it('should skip comparison with lower breaks that have price 0', () => {
    const model = aRepriceModel()
      .withPriceBreak({ minQty: 1, oldPrice: 0, newPrice: 'N/A', isRepriced: false })
      .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true })
      .build();
    // Q1 comparablePrice=0, so `sourcePrice >= 0 && 0 !== 0` fails
    // Q3 should be kept
    const result = ApplyMultiPriceBreakRule(model);
    const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
    expect(q3!.newPrice).toBe(7);
  });
});
```

---

## 8. Test File: buy-box.test.ts

**File:** `__tests__/v1/rules/buy-box.test.ts`

**Function under test:** `ApplyBuyBoxRule` (line 209)

**Signature:** `ApplyBuyBoxRule(repriceResult: RepriceModel, net32Result: Net32Product[])`

**Business logic:** When a product's price is going DOWN (newPrice < oldPrice), checks if the first vendor in the net32 result list is one of the "own" vendor IDs (`contextVendorIds = ["17357", "20722", "20755", "20533", "20727", "5"]`). If it is, the reprice is blocked because we already have the buy box. The `explained` is set to `IGNORE_BUY_BOX`. Only acts on breaks where `oldPrice != 0` and `newPrice != "N/A"`.

**Sync:** Yes. **Clones:** Yes (`_.cloneDeep`).

```typescript
import { ApplyBuyBoxRule } from '../../../v1/repricer-rule-helper';
import { RepriceRenewedMessageEnum } from '../../../../../../model/reprice-renewed-message';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import { aNet32Product } from '../../infrastructure/builders/net32-product.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplyBuyBoxRule', () => {
  const ownVendorIds = ['17357', '20722', '20755', '20533', '20727', '5'];

  describe('single-break model', () => {
    it('should block price decrease when first vendor is own vendor (17357)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const net32 = [
        aNet32Product().vendorId(17357).unitPrice(10).build(),
        aNet32Product().vendorId(99999).unitPrice(7).build(),
      ];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(8);
      expect(result.repriceDetails!.explained).toBe(RepriceRenewedMessageEnum.IGNORE_BUY_BOX);
    });

    it('should block price decrease when first vendor is sister vendor (20722)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const net32 = [aNet32Product().vendorId(20722).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });

    it('should allow price decrease when first vendor is external', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const net32 = [
        aNet32Product().vendorId(99999).unitPrice(7).build(),
        aNet32Product().vendorId(17357).unitPrice(10).build(),
      ];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe(8);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it('should allow price increase even when first vendor is own vendor', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      const net32 = [aNet32Product().vendorId(17357).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe(12);
    });

    it('should skip when newPrice is N/A', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice('N/A').build();
      model.repriceDetails!.isRepriced = false;
      const net32 = [aNet32Product().vendorId(17357).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });

    it('should skip when oldPrice is 0', () => {
      const model = aRepriceModel().withOldPrice(0).withNewPrice(5).build();
      model.repriceDetails!.oldPrice = 0;
      const net32 = [aNet32Product().vendorId(17357).build()];
      const result = ApplyBuyBoxRule(model, net32);
      expect(result.repriceDetails!.newPrice).toBe(5);
    });

    it('should handle empty net32 result list', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyBuyBoxRule(model, []);
      // _.first([]) returns undefined, so the condition fails
      expect(result.repriceDetails!.newPrice).toBe(8);
    });
  });

  describe('multi-break model', () => {
    it('should block only decreasing breaks when first vendor is own vendor', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 9, isRepriced: true })
        .build();
      const net32 = [aNet32Product().vendorId(17357).build()];
      const result = ApplyBuyBoxRule(model, net32);
      // Q1: 8 < 10, blocked
      expect(result.listOfRepriceDetails[0].newPrice).toBe('N/A');
      // Q3: 9 > 8, not a decrease, allowed
      expect(result.listOfRepriceDetails[1].newPrice).toBe(9);
    });
  });

  describe('vendor ID matching', () => {
    it.each(ownVendorIds.map(id => [id]))(
      'should block when first vendor ID is %s',
      (vendorId) => {
        const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
        const net32 = [aNet32Product().vendorId(parseInt(vendorId)).build()];
        const result = ApplyBuyBoxRule(model, net32);
        expect(result.repriceDetails!.newPrice).toBe('N/A');
      }
    );
  });

  describe('cloning behavior', () => {
    it('should not mutate the original model', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const net32 = [aNet32Product().vendorId(17357).build()];
      ApplyBuyBoxRule(model, net32);
      expect(model.repriceDetails!.newPrice).toBe(8);
    });
  });
});
```

---

## 9. Test File: keep-position.test.ts

**File:** `__tests__/v1/rules/keep-position.test.ts`

**Function under test:** `ApplyKeepPositionLogic` (line 260)

**Signature:** `ApplyKeepPositionLogic(repriceResult: RepriceModel, net32Result: Net32Product[], ownVendorId: string)`

**Business logic:** When a price is going DOWN (newPrice < oldPrice), checks the vendor ranking in the net32 results. Finds the position of the own vendor (by vendorId) and the position of the lowest vendor (by `lowestVendor` name match). If the lowest vendor is ranked BELOW the own vendor (evalVendorIndex > ownVendorIndex), the reprice is blocked -- we should keep our higher position rather than lowering to match a vendor ranked below us. The `explained` is set to `IGNORE_KEEP_POSITION`.

**Sync:** Yes. **Clones:** Yes (`_.cloneDeep`).

**Important:** The function uses `_.findIndex` with `{ vendorId: ownVendorId }` first as-is, and if that returns -1, tries `.toString()`. The lowest vendor lookup uses `{ vendorName: $.lowestVendor }`.

```typescript
import { ApplyKeepPositionLogic } from '../../../v1/repricer-rule-helper';
import { RepriceRenewedMessageEnum } from '../../../../../../model/reprice-renewed-message';
import { aRepriceModel, makeRepriceData } from '../../infrastructure/builders/reprice-model.builder';
import { aNet32Product } from '../../infrastructure/builders/net32-product.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplyKeepPositionLogic', () => {
  describe('single-break model', () => {
    it('should block when lowest vendor is ranked below own vendor', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      model.repriceDetails!.lowestVendor = 'CheapVendor';

      const net32 = [
        aNet32Product().vendorId(17357).vendorName('Tradent').unitPrice(10).build(),
        aNet32Product().vendorId(99999).vendorName('CheapVendor').unitPrice(7).build(),
      ];
      // ownVendorIndex=0, evalVendorIndex=1 => 1 > 0 => block
      const result = ApplyKeepPositionLogic(model, net32, '17357');

      expect(result.repriceDetails!.newPrice).toBe('N/A');
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(8);
      expect(result.repriceDetails!.explained).toBe(RepriceRenewedMessageEnum.IGNORE_KEEP_POSITION);
    });

    it('should allow when lowest vendor is ranked above own vendor', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      model.repriceDetails!.lowestVendor = 'TopVendor';

      const net32 = [
        aNet32Product().vendorId(88888).vendorName('TopVendor').unitPrice(7).build(),
        aNet32Product().vendorId(17357).vendorName('Tradent').unitPrice(10).build(),
      ];
      // ownVendorIndex=1, evalVendorIndex=0 => 0 > 1 is false => allow
      const result = ApplyKeepPositionLogic(model, net32, '17357');

      expect(result.repriceDetails!.newPrice).toBe(8);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it('should allow price increase regardless of position', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      model.repriceDetails!.lowestVendor = 'CheapVendor';

      const net32 = [
        aNet32Product().vendorId(17357).vendorName('Tradent').build(),
        aNet32Product().vendorId(99999).vendorName('CheapVendor').build(),
      ];
      const result = ApplyKeepPositionLogic(model, net32, '17357');

      expect(result.repriceDetails!.newPrice).toBe(12);
    });

    it('should skip when newPrice is N/A', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice('N/A').build();
      model.repriceDetails!.isRepriced = false;

      const net32 = [aNet32Product().vendorId(17357).build()];
      const result = ApplyKeepPositionLogic(model, net32, '17357');

      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });

    it('should skip when oldPrice is 0', () => {
      const model = aRepriceModel().withOldPrice(0).withNewPrice(5).build();
      model.repriceDetails!.oldPrice = 0;

      const net32 = [aNet32Product().vendorId(17357).build()];
      const result = ApplyKeepPositionLogic(model, net32, '17357');

      expect(result.repriceDetails!.newPrice).toBe(5);
    });

    it('should handle own vendor not found in net32 list (ownVendorIndex = -1)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      model.repriceDetails!.lowestVendor = 'SomeVendor';

      const net32 = [
        aNet32Product().vendorId(99999).vendorName('SomeVendor').build(),
      ];
      // ownVendorIndex = -1 (tries both numeric and string match)
      // evalVendorIndex = 0; 0 > -1 => block
      const result = ApplyKeepPositionLogic(model, net32, '17357');

      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });
  });

  describe('multi-break model', () => {
    it('should block only decreasing breaks where vendor is ranked below', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 9, isRepriced: true })
        .build();
      model.listOfRepriceDetails[0].lowestVendor = 'LowerVendor';
      model.listOfRepriceDetails[1].lowestVendor = 'LowerVendor';

      const net32 = [
        aNet32Product().vendorId(17357).vendorName('Tradent').build(),
        aNet32Product().vendorId(99999).vendorName('LowerVendor').build(),
      ];

      const result = ApplyKeepPositionLogic(model, net32, '17357');
      // Q1: 8 < 10, decrease, vendor below => block
      expect(result.listOfRepriceDetails[0].newPrice).toBe('N/A');
      // Q3: 9 > 8, increase => skip check
      expect(result.listOfRepriceDetails[1].newPrice).toBe(9);
    });
  });

  describe('cloning behavior', () => {
    it('should not mutate the original model', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      model.repriceDetails!.lowestVendor = 'CheapVendor';
      const net32 = [
        aNet32Product().vendorId(17357).vendorName('Tradent').build(),
        aNet32Product().vendorId(99999).vendorName('CheapVendor').build(),
      ];
      ApplyKeepPositionLogic(model, net32, '17357');
      expect(model.repriceDetails!.newPrice).toBe(8);
    });
  });
});
```

---

## 10. Test File: suppress-price-break.test.ts

**File:** `__tests__/v1/rules/suppress-price-break.test.ts`

**Function under test:** `ApplySuppressPriceBreakRule` (line 121)

**Signature:** `ApplySuppressPriceBreakRule(repriceResult: RepriceModel, minQty: number, isOverrideEnabled: boolean)`

**Business logic:** Suppresses repricing on non-target quantity breaks unless the target break (identified by `minQty` param, typically 1) has actually changed. Uses `validateQtyReprice()` to check if the target break changed. If the target break did NOT change (`isOneQtyChanged=false`), then all other breaks that have a new price different from their old price are blocked (`newPrice="N/A"`, `explained=IGNORED_ONE_QTY_SETTING`). When `isOverrideEnabled=true`, breaks with `oldPrice=0` are first removed, and `validateQtyReprice` always returns true (so no suppression happens). After suppression, breaks with both `newPrice="N/A"` and `oldPrice=0` are removed.

**Sync:** Yes. **Clones:** Yes (`_.cloneDeep`).

```typescript
import { ApplySuppressPriceBreakRule } from '../../../v1/repricer-rule-helper';
import { RepriceMessageEnum } from '../../../../../../model/reprice-message';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplySuppressPriceBreakRule', () => {
  describe('when Q1 has changed', () => {
    it('should allow all breaks when Q1 changed', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 9, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true })
        .build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(9);
      expect(result.listOfRepriceDetails[1].newPrice).toBe(7);
    });
  });

  describe('when Q1 has NOT changed', () => {
    it('should suppress other breaks that changed', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true })
        .build();
      // Q1 newPrice=10 == oldPrice=10, so Q1 didn't change
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(10); // Q1 untouched
      expect(result.listOfRepriceDetails[1].newPrice).toBe('N/A'); // Q3 suppressed
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[1].explained).toBe(RepriceMessageEnum.IGNORED_ONE_QTY_SETTING);
    });

    it('should allow other breaks that did NOT change', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8, isRepriced: true })
        .build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      // Q3 newPrice=8 == oldPrice=8, no change, so not suppressed
      expect(result.listOfRepriceDetails[1].newPrice).toBe(8);
    });

    it('should not suppress already-ignored breaks (newPrice = N/A)', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 'N/A', isRepriced: false })
        .build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      expect(result.listOfRepriceDetails[1].newPrice).toBe('N/A');
    });

    it('should set goToPrice when suppressing', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 6, isRepriced: true })
        .build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      expect(result.listOfRepriceDetails[1].goToPrice).toBe(6);
    });
  });

  describe('isOverrideEnabled = true', () => {
    it('should remove breaks with oldPrice=0 and allow all others', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 5, isRepriced: true })
        .withPriceBreak({ minQty: 6, oldPrice: 7, newPrice: 6, isRepriced: true })
        .build();
      const result = ApplySuppressPriceBreakRule(model, 1, true);
      // oldPrice=0 break removed; override => validateQtyReprice returns true
      // so no suppression of Q6
      const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
      expect(q3).toBeUndefined();
      const q6 = result.listOfRepriceDetails.find(d => d.minQty === 6);
      expect(q6!.newPrice).toBe(6);
    });
  });

  describe('cleanup of orphaned breaks', () => {
    it('should remove breaks with newPrice=N/A and oldPrice=0 after suppression', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 'N/A', isRepriced: false })
        .build();
      const result = ApplySuppressPriceBreakRule(model, 1, false);
      const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
      expect(q3).toBeUndefined();
    });
  });

  describe('cloning behavior', () => {
    it('should not mutate the original model', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true })
        .build();
      ApplySuppressPriceBreakRule(model, 1, false);
      expect(model.listOfRepriceDetails[1].newPrice).toBe(7);
    });
  });
});
```

---

## 11. Test File: beat-q-price.test.ts

**File:** `__tests__/v1/rules/beat-q-price.test.ts`

**Function under test:** `ApplyBeatQPriceRule` (line 141)

**Signature:** `ApplyBeatQPriceRule(repriceResult: RepriceModel)`

**Business logic:** When "beat Q price" is enabled, the system competes only on quantity breaks, not on Q1. For multi-break models: ignores the Q1 break (sets `newPrice="N/A"`, `isRepriced=false`, `explained=BEAT_Q_PRICE`), leaves other breaks untouched. For single-break models: ignores the only break with `explained=BEAT_Q_PRICE_1`.

**Sync:** Yes. **Clones:** No (mutates input directly).

```typescript
import { ApplyBeatQPriceRule } from '../../../v1/repricer-rule-helper';
import { RepriceMessageEnum } from '../../../../../../model/reprice-message';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplyBeatQPriceRule', () => {
  describe('multi-break model', () => {
    it('should suppress Q1 and leave other breaks untouched', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 9, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true })
        .withPriceBreak({ minQty: 6, oldPrice: 6, newPrice: 5, isRepriced: true })
        .build();

      const result = ApplyBeatQPriceRule(model);

      // Q1 suppressed
      expect(result.listOfRepriceDetails[0].newPrice).toBe('N/A');
      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[0].goToPrice).toBe(9);
      expect(result.listOfRepriceDetails[0].explained).toBe(RepriceMessageEnum.BEAT_Q_PRICE);
      // Q3 and Q6 untouched
      expect(result.listOfRepriceDetails[1].newPrice).toBe(7);
      expect(result.listOfRepriceDetails[2].newPrice).toBe(5);
    });

    it('should suppress Q1 even when Q1 newPrice is N/A', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 'N/A', isRepriced: false })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true })
        .build();

      const result = ApplyBeatQPriceRule(model);

      // Q1 still gets overwritten
      expect(result.listOfRepriceDetails[0].explained).toBe(RepriceMessageEnum.BEAT_Q_PRICE);
    });
  });

  describe('single-break model', () => {
    it('should suppress the single break with BEAT_Q_PRICE_1', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();

      const result = ApplyBeatQPriceRule(model);

      expect(result.repriceDetails!.newPrice).toBe('N/A');
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(9);
      expect(result.repriceDetails!.explained).toBe(RepriceMessageEnum.BEAT_Q_PRICE_1);
    });
  });

  describe('mutation behavior', () => {
    it('should mutate the input model directly (no clone)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      ApplyBeatQPriceRule(model);
      expect(model.repriceDetails!.newPrice).toBe('N/A');
    });
  });
});
```

---

## 12. Test File: percentage-price.test.ts

**File:** `__tests__/v1/rules/percentage-price.test.ts`

**Function under test:** `ApplyPercentagePriceRule` (line 161)

**Signature:** `ApplyPercentagePriceRule(repriceResult: RepriceModel, percentage: number)`

**Business logic:** Limits how much the price can increase. When `newPrice > oldPrice`, calculates the actual percentage increase: `((newPrice - oldPrice) / oldPrice) * 100`. If this is LESS than the configured `percentage`, the reprice is blocked. Only acts on breaks where `oldPrice != 0` and `newPrice != "N/A"`.

**Important note on the semantics:** The `percentage` parameter is a minimum allowed percentage increase. If the actual increase is below this threshold, the reprice is rejected. This is a cap on how SMALL the increase can be -- typically used to avoid tiny price adjustments.

**Internal helper:** `executePercentageCheck(result, expectedPercentage)` at line 554 -- returns `true` if `percentageIncrease >= expectedPercentage`.

**Sync:** Yes. **Clones:** No (mutates input directly).

```typescript
import { ApplyPercentagePriceRule } from '../../../v1/repricer-rule-helper';
import { RepriceMessageEnum } from '../../../../../../model/reprice-message';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplyPercentagePriceRule', () => {
  describe('single-break model', () => {
    it('should allow when percentage increase meets threshold', () => {
      // oldPrice=10, newPrice=12 => 20% increase >= 10% threshold
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe(12);
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });

    it('should block when percentage increase is below threshold', () => {
      // oldPrice=10, newPrice=10.50 => 5% increase < 10% threshold
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10.50).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.goToPrice).toBe(10.50);
      expect(result.repriceDetails!.explained).toBe(RepriceMessageEnum.IGNORED_PERCENTAGE_CHECK);
    });

    it('should allow when percentage increase exactly equals threshold', () => {
      // oldPrice=10, newPrice=11 => 10% increase == 10% threshold
      const model = aRepriceModel().withOldPrice(10).withNewPrice(11).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe(11);
    });

    it('should skip price decreases (only checks increases)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe(8);
    });

    it('should skip when newPrice equals oldPrice (no increase)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10).build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe(10);
    });

    it('should skip when newPrice is N/A', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice('N/A').build();
      model.repriceDetails!.isRepriced = false;
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });

    it('should allow with percentage=0 (any increase is fine)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10.01).build();
      const result = ApplyPercentagePriceRule(model, 0);
      expect(result.repriceDetails!.newPrice).toBe(10.01);
    });
  });

  describe('multi-break model', () => {
    it('should check each break independently', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 12, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8.50, isRepriced: true })
        .build();
      // Q1: 20% >= 10%, allowed
      // Q3: 6.25% < 10%, blocked
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(12);
      expect(result.listOfRepriceDetails[1].newPrice).toBe('N/A');
    });

    it('should skip breaks with oldPrice=0', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 0, newPrice: 5, isRepriced: true })
        .build();
      const result = ApplyPercentagePriceRule(model, 10);
      expect(result.listOfRepriceDetails[0].newPrice).toBe(5);
    });
  });
});
```

---

## 13. Test File: deactivate-q-break.test.ts

**File:** `__tests__/v1/rules/deactivate-q-break.test.ts`

**Function under test:** `ApplyDeactivateQPriceBreakRule` (line 189)

**Signature:** `ApplyDeactivateQPriceBreakRule(repriceResult: RepriceModel, abortDeactivatingQPriceBreak: boolean)`

**Business logic:** Prevents deactivation of quantity breaks when Q1 has not changed. For each non-Q1 break, checks if it is being deactivated (`newPrice=0` via `validateQtyDeactivation`). If it IS being deactivated AND Q1 has NOT changed AND `abortDeactivatingQPriceBreak` is true, the deactivation is aborted: sets `newPrice="N/A"`, `isRepriced=false`, `active=true`, and appends `IGNORED_ABORT_Q_DEACTIVATION` to explained.

**Internal helpers:**
- `validateQtyReprice(list, 1, false)` -- returns true if Q1's newPrice differs from its oldPrice.
- `validateQtyDeactivation(list, minQty)` -- returns true if the break at the given minQty has `newPrice=0` (numeric).

**Sync:** Yes. **Clones:** Yes (`_.cloneDeep`).

```typescript
import { ApplyDeactivateQPriceBreakRule } from '../../../v1/repricer-rule-helper';
import { RepriceRenewedMessageEnum } from '../../../../../../model/reprice-renewed-message';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplyDeactivateQPriceBreakRule', () => {
  describe('when abortDeactivatingQPriceBreak = true', () => {
    it('should abort deactivation when Q1 has NOT changed', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true })
        .build();
      // Q1 unchanged (10==10), Q3 being deactivated (newPrice=0), abort=true
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
      expect(q3!.newPrice).toBe('N/A');
      expect(q3!.isRepriced).toBe(false);
      expect(q3!.active).toBe(true);
      expect(q3!.explained).toContain(RepriceRenewedMessageEnum.IGNORED_ABORT_Q_DEACTIVATION);
    });

    it('should allow deactivation when Q1 HAS changed', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 9, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true })
        .build();
      // Q1 changed (9!=10), so deactivation is allowed
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
      expect(q3!.newPrice).toBe(0);
    });

    it('should not affect Q1 break itself', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true })
        .build();
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      const q1 = result.listOfRepriceDetails.find(d => d.minQty === 1);
      expect(q1!.newPrice).toBe(10);
    });

    it('should not abort when break is not being deactivated (newPrice != 0)', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true })
        .build();
      // Q3 newPrice=7, not 0 => not a deactivation
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
      expect(q3!.newPrice).toBe(7);
    });

    it('should handle multiple deactivating breaks independently', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true })
        .withPriceBreak({ minQty: 6, oldPrice: 5, newPrice: 0, isRepriced: true })
        .build();
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
      const q6 = result.listOfRepriceDetails.find(d => d.minQty === 6);
      expect(q3!.newPrice).toBe('N/A');
      expect(q6!.newPrice).toBe('N/A');
    });
  });

  describe('when abortDeactivatingQPriceBreak = false', () => {
    it('should allow deactivation regardless of Q1 status', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true })
        .build();
      const result = ApplyDeactivateQPriceBreakRule(model, false);
      const q3 = result.listOfRepriceDetails.find(d => d.minQty === 3);
      expect(q3!.newPrice).toBe(0);
    });
  });

  describe('single-break model', () => {
    it('should return model unchanged (function only acts on multi-break)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(0).build();
      const result = ApplyDeactivateQPriceBreakRule(model, true);
      expect(result.repriceDetails).toBeDefined();
    });
  });

  describe('cloning behavior', () => {
    it('should not mutate the original model', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 0, isRepriced: true })
        .build();
      ApplyDeactivateQPriceBreakRule(model, true);
      expect(model.listOfRepriceDetails.find(d => d.minQty === 3)!.newPrice).toBe(0);
    });
  });
});
```

---

## 14. Test File: sister-comparison.test.ts

**File:** `__tests__/v1/rules/sister-comparison.test.ts`

**Function under test:** `ApplySisterComparisonCheck` (line 416)

**Signature:** `async ApplySisterComparisonCheck(repriceResult: any, net32Result: Net32Product[], productItem: FrontierProduct): Promise<RepriceModel>`

**Business logic:** Checks if the suggested new price matches a sister vendor's price at the same quantity break. If it does, lowers the price by `applicationConfig.OFFSET` (default 0.01) to avoid a tie. If the adjusted price also matches another sister vendor, keeps subtracting OFFSET until no match is found. Appends `#SISTERSAMEPRICE` to explained. Only acts on breaks where `newPrice != "N/A"`.

**Async:** Yes. **Clones:** Yes (`_.cloneDeep`).

**External dependencies:** Calls `globalParam.GetInfo()` to get sister vendor IDs. Uses `applicationConfig.OFFSET` for the price step.

**Mock requirements:**
- `globalParam.GetInfo` -- mock to return `{ VENDOR_ID: '17357', EXCLUDED_VENDOR_ID: '20722;20755' }`
- `applicationConfig` -- mock `OFFSET` to `0.01`

**Note:** When `productItem.ownVendorId` and `productItem.sisterVendorId` are set to non-`"N/A"` values, `globalParam.GetInfo` returns them directly without hitting the DB. However, we still mock to be safe.

```typescript
jest.mock('../../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '17357',
    EXCLUDED_VENDOR_ID: '20722;20755',
  }),
}));

jest.mock('../../../../config', () => ({
  applicationConfig: {
    OFFSET: 0.01,
  },
}));

import { ApplySisterComparisonCheck } from '../../../v1/repricer-rule-helper';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import { aNet32Product } from '../../infrastructure/builders/net32-product.builder';
import { aProduct } from '../../infrastructure/builders/frontier-product.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('ApplySisterComparisonCheck', () => {
  const defaultProduct = aProduct()
    .ownVendorId('17357')
    .sisterVendorId('20722;20755')
    .build();

  describe('single-break model', () => {
    it('should lower price by OFFSET when suggested price matches sister vendor Q1', async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8.00).build();
      const net32 = [
        aNet32Product().vendorId(17357).vendorName('Tradent').unitPrice(10).build(),
        aNet32Product().vendorId(20722).vendorName('Frontier').unitPrice(8.00).inStock(true).build(),
      ];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(parseFloat(result.repriceDetails!.newPrice as string)).toBeCloseTo(7.99, 2);
      expect(result.repriceDetails!.explained).toContain('#SISTERSAMEPRICE');
    });

    it('should not modify when suggested price does not match any sister vendor', async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8.50).build();
      const net32 = [
        aNet32Product().vendorId(17357).vendorName('Tradent').unitPrice(10).build(),
        aNet32Product().vendorId(20722).vendorName('Frontier').unitPrice(9.00).inStock(true).build(),
      ];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(result.repriceDetails!.newPrice).toBe(8.50);
      expect(result.repriceDetails!.explained).not.toContain('#SISTERSAMEPRICE');
    });

    it('should skip when newPrice is N/A', async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice('N/A').build();
      model.repriceDetails!.isRepriced = false;
      const net32 = [
        aNet32Product().vendorId(20722).unitPrice(10).inStock(true).build(),
      ];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(result.repriceDetails!.newPrice).toBe('N/A');
    });

    it('should handle cascade: if OFFSET-adjusted price also matches another sister', async () => {
      // Suggested = 8.00, Sister1 = 8.00, Sister2 = 7.99
      // First offset => 7.99, matches Sister2 => second offset => 7.98
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8.00).build();
      const net32 = [
        aNet32Product().vendorId(20722).vendorName('Frontier').unitPrice(8.00).inStock(true).build(),
        aNet32Product().vendorId(20755).vendorName('MVP').unitPrice(7.99).inStock(true).build(),
      ];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(parseFloat(result.repriceDetails!.newPrice as string)).toBeCloseTo(7.98, 2);
    });

    it('should ignore out-of-stock sister vendors', async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8.00).build();
      const net32 = [
        aNet32Product().vendorId(20722).vendorName('Frontier').unitPrice(8.00).outOfStock().build(),
      ];

      const result = await ApplySisterComparisonCheck(model, net32, defaultProduct);

      // Sister is out of stock, so no match
      expect(result.repriceDetails!.newPrice).toBe(8.00);
    });
  });

  describe('multi-break model', () => {
    it('should check each break against sister vendors at matching minQty', async () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 8, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 6, isRepriced: true })
        .build();
      const net32 = [
        aNet32Product()
          .vendorId(20722)
          .vendorName('Frontier')
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
      expect(result.listOfRepriceDetails[0].explained).toContain('#SISTERSAMEPRICE');
      // Q3: 6 does not match sister Q3=7 => unchanged
      expect(result.listOfRepriceDetails[1].newPrice).toBe(6);
    });
  });

  describe('cloning behavior', () => {
    it('should not mutate the original model', async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8.00).build();
      const net32 = [
        aNet32Product().vendorId(20722).vendorName('Frontier').unitPrice(8.00).inStock(true).build(),
      ];

      await ApplySisterComparisonCheck(model, net32, defaultProduct);

      expect(model.repriceDetails!.newPrice).toBe(8.00);
    });
  });
});
```

---

## 15. Test File: badge-percentage-down.test.ts

**File:** `__tests__/v1/rules/badge-percentage-down.test.ts`

**Function under test:** `ApplyRepriceDownBadgeCheckRule` (line 329)

**Signature:** `async ApplyRepriceDownBadgeCheckRule(repriceResult: RepriceModel, net32Result: any[], productItem: FrontierProduct, badgePercentageDown: number): Promise<RepriceModel>`

**Business logic:** When `badgePercentageDown > 0`, this rule finds the lowest badged vendor's Q1 price, applies the badge percentage discount to get an `effectivePrice`, and potentially overrides the suggested price. The function:
1. Returns immediately if `badgePercentageDown == 0`.
2. Filters vendors by `BADGE_ONLY` indicator using `filterMapper.FilterBasedOnParams`.
3. Sorts badged vendors by Q1 unit price + shipping.
4. Removes own vendor and excluded (sister) vendors from the sorted list.
5. Calculates `effectivePrice = subtractPercentage(lowestBadgePrice + heavyShipping, badgePercentageDown) - heavyShipping`.
6. If `suggestedPrice <= effectivePrice`: do nothing (already competitive).
7. If `suggestedPrice > effectivePrice` and `effectivePrice <= floorPrice`: keeps the suggested price but may adjust if it is above floor.
8. If `suggestedPrice > effectivePrice` and `effectivePrice > floorPrice`: sets newPrice to effectivePrice.

**Async:** Yes. **External dependencies:** `globalParam.GetInfo`, `filterMapper.FilterBasedOnParams`.

**Mock requirements:** Both `globalParam` and `filterMapper` must be mocked. The `FilterBasedOnParams` mock must return the badge-filtered vendor list.

```typescript
jest.mock('../../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '17357',
    EXCLUDED_VENDOR_ID: '20722;20755',
  }),
}));

jest.mock('../../../../filter-mapper', () => ({
  FilterBasedOnParams: jest.fn(),
}));

import { ApplyRepriceDownBadgeCheckRule } from '../../../v1/repricer-rule-helper';
import * as filterMapper from '../../../../filter-mapper';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import { aNet32Product } from '../../infrastructure/builders/net32-product.builder';
import { aProduct } from '../../infrastructure/builders/frontier-product.builder';
import '../../infrastructure/matchers/pricing.matchers';

const mockedFilterBasedOnParams = filterMapper.FilterBasedOnParams as jest.MockedFunction<typeof filterMapper.FilterBasedOnParams>;

describe('ApplyRepriceDownBadgeCheckRule', () => {
  const ownVendor = aNet32Product()
    .vendorId(17357)
    .vendorName('Tradent')
    .unitPrice(10)
    .build();

  describe('early return when badgePercentageDown = 0', () => {
    it('should return model unchanged', async () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      const product = aProduct().badgePercentageDown(0).build();
      const result = await ApplyRepriceDownBadgeCheckRule(model, [ownVendor], product, 0);
      expect(result.repriceDetails!.newPrice).toBe(9);
    });
  });

  describe('when badged vendor has lower effective price', () => {
    it('should set newPrice to effectivePrice when above floor', async () => {
      const badgedVendor = aNet32Product()
        .vendorId(55555)
        .vendorName('BadgedVendor')
        .unitPrice(9.00)
        .badge(1, 'Gold')
        .build();

      mockedFilterBasedOnParams.mockResolvedValue([badgedVendor]);

      // suggestedPrice for Q1 = 8.00
      const model = aRepriceModel().withOldPrice(10).withNewPrice(8).build();
      const product = aProduct()
        .ownVendorId('17357')
        .sisterVendorId('20722;20755')
        .badgePercentageDown(0.05)
        .floor(5)
        .build();

      // effectivePrice = subtractPercentage(9.00, 0.05) = floor((9 - 9*0.05)*100)/100
      // = floor(8.55*100)/100 = floor(855)/100 = 8.55
      // suggestedPrice=8 <= effectivePrice=8.55 => do nothing
      const result = await ApplyRepriceDownBadgeCheckRule(
        model, [ownVendor, badgedVendor], product, 0.05
      );
      expect(result.repriceDetails!.newPrice).toBe(8);
    });

    it('should override when suggested price exceeds effective price and effective > floor', async () => {
      const badgedVendor = aNet32Product()
        .vendorId(55555)
        .vendorName('BadgedVendor')
        .unitPrice(9.00)
        .badge(1, 'Gold')
        .build();

      mockedFilterBasedOnParams.mockResolvedValue([badgedVendor]);

      // suggestedPrice for Q1 = 9.50 (higher than effective)
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9.50).build();
      const product = aProduct()
        .ownVendorId('17357')
        .sisterVendorId('20722;20755')
        .badgePercentageDown(0.05)
        .floor(5)
        .build();

      // effectivePrice = subtractPercentage(9.00, 0.05) = 8.55
      // 9.50 > 8.55, and 8.55 > 5 (floor), and 8.55 != 10 (existingPrice)
      const result = await ApplyRepriceDownBadgeCheckRule(
        model, [ownVendor, badgedVendor], product, 0.05
      );

      // newPrice should be overridden to effectivePrice
      expect(result.repriceDetails!.newPrice).toBe(8.55);
      expect(result.repriceDetails!.explained).toContain('#RepriceDownBadge%');
    });
  });

  describe('when no badged vendors found', () => {
    it('should return model unchanged', async () => {
      mockedFilterBasedOnParams.mockResolvedValue([]);

      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      const product = aProduct()
        .ownVendorId('17357')
        .sisterVendorId('20722;20755')
        .badgePercentageDown(0.05)
        .build();

      const result = await ApplyRepriceDownBadgeCheckRule(
        model, [ownVendor], product, 0.05
      );
      expect(result.repriceDetails!.newPrice).toBe(9);
    });
  });

  describe('when first badged vendor is a sister vendor', () => {
    it('should return model unchanged (sister excluded)', async () => {
      const sisterVendor = aNet32Product()
        .vendorId(20722)
        .vendorName('Frontier')
        .unitPrice(8.00)
        .badge(1, 'Gold')
        .build();

      mockedFilterBasedOnParams.mockResolvedValue([sisterVendor]);

      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      const product = aProduct()
        .ownVendorId('17357')
        .sisterVendorId('20722;20755')
        .badgePercentageDown(0.05)
        .competeAll(false)
        .build();

      const result = await ApplyRepriceDownBadgeCheckRule(
        model, [ownVendor, sisterVendor], product, 0.05
      );

      // First sorted vendor is sister => early return
      expect(result.repriceDetails!.newPrice).toBe(9);
    });
  });

  describe('effective price at or below floor', () => {
    it('should not override to a price below floor', async () => {
      const badgedVendor = aNet32Product()
        .vendorId(55555)
        .vendorName('BadgedVendor')
        .unitPrice(5.00)
        .badge(1, 'Gold')
        .build();

      mockedFilterBasedOnParams.mockResolvedValue([badgedVendor]);

      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      const product = aProduct()
        .ownVendorId('17357')
        .sisterVendorId('20722;20755')
        .badgePercentageDown(0.05)
        .floor(8)
        .build();

      // effectivePrice = subtractPercentage(5.00, 0.05) = 4.75; 4.75 <= 8 (floor)
      // Then effectivePrice = suggestedPrice = 9, and 9 > 8 (floor)
      // So newPrice = 9 with badge tag appended
      const result = await ApplyRepriceDownBadgeCheckRule(
        model, [ownVendor, badgedVendor], product, 0.05
      );

      expect(result.repriceDetails!.newPrice).toBe(9);
      expect(result.repriceDetails!.explained).toContain('#RepriceDownBadge%');
    });
  });
});
```

---

## 16. Test File: align-is-repriced.test.ts

**File:** `__tests__/v1/rules/align-is-repriced.test.ts`

**Function under test:** `AlignIsRepriced` (line 507)

**Signature:** `async AlignIsRepriced(repriceResult: any)`

**Business logic:** Sets `isRepriced=false` when the suggested price equals the old price (no actual change). For multi-break models, checks each break independently and appends `_IGNORED_#SAMEPRICESUGGESTED` to explained when `newPrice == oldPrice` and `active != 0`. For single-break models, compares `$eval.newPrice` and `$eval.oldPrice` (note: this accesses top-level properties which may not exist on RepriceModel, likely a bug -- `$eval.repriceDetails.newPrice` is the intended path).

**Async:** Yes (but no external calls -- the async is a no-op wrapper).

**Clones:** No (mutates input directly).

**Important code detail (single-break branch bug):** Line 517 uses `$eval.newPrice` and `$eval.oldPrice` instead of `$eval.repriceDetails.newPrice` and `$eval.repriceDetails.oldPrice`. `RepriceModel` does not have top-level `newPrice`/`oldPrice` properties, so `parseFloat(undefined)` yields `NaN`, and `NaN == NaN` is false. This means the single-break path effectively never triggers for standard RepriceModel objects. Tests should document this behavior.

```typescript
import { AlignIsRepriced } from '../../../v1/repricer-rule-helper';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('AlignIsRepriced', () => {
  describe('multi-break model', () => {
    it('should set isRepriced=false when newPrice equals oldPrice', async () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true })
        .build();

      const result = await AlignIsRepriced(model);

      // Q1: 10 == 10 => isRepriced set to false
      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[0].explained).toContain('_IGNORED_#SAMEPRICESUGGESTED');
      // Q3: 7 != 8 => unchanged
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(true);
    });

    it('should not modify breaks where newPrice is N/A', async () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 'N/A', isRepriced: false })
        .build();

      const result = await AlignIsRepriced(model);

      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[0].explained).not.toContain('_IGNORED_#SAMEPRICESUGGESTED');
    });

    it('should skip deactivated breaks (active=0)', async () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .build();
      model.listOfRepriceDetails[0].active = 0 as unknown as boolean;

      const result = await AlignIsRepriced(model);

      // active == 0 => skipped
      expect(result.listOfRepriceDetails[0].isRepriced).toBe(true);
    });

    it('should handle multiple same-price breaks', async () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8, isRepriced: true })
        .build();

      const result = await AlignIsRepriced(model);

      expect(result.listOfRepriceDetails[0].isRepriced).toBe(false);
      expect(result.listOfRepriceDetails[1].isRepriced).toBe(false);
    });
  });

  describe('single-break model', () => {
    it('should not trigger due to property access bug ($eval.newPrice is undefined)', async () => {
      // The code checks $eval.newPrice and $eval.oldPrice (top-level),
      // but RepriceModel only has repriceDetails.newPrice/oldPrice.
      // parseFloat(undefined) => NaN; NaN == NaN => false
      // So the single-break branch effectively never fires.
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10).build();

      const result = await AlignIsRepriced(model);

      // isRepriced remains true because the comparison never fires
      expect(result.repriceDetails!.isRepriced).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should catch exceptions and still return the model', async () => {
      // Pass a malformed object that causes an exception
      const model = null as any;
      const result = await AlignIsRepriced(model);
      // Should not throw; the catch block logs and returns $eval
      expect(result).toBeNull();
    });
  });
});
```

---

## 17. Test File: new-break-activation.test.ts

**File:** `__tests__/v1/rules/new-break-activation.test.ts`

**Function under test:** `AppendNewPriceBreakActivation` (line 308)

**Signature:** `AppendNewPriceBreakActivation(repriceResult: RepriceModel): RepriceModel`

**Business logic:** Tags new price break activations (where `oldPrice=0` and `newPrice > 0`) with `#NEW` in the explained string. If the explained already contains `#UP`, replaces it with `#NEW`. Otherwise appends ` #NEW`.

**Sync:** Yes. **Clones:** No (mutates input directly).

```typescript
import { AppendNewPriceBreakActivation } from '../../../v1/repricer-rule-helper';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('AppendNewPriceBreakActivation', () => {
  describe('multi-break model', () => {
    it('should append #NEW when oldPrice=0 and newPrice > 0', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 9, isRepriced: true, explained: 'CHANGE: test' })
        .withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 5, isRepriced: true, explained: 'CHANGE: new break' })
        .build();

      const result = AppendNewPriceBreakActivation(model);

      // Q1: oldPrice=10, not 0 => no change
      expect(result.listOfRepriceDetails[0].explained).toBe('CHANGE: test');
      // Q3: oldPrice=0, newPrice=5 > 0 => append #NEW
      expect(result.listOfRepriceDetails[1].explained).toContain('#NEW');
    });

    it('should replace #UP with #NEW when explained contains #UP', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 5, isRepriced: true, explained: 'CHANGE: validated #UP' })
        .build();

      const result = AppendNewPriceBreakActivation(model);

      expect(result.listOfRepriceDetails[0].explained).toContain('#NEW');
      expect(result.listOfRepriceDetails[0].explained).not.toContain('#UP');
    });

    it('should not modify breaks where oldPrice is not 0', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 12, isRepriced: true, explained: 'CHANGE: #UP' })
        .build();

      const result = AppendNewPriceBreakActivation(model);

      // oldPrice=10, not 0 => no change
      expect(result.listOfRepriceDetails[0].explained).toBe('CHANGE: #UP');
    });

    it('should not modify breaks where newPrice is N/A', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 'N/A', isRepriced: false, explained: 'IGNORE: reason' })
        .build();

      const result = AppendNewPriceBreakActivation(model);

      expect(result.listOfRepriceDetails[0].explained).toBe('IGNORE: reason');
    });

    it('should not modify breaks where newPrice is 0 (deactivation)', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 0, isRepriced: true, explained: 'CHANGE: test' })
        .build();

      const result = AppendNewPriceBreakActivation(model);

      // 0 > 0 is false, so no change
      expect(result.listOfRepriceDetails[0].explained).toBe('CHANGE: test');
    });
  });

  describe('single-break model', () => {
    it('should append #NEW when oldPrice=0 and newPrice > 0', () => {
      const model = aRepriceModel()
        .withOldPrice(0)
        .withNewPrice(5)
        .withExplained('CHANGE: test')
        .build();
      model.repriceDetails!.oldPrice = 0;

      const result = AppendNewPriceBreakActivation(model);

      expect(result.repriceDetails!.explained).toContain('#NEW');
    });

    it('should replace #UP with #NEW in single-break explained', () => {
      const model = aRepriceModel()
        .withOldPrice(0)
        .withNewPrice(5)
        .withExplained('CHANGE: validated #UP')
        .build();
      model.repriceDetails!.oldPrice = 0;

      const result = AppendNewPriceBreakActivation(model);

      expect(result.repriceDetails!.explained).toContain('#NEW');
      expect(result.repriceDetails!.explained).not.toContain('#UP');
    });

    it('should not modify when oldPrice is not 0', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(12).withExplained('CHANGE: #UP').build();

      const result = AppendNewPriceBreakActivation(model);

      expect(result.repriceDetails!.explained).toBe('CHANGE: #UP');
    });
  });

  describe('mutation behavior', () => {
    it('should mutate the input model directly (no clone)', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 3, oldPrice: 0, newPrice: 5, isRepriced: true, explained: 'CHANGE: test' })
        .build();

      AppendNewPriceBreakActivation(model);

      expect(model.listOfRepriceDetails[0].explained).toContain('#NEW');
    });
  });
});
```

---

## 18. Test File: express-cron-override.test.ts

**File:** `__tests__/v1/rules/express-cron-override.test.ts`

**Function under test:** `OverrideRepriceResultForExpressCron` (line 489)

**Signature:** `OverrideRepriceResultForExpressCron(repriceResult: any): any`

**Business logic:** For express cron runs, overrides all reprice results to be "not repriced" -- stores the suggested price in `goToPrice` and sets `newPrice="N/A"`, `isRepriced=false`, and appends `_#INEXPRESSCRON` to explained. This applies to every break unconditionally.

**Sync:** Yes. **Clones:** No (mutates input directly).

```typescript
import { OverrideRepriceResultForExpressCron } from '../../../v1/repricer-rule-helper';
import { aRepriceModel } from '../../infrastructure/builders/reprice-model.builder';
import '../../infrastructure/matchers/pricing.matchers';

describe('OverrideRepriceResultForExpressCron', () => {
  describe('multi-break model', () => {
    it('should override all breaks to N/A and append #INEXPRESSCRON', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 9, isRepriced: true, explained: 'CHANGE: test' })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true, explained: 'CHANGE: test2' })
        .build();

      const result = OverrideRepriceResultForExpressCron(model);

      result.listOfRepriceDetails.forEach((detail: any) => {
        expect(detail.newPrice).toBe('N/A');
        expect(detail.isRepriced).toBe(false);
        expect(detail.explained).toContain('_#INEXPRESSCRON');
      });
      expect(result.listOfRepriceDetails[0].goToPrice).toBe(9);
      expect(result.listOfRepriceDetails[1].goToPrice).toBe(7);
    });

    it('should override even already-ignored breaks', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 'N/A', isRepriced: false, explained: 'IGNORE: test' })
        .build();

      const result = OverrideRepriceResultForExpressCron(model);

      expect(result.listOfRepriceDetails[0].goToPrice).toBe('N/A');
      expect(result.listOfRepriceDetails[0].newPrice).toBe('N/A');
      expect(result.listOfRepriceDetails[0].explained).toBe('IGNORE: test_#INEXPRESSCRON');
    });
  });

  describe('single-break model', () => {
    it('should override repriceDetails', () => {
      const model = aRepriceModel()
        .withOldPrice(10)
        .withNewPrice(9)
        .withExplained('CHANGE: validated')
        .build();

      const result = OverrideRepriceResultForExpressCron(model);

      expect(result.repriceDetails!.goToPrice).toBe(9);
      expect(result.repriceDetails!.newPrice).toBe('N/A');
      expect(result.repriceDetails!.isRepriced).toBe(false);
      expect(result.repriceDetails!.explained).toBe('CHANGE: validated_#INEXPRESSCRON');
    });
  });

  describe('mutation behavior', () => {
    it('should mutate the input model directly (no clone)', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).withExplained('CHANGE').build();

      OverrideRepriceResultForExpressCron(model);

      expect(model.repriceDetails!.newPrice).toBe('N/A');
    });
  });
});
```

---

## 19. Shared Utility Tests (shared.ts)

These tests cover the pure utility functions exported from `shared.ts`. They can be placed in a separate file or appended to an existing rule test file. Recommended location: `__tests__/v1/rules/shared-utils.test.ts`.

**File:** `__tests__/v1/rules/shared-utils.test.ts`

```typescript
import {
  isPriceUpdateRequired,
  notQ2VsQ1,
  MinQtyPricePresent,
  getIsFloorReached,
  getPriceStepValue,
} from '../../../v1/shared';
import { RepriceModel, RepriceData } from '../../../../../../model/reprice-model';
import { Net32PriceBreak } from '../../../../../../types/net32';
import { aRepriceModel, makeRepriceData } from '../../infrastructure/builders/reprice-model.builder';

describe('isPriceUpdateRequired', () => {
  describe('when isRepriceOn = false', () => {
    it('should return false regardless of model state', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      expect(isPriceUpdateRequired(model, false)).toBe(false);
    });
  });

  describe('single-break model', () => {
    it('should return true when newPrice differs from oldPrice', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(9).build();
      expect(isPriceUpdateRequired(model, true)).toBe(true);
    });

    it('should return false when newPrice equals oldPrice', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice(10).build();
      expect(isPriceUpdateRequired(model, true)).toBe(false);
    });

    it('should return false when newPrice is N/A', () => {
      const model = aRepriceModel().withOldPrice(10).withNewPrice('N/A').build();
      model.repriceDetails!.isRepriced = false;
      expect(isPriceUpdateRequired(model, true)).toBe(false);
    });
  });

  describe('multi-break model', () => {
    it('should return true when any break has newPrice different from oldPrice', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 7, isRepriced: true })
        .build();
      model.isMultiplePriceBreakAvailable = true;
      expect(isPriceUpdateRequired(model, true)).toBe(true);
    });

    it('should return true when any break has active=false (deactivation)', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8, isRepriced: true, active: false })
        .build();
      model.isMultiplePriceBreakAvailable = true;
      expect(isPriceUpdateRequired(model, true)).toBe(true);
    });

    it('should return false when all breaks have same price and are active', () => {
      const model = aRepriceModel()
        .withPriceBreak({ minQty: 1, oldPrice: 10, newPrice: 10, isRepriced: true })
        .withPriceBreak({ minQty: 3, oldPrice: 8, newPrice: 8, isRepriced: true })
        .build();
      model.isMultiplePriceBreakAvailable = true;
      expect(isPriceUpdateRequired(model, true)).toBe(false);
    });
  });
});

describe('notQ2VsQ1', () => {
  it('should return false when minQty=2 and compareWithQ1=true', () => {
    expect(notQ2VsQ1(2, true)).toBe(false);
  });

  it('should return true when minQty=2 and compareWithQ1=false', () => {
    expect(notQ2VsQ1(2, false)).toBe(true);
  });

  it('should return true when minQty=1 and compareWithQ1=true', () => {
    expect(notQ2VsQ1(1, true)).toBe(true);
  });

  it('should return true when minQty=3 and compareWithQ1=true', () => {
    expect(notQ2VsQ1(3, true)).toBe(true);
  });
});

describe('MinQtyPricePresent', () => {
  it('should return true when a price break with matching minQty exists', () => {
    const breaks: Net32PriceBreak[] = [
      { minQty: 1, unitPrice: 10, active: true },
      { minQty: 3, unitPrice: 8, active: true },
    ];
    expect(MinQtyPricePresent(breaks, 3)).toBe(true);
  });

  it('should return false when no price break with matching minQty exists', () => {
    const breaks: Net32PriceBreak[] = [
      { minQty: 1, unitPrice: 10, active: true },
    ];
    expect(MinQtyPricePresent(breaks, 3)).toBe(false);
  });

  it('should return false when priceBreaks is null', () => {
    expect(MinQtyPricePresent(null as any, 1)).toBe(false);
  });

  it('should return false when priceBreaks is empty', () => {
    expect(MinQtyPricePresent([], 1)).toBe(false);
  });

  it('should match even inactive price breaks', () => {
    const breaks: Net32PriceBreak[] = [
      { minQty: 1, unitPrice: 10, active: false },
    ];
    expect(MinQtyPricePresent(breaks, 1)).toBe(true);
  });
});

describe('getIsFloorReached', () => {
  it('should return true when explained contains #HitFloor (case-insensitive)', async () => {
    const detail = makeRepriceData({
      oldPrice: 10,
      newPrice: 5,
      isRepriced: false,
      explained: 'IGNORE: #HitFloor',
    });
    expect(await getIsFloorReached(detail)).toBe(true);
  });

  it('should return true when explained contains #HITFLOOR (uppercase)', async () => {
    const detail = makeRepriceData({
      oldPrice: 10,
      newPrice: 5,
      isRepriced: false,
      explained: 'SOMETHING #HITFLOOR',
    });
    expect(await getIsFloorReached(detail)).toBe(true);
  });

  it('should return false when explained does not contain #HitFloor', async () => {
    const detail = makeRepriceData({
      oldPrice: 10,
      newPrice: 9,
      isRepriced: true,
      explained: 'CHANGE: validated',
    });
    expect(await getIsFloorReached(detail)).toBe(false);
  });

  it('should throw when explained is null', async () => {
    const detail = makeRepriceData({
      oldPrice: 10,
      newPrice: 9,
      isRepriced: true,
    });
    detail.explained = null;
    await expect(getIsFloorReached(detail)).rejects.toThrow('Reprice details explained is null');
  });
});

describe('getPriceStepValue', () => {
  it('should return $DOWN when oldPrice > newPrice', async () => {
    const detail = makeRepriceData({ oldPrice: 10, newPrice: 8 });
    expect(await getPriceStepValue(detail)).toBe('$DOWN');
  });

  it('should return $UP when oldPrice < newPrice', async () => {
    const detail = makeRepriceData({ oldPrice: 10, newPrice: 12 });
    expect(await getPriceStepValue(detail)).toBe('$UP');
  });

  it('should return $SAME when oldPrice equals newPrice', async () => {
    const detail = makeRepriceData({ oldPrice: 10, newPrice: 10 });
    expect(await getPriceStepValue(detail)).toBe('$SAME');
  });

  it('should treat N/A as 0 for comparison', async () => {
    const detail = makeRepriceData({ oldPrice: 10, newPrice: 'N/A' });
    // parseFloat("N/A") is NaN, but the ternary uses == "N/A" check and returns 0
    // 10 > 0 => $DOWN
    expect(await getPriceStepValue(detail)).toBe('$DOWN');
  });

  it('should return $DOWN when oldPrice > 0 and newPrice is 0', async () => {
    const detail = makeRepriceData({ oldPrice: 10, newPrice: 0 });
    expect(await getPriceStepValue(detail)).toBe('$DOWN');
  });
});
```

---

## 20. Summary Table

| # | Test File | Function(s) Tested | Sync/Async | Needs Mocks | Approx. Tests |
|---|-----------|-------------------|------------|-------------|---------------|
| 1 | `direction-rule.test.ts` | `ApplyRule` | Sync | No | 14 |
| 2 | `floor-check.test.ts` | `ApplyFloorCheckRule` | Sync | No | 9 |
| 3 | `max-price-check.test.ts` | `ApplyMaxPriceCheck` | Async | No | 7 |
| 4 | `multi-price-break.test.ts` | `ApplyMultiPriceBreakRule` | Sync | No | 9 |
| 5 | `buy-box.test.ts` | `ApplyBuyBoxRule` | Sync | No | 10 |
| 6 | `keep-position.test.ts` | `ApplyKeepPositionLogic` | Sync | No | 7 |
| 7 | `suppress-price-break.test.ts` | `ApplySuppressPriceBreakRule` | Sync | No | 7 |
| 8 | `beat-q-price.test.ts` | `ApplyBeatQPriceRule` | Sync | No | 4 |
| 9 | `percentage-price.test.ts` | `ApplyPercentagePriceRule` | Sync | No | 8 |
| 10 | `deactivate-q-break.test.ts` | `ApplyDeactivateQPriceBreakRule` | Sync | No | 7 |
| 11 | `sister-comparison.test.ts` | `ApplySisterComparisonCheck` | Async | Yes (globalParam, config) | 6 |
| 12 | `badge-percentage-down.test.ts` | `ApplyRepriceDownBadgeCheckRule` | Async | Yes (globalParam, filterMapper) | 5 |
| 13 | `align-is-repriced.test.ts` | `AlignIsRepriced` | Async | No | 5 |
| 14 | `new-break-activation.test.ts` | `AppendNewPriceBreakActivation` | Sync | No | 7 |
| 15 | `express-cron-override.test.ts` | `OverrideRepriceResultForExpressCron` | Sync | No | 4 |
| 16 | `shared-utils.test.ts` | `isPriceUpdateRequired`, `notQ2VsQ1`, `MinQtyPricePresent`, `getIsFloorReached`, `getPriceStepValue` | Mixed | No | 17 |
| | **Total** | | | | **~126** |
