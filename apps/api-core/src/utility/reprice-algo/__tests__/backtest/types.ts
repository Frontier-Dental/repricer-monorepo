import { V2AlgoSettingsData } from "../../../../utility/mysql/v2-algo-settings";
import { Net32Product } from "../../../../types/net32";
import { VendorThreshold } from "../../v2/shipping-threshold";

// ─── Raw database row shapes ───────────────────────────────────────────

export interface HistoryRow {
  Id: number;
  RefTime: Date;
  MpId: number;
  ChannelName: string;
  ExistingPrice: number | null;
  MinQty: number;
  Position: number | null;
  LowestVendor: string | null;
  LowestPrice: number | null;
  SuggestedPrice: number | null;
  RepriceComment: string | null;
  MaxVendor: string | null;
  MaxVendorPrice: number | null;
  OtherVendorList: string | null;
  LinkedApiResponse: number;
  ContextCronName: string | null;
  TriggeredByVendor: string | null;
  RepriceResult: string | null;
}

export interface HistoryApiResponseRow {
  Id: number;
  RefTime: Date;
  ApiResponse: string; // JSON string of Net32Product[]
}

export interface V2AlgoResultRow {
  id: number;
  job_id: string;
  mp_id: number;
  vendor_id: number;
  quantity: number;
  suggested_price: number | null;
  comment: string;
  triggered_by_vendor: string | null;
  result: string; // AlgoResult enum value, e.g. "CHANGE #DOWN"
  cron_name: string;
  q_break_valid: boolean;
  price_update_result: string | null;
  new_price_breaks: string | null;
  lowest_price: number | null;
  lowest_vendor_id: number | null;
  created_at: Date;
}

// ─── Backtest data structures ──────────────────────────────────────────

export interface BacktestRecord {
  /** Unique identifier for this record (v2_algo_results.id or table_history.Id) */
  recordId: number;
  /** The job_id that groups all quantity solutions for one algo run */
  jobId: string;
  mpId: number;
  vendorId: number;
  quantity: number;
  timestamp: Date;
  cronName: string;

  /** The parsed Net32Product[] from the API response at decision time */
  apiResponse: Net32Product[];

  /** V2AlgoSettingsData that was active for this vendor+mpId at decision time */
  vendorSettings: V2AlgoSettingsData;

  /** Vendor shipping thresholds for all vendors in the API response */
  vendorThresholds: VendorThreshold[];

  /** V1 settings: FrontierProduct row from the vendor detail table (e.g., table_tradentDetails) */
  v1Settings: any | null;

  /** V2 settings for ALL own vendors for this mpId (used by replay to match production behavior) */
  allVendorSettings: V2AlgoSettingsData[];

  /** What the algo actually decided in production */
  historical: {
    algoResult: string;
    suggestedPrice: number | null;
    comment: string;
    triggeredByVendor: string | null;
    qBreakValid: boolean;
    lowestPrice: number | null;
    lowestVendorId: number | null;
    existingPrice: number | null;
    position: number | null;
    lowestVendor: string | null;
  };
}

// ─── Regression backtest output ────────────────────────────────────────

export interface BacktestDiff {
  recordId: number;
  mpId: number;
  vendorId: number;
  quantity: number;
  timestamp: Date;
  /** Market context at decision time */
  existingPrice: number | null;
  position: number | null;
  lowestPrice: number | null;
  lowestVendor: string | null;
  historical: {
    algoResult: string;
    suggestedPrice: number | null;
    comment: string;
  };
  current: {
    algoResult: string;
    suggestedPrice: number | null;
    comment: string;
  };
  priceDelta: number | null;
}

export interface BacktestResult {
  total: number;
  matches: number;
  diffs: BacktestDiff[];
  matchRate: number;
  executionTimeMs: number;
}

// ─── Product-level regression output ─────────────────────────────────

export interface ProductBacktestResult {
  total: number;
  matches: number;
  matchesV1: number;
  matchesV2: number;
  products: ProductDiff[];
  matchRate: number;
  matchRateV1: number;
  matchRateV2: number;
  executionTimeMs: number;
}

export interface ProductDiff {
  mpId: number;
  timestamp: Date;
  cronName: string;
  market: MarketVendor[];
  vendors: VendorDecision[];
  isMatch: boolean;
}

export interface MarketVendor {
  vendorId: number;
  vendorName: string;
  unitPrice: number | null;
  shipping: number | null;
  totalPrice: number | null;
  badgeName: string | null;
  inStock: boolean;
  inventory: number | null;
  freeShippingThreshold: number | null;
  isOwnVendor: boolean;
}

export interface VendorDecision {
  vendorId: number;
  existingPrice: number | null;
  position: number | null;
  historical: { algoResult: string; suggestedPrice: number | null; comment: string };
  currentV1: { algoResult: string; suggestedPrice: number | null; comment: string } | null;
  currentV2: { algoResult: string; suggestedPrice: number | null; comment: string };
  priceDeltaV1: number | null;
  priceDeltaV2: number | null;
  isMatchV1: boolean | null;
  isMatchV2: boolean;
  isMatch: boolean;
  settings: {
    up_down: string;
    floor_price: number;
    max_price: number;
    badge_indicator: string;
    price_strategy: string;
    reprice_up_percentage: number;
    reprice_down_percentage: number;
    keep_position: boolean;
    sister_vendor_ids: string;
    exclude_vendors: string;
    compete_with_all_vendors: boolean;
    handling_time_group: string;
    inventory_competition_threshold: number;
    enabled: boolean;
  };
}

// ─── What-if backtest output ───────────────────────────────────────────

export interface WhatIfReport {
  total: number;
  pricesChanged: number;
  avgPriceDelta: number;
  directionBreakdown: {
    newlyRepriced: number;
    noLongerRepriced: number;
    pricedHigher: number;
    pricedLower: number;
    unchanged: number;
  };
  samples: WhatIfSample[];
}

export interface WhatIfSample {
  mpId: number;
  vendorId: number;
  quantity: number;
  historical: { algoResult: string; suggestedPrice: number | null };
  currentV1: { algoResult: string; suggestedPrice: number | null } | null;
  original: { algoResult: string; suggestedPrice: number | null };
  modified: { algoResult: string; suggestedPrice: number | null };
  priceDelta: number | null;
}

// ─── Extract options ───────────────────────────────────────────────────

export interface ExtractOptions {
  dateFrom: Date;
  dateTo: Date;
  limit?: number;
  mpIds?: number[];
  vendorIds?: number[];
  cronName?: string;
  /** If true, use v2_algo_results as the source. If false, use table_history. Default: true */
  useV2Results?: boolean;
  /** If true, exclude SCRAPE-ONLY records from table_history (they have no algo decisions). Default: true */
  excludeScrapeOnly?: boolean;
}
