import { Knex, knex } from "knex";
import { BacktestRecord, ExtractOptions, HistoryApiResponseRow, V2AlgoResultRow } from "./types";
import { V2AlgoSettingsData } from "../../../../utility/mysql/v2-algo-settings";
import { VendorThreshold } from "../../v2/shipping-threshold";
import { Net32Product } from "../../../../types/net32";
import { VendorIdLookup } from "@repricer-monorepo/shared";

// ─── Database connection ───────────────────────────────────────────────

let _knex: Knex | null = null;

export function setBacktestKnex(instance: Knex): void {
  _knex = instance;
}

export function getBacktestKnex(): Knex {
  if (_knex) return _knex;
  _knex = knex({
    client: "mysql2",
    connection: {
      host: process.env.BACKTEST_SQL_HOST ?? process.env.SQL_HOSTNAME ?? "localhost",
      port: Number(process.env.BACKTEST_SQL_PORT ?? process.env.SQL_PORT ?? 3306),
      user: process.env.BACKTEST_SQL_USER ?? process.env.SQL_USERNAME ?? "root",
      password: process.env.BACKTEST_SQL_PASSWORD ?? process.env.SQL_PASSWORD ?? "",
      database: process.env.BACKTEST_SQL_DATABASE ?? process.env.SQL_DATABASE ?? "repricer",
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

export async function extractBacktestData(options: ExtractOptions): Promise<BacktestRecord[]> {
  const db = getBacktestKnex();
  const useV2 = options.useV2Results !== false;

  if (useV2) {
    return extractFromV2AlgoResults(db, options);
  } else {
    return extractFromTableHistory(db, options);
  }
}

// ─── V2 algo results extraction (preferred) ────────────────────────────

async function extractFromV2AlgoResults(db: Knex, options: ExtractOptions): Promise<BacktestRecord[]> {
  // Step 1: Pull v2_algo_results rows within the date range
  let query = db("v2_algo_results").whereBetween("created_at", [options.dateFrom, options.dateTo]).orderBy("created_at", "desc");

  if (options.mpIds && options.mpIds.length > 0) {
    query = query.whereIn("mp_id", options.mpIds);
  }
  if (options.vendorIds && options.vendorIds.length > 0) {
    query = query.whereIn("vendor_id", options.vendorIds);
  }
  if (options.cronName) {
    query = query.where("cron_name", options.cronName);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const rows: V2AlgoResultRow[] = await query;

  if (rows.length === 0) {
    console.log("[backtest] No v2_algo_results rows found for the given criteria.");
    return [];
  }

  console.log(`[backtest] Found ${rows.length} v2_algo_results rows. Enriching...`);

  // Step 2: For each unique job_id, we need the API response.
  const uniqueJobIds = [...new Set(rows.map((r) => r.job_id))];
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
      const apiResponse = await findApiResponseForRecord(db, sampleRow.mp_id, sampleRow.created_at);
      if (apiResponse) {
        apiResponseCache.set(jobId, apiResponse);
      } else {
        console.warn(`[backtest] No API response found for job ${jobId} (mpId=${sampleRow.mp_id}, time=${sampleRow.created_at}). Skipping.`);
      }
    } catch (err) {
      console.warn(`[backtest] Error fetching API response for job ${jobId}:`, err);
    }
  }

  // Step 3: Fetch V2AlgoSettingsData for each unique (mp_id, vendor_id) pair
  const settingsCache = new Map<string, V2AlgoSettingsData>();
  const uniquePairs = [...new Set(rows.map((r) => `${r.mp_id}:${r.vendor_id}`))];

  for (const pair of uniquePairs) {
    const [mpId, vendorId] = pair.split(":").map(Number);
    try {
      const settings = await db("v2_algo_settings").where({ mp_id: mpId, vendor_id: vendorId }).first();
      if (settings) {
        settingsCache.set(pair, settings as V2AlgoSettingsData);
      } else {
        console.warn(`[backtest] No v2_algo_settings found for mpId=${mpId}, vendorId=${vendorId}. Using defaults.`);
        settingsCache.set(pair, createDefaultSettings(mpId, vendorId));
      }
    } catch (err) {
      console.warn(`[backtest] Error fetching settings for ${pair}:`, err);
      settingsCache.set(pair, createDefaultSettings(mpId, vendorId));
    }
  }

  // Step 4: Fetch vendor thresholds for all vendor IDs seen in API responses
  const allVendorIdsInResponses = new Set<number>();
  for (const products of apiResponseCache.values()) {
    for (const p of products) {
      allVendorIdsInResponses.add(typeof p.vendorId === "string" ? parseInt(p.vendorId, 10) : p.vendorId);
    }
  }

  const thresholdCache = new Map<number, VendorThreshold>();
  if (allVendorIdsInResponses.size > 0) {
    try {
      const thresholdRows = await db("vendor_thresholds").whereIn("vendor_id", [...allVendorIdsInResponses]);
      for (const row of thresholdRows) {
        thresholdCache.set(row.vendor_id, {
          vendorId: row.vendor_id,
          standardShipping: parseFloat(row.standard_shipping),
          threshold: parseFloat(row.threshold),
        });
      }
    } catch (err) {
      console.warn("[backtest] Error fetching vendor thresholds:", err);
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
      const vid = typeof p.vendorId === "string" ? parseInt(p.vendorId, 10) : p.vendorId;
      const threshold = thresholdCache.get(vid);
      if (threshold && !vendorThresholds.find((t) => t.vendorId === vid)) {
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
        existingPrice: null, // v2_algo_results doesn't store this
        position: null,
        lowestVendor: null,
      },
    });
  }

  console.log(`[backtest] Assembled ${records.length} backtest records (${records.length}/${rows.length} had API responses).`);
  return records;
}

// ─── Channel name → vendor ID mapping (from shared package) ─────────────

// ─── table_history extraction (for V1 data) ─────────────────────────────

async function extractFromTableHistory(db: Knex, options: ExtractOptions): Promise<BacktestRecord[]> {
  let query = db("table_history as h").join("table_history_apiResponse as a", "h.LinkedApiResponse", "a.ApiResponseId").select("h.*", "a.ApiResponse").whereBetween("h.RefTime", [options.dateFrom, options.dateTo]).orderBy("h.RefTime", "desc");

  if (options.mpIds && options.mpIds.length > 0) {
    query = query.whereIn("h.MpId", options.mpIds);
  }
  if (options.cronName) {
    query = query.where("h.ContextCronName", options.cronName);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const rows = await query;

  if (rows.length === 0) {
    console.log("[backtest] No table_history rows found for the given criteria.");
    return [];
  }

  console.log(`[backtest] Found ${rows.length} table_history rows. Enriching...`);

  const records: BacktestRecord[] = [];

  for (const row of rows) {
    try {
      const apiResponse = safeParseApiResponse(row.ApiResponse);
      if (!apiResponse || apiResponse.length === 0) continue;

      // Map ChannelName (e.g., "TRADENT") to vendor ID using shared package
      const channelName = (row.ChannelName || "").toUpperCase().trim() as keyof typeof VendorIdLookup;
      const vendorId = VendorIdLookup[channelName] || 0;

      // Try to fetch settings
      let vendorSettings: V2AlgoSettingsData;
      try {
        const settings = await db("v2_algo_settings").where({ mp_id: row.MpId, vendor_id: vendorId }).first();
        vendorSettings = settings ?? createDefaultSettings(row.MpId, vendorId);
      } catch {
        vendorSettings = createDefaultSettings(row.MpId, vendorId);
      }

      // Fetch thresholds
      const vendorIdsInResponse = apiResponse.map((p) => (typeof p.vendorId === "string" ? parseInt(p.vendorId, 10) : p.vendorId));
      let vendorThresholds: VendorThreshold[] = [];
      try {
        const thresholdRows = await db("vendor_thresholds").whereIn("vendor_id", vendorIdsInResponse);
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
        cronName: row.ContextCronName ?? "unknown",
        apiResponse,
        vendorSettings,
        vendorThresholds,
        historical: {
          algoResult: parseV1AlgoResult(row.RepriceComment),
          suggestedPrice: row.SuggestedPrice ? parseFloat(row.SuggestedPrice) : null,
          comment: row.RepriceComment ?? "",
          triggeredByVendor: row.TriggeredByVendor,
          qBreakValid: true, // table_history doesn't track this
          lowestPrice: row.LowestPrice ? parseFloat(row.LowestPrice) : null,
          lowestVendorId: null,
          existingPrice: row.ExistingPrice ? parseFloat(row.ExistingPrice) : null,
          position: row.Position ?? null,
          lowestVendor: row.LowestVendor ?? null,
        },
      });
    } catch (err) {
      console.warn(`[backtest] Error processing history row ${row.Id}:`, err);
    }
  }

  console.log(`[backtest] Assembled ${records.length} backtest records from table_history.`);
  return records;
}

// ─── Helper: find API response by mpId + approximate timestamp ─────────

async function findApiResponseForRecord(db: Knex, mpId: number, timestamp: Date): Promise<Net32Product[] | null> {
  const historyRow = await db("table_history")
    .where("MpId", mpId)
    .whereBetween("RefTime", [
      new Date(timestamp.getTime() - 60_000), // 1 minute before
      new Date(timestamp.getTime() + 60_000), // 1 minute after
    ])
    .orderByRaw("ABS(TIMESTAMPDIFF(SECOND, RefTime, ?)) ASC", [timestamp])
    .first();

  if (!historyRow || !historyRow.LinkedApiResponse) {
    return null;
  }

  const apiRow: HistoryApiResponseRow | undefined = await db("table_history_apiResponse").where("ApiResponseId", historyRow.LinkedApiResponse).first();

  if (!apiRow) return null;

  return safeParseApiResponse(apiRow.ApiResponse);
}

// ─── Helper: parse V1 RepriceComment into algo result ─────────────────
// V1 format: "CHANGE: #BB_BADGE | $DOWN", "IGNORE: #Sister #DOWN", "N/A"
// V2 format: "CHANGE #DOWN", "IGNORE #FLOOR", "NO_SOLUTION"

function parseV1AlgoResult(comment: string | null | undefined): string {
  if (!comment || comment === "N/A") return "NO_SOLUTION";
  const upper = comment.toUpperCase().trim();

  if (upper.startsWith("CHANGE")) {
    if (upper.includes("$DOWN") || upper.includes("#DOWN")) return "CHANGE #DOWN";
    if (upper.includes("$UP") || upper.includes("#UP")) return "CHANGE #UP";
    return "CHANGE #DOWN"; // default for CHANGE
  }
  if (upper.startsWith("IGNORE")) {
    if (upper.includes("#FLOOR") || upper.includes("#HITFLOOR")) return "IGNORE #FLOOR";
    if (upper.includes("#SISTER")) return "IGNORE #SISTER";
    if (upper.includes("#LOWEST")) return "IGNORE #LOWEST";
    return "IGNORE #OTHER";
  }
  return "NO_SOLUTION";
}

// ─── Helper: safely parse API response JSON ────────────────────────────

function safeParseApiResponse(raw: string | null | undefined): Net32Product[] | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed;
    // Some older records may wrap in { data: [...] }
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    return null;
  } catch (err) {
    console.warn("[backtest] Failed to parse API response JSON:", err);
    return null;
  }
}

// ─── Helper: create default V2 settings ────────────────────────────────

function createDefaultSettings(mpId: number, vendorId: number): V2AlgoSettingsData {
  return {
    id: 0,
    mp_id: mpId,
    vendor_id: vendorId,
    suppress_price_break_if_Q1_not_updated: false,
    suppress_price_break: false,
    compete_on_price_break_only: false,
    up_down: "UP/DOWN" as any,
    badge_indicator: "ALL" as any,
    execution_priority: 0,
    reprice_up_percentage: -1,
    compare_q2_with_q1: false,
    compete_with_all_vendors: false,
    reprice_up_badge_percentage: -1,
    sister_vendor_ids: "",
    exclude_vendors: "",
    inactive_vendor_id: "",
    handling_time_group: "ALL" as any,
    keep_position: false,
    max_price: 99999999.99,
    floor_price: 0,
    inventory_competition_threshold: 1,
    reprice_down_percentage: -1,
    reprice_down_badge_percentage: -1,
    floor_compete_with_next: false,
    own_vendor_threshold: 1,
    price_strategy: "UNIT" as any,
    enabled: true,
  };
}

// ─── Offline snapshot support ──────────────────────────────────────────

/**
 * Save extracted records to a JSON file for offline testing.
 */
export async function saveSnapshot(records: BacktestRecord[], filePath: string): Promise<void> {
  const fs = await import("fs");
  const data = JSON.stringify(records, null, 2);
  fs.writeFileSync(filePath, data, "utf-8");
  console.log(`[backtest] Saved ${records.length} records to ${filePath}`);
}

/**
 * Load records from a previously saved JSON snapshot.
 */
export async function loadSnapshot(filePath: string): Promise<BacktestRecord[]> {
  const fs = await import("fs");
  const raw = fs.readFileSync(filePath, "utf-8");
  const records: BacktestRecord[] = JSON.parse(raw);
  // Re-hydrate Date objects (JSON.parse returns strings)
  for (const r of records) {
    r.timestamp = new Date(r.timestamp);
  }
  console.log(`[backtest] Loaded ${records.length} records from ${filePath}`);
  return records;
}
