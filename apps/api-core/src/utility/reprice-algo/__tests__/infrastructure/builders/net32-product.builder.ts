import { Net32Product, Net32PriceBreak } from "../../../../../types/net32";

const DEFAULT_NET32_PRODUCT: Net32Product = {
  vendorProductId: 1001,
  vendorProductCode: "VP-TEST-001",
  vendorId: 99999,
  vendorName: "TestCompetitor",
  vendorRegion: "US",
  inStock: true,
  standardShipping: 0,
  standardShippingStatus: "FREE",
  freeShippingGap: 0,
  heavyShippingStatus: "NONE",
  heavyShipping: 0,
  shippingTime: 2,
  inventory: 100,
  isFulfillmentPolicyStock: true,
  vdrGeneralAverageRatingSum: 4.5,
  vdrNumberOfGeneralRatings: 100,
  isBackordered: false,
  vendorProductLevelLicenseRequiredSw: false,
  vendorVerticalLevelLicenseRequiredSw: false,
  priceBreaks: [{ minQty: 1, unitPrice: 10.0, active: true }],
  badgeId: 0,
  badgeName: null,
  imagePath: "",
  arrivalDate: "",
  arrivalBusinessDays: 2,
  twoDayDeliverySw: false,
  isLowestTotalPrice: null,
};

export class Net32ProductBuilder {
  private product: Net32Product;

  constructor() {
    this.product = {
      ...DEFAULT_NET32_PRODUCT,
      priceBreaks: DEFAULT_NET32_PRODUCT.priceBreaks.map((pb) => ({ ...pb })),
    };
  }

  static create(): Net32ProductBuilder {
    return new Net32ProductBuilder();
  }

  vendorId(id: number | string): this {
    this.product.vendorId = id;
    return this;
  }

  vendorName(name: string): this {
    this.product.vendorName = name;
    return this;
  }

  unitPrice(price: number, minQty = 1): this {
    const existing = this.product.priceBreaks.find((pb) => pb.minQty === minQty);
    if (existing) {
      existing.unitPrice = price;
    } else {
      this.product.priceBreaks.push({ minQty, unitPrice: price, active: true });
    }
    return this;
  }

  priceBreaks(breaks: Array<{ minQty: number; unitPrice: number; active?: boolean; promoAddlDescr?: string }>): this {
    this.product.priceBreaks = breaks.map((b) => ({
      minQty: b.minQty,
      unitPrice: b.unitPrice,
      active: b.active ?? true,
      promoAddlDescr: b.promoAddlDescr,
    }));
    return this;
  }

  shipping(cost: number): this {
    this.product.standardShipping = cost;
    return this;
  }

  threshold(value: number): this {
    this.product.freeShippingThreshold = value;
    return this;
  }

  shippingTime(days: number): this {
    this.product.shippingTime = days;
    return this;
  }

  badge(id: number, name: string): this {
    this.product.badgeId = id;
    this.product.badgeName = name;
    return this;
  }

  noBadge(): this {
    this.product.badgeId = 0;
    this.product.badgeName = null;
    return this;
  }

  inventory(count: number): this {
    this.product.inventory = count;
    return this;
  }

  outOfStock(): this {
    this.product.inStock = false;
    this.product.inventory = 0;
    return this;
  }

  inStock(val = true): this {
    this.product.inStock = val;
    return this;
  }

  expiry(desc: string): this {
    this.product.priceBreaks.forEach((pb) => ((pb as any).promoAddlDescr = desc));
    return this;
  }

  heavyShipping(cost: number): this {
    this.product.heavyShipping = cost;
    this.product.heavyShippingStatus = cost > 0 ? "HEAVY" : "NONE";
    return this;
  }

  freeShippingGap(gap: number): this {
    this.product.freeShippingGap = gap;
    return this;
  }

  /** Preset: own vendor (Tradent, ID 17357) */
  asOwnVendor(): this {
    this.product.vendorId = 17357;
    this.product.vendorName = "Tradent";
    return this;
  }

  /** Preset: sister vendor (Frontier, ID 20722) */
  asSister(): this {
    this.product.vendorId = 20722;
    this.product.vendorName = "Frontier";
    return this;
  }

  /** Preset: second sister (MVP, ID 20755) */
  asSister2(): this {
    this.product.vendorId = 20755;
    this.product.vendorName = "MVP";
    return this;
  }

  build(): Net32Product {
    return {
      ...this.product,
      priceBreaks: this.product.priceBreaks.map((pb) => ({ ...pb })),
    };
  }
}

/** Shorthand factory */
export const aNet32Product = () => Net32ProductBuilder.create();
