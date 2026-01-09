import _ from "lodash";
import { RepriceModel } from "../../../model/reprice-model";
import { RepriceRenewedMessageEnum } from "../../../model/reprice-renewed-message";
import * as globalParam from "../../../model/global-param";
import * as badgeHelper from "../../badge-helper";
import * as filterMapper from "../../filter-mapper";
import { Net32PriceBreak, Net32Product } from "../../../types/net32";
import { FrontierProduct } from "../../../types/frontier";
import { applicationConfig } from "../../config";

export async function Reprice(refProduct: any, payload: any, productItem: any, sourceId: string) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  let repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, 0, false, false, [], RepriceRenewedMessageEnum.DEFAULT);
  const unitPrice = refProduct.priceBreaks.find((x: any) => x.minQty == 1).unitPrice;
  const standardShippingPrice = GetShippingPrice(refProduct);
  const existingPrice = unitPrice + standardShippingPrice;
  repriceModel.repriceDetails!.oldPrice = unitPrice;
  const maxPrice = productItem.maxPrice ? parseFloat(productItem.maxPrice) : 99999;
  const floorPrice = productItem.floorPrice ? parseFloat(productItem.floorPrice) : 0;
  let lowestPrice = 0;
  const processOffset = applicationConfig.OFFSET;
  let excludedVendors = productItem.competeAll === true ? [] : $.EXCLUDED_VENDOR_ID.split(";");
  const allowCompeteWithNextForFloor = productItem.competeWithNext;
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
    //eligibleList = await getEligibleListBasedOnHandlingTimeFilter(eligibleList, productItem);

    // Update Eligible List based on badgeIndicator
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "BADGE_INDICATOR");
    //eligibleList = await getEligibleListBasedOnBadgeIndicator(eligibleList, productItem);

    //Clean Eligible List based on Duplicate PricePoint
    let tempEligibleList = await filterEligibleList(eligibleList, 1);

    //Sort the eligible list of Products based on minQty=1 Price
    let sortedPayload = _.sortBy(tempEligibleList, [
      (prod) => {
        return (
          (
            _.find(prod.priceBreaks!, (x) => {
              if (x.minQty == 1 && x.active == true) return true;
            }) as any
          ).unitPrice + GetShippingPrice(prod)
        );
      },
    ]);
    if (!sortedPayload || (sortedPayload && sortedPayload.length < 1)) {
      return repriceModel;
    }

    //Check if first 2 are tie
    const isTieScenario = await IsTie(sortedPayload, 1);
    if (isTieScenario === true) {
      try {
        const tieWithSister = await IsTieWithSister(sortedPayload, 1, productItem);
        if (tieWithSister !== true) {
          excludedVendors = [];
        }
      } catch (exception) {
        console.error(`Exception in TIE Scenario for ${productItem.mpid}`);
        console.error(exception);
      }
    }

    //Remove Sister Vendor if Both UP & DOWN selected or Compete with Next is true
    if (allowCompeteWithNextForFloor === true || productItem.repricingRule === 2) {
      sortedPayload = await filterMapper.FilterBasedOnParams(sortedPayload, productItem, "SISTER_VENDOR_EXCLUSION");
    }

    //Set the Lowest Price
    if (sortedPayload && sortedPayload.length > 0) {
      _.first(sortedPayload)!.priceBreaks!.forEach((price: any) => {
        if (price.minQty == 1 && price.active == true) {
          lowestPrice = price.unitPrice + GetShippingPrice(_.first(sortedPayload)!);
        }
      });
    }

    //If the Lowest Price is of Self-Vendor
    if (_.first(sortedPayload)!.vendorId == $.VENDOR_ID) {
      // If no Competitor found
      if (sortedPayload.length === 1) {
        const newPrice = productItem.maxPrice ? productItem.maxPrice : "N/A";
        const model = new RepriceModel(sourceId, refProduct, productItem.productName, newPrice, newPrice != "N/A", false, [], RepriceRenewedMessageEnum.NO_COMPETITOR);
        model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
        model.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
        return model;
      }

      // if next in list is in Excluded Vendor, go to next
      let nextIndex = 1;
      if (sortedPayload[nextIndex] && _.includes(excludedVendors, sortedPayload[nextIndex].vendorId.toString())) {
        nextIndex++;
      }

      for (let i = nextIndex; i <= sortedPayload.length; i++) {
        if (sortedPayload[i] && _.includes(excludedVendors, sortedPayload[i].vendorId.toString())) {
          nextIndex++;
        } else if ((await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, 1, floorPrice, GetShippingPrice(sortedPayload[i]), true)) == true) {
          nextIndex++;
        } else {
          break;
        }
      }
      // Check the next Lowest Price
      const nextLowestPrice =
        (
          _.find(sortedPayload[nextIndex].priceBreaks!, (price) => {
            if (price.minQty == 1 && price.active == true) {
              return true;
            }
          }) as any
        ).unitPrice + GetShippingPrice(sortedPayload[nextIndex]);
      if (nextLowestPrice > floorPrice && (nextLowestPrice >= existingPrice || allowCompeteWithNextForFloor === true)) {
        //&& nextLowestPrice >= existingPrice
        const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(nextLowestPrice), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1);
        const contextPrice = contextPriceResult.Price;
        if (nextLowestPrice > contextPrice && contextPrice <= maxPrice) {
          if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
            repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, contextPrice - standardShippingPrice, true, false, [], await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_NEXT, contextPriceResult.Type));
          }
        } else {
          repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, unitPrice, false, false, [], RepriceRenewedMessageEnum.IGNORE_OWN);
          repriceModel.repriceDetails!.goToPrice = contextPrice - standardShippingPrice;
        }
      }
      //1. If Next Lowest price is Greater Than Floor Price
      //2. Floor Price is Not Equal to Existing Price
      //SET: Floor Price
      else if (nextLowestPrice > floorPrice && floorPrice !== existingPrice) {
        //repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, floorPrice, true, false, [], _enum.PRICE_UP_SECOND_FLOOR);
      }
      //1. If Next Lowest price is Greater Than Max Price
      //2. Max Price is Not Equal to Existing Price
      //SET: Max Price
      else if (nextLowestPrice > productItem.maxPrice && productItem.maxPrice != existingPrice) {
        repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, productItem.maxPrice, true, false, [], RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX);
      }
      repriceModel.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, 1);
      repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
    }
    // For Other Vendors
    else {
      // Check if the lowest price is of the same parent company
      if (_.includes(excludedVendors, _.first(sortedPayload)!.vendorId.toString())) {
        let model = new RepriceModel(sourceId, refProduct, productItem.productName, unitPrice, false, false, [], RepriceRenewedMessageEnum.NO_COMPETITOR_SISTER_VENDOR);
        model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
        const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(lowestPrice as any), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1);
        model.repriceDetails!.goToPrice = (contextPriceResult.Price - standardShippingPrice).toFixed(2);
        model.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
        return model;
      }

      // Check the Lowest Price
      const prodPriceWithMinQty = _.first(sortedPayload)!.priceBreaks!.find((x: any) => x.minQty == 1 && x.active == true);
      if (prodPriceWithMinQty) {
        const lowestPrice = prodPriceWithMinQty.unitPrice + GetShippingPrice(_.first(sortedPayload)!);
        const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(lowestPrice as any), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1);
        let contextPrice = contextPriceResult.Price;
        let offsetPrice = contextPrice;
        //1. If the Offset Price is less than Floor Price
        //SET: Do Nothing
        if (offsetPrice <= floorPrice) {
          //If Own vendor is 2nd Lowest
          if (sortedPayload[1] && sortedPayload[1].vendorId == $.VENDOR_ID) {
            let nextIndex = 2;
            for (let i = nextIndex; i <= sortedPayload.length; i++) {
              if (sortedPayload[i] && (_.includes(excludedVendors, sortedPayload[i].vendorId.toString()) || sortedPayload[i].vendorId == $.VENDOR_ID)) {
                nextIndex++;
              } else if (sortedPayload[i] && (await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, 1, floorPrice, GetShippingPrice(sortedPayload[i]), true)) === true) {
                nextIndex++;
              } else {
                break;
              }
            }
            // if (sortedPayload[nextIndex] && _.includes(excludedVendors, sortedPayload[nextIndex].vendorId.toString())) {
            //     nextIndex++;
            // }
            if (!sortedPayload[nextIndex]) {
              if (existingPrice != productItem.maxPrice) {
                let model = new RepriceModel(sourceId, refProduct, productItem.productName, productItem.maxPrice, true, false, [], RepriceRenewedMessageEnum.PRICE_MAXED);
                model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
                return model;
              } else {
                let model = new RepriceModel(sourceId, refProduct, productItem.productName, "N/A", false, false, [], RepriceRenewedMessageEnum.IGNORE_ALREADY_MAXED);
                model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
                return model;
              }
            }
            const nextLowestPrice =
              (
                _.find(sortedPayload[nextIndex].priceBreaks!, (price) => {
                  if (price.minQty == 1 && price.active == true) {
                    return true;
                  }
                }) as any
              ).unitPrice + GetShippingPrice(sortedPayload[nextIndex]);
            if (nextLowestPrice > floorPrice && (nextLowestPrice >= existingPrice || allowCompeteWithNextForFloor === true)) {
              //&& nextLowestPrice >= existingPrice
              const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(nextLowestPrice), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1);
              contextPrice = contextPriceResult.Price;
              if (nextLowestPrice > contextPrice) {
                if (contextPrice.toFixed(2) !== existingPrice.toFixed(2) && contextPrice <= maxPrice) {
                  const model = new RepriceModel(sourceId, refProduct, productItem.productName, contextPrice - standardShippingPrice, true, false, [], await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT, contextPriceResult.Type));
                  model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
                  return model;
                } else if (contextPrice.toFixed(2) !== existingPrice.toFixed(2) && contextPrice > maxPrice) {
                  let model = new RepriceModel(sourceId, refProduct, productItem.productName, productItem.maxPrice - standardShippingPrice, true, false, [], RepriceRenewedMessageEnum.PRICE_MAXED);
                  model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
                  return model;
                }
              } else {
                repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, unitPrice, false, false, [], RepriceRenewedMessageEnum.IGNORE_OWN);
                repriceModel.repriceDetails!.goToPrice = contextPrice - standardShippingPrice;
              }
            }
          } else if (sortedPayload[1]) {
            let nextIndex = 1;
            for (let i = nextIndex; i <= sortedPayload.length; i++) {
              if (sortedPayload[i] && (_.includes(excludedVendors, sortedPayload[i].vendorId.toString()) || sortedPayload[i].vendorId == $.VENDOR_ID)) {
                nextIndex++;
              } else if (sortedPayload[i] && (await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, 1, floorPrice, GetShippingPrice(sortedPayload[i]), true)) == true) {
                nextIndex++;
              } else {
                break;
              }
            }
            if (sortedPayload[nextIndex]) {
              const secondLowestPrice = (sortedPayload[nextIndex].priceBreaks!.find((x: any) => x.minQty == 1 && x.active == true) as any).unitPrice + GetShippingPrice(sortedPayload[nextIndex]);
              if (secondLowestPrice && (secondLowestPrice >= existingPrice || allowCompeteWithNextForFloor === true)) {
                const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(secondLowestPrice), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1);
                contextPrice = contextPriceResult.Price;
                repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, contextPrice - standardShippingPrice, true, false, [], await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT, contextPriceResult.Type));
                offsetPrice = contextPrice - standardShippingPrice;
                repriceModel.repriceDetails!.isRepriced = true;
                repriceModel.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, 1);
              }
            } else {
              const maxPriceToBeSet = await getSetPrice(maxPrice, refProduct.standardShipping, refProduct.freeShippingThreshold, 1);
              repriceModel.repriceDetails!.newPrice = maxPriceToBeSet;
              repriceModel.repriceDetails!.isRepriced = true;
              repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_MAXED;
            }
          } else {
            repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, unitPrice, false, false, [], RepriceRenewedMessageEnum.IGNORE_OWN);
          }
        }
        //1. If the Offset Price is greater than Floor Price
        //2. If the Offset Price is less than Max Price
        //SET: Offset Price
        if (repriceModel.repriceDetails!.isRepriced !== true) {
          if (offsetPrice > floorPrice) {
            if (offsetPrice > maxPrice) {
              offsetPrice = maxPrice;
              const tempPriceMax = await getSetPrice(offsetPrice, refProduct.standardShipping, refProduct.freeShippingThreshold, 1);
              repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, parseFloat(tempPriceMax), true, false, [], RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL);
            } else {
              const tempPriceUpdated = await getSetPrice(offsetPrice, refProduct.standardShipping, refProduct.freeShippingThreshold, 1);
              repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, parseFloat(tempPriceUpdated), true, false, [], RepriceRenewedMessageEnum.PRICE_UP_NEXT);
            }
          } else if (parseFloat(existingPrice) > maxPrice) {
            const maxPriceToBeSet = await getSetPrice(maxPrice, refProduct.standardShipping, refProduct.freeShippingThreshold, 1);
            repriceModel.repriceDetails!.newPrice = maxPriceToBeSet;
            repriceModel.repriceDetails!.isRepriced = true;
            repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_MAXED;
          } else {
            const tempPriceUpdated = await getSetPrice(offsetPrice, refProduct.standardShipping, refProduct.freeShippingThreshold, 1);
            repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, unitPrice, false, false, [], RepriceRenewedMessageEnum.OFFSET_LESS_THAN_FLOOR);
            repriceModel.repriceDetails!.goToPrice = tempPriceUpdated;
          }
          repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, 1);
        }
      } else {
        repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, unitPrice, false, false, [], RepriceRenewedMessageEnum.DEFAULT);
      }
      repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
    }
    if (isTieScenario === true) {
      repriceModel.repriceDetails!.explained = repriceModel.repriceDetails!.explained + " #TIE";
    }

    // For Applying Badge Percentage Scenario
    if (_.isEqual(productItem.badgeIndicator, "ALL_PERCENTAGE") && productItem.badgePercentage > 0) {
      repriceModel = await badgeHelper.ReCalculatePriceForNc(repriceModel, productItem, eligibleList, 1);
    }
  } catch (exception) {
    console.log(`Error in Reprice for mpid : ${productItem.mpid} || Error : ${exception}`);
  }
  return repriceModel;
}

export async function RepriceIndividualPriceBreak(refProduct: any, payload: any, productItem: any, sourceId: string, priceBreak: any) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  const unitPrice = priceBreak.unitPrice;
  const standardShippingPrice = GetShippingPriceForPriceBreak(refProduct, priceBreak);
  const existingPrice = unitPrice + standardShippingPrice;
  const processOffset = applicationConfig.OFFSET;
  let repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, 0, false, false, [], RepriceRenewedMessageEnum.IGNORE_OWN);
  repriceModel.repriceDetails!.oldPrice = unitPrice;
  repriceModel.repriceDetails!.minQty = priceBreak.minQty;
  const maxPrice = productItem.maxPrice ? parseFloat(productItem.maxPrice) : 99999;
  const floorPrice = productItem.floorPrice ? parseFloat(productItem.floorPrice) : 0;
  let lowestPrice = 0;
  let excludedVendors = productItem.competeAll === true ? [] : $.EXCLUDED_VENDOR_ID.split(";");
  const allowCompeteWithNextForFloor = productItem.competeWithNext;
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

    //Compare Q2 with Q1
    if (productItem.compareWithQ1 === true && priceBreak.minQty === 2) {
      eligibleList = [];
      payload.forEach((element: any) => {
        if (element.priceBreaks) {
          element.priceBreaks.forEach((p: any) => {
            if (p.minQty == 1 && p.active == true && isNotShortExpiryProduct(p, element.priceBreaks, 1) && !eligibleList.find((x) => x.vendorId == element.vendorId) && !_.includes(excludedVendors, element.vendorId.toString()) && element.vendorId.toString() != refProduct.vendorId.toString()) {
              eligibleList.push(element);
            }
          });
        }
      });
      let q2EligibleList: any[] = [];
      let q2EligibleListAll: any[] = [];
      payload.forEach((element: any) => {
        if (element.priceBreaks) {
          element.priceBreaks.forEach((p: any) => {
            if (p.minQty == 2 && p.active == true && isNotShortExpiryProduct(p, element.priceBreaks, 2) && !q2EligibleList.find((x) => x.vendorId == element.vendorId) && !_.includes(excludedVendors, element.vendorId.toString()) && element.vendorId.toString() != refProduct.vendorId.toString()) {
              q2EligibleList.push(element);
            }
            if (p.minQty == 2 && p.active == true && isNotShortExpiryProduct(p, element.priceBreaks, 2) && !q2EligibleListAll.find((x) => x.vendorId == element.vendorId) && element.vendorId.toString() != refProduct.vendorId.toString()) {
              q2EligibleListAll.push(element);
            }
          });
        }
      });
      // Update Eligible List based on badgeIndicator
      eligibleList = await getEligibleListBasedOnBadgeIndicator(eligibleList, productItem);
      q2EligibleList = await getEligibleListBasedOnBadgeIndicator(q2EligibleList, productItem);
      q2EligibleListAll = await getEligibleListBasedOnBadgeIndicator(q2EligibleListAll, productItem);

      if (eligibleList.length === 0) {
        repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.NO_COMPETITOR;
        return repriceModel;
      }

      q2EligibleListAll = _.sortBy(q2EligibleListAll, [
        (prod) => {
          return _.find(prod.priceBreaks, (x) => {
            if (x.minQty == priceBreak.minQty && x.active == true) return true;
          }).unitPrice;
        },
      ]);
      eligibleList = _.sortBy(eligibleList, [
        (prod) => {
          return _.find(prod.priceBreaks, (x) => {
            if (x.minQty == 1 && x.active == true) return true;
          }).unitPrice;
        },
      ]);
      q2EligibleList = _.sortBy(q2EligibleList, [
        (prod) => {
          return _.find(prod.priceBreaks, (x) => {
            if (x.minQty == priceBreak.minQty && x.active == true) return true;
          }).unitPrice;
        },
      ]);

      const lowestUnitMinQtyPrice = await getLowestPrice(eligibleList, 1);
      const lowestQ2UnitPrice = await getLowestPrice(q2EligibleList, 2);
      const comparePrice = await getComparablePrice(lowestUnitMinQtyPrice, lowestQ2UnitPrice);
      if (comparePrice && (comparePrice as any).Price > 0) {
        // Check if comparable Price is available for Sister.
        if (comparePrice.Type == "Q2" && q2EligibleListAll.length > 0 && _.includes(excludedVendors, _.first(q2EligibleListAll).vendorId.toString())) {
          repriceModel.repriceDetails!.explained = repriceModel.repriceDetails!.explained + "_" + RepriceRenewedMessageEnum.IGNORED_Q2_VS_Q1_SISTER;
          repriceModel.updateTriggeredBy(_.first(q2EligibleListAll).vendorName, _.first(q2EligibleListAll).vendorId, priceBreak.minQty);
          return repriceModel;
        }
        //const suggestedPrice = repriceModel.repriceDetails.newPrice != "N/A" ? parseFloat(repriceModel.repriceDetails.newPrice) : 0;
        if ((comparePrice as any).Price - standardShippingPrice - processOffset >= floorPrice) {
          repriceModel.repriceDetails!.newPrice = await getSetPrice((comparePrice as any).Price - processOffset, refProduct.standardShipping, refProduct.freeShippingThreshold, priceBreak.minQty);
          repriceModel.repriceDetails!.isRepriced = true;
          repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.REPRICE_Q2_VS_Q1;
          if ((comparePrice as any).Type === "Q2") {
            repriceModel.updateTriggeredBy(_.first(q2EligibleList).vendorName, _.first(q2EligibleList).vendorId, priceBreak.minQty);
          } else {
            repriceModel.updateTriggeredBy(_.first(eligibleList).vendorName, _.first(eligibleList).vendorId, priceBreak.minQty);
          }
        } else {
          repriceModel.repriceDetails!.explained = repriceModel.repriceDetails!.explained + "_" + RepriceRenewedMessageEnum.IGNORED_Q2_VS_Q1;
        }
      }
      if (repriceModel.repriceDetails!.isRepriced === true) {
        return repriceModel;
      }
    }

    //Update Eligible List based on Excluded Vendor List defined by User
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "EXCLUDED_VENDOR");

    //Update Eligible List based on Inventory Threshold defined by User
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "INVENTORY_THRESHOLD");

    //Update Eligible List based on HandlingTimeFilter
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "HANDLING_TIME");
    //eligibleList = await getEligibleListBasedOnHandlingTimeFilter(eligibleList, productItem);

    // Update Eligible List based on badgeIndicator
    eligibleList = await filterMapper.FilterBasedOnParams(eligibleList, productItem, "BADGE_INDICATOR");
    //eligibleList = await getEligibleListBasedOnBadgeIndicator(eligibleList, productItem);

    if (eligibleList.length === 0) {
      repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.NO_COMPETITOR;
      return repriceModel;
    }

    //Clean Eligible List based on Duplicate PricePoint
    let tempEligibleList = await filterEligibleList(eligibleList, priceBreak.minQty);

    //Sort the eligible list of Products based on minQty=minQty of the parameter Price
    let sortedPayload = _.sortBy(tempEligibleList, [
      (prod) => {
        return (
          (
            _.find(prod.priceBreaks!, (x) => {
              if (x.minQty == priceBreak.minQty && x.active == true) return true;
            }) as any
          ).unitPrice + GetShippingPriceForPriceBreak(prod, priceBreak)
        );
      },
    ]);

    if (!sortedPayload || (sortedPayload && sortedPayload.length < 1)) {
      return repriceModel;
    }

    //Check if first 2 are tie
    const isTieScenario = await IsTie(sortedPayload, priceBreak.minQty);
    if (isTieScenario === true) {
      try {
        const tieWithSister = await IsTieWithSister(sortedPayload, priceBreak.minQty, productItem);
        if (tieWithSister !== true) {
          excludedVendors = [];
        }
      } catch (exception) {
        console.error(`Exception in TIE Scenario for ${productItem.mpid}`);
        console.error(exception);
      }
    }
    let sortedPriceBreakAllVendors = _.cloneDeep(sortedPayload);
    //Remove Sister Vendor if Both UP & DOWN selected or Compete with Next is true
    if (allowCompeteWithNextForFloor === true || productItem.repricingRule === 2) {
      sortedPayload = await filterMapper.FilterBasedOnParams(sortedPayload, productItem, "SISTER_VENDOR_EXCLUSION");
    }
    //Set the Lowest Price
    _.first(sortedPayload)!.priceBreaks.forEach((price: any) => {
      if (price.minQty == priceBreak.minQty && price.active == true) {
        lowestPrice = price.unitPrice + GetShippingPriceForPriceBreak(_.first(sortedPayload)!, priceBreak);
      }
    });

    // If only Own Vendor or Sister Vendor is available, Shut down the Price Break
    if (priceBreak.minQty != 1 && priceBreak.unitPrice != 0) {
      const nonSisterVendorDetails = sortedPayload.filter((x) => x.vendorId != $.VENDOR_ID && !_.includes(excludedVendors, x.vendorId.toString()));
      if (nonSisterVendorDetails.length === 0) {
        repriceModel.repriceDetails!.newPrice = unitPrice;
        repriceModel.repriceDetails!.isRepriced = true;
        repriceModel.repriceDetails!.active = 0 as unknown as boolean;
        repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED;
        repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
        repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, priceBreak.minQty);
        return repriceModel;
      }
    }
    let isDummyPriceBreak = false;
    //If the Lowest Price is of Self-Vendor
    if (_.first(sortedPayload)!.vendorId == $.VENDOR_ID) {
      /*
        1. If the 1st Lowest Price is of Self Vendor with Price Break Not Available
        2. Then Look for the Next lowest Vendor with Price Break Available
        3. If the Next Lowest vendor is sister vendor, then skip that price break change
      */
      if (priceBreak.minQty != 1) {
        const existingPriceOfOwnProduct = _.first(sortedPriceBreakAllVendors)?.priceBreaks.find((x) => x.minQty == priceBreak.minQty)?.unitPrice;
        if (existingPriceOfOwnProduct == 0 && sortedPriceBreakAllVendors[1]) {
          isDummyPriceBreak = true;
          const nextLowestVendor = sortedPriceBreakAllVendors[1].vendorId.toString();
          if (_.includes(excludedVendors, nextLowestVendor)) {
            repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.NO_COMPETITOR_SISTER_VENDOR;
            repriceModel.updateLowest(sortedPriceBreakAllVendors[1].vendorName, sortedPriceBreakAllVendors[1].priceBreaks.find((x) => x.minQty == priceBreak.minQty)!.unitPrice);
            repriceModel.updateTriggeredBy(sortedPriceBreakAllVendors[1]!.vendorName, sortedPriceBreakAllVendors[1]!.vendorId, priceBreak.minQty);
            return repriceModel;
          }
        }
      }

      // if next in list is in Excluded Vendor, go to next
      let nextIndex = 1;
      if (sortedPayload[nextIndex] && _.includes(excludedVendors, sortedPayload[nextIndex].vendorId.toString())) {
        nextIndex++;
      }

      for (let i = nextIndex; i <= sortedPayload.length; i++) {
        if (sortedPayload[i] && _.includes(excludedVendors, sortedPayload[i].vendorId.toString())) {
          nextIndex++;
        } else if ((await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, priceBreak.minQty, floorPrice, GetShippingPrice(sortedPayload[i]), true)) == true) {
          nextIndex++;
        } else {
          break;
        }
      }

      repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, priceBreak.minQty);
      if (sortedPayload[nextIndex]) {
        // Check the next Lowest Price
        const nextLowestPrice =
          (
            _.find(sortedPayload[nextIndex].priceBreaks!, (price) => {
              if (price.minQty == priceBreak.minQty && price.active == true) {
                return true;
              }
            }) as any
          ).unitPrice + GetShippingPriceForPriceBreak(sortedPayload[nextIndex], priceBreak);
        if (nextLowestPrice > floorPrice && nextLowestPrice >= existingPrice) {
          const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(nextLowestPrice), processOffset, floorPrice, parseFloat(productItem.percentageDown), priceBreak.minQty);
          const contextPrice = contextPriceResult.Price;
          if (nextLowestPrice > contextPrice && contextPrice <= maxPrice) {
            if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
              if (contextPrice - standardShippingPrice >= floorPrice) {
                repriceModel.repriceDetails!.newPrice = await getSetPrice(contextPrice, standardShippingPrice, productItem.freeShippingThreshold, priceBreak.minQty); //(nextLowestPrice - processOffset - standardShippingPrice).toFixed(2);
                repriceModel.repriceDetails!.isRepriced = true;
                repriceModel.repriceDetails!.explained = await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_SECOND, contextPriceResult.Type);
              }
            }
            //repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, nextLowestPrice - processOffset, true);
          } else if (existingPrice === 0 && contextPrice - standardShippingPrice >= floorPrice) {
            //Create new Reprice Point
            repriceModel.repriceDetails!.newPrice = await getSetPrice(contextPrice, standardShippingPrice, productItem.freeShippingThreshold, priceBreak.minQty); //(nextLowestPrice - processOffset - standardShippingPrice).toFixed(2);
            repriceModel.repriceDetails!.isRepriced = true;
            repriceModel.repriceDetails!.explained = await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.IGNORE_OWN, contextPriceResult.Type);
          }
        }
        //1. If Next Lowest price is Greater Than Floor Price
        //2. Floor Price is Not Equal to Existing Price
        //SET: Floor Price
        else if (nextLowestPrice > floorPrice && floorPrice !== existingPrice) {
          // repriceModel.repriceDetails.newPrice = floorPrice.toFixed(2);
          // repriceModel.repriceDetails.isRepriced = true;
          // repriceModel.repriceDetails.explained = _enum.PRICE_UP_SECOND_FLOOR;
        }
        //1. If Next Lowest price is Greater Than Max Price
        //2. Max Price is Not Equal to Existing Price
        //SET: Max Price
        else if (nextLowestPrice > productItem.maxPrice && productItem.maxPrice != existingPrice) {
          repriceModel.repriceDetails!.newPrice = productItem.maxPrice.toFixed(2);
          repriceModel.repriceDetails!.isRepriced = true;
          repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX;
        }
        repriceModel.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, priceBreak.minQty);
      } else {
        repriceModel.repriceDetails!.newPrice = productItem.maxPrice ? productItem.maxPrice : "N/A";
        repriceModel.repriceDetails!.isRepriced = true;
        repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX;
      }
    }
    // For Other Vendors
    else {
      // Check if the lowest price is of the same parent company
      if (_.includes(excludedVendors, _.first(sortedPayload)!.vendorId.toString())) {
        repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.NO_COMPETITOR_SISTER_VENDOR;
        repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
        const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(lowestPrice as any), processOffset, floorPrice, parseFloat(productItem.percentageDown), priceBreak.minQty);
        const goToPriceCalc = await getSetPrice(contextPriceResult.Price, refProduct.standardShippingPrice, refProduct.freeShippingThreshold, priceBreak.minQty);
        repriceModel.repriceDetails!.goToPrice = goToPriceCalc;
        repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, priceBreak.minQty);
        return repriceModel;
      }

      // Check the Lowest Price
      const prodPriceWithMinQty = _.first(sortedPayload)!.priceBreaks.find((x: any) => x.minQty == priceBreak.minQty && x.active == true);
      repriceModel.updateTriggeredBy(_.first(sortedPayload)!.vendorName, _.first(sortedPayload)!.vendorId, priceBreak.minQty);
      if (prodPriceWithMinQty) {
        const lowestPrice = prodPriceWithMinQty.unitPrice + GetShippingPriceForPriceBreak(_.first(sortedPayload)!, priceBreak);
        const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(lowestPrice as any), processOffset, floorPrice, parseFloat(productItem.percentageDown), priceBreak.minQty);
        let offsetPrice = contextPriceResult.Price;
        //1. If the Offset Price is less than Floor Price
        //SET: Do Nothing
        if (offsetPrice <= floorPrice) {
          if (priceBreak.minQty != 1 && existingPrice != 0) {
            repriceModel.repriceDetails!.newPrice = unitPrice;
            repriceModel.repriceDetails!.isRepriced = true;
            repriceModel.repriceDetails!.active = 0 as unknown as boolean;
            repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED;
          } else if (sortedPayload[1] && sortedPayload[1].vendorId == $.VENDOR_ID) {
            let nextIndex = 2;
            for (let i = nextIndex; i <= sortedPayload.length; i++) {
              if (sortedPayload[i] && (_.includes(excludedVendors, sortedPayload[i].vendorId.toString()) || sortedPayload[i].vendorId == $.VENDOR_ID)) {
                nextIndex++;
              } else if ((await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, priceBreak.minQty, floorPrice, GetShippingPrice(sortedPayload[i]), true)) == true) {
                nextIndex++;
              } else {
                break;
              }
            }
            const nextLowestPrice =
              (
                _.find(sortedPayload[nextIndex].priceBreaks, (price) => {
                  if (price.minQty == priceBreak.minQty && price.active == true) {
                    return true;
                  }
                }) as any
              ).unitPrice + GetShippingPriceForPriceBreak(sortedPayload[nextIndex], priceBreak);
            if (nextLowestPrice > floorPrice && (nextLowestPrice >= existingPrice || allowCompeteWithNextForFloor === true)) {
              //&& nextLowestPrice >= existingPrice
              const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(nextLowestPrice), processOffset, floorPrice, parseFloat(productItem.percentageDown), priceBreak.minQty);
              const contextPrice = contextPriceResult.Price;
              if (nextLowestPrice > contextPrice && contextPrice <= maxPrice) {
                if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
                  repriceModel.repriceDetails!.newPrice = await getSetPrice(contextPrice, refProduct.standardShipping, refProduct.freeShippingThreshold, priceBreak.minQty);
                  repriceModel.repriceDetails!.isRepriced = true;
                  repriceModel.repriceDetails!.explained = await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT, contextPriceResult.Type);
                } else {
                  repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED;
                }
              } else {
                repriceModel.repriceDetails!.isRepriced = true;
                repriceModel.repriceDetails!.explained = await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED, contextPriceResult.Type);
                repriceModel.repriceDetails!.goToPrice = contextPrice - standardShippingPrice;
              }
              repriceModel.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, priceBreak.minQty);
            }
          } else if (sortedPayload[1]) {
            let nextIndex = 1;
            for (let i = nextIndex; i <= sortedPayload.length; i++) {
              if (sortedPayload[i] && (_.includes(excludedVendors, sortedPayload[i].vendorId.toString()) || sortedPayload[i].vendorId == $.VENDOR_ID)) {
                nextIndex++;
              } else if ((await filterMapper.IsVendorFloorPrice(sortedPayload[i].priceBreaks, priceBreak.minQty, floorPrice, GetShippingPrice(sortedPayload[i]), true)) == true) {
                nextIndex++;
              } else {
                break;
              }
            }
            const secondLowestPrice = sortedPayload[nextIndex].priceBreaks.find((x: any) => x.minQty == priceBreak.minQty && x.active == true);
            if (secondLowestPrice) {
              const nextLowestPriceForNRank =
                (
                  _.find(sortedPayload[nextIndex].priceBreaks, (price) => {
                    if (price.minQty == priceBreak.minQty && price.active == true) {
                      return true;
                    }
                  }) as any
                ).unitPrice + GetShippingPriceForPriceBreak(sortedPayload[nextIndex], priceBreak);
              if (nextLowestPriceForNRank > floorPrice && (nextLowestPriceForNRank >= existingPrice || allowCompeteWithNextForFloor == true)) {
                const contextPriceResult = await filterMapper.GetContextPrice(parseFloat(nextLowestPriceForNRank), processOffset, floorPrice, parseFloat(productItem.percentageDown), priceBreak.minQty);

                const contextPrice = contextPriceResult.Price;
                repriceModel.repriceDetails!.newPrice = await getSetPrice(contextPrice, refProduct.standardShipping, refProduct.freeShippingThreshold, priceBreak.minQty);
                repriceModel.repriceDetails!.isRepriced = true;
                repriceModel.repriceDetails!.explained = await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.PRICE_UP_NEXT, contextPriceResult.Type);
              } else {
                repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED;
              }
              repriceModel.updateTriggeredBy(sortedPayload[nextIndex].vendorName, sortedPayload[nextIndex].vendorId, priceBreak.minQty);
            }
          } else {
            repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED;
          }
        }
        //1. If the Offset Price is greater than Floor Price
        //2. If the Offset Price is less than Max Price
        //SET: Offset Price
        if (repriceModel.repriceDetails!.isRepriced !== true && offsetPrice > floorPrice && offsetPrice - standardShippingPrice >= floorPrice) {
          repriceModel.repriceDetails!.newPrice = await getSetPrice(offsetPrice, refProduct.standardShipping, refProduct.freeShippingThreshold, priceBreak.minQty);
          repriceModel.repriceDetails!.isRepriced = true;
          repriceModel.repriceDetails!.explained = await filterMapper.AppendPriceFactorTag(RepriceRenewedMessageEnum.REPRICE_DEFAULT, contextPriceResult.Type);
        } else if (parseFloat(existingPrice) > maxPrice && repriceModel.repriceDetails!.isRepriced !== true) {
          const maxPriceToBeSet = await getSetPrice(maxPrice, refProduct.standardShipping, refProduct.freeShippingThreshold, priceBreak.minQty);
          repriceModel.repriceDetails!.newPrice = maxPriceToBeSet;
          repriceModel.repriceDetails!.isRepriced = true;
          repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.PRICE_MAXED;
        } else if (repriceModel.repriceDetails!.isRepriced !== true && offsetPrice > floorPrice && offsetPrice - standardShippingPrice < floorPrice) {
          repriceModel.repriceDetails!.explained = RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED;
        }
      }
    }
    if (isDummyPriceBreak === true) {
      repriceModel.updateLowest(sortedPayload[1].vendorName, sortedPayload[1].priceBreaks.find((x) => x.minQty == priceBreak.minQty)!.unitPrice);
    } else {
      repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
    }

    if (isTieScenario === true) {
      repriceModel.repriceDetails!.explained = repriceModel.repriceDetails!.explained + " #TIE";
    }

    // For Applying Badge Percentage Scenario
    if (_.isEqual(productItem.badgeIndicator, "ALL_PERCENTAGE") && productItem.badgePercentage > 0) {
      repriceModel = await badgeHelper.ReCalculatePriceForNc(repriceModel, productItem, eligibleList, priceBreak.minQty);
    }
  } catch (exception) {
    console.log(`Error in Reprice for mpid : ${productItem.mpid} || Error : ${exception}`);
  }
  return repriceModel;
}

//<!-- PRIVATE FUNCTIONS -->
function isNotShortExpiryProduct(priceBreaks: Net32PriceBreak, listOfPriceBreaks: Net32PriceBreak[], _minQty: number) {
  const contextPriceBreaks = listOfPriceBreaks.filter((x) => x.minQty == _minQty && x.active == true);
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

function GetShippingPrice(item: Net32Product) {
  if (item != null && item.priceBreaks && item.priceBreaks.length > 0) {
    const thresholdPrice = item.freeShippingThreshold != null && item.freeShippingThreshold >= 0 ? item.freeShippingThreshold : 999999;
    const unitBreak = item.priceBreaks.find((x) => x.minQty == 1) as Net32PriceBreak;
    const shippingCharge = item.standardShipping;
    return unitBreak?.unitPrice < thresholdPrice ? parseFloat(shippingCharge as unknown as string) : 0;
  }
  return 0;
}

function GetShippingPriceForPriceBreak(item: Net32Product, priceBreak: Net32PriceBreak) {
  if (item != null && item.priceBreaks && item.priceBreaks.length > 0 && priceBreak.minQty == 1) {
    const contextPriceBreak = item.priceBreaks.find((x) => x.minQty == priceBreak.minQty);
    if (contextPriceBreak) {
      const thresholdPrice = item.freeShippingThreshold != null && item.freeShippingThreshold >= 0 ? item.freeShippingThreshold : 999999;
      const shippingCharge = item.standardShipping;
      const unitPrice = contextPriceBreak.unitPrice;
      return unitPrice < thresholdPrice ? parseFloat(shippingCharge as unknown as string) : 0;
    }
  }
  return 0;
}

async function getLowestPrice(eligibleList: Net32Product[], qty: number) {
  const sortedPayload = _.sortBy(eligibleList, [
    (prod) => {
      return prod.priceBreaks!.find((x) => x.minQty == qty && x.active == true)!.unitPrice;
    },
  ]);
  if (sortedPayload && sortedPayload.length > 0) {
    return _.first(sortedPayload)!.priceBreaks!.find((x) => x.minQty == qty)!.unitPrice;
  }
  return 0;
}

async function getSetPrice(actualPrice: number, shippingPrice: number, shippingThreshold: number, minQty: number) {
  if (actualPrice >= shippingThreshold || minQty !== 1) return actualPrice.toFixed(2);
  else return (actualPrice - shippingPrice).toFixed(2);
}

async function IsTie(sortedPayload: Net32Product[], _minQty: number) {
  if (applicationConfig.IGNORE_TIE) {
    return false;
  }
  const firstItem = _.first(sortedPayload);
  const secondItem = _.nth(sortedPayload, 1);
  if (firstItem && secondItem) {
    const firstItemPrice = firstItem.priceBreaks.find((x) => x.minQty == _minQty && x.active == true);
    const secondItemPrice = secondItem.priceBreaks.find((x) => x.minQty == _minQty && x.active == true);
    return firstItemPrice?.unitPrice === secondItemPrice?.unitPrice;
  }
  return false;
}

async function getEligibleListBasedOnBadgeIndicator(eligibleList: Net32Product[], productItem: FrontierProduct) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  if (_.isEqual(productItem.badgeIndicator, "BADGE_ONLY")) {
    let badgedItems = eligibleList.filter((item) => item.badgeId && item.badgeId > 0 && item.badgeName);
    if (
      !_.find(badgedItems, ($bi) => {
        return $bi.vendorId == $.VENDOR_ID;
      })
    ) {
      let itemToAdd = _.find(eligibleList, ($bi) => {
        return $bi.vendorId == $.VENDOR_ID;
      });
      if (itemToAdd) {
        badgedItems.push(itemToAdd);
      }
    }
    return badgedItems;
  } else if (_.isEqual(productItem.badgeIndicator, "NON_BADGE_ONLY")) {
    let nonBadgedItems = _.filter(eligibleList, (item) => {
      return !item.badgeId || item.badgeId == 0;
    });
    if (
      !_.find(nonBadgedItems, ($bi) => {
        return $bi.vendorId == $.VENDOR_ID;
      })
    ) {
      let itemToAdd = _.find(eligibleList, ($bi) => {
        return $bi.vendorId == $.VENDOR_ID;
      });
      if (itemToAdd) {
        nonBadgedItems.push(itemToAdd);
      }
    }
    return nonBadgedItems;
  }
  return eligibleList;
}

async function IsTieWithSister(sortedPayload: Net32Product[], _minQty: number, productItem: FrontierProduct) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  const firstItem = _.first(sortedPayload);
  const secondItem = _.nth(sortedPayload, 1);
  let tempAllowedVendor = $.EXCLUDED_VENDOR_ID.split(";");
  tempAllowedVendor.push($.VENDOR_ID);
  const isFirstItemValid = _.includes(tempAllowedVendor, firstItem!.vendorId.toString());
  const isSecondItemValid = _.includes(tempAllowedVendor, secondItem!.vendorId.toString());
  if (firstItem && secondItem && isFirstItemValid === true && isSecondItemValid === true) {
    const firstItemPrice = firstItem.priceBreaks.find((x) => x.minQty == _minQty && x.active == true)!.unitPrice;
    const secondItemPrice = secondItem.priceBreaks.find((x) => x.minQty == _minQty && x.active == true)!.unitPrice;
    return firstItemPrice === secondItemPrice;
  }
  return false;
  return false;
}

async function filterEligibleList(eligibleList: Net32Product[], _minQty: number) {
  let cloneList = _.cloneDeep(eligibleList);
  for (let vendorDet of cloneList) {
    _.sortBy(vendorDet.priceBreaks, ["minQty", "unitPrice"], ["desc"]);
    const groupedPriceInfo = _.groupBy(vendorDet.priceBreaks, (x) => x.minQty);
    if (groupedPriceInfo && groupedPriceInfo[_minQty] && groupedPriceInfo[_minQty].length > 1) {
      for (let idx = 0; idx < groupedPriceInfo[_minQty].length - 1; idx++) {
        var contextIndex = _.findIndex(vendorDet.priceBreaks, ["unitPrice", groupedPriceInfo[_minQty][idx].unitPrice]);
        if (contextIndex > -1) {
          _.pullAt(vendorDet.priceBreaks, contextIndex);
        }
      }
    }
  }
  return cloneList;
}

async function getComparablePrice(q1Price: number, q2Price: number) {
  let comparableResponse: { Price: number; Type: string } = {
    Price: q1Price,
    Type: "Q1",
  };
  if (q1Price != 0) {
    if (q2Price != 0 && q2Price < q1Price) {
      comparableResponse.Price = q2Price;
      comparableResponse.Type = "Q2";
      //return q2Price;
    }
    //else return q1Price;
  }
  //return q1Price;
  return comparableResponse;
}
