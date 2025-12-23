import { CronSettings } from "../../types/cron-settings";
import { ErrorItem } from "../../types/error-item";
import { GlobalConfig } from "../../types/global-config";
import { applicationConfig } from "../config";
import { getMongoDb } from "./index";
import { CronSettingsDetail, ScrapeCronDetail } from "./types";
import { GetCacheClientOptions } from "../../client/cacheClient";
import CacheClient from "../../client/cacheClient";
import { CacheKey } from "@repricer-monorepo/shared";

export async function InitCronStatusAsync(payload: any) {
  const dbo = await getMongoDb();
  const { insertedId } = await dbo.collection(applicationConfig.CRON_STATUS_COLLECTION_NAME).insertOne(payload);
  return insertedId;
}

export async function UpdateCronStatusAsync(payload: any) {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.CRON_STATUS_COLLECTION_NAME).findOneAndUpdate(
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
    }
  );
}

export async function PushLogsAsync(payload: any) {
  const dbo = await getMongoDb();
  const { insertedId } = await dbo.collection(applicationConfig.CRON_LOGS_COLLECTION_NAME).insertOne(payload);
  return insertedId.toString();
}

export async function UpdateProductAsync(payload: any, isPriceUpdated: any, contextVendor: any): Promise<any> {
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
  mongoResult = await dbo.collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION).findOneAndUpdate(
    { mpId: payload.mpid },
    {
      $set: setVal,
    }
  );
  return mongoResult;
}

export async function ResetPendingCronLogs() {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.CRON_STATUS_COLLECTION_NAME).updateMany({}, { $set: { status: "Complete" } });
}

export async function UpsertErrorItemLog(payload: any) {
  const dbo = await getMongoDb();
  const existingItem = await dbo.collection(applicationConfig.ERROR_ITEM_COLLECTION).findOne({
    $and: [{ mpId: payload.mpId }, { vendorName: payload.vendorName }],
  });
  if (existingItem) {
    return dbo.collection(applicationConfig.ERROR_ITEM_COLLECTION).findOneAndUpdate(
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
      }
    );
  } else {
    return dbo.collection(applicationConfig.ERROR_ITEM_COLLECTION).insertOne(payload);
  }
}

export async function FindErrorItemByIdAndStatus(_mpId: any, _status: any, _vendor: any) {
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

  return dbo.collection(applicationConfig.ERROR_ITEM_COLLECTION).countDocuments(query);
}

export async function FindProductById(mpid: any) {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION).findOne({ mpId: mpid });
}

export const GetListOfOverrideProducts = async (): Promise<any> => {
  const query = {
    $and: [{ activated: true }, { override_bulk_update: true }, { scrapeOn: true }],
  };
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.GET_PRICE_LIST_COLLECTION_NAME).find(query).toArray();
};

export async function ExecuteProductQuery(query: any) {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION).find(query).toArray();
}

export async function ExecuteProductUpdate(mpid: any, setVal: any) {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION).findOneAndUpdate(
    { mpId: mpid },
    {
      $set: setVal,
    }
  );
}

export async function GetErrorItemsByMpId(mpId: number): Promise<ErrorItem[]> {
  const dbo = await getMongoDb();
  const result = await dbo.collection(applicationConfig.ERROR_ITEM_COLLECTION).find({ mpId: mpId, active: true }).toArray();
  return result as ErrorItem[];
}

export async function GetEligibleContextErrorItems(_activeStatus: any, _mpId: any, _contextVendor: any): Promise<ErrorItem[]> {
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
  const result = await dbo.collection(applicationConfig.ERROR_ITEM_COLLECTION).find(query).toArray();
  return result as ErrorItem[];
}

export async function GetProductListByQuery(query: any) {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION).find(query).toArray();
}

export async function SaveFilterCronLogs(payload: any) {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.FILTER_CRON_LOGS).insertOne(payload);
}

export async function UpdateCronForProductAsync(payload: any) {
  const dbo = await getMongoDb();
  let setVal = {} as any;
  if (payload.tradentDetails) {
    setVal["tradentDetails.slowCronId"] = payload.tradentDetails.slowCronId;
    setVal["tradentDetails.slowCronName"] = payload.tradentDetails.slowCronName;
  }
  if (payload.frontierDetails) {
    setVal["frontierDetails.slowCronId"] = payload.frontierDetails.slowCronId;
    setVal["frontierDetails.slowCronName"] = payload.frontierDetails.slowCronName;
  }
  if (payload.mvpDetails) {
    setVal["mvpDetails.slowCronId"] = payload.mvpDetails.slowCronId;
    setVal["mvpDetails.slowCronName"] = payload.mvpDetails.slowCronName;
  }
  if (typeof payload.isSlowActivated != "undefined") {
    setVal["isSlowActivated"] = payload.isSlowActivated;
  }
  return dbo.collection(applicationConfig.MANAGED_MONGO_PRODUCT_COLLECTION).findOneAndUpdate(
    { mpId: payload.mpId },
    {
      $set: setVal,
    }
  );
}

export async function Push422LogsAsync(payload: any) {
  const dbo = await getMongoDb();
  const mongoResult = await dbo.collection(applicationConfig.ERROR_422_CRON_LOGS).insertOne(payload);
  return mongoResult && mongoResult.insertedId ? mongoResult.insertedId.toString() : null;
}

export async function GetScrapeProductList(cronId: any, _isActive: any) {
  const dbo = await getMongoDb();
  const query = {
    $and: [{ isActive: _isActive }, { linkedCronId: cronId }],
  };
  const mongoResult = await dbo.collection(applicationConfig.SCRAPE_ITEMS_COLLECTION_NAME).find(query).sort({ _id: 1 }).toArray();
  return mongoResult;
}

export async function InsertScrapeProduct(payload: any) {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.SCRAPE_PRODUCTS_COLLECTION_NAME).insertOne(payload);
}

export async function PushLogs(payload: any) {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.SCRAPE_PRODUCTS_LOGS_COLLECTION_NAME).insertOne(payload);
}

export async function UpdateScrapeProducts(mpId: any) {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.SCRAPE_ITEMS_COLLECTION_NAME).findOneAndUpdate(
    { mpId: mpId },
    {
      $set: {
        last_scrape_time: new Date(),
      },
    }
  );
}

export const GetContextErrorItems = async (_activeStatus: any): Promise<any> => {
  const query = {
    nextCronTime: {
      $lte: new Date(),
    },
    active: _activeStatus,
  };
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.ERROR_ITEM_COLLECTION).find(query).toArray();
};
