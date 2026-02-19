import { BacktestRecord, BacktestResult, BacktestDiff } from "./types";
import { replayRecord, ReplayResult } from "./replay-algo";

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
          algoResult: "NO_SOLUTION",
          suggestedPrice: null,
          comment: "Replay did not produce a solution for this vendor+quantity.",
        },
        priceDelta: null,
      });
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
