import _ from "lodash";
import { RepriceModel } from "../model/reprice-model";
import { RepriceRenewedMessageEnum } from "../model/reprice-renewed-message";

export async function parseShippingBuyBox(
  repriceResult: any,
  net32Result: any,
  productItem: any,
): Promise<any> {
  const getBBShippingValue = parseFloat(productItem.getBBShippingValue) || 0;
  const buyBoxVendor: any = _.first(
    net32Result.filter((item: any) => {
      return item.inStock === true;
    }),
  );
  const ownVendorItem = net32Result.find(
    (x: any) => x.vendorId.toString() == productItem.ownVendorId.toString(),
  );
  if (!buyBoxVendor || !ownVendorItem) return repriceResult;
  if (
    buyBoxVendor &&
    buyBoxVendor.vendorId.toString() == productItem.ownVendorId.toString()
  ) {
    return new RepriceModel(
      productItem.mpid,
      ownVendorItem,
      productItem.productName,
      "N/A",
      false,
      false,
      [],
      RepriceRenewedMessageEnum.DEFAULT,
    );
  } else if (buyBoxVendor && getBBShippingValue > 0) {
    try {
      const buyBoxVendorShippingTime = parseInt(buyBoxVendor.shippingTime) || 0;
      const ownVendorShippingTime = parseInt(ownVendorItem.shippingTime) || 0;
      if (
        buyBoxVendorShippingTime == 1 &&
        (ownVendorShippingTime == 2 || ownVendorShippingTime == 1)
      )
        return repriceResult;
      else if (buyBoxVendorShippingTime < ownVendorShippingTime) {
        repriceResult.repriceDetails.isRepriced = true;
        repriceResult.repriceDetails.explained =
          RepriceRenewedMessageEnum.BB_SHIPPING;
        const comparablePrice =
          buyBoxVendor.priceBreaks.find((x: any) => x.minQty == 1)?.unitPrice ||
          0;
        repriceResult.repriceDetails.newPrice = await subtractPercentage(
          comparablePrice,
          getBBShippingValue,
        );
        repriceResult.updateTriggeredBy(
          buyBoxVendor.vendorName,
          buyBoxVendor.vendorId,
          1,
        );
        return repriceResult;
      }
    } catch (error) {
      console.error(
        `Error parsing shipping buy box for ${productItem.mpid}:`,
        error,
      );
    }
  }
  return repriceResult;
}

export async function parseBadgeBuyBox(
  repriceResult: any,
  net32Result: any,
  productItem: any,
): Promise<any> {
  const getBBBadgeValue = parseFloat(productItem.getBBBadgeValue) || 0;
  const buyBoxVendor: any = _.first(
    net32Result.filter((item: any) => {
      return item.inStock === true;
    }),
  );
  const ownVendorItem = net32Result.find(
    (x: any) => x.vendorId.toString() == productItem.ownVendorId.toString(),
  );
  if (!buyBoxVendor || !ownVendorItem) return repriceResult;
  if (
    buyBoxVendor &&
    buyBoxVendor.vendorId.toString() == productItem.ownVendorId.toString()
  ) {
    return new RepriceModel(
      productItem.mpid,
      ownVendorItem,
      productItem.productName,
      "N/A",
      false,
      false,
      [],
      RepriceRenewedMessageEnum.DEFAULT,
    );
  } else if (buyBoxVendor && getBBBadgeValue > 0 && buyBoxVendor.badgeId > 0) {
    repriceResult.repriceDetails.isRepriced = true;
    repriceResult.repriceDetails.explained = RepriceRenewedMessageEnum.BB_BADGE;
    const comparablePrice =
      buyBoxVendor.priceBreaks.find((x: any) => x.minQty == 1)?.unitPrice || 0;
    repriceResult.repriceDetails.newPrice = await subtractPercentage(
      comparablePrice,
      getBBBadgeValue,
    );
    repriceResult.updateTriggeredBy(
      buyBoxVendor.vendorName,
      buyBoxVendor.vendorId,
      1,
    );
    return repriceResult;
  }
  return repriceResult;
}

async function subtractPercentage(originalNumber: number, percentage: number) {
  return parseFloat(
    (
      Math.floor((originalNumber - originalNumber * percentage) * 100) / 100
    ).toFixed(2),
  );
}
