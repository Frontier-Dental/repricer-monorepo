import _ from "lodash";
import moment from "moment";
import * as dbHelper from "./mongo/db-helper";
import * as sqlHelper from "./mysql/mysql-helper";
import { FilterCronItem, FilterCronLog } from "../model/filter-cron-log";
import { Generate } from "./job-id-helper";
import { RepriceRenewedMessageEnum } from "../model/reprice-renewed-message";
import { GetInfo } from "../model/global-param";
import { RepriceModel } from "../model/reprice-model";
import { FrontierProduct } from "../types/frontier";
import { Net32Product } from "../types/net32";
import { applicationConfig } from "./config";
import Decimal from "decimal.js";

export async function FilterProducts(filterCronDetails: any) {
  const filterDuration = parseInt(filterCronDetails.filterValue);
  let filterDateValue = moment(Date.now()).subtract(filterDuration, "h").format();
  let filterDate = new Date(filterDateValue);
  console.log(`Filter Cron : Running ${filterCronDetails.cronName} for Filter Date : ${filterDate} at ${new Date()}`);
  //const filterQuery = await getFilterQuery(filterDate, regularCronSet);
  let listOfEligibleProducts = await sqlHelper.GetFilterEligibleProductsList(filterDate); //ait dbHelper.GetProductListByQuery(filterQuery);
  console.log(`Received Filter Products for ${filterCronDetails.cronName} | Product Count : ${listOfEligibleProducts.length}`);
  if (listOfEligibleProducts && listOfEligibleProducts.length > 0) {
    let filterCronLog = new FilterCronLog(Generate(), filterCronDetails.cronId, filterDate as any, []);
    for (let product of listOfEligibleProducts) {
      const logItem = new FilterCronItem(product.MpId, product.RegularCronId, product.RegularCronName, filterCronDetails.linkedCronId, filterCronDetails.linkedCronName, getLastUpdateTime(product));
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

export function GetLastCronMessageSimple(repriceResult: any): string {
  let resultStr = "";
  if (repriceResult && repriceResult.cronResponse && repriceResult.cronResponse.repriceData) {
    const repriceResultInfo = repriceResult.cronResponse.repriceData;
    if (repriceResultInfo.listOfRepriceDetails && repriceResultInfo.listOfRepriceDetails.length > 0) {
      for (const rep of repriceResultInfo.listOfRepriceDetails) {
        resultStr += `${rep.minQty}@${rep.explained}/`;
      }
    } else if (repriceResultInfo.repriceDetails) {
      resultStr += repriceResultInfo.repriceDetails.explained;
    } else resultStr = `Reprice Result is empty`;
  }
  return resultStr;
}

export async function FilterBasedOnParams(inputResult: Net32Product[], productItem: FrontierProduct, filterType: string) {
  let outputResult: Net32Product[] = [];
  const $ = await GetInfo(productItem.mpid, productItem);
  switch (filterType) {
    case "EXCLUDED_VENDOR":
      const excludedVendorList = productItem.excludedVendors != null && productItem.excludedVendors != "" ? productItem.excludedVendors.split(";").filter((element) => element.trim() !== "") : [];
      outputResult = _.filter(inputResult, (item) => {
        return !_.includes(excludedVendorList, item.vendorId.toString());
      });
      break;
    case "INVENTORY_THRESHOLD":
      if (productItem.includeInactiveVendors) {
        outputResult = _.filter(inputResult, (item) => {
          return parseInt(item.inventory as unknown as string) >= parseInt(productItem.inventoryThreshold as unknown as string);
        });
      } else {
        outputResult = inputResult.filter((item) => {
          return item.inStock && parseInt(item.inventory as unknown as string) >= parseInt(productItem.inventoryThreshold as unknown as string);
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
        let badgedItems = [];
        if (productItem.includeInactiveVendors) {
          badgedItems = _.filter(inputResult, (item) => {
            return item.badgeId && item.badgeId > 0 && item.badgeName;
          });
        } else {
          badgedItems = _.filter(inputResult, (item) => {
            return item.badgeId && item.badgeId > 0 && item.badgeName && item.inStock;
          });
        }
        if (
          !badgedItems.find(($bi) => {
            return ($bi as any).vendorId == $.VENDOR_ID;
          })
        ) {
          let itemToAdd = inputResult.find(($bi) => {
            return $bi.vendorId == $.VENDOR_ID;
          });
          if (itemToAdd) {
            badgedItems.push(itemToAdd);
          }
        }
        outputResult = badgedItems as any;
      } else if (_.isEqual(productItem.badgeIndicator, "NON_BADGE_ONLY")) {
        let nonBadgedItems = [];
        if (productItem.includeInactiveVendors) {
          nonBadgedItems = _.filter(inputResult, (item) => {
            return !item.badgeId || item.badgeId == 0;
          });
        } else {
          nonBadgedItems = _.filter(inputResult, (item) => {
            return (!item.badgeId || item.badgeId == 0) && item.inStock;
          });
        }
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
          return item.inStock && item.inventory && item.inventory >= parseInt(productItem.contextMinQty as unknown as string);
        });
      } else outputResult = inputResult;
      break;
    case "SISTER_VENDOR_EXCLUSION":
      const excludedSisterList = $.EXCLUDED_VENDOR_ID != null && $.EXCLUDED_VENDOR_ID != "" ? $.EXCLUDED_VENDOR_ID.split(";").filter((element: any) => element.trim() !== "") : [];
      outputResult = inputResult.filter((item) => {
        return !_.includes(excludedSisterList, item.vendorId.toString());
      });
      break;
    default:
      break;
  }
  return outputResult;
}

export async function GetContextPrice(nextLowestPrice: any, processOffset: any, floorPrice: any, percentageDown: any, minQty: any, heavyShippingPrice: number = 0): Promise<any> {
  let returnObj: any = {};
  returnObj.Price = new Decimal(nextLowestPrice).minus(processOffset).toNumber();
  returnObj.Type = "OFFSET";
  try {
    if (percentageDown != 0 && minQty == 1) {
      const percentageDownPrice = subtractPercentage(nextLowestPrice + heavyShippingPrice, percentageDown) - heavyShippingPrice;
      if (percentageDownPrice > floorPrice) {
        returnObj.Price = percentageDownPrice;
        returnObj.Type = "PERCENTAGE";
      } else if (percentageDownPrice <= floorPrice) {
        returnObj.Type = "FLOOR_OFFSET";
      }
    }
  } catch (exception) {
    console.log(`Exception while getting ContextPrice : ${exception}`);
  }
  return returnObj;
}

export function AppendPriceFactorTag(strValue: string, objType: string) {
  if (objType == "PERCENTAGE") return `${strValue} #%Down`;
  else if (objType == "FLOOR_OFFSET") return `${strValue} #Floor-MovedFrom%to$`;
  else return strValue;
}

export function IsVendorFloorPrice(priceBreakList: any, minQty: any, floorPrice: any, shippingCharge: any, isNc: any) {
  const contextPriceBreak = priceBreakList.find((x: any) => x.minQty == minQty);
  const shippingPrice = shippingCharge ? parseFloat(shippingCharge) : 0;
  if (contextPriceBreak) {
    const contextPrice = isNc ? parseFloat(contextPriceBreak.unitPrice) + parseFloat(shippingPrice as unknown as string) : parseFloat(contextPriceBreak.unitPrice);
    return contextPrice <= floorPrice;
  }
  return false;
}

export async function VerifyFloorWithSister(productItem: any, refProduct: any, sortedPayload: any, excludedVendors: any, ownVendorId: any, minQty: any, sourceId: any): Promise<any> {
  let aboveFloorVendors: any[] = [];
  const processOffset = applicationConfig.OFFSET;
  const floorPrice = productItem.floorPrice ? parseFloat(productItem.floorPrice) : 0;
  const existingPrice = refProduct.priceBreaks.find((x: any) => x.minQty == minQty).unitPrice;
  for (let k = 1; k <= sortedPayload.length; k++) {
    if (sortedPayload[k] && sortedPayload[k].priceBreaks) {
      if (sortedPayload[k].vendorId == ownVendorId) continue;
      const pbPrice = _.find(sortedPayload[k].priceBreaks, (price) => {
        if (price.minQty == minQty && price.active == true) {
          return true;
        }
      }).unitPrice;
      const updatePrice = await GetContextPrice(parseFloat(pbPrice), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1, sortedPayload[k].heavyShipping ? parseFloat(sortedPayload[k].heavyShipping) : 0);
      if (updatePrice.Price > floorPrice) {
        aboveFloorVendors.push(sortedPayload[k]);
      }
    }
  }
  if (aboveFloorVendors.length > 0 && _.includes(excludedVendors, _.first(aboveFloorVendors).vendorId.toString())) {
    let model = new RepriceModel(sourceId, refProduct, productItem.productName, existingPrice, false, false, [], `${RepriceRenewedMessageEnum.NO_COMPETITOR_SISTER_VENDOR} #HitFloor`);
    const effectiveLowest = _.first(aboveFloorVendors).priceBreaks.find((x: any) => x.minQty == 1 && x.active == true).unitPrice;
    model.updateLowest(_.first(aboveFloorVendors).vendorName, effectiveLowest);
    const contextPriceResult = await GetContextPrice(parseFloat(effectiveLowest), processOffset, floorPrice, parseFloat(productItem.percentageDown), 1, _.first(aboveFloorVendors).heavyShipping ? parseFloat(_.first(aboveFloorVendors).heavyShipping) : 0);
    var contextPrice = contextPriceResult.Price;
    model.repriceDetails!.goToPrice = contextPrice.toFixed(2);
    model.updateTriggeredBy(_.first(aboveFloorVendors).vendorName, _.first(aboveFloorVendors).vendorId, 1);
    return model;
  } else return false;
}

export async function IsWaitingForNextRun(mpId: any, contextVendor: string, prod: any) {
  if (prod.cronName == applicationConfig.CRON_NAME_422) return false; // If the product is Express Cron, no need to check for waiting status
  const dbResult = await dbHelper.FindErrorItemByIdAndStatus(parseInt(mpId), true, contextVendor.toUpperCase());
  return dbResult > 0;
}

async function getFilterQuery(filterDate: any, regularCronSet: any) {
  return {
    $and: [
      {
        $or: [
          {
            $and: [
              {
                $or: [{ "tradentDetails.last_update_time": { $exists: false } }, { "tradentDetails.last_update_time": null }, { "tradentDetails.last_update_time": { $lte: filterDate } }],
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
                $or: [{ "frontierDetails.last_update_time": { $exists: false } }, { "frontierDetails.last_update_time": null }, { "frontierDetails.last_update_time": { $lte: filterDate } }],
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
                $or: [{ "mvpDetails.last_update_time": { $exists: false } }, { "mvpDetails.last_update_time": null }, { "mvpDetails.last_update_time": { $lte: filterDate } }],
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
  return parseFloat((Math.floor((originalNumber - originalNumber * percentage) * 100) / 100).toFixed(2));
}

export async function GetProductDetailsByVendor(details: any, contextVendor: string) {
  if (contextVendor == "TRADENT") {
    return details.tradentDetails;
  }
  if (contextVendor == "FRONTIER") {
    return details.frontierDetails;
  }
  if (contextVendor == "MVP") {
    return details.mvpDetails;
  }
  if (contextVendor == "TOPDENT") {
    return details.topDentDetails;
  }
  if (contextVendor == "FIRSTDENT") {
    return details.firstDentDetails;
  }
  if (contextVendor == "TRIAD") {
    return details.triadDetails;
  }
  if (contextVendor == "BITESUPPLY") {
    return details.biteSupplyDetails;
  }
}

export async function GetTriggeredByVendor(repriceResult: any, mpId: string, contextVendor: string): Promise<{ resultStr: string; updateRequired: boolean }> {
  const productDetails = await sqlHelper.GetItemListById(mpId);
  let updateRequired = hasPriceChanged(repriceResult);
  let resultStr = "";
  if (productDetails && repriceResult) {
    const contextVendorDetails = await GetProductDetailsByVendor(productDetails, contextVendor);
    if (contextVendorDetails) {
      const existingTriggeredByVendorValue = contextVendorDetails.triggeredByVendor;
      if (existingTriggeredByVendorValue != null || existingTriggeredByVendorValue != "") {
        if (repriceResult.repriceDetails) {
          resultStr = repriceResult.repriceDetails.isRepriced ? repriceResult.repriceDetails.triggeredByVendor : existingTriggeredByVendorValue;
        } else if (repriceResult.listOfRepriceDetails && repriceResult.listOfRepriceDetails.length > 0) {
          const existingSegregatedMessage: any = await flattenExistingValue(existingTriggeredByVendorValue, ",", /^(\d+)\s*@\s*(.+)$/);
          const repricedPriceBreak = _.filter(repriceResult.listOfRepriceDetails, (rp: any) => rp.isRepriced === true);
          if (repricedPriceBreak && repricedPriceBreak.length > 0) {
            let recordsOfMessages = [];
            //If Existing Price breaks are Available
            for (let record of existingSegregatedMessage) {
              if (record) {
                const priceUpdaterPriceBreak = repricedPriceBreak.find((x: any) => x.minQty === record.minQty);
                if (priceUpdaterPriceBreak)
                  recordsOfMessages.push({
                    minQty: record.minQty,
                    message: priceUpdaterPriceBreak.triggeredByVendor,
                    isExistingMessage: false,
                  });
                else recordsOfMessages.push(record);
              }
            }
            //If New Price breaks are Added
            for (let pb of repricedPriceBreak) {
              const hasPriceBreak = existingSegregatedMessage?.some((item: { minQty: any }) => item.minQty === pb.minQty);
              if (!hasPriceBreak) {
                recordsOfMessages.push({
                  minQty: pb.minQty,
                  message: pb.triggeredByVendor,
                  isExistingMessage: false,
                });
              }
            }
            if (recordsOfMessages.length > 0) {
              for (const rep of recordsOfMessages) {
                let cleanMessage = cleanRepeatedPrefix(rep.message);
                cleanMessage = stripPrefix(cleanMessage, /^\d+\s*@\s*/);
                resultStr += `${rep.minQty} @ ${cleanMessage},`;
              }
            }
          } else {
            resultStr = existingTriggeredByVendorValue;
          }
        } else resultStr = `TriggeredByVendorValue is empty`;
      } else if (repriceResult.repriceDetails) {
        resultStr = repriceResult.repriceDetails.triggeredByVendor;
      } else if (repriceResult.listOfRepriceDetails && repriceResult.listOfRepriceDetails.length > 0) {
        for (const rep of repriceResult.listOfRepriceDetails) {
          resultStr += `${rep.triggeredByVendor},`;
        }
      } else {
        resultStr = `TriggeredByVendorValue is empty`;
      }
    }
  }
  return { resultStr, updateRequired };
}

async function flattenExistingValue(existingLastCronMessage: string, delimiter: string, pattern: RegExp): Promise<Array<{ minQty: number; message: string; isExistingMessage: true }>> {
  const segments = existingLastCronMessage
    .split(delimiter)
    .map((s) => s.trim())
    .filter(Boolean);

  return segments.flatMap((segment) => {
    const match = segment.match(pattern);
    if (!match || match.length < 3) return [];

    const minQty = parseInt(match[1], 10);
    const message = match[2];
    return [{ minQty, message, isExistingMessage: true }];
  });
}

function cleanRepeatedPrefix(input: string): string {
  return input.replace(/^(\d+@)+/, (match) => {
    const first = match.match(/^(\d+)@/);
    return first ? first[0] : match;
  });
}

function hasPriceChanged(repriceResult: any): boolean {
  if ((repriceResult.listOfRepriceDetails ?? []).length > 0) {
    return (repriceResult.listOfRepriceDetails ?? []).some((x: { isRepriced: boolean }) => x.isRepriced);
  } else return repriceResult.repriceDetails?.isRepriced;
}

function stripPrefix(input: string, regex: RegExp): string {
  return input.replace(regex, "");
}

async function flattenExistingMessages(existingLastCronMessage: any): Promise<[]> {
  const segments = existingLastCronMessage.split("/").filter(Boolean); // Remove empty segments
  return segments.map((segment: string) => {
    const match = segment.match(/^(\d+)@(.+)$/);
    if (match) {
      const minQty = parseInt(match[1]);
      const message = match[0]; // Preserve full message
      return { minQty: minQty, message: message };
    }
  });
}

export async function GetLastCronMessage(repriceResult: any, mpId: string, contextVendor: string): Promise<string> {
  const productDetails = await sqlHelper.GetItemListById(mpId);
  let resultStr = "";
  if (productDetails && repriceResult && repriceResult.data && repriceResult.data.cronResponse && repriceResult.data.cronResponse.repriceData) {
    const contextVendorDetails = await GetProductDetailsByVendor(productDetails, contextVendor);
    if (contextVendorDetails) {
      const existingLastCronMessage = contextVendorDetails.last_cron_message;
      if (existingLastCronMessage != null || existingLastCronMessage != "") {
        if (repriceResult.data.cronResponse.repriceData.repriceDetails) {
          resultStr = repriceResult.data.cronResponse.repriceData.repriceDetails.isRepriced ? repriceResult.data.cronResponse.repriceData.repriceDetails.explained : existingLastCronMessage;
        } else if (repriceResult.data.cronResponse.repriceData.listOfRepriceDetails && repriceResult.data.cronResponse.repriceData.listOfRepriceDetails.length > 0) {
          const existingSegregatedMessage: any = await flattenExistingMessages(existingLastCronMessage);
          const repricedPriceBreak = _.filter(repriceResult.data.cronResponse.repriceData.listOfRepriceDetails, (rp: any) => rp.isRepriced === true);
          if (repricedPriceBreak && repricedPriceBreak.length > 0) {
            let recordsOfMessages = [];
            //If Existing Price breaks are Available
            for (let record of existingSegregatedMessage) {
              if (record) {
                const priceUpdaterPriceBreak = repricedPriceBreak.find((x: any) => x.minQty === record.minQty);
                if (priceUpdaterPriceBreak)
                  recordsOfMessages.push({
                    minQty: record.minQty,
                    message: priceUpdaterPriceBreak.explained,
                  });
                else recordsOfMessages.push(record);
              }
            }
            //If New Price breaks are Added
            for (let pb of repricedPriceBreak) {
              const hasPriceBreak = existingSegregatedMessage.some((item: { minQty: any }) => item.minQty === pb.minQty);
              if (!hasPriceBreak) {
                recordsOfMessages.push({
                  minQty: pb.minQty,
                  message: pb.explained,
                });
              }
            }
            if (recordsOfMessages.length > 0) {
              for (const rep of recordsOfMessages) {
                resultStr += `${rep.minQty}@${rep.message}/`;
              }
            }
          } else {
            resultStr = existingLastCronMessage;
          }
        } else resultStr = `Reprice Result is empty`;
      } else if (repriceResult.data.cronResponse.repriceData.repriceDetails) {
        resultStr = repriceResult.data.cronResponse.repriceData.repriceDetails.explained;
      } else if (!(repriceResult.data.cronResponse.repriceData.listOfRepriceDetails && repriceResult.data.cronResponse.repriceData.listOfRepriceDetails.length > 0)) {
        resultStr = `Reprice Result is empty`;
      } else {
        for (const rep of repriceResult.data.cronResponse.repriceData.listOfRepriceDetails) {
          resultStr += `${rep.minQty}@${rep.explained}/`;
        }
      }
    }
  }
  return resultStr;
}
