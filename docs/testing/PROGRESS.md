# Testing Framework — Implementation Progress

## Phase 1: Layers 0-2 (COMPLETE)

**Status:** Done
**Date completed:** 2026-02-12
**Total:** 24 test suites, 242 tests, all passing (~13s)

---

### Layer 0 — Test Infrastructure

| File | Path | Status |
|------|------|--------|
| Net32 Product Builder | `__tests__/infrastructure/builders/net32-product.builder.ts` | Done |
| Frontier Product Builder | `__tests__/infrastructure/builders/frontier-product.builder.ts` | Done |
| Reprice Model Builder | `__tests__/infrastructure/builders/reprice-model.builder.ts` | Done |
| V2 Settings Builder | `__tests__/infrastructure/builders/v2-settings.builder.ts` | Done |
| Custom Matchers | `__tests__/infrastructure/matchers/pricing.matchers.ts` | Done |
| Jest Config | `jest.config.js` | Done |

---

### Layer 1 — V1 Rule Unit Tests (16 files, 152 tests)

| # | File | Function Under Test | Tests | Status |
|---|------|---------------------|-------|--------|
| 1 | `direction-rule.test.ts` | `ApplyRule` | 14 | Pass |
| 2 | `floor-check.test.ts` | `ApplyFloorCheckRule` | 10 | Pass |
| 3 | `max-price-check.test.ts` | `ApplyMaxPriceCheck` | 8 | Pass |
| 4 | `multi-price-break.test.ts` | `ApplyMultiPriceBreakRule` | 11 | Pass |
| 5 | `buy-box.test.ts` | `ApplyBuyBoxRule` | 15 | Pass |
| 6 | `keep-position.test.ts` | `ApplyKeepPositionLogic` | 8 | Pass |
| 7 | `suppress-price-break.test.ts` | `ApplySuppressPriceBreakRule` | 8 | Pass |
| 8 | `beat-q-price.test.ts` | `ApplyBeatQPriceRule` | 4 | Pass |
| 9 | `percentage-price.test.ts` | `ApplyPercentagePriceRule` | 9 | Pass |
| 10 | `deactivate-q-break.test.ts` | `ApplyDeactivateQPriceBreakRule` | 8 | Pass |
| 11 | `sister-comparison.test.ts` | `ApplySisterComparisonCheck` | 7 | Pass |
| 12 | `badge-percentage-down.test.ts` | `ApplyRepriceDownBadgeCheckRule` | 6 | Pass |
| 13 | `align-is-repriced.test.ts` | `AlignIsRepriced` | 6 | Pass |
| 14 | `new-break-activation.test.ts` | `AppendNewPriceBreakActivation` | 9 | Pass |
| 15 | `express-cron-override.test.ts` | `OverrideRepriceResultForExpressCron` | 4 | Pass |
| 16 | `shared-utils.test.ts` | `isPriceUpdateRequired`, `notQ2VsQ1`, `MinQtyPricePresent`, `getIsFloorReached`, `getPriceStepValue` | 25 | Pass |

All Layer 1 tests live under `apps/api-core/src/utility/reprice-algo/__tests__/v1/rules/`.

---

### Layer 2 — Filter / Eligibility Tests (8 files, 90 tests)

| # | File | Filter / Function | Tests | Status |
|---|------|-------------------|-------|--------|
| 1 | `excluded-vendor.test.ts` | `EXCLUDED_VENDOR` | 11 | Pass |
| 2 | `inventory-threshold.test.ts` | `INVENTORY_THRESHOLD` | 9 | Pass |
| 3 | `handling-time.test.ts` | `HANDLING_TIME` | 14 | Pass |
| 4 | `badge-indicator.test.ts` | `BADGE_INDICATOR` | 14 | Pass |
| 5 | `phantom-price-break.test.ts` | `PHANTOM_PRICE_BREAK` | 9 | Pass |
| 6 | `sister-vendor-exclusion.test.ts` | `SISTER_VENDOR_EXCLUSION` | 9 | Pass |
| 7 | `get-context-price.test.ts` | `GetContextPrice` | 14 | Pass |
| 8 | `subtract-percentage.test.ts` | `subtractPercentage` | 10 | Pass |

All Layer 2 tests live under `apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/`.

---

## Deviations from Docs

Issues discovered and fixed during implementation:

### Layer 1

1. **Import path depth** — Docs used 6 `../` for model imports (e.g., `../../../../../../model/reprice-renewed-message`). Correct depth from `__tests__/v1/rules/` is 5 `../`.

2. **`ApplyRule` isNcNeeded parameter** — Passing `undefined` causes `undefined == false` to be `false`, which triggers the NC branch and crashes. All tests pass `false` explicitly as the third argument.

3. **`SHUT_DOWN_NO_COMPETITOR` test** — The check only exists in the multi-break path (line 48 of `repricer-rule-helper.ts`), not in the single-break path. Test was changed to use a multi-break model.

4. **`ApplyKeepPositionLogic` vendorId type** — `_.findIndex` uses strict equality. String `'17357'` does not match number `17357`. All vendorId values in keep-position tests use strings (e.g., `.vendorId('17357')`).

### Layer 2

5. **`makeFrontierProduct` missing `...overrides` spread** — The inline helper in `02-filter-tests.md` accepted an `overrides` parameter but never applied it via object spread. All filter tests silently used default values. Fixed by adding `...overrides` before the closing brace.

6. **Additional mocks required** — `filter-mapper.ts` imports `config.ts` (Zod parse at module level), `mongo/db-helper`, and `mysql/mysql-helper` (which imports ESM package `@repricer-monorepo/shared`). Docs only mocked `global-param`. All filter test files need these additional mocks:
   ```typescript
   jest.mock('../../../../config', () => ({ applicationConfig: { OFFSET: 0.01 } }));
   jest.mock('../../../../mongo/db-helper', () => ({}));
   jest.mock('../../../../mysql/mysql-helper', () => ({}));
   ```

7. **`subtractPercentage` floating-point precision** — `10 - 10 * 0.03` evaluates to `9.6999...` in IEEE 754, so `Math.floor(969.999...) / 100 = 9.69`, not `9.70` as the docs expected.

---

## Source Code Bugs Documented by Tests

These are known bugs in the production code that tests explicitly document:

1. **`AlignIsRepriced` single-break path** — Checks `$eval.newPrice` / `$eval.oldPrice` (top-level properties), but `RepriceModel` only has `repriceDetails.newPrice`. `parseFloat(undefined)` produces `NaN`, and `NaN == NaN` is `false`, so the single-break branch never fires.

2. **`ApplyRule` Only Down condition (line 52)** — `$.explained == RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED || RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT` — the second operand is always truthy (non-empty string, not a comparison). This means any price-up in "Only Down" mode with a non-zero explained string hits this branch.

---

## Phase 2: Layers 3-4 (COMPLETE)

**Status:** Done
**Date completed:** 2026-02-18
**Total:** 4 test suites, 52 tests, all passing

---

### Layer 3 — V1 Integration Tests (3 files, 22 tests)

| # | File | Function Under Test | Tests | Status |
|---|------|---------------------|-------|--------|
| 1 | `reprice-helper.test.ts` | `FullRepriceV1` (single-break) | 8 | Pass |
| 2 | `reprice-helper-nc.test.ts` | `FullRepriceV1NC` (multi-break) | 8 | Pass |
| 3 | `reprice-pipeline.test.ts` | Full V1 pipeline end-to-end | 6 | Pass |

All Layer 3 tests live under `apps/api-core/src/utility/reprice-algo/__tests__/v1/integration/`.

---

### Layer 4 — V2 Golden File Tests (1 runner, 30 scenarios)

| # | Scenario File | Description | Expected Result | Status |
|---|--------------|-------------|-----------------|--------|
| 01 | `01-no-competitor.json` | Solo vendor, price up to max | CHANGE #UP | Pass |
| 02 | `02-own-lowest.json` | Already lowest, ignore | IGNORE #LOWEST | Pass |
| 03 | `03-hit-floor.json` | Undercut hits floor price | IGNORE #FLOOR | Pass |
| 04 | `04-sister-lowest.json` | Sister vendor holds buy-box | IGNORE #SISTER_LOWEST | Pass |
| 05 | `05-rule-only-up.json` | Direction UP only, already above | IGNORE #SETTINGS | Pass |
| 06 | `06-rule-only-down.json` | Direction DOWN only, already below | IGNORE #SETTINGS | Pass |
| 07 | `07-keep-position.json` | Keep position mode | CHANGE #DOWN | Pass |
| 08 | `08-own-vendor-low-inventory.json` | Own vendor low inventory | IGNORE #SETTINGS | Pass |
| 09 | `09-floor-compete-with-next-off.json` | Floor hit, compete-with-next disabled | IGNORE #FLOOR | Pass |
| 10 | `10-short-expiry.json` | Short expiry product | IGNORE #SHORT_EXPIRY | Pass |
| 11 | `11-undercut-competitor.json` | Standard undercut by 1 cent | CHANGE #DOWN | Pass |
| 12 | `12-floor-compete-with-next.json` | Floor hit, compete with next vendor | CHANGE #DOWN | Pass |
| 13 | `13-price-up-to-max.json` | Price up capped at max | CHANGE #UP | Pass |
| 14 | `14-new-price-break.json` | New price break activation | CHANGE #NEW | Pass |
| 15 | `15-price-up.json` | Standard price up | CHANGE #UP | Pass |
| 16 | `16-badge-vs-no-badge-unit.json` | Badge vs non-badge, unit strategy | CHANGE #DOWN | Pass |
| 17 | `17-max-price-cap.json` | Max price cap applied | CHANGE #DOWN | Pass |
| 18 | `18-suppress-price-break.json` | Suppress price break | CHANGE #REMOVED | Pass |
| 19 | `19-compete-on-price-break-only.json` | Compete on price break only | CHANGE #DOWN | Pass |
| 20 | `20-multiple-competitors.json` | Multiple competitors | CHANGE #DOWN | Pass |
| 21 | `21-slow-cron-overrides.json` | Slow cron override behavior | CHANGE #DOWN | Pass |
| 22 | `22-handling-time-filter.json` | Handling time filter | CHANGE #DOWN | Pass |
| 23 | `23-exclude-vendor.json` | Excluded vendor | CHANGE #DOWN | Pass |
| 24 | `24-inventory-threshold-filter.json` | Inventory threshold filter | CHANGE #DOWN | Pass |
| 25 | `25-same-price-already-winning.json` | Same price, already winning | IGNORE #LOWEST | Pass |
| 26 | `26-badge-indicator-badge-only.json` | Badge indicator=BADGE filter | CHANGE #DOWN | Pass |
| 27 | `27-simulated-sister-vendor.json` | Simulated sister in winning position | IGNORE #SISTER_LOWEST | Pass |
| 28 | `28-down-percentage.json` | 5% undercut instead of 1 cent | CHANGE #DOWN | Pass |
| 29 | `29-compete-with-all-vendors.json` | Sister treated as competitor | CHANGE #DOWN | Pass |
| 30 | `30-vendor-blocked-422.json` | Vendor blocked by 422 error | NO_RESULT | Pass |

Runner lives at `apps/api-core/src/utility/reprice-algo/__tests__/golden-files/runner.test.ts`.
Scenarios live under `apps/api-core/src/utility/reprice-algo/__tests__/golden-files/scenarios/`.

---

### Layer 3 Deviations

8. **Additional mocks for integration tests** — `repricer-rule-helper.ts` imports `../../config`, `../../filter-mapper`, and `../../../model/global-param`. `filter-mapper.ts` in turn imports `./mysql/mysql-helper` (ESM `@repricer-monorepo/shared`). Integration tests require mocks for `config`, `mysql/mysql-helper`, `mongo/db-helper`, and `global-param` — docs did not mention `mysql/mysql-helper`.

9. **`vendorId` TypeScript TS2783** — Builder's `.build()` produced `{ vendorId: '17357', ..., vendorId: 17357 }` (duplicate key from spread + explicit assignment). Fixed by ensuring the builder only sets `vendorId` once.

### Layer 4 Deviations

10. **V2 runner requires 4 mocks** — Docs stated `repriceProductV2` is a pure function needing no mocks. In practice, transitive imports require mocking: `@repricer-monorepo/shared` (ESM package), `../../config` (Zod parse at module load), `knex-wrapper` (DB connection), and `../../mysql/mySql-mapper` (imports ESM package).

11. **`Array.prototype.toSorted` polyfill** — `algorithm.ts` line 1533 uses `.toSorted()` which requires Node.js 20+. Server runs Node 18.19.1. Runner adds a polyfill at the top of the test file.

12. **V2 sister detection requires all own vendors enabled** — The docs' runner template set `enabled: false` for non-own vendor settings. However, V2's sister detection (`algorithm.ts:495`) checks `availableVendorIds`, which only includes vendors with `enabled: true`. Runner must enable ALL own vendor IDs (not just `ownVendorId`) for sister/compete-all scenarios (04, 29) to work correctly.

---

## Phase 3: Layers 5-7 (COMPLETE)

**Status:** Done
**Date completed:** 2026-02-19
**Total:** 4 test suites (2 skipped by default), 32 tests (6 skipped by default)

---

### Layer 5 — Invariant Tests (1 file + 1 arbitrary file, 10 tests)

| # | File | Invariant | Tests | Status |
|---|------|-----------|-------|--------|
| 1 | `pricing-invariants.test.ts` | Floor Price (single + multi) | 2 | Pass |
| 2 | | Max Price | 1 | Pass |
| 3 | | Direction Rule 0 — Only Up (single + multi) | 2 | Pass |
| 4 | | Direction Rule 1 — Only Down (single + multi) | 2 | Pass |
| 5 | | Q-Break Hierarchy | 1 | Pass |
| 6 | | Offset Consistency (plain + percentage) | 2 | Pass |

Support file: `arbitraries.ts` — custom fast-check generators (`arbPrice`, `arbRepriceData`, `arbSingleBreakRepriceModel`, `arbMultiBreakRepriceModel`, `arbDownwardPriceMove`, `arbUpwardPriceMove`).

All Layer 5 tests live under `apps/api-core/src/utility/reprice-algo/__tests__/invariants/`.

---

### Layer 6 — Backtesting Framework (8 files, 6 tests — skipped by default)

| # | File | Purpose | Status |
|---|------|---------|--------|
| 1 | `types.ts` | Type definitions (`BacktestRecord`, `BacktestDiff`, `WhatIfReport`, etc.) | Done |
| 2 | `extract-data.ts` | DB extraction + snapshot load/save | Done |
| 3 | `replay-algo.ts` | Bridge: `BacktestRecord` → `repriceProductV2()` inputs | Done |
| 4 | `regression-runner.ts` | Mode 1: Regression comparison logic + formatting | Done |
| 5 | `what-if-runner.ts` | Mode 2: What-if comparison logic + formatting | Done |
| 6 | `regression.test.ts` | Jest test: regression backtest (2 tests, skipped) | Done |
| 7 | `what-if.test.ts` | Jest test: what-if scenarios (4 tests, skipped) | Done |
| 8 | `create-snapshot.ts` | Standalone script: create offline JSON snapshot | Done |

Tests require `BACKTEST_ENABLED=true` and MySQL access (or a JSON snapshot via `BACKTEST_SNAPSHOT`).

All Layer 6 files live under `apps/api-core/src/utility/reprice-algo/__tests__/backtest/`.

---

### Layer 7 — Cross-Algorithm Tests (5 files, 22 tests)

| # | File | Purpose | Tests | Status |
|---|------|---------|-------|--------|
| 1 | `normalized-types.ts` | Common interfaces: `NormalizedDecision`, `AlgoRunner`, `AlgoInput`, `VendorConfig` | — | Done |
| 2 | `v1-adapter.ts` | Normalizes V1 `RepriceModel` output; maps `explained` strings to categories | — | Done |
| 3 | `v2-adapter.ts` | Adapts `repriceProductV2()` output to `NormalizedDecision[]` | — | Done |
| 4 | `shared-suite.ts` | Universal test suite: floor, max, direction, sister, undercut (7 tests) | 7 | Done |
| 5 | `comparison.test.ts` | V2 universal tests + V1 normalization tests + V1-vs-V2 comparison | 22 | Pass |

All Layer 7 files live under `apps/api-core/src/utility/reprice-algo/__tests__/cross-algo/`.

---

### Phase 3 Deviations

13. **Invariant 5 surviving break filter** — Docs' filter checked only `d.active !== false` for "surviving" breaks and used `d.oldPrice` as fallback for suppressed breaks. But `ApplyMultiPriceBreakRule` sets `newPrice = "N/A"` without changing `active` when suppressing, so suppressed breaks passed through. Fixed by adding `d.newPrice !== "N/A" && d.newPrice !== null` to the surviving filter and using `parseFloat(d.newPrice)` directly.

14. **V1 adapter `#SupressQbreakrule` typo** — V1 production code uses the misspelled tag `#SupressQbreakrule` (single 'P' in "Supress"). Docs' adapter checked for `#SUPPRESSQBREAKRULE` (double 'P'). Fixed by checking for both spellings.

15. **Cross-algo tests require same mocks as Layer 4** — `comparison.test.ts` imports V2 adapter which transitively imports `@repricer-monorepo/shared` (ESM), `config.ts` (Zod parse), `knex-wrapper`, and `mySql-mapper`. Same 4 mocks as the golden-files runner are required. Also needs the `toSorted` polyfill for Node 18.

---

## How to Run

```bash
cd apps/api-core

# All tests
npx jest --testPathPatterns='__tests__' --verbose

# Layer 1 only (rules)
npx jest --testPathPatterns='__tests__/v1/rules' --verbose

# Layer 2 only (filters)
npx jest --testPathPatterns='__tests__/v1/filters' --verbose

# Layer 3 only (V1 integration)
npx jest --testPathPatterns='__tests__/v1/integration' --verbose

# Layer 4 only (V2 golden files)
npx jest --testPathPatterns='__tests__/golden-files' --verbose

# Layer 5 only (invariants)
npx jest --testPathPatterns='__tests__/invariants' --verbose

# Layer 6 only (backtesting — requires BACKTEST_ENABLED=true)
BACKTEST_ENABLED=true npx jest --testPathPatterns='backtest' --verbose

# Layer 7 only (cross-algo)
npx jest --testPathPatterns='cross-algo' --verbose

# Single file
npx jest src/utility/reprice-algo/__tests__/v1/rules/direction-rule.test.ts --verbose
```
