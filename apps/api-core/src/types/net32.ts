export interface Net32Response {
  data: Net32Product[];
}

export interface Net32Product {
  vendorProductId: number;
  vendorProductCode: string;
  vendorId: number | string;
  vendorName: string;
  vendorRegion: string;
  inStock: boolean;
  standardShipping: number;
  standardShippingStatus: string;
  freeShippingGap: number;
  heavyShippingStatus: string;
  heavyShipping: number;
  shippingTime: number;
  inventory: number;
  isFulfillmentPolicyStock: boolean;
  vdrGeneralAverageRatingSum: number;
  vdrNumberOfGeneralRatings: number;
  isBackordered: boolean;
  vendorProductLevelLicenseRequiredSw: boolean;
  vendorVerticalLevelLicenseRequiredSw: boolean;
  priceBreaks: Net32PriceBreak[];
  badgeId: number;
  badgeName: string | null;
  imagePath: string;
  arrivalDate: string;
  arrivalBusinessDays: number;
  twoDayDeliverySw: boolean;
  isLowestTotalPrice: string | null;
  freeShippingThreshold?: number;
}

export interface Net32PriceBreak {
  pmId?: string;
  minQty: number;
  unitPrice: number;
  promoAddlDescr?: string;
  active?: boolean;
  vendorId?: string;
  vendorName?: string;
}
