# Repricer Algorithm Testing Strategy

> **Purpose**: This document is the single entry point for implementing the algo testing framework.
> Each layer has its own detailed doc in `docs/testing/`. This overview explains what, why, and the order of execution.

## Quick Start

```bash
# From repo root
cd apps/api-core

# Install new dev dependency (only one needed)
npm install --save-dev fast-check

# Run all algo tests
npx jest --testPathPattern='__tests__'

# Run a specific layer
npx jest --testPathPattern='__tests__/v1/rules'
npx jest --testPathPattern='__tests__/v1/filters'
npx jest --testPathPattern='__tests__/v1/integration'
npx jest --testPathPattern='__tests__/golden-files'
npx jest --testPathPattern='__tests__/invariants'
```

## What Exists Today

| Item | Status |
|------|--------|
| Test runner | Jest 30.0.4 + ts-jest 29.4.0 (already installed) |
| Jest config | `apps/api-core/jest.config.js` (exists, minimal) |
| Existing tests | 1 file: `v2/v2.test.ts` — test is commented out |
| fast-check | Not installed (needs `npm install --save-dev fast-check`) |

## What We're Building

**7 layers** of tests, each independent, each adding value on its own:

| Layer | Doc | What | Depends On |
|-------|-----|------|------------|
| 0 | [00-setup.md](testing/00-setup.md) | Project setup, builders, matchers | Nothing |
| 1 | [01-unit-tests.md](testing/01-unit-tests.md) | Unit tests for each rule function | Layer 0 |
| 2 | [02-filter-tests.md](testing/02-filter-tests.md) | Filter/eligibility tests | Layer 0 |
| 3 | [03-integration-tests.md](testing/03-integration-tests.md) | Full pipeline with mocked externals | Layer 0 |
| 4 | [04-golden-files.md](testing/04-golden-files.md) | Data-driven scenario tests from JSON | Layer 0 |
| 5 | [05-invariant-tests.md](testing/05-invariant-tests.md) | Property-based tests with fast-check | Layer 0 |
| 6 | [06-backtesting.md](testing/06-backtesting.md) | Replay historical data | Layer 0 |
| 7 | [07-cross-algo.md](testing/07-cross-algo.md) | V1 vs V2 comparison + future algo support | Layer 0 |

## Zero Impact on Existing Code

All tests are in new `__tests__/` directories. **No existing files are modified.** Tests import existing functions and types directly — they don't change them.

The only change to existing files: none. The only new dependency: `fast-check` (dev only, for Layer 5).

## Directory Structure

All new files go under:
```
apps/api-core/src/utility/reprice-algo/__tests__/
```

```
__tests__/
  infrastructure/                    # LAYER 0: Shared test utilities
    builders/
      net32-product.builder.ts       # Build Net32Product (sensible defaults)
      frontier-product.builder.ts    # Build FrontierProduct (77 fields, all defaulted)
      reprice-model.builder.ts       # Build RepriceModel / RepriceData
      v2-settings.builder.ts         # Build V2AlgoSettingsData
    matchers/
      pricing.matchers.ts            # Custom Jest matchers (toBeRepriced, etc.)
    types.ts                         # Shared test types
  v1/
    rules/                           # LAYER 1: One file per rule
      direction-rule.test.ts
      floor-check.test.ts
      max-price-check.test.ts
      multi-price-break.test.ts
      buy-box.test.ts
      keep-position.test.ts
      suppress-price-break.test.ts
      beat-q-price.test.ts
      percentage-price.test.ts
      deactivate-q-break.test.ts
      sister-comparison.test.ts
      badge-percentage-down.test.ts
      align-is-repriced.test.ts
      new-break-activation.test.ts
      express-cron-override.test.ts
    filters/                         # LAYER 2: One file per filter
      excluded-vendor.test.ts
      inventory-threshold.test.ts
      handling-time.test.ts
      badge-indicator.test.ts
      phantom-price-break.test.ts
      sister-vendor-exclusion.test.ts
      context-price.test.ts
      subtract-percentage.test.ts
      # NOTE: short-expiry — isNotShortExpiryProduct is a private function
      #   (not exported). Test indirectly via integration tests (Layer 3)
      #   or export it first if direct testing is desired.
    integration/                     # LAYER 3: Full pipeline tests
      standard-mode.test.ts
      nc-mode.test.ts
      multi-price-break.test.ts
  v2/                               # V2-specific tests (DEFERRED — V1 first)
    strategies/                      # Planned: test each price strategy
      unit-strategy.test.ts
      total-strategy.test.ts
      buy-box-strategy.test.ts
    filters/
      competition-filters.test.ts
    rules/
      up-down-restriction.test.ts
      keep-position.test.ts
    # NOTE: V2 unit tests do not have a dedicated layer doc yet.
    # The V2 algo is a pure function tested via Layers 4 (golden files),
    # 5 (invariants), and 7 (cross-algo). Dedicated V2 unit test docs
    # will be added after V1 testing is complete.
  golden-files/                      # LAYER 4: Data-driven scenarios
    runner.test.ts
    scenarios/                       # JSON fixtures
      01-no-competitor.json
      02-own-lowest.json
      03-hit-floor.json
      ... (60+ files)
  invariants/                        # LAYER 5: Property-based
    pricing-invariants.test.ts
    arbitraries.ts
  backtest/                          # LAYER 6: Historical replay
    extract-data.ts
    regression-runner.ts
    regression.test.ts
  cross-algo/                        # LAYER 7: V1 vs V2
    normalized-types.ts
    v1-adapter.ts
    v2-adapter.ts
    comparison.test.ts
```

## Source Files Being Tested

All source files are under `apps/api-core/src/`. Relative paths from `__tests__/`:

| Source File | What It Contains |
|-------------|-----------------|
| `../v1/repricer-rule-helper.ts` | 15 rule functions (ApplyFloorCheckRule, ApplyBuyBoxRule, etc.) |
| `../v1/reprice-helper.ts` | Standard mode: Reprice(), RepriceIndividualPriceBreak() |
| `../v1/reprice-helper-nc.ts` | NC mode: Reprice(), RepriceIndividualPriceBreak() |
| `../v1/algo-v1.ts` | Entry point: repriceProduct(), repriceProductToMax() |
| `../v1/shared.ts` | Utilities: isPriceUpdateRequired(), getIsFloorReached() |
| `../../filter-mapper.ts` | FilterBasedOnParams(), GetContextPrice() |
| `../../../../model/reprice-model.ts` | RepriceModel class, RepriceData class |
| `../../../../model/reprice-renewed-message.ts` | RepriceRenewedMessageEnum |
| `../../../../types/net32.ts` | Net32Product, Net32PriceBreak interfaces |
| `../../../../types/frontier.ts` | FrontierProduct interface |
| `../v2/algorithm.ts` | repriceProductV2(), hasBadge(), getShippingBucket() |
| `../v2/settings.ts` | applyCompetitionFilters(), applyUpDownRestriction() |
| `../v2/types.ts` | AlgoResult, ChangeResult, Net32AlgoProduct |

## Implementation Order

**Phase 1 (Foundation — do first):**
- Layer 0: Setup + builders + matchers
- Layer 1: Unit tests for all 15 rule functions
- Layer 2: Filter tests

**Phase 2 (Integration — do second):**
- Layer 3: Pipeline integration tests
- Layer 4: Golden file scenarios

**Phase 3 (Advanced — do third):**
- Layer 5: Property-based invariant tests
- Layer 6: Backtesting framework
- Layer 7: Cross-algo comparison

Each phase is independently valuable. Phase 1 alone catches most regressions.

## How to Verify Each Layer Works

After implementing each layer, verify:

```bash
# Layer 0: Builders compile
npx jest --testPathPattern='__tests__/infrastructure' --passWithNoTests

# Layer 1: All rules tested (~75 tests)
npx jest --testPathPattern='__tests__/v1/rules' --verbose

# Layer 2: All filters tested (~30 tests)
npx jest --testPathPattern='__tests__/v1/filters' --verbose

# Layer 3: Pipeline tests pass (~20 tests)
npx jest --testPathPattern='__tests__/v1/integration' --verbose

# Layer 4: All golden files pass
npx jest --testPathPattern='__tests__/golden-files' --verbose

# Layer 5: Invariants hold for 1000 random inputs
npx jest --testPathPattern='__tests__/invariants' --verbose

# All together
npx jest --testPathPattern='__tests__' --coverage
```

## Detailed Layer Documentation

Each layer doc is self-contained — it includes:
- Exact file paths and import statements
- Complete function signatures being tested
- Every test case with full code
- How to run and verify

See the `docs/testing/` directory for all layer docs.
