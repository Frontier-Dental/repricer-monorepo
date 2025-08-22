export enum VendorId {
  FRONTIER = 20722,
  TRADENT = 17357,
  MVP = 20755,
  TOPDENT = 20727,
  FIRSTDENT = 20533,
}

export enum VendorName {
  FRONTIER = "FRONTIER",
  MVP = "MVP",
  TRADENT = "TRADENT",
  FIRSTDENT = "FIRSTDENT",
  TOPDENT = "TOPDENT",
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
