import mongoose, { Schema, Document } from "mongoose";

export interface IItem extends Document {
  mpid: string;
  productName: string;
  channelName: string;
  channelId: string;
  focusId: string;
  activated: boolean;
  cronId: string;
  cronName?: string;
  lastCronTime?: Date;
  last_cron_time?: Date;
  lastCronRun?: string;
  lastUpdateTime?: Date;
  last_update_time?: Date;
  lastUpdatedBy?: string;
  lastAttemptedTime?: Date;
  last_attempted_time?: Date;
  last_cron_message?: string;
  lowest_vendor?: string;
  lowest_vendor_price?: number;
  lastExistingPrice?: number;
  lastSuggestedPrice?: number;
  unitPrice?: number;
  floorPrice?: number;
  is_nc_needed?: boolean;
  repricingRule?: string;
  suppressPriceBreak?: boolean;
  suppressPriceBreakForOne?: boolean;
  beatQPrice?: boolean;
  percentageIncrease?: number;
  compareWithQ1?: boolean;
  competeAll?: boolean;
  badgeIndicator?: string;
  badge_indicator?: string;
  badgePercentage?: number;
  nextCronTime?: Date;
  next_cron_time?: Date;
  requestInterval?: number;
  requestIntervalUnit?: string;
  scrapeOn?: boolean;
  allowReprice?: boolean;
  tags?: string[];
  priority?: number;
  wait_update_period?: number;
  maxPrice?: number;
  net32url?: string;
  abortDeactivatingQPriceBreak?: boolean;
  ownVendorId?: string;
  sisterVendorId?: string;
  includeInactiveVendors?: boolean;
  inactiveVendorId?: string;
  override_bulk_update?: boolean;
  override_bulk_rule?: string;
  latest_price?: number;
}

const ItemSchema: Schema = new Schema(
  {
    mpid: { type: String, required: true, unique: true },
    productName: { type: String },
    channelName: { type: String },
    channelId: { type: String },
    focusId: { type: String },
    activated: { type: Boolean, default: false },
    cronId: { type: String },
    last_cron_time: { type: Date },
    lastCronRun: { type: String },
    last_update_time: { type: Date },
    lastUpdatedBy: { type: String },
    last_attempted_time: { type: Date },
    last_cron_message: { type: String },
    lowest_vendor: { type: String },
    lowest_vendor_price: { type: Number },
    lastExistingPrice: { type: Number },
    lastSuggestedPrice: { type: Number },
    unitPrice: { type: Number },
    floorPrice: { type: Number },
    is_nc_needed: { type: Boolean },
    repricingRule: { type: String },
    suppressPriceBreak: { type: Boolean },
    suppressPriceBreakForOne: { type: Boolean },
    beatQPrice: { type: Boolean },
    percentageIncrease: { type: Number },
    compareWithQ1: { type: Boolean },
    competeAll: { type: Boolean },
    badgeIndicator: { type: String },
    badgePercentage: { type: Number },
    next_cron_time: { type: Date },
    requestInterval: { type: Number },
    requestIntervalUnit: { type: String },
    scrapeOn: { type: Boolean },
    allowReprice: { type: Boolean },
    tags: [{ type: String }],
    priority: { type: Number },
    wait_update_period: { type: Number },
    maxPrice: { type: Number },
    net32url: { type: String },
    abortDeactivatingQPriceBreak: { type: Boolean },
    ownVendorId: { type: String },
    sisterVendorId: { type: String },
    includeInactiveVendors: { type: Boolean },
    inactiveVendorId: { type: String },
    override_bulk_update: { type: Boolean },
    override_bulk_rule: { type: String },
    latest_price: { type: Number },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IItem>("Item", ItemSchema);
