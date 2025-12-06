import _ from "lodash";
import { OwnVendorProductDetails } from "../../model/user-models/custom-product";
import { FullProductDetailsV2 } from "../../types/full-product-details-v2";
import { RepriceModel } from "../../model/reprice-model";
import { SecretKeyEntry } from "../../types/cron-settings";
import { AlgoExecutionMode, VendorName } from "@repricer-monorepo/shared";

// Types for the mapped product details list
export interface ProductDetailsListItem {
  mpId: number;
  productIdentifier: number;
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
  triadDetails: OwnVendorProductDetails | null;
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
  algo_execution_mode?: AlgoExecutionMode;
}

export type ProductDetailsList = ProductDetailsListItem[];

export const MapProductDetailsList = (
  payload: FullProductDetailsV2[],
): ProductDetailsList => {
  let mappedList: ProductDetailsList = [];
  if (!payload || payload.length === 0) {
    return mappedList;
  }
  const groupedList = _.groupBy(payload, (prod) => prod.ProductId);
  const listOfProductIds = _.keys(groupedList);
  for (const prodId of listOfProductIds) {
    const mappedProduct = {
      mpId: parseInt(prodId),
      algo_execution_mode: groupedList[parseInt(prodId)][0].algo_execution_mode,
      productIdentifier: groupedList[parseInt(prodId)][0].ProductIdentifier,
      isSlowActivated:
        _.first(groupedList[parseInt(prodId)])?.IsSlowActivated == 1
          ? true
          : false,
      isScrapeOnlyActivated:
        _.first(groupedList[parseInt(prodId)])?.ScrapeOnlyActive == 1
          ? true
          : false,
      scrapeOnlyCronId: _.first(groupedList[parseInt(prodId)])
        ?.LinkedScrapeOnlyCronId as any,
      scrapeOnlyCronName: _.first(groupedList[parseInt(prodId)])
        ?.LinkedScrapeOnlyCron as any,
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
        groupedList[parseInt(prodId)][0].algo_execution_mode?.toString(),
        VendorName.TRADENT,
      ),
      frontierDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        groupedList[parseInt(prodId)][0].algo_execution_mode?.toString(),
        VendorName.FRONTIER,
      ),
      mvpDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        groupedList[parseInt(prodId)][0].algo_execution_mode?.toString(),
        VendorName.MVP,
      ),
      topDentDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        groupedList[parseInt(prodId)][0].algo_execution_mode?.toString(),
        VendorName.TOPDENT,
      ),
      firstDentDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        groupedList[parseInt(prodId)][0].algo_execution_mode?.toString(),
        VendorName.FIRSTDENT,
      ),
      triadDetails: getMappedVendorDetails(
        groupedList[parseInt(prodId)],
        groupedList[parseInt(prodId)][0].algo_execution_mode?.toString(),
        VendorName.TRIAD,
      ),
    };
    mappedList.push(mappedProduct);
  }
  return mappedList;
};

export const GetTriggeredByValue = (
  repriceModel: RepriceModel,
): string | null => {
  let triggeredByVendorValue = null;

  triggeredByVendorValue =
    (repriceModel.listOfRepriceDetails ?? []).length > 0
      ? (repriceModel.listOfRepriceDetails ?? [])
          .map(($) => `${$.triggeredByVendor}`)
          .join(", ")
      : repriceModel.repriceDetails?.triggeredByVendor || null;

  return triggeredByVendorValue;
};

export const ToIpConfigModelList = (
  incomingSqlData: any,
): any[] | PromiseLike<any[]> => {
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
};

export const ToEnvSettingsModel = (incomingSqlData: any): any => {
  let mappedItem: any = null;
  if (!incomingSqlData) {
    return mappedItem;
  }
  mappedItem = {
    delay: incomingSqlData[0].Delay,
    source: incomingSqlData[0].Source,
    override_all: incomingSqlData[0].OverrideAll === 1 ? "true" : "false",
    FrontierApiKey: incomingSqlData[0].FrontierApiKey,
    DevIntegrationKey: incomingSqlData[0].DevIntegrationKey,
    expressCronBatchSize: incomingSqlData[0].ExpressCronBatchSize,
    expressCronOverlapThreshold: incomingSqlData[0].ExpressCronOverlapThreshold,
    expressCronInstanceLimit: incomingSqlData[0].ExpressCronInstanceLimit,
    AuditInfo: {
      UpdatedBy: incomingSqlData[0].UpdatedBy,
      UpdatedOn: incomingSqlData[0].UpdatedOn,
    },
    override_execution_priority_details: {
      override_priority:
        incomingSqlData[0].OverridePriority === 1 ? "true" : "false",
      priority_settings: {
        tradent_priority: getPriority(incomingSqlData, "TRADENT"),
        frontier_priority: getPriority(incomingSqlData, "FRONTIER"),
        mvp_priority: getPriority(incomingSqlData, "MVP"),
        firstDent_priority: getPriority(incomingSqlData, "FIRSTDENT"),
        topDent_priority: getPriority(incomingSqlData, "TOPDENT"),
        triad_priority: getPriority(incomingSqlData, "TRIAD"),
      },
    },
  };
  return mappedItem;
};

export function ToCronSettingsModel(incomingSqlData: any): any {
  const mappedList: any[] = [];
  if (!incomingSqlData || incomingSqlData.length === 0) {
    return mappedList;
  }
  const groupedList = _.groupBy(incomingSqlData, (sqlData) => sqlData.CronId);
  if (!groupedList || groupedList === null) {
    return mappedList;
  }
  const listOfCronsIds = _.keys(groupedList);
  for (const cronId of listOfCronsIds) {
    const cronSettingSqlEntity = groupedList[cronId];
    const mappedCronSetting = {
      CronId: cronSettingSqlEntity[0].CronId,
      CronName: cronSettingSqlEntity[0].CronName,
      CronTimeUnit: cronSettingSqlEntity[0].CronTimeUnit,
      CronTime: cronSettingSqlEntity[0].CronTime,
      CronStatus: cronSettingSqlEntity[0].CronStatus == 1 ? true : false,
      Offset: cronSettingSqlEntity[0].Offset,
      ProxyProvider: cronSettingSqlEntity[0].ProxyProvider,
      IpType: cronSettingSqlEntity[0].IpType,
      FixedIp: cronSettingSqlEntity[0].FixedIp,
      CreatedTime: cronSettingSqlEntity[0].CreatedTime,
      SwitchSequence: cronSettingSqlEntity[0].SwitchSequence,
      IsHidden: cronSettingSqlEntity[0].IsHidden == 1 ? true : false,
      UpdatedTime: cronSettingSqlEntity[0].UpdatedTime,
      CronType: cronSettingSqlEntity[0].CronType,
      SecretKey: toSecretKeysForCron(cronSettingSqlEntity),
      AlternateProxyProvider:
        toAlternateProxyProvidersForCron(cronSettingSqlEntity),
      AuditInfo: {
        UpdatedBy: cronSettingSqlEntity[0].UpdatedBy,
        UpdatedOn: cronSettingSqlEntity[0].UpdatedTime,
      },
    };
    mappedList.push(mappedCronSetting as any);
  }
  return mappedList;
}

export function MapWithAuditInfo(incomingSqlData: any): any {
  let mappedItem: any = [];
  if (!incomingSqlData) {
    return mappedItem;
  }
  for (let sqlItem of incomingSqlData) {
    // Remove 'UpdatedBy' and add 'AuditInfo'
    const { updatedBy, updatedTime, ...rest } = sqlItem;
    mappedItem.push({
      ...rest,
      AuditInfo: {
        UpdatedBy: sqlItem.updatedBy,
        UpdatedOn: sqlItem.updatedTime,
      },
    });
  }
  return mappedItem;
}
/********************************** PRIVATE FUNCTIONS **********************************/

function getMappedVendorDetails(
  listOfItems: any[],
  algoExecutionMode: any,
  vendorName: VendorName,
): OwnVendorProductDetails | null {
  const linkedData = listOfItems.find(
    (x) => x.ChannelName && x.ChannelName.toUpperCase() == vendorName,
  );
  return linkedData
    ? new OwnVendorProductDetails(linkedData, algoExecutionMode)
    : null;
}

function getLinkedInfoForVendor(
  listOfItems: any[],
  vendorName: VendorName,
): number | null {
  const vendorEntity = getVendorEntityDb(listOfItems, vendorName);
  return vendorEntity != null ? vendorEntity["Id"] : null;
}

function getVendorEntityDb(listOfItems: any[], vendorName: VendorName) {
  return listOfItems.find(
    (x) => x.ChannelName && x.ChannelName.toUpperCase() == vendorName,
  );
}

function hasPriceChanged(repriceModel: any) {
  if ((repriceModel.listOfRepriceDetails ?? []).length > 0) {
    const qty1PriceBreak = (repriceModel.listOfRepriceDetails ?? []).find(
      (x: { minQty: number }) => x.minQty == 1,
    );
    if (
      qty1PriceBreak &&
      qty1PriceBreak.newPrice != null &&
      qty1PriceBreak.newPrice != "N/A" &&
      qty1PriceBreak.newPrice != ""
    ) {
      return true;
    }
  } else if (
    repriceModel.repriceDetails?.newPrice != null &&
    repriceModel.repriceDetails?.newPrice != "N/A" &&
    repriceModel.repriceDetails?.newPrice != ""
  ) {
    return true;
  }
  return false;
}

function getPriority(incomingSqlData: any, vendorName: string) {
  const vendorEntity = incomingSqlData.find(
    (x: any) => x.EntityName && x.EntityName.toUpperCase() == vendorName,
  );
  return vendorEntity ? vendorEntity.Priority.toString() : null;
}

function toSecretKeysForCron(cronSettingSqlEntity: any[]) {
  const secretKeys = [];
  const groupedSecretKeys = _.groupBy(
    cronSettingSqlEntity,
    (sqlData) => sqlData.VendorName,
  );
  if (!groupedSecretKeys || groupedSecretKeys === null) {
    return null;
  }
  const listOfVendorNames = _.keys(groupedSecretKeys);
  for (const vendor of listOfVendorNames) {
    const secretKeySqlEntity = groupedSecretKeys[vendor];
    const secretKey = {
      vendorName: vendor,
      secretKey: secretKeySqlEntity[0].SecretKey,
    };
    secretKeys.push(secretKey);
  }
  return secretKeys;
}
function toAlternateProxyProvidersForCron(cronSettingSqlEntity: any[]) {
  const alternateProxyProviders = [];
  const groupedAlternateProviders = _.groupBy(
    cronSettingSqlEntity,
    (sqlData) => sqlData.AltProxySequence,
  );
  if (!groupedAlternateProviders || groupedAlternateProviders === null) {
    return null;
  }
  const listOfSequences = _.keys(groupedAlternateProviders);
  for (const sequence of listOfSequences) {
    const alternateProviderSqlEntity = groupedAlternateProviders[sequence];
    const alternateProvider = {
      Sequence: parseInt(sequence),
      ProxyProvider: alternateProviderSqlEntity[0].AltProxyProvider,
    };
    alternateProxyProviders.push(alternateProvider);
  }
  return alternateProxyProviders;
}
