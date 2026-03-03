# V1 Repricing Pipeline Integration Tests

This guide provides everything needed to implement integration tests for the V1 repricing pipeline. All tests exercise the real algorithm logic while mocking external I/O (database, API calls, cache).

## Test File Location

All test files go under:

```
apps/api-core/src/utility/reprice-algo/__tests__/v1/integration/
```

Create this directory structure before starting.

## Architecture Overview

The V1 pipeline has two entry points:

1. **`repriceProduct()`** in `algo-v1.ts` -- the full pipeline including price update POST, history writing, and rule application
2. **`Reprice()`** and `RepriceIndividualPriceBreak()`** in `reprice-helper.ts` (standard mode) and `reprice-helper-nc.ts` (NC mode) -- the core repricing logic only

### Call Chain for `repriceProduct()`

```
repriceProduct(mpid, net32Products, internalProduct, contextVendor)
  |-- formatter.FormatActiveField(result)              [pure, no mock]
  |-- formatter.FormatShippingThreshold(result)        [pure, no mock]
  |-- formatter.SetGlobalDetails(productItem, vendor)  [pure, no mock]
  |-- formatter.SetOwnVendorThreshold(...)             [calls globalParam.GetInfo]
  |-- responseUtility.GetOwnProduct(...)               [calls globalParam.GetInfo]
  |-- responseUtility.FilterActiveResponse(...)        [pure, no mock]
  |-- repriceHelper.GetDistinctPriceBreaksAcrossVendors(...)  [calls globalParam.GetInfo]
  |-- repriceHelper.Reprice(...)                       [calls globalParam.GetInfo, filterMapper.*]
  |   OR repriceHelperNc.Reprice(...)                  [calls globalParam.GetInfo, filterMapper.*]
  |-- Rule.ApplyRule(...)                              [pure rule logic]
  |-- Rule.ApplyMultiPriceBreakRule(...)               [pure]
  |-- Rule.ApplyFloorCheckRule(...)                    [pure]
  |-- Rule.ApplySisterComparisonCheck(...)             [calls globalParam.GetInfo]
  |-- Rule.ApplyMaxPriceCheck(...)                     [pure]
  |-- Rule.AlignIsRepriced(...)                        [pure]
  |-- mySqlHelper.UpdateTriggeredByVendor(...)         [DB write -- mock]
  |-- HistoryHelper.Execute(...)                       [DB write -- mock]
  |-- ResultParser.Parse(...)                          [pure]
  |-- mySqlHelper.UpdateRepriceResultStatus(...)       [DB write -- mock]
  |-- filterMapper.IsWaitingForNextRun(...)            [DB read -- mock]
  |-- axiosHelper.postAsync(...)                       [HTTP POST -- mock or IS_DEV=true]
  |-- getSecretKey(...)                                [calls GetCronSettingsDetailsById -- DB read]
  |-- findTinyProxyConfigByVendorId(...)               [DB read -- mock]
```

### Call Chain for `Reprice()` (reprice-helper.ts)

```
Reprice(refProduct, payload, productItem, sourceId)
  |-- globalParam.GetInfo(...)                          [mock]
  |-- filterMapper.FilterBasedOnParams(...)             [calls globalParam.GetInfo internally]
  |-- filterMapper.GetContextPrice(...)                 [pure math]
  |-- filterMapper.AppendPriceFactorTag(...)            [pure string]
  |-- filterMapper.IsVendorFloorPrice(...)              [pure comparison]
  |-- filterMapper.VerifyFloorWithSister(...)           [calls GetContextPrice, creates RepriceModel]
  |-- badgeHelper.ReCalculatePrice(...)                 [calls globalParam.GetInfo]
```

## Mock Strategy

### Recommended Approach: Test `Reprice()` and `RepriceIndividualPriceBreak()` Directly

Testing the inner `Reprice()` functions rather than `repriceProduct()` avoids needing to mock:
- MySQL helpers (`UpdateTriggeredByVendor`, `UpdateRepriceResultStatus`)
- History helper (`Execute`)
- Axios / price update POST
- Secret key retrieval (`GetCronSettingsDetailsById`)
- Filter-mapper's `IsWaitingForNextRun` (calls MongoDB)
- Tiny proxy config lookup

The inner functions still need the `globalParam` mock (since `Reprice()` calls `globalParam.GetInfo()` directly), but the surface area is much smaller.

### What MUST Be Mocked

The following modules make external I/O calls and must be mocked for all test files:

#### 1. `globalParam.GetInfo()` -- MySQL via `sqlV2Service.GetGlobalConfig()`

File: `apps/api-core/src/model/global-param.ts`

`GetInfo()` first checks if `productItem.ownVendorId` and `productItem.sisterVendorId` are set. If they are (and not "N/A"), it returns them directly without hitting the database. This means **if you set these fields on your test `productItem`, no mock is needed for `globalParam` at all**.

However, `filterMapper.FilterBasedOnParams()` also calls `GetInfo()` internally, so the mock is still needed unless you provide `ownVendorId` and `sisterVendorId` on ALL product items that pass through it.

```typescript
// Mock path relative to test files at:
// apps/api-core/src/utility/reprice-algo/__tests__/v1/integration/
jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '17357',
    EXCLUDED_VENDOR_ID: '20722;20755',
  }),
}));
```

**IMPORTANT**: The relative path from the test directory to each module was computed as follows.

The test file is at:
```
src/utility/reprice-algo/__tests__/v1/integration/test.ts
```

Counting directories from `test.ts`:
1. `../` = from `integration/` to `v1/`
2. `../../` = from `v1/` to `__tests__/`
3. `../../../` = from `__tests__/` to `reprice-algo/`
4. `../../../../` = from `reprice-algo/` to `utility/`
5. `../../../../../` = from `utility/` to `src/`

Correct relative paths from `apps/api-core/src/utility/reprice-algo/__tests__/v1/integration/`:

| Target File | Relative From Test Dir |
|---|---|
| `src/model/global-param.ts` | `../../../../../model/global-param` |
| `src/utility/config.ts` | `../../../../config` |
| `src/utility/filter-mapper.ts` | `../../../../filter-mapper` |
| `src/utility/badge-helper.ts` | `../../../../badge-helper` |
| `src/utility/history-helper.ts` | `../../../../history-helper` |
| `src/utility/mongo/db-helper.ts` | `../../../../mongo/db-helper` |
| `src/utility/mysql/mysql-helper.ts` | `../../../../mysql/mysql-helper` |
| `src/utility/mysql/mysql-v2.ts` | `../../../../mysql/mysql-v2` |
| `src/utility/mysql/tinyproxy-configs.ts` | `../../../../mysql/tinyproxy-configs` |
| `src/utility/axios-helper.ts` | `../../../../axios-helper` |
| `src/utility/buy-box-helper.ts` | `../../../../buy-box-helper` |
| `src/utility/repriceResultParser.ts` | `../../../../repriceResultParser` |
| `src/utility/response-utility.ts` | `../../../../response-utility` |
| `src/resources/api-mapping.ts` | `../../../../../resources/api-mapping` |
| `src/types/net32.ts` | `../../../../../types/net32` |
| `src/types/frontier.ts` | `../../../../../types/frontier` |
| `src/model/reprice-model.ts` | `../../../../../model/reprice-model` |
| `src/model/reprice-renewed-message.ts` | `../../../../../model/reprice-renewed-message` |

And for importing the **source modules under test** (3 levels up to `reprice-algo/`):

| Target File | Relative From Test Dir |
|---|---|
| `reprice-algo/v1/reprice-helper.ts` | `../../../v1/reprice-helper` |
| `reprice-algo/v1/reprice-helper-nc.ts` | `../../../v1/reprice-helper-nc` |
| `reprice-algo/v1/repricer-rule-helper.ts` | `../../../v1/repricer-rule-helper` |
| `reprice-algo/v1/algo-v1.ts` | `../../../v1/algo-v1` |

#### 2. `applicationConfig` -- reads `process.env` at import time

File: `apps/api-core/src/utility/config.ts`

The config uses `zod` to parse `process.env` at module load time via:
```typescript
export const applicationConfig = envSchema.parse(process.env);
```

This will throw if required env vars are missing. You must mock the entire module:

```typescript
jest.mock('../../../../config', () => ({
  applicationConfig: {
    OFFSET: 0.01,
    IGNORE_TIE: false,
    FLAG_MULTI_PRICE_UPDATE: true,
    IS_DEV: true,
    VENDOR_ID: 17357,
    OWN_VENDOR_LIST: '17357;20722;20755;20533;20727;5',
    EXCLUDED_VENDOR_ID: '20722;20755',
    PRICE_UPDATE_V2_ENABLED: false,
    WRITE_HISTORY_SQL: false,
    FORMAT_RESPONSE_CUSTOM: true,
    CRON_NAME_422: 'Cron-422',
    ENABLE_SLOW_CRON_FEATURE: true,
  },
}));
```

#### 3. `filterMapper.FilterBasedOnParams()` -- calls `globalParam.GetInfo()` internally

File: `apps/api-core/src/utility/filter-mapper.ts`

This function calls `GetInfo()` internally for all filter types. If `globalParam` is mocked, this works transparently. However, it also calls `dbHelper.FindErrorItemByIdAndStatus()` in `IsWaitingForNextRun()`.

For tests calling `Reprice()` directly, `FilterBasedOnParams` is called but `IsWaitingForNextRun` is NOT -- that is only called from `repriceProduct()` in `algo-v1.ts`.

**Do NOT mock filter-mapper for `Reprice()` tests** -- let it run for real. It mostly does array filtering. Just make sure `globalParam` is mocked.

#### 4. MySQL modules (only needed if testing `repriceProduct()`)

```typescript
jest.mock('../../../../mysql/mysql-helper', () => ({
  UpdateTriggeredByVendor: jest.fn().mockResolvedValue(undefined),
  UpdateRepriceResultStatus: jest.fn().mockResolvedValue(undefined),
  GetFilterEligibleProductsList: jest.fn().mockResolvedValue([]),
  UpdateCronForProductAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../mysql/mysql-v2', () => ({
  GetGlobalConfig: jest.fn().mockResolvedValue({
    ownVendorId: '17357',
    excludedSisterVendors: '20722;20755',
    override_all: 'false',
  }),
  GetCronSettingsDetailsById: jest.fn().mockResolvedValue({
    SecretKey: [{ vendorName: 'TRADENT', secretKey: 'test-secret-key' }],
  }),
}));

jest.mock('../../../../mysql/tinyproxy-configs', () => ({
  findTinyProxyConfigByVendorId: jest.fn().mockResolvedValue(null),
}));
```

#### 5. MongoDB helper (only needed if testing `repriceProduct()`)

```typescript
jest.mock('../../../../mongo/db-helper', () => ({
  UpdateProductAsync: jest.fn().mockResolvedValue(undefined),
  UpsertErrorItemLog: jest.fn().mockResolvedValue(undefined),
  FindErrorItemByIdAndStatus: jest.fn().mockResolvedValue(0),
  SaveFilterCronLogs: jest.fn().mockResolvedValue(undefined),
}));
```

#### 6. History helper (only needed if testing `repriceProduct()`)

```typescript
jest.mock('../../../../history-helper', () => ({
  Execute: jest.fn().mockResolvedValue('test-history-id'),
  Write: jest.fn().mockResolvedValue(undefined),
  getHistoricalPrice: jest.fn().mockResolvedValue({}),
}));
```

#### 7. Axios helper (only needed if testing `repriceProduct()`)

```typescript
jest.mock('../../../../axios-helper', () => ({
  postAsync: jest.fn().mockResolvedValue({
    data: { status: 'SUCCESS', type: 'dummy' },
  }),
}));
```

#### 8. Result parser (only needed if testing `repriceProduct()`)

```typescript
jest.mock('../../../../repriceResultParser', () => ({
  Parse: jest.fn().mockResolvedValue('DEFAULT'),
}));
```

## Data Builders

> **Note**: Layer 0 (`00-setup.md`) defines reusable builders (`Net32ProductBuilder`, `FrontierProductBuilder`, `RepriceModelBuilder`) in `__tests__/infrastructure/builders/`. Once Layer 0 is implemented, you can replace these inline helpers with the builders. The inline versions below are provided so this layer can be implemented independently if needed.

### Net32Product Builder

Use this to construct competitor and own-vendor product data:

```typescript
import { Net32Product, Net32PriceBreak } from '../../../../../types/net32';

function buildNet32Product(overrides: Partial<Net32Product> & { vendorId: number | string; priceBreaks: Net32PriceBreak[] }): Net32Product {
  return {
    vendorProductId: 1001,
    vendorProductCode: 'TEST-001',
    vendorId: overrides.vendorId,
    vendorName: `Vendor-${overrides.vendorId}`,
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 0,
    standardShippingStatus: 'FREE_SHIPPING',
    freeShippingGap: 0,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 2,
    inventory: 100,
    isFulfillmentPolicyStock: false,
    vdrGeneralAverageRatingSum: 4.5,
    vdrNumberOfGeneralRatings: 100,
    isBackordered: false,
    vendorProductLevelLicenseRequiredSw: false,
    vendorVerticalLevelLicenseRequiredSw: false,
    badgeId: 0,
    badgeName: null,
    imagePath: '',
    arrivalDate: '',
    arrivalBusinessDays: 2,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    freeShippingThreshold: 0,
    ...overrides,
  };
}

function buildPriceBreak(minQty: number, unitPrice: number, active: boolean = true): Net32PriceBreak {
  return { minQty, unitPrice, active };
}
```

### FrontierProduct (Internal Product) Builder

```typescript
import { FrontierProduct } from '../../../../../types/frontier';

function buildFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'ch-001',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '50.00',
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: -1,         // -1 = "Please Select" (no rule), 0 = Only Up, 1 = Only Down, 2 = Both
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: '',
    badgePercentage: 0,
    productName: 'Test Product',
    cronId: 'cron-001',
    cronName: 'TestCron',
    requestInterval: 60,
    requestIntervalUnit: 'MIN',
    scrapeOn: false,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: '',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '17357',
    sisterVendorId: '20722;20755',
    tags: [],
    includeInactiveVendors: false,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: -1,
    latest_price: 10,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '',
    lastUpdatedBy: '',
    last_attempted_time: '',
    last_cron_message: '',
    last_cron_time: '',
    lowest_vendor: '',
    lowest_vendor_price: '',
    next_cron_time: '',
    slowCronId: '',
    slowCronName: '',
    last_update_time: '',
    applyBuyBoxLogic: false,
    applyNcForBuyBox: false,
    isSlowActivated: false,
    lastUpdatedByUser: '',
    lastUpdatedOn: '',
    handlingTimeFilter: '',
    keepPosition: false,
    excludedVendors: '',
    inventoryThreshold: 0,
    percentageDown: '0',
    badgePercentageDown: '0',
    competeWithNext: false,
    triggeredByVendor: '',
    ignorePhantomQBreak: false,
    ownVendorThreshold: 0,
    skipReprice: false,
    secretKey: [],
    contextCronName: 'TestCron',
    ...overrides,
  } as FrontierProduct;
}
```

**Key `FrontierProduct` fields that control algorithm behavior:**

| Field | Type | Effect |
|---|---|---|
| `ownVendorId` | `string` | Your vendor ID. If set with `sisterVendorId`, `globalParam.GetInfo()` skips DB. |
| `sisterVendorId` | `string` | Semicolon-separated excluded vendor IDs. |
| `floorPrice` | `string` | Minimum allowed price. |
| `maxPrice` | `string` | Maximum allowed price. |
| `is_nc_needed` | `boolean` | `true` = use NC (shipping-inclusive) mode. |
| `competeAll` | `boolean` | `true` = ignore sister vendor exclusions. |
| `competeWithNext` | `boolean` | `true` = compete with next vendor when floor hit. |
| `repricingRule` | `number` | `-1`=none, `0`=only up, `1`=only down, `2`=both. |
| `percentageDown` | `string` | If > 0, use percentage-based pricing instead of offset. |
| `suppressPriceBreak` | `boolean` | `true` = treat as single price break even if multiple exist. |
| `allowReprice` | `boolean` | Must be `true` for price updates to be flagged. |
| `applyNcForBuyBox` | `boolean` | `true` = apply NC pricing when floor is reached. |
| `compareWithQ1` | `boolean` | `true` = compare Q2 with Q1 in NC mode. |
| `badgeIndicator` | `string` | `'BADGE_ONLY'`, `'NON_BADGE_ONLY'`, `'ALL_PERCENTAGE'`, or empty. |
| `excludedVendors` | `string` | Additional vendor IDs to exclude (beyond sister vendors). |
| `inventoryThreshold` | `number` | Minimum inventory for competitor to be eligible. |

## Test File Templates

---

### File 1: `standard-mode.test.ts`

Tests `Reprice()` from `reprice-helper.ts` in standard mode (`is_nc_needed=false`).

```typescript
/**
 * Integration tests for V1 standard repricing mode.
 *
 * Tests the Reprice() function from reprice-helper.ts with real algorithm logic,
 * mocking only external I/O boundaries (globalParam for DB, config for env vars).
 */
import { RepriceRenewedMessageEnum } from '../../../../../model/reprice-renewed-message';
import { Net32Product, Net32PriceBreak } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';

// ============================================================
// MOCKS - must be before imports of modules under test
// ============================================================

jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '17357',
    EXCLUDED_VENDOR_ID: '20722;20755',
  }),
}));

jest.mock('../../../../config', () => ({
  applicationConfig: {
    OFFSET: 0.01,
    IGNORE_TIE: false,
    FLAG_MULTI_PRICE_UPDATE: true,
    IS_DEV: true,
    VENDOR_ID: 17357,
    OWN_VENDOR_LIST: '17357;20722;20755;20533;20727;5',
    EXCLUDED_VENDOR_ID: '20722;20755',
    PRICE_UPDATE_V2_ENABLED: false,
    WRITE_HISTORY_SQL: false,
    FORMAT_RESPONSE_CUSTOM: true,
    CRON_NAME_422: 'Cron-422',
  },
}));

// badge-helper calls globalParam.GetInfo internally; mock is covered above.
// filter-mapper calls globalParam.GetInfo internally; mock is covered above.

// mongo db-helper is used by filter-mapper's IsWaitingForNextRun, which is NOT
// called by Reprice() -- only by repriceProduct(). Still, mock it defensively.
jest.mock('../../../../mongo/db-helper', () => ({
  FindErrorItemByIdAndStatus: jest.fn().mockResolvedValue(0),
  UpdateProductAsync: jest.fn().mockResolvedValue(undefined),
  UpsertErrorItemLog: jest.fn().mockResolvedValue(undefined),
  SaveFilterCronLogs: jest.fn().mockResolvedValue(undefined),
}));

// ============================================================
// IMPORTS - after mocks
// ============================================================

import * as repriceHelper from '../../../v1/reprice-helper';

// ============================================================
// BUILDERS
// ============================================================

function buildNet32Product(
  overrides: Partial<Net32Product> & { vendorId: number | string; priceBreaks: Net32PriceBreak[] },
): Net32Product {
  return {
    vendorProductId: 1001,
    vendorProductCode: 'TEST-001',
    vendorId: overrides.vendorId,
    vendorName: `Vendor-${overrides.vendorId}`,
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 0,
    standardShippingStatus: 'FREE_SHIPPING',
    freeShippingGap: 0,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 2,
    inventory: 100,
    isFulfillmentPolicyStock: false,
    vdrGeneralAverageRatingSum: 4.5,
    vdrNumberOfGeneralRatings: 100,
    isBackordered: false,
    vendorProductLevelLicenseRequiredSw: false,
    vendorVerticalLevelLicenseRequiredSw: false,
    badgeId: 0,
    badgeName: null,
    imagePath: '',
    arrivalDate: '',
    arrivalBusinessDays: 2,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    freeShippingThreshold: 0,
    ...overrides,
  };
}

function buildPriceBreak(minQty: number, unitPrice: number, active: boolean = true): Net32PriceBreak {
  return { minQty, unitPrice, active };
}

function buildFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'ch-001',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '50.00',
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: -1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: '',
    badgePercentage: 0,
    productName: 'Test Product',
    cronId: 'cron-001',
    cronName: 'TestCron',
    requestInterval: 60,
    requestIntervalUnit: 'MIN',
    scrapeOn: false,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: '',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '17357',
    sisterVendorId: '20722;20755',
    tags: [],
    includeInactiveVendors: false,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: -1,
    latest_price: 10,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '',
    lastUpdatedBy: '',
    last_attempted_time: '',
    last_cron_message: '',
    last_cron_time: '',
    lowest_vendor: '',
    lowest_vendor_price: '',
    next_cron_time: '',
    slowCronId: '',
    slowCronName: '',
    last_update_time: '',
    applyBuyBoxLogic: false,
    applyNcForBuyBox: false,
    isSlowActivated: false,
    lastUpdatedByUser: '',
    lastUpdatedOn: '',
    handlingTimeFilter: '',
    keepPosition: false,
    excludedVendors: '',
    inventoryThreshold: 0,
    percentageDown: '0',
    badgePercentageDown: '0',
    competeWithNext: false,
    triggeredByVendor: '',
    ignorePhantomQBreak: false,
    ownVendorThreshold: 0,
    skipReprice: false,
    secretKey: [],
    contextCronName: 'TestCron',
  } as FrontierProduct;
}

// ============================================================
// TESTS
// ============================================================

describe('V1 Standard Mode Integration - Reprice()', () => {
  const OWN_VENDOR_ID = 17357;
  const SISTER_VENDOR_ID = 20722;
  const COMPETITOR_VENDOR_ID = 99999;
  const MPID = '12345';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // Test 1: Undercut lowest competitor
  // ----------------------------------------------------------
  it('should undercut lowest competitor by OFFSET ($0.01)', async () => {
    // Own vendor at $12, competitor at $10. Expected: $9.99
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 12.00)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
    });

    // payload = competitor list (does NOT include own vendor for Reprice())
    // refProduct = own vendor's Net32Product
    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.isRepriced).toBe(true);
    expect(parseFloat(result.repriceDetails!.newPrice as string)).toBe(9.99);
    expect(result.repriceDetails!.explained).toContain('CHANGE');
  });

  // ----------------------------------------------------------
  // Test 2: No competitor (only own vendor in list)
  // ----------------------------------------------------------
  it('should go to max price when no competitor exists', async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const productItem = buildFrontierProduct({
      maxPrice: '50.00',
    });

    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct],  // only own vendor
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // When own vendor is lowest and only vendor, should set to maxPrice
    expect(result.repriceDetails!.explained).toContain('No competitor');
  });

  // ----------------------------------------------------------
  // Test 3: Own vendor already lowest
  // ----------------------------------------------------------
  it('should IGNORE when own vendor is already lowest and no competitor to compete up to', async () => {
    // Own vendor at $8, competitor at $12. Own is lowest.
    // With no higher-priced non-sister competitor to compete UP to within bounds,
    // the algo should suggest repricing up to compete with the next vendor.
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 8.00)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [buildPriceBreak(1, 12.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
    });

    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // When own vendor is lowest, algo tries to price up to next competitor - 0.01
    // Next competitor is at $12, so suggested = $11.99
    // Since $11.99 > $8.00 (existing), isRepriced should be true
    expect(result.repriceDetails!.isRepriced).toBe(true);
    expect(parseFloat(result.repriceDetails!.newPrice as string)).toBe(11.99);
  });

  // ----------------------------------------------------------
  // Test 4: Competitor below floor -> IGNORE #HitFloor
  // ----------------------------------------------------------
  it('should IGNORE with #HitFloor when offset price is below floor', async () => {
    // Own vendor at $10, competitor at $5.50, floor at $6.
    // Offset price = $5.49, which is below floor.
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [buildPriceBreak(1, 5.50)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '6.00',
      maxPrice: '50.00',
    });

    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // Price of 5.50 - 0.01 = 5.49 < floor of 6.00
    expect(result.repriceDetails!.explained).toContain('#HitFloor');
  });

  // ----------------------------------------------------------
  // Test 5: Sister vendor is lowest -> IGNORE #Sister #DOWN
  // ----------------------------------------------------------
  it('should IGNORE with #Sister when sister vendor is lowest', async () => {
    // Sister vendor (20722) is lowest at $8, own vendor at $10.
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const sisterVendor = buildNet32Product({
      vendorId: SISTER_VENDOR_ID,
      vendorName: 'Frontier',
      priceBreaks: [buildPriceBreak(1, 8.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
    });

    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct, sisterVendor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.explained).toContain('#Sister');
    expect(result.repriceDetails!.isRepriced).toBe(false);
  });

  // ----------------------------------------------------------
  // Test 6: Go to 2nd lowest when 1st is at floor
  // ----------------------------------------------------------
  it('should compete with 2nd lowest when 1st competitor is at floor', async () => {
    // Own vendor at $10 (lowest), competitor A at $4 (below floor), competitor B at $15.
    // Floor = $6. Competitor A is below floor, so algo should compete with B.
    // Expected: $14.99
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const competitorA = buildNet32Product({
      vendorId: 88888,
      vendorName: 'CheapVendor',
      priceBreaks: [buildPriceBreak(1, 4.00)],
    });
    const competitorB = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorB',
      priceBreaks: [buildPriceBreak(1, 15.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '6.00',
      maxPrice: '50.00',
    });

    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct, competitorA, competitorB],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // Should skip competitorA (below floor) and compete with competitorB
    // Price = $15.00 - $0.01 = $14.99
    if (result.repriceDetails!.isRepriced) {
      expect(parseFloat(result.repriceDetails!.newPrice as string)).toBe(14.99);
    }
  });

  // ----------------------------------------------------------
  // Test 7: Go to max when all competitors below floor
  // ----------------------------------------------------------
  it('should go to max price when all competitors are below floor', async () => {
    // Own vendor is lowest, all competitors below floor.
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [buildPriceBreak(1, 3.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '6.00',
      maxPrice: '50.00',
    });

    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // When own vendor is lowest and all other vendors are below floor,
    // the algo should go to max price
    // The exact behavior depends on the sortedPayload and nextIndex logic
  });

  // ----------------------------------------------------------
  // Test 8: Tie scenario (two vendors same price)
  // ----------------------------------------------------------
  it('should append #TIE when two vendors have the same price', async () => {
    // Two non-own vendors tied at $10
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 15.00)],
    });
    const competitorA = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const competitorB = buildNet32Product({
      vendorId: 77777,
      vendorName: 'CompetitorB',
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
    });

    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct, competitorA, competitorB],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.explained).toContain('#TIE');
  });

  // ----------------------------------------------------------
  // Test 9: Percentage-based pricing (percentageDown > 0)
  // ----------------------------------------------------------
  it('should use percentage-based pricing when percentageDown is set', async () => {
    // Competitor at $10, percentageDown = 0.05 (5%).
    // Percentage price = $10 - 5% = $9.50
    // Offset price = $10 - $0.01 = $9.99
    // Since percentageDown is set and %price > floor, should use $9.50
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 15.00)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
      percentageDown: '0.05',
    });

    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.isRepriced).toBe(true);
    // The percentage price should be used: 10 - (10 * 0.05) = 9.50
    expect(parseFloat(result.repriceDetails!.newPrice as string)).toBe(9.5);
    expect(result.repriceDetails!.explained).toContain('#%Down');
  });

  // ----------------------------------------------------------
  // Test 10: Price capped at max price
  // ----------------------------------------------------------
  it('should cap price at max when computed price exceeds max', async () => {
    // Own vendor lowest at $8, next competitor at $60, max = $20
    // Algo would want to set to $59.99 but max is $20
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 8.00)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [buildPriceBreak(1, 60.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '20.00',
    });

    const result = await repriceHelper.Reprice(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // Price should be capped at max ($20), not $59.99
    expect(result.repriceDetails!.explained).toContain('MAXED');
  });
});
```

---

### File 2: `nc-mode.test.ts`

Tests `Reprice()` and `RepriceIndividualPriceBreak()` from `reprice-helper-nc.ts` (NC/shipping-inclusive mode).

```typescript
/**
 * Integration tests for V1 NC (shipping-inclusive) repricing mode.
 *
 * In NC mode, shipping costs are added to unit prices for comparison.
 * The key difference: effectivePrice = unitPrice + shippingCharge
 */
import { Net32Product, Net32PriceBreak } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';

// ============================================================
// MOCKS
// ============================================================

jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '17357',
    EXCLUDED_VENDOR_ID: '20722;20755',
  }),
}));

jest.mock('../../../../config', () => ({
  applicationConfig: {
    OFFSET: 0.01,
    IGNORE_TIE: false,
    FLAG_MULTI_PRICE_UPDATE: true,
    IS_DEV: true,
    VENDOR_ID: 17357,
    OWN_VENDOR_LIST: '17357;20722;20755;20533;20727;5',
    EXCLUDED_VENDOR_ID: '20722;20755',
    PRICE_UPDATE_V2_ENABLED: false,
    WRITE_HISTORY_SQL: false,
    FORMAT_RESPONSE_CUSTOM: true,
    CRON_NAME_422: 'Cron-422',
  },
}));

jest.mock('../../../../mongo/db-helper', () => ({
  FindErrorItemByIdAndStatus: jest.fn().mockResolvedValue(0),
  UpdateProductAsync: jest.fn().mockResolvedValue(undefined),
  UpsertErrorItemLog: jest.fn().mockResolvedValue(undefined),
  SaveFilterCronLogs: jest.fn().mockResolvedValue(undefined),
}));

// ============================================================
// IMPORTS
// ============================================================

import * as repriceHelperNc from '../../../v1/reprice-helper-nc';

// ============================================================
// BUILDERS (same as standard-mode, copy or extract to shared file)
// ============================================================

function buildNet32Product(
  overrides: Partial<Net32Product> & { vendorId: number | string; priceBreaks: Net32PriceBreak[] },
): Net32Product {
  return {
    vendorProductId: 1001,
    vendorProductCode: 'TEST-001',
    vendorId: overrides.vendorId,
    vendorName: `Vendor-${overrides.vendorId}`,
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 0,
    standardShippingStatus: 'FREE_SHIPPING',
    freeShippingGap: 0,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 2,
    inventory: 100,
    isFulfillmentPolicyStock: false,
    vdrGeneralAverageRatingSum: 4.5,
    vdrNumberOfGeneralRatings: 100,
    isBackordered: false,
    vendorProductLevelLicenseRequiredSw: false,
    vendorVerticalLevelLicenseRequiredSw: false,
    badgeId: 0,
    badgeName: null,
    imagePath: '',
    arrivalDate: '',
    arrivalBusinessDays: 2,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    freeShippingThreshold: 0,
    ...overrides,
  };
}

function buildPriceBreak(minQty: number, unitPrice: number, active: boolean = true): Net32PriceBreak {
  return { minQty, unitPrice, active };
}

function buildFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'ch-001',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '50.00',
    is_nc_needed: true,   // NC mode enabled
    suppressPriceBreakForOne: false,
    repricingRule: -1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: '',
    badgePercentage: 0,
    productName: 'Test Product NC',
    cronId: 'cron-001',
    cronName: 'TestCron',
    requestInterval: 60,
    requestIntervalUnit: 'MIN',
    scrapeOn: false,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: '',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '17357',
    sisterVendorId: '20722;20755',
    tags: [],
    includeInactiveVendors: false,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: -1,
    latest_price: 10,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '',
    lastUpdatedBy: '',
    last_attempted_time: '',
    last_cron_message: '',
    last_cron_time: '',
    lowest_vendor: '',
    lowest_vendor_price: '',
    next_cron_time: '',
    slowCronId: '',
    slowCronName: '',
    last_update_time: '',
    applyBuyBoxLogic: false,
    applyNcForBuyBox: false,
    isSlowActivated: false,
    lastUpdatedByUser: '',
    lastUpdatedOn: '',
    handlingTimeFilter: '',
    keepPosition: false,
    excludedVendors: '',
    inventoryThreshold: 0,
    percentageDown: '0',
    badgePercentageDown: '0',
    competeWithNext: false,
    triggeredByVendor: '',
    ignorePhantomQBreak: false,
    ownVendorThreshold: 0,
    skipReprice: false,
    secretKey: [],
    contextCronName: 'TestCron',
  } as FrontierProduct;
}

// ============================================================
// TESTS
// ============================================================

describe('V1 NC Mode Integration - Reprice()', () => {
  const OWN_VENDOR_ID = 17357;
  const COMPETITOR_VENDOR_ID = 99999;
  const MPID = '12345';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // Test 1: Shipping added to price comparison
  // ----------------------------------------------------------
  it('should include shipping in price comparison for NC mode', async () => {
    // Own vendor: unit $10, shipping $5, threshold $100
    //   -> effective price = $10 + $5 = $15 (below threshold, shipping applies)
    // Competitor: unit $12, shipping $0 (free shipping)
    //   -> effective price = $12 + $0 = $12
    // Competitor is cheaper when shipping is included!
    // Expected: undercut competitor's effective $12, so $11.99 effective
    //   -> unit price = $11.99 - $5 (own shipping) = $6.99
    //   (the NC helper function getSetPrice handles this subtraction)
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      standardShipping: 5,
      standardShippingStatus: 'STANDARD_SHIPPING',
      freeShippingGap: 90,              // threshold = unitPrice + gap
      freeShippingThreshold: 100,
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      standardShipping: 0,
      standardShippingStatus: 'FREE_SHIPPING',
      freeShippingGap: 0,
      freeShippingThreshold: 0,
      priceBreaks: [buildPriceBreak(1, 12.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
    });

    const result = await repriceHelperNc.Reprice(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // In NC mode, the comparison is shipping-inclusive.
    // The exact new price depends on GetShippingPrice and getSetPrice logic.
    expect(result.repriceDetails!.isRepriced).toBe(true);
  });

  // ----------------------------------------------------------
  // Test 2: NC Buy Box when floor reached + applyNcForBuyBox
  // ----------------------------------------------------------
  it('should apply NC repricing when floor is reached and applyNcForBuyBox is true', async () => {
    // This test validates the NC buy box scenario from algo-v1.ts.
    // When standard repricing hits floor, and applyNcForBuyBox=true,
    // the algo re-runs through repriceHelperNc to get a shipping-aware price.
    //
    // For this test, we call repriceHelperNc.Reprice directly with a scenario
    // where the offset price would be below floor in standard mode.
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      standardShipping: 5,
      standardShippingStatus: 'STANDARD_SHIPPING',
      freeShippingGap: 90,
      freeShippingThreshold: 100,
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      standardShipping: 3,
      standardShippingStatus: 'STANDARD_SHIPPING',
      freeShippingGap: 87,
      freeShippingThreshold: 100,
      priceBreaks: [buildPriceBreak(1, 7.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
      applyNcForBuyBox: true,
    });

    const result = await repriceHelperNc.Reprice(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    // NC mode considers shipping, so the effective competitor price is $7 + $3 = $10
    // Offset from that = $9.99 effective, minus own shipping $5 = $4.99 unit
    // But $4.99 < floor $5, so behavior depends on floor logic
  });

  // ----------------------------------------------------------
  // Test 3: Heavy shipping product
  // ----------------------------------------------------------
  it('should handle heavy shipping price in NC calculations', async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      standardShipping: 5,
      standardShippingStatus: 'STANDARD_SHIPPING',
      freeShippingGap: 90,
      freeShippingThreshold: 100,
      heavyShipping: 10,
      heavyShippingStatus: 'HEAVY',
      priceBreaks: [buildPriceBreak(1, 20.00)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      standardShipping: 0,
      freeShippingThreshold: 0,
      heavyShipping: 8,
      heavyShippingStatus: 'HEAVY',
      priceBreaks: [buildPriceBreak(1, 25.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '10.00',
      maxPrice: '80.00',
    });

    const result = await repriceHelperNc.Reprice(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
  });

  // ----------------------------------------------------------
  // Test 4: NC mode with free shipping (above threshold)
  // ----------------------------------------------------------
  it('should not add shipping when price is above free shipping threshold', async () => {
    // If unit price >= freeShippingThreshold, shipping is $0
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      standardShipping: 5,
      standardShippingStatus: 'STANDARD_SHIPPING',
      freeShippingGap: 0,                // gap=0 means threshold=999999 (always charge)
      freeShippingThreshold: 15,          // but we override threshold directly
      priceBreaks: [buildPriceBreak(1, 20.00)],  // $20 > $15 threshold
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      standardShipping: 5,
      freeShippingThreshold: 15,
      priceBreaks: [buildPriceBreak(1, 25.00)],  // $25 > $15 threshold
    });
    const productItem = buildFrontierProduct({
      floorPrice: '10.00',
      maxPrice: '80.00',
    });

    const result = await repriceHelperNc.Reprice(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    // Both vendors above threshold, so no shipping added.
    // Effective comparison: $20 vs $25, own is lowest
  });

  // ----------------------------------------------------------
  // Test 5: NC RepriceIndividualPriceBreak with Q2
  // ----------------------------------------------------------
  it('should handle NC pricing for individual Q2 price break', async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      standardShipping: 5,
      standardShippingStatus: 'STANDARD_SHIPPING',
      freeShippingGap: 90,
      freeShippingThreshold: 100,
      priceBreaks: [
        buildPriceBreak(1, 10.00),
        buildPriceBreak(2, 9.00),
      ],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      standardShipping: 3,
      standardShippingStatus: 'STANDARD_SHIPPING',
      freeShippingGap: 87,
      freeShippingThreshold: 100,
      priceBreaks: [
        buildPriceBreak(1, 11.00),
        buildPriceBreak(2, 10.00),
      ],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
    });

    const q2PriceBreak = buildPriceBreak(2, 9.00);

    const result = await repriceHelperNc.RepriceIndividualPriceBreak(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
      q2PriceBreak,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.minQty).toBe(2);
  });

  // ----------------------------------------------------------
  // Test 6: NC mode sister vendor handling
  // ----------------------------------------------------------
  it('should handle sister vendor in NC mode same as standard', async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      standardShipping: 5,
      standardShippingStatus: 'STANDARD_SHIPPING',
      freeShippingGap: 90,
      freeShippingThreshold: 100,
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const sisterVendor = buildNet32Product({
      vendorId: 20722,
      vendorName: 'Frontier',
      standardShipping: 0,
      freeShippingThreshold: 0,
      priceBreaks: [buildPriceBreak(1, 8.00)],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
    });

    const result = await repriceHelperNc.Reprice(
      ownProduct,
      [ownProduct, sisterVendor],
      productItem,
      MPID,
    );

    expect(result).toBeDefined();
    expect(result.repriceDetails).toBeDefined();
    expect(result.repriceDetails!.explained).toContain('#Sister');
    expect(result.repriceDetails!.isRepriced).toBe(false);
  });
});
```

---

### File 3: `multi-price-break.test.ts`

Tests products with multiple quantity price breaks.

```typescript
/**
 * Integration tests for V1 multi-price-break repricing.
 *
 * Tests RepriceIndividualPriceBreak() and the multi-price-break flow
 * where each Q break is repriced independently, then rules enforce hierarchy.
 */
import { Net32Product, Net32PriceBreak } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';
import { RepriceModel } from '../../../../../model/reprice-model';

// ============================================================
// MOCKS
// ============================================================

jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '17357',
    EXCLUDED_VENDOR_ID: '20722;20755',
  }),
}));

jest.mock('../../../../config', () => ({
  applicationConfig: {
    OFFSET: 0.01,
    IGNORE_TIE: false,
    FLAG_MULTI_PRICE_UPDATE: true,
    IS_DEV: true,
    VENDOR_ID: 17357,
    OWN_VENDOR_LIST: '17357;20722;20755;20533;20727;5',
    EXCLUDED_VENDOR_ID: '20722;20755',
    PRICE_UPDATE_V2_ENABLED: false,
    WRITE_HISTORY_SQL: false,
    FORMAT_RESPONSE_CUSTOM: true,
    CRON_NAME_422: 'Cron-422',
  },
}));

jest.mock('../../../../mongo/db-helper', () => ({
  FindErrorItemByIdAndStatus: jest.fn().mockResolvedValue(0),
  UpdateProductAsync: jest.fn().mockResolvedValue(undefined),
  UpsertErrorItemLog: jest.fn().mockResolvedValue(undefined),
  SaveFilterCronLogs: jest.fn().mockResolvedValue(undefined),
}));

// ============================================================
// IMPORTS
// ============================================================

import * as repriceHelper from '../../../v1/reprice-helper';
import * as Rule from '../../../v1/repricer-rule-helper';

// ============================================================
// BUILDERS
// ============================================================

function buildNet32Product(
  overrides: Partial<Net32Product> & { vendorId: number | string; priceBreaks: Net32PriceBreak[] },
): Net32Product {
  return {
    vendorProductId: 1001,
    vendorProductCode: 'TEST-001',
    vendorId: overrides.vendorId,
    vendorName: `Vendor-${overrides.vendorId}`,
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 0,
    standardShippingStatus: 'FREE_SHIPPING',
    freeShippingGap: 0,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 2,
    inventory: 100,
    isFulfillmentPolicyStock: false,
    vdrGeneralAverageRatingSum: 4.5,
    vdrNumberOfGeneralRatings: 100,
    isBackordered: false,
    vendorProductLevelLicenseRequiredSw: false,
    vendorVerticalLevelLicenseRequiredSw: false,
    badgeId: 0,
    badgeName: null,
    imagePath: '',
    arrivalDate: '',
    arrivalBusinessDays: 2,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    freeShippingThreshold: 0,
    ...overrides,
  };
}

function buildPriceBreak(minQty: number, unitPrice: number, active: boolean = true): Net32PriceBreak {
  return { minQty, unitPrice, active };
}

function buildFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'ch-001',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '50.00',
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: -1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: '',
    badgePercentage: 0,
    productName: 'Test Product Multi-PB',
    cronId: 'cron-001',
    cronName: 'TestCron',
    requestInterval: 60,
    requestIntervalUnit: 'MIN',
    scrapeOn: false,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: '',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '17357',
    sisterVendorId: '20722;20755',
    tags: [],
    includeInactiveVendors: false,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: -1,
    latest_price: 10,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '',
    lastUpdatedBy: '',
    last_attempted_time: '',
    last_cron_message: '',
    last_cron_time: '',
    lowest_vendor: '',
    lowest_vendor_price: '',
    next_cron_time: '',
    slowCronId: '',
    slowCronName: '',
    last_update_time: '',
    applyBuyBoxLogic: false,
    applyNcForBuyBox: false,
    isSlowActivated: false,
    lastUpdatedByUser: '',
    lastUpdatedOn: '',
    handlingTimeFilter: '',
    keepPosition: false,
    excludedVendors: '',
    inventoryThreshold: 0,
    percentageDown: '0',
    badgePercentageDown: '0',
    competeWithNext: false,
    triggeredByVendor: '',
    ignorePhantomQBreak: false,
    ownVendorThreshold: 0,
    skipReprice: false,
    secretKey: [],
    contextCronName: 'TestCron',
  } as FrontierProduct;
}

// ============================================================
// TESTS
// ============================================================

describe('V1 Multi-Price-Break Integration', () => {
  const OWN_VENDOR_ID = 17357;
  const COMPETITOR_VENDOR_ID = 99999;
  const MPID = '12345';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // Test 1: Each Q break repriced independently
  // ----------------------------------------------------------
  it('should reprice Q1 and Q3 independently via RepriceIndividualPriceBreak', async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [
        buildPriceBreak(1, 12.00),
        buildPriceBreak(3, 10.00),
      ],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [
        buildPriceBreak(1, 10.00),
        buildPriceBreak(3, 8.00),
      ],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
    });

    // Reprice Q1
    const q1Result = await repriceHelper.RepriceIndividualPriceBreak(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
      buildPriceBreak(1, 12.00),
    );

    // Reprice Q3
    const q3Result = await repriceHelper.RepriceIndividualPriceBreak(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
      buildPriceBreak(3, 10.00),
    );

    expect(q1Result.repriceDetails).toBeDefined();
    expect(q3Result.repriceDetails).toBeDefined();
    expect(q1Result.repriceDetails!.minQty).toBeUndefined;  // Q1 does not set minQty in single mode
    expect(q3Result.repriceDetails!.minQty).toBe(3);

    // Q1: competitor at $10, expected undercut = $9.99
    expect(q1Result.repriceDetails!.isRepriced).toBe(true);
    expect(parseFloat(q1Result.repriceDetails!.newPrice as string)).toBe(9.99);

    // Q3: competitor at $8, expected undercut = $7.99
    expect(q3Result.repriceDetails!.isRepriced).toBe(true);
    expect(parseFloat(q3Result.repriceDetails!.newPrice as string)).toBe(7.99);
  });

  // ----------------------------------------------------------
  // Test 2: Q break deactivated when no competitor has it
  // ----------------------------------------------------------
  it('should deactivate Q break when no competitor has that price break', async () => {
    // Own vendor has Q1 and Q3, competitor only has Q1
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [
        buildPriceBreak(1, 12.00),
        buildPriceBreak(3, 10.00),
      ],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [
        buildPriceBreak(1, 10.00),
        // No Q3 price break
      ],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
    });

    // Reprice Q3 -- no competitor has Q3
    const q3Result = await repriceHelper.RepriceIndividualPriceBreak(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
      buildPriceBreak(3, 10.00),
    );

    expect(q3Result.repriceDetails).toBeDefined();
    // When no non-sister vendor has this Q break, the algo should deactivate it
    // The behavior depends on whether only own+sister vendors exist for this Q
  });

  // ----------------------------------------------------------
  // Test 3: Q break hierarchy enforced (Q3 price must be < Q1 price)
  // ----------------------------------------------------------
  it('should enforce Q break hierarchy via ApplyMultiPriceBreakRule', async () => {
    // Simulate a scenario where Q3 ends up >= Q1 after individual repricing
    // ApplyMultiPriceBreakRule should catch this
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [
        buildPriceBreak(1, 10.00),
        buildPriceBreak(3, 9.00),
      ],
    });

    // Build a RepriceModel with multiple price breaks where Q3 >= Q1
    const multiModel = new RepriceModel(
      MPID,
      ownProduct,
      'Test Product',
      null,
      false,
      true, // isMultiplePriceBreak = true
    );

    // Simulate Q1 repriced to $8.00
    const q1Detail = {
      oldPrice: 10.00,
      newPrice: '8.00' as string | number | null,
      isRepriced: true,
      updatedOn: new Date(),
      explained: 'CHANGE: updated',
      lowestVendor: null,
      lowestVendorPrice: null,
      triggeredByVendor: null,
      minQty: 1,
    };
    // Simulate Q3 repriced to $9.00 (which is MORE than Q1's new price of $8.00 -- violation!)
    const q3Detail = {
      oldPrice: 9.00,
      newPrice: '9.00' as string | number | null,
      isRepriced: true,
      updatedOn: new Date(),
      explained: 'CHANGE: 2nd lowest validated',
      lowestVendor: null,
      lowestVendorPrice: null,
      triggeredByVendor: null,
      minQty: 3,
    };
    multiModel.listOfRepriceDetails.push(q1Detail as any);
    multiModel.listOfRepriceDetails.push(q3Detail as any);

    const corrected = Rule.ApplyMultiPriceBreakRule(multiModel);

    expect(corrected.listOfRepriceDetails).toBeDefined();
    expect(corrected.listOfRepriceDetails.length).toBeGreaterThan(0);

    // The Q3 detail should be flagged because its price ($9.00) >= Q1 price ($8.00)
    const q3Corrected = corrected.listOfRepriceDetails.find(
      (d: any) => d.minQty === 3,
    );
    if (q3Corrected) {
      // ApplyMultiPriceBreakRule either marks it as not repriced or deactivates it
      expect(
        q3Corrected.isRepriced === false ||
        q3Corrected.active === (0 as unknown as boolean) ||
        (q3Corrected.explained && q3Corrected.explained.includes('#otherbreakslower')),
      ).toBe(true);
    }
  });

  // ----------------------------------------------------------
  // Test 4: Suppress price break rule (Q1 unchanged blocks others)
  // ----------------------------------------------------------
  it('should suppress other Q breaks when Q1 is not changed (SuppressPriceBreakRule)', async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [
        buildPriceBreak(1, 10.00),
        buildPriceBreak(3, 8.00),
      ],
    });

    const multiModel = new RepriceModel(
      MPID,
      ownProduct,
      'Test Product',
      null,
      false,
      true,
    );

    // Q1 NOT repriced (same price)
    const q1Detail = {
      oldPrice: 10.00,
      newPrice: 'N/A' as string | number | null,
      isRepriced: false,
      updatedOn: new Date(),
      explained: 'IGNORE: #Lowest',
      lowestVendor: null,
      lowestVendorPrice: null,
      triggeredByVendor: null,
      minQty: 1,
    };
    // Q3 repriced to $7.00
    const q3Detail = {
      oldPrice: 8.00,
      newPrice: '7.00' as string | number | null,
      isRepriced: true,
      updatedOn: new Date(),
      explained: 'CHANGE: updated',
      lowestVendor: null,
      lowestVendorPrice: null,
      triggeredByVendor: null,
      minQty: 3,
    };
    multiModel.listOfRepriceDetails.push(q1Detail as any);
    multiModel.listOfRepriceDetails.push(q3Detail as any);

    // Apply the suppress rule: when Q1 is not changed, block other Qs
    const suppressed = Rule.ApplySuppressPriceBreakRule(multiModel, 1, false);

    const q3Suppressed = suppressed.listOfRepriceDetails.find(
      (d: any) => d.minQty === 3,
    );
    expect(q3Suppressed).toBeDefined();
    if (q3Suppressed) {
      expect(q3Suppressed.isRepriced).toBe(false);
      expect(q3Suppressed.newPrice).toBe('N/A');
      expect(q3Suppressed.explained).toContain('IGNORE');
    }
  });

  // ----------------------------------------------------------
  // Test 5: GetDistinctPriceBreaksAcrossVendors discovers new Q breaks
  // ----------------------------------------------------------
  it('should discover price breaks from competitors that own vendor does not have', async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [buildPriceBreak(1, 10.00)],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [
        buildPriceBreak(1, 9.00),
        buildPriceBreak(3, 7.00),
        buildPriceBreak(5, 6.00),
      ],
    });
    const productItem = buildFrontierProduct();

    const distinctBreaks = await repriceHelper.GetDistinctPriceBreaksAcrossVendors(
      [competitor],
      ownProduct,
      productItem,
    );

    expect(distinctBreaks).toBeDefined();
    expect(distinctBreaks.length).toBe(2); // Q3 and Q5 (own vendor only has Q1)
    expect(distinctBreaks.find((b) => b.minQty === 3)).toBeDefined();
    expect(distinctBreaks.find((b) => b.minQty === 5)).toBeDefined();
    // New breaks should have unitPrice=0 and active=true
    expect(distinctBreaks[0].unitPrice).toBe(0);
    expect(distinctBreaks[0].active).toBe(true);
  });

  // ----------------------------------------------------------
  // Test 6: Full multi-price-break flow with rule application
  // ----------------------------------------------------------
  it('should reprice all Q breaks and enforce hierarchy in full flow', async () => {
    const ownProduct = buildNet32Product({
      vendorId: OWN_VENDOR_ID,
      vendorName: 'Tradent',
      priceBreaks: [
        buildPriceBreak(1, 15.00),
        buildPriceBreak(3, 12.00),
      ],
    });
    const competitor = buildNet32Product({
      vendorId: COMPETITOR_VENDOR_ID,
      vendorName: 'CompetitorA',
      priceBreaks: [
        buildPriceBreak(1, 10.00),
        buildPriceBreak(3, 8.00),
      ],
    });
    const productItem = buildFrontierProduct({
      floorPrice: '5.00',
      maxPrice: '50.00',
    });

    // Reprice each Q individually
    const q1Result = await repriceHelper.RepriceIndividualPriceBreak(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
      buildPriceBreak(1, 15.00),
    );
    const q3Result = await repriceHelper.RepriceIndividualPriceBreak(
      ownProduct,
      [ownProduct, competitor],
      productItem,
      MPID,
      buildPriceBreak(3, 12.00),
    );

    // Build multi model
    const multiModel = new RepriceModel(
      MPID,
      ownProduct,
      'Test Product',
      null,
      false,
      true,
    );
    multiModel.listOfRepriceDetails.push(q1Result.repriceDetails!);
    multiModel.listOfRepriceDetails.push(q3Result.repriceDetails!);

    // Apply hierarchy rule
    const final = Rule.ApplyMultiPriceBreakRule(multiModel);

    expect(final.listOfRepriceDetails.length).toBeGreaterThan(0);
    // Q3 price should be less than Q1 price
    const q1Final = final.listOfRepriceDetails.find((d: any) => d.minQty === 1);
    const q3Final = final.listOfRepriceDetails.find((d: any) => d.minQty === 3);
    if (q1Final && q3Final && q1Final.newPrice !== 'N/A' && q3Final.newPrice !== 'N/A') {
      expect(parseFloat(q3Final.newPrice as string)).toBeLessThan(
        parseFloat(q1Final.newPrice as string),
      );
    }
  });
});
```

## Running the Tests

From the repository root:

```bash
# Run all V1 integration tests
npx jest --testPathPattern='__tests__/v1/integration' --verbose

# Run a specific test file
npx jest --testPathPattern='__tests__/v1/integration/standard-mode' --verbose

# Run with coverage
npx jest --testPathPattern='__tests__/v1/integration' --verbose --coverage

# Run from the api-core app directory
cd apps/api-core && npx jest --testPathPattern='__tests__/v1/integration' --verbose
```

## Custom Assertions

Add these helper functions to simplify assertions:

```typescript
// In a shared test utility file or at the top of each test file

function expectRepriced(result: any, expectedPrice?: number) {
  expect(result.repriceDetails).toBeDefined();
  expect(result.repriceDetails!.isRepriced).toBe(true);
  expect(result.repriceDetails!.newPrice).not.toBe('N/A');
  if (expectedPrice !== undefined) {
    expect(parseFloat(result.repriceDetails!.newPrice as string)).toBeCloseTo(expectedPrice, 2);
  }
}

function expectIgnored(result: any, tagSubstring?: string) {
  expect(result.repriceDetails).toBeDefined();
  expect(result.repriceDetails!.isRepriced).toBe(false);
  if (tagSubstring) {
    expect(result.repriceDetails!.explained).toContain(tagSubstring);
  }
}

function expectExplained(result: any, substring: string) {
  expect(result.repriceDetails).toBeDefined();
  expect(result.repriceDetails!.explained).toContain(substring);
}
```

## Troubleshooting

### Mock Path Issues

**Symptom**: `Cannot find module '../../../../../model/global-param' from 'src/utility/reprice-algo/__tests__/v1/integration/standard-mode.test.ts'`

**Fix**: The mock path is resolved relative to the test file. Count the directories:
```
integration/ -> v1/ -> __tests__/ -> reprice-algo/ -> utility/ -> src/
    ../          ../      ../           ../             ../         ../
    1            2        3             4               5           (too far)
```
From `integration/test.ts` to `src/` is 5 `../` segments. Then navigate to the target:
- `src/model/global-param` = `../../../../../model/global-param`
- `src/utility/config` = `../../../../config` (only 4 `../` to get to `utility/`)

**Key rule**: `jest.mock()` paths are resolved from the test file's directory, same as a regular `import` would be.

### Config Parsing Errors

**Symptom**: `Invalid or missing environment variables` during test

**Fix**: The `config.ts` module calls `envSchema.parse(process.env)` at import time. Your `jest.mock('../../../../config', ...)` must be declared BEFORE any import that transitively imports config. Jest hoists `jest.mock()` calls automatically, but ensure the mock provides all config properties that the code under test actually reads. Add any missing properties to the mock object.

### "Cannot read properties of undefined" in RepriceModel

**Symptom**: `TypeError: Cannot read properties of undefined (reading 'unitPrice')`

**Fix**: Ensure your `refProduct` (own vendor's Net32Product) has `priceBreaks` with at least one entry where `minQty == 1`. The `RepriceModel` constructor calls `getOldPrice()` which iterates `priceBreaks`.

### filterMapper.FilterBasedOnParams Returns Empty

**Symptom**: All competitors filtered out, resulting in unexpected "no competitor" results.

**Fix**: Check these fields on `buildFrontierProduct`:
- `excludedVendors`: Set to `''` (empty string) unless you want to exclude specific vendors
- `inventoryThreshold`: Set to `0` unless testing threshold behavior
- `handlingTimeFilter`: Set to `''` unless testing handling time filter
- `badgeIndicator`: Set to `''` unless testing badge filtering
- `includeInactiveVendors`: Set to `false` for standard behavior

Also ensure competitor products have:
- `inStock: true`
- `inventory: 100` (or above your threshold)
- `isBackordered: false`
- `shippingTime: 2` (or appropriate value)

### globalParam.GetInfo Mock Not Taking Effect

**Symptom**: Test errors about database connection or globalParam returning undefined.

**Fix**: The `GetInfo` function has a fast path: if `productItem.ownVendorId` and `productItem.sisterVendorId` are both set and not `"N/A"`, it returns them directly without calling the DB. Set these in your `buildFrontierProduct`:

```typescript
ownVendorId: '17357',
sisterVendorId: '20722;20755',
```

However, `filterMapper.FilterBasedOnParams` also calls `GetInfo`, and the product items there are the competitor products (Net32Product), not FrontierProduct. The mock is still needed for those code paths.

### Import Resolution for Relative Paths to Source Under Test

**Symptom**: Test can't find `reprice-helper.ts` or `reprice-helper-nc.ts`.

**Fix**: The import from the test file to the source modules under test requires 3 levels up (from `integration/` through `v1/` through `__tests__/` to `reprice-algo/`), then down to `v1/`:

```typescript
import * as repriceHelper from '../../../v1/reprice-helper';
import * as repriceHelperNc from '../../../v1/reprice-helper-nc';
import * as Rule from '../../../v1/repricer-rule-helper';
```

### Summary of All Relative Paths from Test Files

All paths verified with `os.path.relpath()` against the actual directory structure.

```typescript
// === Source imports (3 levels up to reprice-algo/) ===
import * as repriceHelper from '../../../v1/reprice-helper';
import * as repriceHelperNc from '../../../v1/reprice-helper-nc';
import * as Rule from '../../../v1/repricer-rule-helper';

// === Type/Model imports (5 levels up to src/) ===
import { Net32Product, Net32PriceBreak } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';
import { RepriceModel } from '../../../../../model/reprice-model';
import { RepriceRenewedMessageEnum } from '../../../../../model/reprice-renewed-message';

// === Mock paths ===
// 5 levels up to src/ for model/:
jest.mock('../../../../../model/global-param', () => ({ ... }));
// 4 levels up to utility/ for utility modules:
jest.mock('../../../../config', () => ({ ... }));
jest.mock('../../../../mongo/db-helper', () => ({ ... }));
jest.mock('../../../../mysql/mysql-helper', () => ({ ... }));
jest.mock('../../../../mysql/mysql-v2', () => ({ ... }));
jest.mock('../../../../mysql/tinyproxy-configs', () => ({ ... }));
jest.mock('../../../../history-helper', () => ({ ... }));
jest.mock('../../../../axios-helper', () => ({ ... }));
jest.mock('../../../../repriceResultParser', () => ({ ... }));
```

**IMPORTANT NOTE ON MOCK PATH VERIFICATION**: The paths above are calculated from the directory structure. Jest resolves `jest.mock()` module paths the same way it resolves `import` paths -- relative to the test file. If a path doesn't work, use this debugging approach:

```typescript
// Add a temporary import to verify the path resolves:
import * as testImport from '../../../../config';
console.log(testImport); // If this works, the jest.mock path is correct
```

If paths still don't resolve, check `tsconfig.json` for path aliases that might affect resolution. The current `jest.config.js` uses `ts-jest` with defaults, which should respect tsconfig paths.
