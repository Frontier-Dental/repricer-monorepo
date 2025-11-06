import _ from "lodash";
import CustomProduct from "../../models/user-model/custom-product";
import { VendorName } from "@repricer-monorepo/shared";

export function MapProductDetailsList(payload: any) {
  let mappedList: any[] = [];
  if (!payload || payload.length === 0) {
    return mappedList;
  }
  const groupedList = _.groupBy(payload, (prod) => prod.ProductId);
  if (!groupedList || groupedList === null) {
    return mappedList;
  }
  const listOfProductIds = _.keys(groupedList);
  if (!listOfProductIds || listOfProductIds.length === 0) {
    return mappedList;
  }
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
        _.first(groupedList[parseInt(prodId)]).IsBadgeItem == 1 ? true : false,
      cronId: _.first(groupedList[parseInt(prodId)]).RegularCronId,
      net32url: _.first(groupedList[parseInt(prodId)]).Net32Url,
      slowCronId: _.first(groupedList[parseInt(prodId)]).SlowCronId,
      algo_execution_mode: _.first(groupedList[parseInt(prodId)])
        .algo_execution_mode,
      tradentLinkInfo: getLinkedInfoForVendor(
        groupedList[parseInt(prodId)],
        VendorName.TRADENT,
      ),
      frontierLinkInfo: getLinkedInfoForVendor(
        groupedList[parseInt(prodId)],
        VendorName.FRONTIER,
      ),
      mvpLinkInfo: getLinkedInfoForVendor(
        groupedList[parseInt(prodId)],
        VendorName.MVP,
      ),
      topDentLinkInfo: getLinkedInfoForVendor(
        groupedList[parseInt(prodId)],
        VendorName.TOPDENT,
      ),
      firstDentLinkInfo: getLinkedInfoForVendor(
        groupedList[parseInt(prodId)],
        VendorName.FIRSTDENT,
      ),
      triadLinkInfo: getLinkedInfoForVendor(
        groupedList[parseInt(prodId)],
        VendorName.TRIAD,
      ),
      tradentDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        VendorName.TRADENT,
      ),
      frontierDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        VendorName.FRONTIER,
      ),
      mvpDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        VendorName.MVP,
      ),
      topDentDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        VendorName.TOPDENT,
      ),
      firstDentDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        VendorName.FIRSTDENT,
      ),
      triadDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        VendorName.TRIAD,
      ),
    };
    mappedList.push(mappedProduct as any);
  }
  return mappedList;
}

/********************************** PRIVATE FUNCTIONS **********************************/

function getMappedVendorDetails(listOfItems: any, vendorName: any) {
  const linkedData = listOfItems.find(
    (x: any) => x.ChannelName && x.ChannelName.toUpperCase() == vendorName,
  );
  return linkedData ? new CustomProduct(linkedData) : null;
}
function getLinkedInfoForVendor(listOfItems: any, vendorName: any) {
  const vendorEntity = getVendorEntityDb(listOfItems, vendorName);
  return vendorEntity != null ? vendorEntity["Id"] : null;
}
const getVendorEntityDb = (listOfItems: any, vendorName: any) =>
  listOfItems.find(
    (x: any) => x.ChannelName && x.ChannelName.toUpperCase() == vendorName,
  );

export function ToIpConfigModelList(
  incomingSqlData: any,
): any[] | PromiseLike<any[]> {
  const mappedList: any[] = [];
  if (!incomingSqlData || incomingSqlData.length === 0) {
    return mappedList;
  }
  for (const sqlItem of incomingSqlData) {
    const mappedItem = {
      proxyProvider: sqlItem.ProxyProvider,
      proxyProviderName: sqlItem.ProxyProviderName,
      userName: sqlItem.UserName,
      password: sqlItem.Password,
      hostUrl: sqlItem.HostUrl,
      port: sqlItem.Port,
      ipTypeName: sqlItem.IpTypeName,
      ipType: sqlItem.IpType,
      method: sqlItem.Method,
      active: sqlItem.Active === 1 ? true : false,
      proxyPriority: sqlItem.ProxyPriority,
      isDummy: sqlItem.IsDummy === 1 ? true : false,
      AuditInfo: {
        UpdatedBy: sqlItem.UpdatedBy,
        UpdatedOn: sqlItem.UpdatedOn,
      },
    };
    mappedList.push(mappedItem);
  }
  return mappedList;
}
