import _ from "lodash";
import moment from "moment";
import * as dbHelper from "./mongo/dbHelper";
import * as sqlHelper from "./mySqlHelper";
import { FilterCronLog } from "../model/filterCronLog";
import { Generate } from "./keyGenHelper";
import { RepriceRenewedMessageEnum } from "../model/repriceRenewedMessage";
import { FilterCronItem } from "../model/filterCronLog";
import { GetInfo } from "../model/globalParam";
import { RepriceModel } from "../model/repriceModel";
import { FrontierProduct } from "../types/frontier";
import { Net32PriceBreak, Net32Product } from "../types/net32";
import { applicationConfig } from "./config";

export async function FilterProducts(filterCronDetails: any) {
  const filterDuration = parseInt(filterCronDetails.filterValue);
  let filterDateValue = moment(Date.now())
    .subtract(filterDuration, "h")
    .format();
  let filterDate = new Date(filterDateValue);
  //const regularCronDetails = await dbHelper.GetCronSettingsList();
  //const regularCronSet = _.map(regularCronDetails, "CronId");
  console.log(
    `Filter Cron : Running ${filterCronDetails.cronName} for Filter Date : ${filterDate} at ${new Date()}`,
  );
  //const filterQuery = await getFilterQuery(filterDate, regularCronSet);
  let listOfEligibleProducts =
    await sqlHelper.GetFilterEligibleProductsList(filterDate); //ait dbHelper.GetProductListByQuery(filterQuery);
  console.log(
    `Received Filter Products for ${filterCronDetails.cronName} | Product Count : ${listOfEligibleProducts.length}`,
  );
  if (listOfEligibleProducts && listOfEligibleProducts.length > 0) {
    let filterCronLog = new FilterCronLog(
      Generate(),
      filterCronDetails.cronId,
      filterDate as any,
      [],
    );
    for (let product of listOfEligibleProducts) {
      const logItem = new FilterCronItem(
        product.MpId,
        product.RegularCronId,
        product.RegularCronName,
        filterCronDetails.linkedCronId,
        filterCronDetails.linkedCronName,
        getLastUpdateTime(product),
      );
      // Set CronId to Slow Cron Group & update the Parent Cron Details
      if (applicationConfig.ENABLE_SLOW_CRON_FEATURE) {
        product.tradentDetails = {};
        product.tradentDetails.slowCronId = filterCronDetails.linkedCronId;
        product.tradentDetails.slowCronName = filterCronDetails.linkedCronName;
        product.isSlowActivated = true;
        product.mpId = product.MpId;
        // Update the same in DB
        await sqlHelper.UpdateCronForProductAsync(product);
      }
      //Create a Log for the same
      filterCronLog.push(logItem);
    }
    filterCronLog.finish();
    await dbHelper.SaveFilterCronLogs(filterCronLog);
  }
}

export async function FilterBasedOnParams(
  inputResult: Net32Product[],
  productItem: FrontierProduct,
  filterType: string,
) {
  let outputResult: Net32Product[] = [];
  const $ = await GetInfo(productItem.mpid, productItem);
  switch (filterType) {
    case "EXCLUDED_VENDOR":
      const excludedVendorList =
        productItem.excludedVendors != null && productItem.excludedVendors != ""
          ? productItem.excludedVendors
              .split(";")
              .filter((element) => element.trim() !== "")
          : [];
      outputResult = _.filter(inputResult, (item) => {
        return !_.includes(excludedVendorList, item.vendorId.toString());
      });
      break;
    case "INVENTORY_THRESHOLD":
      if (parseInt(productItem.inventoryThreshold as unknown as string) == 0) {
        outputResult = inputResult;
      } else {
        outputResult = inputResult.filter((item) => {
          return (
            item.inStock == true &&
            item.inventory &&
            item.inventory >
              parseInt(productItem.inventoryThreshold as unknown as string)
          );
        });
      }
      break;
    case "HANDLING_TIME":
      switch (productItem.handlingTimeFilter) {
        case "FAST_SHIPPING":
          outputResult = inputResult.filter((item) => {
            return item.shippingTime && item.shippingTime <= 2;
          });
          break;
        case "STOCKED":
          outputResult = inputResult.filter((item) => {
            return item.shippingTime && item.shippingTime <= 5;
          });
          break;
        case "LONG_HANDLING":
          outputResult = inputResult.filter((item) => {
            return item.shippingTime && item.shippingTime >= 6;
          });
          break;
        default:
          outputResult = inputResult;
          break;
      }
      if (
        !outputResult.find(($bi) => {
          return $bi.vendorId == $.VENDOR_ID;
        })
      ) {
        const itemToAdd = inputResult.find(($bi) => {
          return $bi.vendorId == $.VENDOR_ID;
        });
        if (itemToAdd) {
          outputResult.push(itemToAdd);
        }
      }
      break;
    case "BADGE_INDICATOR":
      if (_.isEqual(productItem.badgeIndicator, "BADGE_ONLY")) {
        let badgedItems = inputResult.filter((item) => {
          return (
            item.badgeId &&
            item.badgeId > 0 &&
            item.badgeName &&
            item.inStock == true
          );
        });
        if (
          !badgedItems.find(($bi) => {
            return $bi.vendorId == $.VENDOR_ID;
          })
        ) {
          let itemToAdd = inputResult.find(($bi) => {
            return $bi.vendorId == $.VENDOR_ID;
          });
          if (itemToAdd) {
            badgedItems.push(itemToAdd);
          }
        }
        outputResult = badgedItems;
      } else if (_.isEqual(productItem.badgeIndicator, "NON_BADGE_ONLY")) {
        let nonBadgedItems = inputResult.filter((item) => {
          return (!item.badgeId || item.badgeId == 0) && item.inStock == true;
        });
        if (
          !nonBadgedItems.find(($bi) => {
            return $bi.vendorId == $.VENDOR_ID;
          })
        ) {
          let itemToAdd = inputResult.find(($bi) => {
            return $bi.vendorId == $.VENDOR_ID;
          });
          if (itemToAdd) {
            nonBadgedItems.push(itemToAdd);
          }
        }
        outputResult = nonBadgedItems;
      } else outputResult = inputResult;
      break;
    case "PHANTOM_PRICE_BREAK":
      if (parseInt(productItem.contextMinQty as unknown as string) != 1) {
        outputResult = inputResult.filter((item) => {
          return (
            item.inStock == true &&
            item.inventory &&
            item.inventory >=
              parseInt(productItem.contextMinQty as unknown as string)
          );
        });
      } else outputResult = inputResult;
      break;
    case "SISTER_VENDOR_EXCLUSION":
      const excludedSisterList =
        $.EXCLUDED_VENDOR_ID != null && $.EXCLUDED_VENDOR_ID != ""
          ? $.EXCLUDED_VENDOR_ID.split(";").filter(
              (element: any) => element.trim() !== "",
            )
          : [];
      outputResult = inputResult.filter((item) => {
        return !_.includes(excludedSisterList, item.vendorId.toString());
      });
      break;
    default:
      break;
  }
  return outputResult;
}

export function GetContextPrice(
  nextLowestPrice: number,
  processOffset: number,
  floorPrice: number,
  percentageDown: number,
  minQty: number,
): { Price: number; Type: string } {
  let returnObj: { Price: number; Type: string } = {
    Price: nextLowestPrice - processOffset,
    Type: "OFFSET",
  };
  if (percentageDown != 0 && minQty == 1) {
    const percentageDownPrice = subtractPercentage(
      nextLowestPrice,
      percentageDown,
    );
    if (percentageDownPrice > floorPrice) {
      returnObj.Price = percentageDownPrice;
      returnObj.Type = "PERCENTAGE";
    } else if (percentageDownPrice <= floorPrice) {
      returnObj.Type = "FLOOR_OFFSET";
    }
  }
  return returnObj;
}

export function AppendPriceFactorTag(strValue: string, objType: string) {
  if (objType == "PERCENTAGE") return `${strValue} #%Down`;
  else if (objType == "FLOOR_OFFSET") return `${strValue} #Floor-MovedFrom%to$`;
  else return strValue;
}

export function IsVendorFloorPrice(
  priceBreakList: Net32PriceBreak[],
  minQty: number,
  floorPrice: number,
) {
  const contextPriceBreak = priceBreakList.find((x) => x.minQty == minQty);
  if (
    contextPriceBreak &&
    parseFloat(contextPriceBreak.unitPrice as unknown as string) < floorPrice
  )
    return true;
  return false;
}

export async function VerifyFloorWithSister(
  productItem: FrontierProduct,
  refProduct: Net32Product,
  sortedPayload: Net32Product[],
  excludedVendors: string[],
  ownVendorId: number,
  minQty: number,
  sourceId: string,
): Promise<any> {
  let aboveFloorVendors: any[] = [];
  const processOffset = applicationConfig.OFFSET;
  const floorPrice = productItem.floorPrice
    ? parseFloat(productItem.floorPrice)
    : 0;
  const existingPrice = refProduct.priceBreaks.find(
    (x) => x.minQty == minQty,
  )!.unitPrice;
  for (let k = 1; k <= sortedPayload.length; k++) {
    if (sortedPayload[k] && sortedPayload[k].priceBreaks) {
      if (sortedPayload[k].vendorId == ownVendorId) continue;
      const pbPrice = sortedPayload[k].priceBreaks.find(
        (x) => x.minQty == minQty && x.active == true,
      )!.unitPrice;
      const updatePrice = GetContextPrice(
        parseFloat(pbPrice as unknown as string),
        processOffset,
        floorPrice,
        parseFloat(productItem.percentageDown),
        1,
      );
      if (updatePrice.Price > floorPrice) {
        aboveFloorVendors.push(sortedPayload[k]);
      }
    }
  }
  if (
    aboveFloorVendors.length > 0 &&
    _.includes(excludedVendors, _.first(aboveFloorVendors).vendorId.toString())
  ) {
    let model = new RepriceModel(
      sourceId,
      refProduct,
      productItem.productName,
      existingPrice,
      false,
      false,
      [],
      `${RepriceRenewedMessageEnum.NO_COMPETITOR_SISTER_VENDOR} #HitFloor`,
    );
    const effectiveLowest = _.first(aboveFloorVendors).priceBreaks.find(
      (x: any) => x.minQty == 1 && x.active == true,
    ).unitPrice;
    model.updateLowest(_.first(aboveFloorVendors).vendorName, effectiveLowest);
    const contextPriceResult = GetContextPrice(
      parseFloat(effectiveLowest),
      processOffset,
      floorPrice,
      parseFloat(productItem.percentageDown),
      1,
    );
    var contextPrice = contextPriceResult.Price;
    model.repriceDetails!.goToPrice = contextPrice.toFixed(2);
    model.updateTriggeredBy(
      _.first(aboveFloorVendors).vendorName,
      _.first(aboveFloorVendors).vendorId,
    );
    return model;
  } else return false;
}

async function getFilterQuery(filterDate: any, regularCronSet: any) {
  return {
    $and: [
      {
        $or: [
          {
            $and: [
              {
                $or: [
                  { "tradentDetails.last_update_time": { $exists: false } },
                  { "tradentDetails.last_update_time": null },
                  { "tradentDetails.last_update_time": { $lte: filterDate } },
                ],
              },
              { "tradentDetails.cronId": { $in: regularCronSet } },
              { "tradentDetails.activated": true },
            ],
          },
          {
            tradentDetails: null,
          },
        ],
      },
      {
        $or: [
          {
            $and: [
              {
                $or: [
                  { "frontierDetails.last_update_time": { $exists: false } },
                  { "frontierDetails.last_update_time": null },
                  { "frontierDetails.last_update_time": { $lte: filterDate } },
                ],
              },
              { "frontierDetails.cronId": { $in: regularCronSet } },
              { "frontierDetails.activated": true },
            ],
          },
          {
            frontierDetails: null,
          },
        ],
      },
      {
        $or: [
          {
            $and: [
              {
                $or: [
                  { "mvpDetails.last_update_time": { $exists: false } },
                  { "mvpDetails.last_update_time": null },
                  { "mvpDetails.last_update_time": { $lte: filterDate } },
                ],
              },
              { "mvpDetails.cronId": { $in: regularCronSet } },
              { "mvpDetails.activated": true },
            ],
          },
          {
            mvpDetails: null,
          },
        ],
      },
    ],
  };
}
function getEntityValue(product: any, key: any) {
  if (product.tradentDetails) {
    return product.tradentDetails[key];
  }
  if (product.frontierDetails) {
    return product.frontierDetails[key];
  }
  if (product.mvpDetails) {
    return product.mvpDetails[key];
  }
}

function getLastUpdateTime(product: any) {
  let str = "";
  if (product["T_LUT"] != null) {
    str = `${str} | TRADENT : ${moment(product["T_LUT"]).format("DD-MM-YYYY HH:mm:ss")}`;
  } else {
    str = `${str} | TRADENT : BLANK`;
  }

  if (product["F_LUT"] != null) {
    str = `${str} | FRONTIER : ${moment(product["F_LUT"]).format("DD-MM-YYYY HH:mm:ss")}`;
  } else {
    str = `${str} | FRONTIER : BLANK`;
  }
  if (product["M_LUT"] != null) {
    str = `${str} | MVP : ${moment(product["M_LUT"]).format("DD-MM-YYYY HH:mm:ss")}`;
  } else {
    str = `${str} | MVP : BLANK`;
  }
  return str;
}
export function subtractPercentage(originalNumber: number, percentage: number) {
  return parseFloat(
    (
      Math.floor((originalNumber - originalNumber * percentage) * 100) / 100
    ).toFixed(2),
  );
}
