// Define types for the function parameters where possible
export interface RunInfo {
  CronName: string;
  CronId: string;
  RunStartTime: Date | string;
  RunId: string;
  KeyGenId: string;
  RunType: string;
  ProductCount: number;
  EligibleCount: number;
  ScrapedSuccessCount: number;
  ScrapedFailureCount: number;
}

export interface ProductInfo {
  LinkedCronInfo: number;
  Mpid: string;
  VendorProductId: string;
  VendorProductCode: string;
  VendorName: string;
  VendorRegion: string;
  InStock: number;
  StandardShipping: number;
  StandardShippingStatus: string;
  FreeShippingGap: number;
  ShippingTime: number;
  IsFulfillmentPolicyStock: number;
  IsBackordered: number;
  BadgeId: number;
  BadgeName: string;
  ArrivalBusinessDays: number;
  ItemRank: number;
  IsOwnVendor: number;
  VendorId: string;
  HeavyShippingStatus: string;
  HeavyShipping: number;
  Inventory: number;
  ArrivalDate: string;
  IsLowestTotalPrice: string;
  StartTime: string;
  EndTime: string;
}

export interface PriceBreakInfo {
  LinkedProductInfo: number;
  PMID: number;
  MinQty: number;
  UnitPrice: number;
  PromoAddlDescr: string;
  IsActive: number;
}

export interface StatusInfo {
  KeyGenId: string;
  RunType: string;
  IsCompleted: number;
}

export interface ProxyNet32 {
  id: number;
  proxy_username: string;
  proxy_password: string;
  ip: string;
  port: string;
}

export interface UpdateProductPayload {
  lastCronRun: string;
  last_cron_message: string;
  lastUpdatedBy: string;
  lowest_vendor: string;
  lowest_vendor_price: string;
  lastExistingPrice: string;
  lastSuggestedPrice: string;
  last_cron_time: string;
  last_attempted_time: string;
  next_cron_time: string | null;
  last_update_time?: string;
  mpid: string | number;
}

export interface UpdateCronForProductPayload {
  slowCronId?: string;
  slowCronName?: string;
  isSlowActivated: number;
  mpId: string | number;
  tradentDetails?: Record<string, any>;
  frontierDetails?: Record<string, any>;
  mvpDetails?: Record<string, any>;
}
