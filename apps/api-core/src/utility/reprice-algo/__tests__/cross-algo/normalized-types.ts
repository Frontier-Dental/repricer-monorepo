/**
 * Normalized category that abstracts away V1's freeform strings and V2's enum.
 * Each category maps to a semantic decision class.
 */
export type NormalizedCategory = "CHANGE_UP" | "CHANGE_DOWN" | "CHANGE_NEW" | "CHANGE_REMOVED" | "IGNORE_FLOOR" | "IGNORE_LOWEST" | "IGNORE_SISTER" | "IGNORE_SETTINGS" | "IGNORE_BUYBOX" | "IGNORE_EXPIRY" | "IGNORE_OTHER" | "ERROR";

/**
 * A single pricing decision in a common format.
 * Both V1 and V2 adapters produce arrays of these.
 */
export interface NormalizedDecision {
  /** The vendor ID this decision applies to */
  vendorId: number;
  /** The quantity break (minQty) this decision applies to */
  quantity: number;
  /** The existing unit price before any change */
  existingPrice: number;
  /** The suggested new unit price, or null if no change */
  suggestedPrice: number | null;
  /** Whether a price change should be executed */
  shouldChange: boolean;
  /** The semantic category of this decision */
  category: NormalizedCategory;
  /** Raw tags/annotations from the algo (e.g. "#HitFloor", "#Sister") */
  tags: string[];
  /** The raw explanation string from the original algo */
  rawExplained: string;
}

/**
 * Common input format for running any algo.
 * Adapters translate this into whatever their algo needs.
 */
export interface AlgoInput {
  /** Net32 marketplace product ID */
  mpId: number;
  /**
   * Raw Net32 API product data. Use the Net32AlgoProduct shape
   * (V2 format) as the canonical input -- V1 adapter translates internally.
   */
  net32Products: Net32AlgoProductInput[];
  /** All vendor IDs that belong to "our" company */
  allOwnVendorIds: number[];
  /** Vendor IDs that are not in a 422 error state */
  non422VendorIds: number[];
  /** Per-vendor configuration. Adapters map these to their native config format. */
  vendorConfigs: VendorConfig[];
  /** Whether this is a slow cron run */
  isSlowCron: boolean;
}

/**
 * Vendor-level configuration in a common format.
 * Covers the union of V1's FrontierProduct fields and V2's V2AlgoSettingsData.
 */
export interface VendorConfig {
  vendorId: number;
  vendorName: string;
  floorPrice: number;
  maxPrice: number;
  /** V1: repricingRule (0=UP, 1=DOWN, 2=BOTH). V2: AlgoPriceDirection enum. */
  direction: "UP" | "DOWN" | "UP_DOWN";
  /** V2-specific: price strategy. V1 defaults to 'UNIT'. */
  priceStrategy: "UNIT" | "TOTAL" | "BUY_BOX";
  enabled: boolean;
  /** Comma-separated sister vendor IDs */
  sisterVendorIds: string;
  /** Comma-separated excluded vendor IDs */
  excludeVendors: string;
  /** Whether to compete with all vendors including sisters */
  competeWithAllVendors: boolean;
  /** Floor compete with next: when at floor, try to compete with next vendor */
  floorCompeteWithNext: boolean;
  /** Inventory threshold for own vendor */
  ownVendorThreshold: number;
  /** Inventory competition threshold for competitors */
  inventoryCompetitionThreshold: number;
  /** Standard shipping cost for this vendor */
  standardShipping: number;
  /** Free shipping threshold */
  freeShippingThreshold: number;
}

/**
 * Net32 product data in the canonical format (matches V2's Net32AlgoProduct).
 * V1 adapter converts this to V1's Net32Product internally.
 */
export interface Net32AlgoProductInput {
  vendorId: number;
  vendorName: string;
  inStock: boolean;
  standardShipping: number;
  shippingTime: number;
  inventory: number;
  badgeId: number;
  badgeName: string | null;
  priceBreaks: { minQty: number; unitPrice: number }[];
  freeShippingGap: number;
  freeShippingThreshold: number;
}

/**
 * The interface that any algorithm version must implement.
 * Implementing this grants access to all universal tests via `runSharedAlgoTests()`.
 */
export interface AlgoRunner {
  /** Human-readable name for test output (e.g. "V1", "V2", "V3-experimental") */
  name: string;
  /** Execute the algorithm and return normalized decisions */
  run(input: AlgoInput): Promise<NormalizedDecision[]>;
}
