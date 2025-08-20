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
  effectiveUnitPrice: Decimal;
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

export enum VendorName {
  FRONTIER = "FRONTIER",
  MVP = "MVP",
  TRADENT = "TRADENT",
  FIRSTDENT = "FIRSTDENT",
  TOPDENT = "TOPDENT",
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

export enum VendorId {
  FRONTIER = 20722,
  TRADENT = 17357,
  MVP = 20755,
  TOPDENT = 20727,
  FIRSTDENT = 20533,
}

export const VendorNameLookup: Record<number, VendorName> = {
  [VendorId.FRONTIER]: VendorName.FRONTIER,
  [VendorId.TRADENT]: VendorName.TRADENT,
  [VendorId.MVP]: VendorName.MVP,
  [VendorId.TOPDENT]: VendorName.TOPDENT,
  [VendorId.FIRSTDENT]: VendorName.FIRSTDENT,
};

export const VendorIdLookup: Record<VendorName, VendorId> = {
  [VendorName.FRONTIER]: VendorId.FRONTIER,
  [VendorName.TRADENT]: VendorId.TRADENT,
  [VendorName.MVP]: VendorId.MVP,
  [VendorName.TOPDENT]: VendorId.TOPDENT,
  [VendorName.FIRSTDENT]: VendorId.FIRSTDENT,
};
