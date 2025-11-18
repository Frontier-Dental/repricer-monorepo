import _ from "lodash";
import * as globalParam from "../../../model/global-param";
import * as dbHelper from "../../mongo/db-helper";
import { Net32PriceBreak, Net32Product } from "../../../types/net32";
import { FrontierProduct } from "../../../types/frontier";
import { RepriceData, RepriceModel } from "../../../model/reprice-model";
import { applicationConfig } from "../../config";
import * as sqlV2Service from "../../../utility/mysql/mysql-v2";
import { GetCronSettingsDetailsById } from "../../../utility/mysql/mysql-v2";

export function isPriceUpdateRequired(
  repriceResult: RepriceModel,
  isRepriceOn: boolean,
) {
  if (
    isRepriceOn &&
    repriceResult.repriceDetails &&
    repriceResult.repriceDetails.newPrice !== "N/A" &&
    repriceResult.repriceDetails.newPrice !==
      (repriceResult.repriceDetails.oldPrice as unknown as string)
  ) {
    return true;
  } else if (
    isRepriceOn &&
    repriceResult.isMultiplePriceBreakAvailable &&
    repriceResult.listOfRepriceDetails.length > 0
  ) {
    let $eval = false;
    repriceResult.listOfRepriceDetails.forEach(($rp) => {
      if (
        $rp.newPrice !== "N/A" &&
        ($rp.newPrice as unknown as number) !== $rp.oldPrice
      ) {
        $eval = true;
      } else if ($rp.active == false) {
        $eval = true;
      }
    });
    return $eval;
  }
  return false;
}

export async function getSamePriceBreakDetails(
  outputList: Net32Product[],
  priceBreak: Net32PriceBreak,
  productItem: FrontierProduct,
) {
  if (!applicationConfig.FLAG_MULTI_PRICE_UPDATE) return outputList;
  if (outputList.length == 1) return outputList;
  let result: Net32Product[] = [];
  for (let out of outputList) {
    const $ = await globalParam.GetInfo(out.vendorId, productItem);
    let excludedVendors = productItem.competeAll
      ? []
      : $.EXCLUDED_VENDOR_ID.split(";");
    if (
      out.vendorId != $.VENDOR_ID &&
      !_.includes(excludedVendors, out.vendorId.toString()) &&
      out.priceBreaks &&
      out.priceBreaks.length > 0
    ) {
      out.priceBreaks.forEach((pb) => {
        if (pb.minQty == priceBreak.minQty) {
          result.push(out);
        }
      });
    }
  }
  return result;
}

export function notQ2VsQ1(minQty: number, compareWithQ1: boolean) {
  return !(minQty == 2 && compareWithQ1);
}

export async function getSecretKey(cronId: string, contextVendor: string) {
  const cronSettingDetails = await GetCronSettingsDetailsById(cronId);
  if (cronSettingDetails.length === 0) {
    throw new Error(`Cron setting details not found for ${cronId}`);
  }
  const secretKey = cronSettingDetails[0].SecretKey?.find(
    (x: any) => x.vendorName == contextVendor,
  )?.secretKey;
  if (!secretKey) {
    throw new Error(`Secret key not found for ${cronId} and ${contextVendor}`);
  }
  return secretKey;
}

export async function isOverrideEnabledForProduct(
  override_bulk_update: boolean,
): Promise<boolean> {
  if (override_bulk_update) {
    const globalConfig = await sqlV2Service.GetGlobalConfig();
    if (globalConfig && globalConfig.override_all) {
      return JSON.parse(globalConfig.override_all);
    }
  }
  return false;
}

export const delay = (s: number) =>
  new Promise((res: any) => setTimeout(res, s * 1000));

export function MinQtyPricePresent(
  priceBreaks: Net32PriceBreak[],
  minQty: number,
) {
  if (priceBreaks == null || priceBreaks.length == 0) return false;
  let present = false;
  for (const pb of priceBreaks) {
    if (pb.minQty == minQty) {
      present = true;
    }
  }
  return present;
}

export const getIsFloorReached = async (repricerDetails: RepriceData) => {
  if (!repricerDetails.explained) {
    throw new Error("Reprice details explained is null");
  }
  return repricerDetails.explained.toUpperCase().indexOf("#HITFLOOR") > -1;
};

export const getPriceStepValue = async (repricerDetails: any) => {
  const oldPrice = parseFloat(repricerDetails.oldPrice);
  const newPrice =
    repricerDetails.newPrice == "N/A"
      ? 0
      : parseFloat(repricerDetails.newPrice);
  if (oldPrice > newPrice) {
    return "$DOWN";
  } else if (oldPrice < newPrice) {
    return "$UP";
  } else return "$SAME";
};
