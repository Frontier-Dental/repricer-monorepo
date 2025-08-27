import _ from "lodash";
import CustomProduct from "../../models/user-model/custom-product";

export const MapProductDetailsList = async (payload: any) => {
  let mappedList: any[] = [];
  if (payload && payload.length > 0) {
    const groupedList = _.groupBy(payload, (prod) => prod.ProductId);
    if (groupedList && groupedList != null) {
      const listOfProductIds = _.keys(groupedList);
      if (listOfProductIds && listOfProductIds.length > 0) {
        for (const prodId of listOfProductIds) {
          const mappedProduct = {
            mpId: prodId,
            isSlowActivated:
              _.first(groupedList[parseInt(prodId)]).IsSlowActivated == 1
                ? true
                : false,
            isScrapeOnlyActivated:
              _.first(groupedList[parseInt(prodId)]).ScrapeOnlyActive == 1
                ? true
                : false,
            scrapeOnlyCronId: _.first(groupedList[parseInt(prodId)])
              .LinkedScrapeOnlyCronId,
            scrapeOnlyCronName: _.first(groupedList[parseInt(prodId)])
              .LinkedScrapeOnlyCron,
            isBadgeItem:
              _.first(groupedList[parseInt(prodId)]).IsBadgeItem == 1
                ? true
                : false,
            cronId: _.first(groupedList[parseInt(prodId)]).RegularCronId,
            net32url: _.first(groupedList[parseInt(prodId)]).Net32Url,
            slowCronId: _.first(groupedList[parseInt(prodId)]).SlowCronId,
            tradentLinkInfo: await getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "TRADENT",
            ),
            frontierLinkInfo: await getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "FRONTIER",
            ),
            mvpLinkInfo: await getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "MVP",
            ),
            topDentLinkInfo: await getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "TOPDENT",
            ),
            firstDentLinkInfo: await getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "FIRSTDENT",
            ),
            triadLinkInfo: await getLinkedInfoForVendor(
              groupedList[parseInt(prodId)],
              "TRIAD",
            ),
            tradentDetails: await getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "TRADENT",
            ),
            frontierDetails: await getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "FRONTIER",
            ),
            mvpDetails: await getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "MVP",
            ),
            topDentDetails: await getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "TOPDENT",
            ),
            firstDentDetails: await getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "FIRSTDENT",
            ),
            triadDetails: await getMappedVendorDetails(
              groupedList[parseInt(prodId)],
              "TRIAD",
            ),
          };
          mappedList.push(mappedProduct as any);
        }
      }
    }
  }
  return mappedList;
};

/********************************** PRIVATE FUNCTIONS **********************************/

async function getMappedVendorDetails(listOfItems: any, vendorName: any) {
  const linkedData = listOfItems.find(
    (x: any) => x.ChannelName && x.ChannelName.toUpperCase() == vendorName,
  );
  return linkedData ? new CustomProduct(linkedData) : null;
}
async function getLinkedInfoForVendor(listOfItems: any, vendorName: any) {
  const vendorEntity = getVendorEntityDb(listOfItems, vendorName);
  return vendorEntity != null ? vendorEntity["Id"] : null;
}
const getVendorEntityDb = (listOfItems: any, vendorName: any) =>
  listOfItems.find(
    (x: any) => x.ChannelName && x.ChannelName.toUpperCase() == vendorName,
  );
