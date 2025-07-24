import _ from "lodash";
import * as cacheHelper from "../cacheHelper";
import { CacheKeyName } from "../../resources/cacheKeyName";
import { CronSettings } from "../../types/CronSettings";
import { ErrorItem } from "../../types/ErrorItem";
import { GlobalConfig } from "../../types/GlobalConfig";
import { getMongoDb } from "./index";
import { CronSettingsDetail, ScrapeCronDetail } from "./types";
import { applicationConfig } from "../config";

export async function UpdateProxyPriority(payload: {
  CronId: string;
  ProxyProvider: number;
}) {
  const dbo = await getMongoDb();
  const updateValue = {
    $set: {
      ProxyProvider: payload.ProxyProvider,
    },
  };
  return dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME!)
    .updateOne({ CronId: payload.CronId }, updateValue);
}

export async function GetProxySwitchCronDetails(ignoreCache = false) {
  const cacheKey = CacheKeyName.PROXY_SWITCH_CRON_DETAILS;
  if ((await cacheHelper.Has(cacheKey)) == true && ignoreCache == false) {
    return cacheHelper.Get(cacheKey);
  } else {
    const dbo = await getMongoDb();
    const mongoResult = await dbo
      .collection(applicationConfig.PROXY_SWITCHER_CRON_COLLECTION_NAME!)
      .find()
      .toArray();
    cacheHelper.Set(cacheKey, mongoResult);
    return mongoResult;
  }
}

export async function GetAllProxyProvider(current_proxy_priority: any) {
  const query = {
    proxyPriority: { $exists: true, $nin: [0, current_proxy_priority] }, // will fetch proxies without proxy priority 0  and not existing one
  };
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.IP_CONFIG)
    .find(query)
    .sort({ proxyPriority: 1 })
    .toArray();
}

export async function GetProxyConfigByPriority(proxyPriority: any) {
  const cacheKey = `${CacheKeyName.PROXY_CONFIG_BY_PRIORITY}_${proxyPriority}`;
  if (await cacheHelper.Has(cacheKey)) {
    return cacheHelper.Get(cacheKey);
  } else {
    const query = {
      proxyPriority: proxyPriority,
    };
    const dbo = await getMongoDb();
    const result = await dbo
      .collection(applicationConfig.IP_CONFIG)
      .find(query)
      .toArray();
    cacheHelper.Set(cacheKey, result);
    return result;
  }
}

export async function GetActiveProductList(cronId: any, isSlowCron = false) {
  let query = {
    $and: [
      {
        $or: [
          { "tradentDetails.activated": true },
          { "mvpDetails.activated": true },
          { "frontierDetails.activated": true },
        ],
      },
      {
        $or: [
          { "tradentDetails.cronId": cronId },
          { "mvpDetails.cronId": cronId },
          { "frontierDetails.cronId": cronId },
        ],
      },
      {
        $or: [
          { isSlowActivated: false },
          { isSlowActivated: { $exists: false } },
          { isSlowActivated: null },
        ],
      },
    ],
  };

  if (isSlowCron == true) {
    query = {
      $and: [
        {
          $or: [
            { "tradentDetails.activated": true },
            { "mvpDetails.activated": true },
            { "frontierDetails.activated": true },
          ],
        },
        {
          $or: [
            { "tradentDetails.slowCronId": cronId },
            { "mvpDetails.slowCronId": cronId },
            { "frontierDetails.slowCronId": cronId },
          ] as any,
        },
        { isSlowActivated: true } as any,
      ],
    };
  }

  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION)
    .find(query)
    .toArray();
}

export async function GetGlobalConfig() {
  let mongoResult;
  const globalCacheKey = CacheKeyName.GLOBAL_INFO;
  if ((await cacheHelper.Has(globalCacheKey)) == true) {
    mongoResult = await cacheHelper.Get(globalCacheKey);
  } else {
    const dbo = await getMongoDb();
    mongoResult = await dbo
      .collection(applicationConfig.ENV_SETTINGS)
      .findOne();
    cacheHelper.Set(globalCacheKey, mongoResult);
  }
  if (!mongoResult) {
    throw new Error("Global config not found");
  }
  return mongoResult as GlobalConfig;
}

export async function GetCronSettingsListFresh(): Promise<
  CronSettingsDetail[]
> {
  const cronSettingCacheKey = CacheKeyName.CRON_SETTINGS_LIST;
  let mongoResult;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .find()
    .toArray();
  cacheHelper.Set(cronSettingCacheKey, mongoResult);
  return mongoResult as CronSettingsDetail[];
}

export async function InitCronStatusAsync(payload: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.CRON_STATUS_COLLECTION_NAME)
    .insertOne(payload);
  if (mongoResult && mongoResult.insertedId) {
    mongoResult = mongoResult.insertedId.toString();
  } else mongoResult = null;
  return mongoResult;
}

export async function UpdateCronStatusAsync(payload: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.CRON_STATUS_COLLECTION_NAME)
    .findOneAndUpdate(
      {
        $and: [{ cronTime: payload.cronTime }, { keyGenId: payload.keyGenId }],
      },
      {
        $set: {
          cronTime: payload.cronTime,
          productsCount: payload.productsCount,
          maximumProductCount: payload.maximumProductCount,
          status: payload.status,
          cronId: payload.cronId,
        },
      },
    );
  return mongoResult;
}

export async function GetDelay() {
  let mongoResult = 0;
  const delaySettingCacheKey = CacheKeyName.ENV_DELAY;
  if ((await cacheHelper.Has(delaySettingCacheKey)) == true) {
    mongoResult = await cacheHelper.Get(delaySettingCacheKey);
  } else {
    const dbo = await getMongoDb();
    const dbResponse = await dbo
      .collection(applicationConfig.ENV_SETTINGS)
      .findOne();
    if (dbResponse && dbResponse.delay) {
      mongoResult = parseInt(dbResponse.delay);
    }
    cacheHelper.Set(delaySettingCacheKey, mongoResult);
  }
  return mongoResult;
}

export async function GetCronSettingsDetailsByName(
  cronName: any,
): Promise<any> {
  let mongoResult = null;
  const query = {
    CronName: cronName,
  };
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .find(query)
    .toArray();
  if (mongoResult && mongoResult.length == 0) {
    mongoResult = await dbo
      .collection(applicationConfig.SLOW_CRON_GROUP_COLLECTION_NAME)
      .find(query)
      .toArray();
  }
  if (mongoResult && mongoResult.length == 0) {
    mongoResult = await dbo
      .collection(applicationConfig.SCRAPE_CRON_NAME)
      .find(query)
      .toArray();
  }
  return mongoResult;
}

export async function PushLogsAsync(payload: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_LOGS_COLLECTION_NAME)
    .insertOne(payload);
  if (mongoResult && mongoResult.insertedId) {
    mongoResult = mongoResult.insertedId.toString();
  } else mongoResult = null;
  return mongoResult;
}

export async function UpdateProductAsync(
  payload: any,
  isPriceUpdated: any,
  contextVendor: any,
): Promise<any> {
  let mongoResult = null;
  const dbo = await getMongoDb();
  let setVal = {};
  if (contextVendor == "TRADENT") {
    if (isPriceUpdated && isPriceUpdated == true) {
      setVal = {
        "tradentDetails.last_cron_time": payload.last_cron_time,
        "tradentDetails.secretKey": payload.secretKey,
        "tradentDetails.last_attempted_time": payload.last_attempted_time,
        "tradentDetails.lastCronRun": payload.lastCronRun,
        "tradentDetails.last_update_time": payload.last_update_time,
        "tradentDetails.lastUpdatedBy": payload.lastUpdatedBy,
        "tradentDetails.next_cron_time": payload.next_cron_time,
        "tradentDetails.last_cron_message": payload.last_cron_message,
        "tradentDetails.lowest_vendor": payload.lowest_vendor,
        "tradentDetails.lowest_vendor_price": payload.lowest_vendor_price,
        "tradentDetails.lastExistingPrice": payload.lastExistingPrice,
        "tradentDetails.lastSuggestedPrice": payload.lastSuggestedPrice,
      };
    } else {
      setVal = {
        "tradentDetails.last_cron_time": payload.last_cron_time,
        "tradentDetails.secretKey": payload.secretKey,
        "tradentDetails.last_attempted_time": payload.last_attempted_time,
        "tradentDetails.lastCronRun": payload.lastCronRun,
        "tradentDetails.lastUpdatedBy": payload.lastUpdatedBy,
        "tradentDetails.last_cron_message": payload.last_cron_message,
        "tradentDetails.lowest_vendor": payload.lowest_vendor,
        "tradentDetails.lowest_vendor_price": payload.lowest_vendor_price,
        "tradentDetails.lastExistingPrice": payload.lastExistingPrice,
        "tradentDetails.lastSuggestedPrice": payload.lastSuggestedPrice,
        "tradentDetails.next_cron_time": payload.next_cron_time,
      };
    }
  }
  if (contextVendor == "FRONTIER") {
    if (isPriceUpdated && isPriceUpdated == true) {
      setVal = {
        "frontierDetails.last_cron_time": payload.last_cron_time,
        "frontierDetails.secretKey": payload.secretKey,
        "frontierDetails.last_attempted_time": payload.last_attempted_time,
        "frontierDetails.lastCronRun": payload.lastCronRun,
        "frontierDetails.last_update_time": payload.last_update_time,
        "frontierDetails.lastUpdatedBy": payload.lastUpdatedBy,
        "frontierDetails.next_cron_time": payload.next_cron_time,
        "frontierDetails.last_cron_message": payload.last_cron_message,
        "frontierDetails.lowest_vendor": payload.lowest_vendor,
        "frontierDetails.lowest_vendor_price": payload.lowest_vendor_price,
        "frontierDetails.lastExistingPrice": payload.lastExistingPrice,
        "frontierDetails.lastSuggestedPrice": payload.lastSuggestedPrice,
      };
    } else {
      setVal = {
        "frontierDetails.last_cron_time": payload.last_cron_time,
        "frontierDetails.secretKey": payload.secretKey,
        "frontierDetails.last_attempted_time": payload.last_attempted_time,
        "frontierDetails.lastCronRun": payload.lastCronRun,
        "frontierDetails.lastUpdatedBy": payload.lastUpdatedBy,
        "frontierDetails.last_cron_message": payload.last_cron_message,
        "frontierDetails.lowest_vendor": payload.lowest_vendor,
        "frontierDetails.lowest_vendor_price": payload.lowest_vendor_price,
        "frontierDetails.lastExistingPrice": payload.lastExistingPrice,
        "frontierDetails.lastSuggestedPrice": payload.lastSuggestedPrice,
        "frontierDetails.next_cron_time": payload.next_cron_time,
      };
    }
  }
  if (contextVendor == "MVP") {
    if (isPriceUpdated && isPriceUpdated == true) {
      setVal = {
        "mvpDetails.last_cron_time": payload.last_cron_time,
        "mvpDetails.secretKey": payload.secretKey,
        "mvpDetails.last_attempted_time": payload.last_attempted_time,
        "mvpDetails.lastCronRun": payload.lastCronRun,
        "mvpDetails.last_update_time": payload.last_update_time,
        "mvpDetails.lastUpdatedBy": payload.lastUpdatedBy,
        "mvpDetails.next_cron_time": payload.next_cron_time,
        "mvpDetails.last_cron_message": payload.last_cron_message,
        "mvpDetails.lowest_vendor": payload.lowest_vendor,
        "mvpDetails.lowest_vendor_price": payload.lowest_vendor_price,
        "mvpDetails.lastExistingPrice": payload.lastExistingPrice,
        "mvpDetails.lastSuggestedPrice": payload.lastSuggestedPrice,
      };
    } else {
      setVal = {
        "mvpDetails.last_cron_time": payload.last_cron_time,
        "mvpDetails.secretKey": payload.secretKey,
        "mvpDetails.last_attempted_time": payload.last_attempted_time,
        "mvpDetails.lastCronRun": payload.lastCronRun,
        "mvpDetails.lastUpdatedBy": payload.lastUpdatedBy,
        "mvpDetails.last_cron_message": payload.last_cron_message,
        "mvpDetails.lowest_vendor": payload.lowest_vendor,
        "mvpDetails.lowest_vendor_price": payload.lowest_vendor_price,
        "mvpDetails.lastExistingPrice": payload.lastExistingPrice,
        "mvpDetails.lastSuggestedPrice": payload.lastSuggestedPrice,
        "mvpDetails.next_cron_time": payload.next_cron_time,
      };
    }
  }
  mongoResult = await dbo
    .collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION)
    .findOneAndUpdate(
      { mpId: payload.mpid },
      {
        $set: setVal,
      },
    );
  return mongoResult;
}

export async function GetCronSettingsList(): Promise<CronSettingsDetail[]> {
  const cronSettingCacheKey = CacheKeyName.CRON_SETTINGS_LIST;
  let mongoResult = null;
  if (cacheHelper.Has(cronSettingCacheKey)) {
    mongoResult = cacheHelper.Get(cronSettingCacheKey);
  } else {
    const dbo = await getMongoDb();
    mongoResult = await dbo
      .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
      .find()
      .toArray();
    cacheHelper.Set(cronSettingCacheKey, mongoResult);
  }
  return mongoResult;
}

export async function GetCronSettingsDetailsById(
  cronId: string,
): Promise<CronSettings[]> {
  const query = {
    CronId: cronId,
  };
  const dbo = await getMongoDb();
  let mongoResult = await dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .find(query)
    .toArray();
  if (!mongoResult || mongoResult.length == 0) {
    mongoResult = await dbo
      .collection(applicationConfig.SLOW_CRON_GROUP_COLLECTION_NAME)
      .find(query)
      .toArray();
  }
  return mongoResult as CronSettings[];
}

export async function GetProxyConfigByProviderId(providerId: any) {
  var result = null;
  const cacheKey = `${CacheKeyName.PROXY_CONFIG_BY_PROVIDER_ID}_${providerId}`;
  if (cacheHelper.Has(cacheKey) && applicationConfig.IGNORE_CACHE === false) {
    result = cacheHelper.Get(cacheKey);
  } else {
    const query = {
      proxyProvider: providerId,
    };
    const dbo = await getMongoDb();
    result = await dbo
      .collection(applicationConfig.IP_CONFIG)
      .find(query)
      .toArray();
    cacheHelper.Set(cacheKey, result);
  }
  return result;
}

export async function ResetPendingCronLogs() {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.CRON_STATUS_COLLECTION_NAME)
    .updateMany({}, { $set: { status: "Complete" } });
  return mongoResult;
}

export async function UpsertErrorItemLog(payload: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  const existingItem = await dbo
    .collection(applicationConfig.ERROR_ITEM_COLLECTION)
    .findOne({
      $and: [{ mpId: payload.mpId }, { vendorName: payload.vendorName }],
    });
  if (existingItem) {
    mongoResult = await dbo
      .collection(applicationConfig.ERROR_ITEM_COLLECTION)
      .findOneAndUpdate(
        {
          $and: [{ mpId: payload.mpId }, { vendorName: payload.vendorName }],
        },
        {
          $set: {
            nextCronTime: payload.nextCronTime,
            active: payload.active,
            updatedOn: new Date(),
            insertReason: payload.insertReason,
          },
        },
      );
  } else {
    mongoResult = await dbo
      .collection(applicationConfig.ERROR_ITEM_COLLECTION)
      .insertOne(payload);
  }
  return mongoResult;
}

export async function FindErrorItemByIdAndStatus(
  _mpId: any,
  _status: any,
  _vendor: any,
) {
  let result = 0;
  const dbo = await getMongoDb();
  const query = {
    $and: [
      {
        active: _status,
      },
      {
        mpId: parseInt(_mpId),
      },
      {
        vendorName: _vendor,
      },
    ],
  };

  result = await dbo
    .collection(applicationConfig.ERROR_ITEM_COLLECTION)
    .countDocuments(query);
  return result;
}

export async function FindProductById(mpid: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION)
    .findOne({ mpId: mpid });
  return mongoResult;
}

export async function UpdateCronDetailsByCronId(
  cronId: string,
  _status: boolean,
) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .findOneAndUpdate(
      { CronId: cronId },
      {
        $set: {
          UpdatedTime: new Date(),
          CronStatus: _status,
        },
      },
    );
  cacheHelper.DeleteCacheByKey(CacheKeyName.CRON_SETTINGS_LIST);
  return mongoResult;
}

export async function GetListOfOverrideProducts() {
  let mongoResult = null;
  const query = {
    $and: [
      {
        $or: [
          { "tradentDetails.activated": true },
          { "mvpDetails.activated": true },
          { "frontierDetails.activated": true },
        ],
      },
      {
        $or: [
          { "tradentDetails.override_bulk_update": true },
          { "mvpDetails.override_bulk_update": true },
          { "frontierDetails.override_bulk_update": true },
        ],
      },
      {
        $or: [
          { "tradentDetails.scrapeOn": true },
          { "mvpDetails.scrapeOn": true },
          { "frontierDetails.scrapeOn": true },
        ],
      },
    ],
  };
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.GET_PRICE_LIST_COLLECTION_NAME)
    .find(query)
    .toArray();
  return mongoResult;
}

export async function ExecuteProductQuery(query: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION)
    .find(query)
    .toArray();
  return mongoResult;
}

export async function ExecuteProductUpdate(mpid: any, setVal: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION)
    .findOneAndUpdate(
      { mpId: mpid },
      {
        $set: setVal,
      },
    );
  return mongoResult;
}

export async function GetEligibleContextErrorItems(
  _activeStatus: any,
  _mpId: any,
  _contextVendor: any,
): Promise<ErrorItem[]> {
  var result = null;
  const query = {
    $and: [
      {
        active: _activeStatus,
      },
      {
        mpId: parseInt(_mpId),
      },
      {
        vendorName: {
          $ne: _contextVendor,
        },
      },
    ],
  };
  const dbo = await getMongoDb();
  result = await dbo
    .collection(applicationConfig.ERROR_ITEM_COLLECTION)
    .find(query)
    .toArray();
  return result as ErrorItem[];
}

export async function GetFilterCronDetails(ignoreCache = false) {
  let mongoResult = null;
  const cacheKey = CacheKeyName.FILTER_CRON_DETAILS;
  if ((await cacheHelper.Has(cacheKey)) == true && ignoreCache == false) {
    mongoResult = await cacheHelper.Get(cacheKey);
  } else {
    const dbo = await getMongoDb();
    mongoResult = await dbo
      .collection(applicationConfig.FILTER_CRON_COLLECTION_NAME)
      .find()
      .sort({ _id: 1 })
      .toArray();
    cacheHelper.Set(cacheKey, mongoResult);
  }
  return mongoResult;
}

export async function GetFilterCronDetailsByName(_cronName: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.FILTER_CRON_COLLECTION_NAME)
    .findOne({ cronName: _cronName });
  return mongoResult;
}

export async function GetProductListByQuery(query: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION)
    .find(query)
    .toArray();
  return mongoResult;
}

export async function SaveFilterCronLogs(payload: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.FILTER_CRON_LOGS)
    .insertOne(payload);
  return mongoResult;
}

export async function UpdateCronForProductAsync(payload: any) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  let setVal = {} as any;
  if (payload.tradentDetails) {
    setVal["tradentDetails.slowCronId"] = payload.tradentDetails.slowCronId;
    setVal["tradentDetails.slowCronName"] = payload.tradentDetails.slowCronName;
  }
  if (payload.frontierDetails) {
    setVal["frontierDetails.slowCronId"] = payload.frontierDetails.slowCronId;
    setVal["frontierDetails.slowCronName"] =
      payload.frontierDetails.slowCronName;
  }
  if (payload.mvpDetails) {
    setVal["mvpDetails.slowCronId"] = payload.mvpDetails.slowCronId;
    setVal["mvpDetails.slowCronName"] = payload.mvpDetails.slowCronName;
  }
  if (typeof payload.isSlowActivated != "undefined") {
    setVal["isSlowActivated"] = payload.isSlowActivated;
  }
  mongoResult = await dbo
    .collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION)
    .findOneAndUpdate(
      { mpId: payload.mpId },
      {
        $set: setVal,
      },
    );
  return mongoResult;
}

export async function GetSlowCronDetails(ignoreCache = false) {
  let mongoResult = null;
  const cacheKey = CacheKeyName.SLOW_CRON_DETAILS;
  if ((await cacheHelper.Has(cacheKey)) == true && ignoreCache == false) {
    mongoResult = await cacheHelper.Get(cacheKey);
  } else {
    const dbo = await getMongoDb();
    mongoResult = await dbo
      .collection(applicationConfig.SLOW_CRON_GROUP_COLLECTION_NAME)
      .find()
      .sort({ _id: 1 })
      .toArray();
    cacheHelper.Set(cacheKey, mongoResult);
  }
  return mongoResult;
}

export async function GetLinkedCronSettingsByProviderId(
  proxyProviderId: number,
): Promise<CronSettingsDetail[]> {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .find({ ProxyProvider: proxyProviderId })
    .toArray();
  let slowCronDetails = await dbo
    .collection(applicationConfig.SLOW_CRON_GROUP_COLLECTION_NAME)
    .find({ ProxyProvider: proxyProviderId })
    .toArray();
  mongoResult = _.concat(mongoResult, slowCronDetails);
  return mongoResult as CronSettingsDetail[];
}

export async function UpdateProxyDetailsByCronId(
  cronId: string,
  proxyProvider: number,
) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .findOneAndUpdate(
      { CronId: cronId },
      {
        $set: {
          UpdatedTime: new Date(),
          ProxyProvider: proxyProvider,
          AuditInfo: {
            UpdatedBy: "AUTO-SWITCH",
            UpdatedOn: new Date(),
          },
        },
      },
    );
  mongoResult = await dbo
    .collection(applicationConfig.SLOW_CRON_GROUP_COLLECTION_NAME)
    .findOneAndUpdate(
      { CronId: cronId },
      {
        $set: {
          UpdatedTime: new Date(),
          ProxyProvider: proxyProvider,
          AuditInfo: {
            UpdatedBy: "AUTO-SWITCH",
            UpdatedOn: new Date(),
          },
        },
      },
    );
  cacheHelper.DeleteCacheByKey(CacheKeyName.CRON_SETTINGS_LIST);
  cacheHelper.DeleteCacheByKey(CacheKeyName.SLOW_CRON_DETAILS);
  return mongoResult;
}

export async function GetProxyFailureDetailsByProxyProviderId(
  proxyProvId: any,
) {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.PROXY_FAILURE_COLLECTION)
    .findOne({ proxyProvider: proxyProvId });
  return mongoResult;
}

export async function ResetProxyFailureDetails(proxyProvId: any, userId: any) {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.PROXY_FAILURE_COLLECTION)
    .findOneAndUpdate(
      { proxyProvider: proxyProvId },
      {
        $set: {
          lastResetTime: new Date(),
          initTime: new Date("01-01-1900"),
          failureCount: 0,
          AuditInfo: {
            UpdatedBy: userId,
            UpdatedOn: new Date(),
          },
        },
      },
    );
}

export async function InitProxyFailureDetails(proxyProvId: any, count: any) {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.PROXY_FAILURE_COLLECTION)
    .findOneAndUpdate(
      { proxyProvider: proxyProvId },
      {
        $set: {
          initTime: new Date(),
          failureCount: count,
        },
      },
    );
}

export async function UpdateProxyFailureDetails(proxyProvId: any, count: any) {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.PROXY_FAILURE_COLLECTION)
    .findOneAndUpdate(
      { proxyProvider: proxyProvId },
      {
        $set: {
          failureCount: count,
        },
      },
    );
}

export async function GetProxyFailureDetails() {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.PROXY_FAILURE_COLLECTION)
    .find()
    .toArray();
}

export async function Push422LogsAsync(payload: any) {
  const dbo = await getMongoDb();
  const mongoResult = await dbo
    .collection(applicationConfig.ERROR_422_CRON_LOGS)
    .insertOne(payload);
  return mongoResult && mongoResult.insertedId
    ? mongoResult.insertedId.toString()
    : null;
}

export async function GetScrapeProductList(cronId: any, _isActive: any) {
  const dbo = await getMongoDb();
  const query = {
    $and: [{ isActive: _isActive }, { linkedCronId: cronId }],
  };
  const mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION_NAME)
    .find(query)
    .sort({ _id: 1 })
    .toArray();
  return mongoResult;
}

export async function GetScrapeCronDetails(
  ignoreCache = false,
): Promise<ScrapeCronDetail[]> {
  let mongoResult = null;
  const cacheKey = CacheKeyName.SCRAPE_CRON_DETAILS;
  if (cacheHelper.Has(cacheKey) && ignoreCache === false) {
    mongoResult = await cacheHelper.Get(cacheKey);
  } else {
    const dbo = await getMongoDb();
    mongoResult = await dbo
      .collection(applicationConfig.SCRAPE_CRON_NAME)
      .find()
      .sort({ _id: 1 })
      .toArray();
    cacheHelper.Set(cacheKey, mongoResult);
  }
  return mongoResult;
}

export async function InsertScrapeProduct(payload: any) {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.SCRAPE_PRODUCTS_COLLECTION_NAME)
    .insertOne(payload);
}

export async function PushLogs(payload: any) {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.SCRAPE_PRODUCTS_LOGS_COLLECTION_NAME)
    .insertOne(payload);
}

export async function UpdateScrapeProducts(mpId: any) {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION_NAME)
    .findOneAndUpdate(
      { mpId: mpId },
      {
        $set: {
          last_scrape_time: new Date(),
        },
      },
    );
}
