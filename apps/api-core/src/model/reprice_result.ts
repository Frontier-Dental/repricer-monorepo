export enum Vendor {
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

export interface RepriceResult {
  // vendor should only be undefined in the case where no change is being made
  vendor?: Vendor;
  // new price should only be undefined in the case where no change is being made
  newPrice?: number;
  removeQuantityBreak?: boolean;
  quantity: number;
}
