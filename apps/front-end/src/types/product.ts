export interface ProductDetails {
  ProductIdentifier: number;
  ProductId: number;
  ProductName: string | null;
  Net32Url: string;
  ScrapeOnlyActive: number;
  LinkedScrapeOnlyCron: string;
  LinkedScrapeOnlyCronId: string;
  RegularCronName: string;
  RegularCronId: string;
  SlowCronName: string | null;
  SlowCronId: string | null;
  IsSlowActivated: number;
  IsBadgeItem: number;
  Id: number;
  ChannelName: string;
  ScrapeOn: number;
  AllowReprice: number;
  Activated: number;
  UnitPrice: string;
  FocusId: string | null;
  RequestInterval: number;
  FloorPrice: string;
  MaxPrice: string;
  ChannelId: string;
  CreatedAt: string | null;
  UpdatedAt: string;
  UpdatedBy: string;
  LastCronTime: string;
  LastUpdateTime: string;
  LastAttemptedTime: string;
  IsNCNeeded: number;
  RepricingRule: number;
  RequestIntervalUnit: string;
  SuppressPriceBreak: number;
  PriorityValue: number;
  LastCronMessage: string;
  LowestVendor: string;
  LowestVendorPrice: string;
  LastExistingPrice: string;
  LastSuggestedPrice: string;
  NextCronTime: string | null;
  BeatQPrice: number;
  CompeteAll: number;
  PercentageIncrease: number;
  SuppressPriceBreakForOne: number;
  CompareWithQ1: number;
  WaitUpdatePeriod: number;
  LastCronRun: string;
  AbortDeactivatingQPriceBreak: number;
  BadgeIndicator: string;
  BadgePercentage: number;
  LastUpdatedBy: string;
  InactiveVendorId: string;
  IncludeInactiveVendors: number;
  OverrideBulkRule: number;
  OverrideBulkUpdate: number;
  LatestPrice: number;
  ExecutionPriority: number;
  ApplyBuyBoxLogic: number;
  ApplyNcForBuyBox: number;
  MpId: number;
  SisterVendorId: string;
  HandlingTimeFilter: string;
  KeepPosition: string | null;
  InventoryThreshold: number;
  ExcludedVendors: string;
  BadgePercentageDown: string;
  PercentageDown: string;
  CompeteWithNext: number;
  TriggeredByVendor: string | null;
  IgnorePhantomBreak: number;
  OwnVendorThreshold: number;
  RepriceResult: string | null;
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
