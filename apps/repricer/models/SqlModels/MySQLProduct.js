class MySqlProduct {
  constructor(payload, sqlProductDetails, mpid, auditInfo) {
    this.MpId = parseInt(mpid);
    this.Net32Url = this.getItemValue(payload, "net32url");
    this.IsActive = this.getItemValue(payload, "isScrapeOnlyActivated");
    this.LinkedCronName = this.getItemValue(payload, "scrapeOnlyCronName");
    this.LinkedCronId = this.getItemValue(payload, "scrapeOnlyCronId");
    this.LastUpdatedAt = auditInfo.UpdatedOn;
    this.LastUpdatedBy = auditInfo.UpdatedBy;
    this.ProductName = this.getItemValue(payload, "productName");
    this.RegularCronName = this.getItemValue(payload, "cronName");
    this.RegularCronId = this.getItemValue(payload, "cronId");
    this.SlowCronName = this.getItemValue(sqlProductDetails, "slowCronName");
    this.SlowCronId = this.getItemValue(sqlProductDetails, "slowCronId");
    this.IsSlowActivated = this.getItemValue(payload, "isSlowActivated");
    this.LinkedTradentDetailsInfo =
      sqlProductDetails.tradentLinkInfo != null
        ? sqlProductDetails.tradentLinkInfo
        : null;
    this.LinkedFrontiersDetailsInfo =
      sqlProductDetails.frontierLinkInfo != null
        ? sqlProductDetails.frontierLinkInfo
        : null;
    this.LinkedMvpDetailsInfo =
      sqlProductDetails.mvpLinkInfo != null
        ? sqlProductDetails.mvpLinkInfo
        : null;
    this.LinkedFirstDentDetailsInfo =
      sqlProductDetails.firstDentLinkInfo != null
        ? sqlProductDetails.firstDentLinkInfo
        : null;
    this.LinkedTopDentDetailsInfo =
      sqlProductDetails.topDentLinkInfo != null
        ? sqlProductDetails.topDentLinkInfo
        : null;
    this.IsBadgeItem = this.getItemValue(payload, "isBadgeItem");
  }
  getItemValue(payload, identifier) {
    if (payload.tradentDetails) {
      return payload.tradentDetails[identifier];
    }
    if (payload.frontierDetails) {
      return payload.frontierDetails[identifier];
    }
    if (payload.mvpDetails) {
      return payload.mvpDetails[identifier];
    }
    if (payload.topDentDetails) {
      return payload.topDentDetails[identifier];
    }
    if (payload.firstDentDetails) {
      return payload.firstDentDetails[identifier];
    }
  }
}
module.exports = MySqlProduct;
