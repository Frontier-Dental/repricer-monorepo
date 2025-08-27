import _ from "lodash";
import { Net32Product } from "../types/net32";

export class History {
  mpId: number;
  historicalLogs: any;

  constructor(mpId: string | number, logs: any) {
    this.mpId = typeof mpId === "string" ? parseInt(mpId) : mpId;
    this.historicalLogs = logs;
  }
  SetHistory(_history: any) {
    this.historicalLogs.push(_history);
  }
}

export class HistoricalLogs {
  refTime: Date;
  historicalPrice: HistoricalPrice[];

  constructor(_historicalPrice: HistoricalPrice[]) {
    this.refTime = new Date();
    this.historicalPrice = _historicalPrice;
  }
  SetHistoricalPrice(_historicalPrice: HistoricalPrice) {
    this.historicalPrice.push(_historicalPrice);
  }
}

export class HistoricalPrice {
  existingPrice: number;
  minQty: number;
  rank: number | null;
  lowestVendor: string | null;
  lowestPrice: string | number;
  suggestedPrice: number | string | null;
  repriceComment: string | null;
  maxVendor: string;
  maxVendorPrice: string | number;
  otherVendorList: string;
  apiResponse: any;
  vendorName: string;
  contextCronName: string;
  triggeredByVendor: any;
  repriceResult: any;

  constructor(
    existingPrice: number,
    minQty: number,
    rank: number | null,
    lowestVendor: string | null,
    lowestPrice: string | number | null,
    suggestedPrice: number | string | null,
    comment: string | null,
    listOfVendors: Net32Product[],
    eligibleList: Net32Product[],
    contextVendor: string,
    cronName: string,
    triggeredByVendor: any,
    repriceResult: any,
  ) {
    this.existingPrice = existingPrice;
    this.minQty = minQty;
    this.rank = rank;
    this.lowestVendor = lowestVendor
      ? lowestVendor
      : listOfVendors && listOfVendors.length > 0
        ? listOfVendors[0].vendorName
        : "N/A";
    this.lowestPrice = lowestPrice
      ? lowestPrice
      : listOfVendors && listOfVendors.length > 0
        ? listOfVendors[0].priceBreaks.find(
            (price) => price.minQty === minQty && price.active,
          )!.unitPrice!
        : "N/A";
    this.suggestedPrice = suggestedPrice;
    this.repriceComment = comment;
    this.maxVendor =
      listOfVendors && listOfVendors.length > 0
        ? listOfVendors[listOfVendors.length - 1].vendorName
        : "N/A";
    this.maxVendorPrice =
      listOfVendors && listOfVendors.length > 0
        ? listOfVendors[listOfVendors.length - 1].priceBreaks.find(
            (price) => price.minQty === minQty && price.active,
          )!.unitPrice!
        : "N/A";
    this.otherVendorList = this.getOtherVendorList(listOfVendors);
    this.apiResponse = eligibleList;
    this.vendorName = contextVendor;
    this.contextCronName = cronName;
    this.triggeredByVendor = triggeredByVendor;
    this.repriceResult = repriceResult;
  }
  getOtherVendorList(listOfVendors: Net32Product[]): string {
    if (!listOfVendors || listOfVendors.length === 0) return "";
    let otherVendorList = "";
    for (let idx = 1; idx < listOfVendors.length - 1; idx++) {
      const unitPrice = listOfVendors[idx].priceBreaks.find(
        (price) => price.minQty === this.minQty && price.active,
      )!.unitPrice!;
      const $vendorName = listOfVendors[idx].vendorName;
      otherVendorList += `${$vendorName} @ ${unitPrice} | `;
    }
    return otherVendorList;
  }
}
