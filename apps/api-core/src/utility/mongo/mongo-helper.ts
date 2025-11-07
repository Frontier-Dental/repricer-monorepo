import _ from "lodash";
import { getMongoDb } from ".";
import { applicationConfig } from "../config";

export const GetItemList = async (): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.GET_PRICE_LIST_COLLECTION_NAME)
    .find({ activated: true })
    .toArray();
};

export const PushLogsAsync = async (payload: any): Promise<any> => {
  const dbo = await getMongoDb();
  const { insertedId } = await dbo
    .collection(applicationConfig.CRON_LOGS_COLLECTION_NAME)
    .insertOne(payload);
  return insertedId.toString();
};

export const UpdateProductAsync = async (
  payload: any,
  isPriceUpdated: boolean,
): Promise<any> => {
  const dbo = await getMongoDb();
  if (isPriceUpdated) {
    return dbo
      .collection(applicationConfig.GET_PRICE_LIST_COLLECTION_NAME)
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
      .collection(applicationConfig.GET_PRICE_LIST_COLLECTION_NAME)
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
  const dbo = await getMongoDb();
  const result = await dbo
    .collection(applicationConfig.CRON_STATUS_COLLECTION_NAME)
    .insertOne(payload);
  return result.insertedId.toString();
};

export const UpdateCronStatusAsync = async (payload: any): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.CRON_STATUS_COLLECTION_NAME)
    .updateOne(
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
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .find()
    .toArray();
};

export const ResetPendingCronLogs = async (): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.CRON_STATUS_COLLECTION_NAME)
    .updateMany({}, { $set: { status: "Complete" } });
};

export const UpdateCronSettings = async (cronId: string): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
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
    .collection(applicationConfig.ERROR_ITEM_COLLECTION)
    .findOne({
      $and: [{ mpId: payload.mpId }, { vendorName: payload.vendorName }],
    });
  if (existingItem) {
    return dbo
      .collection(applicationConfig.ERROR_ITEM_COLLECTION)
      .findOneAndUpdate(
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
      .collection(applicationConfig.ERROR_ITEM_COLLECTION)
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
    .collection(applicationConfig.ERROR_ITEM_COLLECTION)
    .find(query)
    .toArray();
};

export const GetItemListById = async (_mpId: any): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION)
    .findOne({ mpId: _mpId.toString() });
};

// export const GetProxyConfigByProviderId = async (
//   providerId: any,
// ): Promise<any> => {
//   const query = {
//     proxyProvider: providerId,
//   };
//   const dbo = await getMongoDb();
//   return dbo.collection(applicationConfig.IP_CONFIG).find(query).toArray();
// };

export const GetCronSettingsDetailsByName = async (
  cronName: string,
): Promise<any> => {
  const query = {
    CronName: cronName,
  };
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .findOne(query);
};

export const GetHistoryDetailsForId = async (_mpId: any): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.HISTORY_DB)
    .findOne({ mpId: parseInt(_mpId) });
};

export const UpsertHistoryDetails = async (payload: any): Promise<any> => {
  const dbo = await getMongoDb();
  const existingItem = await dbo
    .collection(applicationConfig.HISTORY_DB)
    .findOne({ mpId: payload.mpId });
  if (existingItem) {
    return dbo.collection(applicationConfig.HISTORY_DB).findOneAndUpdate(
      { mpId: payload.mpId },
      {
        $set: {
          historicalLogs: payload.historicalLogs,
        },
      },
    );
  } else {
    return dbo.collection(applicationConfig.HISTORY_DB).insertOne(payload);
  }
};

export async function getNet32KeysByCronName(cronName: string): Promise<any> {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .findOne({ CronName: cronName });
}

// export const GetRotatingProxyUrl = async (): Promise<any> => {
//   const query = {
//     $and: [
//       {
//         proxyProvider: 1,
//       },
//       {
//         ipType: 1,
//       },
//     ],
//   };
//   const dbo = await getMongoDb();
//   const result = await dbo
//     .collection(applicationConfig.IP_CONFIG)
//     .findOne(query);
//   return result?.hostUrl;
// };

// export const GetGlobalConfig = async (): Promise<any> => {
//   const dbo = await getMongoDb();
//   return dbo.collection(applicationConfig.ENV_SETTINGS).findOne();
// };

export const FindErrorItemByIdAndStatus = async (
  _mpId: any,
  _status: any,
): Promise<any> => {
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
    .collection(applicationConfig.ERROR_ITEM_COLLECTION)
    .countDocuments(query);
};

// export const GetDelay = async (): Promise<any> => {
//   const dbo = await getMongoDb();
//   const dbResponse = await dbo
//     .collection(applicationConfig.ENV_SETTINGS)
//     .findOne();
//   if (!dbResponse) {
//     throw new Error("Delay not found");
//   }
//   return parseInt(dbResponse.delay);
// };

export const UpdateCronDetailsByCronId = async (
  cronId: string,
  _status: any,
): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
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
    .collection(applicationConfig.GET_PRICE_LIST_COLLECTION_NAME)
    .find(query)
    .toArray();
};

export const GetVendorDetails_ManagedService = async (
  query: any,
): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.MANAGED_MONGO_COLLECTION)
    .find(query)
    .toArray();
};

export const load_vendor_data = async (payload: any): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.MANAGED_MONGO_COLLECTION)
    .insertOne(payload);
};

export const update_vendor_data = async (payload: any): Promise<any> => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.MANAGED_MONGO_COLLECTION)
    .findOneAndUpdate(
      { mpId: payload.mpId },
      {
        $set: {
          result: payload.result,
          lastUpdated: new Date(),
        },
      },
    );
};
