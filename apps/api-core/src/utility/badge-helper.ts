import _ from "lodash";
import * as globalParam from "../model/global-param";
import { RepriceRenewedMessageEnum } from "../model/reprice-renewed-message";
import { RepriceModel } from "../model/reprice-model";
import { FrontierProduct } from "../types/frontier";
import { Net32Product } from "../types/net32";

export async function ReCalculatePrice(
  repriceModel: RepriceModel,
  productItem: FrontierProduct,
  eligibleList: Net32Product[],
  _minQty: number,
): Promise<RepriceModel> {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  if (
    repriceModel.repriceDetails &&
    !_.isEqual(repriceModel.repriceDetails.newPrice, "N/A")
  ) {
    const calculatedNewPrice = parseFloat(
      repriceModel.repriceDetails.newPrice as unknown as string,
    );

    // Get All Badged Vendors
    let badgedItems = eligibleList.filter(
      (item) => item.badgeId && item.badgeId > 0 && item.badgeName,
    );
    //Remove Own Vendor If Present
    badgedItems = badgedItems.filter((item) => item.vendorId !== $.VENDOR_ID);

    if (badgedItems && badgedItems.length > 0) {
      // Sort Badged Vendors based on UnitPrice
      const sortedBadgedItems = _.sortBy(badgedItems, [
        (prod) => {
          return prod.priceBreaks.find(
            (x) => x.minQty == _minQty && x.active == true,
          )!.unitPrice;
        },
      ]);
      if (sortedBadgedItems && _.first(sortedBadgedItems)) {
        // Get the Lowest Badged Unit Price
        const lowestBadgedPrice = _.first(sortedBadgedItems)!.priceBreaks.find(
          (x) => x.minQty == _minQty && x.active == true,
        )!.unitPrice;
        const lowestBadgeItem = _.first(sortedBadgedItems)!.priceBreaks.find(
          (x) => x.minQty == _minQty && x.active == true,
        )!;

        // Calculate Allowed Price based on BadgePercentage
        const badgePercentage =
          parseFloat(productItem.badgePercentage as unknown as string) / 100;
        const allowedPrice = lowestBadgedPrice * (1 - badgePercentage);
        if (calculatedNewPrice >= allowedPrice) {
          // If AllowedPrice is Greater Than OR Equals To Floor Price -> Update the Price to Percentage Allowed Price
          if (allowedPrice >= (productItem.floorPrice as unknown as number)) {
            repriceModel.repriceDetails!.goToPrice =
              repriceModel.repriceDetails!.newPrice;
            repriceModel.repriceDetails!.newPrice = allowedPrice.toFixed(2);
            repriceModel.repriceDetails.explained =
              repriceModel.repriceDetails.explained +
              RepriceRenewedMessageEnum.PRICE_CHANGE_BADGE_PERCENTAGE;
            repriceModel.repriceDetails.triggeredByVendor = `${_minQty} @ ${lowestBadgeItem.vendorId}-${lowestBadgeItem.vendorName}`;
          } else {
            // Mark Floor Hit and Ignore Price Change
            repriceModel.repriceDetails.explained =
              repriceModel.repriceDetails.explained +
              `Can't match the price. #PriceTooLow`;
          }
        }
      }
    }
  }
  return repriceModel;
}

export async function ReCalculatePriceForNc(
  repriceModel: RepriceModel,
  productItem: FrontierProduct,
  eligibleList: Net32Product[],
  _minQty: number,
): Promise<RepriceModel> {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  if (
    repriceModel.repriceDetails &&
    !_.isEqual(repriceModel.repriceDetails.newPrice, "N/A")
  ) {
    const calculatedNewPrice = parseFloat(
      repriceModel.repriceDetails.newPrice as unknown as string,
    );
    // Calculate Standard Shipping For Own Vendor
    const standardShippingPrice = GetShippingPriceForPriceBreak(
      eligibleList.find((x) => x.vendorId == $.VENDOR_ID)!,
      _minQty,
    );

    // Get All Badged Vendors
    let badgedItems = eligibleList.filter(
      (item) => item.badgeId && item.badgeId > 0 && item.badgeName,
    );

    //Remove Own Vendor If Present
    badgedItems = badgedItems.filter((item) => item.vendorId !== $.VENDOR_ID);

    if (badgedItems && badgedItems.length > 0) {
      // Sort Badged Vendors based on UnitPrice
      const sortedBadgedItems = _.sortBy(badgedItems, [
        (prod) => {
          return (
            prod.priceBreaks.find(
              (x) => x.minQty == _minQty && x.active == true,
            )!.unitPrice + GetShippingPriceForPriceBreak(prod, _minQty)
          );
        },
      ]);
      if (sortedBadgedItems && _.first(sortedBadgedItems)) {
        // Get the Lowest Badged Unit Price
        const lowestBadgedPrice =
          _.first(sortedBadgedItems)!.priceBreaks.find(
            (x) => x.minQty == _minQty && x.active == true,
          )!.unitPrice +
          GetShippingPriceForPriceBreak(_.first(sortedBadgedItems)!, _minQty);

        // Calculate Allowed Price based on BadgePercentage
        const badgePercentage =
          parseFloat(productItem.badgePercentage as unknown as string) / 100;
        const allowedPrice =
          lowestBadgedPrice * (1 - badgePercentage) - standardShippingPrice;
        if (calculatedNewPrice >= allowedPrice) {
          repriceModel.repriceDetails.goToPrice =
            repriceModel.repriceDetails.newPrice;
          // If AllowedPrice is Greater Than OR Equals To Floor Price -> Update the Price to Percentage Allowed Price
          if (allowedPrice >= (productItem.floorPrice as unknown as number)) {
            repriceModel.repriceDetails.newPrice = allowedPrice.toFixed(2);
            repriceModel.repriceDetails.explained =
              repriceModel.repriceDetails.explained +
              RepriceRenewedMessageEnum.PRICE_CHANGE_BADGE_PERCENTAGE;
            repriceModel.repriceDetails.triggeredByVendor = `${_minQty} @ ${_.first(sortedBadgedItems).vendorId}-${_.first(sortedBadgedItems).vendorName}`;
          } else {
            // Mark Floor Hit and Ignore Price Change
            repriceModel.repriceDetails.newPrice = "N/A";
            repriceModel.repriceDetails.explained =
              repriceModel.repriceDetails.explained +
              RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED;
          }
        }
      }
    }
  }
  return repriceModel;
}

function GetShippingPriceForPriceBreak(
  item: Net32Product,
  _minQty: number,
): number {
  if (item != null && item.priceBreaks && item.priceBreaks.length > 0) {
    const contextPriceBreak = item.priceBreaks.find((x) => x.minQty == _minQty);
    if (contextPriceBreak) {
      const thresholdPrice =
        item.freeShippingThreshold && item.freeShippingThreshold != null
          ? item.freeShippingThreshold
          : 999999;
      const shippingCharge = item.standardShipping;
      const unitPrice = contextPriceBreak.unitPrice;
      return unitPrice < thresholdPrice
        ? parseFloat(shippingCharge as unknown as string)
        : 0;
    }
  }
  return 0;
}
