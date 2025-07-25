import moment from "moment";

export class ProductInfo {
  LinkedCronInfo: any;
  Mpid: any;
  VendorProductId: any;
  VendorProductCode: any;
  VendorId: any;
  VendorName: any;
  VendorRegion: any;
  InStock: any;
  StandardShipping: any;
  StandardShippingStatus: any;
  FreeShippingGap: any;
  HeavyShippingStatus: any;
  HeavyShipping: any;
  Inventory: any;
  ShippingTime: any;
  IsFulfillmentPolicyStock: any;
  IsBackordered: any;
  BadgeId: any;
  BadgeName: any;
  ArrivalDate: any;
  ArrivalBusinessDays: any;
  IsLowestTotalPrice: any;
  ItemRank: any;
  IsOwnVendor: any;
  StartTime: any;
  EndTime: any;

  constructor(
    _mpid: any,
    details: any,
    _linkedCronInfoId: any,
    _rank: any,
    _isOwnVendor: any,
  ) {
    this.LinkedCronInfo = _linkedCronInfoId;
    this.Mpid = _mpid.toString();
    this.VendorProductId = details.vendorProductId.toString();
    this.VendorProductCode = details.vendorProductCode.toString();
    this.VendorId = details.vendorId.toString();
    this.VendorName = details.vendorName;
    this.VendorRegion = details.vendorRegion;
    this.InStock = details.inStock;
    this.StandardShipping = details.standardShipping;
    this.StandardShippingStatus = details.standardShippingStatus;
    this.FreeShippingGap = details.freeShippingGap;
    this.HeavyShippingStatus = details.heavyShippingStatus;
    this.HeavyShipping = details.heavyShipping;
    this.Inventory = details.inventory;
    this.ShippingTime = details.shippingTime;
    this.IsFulfillmentPolicyStock = details.isFulfillmentPolicyStock;
    this.IsBackordered = details.isBackordered;
    this.BadgeId = details.badgeId;
    this.BadgeName = details.badgeName;
    this.ArrivalDate = details.arrivalDate;
    this.ArrivalBusinessDays = details.arrivalBusinessDays;
    this.IsLowestTotalPrice = details.isLowestTotalPrice;
    this.ItemRank = _rank;
    this.IsOwnVendor = _isOwnVendor;
  }
  addStartTime(dateValue: any) {
    this.StartTime = moment(dateValue).format("DD-MM-YYYY HH:mm:ss");
  }
  addEndTime(dateValue: any) {
    this.EndTime = moment(dateValue).format("DD-MM-YYYY HH:mm:ss");
  }
}
