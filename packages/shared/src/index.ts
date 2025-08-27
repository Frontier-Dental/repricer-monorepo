export enum VendorId {
  FRONTIER = 20722,
  TRADENT = 17357,
  MVP = 20755,
  TOPDENT = 20727,
  FIRSTDENT = 20533,
  TRIAD = 5,
}

export enum VendorName {
  FRONTIER = "FRONTIER",
  MVP = "MVP",
  TRADENT = "TRADENT",
  FIRSTDENT = "FIRSTDENT",
  TOPDENT = "TOPDENT",
  TRIAD = "TRIAD",
}

export const VendorNameLookup: Record<number, VendorName> = {
  [VendorId.FRONTIER]: VendorName.FRONTIER,
  [VendorId.TRADENT]: VendorName.TRADENT,
  [VendorId.MVP]: VendorName.MVP,
  [VendorId.TOPDENT]: VendorName.TOPDENT,
  [VendorId.FIRSTDENT]: VendorName.FIRSTDENT,
  [VendorId.TRIAD]: VendorName.TRIAD,
};

export const VendorIdLookup: Record<VendorName, VendorId> = {
  [VendorName.FRONTIER]: VendorId.FRONTIER,
  [VendorName.TRADENT]: VendorId.TRADENT,
  [VendorName.MVP]: VendorId.MVP,
  [VendorName.TOPDENT]: VendorId.TOPDENT,
  [VendorName.FIRSTDENT]: VendorId.FIRSTDENT,
  [VendorName.TRIAD]: VendorId.TRIAD,
};

export enum AlgoExecutionMode {
  V2_ONLY = "V2_ONLY",
  V1_ONLY = "V1_ONLY",
  V2_EXECUTE_V1_DRY = "V2_EXECUTE_V1_DRY",
  V1_EXECUTE_V2_DRY = "V1_EXECUTE_V2_DRY",
}

export enum AlgoPriceDirection {
  UP = "UP",
  UP_DOWN = "UP/DOWN",
  DOWN = "DOWN",
}

export enum AlgoBadgeIndicator {
  ALL = "ALL",
  BADGE = "BADGE",
}

export enum AlgoHandlingTimeGroup {
  ALL = "ALL",
  FAST_SHIPPING = "FAST_SHIPPING",
  STOCKED = "STOCKED",
  LONG_HANDLING = "LONG_HANDLING",
}
