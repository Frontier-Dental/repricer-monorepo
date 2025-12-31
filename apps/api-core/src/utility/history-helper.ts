import _ from "lodash";
import path from "path";
import fsExtra from "fs-extra";
import uuid from "uuid";
import { HistoricalLogs, HistoricalPrice } from "../model/history";
// import * as globalParam from "../model/global-param";
import { HistoryModel } from "../model/sql-models/history";
import * as mySqlHelper from "./mysql/mysql-helper";
import { RepriceData, RepriceModel } from "../model/reprice-model";
import { Net32PriceBreak, Net32Product } from "../types/net32";
import { applicationConfig } from "./config";
import { VendorName } from "@repricer-monorepo/shared";
import * as ResultParser from "./repriceResultParser";

export async function Execute(mpId: number | string, repriceModel: RepriceModel, eligibleList: Net32Product[], ncFlag: boolean, contextVendor?: string, contextCronName?: string) {
  let insertIdLists: { minQty: any; historyIdentifier: any }[] = [];
  let historicalLogs = new HistoricalLogs([]);
  const repriceResult = await ResultParser.Parse(repriceModel);
  if (repriceModel.listOfRepriceDetails && repriceModel.listOfRepriceDetails.length > 0) {
    for (const $rp of repriceModel.listOfRepriceDetails) {
      const priceHistory = await getHistoricalPrice($rp, eligibleList, ncFlag, mpId, contextVendor!, contextCronName!, $rp.triggeredByVendor, repriceResult);
      historicalLogs.SetHistoricalPrice(priceHistory);
    }
  } else {
    const priceHistory = await getHistoricalPrice(repriceModel.repriceDetails!, eligibleList, ncFlag, mpId, contextVendor!, contextCronName!, repriceModel.triggeredByVendor, repriceResult);
    historicalLogs.SetHistoricalPrice(priceHistory);
  }
  //writeFileToJson(historicalLogs, mpId);
  if (applicationConfig.WRITE_HISTORY_SQL) {
    return writeFileToSql(historicalLogs, mpId);
  }
}

export async function Write(data: any, fileName: string, filePath: string, mpId?: string | null) {
  await fsExtra.outputJSON(path.join(__dirname, filePath, fileName), data);
}

export async function getHistoricalPrice(repriceDetails: RepriceData, eligibleList: Net32Product[], ncFlag: boolean, mpId: number | string, contextVendor: string, contextCronName: string, triggeredByVendor: any, repriceResult: any): Promise<HistoricalPrice> {
  const minQty = repriceDetails && repriceDetails.minQty ? repriceDetails.minQty : 1;
  let sortedPayload = getEligibleSortedProducts(eligibleList, minQty, ncFlag);

  if (!repriceDetails) {
    return new HistoricalPrice(0, minQty, null, null, null, null, null, sortedPayload, eligibleList, contextVendor, contextCronName, triggeredByVendor, repriceResult);
  }

  const suggestedPrice = repriceDetails ? (repriceDetails.goToPrice ? repriceDetails.goToPrice : repriceDetails.newPrice) : 0;
  const rank =
    _.findIndex(
      sortedPayload,
      (e) => {
        return e.vendorId.toString() == getOwnVendorId(contextVendor);
      },
      0
    ) + 1;
  return new HistoricalPrice(repriceDetails.oldPrice, minQty, rank, repriceDetails.lowestVendor, repriceDetails.lowestVendorPrice, suggestedPrice, repriceDetails.explained, sortedPayload, eligibleList, contextVendor, contextCronName, triggeredByVendor, repriceResult);
}

export function getEligibleSortedProducts(payload: Net32Product[], minQty: number, ncFlag: boolean) {
  let eligibleList: Net32Product[] = [];
  if (!payload) return eligibleList;
  payload.forEach((element) => {
    if (element.priceBreaks) {
      element.priceBreaks.forEach((p) => {
        if (p.minQty === minQty && p.active && isNotShortExpiryProduct(p, element.priceBreaks, minQty) && !eligibleList.find((x) => x.vendorId == element.vendorId)) {
          eligibleList.push(element);
        }
      });
    }
  });
  //Clean Eligible List based on Duplicate PricePoint
  let tempEligibleList = filterEligibleList(eligibleList, minQty);
  if (ncFlag) {
    eligibleList = _.sortBy(tempEligibleList, [(prod) => prod.priceBreaks.find((x) => x.minQty === minQty && x.active === true)!.unitPrice + GetShippingPrice(prod, minQty)]);
  } else {
    eligibleList = _.sortBy(tempEligibleList, [(prod) => prod.priceBreaks.find((x) => x.minQty === minQty && x.active === true)!.unitPrice]);
  }

  return eligibleList;
}

function isNotShortExpiryProduct(priceBreaks: Net32PriceBreak, listOfPriceBreaks: Net32PriceBreak[], _minQty: number) {
  const contextPriceBreaks: any = listOfPriceBreaks.find((x) => x.minQty == _minQty && x.active == true);
  if (contextPriceBreaks && contextPriceBreaks.length > 1) {
    let resultantEval = true;
    contextPriceBreaks.forEach((x: any) => {
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

function GetShippingPrice(item: Net32Product, minQty: number) {
  if (item != null && item.priceBreaks && item.priceBreaks.length > 0) {
    const contextPriceBreak = item.priceBreaks.find((x) => x.minQty == minQty);
    if (contextPriceBreak) {
      const thresholdPrice = item.freeShippingThreshold && item.freeShippingThreshold != null ? item.freeShippingThreshold : 999999;
      const shippingCharge = item.standardShipping;
      const unitPrice = contextPriceBreak.unitPrice;
      return unitPrice < thresholdPrice ? parseFloat(shippingCharge as unknown as string) : 0;
    }
  }
  return 0;
}

function filterEligibleList(eligibleList: Net32Product[], _minQty: number) {
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

function getOwnVendorId(vendorName: string) {
  switch (
    vendorName.toUpperCase() //17357;20722;20755;20533;20727
  ) {
    case VendorName.TRADENT:
      return "17357";
    case VendorName.FRONTIER:
      return "20722";
    case VendorName.MVP:
      return "20755";
    case VendorName.TOPDENT:
      return "20533";
    case VendorName.FIRSTDENT:
      return "20727";
    case VendorName.TRIAD:
      return "5";
    default:
      throw new Error(`Unknown vendor name: ${vendorName}`);
  }
}

async function writeFileToSql(data: HistoricalLogs, mpId: string | number) {
  let insertIdList = [];
  if (data.historicalPrice && data.historicalPrice.length > 0) {
    const apiResponseLinkedId = await mySqlHelper.InsertHistoricalApiResponse(data.historicalPrice[0].apiResponse, data.refTime);
    for (const history of data.historicalPrice) {
      const sqlModelHistory = new HistoryModel(history, mpId, data.refTime, apiResponseLinkedId);

      const insertId = await mySqlHelper.InsertHistory(sqlModelHistory, data.refTime);

      insertIdList.push({
        minQty: history.minQty,
        historyIdentifier: insertId,
      });
    }
  }
  return insertIdList;
}
