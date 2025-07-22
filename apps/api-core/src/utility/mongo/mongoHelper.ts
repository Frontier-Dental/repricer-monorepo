import _ from "lodash";
import { CacheKeyName } from "../../resources/cacheKeyName";
import * as cacheHelper from "../cacheHelper";
import { getMongoDb } from ".";

// Type definitions for payloads and results (use 'any' where unclear)

export const GetItemList = async (): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.GET_PRICE_LIST_COLLECTION_NAME!)
    .find({ activated: true })
    .toArray();
};

export const PushLogsAsync = async (payload: any): Promise<any> => {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(process.env.SCRAPE_LOGS_COLLECTION_NAME!)
    .insertOne(payload);
  if (mongoResult && mongoResult.insertedId) {
    mongoResult = mongoResult.insertedId.toString();
  } else mongoResult = null;
  return mongoResult;
};

export const UpdateProductAsync = async (
  payload: any,
  isPriceUpdated: boolean,
): Promise<any> => {
  const dbo = await getMongoDb();
  if (isPriceUpdated) {
    return dbo
      .collection(process.env.GET_PRICE_LIST_COLLECTION_NAME!)
      .findOneAndUpdate(
        { mpid: payload.mpid },
        {
          $set: {
            last_cron_time: payload.last_cron_time,
            secretKey: payload.secretKey,
            last_attempted_time: payload.last_attempted_time,
            lastCronRun: payload.lastCronRun,
            last_update_time: payload.last_update_time,
            lastUpdatedBy: payload.lastUpdatedBy,
            next_cron_time: payload.next_cron_time,
            last_cron_message: payload.last_cron_message,
            lowest_vendor: payload.lowest_vendor,
            lowest_vendor_price: payload.lowest_vendor_price,
            lastExistingPrice: payload.lastExistingPrice,
            lastSuggestedPrice: payload.lastSuggestedPrice,
          },
        },
      );
  } else {
    return dbo
      .collection(process.env.GET_PRICE_LIST_COLLECTION_NAME!)
      .findOneAndUpdate(
        { mpid: payload.mpid },
        {
          $set: {
            last_cron_time: payload.last_cron_time,
            secretKey: payload.secretKey,
            last_attempted_time: payload.last_attempted_time,
            lastCronRun: payload.lastCronRun,
            //"last_update_time": payload.last_update_time,
            lastUpdatedBy: payload.lastUpdatedBy,
            //"next_cron_time": payload.next_cron_time,
            last_cron_message: payload.last_cron_message,
            lowest_vendor: payload.lowest_vendor,
            lowest_vendor_price: payload.lowest_vendor_price,
            lastExistingPrice: payload.lastExistingPrice,
            lastSuggestedPrice: payload.lastSuggestedPrice,
          },
        },
      );
  }
};

export const InitCronStatusAsync = async (payload: any): Promise<any> => {
  let mongoResult = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(process.env.CRON_STATUS_COLLECTION_NAME!)
    .insertOne(payload);
  if (mongoResult && mongoResult.insertedId) {
    mongoResult = mongoResult.insertedId.toString();
  } else mongoResult = null;
  return mongoResult;
};

export const UpdateCronStatusAsync = async (payload: any): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo.collection(process.env.CRON_STATUS_COLLECTION_NAME!).updateOne(
    { cronTime: payload.cronTime },
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
};

export const GetCronSettingsList = async (): Promise<any> => {
  const cronSettingCacheKey = CacheKeyName.CRON_SETTINGS_LIST;
  let mongoResult = null;
  if ((await cacheHelper.Has(cronSettingCacheKey)) == true) {
    mongoResult = await cacheHelper.Get(cronSettingCacheKey);
  } else {
    const dbo = await getMongoDb();
    mongoResult = await dbo
      .collection(process.env.CRON_SETTINGS_COLLECTION_NAME!)
      .find()
      .toArray();
    cacheHelper.Set(cronSettingCacheKey, mongoResult);
  }
  return mongoResult;
};

export const ResetPendingCronLogs = async (): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.CRON_STATUS_COLLECTION_NAME!)
    .updateMany({}, { $set: { status: "Complete" } });
};

export const UpdateCronSettings = async (cronId: string): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.CRON_SETTINGS_COLLECTION_NAME!)
    .findOneAndUpdate(
      { CronId: cronId },
      {
        $set: {
          UpdatedTime: new Date(),
        },
      },
    );
};

export const UpsertErrorItemLog = async (payload: any): Promise<any> => {
  const dbo = await getMongoDb();
  const existingItem = await dbo
    .collection(process.env.ERROR_ITEM_COLLECTION!)
    .findOne({
      $and: [{ mpId: payload.mpId }, { vendorName: payload.vendorName }],
    });
  if (existingItem) {
    return dbo.collection(process.env.ERROR_ITEM_COLLECTION!).findOneAndUpdate(
      { mpId: payload.mpId },
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
    return dbo
      .collection(process.env.ERROR_ITEM_COLLECTION!)
      .insertOne(payload);
  }
};

export const GetContextErrorItems = async (
  _activeStatus: any,
): Promise<any> => {
  const query = {
    nextCronTime: {
      $lte: new Date(),
    },
    active: _activeStatus,
  };
  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.ERROR_ITEM_COLLECTION!)
    .find(query)
    .toArray();
};

export const GetItemListById = async (_mpId: any): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.MANAGED_MONGO_PRODUCT_COLLECTION!)
    .findOne({ mpId: _mpId.toString() });
};

export const GetProxyConfigByProviderId = async (
  providerId: any,
): Promise<any> => {
  let result = null;
  const cacheKey = `${CacheKeyName.PROXY_CONFIG_BY_PROVIDER_ID}_${providerId}`;
  if (await cacheHelper.Has(cacheKey)) {
    result = await cacheHelper.Get(cacheKey);
  } else {
    const query = {
      proxyProvider: providerId,
    };
    const dbo = await getMongoDb();
    result = await dbo.collection(process.env.IP_CONFIG!).find(query).toArray();
    cacheHelper.Set(cacheKey, result);
  }
  return result;
};

export const GetCronSettingsDetailsByName = async (
  cronName: string,
): Promise<any> => {
  const cronSettingCacheKey = CacheKeyName.CRON_SETTINGS_LIST;
  if ((await cacheHelper.Has(cronSettingCacheKey)) == true) {
    const cacheDetails = await cacheHelper.Get(cronSettingCacheKey);
    return _.filter(cacheDetails, (x: any) => x.CronName == cronName);
  } else {
    const query = {
      CronName: cronName,
    };
    const dbo = await getMongoDb();
    return dbo
      .collection(process.env.CRON_SETTINGS_COLLECTION_NAME!)
      .find(query)
      .toArray();
  }
};

export const GetHistoryDetailsForId = async (_mpId: any): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.HISTORY_DB!)
    .findOne({ mpId: parseInt(_mpId) });
};

export const UpsertHistoryDetails = async (payload: any): Promise<any> => {
  const dbo = await getMongoDb();
  const existingItem = await dbo
    .collection(process.env.HISTORY_DB!)
    .findOne({ mpId: payload.mpId });
  if (existingItem) {
    return dbo.collection(process.env.HISTORY_DB!).findOneAndUpdate(
      { mpId: payload.mpId },
      {
        $set: {
          historicalLogs: payload.historicalLogs,
        },
      },
    );
  } else {
    return dbo.collection(process.env.HISTORY_DB!).insertOne(payload);
  }
};

export const GetRotatingProxyUrl = async (): Promise<any> => {
  const query = {
    $and: [
      {
        proxyProvider: 1,
      },
      {
        ipType: 1,
      },
    ],
  };
  const dbo = await getMongoDb();
  const result = await dbo.collection(process.env.IP_CONFIG!).findOne(query);
  return result?.hostUrl;
};

export const GetGlobalConfig = async (): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo.collection(process.env.ENV_SETTINGS!).findOne();
};

export const FindErrorItemByIdAndStatus = async (
  _mpId: any,
  _status: any,
): Promise<any> => {
  let result = 0;
  const query = {
    $and: [
      {
        active: _status,
      },
      {
        mpId: parseInt(_mpId),
      },
    ],
  };

  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.ERROR_ITEM_COLLECTION!)
    .countDocuments(query);
};

export const GetDelay = async (): Promise<any> => {
  let mongoResult = 0;
  const delaySettingCacheKey = CacheKeyName.ENV_DELAY;
  if ((await cacheHelper.Has(delaySettingCacheKey)) == true) {
    mongoResult = await cacheHelper.Get(delaySettingCacheKey);
  } else {
    const dbo = await getMongoDb();
    const dbResponse = await dbo
      .collection(process.env.ENV_SETTINGS!)
      .findOne();
    if (dbResponse && dbResponse.delay) {
      mongoResult = parseInt(dbResponse.delay);
    }
    cacheHelper.Set(delaySettingCacheKey, mongoResult);
  }
  return mongoResult;
};

export const GetCronSettingsListFresh = async (): Promise<any[]> => {
  const cronSettingCacheKey = CacheKeyName.CRON_SETTINGS_LIST;
  const dbo = await getMongoDb();
  const mongoResult = await dbo
    .collection(process.env.CRON_SETTINGS_COLLECTION_NAME!)
    .find()
    .toArray();
  cacheHelper.Set(cronSettingCacheKey, mongoResult);
  return mongoResult;
};

export const UpdateCronDetailsByCronId = async (
  cronId: string,
  _status: any,
): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.CRON_SETTINGS_COLLECTION_NAME!)
    .findOneAndUpdate(
      { CronId: cronId },
      {
        $set: {
          UpdatedTime: new Date(),
          CronStatus: _status,
        },
      },
    );
};

export const GetListOfOverrideProducts = async (): Promise<any> => {
  const query = {
    $and: [
      { activated: true },
      { override_bulk_update: true },
      { scrapeOn: true },
    ],
  };
  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.GET_PRICE_LIST_COLLECTION_NAME!)
    .find(query)
    .toArray();
};

export const GetVendorDetails_ManagedService = async (
  query: any,
): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.MANAGED_MONGO_COLLECTION!)
    .find(query)
    .toArray();
};

export const load_vendor_data = async (payload: any): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(process.env.MANAGED_MONGO_COLLECTION!)
    .insertOne(payload);
};

export const update_vendor_data = async (payload: any): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo.collection(process.env.MANAGED_MONGO_COLLECTION!).findOneAndUpdate(
    { mpId: payload.mpId },
    {
      $set: {
        result: payload.result,
        lastUpdated: new Date(),
      },
    },
  );
};
