# Layer 4 -- Data-Driven Scenario Testing with JSON Golden Files

## Overview

Golden-file testing drives the V2 repricing algorithm through realistic scenarios
defined entirely in JSON. Each scenario encodes the Net32 product array, vendor
settings, and the expected algorithm outcome. A single test runner loads every
`*.json` file from the `scenarios/` directory and executes it as an independent
Jest test case. When the algorithm changes intentionally you update the JSON
fixtures -- never the test runner.

```
apps/api-core/src/utility/reprice-algo/__tests__/golden-files/
  runner.test.ts              <-- the single test runner
  scenarios/
    01-no-competitor.json
    02-own-lowest.json
    ...                       <-- one file per scenario
```

---

## Concept

Each JSON fixture contains:

| Key           | Purpose                                                    |
| ------------- | ---------------------------------------------------------- |
| `name`        | Human-readable label shown in Jest output                  |
| `description` | Business context -- *why* this scenario matters            |
| `tags`        | Free-form labels for filtering (`["floor","ignore"]`)      |
| `input`       | `mpId`, `net32Products` array, partial `vendorSettings`    |
| `expected`    | `algoResult`, `suggestedPrice`, optional comment fragments |

The test runner merges partial `vendorSettings` over the database defaults
(reproduced as a constant in the runner) so scenarios only need to specify the
fields that differ from a baseline configuration.

---

## File Locations

| What               | Path                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Test runner          | `apps/api-core/src/utility/reprice-algo/__tests__/golden-files/runner.test.ts`                |
| Scenario directory   | `apps/api-core/src/utility/reprice-algo/__tests__/golden-files/scenarios/`                    |
| Algorithm under test | `apps/api-core/src/utility/reprice-algo/v2/algorithm.ts` -- `repriceProductV2()`              |
| Types referenced     | `apps/api-core/src/utility/reprice-algo/v2/types.ts` -- `AlgoResult`, `Net32AlgoProduct`      |
| Vendor settings type | `apps/api-core/src/utility/mysql/v2-algo-settings.ts` -- `V2AlgoSettingsData`                 |
| Shared enums         | `packages/shared/src/index.ts` -- `VendorId`, `AlgoPriceDirection`, `AlgoPriceStrategy`, etc. |

---

## JSON Fixture Format

Every scenario file must conform to this structure. Fields within
`vendorSettings` are **partial** -- the runner fills in defaults for anything
omitted.

```jsonc
{
  "name": "Human-readable scenario name",
  "description": "What business situation this tests",
  "tags": ["floor", "ignore"],
  "input": {
    "mpId": 12345,
    "net32Products": [
      // Array of Net32AlgoProduct objects (see full shape below)
    ],
    "vendorSettings": {
      // PARTIAL V2AlgoSettingsData -- only override what matters
      "floor_price": 5.00,
      "max_price": 20.00,
      "up_down": "UP/DOWN",
      "enabled": true
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357, 20722, 20755],
    "nonBlocked422VendorIds": [17357, 20722, 20755],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #FLOOR",
    "suggestedPrice": null,
    "commentContains": ["Hit the floor"],
    "commentNotContains": ["error"]
  }
}
```

### Net32AlgoProduct shape

This is the type consumed by `repriceProductV2()`. The full interface lives in
`apps/api-core/src/utility/reprice-algo/v2/types.ts`:

```ts
interface Net32AlgoProduct {
  vendorId: number;
  vendorName: string;
  inStock: boolean;
  standardShipping: number;
  shippingTime: number;        // days
  inventory: number;
  badgeId: number;             // 0 = no badge
  badgeName: string | null;    // "" or null = no badge
  priceBreaks: { minQty: number; unitPrice: number }[];
  freeShippingGap: number;
  freeShippingThreshold: number;
}
```

### V2AlgoSettingsData defaults

These are the database defaults applied when creating a new settings row
(from `apps/api-core/src/utility/mysql/v2-algo-settings.ts`). The runner
reproduces these exactly and merges scenario overrides on top:

```ts
const DEFAULT_VENDOR_SETTINGS: Omit<V2AlgoSettingsData, "id"> = {
  mp_id: 0,                                       // overridden per scenario
  vendor_id: 0,                                    // overridden per scenario
  suppress_price_break_if_Q1_not_updated: false,
  suppress_price_break: false,
  compete_on_price_break_only: false,
  up_down: "UP/DOWN",                              // AlgoPriceDirection.UP_DOWN
  badge_indicator: "ALL",                          // AlgoBadgeIndicator.ALL
  execution_priority: 0,
  reprice_up_percentage: -1,
  compare_q2_with_q1: false,
  compete_with_all_vendors: false,
  reprice_up_badge_percentage: -1,
  sister_vendor_ids: "",
  exclude_vendors: "",
  inactive_vendor_id: "",
  handling_time_group: "ALL",                      // AlgoHandlingTimeGroup.ALL
  keep_position: false,
  max_price: 99999999.99,
  floor_price: 0,
  inventory_competition_threshold: 1,
  reprice_down_percentage: -1,
  reprice_down_badge_percentage: -1,
  floor_compete_with_next: false,
  own_vendor_threshold: 1,
  price_strategy: "UNIT",                          // AlgoPriceStrategy.UNIT
  enabled: false,
};
```

### VendorThreshold shape

`repriceProductV2` also requires a `VendorThreshold[]` array. Each threshold
maps a vendorId to its free-shipping threshold and standard shipping cost:

```ts
interface VendorThreshold {
  vendorId: number;
  standardShipping: number;
  threshold: number;           // order subtotal above which shipping is free
}
```

The runner auto-generates these from the `net32Products` array in each scenario.

### Expected result fields

| Field                | Type                | Required | Description                                              |
| -------------------- | ------------------- | -------- | -------------------------------------------------------- |
| `algoResult`         | `string`            | yes      | Exact `AlgoResult` enum value, e.g. `"CHANGE #DOWN"`    |
| `suggestedPrice`     | `number \| null`    | yes      | Expected `suggestedPrice` from the algo                  |
| `commentContains`    | `string[]`          | no       | Substrings that MUST appear in `comment`                 |
| `commentNotContains` | `string[]`          | no       | Substrings that MUST NOT appear in `comment`             |

---

## Test Runner -- `runner.test.ts`

Create this file at:
`apps/api-core/src/utility/reprice-algo/__tests__/golden-files/runner.test.ts`

```ts
import * as fs from "fs";
import * as path from "path";
import {
  AlgoBadgeIndicator,
  AlgoHandlingTimeGroup,
  AlgoPriceDirection,
  AlgoPriceStrategy,
} from "@repricer-monorepo/shared";
import { V2AlgoSettingsData } from "../../../../utility/mysql/v2-algo-settings";
import { repriceProductV2 } from "../../v2/algorithm";
import { VendorThreshold } from "../../v2/shipping-threshold";
import { Net32AlgoProduct } from "../../v2/types";

// ---------------------------------------------------------------------------
// Types for the JSON fixture files
// ---------------------------------------------------------------------------
interface ScenarioExpected {
  algoResult: string;
  suggestedPrice: number | null;
  commentContains?: string[];
  commentNotContains?: string[];
}

interface ScenarioInput {
  mpId: number;
  net32Products: Net32AlgoProduct[];
  vendorSettings: Partial<V2AlgoSettingsData>;
  ownVendorId: number;
  allOwnVendorIds: number[];
  nonBlocked422VendorIds: number[];
  isSlowCron: boolean;
  vendorThresholds?: VendorThreshold[];
}

interface ScenarioFile {
  name: string;
  description: string;
  tags: string[];
  input: ScenarioInput;
  expected: ScenarioExpected;
}

// ---------------------------------------------------------------------------
// Database defaults -- must stay in sync with createV2AlgoSettings()
// in apps/api-core/src/utility/mysql/v2-algo-settings.ts
// ---------------------------------------------------------------------------
const DEFAULT_VENDOR_SETTINGS: Omit<V2AlgoSettingsData, "id"> = {
  mp_id: 0,
  vendor_id: 0,
  suppress_price_break_if_Q1_not_updated: false,
  suppress_price_break: false,
  compete_on_price_break_only: false,
  up_down: AlgoPriceDirection.UP_DOWN,
  badge_indicator: AlgoBadgeIndicator.ALL,
  execution_priority: 0,
  reprice_up_percentage: -1,
  compare_q2_with_q1: false,
  compete_with_all_vendors: false,
  reprice_up_badge_percentage: -1,
  sister_vendor_ids: "",
  exclude_vendors: "",
  inactive_vendor_id: "",
  handling_time_group: AlgoHandlingTimeGroup.ALL,
  keep_position: false,
  max_price: 99999999.99,
  floor_price: 0,
  inventory_competition_threshold: 1,
  reprice_down_percentage: -1,
  reprice_down_badge_percentage: -1,
  floor_compete_with_next: false,
  own_vendor_threshold: 1,
  price_strategy: AlgoPriceStrategy.UNIT,
  enabled: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVendorSettings(
  mpId: number,
  vendorId: number,
  overrides: Partial<V2AlgoSettingsData>,
): V2AlgoSettingsData {
  return {
    ...DEFAULT_VENDOR_SETTINGS,
    mp_id: mpId,
    vendor_id: vendorId,
    enabled: true, // scenarios always assume the vendor is enabled
    ...overrides,
  } as V2AlgoSettingsData;
}

/**
 * Build a VendorThreshold[] from the scenario. If the scenario provides
 * explicit vendorThresholds, use them. Otherwise derive one per unique
 * vendorId from the net32Products array, using the product's own
 * freeShippingThreshold and standardShipping.
 */
function buildVendorThresholds(
  scenario: ScenarioFile,
): VendorThreshold[] {
  if (
    scenario.input.vendorThresholds &&
    scenario.input.vendorThresholds.length > 0
  ) {
    return scenario.input.vendorThresholds;
  }
  const seen = new Set<number>();
  const thresholds: VendorThreshold[] = [];
  for (const p of scenario.input.net32Products) {
    if (!seen.has(p.vendorId)) {
      seen.add(p.vendorId);
      thresholds.push({
        vendorId: p.vendorId,
        standardShipping: p.standardShipping,
        threshold: p.freeShippingThreshold,
      });
    }
  }
  return thresholds;
}

// ---------------------------------------------------------------------------
// Load every *.json file from the scenarios/ directory
// ---------------------------------------------------------------------------
const SCENARIOS_DIR = path.join(__dirname, "scenarios");

function loadScenarios(): { fileName: string; scenario: ScenarioFile }[] {
  if (!fs.existsSync(SCENARIOS_DIR)) {
    throw new Error(
      `Scenarios directory not found: ${SCENARIOS_DIR}. ` +
        `Create it and add at least one .json fixture.`,
    );
  }
  const files = fs
    .readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    throw new Error(
      `No .json scenario files found in ${SCENARIOS_DIR}. ` +
        `Add at least one fixture to run golden-file tests.`,
    );
  }

  return files.map((fileName) => {
    const raw = fs.readFileSync(path.join(SCENARIOS_DIR, fileName), "utf-8");
    return { fileName, scenario: JSON.parse(raw) as ScenarioFile };
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe("Golden-file scenario tests", () => {
  const scenarios = loadScenarios();

  it.each(scenarios.map((s) => [s.fileName, s.scenario.name, s] as const))(
    "%s -- %s",
    (_fileName, _name, { scenario }) => {
      const {
        mpId,
        net32Products,
        vendorSettings: partialSettings,
        ownVendorId,
        allOwnVendorIds,
        nonBlocked422VendorIds,
        isSlowCron,
      } = scenario.input;

      // Build the full vendor settings for the own vendor
      const vendorSettings = allOwnVendorIds.map((vid) =>
        buildVendorSettings(mpId, vid, {
          ...partialSettings,
          // Ensure floor/max apply only to the own vendor under test
          ...(vid === ownVendorId ? {} : { enabled: false }),
        }),
      );
      // The own vendor must be enabled
      const ownIdx = vendorSettings.findIndex((v) => v.vendor_id === ownVendorId);
      if (ownIdx >= 0) {
        vendorSettings[ownIdx].enabled = true;
      }

      const vendorThresholds = buildVendorThresholds(scenario);

      // Run the algorithm
      const results = repriceProductV2(
        mpId,
        net32Products,
        nonBlocked422VendorIds,
        allOwnVendorIds,
        vendorSettings,
        "golden-test-job",
        isSlowCron,
        `https://www.net32.com/ec/mp-${mpId}`,
        vendorThresholds,
      );

      // We only care about Q1 results for the own vendor under test
      const q1Result = results.find(
        (r) => r.vendor.vendorId === ownVendorId && r.quantity === 1,
      );

      expect(q1Result).toBeDefined();
      if (!q1Result) return; // type guard for TS

      // -- algoResult
      expect(q1Result.algoResult).toBe(scenario.expected.algoResult);

      // -- suggestedPrice
      if (scenario.expected.suggestedPrice === null) {
        expect(q1Result.suggestedPrice).toBeNull();
      } else {
        expect(q1Result.suggestedPrice).toBeCloseTo(
          scenario.expected.suggestedPrice,
          2,
        );
      }

      // -- comment substring assertions
      if (scenario.expected.commentContains) {
        for (const fragment of scenario.expected.commentContains) {
          expect(q1Result.comment).toContain(fragment);
        }
      }
      if (scenario.expected.commentNotContains) {
        for (const fragment of scenario.expected.commentNotContains) {
          expect(q1Result.comment).not.toContain(fragment);
        }
      }
    },
  );
});
```

### Key design decisions

1. **Only Q1 by default.** The runner filters to `quantity === 1` for the
   `ownVendorId`. Most business scenarios are Q1-centric. If a scenario needs
   to assert on a different quantity, add an optional `expectedQuantity` field
   to the fixture format and adjust the filter.

2. **Vendor thresholds are derived.** Rather than requiring every scenario to
   spell out `VendorThreshold[]` entries, the runner builds them automatically
   from each product's `freeShippingThreshold` and `standardShipping`. A
   scenario can override this by providing an explicit `vendorThresholds` array.

3. **No network or database calls.** `repriceProductV2()` is a pure function
   that accepts all data as arguments. No mocks are needed.

4. **`enabled` defaults to `true`.** In the database the default is `false`,
   but a scenario would be pointless with the vendor disabled, so the runner
   always forces `enabled: true` for the own vendor.

---

## Complete Scenario Fixtures

### Scenario 01 -- `01-no-competitor.json`

Only the own vendor is present. No competitor exists. The algorithm prices to
max.

```json
{
  "name": "No competitor -- only own vendor present",
  "description": "When the Net32 product list contains only our own vendor, there are no competitors. The algorithm should push the price to max_price since there is nobody to undercut.",
  "tags": ["ignore", "no-competitor"],
  "input": {
    "mpId": 10001,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 10.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #UP",
    "suggestedPrice": 25.00,
    "commentContains": ["undercut"]
  }
}
```

### Scenario 02 -- `02-own-lowest.json`

Own vendor is already the cheapest (buy-box rank 0) and direction is DOWN.
Algorithm should IGNORE because we are already winning.

```json
{
  "name": "Own vendor already lowest -- direction DOWN",
  "description": "When our vendor is already in the winning position (rank 0) and direction is DOWN, the algorithm should IGNORE because there is nothing to price down to.",
  "tags": ["ignore", "lowest"],
  "input": {
    "mpId": 10002,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 8.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #LOWEST",
    "suggestedPrice": 11.99,
    "commentContains": ["Already winning"]
  }
}
```

### Scenario 03 -- `03-hit-floor.json`

The competitor's price is below our floor. After iterating through all
competitors, none yields a valid undercut price above floor. The algo returns
`IGNORE #FLOOR`.

```json
{
  "name": "All competitors below floor price",
  "description": "Every competitor's price minus one penny falls below our floor_price, so no valid undercut exists. The algorithm should IGNORE with a floor indication.",
  "tags": ["ignore", "floor"],
  "input": {
    "mpId": 10003,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 10.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CheapVendor",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 2,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 4.50 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #FLOOR",
    "suggestedPrice": null,
    "commentContains": ["Hit the floor"]
  }
}
```

### Scenario 04 -- `04-sister-lowest.json`

A sister vendor (one of our own) already occupies the winning position. The
algorithm should IGNORE because we do not want to compete with ourselves.

```json
{
  "name": "Sister vendor already in winning position",
  "description": "When a sister vendor (another one of our own vendor IDs) already holds the buy-box / lowest position, the algorithm should IGNORE to avoid internal competition.",
  "tags": ["ignore", "sister"],
  "input": {
    "mpId": 10004,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 20722,
        "vendorName": "Frontier",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 8.00 }],
        "freeShippingGap": 20.00,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 15.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357, 20722],
    "nonBlocked422VendorIds": [17357, 20722],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #SISTER_LOWEST",
    "suggestedPrice": 14.99,
    "commentContains": ["sister"]
  }
}
```

### Scenario 05 -- `05-rule-only-up.json`

Direction is UP only, but the competitor is cheaper so the algo would need to
price down. Since UP restricts this, it should IGNORE.

```json
{
  "name": "Rule=UP only but competitor is cheaper",
  "description": "Vendor is set to only price UP. The competitor is cheaper so the suggested price would be lower than current. The up/down restriction should cause IGNORE.",
  "tags": ["ignore", "direction", "up-only"],
  "input": {
    "mpId": 10005,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 15.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #SETTINGS",
    "suggestedPrice": 11.99,
    "commentContains": ["only price up", "down"]
  }
}
```

### Scenario 06 -- `06-rule-only-down.json`

Direction is DOWN only, but the competitor is more expensive so the suggested
price would be higher. The restriction causes IGNORE.

```json
{
  "name": "Rule=DOWN only but would need to price up",
  "description": "Vendor is set to only price DOWN. The competitor is more expensive, so the algo would suggest pricing up, which is blocked by the DOWN restriction.",
  "tags": ["ignore", "direction", "down-only"],
  "input": {
    "mpId": 10006,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 8.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 18.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #LOWEST",
    "suggestedPrice": 17.99,
    "commentContains": ["Already winning"]
  }
}
```

### Scenario 07 -- `07-keep-position.json`

`keep_position` is on and our vendor already has a higher position in the
original Net32 JSON than the lowest competitor. Should IGNORE.

```json
{
  "name": "Keep position -- own vendor listed above competitor",
  "description": "When keep_position is enabled and our vendor appears earlier (lower index) in the Net32 array than the lowest-priced competitor, the algorithm should IGNORE to maintain the existing JSON positioning.",
  "tags": ["ignore", "keep-position"],
  "input": {
    "mpId": 10007,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 10.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "keep_position": true,
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #SETTINGS",
    "suggestedPrice": 9.99,
    "commentContains": ["Keep position"]
  }
}
```

### Scenario 08 -- `08-own-vendor-low-inventory.json`

Own vendor inventory is below the `own_vendor_threshold`. Algorithm should
IGNORE because we do not have enough stock to compete.

```json
{
  "name": "Own vendor inventory below threshold",
  "description": "When the own vendor's inventory is below the own_vendor_threshold setting, the algorithm should IGNORE because we cannot reliably fulfill orders.",
  "tags": ["ignore", "threshold", "inventory"],
  "input": {
    "mpId": 10008,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 2,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 10.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "own_vendor_threshold": 10,
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #SETTINGS",
    "suggestedPrice": 9.99,
    "commentContains": ["threshold"]
  }
}
```

### Scenario 09 -- `09-floor-compete-with-next-off.json`

`floor_compete_with_next` is off and our vendor cannot win rank 0.
The algo should IGNORE #FLOOR because without the floor-compete-next setting,
we do not try to compete with the next cheapest when at the floor boundary.

```json
{
  "name": "Floor compete with next is OFF -- not rank 0",
  "description": "When floor_compete_with_next is disabled and our vendor cannot achieve rank 0, the algorithm should IGNORE with a floor indication rather than trying to compete with the next vendor up.",
  "tags": ["ignore", "floor", "floor-compete-next"],
  "input": {
    "mpId": 10009,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "VeryChea pVendor",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 1,
        "inventory": 100,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 3.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99002,
        "vendorName": "MidVendor",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 9.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 7.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "floor_compete_with_next": false,
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #FLOOR",
    "suggestedPrice": 8.99,
    "commentContains": ["Floor compete with next"]
  }
}
```

### Scenario 10 -- `10-short-expiry.json`

The own vendor's price break has an "EXP" promo description indicating short
expiry. Algorithm should IGNORE.

```json
{
  "name": "Short expiry product",
  "description": "When the own vendor's price break contains promoAddlDescr with 'EXP', the product is short-expiry and the algorithm should IGNORE to avoid repricing expiring stock.",
  "tags": ["ignore", "short-expiry"],
  "input": {
    "mpId": 10010,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 10.00, "promoAddlDescr": "Short EXP 2026-03" }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 14.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #SHORT_EXPIRY",
    "suggestedPrice": 13.99,
    "commentContains": ["Short expiry"]
  }
}
```

### Scenario 11 -- `11-undercut-competitor.json`

Basic undercut: one competitor, our price is higher, we undercut by a penny.

```json
{
  "name": "Basic undercut -- price down by 1 cent",
  "description": "Standard case: one competitor is cheaper. The algorithm should suggest undercutting by one penny, resulting in CHANGE #DOWN.",
  "tags": ["change", "undercut", "basic"],
  "input": {
    "mpId": 10011,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 15.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 11.99,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 12 -- `12-floor-compete-with-next.json`

First competitor is below floor, but `floor_compete_with_next` is on so the
algo should compete with the second cheapest.

```json
{
  "name": "Floor compete with next -- skip unreachable, compete with 2nd",
  "description": "The cheapest competitor is below our floor price, but floor_compete_with_next is enabled. The algorithm should skip the unreachable vendor and undercut the next one instead, resulting in a CHANGE.",
  "tags": ["change", "floor", "floor-compete-next"],
  "input": {
    "mpId": 10012,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 15.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "SuperCheap",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 1,
        "inventory": 100,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 3.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99002,
        "vendorName": "MidRange",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 7.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "floor_compete_with_next": true,
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 11.99,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 13 -- `13-price-up-to-max.json`

All competitors are far below floor. With `floor_compete_with_next` on, the
algo iterates all competitors but none gives a valid undercut above floor.
Since no competitors remain, the algo pushes to max.

```json
{
  "name": "All competitors below floor -- push to max",
  "description": "Every competitor's price is so low that undercutting them would be below floor. The algorithm should push our price to the max_price since effectively there are no reachable competitors.",
  "tags": ["change", "max", "push-to-max"],
  "input": {
    "mpId": 10013,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 10.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "DirtCheap1",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 1,
        "inventory": 100,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 2.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99002,
        "vendorName": "DirtCheap2",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 1,
        "inventory": 100,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 1.50 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 8.00,
      "max_price": 20.00,
      "up_down": "UP/DOWN",
      "floor_compete_with_next": true,
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #FLOOR",
    "suggestedPrice": null,
    "commentContains": ["Hit the floor"]
  }
}
```

### Scenario 14 -- `14-new-price-break.json`

Our vendor does not currently have a Q1 price break in the listing. The
algorithm finds a competitor and creates a new price break.

```json
{
  "name": "New price break -- vendor not currently listed at Q1",
  "description": "Our vendor exists in the product list but does not have an active Q1 price break. The algorithm creates a new break to compete, resulting in CHANGE #NEW.",
  "tags": ["change", "new", "price-break"],
  "input": {
    "mpId": 10014,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 2, "unitPrice": 9.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 14.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #NEW",
    "suggestedPrice": 13.99,
    "commentContains": ["New price break"]
  }
}
```

### Scenario 15 -- `15-price-up.json`

Our vendor is currently cheaper than all competitors. The algorithm should
suggest pricing up.

```json
{
  "name": "Price up -- own vendor currently cheapest by far",
  "description": "Our vendor's current price is much lower than the only competitor. The algorithm should suggest raising the price to just below the competitor, resulting in CHANGE #UP.",
  "tags": ["change", "up"],
  "input": {
    "mpId": 10015,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 8.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 18.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #UP",
    "suggestedPrice": 17.99,
    "commentContains": ["Pricing up"]
  }
}
```

### Scenario 16 -- `16-badge-vs-no-badge-unit.json`

Competitor has a badge, our vendor does not. With UNIT strategy, the badge
does not affect unit price comparison, so we still undercut by a penny.

```json
{
  "name": "Badge competitor -- UNIT strategy undercut",
  "description": "Competitor has a badge but under UNIT price strategy, badge status does not affect the unit price comparison. Our vendor undercuts by one penny.",
  "tags": ["change", "badge", "unit"],
  "input": {
    "mpId": 10016,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 15.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "BadgeVendor",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 11.99,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 17 -- `17-max-price-cap.json`

Competitor is very expensive. Undercutting them would still be above our
`max_price`. The algorithm should cap at max, returning a CHANGE with
`hitMax` true.

```json
{
  "name": "Max price cap -- competitor above max",
  "description": "The only competitor's price is so high that undercutting by a penny still exceeds our max_price. The algorithm should cap the suggested price at max_price.",
  "tags": ["change", "max-price", "cap"],
  "input": {
    "mpId": 10017,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 10.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "ExpensiveVendor",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 50.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 20.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #UP",
    "suggestedPrice": 20.00,
    "commentContains": ["Pricing up"]
  }
}
```

### Scenario 18 -- `18-suppress-price-break.json`

`suppress_price_break` is on. For Q1, the algorithm should proceed normally,
but this scenario verifies the Q1 path is unaffected by the setting.

```json
{
  "name": "Suppress price break -- Q1 still proceeds",
  "description": "When suppress_price_break is enabled, quantity breaks above Q1 are suppressed, but Q1 itself should still be processed normally.",
  "tags": ["change", "suppress", "price-break"],
  "input": {
    "mpId": 10018,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 15.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "suppress_price_break": true,
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 11.99,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 19 -- `19-compete-on-price-break-only.json`

`compete_on_price_break_only` is on. For Q1, the algo should IGNORE because
Q1 is not a quantity break.

```json
{
  "name": "Compete on price break only -- Q1 is IGNORED",
  "description": "When compete_on_price_break_only is enabled, the algorithm should IGNORE Q1 because Q1 is not considered a quantity break. Only Q2+ would be acted upon.",
  "tags": ["ignore", "price-break-only"],
  "input": {
    "mpId": 10019,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [
          { "minQty": 1, "unitPrice": 15.00 },
          { "minQty": 2, "unitPrice": 12.00 }
        ],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [
          { "minQty": 1, "unitPrice": 13.00 },
          { "minQty": 2, "unitPrice": 10.00 }
        ],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "compete_on_price_break_only": true,
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #SETTINGS",
    "suggestedPrice": 12.99,
    "commentContains": ["price breaks"]
  }
}
```

### Scenario 20 -- `20-multiple-competitors-undercut-cheapest.json`

Three competitors at different prices. The algorithm undercuts the cheapest
one.

```json
{
  "name": "Multiple competitors -- undercut the cheapest",
  "description": "With three competitors at different price points, the algorithm should target the cheapest one and undercut by a penny.",
  "tags": ["change", "multiple", "undercut"],
  "input": {
    "mpId": 10020,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 20.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CheapVendor",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 10.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99002,
        "vendorName": "MidVendor",
        "inStock": true,
        "standardShipping": 3.00,
        "shippingTime": 2,
        "inventory": 75,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 14.00 }],
        "freeShippingGap": 15.00,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99003,
        "vendorName": "ExpensiveVendor",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 1,
        "inventory": 200,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 22.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 30.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 9.99,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 21 -- `21-slow-cron-overrides.json`

When `isSlowCron` is true, several restrictions are relaxed:
`up_down`, `keep_position`, and `floor_compete_with_next` are bypassed.
This scenario has `up_down=UP` but because of slow cron, the algo still
prices down.

```json
{
  "name": "Slow cron bypasses up/down restriction",
  "description": "During slow cron execution, the up/down restriction is relaxed. Even though the vendor is set to UP only, the algorithm should still price down because isSlowCron is true.",
  "tags": ["change", "slow-cron", "override"],
  "input": {
    "mpId": 10021,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 15.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": true
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 11.99,
    "commentContains": ["Pricing down", "Slow cron"]
  }
}
```

### Scenario 22 -- `22-handling-time-filter.json`

`handling_time_group` is set to `FAST_SHIPPING`. Competitors with
`shippingTime > 2` are filtered out. The remaining competitor determines the
price.

```json
{
  "name": "Handling time filter -- only fast shipping competitors",
  "description": "With handling_time_group set to FAST_SHIPPING, competitors with shipping time > 2 days are excluded. Only fast-shipping competitors are considered for pricing.",
  "tags": ["change", "handling-time", "filter"],
  "input": {
    "mpId": 10022,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 20.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "SlowVendor",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 7,
        "inventory": 100,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 8.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99002,
        "vendorName": "FastVendor",
        "inStock": true,
        "standardShipping": 3.00,
        "shippingTime": 1,
        "inventory": 75,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 16.00 }],
        "freeShippingGap": 15.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 30.00,
      "up_down": "UP/DOWN",
      "handling_time_group": "FAST_SHIPPING",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 15.99,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 23 -- `23-exclude-vendor.json`

The cheapest competitor is in the `exclude_vendors` list. The algorithm should
skip them and compete with the next cheapest.

```json
{
  "name": "Excluded vendor -- skip cheapest and target next",
  "description": "The cheapest competitor is in the exclude_vendors setting. The algorithm should ignore this vendor entirely and compete with the next available competitor.",
  "tags": ["change", "exclude", "filter"],
  "input": {
    "mpId": 10023,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 20.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "ExcludedVendor",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 8.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99002,
        "vendorName": "IncludedVendor",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 14.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 30.00,
      "up_down": "UP/DOWN",
      "exclude_vendors": "99001",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 13.99,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 24 -- `24-inventory-threshold-filter.json`

Competitor has inventory below `inventory_competition_threshold`. They are
filtered out, leaving only a more expensive competitor.

```json
{
  "name": "Inventory threshold -- low-stock competitor filtered out",
  "description": "A competitor has inventory below the inventory_competition_threshold. They are excluded from competition, so the algorithm targets the next competitor with sufficient stock.",
  "tags": ["change", "inventory", "filter"],
  "input": {
    "mpId": 10024,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 18.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "LowStockVendor",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 2,
        "inventory": 2,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 8.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99002,
        "vendorName": "HighStockVendor",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 80,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 14.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 30.00,
      "up_down": "UP/DOWN",
      "inventory_competition_threshold": 10,
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 13.99,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 25 -- `25-same-price-already-winning.json`

Our vendor's existing price happens to equal the suggested price and we are at
rank 0. Algorithm should IGNORE because nothing needs to change.

```json
{
  "name": "Same price already at rank 0 -- no change needed",
  "description": "When the algo computes a suggested price that equals our current price and we are already at buy-box rank 0, the result should be IGNORE because there is nothing to update.",
  "tags": ["ignore", "same-price", "winning"],
  "input": {
    "mpId": 10025,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 11.99 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #LOWEST",
    "suggestedPrice": 11.99,
    "commentContains": ["winning"]
  }
}
```

### Scenario 26 -- `26-badge-indicator-badge-only.json`

`badge_indicator` is set to `BADGE`. Non-badge competitors are filtered out.

```json
{
  "name": "Badge indicator=BADGE -- only compete with badge vendors",
  "description": "When badge_indicator is set to BADGE, only competitors with badges are considered. Non-badge vendors are excluded from the competition set.",
  "tags": ["change", "badge", "filter"],
  "input": {
    "mpId": 10026,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 20.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "NoBadgeVendor",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 8.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99002,
        "vendorName": "BadgeVendor",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 16.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 30.00,
      "up_down": "UP/DOWN",
      "badge_indicator": "BADGE",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 15.99,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 27 -- `27-simulated-sister-vendor.json`

The `sister_vendor_ids` setting contains a competitor's vendor ID, treating
them as a "simulated sister". If this simulated sister is in the winning
position, the algo should IGNORE.

```json
{
  "name": "Simulated sister vendor in winning position",
  "description": "The sister_vendor_ids setting includes a competitor vendor ID. When this simulated sister holds the buy-box position, the algorithm should IGNORE to avoid competing with the simulated sister.",
  "tags": ["ignore", "sister", "simulated"],
  "input": {
    "mpId": 10027,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 15.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "SimulatedSister",
        "inStock": true,
        "standardShipping": 0,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 9.00 }],
        "freeShippingGap": 0,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99002,
        "vendorName": "RealCompetitor",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 14.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "sister_vendor_ids": "99001",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "IGNORE #SISTER_LOWEST",
    "suggestedPrice": 8.99,
    "commentContains": ["simulated sister"]
  }
}
```

### Scenario 28 -- `28-down-percentage.json`

`reprice_down_percentage` is set to 5. With `up_down=DOWN`, the vendor
undercuts by 5% instead of by a penny.

```json
{
  "name": "Down percentage -- 5% undercut instead of 1 cent",
  "description": "When reprice_down_percentage is set to a positive value and direction is DOWN, the algorithm undercuts by that percentage instead of a penny. For a $20 competitor, 5% off = $19.00.",
  "tags": ["change", "percentage", "down"],
  "input": {
    "mpId": 10028,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 22.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 20.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 30.00,
      "up_down": "DOWN",
      "reprice_down_percentage": 5,
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [17357],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 19.00,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 29 -- `29-compete-with-all-vendors.json`

`compete_with_all_vendors` is enabled, so our other vendor IDs are also treated
as competitors.

```json
{
  "name": "Compete with all vendors -- sister treated as competitor",
  "description": "When compete_with_all_vendors is true, sister vendor IDs are added to the competition pool. Our vendor should undercut the sister just like any other competitor.",
  "tags": ["change", "compete-all", "sister"],
  "input": {
    "mpId": 10029,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 18.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 20722,
        "vendorName": "Frontier",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 14.00 }],
        "freeShippingGap": 20.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "compete_with_all_vendors": true,
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357, 20722],
    "nonBlocked422VendorIds": [17357, 20722],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "CHANGE #DOWN",
    "suggestedPrice": 13.99,
    "commentContains": ["Pricing down"]
  }
}
```

### Scenario 30 -- `30-vendor-blocked-422.json`

Our vendor ID is absent from `nonBlocked422VendorIds` (simulating a 422 block).
The algorithm should produce no results for this vendor.

```json
{
  "name": "Vendor blocked by 422 -- no results produced",
  "description": "When the own vendor ID is not in the nonBlocked422VendorIds list (e.g., due to a previous 422 error), the algorithm should not produce any results for this vendor because it is excluded from available vendors.",
  "tags": ["ignore", "422", "blocked"],
  "input": {
    "mpId": 10030,
    "net32Products": [
      {
        "vendorId": 17357,
        "vendorName": "Tradent",
        "inStock": true,
        "standardShipping": 7.95,
        "shippingTime": 2,
        "inventory": 100,
        "badgeId": 1,
        "badgeName": "Authorized",
        "priceBreaks": [{ "minQty": 1, "unitPrice": 15.00 }],
        "freeShippingGap": 42.05,
        "freeShippingThreshold": 50.00
      },
      {
        "vendorId": 99001,
        "vendorName": "CompetitorA",
        "inStock": true,
        "standardShipping": 5.00,
        "shippingTime": 3,
        "inventory": 50,
        "badgeId": 0,
        "badgeName": null,
        "priceBreaks": [{ "minQty": 1, "unitPrice": 12.00 }],
        "freeShippingGap": 25.00,
        "freeShippingThreshold": 50.00
      }
    ],
    "vendorSettings": {
      "floor_price": 5.00,
      "max_price": 25.00,
      "up_down": "UP/DOWN",
      "price_strategy": "UNIT"
    },
    "ownVendorId": 17357,
    "allOwnVendorIds": [17357],
    "nonBlocked422VendorIds": [],
    "isSlowCron": false
  },
  "expected": {
    "algoResult": "NO_RESULT",
    "suggestedPrice": null
  }
}
```

> **Note about scenario 30:** This scenario expects no Q1 result for the own
> vendor. The runner needs a small special case: when `expected.algoResult` is
> `"NO_RESULT"`, assert that the filtered result is `undefined` rather than
> checking fields on it. Add this to the runner:

```ts
// Inside the test callback, after filtering q1Result:
if (scenario.expected.algoResult === "NO_RESULT") {
  expect(q1Result).toBeUndefined();
  return;
}
```

---

## Updated Runner with NO_RESULT Support

The final test block in `runner.test.ts` should look like this (replacing the
assertion section shown earlier):

```ts
    // We only care about Q1 results for the own vendor under test
    const q1Result = results.find(
      (r) => r.vendor.vendorId === ownVendorId && r.quantity === 1,
    );

    // Special case: scenario expects no result for this vendor
    if (scenario.expected.algoResult === "NO_RESULT") {
      expect(q1Result).toBeUndefined();
      return;
    }

    expect(q1Result).toBeDefined();
    if (!q1Result) return;

    // -- algoResult
    expect(q1Result.algoResult).toBe(scenario.expected.algoResult);

    // -- suggestedPrice
    if (scenario.expected.suggestedPrice === null) {
      expect(q1Result.suggestedPrice).toBeNull();
    } else {
      expect(q1Result.suggestedPrice).toBeCloseTo(
        scenario.expected.suggestedPrice,
        2,
      );
    }

    // -- comment substring assertions
    if (scenario.expected.commentContains) {
      for (const fragment of scenario.expected.commentContains) {
        expect(q1Result.comment).toContain(fragment);
      }
    }
    if (scenario.expected.commentNotContains) {
      for (const fragment of scenario.expected.commentNotContains) {
        expect(q1Result.comment).not.toContain(fragment);
      }
    }
```

---

## Running the Tests

```bash
# Run only golden-file tests
npx jest --testPathPattern='golden-files' --verbose

# Run with a tag filter (requires custom logic or grep on output)
npx jest --testPathPattern='golden-files' --verbose 2>&1 | grep -E '(PASS|FAIL|--)'
```

---

## Update Workflow

When the algorithm changes intentionally:

```bash
# 1. Run tests to see which scenarios break
npx jest --testPathPattern='golden-files' --verbose

# 2. Review each failure. Verify the new behavior is correct.

# 3. Update the JSON fixture files to match the new expected output.
#    Only change the "expected" section -- never the "input".

# 4. Re-run to confirm all pass
npx jest --testPathPattern='golden-files' --verbose
```

### When to add new scenarios

- A new business rule is added (e.g., a new setting in V2AlgoSettingsData)
- A bug is found -- add a failing scenario first, then fix the code
- An edge case is discovered in production

### Naming convention

```
NN-short-description.json
```

where `NN` is a zero-padded sequence number. Scenarios are loaded in sorted
order so numbering controls execution order (though tests should not depend on
it).

---

## AlgoResult Reference

These are the possible values of `AlgoResult` from
`apps/api-core/src/utility/reprice-algo/v2/types.ts`:

| Enum value              | String literal            | Meaning                                         |
| ----------------------- | ------------------------- | ----------------------------------------------- |
| `CHANGE_UP`             | `"CHANGE #UP"`            | Price increased to undercut a more expensive competitor |
| `CHANGE_NEW`            | `"CHANGE #NEW"`           | New price break created (none existed before)    |
| `CHANGE_DOWN`           | `"CHANGE #DOWN"`          | Price decreased to undercut a cheaper competitor |
| `CHANGE_REMOVED`        | `"CHANGE #REMOVED"`       | Price break deactivated (unnecessary Q break)    |
| `IGNORE_FLOOR`          | `"IGNORE #FLOOR"`         | Cannot price below floor / floor-compete-next off |
| `IGNORE_LOWEST`         | `"IGNORE #LOWEST"`        | Already in the winning position                  |
| `IGNORE_SISTER_LOWEST`  | `"IGNORE #SISTER_LOWEST"` | A sister or simulated-sister holds the position  |
| `IGNORE_SETTINGS`       | `"IGNORE #SETTINGS"`      | Blocked by a vendor setting (up/down, keep_position, threshold, etc.) |
| `IGNORE_SHORT_EXPIRY`   | `"IGNORE #SHORT_EXPIRY"`  | Product has short expiry (promoAddlDescr contains EXP) |
| `ERROR`                 | `"ERROR"`                 | Unexpected state -- should never happen          |

---

## Scenario Summary Table

| #  | File name                              | AlgoResult               | Key setting / condition                     |
| -- | -------------------------------------- | ------------------------ | ------------------------------------------- |
| 01 | `01-no-competitor.json`                | `CHANGE #UP`             | No competitors, push to max                 |
| 02 | `02-own-lowest.json`                   | `IGNORE #LOWEST`         | Own vendor cheapest, direction=DOWN          |
| 03 | `03-hit-floor.json`                    | `IGNORE #FLOOR`          | Competitor below floor                       |
| 04 | `04-sister-lowest.json`                | `IGNORE #SISTER_LOWEST`  | Sister vendor at rank 0                      |
| 05 | `05-rule-only-up.json`                 | `IGNORE #SETTINGS`       | up_down=UP, would need to go down            |
| 06 | `06-rule-only-down.json`               | `IGNORE #LOWEST`         | up_down=DOWN, already winning                |
| 07 | `07-keep-position.json`                | `IGNORE #SETTINGS`       | keep_position=true                           |
| 08 | `08-own-vendor-low-inventory.json`     | `IGNORE #SETTINGS`       | own_vendor_threshold > inventory             |
| 09 | `09-floor-compete-with-next-off.json`  | `IGNORE #FLOOR`          | floor_compete_with_next=false                |
| 10 | `10-short-expiry.json`                 | `IGNORE #SHORT_EXPIRY`   | promoAddlDescr contains "EXP"               |
| 11 | `11-undercut-competitor.json`          | `CHANGE #DOWN`           | Basic penny undercut                         |
| 12 | `12-floor-compete-with-next.json`      | `CHANGE #DOWN`           | floor_compete_with_next=true, skip 1st       |
| 13 | `13-price-up-to-max.json`              | `IGNORE #FLOOR`          | All competitors below floor                  |
| 14 | `14-new-price-break.json`              | `CHANGE #NEW`            | No existing Q1 break                         |
| 15 | `15-price-up.json`                     | `CHANGE #UP`             | Own vendor cheapest, prices up               |
| 16 | `16-badge-vs-no-badge-unit.json`       | `CHANGE #DOWN`           | Badge competitor, UNIT strategy              |
| 17 | `17-max-price-cap.json`                | `CHANGE #UP`             | Competitor above max, capped                 |
| 18 | `18-suppress-price-break.json`         | `CHANGE #DOWN`           | suppress_price_break=true, Q1 unaffected     |
| 19 | `19-compete-on-price-break-only.json`  | `IGNORE #SETTINGS`       | compete_on_price_break_only=true             |
| 20 | `20-multiple-competitors.json`         | `CHANGE #DOWN`           | Undercut cheapest of three                   |
| 21 | `21-slow-cron-overrides.json`          | `CHANGE #DOWN`           | isSlowCron bypasses up_down                  |
| 22 | `22-handling-time-filter.json`         | `CHANGE #DOWN`           | handling_time_group=FAST_SHIPPING            |
| 23 | `23-exclude-vendor.json`               | `CHANGE #DOWN`           | exclude_vendors filters cheapest             |
| 24 | `24-inventory-threshold-filter.json`   | `CHANGE #DOWN`           | inventory_competition_threshold filter       |
| 25 | `25-same-price-already-winning.json`   | `IGNORE #LOWEST`         | Same price + rank 0                          |
| 26 | `26-badge-indicator-badge-only.json`   | `CHANGE #DOWN`           | badge_indicator=BADGE                        |
| 27 | `27-simulated-sister-vendor.json`      | `IGNORE #SISTER_LOWEST`  | sister_vendor_ids contains competitor         |
| 28 | `28-down-percentage.json`              | `CHANGE #DOWN`           | reprice_down_percentage=5                    |
| 29 | `29-compete-with-all-vendors.json`     | `CHANGE #DOWN`           | compete_with_all_vendors=true                |
| 30 | `30-vendor-blocked-422.json`           | `NO_RESULT`              | Vendor not in nonBlocked422VendorIds         |

---

## Important Implementation Notes

1. **`repriceProductV2` is a pure function.** It takes all inputs as arguments
   and returns results synchronously. No database calls, no network calls.
   This is what makes golden-file testing possible without mocks.

2. **The function signature:**
   ```ts
   repriceProductV2(
     mpId: number,
     rawNet32Products: Net32AlgoProduct[],
     non422VendorIds: number[],
     allOwnVendorIds: number[],
     vendorSettings: V2AlgoSettingsData[],
     jobId: string,
     isSlowCron: boolean,
     net32url: string,
     vendorThresholds: VendorThreshold[],
   )
   ```

3. **Vendor IDs that matter:**
   - `17357` = Tradent
   - `20722` = Frontier
   - `20755` = MVP
   - `20727` = TopDent
   - `20533` = FirstDent
   - `5` = Triad
   - `10` = BiteSupply

4. **Price strategy differences:**
   - `UNIT` -- compares unit prices directly
   - `TOTAL` -- compares total cost (unit price * qty + shipping if below threshold)
   - `BUY_BOX` -- applies badge, shipping bucket, and penny undercut rules

   Most scenarios above use `UNIT` for simplicity. Add `TOTAL` and `BUY_BOX`
   scenarios as needed for full coverage.

5. **The `freeShippingThreshold` field** on `Net32AlgoProduct` is critical for
   TOTAL and BUY_BOX strategies. It determines whether shipping cost is added
   to the total. Set it consistently across all products in a scenario.

6. **Expected prices may need adjustment** after running the tests for the
   first time against the real algorithm. The values in this document are based
   on careful reading of the algorithm source, but rounding edge cases may
   cause small differences. Run the tests, inspect actual values, and update
   fixtures accordingly.
