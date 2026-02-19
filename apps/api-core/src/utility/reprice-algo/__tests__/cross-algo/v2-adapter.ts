import { AlgoBadgeIndicator, AlgoHandlingTimeGroup, AlgoPriceDirection, AlgoPriceStrategy } from "@repricer-monorepo/shared";
import { repriceProductV2 } from "../../v2/algorithm";
import { AlgoResult } from "../../v2/types";
import { V2AlgoSettingsData } from "../../../../utility/mysql/v2-algo-settings";
import { VendorThreshold } from "../../v2/shipping-threshold";
import { AlgoInput, AlgoRunner, NormalizedCategory, NormalizedDecision, VendorConfig } from "./normalized-types";

/**
 * Maps V2 AlgoResult enum values to normalized categories.
 */
function mapAlgoResultToCategory(result: AlgoResult): NormalizedCategory {
  switch (result) {
    case AlgoResult.CHANGE_UP:
      return "CHANGE_UP";
    case AlgoResult.CHANGE_DOWN:
      return "CHANGE_DOWN";
    case AlgoResult.CHANGE_NEW:
      return "CHANGE_NEW";
    case AlgoResult.CHANGE_REMOVED:
      return "CHANGE_REMOVED";
    case AlgoResult.IGNORE_FLOOR:
      return "IGNORE_FLOOR";
    case AlgoResult.IGNORE_LOWEST:
      return "IGNORE_LOWEST";
    case AlgoResult.IGNORE_SISTER_LOWEST:
      return "IGNORE_SISTER";
    case AlgoResult.IGNORE_SETTINGS:
      return "IGNORE_SETTINGS";
    case AlgoResult.IGNORE_SHORT_EXPIRY:
      return "IGNORE_EXPIRY";
    case AlgoResult.ERROR:
      return "ERROR";
    default:
      return "ERROR";
  }
}

/**
 * Extracts tags from AlgoResult string (e.g. "CHANGE #UP" -> ["#UP"]).
 */
function extractTagsFromAlgoResult(result: AlgoResult): string[] {
  const tags: string[] = [];
  const match = result.match(/#\w+/g);
  if (match) {
    tags.push(...match);
  }
  return tags;
}

/**
 * Convert a common VendorConfig to V2's V2AlgoSettingsData.
 */
function vendorConfigToV2Settings(mpId: number, config: VendorConfig): V2AlgoSettingsData {
  let upDown: AlgoPriceDirection;
  switch (config.direction) {
    case "UP":
      upDown = AlgoPriceDirection.UP;
      break;
    case "DOWN":
      upDown = AlgoPriceDirection.DOWN;
      break;
    case "UP_DOWN":
    default:
      upDown = AlgoPriceDirection.UP_DOWN;
      break;
  }

  let priceStrategy: AlgoPriceStrategy;
  switch (config.priceStrategy) {
    case "TOTAL":
      priceStrategy = AlgoPriceStrategy.TOTAL;
      break;
    case "BUY_BOX":
      priceStrategy = AlgoPriceStrategy.BUY_BOX;
      break;
    case "UNIT":
    default:
      priceStrategy = AlgoPriceStrategy.UNIT;
      break;
  }

  return {
    mp_id: mpId,
    vendor_id: config.vendorId,
    suppress_price_break_if_Q1_not_updated: false,
    suppress_price_break: false,
    compete_on_price_break_only: false,
    up_down: upDown,
    badge_indicator: AlgoBadgeIndicator.ALL,
    execution_priority: 0,
    reprice_up_percentage: -1,
    compare_q2_with_q1: false,
    compete_with_all_vendors: config.competeWithAllVendors,
    reprice_up_badge_percentage: -1,
    sister_vendor_ids: config.sisterVendorIds,
    exclude_vendors: config.excludeVendors,
    inactive_vendor_id: "",
    handling_time_group: AlgoHandlingTimeGroup.ALL,
    keep_position: false,
    inventory_competition_threshold: config.inventoryCompetitionThreshold,
    reprice_down_percentage: -1,
    max_price: config.maxPrice,
    floor_price: config.floorPrice,
    reprice_down_badge_percentage: -1,
    floor_compete_with_next: config.floorCompeteWithNext,
    own_vendor_threshold: config.ownVendorThreshold,
    price_strategy: priceStrategy,
    enabled: config.enabled,
  };
}

/**
 * Build VendorThreshold objects from input data.
 */
function buildVendorThresholds(input: AlgoInput): VendorThreshold[] {
  return input.net32Products.map((p) => ({
    vendorId: p.vendorId,
    standardShipping: p.standardShipping,
    threshold: p.freeShippingThreshold,
  }));
}

export class V2Adapter implements AlgoRunner {
  name = "V2";

  async run(input: AlgoInput): Promise<NormalizedDecision[]> {
    const vendorSettings = input.vendorConfigs.filter((vc) => input.allOwnVendorIds.includes(vc.vendorId)).map((vc) => vendorConfigToV2Settings(input.mpId, vc));

    const vendorThresholds = buildVendorThresholds(input);

    const results = repriceProductV2(input.mpId, input.net32Products, input.non422VendorIds, input.allOwnVendorIds, vendorSettings, "test-job-id", input.isSlowCron, `https://www.net32.com/rest/marketplace/product/${input.mpId}`, vendorThresholds);

    return results.map((r) => {
      const vendorProduct = input.net32Products.find((p) => p.vendorId === r.vendor.vendorId);
      const existingPrice = vendorProduct?.priceBreaks.filter((pb) => pb.minQty <= r.quantity).sort((a, b) => b.minQty - a.minQty)[0]?.unitPrice ?? 0;

      const category = mapAlgoResultToCategory(r.algoResult);
      const shouldChange = category.startsWith("CHANGE");

      return {
        vendorId: r.vendor.vendorId,
        quantity: r.quantity,
        existingPrice,
        suggestedPrice: r.suggestedPrice,
        shouldChange,
        category,
        tags: extractTagsFromAlgoResult(r.algoResult),
        rawExplained: `${r.algoResult}: ${r.comment}`,
      };
    });
  }
}
