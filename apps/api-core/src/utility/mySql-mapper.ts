import _ from "lodash";
import { OwnVendorProductDetails } from "../model/user-models/custom-product";
import { FullProductDetailsV2 } from "../types/full-product-details-v2";
import { RepriceModel } from "../model/reprice-model";
import { SecretKeyEntry } from "../types/cron-settings";

// Types for the mapped product details list
export interface ProductDetailsListItem {
  mpId: number;
  isSlowActivated: boolean;
  isScrapeOnlyActivated: boolean;
  scrapeOnlyCronId: string | number;
  scrapeOnlyCronName: string;
  tradentLinkInfo: number | null;
  frontierLinkInfo: number | null;
  mvpLinkInfo: number | null;
  topDentLinkInfo: number | null;
  firstDentLinkInfo: number | null;
  tradentDetails: OwnVendorProductDetails | null;
  frontierDetails: OwnVendorProductDetails | null;
  mvpDetails: OwnVendorProductDetails | null;
  topDentDetails: OwnVendorProductDetails | null;
  firstDentDetails: OwnVendorProductDetails | null;
  mpid?: string;
  secretKey?: SecretKeyEntry[];
  last_attempted_time?: Date;
  lastCronRun?: string;
  last_cron_time?: Date;
  cronName?: string;
  contextCronName?: string;
  isOverrideRun?: boolean;
  last_update_time?: Date;
  lastUpdatedBy?: string;
  lastUpdatedOn?: Date;
  last_cron_message?: string;
  lastExistingPrice?: string;
  lastSuggestedPrice?: string;
  next_cron_time?: Date | null;
  wait_update_period?: boolean;
  cronId?: string;
}

export type ProductDetailsList = ProductDetailsListItem[];

export const MapProductDetailsList = (
  payload: FullProductDetailsV2[],
): ProductDetailsList => {
  let mappedList: ProductDetailsList = [];
  if (payload && payload.length > 0) {
    const groupedList = _.groupBy(payload, (prod) => prod.ProductId);
    if (groupedList && groupedList != null) {
      const listOfProductIds = _.keys(groupedList);
      if (listOfProductIds && listOfProductIds.length > 0) {
        for (const prodId of listOfProductIds) {
          const mappedProduct = {
            mpId: parseInt(prodId),
            isSlowActivated:
              _.first(groupedList[parseInt(prodId)])?.IsSlowActivated == 1
                ? true
                : false,
            isScrapeOnlyActivated:
              _.first(groupedList[parseInt(prodId)])?.ScrapeOnlyActive == 1
                ? true
                : false,
            scrapeOnlyCronId:
              _.first(groupedList[parseInt(prodId)])?.LinkedScrapeOnlyCronId ||
              0,
            scrapeOnlyCronName:
              _.first(groupedList[parseInt(prodId)])?.LinkedScrapeOnlyCron ||
              "",
            tradentLinkInfo: getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "TRADENT",
            ),
            frontierLinkInfo: getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "FRONTIER",
            ),
            mvpLinkInfo: getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "MVP",
            ),
            topDentLinkInfo: getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "TOPDENT",
            ),
            firstDentLinkInfo: getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "FIRSTDENT",
            ),
            tradentDetails: getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "TRADENT",
            ),
            frontierDetails: getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "FRONTIER",
            ),
            mvpDetails: getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "MVP",
            ),
            topDentDetails: getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "TOPDENT",
            ),
            firstDentDetails: getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "FIRSTDENT",
            ),
          };
          mappedList.push(mappedProduct);
        }
      }
    }
  }
  return mappedList;
};

export const GetTriggeredByValue = (repriceModel: RepriceModel): string => {
  let triggeredByVendorValue = "";

  if (
    repriceModel.listOfRepriceDetails &&
    repriceModel.listOfRepriceDetails.length > 0
  ) {
    triggeredByVendorValue = repriceModel.listOfRepriceDetails
      .map((item) => `${item.minQty} @ ${item.triggeredByVendor}`)
      .join(", ");
  } else {
    triggeredByVendorValue =
      repriceModel.repriceDetails?.triggeredByVendor || "";
  }

  return triggeredByVendorValue;
};

/********************************** PRIVATE FUNCTIONS **********************************/

function getMappedVendorDetails(
  listOfItems: any[],
  vendorName: string,
): OwnVendorProductDetails | null {
  const linkedData = listOfItems.find(
    (x) => x.ChannelName && x.ChannelName.toUpperCase() == vendorName,
  );
  return linkedData ? new OwnVendorProductDetails(linkedData) : null;
}

function getLinkedInfoForVendor(
  listOfItems: any[],
  vendorName: string,
): number | null {
  const vendorEntity = getVendorEntityDb(listOfItems, vendorName);
  return vendorEntity != null ? vendorEntity["Id"] : null;
}

const getVendorEntityDb = (
  listOfItems: any[],
  vendorName: string,
): any | undefined =>
  listOfItems.find(
    (x) => x.ChannelName && x.ChannelName.toUpperCase() == vendorName,
  );
