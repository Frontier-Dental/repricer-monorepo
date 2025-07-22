const _ = require("lodash");
const mongoose = require("mongoose");
const badgeResx = require("../resources/badgeIndicatorMapping.json");

const itemSchema = new mongoose.Schema(
  {
    channelName: {
      type: String,
      default: null,
    },
    scrapeOn: {
      type: Boolean,
      default: true,
    },
    allowReprice: {
      type: Boolean,
      default: true,
    },
    mpid: {
      type: String,
      require: true,
    },
    productName: {
      type: String,
    },
    unitPrice: {
      type: Number,
    },
    activated: {
      type: Boolean,
      default: true,
    },
    executionPriority: {
      type: Number,
    },
    SecretKey: String,
    net32url: String,
    currentDateTime: Date,
    focusId: String,
    alternateId: String,
    requestInterval: Number,
    requestIntervalUnit: String,
    floorPrice: Number,
    maxPrice: Number,
    channelId: String,
    Request_every: String,
    net32_url: String,
    Reprice_on_off: String,
    last_cron_time: Date,
    last_update_time: Date,
    last_attempted_time: Date,
    tags: Array,
    cronId: String,
    cronName: String,
    is_nc_needed: Boolean,
    repricingRule: {
      type: Number,
      default: 2,
    },
    suppressPriceBreak: Boolean,
    priority: {
      type: Number,
      default: 5,
    },
    competeAll: {
      type: Boolean,
      default: false,
    },
    last_cron_message: {
      type: String,
      default: "N/A",
    },
    lowest_vendor: {
      type: String,
      default: "N/A",
    },
    lowest_vendor_price: {
      type: String,
      default: "N/A",
    },
    next_cron_time: Date,
    suppressPriceBreakForOne: {
      type: Boolean,
      default: false,
    },
    beatQPrice: {
      type: Boolean,
      default: false,
    },
    lastExistingPrice: {
      type: String,
      default: "N/A",
    },
    lastSuggestedPrice: {
      type: String,
      default: "N/A",
    },
    percentageIncrease: {
      type: Number,
      default: 0,
    },
    compareWithQ1: {
      type: Boolean,
      default: false,
    },
    wait_update_period: {
      type: Boolean,
      default: false,
    },
    lastUpdatedBy: {
      type: String,
      default: "N/A",
    },
    lastCronRun: {
      type: String,
      default: "N/A",
    },
    badgeIndicator: {
      type: String,
      default: _.first(badgeResx).key,
    },
    badgePercentage: {
      type: Number,
      default: 0,
    },
    abortDeactivatingQPriceBreak: {
      type: Boolean,
      default: true,
    },
    ownVendorId: {
      type: String,
      default: "N/A",
    },
    sisterVendorId: {
      type: String,
      default: "N/A",
    },
    includeInactiveVendors: {
      type: Boolean,
      default: false,
    },
    inactiveVendorId: {
      type: String,
      default: "N/A",
    },
    override_bulk_update: {
      type: Boolean,
      default: true,
    },
    override_bulk_rule: {
      type: Number,
      default: 2,
    },
    latest_price: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const itemModel = mongoose.model("Item", itemSchema);
module.exports = itemModel;
