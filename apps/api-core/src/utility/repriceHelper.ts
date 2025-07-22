import _ from "lodash";
import { RepriceModel } from "../model/repriceModel";
import { RepriceRenewedMessageEnum } from "../model/repriceRenewedMessage";
import * as globalParam from "../model/globalParam";
import * as badgeHelper from "../utility/badgeHelper";
import * as filterMapper from "../utility/filterMapper";
import { Net32PriceBreak, Net32Product } from "../types/net32";
import { FrontierProduct } from "../types/frontier";

//<!-- MODULE FUNCTIONS -->
export async function Reprice(
  refProduct: Net32Product,
  payload: Net32Product[],
  productItem: FrontierProduct,
  sourceId: string,
) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  let repriceModel = new RepriceModel(
    sourceId,
    refProduct,
    productItem.productName,
    0 as unknown as string,
    false,
    false,
    [],
    RepriceRenewedMessageEnum.DEFAULT,
  );
  const existingPrice = refProduct.priceBreaks.find(
    (x) => x.minQty == 1,
  )!.unitPrice;
  repriceModel.repriceDetails!.oldPrice = existingPrice;
  const maxPrice = productItem.maxPrice ? productItem.maxPrice : 99999;
  const floorPrice = productItem.floorPrice
    ? parseFloat(productItem.floorPrice)
    : 0;
  let lowestPrice = 0;
  const processOffset = parseFloat(process.env.OFFSET!);
  let excludedVendors =
    productItem.competeAll == true ? [] : $.EXCLUDED_VENDOR_ID.split(";");
  const allowCompeteWithNextForFloor = productItem.competeWithNext;

  let eligibleList: Net32Product[] = [];
  // Get eligible List of Products where minQty is 1
  payload.forEach((element) => {
    if (element.priceBreaks) {
      element.priceBreaks.forEach((p) => {
        if (
          p.minQty == 1 &&
          p.active == true &&
          isNotShortExpiryProduct(p, element.priceBreaks, 1) &&
          !eligibleList.find((x) => x.vendorId == element.vendorId)
        ) {
          eligibleList.push(element);
        }
      });
    }
  });
  //Update Eligible List based on Excluded Vendor List defined by User
  eligibleList = await filterMapper.FilterBasedOnParams(
    eligibleList,
    productItem,
    "EXCLUDED_VENDOR",
  );

  //Update Eligible List based on Inventory Threshold defined by User
  eligibleList = await filterMapper.FilterBasedOnParams(
    eligibleList,
    productItem,
    "INVENTORY_THRESHOLD",
  );

  //Update Eligible List based on HandlingTimeFilter
  eligibleList = await filterMapper.FilterBasedOnParams(
    eligibleList,
    productItem,
    "HANDLING_TIME",
  );
  //eligibleList = await getEligibleListBasedOnHandlingTimeFilter(eligibleList, productItem);

  // Update Eligible List based on badgeIndicator
  eligibleList = await filterMapper.FilterBasedOnParams(
    eligibleList,
    productItem,
    "BADGE_INDICATOR",
  );
  //eligibleList = await getEligibleListBasedOnBadgeIndicator(eligibleList, productItem);

  //Clean Eligible List based on Duplicate PricePoint
  let tempEligibleList = await filterEligibleList(eligibleList, 1);

  //Sort the eligible list of Products based on minQty=1 Price
  let sortedPayload = _.sortBy(tempEligibleList, [
    (prod) => {
      return prod.priceBreaks.find((x) => x.minQty == 1 && x.active == true)!
        .unitPrice;
    },
  ]);
  if (!sortedPayload || (sortedPayload && sortedPayload.length < 1)) {
    return repriceModel;
  }
  //Check if first 2 are tie
  const isTieScenario = await IsTie(sortedPayload, 1);
  if (isTieScenario === true) {
    const tieWithSister = await IsTieWithSister(sortedPayload, 1, productItem);
    if (tieWithSister !== true) {
      excludedVendors = [];
    }
  }

  //Remove Sister Vendor if Both UP & DOWN selected or Compete with Next is true
  if (
    allowCompeteWithNextForFloor === true ||
    productItem.repricingRule === 2
  ) {
    sortedPayload = await filterMapper.FilterBasedOnParams(
      sortedPayload,
      productItem,
      "SISTER_VENDOR_EXCLUSION",
    );
  }

  //Set the Lowest Price
  _.first(sortedPayload)!.priceBreaks.forEach((price) => {
    if (price.minQty == 1 && price.active == true) {
      lowestPrice = price.unitPrice;
    }
  });

  //If the Lowest Price is of Self-Vendor
  if (_.first(sortedPayload)!.vendorId == parseInt($.VENDOR_ID)) {
    // If no Competitor found
    if (sortedPayload.length == 1) {
      const newPrice =
        productItem.maxPrice && lowestPrice != parseFloat(productItem.maxPrice)
          ? productItem.maxPrice
          : "N/A";
      const model = new RepriceModel(
        sourceId,
        refProduct,
        productItem.productName,
        newPrice,
        newPrice != "N/A",
        false,
        [],
        RepriceRenewedMessageEnum.NO_COMPETITOR,
      );
      model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
      model.updateTriggeredBy(
        _.first(sortedPayload)!.vendorName,
        _.first(sortedPayload)!.vendorId as unknown as string,
      );
      return model;
    }

    // if next in list is in Excluded Vendor, go to next
    let nextIndex = 1;
    if (
      sortedPayload[nextIndex] &&
      _.includes(excludedVendors, sortedPayload[nextIndex].vendorId.toString())
    ) {
      nextIndex++;
    }
    for (let i = nextIndex; i < sortedPayload.length; i++) {
      if (
        sortedPayload[i] &&
        _.includes(excludedVendors, sortedPayload[i].vendorId.toString())
      ) {
        nextIndex++;
      } else if (
        (await filterMapper.IsVendorFloorPrice(
          sortedPayload[i].priceBreaks,
          1,
          floorPrice,
        )) === true
      ) {
        nextIndex++;
      } else {
        break;
      }
    }
    if (sortedPayload[nextIndex]) {
      // Check the next Lowest Price
      const nextLowestPrice = sortedPayload[nextIndex].priceBreaks.find(
        (x) => x.minQty == 1 && x.active == true,
      )!.unitPrice;
      if (nextLowestPrice > floorPrice && nextLowestPrice >= existingPrice) {
        const contextPriceResult = filterMapper.GetContextPrice(
          parseFloat(nextLowestPrice as unknown as string),
          processOffset,
          floorPrice,
          parseFloat(productItem.percentageDown),
          1,
        );
        const contextPrice = contextPriceResult.Price;
        if (nextLowestPrice > contextPrice) {
          if (
            (contextPrice as unknown as number) <=
            (maxPrice as unknown as number)
          ) {
            if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
              repriceModel = new RepriceModel(
                sourceId,
                refProduct,
                productItem.productName,
                contextPrice as unknown as string,
                true,
                false,
                [],
                filterMapper.AppendPriceFactorTag(
                  RepriceRenewedMessageEnum.PRICE_UP_NEXT,
                  contextPriceResult.Type,
                ),
              );
            }
          } else {
            repriceModel = new RepriceModel(
              sourceId,
              refProduct,
              productItem.productName,
              productItem.maxPrice,
              true,
              false,
              [],
              RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL,
            );
          }
        } else {
          repriceModel = new RepriceModel(
            sourceId,
            refProduct,
            productItem.productName,
            existingPrice,
            false,
            false,
            [],
            RepriceRenewedMessageEnum.IGNORE_OWN,
          );
          repriceModel.repriceDetails!.goToPrice =
            contextPrice as unknown as string;
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
      else if (
        nextLowestPrice > (productItem.maxPrice as unknown as number) &&
        productItem.maxPrice != (existingPrice as unknown as string)
      ) {
        repriceModel = new RepriceModel(
          sourceId,
          refProduct,
          productItem.productName,
          productItem.maxPrice,
          true,
          false,
          [],
          RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX,
        );
      }

      repriceModel.updateTriggeredBy(
        sortedPayload[nextIndex].vendorName,
        sortedPayload[nextIndex].vendorId as unknown as string,
      );
    }
    if (!sortedPayload[nextIndex]) {
      repriceModel = new RepriceModel(
        sourceId,
        refProduct,
        productItem.productName,
        productItem.maxPrice,
        true,
        false,
        [],
        RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL,
      );
      repriceModel.updateTriggeredBy(
        _.first(sortedPayload)!.vendorName,
        _.first(sortedPayload)!.vendorId as unknown as string,
      );
    }
    repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
  }
  // For Other Vendors
  else {
    //Check if the lowest price is of the same parent company
    if (
      _.includes(excludedVendors, _.first(sortedPayload)!.vendorId.toString())
    ) {
      let model = new RepriceModel(
        sourceId,
        refProduct,
        productItem.productName,
        existingPrice,
        false,
        false,
        [],
        RepriceRenewedMessageEnum.NO_COMPETITOR_SISTER_VENDOR,
      );
      model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
      const contextPriceResult = filterMapper.GetContextPrice(
        parseFloat(lowestPrice as any),
        processOffset,
        floorPrice,
        parseFloat(productItem.percentageDown),
        1,
      );
      const contextPrice = contextPriceResult.Price;
      model.repriceDetails!.goToPrice = contextPrice.toFixed(2);
      model.updateTriggeredBy(
        _.first(sortedPayload)!.vendorName,
        _.first(sortedPayload)!.vendorId as unknown as string,
      );
      return model;
    }

    // Check the Lowest Price
    const prodPriceWithMinQty = _.first(sortedPayload)!.priceBreaks.find(
      (x: any) => x.minQty == 1 && x.active == true,
    );
    if (prodPriceWithMinQty) {
      const lowestPrice = prodPriceWithMinQty.unitPrice;
      const contextPriceResult = filterMapper.GetContextPrice(
        parseFloat(lowestPrice as unknown as string),
        processOffset,
        floorPrice,
        parseFloat(productItem.percentageDown),
        1,
      );
      const offsetPrice = contextPriceResult.Price;
      //1. If the Offset Price is less than Floor Price
      //SET: Do Nothing
      if (offsetPrice <= floorPrice) {
        //If Lowest is below Floor and competing with others and Sister is already Lowest
        const floorSisterResult = await filterMapper.VerifyFloorWithSister(
          productItem,
          refProduct,
          sortedPayload,
          excludedVendors,
          $.VENDOR_ID,
          1,
          sourceId,
        );
        //if (floorSisterResult != false) return floorSisterResult;

        //If Own vendor is 2nd Lowest
        if (
          sortedPayload[1] &&
          (sortedPayload[1].vendorId == $.VENDOR_ID ||
            _.includes(excludedVendors, sortedPayload[1].vendorId.toString()))
        ) {
          let nextIndex = 2;
          for (let i = nextIndex; i < sortedPayload.length; i++) {
            if (
              sortedPayload[i] &&
              (_.includes(
                excludedVendors,
                sortedPayload[i].vendorId.toString(),
              ) ||
                sortedPayload[i].vendorId == $.VENDOR_ID)
            ) {
              nextIndex++;
            } else if (
              (await filterMapper.IsVendorFloorPrice(
                sortedPayload[i].priceBreaks,
                1,
                floorPrice,
              )) === true
            ) {
              nextIndex++;
            } else {
              break;
            }
          }
          if (!sortedPayload[nextIndex]) {
            const model = new RepriceModel(
              sourceId,
              refProduct,
              productItem.productName,
              productItem.maxPrice,
              true,
              false,
              [],
              RepriceRenewedMessageEnum.PRICE_MAXED,
            );
            model.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
            model.updateTriggeredBy(
              _.first(sortedPayload)!.vendorName,
              _.first(sortedPayload)!.vendorId as unknown as string,
            );
            return model;
          }
          const nextLowestPrice = sortedPayload[nextIndex].priceBreaks.find(
            (x) => x.minQty == 1 && x.active == true,
          )!.unitPrice;
          if (
            nextLowestPrice > floorPrice &&
            (nextLowestPrice >= existingPrice ||
              allowCompeteWithNextForFloor === true)
          ) {
            //&& nextLowestPrice >= existingPrice
            const contextPriceResult = filterMapper.GetContextPrice(
              parseFloat(nextLowestPrice as unknown as string),
              processOffset,
              floorPrice,
              parseFloat(productItem.percentageDown),
              1,
            );
            const contextPrice = contextPriceResult.Price;
            if (contextPrice < existingPrice && floorSisterResult !== false) {
              //Check for Sister Being lowest only while going Down
              return floorSisterResult;
            }
            if (
              nextLowestPrice > contextPrice &&
              contextPrice <= (maxPrice as unknown as number)
            ) {
              if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
                const model = new RepriceModel(
                  sourceId,
                  refProduct,
                  productItem.productName,
                  contextPrice as unknown as string,
                  true,
                  false,
                  [],
                  filterMapper.AppendPriceFactorTag(
                    RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT,
                    contextPriceResult.Type,
                  ),
                );
                model.updateLowest(
                  _.first(sortedPayload)!.vendorName,
                  lowestPrice,
                );
                model.updateTriggeredBy(
                  sortedPayload[nextIndex].vendorName,
                  sortedPayload[nextIndex].vendorId as unknown as string,
                );
                return model;
              }
            } else {
              const model = new RepriceModel(
                sourceId,
                refProduct,
                productItem.productName,
                parseFloat(productItem.maxPrice) as unknown as string,
                true,
                false,
                [],
                RepriceRenewedMessageEnum.PRICE_MAXED,
              );
              model.updateLowest(
                _.first(sortedPayload)!.vendorName,
                lowestPrice,
              );
              model.updateTriggeredBy(
                sortedPayload[nextIndex].vendorName,
                sortedPayload[nextIndex].vendorId as unknown as string,
              );
              return model;
            }
            // else {
            //     repriceModel = new RepriceModel(sourceId, refProduct, productItem.productName, existingPrice, false, false, [], _enum_new.IGNORE_OWN);
            //     repriceModel.repriceDetails.goToPrice = nextLowestPrice - processOffset;
            // }
          }
        } else if (sortedPayload[1]) {
          let nextIndex = 1;
          for (let i = nextIndex; i < sortedPayload.length; i++) {
            if (
              sortedPayload[i] &&
              (_.includes(
                excludedVendors,
                sortedPayload[i].vendorId.toString(),
              ) ||
                sortedPayload[i].vendorId == $.VENDOR_ID)
            ) {
              nextIndex++;
            } else if (
              filterMapper.IsVendorFloorPrice(
                sortedPayload[i].priceBreaks,
                1,
                floorPrice,
              ) == true
            ) {
              nextIndex++;
            } else {
              break;
            }
          }
          const secondLowestPrice = sortedPayload[nextIndex].priceBreaks.find(
            (x: any) => x.minQty == 1 && x.active == true,
          );
          if (
            (secondLowestPrice as any) > floorPrice &&
            ((secondLowestPrice as any) >= existingPrice ||
              allowCompeteWithNextForFloor === true)
          ) {
            const contextPriceResult = filterMapper.GetContextPrice(
              parseFloat(secondLowestPrice!.unitPrice as unknown as string),
              processOffset,
              floorPrice,
              parseFloat(productItem.percentageDown),
              1,
            );
            repriceModel = new RepriceModel(
              sourceId,
              refProduct,
              productItem.productName,
              contextPriceResult.Price,
              true,
              false,
              [],
              filterMapper.AppendPriceFactorTag(
                RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT,
                contextPriceResult.Type,
              ),
            );
          }
          repriceModel.updateTriggeredBy(
            sortedPayload[nextIndex].vendorName,
            sortedPayload[nextIndex].vendorId as unknown as string,
          );
        } else {
          repriceModel = new RepriceModel(
            sourceId,
            refProduct,
            productItem.productName,
            existingPrice,
            false,
            false,
            [],
            RepriceRenewedMessageEnum.IGNORE_OWN,
          );
          repriceModel.updateTriggeredBy(
            _.first(sortedPayload)!.vendorName,
            _.first(sortedPayload)!.vendorId as unknown as string,
          );
        }
      }
      //1. If the Offset Price is greater than Floor Price
      //2. If the Offset Price is less than Max Price
      //SET: Offset Price
      if (offsetPrice > floorPrice) {
        repriceModel = new RepriceModel(
          sourceId,
          refProduct,
          productItem.productName,
          offsetPrice,
          true,
          false,
          [],
          filterMapper.AppendPriceFactorTag(
            RepriceRenewedMessageEnum.PRICE_UP_NEXT,
            contextPriceResult.Type,
          ),
        );
        repriceModel.updateTriggeredBy(
          _.first(sortedPayload)!.vendorName,
          _.first(sortedPayload)!.vendorId as unknown as string,
        );
      } else if (repriceModel.repriceDetails!.isRepriced !== true) {
        repriceModel = new RepriceModel(
          sourceId,
          refProduct,
          productItem.productName,
          existingPrice,
          false,
          false,
          [],
          RepriceRenewedMessageEnum.OFFSET_LESS_THAN_FLOOR,
        );
        repriceModel.repriceDetails!.goToPrice =
          offsetPrice as unknown as string;
        repriceModel.updateTriggeredBy(
          _.first(sortedPayload)!.vendorName,
          _.first(sortedPayload)!.vendorId as unknown as string,
        );
      }
    } else {
      repriceModel = new RepriceModel(
        sourceId,
        refProduct,
        productItem.productName,
        existingPrice,
        false,
        false,
        [],
        RepriceRenewedMessageEnum.DEFAULT,
      );
      repriceModel.updateTriggeredBy(
        _.first(sortedPayload)!.vendorName,
        _.first(sortedPayload)!.vendorId as unknown as string,
      );
    }
    repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
  }

  if (isTieScenario === true) {
    repriceModel.repriceDetails!.explained =
      repriceModel.repriceDetails!.explained + "#TIE";
  }

  // For Applying Badge Percentage Scenario
  if (
    _.isEqual(productItem.badgeIndicator, "ALL_PERCENTAGE") &&
    productItem.badgePercentage > 0
  ) {
    repriceModel = await badgeHelper.ReCalculatePrice(
      repriceModel,
      productItem,
      eligibleList,
      1,
    );
  }
  return repriceModel;
}

export async function RepriceIndividualPriceBreak(
  refProduct: Net32Product,
  payload: Net32Product[],
  productItem: FrontierProduct,
  sourceId: string,
  priceBreak: Net32PriceBreak,
) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  const existingPrice = priceBreak.unitPrice;
  const processOffset = parseFloat(process.env.OFFSET!);
  let repriceModel = new RepriceModel(
    sourceId,
    refProduct,
    productItem.productName,
    0,
    false,
    false,
    [],
    RepriceRenewedMessageEnum.IGNORE_OWN,
  );
  repriceModel.repriceDetails!.oldPrice = existingPrice;
  repriceModel.repriceDetails!.minQty = priceBreak.minQty;
  const maxPrice = productItem.maxPrice ? productItem.maxPrice : 99999;
  const floorPrice = productItem.floorPrice
    ? parseFloat(productItem.floorPrice)
    : 0;
  let lowestPrice = 0;
  let excludedVendors =
    productItem.competeAll === true ? [] : $.EXCLUDED_VENDOR_ID.split(";");
  const allowCompeteWithNextForFloor = productItem.competeWithNext;
  let eligibleList: Net32Product[] = [];
  // Get eligible List of Products where minQty is equal to minQty of the parameter
  payload.forEach((element) => {
    if (element.priceBreaks) {
      element.priceBreaks.forEach((p) => {
        if (
          p.minQty == priceBreak.minQty &&
          p.active == true &&
          isNotShortExpiryProduct(p, element.priceBreaks, priceBreak.minQty) &&
          !eligibleList.find((x) => x.vendorId == element.vendorId)
        ) {
          eligibleList.push(element);
        }
      });
    }
  });

  //Update Eligible List based on Inventory Availability for Price Break
  if (productItem.ignorePhantomQBreak === true) {
    productItem.contextMinQty = priceBreak.minQty;
    eligibleList = await filterMapper.FilterBasedOnParams(
      eligibleList,
      productItem,
      "PHANTOM_PRICE_BREAK",
    );
  }

  if (eligibleList.length === 0) {
    repriceModel.repriceDetails!.explained =
      RepriceRenewedMessageEnum.NO_COMPETITOR;
    return repriceModel;
  }

  //Update Eligible List based on Excluded Vendor List defined by User
  eligibleList = await filterMapper.FilterBasedOnParams(
    eligibleList,
    productItem,
    "EXCLUDED_VENDOR",
  );

  //Update Eligible List based on Inventory Threshold defined by User
  eligibleList = await filterMapper.FilterBasedOnParams(
    eligibleList,
    productItem,
    "INVENTORY_THRESHOLD",
  );

  //Update Eligible List based on HandlingTimeFilter
  eligibleList = await filterMapper.FilterBasedOnParams(
    eligibleList,
    productItem,
    "HANDLING_TIME",
  );
  //eligibleList = await getEligibleListBasedOnHandlingTimeFilter(eligibleList, productItem);

  // Update Eligible List based on badgeIndicator
  eligibleList = await filterMapper.FilterBasedOnParams(
    eligibleList,
    productItem,
    "BADGE_INDICATOR",
  );
  //eligibleList = await getEligibleListBasedOnBadgeIndicator(eligibleList, productItem);

  //Clean Eligible List based on Duplicate PricePoint
  let tempEligibleList = await filterEligibleList(
    eligibleList,
    priceBreak.minQty,
  );

  //Sort the eligible list of Products based on minQty=minQty of the parameter Price
  let sortedPayload = _.sortBy(tempEligibleList, [
    (prod) => {
      return prod.priceBreaks.find(
        (x) => x.minQty == priceBreak.minQty && x.active == true,
      )!.unitPrice;
    },
  ]);
  if (!sortedPayload || (sortedPayload && sortedPayload.length < 1)) {
    return repriceModel;
  }
  //Check if first 2 are tie
  const isTieScenario = await IsTie(sortedPayload, priceBreak.minQty);
  if (isTieScenario === true) {
    const tieWithSister = await IsTieWithSister(
      sortedPayload,
      priceBreak.minQty,
      productItem,
    );
    if (tieWithSister !== true) {
      excludedVendors = [];
    }
  }

  //Remove Sister Vendor if Both UP & DOWN selected or Compete with Next is true
  if (
    allowCompeteWithNextForFloor === true ||
    productItem.repricingRule === 2
  ) {
    sortedPayload = await filterMapper.FilterBasedOnParams(
      sortedPayload,
      productItem,
      "SISTER_VENDOR_EXCLUSION",
    );
  }
  //Set the Lowest Price
  _.first(sortedPayload)!.priceBreaks.forEach((price) => {
    if (price.minQty == priceBreak.minQty && price.active == true) {
      lowestPrice = price.unitPrice;
    }
  });

  // If only Own Vendor or Sister Vendor is available, Shut down the Price Break
  if (priceBreak.minQty != 1) {
    const nonSisterVendorDetails = sortedPayload.filter(
      (x) =>
        x.vendorId != $.VENDOR_ID &&
        !_.includes(excludedVendors, x.vendorId.toString()),
    );
    if (nonSisterVendorDetails.length === 0) {
      repriceModel.repriceDetails!.newPrice = 0 as unknown as string;
      repriceModel.repriceDetails!.isRepriced = true;
      repriceModel.repriceDetails!.active = 0 as unknown as boolean;
      repriceModel.repriceDetails!.explained =
        RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED;
      repriceModel.updateLowest(
        _.first(sortedPayload)!.vendorName,
        lowestPrice,
      );
      repriceModel.updateTriggeredBy(
        _.first(sortedPayload)!.vendorName,
        _.first(sortedPayload)!.vendorId as unknown as string,
      );
      return repriceModel;
    }
  }
  //If the Lowest Price is of Self-Vendor
  if (_.first(sortedPayload)!.vendorId == $.VENDOR_ID) {
    // if next in list is in Excluded Vendor, go to next
    let nextIndex = 1;
    if (
      sortedPayload[nextIndex] &&
      _.includes(excludedVendors, sortedPayload[nextIndex].vendorId.toString())
    ) {
      nextIndex++;
    }

    for (let i = nextIndex; i < sortedPayload.length; i++) {
      if (
        sortedPayload[i] &&
        _.includes(excludedVendors, sortedPayload[i].vendorId.toString())
      ) {
        nextIndex++;
      } else if (
        filterMapper.IsVendorFloorPrice(
          sortedPayload[i].priceBreaks,
          priceBreak.minQty,
          floorPrice,
        ) == true
      ) {
        nextIndex++;
      } else {
        break;
      }
    }

    if (sortedPayload[nextIndex]) {
      // Check the next Lowest Price
      const nextLowestPrice = sortedPayload[nextIndex].priceBreaks.find(
        (x) => x.minQty == priceBreak.minQty && x.active == true,
      )!.unitPrice;
      if (
        nextLowestPrice > floorPrice &&
        (nextLowestPrice >= existingPrice ||
          allowCompeteWithNextForFloor === true)
      ) {
        //&& nextLowestPrice >= existingPrice
        const contextPriceResult = filterMapper.GetContextPrice(
          parseFloat(nextLowestPrice as unknown as string),
          processOffset,
          floorPrice,
          parseFloat(productItem.percentageDown),
          priceBreak.minQty,
        );
        const contextPrice = contextPriceResult.Price;
        if (nextLowestPrice > contextPrice) {
          if (
            (contextPrice as unknown as number) <=
            (maxPrice as unknown as number)
          ) {
            if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
              repriceModel.repriceDetails!.newPrice = contextPrice.toFixed(2);
              repriceModel.repriceDetails!.isRepriced = true;
              repriceModel.repriceDetails!.explained =
                filterMapper.AppendPriceFactorTag(
                  RepriceRenewedMessageEnum.PRICE_UP_SECOND,
                  contextPriceResult.Type,
                );
            }
          } else {
            repriceModel.repriceDetails!.newPrice = (
              productItem.maxPrice as unknown as number
            ).toFixed(2);
            repriceModel.repriceDetails!.isRepriced = true;
            repriceModel.repriceDetails!.explained =
              RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL;
          }
        } else if (existingPrice === 0) {
          //Create new Reprice Point
          repriceModel.repriceDetails!.newPrice = contextPrice.toFixed(2);
          repriceModel.repriceDetails!.isRepriced = true;
          repriceModel.repriceDetails!.explained =
            filterMapper.AppendPriceFactorTag(
              RepriceRenewedMessageEnum.IGNORE_OWN,
              contextPriceResult.Type,
            );
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
      else if (
        nextLowestPrice > (productItem.maxPrice as unknown as number) &&
        productItem.maxPrice != (existingPrice as unknown as string)
      ) {
        repriceModel.repriceDetails!.newPrice = (
          productItem.maxPrice as unknown as number
        ).toFixed(2);
        repriceModel.repriceDetails!.isRepriced = true;
        repriceModel.repriceDetails!.explained =
          RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX;
      }
      repriceModel.updateTriggeredBy(
        sortedPayload[nextIndex].vendorName,
        sortedPayload[nextIndex].vendorId as unknown as string,
      );
    } else {
      repriceModel.repriceDetails!.newPrice = productItem.maxPrice
        ? productItem.maxPrice
        : "N/A";
      repriceModel.repriceDetails!.isRepriced = true;
      repriceModel.repriceDetails!.explained =
        RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX;
      repriceModel.updateTriggeredBy(
        _.first(sortedPayload)!.vendorName,
        _.first(sortedPayload)!.vendorId as unknown as string,
      );
    }
    repriceModel.updateLowest(_.first(sortedPayload)!.vendorName, lowestPrice);
  }
  // For Other Vendors
  else {
    // Check if the lowest price is of the same parent company
    if (
      _.includes(excludedVendors, _.first(sortedPayload)!.vendorId.toString())
    ) {
      repriceModel.repriceDetails!.explained =
        RepriceRenewedMessageEnum.NO_COMPETITOR_SISTER_VENDOR;
      repriceModel.updateLowest(
        _.first(sortedPayload)!.vendorName,
        lowestPrice,
      );
      const contextPriceResult = filterMapper.GetContextPrice(
        parseFloat(lowestPrice as any),
        processOffset,
        floorPrice,
        parseFloat(productItem.percentageDown),
        priceBreak.minQty,
      );
      repriceModel.repriceDetails!.goToPrice =
        contextPriceResult.Price.toFixed(2);
      repriceModel.updateTriggeredBy(
        _.first(sortedPayload)!.vendorName,
        _.first(sortedPayload)!.vendorId as unknown as string,
      );
      return repriceModel;
    }

    // Check the Lowest Price
    const prodPriceWithMinQty = _.first(sortedPayload)!.priceBreaks.find(
      (x: any) => x.minQty == priceBreak.minQty && x.active == true,
    );
    if (prodPriceWithMinQty) {
      const lowestPrice = prodPriceWithMinQty.unitPrice;
      const contextPriceResult = filterMapper.GetContextPrice(
        parseFloat(lowestPrice as unknown as string),
        processOffset,
        floorPrice,
        parseFloat(productItem.percentageDown),
        priceBreak.minQty,
      );
      let offsetPrice = contextPriceResult.Price;
      //1. If the Offset Price is less than Floor Price
      //SET: Do Nothing
      if (offsetPrice <= floorPrice) {
        //If Lowest is below Floor and competing with others and Sister is already Lowest
        const floorSisterResult = await filterMapper.VerifyFloorWithSister(
          productItem,
          refProduct,
          sortedPayload,
          excludedVendors,
          $.VENDOR_ID,
          priceBreak.minQty,
          sourceId,
        );
        //if (floorSisterResult != false) return floorSisterResult;
        //do nothing
        let nextIndex = 1;
        for (let i = nextIndex; i < sortedPayload.length; i++) {
          if (
            sortedPayload[i] &&
            (_.includes(
              excludedVendors,
              sortedPayload[i].vendorId.toString(),
            ) ||
              sortedPayload[i].vendorId == $.VENDOR_ID)
          ) {
            nextIndex++;
          } else if (
            filterMapper.IsVendorFloorPrice(
              sortedPayload[i].priceBreaks,
              priceBreak.minQty,
              floorPrice,
            ) == true
          ) {
            nextIndex++;
          } else {
            break;
          }
        }
        if (
          sortedPayload[nextIndex] &&
          (_.includes(
            excludedVendors,
            sortedPayload[nextIndex].vendorId.toString(),
          ) ||
            sortedPayload[nextIndex].vendorId == $.VENDOR_ID)
        ) {
          nextIndex++;
        }
        if (sortedPayload[nextIndex]) {
          const nextLowestPriceBreak = sortedPayload[
            nextIndex
          ].priceBreaks.find(
            (x) => x.minQty == priceBreak.minQty && x.active == true,
          )!;
          if (nextLowestPriceBreak) {
            const nextLowestPrice = nextLowestPriceBreak.unitPrice;
            if (
              nextLowestPrice > floorPrice &&
              (nextLowestPrice >= existingPrice ||
                allowCompeteWithNextForFloor === true)
            ) {
              //&& nextLowestPrice >= existingPrice
              const contextPriceResult = filterMapper.GetContextPrice(
                parseFloat(nextLowestPrice as unknown as string),
                processOffset,
                floorPrice,
                parseFloat(productItem.percentageDown),
                priceBreak.minQty,
              );
              const contextPrice = contextPriceResult.Price;
              if (contextPrice < existingPrice && floorSisterResult !== false) {
                //Check for Sister Being lowest only while going Down
                return floorSisterResult;
              }
              if (
                nextLowestPrice > contextPrice &&
                contextPrice <= (maxPrice as unknown as number)
              ) {
                if (contextPrice.toFixed(2) !== existingPrice.toFixed(2)) {
                  repriceModel.repriceDetails!.newPrice =
                    contextPrice.toFixed(2);
                  repriceModel.repriceDetails!.isRepriced = true;
                  repriceModel.repriceDetails!.explained =
                    filterMapper.AppendPriceFactorTag(
                      RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT,
                      contextPriceResult.Type,
                    );
                  offsetPrice = contextPrice;
                }
              } else if (existingPrice === 0) {
                //Create new Reprice Point
                repriceModel.repriceDetails!.newPrice = contextPrice.toFixed(2);
                repriceModel.repriceDetails!.isRepriced = true;
                repriceModel.repriceDetails!.explained =
                  filterMapper.AppendPriceFactorTag(
                    RepriceRenewedMessageEnum.NEW_PRICE_BREAK,
                    contextPriceResult.Type,
                  );
              }
            }
          }
          repriceModel.updateTriggeredBy(
            sortedPayload[nextIndex].vendorName,
            sortedPayload[nextIndex].vendorId as unknown as string,
          );
        } else {
          if (priceBreak.minQty != 1) {
            repriceModel.repriceDetails!.newPrice = 0 as unknown as string;
            repriceModel.repriceDetails!.isRepriced = true;
            repriceModel.repriceDetails!.active = 0 as unknown as boolean;
            repriceModel.repriceDetails!.explained =
              RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED;
          } else {
            repriceModel.repriceDetails!.newPrice = productItem.maxPrice
              ? productItem.maxPrice
              : "N/A";
            repriceModel.repriceDetails!.isRepriced = true;
            repriceModel.repriceDetails!.explained =
              RepriceRenewedMessageEnum.PRICE_UP_SECOND_MAX;
          }
          repriceModel.updateTriggeredBy(
            _.first(sortedPayload)!.vendorName,
            _.first(sortedPayload)!.vendorId as unknown as string,
          );
        }
      }
      //1. If the Offset Price is greater than Floor Price
      //2. If the Offset Price is less than Max Price
      //SET: Offset Price
      if (
        offsetPrice > floorPrice &&
        repriceModel.repriceDetails!.isRepriced !== true
      ) {
        repriceModel.repriceDetails!.newPrice = offsetPrice.toFixed(2);
        repriceModel.repriceDetails!.isRepriced = true;
        repriceModel.repriceDetails!.explained =
          RepriceRenewedMessageEnum.REPRICE_DEFAULT;
        repriceModel.updateTriggeredBy(
          _.first(sortedPayload)!.vendorName,
          _.first(sortedPayload)!.vendorId as unknown as string,
        );
      } else if (offsetPrice <= floorPrice) {
        repriceModel.repriceDetails!.goToPrice =
          offsetPrice as unknown as string;
        repriceModel.repriceDetails!.newPrice = "N/A";
        repriceModel.repriceDetails!.isRepriced = false;
        repriceModel.repriceDetails!.explained =
          RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED;
        repriceModel.updateTriggeredBy(
          _.first(sortedPayload)!.vendorName,
          _.first(sortedPayload)!.vendorId as unknown as string,
        );
      }

      repriceModel.updateLowest(
        _.first(sortedPayload)!.vendorName,
        lowestPrice,
      );
    }
  }
  if (isTieScenario === true) {
    repriceModel.repriceDetails!.explained =
      repriceModel.repriceDetails!.explained + " #TIE";
  }

  // For Applying Badge Percentage Scenario
  if (
    _.isEqual(productItem.badgeIndicator, "ALL_PERCENTAGE") &&
    productItem.badgePercentage > 0
  ) {
    repriceModel = await badgeHelper.ReCalculatePrice(
      repriceModel,
      productItem,
      eligibleList,
      priceBreak.minQty,
    );
  }
  return repriceModel;
}

export async function GetDistinctPriceBreaksAcrossVendors(
  listOfProducts: Net32Product[],
  ownProduct: Net32Product,
  productItem: FrontierProduct,
) {
  const $ = await globalParam.GetInfo(ownProduct.vendorId, productItem);
  let pricePoints: Net32PriceBreak[] = [];
  if (!ownProduct) return pricePoints;
  listOfProducts.forEach((x) => {
    if (x.vendorId != $.VENDOR_ID) {
      if (x.priceBreaks && x.priceBreaks.length > 0) {
        x.priceBreaks.forEach((p) => {
          const ownPriceBreak = ownProduct.priceBreaks.find(
            ($pb) => $pb.minQty == p.minQty,
          );
          if (
            !ownPriceBreak &&
            !pricePoints.find(($) => $.minQty == p.minQty)
          ) {
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

export async function RepriceToMax(
  refProduct: Net32Product,
  payload: Net32Product[],
  productItem: FrontierProduct,
  sourceId: string,
) {
  const existingPrice = refProduct.priceBreaks.find(
    (x) => x.minQty == 1,
  )!.unitPrice;
  const maxPrice = productItem.maxPrice
    ? parseFloat(productItem.maxPrice)
    : 99999;
  let lowestPrice = 0;
  let repriceModel = new RepriceModel(
    sourceId,
    refProduct,
    productItem.productName,
    maxPrice,
    true,
    false,
    [],
    RepriceRenewedMessageEnum.PRICE_MAXED_MANUAL,
  );
  if (repriceModel.repriceDetails) {
    repriceModel.repriceDetails.oldPrice = existingPrice;
  }
  //Sort the eligible list of Products based on minQty=1 Price
  let sortedPayload = _.sortBy(payload, [
    (prod) => {
      return prod.priceBreaks.find((x) => x.minQty == 1 && x.active == true)!
        .unitPrice;
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
function isNotShortExpiryProduct(
  priceBreaks: Net32PriceBreak,
  listOfPriceBreaks: Net32PriceBreak[],
  _minQty: number,
) {
  const contextPriceBreaks = _.filter(
    listOfPriceBreaks,
    (x) => x.minQty == _minQty && x.active == true,
  );
  if (contextPriceBreaks && contextPriceBreaks.length > 1) {
    let resultantEval = true;
    contextPriceBreaks.forEach((x) => {
      if (
        x.promoAddlDescr &&
        x.promoAddlDescr.toUpperCase().indexOf("EXP") > -1
      ) {
        resultantEval = false;
      }
    });
    return resultantEval;
  }
  return true;
}

async function IsTie(sortedPayload: Net32Product[], _minQty: number) {
  if (JSON.parse(process.env.IGNORE_TIE!) === true) {
    return false;
  }
  const firstItem = _.first(sortedPayload);
  const secondItem = _.nth(sortedPayload, 1);
  if (firstItem && secondItem) {
    const firstItemPrice = firstItem.priceBreaks.find(
      (x) => x.minQty == _minQty && x.active == true,
    )!.unitPrice;
    const secondItemPrice = secondItem.priceBreaks.find(
      (x) => x.minQty == _minQty && x.active == true,
    )!.unitPrice;
    return firstItemPrice === secondItemPrice;
  }
  return false;
}

async function IsTieWithSister(
  sortedPayload: Net32Product[],
  _minQty: number,
  productItem: FrontierProduct,
) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  const firstItem = _.first(sortedPayload);
  const secondItem = _.nth(sortedPayload, 1);
  let tempAllowedVendor = $.EXCLUDED_VENDOR_ID.split(";");
  tempAllowedVendor.push($.VENDOR_ID);
  const isFirstItemValid = _.includes(
    tempAllowedVendor,
    firstItem!.vendorId.toString(),
  );
  const isSecondItemValid = _.includes(
    tempAllowedVendor,
    secondItem!.vendorId.toString(),
  );
  if (
    firstItem &&
    secondItem &&
    isFirstItemValid === true &&
    isSecondItemValid === true
  ) {
    const firstItemPrice = firstItem.priceBreaks.find(
      (x) => x.minQty == _minQty && x.active == true,
    )!.unitPrice;
    const secondItemPrice = secondItem.priceBreaks.find(
      (x) => x.minQty == _minQty && x.active == true,
    )!.unitPrice;
    return firstItemPrice === secondItemPrice;
  }
  return false;
}

async function filterEligibleList(
  eligibleList: Net32Product[],
  _minQty: number,
) {
  let cloneList = _.cloneDeep(eligibleList);
  for (let vendorDet of cloneList) {
    _.sortBy(vendorDet.priceBreaks, ["minQty", "unitPrice"], ["desc"]);
    const groupedPriceInfo = _.groupBy(vendorDet.priceBreaks, (x) => x.minQty);
    if (
      groupedPriceInfo &&
      groupedPriceInfo[_minQty] &&
      groupedPriceInfo[_minQty].length > 1
    ) {
      for (let idx = 0; idx < groupedPriceInfo[_minQty].length - 1; idx++) {
        var contextIndex = _.findIndex(vendorDet.priceBreaks, [
          "unitPrice",
          groupedPriceInfo[_minQty][idx].unitPrice,
        ]);
        if (contextIndex > -1) {
          _.pullAt(vendorDet.priceBreaks, contextIndex);
        }
      }
    }
  }
  return cloneList;
}
