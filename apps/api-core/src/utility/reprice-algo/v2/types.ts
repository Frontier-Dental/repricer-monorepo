import { Net32PriceBreak } from "../../../types/net32";

export interface PriceSolutionWithRanks {
  vendorPrices: { vendorId: number; price: number }[];
  combination: SimplifiedNet32ProductFreeShippingAlgo[];
  totalRank: number;
  buyBoxRankFreeShipping: number;
  buyBoxRankIncludingShipping: number;
}

export interface AggregatePriceSolution {
  vendorPrices: {
    vendorId: number;
    price: number;
  }[];
  consideredConfigurations: number;
  solutions: PriceSolutionWithRanks;
  totalRank: number;
  averagePrice: number;
}

export interface SimplifiedNet32Product {
  vendorId: number;
  vendorName: string;
  inStock: boolean;
  standardShipping: number;
  shippingTime: number;
  badgeId: number;
  badgeName: string | null;
  priceBreaks: Net32PriceBreak[];
  freeShippingGap: number;
}

export interface SimplifiedNet32ProductFreeShippingAlgo
  extends SimplifiedNet32Product {
  freeShipping: boolean;
}

export interface InternalProduct {
  ownVendorId: number;
  ownVendorName: string;
  floorPrice: number;
  maxPrice: number;
  priority: number;
  net32url?: string;
}

export interface ExistingAnalytics {
  [quantity: number]: {
    beforeShippingLadder: SimplifiedNet32Product[];
    beforeNonShippingLadder: SimplifiedNet32Product[];
    beforeOwnShippingRank: number;
    beforeOwnNonShippingRank: number;
    beforeOwnAveragePrice: number;
    afterShippingLadder?: SimplifiedNet32Product[];
    afterNonShippingLadder?: SimplifiedNet32Product[];
    afterOwnShippingRank?: number;
    afterOwnNonShippingRank?: number;
    afterOwnAveragePrice?: number;
  };
}

export interface PriceSolutions {
  [quantity: number]: AggregatePriceSolution[];
}

export enum VendorName {
  FRONTIER = "FRONTIER",
  MVP = "MVP",
  TRADENT = "TRADENT",
  FIRSTDENT = "FIRSTDENT",
  TOPDENT = "TOPDENT",
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
