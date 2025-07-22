const mongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectId;
const _ = require("lodash");
const cacheHelper = require("../Utility/CacheHelper");
const cacheKeyEnum = require("../resources/cacheKeyName.json");
const SessionHelper = require("../Utility/SessionHelper");

module.exports.GetCronLogsV2 = async (pgNo, type, cronId, date, pgLimit) => {
  let query = {};

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
  let mongoResult = null,
    pageSize = 0,
    pageNumber = 0,
    totalDocs = 0,
    totalPages = 0;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    pageSize = parseInt(pgLimit) || parseInt(process.env.CRON_PAGESIZE);
    pageNumber = parseInt(pgNo) || 0;

    if (type && type == "422Error") {
      totalDocs = await dbo
        .collection(process.env.ERROR_422_CRON_LOGS)
        .countDocuments({ cronId: "DUMMY-422-Error" });
    } else if (type && type == "All") {
      totalDocs = await dbo
        .collection(process.env.ERROR_422_CRON_LOGS)
        .countDocuments({ cronId: "DUMMY-422-Error" });
      totalDocs =
        totalDocs +
        (await dbo
          .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
          .estimatedDocumentCount());
    } else {
      totalDocs = await dbo
        .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
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
        .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
        .aggregate(pipeline)
        .toArray();
    } else {
      mongoResult = [];
    }

    //422 Cron Logs
    if (type && (type == "422Error" || type == "All")) {
      let queryForFilter = {
        $and: [{ cronId: "DUMMY-422-Error" }, { type: "422Error" }],
      };
      if (query["time"]) {
        queryForFilter = {
          $and: [
            { cronId: "DUMMY-422-Error" },
            { type: "422Error" },
            { time: query["time"] },
          ],
        };
      }
      const _errorCronLogs = await dbo
        .collection(process.env.ERROR_422_CRON_LOGS)
        .find(queryForFilter)
        .sort({ time: -1 })
        .skip(pageNumber * pageSize)
        .limit(pageSize)
        .toArray();
      mongoResult = _.concat(mongoResult, _errorCronLogs);
    }

    //ALL Other Logs
    if (type && type == "ALL_EXCEPT_422") {
      let queryToSearch = {
        time: query["time"],
      };
      if (cronId != "") {
        queryToSearch = {
          $and: [{ time: query["time"] }, { cronId: cronId }],
        };
      }
      mongoResult = await dbo
        .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
        .find(queryToSearch)
        .sort({ time: -1 })
        .skip(pageNumber * pageSize)
        .limit(pageSize)
        .toArray();
    }

    dbConnection.close();
  } catch (exception) {
    console.log("fetch cron logs history", exception);
  }

  return { mongoResult, pageNumber, pageSize, totalDocs, totalPages };
};

module.exports.GetCronLogs = async (pgNo, type, cronId, date) => {
  let query = {};
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
  let mongoResult = null,
    pageSize = 0,
    pageNumber = 0,
    totalDocs = 0,
    totalPages = 0;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);

    pageSize = parseInt(process.env.CRON_PAGESIZE);
    pageNumber = pgNo || 0;
    totalDocs = await dbo
      .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
      .countDocuments(query);
    totalPages = Math.ceil(totalDocs / pageSize);
    // mongoResult = await dbo.collection(process.env.GET_CRON_LOGS_COLLECTION_NAME).find(query).sort({ $natural: -1 }).skip(pageNumber * pageSize).limit(pageSize).toArray();
    if (pgNo !== undefined) {
      mongoResult = await dbo
        .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
        .find(query)
        .sort({ $natural: -1 })
        .skip(pageNumber * pageSize)
        .limit(pageSize)
        .toArray();
    } else {
      mongoResult = await dbo
        .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
        .find(query)
        .sort({ $natural: -1 })
        .toArray();
    }
    dbConnection.close();
  } catch (exception) {}
  return { mongoResult, pageNumber, pageSize, totalDocs, totalPages };
};

module.exports.GetUserLogin = async (query) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.USERS_COLLECTION)
      .findOne(query);
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetItemList = async (mpId) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);

    const query = { mpid: mpId };
    mongoResult = await dbo
      .collection(process.env.ITEMS_COLLECTION_NAME)
      .find(query)
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpdateCronLogPostPriceUpdate = async (req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
      .findOneAndUpdate(
        { _id: req._id },
        {
          $set: {
            logs: req.logs,
          },
        },
      );
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetLogsById = async (id) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    const query = { _id: ObjectID(id) };
    mongoResult = await dbo
      .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
      .find(query)
      .toArray();
    if (mongoResult && mongoResult.length == 0) {
      mongoResult = await dbo
        .collection(process.env.ERROR_422_CRON_LOGS)
        .find(query)
        .toArray();
    }
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.FindOneProductModel = async (query) => {
  let product = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    const dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);

    // Fetch the document that matches the provided query
    product = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .findOne(query);

    dbConnection.close();
  } catch (exception) {
    console.log("Error in FindOneProductModel:", exception);
    throw exception;
  }
  return product;
};

module.exports.GetLatestCronStatus = async () => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    const query = { status: "In-Progress" };
    mongoResult = await dbo
      .collection(process.env.CRON_STATUS_COLLECTION_NAME)
      .find(query)
      .sort({ _id: -1 })
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.PushManualCronLogAsync = async (payload) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
      .insertOne(payload);
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetCronSettingsList = async () => {
  let mongoResult = null;
  cacheHelper.DeleteCacheByKey(cacheKeyEnum.PRIMARY_CRON_SETTINGS_LIST);
  const cacheKey = cacheKeyEnum.PRIMARY_CRON_SETTINGS_LIST;
  try {
    if ((await cacheHelper.Has(cacheKey)) == true) {
      mongoResult = await cacheHelper.Get(cacheKey);
    } else {
      const dbConnection = await mongoClient.connect(
        process.env.MANAGED_MONGO_URL,
      );
      let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
      mongoResult = await dbo
        .collection(process.env.CRON_SETTINGS_COLLECTION_NAME)
        .find()
        .toArray();
      dbConnection.close();
      cacheHelper.Set(cacheKey, mongoResult);
    }
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpdateCronSettingsList = async (payload, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    for (const element of payload) {
      mongoResult = await dbo
        .collection(process.env.CRON_SETTINGS_COLLECTION_NAME)
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
    dbConnection.close();
    cacheHelper.DeleteCacheByKey(cacheKeyEnum.PRIMARY_CRON_SETTINGS_LIST);
    cacheHelper.DeleteExternalCache(cacheKeyEnum.EXTERNAL_CRON_SETTINGS_LIST);
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.InsertCronSettings = async (payload) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.CRON_SETTINGS_COLLECTION_NAME)
      .insertOne(payload);
    dbConnection.close();
    cacheHelper.DeleteCacheByKey(cacheKeyEnum.PRIMARY_CRON_SETTINGS_LIST);
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.ToggleCronStatus = async (cronId, cronStatus, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.CRON_SETTINGS_COLLECTION_NAME)
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
    dbConnection.close();
    cacheHelper.DeleteCacheByKey(cacheKeyEnum.PRIMARY_CRON_SETTINGS_LIST);
    cacheHelper.DeleteExternalCache(cacheKeyEnum.EXTERNAL_CRON_SETTINGS_LIST);
  } catch (exception) {}
  return mongoResult;
};

module.exports.PurgeCronBasedOnId = async (cronId) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.DATA_SOURCE == "CMS"
        ? process.env.MANAGED_MONGO_URL
        : process.env.DATABASE_URL,
    );
    // const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
      .deleteMany({ cronId: cronId });
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.PurgeCronBasedOnDate = async (dateString) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.DATA_SOURCE == "CMS"
        ? process.env.MANAGED_MONGO_URL
        : process.env.DATABASE_URL,
    );
    // const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
      .deleteMany({
        time: {
          $lte: new Date(dateString),
        },
      });
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.deleteById = async (Id) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.DATA_SOURCE == "CMS"
        ? process.env.MANAGED_MONGO_URL
        : process.env.DATABASE_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .deleteOne({ mpId: Id });
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.CheckInProgressExport = async () => {
  let mongoResult = null;
  try {
    let query = { status: "In Progress" };
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo.collection("exports").find(query).toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.FetchQueuedExport = async () => {
  let mongoResult = null;
  try {
    let query = { $or: [{ status: "Queued" }, { status: "Batched" }] };
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo.collection("exports").findOne(query);
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpdateExportStatus = async (id, status, info = {}) => {
  let mongoResult = null;
  let set = info;
  set.status = status;
  try {
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo.collection("exports").findOneAndUpdate(
      { _id: id },
      {
        $set: set,
      },
    );
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.FetchExports = async () => {
  let mongoResult = null;
  try {
    let query = {};
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo.collection("exports").find(query).toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.Get422ProductCountByType = async (_type) => {
  let mongoResult = null;
  try {
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
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.ERROR_ITEM_COLLECTION)
      .countDocuments(query);
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetContextErrorItemsCount = async (_activeStatus) => {
  var result = null;
  try {
    const query = {
      nextCronTime: {
        $lte: new Date(),
        //$gte: new Date()
      },
      active: _activeStatus,
    };
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    result = await dbo
      .collection(process.env.ERROR_ITEM_COLLECTION)
      .countDocuments(query);
    dbConnection.close();
  } catch (exception) {}
  return result;
};

module.exports.GetConfigurations = async (activeOnly = true) => {
  let mongoResult = null;

  try {
    const dbConnection = await mongoClient.connect(
      process.env.DATA_SOURCE == "CMS"
        ? process.env.MANAGED_MONGO_URL
        : process.env.DATABASE_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    const query = activeOnly ? { active: true } : {};
    mongoResult = await dbo
      .collection(process.env.IP_CONFIG)
      .find(query)
      .toArray();
    dbConnection.close();
  } catch (exception) {}

  return mongoResult;
};

module.exports.UpdateConfiguration = async (payload, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.DATA_SOURCE == "CMS"
        ? process.env.MANAGED_MONGO_URL
        : process.env.DATABASE_URL,
    );
    // const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    for (const element of payload) {
      mongoResult = await dbo
        .collection(process.env.IP_CONFIG)
        .findOneAndUpdate(
          { proxyProvider: element.proxyProvider, ipType: element.ipType },
          {
            $set: {
              userName: element.userName,
              password: element.password,
              hostUrl: element.hostUrl,
              port: parseInt(element.port),
              active: element.active,
              //"proxyPriority": parseInt(element.proxyPriority),
              AuditInfo: await SessionHelper.GetAuditInfo(req),
            },
          },
        );
      cacheHelper.DeleteExternalCache(
        `${cacheKeyEnum.EXTERNAL_PROXY_CONFIG_BY_PROVIDER_ID}_${parseInt(element.proxyProvider)}`,
      );
    }
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetHistoryDetailsForId = async (_mpId) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.HISTORY_DB)
      .findOne({ mpId: parseInt(_mpId) });
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetHistoryDetailsForDateRange = async (
  startDate,
  endDate,
  counter,
) => {
  let mongoResult = null;
  try {
    const query = {
      $and: [
        { mpId: { $gte: 1 } },
        { "historicalLogs.refTime": { $gte: new Date(startDate) } },
        { "historicalLogs.refTime": { $lte: new Date(endDate) } },
      ],
    };
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    const totalDocCount = await dbo
      .collection(process.env.HISTORY_DB)
      .countDocuments();

    mongoResult = await dbo
      .collection(process.env.HISTORY_DB)
      .find(query)
      .sort({ $natural: -1 })
      .skip((parseInt(counter) - 1) * parseInt(process.env.HISTORY_LIMIT))
      .limit(parseInt(process.env.HISTORY_LIMIT))
      .toArray();
    dbConnection.close();
    for (let doc of mongoResult) {
      if (doc.historicalLogs) {
        doc.historicalLogs = await FilterHistoryData(
          doc.historicalLogs,
          startDate,
          endDate,
        );
      }
    }
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetHistoryDetailsForIdByDate = async (
  _mpId,
  startDate,
  endDate,
) => {
  let mongoResult = null;
  try {
    const query = {
      $and: [
        { mpId: _mpId },
        { "historicalLogs.refTime": { $gte: new Date(startDate) } },
        { "historicalLogs.refTime": { $lte: new Date(endDate) } },
      ],
    };
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo.collection(process.env.HISTORY_DB).findOne(query);
    dbConnection.close();
    if (mongoResult && mongoResult.historicalLogs) {
      mongoResult.historicalLogs = await FilterHistoryData(
        mongoResult.historicalLogs,
        startDate,
        endDate,
      );
    }
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetTotalHistoryCount = async () => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(process.env.DATABASE_URL);
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo.collection(process.env.HISTORY_DB).countDocuments();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.InitExportStatus = async (payload) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.EXPORT_STATUS)
      .insertOne(payload);
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpdateExportStatusV2 = async (payload) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.EXPORT_STATUS)
      .findOneAndUpdate(
        { fileName: payload.fileName },
        {
          $set: {
            status: payload.status,
            updatedTime: new Date(),
          },
        },
      );
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetExportFileStatus = async (_fileName) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.EXPORT_STATUS)
      .findOne({ fileName: _fileName });
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetExportFileNamesByStatus = async (_fileStatus) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.EXPORT_STATUS)
      .find({ status: _fileStatus })
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.Get422ProductDetailsByType = async (_type) => {
  let mongoResult = null;
  try {
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
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.ERROR_ITEM_COLLECTION)
      .find(query)
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetEnvValueByKey = async (keyName) => {
  let mongoResult = null;
  let evalValue = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo.collection(process.env.ENV_SETTINGS).findOne();
    dbConnection.close();
  } catch (exception) {}
  if (mongoResult) {
    switch (keyName) {
      case "SOURCE":
        evalValue = mongoResult.source;
        break;
      case "DELAY":
        evalValue = mongoResult.delay;
        break;
      case "OWN_VENDOR_ID":
        evalValue = mongoResult.ownVendorId;
        break;
      case "SISTER_VENDORS":
        evalValue = mongoResult.excludedSisterVendors;
        break;
      case "FRONTIER_API_KEY":
        evalValue = mongoResult.FrontierApiKey;
        break;
      case "DEV_SYNC_API_KEY":
        evalValue = mongoResult.DevIntegrationKey;
        break;
      default:
        break;
    }
  }
  return evalValue;
};

module.exports.InsertOrUpdateProduct = async (payload, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .findOne({ mpId: payload.mpId });
    if (mongoResult) {
      if (payload.tradentDetails) {
        payload.tradentDetails.AuditInfo =
          await SessionHelper.GetAuditInfo(req);
        mongoResult = await dbo
          .collection(process.env.PRODUCT_COLLECTION)
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
        payload.frontierDetails.AuditInfo =
          await SessionHelper.GetAuditInfo(req);
        mongoResult = await dbo
          .collection(process.env.PRODUCT_COLLECTION)
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
          .collection(process.env.PRODUCT_COLLECTION)
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
        .collection(process.env.PRODUCT_COLLECTION)
        .insertOne(payload);
    }
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.GetAllProductDetails = async () => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.DATA_SOURCE == "CMS"
        ? process.env.MANAGED_MONGO_URL
        : process.env.DATABASE_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .find()
      .sort({ _id: -1 })
      .toArray();
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.GetAllProductDetailsV2 = async (query, pageNumber, pageSize) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.DATA_SOURCE == "CMS"
        ? process.env.MANAGED_MONGO_URL
        : process.env.DATABASE_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .find(query)
      .skip(pageNumber * pageSize)
      .sort({ _id: -1 })
      .limit(pageSize)
      .toArray();
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.GetProductCount = async (query) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.DATA_SOURCE == "CMS"
        ? process.env.MANAGED_MONGO_URL
        : process.env.DATABASE_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .countDocuments(query);
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.FindProductById = async (mpid) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.DATA_SOURCE == "CMS"
        ? process.env.MANAGED_MONGO_URL
        : process.env.DATABASE_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .find({ mpId: mpid })
      .toArray();
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.InsertOrUpdateProductWithCronName = async (payload, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    let productDetails = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .findOne({ mpId: payload.mpId });
    const contextCronName = await getContextDetails(payload, "cronName");
    const contextCronId = await getContextDetails(payload, "cronId");
    let _tradentUpdated = false;
    let _frontUpdated = false;
    let _mvpDetails = false;
    if (productDetails) {
      if (payload.tradentDetails) {
        _tradentUpdated = true;
        payload.tradentDetails.AuditInfo =
          await SessionHelper.GetAuditInfo(req);
        mongoResult = await dbo
          .collection(process.env.PRODUCT_COLLECTION)
          .findOneAndUpdate(
            { mpId: payload.mpId },
            {
              $set:
                productDetails.tradentDetails != null
                  ? setSelectiveDetails(
                      payload.tradentDetails,
                      "tradentDetails",
                    )
                  : { tradentDetails: payload.tradentDetails },
            },
          );
      }

      if (payload.frontierDetails) {
        _frontUpdated = true;
        payload.frontierDetails.AuditInfo =
          await SessionHelper.GetAuditInfo(req);
        mongoResult = await dbo
          .collection(process.env.PRODUCT_COLLECTION)
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
          .collection(process.env.PRODUCT_COLLECTION)
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
      //     mongoResult = await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
      //     mongoResult = await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
      //     mongoResult = await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
        .collection(process.env.PRODUCT_COLLECTION)
        .insertOne(payload);
    }
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

const setSelectiveDetails = (details, prefix) => {
  let setObj = {};
  for (const key in details) {
    if (details.hasOwnProperty(key)) {
      setObj[`${prefix}.${key}`] = details[key];
    }
  }
  return setObj;
};

async function FilterHistoryData(historyData, startDate, endDate) {
  let tempLogs = _.cloneDeep(historyData);
  tempLogs = _.remove(tempLogs, ($) => {
    return $.refTime < new Date(endDate);
  });
  tempLogs = _.remove(tempLogs, ($) => {
    return $.refTime > new Date(startDate);
  });
  return tempLogs;
}

module.exports.ActivateProductModel = async (mpid, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .findOne({ mpId: mpid });
    if (mongoResult) {
      if (mongoResult.tradentDetails) {
        await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
        await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
        await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.DeactivateProductModel = async (mpid, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .findOne({ mpId: mpid });
    if (mongoResult) {
      if (mongoResult.tradentDetails) {
        await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
        await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
        await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};
module.exports.GetDefaultUserLogin = async () => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.USERS_COLLECTION)
      .findOne({});
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpdateExecutionPriority = async (mpid, id, value, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    if (id == 0) {
      await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
      await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
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
      await dbo.collection(process.env.PRODUCT_COLLECTION).findOneAndUpdate(
        { mpId: mpid },
        {
          $set: {
            "mvpDetails.executionPriority": value,
            "mvpDetails.AuditInfo": await SessionHelper.GetAuditInfo(req),
          },
        },
      );
    }
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.GetEnvSettings = async () => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo.collection(process.env.ENV_SETTINGS).findOne();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpsertEnvSettings = async (payload) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.ENV_SETTINGS)
      .findOneAndUpdate({}, payload);
    dbConnection.close();
    cacheHelper.DeleteExternalCache(cacheKeyEnum.EXTERNAL_GLOBAL_INFO);
    cacheHelper.DeleteExternalCache(cacheKeyEnum.EXTERNAL_ENV_DELAY);
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetLogsBasedOnQuery = async (query) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.GET_CRON_LOGS_COLLECTION_NAME)
      .find(query)
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetFilteredCrons = async () => {
  let mongoResult = null;
  try {
    const cacheKey = cacheKeyEnum.FILTER_CRON_SETTINGS_LIST;
    if ((await cacheHelper.Has(cacheKey)) == true) {
      mongoResult = await cacheHelper.Get(cacheKey);
    } else {
      const dbConnection = await mongoClient.connect(
        process.env.MANAGED_MONGO_URL,
      );
      let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
      mongoResult = await dbo
        .collection(process.env.FILTER_CRON_COLLECTION_NAME)
        .find()
        .toArray();
      dbConnection.close();
      cacheHelper.Set(cacheKey, mongoResult);
    }
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpdateFilterCronDetails = async (cronId, payload) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.FILTER_CRON_COLLECTION_NAME)
      .findOneAndUpdate({ cronId: cronId }, payload);
    dbConnection.close();
    cacheHelper.DeleteCacheByKey(cacheKeyEnum.FILTER_CRON_SETTINGS_LIST);
    cacheHelper.DeleteExternalCache(cacheKeyEnum.EXTERNAL_FILTER_CRON_DETAILS);
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpdateSlowCronDetails = async (cronId, payload) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SLOW_CRON_GROUP_COLLECTION_NAME)
      .findOneAndUpdate({ CronId: cronId }, payload);
    dbConnection.close();
    cacheHelper.DeleteCacheByKey(cacheKeyEnum.SLOW_CRON_SETTINGS_LIST);
    cacheHelper.DeleteExternalCache(cacheKeyEnum.EXTERNAL_SLOW_CRON_DETAILS);
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetSlowCronDetails = async () => {
  let mongoResult = null;
  try {
    cacheHelper.DeleteCacheByKey(cacheKeyEnum.SLOW_CRON_SETTINGS_LIST);
    const cacheKey = cacheKeyEnum.SLOW_CRON_SETTINGS_LIST;
    if ((await cacheHelper.Has(cacheKey)) == true) {
      mongoResult = await cacheHelper.Get(cacheKey);
    } else {
      const dbConnection = await mongoClient.connect(
        process.env.MANAGED_MONGO_URL,
      );
      let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
      mongoResult = await dbo
        .collection(process.env.SLOW_CRON_GROUP_COLLECTION_NAME)
        .find()
        .toArray();
      dbConnection.close();
      cacheHelper.Set(cacheKey, mongoResult);
    }
  } catch (exception) {}
  return mongoResult;
};

module.exports.updateSlowCron = async (payload, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    for (const element of payload) {
      mongoResult = await dbo
        .collection(process.env.SLOW_CRON_GROUP_COLLECTION_NAME)
        .findOneAndUpdate(
          { CronId: element.CronId },
          {
            $set: {
              CronName: element.CronName,
              CronTime: element.CronTime,
              CronTimeUnit: element.CronTimeUnit,
              Offset: element.Offset,
              ProxyProvider: element.ProxyProvider,
              IpType: element.IpType,
              FixedIp: element.FixedIp,
              UpdatedTime: element.UpdatedTime,
              AlternateProxyProvider: element.AlternateProxyProvider,
              AuditInfo: await SessionHelper.GetAuditInfo(req),
            },
          },
        );
    }
    dbConnection.close();
    cacheHelper.DeleteCacheByKey(cacheKeyEnum.SLOW_CRON_SETTINGS_LIST);
    cacheHelper.DeleteExternalCache(cacheKeyEnum.EXTERNAL_SLOW_CRON_DETAILS);
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetFilterCronLogsByLimit = async (_limit) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.FILTER_CRON_LOGS)
      .find()
      .limit(_limit)
      .sort({ $natural: -1 })
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetFilterCronLogByKey = async (key) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.FILTER_CRON_LOGS)
      .findOne({ cronKey: key });
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetProductListByQuery = async (query) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .find(query)
      .toArray();
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.InsertOrUpdateProductWithQuery = async (mpid, query) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PRODUCT_COLLECTION)
      .findOneAndUpdate({ mpId: mpid }, query);
    dbConnection.close();
  } catch (exception) {
    console.log(exception);
  }
  return mongoResult;
};

module.exports.GetProxyFailureDetails = async () => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PROXY_FAILURE_COLLECTION)
      .find()
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.InsertUserLogin = async (userDetails) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.USERS_COLLECTION)
      .insertOne(userDetails);
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpdateUserPassword = async (_userName, newPassword) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.USERS_COLLECTION)
      .findOneAndUpdate(
        { userName: _userName },
        { $set: { userPassword: newPassword } },
      );
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpdateProxyProviderThresholdValue = async (payload, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.PROXY_FAILURE_COLLECTION)
      .findOneAndUpdate(
        { proxyProvider: parseInt(payload.proxyProvider) },
        {
          $set: {
            thresholdCount: parseInt(payload.value),
            AuditInfo: await SessionHelper.GetAuditInfo(req),
          },
        },
      );
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.InsertOrUpdateScrapeOnlyProduct = async (payload) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    var dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SCRAPE_ITEMS_COLLECTION)
      .insertOne(payload);
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetScrapeCrons = async () => {
  let mongoResult = null;
  try {
    const cacheKey = cacheKeyEnum.SCRAPE_CRON_SETTINGS_LIST;
    // if (await cacheHelper.Has(cacheKey) == true) {
    if (false) {
      mongoResult = await cacheHelper.Get(cacheKey);
    } else {
      const dbConnection = await mongoClient.connect(
        process.env.MANAGED_MONGO_URL,
      );
      let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
      mongoResult = await dbo
        .collection(process.env.SCRAPE_CRON_SETTINGS_COLLECTION_NAME)
        .find()
        .toArray();
      dbConnection.close();
      cacheHelper.Set(cacheKey, mongoResult);
    }
  } catch (exception) {}
  return mongoResult;
};

module.exports.UpdateScrapeCronDetails = async (cronId, payload) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SCRAPE_CRON_SETTINGS_COLLECTION_NAME)
      .findOneAndUpdate({ CronId: cronId }, payload);
    dbConnection.close();
    cacheHelper.DeleteCacheByKey(cacheKeyEnum.SCRAPE_CRON_SETTINGS_LIST);
  } catch (exception) {}
  return mongoResult;
};

module.exports.updateScrapeCron = async (payload, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);

    for (const element of payload) {
      mongoResult = await dbo
        .collection(process.env.SCRAPE_CRON_SETTINGS_COLLECTION_NAME)
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
    dbConnection.close();
    cacheHelper.DeleteCacheByKey(cacheKeyEnum.SCRAPE_CRON_SETTINGS_LIST);
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetScrapeProducts = async (query, pageNumber, pageSize) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SCRAPE_ITEMS_COLLECTION)
      .find(query)
      .skip(pageNumber * pageSize)
      .sort({ _id: -1 })
      .limit(pageSize)
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetScrapeProductCount = async (query) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SCRAPE_ITEMS_COLLECTION)
      .countDocuments(query);
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.deleteScrapeProductById = async (Id) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SCRAPE_ITEMS_COLLECTION)
      .deleteOne({ mpId: Id });
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetAllScrapeProductDetails = async () => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SCRAPE_ITEMS_COLLECTION)
      .find()
      .sort({ _id: -1 })
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.InsertOrUpdateScrapeProduct = async (payload, req) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    let existResult = await dbo
      .collection(process.env.SCRAPE_ITEMS_COLLECTION)
      .findOne({ mpId: payload.mpId });
    if (existResult) {
      mongoResult = await dbo
        .collection(process.env.SCRAPE_ITEMS_COLLECTION)
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
        .collection(process.env.SCRAPE_ITEMS_COLLECTION)
        .insertOne(payload);
    }

    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetScrapeLogs = async (pageNumber, pageSize) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SCRAPE_LOGS_COLLECTION)
      .find()
      .skip(pageNumber * pageSize)
      .sort({ _id: -1 })
      .limit(pageSize)
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetScrapeLogsCount = async () => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SCRAPE_LOGS_COLLECTION)
      .countDocuments();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.FindScrapeProductById = async (mpid) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SCRAPE_ITEMS_COLLECTION)
      .find({ mpId: mpid })
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetScrapeLogsList = async (id) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.SCRAPE_LOGS_COLLECTION)
      .find({ _id: ObjectID(id) })
      .toArray();
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.IgnoreCronStatusLog = async (_cronId, _keygen) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    mongoResult = await dbo
      .collection(process.env.CRON_STATUS_COLLECTION_NAME)
      .findOneAndUpdate(
        { $and: [{ keyGenId: _keygen }, { cronId: _cronId }] },
        {
          $set: {
            status: "IGNORE",
          },
        },
      );
    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

async function getContextDetails(payload, key) {
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

module.exports.Update422StatusById = async (_mpId, isBulk) => {
  let mongoResult = null;
  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    if (isBulk == false) {
      mongoResult = await dbo
        .collection(process.env.ERROR_ITEM_COLLECTION)
        .updateMany({ mpId: _mpId }, { $set: { active: false } });
    } else {
      mongoResult = await dbo
        .collection(process.env.ERROR_ITEM_COLLECTION)
        .updateMany({}, { $set: { active: false } });
    }

    dbConnection.close();
  } catch (exception) {}
  return mongoResult;
};

module.exports.GetCronsByProxyProvider = async (proxyProviderId) => {
  let result = {
    regularCrons: [],
    slowCrons: [],
    scrapeCrons: [],
    error422Crons: [],
  };

  try {
    const dbConnection = await mongoClient.connect(
      process.env.MANAGED_MONGO_URL,
    );
    let dbo = dbConnection.db(process.env.GET_REPRICER_DBNAME);
    const providerId = parseInt(proxyProviderId);

    const [regularCrons, slowCrons, scrapeCrons] = await Promise.all([
      dbo
        .collection(process.env.CRON_SETTINGS_COLLECTION_NAME)
        .find({
          $or: [
            { ProxyProvider: providerId },
            { "AlternateProxyProvider.ProxyProvider": providerId },
          ],
        })
        .toArray(),

      dbo
        .collection(process.env.SLOW_CRON_GROUP_COLLECTION_NAME)
        .find({
          $or: [
            { ProxyProvider: providerId },
            { "AlternateProxyProvider.proxyProvider": providerId },
          ],
        })
        .toArray(),

      dbo
        .collection(process.env.SCRAPE_CRON_SETTINGS_COLLECTION_NAME)
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
    dbConnection.close();
    return result;
  } catch (exception) {
    console.error("Error in GetCronsByProxyProvider:", exception);
  }
};
