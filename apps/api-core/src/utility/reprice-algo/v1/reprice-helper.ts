import _ from "lodash";
import { RepriceModel } from "../../../model/reprice-model";
import { RepriceRenewedMessageEnum } from "../../../model/reprice-renewed-message";
import * as globalParam from "../../../model/global-param";
import * as badgeHelper from "../../badge-helper";
import * as filterMapper from "../../filter-mapper";
import { Net32PriceBreak, Net32Product } from "../../../types/net32";
import { FrontierProduct } from "../../../types/frontier";
import { applicationConfig } from "../../config";

//<!-- MODULE FUNCTIONS -->
export async function Reprice(refProduct: any, payload: any, productItem: any, sourceId: string) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  let repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, 0, false, false, [], RepriceRenewedMessageEnum.DEFAULT);
  const existingPrice = refProduct.priceBreaks.find((x: any) => x.minQty == 1).unitPrice;
  repriceModel.repriceDetails!.oldPrice = existingPrice;
  const maxPrice = productItem.maxPrice ? parseFloat(productItem.maxPrice) : 99999;
  const floorPrice = productItem.floorPrice ? parseFloat(productItem.floorPrice) : 0;
  const heavyShippingPrice = refProduct.heavyShipping ? parseFloat(refProduct.heavyShipping) : 0;
  let lowestPrice = 0;
  const processOffset = applicationConfig.OFFSET;
  let excludedVendors = productItem.competeAll == true ? [] : $.EXCLUDED_VENDOR_ID.split(";");
  const allowCompeteWithNextForFloor = productItem.competeWithNext;
  let rawDataForSisterCheck: any = [];

  try {
    let eligibleList: any[] = [];
    // Get eligible List of Products where minQty is 1
    payload.forEach((element: any) => {
      if (element.priceBreaks) {
        element.priceBreaks.forEach((p: any) => {
          if (p.minQty == 1 && p.active == true && isNotShortExpiryProduct(p, element.priceBreaks, 1) && !eligibleList.find((x) => x.vendorId == element.vendorId)) {
            eligibleList.push(element);
          }
        });
      }
    });
    //Update Eligible List based on Excluded Vendor List defined by User
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "EXCLUDED_VENDOR");

    //Update Eligible List based on Inventory Threshold defined by User
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "INVENTORY_THRESHOLD");

    //Update Eligible List based on HandlingTimeFilter
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "HANDLING_TIME");

    // Update Eligible List based on badgeIndicator
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "BADGE_INDICATOR");

    //Clean Eligible List based on Duplicate PricePoint
    let tempEligibleList = await filterEligibleList(eligibleList, 1);

    //Sort the eligible list of Products based on minQty=1 Price
    let sortedPayload = _.sortBy(tempEligibleList, [
      (prod) => {
        return (
          _.find(prod.priceBreaks, (x) => {
            if (x.minQty == 1 && x.active == true) return true;
          })! as any
        ).unitPrice;
      },
    ]);
    if (!sortedPayload || (sortedPayload && sortedPayload.length < 1)) {
      return repriceModel;
    }
    //Check if first 2 are tie
    const isTieScenario = await IsTie(sortedPayload, 1);
    if (isTieScenario) {
      try {
        const tieWithSister = await IsTieWithSister(sortedPayload, 1, productItem);
        if (!tieWithSister) {
          excludedVendors = [];
        }
      } catch (exception) {
        console.error(`Exception in TIE Scenario for ${productItem.mpid}`);
        console.error(exception);
      }
    }

    // //Remove Sister Vendor if Both UP & DOWN selected or Compete with Next is true
    // if (
    //   allowCompeteWithNextForFloor === true ||
    //   productItem.repricingRule === 2
    // ) {
    //   rawDataForSisterCheck = _.cloneDeep(sortedPayload);
    //   sortedPayload = await filterMapper.FilterBasedOnParams(
    //     sortedPayload,
    //     productItem,
    //     "SISTER_VENDOR_EXCLUSION",
    //   );
    // }

    //Set the Lowest Price
    _.first(sortedPayload)!.priceBreaks.forEach((price: any) => {
      if (price.minQty == 1 && price.active == true) {
        lowestPrice = price.unitPrice;
      }
    });

    //If the Lowest Price is of Self-Vendor
    if (_.first(sortedPayload)!.vendorId == parseInt($.VENDOR_ID)) {
      // If no Competitor found
      if (sortedPayload.length == 1) {
        const newPrice = productItem.maxPrice && lowestPrice != parseFloat(productItem.maxPrice) ? productItem.maxPrice : "N/A";
        const model = new RepriceModel(sourceId, refProduct, productItem.productName, newPrice, newPrice != "N/A", false, [], newPrice != "N/A" ? RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL : RepriceRenewedMessageEnum.NO_COMPETITOR);
        model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
        model.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
        return model;
      }

      //Remove Sister Vendor if Both UP & DOWN selected or Compete with Next is true
      if (allowCompeteWithNextForFloor || productItem.repricingRule === 2) {
        rawDataForSisterCheck = _.cloneDeep(sortedPayload);
        sortedPayload = await filterMapper.FilterBasedOnParams(sortedPayload, productItem, "SISTER_VENDOR_EXCLUSION");
      }

      // if next in list is in Excluded Vendor, go to next
      let nextIndex = 1;
      if (sortedPayload[nextIndex] && _.includes(excludedVendors, sortedPayload[nextIndex].vendorId.toString())) {
        nextIndex++;
      }
      for (let i = nextIndex; i < sortedPayload.length; i++) {
        if (sortedPayload[i]) {
          if (_.includes(excludedVendors, sortedPayload[i].vendorId.toString())) {
            nextIndex++;
          } else if (await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, 1, floorPrice, 0, false)) {
            nextIndex++;
          } else {
            break;
          }
        }
      }
      if (sortedPayload[nextIndex]) {
        // Check the next Lowest Price
        const nextLowestPrice = (
          _.find(sortedPayload[nextIndex].priceBreaks, (price) => {
            if (price.minQty == 1 && price.active == true) {
              return true;
            }
          })! as any
        ).unitPrice;
        if (nextLowestPrice > floorPrice && nextLowestPrice >= existingPrice) {
          const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(nextLowestPrice), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1, heavyShippingPrice);
          const contextPrice = contextPriceResult.Price;
          if (nextLowestPrice > contextPrice) {
            if (contextPrice <= maxPrice) {
              if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
                repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, contextPrice, true, false, [], await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_NEXT, contextPriceResult.Type));
              }
            } else {
              repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, productItem.maxPrice, true, false, [], RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL);
            }
          } else {
            repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, existingPrice, false, false, [], RepriceRenewedMessageEnum.IGNORE_OWN);
            repriceModel.repriceDetails!.goToPrice = contextPrice;
          }
        }
        //1. If Next Lowest price is Greater Than Floor Price
        //2. Floor Price is Not Equal to Existing Price
        //SET: Floor Price
        else if (nextLowestPrice > floorPrice && floorPrice != existingPrice) {
          //repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, floorPrice, true, false, [], _enum.PRICE_UP_SECOND_FLOOR);
        }
        //1. If Next Lowest price is Greater Than Max Price
        //2. Max Price is Not Equal to Existing Price
        //SET: Max Price
        else if (nextLowestPrice > productItem.maxPrice && productItem.maxPrice != existingPrice) {
          repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, productItem.maxPrice, true, false, [], RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX);
        }

        repriceModel.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, 1);
      }
      if (!sortedPayload[nextIndex]) {
        repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, productItem.maxPrice, true, false, [], RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL);
        repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
      }
      repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
    }
    //Check if the lowest price is of the same parent company
    else if (_.includes(excludedVendors, _.first(sortedPayload)!.vendorId.toString())) {
      let model = new RepriceModel(sourceId, refProduct, productItem.productName, existingPrice, false, false, [], RepriceRenewedMessageEnum.NO_COMPETITOR_SISTER_VENDOR);
      model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
      const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(lowestPrice as any), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1, heavyShippingPrice);
      const contextPrice = contextPriceResult.Price;
      model.repriceDetails!.goToPrice = contextPrice.toFixed(2);
      model.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
      return model;
    }
    // For Other Vendors
    else {
      //Remove Sister Vendor if Both UP & DOWN selected or Compete with Next is true
      if (allowCompeteWithNextForFloor || productItem.repricingRule === 2) {
        rawDataForSisterCheck = _.cloneDeep(sortedPayload);
        sortedPayload = await filterMapper.FilterBasedOnParams(sortedPayload, productItem, "SISTER_VENDOR_EXCLUSION");
      }

      // Check the Lowest Price
      const prodPriceWithMinQty = _.first(sortedPayload)!.priceBreaks.find((x: any) => x.minQty == 1 && x.active == true);
      if (prodPriceWithMinQty) {
        const lowestPrice = prodPriceWithMinQty.unitPrice;
        const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(lowestPrice as any), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1, heavyShippingPrice);
        const offsetPrice = contextPriceResult.Price;
        //1. If the Offset Price is less than Floor Price
        //SET: Do Nothing
        if (offsetPrice <= floorPrice) {
          //If Lowest is below Floor and competing with others and Sister is already Lowest
          const floorSisterResult = await filterMapper.VerifyFloorWithSister(productItem, refProduct, rawDataForSisterCheck, excludedVendors, $.VENDOR_ID, 1, sourceId);

          //if (floorSisterResult != false) return floorSisterResult;

          //If Own vendor is 2nd Lowest
          if (sortedPayload[1] && (sortedPayload[1].vendorId == $.VENDOR_ID || _.includes(excludedVendors, sortedPayload[1].vendorId.toString()))) {
            let nextIndex = 2;
            for (let i = nextIndex; i < sortedPayload.length; i++) {
              if (sortedPayload[i]) {
                if (_.includes(excludedVendors, sortedPayload[i].vendorId.toString()) || sortedPayload[i].vendorId == $.VENDOR_ID) {
                  nextIndex++;
                } else if (await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, 1, floorPrice, 0, false)) {
                  nextIndex++;
                } else {
                  break;
                }
              }
            }
            if (!sortedPayload[nextIndex]) {
              const model = new RepriceModel(sourceId, refProduct, productItem.productName, productItem.maxPrice, true, false, [], RepriceRenewedMessageEnum.PRICE_MAXED);
              model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
              model.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
              return model;
            }
            const nextLowestPrice = (
              _.find(sortedPayload[nextIndex].priceBreaks, (price) => {
                if (price.minQty == 1 && price.active == true) {
                  return true;
                }
              })! as any
            ).unitPrice;
            if (nextLowestPrice > floorPrice && (nextLowestPrice >= existingPrice || allowCompeteWithNextForFloor === true)) {
              //&& nextLowestPrice >= existingPrice
              const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(nextLowestPrice), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1, heavyShippingPrice);
              const contextPrice = contextPriceResult.Price;
              if (contextPrice < existingPrice && floorSisterResult !== false) {
                //Check for Sister Being lowest only while going Down
                return floorSisterResult;
              }
              if (nextLowestPrice > contextPrice && contextPrice <= maxPrice) {
                if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
                  const model = new RepriceModel(sourceId, refProduct, productItem.productName, contextPrice, true, false, [], await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT, contextPriceResult.Type));
                  model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
                  model.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, 1);
                  return model;
                }
              } else {
                const model = new RepriceModel(sourceId, refProduct, productItem.productName, parseFloat(productItem.maxPrice), true, false, [], RepriceRenewedMessageEnum.PRICE_MAXED);
                model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
                model.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, 1);
                return model;
              }
              // else {
              //     repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, existingPrice, false, false, [], _enum_new.IGNORE_OWN);
              //     repriceModel.repriceDetails.goToPrice = nextLowestPrice - processOffset;
              // }
            }
          } else if (sortedPayload[1]) {
            if (allowCompeteWithNextForFloor == true && floorSisterResult !== false) return floorSisterResult;
            let nextIndex = 1;
            for (let i = nextIndex; i < sortedPayload.length; i++) {
              if (sortedPayload[i] && (_.includes(excludedVendors, sortedPayload[i].vendorId.toString()) || sortedPayload[i].vendorId == $.VENDOR_ID)) {
                nextIndex++;
              } else if (await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, 1, floorPrice, 0, false)) {
                nextIndex++;
              } else {
                break;
              }
            }
            if (sortedPayload[nextIndex] != null) {
              const secondLowestPrice = sortedPayload[nextIndex]!.priceBreaks!.find((x: any) => x.minQty == 1 && x.active == true);
              if (secondLowestPrice && secondLowestPrice.unitPrice > floorPrice && (secondLowestPrice.unitPrice >= existingPrice || allowCompeteWithNextForFloor === true)) {
                const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(secondLowestPrice.unitPrice as any), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1, heavyShippingPrice);
                repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, contextPriceResult.Price, true, false, [], await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT, contextPriceResult.Type));
              }
              repriceModel.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, 1);
            } else {
              const model = new RepriceModel(sourceId, refProduct, productItem.productName, parseFloat(productItem.maxPrice), true, false, [], RepriceRenewedMessageEnum.PRICE_MAXED);
              model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
              model.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
              return model;
            }
          } else {
            repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, existingPrice, false, false, [], RepriceRenewedMessageEnum.IGNORE_OWN);
            repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
          }
        }
        //1. If the Offset Price is greater than Floor Price
        //2. If the Offset Price is less than Max Price
        //SET: Offset Price
        if (offsetPrice > floorPrice) {
          if (offsetPrice < maxPrice) {
            repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, offsetPrice, true, false, [], await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_NEXT, contextPriceResult.Type));
          } else {
            repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, maxPrice, true, false, [], RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL);
          }
          repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
        } else if (repriceModel.repriceDetails!.isRepriced == false && parseFloat(existingPrice) > maxPrice) {
          repriceModel.repriceDetails!.newPrice = maxPrice;
          repriceModel.repriceDetails!.isRepriced = true;
          repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_MAXED;
        } else if (!repriceModel.repriceDetails!.isRepriced) {
          repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, existingPrice, false, false, [], RepriceRenewedMessageEnum.OFFSET_LESS_THAN_FLOOR);
          repriceModel.repriceDetails!.goToPrice = offsetPrice;
          repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
        }
      } else {
        repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, existingPrice, false, false, [], RepriceRenewedMessageEnum.DEFAULT);
        repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
      }
      repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
    }

    if (isTieScenario) {
      repriceModel.repriceDetails!.explained = repriceModel.repriceDetails!.explained + "#TIE";
    }

    // For Applying Badge Percentage Scenario
    if (_.isEqual(productItem.badgeIndicator, "ALL_PERCENTAGE") && productItem.badgePercentage > 0) {
      repriceModel = await badgeHelper.ReCalculatePrice(repriceModel, productItem, eligibleList, 1);
    }
  } catch (exception) {
    console.log(`Error in Reprice for MpId : ${productItem.mpid} || Error : ${exception}`);
  }
  return repriceModel;
}

export async function RepriceIndividualPriceBreak(refProduct: any, payload: any, productItem: any, sourceId: string, priceBreak: any) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  const existingPrice = priceBreak.unitPrice;
  const processOffset = applicationConfig.OFFSET;
  let repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, 0, false, false, [], RepriceRenewedMessageEnum.IGNORE_OWN);
  repriceModel.repriceDetails!.oldPrice = existingPrice;
  repriceModel.repriceDetails!.minQty = priceBreak.minQty;
  const maxPrice = productItem.maxPrice ? productItem.maxPrice : 99999;
  const floorPrice = productItem.floorPrice ? parseFloat(productItem.floorPrice) : 0;
  const heavyShippingPrice = refProduct.heavyShipping ? parseFloat(refProduct.heavyShipping) : 0;
  let lowestPrice = 0;
  let excludedVendors = productItem.competeAll === true ? [] : $.EXCLUDED_VENDOR_ID.split(";");
  const allowCompeteWithNextForFloor = productItem.competeWithNext;
  let rawDataForSisterCheck: any = [];
  try {
    let eligibleList: any[] = [];
    // Get eligible List of Products where minQty is equal to minQty of the parameter
    payload.forEach((element: any) => {
      if (element.priceBreaks) {
        element.priceBreaks.forEach((p: any) => {
          if (p.minQty == priceBreak.minQty && p.active == true && isNotShortExpiryProduct(p, element.priceBreaks, priceBreak.minQty) && !eligibleList.find((x) => x.vendorId == element.vendorId)) {
            eligibleList.push(element);
          }
        });
      }
    });

    //Update Eligible List based on Inventory Availability for Price Break
    if (productItem.ignorePhantomQBreak === true) {
      productItem.contextMinQty = priceBreak.minQty;
      eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "PHANTOM_PRICE_BREAK");
    }

    if (eligibleList.length === 0) {
      repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.NO_COMPETITOR;
      return repriceModel;
    }

    //Update Eligible List based on Excluded Vendor List defined by User
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "EXCLUDED_VENDOR");

    //Update Eligible List based on Inventory Threshold defined by User
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "INVENTORY_THRESHOLD");

    //Update Eligible List based on HandlingTimeFilter
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "HANDLING_TIME");

    // Update Eligible List based on badgeIndicator
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "BADGE_INDICATOR");

    //Clean Eligible List based on Duplicate PricePoint
    let tempEligibleList = await filterEligibleList(eligibleList, priceBreak.minQty);

    //Sort the eligible list of Products based on minQty=minQty of the parameter Price
    let sortedPayload = _.sortBy(tempEligibleList, [
      (prod) => {
        return (
          _.find(prod.priceBreaks, (x) => {
            if (x.minQty == priceBreak.minQty && x.active == true) return true;
          })! as any
        ).unitPrice;
      },
    ]);
    if (!sortedPayload || (sortedPayload && sortedPayload.length < 1)) {
      return repriceModel;
    }
    //Check if first 2 are tie
    const isTieScenario = await IsTie(sortedPayload, priceBreak.minQty);
    if (isTieScenario) {
      try {
        const tieWithSister = await IsTieWithSister(sortedPayload, priceBreak.minQty, productItem);
        if (!tieWithSister) {
          excludedVendors = [];
        }
      } catch (exception) {
        console.error(`Exception in TIE Scenario for ${productItem.mpid}`);
        console.error(exception);
      }
    }

    // //Remove Sister Vendor if Both UP & DOWN selected or Compete with Next is true
    // if (
    //   allowCompeteWithNextForFloor === true ||
    //   productItem.repricingRule === 2
    // ) {
    //   rawDataForSisterCheck = _.cloneDeep(sortedPayload);
    //   sortedPayload = await filterMapper.FilterBasedOnParams(
    //     sortedPayload,
    //     productItem,
    //     "SISTER_VENDOR_EXCLUSION",
    //   );
    // }
    //Set the Lowest Price
    _.first(sortedPayload)!.priceBreaks.forEach((price: any) => {
      if (price.minQty == priceBreak.minQty && price.active == true) {
        lowestPrice = price.unitPrice;
      }
    });

    // If only Own Vendor or Sister Vendor is available, Shut down the Price Break
    if (priceBreak.minQty != 1 && priceBreak.unitPrice != 0) {
      const nonSisterVendorDetails = sortedPayload.filter((x) => x.vendorId != $.VENDOR_ID && !_.includes(excludedVendors, x.vendorId.toString()));
      if (nonSisterVendorDetails.length === 0) {
        repriceModel.repriceDetails!.newPrice = existingPrice;
        repriceModel.repriceDetails!.isRepriced = true;
        repriceModel.repriceDetails!.active = 0 as unknown as boolean;
        repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED;
        repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
        repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, priceBreak.minQty);
        return repriceModel;
      }
    }
    //If the Lowest Price is of Self-Vendor
    if (_.first(sortedPayload)!.vendorId == $.VENDOR_ID) {
      /*
        1. If the 1st Lowest Price is of Self Vendor with Price Break Not Available
        2. Then Look for the Next lowest Vendor with Price Break Available
        3. If the Next Lowest vendor is sister vendor, then skip that price break change
      */
      const existingPriceOfOwnProduct = _.first(sortedPayload)?.priceBreaks.find((x) => x.minQty == priceBreak.minQty)?.unitPrice;
      if (existingPriceOfOwnProduct == 0 && sortedPayload[1]) {
        const nextLowestVendor = sortedPayload[1].vendorId.toString();
        if (_.includes(excludedVendors, nextLowestVendor)) {
          repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.NO_COMPETITOR_SISTER_VENDOR;
          repriceModel.updateLowest(sortedPayload[1].vendorName, sortedPayload[1].priceBreaks.find((x) => x.minQty == priceBreak.minQty)!.unitPrice);
          repriceModel.updateTriggeredBy(sortedPayload[1]!.vendorName, sortedPayload[1]!.vendorId, priceBreak.minQty);
          return repriceModel;
        }
      }

      //Remove Sister Vendor if Both UP & DOWN selected or Compete with Next is true
      if (allowCompeteWithNextForFloor || productItem.repricingRule === 2) {
        rawDataForSisterCheck = _.cloneDeep(sortedPayload);
        sortedPayload = await filterMapper.FilterBasedOnParams(sortedPayload, productItem, "SISTER_VENDOR_EXCLUSION");
      }

      // if next in list is in Excluded Vendor, go to next
      let nextIndex = 1;
      if (sortedPayload[nextIndex] && _.includes(excludedVendors, sortedPayload[nextIndex].vendorId.toString())) {
        nextIndex++;
      }

      for (let i = nextIndex; i < sortedPayload.length; i++) {
        if (sortedPayload[i] && _.includes(excludedVendors, sortedPayload[i].vendorId.toString())) {
          nextIndex++;
        } else if ((await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, priceBreak.minQty, floorPrice, 0, false)) == true) {
          nextIndex++;
        } else {
          break;
        }
      }

      if (sortedPayload[nextIndex]) {
        // Check the next Lowest Price
        const nextLowestPrice = (
          _.find(sortedPayload[nextIndex].priceBreaks, (price) => {
            if (price.minQty == priceBreak.minQty && price.active == true) {
              return true;
            }
          })! as any
        ).unitPrice;
        if (nextLowestPrice > floorPrice && (nextLowestPrice >= existingPrice || allowCompeteWithNextForFloor === true)) {
          //&& nextLowestPrice >= existingPrice
          const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(nextLowestPrice), processOffset, floorPrice, parseFloat(productItem.percentageDown), priceBreak.minQty, heavyShippingPrice);
          const contextPrice = contextPriceResult.Price;
          if (nextLowestPrice > contextPrice) {
            if (contextPrice <= maxPrice) {
              if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
                repriceModel.repriceDetails!.newPrice = contextPrice.toFixed(2);
                repriceModel.repriceDetails!.isRepriced = true;
                repriceModel.repriceDetails!.explained = await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_SECOND, contextPriceResult.Type);
              } else if (nextIndex >= sortedPayload.length) {
                repriceModel.repriceDetails!.newPrice = maxPrice;
                repriceModel.repriceDetails!.isRepriced = true;
                repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL;
              }
            } else {
              repriceModel.repriceDetails!.newPrice = maxPrice;
              repriceModel.repriceDetails!.isRepriced = true;
              repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL;
            }
          } else if (existingPrice === 0) {
            //Create new Reprice Point
            repriceModel.repriceDetails!.newPrice = contextPrice.toFixed(2);
            repriceModel.repriceDetails!.isRepriced = true;
            repriceModel.repriceDetails!.explained = await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.IGNORE_OWN, contextPriceResult.Type);
          }
        }
        //1. If Next Lowest price is Greater Than Floor Price
        //2. Floor Price is Not Equal to Existing Price
        //SET: Floor Price
        else if (nextLowestPrice > floorPrice && floorPrice != existingPrice) {
          // repriceModel.repriceDetails.newPrice = floorPrice.toFixed(2);
          // repriceModel.repriceDetails.isRepriced = true;
          // repriceModel.repriceDetails.explained = _enum.PRICE_UP_SECOND_FLOOR;
        }
        //1. If Next Lowest price is Greater Than Max Price
        //2. Max Price is Not Equal to Existing Price
        //SET: Max Price
        else if (nextLowestPrice > productItem.maxPrice && productItem.maxPrice != existingPrice) {
          repriceModel.repriceDetails!.newPrice = maxPrice;
          repriceModel.repriceDetails!.isRepriced = true;
          repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX;
        }
        repriceModel.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, priceBreak.minQty);
      } else {
        repriceModel.repriceDetails!.newPrice = maxPrice;
        repriceModel.repriceDetails!.isRepriced = true;
        repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX;
        repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, priceBreak.minQty);
      }
      repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
    }
    // Check if the lowest price is of the same parent company
    else if (_.includes(excludedVendors, _.first(sortedPayload)!.vendorId.toString())) {
      repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.NO_COMPETITOR_SISTER_VENDOR;
      repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
      const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(lowestPrice as any), processOffset, floorPrice, parseFloat(productItem.percentageDown), priceBreak.minQty, heavyShippingPrice);
      repriceModel.repriceDetails!.goToPrice = contextPriceResult.Price.toFixed(2);
      repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, priceBreak.minQty);
      return repriceModel;
    }
    // For Other Vendors
    else {
      //Remove Sister Vendor if Both UP & DOWN selected or Compete with Next is true
      if (allowCompeteWithNextForFloor || productItem.repricingRule === 2) {
        rawDataForSisterCheck = _.cloneDeep(sortedPayload);
        sortedPayload = await filterMapper.FilterBasedOnParams(sortedPayload, productItem, "SISTER_VENDOR_EXCLUSION");
      }

      // Check the Lowest Price
      const prodPriceWithMinQty = _.first(sortedPayload)!.priceBreaks.find((x: any) => x.minQty == priceBreak.minQty && x.active == true);
      if (prodPriceWithMinQty) {
        const lowestPrice = prodPriceWithMinQty.unitPrice;
        const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(lowestPrice as any), processOffset, floorPrice, parseFloat(productItem.percentageDown), priceBreak.minQty, heavyShippingPrice);
        let offsetPrice = contextPriceResult.Price;
        //1. If the Offset Price is less than Floor Price
        //SET: Do Nothing
        if (offsetPrice <= floorPrice) {
          //If Lowest is below Floor and competing with others and Sister is already Lowest
          const floorSisterResult = await filterMapper.VerifyFloorWithSister(productItem, refProduct, rawDataForSisterCheck, excludedVendors, $.VENDOR_ID, priceBreak.minQty, sourceId);

          //if (floorSisterResult != false) return floorSisterResult;
          //do nothing
          let nextIndex = 1;
          for (let i = nextIndex; i < sortedPayload.length; i++) {
            if (sortedPayload[i]) {
              if (_.includes(excludedVendors, sortedPayload[i].vendorId.toString()) || sortedPayload[i].vendorId == $.VENDOR_ID) {
                nextIndex++;
              } else if (sortedPayload[i] && (await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, priceBreak.minQty, floorPrice, 0, false))) {
                nextIndex++;
              } else break;
            }
          }
          if (sortedPayload[nextIndex] && (_.includes(excludedVendors, sortedPayload[nextIndex].vendorId.toString()) || sortedPayload[nextIndex].vendorId == $.VENDOR_ID)) {
            nextIndex++;
          }
          if (sortedPayload[nextIndex]) {
            const nextLowestPriceBreak = _.find(sortedPayload[nextIndex].priceBreaks, (price) => {
              if (price.minQty == priceBreak.minQty && price.active == true) {
                return true;
              }
            });
            if (nextLowestPriceBreak) {
              const nextLowestPrice = (nextLowestPriceBreak as any).unitPrice;
              if (nextLowestPrice > floorPrice && (nextLowestPrice >= existingPrice || allowCompeteWithNextForFloor === true)) {
                //&& nextLowestPrice >= existingPrice
                const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(nextLowestPrice), processOffset, floorPrice, parseFloat(productItem.percentageDown), priceBreak.minQty, heavyShippingPrice);
                const contextPrice = contextPriceResult.Price;
                if (contextPrice < existingPrice && floorSisterResult !== false) {
                  //Check for Sister Being lowest only while going Down
                  return floorSisterResult;
                }
                if (nextLowestPrice > contextPrice && contextPrice <= maxPrice) {
                  if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
                    repriceModel.repriceDetails!.newPrice = contextPrice.toFixed(2);
                    repriceModel.repriceDetails!.isRepriced = true;
                    repriceModel.repriceDetails!.explained = await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT, contextPriceResult.Type);
                    offsetPrice = contextPrice;
                  }
                } else if (existingPrice === 0) {
                  //Create new Reprice Point
                  repriceModel.repriceDetails!.newPrice = contextPrice.toFixed(2);
                  repriceModel.repriceDetails!.isRepriced = true;
                  repriceModel.repriceDetails!.explained = await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.NEW_PRICE_BREAK, contextPriceResult.Type);
                }
              }
            }
            repriceModel.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, priceBreak.minQty);
          } else {
            if (priceBreak.minQty != 1) {
              repriceModel.repriceDetails!.newPrice = existingPrice;
              repriceModel.repriceDetails!.isRepriced = true;
              repriceModel.repriceDetails!.active = 0 as unknown as boolean;
              repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED;
            } else {
              repriceModel.repriceDetails!.newPrice = maxPrice;
              repriceModel.repriceDetails!.isRepriced = true;
              repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX;
            }
            repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, priceBreak.minQty);
          }
        }
        //1. If the Offset Price is greater than Floor Price
        //2. If the Offset Price is less than Max Price
        //SET: Offset Price
        if (offsetPrice > floorPrice && !repriceModel.repriceDetails!.isRepriced) {
          if (offsetPrice < maxPrice) {
            repriceModel.repriceDetails!.newPrice = offsetPrice.toFixed(2);
            repriceModel.repriceDetails!.isRepriced = true;
            repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.REPRICE_DEFAULT;
          } else {
            repriceModel.repriceDetails!.newPrice = maxPrice;
            repriceModel.repriceDetails!.isRepriced = true;
            repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_MAXED;
          }
          repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, priceBreak.minQty);
        } else if (offsetPrice <= floorPrice && repriceModel.repriceDetails!.isRepriced == false && parseFloat(existingPrice) > parseFloat(maxPrice)) {
          repriceModel.repriceDetails!.newPrice = maxPrice;
          repriceModel.repriceDetails!.isRepriced = true;
          repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_MAXED;
        } else if (offsetPrice <= floorPrice && !repriceModel.repriceDetails!.isRepriced) {
          repriceModel.repriceDetails!.goToPrice = offsetPrice;
          repriceModel.repriceDetails!.newPrice = "N/A";
          repriceModel.repriceDetails!.isRepriced = false;
          repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED;
          repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, priceBreak.minQty);
        }
        repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
      }
    }
    if (isTieScenario) {
      repriceModel.repriceDetails!.explained = repriceModel.repriceDetails!.explained + " #TIE";
    }

    // For Applying Badge Percentage Scenario
    if (_.isEqual(productItem.badgeIndicator, "ALL_PERCENTAGE") && productItem.badgePercentage > 0) {
      repriceModel = await badgeHelper.ReCalculatePrice(repriceModel, productItem, eligibleList, priceBreak.minQty);
    }
  } catch (exception) {
    console.log(`Error in Reprice for mpid : ${productItem.mpid} || Error : ${exception}`);
  }
  return repriceModel;
}

export async function GetDistinctPriceBreaksAcrossVendors(listOfProducts: Net32Product[], ownProduct: Net32Product, productItem: FrontierProduct) {
  const $ = await globalParam.GetInfo(ownProduct.vendorId, productItem);
  let pricePoints: Net32PriceBreak[] = [];
  if (!ownProduct) return pricePoints;
  listOfProducts.forEach((x) => {
    if (x.vendorId != $.VENDOR_ID) {
      if (x.priceBreaks && x.priceBreaks.length > 0) {
        x.priceBreaks.forEach((p) => {
          const ownPriceBreak = ownProduct.priceBreaks.find(($pb) => $pb.minQty == p.minQty);
          if (!ownPriceBreak && !pricePoints.find(($) => $.minQty == p.minQty)) {
            pricePoints.push({
              minQty: p.minQty,
              unitPrice: 0,
              active: true,
            });
          }
        });
      }
    }
  });
  return pricePoints;
}

export async function RepriceToMax(refProduct: Net32Product, payload: Net32Product[], productItem: FrontierProduct, sourceId: string) {
  const existingPrice = refProduct.priceBreaks.find((x) => x.minQty == 1)!.unitPrice;
  const maxPrice = productItem.maxPrice ? parseFloat(productItem.maxPrice) : 99999;
  let lowestPrice = 0;
  let repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, maxPrice, true, false, [], RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL);
  if (repriceModel.repriceDetails) {
    repriceModel.repriceDetails.oldPrice = existingPrice;
  }
  //Sort the eligible list of Products based on minQty=1 Price
  let sortedPayload = _.sortBy(payload, [
    (prod) => {
      return prod.priceBreaks.find((x) => x.minQty == 1 && x.active == true)!.unitPrice;
    },
  ]);
  _.first(sortedPayload)!.priceBreaks.forEach((price) => {
    if (price.minQty == 1 && price.active == true) {
      lowestPrice = price.unitPrice;
    }
  });
  repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
  return repriceModel;
}

//<!-- PRIVATE FUNCTIONS -->
function isNotShortExpiryProduct(priceBreaks: Net32PriceBreak, listOfPriceBreaks: Net32PriceBreak[], _minQty: number) {
  const contextPriceBreaks = _.filter(listOfPriceBreaks, (x) => x.minQty == _minQty && x.active == true);
  if (contextPriceBreaks && contextPriceBreaks.length > 1) {
    let resultantEval = true;
    contextPriceBreaks.forEach((x) => {
      if (x.promoAddlDescr && (x.promoAddlDescr.toUpperCase().indexOf("EXP") > -1 || x.promoAddlDescr.toUpperCase().indexOf("SHORT") > -1)) {
        resultantEval = false;
      }
    });
    return resultantEval;
  }
  if (priceBreaks && priceBreaks.promoAddlDescr) {
    return priceBreaks.promoAddlDescr.toUpperCase().indexOf("EXP") < 0 && priceBreaks.promoAddlDescr.toUpperCase().indexOf("SHORT") < 0;
  }
  return true;
}

async function IsTie(sortedPayload: Net32Product[], _minQty: number) {
  if (applicationConfig.IGNORE_TIE) {
    return false;
  }
  const firstItem = _.first(sortedPayload);
  const secondItem = _.nth(sortedPayload, 1);
  if (firstItem && secondItem) {
    const firstItemPrice = firstItem.priceBreaks.find((x) => x.minQty == _minQty && x.active == true)!.unitPrice;
    const secondItemPrice = secondItem.priceBreaks.find((x) => x.minQty == _minQty && x.active == true)!.unitPrice;
    return firstItemPrice === secondItemPrice;
  }
  return false;
}

async function IsTieWithSister(sortedPayload: Net32Product[], _minQty: number, productItem: FrontierProduct) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  const firstItem = _.first(sortedPayload);
  const secondItem = _.nth(sortedPayload, 1);
  let tempAllowedVendor = $.EXCLUDED_VENDOR_ID.split(";");
  tempAllowedVendor.push($.VENDOR_ID);
  const isFirstItemValid = _.includes(tempAllowedVendor, firstItem!.vendorId.toString());
  const isSecondItemValid = _.includes(tempAllowedVendor, secondItem!.vendorId.toString());
  if (firstItem && secondItem && isFirstItemValid && isSecondItemValid) {
    const firstItemPrice = firstItem.priceBreaks.find((x) => x.minQty == _minQty && x.active == true)!.unitPrice;
    const secondItemPrice = secondItem.priceBreaks.find((x) => x.minQty == _minQty && x.active == true)!.unitPrice;
    return firstItemPrice === secondItemPrice;
  }
  return false;
}

async function filterEligibleList(eligibleList: Net32Product[], _minQty: number) {
  let cloneList = _.cloneDeep(eligibleList);
  for (let vendorDet of cloneList) {
    _.sortBy(vendorDet.priceBreaks, ["minQty", "unitPrice"], ["desc"]);
    const groupedPriceInfo = _.groupBy(vendorDet.priceBreaks, (x) => x.minQty);
    if (groupedPriceInfo && groupedPriceInfo[_minQty] && groupedPriceInfo[_minQty].length > 1) {
      for (let idx = 0; idx < groupedPriceInfo[_minQty].length - 1; idx++) {
        const contextIndex = _.findIndex(vendorDet.priceBreaks, ["unitPrice", groupedPriceInfo[_minQty][idx].unitPrice]);
        if (contextIndex > -1) {
          _.pullAt(vendorDet.priceBreaks, contextIndex);
        }
      }
    }
  }
  return cloneList;
}
