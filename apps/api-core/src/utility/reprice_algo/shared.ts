import _ from "lodash";
import * as globalParam from "../../model/globalParam";
import * as dbHelper from "../mongo/dbHelper";
import { Net32PriceBreak, Net32Product } from "../../types/net32";
import { FrontierProduct } from "../../types/frontier";
import { RepriceData, RepriceModel } from "../../model/repriceModel";
import { applicationConfig } from "../config";

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
  if (applicationConfig.FLAG_MULTI_PRICE_UPDATE === false) return outputList;
  if (outputList.length == 1) return outputList;
  let result: Net32Product[] = [];
  for (let out of outputList) {
    const $ = await globalParam.GetInfo(out.vendorId, productItem);
    if (
      out.vendorId != $.VENDOR_ID &&
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
  if (minQty == 2 && compareWithQ1 == true) {
    return false;
  }
  return true;
}

export async function getSecretKey(cronId: string, contextVendor: string) {
  const cronSettingDetails = await dbHelper.GetCronSettingsDetailsById(cronId);
  if (cronSettingDetails.length === 0) {
    throw new Error(`Cron setting details not found for ${cronId}`);
  }
  const secretKey = cronSettingDetails[0].SecretKey?.find(
    (x) => x.vendorName == contextVendor,
  )?.secretKey;
  if (!secretKey) {
    throw new Error(`Secret key not found for ${cronId} and ${contextVendor}`);
  }
  return secretKey;
}

export async function isOverrideEnabledForProduct(
  override_bulk_update: boolean,
): Promise<boolean> {
  if (override_bulk_update == true) {
    const globalConfig = await dbHelper.GetGlobalConfig();
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
