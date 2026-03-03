# Layer 0: Project Setup, Builders & Matchers

> **Goal**: Create the test infrastructure that all other layers depend on.
> After this layer, writing any new test takes minutes because builders handle the 77-field FrontierProduct, custom matchers read like English, and all imports are established.

## 0.1 Prerequisites

**Already installed** (in `apps/api-core/package.json`):
```
jest: ^30.0.4
ts-jest: ^29.4.0
@types/jest: ^30.0.0
```

**Needs to be installed** (for Layer 5 — property-based tests):
```bash
cd apps/api-core
npm install --save-dev fast-check
```

**Existing Jest config** (`apps/api-core/jest.config.js`):
```javascript
const { createDefaultPreset } = require("ts-jest");
const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
};
```

This config works as-is. Jest will find any `*.test.ts` file automatically.

**Existing TypeScript config** (`apps/api-core/tsconfig.json`):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "sourceMap": true,
    "lib": ["es2024", "dom"],
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Since `rootDir` is `src` and `__tests__/` will be inside `src/`, TypeScript will pick up test files. The `resolveJsonModule: true` is already set (needed for golden file JSON fixtures in Layer 4).

**Running tests**:
```bash
cd apps/api-core
npx jest                                        # all tests
npx jest --testPathPattern='__tests__/v1/rules'  # specific layer
npx jest --verbose                               # see each test name
npx jest --coverage                              # coverage report
```

## 0.2 Create Directory Structure

```bash
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/infrastructure/builders
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/infrastructure/matchers
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/v1/rules
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/v1/filters
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/v1/integration
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/v2/strategies
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/v2/filters
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/v2/rules
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/golden-files/scenarios
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/invariants
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/backtest
mkdir -p apps/api-core/src/utility/reprice-algo/__tests__/cross-algo
```

## 0.3 Import Map

All test files live under:
```
apps/api-core/src/utility/reprice-algo/__tests__/
```

**Import path convention**: The paths below assume the test file is **2 directories deep** inside `__tests__/` (e.g., `__tests__/v1/rules/*.test.ts`, `__tests__/v1/filters/*.test.ts`, `__tests__/invariants/*.test.ts`). Files at different depths need adjusted paths:
- 3 levels deep (e.g., `__tests__/infrastructure/builders/*.ts`): add one more `../`
- 1 level deep (e.g., `__tests__/golden-files/runner.test.ts`): same as below (golden-files is 2 levels)

Here are the exact imports from test files to source files:

```typescript
// ============================================================
// MODELS (classes — have constructors)
// ============================================================
import { RepriceModel, RepriceData } from '../../../../model/reprice-model';
// RepriceData constructor: (oldPrice: number, newPrice: string | number | null, isRepriced: boolean, message: string | null, minQty?: number)
// RepriceModel constructor: (sourceId: string, productDetails: Net32Product | null, name: string, newPrice: string | number | null, isRepriced: boolean, multiplePriceBreak?: boolean, listOfRepriceData?: RepriceData[], message?: string | null)

// ============================================================
// ENUMS
// ============================================================
import { RepriceRenewedMessageEnum } from '../../../../model/reprice-renewed-message';
import { RepriceMessageEnum } from '../../../../model/reprice-message';
import { RepriceResultEnum } from '../../../../model/enumerations';

// ============================================================
// TYPES (interfaces — no constructors)
// ============================================================
import { Net32Product, Net32PriceBreak } from '../../../../types/net32';
import { FrontierProduct } from '../../../../types/frontier';

// ============================================================
// SHARED PACKAGE
// ============================================================
import { VendorId, VendorName, AlgoExecutionMode, AlgoPriceStrategy, AlgoPriceDirection, AlgoBadgeIndicator, AlgoHandlingTimeGroup } from '@repricer-monorepo/shared';

// ============================================================
// V1 RULE FUNCTIONS (all standalone, all exported)
// ============================================================
import {
  ApplyRule,                          // (repriceResult: any, ruleIdentifier: number, isNcNeeded?: boolean, net32Details?: Net32Product)
  ApplyMultiPriceBreakRule,           // (repriceResult: RepriceModel)
  ApplySuppressPriceBreakRule,        // (repriceResult: RepriceModel, minQty: number, isOverrideEnabled: boolean)
  ApplyBeatQPriceRule,                // (repriceResult: RepriceModel)
  ApplyPercentagePriceRule,           // (repriceResult: RepriceModel, percentage: number)
  ApplyDeactivateQPriceBreakRule,     // (repriceResult: RepriceModel, abortDeactivatingQPriceBreak: boolean)
  ApplyBuyBoxRule,                    // (repriceResult: RepriceModel, net32Result: Net32Product[])
  ApplyFloorCheckRule,                // (repriceResult: RepriceModel, floorPrice: number)
  ApplyKeepPositionLogic,             // (repriceResult: RepriceModel, net32Result: Net32Product[], ownVendorId: string)
  AppendNewPriceBreakActivation,      // (repriceResult: RepriceModel): RepriceModel
  ApplyRepriceDownBadgeCheckRule,     // async (repriceResult: RepriceModel, net32Result: any[], productItem: FrontierProduct, badgePercentageDown: number): Promise<RepriceModel>
  ApplySisterComparisonCheck,         // async (repriceResult: any, net32Result: Net32Product[], productItem: FrontierProduct): Promise<RepriceModel>
  OverrideRepriceResultForExpressCron,// (repriceResult: any): any
  AlignIsRepriced,                    // async (repriceResult: any)
  ApplyMaxPriceCheck,                 // async (repriceResult: any, productItem: FrontierProduct): Promise<RepriceModel>
} from '../v1/repricer-rule-helper';

// ============================================================
// V1 SHARED UTILITIES
// ============================================================
import {
  isPriceUpdateRequired,    // (repriceResult: RepriceModel, isRepriceOn: boolean)
  getIsFloorReached,         // async (repricerDetails: RepriceData) => boolean
  getPriceStepValue,         // async (repricerDetails: any) => "$UP" | "$DOWN" | "$SAME"
  MinQtyPricePresent,        // (priceBreaks: Net32PriceBreak[], minQty: number) => boolean
  notQ2VsQ1,                 // (minQty: number, compareWithQ1: boolean) => boolean
} from '../v1/shared';

// ============================================================
// V1 FILTER MAPPER
// ============================================================
import {
  FilterBasedOnParams,       // async (inputResult: Net32Product[], productItem: FrontierProduct, filterType: string)
  // NOTE: GetContextPrice, IsVendorFloorPrice, VerifyFloorWithSister are also in this file
  // but check if they are exported — they may need to be exported first
} from '../../filter-mapper';

// ============================================================
// V1 ENTRY POINTS (async — call external APIs/DB, need mocking for integration tests)
// ============================================================
import { repriceProduct, repriceProductToMax } from '../v1/algo-v1';

// ============================================================
// V1 REPRICE HELPERS (async — use globalParam.GetInfo() which calls DB)
// ============================================================
import { Reprice, RepriceIndividualPriceBreak, GetDistinctPriceBreaksAcrossVendors, RepriceToMax } from '../v1/reprice-helper';
import { Reprice as RepriceNc, RepriceIndividualPriceBreak as RepriceIndividualPriceBreakNc } from '../v1/reprice-helper-nc';

// ============================================================
// V2 TYPES
// ============================================================
import { Net32AlgoProduct, Net32AlgoProductWithBestPrice, InternalProduct, AlgoResult, ChangeResult, QbreakInvalidReason } from '../v2/types';

// ============================================================
// V2 ALGORITHM (standalone functions)
// ============================================================
import { repriceProductV2, hasBadge, getShippingBucket, getUndercutPriceOnPenny } from '../v2/algorithm';

// ============================================================
// V2 SETTINGS/FILTERS (standalone functions)
// ============================================================
import {
  applyCompetitionFilters,
  applyShortExpiryFilter,
  applyBadgeIndicatorFilter,
  applyVendorExclusionFilter,
  applyHandlingTimeGroup,
  applyMinQuantityFilter,
  applyUpDownRestriction,
  applyKeepPosition,
  applyFloorCompeteWithNext,
  applyOwnVendorThreshold,
  applySuppressPriceBreakFilter,
  applyCompeteOnPriceBreaksOnly,
  applySuppressQBreakIfQ1NotUpdated,
} from '../v2/settings';
```

## 0.4 Net32ProductBuilder

**File**: `__tests__/infrastructure/builders/net32-product.builder.ts`

This builder creates `Net32Product` objects (from `src/types/net32.ts`) with sensible defaults. Every field is pre-filled so tests only set what's relevant.

```typescript
import { Net32Product, Net32PriceBreak } from '../../../../../types/net32';

const DEFAULT_NET32_PRODUCT: Net32Product = {
  vendorProductId: 1001,
  vendorProductCode: 'VP-TEST-001',
  vendorId: 99999,
  vendorName: 'TestCompetitor',
  vendorRegion: 'US',
  inStock: true,
  standardShipping: 0,
  standardShippingStatus: 'FREE',
  freeShippingGap: 0,
  heavyShippingStatus: 'NONE',
  heavyShipping: 0,
  shippingTime: 2,
  inventory: 100,
  isFulfillmentPolicyStock: true,
  vdrGeneralAverageRatingSum: 4.5,
  vdrNumberOfGeneralRatings: 100,
  isBackordered: false,
  vendorProductLevelLicenseRequiredSw: false,
  vendorVerticalLevelLicenseRequiredSw: false,
  priceBreaks: [{ minQty: 1, unitPrice: 10.00, active: true }],
  badgeId: 0,
  badgeName: null,
  imagePath: '',
  arrivalDate: '',
  arrivalBusinessDays: 2,
  twoDayDeliverySw: false,
  isLowestTotalPrice: null,
};

export class Net32ProductBuilder {
  private product: Net32Product;

  constructor() {
    this.product = {
      ...DEFAULT_NET32_PRODUCT,
      priceBreaks: DEFAULT_NET32_PRODUCT.priceBreaks.map(pb => ({ ...pb })),
    };
  }

  static create(): Net32ProductBuilder {
    return new Net32ProductBuilder();
  }

  vendorId(id: number | string): this {
    this.product.vendorId = id;
    return this;
  }

  vendorName(name: string): this {
    this.product.vendorName = name;
    return this;
  }

  unitPrice(price: number, minQty = 1): this {
    const existing = this.product.priceBreaks.find(pb => pb.minQty === minQty);
    if (existing) {
      existing.unitPrice = price;
    } else {
      this.product.priceBreaks.push({ minQty, unitPrice: price, active: true });
    }
    return this;
  }

  priceBreaks(breaks: Array<{ minQty: number; unitPrice: number; active?: boolean; promoAddlDescr?: string }>): this {
    this.product.priceBreaks = breaks.map(b => ({
      minQty: b.minQty,
      unitPrice: b.unitPrice,
      active: b.active ?? true,
      promoAddlDescr: b.promoAddlDescr,
    }));
    return this;
  }

  shipping(cost: number): this {
    this.product.standardShipping = cost;
    return this;
  }

  threshold(value: number): this {
    this.product.freeShippingThreshold = value;
    return this;
  }

  shippingTime(days: number): this {
    this.product.shippingTime = days;
    return this;
  }

  badge(id: number, name: string): this {
    this.product.badgeId = id;
    this.product.badgeName = name;
    return this;
  }

  noBadge(): this {
    this.product.badgeId = 0;
    this.product.badgeName = null;
    return this;
  }

  inventory(count: number): this {
    this.product.inventory = count;
    return this;
  }

  outOfStock(): this {
    this.product.inStock = false;
    this.product.inventory = 0;
    return this;
  }

  inStock(val = true): this {
    this.product.inStock = val;
    return this;
  }

  expiry(desc: string): this {
    this.product.priceBreaks.forEach(pb => (pb as any).promoAddlDescr = desc);
    return this;
  }

  heavyShipping(cost: number): this {
    this.product.heavyShipping = cost;
    this.product.heavyShippingStatus = cost > 0 ? 'HEAVY' : 'NONE';
    return this;
  }

  freeShippingGap(gap: number): this {
    this.product.freeShippingGap = gap;
    return this;
  }

  /** Preset: own vendor (Tradent, ID 17357) */
  asOwnVendor(): this {
    this.product.vendorId = 17357;
    this.product.vendorName = 'Tradent';
    return this;
  }

  /** Preset: sister vendor (Frontier, ID 20722) */
  asSister(): this {
    this.product.vendorId = 20722;
    this.product.vendorName = 'Frontier';
    return this;
  }

  /** Preset: second sister (MVP, ID 20755) */
  asSister2(): this {
    this.product.vendorId = 20755;
    this.product.vendorName = 'MVP';
    return this;
  }

  build(): Net32Product {
    return {
      ...this.product,
      priceBreaks: this.product.priceBreaks.map(pb => ({ ...pb })),
    };
  }
}

/** Shorthand factory */
export const aNet32Product = () => Net32ProductBuilder.create();
```

## 0.5 FrontierProductBuilder

**File**: `__tests__/infrastructure/builders/frontier-product.builder.ts`

This builder creates `FrontierProduct` objects (from `src/types/frontier.ts`). The interface has **77 fields** — the builder defaults every single one.

```typescript
import { FrontierProduct } from '../../../../../types/frontier';

const DEFAULT_FRONTIER_PRODUCT: FrontierProduct = {
  // Identity
  channelName: 'test-channel',
  activated: true,
  mpid: 12345,
  channelId: 'CH-TEST',
  productName: 'Test Product',
  focusId: 'FOCUS-001',

  // Pricing bounds
  unitPrice: '10.00',
  floorPrice: '0',
  maxPrice: '99999',

  // Core rules
  repricingRule: 2,             // 0=OnlyUp, 1=OnlyDown, 2=Both, -1=None
  is_nc_needed: false,
  suppressPriceBreakForOne: false,
  suppressPriceBreak: false,
  beatQPrice: false,
  percentageIncrease: 0,
  compareWithQ1: false,
  competeAll: false,
  abortDeactivatingQPriceBreak: true,

  // Badge settings
  badgeIndicator: 'ALL_ZERO',
  badgePercentage: 0,
  badgePercentageDown: '0',

  // Vendor settings
  ownVendorId: '17357',
  sisterVendorId: '20722;20755',
  excludedVendors: '',
  includeInactiveVendors: false,
  inactiveVendorId: '',
  ownVendorThreshold: 50,

  // Buy box
  applyBuyBoxLogic: false,
  applyNcForBuyBox: false,
  getBBShipping: false,
  getBBBadge: false,

  // Position & competition
  keepPosition: false,
  competeWithNext: false,
  inventoryThreshold: 0,
  handlingTimeFilter: 'ALL',
  ignorePhantomQBreak: false,
  percentageDown: '0',

  // Cron & timing
  cronId: 'CRON-TEST',
  cronName: 'test-cron',
  requestInterval: 60,
  requestIntervalUnit: 'minutes',
  scrapeOn: true,
  allowReprice: true,
  priority: 5,
  wait_update_period: false,
  net32url: 'https://www.net32.com/rest/neo/pdp/12345/vendor-options',
  executionPriority: 0,
  skipReprice: false,

  // Override
  override_bulk_update: false,
  override_bulk_rule: 2,

  // Status fields (not used by algo logic)
  latest_price: 0,
  lastCronRun: 'N/A',
  lastExistingPrice: 'N/A',
  lastSuggestedPrice: 'N/A',
  lastUpdatedBy: 'N/A',
  last_attempted_time: '',
  last_cron_message: 'N/A',
  last_cron_time: '',
  lowest_vendor: 'N/A',
  lowest_vendor_price: 'N/A',
  next_cron_time: '',
  last_update_time: '',
  slowCronId: '',
  slowCronName: '',
  isSlowActivated: false,
  lastUpdatedByUser: '',
  lastUpdatedOn: '',
  triggeredByVendor: '',
  tags: [],
  secretKey: [],
  contextCronName: 'test-cron',
};

export class FrontierProductBuilder {
  private product: FrontierProduct;

  constructor() {
    this.product = { ...DEFAULT_FRONTIER_PRODUCT, tags: [], secretKey: [] };
  }

  static create(): FrontierProductBuilder {
    return new FrontierProductBuilder();
  }

  // ---- Pricing bounds ----
  floor(price: number): this { this.product.floorPrice = String(price); return this; }
  maxPrice(price: number): this { this.product.maxPrice = String(price); return this; }
  unitPrice(price: number): this { this.product.unitPrice = String(price); return this; }

  // ---- Core rules ----
  /** 0=OnlyUp, 1=OnlyDown, 2=Both, -1=None */
  rule(r: -1 | 0 | 1 | 2): this { this.product.repricingRule = r; return this; }
  ncMode(enabled = true): this { this.product.is_nc_needed = enabled; return this; }
  suppressPriceBreak(enabled = true): this { this.product.suppressPriceBreakForOne = enabled; return this; }
  beatQPrice(enabled = true): this { this.product.beatQPrice = enabled; return this; }
  percentageIncrease(pct: number): this { this.product.percentageIncrease = pct; return this; }
  compareWithQ1(enabled = true): this { this.product.compareWithQ1 = enabled; return this; }
  competeAll(enabled = true): this { this.product.competeAll = enabled; return this; }
  abortDeactivatingQBreak(enabled = true): this { this.product.abortDeactivatingQPriceBreak = enabled; return this; }

  // ---- Badge ----
  badgeIndicator(indicator: string): this { this.product.badgeIndicator = indicator; return this; }
  badgePercentage(pct: number): this { this.product.badgePercentage = pct; return this; }
  badgePercentageDown(pct: number | string): this { this.product.badgePercentageDown = String(pct); return this; }

  // ---- Vendor ----
  ownVendorId(id: string): this { this.product.ownVendorId = id; return this; }
  sisterVendorId(ids: string): this { this.product.sisterVendorId = ids; return this; }
  excludedVendors(ids: string): this { this.product.excludedVendors = ids; return this; }
  ownVendorThreshold(t: number): this { this.product.ownVendorThreshold = t; return this; }

  // ---- Buy box ----
  buyBoxLogic(enabled = true): this { this.product.applyBuyBoxLogic = enabled; return this; }
  ncForBuyBox(enabled = true): this { this.product.applyNcForBuyBox = enabled; return this; }
  bbShipping(enabled = true): this { this.product.getBBShipping = enabled; return this; }
  bbBadge(enabled = true): this { this.product.getBBBadge = enabled; return this; }

  // ---- Position & competition ----
  keepPosition(enabled = true): this { this.product.keepPosition = enabled; return this; }
  competeWithNext(enabled = true): this { this.product.competeWithNext = enabled; return this; }
  inventoryThreshold(t: number): this { this.product.inventoryThreshold = t; return this; }
  handlingTimeFilter(f: string): this { this.product.handlingTimeFilter = f; return this; }
  ignorePhantomQBreak(enabled = true): this { this.product.ignorePhantomQBreak = enabled; return this; }
  percentageDown(pct: number | string): this { this.product.percentageDown = String(pct); return this; }

  // ---- Override ----
  overrideBulkUpdate(enabled = true): this { this.product.override_bulk_update = enabled; return this; }
  overrideBulkRule(r: number): this { this.product.override_bulk_rule = r; return this; }

  // ---- Bulk setter ----
  fromPartial(partial: Partial<FrontierProduct>): this {
    Object.assign(this.product, partial);
    return this;
  }

  build(): FrontierProduct {
    return { ...this.product, tags: [...this.product.tags], secretKey: [...this.product.secretKey] };
  }
}

/** Shorthand factory */
export const aProduct = () => FrontierProductBuilder.create();
```

## 0.6 RepriceModelBuilder

**File**: `__tests__/infrastructure/builders/reprice-model.builder.ts`

Builds `RepriceModel` and `RepriceData` objects. These are **classes** with constructors — the builder wraps them for convenience.

**Important**: `RepriceData` constructor formats `newPrice` — if `isRepriced=true`, it calls `.toFixed(2)` on numeric prices. If `isRepriced=false`, it sets `newPrice='N/A'`. For tests that need to set arbitrary values, use the field overrides after construction.

```typescript
import { RepriceModel, RepriceData } from '../../../../../model/reprice-model';
import { Net32Product } from '../../../../../types/net32';

/**
 * Build a RepriceData for testing.
 * Unlike the real constructor, this does NOT format newPrice with toFixed(2).
 * Tests need exact control over values.
 */
function makeRepriceData(opts: {
  oldPrice?: number;
  newPrice?: number | string | null;
  isRepriced?: boolean;
  explained?: string | null;
  minQty?: number;
  active?: boolean;
  goToPrice?: number | string | null;
  lowestVendor?: string | null;
  lowestVendorPrice?: any;
  triggeredByVendor?: string | null;
}): RepriceData {
  const d = new RepriceData(
    opts.oldPrice ?? 10,
    opts.newPrice ?? 9.99,
    opts.isRepriced ?? true,
    opts.explained ?? '',
    opts.minQty ?? 1,
  );
  // Override fields that the constructor may have formatted
  if (opts.newPrice !== undefined) d.newPrice = opts.newPrice;
  if (opts.isRepriced !== undefined) d.isRepriced = opts.isRepriced;
  if (opts.active !== undefined) d.active = opts.active;
  if (opts.goToPrice !== undefined) d.goToPrice = opts.goToPrice;
  if (opts.lowestVendor !== undefined) d.lowestVendor = opts.lowestVendor;
  if (opts.lowestVendorPrice !== undefined) d.lowestVendorPrice = opts.lowestVendorPrice;
  if (opts.triggeredByVendor !== undefined) d.triggeredByVendor = opts.triggeredByVendor;
  return d;
}

export class RepriceModelBuilder {
  private sourceId = '12345';
  private productName = 'Test Product';
  private vendorId: number | string = 17357;
  private vendorName = 'Tradent';
  private singleDetail: Parameters<typeof makeRepriceData>[0] | null = null;
  private multiDetails: Array<Parameters<typeof makeRepriceData>[0]> = [];

  static create(): RepriceModelBuilder {
    return new RepriceModelBuilder();
  }

  /** Set fields for a single-break model (repriceDetails) */
  withOldPrice(price: number): this {
    if (!this.singleDetail) this.singleDetail = {};
    this.singleDetail.oldPrice = price;
    return this;
  }

  withNewPrice(price: number | string | null): this {
    if (!this.singleDetail) this.singleDetail = {};
    this.singleDetail.newPrice = price;
    this.singleDetail.isRepriced = price !== 'N/A' && price !== null;
    return this;
  }

  withExplained(msg: string): this {
    if (!this.singleDetail) this.singleDetail = {};
    this.singleDetail.explained = msg;
    return this;
  }

  withGoToPrice(price: number | string | null): this {
    if (!this.singleDetail) this.singleDetail = {};
    this.singleDetail.goToPrice = price;
    return this;
  }

  /** Add a price break for multi-break models (listOfRepriceDetails) */
  withPriceBreak(opts: {
    minQty: number;
    oldPrice?: number;
    newPrice?: number | string;
    isRepriced?: boolean;
    active?: boolean;
    explained?: string;
    goToPrice?: number | string | null;
  }): this {
    this.multiDetails.push({
      minQty: opts.minQty,
      oldPrice: opts.oldPrice ?? 10,
      newPrice: opts.newPrice ?? 9.99,
      isRepriced: opts.isRepriced ?? (opts.newPrice !== 'N/A'),
      active: opts.active,
      explained: opts.explained ?? '',
      goToPrice: opts.goToPrice,
    });
    return this;
  }

  withVendorId(id: number | string): this { this.vendorId = id; return this; }
  withVendorName(name: string): this { this.vendorName = name; return this; }

  build(): RepriceModel {
    // Create a minimal Net32Product for the constructor
    const productDetails: Net32Product = {
      vendorProductId: 1001,
      vendorProductCode: 'VP-001',
      vendorId: this.vendorId,
      vendorName: this.vendorName,
      vendorRegion: 'US',
      inStock: true,
      standardShipping: 0,
      standardShippingStatus: 'FREE',
      freeShippingGap: 0,
      heavyShippingStatus: 'NONE',
      heavyShipping: 0,
      shippingTime: 2,
      inventory: 100,
      isFulfillmentPolicyStock: true,
      vdrGeneralAverageRatingSum: 4.5,
      vdrNumberOfGeneralRatings: 100,
      isBackordered: false,
      vendorProductLevelLicenseRequiredSw: false,
      vendorVerticalLevelLicenseRequiredSw: false,
      priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      badgeId: 0,
      badgeName: null,
      imagePath: '',
      arrivalDate: '',
      arrivalBusinessDays: 2,
      twoDayDeliverySw: false,
      isLowestTotalPrice: null,
    };

    if (this.multiDetails.length > 0) {
      // Multi-break model
      const listOfRepriceData = this.multiDetails.map(d => makeRepriceData(d));
      const model = new RepriceModel(
        this.sourceId, productDetails, this.productName,
        null, false, true, listOfRepriceData, null,
      );
      return model;
    }

    if (this.singleDetail) {
      // Single-break model
      const model = new RepriceModel(
        this.sourceId, productDetails, this.productName,
        this.singleDetail.newPrice ?? 9.99,
        this.singleDetail.isRepriced ?? true,
        false, [], this.singleDetail.explained ?? '',
      );
      // Override any fields the constructor formatted
      if (this.singleDetail.oldPrice !== undefined) model.repriceDetails!.oldPrice = this.singleDetail.oldPrice;
      if (this.singleDetail.newPrice !== undefined) model.repriceDetails!.newPrice = this.singleDetail.newPrice;
      if (this.singleDetail.isRepriced !== undefined) model.repriceDetails!.isRepriced = this.singleDetail.isRepriced;
      if (this.singleDetail.goToPrice !== undefined) model.repriceDetails!.goToPrice = this.singleDetail.goToPrice;
      if (this.singleDetail.active !== undefined) model.repriceDetails!.active = this.singleDetail.active;
      return model;
    }

    // Default: single break, repriced from 10 to 9.99
    return new RepriceModel(
      this.sourceId, productDetails, this.productName,
      9.99, true, false, [], '',
    );
  }
}

/** Shorthand factory */
export const aRepriceModel = () => RepriceModelBuilder.create();

/** Export the helper for direct use */
export { makeRepriceData };
```

## 0.7 V2 Settings Builder

**File**: `__tests__/infrastructure/builders/v2-settings.builder.ts`

```typescript
// V2AlgoSettingsData IS exported from the source — import it directly.
// The enum types (AlgoPriceDirection, etc.) are string enums from @repricer-monorepo/shared,
// so string literal values like 'UP/DOWN' work at runtime via string coercion.
import { V2AlgoSettingsData } from '../../../../../utility/mysql/v2-algo-settings';
// If you need the enum types for explicit values:
// import { AlgoPriceDirection, AlgoPriceStrategy, AlgoBadgeIndicator, AlgoHandlingTimeGroup } from '@repricer-monorepo/shared';

const DEFAULT_V2_SETTINGS: V2AlgoSettingsData = {
  id: 1,
  mp_id: 12345,
  vendor_id: 17357,
  enabled: true,
  floor_price: 0,
  max_price: 99999999.99,
  price_strategy: 'UNIT',
  up_down: 'UP/DOWN',
  badge_indicator: 'ALL',
  handling_time_group: 'ALL',
  compete_with_all_vendors: false,
  compare_q2_with_q1: false,
  suppress_price_break: false,
  suppress_price_break_if_Q1_not_updated: false,
  compete_on_price_break_only: false,
  floor_compete_with_next: false,
  keep_position: false,
  reprice_down_percentage: -1,
  reprice_down_badge_percentage: -1,
  reprice_up_percentage: -1,
  reprice_up_badge_percentage: -1,
  sister_vendor_ids: '',
  exclude_vendors: '',
  inactive_vendor_id: '',
  inventory_competition_threshold: 1,
  own_vendor_threshold: 1,
  execution_priority: 0,
};

export class V2SettingsBuilder {
  private settings: V2AlgoSettingsData;

  constructor() {
    this.settings = { ...DEFAULT_V2_SETTINGS };
  }

  static create(): V2SettingsBuilder { return new V2SettingsBuilder(); }

  vendorId(id: number): this { this.settings.vendor_id = id; return this; }
  mpId(id: number): this { this.settings.mp_id = id; return this; }
  floor(price: number): this { this.settings.floor_price = price; return this; }
  maxPrice(price: number): this { this.settings.max_price = price; return this; }
  priceStrategy(s: 'UNIT' | 'TOTAL' | 'BUY_BOX'): this { this.settings.price_strategy = s; return this; }
  upDown(d: 'UP' | 'UP/DOWN' | 'DOWN'): this { this.settings.up_down = d; return this; }
  badgeIndicator(i: 'ALL' | 'BADGE'): this { this.settings.badge_indicator = i; return this; }
  handlingTimeGroup(g: string): this { this.settings.handling_time_group = g as any; return this; }
  keepPosition(enabled = true): this { this.settings.keep_position = enabled; return this; }
  sisterVendors(ids: string): this { this.settings.sister_vendor_ids = ids; return this; }
  excludeVendors(ids: string): this { this.settings.exclude_vendors = ids; return this; }
  floorCompeteWithNext(enabled = true): this { this.settings.floor_compete_with_next = enabled; return this; }
  suppressPriceBreak(enabled = true): this { this.settings.suppress_price_break = enabled; return this; }
  competeOnBreaksOnly(enabled = true): this { this.settings.compete_on_price_break_only = enabled; return this; }
  repriceDownPercentage(pct: number): this { this.settings.reprice_down_percentage = pct; return this; }
  repriceUpPercentage(pct: number): this { this.settings.reprice_up_percentage = pct; return this; }
  executionPriority(p: number): this { this.settings.execution_priority = p; return this; }

  build(): V2AlgoSettingsData { return { ...this.settings }; }
}

export const aV2Settings = () => V2SettingsBuilder.create();
```

## 0.8 Custom Jest Matchers

**File**: `__tests__/infrastructure/matchers/pricing.matchers.ts`

```typescript
import { RepriceData } from '../../../../../model/reprice-model';

declare global {
  namespace jest {
    interface Matchers<R> {
      /** Assert that repriceData has isRepriced=true and newPrice is not 'N/A' */
      toBeRepriced(): R;
      /** Assert that repriceData has isRepriced=false or newPrice='N/A' */
      toBeIgnored(): R;
      /** Assert that explained string contains the given substring */
      toHaveExplainedContaining(tag: string): R;
      /** Assert that explained string does NOT contain the given substring */
      toHaveExplainedNotContaining(tag: string): R;
      /** Assert newPrice equals expected (with 0.005 tolerance for floats) */
      toHaveSuggestedPrice(price: number): R;
      /** Assert the price break is deactivated (active=false or active=0) */
      toBeDeactivated(): R;
    }
  }
}

expect.extend({
  toBeRepriced(received: RepriceData) {
    const pass = received.isRepriced === true && received.newPrice !== 'N/A' && received.newPrice !== null;
    return {
      pass,
      message: () =>
        `expected repriceData ${pass ? 'not ' : ''}to be repriced\n` +
        `  isRepriced: ${received.isRepriced}\n` +
        `  newPrice: ${received.newPrice}\n` +
        `  explained: ${received.explained}`,
    };
  },

  toBeIgnored(received: RepriceData) {
    const pass = received.isRepriced === false || received.newPrice === 'N/A' || received.newPrice === null;
    return {
      pass,
      message: () =>
        `expected repriceData ${pass ? 'not ' : ''}to be ignored\n` +
        `  isRepriced: ${received.isRepriced}\n` +
        `  newPrice: ${received.newPrice}`,
    };
  },

  toHaveExplainedContaining(received: RepriceData, tag: string) {
    const explained = received.explained ?? '';
    const pass = explained.includes(tag);
    return {
      pass,
      message: () =>
        `expected explained "${explained}" ${pass ? 'not ' : ''}to contain "${tag}"`,
    };
  },

  toHaveExplainedNotContaining(received: RepriceData, tag: string) {
    const explained = received.explained ?? '';
    const pass = !explained.includes(tag);
    return {
      pass,
      message: () =>
        `expected explained "${explained}" ${pass ? '' : 'not '}to contain "${tag}"`,
    };
  },

  toHaveSuggestedPrice(received: RepriceData, price: number) {
    const actual = Number(received.newPrice);
    const pass = Math.abs(actual - price) < 0.005;
    return {
      pass,
      message: () =>
        `expected newPrice ${received.newPrice} (${actual}) ${pass ? 'not ' : ''}to equal ${price}`,
    };
  },

  toBeDeactivated(received: RepriceData) {
    const pass = received.active === false || (received.active as any) === 0;
    return {
      pass,
      message: () =>
        `expected price break ${pass ? 'not ' : ''}to be deactivated (active=${received.active})`,
    };
  },
});

export {}; // Ensure this is treated as a module
```

**To use matchers in tests**, add this import at the top of any test file:
```typescript
import '../infrastructure/matchers/pricing.matchers';
```

Or configure Jest to auto-load it in `jest.config.js`:
```javascript
module.exports = {
  testEnvironment: "node",
  transform: { ...tsJestTransformCfg },
  setupFiles: ['./src/utility/reprice-algo/__tests__/infrastructure/matchers/pricing.matchers.ts'],
};
```

## 0.9 Verification

After creating all the above files, verify the setup compiles:

```bash
cd apps/api-core
npx jest --testPathPattern='__tests__' --passWithNoTests
```

Expected output: `No tests found` (because we haven't written test files yet), but **no compilation errors**.

## 0.10 Dependencies That Need Mocking (for Layer 3+)

The V1 rule functions in `repricer-rule-helper.ts` are **mostly pure** — they take a `RepriceModel` and return a modified one. No mocking needed for Layer 1.

However, some functions call external services:

| Function | External Dependency | Needs Mock? |
|----------|-------------------|-------------|
| `ApplyRepriceDownBadgeCheckRule` | `FilterBasedOnParams` (calls through) | Maybe — depends on badge filter |
| `ApplySisterComparisonCheck` | None (pure logic) | No |
| `ApplyMaxPriceCheck` | None (pure logic) | No |
| `Reprice()` (reprice-helper.ts) | `globalParam.GetInfo()` → calls `sqlV2Service.GetGlobalConfig()` | **Yes** |
| `repriceProduct()` (algo-v1.ts) | Net32 API, price update API, history DB | **Yes** |
| `FilterBasedOnParams` | None (pure logic on arrays) | No |

**Mock strategy for integration tests (Layer 3)**:

```typescript
// Mock the globalParam module
jest.mock('../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '17357',
    EXCLUDED_VENDOR_ID: '20722;20755',
  }),
}));

// Mock config to control OFFSET and other values
jest.mock('../../../config', () => ({
  applicationConfig: {
    OFFSET: 0.01,
    IGNORE_TIE: false,
    FLAG_MULTI_PRICE_UPDATE: true,
    IS_DEV: true,  // prevents real API calls
    VENDOR_ID: 17357,
    OWN_VENDOR_LIST: '17357;20722;20755;20533;20727;5',
    EXCLUDED_VENDOR_ID: '20722;20755',
    PRICE_UPDATE_V2_ENABLED: false,
  },
}));
```

The exact mock paths will be refined during Layer 3 implementation. For Layers 1 and 2, no mocks are needed.
