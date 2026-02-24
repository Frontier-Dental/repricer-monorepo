import { BacktestRecord, BacktestResult, BacktestDiff, ProductBacktestResult, ProductDiff, MarketVendor, VendorDecision } from "./types";
import { replayRecord, ReplayResult, ALL_OWN_VENDOR_IDS } from "./replay-algo";

/**
 * Run a regression backtest: replay each record through the current algo
 * and compare with the historical decision.
 */
export async function runRegressionBacktest(records: BacktestRecord[]): Promise<BacktestResult> {
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
    const matchingResult = replayResults.find((r) => r.vendorId === record.vendorId && r.quantity === record.quantity);

    if (!matchingResult) {
      // If historical was also NO_SOLUTION, this is a match
      if (normalizeAlgoResult(record.historical.algoResult) === "NO_SOLUTION") {
        matches++;
      } else {
        diffs.push({
          recordId: record.recordId,
          mpId: record.mpId,
          vendorId: record.vendorId,
          quantity: record.quantity,
          timestamp: record.timestamp,
          existingPrice: record.historical.existingPrice,
          position: record.historical.position,
          lowestPrice: record.historical.lowestPrice,
          lowestVendor: record.historical.lowestVendor,
          historical: {
            algoResult: record.historical.algoResult,
            suggestedPrice: record.historical.suggestedPrice,
            comment: record.historical.comment,
          },
          current: {
            algoResult: "NO_SOLUTION",
            suggestedPrice: null,
            comment: "Replay did not produce a solution for this vendor+quantity.",
          },
          priceDelta: null,
        });
      }
      continue;
    }

    const isMatch = compareResults(record, matchingResult);

    if (isMatch) {
      matches++;
    } else {
      const priceDelta = computePriceDelta(record.historical.suggestedPrice, matchingResult.suggestedPrice);

      diffs.push({
        recordId: record.recordId,
        mpId: record.mpId,
        vendorId: record.vendorId,
        quantity: record.quantity,
        timestamp: record.timestamp,
        existingPrice: record.historical.existingPrice,
        position: record.historical.position,
        lowestPrice: record.historical.lowestPrice,
        lowestVendor: record.historical.lowestVendor,
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

// ─── Product-level regression ─────────────────────────────────────────

/**
 * Run a product-level regression: group records by product, build market
 * snapshot from API response, compare V1 vs V2 decisions for each vendor.
 */
export async function runProductRegressionBacktest(records: BacktestRecord[]): Promise<ProductBacktestResult> {
  const startTime = Date.now();

  // Group records by mpId + 2-minute timestamp bucket
  const groups = new Map<string, BacktestRecord[]>();
  for (const record of records) {
    const bucket = Math.floor(new Date(record.timestamp).getTime() / 120_000);
    const key = `${record.mpId}:${bucket}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const products: ProductDiff[] = [];
  let matches = 0;

  for (const [, group] of groups) {
    const first = group[0];

    // Build market snapshot from API response
    const market: MarketVendor[] = first.apiResponse
      .map((p) => {
        const vid = typeof p.vendorId === "string" ? parseInt(p.vendorId, 10) : p.vendorId;
        const q1Price = Array.isArray(p.priceBreaks) && p.priceBreaks.length > 0 ? p.priceBreaks[0].unitPrice : null;
        const shipping = p.standardShipping ?? null;
        const totalPrice = q1Price != null ? q1Price + (shipping ?? 0) : null;
        return {
          vendorId: vid,
          vendorName: p.vendorName || String(vid),
          unitPrice: q1Price,
          shipping,
          totalPrice,
          badgeName: p.badgeName ?? null,
          inStock: p.inStock,
          inventory: p.inventory ?? null,
          freeShippingThreshold: p.freeShippingThreshold ?? null,
          isOwnVendor: ALL_OWN_VENDOR_IDS.includes(vid),
        };
      })
      .sort((a, b) => (a.totalPrice ?? 999999) - (b.totalPrice ?? 999999));

    // Build vendor decisions: pair V1 (from historical records) with V2 (from replay)
    const vendors: VendorDecision[] = [];
    let allMatch = true;

    for (const record of group) {
      // V1 decision from historical
      const v1 = {
        algoResult: record.historical.algoResult,
        suggestedPrice: record.historical.suggestedPrice,
        comment: record.historical.comment,
      };

      // V2 decision from replay
      const replayResults = replayRecord(record);
      const matchingReplay = replayResults.find((r) => r.vendorId === record.vendorId && r.quantity === record.quantity);

      const v2 = matchingReplay ? { algoResult: matchingReplay.algoResult, suggestedPrice: matchingReplay.suggestedPrice, comment: matchingReplay.comment } : { algoResult: "NO_SOLUTION", suggestedPrice: null as number | null, comment: "No replay result" };

      // Compare
      const v1Norm = normalizeAlgoResult(v1.algoResult);
      const v2Norm = normalizeAlgoResult(v2.algoResult);
      let isVendorMatch = v1Norm === v2Norm;
      if (isVendorMatch && v1.suggestedPrice !== null && v2.suggestedPrice !== null) {
        isVendorMatch = Math.abs(v1.suggestedPrice - v2.suggestedPrice) <= 0.01;
      }
      if (isVendorMatch && (v1.suggestedPrice === null) !== (v2.suggestedPrice === null)) {
        isVendorMatch = false;
      }

      if (!isVendorMatch) allMatch = false;

      const s = record.vendorSettings;
      vendors.push({
        vendorId: record.vendorId,
        existingPrice: record.historical.existingPrice,
        position: record.historical.position,
        v1,
        v2,
        priceDelta: computePriceDelta(v1.suggestedPrice, v2.suggestedPrice),
        isMatch: isVendorMatch,
        settings: {
          up_down: String(s.up_down),
          floor_price: s.floor_price,
          max_price: s.max_price,
          badge_indicator: String(s.badge_indicator),
          price_strategy: String(s.price_strategy),
          reprice_up_percentage: s.reprice_up_percentage,
          reprice_down_percentage: s.reprice_down_percentage,
          keep_position: s.keep_position,
          sister_vendor_ids: s.sister_vendor_ids,
          exclude_vendors: s.exclude_vendors,
          compete_with_all_vendors: s.compete_with_all_vendors,
          handling_time_group: String(s.handling_time_group),
          inventory_competition_threshold: s.inventory_competition_threshold,
          enabled: s.enabled,
        },
      });
    }

    if (allMatch) matches++;

    products.push({
      mpId: first.mpId,
      timestamp: first.timestamp,
      cronName: first.cronName,
      market,
      vendors,
      isMatch: allMatch,
    });
  }

  const total = products.length;
  const matchRate = total > 0 ? matches / total : 1;

  return {
    total,
    matches,
    products,
    matchRate,
    executionTimeMs: Date.now() - startTime,
  };
}

// ─── Comparison logic ──────────────────────────────────────────────────

function compareResults(record: BacktestRecord, replay: ReplayResult): boolean {
  // Primary comparison: AlgoResult must match
  if (normalizeAlgoResult(record.historical.algoResult) !== normalizeAlgoResult(replay.algoResult)) {
    return false;
  }

  // Secondary comparison: if both have a suggested price, they should match
  // within a small tolerance (0.01) to account for floating point
  if (record.historical.suggestedPrice !== null && replay.suggestedPrice !== null) {
    const delta = Math.abs(record.historical.suggestedPrice - replay.suggestedPrice);
    if (delta > 0.01) {
      return false;
    }
  }

  // If one has a price and the other doesn't, that's a mismatch
  if ((record.historical.suggestedPrice === null) !== (replay.suggestedPrice === null)) {
    return false;
  }

  return true;
}

/**
 * Normalize AlgoResult strings for comparison.
 */
function normalizeAlgoResult(result: string): string {
  if (!result) return "UNKNOWN";
  return result.trim().toUpperCase();
}

function computePriceDelta(historical: number | null, current: number | null): number | null {
  if (historical === null || current === null) return null;
  return Number((current - historical).toFixed(4));
}

// ─── Console output formatting ─────────────────────────────────────────

export function printBacktestSummary(result: BacktestResult): void {
  console.log("\n" + "=".repeat(80));
  console.log("  REGRESSION BACKTEST SUMMARY");
  console.log("=".repeat(80));
  console.log(`  Total records:    ${result.total}`);
  console.log(`  Matches:          ${result.matches}`);
  console.log(`  Diffs:            ${result.diffs.length}`);
  console.log(`  Match rate:       ${(result.matchRate * 100).toFixed(2)}%`);
  console.log(`  Execution time:   ${(result.executionTimeMs / 1000).toFixed(1)}s`);
  console.log("=".repeat(80));

  if (result.diffs.length > 0) {
    console.log("\n  DIFFS (first 20):");
    console.log("-".repeat(80));
    console.log(padRight("MpId", 10) + padRight("Vendor", 8) + padRight("Qty", 5) + padRight("Historical Result", 22) + padRight("Current Result", 22) + padRight("Price Delta", 12));
    console.log("-".repeat(80));

    const displayDiffs = result.diffs.slice(0, 20);
    for (const diff of displayDiffs) {
      console.log(padRight(String(diff.mpId), 10) + padRight(String(diff.vendorId), 8) + padRight(String(diff.quantity), 5) + padRight(diff.historical.algoResult, 22) + padRight(diff.current.algoResult, 22) + padRight(diff.priceDelta !== null ? diff.priceDelta.toFixed(2) : "N/A", 12));
    }

    if (result.diffs.length > 20) {
      console.log(`  ... and ${result.diffs.length - 20} more diffs.`);
    }
  }

  console.log("");
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}
