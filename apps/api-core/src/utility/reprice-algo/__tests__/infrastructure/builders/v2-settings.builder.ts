import { V2AlgoSettingsData } from "../../../../../utility/mysql/v2-algo-settings";

const DEFAULT_V2_SETTINGS: V2AlgoSettingsData = {
  id: 1,
  mp_id: 12345,
  vendor_id: 17357,
  enabled: true,
  floor_price: 0,
  max_price: 99999999.99,
  price_strategy: "UNIT" as any,
  up_down: "UP/DOWN" as any,
  badge_indicator: "ALL" as any,
  handling_time_group: "ALL" as any,
  compete_with_all_vendors: false,
  compare_q2_with_q1: false,
  suppress_price_break: false,
  suppress_price_break_if_Q1_not_updated: false,
  compete_on_price_break_only: false,
  floor_compete_with_next: false,
  keep_position: false,
  reprice_down_percentage: -1,
  reprice_down_badge_percentage: -1,
  reprice_up_percentage: -1,
  reprice_up_badge_percentage: -1,
  sister_vendor_ids: "",
  exclude_vendors: "",
  inactive_vendor_id: "",
  inventory_competition_threshold: 1,
  own_vendor_threshold: 1,
  execution_priority: 0,
};

export class V2SettingsBuilder {
  private settings: V2AlgoSettingsData;

  constructor() {
    this.settings = { ...DEFAULT_V2_SETTINGS };
  }

  static create(): V2SettingsBuilder {
    return new V2SettingsBuilder();
  }

  vendorId(id: number): this {
    this.settings.vendor_id = id;
    return this;
  }
  mpId(id: number): this {
    this.settings.mp_id = id;
    return this;
  }
  floor(price: number): this {
    this.settings.floor_price = price;
    return this;
  }
  maxPrice(price: number): this {
    this.settings.max_price = price;
    return this;
  }
  priceStrategy(s: "UNIT" | "TOTAL" | "BUY_BOX"): this {
    this.settings.price_strategy = s as any;
    return this;
  }
  upDown(d: "UP" | "UP/DOWN" | "DOWN"): this {
    this.settings.up_down = d as any;
    return this;
  }
  badgeIndicator(i: "ALL" | "BADGE"): this {
    this.settings.badge_indicator = i as any;
    return this;
  }
  handlingTimeGroup(g: string): this {
    this.settings.handling_time_group = g as any;
    return this;
  }
  keepPosition(enabled = true): this {
    this.settings.keep_position = enabled;
    return this;
  }
  sisterVendors(ids: string): this {
    this.settings.sister_vendor_ids = ids;
    return this;
  }
  excludeVendors(ids: string): this {
    this.settings.exclude_vendors = ids;
    return this;
  }
  floorCompeteWithNext(enabled = true): this {
    this.settings.floor_compete_with_next = enabled;
    return this;
  }
  suppressPriceBreak(enabled = true): this {
    this.settings.suppress_price_break = enabled;
    return this;
  }
  competeOnBreaksOnly(enabled = true): this {
    this.settings.compete_on_price_break_only = enabled;
    return this;
  }
  repriceDownPercentage(pct: number): this {
    this.settings.reprice_down_percentage = pct;
    return this;
  }
  repriceUpPercentage(pct: number): this {
    this.settings.reprice_up_percentage = pct;
    return this;
  }
  executionPriority(p: number): this {
    this.settings.execution_priority = p;
    return this;
  }

  build(): V2AlgoSettingsData {
    return { ...this.settings };
  }
}

export const aV2Settings = () => V2SettingsBuilder.create();
