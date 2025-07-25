import fs from "fs";
import _ from "lodash";
import * as dbHelper from "./mongo/db-helper";
import { ProductDetailsListItem } from "./mySql-mapper";
import { applicationConfig } from "./config";

export async function GetContextDetails(mpid: string): Promise<any> {
  const feedPath = `${applicationConfig.FEED_FILE_PATH}${applicationConfig.FEED_FILE_NAME}`;
  const net32Data = fs.readFileSync(feedPath, "utf8");
  const jsonData = JSON.parse(net32Data);
  const itemData = jsonData.find((x: any) => x.mpid == mpid);
  return itemData;
}

export async function FilterEligibleProducts(
  productItemList: any[],
  cronId: number,
  isSlowCron: boolean = false,
) {
  if (productItemList && productItemList.length > 0) {
    for (let prod of productItemList) {
      //Tradent
      if (prod.tradentDetails) {
        prod.tradentDetails.skipReprice = await getSkipReprice(
          prod.tradentDetails,
          "TRADENT",
          cronId,
          isSlowCron,
        );
      }
      //Frontier
      if (prod.frontierDetails) {
        prod.frontierDetails.skipReprice = await getSkipReprice(
          prod.frontierDetails,
          "FRONTIER",
          cronId,
          isSlowCron,
        );
      }
      //MVP
      if (prod.mvpDetails) {
        prod.mvpDetails.skipReprice = await getSkipReprice(
          prod.mvpDetails,
          "MVP",
          cronId,
          isSlowCron,
        );
      }
      //TOPDENT
      if (prod.topDentDetails) {
        prod.topDentDetails.skipReprice = await getSkipReprice(
          prod.topDentDetails,
          "TOPDENT",
          cronId,
          isSlowCron,
        );
      }
      //FIRSTDENT
      if (prod.firstDentDetails) {
        prod.firstDentDetails.skipReprice = await getSkipReprice(
          prod.firstDentDetails,
          "FIRSTDENT",
          cronId,
          isSlowCron,
        );
      }
    }
  }
  return productItemList;
}

export function SetSkipReprice(
  productItemList: ProductDetailsListItem[],
  value: boolean,
) {
  if (!productItemList || productItemList.length === 0) {
    throw new Error("No product items found");
  }
  // Return a new array with updated skipReprice values, without mutating the original
  return productItemList.map((prod) => {
    return {
      ...prod,
      tradentDetails: prod.tradentDetails
        ? { ...prod.tradentDetails, skipReprice: value }
        : prod.tradentDetails,
      frontierDetails: prod.frontierDetails
        ? { ...prod.frontierDetails, skipReprice: value }
        : prod.frontierDetails,
      mvpDetails: prod.mvpDetails
        ? { ...prod.mvpDetails, skipReprice: value }
        : prod.mvpDetails,
      topDentDetails: prod.topDentDetails
        ? { ...prod.topDentDetails, skipReprice: value }
        : prod.topDentDetails,
      firstDentDetails: prod.firstDentDetails
        ? { ...prod.firstDentDetails, skipReprice: value }
        : prod.firstDentDetails,
    };
  });
}

async function getSkipReprice(
  prod: any,
  vendor: string,
  cronId: number,
  isSlowCron: boolean = false,
) {
  if (
    (isSlowCron == false && prod.cronId == cronId) ||
    (isSlowCron == true && prod.slowCronId == cronId)
  ) {
    const isErrorItem = await dbHelper.FindErrorItemByIdAndStatus(
      prod.mpid,
      true,
      vendor,
    );
    if (isErrorItem != 0) {
      return true;
    }
    if (
      !prod.last_cron_time ||
      prod.last_cron_time == null ||
      applicationConfig.IS_DEBUG
    ) {
      return false;
    } else if (prod.requestIntervalUnit) {
      if (
        prod.next_cron_time == null ||
        (prod.next_cron_time != null && prod.next_cron_time < new Date())
      ) {
        if (prod.requestIntervalUnit == "min") {
          const lastCronTime = prod.last_cron_time;
          const timeDiffInMinutes = Math.round(
            ((new Date() as any) - lastCronTime) / 60000,
          );
          const requestEveryForProduct = await getRequestIntervalDuration(
            prod.requestInterval,
          );
          if (requestEveryForProduct == -1) {
            return false;
          } else if (timeDiffInMinutes >= requestEveryForProduct) {
            return false;
          }
        } else if (prod.requestIntervalUnit == "sec") {
          const lastCronTime = prod.last_cron_time;
          const timeDiffInSeconds = Math.round(
            ((new Date() as any) - lastCronTime) / 1000,
          );
          const requestEveryForProduct = await getRequestIntervalDuration(
            prod.requestInterval,
          );
          if (requestEveryForProduct == -1) {
            return false;
          } else if (timeDiffInSeconds >= requestEveryForProduct) {
            return false;
          }
        }
      }
    }
    return true;
  }
  return true;
}

async function getRequestIntervalDuration(duration: string) {
  if (Number.isNaN(parseInt(duration)) == true) {
    return -1;
  }
  return parseInt(duration);
}
