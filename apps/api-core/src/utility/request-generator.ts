import _ from "lodash";
import * as responseUtility from "./response-utility";
import { GlobalConfig } from "../types/global-config";
import { ErrorItem } from "../types/error-item";
import { ProductDetailsListItem } from "./mysql/mySql-mapper";
import { applicationConfig } from "./config";
import { VendorName } from "@repricer-monorepo/shared";
import * as sqlV2Service from "../utility/mysql/mysql-v2";
export async function GetProductItemListQuery(): Promise<{
  idRef: string;
  active: boolean;
}> {
  return {
    idRef: "PRODUCT_MASTER_LIST",
    active: true,
  };
}

export async function GetPrioritySequence(productInfo: ProductDetailsListItem, contextErrorDetails: ErrorItem[] | null, includeErrorItems: boolean, isExpressCron: boolean, contextVendor: any): Promise<{ name: VendorName; value: string }[]> {
  const _tradent = { name: VendorName.TRADENT, value: "tradentDetails" };
  const _frontier = { name: VendorName.FRONTIER, value: "frontierDetails" };
  const _mvp = { name: VendorName.MVP, value: "mvpDetails" };
  const _topDent = { name: VendorName.TOPDENT, value: "topDentDetails" };
  const _firstDent = { name: VendorName.FIRSTDENT, value: "firstDentDetails" };
  const _triad = { name: VendorName.TRIAD, value: "triadDetails" };
  const _biteSupply = { name: VendorName.BITESUPPLY, value: "biteSupplyDetails" };
  const vendorList = [_tradent, _frontier, _mvp, _topDent, _firstDent, _triad, _biteSupply];
  let prioritySequence: any[] = [];
  const globalConfig = await sqlV2Service.GetGlobalConfig();
  const isOverrideEnabled = IsOverrideExecutionPriorityEnabled(globalConfig!);
  let productDetails = _.cloneDeep(productInfo);

  // Override Execution Priority List in case of Override Set to true
  if (isOverrideEnabled) {
    productDetails = responseUtility.MapOverrideExecutionPriority(productDetails, globalConfig!.override_execution_priority_details!.priority_settings);
  }
  // // For Express Cron, Context Vendor will be given first priority
  // if (isExpressCron && contextVendor) {
  //   const vendorMap = vendorList.find((v) => v.name === contextVendor);
  //   if (vendorMap) {
  //     prioritySequence.push(vendorMap);
  //   }
  // }
  for (let pty = 1; pty <= applicationConfig.VENDOR_COUNT; pty++) {
    const vendors = [
      { details: productDetails.tradentDetails, obj: _tradent },
      { details: productDetails.frontierDetails, obj: _frontier },
      { details: productDetails.mvpDetails, obj: _mvp },
      { details: productDetails.topDentDetails, obj: _topDent },
      { details: productDetails.firstDentDetails, obj: _firstDent },
      { details: productDetails.triadDetails, obj: _triad },
      { details: productDetails.biteSupplyDetails, obj: _biteSupply },
    ];
    for (const vendor of vendors) {
      if (vendor.details && vendor.details.activated && vendor.details.executionPriority === pty && proceedNext(productDetails, vendor.obj.value)) {
        if (includeErrorItems && contextErrorDetails) {
          const vendorDetails = contextErrorDetails.find((x) => x.vendorName === vendor.obj.name);
          if (!vendorDetails && !prioritySequence.find((p) => p.name === vendor.obj.name)) {
            prioritySequence.push(vendor.obj);
          }
        } else if (!prioritySequence.find((p) => p.name === vendor.obj.name)) {
          prioritySequence.push(vendor.obj);
        }
      }
    }
  }
  return prioritySequence;
}

function proceedNext(prod: any, key: string) {
  return prod[key] && prod[key].scrapeOn == true && prod[key].skipReprice == false;
}

function IsOverrideExecutionPriorityEnabled(globalConfig: GlobalConfig): boolean {
  return globalConfig && globalConfig.override_execution_priority_details ? JSON.parse(globalConfig.override_execution_priority_details.override_priority) : false;
}
