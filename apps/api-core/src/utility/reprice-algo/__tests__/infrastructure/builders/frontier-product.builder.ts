import { FrontierProduct } from "../../../../../types/frontier";

const DEFAULT_FRONTIER_PRODUCT: FrontierProduct = {
  // Identity
  channelName: "test-channel",
  activated: true,
  mpid: 12345,
  channelId: "CH-TEST",
  productName: "Test Product",
  focusId: "FOCUS-001",

  // Pricing bounds
  unitPrice: "10.00",
  floorPrice: "0",
  maxPrice: "99999",

  // Core rules
  repricingRule: 2, // 0=OnlyUp, 1=OnlyDown, 2=Both, -1=None
  is_nc_needed: false,
  suppressPriceBreakForOne: false,
  suppressPriceBreak: false,
  beatQPrice: false,
  percentageIncrease: 0,
  compareWithQ1: false,
  competeAll: false,
  abortDeactivatingQPriceBreak: true,

  // Badge settings
  badgeIndicator: "ALL_ZERO",
  badgePercentage: 0,
  badgePercentageDown: "0",

  // Vendor settings
  ownVendorId: "17357",
  sisterVendorId: "20722;20755",
  excludedVendors: "",
  includeInactiveVendors: false,
  inactiveVendorId: "",
  ownVendorThreshold: 50,

  // Buy box
  applyBuyBoxLogic: false,
  applyNcForBuyBox: false,
  getBBShipping: false,
  getBBBadge: false,

  // Position & competition
  keepPosition: false,
  competeWithNext: false,
  inventoryThreshold: 0,
  handlingTimeFilter: "ALL",
  ignorePhantomQBreak: false,
  percentageDown: "0",

  // Cron & timing
  cronId: "CRON-TEST",
  cronName: "test-cron",
  requestInterval: 60,
  requestIntervalUnit: "minutes",
  scrapeOn: true,
  allowReprice: true,
  priority: 5,
  wait_update_period: false,
  net32url: "https://www.net32.com/rest/neo/pdp/12345/vendor-options",
  executionPriority: 0,
  skipReprice: false,

  // Override
  override_bulk_update: false,
  override_bulk_rule: 2,

  // Status fields (not used by algo logic)
  latest_price: 0,
  lastCronRun: "N/A",
  lastExistingPrice: "N/A",
  lastSuggestedPrice: "N/A",
  lastUpdatedBy: "N/A",
  last_attempted_time: "",
  last_cron_message: "N/A",
  last_cron_time: "",
  lowest_vendor: "N/A",
  lowest_vendor_price: "N/A",
  next_cron_time: "",
  last_update_time: "",
  slowCronId: "",
  slowCronName: "",
  isSlowActivated: false,
  lastUpdatedByUser: "",
  lastUpdatedOn: "",
  triggeredByVendor: "",
  tags: [],
  secretKey: [],
  contextCronName: "test-cron",
};

export class FrontierProductBuilder {
  private product: FrontierProduct;

  constructor() {
    this.product = { ...DEFAULT_FRONTIER_PRODUCT, tags: [], secretKey: [] };
  }

  static create(): FrontierProductBuilder {
    return new FrontierProductBuilder();
  }

  // ---- Pricing bounds ----
  floor(price: number): this {
    this.product.floorPrice = String(price);
    return this;
  }
  maxPrice(price: number): this {
    this.product.maxPrice = String(price);
    return this;
  }
  unitPrice(price: number): this {
    this.product.unitPrice = String(price);
    return this;
  }

  // ---- Core rules ----
  /** 0=OnlyUp, 1=OnlyDown, 2=Both, -1=None */
  rule(r: -1 | 0 | 1 | 2): this {
    this.product.repricingRule = r;
    return this;
  }
  ncMode(enabled = true): this {
    this.product.is_nc_needed = enabled;
    return this;
  }
  suppressPriceBreak(enabled = true): this {
    this.product.suppressPriceBreakForOne = enabled;
    return this;
  }
  beatQPrice(enabled = true): this {
    this.product.beatQPrice = enabled;
    return this;
  }
  percentageIncrease(pct: number): this {
    this.product.percentageIncrease = pct;
    return this;
  }
  compareWithQ1(enabled = true): this {
    this.product.compareWithQ1 = enabled;
    return this;
  }
  competeAll(enabled = true): this {
    this.product.competeAll = enabled;
    return this;
  }
  abortDeactivatingQBreak(enabled = true): this {
    this.product.abortDeactivatingQPriceBreak = enabled;
    return this;
  }

  // ---- Badge ----
  badgeIndicator(indicator: string): this {
    this.product.badgeIndicator = indicator;
    return this;
  }
  badgePercentage(pct: number): this {
    this.product.badgePercentage = pct;
    return this;
  }
  badgePercentageDown(pct: number | string): this {
    this.product.badgePercentageDown = String(pct);
    return this;
  }

  // ---- Vendor ----
  ownVendorId(id: string): this {
    this.product.ownVendorId = id;
    return this;
  }
  sisterVendorId(ids: string): this {
    this.product.sisterVendorId = ids;
    return this;
  }
  excludedVendors(ids: string): this {
    this.product.excludedVendors = ids;
    return this;
  }
  ownVendorThreshold(t: number): this {
    this.product.ownVendorThreshold = t;
    return this;
  }

  // ---- Buy box ----
  buyBoxLogic(enabled = true): this {
    this.product.applyBuyBoxLogic = enabled;
    return this;
  }
  ncForBuyBox(enabled = true): this {
    this.product.applyNcForBuyBox = enabled;
    return this;
  }
  bbShipping(enabled = true): this {
    this.product.getBBShipping = enabled;
    return this;
  }
  bbBadge(enabled = true): this {
    this.product.getBBBadge = enabled;
    return this;
  }

  // ---- Position & competition ----
  keepPosition(enabled = true): this {
    this.product.keepPosition = enabled;
    return this;
  }
  competeWithNext(enabled = true): this {
    this.product.competeWithNext = enabled;
    return this;
  }
  inventoryThreshold(t: number): this {
    this.product.inventoryThreshold = t;
    return this;
  }
  handlingTimeFilter(f: string): this {
    this.product.handlingTimeFilter = f;
    return this;
  }
  ignorePhantomQBreak(enabled = true): this {
    this.product.ignorePhantomQBreak = enabled;
    return this;
  }
  percentageDown(pct: number | string): this {
    this.product.percentageDown = String(pct);
    return this;
  }

  // ---- Override ----
  overrideBulkUpdate(enabled = true): this {
    this.product.override_bulk_update = enabled;
    return this;
  }
  overrideBulkRule(r: number): this {
    this.product.override_bulk_rule = r;
    return this;
  }

  // ---- Bulk setter ----
  fromPartial(partial: Partial<FrontierProduct>): this {
    Object.assign(this.product, partial);
    return this;
  }

  build(): FrontierProduct {
    return { ...this.product, tags: [...this.product.tags], secretKey: [...this.product.secretKey] };
  }
}

/** Shorthand factory */
export const aProduct = () => FrontierProductBuilder.create();
