import { Net32PriceBreak } from "../../../types/net32";
import { Decimal } from "decimal.js";

export interface Net32AlgoProduct {
  vendorId: number;
  vendorName: string;
  inStock: boolean;
  standardShipping: number;
  shippingTime: number;
  inventory: number;
  badgeId: number;
  badgeName: string | null;
  priceBreaks: Net32PriceBreak[];
  freeShippingGap: number;
  freeShippingThreshold: number;
}

export interface Net32AlgoProductWithBestPrice extends Net32AlgoProduct {
  bestPrice?: Decimal | null;
}

export interface Net32AlgoProductWrapper {
  product: Net32AlgoProduct | Net32AlgoProductWithBestPrice;
  totalCost: Decimal;
  effectiveUnitPrice?: Decimal | null;
  hasBadge: boolean;
  shippingBucket: number;
}

export interface Net32AlgoProductWrapperWithBuyBoxRank
  extends Net32AlgoProductWrapper {
  buyBoxRank: number;
}

export interface InternalProduct {
  ownVendorId: number;
  ownVendorName: string;
  floorPrice: number;
  maxPrice: number;
  priority: number;
  net32url?: string;
}

export enum ChangeResult {
  OK = "OK",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  ERROR_422 = "ERROR_422",
  NOT_EXECUTION_PRIORITY = "NOT_EXECUTION_PRIORITY",
}

export enum AlgoResult {
  CHANGE_UP = "CHANGE #UP",
  CHANGE_NEW = "CHANGE #NEW",
  CHANGE_DOWN = "CHANGE #DOWN",
  IGNORE_FLOOR = "IGNORE #FLOOR",
  IGNORE_LOWEST = "IGNORE #LOWEST",
  IGNORE_SISTER_LOWEST = "IGNORE #SISTER_LOWEST",
  IGNORE_SETTINGS = "IGNORE #SETTINGS",
  ERROR = "ERROR",
}

export enum QbreakInvalidReason {
  SUPPRESS_BECAUSE_Q1_NOT_UPDATED = "SUPPRESS_BECAUSE_Q1_NOT_UPDATED",
  UNNECESSARY = "UNNECESSARY",
}
