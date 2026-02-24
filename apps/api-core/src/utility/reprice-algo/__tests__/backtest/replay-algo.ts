import { VendorId } from "@repricer-monorepo/shared";
import { repriceProductV2 } from "../../v2/algorithm";
import { Net32AlgoProduct } from "../../v2/types";
import { V2AlgoSettingsData } from "../../../../utility/mysql/v2-algo-settings";
import { VendorThreshold } from "../../v2/shipping-threshold";
import { Net32Product } from "../../../../types/net32";
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
