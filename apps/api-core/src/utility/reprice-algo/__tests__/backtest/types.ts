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

  /** What the algo actually decided in production */
  historical: {
    algoResult: string;
    suggestedPrice: number | null;
    comment: string;
    triggeredByVendor: string | null;
    qBreakValid: boolean;
    lowestPrice: number | null;
    lowestVendorId: number | null;
  };
}

// ─── Regression backtest output ────────────────────────────────────────

export interface BacktestDiff {
  recordId: number;
  mpId: number;
  vendorId: number;
  quantity: number;
  timestamp: Date;
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
}
