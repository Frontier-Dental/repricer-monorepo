class CustomProduct {
  constructor(sqlEntity) {
    this.channelName = sqlEntity["ChannelName"];
    this.activated = sqlEntity["Activated"] == 1 ? true : false;
    this.mpid = sqlEntity["MpId"];
    this.channelId = sqlEntity["ChannelId"];
    this.unitPrice = sqlEntity["UnitPrice"];
    this.floorPrice = sqlEntity["FloorPrice"];
    this.maxPrice = sqlEntity["MaxPrice"];
    this.is_nc_needed = sqlEntity["IsNCNeeded"] == 1 ? true : false;
    this.suppressPriceBreakForOne =
      sqlEntity["SuppressPriceBreakForOne"] == 1 ? true : false;
    this.repricingRule = sqlEntity["RepricingRule"];
    this.suppressPriceBreak =
      sqlEntity["SuppressPriceBreak"] == 1 ? true : false;
    this.beatQPrice = sqlEntity["BeatQPrice"] == 1 ? true : false;
    this.percentageIncrease = sqlEntity["PercentageIncrease"];
    this.compareWithQ1 = sqlEntity["CompareWithQ1"] == 1 ? true : false;
    this.competeAll = sqlEntity["CompeteAll"] == 1 ? true : false;
    this.badgeIndicator = sqlEntity["BadgeIndicator"];
    this.badgePercentage = sqlEntity["BadgePercentage"];
    this.productName = sqlEntity["ProductName"];
    this.cronId = sqlEntity["RegularCronId"];
    this.cronName = sqlEntity["RegularCronName"];
    this.requestInterval = sqlEntity["RequestInterval"];
    this.requestIntervalUnit = sqlEntity["RequestIntervalUnit"];
    this.scrapeOn = sqlEntity["ScrapeOn"] == 1 ? true : false;
    this.allowReprice = sqlEntity["AllowReprice"] == 1 ? true : false;
    this.focusId = sqlEntity["FocusId"];
    this.priority = sqlEntity["PriorityValue"];
    this.wait_update_period = sqlEntity["WaitUpdatePeriod"] == 1 ? true : false;
    this.net32url = sqlEntity["Net32Url"];
    this.abortDeactivatingQPriceBreak =
      sqlEntity["AbortDeactivatingQPriceBreak"] == 1 ? true : false;
    this.ownVendorId = null;
    this.sisterVendorId = sqlEntity["SisterVendorId"];
    this.tags = [];
    this.includeInactiveVendors =
      sqlEntity["IncludeInactiveVendors"] == 1 ? true : false;
    this.inactiveVendorId = sqlEntity["InactiveVendorId"];
    this.override_bulk_update =
      sqlEntity["OverrideBulkUpdate"] == 1 ? true : false;
    this.override_bulk_rule = sqlEntity["OverrideBulkRule"];
    this.latest_price = sqlEntity["LatestPrice"];
    this.executionPriority = sqlEntity["ExecutionPriority"];
    this.lastCronRun = sqlEntity["LastCronRun"];
    this.lastExistingPrice = sqlEntity["LastExistingPrice"];
    this.lastSuggestedPrice = sqlEntity["LastSuggestedPrice"];
    this.lastUpdatedBy = sqlEntity["LastUpdatedBy"];
    this.last_attempted_time = sqlEntity["LastAttemptedTime"];
    this.last_cron_message = sqlEntity["LastCronMessage"];
    this.last_cron_time = sqlEntity["LastCronTime"];
    this.lowest_vendor = sqlEntity["LowestVendor"];
    this.lowest_vendor_price = sqlEntity["LowestVendorPrice"];
    this.next_cron_time = sqlEntity["NextCronTime"];
    this.slowCronId = sqlEntity["SlowCronId"];
    this.slowCronName = sqlEntity["SlowCronName"];
    this.last_update_time = sqlEntity["LastUpdateTime"];
    this.applyBuyBoxLogic = sqlEntity["ApplyBuyBoxLogic"] == 1 ? true : false;
    this.applyNcForBuyBox = sqlEntity["ApplyNcForBuyBox"] == 1 ? true : false;
    this.isSlowActivated = sqlEntity["IsSlowActivated"] == 1 ? true : false;
    this.lastUpdatedByUser = sqlEntity["UpdatedBy"];
    this.lastUpdatedOn = sqlEntity["UpdatedAt"];
    this.handlingTimeFilter = sqlEntity["HandlingTimeFilter"];
    this.keepPosition = sqlEntity["KeepPosition"] == 1 ? true : false;
    this.excludedVendors = sqlEntity["ExcludedVendors"];
    this.inventoryThreshold = sqlEntity["InventoryThreshold"];
    this.percentageDown = sqlEntity["PercentageDown"];
    this.badgePercentageDown = sqlEntity["BadgePercentageDown"];
    this.competeWithNext = sqlEntity["CompeteWithNext"] == 1 ? true : false;
    this.triggeredByVendor = sqlEntity["TriggeredByVendor"];
    this.ignorePhantomQBreak =
      sqlEntity["IgnorePhantomBreak"] == 1 ? true : false;
    this.ownVendorThreshold = sqlEntity["OwnVendorThreshold"];
  }
}
module.exports = CustomProduct;
