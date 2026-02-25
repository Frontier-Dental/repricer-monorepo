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
  const algoProducts: Net32AlgoProduct[] = apiResponse
    .filter((p) => Array.isArray(p.priceBreaks) && p.priceBreaks.length > 0)
    .map((p) => {
      const vid = typeof p.vendorId === "string" ? parseInt(p.vendorId, 10) : p.vendorId;
      const threshold = vendorThresholds.find((t) => t.vendorId === vid);
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
        freeShippingThreshold: threshold?.threshold ?? p.freeShippingThreshold ?? 999999,
      };
    });

  // Determine which of our vendors are "non-422" (i.e., available).
  const non422VendorIds = ALL_OWN_VENDOR_IDS.filter((id) => algoProducts.find((p) => p.vendorId === id));

  // Build the vendorSettings array. repriceProductV2 expects settings for
  // ALL own vendors present in the data.
  const allVendorSettings: V2AlgoSettingsData[] = non422VendorIds.map((vid) => {
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
      up_down: "UP/DOWN" as any,
      badge_indicator: "ALL" as any,
      execution_priority: 99,
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
    };
  });

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
  const modifiedRecord: BacktestRecord = {
    ...record,
    vendorSettings: {
      ...record.vendorSettings,
      ...overrides,
    },
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

  try {
    // Clone settings to avoid mutating the original
    const productItem = { ...v1Settings };
    // Prevent DB calls in isOverrideEnabledForProduct
    productItem.override_bulk_update = false;
    productItem.isSlowCronRun = false;
    productItem.allowReprice = true;

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
    console.warn(`[backtest] V1 replay error for record ${record.recordId} (mpId=${mpId}):`, err);
    return {
      mpId,
      vendorId,
      quantity: record.quantity,
      algoResult: "ERROR",
      suggestedPrice: null,
      comment: `V1 replay error: ${err instanceof Error ? err.message : String(err)}`,
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
      return {
        mpId,
        vendorId,
        quantity,
        algoResult: mapV1ExplainedToAlgoResult(matchingBreak.explained),
        suggestedPrice: parseV1Price(matchingBreak.newPrice),
        comment: matchingBreak.explained || "",
        triggeredByVendor: matchingBreak.triggeredByVendor ?? null,
        qBreakValid: true,
      };
    }
  }

  // Single price break or fallback
  if (repriceResult.repriceDetails) {
    const rd = repriceResult.repriceDetails;
    return {
      mpId,
      vendorId,
      quantity,
      algoResult: mapV1ExplainedToAlgoResult(rd.explained),
      suggestedPrice: parseV1Price(rd.newPrice),
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

function mapV1ExplainedToAlgoResult(explained: string | null): string {
  if (!explained) return "NO_SOLUTION";
  const upper = explained.toUpperCase();

  // V1 uses tags like REPRICE_DEFAULT, PRICE_UP_NEXT, NO_COMPETITOR, etc.
  // plus hash annotations: #HitFloor, $UP, $DOWN, #NCBuyBox, #SISTERSAMEPRICE
  if (upper.includes("REPRICE_DEFAULT") || upper.includes("PRICE_UP") || upper.includes("PRICE_MAXED")) {
    if (upper.includes("$DOWN") || upper.includes("#DOWN")) return "CHANGE #DOWN";
    if (upper.includes("$UP") || upper.includes("#UP") || upper.includes("#NEW")) return "CHANGE #UP";
    if (upper.includes("MAXED")) return "CHANGE #UP";
    return "CHANGE #DOWN";
  }
  if (upper.includes("NO_COMPETITOR") && upper.includes("SISTER")) return "IGNORE #SISTER";
  if (upper.includes("NO_COMPETITOR")) return "NO_SOLUTION";
  if (upper.includes("IGNORE") || upper.includes("SHUT_DOWN") || upper.includes("OFFSET_LESS_THAN_FLOOR")) {
    if (upper.includes("#HITFLOOR") || upper.includes("#FLOOR") || upper.includes("FLOOR")) return "IGNORE #FLOOR";
    if (upper.includes("#SISTER") || upper.includes("SISTER")) return "IGNORE #SISTER";
    if (upper.includes("LOWEST") || upper.includes("OWN")) return "IGNORE #LOWEST";
    return "IGNORE #OTHER";
  }
  if (upper.includes("INACTIVE") || upper.includes("NOT_FOUND") || upper.includes("NOT IN STOCK")) return "NO_SOLUTION";

  return "NO_SOLUTION";
}
