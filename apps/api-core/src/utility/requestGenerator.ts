import _ from "lodash";
import * as dbHelper from "./mongo/dbHelper";
import * as responseUtility from "./responseUtility";
import { GlobalConfig } from "../types/GlobalConfig";
import { ErrorItem } from "../types/ErrorItem";
import { ProductDetailsListItem } from "./mySqlMapper";

export async function GetProductItemListQuery(): Promise<{
  idRef: string;
  active: boolean;
}> {
  return {
    idRef: "PRODUCT_MASTER_LIST",
    active: true,
  };
}

export async function GetPrioritySequence(
  productInfo: ProductDetailsListItem,
  contextErrorDetails: ErrorItem[] | null,
  includeErrorItems: boolean,
) {
  const _tradent = { name: "TRADENT", value: "tradentDetails" };
  const _frontier = { name: "FRONTIER", value: "frontierDetails" };
  const _mvp = { name: "MVP", value: "mvpDetails" };
  const _topDent = { name: "TOPDENT", value: "topDentDetails" };
  const _firstDent = { name: "FIRSTDENT", value: "firstDentDetails" };
  let prioritySequence = [];
  const globalConfig = await dbHelper.GetGlobalConfig();
  const isOverrideEnabled = IsOverrideExecutionPriorityEnabled(globalConfig!);
  let productDetails = _.cloneDeep(productInfo);

  // Override Execution Priority List in case of Override Set to true
  if (isOverrideEnabled == true) {
    productDetails = await responseUtility.MapOverrideExecutionPriority(
      productDetails,
      globalConfig!.override_execution_priority_details!.priority_settings,
    );
  }
  for (let pty = 1; pty <= parseInt(process.env.VENDOR_COUNT || "0"); pty++) {
    const vendors = [
      { details: productDetails.tradentDetails, obj: _tradent },
      { details: productDetails.frontierDetails, obj: _frontier },
      { details: productDetails.mvpDetails, obj: _mvp },
      { details: productDetails.topDentDetails, obj: _topDent },
      { details: productDetails.firstDentDetails, obj: _firstDent },
    ];
    for (const vendor of vendors) {
      if (
        vendor.details &&
        vendor.details.activated == true &&
        vendor.details.executionPriority === pty &&
        proceedNext(productDetails, vendor.obj.value)
      ) {
        if (includeErrorItems && contextErrorDetails) {
          const vendorDetails = contextErrorDetails.find(
            (x) => x.vendorName === vendor.obj.name,
          );
          if (!vendorDetails) {
            prioritySequence.push(vendor.obj);
          }
        } else {
          prioritySequence.push(vendor.obj);
        }
      }
    }
  }
  return prioritySequence;
}

function proceedNext(prod: any, key: string) {
  return (
    prod[key] && prod[key].scrapeOn == true && prod[key].skipReprice == false
  );
}

function IsOverrideExecutionPriorityEnabled(
  globalConfig: GlobalConfig,
): boolean {
  return globalConfig && globalConfig.override_execution_priority_details
    ? JSON.parse(
        globalConfig.override_execution_priority_details.override_priority,
      )
    : false;
}
