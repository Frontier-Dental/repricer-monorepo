import { BacktestRecord, BacktestResult, BacktestDiff, ProductBacktestResult, ProductDiff, MarketVendor, VendorDecision } from "./types";
import { replayRecord, replayRecordV1, ReplayResult, ALL_OWN_VENDOR_IDS } from "./replay-algo";

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
 * snapshot from API response, compare historical vs current decisions for each vendor.
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
  let matchesV1 = 0;
  let matchesV2 = 0;

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

    // Build vendor decisions: three-way comparison (historical vs current V1 vs current V2)
    const vendors: VendorDecision[] = [];
    let allMatch = true;
    let allMatchV1 = true;
    let allMatchV2 = true;

    for (const record of group) {
      // Historical decision from DB
      const hist = {
        algoResult: record.historical.algoResult,
        suggestedPrice: record.historical.suggestedPrice,
        comment: record.historical.comment,
      };

      // Current V2 decision from replay
      const replayV2Results = replayRecord(record);
      const matchingV2 = replayV2Results.find((r) => r.vendorId === record.vendorId && r.quantity === record.quantity);
      const currV2 = matchingV2 ? { algoResult: matchingV2.algoResult, suggestedPrice: matchingV2.suggestedPrice, comment: matchingV2.comment } : { algoResult: "NO_SOLUTION", suggestedPrice: null as number | null, comment: "No V2 replay result" };

      // Current V1 decision from replay
      const v1Result = await replayRecordV1(record);
      const currV1: { algoResult: string; suggestedPrice: number | null; comment: string } | null = v1Result ? { algoResult: v1Result.algoResult, suggestedPrice: v1Result.suggestedPrice, comment: v1Result.comment } : null;

      // Compare V1 and V2 separately against historical
      const isMatchV2 = compareDecision(hist, currV2);
      const isMatchV1: boolean | null = currV1 ? compareDecision(hist, currV1) : null; // null = no V1 settings, N/A
      const isVendorMatch = (isMatchV1 === null || isMatchV1) && isMatchV2;

      if (isMatchV1 === false) allMatchV1 = false;
      if (!isMatchV2) allMatchV2 = false;
      if (!isVendorMatch) allMatch = false;

      const s = record.vendorSettings;
      vendors.push({
        vendorId: record.vendorId,
        existingPrice: record.historical.existingPrice,
        position: record.historical.position,
        historical: hist,
        currentV1: currV1,
        currentV2: currV2,
        priceDeltaV1: currV1 ? computePriceDelta(hist.suggestedPrice, currV1.suggestedPrice) : null,
        priceDeltaV2: computePriceDelta(hist.suggestedPrice, currV2.suggestedPrice),
        isMatchV1,
        isMatchV2,
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
    if (allMatchV1) matchesV1++;
    if (allMatchV2) matchesV2++;

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
  const matchRateV1 = total > 0 ? matchesV1 / total : 1;
  const matchRateV2 = total > 0 ? matchesV2 / total : 1;

  return {
    total,
    matches,
    matchesV1,
    matchesV2,
    products,
    matchRate,
    matchRateV1,
    matchRateV2,
    executionTimeMs: Date.now() - startTime,
  };
}

// ─── Comparison logic ──────────────────────────────────────────────────

function compareDecision(hist: { algoResult: string; suggestedPrice: number | null }, curr: { algoResult: string; suggestedPrice: number | null }): boolean {
  const histOutcome = getOutcomeCategory(hist.algoResult);
  const currOutcome = getOutcomeCategory(curr.algoResult);

  // Both must agree on outcome: CHANGE_UP, CHANGE_DOWN, or NO_CHANGE
  if (histOutcome !== currOutcome) return false;

  // For CHANGE outcomes, prices must match within tolerance
  if (hist.suggestedPrice !== null && curr.suggestedPrice !== null) {
    if (Math.abs(hist.suggestedPrice - curr.suggestedPrice) > 0.01) return false;
  }
  // If one has a price and the other doesn't (e.g. CHANGE vs CHANGE with missing price), mismatch
  if (histOutcome.startsWith("CHANGE") && (hist.suggestedPrice === null) !== (curr.suggestedPrice === null)) return false;

  return true;
}

function compareResults(record: BacktestRecord, replay: ReplayResult): boolean {
  const histOutcome = getOutcomeCategory(record.historical.algoResult);
  const replayOutcome = getOutcomeCategory(replay.algoResult);

  if (histOutcome !== replayOutcome) return false;

  if (record.historical.suggestedPrice !== null && replay.suggestedPrice !== null) {
    if (Math.abs(record.historical.suggestedPrice - replay.suggestedPrice) > 0.01) return false;
  }

  if (histOutcome.startsWith("CHANGE") && (record.historical.suggestedPrice === null) !== (replay.suggestedPrice === null)) {
    return false;
  }

  return true;
}

/**
 * Categorize an algo result into an outcome for comparison:
 *   CHANGE_UP   — price increased
 *   CHANGE_DOWN — price decreased
 *   NO_CHANGE   — price stays the same (IGNORE, NO_SOLUTION, SKIP, ERROR, etc.)
 *
 * This lets us compare V1 vs V2 vs historical fairly: "IGNORE #SISTER" and
 * "NO_SOLUTION" are both NO_CHANGE outcomes and should match.
 */
function getOutcomeCategory(result: string): string {
  if (!result) return "NO_CHANGE";
  const upper = result.trim().toUpperCase();
  if (upper.startsWith("CHANGE") || upper.includes("PRICE CHANGE")) {
    if (upper.includes("DOWN")) return "CHANGE_DOWN";
    if (upper.includes("UP") || upper.includes("NEW") || upper.includes("MAXED")) return "CHANGE_UP";
    return "CHANGE_DOWN"; // default direction for CHANGE
  }
  return "NO_CHANGE";
}

/**
 * Normalize AlgoResult strings for display.
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
