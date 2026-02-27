import { VendorId, VendorNameLookup } from "@repricer-monorepo/shared";
import { repriceProductV2 } from "../../v2/algorithm";
import { repriceProduct as repriceProductV1 } from "../../v1/algo-v1";
import { Net32AlgoProduct } from "../../v2/types";
import { V2AlgoSettingsData } from "../../../../utility/mysql/v2-algo-settings";
import { VendorThreshold } from "../../v2/shipping-threshold";
import { Net32Product } from "../../../../types/net32";
import { RepriceModel } from "../../../../model/reprice-model";
import { BacktestRecord } from "./types";

/**
 * Hardcoded sister vendor ID lists by own vendor.
 * Mirrors format-wrapper.ts → SetGlobalDetails().
 * Pre-setting these ensures globalParam.GetInfo() always short-circuits
 * and never falls through to GetGlobalConfig() DB call (which may return
 * undefined excludedSisterVendors).
 */
const SISTER_VENDOR_MAP: Record<number, string> = {
  [VendorId.TRADENT]: "20722;20755;20533;20727;5;20891",
  [VendorId.FRONTIER]: "17357;20755;20533;20727;5;20891",
  [VendorId.MVP]: "17357;20722;20533;20727;5;20891",
  [VendorId.TOPDENT]: "17357;20722;20533;20755;5;20891",
  [VendorId.FIRSTDENT]: "17357;20722;20755;20727;5;20891",
  [VendorId.TRIAD]: "17357;20722;20755;20727;20533;20891",
  [VendorId.BITESUPPLY]: "17357;20722;20755;20727;20533;5",
};

/**
 * All own vendor IDs in the system.
 * Mirrors utility/reprice-algo/v2/utility.ts -> getAllOwnVendorIds()
 */
export const ALL_OWN_VENDOR_IDS: number[] = [VendorId.TRADENT, VendorId.FRONTIER, VendorId.MVP, VendorId.TOPDENT, VendorId.FIRSTDENT, VendorId.TRIAD, VendorId.BITESUPPLY];

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
  const { apiResponse, vendorSettings, vendorThresholds, mpId, vendorId } = record;

  // Convert Net32Product[] to Net32AlgoProduct[]
  // Don't filter out products without priceBreaks — the algo does its own filtering
  // (mirrors production wrapper.ts which passes ALL products via `...p` spread)
  const algoProducts: Net32AlgoProduct[] = apiResponse.map((p) => {
    const vid = typeof p.vendorId === "string" ? parseInt(p.vendorId, 10) : p.vendorId;
    const threshold = vendorThresholds.find((t) => t.vendorId === vid);
    return {
      vendorId: vid,
      vendorName: p.vendorName,
      inStock: p.inStock,
      // Production uses `...p` spread which keeps the API response's standardShipping.
      // Do NOT override from vendor_thresholds — only freeShippingThreshold gets overridden.
      standardShipping: p.standardShipping,
      shippingTime: p.shippingTime,
      inventory: p.inventory,
      badgeId: p.badgeId ?? 0,
      badgeName: p.badgeName ?? null,
      priceBreaks: p.priceBreaks ?? [],
      freeShippingGap: p.freeShippingGap,
      freeShippingThreshold: threshold?.threshold ?? p.freeShippingThreshold ?? 999999,
    };
  });

  // Determine which of our vendors are "non-422" (i.e., available).
  const non422VendorIds = ALL_OWN_VENDOR_IDS.filter((id) => algoProducts.find((p) => p.vendorId === id));

  // Use real vendor settings from the DB (loaded in extract-data.ts for ALL own vendors).
  // This mirrors production's findOrCreateV2AlgoSettingsForVendors() which loads settings
  // for every own vendor, not just the current one.
  const allVendorSettings: V2AlgoSettingsData[] = record.allVendorSettings;

  // Run the algo
  const isSlowCron = record.cronName.toLowerCase().includes("slow");
  const jobId = `backtest-${record.recordId}`;
  const net32url = `https://www.net32.com/rest/neo/pdp/${mpId}/vendor-options`;

  try {
    const solutions = repriceProductV2(mpId, algoProducts, non422VendorIds, ALL_OWN_VENDOR_IDS, allVendorSettings, jobId, isSlowCron, net32url, vendorThresholds);

    return solutions.map((s) => ({
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
    console.warn(`[backtest] Error replaying record ${record.recordId} (mpId=${mpId}):`, err);
    return [
      {
        mpId,
        vendorId,
        quantity: record.quantity,
        algoResult: "ERROR",
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
export function replayRecordWithOverrides(record: BacktestRecord, overrides: Partial<V2AlgoSettingsData>): ReplayResult[] {
  const modifiedSettings = { ...record.vendorSettings, ...overrides };
  const modifiedRecord: BacktestRecord = {
    ...record,
    vendorSettings: modifiedSettings,
    // Also update this vendor's entry in allVendorSettings so replayRecord uses the overrides
    allVendorSettings: record.allVendorSettings.map((s) => (s.vendor_id === record.vendorId ? modifiedSettings : s)),
  };
  return replayRecord(modifiedRecord);
}

// ─── V1 Replay ──────────────────────────────────────────────────────────

/**
 * Replay a single BacktestRecord through the current V1 algo (repriceProduct with dryRun).
 * Returns a ReplayResult or null if V1 settings are not available.
 */
export async function replayRecordV1(record: BacktestRecord): Promise<ReplayResult | null> {
  const { apiResponse, v1Settings, mpId, vendorId } = record;

  if (!v1Settings) return null;

  const vendorName = VendorNameLookup[vendorId];
  if (!vendorName) return null;

  // Pre-check: own vendor must exist in API response with a minQty=1 price break.
  // The V1 algo does priceBreaks.find(x => x.minQty == 1).unitPrice without null checks,
  // which throws TypeError if no minQty=1 break exists.
  const ownInResponse = apiResponse.find((p) => String(p.vendorId) === String(vendorId));
  if (ownInResponse) {
    const hasQ1 = Array.isArray(ownInResponse.priceBreaks) && ownInResponse.priceBreaks.some((pb) => pb.minQty == 1);
    if (!hasQ1) {
      return {
        mpId,
        vendorId,
        quantity: record.quantity,
        algoResult: "SKIP",
        suggestedPrice: null,
        comment: "Own vendor has no minQty=1 price break (would crash V1 algo)",
        triggeredByVendor: null,
        qBreakValid: false,
      };
    }
  }

  try {
    // Clone settings to avoid mutating the original
    const productItem = { ...v1Settings };
    // Set isSlowCronRun based on the cron name (same logic as V2 replay).
    // This is important: slow cron runs always enable override rules (isOverrideEnabledForProduct returns true).
    productItem.isSlowCronRun = record.cronName.toLowerCase().includes("slow");
    // Force override_bulk_update false to prevent isOverrideEnabledForProduct() from
    // calling GetGlobalConfig() → CacheClient → Encrypto.decrypt(CACHE_PASSWORD).
    // CACHE_PASSWORD is optional in config and may be undefined in dev, causing a crash.
    // Slow crons are unaffected (isOverrideEnabledForProduct returns true before the DB call).
    productItem.override_bulk_update = false;
    productItem.allowReprice = true;

    // Pre-set ownVendorId and sisterVendorId so globalParam.GetInfo() always
    // short-circuits and NEVER falls through to GetGlobalConfig() DB call.
    // The V1 algo calls GetInfo() at 9+ locations; if any call falls through,
    // GetGlobalConfig() may return undefined excludedSisterVendors → .split(";") crash.
    // SetGlobalDetails also sets these, but pre-setting guarantees the short-circuit.
    productItem.ownVendorId = String(vendorId);
    productItem.sisterVendorId = SISTER_VENDOR_MAP[vendorId] || "";

    const result = await repriceProductV1(String(mpId), apiResponse, productItem, vendorName, { dryRun: true });

    if (!result || !result.repriceResult) {
      return {
        mpId,
        vendorId,
        quantity: record.quantity,
        algoResult: "NO_SOLUTION",
        suggestedPrice: null,
        comment: "V1 replay produced no result",
        triggeredByVendor: null,
        qBreakValid: false,
      };
    }

    return mapV1RepriceModelToReplayResult(mpId, vendorId, record.quantity, result.repriceResult);
  } catch (err) {
    const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.warn(`[backtest] V1 replay error for record ${record.recordId} (mpId=${mpId}):`, stack);
    return {
      mpId,
      vendorId,
      quantity: record.quantity,
      algoResult: "ERROR",
      suggestedPrice: null,
      comment: `V1 replay error: ${stack}`,
      triggeredByVendor: null,
      qBreakValid: false,
    };
  }
}

function mapV1RepriceModelToReplayResult(mpId: number, vendorId: number, quantity: number, repriceResult: RepriceModel): ReplayResult {
  // Multi-price-break: find the matching quantity
  if (repriceResult.isMultiplePriceBreakAvailable && repriceResult.listOfRepriceDetails.length > 0) {
    const matchingBreak = repriceResult.listOfRepriceDetails.find((rd: any) => rd.minQty === quantity);
    if (matchingBreak) {
      const oldP = parseV1Price(matchingBreak.oldPrice);
      const newP = parseV1Price(matchingBreak.newPrice);
      return {
        mpId,
        vendorId,
        quantity,
        algoResult: mapV1ExplainedToAlgoResult(matchingBreak.explained, oldP, newP),
        suggestedPrice: newP,
        comment: matchingBreak.explained || "",
        triggeredByVendor: matchingBreak.triggeredByVendor ?? null,
        qBreakValid: true,
      };
    }
  }

  // Single price break or fallback
  if (repriceResult.repriceDetails) {
    const rd = repriceResult.repriceDetails;
    const oldP = parseV1Price(rd.oldPrice);
    const newP = parseV1Price(rd.newPrice);
    return {
      mpId,
      vendorId,
      quantity,
      algoResult: mapV1ExplainedToAlgoResult(rd.explained, oldP, newP),
      suggestedPrice: newP,
      comment: rd.explained || "",
      triggeredByVendor: rd.triggeredByVendor ?? null,
      qBreakValid: true,
    };
  }

  return {
    mpId,
    vendorId,
    quantity,
    algoResult: "NO_SOLUTION",
    suggestedPrice: null,
    comment: "No repriceDetails in V1 result",
    triggeredByVendor: null,
    qBreakValid: false,
  };
}

function parseV1Price(price: string | number | null): number | null {
  if (price === null || price === undefined || price === "N/A") return null;
  const num = typeof price === "number" ? price : parseFloat(price);
  return isNaN(num) ? null : num;
}

/**
 * Map V1 algo `explained` string to a normalized AlgoResult category.
 *
 * V1 uses RepriceRenewedMessageEnum values like "CHANGE: updated", "IGNORE: #Sister",
 * "CHANGE: #BB_BADGE", etc. — NOT the raw enum names like "REPRICE_DEFAULT".
 *
 * The $UP/$DOWN direction is appended AFTER dry-run exit, so we pass oldPrice/newPrice
 * to determine direction from the price change.
 */
function mapV1ExplainedToAlgoResult(explained: string | null, oldPrice?: number | null, newPrice?: number | null): string {
  if (!explained) return "NO_SOLUTION";
  const upper = explained.toUpperCase();

  // CHANGE results: starts with "CHANGE:" or "CHANGE " or "PRICE CHANGE"
  if (upper.startsWith("CHANGE") || upper.includes("PRICE CHANGE")) {
    // Determine direction from $UP/$DOWN tags if present, otherwise from prices
    if (upper.includes("$DOWN") || upper.includes("#DOWN")) return "CHANGE #DOWN";
    if (upper.includes("$UP") || upper.includes("#UP") || upper.includes("#NEW")) return "CHANGE #UP";
    if (upper.includes("MAXED")) return "CHANGE #UP";
    // No direction tags (dry-run) — determine from prices
    if (oldPrice != null && newPrice != null) {
      if (newPrice < oldPrice) return "CHANGE #DOWN";
      if (newPrice > oldPrice) return "CHANGE #UP";
    }
    return "CHANGE #DOWN"; // default
  }

  // IGNORE results: starts with "IGNORE" or contains "IGNORE"
  if (upper.startsWith("IGNORE") || upper.includes("IGNORE")) {
    if (upper.includes("#HITFLOOR") || upper.includes("#FLOOR") || upper.includes("FLOOR")) return "IGNORE #FLOOR";
    if (upper.includes("#SISTER") || upper.includes("SISTER")) return "IGNORE #SISTER";
    if (upper.includes("#LOWEST") || upper.includes("LOWEST") || upper.includes("NO CHANGE")) return "IGNORE #LOWEST";
    if (upper.includes("#KEEPPOSITION") || upper.includes("KEEP POSITION")) return "IGNORE #OTHER";
    if (upper.includes("#HASBUYBOX") || upper.includes("BUY BOX")) return "IGNORE #OTHER";
    if (upper.includes("NO COMPETITOR")) return "IGNORE #OTHER";
    if (upper.includes("NOT FOUND") || upper.includes("NOT IN STOCK") || upper.includes("INACTIVE")) return "NO_SOLUTION";
    return "IGNORE #OTHER";
  }

  // N/A or empty
  if (upper === "N/A" || upper === "") return "NO_SOLUTION";

  return "NO_SOLUTION";
}
