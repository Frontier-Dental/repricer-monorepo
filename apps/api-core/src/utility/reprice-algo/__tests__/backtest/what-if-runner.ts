import { BacktestRecord, WhatIfReport, WhatIfSample } from "./types";
import { replayRecord, replayRecordWithOverrides, ReplayResult } from "./replay-algo";
import { V2AlgoSettingsData } from "../../../../utility/mysql/v2-algo-settings";

/** AlgoResult values that indicate a price change was made */
const CHANGE_RESULTS = new Set(["CHANGE #UP", "CHANGE #DOWN", "CHANGE #NEW", "CHANGE #REMOVED"]);

function isChangeResult(result: string): boolean {
  return CHANGE_RESULTS.has(result.trim().toUpperCase());
}

/**
 * Run a what-if backtest: replay each record TWICE (original settings vs
 * modified settings) and report on differences.
 */
export async function runWhatIfBacktest(records: BacktestRecord[], overrides: Partial<V2AlgoSettingsData>): Promise<WhatIfReport> {
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
    const originalMatch = originalResults.find((r) => r.vendorId === record.vendorId && r.quantity === record.quantity);

    // Run with modified settings
    const modifiedResults = replayRecordWithOverrides(record, overrides);
    const modifiedMatch = modifiedResults.find((r) => r.vendorId === record.vendorId && r.quantity === record.quantity);

    // Compare
    const origResult = originalMatch?.algoResult ?? "NO_SOLUTION";
    const modResult = modifiedMatch?.algoResult ?? "NO_SOLUTION";
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
        priceDelta: origPrice !== null && modPrice !== null ? Number((modPrice - origPrice).toFixed(4)) : null,
      });
    }
  }

  const avgPriceDelta = priceDeltaCount > 0 ? Number((totalPriceDelta / priceDeltaCount).toFixed(4)) : 0;

  return {
    total: records.length,
    pricesChanged,
    avgPriceDelta,
    directionBreakdown,
    samples,
  };
}

// ─── Console output formatting ─────────────────────────────────────────

export function printWhatIfSummary(report: WhatIfReport, overrideDescription: string): void {
  console.log("\n" + "=".repeat(80));
  console.log("  WHAT-IF BACKTEST SUMMARY");
  console.log("=".repeat(80));
  console.log(`  Override: ${overrideDescription}`);
  console.log(`  Total records:     ${report.total}`);
  console.log(`  Prices changed:    ${report.pricesChanged} (${((report.pricesChanged / report.total) * 100).toFixed(1)}%)`);
  console.log(`  Avg price delta:   $${report.avgPriceDelta.toFixed(4)}`);
  console.log("");
  console.log("  Direction Breakdown:");
  console.log(`    Newly repriced:      ${report.directionBreakdown.newlyRepriced}`);
  console.log(`    No longer repriced:  ${report.directionBreakdown.noLongerRepriced}`);
  console.log(`    Priced higher:       ${report.directionBreakdown.pricedHigher}`);
  console.log(`    Priced lower:        ${report.directionBreakdown.pricedLower}`);
  console.log(`    Unchanged:           ${report.directionBreakdown.unchanged}`);
  console.log("=".repeat(80));

  if (report.samples.length > 0) {
    console.log("\n  SAMPLE CHANGES (first 10):");
    console.log("-".repeat(80));
    const displaySamples = report.samples.slice(0, 10);
    for (const s of displaySamples) {
      console.log(`    MpId=${s.mpId} V=${s.vendorId} Q=${s.quantity}: ` + `${s.original.algoResult} ($${s.original.suggestedPrice ?? "N/A"}) -> ` + `${s.modified.algoResult} ($${s.modified.suggestedPrice ?? "N/A"}) ` + `[delta: ${s.priceDelta !== null ? "$" + s.priceDelta.toFixed(2) : "N/A"}]`);
    }
  }

  console.log("");
}
