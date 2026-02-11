    # V1 Filter/Eligibility Unit Tests -- Implementation Guide

This document provides everything needed to implement unit tests for the filter and eligibility functions used in the V1 repricing algorithm. All source code references, type definitions, mock strategies, and complete test files are included. No additional codebase exploration is required.

---

## Table of Contents

1. [Project Setup and Prerequisites](#1-project-setup-and-prerequisites)
2. [Source Files Under Test](#2-source-files-under-test)
3. [Type Definitions Reference](#3-type-definitions-reference)
4. [Mocking Strategy](#4-mocking-strategy)
5. [Test File: EXCLUDED_VENDOR Filter](#5-test-file-excluded_vendor-filter)
6. [Test File: INVENTORY_THRESHOLD Filter](#6-test-file-inventory_threshold-filter)
7. [Test File: HANDLING_TIME Filter](#7-test-file-handling_time-filter)
8. [Test File: BADGE_INDICATOR Filter](#8-test-file-badge_indicator-filter)
9. [Test File: PHANTOM_PRICE_BREAK Filter](#9-test-file-phantom_price_break-filter)
10. [Test File: SISTER_VENDOR_EXCLUSION Filter](#10-test-file-sister_vendor_exclusion-filter)
11. [Test File: GetContextPrice](#11-test-file-getcontextprice)
12. [Test File: subtractPercentage](#12-test-file-subtractpercentage)
13. [Note on isNotShortExpiryProduct](#13-note-on-isnotshortexpiryproduct)
14. [How to Run](#14-how-to-run)

---

## 1. Project Setup and Prerequisites

**Test runner:** Jest with ts-jest (already configured).

**Jest config** (`apps/api-core/jest.config.js`):
```js
const { createDefaultPreset } = require("ts-jest");
const tsJestTransformCfg = createDefaultPreset().transform;
module.exports = {
  testEnvironment: "node",
  transform: { ...tsJestTransformCfg },
};
```

**TypeScript config** (`apps/api-core/tsconfig.json`):
- target: ES2020, module: commonjs, strict: true, esModuleInterop: true

**Test file location:** All test files go under:
```
apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/
```

**Run command from monorepo root:**
```bash
cd apps/api-core && npx jest src/utility/reprice-algo/__tests__/v1/filters/
```

---

## 2. Source Files Under Test

### FilterBasedOnParams
- **File:** `apps/api-core/src/utility/filter-mapper.ts`
- **Signature:** `export async function FilterBasedOnParams(inputResult: Net32Product[], productItem: FrontierProduct, filterType: string)`
- **Returns:** `Promise<Net32Product[]>` (filtered array)
- **Internal dependency:** Calls `GetInfo(productItem.mpid, productItem)` from `../../model/global-param` which returns `{ VENDOR_ID: string, EXCLUDED_VENDOR_ID: string }`. This calls the database when `productItem.ownVendorId` or `productItem.sisterVendorId` is null/`"N/A"`. When both are present and non-`"N/A"`, it returns them directly without any DB call: `{ VENDOR_ID: productItem.ownVendorId, EXCLUDED_VENDOR_ID: productItem.sisterVendorId }`.

### GetContextPrice
- **File:** `apps/api-core/src/utility/filter-mapper.ts`
- **Signature:** `export async function GetContextPrice(nextLowestPrice: any, processOffset: any, floorPrice: any, percentageDown: any, minQty: any, heavyShippingPrice: number = 0): Promise<any>`
- **Returns:** `{ Price: number, Type: "OFFSET" | "PERCENTAGE" | "FLOOR_OFFSET" }` (note: capital `P` in `Price`, capital `T` in `Type`)
- **Internal dependency:** Uses `subtractPercentage` (same file, no external deps). Uses `Decimal` from `decimal.js`.

### subtractPercentage
- **File:** `apps/api-core/src/utility/filter-mapper.ts`
- **Signature:** `export function subtractPercentage(originalNumber: number, percentage: number)`
- **Returns:** `number`
- **Formula:** `parseFloat((Math.floor((originalNumber - originalNumber * percentage) * 100) / 100).toFixed(2))`
- **Pure function, no dependencies.**

### isNotShortExpiryProduct
- **File:** `apps/api-core/src/utility/reprice-algo/v1/reprice-helper.ts` (line 726)
- **NOT exported** -- it is a private `function` (no `export` keyword). Cannot be tested directly. See [section 13](#13-note-on-isnotshortexpiryproduct).

---

## 3. Type Definitions Reference

### Net32Product (`apps/api-core/src/types/net32.ts`)
```typescript
export interface Net32Product {
  vendorProductId: number;
  vendorProductCode: string;
  vendorId: number | string;
  vendorName: string;
  vendorRegion: string;
  inStock: boolean;
  standardShipping: number;
  standardShippingStatus: string;
  freeShippingGap: number;
  heavyShippingStatus: string;
  heavyShipping: number;
  shippingTime: number;
  inventory: number;
  isFulfillmentPolicyStock: boolean;
  vdrGeneralAverageRatingSum: number;
  vdrNumberOfGeneralRatings: number;
  isBackordered: boolean;
  vendorProductLevelLicenseRequiredSw: boolean;
  vendorVerticalLevelLicenseRequiredSw: boolean;
  priceBreaks: Net32PriceBreak[];
  badgeId: number;
  badgeName: string | null;
  imagePath: string;
  arrivalDate: string;
  arrivalBusinessDays: number;
  twoDayDeliverySw: boolean;
  isLowestTotalPrice: string | null;
  freeShippingThreshold?: number;
}
```

### FrontierProduct (`apps/api-core/src/types/frontier.ts`)
```typescript
export interface FrontierProduct {
  channelName: string;
  activated: boolean;
  mpid: number;
  channelId: string;
  unitPrice: string;
  floorPrice: string;
  maxPrice: string;
  is_nc_needed: boolean;
  suppressPriceBreakForOne: boolean;
  repricingRule: number;
  suppressPriceBreak: boolean;
  beatQPrice: boolean;
  percentageIncrease: number;
  compareWithQ1: boolean;
  competeAll: boolean;
  badgeIndicator: string;
  badgePercentage: number;
  productName: string;
  cronId: string;
  cronName: string;
  requestInterval: number;
  requestIntervalUnit: string;
  scrapeOn: boolean;
  allowReprice: boolean;
  focusId: string;
  priority: number;
  wait_update_period: boolean;
  net32url: string;
  abortDeactivatingQPriceBreak: boolean;
  ownVendorId: string | null;
  sisterVendorId: string;
  tags: string[];
  includeInactiveVendors: boolean;
  inactiveVendorId: string;
  override_bulk_update: boolean;
  override_bulk_rule: number;
  latest_price: number;
  executionPriority: number;
  lastCronRun: string;
  lastExistingPrice: string;
  lastSuggestedPrice: string;
  lastUpdatedBy: string;
  last_attempted_time: string;
  last_cron_message: string;
  last_cron_time: string;
  lowest_vendor: string;
  lowest_vendor_price: string;
  next_cron_time: string;
  slowCronId: string;
  slowCronName: string;
  last_update_time: string;
  applyBuyBoxLogic: boolean;
  applyNcForBuyBox: boolean;
  isSlowActivated: boolean;
  lastUpdatedByUser: string;
  lastUpdatedOn: string;
  handlingTimeFilter: string;
  keepPosition: boolean;
  excludedVendors: string;
  inventoryThreshold: number;
  percentageDown: string;
  badgePercentageDown: string;
  competeWithNext: boolean;
  triggeredByVendor: string;
  ignorePhantomQBreak: boolean;
  ownVendorThreshold: number;
  skipReprice: boolean;
  secretKey: any[];
  contextCronName: string;
  contextMinQty?: number;
  algo_execution_mode?: any;
  getBBShipping?: any;
  getBBBadge?: any;
}
```

---

## 4. Mocking Strategy

### Why mocking is needed

`FilterBasedOnParams` calls `GetInfo()` from `../../model/global-param`. When `productItem.ownVendorId` and `productItem.sisterVendorId` are both set to non-`"N/A"` values, `GetInfo` returns immediately without hitting the DB:

```typescript
// from apps/api-core/src/model/global-param.ts
export async function GetInfo(mpId: any, productDet?: any) {
  const productInfo = productDet ? productDet : null;
  if (productInfo && productInfo.ownVendorId && productInfo.sisterVendorId
      && productInfo.ownVendorId != "N/A" && productInfo.sisterVendorId != "N/A") {
    return {
      VENDOR_ID: productInfo.ownVendorId,
      EXCLUDED_VENDOR_ID: productInfo.sisterVendorId,
    };
  }
  // Falls through to DB call...
  const response = await sqlV2Service.GetGlobalConfig();
  return {
    VENDOR_ID: (response as any).ownVendorId,
    EXCLUDED_VENDOR_ID: (response as any).excludedSisterVendors,
  };
}
```

**Strategy:** Always set `productItem.ownVendorId` and `productItem.sisterVendorId` to real string values (not `null` or `"N/A"`) in test data. This avoids the DB call entirely and **no mock of `GetInfo` is needed**.

However, to be safe against any other transitive imports that might trigger DB connections, we still mock the `global-param` module at the top of each test file:

```typescript
jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '100',
    EXCLUDED_VENDOR_ID: '200;201',
  }),
}));
```

The mock path is relative to the test file location at:
`apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/*.test.ts`

The actual module is at:
`apps/api-core/src/model/global-param.ts`

Relative path from test file: `../../../../../model/global-param`

### Builder Helper Functions

> **Note**: Layer 0 (`00-setup.md`) defines reusable builders (`Net32ProductBuilder`, `FrontierProductBuilder`) in `__tests__/infrastructure/builders/`. Once Layer 0 is implemented, you can replace these inline helpers with the builders. The inline versions below are provided so this layer can be implemented independently if needed.

Inline helper factories for use in each test file:

```typescript
function makeNet32Product(overrides: Partial<Net32Product> = {}): Net32Product {
  return {
    vendorProductId: 1,
    vendorProductCode: 'VP001',
    vendorId: 100,
    vendorName: 'Test Vendor',
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 5.99,
    standardShippingStatus: 'ACTIVE',
    freeShippingGap: 10,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 3,
    inventory: 50,
    isFulfillmentPolicyStock: false,
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
    arrivalBusinessDays: 3,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    ...overrides,
  };
}

function makeFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'CH1',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '99.00',
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: 'ALL_ZERO',
    badgePercentage: 0,
    productName: 'Test Product',
    cronId: 'cron1',
    cronName: 'Regular',
    requestInterval: 60,
    requestIntervalUnit: 'MINUTES',
    scrapeOn: true,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: 'https://net32.com/test',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '100',
    sisterVendorId: '200;201',
    tags: [],
    includeInactiveVendors: true,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: 0,
    latest_price: 10.00,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '9.99',
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
    handlingTimeFilter: 'ALL',
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
    contextCronName: '',
    contextMinQty: 1,
    algo_execution_mode: undefined,
    getBBShipping: undefined,
    getBBBadge: undefined,
  };
}
```

---

## 5. Test File: EXCLUDED_VENDOR Filter

**File:** `apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/excluded-vendor.test.ts`

### Source Logic (lines 64-68 of filter-mapper.ts):
```typescript
case "EXCLUDED_VENDOR":
  const excludedVendorList = productItem.excludedVendors != null && productItem.excludedVendors != ""
    ? productItem.excludedVendors.split(";").filter((element) => element.trim() !== "")
    : [];
  outputResult = _.filter(inputResult, (item) => {
    return !_.includes(excludedVendorList, item.vendorId.toString());
  });
  break;
```

Key details:
- Splits `productItem.excludedVendors` by `";"`
- Filters out empty strings after split
- Compares `item.vendorId.toString()` against the exclusion list (string comparison)
- If `excludedVendors` is null or empty string, the exclusion list is empty -> no filtering

### Complete Test Code:

```typescript
import { FilterBasedOnParams } from '../../../../filter-mapper';
import { Net32Product } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';

// Mock GetInfo to avoid any DB calls
jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '100',
    EXCLUDED_VENDOR_ID: '200;201',
  }),
}));

function makeNet32Product(overrides: Partial<Net32Product> = {}): Net32Product {
  return {
    vendorProductId: 1,
    vendorProductCode: 'VP001',
    vendorId: 100,
    vendorName: 'Test Vendor',
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 5.99,
    standardShippingStatus: 'ACTIVE',
    freeShippingGap: 10,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 3,
    inventory: 50,
    isFulfillmentPolicyStock: false,
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
    arrivalBusinessDays: 3,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    ...overrides,
  };
}

function makeFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'CH1',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '99.00',
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: 'ALL_ZERO',
    badgePercentage: 0,
    productName: 'Test Product',
    cronId: 'cron1',
    cronName: 'Regular',
    requestInterval: 60,
    requestIntervalUnit: 'MINUTES',
    scrapeOn: true,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: 'https://net32.com/test',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '100',
    sisterVendorId: '200;201',
    tags: [],
    includeInactiveVendors: true,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: 0,
    latest_price: 10.00,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '9.99',
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
    handlingTimeFilter: 'ALL',
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
    contextCronName: '',
    contextMinQty: 1,
  } as FrontierProduct;
}

describe('FilterBasedOnParams - EXCLUDED_VENDOR', () => {
  const vendorA = makeNet32Product({ vendorId: 10, vendorName: 'Vendor A' });
  const vendorB = makeNet32Product({ vendorId: 20, vendorName: 'Vendor B' });
  const vendorC = makeNet32Product({ vendorId: 30, vendorName: 'Vendor C' });
  const allVendors = [vendorA, vendorB, vendorC];

  it('should remove vendors whose vendorId is in the exclusion list', async () => {
    const product = makeFrontierProduct({ excludedVendors: '10;30' });
    const result = await FilterBasedOnParams(allVendors, product, 'EXCLUDED_VENDOR');
    expect(result).toHaveLength(1);
    expect(result[0].vendorId).toBe(20);
  });

  it('should return all vendors when excludedVendors is empty string', async () => {
    const product = makeFrontierProduct({ excludedVendors: '' });
    const result = await FilterBasedOnParams(allVendors, product, 'EXCLUDED_VENDOR');
    expect(result).toHaveLength(3);
  });

  it('should return all vendors when excludedVendors is null', async () => {
    const product = makeFrontierProduct({ excludedVendors: null as any });
    const result = await FilterBasedOnParams(allVendors, product, 'EXCLUDED_VENDOR');
    expect(result).toHaveLength(3);
  });

  it('should handle single excluded vendor', async () => {
    const product = makeFrontierProduct({ excludedVendors: '20' });
    const result = await FilterBasedOnParams(allVendors, product, 'EXCLUDED_VENDOR');
    expect(result).toHaveLength(2);
    expect(result.map(v => v.vendorId)).toEqual([10, 30]);
  });

  it('should handle excludedVendors with trailing semicolon', async () => {
    const product = makeFrontierProduct({ excludedVendors: '10;' });
    const result = await FilterBasedOnParams(allVendors, product, 'EXCLUDED_VENDOR');
    // The split(";").filter(e => e.trim() !== "") removes empty entries
    expect(result).toHaveLength(2);
    expect(result.map(v => v.vendorId)).toEqual([20, 30]);
  });

  it('should handle excludedVendors with leading semicolon', async () => {
    const product = makeFrontierProduct({ excludedVendors: ';20;' });
    const result = await FilterBasedOnParams(allVendors, product, 'EXCLUDED_VENDOR');
    expect(result).toHaveLength(2);
    expect(result.map(v => v.vendorId)).toEqual([10, 30]);
  });

  it('should handle vendorId that does not match any vendor', async () => {
    const product = makeFrontierProduct({ excludedVendors: '999' });
    const result = await FilterBasedOnParams(allVendors, product, 'EXCLUDED_VENDOR');
    expect(result).toHaveLength(3);
  });

  it('should exclude all vendors if all are in the exclusion list', async () => {
    const product = makeFrontierProduct({ excludedVendors: '10;20;30' });
    const result = await FilterBasedOnParams(allVendors, product, 'EXCLUDED_VENDOR');
    expect(result).toHaveLength(0);
  });

  it('should return empty array when input is empty', async () => {
    const product = makeFrontierProduct({ excludedVendors: '10' });
    const result = await FilterBasedOnParams([], product, 'EXCLUDED_VENDOR');
    expect(result).toHaveLength(0);
  });

  it('should compare vendorId as string (vendorId is number, exclusion list is string)', async () => {
    // vendorId is numeric 10, excludedVendors is "10" -- should still match via .toString()
    const product = makeFrontierProduct({ excludedVendors: '10' });
    const numericVendor = makeNet32Product({ vendorId: 10 });
    const result = await FilterBasedOnParams([numericVendor], product, 'EXCLUDED_VENDOR');
    expect(result).toHaveLength(0);
  });

  it('should handle vendorId as string type on the Net32Product', async () => {
    const stringVendor = makeNet32Product({ vendorId: '10' as any });
    const product = makeFrontierProduct({ excludedVendors: '10' });
    const result = await FilterBasedOnParams([stringVendor], product, 'EXCLUDED_VENDOR');
    expect(result).toHaveLength(0);
  });
});
```

---

## 6. Test File: INVENTORY_THRESHOLD Filter

**File:** `apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/inventory-threshold.test.ts`

### Source Logic (lines 70-79 of filter-mapper.ts):
```typescript
case "INVENTORY_THRESHOLD":
  if (productItem.includeInactiveVendors) {
    outputResult = _.filter(inputResult, (item) => {
      return parseInt(item.inventory as unknown as string) >= parseInt(productItem.inventoryThreshold as unknown as string);
    });
  } else {
    outputResult = inputResult.filter((item) => {
      return item.inStock && parseInt(item.inventory as unknown as string) >= parseInt(productItem.inventoryThreshold as unknown as string);
    });
  }
  break;
```

Key details:
- Uses `parseInt()` on both `item.inventory` and `productItem.inventoryThreshold` (cast through `unknown` to `string`)
- When `includeInactiveVendors` is true: filters by inventory only
- When `includeInactiveVendors` is false: filters by BOTH `inStock === true` AND inventory >= threshold
- threshold=0 means all items with inventory >= 0 pass (effectively no filtering for positive inventory)

### Complete Test Code:

```typescript
import { FilterBasedOnParams } from '../../../../filter-mapper';
import { Net32Product } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';

jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '100',
    EXCLUDED_VENDOR_ID: '200;201',
  }),
}));

function makeNet32Product(overrides: Partial<Net32Product> = {}): Net32Product {
  return {
    vendorProductId: 1,
    vendorProductCode: 'VP001',
    vendorId: 100,
    vendorName: 'Test Vendor',
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 5.99,
    standardShippingStatus: 'ACTIVE',
    freeShippingGap: 10,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 3,
    inventory: 50,
    isFulfillmentPolicyStock: false,
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
    arrivalBusinessDays: 3,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    ...overrides,
  };
}

function makeFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'CH1',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '99.00',
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: 'ALL_ZERO',
    badgePercentage: 0,
    productName: 'Test Product',
    cronId: 'cron1',
    cronName: 'Regular',
    requestInterval: 60,
    requestIntervalUnit: 'MINUTES',
    scrapeOn: true,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: 'https://net32.com/test',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '100',
    sisterVendorId: '200;201',
    tags: [],
    includeInactiveVendors: true,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: 0,
    latest_price: 10.00,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '9.99',
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
    handlingTimeFilter: 'ALL',
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
    contextCronName: '',
    contextMinQty: 1,
  } as FrontierProduct;
}

describe('FilterBasedOnParams - INVENTORY_THRESHOLD', () => {
  const highInventory = makeNet32Product({ vendorId: 1, inventory: 100, inStock: true });
  const medInventory = makeNet32Product({ vendorId: 2, inventory: 10, inStock: true });
  const lowInventory = makeNet32Product({ vendorId: 3, inventory: 2, inStock: true });
  const zeroInventory = makeNet32Product({ vendorId: 4, inventory: 0, inStock: false });
  const allVendors = [highInventory, medInventory, lowInventory, zeroInventory];

  describe('when includeInactiveVendors is true', () => {
    it('should filter by inventory >= threshold only (ignoring inStock)', async () => {
      const product = makeFrontierProduct({
        inventoryThreshold: 10,
        includeInactiveVendors: true,
      });
      const result = await FilterBasedOnParams(allVendors, product, 'INVENTORY_THRESHOLD');
      expect(result).toHaveLength(2);
      expect(result.map(v => v.vendorId)).toEqual([1, 2]);
    });

    it('should include out-of-stock vendors if inventory meets threshold', async () => {
      const outOfStockHighInv = makeNet32Product({ vendorId: 5, inventory: 50, inStock: false });
      const product = makeFrontierProduct({
        inventoryThreshold: 10,
        includeInactiveVendors: true,
      });
      const result = await FilterBasedOnParams([outOfStockHighInv], product, 'INVENTORY_THRESHOLD');
      expect(result).toHaveLength(1);
    });

    it('should return all when threshold is 0', async () => {
      const product = makeFrontierProduct({
        inventoryThreshold: 0,
        includeInactiveVendors: true,
      });
      const result = await FilterBasedOnParams(allVendors, product, 'INVENTORY_THRESHOLD');
      expect(result).toHaveLength(4);
    });
  });

  describe('when includeInactiveVendors is false', () => {
    it('should filter by inStock AND inventory >= threshold', async () => {
      const product = makeFrontierProduct({
        inventoryThreshold: 5,
        includeInactiveVendors: false,
      });
      const result = await FilterBasedOnParams(allVendors, product, 'INVENTORY_THRESHOLD');
      // highInventory (100, inStock), medInventory (10, inStock), lowInventory (2, inStock but < 5)
      // zeroInventory (0, not inStock)
      expect(result).toHaveLength(2);
      expect(result.map(v => v.vendorId)).toEqual([1, 2]);
    });

    it('should exclude out-of-stock vendors even with sufficient inventory', async () => {
      const outOfStockHighInv = makeNet32Product({ vendorId: 5, inventory: 50, inStock: false });
      const product = makeFrontierProduct({
        inventoryThreshold: 5,
        includeInactiveVendors: false,
      });
      const result = await FilterBasedOnParams([outOfStockHighInv], product, 'INVENTORY_THRESHOLD');
      expect(result).toHaveLength(0);
    });

    it('should return all in-stock vendors when threshold is 0', async () => {
      const product = makeFrontierProduct({
        inventoryThreshold: 0,
        includeInactiveVendors: false,
      });
      const result = await FilterBasedOnParams(allVendors, product, 'INVENTORY_THRESHOLD');
      // Only the 3 in-stock vendors pass (zeroInventory has inStock=false)
      expect(result).toHaveLength(3);
    });
  });

  it('should return empty array when input is empty', async () => {
    const product = makeFrontierProduct({ inventoryThreshold: 0 });
    const result = await FilterBasedOnParams([], product, 'INVENTORY_THRESHOLD');
    expect(result).toHaveLength(0);
  });

  it('should handle exact threshold boundary (inventory equals threshold)', async () => {
    const exactVendor = makeNet32Product({ vendorId: 1, inventory: 10, inStock: true });
    const product = makeFrontierProduct({
      inventoryThreshold: 10,
      includeInactiveVendors: true,
    });
    const result = await FilterBasedOnParams([exactVendor], product, 'INVENTORY_THRESHOLD');
    expect(result).toHaveLength(1);
  });

  it('should handle inventory just below threshold', async () => {
    const belowVendor = makeNet32Product({ vendorId: 1, inventory: 9, inStock: true });
    const product = makeFrontierProduct({
      inventoryThreshold: 10,
      includeInactiveVendors: true,
    });
    const result = await FilterBasedOnParams([belowVendor], product, 'INVENTORY_THRESHOLD');
    expect(result).toHaveLength(0);
  });
});
```

---

## 7. Test File: HANDLING_TIME Filter

**File:** `apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/handling-time.test.ts`

### Source Logic (lines 81-113 of filter-mapper.ts):
```typescript
case "HANDLING_TIME":
  switch (productItem.handlingTimeFilter) {
    case "FAST_SHIPPING":
      outputResult = inputResult.filter((item) => {
        return item.shippingTime && item.shippingTime <= 2;
      });
      break;
    case "STOCKED":
      outputResult = inputResult.filter((item) => {
        return item.shippingTime && item.shippingTime <= 5;
      });
      break;
    case "LONG_HANDLING":
      outputResult = inputResult.filter((item) => {
        return item.shippingTime && item.shippingTime >= 6;
      });
      break;
    default:
      outputResult = inputResult;
      break;
  }
  // ALWAYS re-adds own vendor if not already in outputResult
  if (!outputResult.find(($bi) => { return $bi.vendorId == $.VENDOR_ID; })) {
    const itemToAdd = inputResult.find(($bi) => { return $bi.vendorId == $.VENDOR_ID; });
    if (itemToAdd) {
      outputResult.push(itemToAdd);
    }
  }
  break;
```

Key details:
- `$.VENDOR_ID` comes from `GetInfo()`. With our mock strategy: `productItem.ownVendorId`.
- Uses `==` comparison (loose equality) for vendorId, so numeric vendorId `100` matches string VENDOR_ID `"100"`.
- `shippingTime && shippingTime <= X` means 0 is falsy and will be filtered OUT.
- Own vendor is always re-added if filtered out (from the original `inputResult`, not the filtered set).
- The `default` case (including `"ALL"`) returns `inputResult` unfiltered. Own vendor re-add still runs but is a no-op since they are already included.

### Complete Test Code:

```typescript
import { FilterBasedOnParams } from '../../../../filter-mapper';
import { Net32Product } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';

jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockImplementation(async (_mpId: any, productDet: any) => {
    return {
      VENDOR_ID: productDet?.ownVendorId || '100',
      EXCLUDED_VENDOR_ID: productDet?.sisterVendorId || '200;201',
    };
  }),
}));

function makeNet32Product(overrides: Partial<Net32Product> = {}): Net32Product {
  return {
    vendorProductId: 1,
    vendorProductCode: 'VP001',
    vendorId: 100,
    vendorName: 'Test Vendor',
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 5.99,
    standardShippingStatus: 'ACTIVE',
    freeShippingGap: 10,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 3,
    inventory: 50,
    isFulfillmentPolicyStock: false,
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
    arrivalBusinessDays: 3,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    ...overrides,
  };
}

function makeFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'CH1',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '99.00',
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: 'ALL_ZERO',
    badgePercentage: 0,
    productName: 'Test Product',
    cronId: 'cron1',
    cronName: 'Regular',
    requestInterval: 60,
    requestIntervalUnit: 'MINUTES',
    scrapeOn: true,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: 'https://net32.com/test',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '100',
    sisterVendorId: '200;201',
    tags: [],
    includeInactiveVendors: true,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: 0,
    latest_price: 10.00,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '9.99',
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
    handlingTimeFilter: 'ALL',
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
    contextCronName: '',
    contextMinQty: 1,
  } as FrontierProduct;
}

describe('FilterBasedOnParams - HANDLING_TIME', () => {
  // Own vendor (vendorId 100) with shippingTime 10 (long handling)
  const ownVendor = makeNet32Product({ vendorId: 100, vendorName: 'Own', shippingTime: 10 });
  const fastVendor = makeNet32Product({ vendorId: 1, vendorName: 'Fast', shippingTime: 1 });
  const medVendor = makeNet32Product({ vendorId: 2, vendorName: 'Medium', shippingTime: 4 });
  const slowVendor = makeNet32Product({ vendorId: 3, vendorName: 'Slow', shippingTime: 7 });
  const allVendors = [ownVendor, fastVendor, medVendor, slowVendor];

  describe('FAST_SHIPPING (shippingTime <= 2)', () => {
    it('should keep only vendors with shippingTime <= 2', async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: 'FAST_SHIPPING', ownVendorId: '100' });
      const result = await FilterBasedOnParams(allVendors, product, 'HANDLING_TIME');
      const vendorIds = result.map(v => v.vendorId);
      // fastVendor (1) passes the filter
      expect(vendorIds).toContain(1);
      // medVendor (4) and slowVendor (7) do NOT pass
      expect(vendorIds).not.toContain(2);
      expect(vendorIds).not.toContain(3);
    });

    it('should always include own vendor even if shippingTime > 2', async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: 'FAST_SHIPPING', ownVendorId: '100' });
      const result = await FilterBasedOnParams(allVendors, product, 'HANDLING_TIME');
      expect(result.map(v => v.vendorId)).toContain(100);
    });

    it('should not duplicate own vendor if already in filtered set', async () => {
      const ownFast = makeNet32Product({ vendorId: 100, shippingTime: 1 });
      const product = makeFrontierProduct({ handlingTimeFilter: 'FAST_SHIPPING', ownVendorId: '100' });
      const result = await FilterBasedOnParams([ownFast, fastVendor], product, 'HANDLING_TIME');
      const ownCount = result.filter(v => v.vendorId == 100).length;
      expect(ownCount).toBe(1);
    });

    it('should filter out vendors with shippingTime = 0 (falsy)', async () => {
      const zeroShipping = makeNet32Product({ vendorId: 5, shippingTime: 0 });
      const product = makeFrontierProduct({ handlingTimeFilter: 'FAST_SHIPPING', ownVendorId: '100' });
      const result = await FilterBasedOnParams([zeroShipping, ownVendor], product, 'HANDLING_TIME');
      // shippingTime 0 is falsy, so it fails `item.shippingTime && ...`
      expect(result.map(v => v.vendorId)).not.toContain(5);
    });

    it('should include vendor with shippingTime exactly 2', async () => {
      const boundary = makeNet32Product({ vendorId: 6, shippingTime: 2 });
      const product = makeFrontierProduct({ handlingTimeFilter: 'FAST_SHIPPING', ownVendorId: '100' });
      const result = await FilterBasedOnParams([boundary], product, 'HANDLING_TIME');
      expect(result.map(v => v.vendorId)).toContain(6);
    });
  });

  describe('STOCKED (shippingTime <= 5)', () => {
    it('should keep vendors with shippingTime <= 5', async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: 'STOCKED', ownVendorId: '100' });
      const result = await FilterBasedOnParams(allVendors, product, 'HANDLING_TIME');
      const vendorIds = result.map(v => v.vendorId);
      expect(vendorIds).toContain(1);  // shippingTime 1
      expect(vendorIds).toContain(2);  // shippingTime 4
      expect(vendorIds).not.toContain(3);  // shippingTime 7 (excluded)
    });

    it('should always include own vendor even if shippingTime > 5', async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: 'STOCKED', ownVendorId: '100' });
      const result = await FilterBasedOnParams(allVendors, product, 'HANDLING_TIME');
      expect(result.map(v => v.vendorId)).toContain(100);
    });

    it('should include vendor with shippingTime exactly 5', async () => {
      const boundary = makeNet32Product({ vendorId: 7, shippingTime: 5 });
      const product = makeFrontierProduct({ handlingTimeFilter: 'STOCKED', ownVendorId: '100' });
      const result = await FilterBasedOnParams([boundary], product, 'HANDLING_TIME');
      expect(result.map(v => v.vendorId)).toContain(7);
    });
  });

  describe('LONG_HANDLING (shippingTime >= 6)', () => {
    it('should keep only vendors with shippingTime >= 6', async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: 'LONG_HANDLING', ownVendorId: '100' });
      const result = await FilterBasedOnParams(allVendors, product, 'HANDLING_TIME');
      const vendorIds = result.map(v => v.vendorId);
      // ownVendor (10) and slowVendor (7) pass the >= 6 filter
      expect(vendorIds).toContain(100); // shippingTime 10
      expect(vendorIds).toContain(3);   // shippingTime 7
      expect(vendorIds).not.toContain(1);  // shippingTime 1
      expect(vendorIds).not.toContain(2);  // shippingTime 4
    });

    it('should include vendor with shippingTime exactly 6', async () => {
      const boundary = makeNet32Product({ vendorId: 8, shippingTime: 6 });
      const product = makeFrontierProduct({ handlingTimeFilter: 'LONG_HANDLING', ownVendorId: '100' });
      const result = await FilterBasedOnParams([boundary], product, 'HANDLING_TIME');
      expect(result.map(v => v.vendorId)).toContain(8);
    });

    it('should exclude vendor with shippingTime 5', async () => {
      const boundary = makeNet32Product({ vendorId: 9, shippingTime: 5 });
      const product = makeFrontierProduct({ handlingTimeFilter: 'LONG_HANDLING', ownVendorId: '100' });
      const result = await FilterBasedOnParams([boundary, ownVendor], product, 'HANDLING_TIME');
      expect(result.map(v => v.vendorId)).not.toContain(9);
    });
  });

  describe('ALL / default (no handling time filtering)', () => {
    it('should return all vendors for handlingTimeFilter = ALL', async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: 'ALL', ownVendorId: '100' });
      const result = await FilterBasedOnParams(allVendors, product, 'HANDLING_TIME');
      expect(result).toHaveLength(4);
    });

    it('should return all vendors for unknown handlingTimeFilter value', async () => {
      const product = makeFrontierProduct({ handlingTimeFilter: 'UNKNOWN_VALUE', ownVendorId: '100' });
      const result = await FilterBasedOnParams(allVendors, product, 'HANDLING_TIME');
      expect(result).toHaveLength(4);
    });
  });

  it('should return empty plus own vendor re-add attempt on empty input', async () => {
    const product = makeFrontierProduct({ handlingTimeFilter: 'FAST_SHIPPING', ownVendorId: '100' });
    const result = await FilterBasedOnParams([], product, 'HANDLING_TIME');
    // No vendors in input, own vendor not found in inputResult either
    expect(result).toHaveLength(0);
  });
});
```

---

## 8. Test File: BADGE_INDICATOR Filter

**File:** `apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/badge-indicator.test.ts`

### Source Logic (lines 115-164 of filter-mapper.ts):
```typescript
case "BADGE_INDICATOR":
  if (_.isEqual(productItem.badgeIndicator, "BADGE_ONLY")) {
    let badgedItems = [];
    if (productItem.includeInactiveVendors) {
      badgedItems = _.filter(inputResult, (item) => {
        return item.badgeId && item.badgeId > 0 && item.badgeName;
      });
    } else {
      badgedItems = _.filter(inputResult, (item) => {
        return item.badgeId && item.badgeId > 0 && item.badgeName && item.inStock;
      });
    }
    // Re-add own vendor if not in badgedItems
    if (!badgedItems.find(($bi) => { return ($bi as any).vendorId == $.VENDOR_ID; })) {
      let itemToAdd = inputResult.find(($bi) => { return $bi.vendorId == $.VENDOR_ID; });
      if (itemToAdd) { badgedItems.push(itemToAdd); }
    }
    outputResult = badgedItems as any;
  } else if (_.isEqual(productItem.badgeIndicator, "NON_BADGE_ONLY")) {
    let nonBadgedItems = [];
    if (productItem.includeInactiveVendors) {
      nonBadgedItems = _.filter(inputResult, (item) => {
        return !item.badgeId || item.badgeId == 0;
      });
    } else {
      nonBadgedItems = _.filter(inputResult, (item) => {
        return (!item.badgeId || item.badgeId == 0) && item.inStock;
      });
    }
    // Re-add own vendor if not in nonBadgedItems
    if (!nonBadgedItems.find(($bi) => { return $bi.vendorId == $.VENDOR_ID; })) {
      let itemToAdd = inputResult.find(($bi) => { return $bi.vendorId == $.VENDOR_ID; });
      if (itemToAdd) { nonBadgedItems.push(itemToAdd); }
    }
    outputResult = nonBadgedItems;
  } else outputResult = inputResult;
  break;
```

Key details:
- `BADGE_ONLY`: keeps items with `badgeId > 0 AND badgeName` truthy. Optionally also checks `inStock` when `includeInactiveVendors=false`.
- `NON_BADGE_ONLY`: keeps items with `!badgeId || badgeId == 0`. Optionally also checks `inStock` when `includeInactiveVendors=false`.
- Both always re-add own vendor if filtered out.
- `ALL_ZERO`, `ALL_PERCENTAGE`, or any other value: returns input unfiltered.

### Complete Test Code:

```typescript
import { FilterBasedOnParams } from '../../../../filter-mapper';
import { Net32Product } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';

jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockImplementation(async (_mpId: any, productDet: any) => {
    return {
      VENDOR_ID: productDet?.ownVendorId || '100',
      EXCLUDED_VENDOR_ID: productDet?.sisterVendorId || '200;201',
    };
  }),
}));

function makeNet32Product(overrides: Partial<Net32Product> = {}): Net32Product {
  return {
    vendorProductId: 1,
    vendorProductCode: 'VP001',
    vendorId: 100,
    vendorName: 'Test Vendor',
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 5.99,
    standardShippingStatus: 'ACTIVE',
    freeShippingGap: 10,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 3,
    inventory: 50,
    isFulfillmentPolicyStock: false,
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
    arrivalBusinessDays: 3,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    ...overrides,
  };
}

function makeFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'CH1',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '99.00',
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: 'ALL_ZERO',
    badgePercentage: 0,
    productName: 'Test Product',
    cronId: 'cron1',
    cronName: 'Regular',
    requestInterval: 60,
    requestIntervalUnit: 'MINUTES',
    scrapeOn: true,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: 'https://net32.com/test',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '100',
    sisterVendorId: '200;201',
    tags: [],
    includeInactiveVendors: true,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: 0,
    latest_price: 10.00,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '9.99',
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
    handlingTimeFilter: 'ALL',
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
    contextCronName: '',
    contextMinQty: 1,
  } as FrontierProduct;
}

describe('FilterBasedOnParams - BADGE_INDICATOR', () => {
  // Own vendor has no badge
  const ownVendor = makeNet32Product({ vendorId: 100, badgeId: 0, badgeName: null, inStock: true });
  const badgedVendor = makeNet32Product({ vendorId: 1, badgeId: 5, badgeName: 'Gold', inStock: true });
  const nonBadgedVendor = makeNet32Product({ vendorId: 2, badgeId: 0, badgeName: null, inStock: true });
  const badgedOutOfStock = makeNet32Product({ vendorId: 3, badgeId: 3, badgeName: 'Silver', inStock: false });
  const nonBadgedOutOfStock = makeNet32Product({ vendorId: 4, badgeId: 0, badgeName: null, inStock: false });
  const allVendors = [ownVendor, badgedVendor, nonBadgedVendor, badgedOutOfStock, nonBadgedOutOfStock];

  describe('BADGE_ONLY', () => {
    describe('with includeInactiveVendors = true', () => {
      it('should keep only badged vendors (badgeId > 0 AND badgeName truthy)', async () => {
        const product = makeFrontierProduct({
          badgeIndicator: 'BADGE_ONLY',
          includeInactiveVendors: true,
          ownVendorId: '100',
        });
        const result = await FilterBasedOnParams(allVendors, product, 'BADGE_INDICATOR');
        const vendorIds = result.map(v => v.vendorId);
        expect(vendorIds).toContain(1);   // badged, in stock
        expect(vendorIds).toContain(3);   // badged, out of stock (includeInactive=true)
        expect(vendorIds).not.toContain(2); // non-badged
        expect(vendorIds).not.toContain(4); // non-badged
      });

      it('should re-add own vendor even if not badged', async () => {
        const product = makeFrontierProduct({
          badgeIndicator: 'BADGE_ONLY',
          includeInactiveVendors: true,
          ownVendorId: '100',
        });
        const result = await FilterBasedOnParams(allVendors, product, 'BADGE_INDICATOR');
        expect(result.map(v => v.vendorId)).toContain(100);
      });

      it('should not duplicate own vendor if already badged', async () => {
        const ownBadged = makeNet32Product({ vendorId: 100, badgeId: 2, badgeName: 'Premium', inStock: true });
        const product = makeFrontierProduct({
          badgeIndicator: 'BADGE_ONLY',
          includeInactiveVendors: true,
          ownVendorId: '100',
        });
        const result = await FilterBasedOnParams([ownBadged, badgedVendor], product, 'BADGE_INDICATOR');
        const ownCount = result.filter(v => v.vendorId == 100).length;
        expect(ownCount).toBe(1);
      });
    });

    describe('with includeInactiveVendors = false', () => {
      it('should keep only badged AND in-stock vendors', async () => {
        const product = makeFrontierProduct({
          badgeIndicator: 'BADGE_ONLY',
          includeInactiveVendors: false,
          ownVendorId: '100',
        });
        const result = await FilterBasedOnParams(allVendors, product, 'BADGE_INDICATOR');
        const vendorIds = result.map(v => v.vendorId);
        expect(vendorIds).toContain(1);   // badged + in stock
        expect(vendorIds).not.toContain(3); // badged but out of stock
      });

      it('should still re-add own vendor even if not badged', async () => {
        const product = makeFrontierProduct({
          badgeIndicator: 'BADGE_ONLY',
          includeInactiveVendors: false,
          ownVendorId: '100',
        });
        const result = await FilterBasedOnParams(allVendors, product, 'BADGE_INDICATOR');
        expect(result.map(v => v.vendorId)).toContain(100);
      });
    });

    it('should filter out vendor with badgeId > 0 but badgeName is null', async () => {
      const badgeIdNoBadgeName = makeNet32Product({ vendorId: 5, badgeId: 3, badgeName: null, inStock: true });
      const product = makeFrontierProduct({
        badgeIndicator: 'BADGE_ONLY',
        includeInactiveVendors: true,
        ownVendorId: '100',
      });
      const result = await FilterBasedOnParams([badgeIdNoBadgeName, ownVendor], product, 'BADGE_INDICATOR');
      expect(result.map(v => v.vendorId)).not.toContain(5);
    });

    it('should filter out vendor with badgeId = 0 and badgeName set', async () => {
      const zeroBadgeIdWithName = makeNet32Product({ vendorId: 6, badgeId: 0, badgeName: 'Legacy', inStock: true });
      const product = makeFrontierProduct({
        badgeIndicator: 'BADGE_ONLY',
        includeInactiveVendors: true,
        ownVendorId: '100',
      });
      const result = await FilterBasedOnParams([zeroBadgeIdWithName, ownVendor], product, 'BADGE_INDICATOR');
      expect(result.map(v => v.vendorId)).not.toContain(6);
    });
  });

  describe('NON_BADGE_ONLY', () => {
    describe('with includeInactiveVendors = true', () => {
      it('should keep only non-badged vendors (badgeId falsy or == 0)', async () => {
        const product = makeFrontierProduct({
          badgeIndicator: 'NON_BADGE_ONLY',
          includeInactiveVendors: true,
          ownVendorId: '100',
        });
        const result = await FilterBasedOnParams(allVendors, product, 'BADGE_INDICATOR');
        const vendorIds = result.map(v => v.vendorId);
        expect(vendorIds).toContain(100); // own, non-badged
        expect(vendorIds).toContain(2);   // non-badged, in stock
        expect(vendorIds).toContain(4);   // non-badged, out of stock (includeInactive=true)
        expect(vendorIds).not.toContain(1); // badged
        expect(vendorIds).not.toContain(3); // badged
      });
    });

    describe('with includeInactiveVendors = false', () => {
      it('should keep only non-badged AND in-stock vendors', async () => {
        const product = makeFrontierProduct({
          badgeIndicator: 'NON_BADGE_ONLY',
          includeInactiveVendors: false,
          ownVendorId: '100',
        });
        const result = await FilterBasedOnParams(allVendors, product, 'BADGE_INDICATOR');
        const vendorIds = result.map(v => v.vendorId);
        expect(vendorIds).toContain(100); // own, non-badged, in stock
        expect(vendorIds).toContain(2);   // non-badged, in stock
        expect(vendorIds).not.toContain(4); // non-badged but out of stock
      });
    });

    it('should re-add own vendor even if own vendor is badged', async () => {
      const ownBadged = makeNet32Product({ vendorId: 100, badgeId: 5, badgeName: 'Gold', inStock: true });
      const product = makeFrontierProduct({
        badgeIndicator: 'NON_BADGE_ONLY',
        includeInactiveVendors: true,
        ownVendorId: '100',
      });
      const result = await FilterBasedOnParams([ownBadged, nonBadgedVendor], product, 'BADGE_INDICATOR');
      expect(result.map(v => v.vendorId)).toContain(100);
    });
  });

  describe('ALL_ZERO / ALL_PERCENTAGE / other values (no filtering)', () => {
    it('should return all vendors for ALL_ZERO', async () => {
      const product = makeFrontierProduct({ badgeIndicator: 'ALL_ZERO', ownVendorId: '100' });
      const result = await FilterBasedOnParams(allVendors, product, 'BADGE_INDICATOR');
      expect(result).toHaveLength(allVendors.length);
    });

    it('should return all vendors for ALL_PERCENTAGE', async () => {
      const product = makeFrontierProduct({ badgeIndicator: 'ALL_PERCENTAGE', ownVendorId: '100' });
      const result = await FilterBasedOnParams(allVendors, product, 'BADGE_INDICATOR');
      expect(result).toHaveLength(allVendors.length);
    });

    it('should return all vendors for unknown badge indicator', async () => {
      const product = makeFrontierProduct({ badgeIndicator: 'SOMETHING_ELSE', ownVendorId: '100' });
      const result = await FilterBasedOnParams(allVendors, product, 'BADGE_INDICATOR');
      expect(result).toHaveLength(allVendors.length);
    });
  });

  it('should return empty array when input is empty', async () => {
    const product = makeFrontierProduct({ badgeIndicator: 'BADGE_ONLY', ownVendorId: '100' });
    const result = await FilterBasedOnParams([], product, 'BADGE_INDICATOR');
    expect(result).toHaveLength(0);
  });
});
```

---

## 9. Test File: PHANTOM_PRICE_BREAK Filter

**File:** `apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/phantom-price-break.test.ts`

### Source Logic (lines 166-171 of filter-mapper.ts):
```typescript
case "PHANTOM_PRICE_BREAK":
  if (parseInt(productItem.contextMinQty as unknown as string) != 1) {
    outputResult = inputResult.filter((item) => {
      return item.inStock && item.inventory && item.inventory >= parseInt(productItem.contextMinQty as unknown as string);
    });
  } else outputResult = inputResult;
  break;
```

Key details:
- The minQty comes from `productItem.contextMinQty` (NOT a 4th parameter).
- When `contextMinQty == 1`: no filtering at all, returns input as-is.
- When `contextMinQty != 1`: keeps only vendors with `inStock === true` AND `inventory` truthy AND `inventory >= contextMinQty`.
- Uses `parseInt()` for the comparison, so string values will be parsed.
- `item.inventory` being 0 is falsy and will be filtered out.

### Complete Test Code:

```typescript
import { FilterBasedOnParams } from '../../../../filter-mapper';
import { Net32Product } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';

jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockResolvedValue({
    VENDOR_ID: '100',
    EXCLUDED_VENDOR_ID: '200;201',
  }),
}));

function makeNet32Product(overrides: Partial<Net32Product> = {}): Net32Product {
  return {
    vendorProductId: 1,
    vendorProductCode: 'VP001',
    vendorId: 100,
    vendorName: 'Test Vendor',
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 5.99,
    standardShippingStatus: 'ACTIVE',
    freeShippingGap: 10,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 3,
    inventory: 50,
    isFulfillmentPolicyStock: false,
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
    arrivalBusinessDays: 3,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    ...overrides,
  };
}

function makeFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'CH1',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '99.00',
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: 'ALL_ZERO',
    badgePercentage: 0,
    productName: 'Test Product',
    cronId: 'cron1',
    cronName: 'Regular',
    requestInterval: 60,
    requestIntervalUnit: 'MINUTES',
    scrapeOn: true,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: 'https://net32.com/test',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '100',
    sisterVendorId: '200;201',
    tags: [],
    includeInactiveVendors: true,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: 0,
    latest_price: 10.00,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '9.99',
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
    handlingTimeFilter: 'ALL',
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
    contextCronName: '',
    contextMinQty: 1,
  } as FrontierProduct;
}

describe('FilterBasedOnParams - PHANTOM_PRICE_BREAK', () => {
  const highInvVendor = makeNet32Product({ vendorId: 1, inventory: 100, inStock: true });
  const medInvVendor = makeNet32Product({ vendorId: 2, inventory: 5, inStock: true });
  const lowInvVendor = makeNet32Product({ vendorId: 3, inventory: 1, inStock: true });
  const outOfStockVendor = makeNet32Product({ vendorId: 4, inventory: 50, inStock: false });
  const zeroInvVendor = makeNet32Product({ vendorId: 5, inventory: 0, inStock: true });
  const allVendors = [highInvVendor, medInvVendor, lowInvVendor, outOfStockVendor, zeroInvVendor];

  describe('when contextMinQty == 1 (no filtering)', () => {
    it('should return all vendors unfiltered', async () => {
      const product = makeFrontierProduct({ contextMinQty: 1 });
      const result = await FilterBasedOnParams(allVendors, product, 'PHANTOM_PRICE_BREAK');
      expect(result).toHaveLength(5);
    });

    it('should return empty array when input is empty', async () => {
      const product = makeFrontierProduct({ contextMinQty: 1 });
      const result = await FilterBasedOnParams([], product, 'PHANTOM_PRICE_BREAK');
      expect(result).toHaveLength(0);
    });
  });

  describe('when contextMinQty != 1', () => {
    it('should keep only in-stock vendors with inventory >= contextMinQty', async () => {
      const product = makeFrontierProduct({ contextMinQty: 5 });
      const result = await FilterBasedOnParams(allVendors, product, 'PHANTOM_PRICE_BREAK');
      // highInvVendor (100, inStock) and medInvVendor (5, inStock) pass
      // lowInvVendor (1 < 5), outOfStockVendor (not inStock), zeroInvVendor (0 is falsy) fail
      expect(result).toHaveLength(2);
      expect(result.map(v => v.vendorId)).toEqual([1, 2]);
    });

    it('should filter out vendors not in stock even with sufficient inventory', async () => {
      const product = makeFrontierProduct({ contextMinQty: 2 });
      const result = await FilterBasedOnParams([outOfStockVendor], product, 'PHANTOM_PRICE_BREAK');
      expect(result).toHaveLength(0);
    });

    it('should filter out vendors with zero inventory (falsy)', async () => {
      const product = makeFrontierProduct({ contextMinQty: 0 as any });
      // contextMinQty = 0: parseInt("0") != 1 is true, so filtering IS applied
      // But inventory=0 is falsy, so item.inventory fails the truthy check
      const result = await FilterBasedOnParams([zeroInvVendor], product, 'PHANTOM_PRICE_BREAK');
      expect(result).toHaveLength(0);
    });

    it('should handle contextMinQty = 2 at exact boundary', async () => {
      const exactVendor = makeNet32Product({ vendorId: 6, inventory: 2, inStock: true });
      const product = makeFrontierProduct({ contextMinQty: 2 });
      const result = await FilterBasedOnParams([exactVendor], product, 'PHANTOM_PRICE_BREAK');
      expect(result).toHaveLength(1);
    });

    it('should handle contextMinQty = 2 just below boundary', async () => {
      const belowVendor = makeNet32Product({ vendorId: 7, inventory: 1, inStock: true });
      const product = makeFrontierProduct({ contextMinQty: 2 });
      const result = await FilterBasedOnParams([belowVendor], product, 'PHANTOM_PRICE_BREAK');
      expect(result).toHaveLength(0);
    });

    it('should handle large contextMinQty filtering out everything', async () => {
      const product = makeFrontierProduct({ contextMinQty: 9999 });
      const result = await FilterBasedOnParams(allVendors, product, 'PHANTOM_PRICE_BREAK');
      expect(result).toHaveLength(0);
    });
  });

  it('should handle contextMinQty undefined (parseInt(undefined) is NaN)', async () => {
    const product = makeFrontierProduct({ contextMinQty: undefined });
    // parseInt(undefined as unknown as string) => NaN, NaN != 1 is true
    // So filtering IS applied. item.inventory >= NaN is always false.
    const result = await FilterBasedOnParams(allVendors, product, 'PHANTOM_PRICE_BREAK');
    expect(result).toHaveLength(0);
  });
});
```

---

## 10. Test File: SISTER_VENDOR_EXCLUSION Filter

**File:** `apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/sister-vendor-exclusion.test.ts`

### Source Logic (lines 173-178 of filter-mapper.ts):
```typescript
case "SISTER_VENDOR_EXCLUSION":
  const excludedSisterList = $.EXCLUDED_VENDOR_ID != null && $.EXCLUDED_VENDOR_ID != ""
    ? $.EXCLUDED_VENDOR_ID.split(";").filter((element: any) => element.trim() !== "")
    : [];
  outputResult = inputResult.filter((item) => {
    return !_.includes(excludedSisterList, item.vendorId.toString());
  });
  break;
```

Key details:
- `$.EXCLUDED_VENDOR_ID` comes from `GetInfo()`. With our strategy it equals `productItem.sisterVendorId`.
- Same split-by-semicolon pattern as EXCLUDED_VENDOR, but uses `sisterVendorId` instead of `excludedVendors`.
- This does NOT re-add own vendor (unlike HANDLING_TIME and BADGE_INDICATOR).

### Complete Test Code:

```typescript
import { FilterBasedOnParams } from '../../../../filter-mapper';
import { Net32Product } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';

jest.mock('../../../../../model/global-param', () => ({
  GetInfo: jest.fn().mockImplementation(async (_mpId: any, productDet: any) => {
    return {
      VENDOR_ID: productDet?.ownVendorId || '100',
      EXCLUDED_VENDOR_ID: productDet?.sisterVendorId || '',
    };
  }),
}));

function makeNet32Product(overrides: Partial<Net32Product> = {}): Net32Product {
  return {
    vendorProductId: 1,
    vendorProductCode: 'VP001',
    vendorId: 100,
    vendorName: 'Test Vendor',
    vendorRegion: 'US',
    inStock: true,
    standardShipping: 5.99,
    standardShippingStatus: 'ACTIVE',
    freeShippingGap: 10,
    heavyShippingStatus: 'NONE',
    heavyShipping: 0,
    shippingTime: 3,
    inventory: 50,
    isFulfillmentPolicyStock: false,
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
    arrivalBusinessDays: 3,
    twoDayDeliverySw: false,
    isLowestTotalPrice: null,
    ...overrides,
  };
}

function makeFrontierProduct(overrides: Partial<FrontierProduct> = {}): FrontierProduct {
  return {
    channelName: 'TRADENT',
    activated: true,
    mpid: 12345,
    channelId: 'CH1',
    unitPrice: '10.00',
    floorPrice: '5.00',
    maxPrice: '99.00',
    is_nc_needed: false,
    suppressPriceBreakForOne: false,
    repricingRule: 1,
    suppressPriceBreak: false,
    beatQPrice: false,
    percentageIncrease: 0,
    compareWithQ1: false,
    competeAll: false,
    badgeIndicator: 'ALL_ZERO',
    badgePercentage: 0,
    productName: 'Test Product',
    cronId: 'cron1',
    cronName: 'Regular',
    requestInterval: 60,
    requestIntervalUnit: 'MINUTES',
    scrapeOn: true,
    allowReprice: true,
    focusId: '',
    priority: 1,
    wait_update_period: false,
    net32url: 'https://net32.com/test',
    abortDeactivatingQPriceBreak: false,
    ownVendorId: '100',
    sisterVendorId: '200;201',
    tags: [],
    includeInactiveVendors: true,
    inactiveVendorId: '',
    override_bulk_update: false,
    override_bulk_rule: 0,
    latest_price: 10.00,
    executionPriority: 1,
    lastCronRun: '',
    lastExistingPrice: '10.00',
    lastSuggestedPrice: '9.99',
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
    handlingTimeFilter: 'ALL',
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
    contextCronName: '',
    contextMinQty: 1,
  } as FrontierProduct;
}

describe('FilterBasedOnParams - SISTER_VENDOR_EXCLUSION', () => {
  const vendorA = makeNet32Product({ vendorId: 100, vendorName: 'Own Vendor' });
  const vendorB = makeNet32Product({ vendorId: 200, vendorName: 'Sister 1' });
  const vendorC = makeNet32Product({ vendorId: 201, vendorName: 'Sister 2' });
  const vendorD = makeNet32Product({ vendorId: 300, vendorName: 'Competitor' });
  const allVendors = [vendorA, vendorB, vendorC, vendorD];

  it('should remove sister vendors from the list', async () => {
    const product = makeFrontierProduct({ sisterVendorId: '200;201' });
    const result = await FilterBasedOnParams(allVendors, product, 'SISTER_VENDOR_EXCLUSION');
    expect(result).toHaveLength(2);
    expect(result.map(v => v.vendorId)).toEqual([100, 300]);
  });

  it('should not filter any vendors when sisterVendorId is empty', async () => {
    const product = makeFrontierProduct({ sisterVendorId: '' });
    const result = await FilterBasedOnParams(allVendors, product, 'SISTER_VENDOR_EXCLUSION');
    expect(result).toHaveLength(4);
  });

  it('should handle single sister vendor', async () => {
    const product = makeFrontierProduct({ sisterVendorId: '200' });
    const result = await FilterBasedOnParams(allVendors, product, 'SISTER_VENDOR_EXCLUSION');
    expect(result).toHaveLength(3);
    expect(result.map(v => v.vendorId)).toEqual([100, 201, 300]);
  });

  it('should handle trailing semicolon in sisterVendorId', async () => {
    const product = makeFrontierProduct({ sisterVendorId: '200;' });
    const result = await FilterBasedOnParams(allVendors, product, 'SISTER_VENDOR_EXCLUSION');
    expect(result).toHaveLength(3);
    expect(result.map(v => v.vendorId)).toEqual([100, 201, 300]);
  });

  it('should handle sisterVendorId with IDs not in the input list', async () => {
    const product = makeFrontierProduct({ sisterVendorId: '999;888' });
    const result = await FilterBasedOnParams(allVendors, product, 'SISTER_VENDOR_EXCLUSION');
    expect(result).toHaveLength(4);
  });

  it('should exclude own vendor if own vendor is in the sister list', async () => {
    // NOTE: This is a real edge case. SISTER_VENDOR_EXCLUSION does NOT re-add own vendor.
    const product = makeFrontierProduct({ sisterVendorId: '100;200' });
    const result = await FilterBasedOnParams(allVendors, product, 'SISTER_VENDOR_EXCLUSION');
    expect(result.map(v => v.vendorId)).not.toContain(100);
    expect(result.map(v => v.vendorId)).not.toContain(200);
  });

  it('should return empty when all vendors are sisters', async () => {
    const product = makeFrontierProduct({ sisterVendorId: '100;200;201;300' });
    const result = await FilterBasedOnParams(allVendors, product, 'SISTER_VENDOR_EXCLUSION');
    expect(result).toHaveLength(0);
  });

  it('should return empty array when input is empty', async () => {
    const product = makeFrontierProduct({ sisterVendorId: '200' });
    const result = await FilterBasedOnParams([], product, 'SISTER_VENDOR_EXCLUSION');
    expect(result).toHaveLength(0);
  });

  it('should compare vendorId as string via .toString()', async () => {
    const numericVendor = makeNet32Product({ vendorId: 200 });
    const product = makeFrontierProduct({ sisterVendorId: '200' });
    const result = await FilterBasedOnParams([numericVendor], product, 'SISTER_VENDOR_EXCLUSION');
    expect(result).toHaveLength(0);
  });
});
```

---

## 11. Test File: GetContextPrice

**File:** `apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/get-context-price.test.ts`

### Source Logic (lines 185-203 of filter-mapper.ts):
```typescript
export async function GetContextPrice(nextLowestPrice: any, processOffset: any, floorPrice: any, percentageDown: any, minQty: any, heavyShippingPrice: number = 0): Promise<any> {
  let returnObj: any = {};
  returnObj.Price = new Decimal(nextLowestPrice).minus(processOffset).toNumber();
  returnObj.Type = "OFFSET";
  try {
    if (percentageDown != 0 && minQty == 1) {
      const percentageDownPrice = subtractPercentage(nextLowestPrice + heavyShippingPrice, percentageDown) - heavyShippingPrice;
      if (percentageDownPrice > floorPrice) {
        returnObj.Price = percentageDownPrice;
        returnObj.Type = "PERCENTAGE";
      } else if (percentageDownPrice <= floorPrice) {
        returnObj.Type = "FLOOR_OFFSET";
        // Note: Price stays as the OFFSET price (nextLowestPrice - processOffset)
      }
    }
  } catch (exception) {
    console.log(`Exception while getting ContextPrice : ${exception}`);
  }
  return returnObj;
}
```

Also uses:
```typescript
export function subtractPercentage(originalNumber: number, percentage: number) {
  return parseFloat((Math.floor((originalNumber - originalNumber * percentage) * 100) / 100).toFixed(2));
}
```

Key details:
- Returns `{ Price: number, Type: string }` (capital P and T).
- Default: Price = nextLowestPrice - processOffset, Type = "OFFSET".
- If `percentageDown != 0` AND `minQty == 1` (loose equality):
  - Calculates `subtractPercentage(nextLowestPrice + heavyShippingPrice, percentageDown) - heavyShippingPrice`
  - If result > floorPrice: Price = result, Type = "PERCENTAGE"
  - If result <= floorPrice: Price stays as OFFSET price, Type = "FLOOR_OFFSET"
- No mocks needed. GetContextPrice has no external dependencies (pure computation + Decimal.js).

### Complete Test Code:

```typescript
import { GetContextPrice, subtractPercentage } from '../../../../filter-mapper';

// No mocking needed -- GetContextPrice and subtractPercentage are pure functions.

describe('GetContextPrice', () => {
  describe('default OFFSET behavior (percentageDown = 0 or minQty != 1)', () => {
    it('should return OFFSET type with price = nextLowestPrice - processOffset', async () => {
      const result = await GetContextPrice(10.00, 0.01, 5.00, 0, 1);
      expect(result.Type).toBe('OFFSET');
      expect(result.Price).toBeCloseTo(9.99, 2);
    });

    it('should return OFFSET when percentageDown is 0 even if minQty is 1', async () => {
      const result = await GetContextPrice(20.00, 0.01, 5.00, 0, 1);
      expect(result.Type).toBe('OFFSET');
      expect(result.Price).toBeCloseTo(19.99, 2);
    });

    it('should return OFFSET when minQty != 1 even if percentageDown > 0', async () => {
      const result = await GetContextPrice(10.00, 0.01, 5.00, 0.10, 2);
      expect(result.Type).toBe('OFFSET');
      expect(result.Price).toBeCloseTo(9.99, 2);
    });

    it('should handle large offset', async () => {
      const result = await GetContextPrice(100.00, 5.00, 50.00, 0, 1);
      expect(result.Price).toBeCloseTo(95.00, 2);
      expect(result.Type).toBe('OFFSET');
    });

    it('should handle zero offset', async () => {
      const result = await GetContextPrice(10.00, 0, 5.00, 0, 1);
      expect(result.Price).toBeCloseTo(10.00, 2);
      expect(result.Type).toBe('OFFSET');
    });
  });

  describe('PERCENTAGE behavior (percentageDown != 0 AND minQty == 1, result > floor)', () => {
    it('should return PERCENTAGE type when percentage result > floor', async () => {
      // nextLowestPrice=100, offset=0.01, floor=5, percentageDown=0.10, minQty=1, heavyShipping=0
      // subtractPercentage(100 + 0, 0.10) - 0 = (100 - 100*0.10) = 90.00
      // 90.00 > 5.00 => PERCENTAGE
      const result = await GetContextPrice(100.00, 0.01, 5.00, 0.10, 1, 0);
      expect(result.Type).toBe('PERCENTAGE');
      expect(result.Price).toBeCloseTo(90.00, 2);
    });

    it('should account for heavyShippingPrice in percentage calculation', async () => {
      // nextLowestPrice=100, heavyShipping=10
      // subtractPercentage(100 + 10, 0.10) - 10 = subtractPercentage(110, 0.10) - 10
      // subtractPercentage(110, 0.10) = floor((110 - 11) * 100) / 100 = floor(9900) / 100 = 99.00
      // 99.00 - 10 = 89.00 > 5.00 => PERCENTAGE
      const result = await GetContextPrice(100.00, 0.01, 5.00, 0.10, 1, 10);
      expect(result.Type).toBe('PERCENTAGE');
      expect(result.Price).toBeCloseTo(89.00, 2);
    });

    it('should use loose equality for minQty (string "1" matches)', async () => {
      const result = await GetContextPrice(100.00, 0.01, 5.00, 0.10, '1', 0);
      expect(result.Type).toBe('PERCENTAGE');
    });
  });

  describe('FLOOR_OFFSET behavior (percentageDown != 0 AND minQty == 1, result <= floor)', () => {
    it('should return FLOOR_OFFSET type when percentage result <= floor', async () => {
      // nextLowestPrice=10, offset=0.01, floor=9.50, percentageDown=0.10, minQty=1
      // subtractPercentage(10, 0.10) = floor((10 - 1)*100)/100 = 9.00
      // 9.00 <= 9.50 => FLOOR_OFFSET
      // Price stays as OFFSET = 10 - 0.01 = 9.99
      const result = await GetContextPrice(10.00, 0.01, 9.50, 0.10, 1, 0);
      expect(result.Type).toBe('FLOOR_OFFSET');
      expect(result.Price).toBeCloseTo(9.99, 2);
    });

    it('should return FLOOR_OFFSET when percentage result exactly equals floor', async () => {
      // subtractPercentage(10, 0.05) = floor((10 - 0.5)*100)/100 = floor(950)/100 = 9.50
      // 9.50 <= 9.50 => FLOOR_OFFSET
      const result = await GetContextPrice(10.00, 0.01, 9.50, 0.05, 1, 0);
      expect(result.Type).toBe('FLOOR_OFFSET');
      expect(result.Price).toBeCloseTo(9.99, 2);
    });

    it('should keep OFFSET price (not percentage price) when FLOOR_OFFSET', async () => {
      const result = await GetContextPrice(50.00, 0.01, 48.00, 0.10, 1, 0);
      // subtractPercentage(50, 0.10) = 45.00, 45.00 <= 48.00 => FLOOR_OFFSET
      // Price = 50 - 0.01 = 49.99 (OFFSET price, NOT the percentage price)
      expect(result.Type).toBe('FLOOR_OFFSET');
      expect(result.Price).toBeCloseTo(49.99, 2);
    });
  });

  describe('edge cases', () => {
    it('should handle nextLowestPrice of 0', async () => {
      const result = await GetContextPrice(0, 0.01, 0, 0, 1);
      expect(result.Price).toBeCloseTo(-0.01, 2);
      expect(result.Type).toBe('OFFSET');
    });

    it('should handle heavyShippingPrice default (0)', async () => {
      const result = await GetContextPrice(10.00, 0.01, 5.00, 0.10, 1);
      // heavyShippingPrice defaults to 0
      expect(result.Type).toBe('PERCENTAGE');
    });

    it('should handle very small percentageDown', async () => {
      // nextLowestPrice=100, percentageDown=0.001 (0.1%)
      // subtractPercentage(100, 0.001) = floor((100-0.1)*100)/100 = floor(9990)/100 = 99.90
      // 99.90 > 5 => PERCENTAGE
      const result = await GetContextPrice(100.00, 0.01, 5.00, 0.001, 1, 0);
      expect(result.Type).toBe('PERCENTAGE');
      expect(result.Price).toBeCloseTo(99.90, 2);
    });
  });
});
```

---

## 12. Test File: subtractPercentage

**File:** `apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/subtract-percentage.test.ts`

### Source Logic (line 345-347 of filter-mapper.ts):
```typescript
export function subtractPercentage(originalNumber: number, percentage: number) {
  return parseFloat((Math.floor((originalNumber - originalNumber * percentage) * 100) / 100).toFixed(2));
}
```

Key details:
- Subtracts `percentage` as a decimal fraction (e.g., 0.10 for 10%).
- Uses `Math.floor` (rounds DOWN), then `toFixed(2)`, then `parseFloat`.
- This means the result always rounds down to 2 decimal places.
- Pure function, no dependencies, no mocks needed.

### Complete Test Code:

```typescript
import { subtractPercentage } from '../../../../filter-mapper';

describe('subtractPercentage', () => {
  it('should subtract 10% from 100', () => {
    // 100 - 100 * 0.10 = 90.00
    expect(subtractPercentage(100, 0.10)).toBe(90.00);
  });

  it('should subtract 5% from 200', () => {
    // 200 - 200 * 0.05 = 190.00
    expect(subtractPercentage(200, 0.05)).toBe(190.00);
  });

  it('should round down (floor) to 2 decimal places', () => {
    // 10 - 10 * 0.03 = 9.7
    // Math.floor(9.7 * 100) / 100 = Math.floor(970) / 100 = 9.70
    expect(subtractPercentage(10, 0.03)).toBe(9.70);
  });

  it('should floor fractional cents down', () => {
    // 10.99 - 10.99 * 0.07 = 10.99 - 0.7693 = 10.2207
    // Math.floor(10.2207 * 100) / 100 = Math.floor(1022.07) / 100 = 10.22
    expect(subtractPercentage(10.99, 0.07)).toBe(10.22);
  });

  it('should return original number when percentage is 0', () => {
    expect(subtractPercentage(50, 0)).toBe(50.00);
  });

  it('should return 0 when percentage is 1 (100%)', () => {
    expect(subtractPercentage(50, 1)).toBe(0.00);
  });

  it('should handle very small numbers', () => {
    // 0.01 - 0.01 * 0.10 = 0.009
    // Math.floor(0.009 * 100) / 100 = Math.floor(0.9) / 100 = 0.00
    expect(subtractPercentage(0.01, 0.10)).toBe(0.00);
  });

  it('should handle percentage > 1 (more than 100%)', () => {
    // 100 - 100 * 1.5 = -50
    // Math.floor(-50 * 100) / 100 = Math.floor(-5000) / 100 = -50.00
    expect(subtractPercentage(100, 1.5)).toBe(-50.00);
  });

  it('should handle 0 as original number', () => {
    expect(subtractPercentage(0, 0.10)).toBe(0.00);
  });

  it('should handle typical repricing scenario', () => {
    // Price $24.99, percentage down 3%
    // 24.99 - 24.99 * 0.03 = 24.99 - 0.7497 = 24.2403
    // Math.floor(24.2403 * 100) / 100 = Math.floor(2424.03) / 100 = 24.24
    expect(subtractPercentage(24.99, 0.03)).toBe(24.24);
  });
});
```

---

## 13. Note on isNotShortExpiryProduct

The function `isNotShortExpiryProduct` is defined as a **private function** (no `export` keyword) in:
- `apps/api-core/src/utility/reprice-algo/v1/reprice-helper.ts` (line 726)
- `apps/api-core/src/utility/reprice-algo/v1/reprice-helper-nc.ts` (line 757)
- `apps/api-core/src/utility/history-helper.ts` (line 80)

Since it is not exported from any of these files, it **cannot be directly imported into a test file**.

### Options to test it:

**Option A (Recommended): Test indirectly through integration tests.**
The function is called during the `Reprice()` flow via the eligible list construction. Test it by providing Net32Products with `promoAddlDescr` containing "EXP" or "SHORT" strings and verifying those products are excluded from the reprice result.

**Option B: Extract and export it.**
If the team decides to refactor, export the function from `reprice-helper.ts` and create a dedicated test file. The logic is:

```typescript
function isNotShortExpiryProduct(priceBreaks: Net32PriceBreak, listOfPriceBreaks: Net32PriceBreak[], _minQty: number) {
  const contextPriceBreaks = _.filter(listOfPriceBreaks, (x) => x.minQty == _minQty && x.active == true);
  if (contextPriceBreaks && contextPriceBreaks.length > 1) {
    let resultantEval = true;
    contextPriceBreaks.forEach((x) => {
      if (x.promoAddlDescr && (x.promoAddlDescr.toUpperCase().indexOf("EXP") > -1 || x.promoAddlDescr.toUpperCase().indexOf("SHORT") > -1)) {
        resultantEval = false;
      }
    });
    return resultantEval;
  }
  if (priceBreaks && priceBreaks.promoAddlDescr) {
    return priceBreaks.promoAddlDescr.toUpperCase().indexOf("EXP") < 0 && priceBreaks.promoAddlDescr.toUpperCase().indexOf("SHORT") < 0;
  }
  return true;
}
```

Behavior summary:
1. Finds all price breaks matching `_minQty` and `active == true`.
2. If more than one match exists: returns `false` if ANY has `promoAddlDescr` containing "EXP" or "SHORT" (case-insensitive).
3. If zero or one match: checks the single `priceBreaks` argument's `promoAddlDescr`. Returns `false` if it contains "EXP" or "SHORT".
4. If no `promoAddlDescr` at all: returns `true`.

**Do not create a test file for this function unless it is first exported.**

---

## 14. How to Run

### Run all filter tests:
```bash
cd /home/dima/repricer-monorepo/apps/api-core
npx jest src/utility/reprice-algo/__tests__/v1/filters/ --verbose
```

### Run a single test file:
```bash
cd /home/dima/repricer-monorepo/apps/api-core
npx jest src/utility/reprice-algo/__tests__/v1/filters/excluded-vendor.test.ts --verbose
```

### Run with coverage:
```bash
cd /home/dima/repricer-monorepo/apps/api-core
npx jest src/utility/reprice-algo/__tests__/v1/filters/ --coverage --collectCoverageFrom='src/utility/filter-mapper.ts'
```

### Run in watch mode during development:
```bash
cd /home/dima/repricer-monorepo/apps/api-core
npx jest src/utility/reprice-algo/__tests__/v1/filters/ --watch
```

### Expected test file structure:
```
apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/
  excluded-vendor.test.ts
  inventory-threshold.test.ts
  handling-time.test.ts
  badge-indicator.test.ts
  phantom-price-break.test.ts
  sister-vendor-exclusion.test.ts
  get-context-price.test.ts
  subtract-percentage.test.ts
```

### Mock path reference:
All test files that test `FilterBasedOnParams` must mock:
```typescript
jest.mock('../../../../../model/global-param', () => ({ ... }));
```
This resolves from `apps/api-core/src/utility/reprice-algo/__tests__/v1/filters/` up to `apps/api-core/src/model/global-param`.

### Import path reference:
```typescript
// FilterBasedOnParams, GetContextPrice, subtractPercentage
import { ... } from '../../../../filter-mapper';
// Resolves to: apps/api-core/src/utility/filter-mapper.ts

// Types
import { Net32Product } from '../../../../../types/net32';
import { FrontierProduct } from '../../../../../types/frontier';
// Resolves to: apps/api-core/src/types/net32.ts and frontier.ts
```
