import { MongoClient, Db, ObjectId } from "mongodb";
import _ from "lodash";
// import * as cacheHelper from "../utility/cache-helper";
// import cacheKeyEnum from "../../resources/cacheKeyName.json";
import * as SessionHelper from "../utility/session-helper";
import { applicationConfig } from "../utility/config";
import { GetCacheClientOptions } from "../client/cacheClient";
import CacheClient from "../client/cacheClient";
import { CacheKey } from "@repricer-monorepo/shared";

// --- MongoDB Singleton Helper ---
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

async function getMongoDb() {
  if (!mongoClient) {
    mongoClient = new MongoClient(applicationConfig.MANAGED_MONGO_URL);
    await mongoClient.connect();
    mongoDb = mongoClient.db(applicationConfig.GET_REPRICER_DBNAME);
  }
  return mongoDb!;
}

export const GetCronLogsV2 = async (
  pgNo: number,
  type: string,
  cronId: string,
  date: any,
  pgLimit: number,
) => {
  let query: any = {};
  if (type) {
    switch (type) {
      case "Manual":
        query["type"] = "Manual";
        break;
      case "Regular":
        query["type"] = {
          $nin: ["Manual", "422Error", "OVERRIDE_RUN", "FEED_RUN", "SLOWCRON"],
        };
        break;
      case "422Error":
        query["type"] = "422Error";
        break;
      case "All":
        query["type"] = { $nin: ["FEED_RUN"] };
        break;
      case "Override":
        query["type"] = "OVERRIDE_RUN";
        break;
      case "FeedRun":
        query["type"] = "FEED_RUN";
        break;
      case "ALL_EXCEPT_422":
        query["type"] = { $nin: ["422Error"] };
        break;
      default:
        query["type"] = type;
        break;
    }
  }
  if (cronId != "") {
    query["cronId"] = cronId;
  }
  if (date.fromDate != "" && date.toDate != "") {
    query["time"] = {
      $gt: date.fromDate,
      $lt: date.toDate,
    };
  }
  let mongoResult: any = null,
    pageSize = 0,
    pageNumber = 0,
    totalDocs = 0,
    totalPages = 0;

  const dbo = await getMongoDb();
  pageSize = parseInt(pgLimit as any) || applicationConfig.CRON_PAGESIZE;
  pageNumber = parseInt(pgNo as any) || 0;

  if (type && type == "422Error") {
    totalDocs = await dbo
      .collection(applicationConfig.ERROR_422_CRON_LOGS)
      .countDocuments({ cronId: "DUMMY-422-Error" });
  } else if (type && type == "All") {
    totalDocs = await dbo
      .collection(applicationConfig.ERROR_422_CRON_LOGS)
      .countDocuments({ cronId: "DUMMY-422-Error" });
    totalDocs =
      totalDocs +
      (await dbo
        .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
        .estimatedDocumentCount());
  } else {
    totalDocs = await dbo
      .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
      .estimatedDocumentCount();
  }
  totalPages = Math.ceil(totalDocs / pageSize);

  const pipeline = [
    { $match: query },
    { $sort: { time: -1 } },
    { $skip: pageNumber * pageSize },
    { $limit: pageSize },
  ];
  if (type && type != "422Error" && type != "ALL_EXCEPT_422") {
    mongoResult = await dbo
      .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
      .aggregate(pipeline)
      .toArray();
  } else {
    mongoResult = [];
  }

  //422 Cron Logs
  if (type && (type == "422Error" || type == "All")) {
    let queryForFilter: any = {
      $and: [{ cronId: "DUMMY-422-Error" }, { type: "422Error" }],
    };
    if (query["time"]) {
      queryForFilter = {
        $and: [
          { cronId: "DUMMY-422-Error" },
          { type: "422Error" },
          { time: query["time"] as any },
        ],
      };
    }
    const _errorCronLogs = await dbo
      .collection(applicationConfig.ERROR_422_CRON_LOGS)
      .find(queryForFilter)
      .sort({ time: -1 })
      .skip(pageNumber * pageSize)
      .limit(pageSize)
      .toArray();
    mongoResult = _.concat(mongoResult, _errorCronLogs);
  }

  //ALL Other Logs
  if (type && type == "ALL_EXCEPT_422") {
    let queryToSearch: any = {
      time: query["time"] as any,
    };
    if (cronId != "") {
      queryToSearch = {
        $and: [{ time: query["time"] as any }, { cronId: cronId }],
      };
    }
    mongoResult = await dbo
      .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
      .find(queryToSearch)
      .sort({ time: -1 })
      .skip(pageNumber * pageSize)
      .limit(pageSize)
      .toArray();
  }

  return { mongoResult, pageNumber, pageSize, totalDocs, totalPages };
};

export const GetCronLogs = async (
  pgNo: number,
  type: string,
  cronId: string,
  date: any,
) => {
  let query: any = {};
  if (type) {
    switch (type) {
      case "Manual":
        query["type"] = "Manual";
        break;
      case "Regular":
        // query['type'] = { $ne: 'Manual' }
        query["type"] = {
          $nin: ["Manual", "422Error", "OVERRIDE_RUN", "FEED_RUN", "SLOWCRON"],
        };
        break;
      case "422Error":
        query["type"] = "422Error";
        break;
      case "All":
        break;
      case "Override":
        query["type"] = "OVERRIDE_RUN";
        break;
      case "FeedRun":
        query["type"] = "FEED_RUN";
        break;
      default:
        query["type"] = type;
        break;
    }
  }
  if (cronId != "") {
    query["cronId"] = cronId;
  }
  if (date.fromDate != "" && date.toDate != "") {
    query["time"] = {
      $gt: new Date(date.fromDate),
      $lt: new Date(date.toDate),
    };
  }
  let mongoResult: any = null,
    pageSize = 0,
    pageNumber = 0,
    totalDocs = 0,
    totalPages = 0;

  const dbo = await getMongoDb();

  pageSize = applicationConfig.CRON_PAGESIZE;
  pageNumber = pgNo || 0;
  totalDocs = await dbo
    .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
    .countDocuments(query);
  totalPages = Math.ceil(totalDocs / pageSize);
  // mongoResult = await dbo.collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME).find(query).sort({ $natural: -1 }).skip(pageNumber * pageSize).limit(pageSize).toArray();
  if (pgNo !== undefined) {
    mongoResult = await dbo
      .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
      .find(query)
      .sort({ $natural: -1 })
      .skip(pageNumber * pageSize)
      .limit(pageSize)
      .toArray();
  } else {
    mongoResult = await dbo
      .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
      .find(query)
      .sort({ $natural: -1 })
      .toArray();
  }
  return { mongoResult, pageNumber, pageSize, totalDocs, totalPages };
};

export const GetUserLogin = async (query: any) => {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.USERS_COLLECTION).findOne(query);
};

export const GetItemList = async (mpId: string) => {
  const dbo = await getMongoDb();
  const query = { mpid: mpId };
  return dbo
    .collection(applicationConfig.ITEMS_COLLECTION_NAME)
    .find(query)
    .toArray();
};

export const UpdateCronLogPostPriceUpdate = async (req: any) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
    .findOneAndUpdate(
      { _id: req._id },
      {
        $set: {
          logs: req.logs,
        },
      },
    );
};

export const GetLogsById = async (id: string) => {
  const dbo = await getMongoDb();
  const query = { _id: new ObjectId(id) };
  const mongoResult = await dbo
    .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
    .find(query)
    .toArray();
  if (mongoResult && mongoResult.length == 0) {
    return dbo
      .collection(applicationConfig.ERROR_422_CRON_LOGS)
      .find(query)
      .toArray();
  }
  return mongoResult;
};

export const FindOneProductModel = async (query: any) => {
  let product: any = null;
  const dbo = await getMongoDb();

  // Fetch the document that matches the provided query
  product = await dbo
    .collection(applicationConfig.PRODUCT_COLLECTION)
    .findOne(query);

  return product;
};

export const GetLatestCronStatus = async () => {
  const dbo = await getMongoDb();
  const query: any = { status: "In-Progress" };
  return dbo
    .collection(applicationConfig.CRON_STATUS_COLLECTION_NAME)
    .find(query)
    .sort({ _id: -1 })
    .toArray();
};

export const PushManualCronLogAsync = async (payload: any) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
    .insertOne(payload);
};

export const GetCronSettingsList = async () => {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const cronSettingsList = await cacheClient.get<any>(
    CacheKey.CRON_SETTINGS_LIST,
  );
  if (cronSettingsList != null) return cronSettingsList;
  const dbo = await getMongoDb();
  let dbResponse = await dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .find()
    .toArray();
  if (dbResponse != null) {
    await cacheClient.set(CacheKey.CRON_SETTINGS_LIST, dbResponse);
  }
  return dbResponse;
};

export const UpdateCronSettingsList = async (payload: any, req: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  for (const element of payload) {
    mongoResult = await dbo
      .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
      .findOneAndUpdate(
        { CronId: element.CronId },
        {
          $set: {
            CronName: element.CronName,
            CronTime: element.CronTime,
            CronTimeUnit: element.CronTimeUnit,
            Offset: element.Offset,
            SecretKey: element.SecretKey,
            ProxyProvider: element.ProxyProvider,
            IpType: element.IpType,
            FixedIp: element.FixedIp,
            AlternateProxyProvider: element.AlternateProxyProvider,
            AuditInfo: await SessionHelper.GetAuditInfo(req),
          },
        },
      );
  }
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);

  return mongoResult;
};

export const InsertCronSettings = async (payload: any) => {
  //const cacheClient = new CacheClient(GetCacheClientOptions(applicationConfig));
  const dbo = await getMongoDb();
  const { insertedId } = await dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .insertOne(payload);
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);

  return insertedId.toString();
};

export const ToggleCronStatus = async (
  cronId: string,
  cronStatus: string,
  req: any,
) => {
  const dbo = await getMongoDb();
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);

  return dbo
    .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME)
    .findOneAndUpdate(
      { CronId: cronId },
      {
        $set: {
          CronStatus: cronStatus,
          UpdatedTime: new Date(),
          AuditInfo: await SessionHelper.GetAuditInfo(req),
        },
      },
    );
};

export const PurgeCronBasedOnId = async (cronId: string) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
    .deleteMany({ cronId: cronId });
};

export const PurgeCronBasedOnDate = async (dateString: string) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME)
    .deleteMany({
      time: {
        $lte: new Date(dateString),
      },
    });
};

export const deleteById = async (Id: string) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.PRODUCT_COLLECTION)
    .deleteOne({ mpId: Id });
};

export const CheckInProgressExport = async () => {
  const dbo = await getMongoDb();
  let query = { status: "In Progress" };
  return dbo.collection("exports").find(query).toArray();
};

export const FetchQueuedExport = async () => {
  const dbo = await getMongoDb();
  let query = { $or: [{ status: "Queued" }, { status: "Batched" }] };
  return dbo.collection("exports").findOne(query);
};

export const UpdateExportStatus = async (id: any, status: any, info = {}) => {
  const dbo = await getMongoDb();
  return dbo.collection("exports").findOneAndUpdate(
    { _id: id },
    {
      $set: { ...info, status },
    },
  );
};

export const FetchExports = async () => {
  const dbo = await getMongoDb();
  let query: any = {};
  return dbo.collection("exports").find(query).toArray();
};

export const Get422ProductCountByType = async (_type: any) => {
  const dbo = await getMongoDb();
  let query: any = {
    $and: [
      {
        active: true,
      },
      {
        insertReason: _type,
      },
    ],
  };
  return dbo
    .collection(applicationConfig.ERROR_ITEM_COLLECTION)
    .countDocuments(query);
};

export const GetContextErrorItemsCount = async (_activeStatus: any) => {
  const dbo = await getMongoDb();
  const query: any = {
    nextCronTime: {
      $lte: new Date(),
      //$gte: new Date()
    },
    active: _activeStatus,
  };
  return dbo
    .collection(applicationConfig.ERROR_ITEM_COLLECTION)
    .countDocuments(query);
};

export const GetConfigurations = async (activeOnly = true) => {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const configurationResult = await cacheClient.get<any>(CacheKey.IP_CONFIG);
  if (configurationResult != null) return configurationResult;
  const dbo = await getMongoDb();
  const query = activeOnly ? { active: true } : {};
  const dbResult = await dbo
    .collection(applicationConfig.IP_CONFIG)
    .find(query)
    .toArray();
  if (dbResult != null) await cacheClient.set(CacheKey.IP_CONFIG, dbResult);

  return dbResult;
};

export const UpdateConfiguration = async (payload: any, req: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.IP_CONFIG);

  for (const element of payload) {
    mongoResult = await dbo
      .collection(applicationConfig.IP_CONFIG)
      .findOneAndUpdate(
        { proxyProvider: element.proxyProvider, ipType: element.ipType },
        {
          $set: {
            userName: element.userName,
            password: element.password,
            hostUrl: element.hostUrl,
            port: parseInt(element.port),
            active: element.active,
            AuditInfo: await SessionHelper.GetAuditInfo(req),
          },
        },
      );
  }
  return mongoResult;
};

export const GetHistoryDetailsForId = async (_mpId: any) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.HISTORY_DB)
    .findOne({ mpId: parseInt(_mpId) });
};

export const GetHistoryDetailsForDateRange = async (
  startDate: any,
  endDate: any,
  counter: any,
) => {
  const dbo = await getMongoDb();
  const query = {
    $and: [
      { mpId: { $gte: 1 } },
      { "historicalLogs.refTime": { $gte: new Date(startDate) } },
      { "historicalLogs.refTime": { $lte: new Date(endDate) } },
    ],
  };

  const result = await dbo
    .collection(applicationConfig.HISTORY_DB)
    .find(query)
    .sort({ $natural: -1 })
    .skip((parseInt(counter) - 1) * applicationConfig.HISTORY_LIMIT)
    .limit(applicationConfig.HISTORY_LIMIT)
    .toArray();
  for (let doc of result) {
    if (doc.historicalLogs) {
      doc.historicalLogs = await FilterHistoryData(
        doc.historicalLogs,
        startDate,
        endDate,
      );
    }
  }
  return result;
};

export const GetHistoryDetailsForIdByDate = async (
  _mpId: any,
  startDate: any,
  endDate: any,
) => {
  const dbo = await getMongoDb();
  const query = {
    $and: [
      { mpId: _mpId },
      { "historicalLogs.refTime": { $gte: new Date(startDate) } },
      { "historicalLogs.refTime": { $lte: new Date(endDate) } },
    ],
  };
  const mongoResult = await dbo
    .collection(applicationConfig.HISTORY_DB)
    .findOne(query);
  if (mongoResult && mongoResult.historicalLogs) {
    mongoResult.historicalLogs = await FilterHistoryData(
      mongoResult.historicalLogs,
      startDate,
      endDate,
    );
  }
  return mongoResult;
};

export const GetTotalHistoryCount = async () => {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.HISTORY_DB).countDocuments();
};

export const InitExportStatus = async (payload: any) => {
  const dbo = await getMongoDb();
  const { insertedId } = await dbo
    .collection(applicationConfig.EXPORT_STATUS)
    .insertOne(payload);
  return insertedId.toString();
};

export const UpdateExportStatusV2 = async (payload: any) => {
  const dbo = await getMongoDb();
  return dbo.collection(applicationConfig.EXPORT_STATUS).findOneAndUpdate(
    { fileName: payload.fileName },
    {
      $set: {
        status: payload.status,
        updatedTime: new Date(),
      },
    },
  );
};

export const GetExportFileStatus = async (_fileName: any) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.EXPORT_STATUS)
    .findOne({ fileName: _fileName });
};

export const GetExportFileNamesByStatus = async (_fileStatus: any) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.EXPORT_STATUS!)
    .find({ status: _fileStatus })
    .toArray();
};

export const Get422ProductDetailsByType = async (_type: any) => {
  const dbo = await getMongoDb();
  let query = {
    $and: [
      {
        active: true,
      },
      {
        insertReason: _type,
      },
    ],
  };
  return dbo
    .collection(applicationConfig.ERROR_ITEM_COLLECTION!)
    .find(query)
    .toArray();
};

export const GetEnvValueByKey = async (keyName: any) => {
  const dbo = await getMongoDb();
  const mongoResult = await dbo
    .collection(applicationConfig.ENV_SETTINGS!)
    .findOne();
  if (mongoResult) {
    switch (keyName) {
      case "SOURCE":
        return mongoResult.source;
      case "DELAY":
        return mongoResult.delay;
      case "OWN_VENDOR_ID":
        return mongoResult.ownVendorId;
      case "SISTER_VENDORS":
        return mongoResult.excludedSisterVendors;
      case "FRONTIER_API_KEY":
        return mongoResult.FrontierApiKey;
      case "DEV_SYNC_API_KEY":
        return mongoResult.DevIntegrationKey;
      default:
        throw new Error(`Invalid key name: ${keyName}`);
    }
  }
};

export const InsertOrUpdateProduct = async (payload: any, req: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.PRODUCT_COLLECTION!)
    .findOne({ mpId: payload.mpId });
  if (mongoResult) {
    if (payload.tradentDetails) {
      payload.tradentDetails.AuditInfo = await SessionHelper.GetAuditInfo(req);
      mongoResult = await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: payload.mpId },
          {
            $set: {
              tradentDetails: payload.tradentDetails,
            },
          },
        );
    }
    if (payload.frontierDetails) {
      payload.frontierDetails.AuditInfo = await SessionHelper.GetAuditInfo(req);
      mongoResult = await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: payload.mpId },
          {
            $set: {
              frontierDetails: payload.frontierDetails,
            },
          },
        );
    }

    if (payload.mvpDetails) {
      payload.mvpDetails.AuditInfo = await SessionHelper.GetAuditInfo(req);
      mongoResult = await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: payload.mpId },
          {
            $set: {
              mvpDetails: payload.mvpDetails,
            },
          },
        );
    }
  } else {
    mongoResult = await dbo
      .collection(applicationConfig.PRODUCT_COLLECTION!)
      .insertOne(payload);
  }
  return mongoResult;
};

export const GetAllProductDetails = async () => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.PRODUCT_COLLECTION!)
    .find()
    .sort({ _id: -1 })
    .toArray();
};

export const GetAllProductDetailsV2 = async (
  query: any,
  pageNumber: any,
  pageSize: any,
) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.PRODUCT_COLLECTION!)
    .find(query)
    .skip(pageNumber * pageSize)
    .sort({ _id: -1 })
    .limit(pageSize)
    .toArray();
};

export const GetProductCount = async (query: any) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.PRODUCT_COLLECTION!)
    .countDocuments(query);
};

export const FindProductById = async (mpid: any) => {
  const dbo = await getMongoDb();
  return dbo
    .collection(applicationConfig.PRODUCT_COLLECTION!)
    .find({ mpId: mpid })
    .toArray();
};

export const InsertOrUpdateProductWithCronName = async (
  payload: any,
  req: any,
) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  let productDetails = await dbo
    .collection(applicationConfig.PRODUCT_COLLECTION!)
    .findOne({ mpId: payload.mpId });
  let _tradentUpdated = false;
  let _frontUpdated = false;
  let _mvpDetails = false;
  if (productDetails) {
    if (payload.tradentDetails) {
      _tradentUpdated = true;
      payload.tradentDetails.AuditInfo = await SessionHelper.GetAuditInfo(req);
      mongoResult = await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: payload.mpId },
          {
            $set:
              productDetails.tradentDetails != null
                ? setSelectiveDetails(payload.tradentDetails, "tradentDetails")
                : { tradentDetails: payload.tradentDetails },
          },
        );
    }

    if (payload.frontierDetails) {
      _frontUpdated = true;
      payload.frontierDetails.AuditInfo = await SessionHelper.GetAuditInfo(req);
      mongoResult = await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: payload.mpId },
          {
            $set:
              productDetails.frontierDetails != null
                ? setSelectiveDetails(
                    payload.frontierDetails,
                    "frontierDetails",
                  )
                : { frontierDetails: payload.frontierDetails },
          },
        );
    }
    if (payload.mvpDetails) {
      _mvpDetails = true;
      payload.mvpDetails.AuditInfo = await SessionHelper.GetAuditInfo(req);
      mongoResult = await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: payload.mpId },
          {
            $set:
              productDetails.mvpDetails != null
                ? setSelectiveDetails(payload.mvpDetails, "mvpDetails")
                : { mvpDetails: payload.mvpDetails },
          },
        );
    }

    // Update Cron If Present *** no longer needed as Crons are aligned with DB details before only
    // if (_tradentUpdated == false && productDetails.tradentDetails) {
    //     mongoResult = await dbo.collection(applicationConfig.PRODUCT_COLLECTION).findOneAndUpdate(
    //         { mpId: payload.mpId },
    //         {
    //             $set:
    //             {
    //                 "tradentDetails.cronName": contextCronName,
    //                 "tradentDetails.cronId": contextCronId,
    //                 "tradentDetails.AuditInfo": await SessionHelper.GetAuditInfo(req)
    //             }
    //         });
    // }
    // if (_frontUpdated == false && productDetails.frontierDetails) {
    //     mongoResult = await dbo.collection(applicationConfig.PRODUCT_COLLECTION).findOneAndUpdate(
    //         { mpId: payload.mpId },
    //         {
    //             $set:
    //             {
    //                 "frontierDetails.cronName": contextCronName,
    //                 "frontierDetails.cronId": contextCronId,
    //                 "frontierDetails.AuditInfo": await SessionHelper.GetAuditInfo(req)
    //             }
    //         });
    // }
    // if (_mvpDetails == false && productDetails.mvpDetails) {
    //     mongoResult = await dbo.collection(applicationConfig.PRODUCT_COLLECTION).findOneAndUpdate(
    //         { mpId: payload.mpId },
    //         {
    //             $set:
    //             {
    //                 "mvpDetails.cronName": contextCronName,
    //                 "mvpDetails.cronId": contextCronId,
    //                 "mvpDetails.AuditInfo": await SessionHelper.GetAuditInfo(req)
    //             }
    //         });
    // }
  } else {
    mongoResult = await dbo
      .collection(applicationConfig.PRODUCT_COLLECTION!)
      .insertOne(payload);
  }
  return mongoResult;
};

const setSelectiveDetails = (details: any, prefix: any) => {
  let setObj: any = {};
  for (const key in details) {
    if (details[key]) {
      setObj[`${prefix}.${key}`] = details[key];
    }
  }
  return setObj;
};

function FilterHistoryData(historyData: any, startDate: any, endDate: any) {
  let tempLogs = _.cloneDeep(historyData);
  tempLogs = _.remove(tempLogs, ($) => {
    return $.refTime < new Date(endDate);
  });
  tempLogs = _.remove(tempLogs, ($) => {
    return $.refTime > new Date(startDate);
  });
  return tempLogs;
}

export const ActivateProductModel = async (mpid: any, req: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.PRODUCT_COLLECTION!)
    .findOne({ mpId: mpid });
  if (mongoResult) {
    if (mongoResult.tradentDetails) {
      await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: mpid },
          {
            $set: {
              "tradentDetails.activated": true,
              "tradentDetails.AuditInfo": await SessionHelper.GetAuditInfo(req),
            },
          },
        );
    }
    if (mongoResult.frontierDetails) {
      await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: mpid },
          {
            $set: {
              "frontierDetails.activated": true,
              "frontierDetails.AuditInfo":
                await SessionHelper.GetAuditInfo(req),
            },
          },
        );
    }
    if (mongoResult.mvpDetails) {
      await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: mpid },
          {
            $set: {
              "mvpDetails.activated": true,
              "mvpDetails.AuditInfo": await SessionHelper.GetAuditInfo(req),
            },
          },
        );
    }
  }
  return mongoResult;
};

export const DeactivateProductModel = async (mpid: any, req: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.PRODUCT_COLLECTION!)
    .findOne({ mpId: mpid });
  if (mongoResult) {
    if (mongoResult.tradentDetails) {
      await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: mpid },
          {
            $set: {
              "tradentDetails.activated": false,
              "tradentDetails.AuditInfo": await SessionHelper.GetAuditInfo(req),
            },
          },
        );
    }
    if (mongoResult.frontierDetails) {
      await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: mpid },
          {
            $set: {
              "frontierDetails.activated": false,
              "frontierDetails.AuditInfo":
                await SessionHelper.GetAuditInfo(req),
            },
          },
        );
    }
    if (mongoResult.mvpDetails) {
      await dbo
        .collection(applicationConfig.PRODUCT_COLLECTION!)
        .findOneAndUpdate(
          { mpId: mpid },
          {
            $set: {
              "mvpDetails.activated": false,
              "mvpDetails.AuditInfo": await SessionHelper.GetAuditInfo(req),
            },
          },
        );
    }
  }
  return mongoResult;
};
export const GetDefaultUserLogin = async () => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.USERS_COLLECTION!)
    .findOne({});
  return mongoResult;
};

export const UpdateExecutionPriority = async (
  mpid: any,
  id: any,
  value: any,
  req: any,
) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  if (id == 0) {
    await dbo
      .collection(applicationConfig.PRODUCT_COLLECTION!)
      .findOneAndUpdate(
        { mpId: mpid },
        {
          $set: {
            "tradentDetails.executionPriority": value,
            "tradentDetails.AuditInfo": await SessionHelper.GetAuditInfo(req),
          },
        },
      );
  }
  if (id == 1) {
    await dbo
      .collection(applicationConfig.PRODUCT_COLLECTION!)
      .findOneAndUpdate(
        { mpId: mpid },
        {
          $set: {
            "frontierDetails.executionPriority": value,
            "frontierDetails.AuditInfo": await SessionHelper.GetAuditInfo(req),
          },
        },
      );
  }
  if (id == 2) {
    await dbo
      .collection(applicationConfig.PRODUCT_COLLECTION!)
      .findOneAndUpdate(
        { mpId: mpid },
        {
          $set: {
            "mvpDetails.executionPriority": value,
            "mvpDetails.AuditInfo": await SessionHelper.GetAuditInfo(req),
          },
        },
      );
  }
  return mongoResult;
};

export async function GetEnvSettings() {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const envSettingsResult = await cacheClient.get(CacheKey.ENV_SETTINGS);
  if (envSettingsResult != null) return envSettingsResult;
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo.collection(applicationConfig.ENV_SETTINGS!).findOne();
  if (mongoResult != null)
    await cacheClient.set(CacheKey.ENV_SETTINGS, mongoResult);

  return mongoResult;
}

export const UpsertEnvSettings = async (payload: any) => {
  let mongoResult: any = null;
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.ENV_SETTINGS!)
    .findOneAndUpdate({}, payload);
  await cacheClient.delete(CacheKey.ENV_SETTINGS);

  return mongoResult;
};

export const GetLogsBasedOnQuery = async (query: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.GET_CRON_LOGS_COLLECTION_NAME!)
    .find(query)
    .toArray();
  return mongoResult;
};

export const GetFilteredCrons = async () => {
  let mongoResult: any = null;
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const filterCronDetails = await cacheClient.get(CacheKey.FILTER_CRON_DETAILS);
  if (filterCronDetails != null) return filterCronDetails;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.FILTER_CRON_COLLECTION_NAME!)
    .find()
    .toArray();
  if (mongoResult != null)
    await cacheClient.set(CacheKey.FILTER_CRON_DETAILS, mongoResult);

  return mongoResult;
};

export const UpdateFilterCronDetails = async (cronId: any, payload: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.FILTER_CRON_COLLECTION_NAME!)
    .findOneAndUpdate({ cronId: cronId }, payload);
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.FILTER_CRON_DETAILS);

  return mongoResult;
};

export const UpdateSlowCronDetails = async (cronId: any, payload: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SLOW_CRON_GROUP_COLLECTION_NAME!)
    .findOneAndUpdate({ CronId: cronId }, payload);
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.SLOW_CRON_DETAILS);
  return mongoResult;
};

export const GetSlowCronDetails = async () => {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const slowCronDetails = await cacheClient.get(CacheKey.SLOW_CRON_DETAILS);
  if (slowCronDetails != null) return slowCronDetails;
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SLOW_CRON_GROUP_COLLECTION_NAME!)
    .find()
    .toArray();
  if (mongoResult != null)
    await cacheClient.set(CacheKey.SLOW_CRON_DETAILS, mongoResult);
  return mongoResult;
};

export const updateSlowCron = async (payload: any, req: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();

  for (const element of payload) {
    mongoResult = await dbo
      .collection(applicationConfig.SLOW_CRON_GROUP_COLLECTION_NAME!)
      .findOneAndUpdate(
        { CronId: element.CronId },
        {
          $set: {
            CronName: element.CronName,
            CronTime: element.CronTime,
            CronTimeUnit: element.CronTimeUnit,
            Offset: element.Offset,
            ProxyProvider: element.ProxyProvider,
            UpdatedTime: element.UpdatedTime,
            AlternateProxyProvider: element.AlternateProxyProvider,
            AuditInfo: await SessionHelper.GetAuditInfo(req),
          },
        },
      );
  }
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.SLOW_CRON_DETAILS);
  return mongoResult;
};

export const GetFilterCronLogsByLimit = async (_limit: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.FILTER_CRON_LOGS!)
    .find()
    .limit(_limit)
    .sort({ $natural: -1 })
    .toArray();
  return mongoResult;
};

export const GetFilterCronLogByKey = async (key: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.FILTER_CRON_LOGS!)
    .findOne({ cronKey: key });
  return mongoResult;
};

export const GetProductListByQuery = async (query: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.PRODUCT_COLLECTION!)
    .find(query)
    .toArray();
  return mongoResult;
};

export const InsertOrUpdateProductWithQuery = async (mpid: any, query: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.PRODUCT_COLLECTION!)
    .findOneAndUpdate({ mpId: mpid }, query);
  return mongoResult;
};

export const GetProxyFailureDetails = async () => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.PROXY_FAILURE_COLLECTION!)
    .find()
    .toArray();
  return mongoResult;
};

export const InsertUserLogin = async (userDetails: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.USERS_COLLECTION!)
    .insertOne(userDetails);
  return mongoResult;
};

export const UpdateUserPassword = async (_userName: any, newPassword: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.USERS_COLLECTION!)
    .findOneAndUpdate(
      { userName: _userName },
      { $set: { userPassword: newPassword } },
    );
  return mongoResult;
};

export const UpdateProxyProviderThresholdValue = async (
  payload: any,
  req: any,
) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.PROXY_FAILURE_COLLECTION!)
    .findOneAndUpdate(
      { proxyProvider: parseInt(payload.proxyProvider) },
      {
        $set: {
          thresholdCount: parseInt(payload.value),
          AuditInfo: await SessionHelper.GetAuditInfo(req),
        },
      },
    );
  return mongoResult;
};

export const InsertOrUpdateScrapeOnlyProduct = async (payload: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION!)
    .insertOne(payload);
  return mongoResult;
};

export const GetScrapeCrons = async () => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_CRON_SETTINGS_COLLECTION_NAME!)
    .find()
    .toArray();
  return mongoResult;
};

export const UpdateScrapeCronDetails = async (cronId: any, payload: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_CRON_SETTINGS_COLLECTION_NAME!)
    .findOneAndUpdate({ CronId: cronId }, payload);
  return mongoResult;
};

export const updateScrapeCron = async (payload: any, req: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();

  for (const element of payload) {
    mongoResult = await dbo
      .collection(applicationConfig.SCRAPE_CRON_SETTINGS_COLLECTION_NAME!)
      .findOneAndUpdate(
        { CronId: element.CronId },
        {
          $set: {
            CronName: element.CronName,
            CronTime: element.CronTime,
            CronTimeUnit: element.CronTimeUnit,
            Offset: element.Offset,
            ProxyProvider: element.ProxyProvider,
            UpdatedTime: element.UpdatedTime,
            AlternateProxyProvider: element.AlternateProxyProvider,
            AuditInfo: await SessionHelper.GetAuditInfo(req),
          },
        },
      );
  }
  return mongoResult;
};

export const GetScrapeProducts = async (
  query: any,
  pageNumber: any,
  pageSize: any,
) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION!)
    .find(query)
    .skip(pageNumber * pageSize)
    .sort({ _id: -1 })
    .limit(pageSize)
    .toArray();
  return mongoResult;
};

export const GetScrapeProductCount = async (query: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION!)
    .countDocuments(query);
  return mongoResult;
};

export const deleteScrapeProductById = async (Id: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION!)
    .deleteOne({ mpId: Id });
  return mongoResult;
};

export const GetAllScrapeProductDetails = async () => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION!)
    .find()
    .sort({ _id: -1 })
    .toArray();
  return mongoResult;
};

export const InsertOrUpdateScrapeProduct = async (payload: any, req: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  let existResult = await dbo
    .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION!)
    .findOne({ mpId: payload.mpId });
  if (existResult) {
    mongoResult = await dbo
      .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION!)
      .findOneAndUpdate(
        { mpId: payload.mpId },
        {
          $set: {
            isActive: payload.isActive,
            net32Url: payload.net32Url,
            linkedCron: payload.linkedCron,
            linkedCronId: payload.linkedCronId,
            AuditInfo: await SessionHelper.GetAuditInfo(req),
          },
        },
      );
  } else {
    payload.AuditInfo = await SessionHelper.GetAuditInfo(req);
    mongoResult = await dbo
      .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION!)
      .insertOne(payload);
  }

  return mongoResult;
};

export const GetScrapeLogs = async (pageNumber: any, pageSize: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_LOGS_COLLECTION!)
    .find()
    .skip(pageNumber * pageSize)
    .sort({ _id: -1 })
    .limit(pageSize)
    .toArray();
  return mongoResult;
};

export const GetScrapeLogsCount = async () => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_LOGS_COLLECTION!)
    .countDocuments();
  return mongoResult;
};

export const FindScrapeProductById = async (mpid: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_ITEMS_COLLECTION!)
    .find({ mpId: mpid })
    .toArray();
  return mongoResult;
};

export const GetScrapeLogsList = async (id: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.SCRAPE_LOGS_COLLECTION!)
    .find({ _id: new ObjectId(id) })
    .toArray();
  return mongoResult;
};

export const IgnoreCronStatusLog = async (_cronId: any, _keygen: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  mongoResult = await dbo
    .collection(applicationConfig.CRON_STATUS_COLLECTION_NAME!)
    .findOneAndUpdate(
      { $and: [{ keyGenId: _keygen }, { cronId: _cronId }] },
      {
        $set: {
          status: "IGNORE",
        },
      },
    );
  return mongoResult;
};

async function getContextDetails(payload: any, key: any) {
  if (payload.tradentDetails) {
    return payload.tradentDetails[key];
  }
  if (payload.frontierDetails) {
    return payload.frontierDetails[key];
  }
  if (payload.mvpDetails) {
    return payload.mvpDetails[key];
  }
}

export const Update422StatusById = async (_mpId: any, isBulk: any) => {
  let mongoResult: any = null;
  const dbo = await getMongoDb();
  if (isBulk == false) {
    mongoResult = await dbo
      .collection(applicationConfig.ERROR_ITEM_COLLECTION!)
      .updateMany({ mpId: _mpId }, { $set: { active: false } });
  } else {
    mongoResult = await dbo
      .collection(applicationConfig.ERROR_ITEM_COLLECTION!)
      .updateMany({}, { $set: { active: false } });
  }

  return mongoResult;
};

export const GetCronsByProxyProvider = async (proxyProviderId: any) => {
  let result: any = {
    regularCrons: [],
    slowCrons: [],
    scrapeCrons: [],
    error422Crons: [],
  };

  const dbo = await getMongoDb();
  const providerId = parseInt(proxyProviderId);

  const [regularCrons, slowCrons, scrapeCrons] = await Promise.all([
    dbo
      .collection(applicationConfig.CRON_SETTINGS_COLLECTION_NAME!)
      .find({
        $or: [
          { ProxyProvider: providerId },
          { "AlternateProxyProvider.ProxyProvider": providerId },
        ],
      })
      .toArray(),

    dbo
      .collection(applicationConfig.SLOW_CRON_GROUP_COLLECTION_NAME!)
      .find({
        $or: [
          { ProxyProvider: providerId },
          { "AlternateProxyProvider.proxyProvider": providerId },
        ],
      })
      .toArray(),

    dbo
      .collection(applicationConfig.SCRAPE_CRON_SETTINGS_COLLECTION_NAME!)
      .find({
        $or: [
          { ProxyProvider: providerId },
          { "AlternateProxyProvider.proxyProvider": providerId },
        ],
      })
      .toArray(),
  ]);

  for (let cron of regularCrons) {
    if (cron.IsHidden === true) {
      result.error422Crons.push(cron.CronName);
    } else {
      result.regularCrons.push(cron.CronName);
    }
  }

  for (let cron of slowCrons) result.slowCrons.push(cron.CronName);
  for (let cron of scrapeCrons) result.scrapeCrons.push(cron.CronName);
  return result;
};
