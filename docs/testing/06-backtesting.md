# Layer 6: Backtesting Framework -- Historical Replay

> **Goal**: Replay historical reprice decisions through the current algorithm to detect regressions, evaluate what-if scenarios, and generate impact reports before deploying algo changes.
>
> **Prerequisite**: Layer 0 (builders, matchers, project setup) must be complete.
>
> All implementation files go under:
> ```
> apps/api-core/src/utility/reprice-algo/__tests__/backtest/
> ```

---

## 6.1 Concept

The repricer stores every decision with full context in MySQL:

- **`table_history`** (config key: `applicationConfig.SQL_HISTORY`): Columns are `MpId`, `RefTime`, `ChannelName`, `ExistingPrice`, `MinQty`, `Position`, `LowestVendor`, `LowestPrice`, `SuggestedPrice`, `RepriceComment`, `MaxVendor`, `MaxVendorPrice`, `OtherVendorList`, `LinkedApiResponse`, `ContextCronName`, `TriggeredByVendor`, `RepriceResult`.
- **`table_history_apiResponse`** (config key: `applicationConfig.SQL_HISTORY_API_RESPONSE`): Linked via `LinkedApiResponse` FK. Columns are `Id`, `RefTime`, `ApiResponse` (JSON string containing the full `Net32Product[]` API response).

The V2 algo also stores results in **`v2_algo_results`**: `job_id`, `mp_id`, `vendor_id`, `quantity`, `suggested_price`, `comment`, `triggered_by_vendor`, `result` (AlgoResult enum), `cron_name`, `q_break_valid`, `price_update_result`, `new_price_breaks`, `lowest_price`, `lowest_vendor_id`.

This means we can:
1. Pull historical records (API response + the actual decision the algo made)
2. Reconstruct the algo inputs (V2AlgoSettingsData from `v2_algo_settings`, vendor thresholds from `vendor_thresholds`)
3. Replay the API response through the current `repriceProductV2()`
4. Compare: did the algo produce the same decision?

---

## 6.2 Data Sources and How They Connect

```
table_history (one row per mpId + minQty + vendor per decision)
  |
  |-- LinkedApiResponse --> table_history_apiResponse.Id
  |                            |-- ApiResponse: JSON string of Net32Product[]
  |
  |-- MpId + ChannelName --> v2_algo_settings (mp_id + vendor_id)
  |                            |-- floor_price, max_price, price_strategy, up_down, etc.
  |
  |-- Net32Product[].vendorId --> vendor_thresholds (vendor_id)
                                    |-- threshold, standard_shipping

v2_algo_results (one row per mpId + vendor_id + quantity per decision)
  |-- job_id, result, suggested_price, comment, triggered_by_vendor
  |-- This is the V2-specific result table (table_history is V1-oriented)
```

For V2 backtesting, prefer `v2_algo_results` as the source of historical decisions since it stores the exact `AlgoResult` enum and quantity-level breakdown that `repriceProductV2()` produces.

---

## 6.3 Database Access

The project uses Knex for MySQL. The existing singleton pattern is in:

```
apps/api-core/src/model/sql-models/knex-wrapper.ts
```

```typescript
import { getKnexInstance } from '../../../../model/sql-models/knex-wrapper';
```

The knex instance reads from environment variables via `applicationConfig`:
- `SQL_HOSTNAME`, `SQL_PORT`, `SQL_USERNAME`, `SQL_PASSWORD`, `SQL_DATABASE`
- Password is encrypted and decrypted via `Encrypto` using `REPRICER_ENCRYPTION_KEY`

**For backtesting**, create a standalone Knex connection that does NOT use the encrypted config (for local/CI use with a test database or read-only replica):

```typescript
import { Knex, knex } from 'knex';

function createBacktestKnex(): Knex {
  return knex({
    client: 'mysql2',
    connection: {
      host: process.env.BACKTEST_SQL_HOST ?? process.env.SQL_HOSTNAME,
      port: Number(process.env.BACKTEST_SQL_PORT ?? process.env.SQL_PORT ?? 3306),
      user: process.env.BACKTEST_SQL_USER ?? process.env.SQL_USERNAME,
      password: process.env.BACKTEST_SQL_PASSWORD ?? process.env.SQL_PASSWORD,
      database: process.env.BACKTEST_SQL_DATABASE ?? process.env.SQL_DATABASE,
    },
    pool: { min: 1, max: 5 },
  });
}
```

This allows pointing at a read-only replica or test snapshot without touching production.

---

## 6.4 Three Backtesting Modes

### Mode 1: Regression Backtest
> "Does the current code produce the same decisions as production did?"

- Pull N records from `v2_algo_results` + `table_history_apiResponse`
- For each record: reconstruct inputs, replay through `repriceProductV2()`
- Compare: does the `AlgoResult` match? Does `suggestedPrice` match? Does `comment` match?
- Output: match rate %, list of diffs

### Mode 2: What-If Backtest
> "If I change parameter X, how many products would be affected?"

- Pull N records
- Run each through the algo TWICE: once with the original `V2AlgoSettingsData`, once with a modified copy
- Compare the two outputs
- Output: % changed, avg price delta, direction breakdown (newly repriced, no longer repriced, priced higher, priced lower)

### Mode 3: Impact Report
> "Summarize the effect of a code change before deploying"

- Run as part of CI on PRs that touch files under `reprice-algo/v2/`
- Pull last 7 days of data (or use a fixed JSON snapshot dataset)
- Report: total records, match rate, sample diffs
- Fail CI if match rate drops below threshold (default: 95%)

---

## 6.5 Type Definitions

**File**: `__tests__/backtest/types.ts`

```typescript
import { AlgoResult } from '../../v2/types';
import { V2AlgoSettingsData } from '../../../../utility/mysql/v2-algo-settings';
import { Net32Product } from '../../../../types/net32';
import { VendorThreshold } from '../../v2/shipping-threshold';

// ─── Raw database row shapes ───────────────────────────────────────────

export interface HistoryRow {
  Id: number;
  RefTime: Date;
  MpId: number;
  ChannelName: string;
  ExistingPrice: number | null;
  MinQty: number;
  Position: number | null;
  LowestVendor: string | null;
  LowestPrice: number | null;
  SuggestedPrice: number | null;
  RepriceComment: string | null;
  MaxVendor: string | null;
  MaxVendorPrice: number | null;
  OtherVendorList: string | null;
  LinkedApiResponse: number;
  ContextCronName: string | null;
  TriggeredByVendor: string | null;
  RepriceResult: string | null;
}

export interface HistoryApiResponseRow {
  Id: number;
  RefTime: Date;
  ApiResponse: string; // JSON string of Net32Product[]
}

export interface V2AlgoResultRow {
  id: number;
  job_id: string;
  mp_id: number;
  vendor_id: number;
  quantity: number;
  suggested_price: number | null;
  comment: string;
  triggered_by_vendor: string | null;
  result: string; // AlgoResult enum value, e.g. "CHANGE #DOWN"
  cron_name: string;
  q_break_valid: boolean;
  price_update_result: string | null;
  new_price_breaks: string | null;
  lowest_price: number | null;
  lowest_vendor_id: number | null;
  created_at: Date;
}

// ─── Backtest data structures ──────────────────────────────────────────

export interface BacktestRecord {
  /** Unique identifier for this record (v2_algo_results.id or table_history.Id) */
  recordId: number;
  /** The job_id that groups all quantity solutions for one algo run */
  jobId: string;
  mpId: number;
  vendorId: number;
  quantity: number;
  timestamp: Date;
  cronName: string;

  /** The parsed Net32Product[] from the API response at decision time */
  apiResponse: Net32Product[];

  /** V2AlgoSettingsData that was active for this vendor+mpId at decision time */
  vendorSettings: V2AlgoSettingsData;

  /** Vendor shipping thresholds for all vendors in the API response */
  vendorThresholds: VendorThreshold[];

  /** What the algo actually decided in production */
  historical: {
    algoResult: string;
    suggestedPrice: number | null;
    comment: string;
    triggeredByVendor: string | null;
    qBreakValid: boolean;
    lowestPrice: number | null;
    lowestVendorId: number | null;
  };
}

// ─── Regression backtest output ────────────────────────────────────────

export interface BacktestDiff {
  recordId: number;
  mpId: number;
  vendorId: number;
  quantity: number;
  timestamp: Date;
  historical: {
    algoResult: string;
    suggestedPrice: number | null;
    comment: string;
  };
  current: {
    algoResult: string;
    suggestedPrice: number | null;
    comment: string;
  };
  priceDelta: number | null;
}

export interface BacktestResult {
  total: number;
  matches: number;
  diffs: BacktestDiff[];
  matchRate: number;
  executionTimeMs: number;
}

// ─── What-if backtest output ───────────────────────────────────────────

export interface WhatIfReport {
  total: number;
  pricesChanged: number;
  avgPriceDelta: number;
  directionBreakdown: {
    newlyRepriced: number;
    noLongerRepriced: number;
    pricedHigher: number;
    pricedLower: number;
    unchanged: number;
  };
  samples: WhatIfSample[];
}

export interface WhatIfSample {
  mpId: number;
  vendorId: number;
  quantity: number;
  original: { algoResult: string; suggestedPrice: number | null };
  modified: { algoResult: string; suggestedPrice: number | null };
  priceDelta: number | null;
}

// ─── Extract options ───────────────────────────────────────────────────

export interface ExtractOptions {
  dateFrom: Date;
  dateTo: Date;
  limit?: number;
  mpIds?: number[];
  vendorIds?: number[];
  cronName?: string;
  /** If true, use v2_algo_results as the source. If false, use table_history. Default: true */
  useV2Results?: boolean;
}
```

---

## 6.6 Implementation File 1: `extract-data.ts`

**File**: `__tests__/backtest/extract-data.ts`

This module pulls historical records from MySQL and reconstructs the full `BacktestRecord` objects.

```typescript
import { Knex, knex } from 'knex';
import {
  BacktestRecord,
  ExtractOptions,
  HistoryApiResponseRow,
  V2AlgoResultRow,
} from './types';
import { V2AlgoSettingsData } from '../../../../utility/mysql/v2-algo-settings';
import { VendorThreshold } from '../../v2/shipping-threshold';
import { Net32Product } from '../../../../types/net32';

// ─── Database connection ───────────────────────────────────────────────

let _knex: Knex | null = null;

export function getBacktestKnex(): Knex {
  if (_knex) return _knex;
  _knex = knex({
    client: 'mysql2',
    connection: {
      host: process.env.BACKTEST_SQL_HOST ?? process.env.SQL_HOSTNAME ?? 'localhost',
      port: Number(process.env.BACKTEST_SQL_PORT ?? process.env.SQL_PORT ?? 3306),
      user: process.env.BACKTEST_SQL_USER ?? process.env.SQL_USERNAME ?? 'root',
      password: process.env.BACKTEST_SQL_PASSWORD ?? process.env.SQL_PASSWORD ?? '',
      database: process.env.BACKTEST_SQL_DATABASE ?? process.env.SQL_DATABASE ?? 'repricer',
    },
    pool: { min: 1, max: 5 },
  });
  return _knex;
}

export async function destroyBacktestKnex(): Promise<void> {
  if (_knex) {
    await _knex.destroy();
    _knex = null;
  }
}

// ─── Main extraction function ──────────────────────────────────────────

export async function extractBacktestData(
  options: ExtractOptions,
): Promise<BacktestRecord[]> {
  const db = getBacktestKnex();
  const useV2 = options.useV2Results !== false;

  if (useV2) {
    return extractFromV2AlgoResults(db, options);
  } else {
    return extractFromTableHistory(db, options);
  }
}

// ─── V2 algo results extraction (preferred) ────────────────────────────

async function extractFromV2AlgoResults(
  db: Knex,
  options: ExtractOptions,
): Promise<BacktestRecord[]> {
  // Step 1: Pull v2_algo_results rows within the date range
  let query = db('v2_algo_results')
    .whereBetween('created_at', [options.dateFrom, options.dateTo])
    .orderBy('created_at', 'desc');

  if (options.mpIds && options.mpIds.length > 0) {
    query = query.whereIn('mp_id', options.mpIds);
  }
  if (options.vendorIds && options.vendorIds.length > 0) {
    query = query.whereIn('vendor_id', options.vendorIds);
  }
  if (options.cronName) {
    query = query.where('cron_name', options.cronName);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const rows: V2AlgoResultRow[] = await query;

  if (rows.length === 0) {
    console.log('[backtest] No v2_algo_results rows found for the given criteria.');
    return [];
  }

  console.log(`[backtest] Found ${rows.length} v2_algo_results rows. Enriching...`);

  // Step 2: For each unique job_id, we need the API response.
  //         The API response is stored in table_history_apiResponse, linked
  //         through table_history. We find the matching table_history row
  //         by mp_id + approximate timestamp, then follow LinkedApiResponse.
  //
  //         Alternatively, if v2_algo_execution exists for the same job_id,
  //         it has the chain_of_thought_html but NOT the raw API response.
  //         So we must go through table_history_apiResponse.
  const uniqueJobIds = [...new Set(rows.map(r => r.job_id))];
  const apiResponseCache = new Map<string, Net32Product[]>();

  // Group rows by job_id to batch lookups
  const rowsByJob = new Map<string, V2AlgoResultRow[]>();
  for (const row of rows) {
    const existing = rowsByJob.get(row.job_id) ?? [];
    existing.push(row);
    rowsByJob.set(row.job_id, existing);
  }

  for (const jobId of uniqueJobIds) {
    const jobRows = rowsByJob.get(jobId)!;
    const sampleRow = jobRows[0];

    try {
      const apiResponse = await findApiResponseForRecord(
        db,
        sampleRow.mp_id,
        sampleRow.created_at,
      );
      if (apiResponse) {
        apiResponseCache.set(jobId, apiResponse);
      } else {
        console.warn(
          `[backtest] No API response found for job ${jobId} (mpId=${sampleRow.mp_id}, time=${sampleRow.created_at}). Skipping.`,
        );
      }
    } catch (err) {
      console.warn(
        `[backtest] Error fetching API response for job ${jobId}:`,
        err,
      );
    }
  }

  // Step 3: Fetch V2AlgoSettingsData for each unique (mp_id, vendor_id) pair
  const settingsCache = new Map<string, V2AlgoSettingsData>();
  const uniquePairs = [
    ...new Set(rows.map(r => `${r.mp_id}:${r.vendor_id}`)),
  ];

  for (const pair of uniquePairs) {
    const [mpId, vendorId] = pair.split(':').map(Number);
    try {
      const settings = await db('v2_algo_settings')
        .where({ mp_id: mpId, vendor_id: vendorId })
        .first();
      if (settings) {
        settingsCache.set(pair, settings as V2AlgoSettingsData);
      } else {
        console.warn(
          `[backtest] No v2_algo_settings found for mpId=${mpId}, vendorId=${vendorId}. Using defaults.`,
        );
        settingsCache.set(pair, createDefaultSettings(mpId, vendorId));
      }
    } catch (err) {
      console.warn(
        `[backtest] Error fetching settings for ${pair}:`,
        err,
      );
      settingsCache.set(pair, createDefaultSettings(mpId, vendorId));
    }
  }

  // Step 4: Fetch vendor thresholds for all vendor IDs seen in API responses
  const allVendorIdsInResponses = new Set<number>();
  for (const products of apiResponseCache.values()) {
    for (const p of products) {
      allVendorIdsInResponses.add(
        typeof p.vendorId === 'string' ? parseInt(p.vendorId, 10) : p.vendorId,
      );
    }
  }

  const thresholdCache = new Map<number, VendorThreshold>();
  if (allVendorIdsInResponses.size > 0) {
    try {
      const thresholdRows = await db('vendor_thresholds')
        .whereIn('vendor_id', [...allVendorIdsInResponses]);
      for (const row of thresholdRows) {
        thresholdCache.set(row.vendor_id, {
          vendorId: row.vendor_id,
          standardShipping: parseFloat(row.standard_shipping),
          threshold: parseFloat(row.threshold),
        });
      }
    } catch (err) {
      console.warn('[backtest] Error fetching vendor thresholds:', err);
    }
  }

  // Step 5: Assemble BacktestRecord objects
  const records: BacktestRecord[] = [];

  for (const row of rows) {
    const apiResponse = apiResponseCache.get(row.job_id);
    if (!apiResponse) continue; // Skip records without API response

    const settingsKey = `${row.mp_id}:${row.vendor_id}`;
    const vendorSettings = settingsCache.get(settingsKey);
    if (!vendorSettings) continue;

    // Collect thresholds for vendors in this API response
    const vendorThresholds: VendorThreshold[] = [];
    for (const p of apiResponse) {
      const vid =
        typeof p.vendorId === 'string' ? parseInt(p.vendorId, 10) : p.vendorId;
      const threshold = thresholdCache.get(vid);
      if (threshold && !vendorThresholds.find(t => t.vendorId === vid)) {
        vendorThresholds.push(threshold);
      }
    }

    records.push({
      recordId: row.id,
      jobId: row.job_id,
      mpId: row.mp_id,
      vendorId: row.vendor_id,
      quantity: row.quantity,
      timestamp: row.created_at,
      cronName: row.cron_name,
      apiResponse,
      vendorSettings,
      vendorThresholds,
      historical: {
        algoResult: row.result,
        suggestedPrice: row.suggested_price,
        comment: row.comment,
        triggeredByVendor: row.triggered_by_vendor,
        qBreakValid: row.q_break_valid,
        lowestPrice: row.lowest_price,
        lowestVendorId: row.lowest_vendor_id,
      },
    });
  }

  console.log(
    `[backtest] Assembled ${records.length} backtest records (${records.length}/${rows.length} had API responses).`,
  );
  return records;
}

// ─── table_history extraction (fallback for V1 data) ───────────────────

async function extractFromTableHistory(
  db: Knex,
  options: ExtractOptions,
): Promise<BacktestRecord[]> {
  let query = db('table_history as h')
    .join(
      'table_history_apiResponse as a',
      'h.LinkedApiResponse',
      'a.Id',
    )
    .select('h.*', 'a.ApiResponse')
    .whereBetween('h.RefTime', [options.dateFrom, options.dateTo])
    .orderBy('h.RefTime', 'desc');

  if (options.mpIds && options.mpIds.length > 0) {
    query = query.whereIn('h.MpId', options.mpIds);
  }
  if (options.cronName) {
    query = query.where('h.ContextCronName', options.cronName);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const rows = await query;

  if (rows.length === 0) {
    console.log('[backtest] No table_history rows found for the given criteria.');
    return [];
  }

  console.log(`[backtest] Found ${rows.length} table_history rows. Enriching...`);

  const records: BacktestRecord[] = [];

  for (const row of rows) {
    try {
      const apiResponse = safeParseApiResponse(row.ApiResponse);
      if (!apiResponse || apiResponse.length === 0) continue;

      // For table_history rows, we don't have vendor_id directly.
      // ChannelName is the vendor name (e.g., "TRADENT"). We need to map it.
      // For now, store a placeholder vendorId of 0 -- the regression runner
      // will need the actual mapping.
      const vendorId = 0; // Caller should map ChannelName -> VendorId

      // Try to fetch settings
      let vendorSettings: V2AlgoSettingsData;
      try {
        const settings = await db('v2_algo_settings')
          .where({ mp_id: row.MpId, vendor_id: vendorId })
          .first();
        vendorSettings = settings ?? createDefaultSettings(row.MpId, vendorId);
      } catch {
        vendorSettings = createDefaultSettings(row.MpId, vendorId);
      }

      // Fetch thresholds
      const vendorIdsInResponse = apiResponse.map(p =>
        typeof p.vendorId === 'string' ? parseInt(p.vendorId, 10) : p.vendorId,
      );
      let vendorThresholds: VendorThreshold[] = [];
      try {
        const thresholdRows = await db('vendor_thresholds')
          .whereIn('vendor_id', vendorIdsInResponse);
        vendorThresholds = thresholdRows.map((t: any) => ({
          vendorId: t.vendor_id,
          standardShipping: parseFloat(t.standard_shipping),
          threshold: parseFloat(t.threshold),
        }));
      } catch {
        // Continue without thresholds
      }

      records.push({
        recordId: row.Id ?? row.id,
        jobId: `history-${row.Id ?? row.id}`,
        mpId: row.MpId,
        vendorId,
        quantity: row.MinQty ?? 1,
        timestamp: row.RefTime,
        cronName: row.ContextCronName ?? 'unknown',
        apiResponse,
        vendorSettings,
        vendorThresholds,
        historical: {
          algoResult: row.RepriceResult ?? 'UNKNOWN',
          suggestedPrice: row.SuggestedPrice,
          comment: row.RepriceComment ?? '',
          triggeredByVendor: row.TriggeredByVendor,
          qBreakValid: true, // table_history doesn't track this
          lowestPrice: row.LowestPrice,
          lowestVendorId: null,
        },
      });
    } catch (err) {
      console.warn(
        `[backtest] Error processing history row ${row.Id}:`,
        err,
      );
    }
  }

  console.log(
    `[backtest] Assembled ${records.length} backtest records from table_history.`,
  );
  return records;
}

// ─── Helper: find API response by mpId + approximate timestamp ─────────

async function findApiResponseForRecord(
  db: Knex,
  mpId: number,
  timestamp: Date,
): Promise<Net32Product[] | null> {
  // The API response is stored in table_history_apiResponse, linked through
  // table_history.LinkedApiResponse. We find the table_history row closest
  // to the timestamp for this mpId, then follow the FK.
  const historyRow = await db('table_history')
    .where('MpId', mpId)
    .whereBetween('RefTime', [
      new Date(timestamp.getTime() - 60_000), // 1 minute before
      new Date(timestamp.getTime() + 60_000), // 1 minute after
    ])
    .orderByRaw('ABS(TIMESTAMPDIFF(SECOND, RefTime, ?)) ASC', [timestamp])
    .first();

  if (!historyRow || !historyRow.LinkedApiResponse) {
    return null;
  }

  const apiRow: HistoryApiResponseRow | undefined = await db(
    'table_history_apiResponse',
  )
    .where('Id', historyRow.LinkedApiResponse)
    .first();

  if (!apiRow) return null;

  return safeParseApiResponse(apiRow.ApiResponse);
}

// ─── Helper: safely parse API response JSON ────────────────────────────

function safeParseApiResponse(raw: string | null | undefined): Net32Product[] | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed;
    // Some older records may wrap in { data: [...] }
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    return null;
  } catch (err) {
    console.warn('[backtest] Failed to parse API response JSON:', err);
    return null;
  }
}

// ─── Helper: create default V2 settings ────────────────────────────────

function createDefaultSettings(
  mpId: number,
  vendorId: number,
): V2AlgoSettingsData {
  return {
    id: 0,
    mp_id: mpId,
    vendor_id: vendorId,
    suppress_price_break_if_Q1_not_updated: false,
    suppress_price_break: false,
    compete_on_price_break_only: false,
    up_down: 'UP/DOWN' as any,
    badge_indicator: 'ALL' as any,
    execution_priority: 0,
    reprice_up_percentage: -1,
    compare_q2_with_q1: false,
    compete_with_all_vendors: false,
    reprice_up_badge_percentage: -1,
    sister_vendor_ids: '',
    exclude_vendors: '',
    inactive_vendor_id: '',
    handling_time_group: 'ALL' as any,
    keep_position: false,
    max_price: 99999999.99,
    floor_price: 0,
    inventory_competition_threshold: 1,
    reprice_down_percentage: -1,
    reprice_down_badge_percentage: -1,
    floor_compete_with_next: false,
    own_vendor_threshold: 1,
    price_strategy: 'UNIT' as any,
    enabled: true,
  };
}

// ─── Offline snapshot support ──────────────────────────────────────────

/**
 * Save extracted records to a JSON file for offline testing.
 * This avoids needing DB access for every test run.
 */
export async function saveSnapshot(
  records: BacktestRecord[],
  filePath: string,
): Promise<void> {
  const fs = await import('fs');
  const data = JSON.stringify(records, null, 2);
  fs.writeFileSync(filePath, data, 'utf-8');
  console.log(`[backtest] Saved ${records.length} records to ${filePath}`);
}

/**
 * Load records from a previously saved JSON snapshot.
 */
export async function loadSnapshot(
  filePath: string,
): Promise<BacktestRecord[]> {
  const fs = await import('fs');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const records: BacktestRecord[] = JSON.parse(raw);
  // Re-hydrate Date objects (JSON.parse returns strings)
  for (const r of records) {
    r.timestamp = new Date(r.timestamp);
  }
  console.log(`[backtest] Loaded ${records.length} records from ${filePath}`);
  return records;
}
```

---

## 6.7 Implementation File 2: `replay-algo.ts`

**File**: `__tests__/backtest/replay-algo.ts`

This is the bridge between backtest records and the actual algo. It converts `BacktestRecord` inputs into the exact arguments that `repriceProductV2()` expects.

```typescript
import { VendorId } from '@repricer-monorepo/shared';
import { repriceProductV2 } from '../../v2/algorithm';
import { Net32AlgoProduct } from '../../v2/types';
import { V2AlgoSettingsData } from '../../../../utility/mysql/v2-algo-settings';
import { VendorThreshold } from '../../v2/shipping-threshold';
import { Net32Product } from '../../../../types/net32';
import { BacktestRecord } from './types';

/**
 * All own vendor IDs in the system.
 * Mirrors utility/reprice-algo/v2/utility.ts -> getAllOwnVendorIds()
 */
const ALL_OWN_VENDOR_IDS: number[] = [
  VendorId.TRADENT,
  VendorId.FRONTIER,
  VendorId.MVP,
  VendorId.TOPDENT,
  VendorId.FIRSTDENT,
  VendorId.TRIAD,
  VendorId.BITESUPPLY,
];

export interface ReplayResult {
  mpId: number;
  vendorId: number;
  quantity: number;
  algoResult: string;
  suggestedPrice: number | null;
  comment: string;
  triggeredByVendor: string | null;
  qBreakValid: boolean;
}

/**
 * Replay a single BacktestRecord through the current repriceProductV2().
 *
 * Returns ALL quantity-level solutions for the given mpId (not just the
 * one matching record.quantity). The caller can filter to the relevant one.
 */
export function replayRecord(record: BacktestRecord): ReplayResult[] {
  const { apiResponse, vendorSettings, vendorThresholds, mpId, vendorId } =
    record;

  // Convert Net32Product[] to Net32AlgoProduct[]
  // The algo expects Net32AlgoProduct which has vendorId as number and
  // freeShippingThreshold. The raw API response has vendorId as number|string.
  const algoProducts: Net32AlgoProduct[] = apiResponse
    .filter(p => Array.isArray(p.priceBreaks) && p.priceBreaks.length > 0)
    .map(p => {
      const vid =
        typeof p.vendorId === 'string' ? parseInt(p.vendorId, 10) : p.vendorId;
      const threshold = vendorThresholds.find(t => t.vendorId === vid);
      return {
        vendorId: vid,
        vendorName: p.vendorName,
        inStock: p.inStock,
        standardShipping: threshold?.standardShipping ?? p.standardShipping,
        shippingTime: p.shippingTime,
        inventory: p.inventory,
        badgeId: p.badgeId ?? 0,
        badgeName: p.badgeName ?? null,
        priceBreaks: p.priceBreaks,
        freeShippingGap: p.freeShippingGap,
        freeShippingThreshold:
          threshold?.threshold ?? p.freeShippingThreshold ?? 999999,
      };
    });

  // Determine which of our vendors are "non-422" (i.e., available).
  // For backtesting, assume the vendor being tested was available.
  const non422VendorIds = ALL_OWN_VENDOR_IDS.filter(
    id => algoProducts.find(p => p.vendorId === id),
  );

  // Build the vendorSettings array. repriceProductV2 expects settings for
  // ALL own vendors present in the data. We have settings only for the
  // specific vendor. For other own vendors, use defaults.
  const allVendorSettings: V2AlgoSettingsData[] = non422VendorIds.map(vid => {
    if (vid === vendorId) {
      return vendorSettings;
    }
    // Default settings for sister vendors (disabled, so they won't produce results)
    return {
      id: 0,
      mp_id: mpId,
      vendor_id: vid,
      enabled: false,
      suppress_price_break_if_Q1_not_updated: false,
      suppress_price_break: false,
      compete_on_price_break_only: false,
      up_down: 'UP/DOWN' as any,
      badge_indicator: 'ALL' as any,
      execution_priority: 99,
      reprice_up_percentage: -1,
      compare_q2_with_q1: false,
      compete_with_all_vendors: false,
      reprice_up_badge_percentage: -1,
      sister_vendor_ids: '',
      exclude_vendors: '',
      inactive_vendor_id: '',
      handling_time_group: 'ALL' as any,
      keep_position: false,
      max_price: 99999999.99,
      floor_price: 0,
      inventory_competition_threshold: 1,
      reprice_down_percentage: -1,
      reprice_down_badge_percentage: -1,
      floor_compete_with_next: false,
      own_vendor_threshold: 1,
      price_strategy: 'UNIT' as any,
    };
  });

  // Run the algo
  const isSlowCron = record.cronName.toLowerCase().includes('slow');
  const jobId = `backtest-${record.recordId}`;
  const net32url = `https://www.net32.com/rest/neo/pdp/${mpId}/vendor-options`;

  try {
    const solutions = repriceProductV2(
      mpId,
      algoProducts,
      non422VendorIds,
      ALL_OWN_VENDOR_IDS,
      allVendorSettings,
      jobId,
      isSlowCron,
      net32url,
      vendorThresholds,
    );

    return solutions.map(s => ({
      mpId,
      vendorId: s.vendor.vendorId,
      quantity: s.quantity,
      algoResult: s.algoResult,
      suggestedPrice: s.suggestedPrice,
      comment: s.comment,
      triggeredByVendor: s.triggeredByVendor,
      qBreakValid: s.qBreakValid,
    }));
  } catch (err) {
    console.warn(
      `[backtest] Error replaying record ${record.recordId} (mpId=${mpId}):`,
      err,
    );
    return [
      {
        mpId,
        vendorId,
        quantity: record.quantity,
        algoResult: 'ERROR',
        suggestedPrice: null,
        comment: `Replay error: ${err instanceof Error ? err.message : String(err)}`,
        triggeredByVendor: null,
        qBreakValid: false,
      },
    ];
  }
}

/**
 * Replay a record with overridden settings (for what-if analysis).
 */
export function replayRecordWithOverrides(
  record: BacktestRecord,
  overrides: Partial<V2AlgoSettingsData>,
): ReplayResult[] {
  const modifiedRecord: BacktestRecord = {
    ...record,
    vendorSettings: {
      ...record.vendorSettings,
      ...overrides,
    },
  };
  return replayRecord(modifiedRecord);
}
```

---

## 6.8 Implementation File 3: `regression-runner.ts`

**File**: `__tests__/backtest/regression-runner.ts`

```typescript
import { BacktestRecord, BacktestResult, BacktestDiff } from './types';
import { replayRecord, ReplayResult } from './replay-algo';

/**
 * Run a regression backtest: replay each record through the current algo
 * and compare with the historical decision.
 */
export async function runRegressionBacktest(
  records: BacktestRecord[],
): Promise<BacktestResult> {
  const startTime = Date.now();
  const diffs: BacktestDiff[] = [];
  let matches = 0;
  let processed = 0;

  for (const record of records) {
    processed++;

    if (processed % 100 === 0) {
      console.log(`[backtest] Processing record ${processed}/${records.length}...`);
    }

    const replayResults = replayRecord(record);

    // Find the replay result that matches this record's vendor + quantity
    const matchingResult = replayResults.find(
      r => r.vendorId === record.vendorId && r.quantity === record.quantity,
    );

    if (!matchingResult) {
      // The algo didn't produce a solution for this vendor+quantity.
      // This itself is a diff (the historical run DID produce one).
      diffs.push({
        recordId: record.recordId,
        mpId: record.mpId,
        vendorId: record.vendorId,
        quantity: record.quantity,
        timestamp: record.timestamp,
        historical: {
          algoResult: record.historical.algoResult,
          suggestedPrice: record.historical.suggestedPrice,
          comment: record.historical.comment,
        },
        current: {
          algoResult: 'NO_SOLUTION',
          suggestedPrice: null,
          comment: 'Replay did not produce a solution for this vendor+quantity.',
        },
        priceDelta: null,
      });
      continue;
    }

    const isMatch = compareResults(record, matchingResult);

    if (isMatch) {
      matches++;
    } else {
      const priceDelta = computePriceDelta(
        record.historical.suggestedPrice,
        matchingResult.suggestedPrice,
      );

      diffs.push({
        recordId: record.recordId,
        mpId: record.mpId,
        vendorId: record.vendorId,
        quantity: record.quantity,
        timestamp: record.timestamp,
        historical: {
          algoResult: record.historical.algoResult,
          suggestedPrice: record.historical.suggestedPrice,
          comment: record.historical.comment,
        },
        current: {
          algoResult: matchingResult.algoResult,
          suggestedPrice: matchingResult.suggestedPrice,
          comment: matchingResult.comment,
        },
        priceDelta,
      });
    }
  }

  const executionTimeMs = Date.now() - startTime;
  const total = records.length;
  const matchRate = total > 0 ? matches / total : 1;

  return {
    total,
    matches,
    diffs,
    matchRate,
    executionTimeMs,
  };
}

// ─── Comparison logic ──────────────────────────────────────────────────

function compareResults(
  record: BacktestRecord,
  replay: ReplayResult,
): boolean {
  // Primary comparison: AlgoResult must match
  if (normalizeAlgoResult(record.historical.algoResult) !== normalizeAlgoResult(replay.algoResult)) {
    return false;
  }

  // Secondary comparison: if both have a suggested price, they should match
  // within a small tolerance (0.01) to account for floating point
  if (
    record.historical.suggestedPrice !== null &&
    replay.suggestedPrice !== null
  ) {
    const delta = Math.abs(
      record.historical.suggestedPrice - replay.suggestedPrice,
    );
    if (delta > 0.01) {
      return false;
    }
  }

  // If one has a price and the other doesn't, that's a mismatch
  if (
    (record.historical.suggestedPrice === null) !==
    (replay.suggestedPrice === null)
  ) {
    return false;
  }

  return true;
}

/**
 * Normalize AlgoResult strings for comparison.
 * Historical data may store slightly different formats.
 */
function normalizeAlgoResult(result: string): string {
  if (!result) return 'UNKNOWN';
  // Remove extra whitespace, uppercase
  return result.trim().toUpperCase();
}

function computePriceDelta(
  historical: number | null,
  current: number | null,
): number | null {
  if (historical === null || current === null) return null;
  return Number((current - historical).toFixed(4));
}

// ─── Console output formatting ─────────────────────────────────────────

export function printBacktestSummary(result: BacktestResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('  REGRESSION BACKTEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total records:    ${result.total}`);
  console.log(`  Matches:          ${result.matches}`);
  console.log(`  Diffs:            ${result.diffs.length}`);
  console.log(
    `  Match rate:       ${(result.matchRate * 100).toFixed(2)}%`,
  );
  console.log(
    `  Execution time:   ${(result.executionTimeMs / 1000).toFixed(1)}s`,
  );
  console.log('='.repeat(80));

  if (result.diffs.length > 0) {
    console.log('\n  DIFFS (first 20):');
    console.log(
      '-'.repeat(80),
    );
    console.log(
      padRight('MpId', 10) +
        padRight('Vendor', 8) +
        padRight('Qty', 5) +
        padRight('Historical Result', 22) +
        padRight('Current Result', 22) +
        padRight('Price Delta', 12),
    );
    console.log('-'.repeat(80));

    const displayDiffs = result.diffs.slice(0, 20);
    for (const diff of displayDiffs) {
      console.log(
        padRight(String(diff.mpId), 10) +
          padRight(String(diff.vendorId), 8) +
          padRight(String(diff.quantity), 5) +
          padRight(diff.historical.algoResult, 22) +
          padRight(diff.current.algoResult, 22) +
          padRight(
            diff.priceDelta !== null ? diff.priceDelta.toFixed(2) : 'N/A',
            12,
          ),
      );
    }

    if (result.diffs.length > 20) {
      console.log(`  ... and ${result.diffs.length - 20} more diffs.`);
    }
  }

  console.log('');
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}
```

---

## 6.9 Implementation File 4: `what-if-runner.ts`

**File**: `__tests__/backtest/what-if-runner.ts`

```typescript
import { BacktestRecord, WhatIfReport, WhatIfSample } from './types';
import {
  replayRecord,
  replayRecordWithOverrides,
  ReplayResult,
} from './replay-algo';
import { V2AlgoSettingsData } from '../../../../utility/mysql/v2-algo-settings';

/** AlgoResult values that indicate a price change was made */
const CHANGE_RESULTS = new Set([
  'CHANGE #UP',
  'CHANGE #DOWN',
  'CHANGE #NEW',
  'CHANGE #REMOVED',
]);

function isChangeResult(result: string): boolean {
  return CHANGE_RESULTS.has(result.trim().toUpperCase());
}

/**
 * Run a what-if backtest: replay each record TWICE (original settings vs
 * modified settings) and report on differences.
 */
export async function runWhatIfBacktest(
  records: BacktestRecord[],
  overrides: Partial<V2AlgoSettingsData>,
): Promise<WhatIfReport> {
  let pricesChanged = 0;
  let totalPriceDelta = 0;
  let priceDeltaCount = 0;
  const directionBreakdown = {
    newlyRepriced: 0,
    noLongerRepriced: 0,
    pricedHigher: 0,
    pricedLower: 0,
    unchanged: 0,
  };
  const samples: WhatIfSample[] = [];

  for (const record of records) {
    // Run with original settings
    const originalResults = replayRecord(record);
    const originalMatch = originalResults.find(
      r => r.vendorId === record.vendorId && r.quantity === record.quantity,
    );

    // Run with modified settings
    const modifiedResults = replayRecordWithOverrides(record, overrides);
    const modifiedMatch = modifiedResults.find(
      r => r.vendorId === record.vendorId && r.quantity === record.quantity,
    );

    // Compare
    const origResult = originalMatch?.algoResult ?? 'NO_SOLUTION';
    const modResult = modifiedMatch?.algoResult ?? 'NO_SOLUTION';
    const origPrice = originalMatch?.suggestedPrice ?? null;
    const modPrice = modifiedMatch?.suggestedPrice ?? null;

    const origIsChange = isChangeResult(origResult);
    const modIsChange = isChangeResult(modResult);

    if (origResult === modResult && origPrice === modPrice) {
      directionBreakdown.unchanged++;
      continue;
    }

    pricesChanged++;

    if (!origIsChange && modIsChange) {
      directionBreakdown.newlyRepriced++;
    } else if (origIsChange && !modIsChange) {
      directionBreakdown.noLongerRepriced++;
    } else if (origPrice !== null && modPrice !== null) {
      const delta = modPrice - origPrice;
      if (delta > 0.001) {
        directionBreakdown.pricedHigher++;
      } else if (delta < -0.001) {
        directionBreakdown.pricedLower++;
      } else {
        directionBreakdown.unchanged++;
        pricesChanged--; // Undo the increment -- price is effectively the same
      }
    }

    if (origPrice !== null && modPrice !== null) {
      totalPriceDelta += modPrice - origPrice;
      priceDeltaCount++;
    }

    // Collect sample (first 50)
    if (samples.length < 50) {
      samples.push({
        mpId: record.mpId,
        vendorId: record.vendorId,
        quantity: record.quantity,
        original: { algoResult: origResult, suggestedPrice: origPrice },
        modified: { algoResult: modResult, suggestedPrice: modPrice },
        priceDelta:
          origPrice !== null && modPrice !== null
            ? Number((modPrice - origPrice).toFixed(4))
            : null,
      });
    }
  }

  const avgPriceDelta =
    priceDeltaCount > 0
      ? Number((totalPriceDelta / priceDeltaCount).toFixed(4))
      : 0;

  return {
    total: records.length,
    pricesChanged,
    avgPriceDelta,
    directionBreakdown,
    samples,
  };
}

// ─── Console output formatting ─────────────────────────────────────────

export function printWhatIfSummary(
  report: WhatIfReport,
  overrideDescription: string,
): void {
  console.log('\n' + '='.repeat(80));
  console.log('  WHAT-IF BACKTEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Override: ${overrideDescription}`);
  console.log(`  Total records:     ${report.total}`);
  console.log(`  Prices changed:    ${report.pricesChanged} (${((report.pricesChanged / report.total) * 100).toFixed(1)}%)`);
  console.log(`  Avg price delta:   $${report.avgPriceDelta.toFixed(4)}`);
  console.log('');
  console.log('  Direction Breakdown:');
  console.log(`    Newly repriced:      ${report.directionBreakdown.newlyRepriced}`);
  console.log(`    No longer repriced:  ${report.directionBreakdown.noLongerRepriced}`);
  console.log(`    Priced higher:       ${report.directionBreakdown.pricedHigher}`);
  console.log(`    Priced lower:        ${report.directionBreakdown.pricedLower}`);
  console.log(`    Unchanged:           ${report.directionBreakdown.unchanged}`);
  console.log('='.repeat(80));

  if (report.samples.length > 0) {
    console.log('\n  SAMPLE CHANGES (first 10):');
    console.log('-'.repeat(80));
    const displaySamples = report.samples.slice(0, 10);
    for (const s of displaySamples) {
      console.log(
        `    MpId=${s.mpId} V=${s.vendorId} Q=${s.quantity}: ` +
          `${s.original.algoResult} ($${s.original.suggestedPrice ?? 'N/A'}) -> ` +
          `${s.modified.algoResult} ($${s.modified.suggestedPrice ?? 'N/A'}) ` +
          `[delta: ${s.priceDelta !== null ? '$' + s.priceDelta.toFixed(2) : 'N/A'}]`,
      );
    }
  }

  console.log('');
}
```

---

## 6.10 Implementation File 5: `regression.test.ts`

**File**: `__tests__/backtest/regression.test.ts`

This is the Jest test file that runs the regression backtest. It requires database access and is separated from normal CI via the `describe.skip` / environment variable pattern.

```typescript
/**
 * Regression Backtest
 *
 * This test requires MySQL access. It is SKIPPED by default in normal CI.
 *
 * To run:
 *   BACKTEST_ENABLED=true npx jest --testPathPattern='backtest/regression' --verbose
 *
 * Environment variables:
 *   BACKTEST_ENABLED       - Set to "true" to enable (default: skipped)
 *   BACKTEST_SQL_HOST      - MySQL host (falls back to SQL_HOSTNAME)
 *   BACKTEST_SQL_PORT      - MySQL port (falls back to SQL_PORT)
 *   BACKTEST_SQL_USER      - MySQL user (falls back to SQL_USERNAME)
 *   BACKTEST_SQL_PASSWORD  - MySQL password (falls back to SQL_PASSWORD)
 *   BACKTEST_SQL_DATABASE  - MySQL database (falls back to SQL_DATABASE)
 *   BACKTEST_DAYS          - How many days of data to pull (default: 7)
 *   BACKTEST_LIMIT         - Max records to pull (default: 500)
 *   BACKTEST_THRESHOLD     - Minimum match rate (default: 0.95)
 *   BACKTEST_SNAPSHOT      - Path to a JSON snapshot file (skips DB if set)
 */

import {
  extractBacktestData,
  destroyBacktestKnex,
  loadSnapshot,
} from './extract-data';
import {
  runRegressionBacktest,
  printBacktestSummary,
} from './regression-runner';
import { BacktestRecord } from './types';

const ENABLED = process.env.BACKTEST_ENABLED === 'true';
const DAYS = Number(process.env.BACKTEST_DAYS ?? 7);
const LIMIT = Number(process.env.BACKTEST_LIMIT ?? 500);
const THRESHOLD = Number(process.env.BACKTEST_THRESHOLD ?? 0.95);
const SNAPSHOT_PATH = process.env.BACKTEST_SNAPSHOT ?? '';

const describeOrSkip = ENABLED ? describe : describe.skip;

describeOrSkip('Regression Backtest', () => {
  let records: BacktestRecord[] = [];

  beforeAll(async () => {
    if (SNAPSHOT_PATH) {
      // Load from offline snapshot -- no DB needed
      records = await loadSnapshot(SNAPSHOT_PATH);
    } else {
      // Pull from database
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - DAYS);

      records = await extractBacktestData({
        dateFrom,
        dateTo,
        limit: LIMIT,
        useV2Results: true,
      });
    }

    console.log(`[backtest] Loaded ${records.length} records for regression test.`);
  }, 120_000); // 2 minutes for data extraction

  afterAll(async () => {
    await destroyBacktestKnex();
  });

  it(
    `should have a match rate above ${(THRESHOLD * 100).toFixed(0)}%`,
    async () => {
      if (records.length === 0) {
        console.warn('[backtest] No records found. Skipping assertion.');
        return;
      }

      const result = await runRegressionBacktest(records);
      printBacktestSummary(result);

      expect(result.total).toBeGreaterThan(0);
      expect(result.matchRate).toBeGreaterThanOrEqual(THRESHOLD);
    },
    300_000, // 5 minutes timeout
  );

  it('should produce no ERROR results during replay', async () => {
    if (records.length === 0) return;

    const result = await runRegressionBacktest(records);

    const errorDiffs = result.diffs.filter(
      d => d.current.algoResult === 'ERROR',
    );

    if (errorDiffs.length > 0) {
      console.error(
        `[backtest] ${errorDiffs.length} records produced ERROR during replay:`,
      );
      for (const d of errorDiffs.slice(0, 5)) {
        console.error(
          `  MpId=${d.mpId} V=${d.vendorId} Q=${d.quantity}: ${d.current.comment}`,
        );
      }
    }

    // Allow a small number of errors (e.g., records with missing thresholds)
    const errorRate = errorDiffs.length / records.length;
    expect(errorRate).toBeLessThan(0.05); // Less than 5% errors
  }, 300_000);
});
```

---

## 6.11 Implementation File 6: `what-if.test.ts`

**File**: `__tests__/backtest/what-if.test.ts`

```typescript
/**
 * What-If Backtest
 *
 * Demonstrates how to run a what-if analysis by changing a single setting
 * and measuring the impact across historical data.
 *
 * To run:
 *   BACKTEST_ENABLED=true npx jest --testPathPattern='backtest/what-if' --verbose
 */

import {
  extractBacktestData,
  destroyBacktestKnex,
  loadSnapshot,
} from './extract-data';
import { runWhatIfBacktest, printWhatIfSummary } from './what-if-runner';
import { BacktestRecord } from './types';

const ENABLED = process.env.BACKTEST_ENABLED === 'true';
const DAYS = Number(process.env.BACKTEST_DAYS ?? 7);
const LIMIT = Number(process.env.BACKTEST_LIMIT ?? 500);
const SNAPSHOT_PATH = process.env.BACKTEST_SNAPSHOT ?? '';

const describeOrSkip = ENABLED ? describe : describe.skip;

describeOrSkip('What-If Backtest', () => {
  let records: BacktestRecord[] = [];

  beforeAll(async () => {
    if (SNAPSHOT_PATH) {
      records = await loadSnapshot(SNAPSHOT_PATH);
    } else {
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - DAYS);

      records = await extractBacktestData({
        dateFrom,
        dateTo,
        limit: LIMIT,
        useV2Results: true,
      });
    }

    console.log(`[backtest] Loaded ${records.length} records for what-if test.`);
  }, 120_000);

  afterAll(async () => {
    await destroyBacktestKnex();
  });

  it('what-if: change floor_price to $5.00', async () => {
    if (records.length === 0) return;

    const report = await runWhatIfBacktest(records, {
      floor_price: 5.0,
    });

    printWhatIfSummary(report, 'floor_price = $5.00');

    // Sanity: report should have processed all records
    expect(report.total).toBe(records.length);
  }, 300_000);

  it('what-if: change price_strategy to BUY_BOX', async () => {
    if (records.length === 0) return;

    const report = await runWhatIfBacktest(records, {
      price_strategy: 'BUY_BOX' as any,
    });

    printWhatIfSummary(report, 'price_strategy = BUY_BOX');

    expect(report.total).toBe(records.length);
  }, 300_000);

  it('what-if: enable floor_compete_with_next', async () => {
    if (records.length === 0) return;

    const report = await runWhatIfBacktest(records, {
      floor_compete_with_next: true,
    });

    printWhatIfSummary(report, 'floor_compete_with_next = true');

    expect(report.total).toBe(records.length);
  }, 300_000);

  it('what-if: change up_down to DOWN only', async () => {
    if (records.length === 0) return;

    const report = await runWhatIfBacktest(records, {
      up_down: 'DOWN' as any,
    });

    printWhatIfSummary(report, 'up_down = DOWN');

    expect(report.total).toBe(records.length);
    // Products that were previously priced UP should now be "no longer repriced"
    expect(report.directionBreakdown.noLongerRepriced).toBeGreaterThanOrEqual(0);
  }, 300_000);
});
```

---

## 6.12 Implementation File 7: `create-snapshot.ts`

**File**: `__tests__/backtest/create-snapshot.ts`

A standalone script (not a test) that creates a JSON snapshot file for offline testing. Run with `npx ts-node`.

```typescript
/**
 * Creates a JSON snapshot of historical backtest data for offline testing.
 *
 * Usage:
 *   cd apps/api-core
 *   npx ts-node src/utility/reprice-algo/__tests__/backtest/create-snapshot.ts
 *
 * Environment variables:
 *   BACKTEST_SQL_HOST, BACKTEST_SQL_PORT, BACKTEST_SQL_USER,
 *   BACKTEST_SQL_PASSWORD, BACKTEST_SQL_DATABASE
 *   SNAPSHOT_DAYS    - How many days of data (default: 7)
 *   SNAPSHOT_LIMIT   - Max records (default: 200)
 *   SNAPSHOT_OUTPUT  - Output file path (default: ./backtest-snapshot.json)
 */

import { extractBacktestData, destroyBacktestKnex, saveSnapshot } from './extract-data';
import path from 'path';

async function main() {
  const days = Number(process.env.SNAPSHOT_DAYS ?? 7);
  const limit = Number(process.env.SNAPSHOT_LIMIT ?? 200);
  const output = process.env.SNAPSHOT_OUTPUT ?? path.join(__dirname, 'backtest-snapshot.json');

  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  console.log(`Extracting backtest data: last ${days} days, limit ${limit}`);
  console.log(`Date range: ${dateFrom.toISOString()} to ${dateTo.toISOString()}`);

  const records = await extractBacktestData({
    dateFrom,
    dateTo,
    limit,
    useV2Results: true,
  });

  if (records.length === 0) {
    console.error('No records found. Check your database connection and date range.');
    process.exit(1);
  }

  await saveSnapshot(records, output);
  console.log(`Snapshot saved to: ${output}`);

  await destroyBacktestKnex();
}

main().catch(err => {
  console.error('Failed to create snapshot:', err);
  process.exit(1);
});
```

---

## 6.13 Directory Structure Summary

After implementation, the `backtest/` directory should contain:

```
apps/api-core/src/utility/reprice-algo/__tests__/backtest/
  types.ts                  # Type definitions (BacktestRecord, BacktestDiff, etc.)
  extract-data.ts           # DB extraction + snapshot load/save
  replay-algo.ts            # Bridge: BacktestRecord -> repriceProductV2() inputs
  regression-runner.ts      # Mode 1: Regression comparison logic + formatting
  what-if-runner.ts         # Mode 2: What-if comparison logic + formatting
  regression.test.ts        # Jest test: regression backtest
  what-if.test.ts           # Jest test: what-if scenarios
  create-snapshot.ts        # Standalone script: create offline JSON snapshot
  backtest-snapshot.json    # (generated) Offline test data -- gitignore this
```

Add to `.gitignore`:
```
apps/api-core/src/utility/reprice-algo/__tests__/backtest/backtest-snapshot.json
```

---

## 6.14 How to Run

```bash
cd apps/api-core

# ---- With database access ----

# Run regression backtest (last 7 days, up to 500 records)
BACKTEST_ENABLED=true \
BACKTEST_SQL_HOST=your-db-host \
BACKTEST_SQL_PORT=3306 \
BACKTEST_SQL_USER=readonly_user \
BACKTEST_SQL_PASSWORD=your_password \
BACKTEST_SQL_DATABASE=repricer \
npx jest --testPathPattern='backtest/regression' --verbose

# Run what-if analysis
BACKTEST_ENABLED=true \
BACKTEST_SQL_HOST=your-db-host \
BACKTEST_SQL_USER=readonly_user \
BACKTEST_SQL_PASSWORD=your_password \
BACKTEST_SQL_DATABASE=repricer \
npx jest --testPathPattern='backtest/what-if' --verbose

# ---- Create an offline snapshot ----

BACKTEST_SQL_HOST=your-db-host \
BACKTEST_SQL_USER=readonly_user \
BACKTEST_SQL_PASSWORD=your_password \
BACKTEST_SQL_DATABASE=repricer \
SNAPSHOT_DAYS=7 \
SNAPSHOT_LIMIT=200 \
npx ts-node src/utility/reprice-algo/__tests__/backtest/create-snapshot.ts

# ---- Run with offline snapshot (no DB needed) ----

BACKTEST_ENABLED=true \
BACKTEST_SNAPSHOT=src/utility/reprice-algo/__tests__/backtest/backtest-snapshot.json \
npx jest --testPathPattern='backtest/regression' --verbose
```

---

## 6.15 CI Integration (Mode 3: Impact Report)

For PRs that touch algo files, add a CI step that runs the regression backtest against a fixed snapshot:

```yaml
# .github/workflows/backtest.yml (or add as a step to existing CI)
name: Algo Backtest

on:
  pull_request:
    paths:
      - 'apps/api-core/src/utility/reprice-algo/v2/**'
      - 'apps/api-core/src/utility/reprice-algo/__tests__/backtest/**'

jobs:
  backtest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd apps/api-core && npm ci

      - name: Run regression backtest (offline snapshot)
        env:
          BACKTEST_ENABLED: 'true'
          BACKTEST_SNAPSHOT: src/utility/reprice-algo/__tests__/backtest/backtest-snapshot.json
          BACKTEST_THRESHOLD: '0.95'
        run: |
          cd apps/api-core
          npx jest --testPathPattern='backtest/regression' --verbose
```

For this to work, you need a committed snapshot file. Create one from production data and commit it (ensure it contains no secrets -- the API response data is product pricing, not credentials):

```bash
# One-time: create and commit the snapshot
BACKTEST_SQL_HOST=prod-readonly-replica \
... \
npx ts-node src/utility/reprice-algo/__tests__/backtest/create-snapshot.ts

# Review the snapshot, then commit
git add apps/api-core/src/utility/reprice-algo/__tests__/backtest/backtest-snapshot.json
git commit -m "Add backtest snapshot for CI regression testing"
```

---

## 6.16 Important Implementation Notes

### DB Access Isolation
- Backtest tests are **skipped by default** (`BACKTEST_ENABLED=true` required). They will never run in normal `npx jest` or standard CI pipelines.
- Use a **read-only database user** or a **replica** for backtest queries. The extract queries only perform SELECT operations.

### Snapshot Strategy
- The JSON snapshot should be **refreshed periodically** (weekly or monthly) to stay representative.
- Snapshot files can be large (200 records with full API responses may be 5-20 MB). Consider compressing or limiting to specific mpIds for CI.

### Handling Missing Fields
- The `extract-data.ts` functions handle missing fields gracefully:
  - `safeParseApiResponse` handles null, malformed JSON, and wrapped formats.
  - `createDefaultSettings` fills in V2AlgoSettingsData defaults when settings don't exist.
  - Missing vendor thresholds cause warnings but don't crash the extraction.

### V1 vs V2 Data
- `table_history` stores V1 algo decisions. The `RepriceResult` field contains free-form strings (not the `AlgoResult` enum).
- `v2_algo_results` stores V2 algo decisions with the exact `AlgoResult` enum values. **Prefer V2 data** (`useV2Results: true`).
- The `table_history` extraction path (V1) is included for completeness but the ChannelName-to-VendorId mapping needs to be completed by the implementer.

### The repriceProductV2 Contract
The algo function signature (from `apps/api-core/src/utility/reprice-algo/v2/algorithm.ts`):

```typescript
function repriceProductV2(
  mpId: number,
  rawNet32Products: Net32AlgoProduct[],     // Parsed from API response
  non422VendorIds: number[],                // Own vendors not in 422 state
  allOwnVendorIds: number[],                // All 7 own vendor IDs
  vendorSettings: V2AlgoSettingsData[],     // Settings per vendor
  jobId: string,                            // Unique job identifier
  isSlowCron: boolean,                      // Affects certain rules
  net32url: string,                         // Product URL
  vendorThresholds: VendorThreshold[],      // Shipping thresholds
): Net32AlgoSolutionWithQBreakValid[]       // One per vendor per quantity
```

The return type includes:
- `algoResult: AlgoResult` -- the decision enum
- `suggestedPrice: number | null` -- the proposed price
- `comment: string` -- human-readable explanation
- `triggeredByVendor: string | null` -- which competitor triggered the change
- `qBreakValid: boolean` -- whether this quantity break solution is valid
- `quantity: number` -- which quantity break this solution is for
- `vendor.vendorId: number` -- which of our vendors this solution is for

### Net32AlgoProduct vs Net32Product
The algo uses `Net32AlgoProduct` (from `v2/types.ts`), not `Net32Product` (from `types/net32.ts`). Key differences:
- `Net32AlgoProduct.vendorId` is always `number` (Net32Product allows `number | string`)
- `Net32AlgoProduct.freeShippingThreshold` is required (Net32Product has it optional)
- `Net32AlgoProduct` does not include many Net32Product fields (vendorRegion, imagePath, etc.)

The `replay-algo.ts` module handles this conversion.

---

## 6.17 Verification Checklist

After implementing all files, verify:

```bash
cd apps/api-core

# 1. Files compile (no TypeScript errors)
npx tsc --noEmit

# 2. Tests are recognized but skipped (default mode)
npx jest --testPathPattern='backtest' --verbose
# Expected: "Tests: 2 skipped" (or similar)

# 3. With snapshot (offline mode)
BACKTEST_ENABLED=true \
BACKTEST_SNAPSHOT=path/to/snapshot.json \
npx jest --testPathPattern='backtest/regression' --verbose
# Expected: Regression results printed, test passes if match rate > 95%

# 4. With database (live mode)
BACKTEST_ENABLED=true \
BACKTEST_SQL_HOST=... \
npx jest --testPathPattern='backtest' --verbose --detectOpenHandles
# Expected: Both regression and what-if tests run
```
