# Layer 7: Cross-Algorithm Comparison Testing (V1 vs V2 and Future Algos)

> **Goal**: Create a portable abstraction layer that normalizes output from any algorithm version into a common format, enabling side-by-side comparison testing and instant test coverage for future algorithm implementations (V3+).
>
> **Files go under**: `apps/api-core/src/utility/reprice-algo/__tests__/cross-algo/`

---

## 7.0 Concept

V1 and V2 are architecturally different but share core pricing behaviors: floor enforcement, max price ceilings, direction rules, sister vendor handling, and own-vendor-is-lowest detection. This layer:

1. Normalizes outputs from both algos into a common `NormalizedDecision` format
2. Runs identical scenarios through both and compares results
3. Defines an `AlgoRunner` interface that future algos (V3+) can implement to get all universal tests for free

### Key Differences Between V1 and V2

| Aspect | V1 | V2 |
|--------|----|----|
| Entry point | `repriceProduct()` in `v1/algo-v1.ts` | `repriceProductV2()` in `v2/algorithm.ts` |
| Output type | `RepriceModel` (single result + `listOfRepriceDetails`) | `Net32AlgoSolutionWithQBreakValid[]` (array of solutions) |
| Decision strings | `RepriceRenewedMessageEnum` (freeform strings like `"IGNORE: #HitFloor"`) | `AlgoResult` enum (structured like `"CHANGE #UP"`, `"IGNORE #FLOOR"`) |
| Precision | JavaScript native floats | `Decimal.js` throughout |
| Config scope | Per-product (`FrontierProduct` with 77+ fields) | Per-vendor (`V2AlgoSettingsData` with typed fields) |
| Price strategy | Standard vs NC (no-charge shipping) | `UNIT` vs `TOTAL` vs `BUY_BOX` (via `AlgoPriceStrategy` enum) |
| Tags | `#HitFloor`, `#Sister`, `#DOWN`, `#HasBuyBox`, `#LOGICALERROR` | `#FLOOR`, `#SISTER_LOWEST`, `#SETTINGS`, `#SHORT_EXPIRY` |
| Side effects | Writes to DB (history, status, etc.) | Pure function (no DB calls in algo core) |
| Async | `async` (calls DB helpers, filter-mapper) | Synchronous (pure computation) |

---

## 7.1 File: `normalized-types.ts`

This defines the common format that all algo adapters must produce. Every field is algo-agnostic.

```typescript
// apps/api-core/src/utility/reprice-algo/__tests__/cross-algo/normalized-types.ts

/**
 * Normalized category that abstracts away V1's freeform strings and V2's enum.
 * Each category maps to a semantic decision class.
 */
export type NormalizedCategory =
  | 'CHANGE_UP'
  | 'CHANGE_DOWN'
  | 'CHANGE_NEW'
  | 'CHANGE_REMOVED'
  | 'IGNORE_FLOOR'
  | 'IGNORE_LOWEST'
  | 'IGNORE_SISTER'
  | 'IGNORE_SETTINGS'
  | 'IGNORE_BUYBOX'
  | 'IGNORE_EXPIRY'
  | 'IGNORE_OTHER'
  | 'ERROR';

/**
 * A single pricing decision in a common format.
 * Both V1 and V2 adapters produce arrays of these.
 */
export interface NormalizedDecision {
  /** The vendor ID this decision applies to */
  vendorId: number;
  /** The quantity break (minQty) this decision applies to */
  quantity: number;
  /** The existing unit price before any change */
  existingPrice: number;
  /** The suggested new unit price, or null if no change */
  suggestedPrice: number | null;
  /** Whether a price change should be executed */
  shouldChange: boolean;
  /** The semantic category of this decision */
  category: NormalizedCategory;
  /** Raw tags/annotations from the algo (e.g. "#HitFloor", "#Sister") */
  tags: string[];
  /** The raw explanation string from the original algo */
  rawExplained: string;
}

/**
 * Common input format for running any algo.
 * Adapters translate this into whatever their algo needs.
 */
export interface AlgoInput {
  /** Net32 marketplace product ID */
  mpId: number;
  /**
   * Raw Net32 API product data. Use the Net32AlgoProduct shape
   * (V2 format) as the canonical input -- V1 adapter translates internally.
   */
  net32Products: Net32AlgoProductInput[];
  /** All vendor IDs that belong to "our" company */
  allOwnVendorIds: number[];
  /** Vendor IDs that are not in a 422 error state */
  non422VendorIds: number[];
  /** Per-vendor configuration. Adapters map these to their native config format. */
  vendorConfigs: VendorConfig[];
  /** Whether this is a slow cron run */
  isSlowCron: boolean;
}

/**
 * Vendor-level configuration in a common format.
 * Covers the union of V1's FrontierProduct fields and V2's V2AlgoSettingsData.
 */
export interface VendorConfig {
  vendorId: number;
  vendorName: string;
  floorPrice: number;
  maxPrice: number;
  /** V1: repricingRule (0=UP, 1=DOWN, 2=BOTH). V2: AlgoPriceDirection enum. */
  direction: 'UP' | 'DOWN' | 'UP_DOWN';
  /** V2-specific: price strategy. V1 defaults to 'UNIT'. */
  priceStrategy: 'UNIT' | 'TOTAL' | 'BUY_BOX';
  enabled: boolean;
  /** Comma-separated sister vendor IDs */
  sisterVendorIds: string;
  /** Comma-separated excluded vendor IDs */
  excludeVendors: string;
  /** Whether to compete with all vendors including sisters */
  competeWithAllVendors: boolean;
  /** Floor compete with next: when at floor, try to compete with next vendor */
  floorCompeteWithNext: boolean;
  /** Inventory threshold for own vendor */
  ownVendorThreshold: number;
  /** Inventory competition threshold for competitors */
  inventoryCompetitionThreshold: number;
  /** Standard shipping cost for this vendor */
  standardShipping: number;
  /** Free shipping threshold */
  freeShippingThreshold: number;
}

/**
 * Net32 product data in the canonical format (matches V2's Net32AlgoProduct).
 * V1 adapter converts this to V1's Net32Product internally.
 */
export interface Net32AlgoProductInput {
  vendorId: number;
  vendorName: string;
  inStock: boolean;
  standardShipping: number;
  shippingTime: number;
  inventory: number;
  badgeId: number;
  badgeName: string | null;
  priceBreaks: { minQty: number; unitPrice: number }[];
  freeShippingGap: number;
  freeShippingThreshold: number;
}

/**
 * The interface that any algorithm version must implement.
 * Implementing this grants access to all universal tests via `runSharedAlgoTests()`.
 */
export interface AlgoRunner {
  /** Human-readable name for test output (e.g. "V1", "V2", "V3-experimental") */
  name: string;
  /** Execute the algorithm and return normalized decisions */
  run(input: AlgoInput): Promise<NormalizedDecision[]>;
}
```

### Key Design Decisions

- `Net32AlgoProductInput` uses the V2 shape as canonical because V2 is a strict subset of the raw API response. V1 has extra fields (`vendorProductId`, `vendorRegion`, etc.) that are not used by the core pricing logic.
- `VendorConfig` is the union of V1's `FrontierProduct` config fields and V2's `V2AlgoSettingsData`, covering only fields relevant to pricing decisions.
- `suggestedPrice` is always a plain `number` (not `Decimal.js`) since this is a comparison layer; precision differences are handled by tolerance assertions.

---

## 7.2 File: `v2-adapter.ts`

The V2 adapter is simpler because `repriceProductV2()` is a pure synchronous function. It directly maps `AlgoResult` to `NormalizedCategory`.

```typescript
// apps/api-core/src/utility/reprice-algo/__tests__/cross-algo/v2-adapter.ts

import {
  AlgoBadgeIndicator,
  AlgoHandlingTimeGroup,
  AlgoPriceDirection,
  AlgoPriceStrategy,
} from '@repricer-monorepo/shared';
import { repriceProductV2 } from '../../v2/algorithm';
import { AlgoResult } from '../../v2/types';
import { V2AlgoSettingsData } from '../../../../utility/mysql/v2-algo-settings';
import { VendorThreshold } from '../../v2/shipping-threshold';
import {
  AlgoInput,
  AlgoRunner,
  NormalizedCategory,
  NormalizedDecision,
  VendorConfig,
} from './normalized-types';

/**
 * Maps V2 AlgoResult enum values to normalized categories.
 */
function mapAlgoResultToCategory(result: AlgoResult): NormalizedCategory {
  switch (result) {
    case AlgoResult.CHANGE_UP:
      return 'CHANGE_UP';
    case AlgoResult.CHANGE_DOWN:
      return 'CHANGE_DOWN';
    case AlgoResult.CHANGE_NEW:
      return 'CHANGE_NEW';
    case AlgoResult.CHANGE_REMOVED:
      return 'CHANGE_REMOVED';
    case AlgoResult.IGNORE_FLOOR:
      return 'IGNORE_FLOOR';
    case AlgoResult.IGNORE_LOWEST:
      return 'IGNORE_LOWEST';
    case AlgoResult.IGNORE_SISTER_LOWEST:
      return 'IGNORE_SISTER';
    case AlgoResult.IGNORE_SETTINGS:
      return 'IGNORE_SETTINGS';
    case AlgoResult.IGNORE_SHORT_EXPIRY:
      return 'IGNORE_EXPIRY';
    case AlgoResult.ERROR:
      return 'ERROR';
    default:
      return 'ERROR';
  }
}

/**
 * Extracts tags from AlgoResult string (e.g. "CHANGE #UP" -> ["#UP"]).
 */
function extractTagsFromAlgoResult(result: AlgoResult): string[] {
  const tags: string[] = [];
  const match = result.match(/#\w+/g);
  if (match) {
    tags.push(...match);
  }
  return tags;
}

/**
 * Convert a common VendorConfig to V2's V2AlgoSettingsData.
 */
function vendorConfigToV2Settings(
  mpId: number,
  config: VendorConfig,
): V2AlgoSettingsData {
  let upDown: AlgoPriceDirection;
  switch (config.direction) {
    case 'UP':
      upDown = AlgoPriceDirection.UP;
      break;
    case 'DOWN':
      upDown = AlgoPriceDirection.DOWN;
      break;
    case 'UP_DOWN':
    default:
      upDown = AlgoPriceDirection.UP_DOWN;
      break;
  }

  let priceStrategy: AlgoPriceStrategy;
  switch (config.priceStrategy) {
    case 'TOTAL':
      priceStrategy = AlgoPriceStrategy.TOTAL;
      break;
    case 'BUY_BOX':
      priceStrategy = AlgoPriceStrategy.BUY_BOX;
      break;
    case 'UNIT':
    default:
      priceStrategy = AlgoPriceStrategy.UNIT;
      break;
  }

  return {
    mp_id: mpId,
    vendor_id: config.vendorId,
    suppress_price_break_if_Q1_not_updated: false,
    suppress_price_break: false,
    compete_on_price_break_only: false,
    up_down: upDown,
    badge_indicator: AlgoBadgeIndicator.ALL,
    execution_priority: 0,
    reprice_up_percentage: -1,
    compare_q2_with_q1: false,
    compete_with_all_vendors: config.competeWithAllVendors,
    reprice_up_badge_percentage: -1,
    sister_vendor_ids: config.sisterVendorIds,
    exclude_vendors: config.excludeVendors,
    inactive_vendor_id: '',
    handling_time_group: AlgoHandlingTimeGroup.ALL,
    keep_position: false,
    inventory_competition_threshold: config.inventoryCompetitionThreshold,
    reprice_down_percentage: -1,
    max_price: config.maxPrice,
    floor_price: config.floorPrice,
    reprice_down_badge_percentage: -1,
    floor_compete_with_next: config.floorCompeteWithNext,
    own_vendor_threshold: config.ownVendorThreshold,
    price_strategy: priceStrategy,
    enabled: config.enabled,
  };
}

/**
 * Build VendorThreshold objects from input data.
 * V2 uses these for TOTAL price strategy lowest-vendor calculation.
 */
function buildVendorThresholds(input: AlgoInput): VendorThreshold[] {
  return input.net32Products.map((p) => ({
    vendorId: p.vendorId,
    standardShipping: p.standardShipping,
    threshold: p.freeShippingThreshold,
  }));
}

export class V2Adapter implements AlgoRunner {
  name = 'V2';

  async run(input: AlgoInput): Promise<NormalizedDecision[]> {
    const vendorSettings = input.vendorConfigs
      .filter((vc) => input.allOwnVendorIds.includes(vc.vendorId))
      .map((vc) => vendorConfigToV2Settings(input.mpId, vc));

    const vendorThresholds = buildVendorThresholds(input);

    // repriceProductV2 is synchronous but we return a Promise for the interface
    const results = repriceProductV2(
      input.mpId,
      input.net32Products,
      input.non422VendorIds,
      input.allOwnVendorIds,
      vendorSettings,
      'test-job-id',
      input.isSlowCron,
      `https://www.net32.com/rest/marketplace/product/${input.mpId}`,
      vendorThresholds,
    );

    // results is an array of Net32AlgoSolutionWithQBreakValid (with html appended)
    // Each has: vendor, quantity, algoResult, suggestedPrice, comment, qBreakValid
    return results.map((r) => {
      // Find the existing price for this vendor + quantity from the input data
      const vendorProduct = input.net32Products.find(
        (p) => p.vendorId === r.vendor.vendorId,
      );
      const existingBreak = vendorProduct?.priceBreaks.find(
        (pb) => pb.minQty <= r.quantity,
      );
      // Get the highest price break <= quantity (matching V2's internal logic)
      const existingPrice = vendorProduct?.priceBreaks
        .filter((pb) => pb.minQty <= r.quantity)
        .sort((a, b) => b.minQty - a.minQty)[0]?.unitPrice ?? 0;

      const category = mapAlgoResultToCategory(r.algoResult);
      const shouldChange = category.startsWith('CHANGE');

      return {
        vendorId: r.vendor.vendorId,
        quantity: r.quantity,
        existingPrice,
        suggestedPrice: r.suggestedPrice,
        shouldChange,
        category,
        tags: extractTagsFromAlgoResult(r.algoResult),
        rawExplained: `${r.algoResult}: ${r.comment}`,
      };
    });
  }
}
```

### Why V2 Adapter is Straightforward

- `repriceProductV2()` is a pure function: no DB calls, no side effects.
- `AlgoResult` is a well-structured enum that maps 1:1 to `NormalizedCategory`.
- The return type includes `suggestedPrice` as a plain number (already converted from `Decimal.js`).

---

## 7.3 File: `v1-adapter.ts`

The V1 adapter is more complex because:
- `repriceProduct()` is `async` and calls DB helpers, history writers, etc.
- It produces `RepriceModel` with freeform `explained` strings.
- It requires mocking of many external dependencies.

**Strategy**: Instead of calling `repriceProduct()` (which has too many side effects), we mock V1 at a higher level by directly exercising the V1 helper functions that do the actual pricing logic, or we build a "V1-lite" that strips out the side effects.

The more practical approach: **Map V1 `explained` strings to categories** and provide a mock-based runner.

```typescript
// apps/api-core/src/utility/reprice-algo/__tests__/cross-algo/v1-adapter.ts

import {
  AlgoInput,
  AlgoRunner,
  NormalizedCategory,
  NormalizedDecision,
  VendorConfig,
} from './normalized-types';

/**
 * Maps V1 "explained" strings (from RepriceRenewedMessageEnum and RepriceMessageEnum)
 * to normalized categories.
 *
 * V1 explained strings are freeform and may be concatenated with "_" separators.
 * We check from most-specific to least-specific.
 *
 * Reference for V1 explained strings:
 *   RepriceRenewedMessageEnum (apps/api-core/src/model/reprice-renewed-message.ts)
 *   RepriceMessageEnum (apps/api-core/src/model/reprice-message.ts)
 */
export function mapV1ExplainedToCategory(
  explained: string | null,
  isRepriced: boolean,
  oldPrice: number,
  newPrice: string | number | null,
): NormalizedCategory {
  if (!explained) return 'ERROR';
  const upper = explained.toUpperCase();

  // --- IGNORE categories ---

  // Floor-related ignores (check before generic IGNORE)
  if (upper.includes('IGNORE') && upper.includes('#HITFLOOR')) {
    return 'IGNORE_FLOOR';
  }
  if (upper.includes('IGNORE') && upper.includes('#LOGICALERROR')) {
    return 'IGNORE_FLOOR'; // Logical error means price fell below floor
  }

  // Sister vendor ignore
  if (upper.includes('IGNORE') && upper.includes('#SISTER')) {
    return 'IGNORE_SISTER';
  }
  if (upper.includes('IGNORE') && upper.includes('SISTER VENDOR')) {
    return 'IGNORE_SISTER';
  }

  // Buy box ignore
  if (upper.includes('IGNORE') && upper.includes('#HASBUYBOX')) {
    return 'IGNORE_BUYBOX';
  }

  // Own vendor is lowest
  if (upper.includes('IGNORE') && upper.includes('#LOWEST')) {
    return 'IGNORE_LOWEST';
  }
  if (upper.includes('IGNORE') && upper.includes('ALREADY THE LOWEST')) {
    return 'IGNORE_LOWEST';
  }

  // Direction rule ignores
  if (upper.includes('IGNORE') && upper.includes('#DOWN')) {
    // "IGNORED: Price up only #DOWN" means set to UP only, tried to go DOWN
    return 'IGNORE_SETTINGS';
  }
  if (upper.includes('IGNORE') && upper.includes('#UP')) {
    // "IGNORED: Price down only #UP" means set to DOWN only, tried to go UP
    return 'IGNORE_SETTINGS';
  }

  // Settings-related ignores (suppress, keep position, etc.)
  if (upper.includes('IGNORE') && upper.includes('#SUPPRESSQBREAKRULE')) {
    return 'IGNORE_SETTINGS';
  }
  if (upper.includes('IGNORE') && upper.includes('#KEEPPOSITION')) {
    return 'IGNORE_SETTINGS';
  }
  if (upper.includes('IGNORE') && upper.includes('#COMPETEONQBREAKSONLY')) {
    return 'IGNORE_SETTINGS';
  }
  if (upper.includes('IGNORE') && upper.includes('NOT FOUND IN API')) {
    return 'IGNORE_OTHER';
  }
  if (upper.includes('IGNORE') && upper.includes('NOT IN STOCK')) {
    return 'IGNORE_OTHER';
  }
  if (upper.includes('IGNORE') && upper.includes('#OTHERBREAKSLOWER')) {
    return 'IGNORE_SETTINGS';
  }

  // Generic ignore (catch-all for any remaining IGNORE)
  if (upper.includes('IGNORE') && !isRepriced) {
    return 'IGNORE_OTHER';
  }

  // --- CHANGE categories ---

  if (upper.includes('CHANGE') || isRepriced) {
    // New price break
    if (upper.includes('NEW BREAK') || upper.includes('#NEW')) {
      return 'CHANGE_NEW';
    }
    // QBreak made inactive
    if (upper.includes('INACTIVE')) {
      return 'CHANGE_REMOVED';
    }
    // Determine direction from price comparison
    const numericNew =
      typeof newPrice === 'number'
        ? newPrice
        : newPrice !== null && newPrice !== 'N/A'
          ? parseFloat(newPrice)
          : null;
    if (numericNew !== null && !isNaN(numericNew)) {
      if (numericNew < oldPrice) return 'CHANGE_DOWN';
      if (numericNew > oldPrice) return 'CHANGE_UP';
    }
    // If MAXED, it is going up
    if (upper.includes('MAXED')) {
      return 'CHANGE_UP';
    }
    return 'CHANGE_DOWN'; // Default change direction if ambiguous
  }

  return 'ERROR';
}

/**
 * Extracts tags from V1 explained strings.
 * V1 uses tags like #HitFloor, #Sister, #DOWN, #UP, #HasBuyBox, etc.
 */
export function extractV1Tags(explained: string | null): string[] {
  if (!explained) return [];
  const tags: string[] = [];
  const match = explained.match(/#\w+/g);
  if (match) {
    tags.push(...match);
  }
  return tags;
}

/**
 * V1 Adapter for cross-algo testing.
 *
 * IMPORTANT: V1's repriceProduct() has deep side effects (DB writes, HTTP calls,
 * history updates). This adapter does NOT call the actual V1 entry point.
 *
 * Instead, it works in one of two modes:
 *
 * 1. **Pre-computed mode** (default): You provide V1 results as pre-computed
 *    RepriceModel data (e.g. from golden file snapshots or recorded cron runs).
 *    The adapter just normalizes them.
 *
 * 2. **Mock mode**: A future enhancement where V1's DB/HTTP dependencies are
 *    fully mocked, allowing the actual algo to run. This requires mocking:
 *    - globalParam.GetInfo()
 *    - filterMapper.FilterBasedOnParams()
 *    - filterMapper.GetContextPrice()
 *    - mySqlHelper.* (all DB writes)
 *    - axiosHelper.* (HTTP calls)
 *    - HistoryHelper.Execute()
 *
 * For comparison testing, pre-computed mode is recommended because it isolates
 * the normalization logic from V1's complex dependency chain.
 */
export class V1Adapter implements AlgoRunner {
  name = 'V1';

  /**
   * Pre-computed V1 results to normalize.
   * Structure mirrors RepriceModel.listOfRepriceDetails or repriceDetails.
   */
  private precomputedResults: V1PrecomputedResult[] = [];

  constructor(precomputedResults?: V1PrecomputedResult[]) {
    this.precomputedResults = precomputedResults ?? [];
  }

  /**
   * Set pre-computed results for a specific scenario.
   * Call this before run() to provide V1 output data.
   */
  setPrecomputedResults(results: V1PrecomputedResult[]): void {
    this.precomputedResults = results;
  }

  async run(input: AlgoInput): Promise<NormalizedDecision[]> {
    // In pre-computed mode, normalize the provided results
    return this.precomputedResults.map((result) => {
      const category = mapV1ExplainedToCategory(
        result.explained,
        result.isRepriced,
        result.oldPrice,
        result.newPrice,
      );

      const numericNew =
        typeof result.newPrice === 'number'
          ? result.newPrice
          : result.newPrice !== null && result.newPrice !== 'N/A'
            ? parseFloat(result.newPrice)
            : null;

      const suggestedPrice =
        numericNew !== null && !isNaN(numericNew) ? numericNew : null;

      return {
        vendorId: result.vendorId,
        quantity: result.minQty,
        existingPrice: result.oldPrice,
        suggestedPrice,
        shouldChange: result.isRepriced,
        category,
        tags: extractV1Tags(result.explained),
        rawExplained: result.explained ?? '',
      };
    });
  }
}

/**
 * Shape of a pre-computed V1 result.
 * Mirrors the relevant fields from RepriceData (apps/api-core/src/model/reprice-model.ts).
 */
export interface V1PrecomputedResult {
  vendorId: number;
  minQty: number;
  oldPrice: number;
  newPrice: string | number | null;
  isRepriced: boolean;
  explained: string | null;
  goToPrice?: string | number | null;
}
```

### Why Pre-computed Mode

V1's `repriceProduct()` (in `v1/algo-v1.ts`) calls:
- `globalParam.GetInfo()` (DB lookup for vendor-specific config)
- `filterMapper.FilterBasedOnParams()` (applies exclusion/threshold filters)
- `filterMapper.GetContextPrice()` (calculates offset price)
- `mySqlHelper.UpdateTriggeredByVendor()` (DB write)
- `HistoryHelper.Execute()` (DB write)
- `ResultParser.Parse()` + `mySqlHelper.UpdateRepriceResultStatus()` (DB write)
- `axiosHelper.postAsync()` (HTTP call to Net32 price update API)

Mocking all of these correctly is a significant effort. Pre-computed mode lets you:
1. Capture real V1 output from production/staging runs
2. Normalize it alongside V2 output for the same input
3. Compare decisions without touching V1's dependency chain

---

## 7.4 File: `shared-suite.ts`

A reusable test suite that any `AlgoRunner` can be tested against. These are **universal invariants** that every pricing algorithm must satisfy, regardless of version.

```typescript
// apps/api-core/src/utility/reprice-algo/__tests__/cross-algo/shared-suite.ts

import { AlgoInput, AlgoRunner, Net32AlgoProductInput, VendorConfig } from './normalized-types';

// ---------------------------------------------------------------------------
// Test-data builder helpers
// ---------------------------------------------------------------------------

/** Minimal competitor product with sensible defaults */
function makeCompetitor(overrides: Partial<Net32AlgoProductInput> = {}): Net32AlgoProductInput {
  return {
    vendorId: 9000,
    vendorName: 'Competitor A',
    inStock: true,
    standardShipping: 5,
    shippingTime: 2,
    inventory: 100,
    badgeId: 0,
    badgeName: null,
    priceBreaks: [{ minQty: 1, unitPrice: 10.00 }],
    freeShippingGap: 0,
    freeShippingThreshold: 100,
    ...overrides,
  };
}

/** Minimal "our vendor" product with sensible defaults */
function makeOwnVendor(overrides: Partial<Net32AlgoProductInput> = {}): Net32AlgoProductInput {
  return {
    vendorId: 100,
    vendorName: 'Our Vendor',
    inStock: true,
    standardShipping: 5,
    shippingTime: 2,
    inventory: 100,
    badgeId: 0,
    badgeName: null,
    priceBreaks: [{ minQty: 1, unitPrice: 12.00 }],
    freeShippingGap: 0,
    freeShippingThreshold: 100,
    ...overrides,
  };
}

/** Default vendor config for "our vendor" */
function makeVendorConfig(overrides: Partial<VendorConfig> = {}): VendorConfig {
  return {
    vendorId: 100,
    vendorName: 'Our Vendor',
    floorPrice: 5.00,
    maxPrice: 50.00,
    direction: 'UP_DOWN',
    priceStrategy: 'UNIT',
    enabled: true,
    sisterVendorIds: '',
    excludeVendors: '',
    competeWithAllVendors: false,
    floorCompeteWithNext: false,
    ownVendorThreshold: 1,
    inventoryCompetitionThreshold: 1,
    standardShipping: 5,
    freeShippingThreshold: 100,
    ...overrides,
  };
}

/** Build a complete AlgoInput from parts */
function makeInput(overrides: {
  ownVendor?: Partial<Net32AlgoProductInput>;
  competitors?: Partial<Net32AlgoProductInput>[];
  vendorConfig?: Partial<VendorConfig>;
  isSlowCron?: boolean;
} = {}): AlgoInput {
  const ownVendor = makeOwnVendor(overrides.ownVendor);
  const competitors = (overrides.competitors ?? [makeCompetitor()]).map(
    (c) => makeCompetitor(c),
  );
  const config = makeVendorConfig(overrides.vendorConfig);

  return {
    mpId: 12345,
    net32Products: [ownVendor, ...competitors],
    allOwnVendorIds: [ownVendor.vendorId],
    non422VendorIds: [ownVendor.vendorId],
    vendorConfigs: [config],
    isSlowCron: overrides.isSlowCron ?? false,
  };
}

// ---------------------------------------------------------------------------
// Shared test suite
// ---------------------------------------------------------------------------

/**
 * Runs universal algorithm tests against any AlgoRunner implementation.
 *
 * Usage:
 *   import { V2Adapter } from './v2-adapter';
 *   import { runSharedAlgoTests } from './shared-suite';
 *   runSharedAlgoTests(new V2Adapter());
 *
 * Future V3:
 *   import { V3Adapter } from './v3-adapter';
 *   runSharedAlgoTests(new V3Adapter());
 */
export function runSharedAlgoTests(runner: AlgoRunner) {
  describe(`${runner.name}: Universal Pricing Rules`, () => {

    // -----------------------------------------------------------------------
    // Floor enforcement
    // -----------------------------------------------------------------------
    it('should never suggest a price below floor', async () => {
      // Competitor is at $3, floor is $5.
      // Algo should NOT suggest a price below $5.
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 6.00 }],
        },
        competitors: [{
          vendorId: 9000,
          priceBreaks: [{ minQty: 1, unitPrice: 3.00 }],
        }],
        vendorConfig: { vendorId: 100, floorPrice: 5.00, maxPrice: 50.00 },
      });

      const decisions = await runner.run(input);
      for (const d of decisions) {
        if (d.suggestedPrice !== null) {
          expect(d.suggestedPrice).toBeGreaterThanOrEqual(5.00);
        }
        // If the algo cannot beat the competitor above floor, it should IGNORE
        if (d.category === 'IGNORE_FLOOR') {
          expect(d.shouldChange).toBe(false);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Max price enforcement
    // -----------------------------------------------------------------------
    it('should never suggest a price above max', async () => {
      // No competitors -> algo should price to max ($20), not above
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 10.00 }],
        },
        competitors: [], // No competitors at all
        vendorConfig: { vendorId: 100, floorPrice: 5.00, maxPrice: 20.00 },
      });

      const decisions = await runner.run(input);
      for (const d of decisions) {
        if (d.suggestedPrice !== null) {
          expect(d.suggestedPrice).toBeLessThanOrEqual(20.00);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Own vendor already lowest
    // -----------------------------------------------------------------------
    it('should detect when own vendor is already lowest', async () => {
      // Own vendor at $8, competitor at $12.
      // Own vendor is already winning -- algo should IGNORE.
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 8.00 }],
        },
        competitors: [{
          vendorId: 9000,
          priceBreaks: [{ minQty: 1, unitPrice: 12.00 }],
        }],
        vendorConfig: {
          vendorId: 100,
          floorPrice: 5.00,
          maxPrice: 50.00,
          direction: 'DOWN',
        },
      });

      const decisions = await runner.run(input);
      // At least one decision for Q1 should exist
      const q1Decisions = decisions.filter((d) => d.quantity === 1);
      expect(q1Decisions.length).toBeGreaterThan(0);

      for (const d of q1Decisions) {
        // Should be some form of IGNORE (IGNORE_LOWEST or IGNORE_SETTINGS for DOWN-only)
        expect(d.shouldChange).toBe(false);
      }
    });

    // -----------------------------------------------------------------------
    // Empty competitor list
    // -----------------------------------------------------------------------
    it('should handle empty competitor list gracefully', async () => {
      // Only our vendor on the board, no competitors.
      // Expected: price to max or maintain current price, no crash.
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 10.00 }],
        },
        competitors: [],
        vendorConfig: { vendorId: 100, floorPrice: 5.00, maxPrice: 25.00 },
      });

      // Should not throw
      const decisions = await runner.run(input);
      expect(decisions).toBeDefined();
      // Every decision should still respect floor/max
      for (const d of decisions) {
        if (d.suggestedPrice !== null) {
          expect(d.suggestedPrice).toBeGreaterThanOrEqual(5.00);
          expect(d.suggestedPrice).toBeLessThanOrEqual(25.00);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Direction rule: only UP
    // -----------------------------------------------------------------------
    it('should respect direction rule: only up', async () => {
      // Own vendor at $10, competitor at $8. Direction = UP only.
      // Algo wants to go down to beat competitor, but can't because UP only.
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 10.00 }],
        },
        competitors: [{
          vendorId: 9000,
          priceBreaks: [{ minQty: 1, unitPrice: 8.00 }],
        }],
        vendorConfig: {
          vendorId: 100,
          floorPrice: 5.00,
          maxPrice: 50.00,
          direction: 'UP',
        },
      });

      const decisions = await runner.run(input);
      const q1Decisions = decisions.filter((d) => d.quantity === 1);

      for (const d of q1Decisions) {
        if (d.shouldChange && d.suggestedPrice !== null) {
          // If there IS a change, it must be upward
          expect(d.suggestedPrice).toBeGreaterThanOrEqual(d.existingPrice);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Direction rule: only DOWN
    // -----------------------------------------------------------------------
    it('should respect direction rule: only down', async () => {
      // Own vendor at $8, no competitor (should go to max $50, but DOWN only prevents it).
      // Alternatively: own vendor at $15, competitor at $20. Would want to price up
      // to undercut $20, but DOWN only prevents pricing up.
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 15.00 }],
        },
        competitors: [{
          vendorId: 9000,
          priceBreaks: [{ minQty: 1, unitPrice: 20.00 }],
        }],
        vendorConfig: {
          vendorId: 100,
          floorPrice: 5.00,
          maxPrice: 50.00,
          direction: 'DOWN',
        },
      });

      const decisions = await runner.run(input);
      const q1Decisions = decisions.filter((d) => d.quantity === 1);

      for (const d of q1Decisions) {
        if (d.shouldChange && d.suggestedPrice !== null) {
          // If there IS a change, it must be downward or same
          expect(d.suggestedPrice).toBeLessThanOrEqual(d.existingPrice);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Sister vendor handling
    // -----------------------------------------------------------------------
    it('should handle sister vendor as lowest', async () => {
      // Sister vendor (200) is lowest at $7. Our vendor (100) is at $12.
      // With compete_with_all = false, algo should recognize sister is winning
      // and NOT try to undercut them.
      const sisterVendor = makeCompetitor({
        vendorId: 200,
        vendorName: 'Sister Vendor',
        priceBreaks: [{ minQty: 1, unitPrice: 7.00 }],
      });

      const externalCompetitor = makeCompetitor({
        vendorId: 9000,
        vendorName: 'External',
        priceBreaks: [{ minQty: 1, unitPrice: 15.00 }],
      });

      const input: AlgoInput = {
        mpId: 12345,
        net32Products: [
          makeOwnVendor({
            vendorId: 100,
            priceBreaks: [{ minQty: 1, unitPrice: 12.00 }],
          }),
          sisterVendor,
          externalCompetitor,
        ],
        allOwnVendorIds: [100, 200], // Both are "our" vendors
        non422VendorIds: [100, 200],
        vendorConfigs: [
          makeVendorConfig({
            vendorId: 100,
            competeWithAllVendors: false,
            sisterVendorIds: '200',
          }),
          makeVendorConfig({
            vendorId: 200,
            floorPrice: 5.00,
            maxPrice: 50.00,
            enabled: true,
          }),
        ],
        isSlowCron: false,
      };

      const decisions = await runner.run(input);
      const ourQ1 = decisions.filter(
        (d) => d.vendorId === 100 && d.quantity === 1,
      );

      // Sister is winning, we should not try to undercut
      for (const d of ourQ1) {
        if (d.category === 'IGNORE_SISTER') {
          expect(d.shouldChange).toBe(false);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Standard undercut scenario
    // -----------------------------------------------------------------------
    it('should undercut competitor when possible', async () => {
      // Own vendor at $12, competitor at $10.50, floor $5, max $50.
      // Should suggest a price just below $10.50.
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 12.00 }],
        },
        competitors: [{
          vendorId: 9000,
          priceBreaks: [{ minQty: 1, unitPrice: 10.50 }],
        }],
        vendorConfig: {
          vendorId: 100,
          floorPrice: 5.00,
          maxPrice: 50.00,
          direction: 'UP_DOWN',
        },
      });

      const decisions = await runner.run(input);
      const q1Decisions = decisions.filter((d) => d.quantity === 1);

      expect(q1Decisions.length).toBeGreaterThan(0);
      const changeDecisions = q1Decisions.filter((d) => d.shouldChange);

      if (changeDecisions.length > 0) {
        for (const d of changeDecisions) {
          expect(d.suggestedPrice).not.toBeNull();
          // Should be below competitor's price
          expect(d.suggestedPrice!).toBeLessThan(10.50);
          // Should still be above floor
          expect(d.suggestedPrice!).toBeGreaterThanOrEqual(5.00);
        }
      }
    });
  });
}
```

---

## 7.5 File: `comparison.test.ts`

This test file runs V2 through the shared suite and provides comparison tests for behaviors that must agree between V1 and V2.

```typescript
// apps/api-core/src/utility/reprice-algo/__tests__/cross-algo/comparison.test.ts

import { V2Adapter } from './v2-adapter';
import { V1Adapter, V1PrecomputedResult } from './v1-adapter';
import { runSharedAlgoTests } from './shared-suite';
import { AlgoInput, NormalizedDecision } from './normalized-types';

// ---------------------------------------------------------------------------
// Run the shared universal test suite against each algo
// ---------------------------------------------------------------------------

// V2 can run the full shared suite directly (pure function, no mocks needed)
runSharedAlgoTests(new V2Adapter());

// V1 shared suite is skipped by default because it requires pre-computed data.
// Uncomment and provide pre-computed results to enable:
// runSharedAlgoTests(new V1Adapter(precomputedResults));

// ---------------------------------------------------------------------------
// V1 normalization tests (test the mapping logic itself)
// ---------------------------------------------------------------------------

describe('V1 Adapter: explained string normalization', () => {
  const { mapV1ExplainedToCategory } = require('./v1-adapter');

  it('should map floor-related IGNORE strings to IGNORE_FLOOR', () => {
    expect(
      mapV1ExplainedToCategory('IGNORE: #HitFloor', false, 10, 'N/A'),
    ).toBe('IGNORE_FLOOR');
    expect(
      mapV1ExplainedToCategory('IGNORED : No Changes as Floor Price is hit #HitFloor', false, 10, 'N/A'),
    ).toBe('IGNORE_FLOOR');
    expect(
      mapV1ExplainedToCategory('IGNORE : Logical Error.Suggested Price Below Floor #LOGICALERROR', false, 10, 'N/A'),
    ).toBe('IGNORE_FLOOR');
    expect(
      mapV1ExplainedToCategory('IGNORE :#HitFloor', false, 10, 'N/A'),
    ).toBe('IGNORE_FLOOR');
  });

  it('should map sister vendor IGNORE strings to IGNORE_SISTER', () => {
    expect(
      mapV1ExplainedToCategory('IGNORE: #Sister #DOWN', false, 10, 'N/A'),
    ).toBe('IGNORE_SISTER');
    expect(
      mapV1ExplainedToCategory('IGNORE: #Sister', false, 10, 'N/A'),
    ).toBe('IGNORE_SISTER');
    expect(
      mapV1ExplainedToCategory('IGNORED : Next lowest vendor is the sister vendor #DOWN', false, 10, 'N/A'),
    ).toBe('IGNORE_SISTER');
    expect(
      mapV1ExplainedToCategory('IGNORED : Lowest vendor is the sister vendor', false, 10, 'N/A'),
    ).toBe('IGNORE_SISTER');
  });

  it('should map buy box IGNORE to IGNORE_BUYBOX', () => {
    expect(
      mapV1ExplainedToCategory('IGNORE : #HasBuyBox', false, 10, 'N/A'),
    ).toBe('IGNORE_BUYBOX');
  });

  it('should map lowest IGNORE strings to IGNORE_LOWEST', () => {
    expect(
      mapV1ExplainedToCategory('IGNORE: #Lowest', false, 10, 'N/A'),
    ).toBe('IGNORE_LOWEST');
    expect(
      mapV1ExplainedToCategory('IGNORE:#Lowest', false, 10, 'N/A'),
    ).toBe('IGNORE_LOWEST');
    expect(
      mapV1ExplainedToCategory('IGNORED : No change needed as vendor is already the lowest', false, 10, 'N/A'),
    ).toBe('IGNORE_LOWEST');
  });

  it('should map direction rule IGNORE strings to IGNORE_SETTINGS', () => {
    expect(
      mapV1ExplainedToCategory('IGNORED: Price up only #DOWN', false, 10, 'N/A'),
    ).toBe('IGNORE_SETTINGS');
    expect(
      mapV1ExplainedToCategory('IGNORED: Price down only #UP', false, 10, 'N/A'),
    ).toBe('IGNORE_SETTINGS');
  });

  it('should map suppress/keep-position IGNORE strings to IGNORE_SETTINGS', () => {
    expect(
      mapV1ExplainedToCategory('IGNORE: #SupressQbreakrule', false, 10, 'N/A'),
    ).toBe('IGNORE_SETTINGS');
    expect(
      mapV1ExplainedToCategory('IGNORE : #KeepPosition', false, 10, 'N/A'),
    ).toBe('IGNORE_SETTINGS');
    expect(
      mapV1ExplainedToCategory('IGNORE: #CompeteonQbreaksonly', false, 10, 'N/A'),
    ).toBe('IGNORE_SETTINGS');
  });

  it('should detect CHANGE_DOWN from price comparison', () => {
    // Old price 10, new price 8 -> CHANGE_DOWN
    expect(
      mapV1ExplainedToCategory('CHANGE: lowest validated', true, 10.00, 8.00),
    ).toBe('CHANGE_DOWN');
  });

  it('should detect CHANGE_UP from price comparison', () => {
    // Old price 10, new price 15 -> CHANGE_UP
    expect(
      mapV1ExplainedToCategory('CHANGE: lowest validated', true, 10.00, 15.00),
    ).toBe('CHANGE_UP');
  });

  it('should detect CHANGE_NEW', () => {
    expect(
      mapV1ExplainedToCategory('CHANGE: New Break created', true, 0, 10.00),
    ).toBe('CHANGE_NEW');
  });

  it('should detect CHANGE_REMOVED', () => {
    expect(
      mapV1ExplainedToCategory('CHANGE: QBreak made Inactive -no competitor', true, 10.00, 0),
    ).toBe('CHANGE_REMOVED');
    expect(
      mapV1ExplainedToCategory('CHANGE: QBreak made Inactive #Hitfloor', true, 10.00, 0),
    ).toBe('CHANGE_REMOVED');
  });

  it('should handle concatenated explained strings', () => {
    // V1 sometimes concatenates with "_"
    expect(
      mapV1ExplainedToCategory(
        'IGNORE :#HitFloor_IGNORED: Price up only #DOWN',
        false, 10, 'N/A',
      ),
    ).toBe('IGNORE_FLOOR'); // Most specific match wins (floor before settings)
  });

  it('should return ERROR for null explained', () => {
    expect(
      mapV1ExplainedToCategory(null, false, 10, 'N/A'),
    ).toBe('ERROR');
  });
});

// ---------------------------------------------------------------------------
// Side-by-side comparison tests (V1 pre-computed vs V2 live)
// ---------------------------------------------------------------------------

describe('V1 vs V2: Side-by-side comparison', () => {
  const v2Runner = new V2Adapter();

  /**
   * Helper: Run a scenario through V2 and compare against pre-computed V1 results.
   * Asserts that the high-level decision categories agree.
   */
  async function compareAlgos(
    input: AlgoInput,
    v1Results: V1PrecomputedResult[],
    options: {
      /** Allow price difference up to this tolerance (handles float vs Decimal.js) */
      priceTolerance?: number;
      /** Categories that are allowed to differ between V1 and V2 */
      allowedCategoryDifferences?: string[];
    } = {},
  ) {
    const priceTolerance = options.priceTolerance ?? 0.02;
    const allowedDiffs = new Set(options.allowedCategoryDifferences ?? []);

    const v1Adapter = new V1Adapter(v1Results);
    const v1Decisions = await v1Adapter.run(input);
    const v2Decisions = await v2Runner.run(input);

    // Group decisions by vendorId + quantity for comparison
    const v1Map = new Map<string, NormalizedDecision>();
    for (const d of v1Decisions) {
      v1Map.set(`${d.vendorId}-Q${d.quantity}`, d);
    }

    const v2Map = new Map<string, NormalizedDecision>();
    for (const d of v2Decisions) {
      v2Map.set(`${d.vendorId}-Q${d.quantity}`, d);
    }

    // Find common keys to compare
    const commonKeys = [...v1Map.keys()].filter((k) => v2Map.has(k));

    const mismatches: string[] = [];

    for (const key of commonKeys) {
      const v1 = v1Map.get(key)!;
      const v2 = v2Map.get(key)!;

      // Compare shouldChange
      if (v1.shouldChange !== v2.shouldChange && !allowedDiffs.has('shouldChange')) {
        mismatches.push(
          `${key}: shouldChange differs. V1=${v1.shouldChange} (${v1.category}), V2=${v2.shouldChange} (${v2.category})`,
        );
      }

      // Compare categories (normalized)
      if (v1.category !== v2.category && !allowedDiffs.has(v1.category) && !allowedDiffs.has(v2.category)) {
        mismatches.push(
          `${key}: category differs. V1=${v1.category}, V2=${v2.category}`,
        );
      }

      // Compare prices (with tolerance)
      if (v1.suggestedPrice !== null && v2.suggestedPrice !== null) {
        const diff = Math.abs(v1.suggestedPrice - v2.suggestedPrice);
        if (diff > priceTolerance) {
          mismatches.push(
            `${key}: price differs beyond tolerance. V1=$${v1.suggestedPrice}, V2=$${v2.suggestedPrice} (diff=$${diff.toFixed(4)})`,
          );
        }
      }
    }

    return {
      v1Decisions,
      v2Decisions,
      commonKeys,
      mismatches,
      v1Only: [...v1Map.keys()].filter((k) => !v2Map.has(k)),
      v2Only: [...v2Map.keys()].filter((k) => !v1Map.has(k)),
    };
  }

  it('should agree on floor enforcement for a simple scenario', async () => {
    // Competitor below floor -> both algos should IGNORE
    const input: AlgoInput = {
      mpId: 12345,
      net32Products: [
        {
          vendorId: 100,
          vendorName: 'Our Vendor',
          inStock: true,
          standardShipping: 5,
          shippingTime: 2,
          inventory: 100,
          badgeId: 0,
          badgeName: null,
          priceBreaks: [{ minQty: 1, unitPrice: 8.00 }],
          freeShippingGap: 0,
          freeShippingThreshold: 100,
        },
        {
          vendorId: 9000,
          vendorName: 'Competitor',
          inStock: true,
          standardShipping: 5,
          shippingTime: 2,
          inventory: 100,
          badgeId: 0,
          badgeName: null,
          priceBreaks: [{ minQty: 1, unitPrice: 3.00 }],
          freeShippingGap: 0,
          freeShippingThreshold: 100,
        },
      ],
      allOwnVendorIds: [100],
      non422VendorIds: [100],
      vendorConfigs: [{
        vendorId: 100,
        vendorName: 'Our Vendor',
        floorPrice: 7.00,
        maxPrice: 50.00,
        direction: 'UP_DOWN',
        priceStrategy: 'UNIT',
        enabled: true,
        sisterVendorIds: '',
        excludeVendors: '',
        competeWithAllVendors: false,
        floorCompeteWithNext: false,
        ownVendorThreshold: 1,
        inventoryCompetitionThreshold: 1,
        standardShipping: 5,
        freeShippingThreshold: 100,
      }],
      isSlowCron: false,
    };

    // V1 pre-computed: competitor at $3 with floor $7 -> IGNORE #HitFloor
    const v1Results: V1PrecomputedResult[] = [{
      vendorId: 100,
      minQty: 1,
      oldPrice: 8.00,
      newPrice: 'N/A',
      isRepriced: false,
      explained: 'IGNORE :#HitFloor',
    }];

    const result = await compareAlgos(input, v1Results);

    // Both should agree this is an IGNORE_FLOOR situation
    expect(result.mismatches).toHaveLength(0);
  });

  it('should agree on max price capping', async () => {
    // No competitors -> both should price to max
    const input: AlgoInput = {
      mpId: 12345,
      net32Products: [
        {
          vendorId: 100,
          vendorName: 'Our Vendor',
          inStock: true,
          standardShipping: 5,
          shippingTime: 2,
          inventory: 100,
          badgeId: 0,
          badgeName: null,
          priceBreaks: [{ minQty: 1, unitPrice: 10.00 }],
          freeShippingGap: 0,
          freeShippingThreshold: 100,
        },
      ],
      allOwnVendorIds: [100],
      non422VendorIds: [100],
      vendorConfigs: [{
        vendorId: 100,
        vendorName: 'Our Vendor',
        floorPrice: 5.00,
        maxPrice: 20.00,
        direction: 'UP_DOWN',
        priceStrategy: 'UNIT',
        enabled: true,
        sisterVendorIds: '',
        excludeVendors: '',
        competeWithAllVendors: false,
        floorCompeteWithNext: false,
        ownVendorThreshold: 1,
        inventoryCompetitionThreshold: 1,
        standardShipping: 5,
        freeShippingThreshold: 100,
      }],
      isSlowCron: false,
    };

    // V1 pre-computed: no competitors -> CHANGE to max price
    const v1Results: V1PrecomputedResult[] = [{
      vendorId: 100,
      minQty: 1,
      oldPrice: 10.00,
      newPrice: 20.00,
      isRepriced: true,
      explained: 'CHANGE: Price is MAXED',
    }];

    const result = await compareAlgos(input, v1Results);

    // V2 should also suggest $20 (max price)
    const v2Q1 = result.v2Decisions.filter(
      (d) => d.vendorId === 100 && d.quantity === 1,
    );
    expect(v2Q1.length).toBeGreaterThan(0);
    expect(v2Q1[0].suggestedPrice).toBe(20.00);
  });
});

// ---------------------------------------------------------------------------
// Regression backtest helper (for recorded production data)
// ---------------------------------------------------------------------------

/**
 * Run a regression backtest against recorded production data.
 *
 * Usage:
 *   const records = loadGoldenRecords('path/to/golden.json');
 *   await runRegressionBacktest(records, new V3Adapter());
 *
 * Each record contains:
 *   - input: AlgoInput
 *   - expectedDecisions: NormalizedDecision[]
 */
export async function runRegressionBacktest(
  records: Array<{
    name: string;
    input: AlgoInput;
    expectedDecisions: NormalizedDecision[];
  }>,
  runner: AlgoRunner,
  options: { priceTolerance?: number } = {},
) {
  const tolerance = options.priceTolerance ?? 0.02;

  describe(`${runner.name}: Regression Backtest`, () => {
    for (const record of records) {
      it(`should match expected output for: ${record.name}`, async () => {
        const decisions = await runner.run(record.input);

        for (const expected of record.expectedDecisions) {
          const actual = decisions.find(
            (d) =>
              d.vendorId === expected.vendorId &&
              d.quantity === expected.quantity,
          );

          expect(actual).toBeDefined();
          if (!actual) continue;

          expect(actual.shouldChange).toBe(expected.shouldChange);
          expect(actual.category).toBe(expected.category);

          if (
            expected.suggestedPrice !== null &&
            actual.suggestedPrice !== null
          ) {
            expect(
              Math.abs(actual.suggestedPrice - expected.suggestedPrice),
            ).toBeLessThanOrEqual(tolerance);
          }
        }
      });
    }
  });
}
```

---

## 7.6 How to Add a Future Algorithm (V3+)

When building a new algorithm version, follow these steps to get instant test coverage:

### Step 1: Create `v3-adapter.ts`

```typescript
// apps/api-core/src/utility/reprice-algo/__tests__/cross-algo/v3-adapter.ts

import { AlgoInput, AlgoRunner, NormalizedDecision } from './normalized-types';
// import { repriceProductV3 } from '../../v3/algorithm';

export class V3Adapter implements AlgoRunner {
  name = 'V3';

  async run(input: AlgoInput): Promise<NormalizedDecision[]> {
    // 1. Convert AlgoInput to V3's native input format
    // 2. Call repriceProductV3(...)
    // 3. Map V3 results to NormalizedDecision[]
    throw new Error('V3 adapter not yet implemented');
  }
}
```

### Step 2: Add to `comparison.test.ts`

```typescript
import { V3Adapter } from './v3-adapter';

// This single line gives V3 all 7+ universal tests
runSharedAlgoTests(new V3Adapter());

// Add V3-specific tests separately
describe('V3: Specific behaviors', () => {
  const v3 = new V3Adapter();

  it('should handle V3-specific feature X', async () => {
    // ...
  });
});
```

### Step 3: Run regression backtest

```typescript
import goldenRecords from '../fixtures/golden-records.json';
import { runRegressionBacktest } from './comparison.test';
import { V3Adapter } from './v3-adapter';

runRegressionBacktest(goldenRecords, new V3Adapter());
```

### Step 4: Run all tests

```bash
cd apps/api-core
npx jest --testPathPattern='cross-algo' --verbose
```

---

## 7.7 Collecting Golden Records from Production

To build a regression test suite, capture real production data:

### From V2 (recommended starting point)

V2's `repriceProductV2()` is pure, so you can capture input/output directly:

```typescript
// Add to v2/wrapper.ts or a logging middleware:
function captureForGolden(
  mpId: number,
  rawNet32Products: Net32AlgoProduct[],
  non422VendorIds: number[],
  allOwnVendorIds: number[],
  vendorSettings: V2AlgoSettingsData[],
  results: Net32AlgoSolutionWithQBreakValid[],
) {
  // Write to a JSONL file for later conversion to golden records
  const record = {
    mpId,
    rawNet32Products,
    non422VendorIds,
    allOwnVendorIds,
    vendorSettings,
    results: results.map(r => ({
      vendorId: r.vendor.vendorId,
      quantity: r.quantity,
      algoResult: r.algoResult,
      suggestedPrice: r.suggestedPrice,
      comment: r.comment,
    })),
    timestamp: new Date().toISOString(),
  };
  // Append to file, send to S3, etc.
}
```

### From V1

V1 results are harder to capture cleanly because of side effects. Best approach:

1. Log the `RepriceModel` output from `repriceProduct()` before DB writes
2. Pair with the Net32 API response that was used as input
3. Manually construct `V1PrecomputedResult[]` from the logs

---

## 7.8 Important Caveats

### Behaviors That May Legitimately Differ

| Behavior | V1 | V2 | Impact on comparison |
|----------|----|----|---------------------|
| Exact price | JS floats | Decimal.js | Use `priceTolerance` (default $0.02) |
| BUY_BOX strategy | Not supported | Full support | Skip comparison for BUY_BOX scenarios |
| Short expiry detection | Not in V1 core | `IGNORE_SHORT_EXPIRY` | V2-only category |
| NC (no-charge shipping) | Separate `reprice-helper-nc.ts` path | Integrated via price strategy | Different price calculation |
| Compete with next | `competeWithNext` flag | `floor_compete_with_next` | Slightly different semantics |
| Badge percentage | Post-rule application | Integrated in undercut calculation | May produce different prices |
| Q2 vs Q1 comparison | `compareWithQ1` flag | `compare_q2_with_q1` setting | Same concept, different implementation |

### V1 Side Effects to Mock (for Full Mock Mode)

If you want to run V1 live (not pre-computed), you must mock:

```typescript
// Required mocks for V1 live execution:
jest.mock('../../../../model/global-param');        // GetInfo()
jest.mock('../../../../utility/filter-mapper');       // FilterBasedOnParams, GetContextPrice, etc.
jest.mock('../../../../utility/mysql/mysql-helper');  // All DB writes
jest.mock('../../../../utility/history-helper');      // Execute()
jest.mock('../../../../utility/axios-helper');        // postAsync()
jest.mock('../../../../utility/repriceResultParser'); // Parse()
jest.mock('../../../../utility/config');              // applicationConfig
jest.mock('../../../../utility/format-wrapper');      // FormatActiveField, etc.
jest.mock('../../../../utility/response-utility');    // GetOwnProduct, FilterActiveResponse
jest.mock('../../../../utility/buy-box-helper');      // parseShippingBuyBox, etc.
jest.mock('../../../../utility/mysql/mysql-v2');      // GetCronSettingsDetailsByName, etc.
jest.mock('../../../../utility/mysql/tinyproxy-configs'); // findTinyProxyConfigByVendorId
```

---

## 7.9 File Summary

| File | Purpose | Lines (approx) |
|------|---------|----------------|
| `normalized-types.ts` | Common interfaces: `NormalizedDecision`, `AlgoRunner`, `AlgoInput`, `VendorConfig` | ~120 |
| `v2-adapter.ts` | Adapts `repriceProductV2()` output to `NormalizedDecision[]` | ~160 |
| `v1-adapter.ts` | Normalizes V1 `RepriceModel` output; maps `explained` strings to categories | ~200 |
| `shared-suite.ts` | Universal test suite: floor, max, direction, sister, undercut | ~250 |
| `comparison.test.ts` | V1 normalization tests, V1-vs-V2 comparison, regression backtest helper | ~280 |

Total: ~5 files, ~1010 lines of TypeScript.

---

## 7.10 Quick Start

```bash
# 1. Create the directory
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/cross-algo/

# 2. Create all 5 files as documented above

# 3. Run V2 universal tests (works immediately, no mocks needed)
cd apps/api-core
npx jest --testPathPattern='cross-algo/comparison' --verbose

# 4. Run V1 normalization tests (tests the mapping logic, no algo execution)
npx jest --testPathPattern='cross-algo/comparison' --testNamePattern='V1 Adapter'

# 5. Future: Add V3
# Create v3-adapter.ts, add runSharedAlgoTests(new V3Adapter()) to comparison.test.ts
```
