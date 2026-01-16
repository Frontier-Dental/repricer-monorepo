// Update the import path if the file is located elsewhere, for example:
import { RepriceResultEnum } from "../model/enumerations";
// Or create the file '../enums/repriceResultEnum.ts' with the following content:
// export enum RepriceResultEnum { DEFAULT, /* other values */ }

export const Parse = async (repriceResult: any): Promise<RepriceResultEnum> => {
  // TODO: Replace 'RepriceResultEnum.DEFAULT' with an appropriate enum value
  if (is422Error(repriceResult)) return RepriceResultEnum.SPECIAL_422;
  if (repriceResult == null) return RepriceResultEnum.DEFAULT;
  const hasPriceChangedResult = hasPriceChanged(repriceResult);

  //If PriceBreak Deactivation is the Only change happening
  if (isOnlyPriceBreakDeactivated(repriceResult)) return RepriceResultEnum.CHANGE_UP;
  // If Price Has Not Been Changed
  if (!hasPriceChangedResult) {
    const ignoreFloorPresent = checkPresenceOfComment(repriceResult, ["#HitFloor"]);
    if (ignoreFloorPresent) {
      return RepriceResultEnum.IGNORE_FLOOR;
    }
    const ignoreLowestPresent = checkPresenceOfComment(repriceResult, ["IGNORE:#Lowest", "IGNORE: #Lowest", "#HasBuyBox", "IGNORED: Price down only #UP"]);
    if (ignoreLowestPresent) {
      return RepriceResultEnum.IGNORE_LOWEST;
    }
    const ignoreSisterPresent = checkPresenceOfComment(repriceResult, ["IGNORE:#Sister", "IGNORE: #Sister"]);
    if (ignoreSisterPresent) {
      return RepriceResultEnum.IGNORE_SISTER;
    }
    const productSettingsPresent = checkPresenceOfComment(repriceResult, ["DUMMY"]);
    if (productSettingsPresent) {
      return RepriceResultEnum.IGNORE_SETTINGS;
    }
  }
  // If Price Has Been Changed
  else if (hasPriceChangedResult) {
    const contextRepriceResult = getContextRepriceResult(repriceResult);
    if (contextRepriceResult?.explained?.includes("$DOWN")) {
      return RepriceResultEnum.CHANGE_DOWN;
    } else if (contextRepriceResult?.explained?.includes("$UP")) {
      return RepriceResultEnum.CHANGE_UP;
    }
    //Scenario where NewPrice and OldPrice are Same but we do not do a Price Change & has #HitFloor
    const ignoreFloorPresent = checkPresenceOfComment(repriceResult, ["#HitFloor"]);
    if (ignoreFloorPresent) {
      return RepriceResultEnum.IGNORE_FLOOR;
    }
  }
  return RepriceResultEnum.DEFAULT;
};

function hasPriceChanged(repriceResult: any): boolean {
  if ((repriceResult.listOfRepriceDetails ?? []).length > 0) {
    return (repriceResult.listOfRepriceDetails ?? []).some((x: { isRepriced: boolean }) => x.isRepriced);
  } else return repriceResult.repriceDetails?.isRepriced;
}

function getContextRepriceResult(repriceResult: any) {
  if (repriceResult.listOfRepriceDetails != null && repriceResult.listOfRepriceDetails.length > 0) {
    const priceChangedResult = (repriceResult.listOfRepriceDetails ?? []).find((x: { isRepriced: boolean }) => x.isRepriced);
    return priceChangedResult ? priceChangedResult : repriceResult.listOfRepriceDetails[0];
  } else return repriceResult.repriceDetails;
}

function checkPresenceOfComment(repriceResult: any, keys: string[]): boolean {
  const contextRepriceResult = getContextRepriceResult(repriceResult);
  for (const key of keys) {
    if (contextRepriceResult?.explained.includes(key) == true) {
      return true;
    }
  }
  return false;
}

function is422Error(repriceResult: any): boolean {
  let is422Error = false;
  if (!repriceResult.listOfRepriceDetails || repriceResult.listOfRepriceDetails.length === 0) {
    repriceResult.listOfRepriceDetails.forEach((element: { explained: string | string[] }) => {
      if (element?.explained?.includes("ERROR:422")) {
        is422Error = true;
      }
    });
  } else if (repriceResult.repriceDetails?.explained?.includes("ERROR:422")) {
    is422Error = true;
  }
  return is422Error;
}

function isOnlyPriceBreakDeactivated(repriceResult: any): boolean {
  if (!repriceResult.listOfRepriceDetails || repriceResult.listOfRepriceDetails.length === 0) return false;
  const contextResult = getContextRepriceResult(repriceResult);
  return contextResult?.active == 0;
}
