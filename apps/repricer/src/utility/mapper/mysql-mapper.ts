import _ from "lodash";
import CustomProduct from "../../models/user-model/custom-product";
import {
  VendorName,
  CronSettingsDto,
  SecretKeyDto,
  AlternateProxyProviderDto,
} from "@repricer-monorepo/shared";
import AuditInfo from "../../models/audit-info";

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

export function ToEnvSettingsModel(incomingSqlData: any): any {
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
}

export function mapCronSettingToEntity(
  cronSetting: any,
  auditInfo: AuditInfo,
): CronSettingsDto {
  return new CronSettingsDto(
    cronSetting.CronId,
    cronSetting.CronName,
    cronSetting.CronTimeUnit,
    cronSetting.CronTime ? parseInt(cronSetting.CronTime) : 0,
    cronSetting.ProxyProvider ? parseInt(cronSetting.ProxyProvider) : 0,
    cronSetting.IpType ? parseInt(cronSetting.IpType) : 0,
    cronSetting.Offset ? parseInt(cronSetting.Offset) : 0,
    cronSetting.FixedIp,
    cronSetting.SwitchSequence ? parseInt(cronSetting.SwitchSequence) : 0,
    cronSetting.IsHidden,
    cronSetting.CronType,
    cronSetting.CronStatus,
    auditInfo.UpdatedBy,
    new Date(),
    auditInfo.UpdatedOn,
  );
}

export function mapCronSettingSecretKeysToEntity(
  cronSetting: any,
): SecretKeyDto[] {
  const secretKeyEntities: SecretKeyDto[] = [];
  if (cronSetting.SecretKey && cronSetting.SecretKey.length > 0) {
    for (const secretKey of cronSetting.SecretKey) {
      secretKeyEntities.push(
        new SecretKeyDto(
          cronSetting.CronId,
          secretKey.vendorName,
          secretKey.secretKey,
        ),
      );
    }
  }
  return secretKeyEntities;
}

export function mapAlternateProxyProvidersToEntity(
  cronSetting: any,
): AlternateProxyProviderDto[] {
  const alternateProxyProviderEntities: AlternateProxyProviderDto[] = [];
  if (
    cronSetting.AlternateProxyProvider &&
    cronSetting.AlternateProxyProvider.length > 0
  ) {
    for (const alternateProxyProvider of cronSetting.AlternateProxyProvider) {
      alternateProxyProviderEntities.push(
        new AlternateProxyProviderDto(
          cronSetting.CronId,
          alternateProxyProvider.Sequence
            ? parseInt(alternateProxyProvider.Sequence)
            : 0,
          alternateProxyProvider.ProxyProvider
            ? parseInt(alternateProxyProvider.ProxyProvider)
            : 0,
        ),
      );
    }
  }
  return alternateProxyProviderEntities;
}

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
