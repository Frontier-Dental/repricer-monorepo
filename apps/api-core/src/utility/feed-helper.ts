import fs from "fs";
import _ from "lodash";
import * as dbHelper from "./mongo/db-helper";
import { ProductDetailsListItem } from "./mysql/mySql-mapper";
import { applicationConfig } from "./config";
import { VendorName } from "@repricer-monorepo/shared";
import { getMongoDb } from "./mongo";
import { WithId } from "mongodb";

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
  if (productItemList.length === 0) {
    throw new Error("No products found");
  }
  const [active422CronItems, activeOpportunityCronItems] = await Promise.all([
    getActive422CronItems(),
    getActiveOpportunityCronItems(),
  ]);
  for (let prod of productItemList) {
    //Tradent
    if (prod.tradentDetails) {
      prod.tradentDetails.skipReprice = getSkipReprice(
        prod.tradentDetails,
        VendorName.TRADENT,
        cronId,
        isSlowCron,
        active422CronItems,
        activeOpportunityCronItems,
      );
    }
    //Frontier
    if (prod.frontierDetails) {
      prod.frontierDetails.skipReprice = getSkipReprice(
        prod.frontierDetails,
        VendorName.FRONTIER,
        cronId,
        isSlowCron,
        active422CronItems,
        activeOpportunityCronItems,
      );
    }
    //MVP
    if (prod.mvpDetails) {
      prod.mvpDetails.skipReprice = getSkipReprice(
        prod.mvpDetails,
        VendorName.MVP,
        cronId,
        isSlowCron,
        active422CronItems,
        activeOpportunityCronItems,
      );
    }
    //TOPDENT
    if (prod.topDentDetails) {
      prod.topDentDetails.skipReprice = getSkipReprice(
        prod.topDentDetails,
        VendorName.TOPDENT,
        cronId,
        isSlowCron,
        active422CronItems,
        activeOpportunityCronItems,
      );
    }
    //FIRSTDENT
    if (prod.firstDentDetails) {
      prod.firstDentDetails.skipReprice = getSkipReprice(
        prod.firstDentDetails,
        VendorName.FIRSTDENT,
        cronId,
        isSlowCron,
        active422CronItems,
        activeOpportunityCronItems,
      );
    }
    //TRIAD
    if (prod.triadDetails) {
      prod.triadDetails.skipReprice = getSkipReprice(
        prod.triadDetails,
        VendorName.TRIAD,
        cronId,
        isSlowCron,
        active422CronItems,
        activeOpportunityCronItems,
      );
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
      triadDetails: prod.triadDetails
        ? { ...prod.triadDetails, skipReprice: value }
        : prod.triadDetails,
    };
  });
}

interface ErrorItem extends WithId<Document> {
  mpId: number;
  nextCronTime: Date;
  active: boolean;
  contextCronId: string;
  vendorName: VendorName;
  insertReason: string;
}

async function getActive422CronItems(): Promise<ErrorItem[]> {
  const dbo = await getMongoDb();
  const result = await dbo
    .collection(applicationConfig.ERROR_ITEM_COLLECTION)
    .find({
      active: true,
    })
    .toArray();
  return result as ErrorItem[];
}

async function getActiveOpportunityCronItems(): Promise<ErrorItem[]> {
  const dbo = await getMongoDb();
  const result = await dbo
    .collection(applicationConfig.OPPORTUNITY_ITEM_COLLECTION)
    .find({
      active: true,
    })
    .toArray();
  return result as ErrorItem[];
}

function getSkipReprice(
  prod: any,
  vendor: string,
  cronId: number,
  isSlowCron: boolean = false,
  active422CronItems: ErrorItem[],
  activeOpportunityCronItems: ErrorItem[],
) {
  if (
    (isSlowCron == false && prod.cronId == cronId) ||
    (isSlowCron == true && prod.slowCronId == cronId)
  ) {
    const isErrorItem = active422CronItems.find(
      (item) => item.mpId === prod.mpid && item.vendorName === vendor,
    );
    if (isErrorItem) {
      return true;
    }
    const isOpportunityItem = activeOpportunityCronItems.find(
      (item) => item.mpId === prod.mpid && item.vendorName === vendor,
    );
    if (isOpportunityItem) {
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
          const requestEveryForProduct = getRequestIntervalDuration(
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
          const requestEveryForProduct = getRequestIntervalDuration(
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

function getRequestIntervalDuration(duration: string) {
  if (Number.isNaN(parseInt(duration)) == true) {
    return -1;
  }
  return parseInt(duration);
}
