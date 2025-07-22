const _ = require("lodash");
const moment = require("moment");
const asyncHandler = require("express-async-handler");
const fs = require("fs");
const dayJs = require("dayjs");
const excelJs = require("exceljs");
var path = require("path");

const mongoMiddleware = require("../middleware/mongoMiddleware");
const httpMiddleware = require("../middleware/httpMiddleware");
const cronMiddleware = require("../middleware/cronMiddleware");
const CronLogs = require("../models/cronLogs");
const UpdateRequest = require("../models/updateRequest");
const Exports = require("../models/exports");
const historyExportMiddleware = require("../middleware/historyExportMiddleware");
const EnvSettings = require("../models/envSettings");

const scrapeOnlyMiddleware = require("../middleware/scrapeOnlyMiddleware");
const ftpMiddleware = require("../middleware/ftpMiddleware");

_contextLog = null;

const getCronLogs = asyncHandler(async (req, res) => {
  let logViewModel = [];
  let pgNo = 0;
  let date = {
    fromDate: "",
    toDate: "",
  };

  if (req.query.hasOwnProperty("pgno")) {
    pgNo = req.query.pgno - 1;
  }
  if (
    req.query.hasOwnProperty("fromDate") &&
    req.query.hasOwnProperty("toDate")
  ) {
    date.fromDate = req.query.fromDate;
    date.toDate = req.query.toDate;
  }
  const type = req.query.hasOwnProperty("type") ? req.query.type : "";

  let group = "";
  let cronId = "";
  let cronSettings = await mongoMiddleware.GetCronSettingsList();
  const slowCronSettings = await mongoMiddleware.GetSlowCronDetails();
  cronSettings = _.concat(cronSettings, slowCronSettings);
  if (req.query.hasOwnProperty("group")) {
    if (req.query.group != "") {
      group = req.query.group;
      cronId = cronSettings.find((x) => x.CronName == group).CronId;
    }
  }

  let cronLogs = await mongoMiddleware.GetCronLogs(pgNo, type, cronId, date);
  logsList = cronLogs.mongoResult.sort(
    (a, b) => new Date(a.time) - new Date(b.time),
  );
  if (logsList && logsList.length > 0) {
    let idx = 0;
    for (let log of logsList) {
      const existingModel = _.find(logViewModel, (existing) => {
        if (existing.logData._id.toString() == log._id.toString()) {
          return true;
        }
      });
      if (!existingModel) {
        try {
          let _$cronLog = new CronLogs(log, idx++);
          _$cronLog.repricedProductCount = await getRepricerCount(log);
          _$cronLog.successScrapeCount = await getScrapeCountByFlag(log, 1); // SUCCESS:1
          _$cronLog.failureScrapeCount = await getScrapeCountByFlag(log, 0); // FAILURE:0
          _$cronLog.repriceFailure422Count = await getRepriceFailureByType(
            log,
            1,
          ); //422-Error:1
          _$cronLog.repriceFailureOtherCount = await getRepriceFailureByType(
            log,
            0,
          ); //Any Other Error:0
          _$cronLog.cronName = cronSettings.find(
            (t) => t.CronId == log.cronId,
          ).CronName;
          logViewModel.unshift(_$cronLog);
        } catch (ex) {
          console.log(
            `Error while Mapping cron log ${log._id.toString()} with error ${ex.message}`,
          );
        }
      }
    }
  }
  let cronStatus = await mongoMiddleware.GetLatestCronStatus();
  if (cronStatus && cronStatus.length > 0) {
    cronStatus.forEach((x) => {
      if (x.cronId) {
        try {
          x.cronName = cronSettings.find((t) => t.CronId == x.cronId).CronName;
        } catch (ex) {
          x.cronName = x.cronId;
        }
      }
    });
  }
  let filterCronLogs = await mongoMiddleware.GetFilterCronLogsByLimit(
    parseInt(process.env.FILTER_CRON_LOGS_LIMIT),
  );
  const filterCronDetails = await mongoMiddleware.GetFilteredCrons();
  _.forEach(filterCronLogs, (x) => {
    x.filterDate = moment(x.filterDate).format("DD-MM-YY HH:mm:ss");
    x.startTime = moment(x.startTime).format("DD-MM-YY HH:mm:ss");
    x.endTime = moment(x.endTime).format("DD-MM-YY HH:mm:ss");
    x.cronName = filterCronDetails.find(
      (c) => c.cronId == x.contextCronId,
    ).cronName;
  });
  let params = {
    items: logViewModel,
    cronStatus: cronStatus,
    filterLogs: filterCronLogs,
    pageNumber: cronLogs.pageNumber,
    pageSize: cronLogs.pageSize,
    totalDocs: cronLogs.totalDocs,
    totalPages: cronLogs.totalPages,
    type,
    group,
    date,
    groupName: "dashboard",
    userRole: req.session.users_id.userRole,
  };
  res.render("pages/dashboard/list", params);
});

const getLogsDetails = asyncHandler(async (req, res) => {
  const idx = req.params.id;
  let cronObject = await getCustomLogsDetailsById(idx);
  res.render("pages/dashboard/logViewer", {
    items: cronObject,
    groupName: "dashboard",
    userRole: req.session.users_id.userRole,
  });
});

const getRawJson = asyncHandler(async (req, res) => {
  _contextLog = null;
  const mpid = req.params.mpId;
  const idx = req.params.idx;
  const vendor = req.params.vendor;
  let cronObject = await getCustomLogsDetailsById(idx);
  if (cronObject) {
    _.forEach(cronObject.logData.logs, ($log) => {
      if (_.first($log).productId == mpid) {
        _contextLog = $log.find((x) => x.vendor == vendor);
        if (_contextLog) {
          return false;
        }
      }
    });
    _contextLog.logs.scrapedOn = new Date(
      _contextLog.logs.scrapedOn,
    ).toLocaleString();
    _contextLog.serializedData = JSON.stringify(_contextLog, undefined, 4);
    _contextLog.parentIndex = idx;
    res.render("pages/dashboard/rawJson", {
      item: _contextLog,
      groupName: "dashboard",
      userRole: req.session.users_id.userRole,
    });
  }
});

const downloadLog = asyncHandler(async (req, res) => {
  let today = dayJs();
  const fileName = `log_${_contextLog.productId}_${today.format("YYYY_MM_DD_h_mm_ss")}.json`;
  fs.writeFileSync(fileName, _contextLog.serializedData);
  res.download(fileName, (err) => {
    if (err) {
      console.log(err);
    }
    fs.unlinkSync(fileName);
  });
});

const exportData = asyncHandler(async (req, res) => {
  const idx = req.params.idx;
  const cronObject = await getCustomLogsDetailsById(idx);
  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet("ItemList");

  worksheet.columns = [
    { header: "CRON time", key: "cronTime", width: 20 },
    { header: "Product Name", key: "productName", width: 20 },
    { header: "MPID", key: "mpid", width: 20 },
    { header: "Vendor Product ID", key: "vendorProductId", width: 20 },
    { header: "Channel ID", key: "channelId", width: 20 },
    { header: "Existing Price", key: "oldPrice", width: 20 },
    { header: "Suggested Price", key: "repricedPrice", width: 20 },
    { header: "Price Updated", key: "isPriceUpdated", width: 20 },
    { header: "Comments", key: "comments", width: 20 },
    { header: "Response Json", key: "jsonData", width: 50 },

    // { header: "Scrape On/Off", key: "scrapeOn", width: 20 },
    // { header: "Allow Reprice On/Off", key: "allowReprice", width: 20 },
    // { header: "Request Every Min", key: "requestInterval", width: 20 },
    // { header: "Floor Price", key: "floorPrice", width: 20 },
    // { header: "Net 32 URl", key: "net32url", width: 20 },
    // { header: "Focus Id", key: "focusId", width: 20 },

    // { header: "Activated", key: "activated", width: 20 },
  ];
  const itemCollection = await getExcelItemCollection(cronObject);
  // console.log(itemCollection);
  worksheet.addRows(itemCollection);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=" + `Item_Detailed.xlsx`,
  );

  return workbook.xlsx.write(res).then(function () {
    res.status(200).end();
  });
});

const exportBulkData = asyncHandler(async (req, res) => {
  const fromDate = req.params.from;
  const toDate = req.params.to;

  var filename = "Export_" + fromDate + "_" + toDate + "_" + Date.now();

  const queueExport = await Exports.create({
    fileName: filename,
    // object: cronObject,
    status: "Queued",
    fromDate: new Date(fromDate),
    toDate: new Date(toDate),
  });
  if (queueExport._id) {
    res.render("pages/msgDisplay", {
      response:
        "The export will finish shortly and be available in downloads by the name " +
        filename,
      groupName: "item",
      userRole: req.session.users_id.userRole,
    });
  }
});

async function exportBulkDataCRON() {
  let cronLogs = [];
  let date = {
    fromDate: "",
    toDate: "",
  };
  let inProgressExport = await mongoMiddleware.CheckInProgressExport();
  console.log(inProgressExport);
  let queuedExport = null;
  if (inProgressExport.length) {
    console.log("CRON Log: An export is already in progress...");
  } else {
    queuedExport = await mongoMiddleware.FetchQueuedExport();
    console.log(queuedExport);
    if (queuedExport != null) {
      let updateExportStatus = await mongoMiddleware.UpdateExportStatus(
        queuedExport._id,
        "In Progress",
        {},
      );
      if (updateExportStatus.lastErrorObject.updatedExisting) {
        date.fromDate = new Date(queuedExport.fromDate);
        date.toDate = new Date(queuedExport.toDate);
        console.log(date);

        try {
          console.log("CRON Log: Export batch started...");

          // creating cron object
          let exportStartedOn = new Date();
          cronLogs = await mongoMiddleware.GetCronLogs(undefined, "", "", date);
          let logVM = [];
          logsList = cronLogs.mongoResult.sort(
            (a, b) => new Date(a.time) - new Date(b.time),
          );
          if (logsList && logsList.length > 0) {
            let idx = 0;
            logsList.forEach((log) => {
              const existingModel = _.find(logVM, (existing) => {
                if (existing.logData._id.toString() == log._id.toString()) {
                  return true;
                }
              });
              if (!existingModel) {
                logVM.unshift(new CronLogs(log, idx++));
              }
            });
          }
          var cronObj = logVM;

          // creating JSONs in batches
          let batchLen = 5;
          if (queuedExport.lastIndex < cronObj.length) {
            var startIndex = queuedExport.lastIndex + 1;
            // var lastIndex = Math.min(queuedExport.lastIndex + 1 + batchLen, cronObj.length)
            var lastIndex = Math.min(
              queuedExport.lastIndex + batchLen,
              cronObj.length,
            );
            // var cronObj = logVM.slice(startIndex, lastIndex)
            var cronObj = logVM.slice(startIndex, lastIndex + 1);
            // console.log(cronObj)
            console.log({ lastIndex });
            console.log(
              "cronObj created for batch " + startIndex + " - " + lastIndex,
            );

            var itemCollection = [],
              rowCount = 0,
              errorRowCount = 0,
              dates = cronObj.length;
            let cObj = startIndex;
            for (var obj of cronObj) {
              collection = await getExcelItemCollection(obj, errorRowCount);
              itemCollection.push(collection);
              console.log("Fetched item collection " + ++cObj);
            }
            console.log("itemCollection created...");
            const bulkItemCollection = [].concat.apply([], itemCollection);
            console.log({ bulkItemCollection: bulkItemCollection.length });
            var progress = "Completed batch " + startIndex + " - " + lastIndex;

            fs.writeFile(
              "./exports/" +
                queuedExport.fileName +
                "_" +
                startIndex +
                "_" +
                lastIndex +
                ".json",
              JSON.stringify(bulkItemCollection),
              async (error) => {
                console.log(progress);
                if (error) {
                  console.log(error);
                  throw error;
                } else {
                  console.log("Updating export status");
                  updateExportStatus = await mongoMiddleware.UpdateExportStatus(
                    queuedExport._id,
                    "Batched",
                    {
                      exportStartedOn,
                      dates,
                      rowCount,
                      errorRowCount,
                      lastIndex,
                      progress,
                    },
                  );
                  console.log(updateExportStatus);
                }
              },
            );
          } else {
            // Merging JSONs into one worksheet
            console.log("All batches complete");
            let exportFinishedOn = new Date();
            updateExportStatus = await mongoMiddleware.UpdateExportStatus(
              queuedExport._id,
              "In Progress",
              {
                exportFinishedOn,
                progress: "All batches complete",
              },
            );

            // var startIdx = 0, lastIdx = Math.min(startIdx + batchLen,queuedExport.lastIndex), batchedItemCollection = [], i = 0
            var startIdx = 0,
              lastIdx = Math.min(
                startIdx + batchLen - 1,
                queuedExport.lastIndex,
              ),
              batchedItemCollection = [],
              i = 0;
            // while (i < Math.ceil(queuedExport.lastIndex / (batchLen + 1))) {
            while (i < Math.ceil(queuedExport.lastIndex / batchLen)) {
              const file = await fs.promises.readFile(
                "./exports/" +
                  queuedExport.fileName +
                  "_" +
                  startIdx +
                  "_" +
                  lastIdx +
                  ".json",
              );
              fs.unlinkSync(
                "./exports/" +
                  queuedExport.fileName +
                  "_" +
                  startIdx +
                  "_" +
                  lastIdx +
                  ".json",
              );
              let parsedData = JSON.parse(file);
              batchedItemCollection.push(parsedData);
              // console.log('./exports/' + queuedExport.fileName + '_' + startIdx + '_' + lastIdx + '.json')
              console.log(
                startIdx +
                  "-" +
                  lastIdx +
                  " batch length: " +
                  parsedData.length,
              );
              startIdx = lastIdx + 1;
              // lastIdx = Math.min(startIdx + batchLen,queuedExport.lastIndex)
              lastIdx = Math.min(
                startIdx + batchLen - 1,
                queuedExport.lastIndex,
              );
              i++;
            }
            console.log({
              batchedItemCollection: batchedItemCollection.length,
            });
            const mergedItemCollection = [].concat.apply(
              [],
              batchedItemCollection,
            );

            const workbook = new excelJs.Workbook();
            const worksheet = workbook.addWorksheet("ItemList");
            worksheet.columns = [
              { header: "CRON time", key: "cronTime", width: 20 },
              { header: "Product Name", key: "productName", width: 20 },
              { header: "MPID", key: "mpid", width: 20 },
              {
                header: "Vendor Product ID",
                key: "vendorProductId",
                width: 20,
              },
              { header: "Channel ID", key: "channelId", width: 20 },
              { header: "Existing Price", key: "oldPrice", width: 20 },
              { header: "Suggested Price", key: "repricedPrice", width: 20 },
              { header: "Price Updated", key: "isPriceUpdated", width: 20 },
              { header: "Comments", key: "comments", width: 20 },
              // { header: "Response Json", key: "jsonData", width: 50 },
            ];

            let rowCount = mergedItemCollection.length;
            console.log({ mergedItemCollection: mergedItemCollection.length });
            worksheet.addRows(mergedItemCollection);
            console.log("worksheet created...");

            workbook.xlsx
              .writeFile("./exports/" + queuedExport.fileName + ".xlsx")
              .then(async () => {
                let exportFinishedOn = new Date();
                // console.log({ exportStartedOn, exportFinishedOn, dates, rowCount, errorRowCount })
                updateExportStatus = await mongoMiddleware.UpdateExportStatus(
                  queuedExport._id,
                  "Done",
                  {
                    exportFinishedOn,
                    dates: cronObj.length,
                    rowCount,
                    progress: "Workbook created",
                  },
                );
                console.log("Workbook created...");
              });
          }
        } catch (err) {
          console.log("CRON Log: Export error...");
          console.log(err);
          updateExportStatus = await mongoMiddleware.UpdateExportStatus(
            queuedExport._id,
            "Error",
          );
        }
      } else {
        console.log("Status update error...");
      }
    } else {
      console.log("CRON Log: No export found in queue...");
    }
  }
  return;
}

async function getExcelItemCollection(cronObject, errorRows = 0) {
  let collection = [];
  if (cronObject && cronObject.logData && cronObject.logData.logs) {
    let cRow = 0;
    for (const row of cronObject.logData.logs) {
      ++cRow;
      try {
        const itemDetails = await mongoMiddleware.GetItemList(row.productId);
        if (!itemDetails.length) {
          console.log("...Error in fetching elements of item " + cRow);
          errorRows++;
          continue;
        }
        let _contextRow = _.cloneDeep(_.first(itemDetails));
        _contextRow.cronTime = String(cronObject.logTime);
        _contextRow.vendorProductId = row.logs.repriceData
          ? row.logs.repriceData.vendorProductId
          : "";
        _contextRow.oldPrice =
          row.logs.repriceData && row.logs.repriceData.repriceDetails
            ? row.logs.repriceData.repriceDetails.oldPrice
            : row.logs.repriceData
              ? await getMultiPriceOldPrice(
                  row.logs.repriceData.listOfRepriceDetails,
                )
              : "N/A";
        _contextRow.repricedPrice =
          row.logs.repriceData && row.logs.repriceData.repriceDetails
            ? row.logs.repriceData.repriceDetails.newPrice
            : row.logs.repriceData
              ? await getMultiPriceNewPrice(
                  row.logs.repriceData.listOfRepriceDetails,
                )
              : "N/A";
        _contextRow.isPriceUpdated = row.hasOwnProperty("priceUpdated")
          ? row.priceUpdated
          : "FALSE";
        _contextRow.comments =
          row.logs.repriceData && row.logs.repriceData.repriceDetails
            ? row.logs.repriceData.repriceDetails.explained
            : row.logs.repriceData
              ? await getMultiPriceComments(
                  row.logs.repriceData.listOfRepriceDetails,
                )
              : "N/A";
        // _contextRow.jsonData = JSON.stringify(row.logs,undefined,4);
        collection.push(_contextRow);
      } catch (err) {
        console.log("...Error in fetching elements of item " + cRow);
        errorRows++;
        continue;
      }
      // console.log('...Fetched elements of item ' + cRow)
    }
  }
  return collection;
}

const listDownloads = asyncHandler(async (req, res) => {
  let fileNames = await ftpMiddleware.GetAllFileDetails();
  let exportsList = [];
  if (fileNames && fileNames.length > 0) {
    for (const fileName of fileNames) {
      const fileDetailsInDb = await mongoMiddleware.GetExportFileStatus(
        fileName.name,
      );
      if (fileDetailsInDb) {
        let obj = {
          name: fileName.name,
          createdOn: moment(fileDetailsInDb.createdTime).format(
            "DD-MM-YY HH:mm:ss",
          ),
          status: fileDetailsInDb.status,
          updatedOn: moment(fileDetailsInDb.updatedTime).format(
            "DD-MM-YY HH:mm:ss",
          ),
          updatedBy: fileDetailsInDb.requestedBy
            ? fileDetailsInDb.requestedBy
            : "-",
        };
        exportsList.push(obj);
      }
    }
  }
  const inProgressFiles =
    await mongoMiddleware.GetExportFileNamesByStatus("IN-PROGRESS");
  if (inProgressFiles && inProgressFiles.length > 0) {
    _.forEach(inProgressFiles, (file) => {
      let obj = {
        name: file.fileName,
        createdOn: moment(file.createdTime).format("DD-MM-YY HH:mm:ss"),
        status: file.status,
        updatedOn: moment(file.updatedTime).format("DD-MM-YY HH:mm:ss"),
        updatedBy: file.requestedBy ? file.requestedBy : "-",
      };
      exportsList.push(obj);
    });
  }
  exportsList = _.sortBy(exportsList, ["createdOn"]);
  let params = {
    files: exportsList,
    groupName: "downloads",
    userRole: req.session.users_id.userRole,
  };
  res.render("pages/downloads/exports", params);
});

const downloadFile = asyncHandler(async (req, res) => {
  const filename = req.params.file;
  var directoryPath = path.join(__dirname, "../exports/");

  res.download(directoryPath + filename + ".xlsx", (err) => {
    if (err) {
      console.log(err);
    }
  });
});

const deleteFile = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const filename = req.params.file;
  var directoryPath = path.join(__dirname, "../exports/");
  fs.unlink(directoryPath + filename + ".xlsx", async (err) => {
    if (err) {
      console.log(err);
    } else {
      const deleteStatus = await Exports.findByIdAndDelete(id);
      console.log(deleteStatus);
    }
    res.redirect("/downloads/list_downloads");
  });
});

const updatePrice = asyncHandler(async (req, res) => {
  _contextLog = null;
  const mpid = req.params.mpId;
  const idx = req.params.idx;
  const envInfo = await EnvSettings.findOne();
  const cronObject = await getCustomLogsDetailsById(idx);
  if (cronObject) {
    _contextLog = cronObject.logData.logs.find((x) => x.productId == mpid);
    const ownLog = _contextLog.logs.sourceResult.find(
      (x) => x.vendorId == envInfo.ownVendorId,
    );
    _contextLog.priceUpdated = true;
    _contextLog.priceUpdatedOn = new Date();
    const request = new UpdateRequest(
      mpid,
      _contextLog.logs.repriceData.vendorProductCode,
      _contextLog.logs.repriceData.repriceDetails.newPrice,
      ownLog.inventory,
    );
    const updatedResponse = await httpMiddleware.updatePrice(request);
    _contextLog.priceUpdateResponse = updatedResponse;
    const updatePriceInDb = await mongoMiddleware.UpdateCronLogPostPriceUpdate(
      cronObject.logData,
    );
    return res.json({
      status: true,
      message: `Price updated successfully for ${mpid}.Please wait for sometime for changes to reflect.`,
    });
  }
});

const updateAll = asyncHandler(async (req, res) => {
  const idx = req.params.idx;
  const cronObject = await getCustomLogsDetailsById(idx);
  const envInfo = await EnvSettings.findOne();
  let listOfProducts = [];
  if (cronObject) {
    for (const product of cronObject.logData.logs) {
      if (
        product.logs.repriceData.repriceDetails.newPrice != "N/A" &&
        product.logs.repriceData.repriceDetails.newPrice !=
          product.logs.repriceData.repriceDetails.oldPrice
      ) {
        product.priceUpdated = true;
        product.priceUpdatedOn = new Date();
        const ownLog = product.logs.sourceResult.find(
          (x) => x.vendorId == envInfo.ownVendorId,
        );
        const request = new UpdateRequest(
          product.productId,
          product.logs.repriceData.vendorProductCode,
          product.logs.repriceData.repriceDetails.newPrice,
          ownLog.inventory,
        );
        listOfProducts.push(request);
        const updatePriceInDb =
          await mongoMiddleware.UpdateCronLogPostPriceUpdate(
            cronObject.logData,
          );
      }
    }
    if (listOfProducts.length > 0) {
      cronMiddleware.CreateUpdatePriceCron(listOfProducts);
    }
    return res.json({
      status: true,
      message:
        "Price updated successfully for all the products.Please wait for sometime for changes to reflect.",
    });
  }
});

const updatePriceExternal = asyncHandler(async (req, res) => {
  try {
    const updatedRequest = req.body;
    const updatedResponse = await httpMiddleware.updatePrice(updatedRequest);
    console.log(
      `${updatedRequest.payload.cronName} : PRICE_UPDATE_SUCCESS : ${JSON.stringify(updatedResponse)}`,
    );
    return res.json({
      status: true,
      message: updatedResponse,
    });
  } catch (exception) {
    console.log(
      `${updatedRequest.payload.cronName} : PRICE_UPDATE_ERROR : ${exception.message}`,
    );
    return res.json({
      status: false,
      message: `Sorry some error occurred! Exception : ${exception.message}`,
    });
  }
});

const getMultiPriceOldPrice = asyncHandler(async (listOfRepriceDetails) => {
  if (listOfRepriceDetails) {
    let newPriceDetails = [];
    listOfRepriceDetails.forEach((price) => {
      newPriceDetails.push(`${price.minQty}@${price.oldPrice}`);
    });
    return newPriceDetails.join(",");
  }
  return "";
});

const getMultiPriceNewPrice = asyncHandler(async (listOfRepriceDetails) => {
  if (listOfRepriceDetails) {
    let newPriceDetails = [];
    listOfRepriceDetails.forEach((price) => {
      newPriceDetails.push(`${price.minQty}@${price.newPrice}`);
    });
    return newPriceDetails.join(",");
  }
  return "";
});

const getMultiPriceComments = asyncHandler(async (listOfRepriceDetails) => {
  if (listOfRepriceDetails) {
    let newPriceComments = [];
    listOfRepriceDetails.forEach((price) => {
      newPriceComments.push(`${price.minQty}@${price.explained}`);
    });
    return newPriceComments.join(",");
  }
  return "";
});

const getCustomLogsDetailsById = asyncHandler(async (logId) => {
  const logResponse = await mongoMiddleware.GetLogsById(logId);
  return new CronLogs(_.first(logResponse), 0);
});

async function getRepricerCount(logList) {
  try {
    if (logList) {
      if (logList.RepricedProductCount)
        return logList.RepricedProductCount.toString();
      let repricedProductList = 0;
      _.forEach(logList.logs, (vendorLog) => {
        if (vendorLog.length > 0) {
          _.forEach(vendorLog, (x) => {
            if (x.priceUpdated) {
              repricedProductList++;
            }
          });
        }
      });
      return repricedProductList.toString();
    }
  } catch (ex) {
    //do nothing
  }
  return "N/A";
}

async function getScrapeCountByFlag(logList, flag) {
  let uniqueProductArray = [];
  try {
    if (logList) {
      _.forEach(logList.logs, (vendorLogs) => {
        if (vendorLogs.length > 0) {
          _.forEach(vendorLogs, (x) => {
            if (flag == 1) {
              if (
                x.logs &&
                !_.includes(uniqueProductArray, x.productId.trim()) &&
                (x.logs.repriceData || x.logs.listOfRepriceDetails)
              ) {
                uniqueProductArray.push(x.productId.trim());
              }
            } else if (flag == 0) {
              if (
                x.logs &&
                !_.includes(uniqueProductArray, x.productId.trim()) &&
                !x.logs.repriceData &&
                !x.logs.listOfRepriceDetails
              ) {
                uniqueProductArray.push(x.productId.trim());
              }
            }
          });
        }
      });
    }
  } catch (ex) {}
  return uniqueProductArray.length;
}

async function getRepriceFailureByType(logList, flag) {
  let resultantCount = 0;
  try {
    if (logList) {
      _.forEach(logList.logs, (vendorLogs) => {
        if (vendorLogs.length > 0) {
          _.forEach(vendorLogs, (x) => {
            if (flag == 1) {
              if (
                x.priceUpdateResponse &&
                x.priceUpdateResponse.message &&
                x.priceUpdateResponse.message.indexOf("ERROR:422") >= 0
              ) {
                resultantCount++;
                //return false;
              }
            } else if (flag == 0) {
              if (
                x.priceUpdateResponse &&
                x.priceUpdateResponse.message &&
                x.priceUpdateResponse.message.statusCode &&
                x.priceUpdateResponse.message.statusCode != 200
              ) {
                resultantCount++;
                //return false;
              }
            }
          });
        }
      });
    }
  } catch (ex) {
    //do nothing
  }
  return resultantCount;
}

const exportDataV2 = asyncHandler(async (req, res) => {
  const idx = req.params.idx;
  const cronObject = await getCustomLogsDetailsById(idx);
  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet("ItemList");

  worksheet.columns = [
    { header: "CRON time", key: "cronTime", width: 20 },
    { header: "Vendor", key: "vendorName", width: 20 },
    { header: "Product Name", key: "productName", width: 20 },
    { header: "MPID", key: "mpid", width: 20 },
    { header: "Vendor Product ID", key: "vendorProductId", width: 20 },
    { header: "Existing Price", key: "oldPrice", width: 20 },
    { header: "Suggested Price", key: "repricedPrice", width: 20 },
    { header: "Price Updated", key: "isPriceUpdated", width: 20 },
    { header: "Comments", key: "comments", width: 20 },
    { header: "Response Json", key: "jsonData", width: 50 },
  ];
  const itemCollection = await getExcelItemCollectionV2(cronObject);
  worksheet.addRows(itemCollection);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=" + `Item_Detailed.xlsx`,
  );

  return workbook.xlsx.write(res).then(function () {
    res.status(200).end();
  });
});

async function getExcelItemCollectionV2(cronObject, errorRows = 0) {
  let collection = [];
  if (cronObject && cronObject.logData && cronObject.logData.logs) {
    let cRow = 0;
    for (const row of cronObject.logData.logs) {
      ++cRow;
      try {
        if (row.length > 0) {
          for (const vRow of row) {
            let _contextRow = {};
            _contextRow.cronTime = cronObject.logTime;
            _contextRow.vendorName = vRow.vendor;
            _contextRow.mpid = vRow.productId;
            _contextRow.vendorProductId = vRow.logs.repriceData
              ? vRow.logs.repriceData.vendorProductId
              : "";
            _contextRow.productName = vRow.logs.repriceData
              ? vRow.logs.repriceData.productName
              : "";
            _contextRow.oldPrice =
              vRow.logs.repriceData && vRow.logs.repriceData.repriceDetails
                ? vRow.logs.repriceData.repriceDetails.oldPrice
                : vRow.logs.repriceData
                  ? await getMultiPriceOldPrice(
                      vRow.logs.repriceData.listOfRepriceDetails,
                    )
                  : "N/A";
            _contextRow.repricedPrice =
              vRow.logs.repriceData && vRow.logs.repriceData.repriceDetails
                ? vRow.logs.repriceData.repriceDetails.newPrice
                : vRow.logs.repriceData
                  ? await getMultiPriceNewPrice(
                      vRow.logs.repriceData.listOfRepriceDetails,
                    )
                  : "N/A";
            _contextRow.isPriceUpdated = vRow.hasOwnProperty("priceUpdated")
              ? vRow.priceUpdated
              : "FALSE";
            _contextRow.comments =
              vRow.logs.repriceData && vRow.logs.repriceData.repriceDetails
                ? vRow.logs.repriceData.repriceDetails.explained
                : vRow.logs.repriceData
                  ? await getMultiPriceComments(
                      vRow.logs.repriceData.listOfRepriceDetails,
                    )
                  : "N/A";
            collection.push(_contextRow);
          }
        }
      } catch (err) {
        console.log("...Error in fetching elements of item " + cRow);
        errorRows++;
        continue;
      }
    }
  }
  return collection;
}

const getFilterCronLogsByLimit = asyncHandler(async (req, res) => {
  const logsLimit = parseInt(req.params.noOfLogs);
  let filterCronLogsResult =
    await mongoMiddleware.GetFilterCronLogsByLimit(logsLimit);
  if (filterCronLogsResult && filterCronLogsResult.length > 0) {
    const filterCronDetails = await mongoMiddleware.GetFilteredCrons();
    _.forEach(filterCronLogsResult, (x) => {
      x.filterDate = moment(x.filterDate).format("DD-MM-YY HH:mm:ss");
      x.startTime = moment(x.startTime).format("DD-MM-YY HH:mm:ss");
      x.endTime = moment(x.endTime).format("DD-MM-YY HH:mm:ss");
      x.cronName = filterCronDetails.find(
        (c) => c.cronId == x.contextCronId,
      ).cronName;
    });
  }
  return res.json({
    status: true,
    cronLogs: filterCronLogsResult,
  });
});

const getCurrentTasks = asyncHandler(async (req, res) => {
  let cronSettings = await mongoMiddleware.GetCronSettingsList();

  const slowCronSettings = await mongoMiddleware.GetSlowCronDetails();
  cronSettings = _.concat(cronSettings, slowCronSettings);

  let cronStatus = await mongoMiddleware.GetLatestCronStatus();
  if (cronStatus && cronStatus.length > 0) {
    cronStatus.forEach((x) => {
      if (x.cronId) {
        try {
          x.cronName = cronSettings.find((t) => t.CronId == x.cronId).CronName;
        } catch (ex) {
          x.cronName = x.cronId;
        }
      }
    });
  }

  let params = {
    cronStatus: cronStatus,
    groupName: "tasks",
    userRole: req.session.users_id.userRole,
  };
  res.render("pages/dashboard/currentTasks", params);
});

const getCronHistoryLogs = asyncHandler(async (req, res) => {
  try {
    let logViewModel = [];
    let pgNo = 0;
    let pgLimit = 10; // item per page - default
    let totalRecords = 25; // used for limit in db Query - default

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Set to 00:00:00.000

    // Get today's end date
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 0, 0); // Set to 23:59:59.999

    let date = {
      fromDate: "",
      toDate: "",
    };

    if (
      req.query.hasOwnProperty("fromDate") &&
      req.query.fromDate &&
      req.query.hasOwnProperty("toDate") &&
      req.query.toDate
    ) {
      date.fromDate = new Date(req.query.fromDate);
      date.toDate = new Date(req.query.toDate);
    } else {
      date.fromDate = startOfToday;
      date.toDate = endOfToday;
    }

    if (req.query.hasOwnProperty("pgno")) {
      pgNo = req.query.pgno - 1 || 0;
      if (pgNo < 0) {
        pgNo = 0;
      }
    }

    if (req.query.hasOwnProperty("pageSize")) {
      pgLimit = req.query.pageSize || 25;
    }

    // total records - query from DB
    if (req.query.hasOwnProperty("totalRecords")) {
      totalRecords = req.query.totalRecords || 25;
      pgLimit = totalRecords; //temp
    }

    const type = req.query.hasOwnProperty("cronType")
      ? req.query.cronType
      : "ALL_EXCEPT_422";

    let group = "";
    let cronId = "";

    let cronSettings = await mongoMiddleware.GetCronSettingsList();
    const slowCronSettings = await mongoMiddleware.GetSlowCronDetails();
    const scrapeOnlyCronSettings = await mongoMiddleware.GetScrapeCrons();
    cronSettings = _.concat(cronSettings, slowCronSettings);
    cronSettings = _.concat(cronSettings, scrapeOnlyCronSettings);

    let cronStatus = await mongoMiddleware.GetLatestCronStatus();
    if (cronStatus && cronStatus.length > 0) {
      cronStatus.forEach((x) => {
        if (x.cronId) {
          try {
            x.cronName = cronSettings.find(
              (t) => t.CronId == x.cronId,
            ).CronName;
          } catch (ex) {
            x.cronName = x.cronId;
          }
        }
      });
    }

    if (req.query.hasOwnProperty("cronId")) {
      if (req.query.cronId != "" && req.query.cronId != "ALL") {
        cronId = req.query.cronId;
      }
    }

    let cronLogs = null;
    if (type == "SCRAPE_ONLY") {
      if (cronId != "") {
        cronLogs = await scrapeOnlyMiddleware.GetRunInfoByCron(
          totalRecords,
          moment(date.fromDate).format("YYYY-MM-DD hh:mm:ss"),
          moment(date.toDate).format("YYYY-MM-DD hh:mm:ss"),
          cronId,
        );
      } else {
        cronLogs = await scrapeOnlyMiddleware.GetRunInfo(
          totalRecords,
          moment(date.fromDate).format("YYYY-MM-DD hh:mm:ss"),
          moment(date.toDate).format("YYYY-MM-DD hh:mm:ss"),
        );
      }
    } else {
      cronLogs = await mongoMiddleware.GetCronLogsV2(
        pgNo,
        type,
        cronId,
        date,
        totalRecords,
      );
    }

    if (type != "SCRAPE_ONLY") {
      let logsList = cronLogs.mongoResult.sort(
        (a, b) => new Date(a.time) - new Date(b.time),
      );
      if (logsList && logsList.length > 0) {
        let idx = 0;
        for (let log of logsList) {
          const existingModel = _.find(logViewModel, (existing) => {
            if (existing.logData._id.toString() == log._id.toString()) {
              return true;
            }
          });
          if (!existingModel) {
            try {
              let _$cronLog = new CronLogs(log, idx++);
              const logAnalysisInfo = await getLogAnalysis(log);
              _$cronLog.repricedProductCount = await getRepricerCount(log);
              _$cronLog.successScrapeCount = logAnalysisInfo.successCount;
              _$cronLog.failureScrapeCount = logAnalysisInfo.failureCount;
              _$cronLog.repriceFailure422Count =
                logAnalysisInfo.failure422Count;
              _$cronLog.repriceFailureOtherCount =
                logAnalysisInfo.failureOtherCount;
              _$cronLog.cronName = cronSettings.find(
                (t) => t.CronId == log.cronId,
              ).CronName;
              logViewModel.unshift(_$cronLog);
            } catch (ex) {
              console.log(
                `Error while Mapping cron log ${log._id.toString()} with error ${ex.message}`,
              );
            }
          }
        }
      }
    } else if (type == "SCRAPE_ONLY") {
      logViewModel = cronLogs;
    }
    // filterCronLogs
    let filterCronLogs = await mongoMiddleware.GetFilterCronLogsByLimit(
      parseInt(process.env.FILTER_CRON_LOGS_LIMIT),
    );
    const filterCronDetails = await mongoMiddleware.GetFilteredCrons();
    _.forEach(filterCronLogs, (x) => {
      x.filterDate = moment(x.filterDate).format("DD-MM-YY HH:mm:ss");
      x.startTime = moment(x.startTime).format("DD-MM-YY HH:mm:ss");
      x.endTime = moment(x.endTime).format("DD-MM-YY HH:mm:ss");
      x.cronName = filterCronDetails.find(
        (c) => c.cronId == x.contextCronId,
      ).cronName;
    });
    let cronTypes = [
      "ALL_EXCEPT_422",
      "Regular",
      "SLOWCRON",
      "Manual",
      "422Error",
      "OVERRIDE_RUN",
      "FEED_RUN",
      "All",
      "SCRAPE_ONLY",
    ];

    let params = {
      filterCron: cronId,
      filterCronType: type,
      filterPgSize: cronLogs.pageSize,
      filterStartDate: moment(date.fromDate).format("YYYY-MM-DDTHH:mm"),
      filterEndDate: moment(date.toDate).format("YYYY-MM-DDTHH:mm"),
      filterTotalRecords: totalRecords,
    };

    res.render("pages/dashboard/cronHistory", {
      cronStatus: cronStatus,
      params: params,
      items: logViewModel,
      filterLogs: filterCronLogs,
      groupName: "cronHistory",
      params: params,
      cronSettings: cronSettings,
      cronTypes: cronTypes,
      date,
      type,
      pageSize: cronLogs.pageSize,
      pageNumber: cronLogs.pageNumber,
      totalDocs: cronLogs.totalDocs,
      totalPages: cronLogs.totalPages,
      userRole: req.session.users_id.userRole,
    });
  } catch (e) {
    console.log(e);
  }
});

async function getLogAnalysis(logList) {
  let uniqueSuccessProductArray = [];
  let uniqueFailureProductArray = [];
  let logAnalysisInfo = {
    successCount: 0,
    failureCount: 0,
    failure422Count: 0,
    failureOtherCount: 0,
  };
  try {
    if (logList) {
      for (const vendorLogs of logList.logs) {
        if (vendorLogs.length > 0) {
          for (const x of vendorLogs) {
            if (
              x.logs &&
              !_.includes(uniqueSuccessProductArray, x.productId) &&
              (x.logs.repriceData || x.logs.listOfRepriceDetails)
            ) {
              logAnalysisInfo.successCount++;
              uniqueSuccessProductArray.push(x.productId);
            }
            if (
              x.logs &&
              !_.includes(uniqueFailureProductArray, x.productId) &&
              !x.logs.repriceData &&
              !x.logs.listOfRepriceDetails
            ) {
              logAnalysisInfo.failureCount++;
              uniqueFailureProductArray.push(x.productId);
            }
            if (
              x.priceUpdateResponse &&
              x.priceUpdateResponse.message &&
              JSON.stringify(x.priceUpdateResponse.message).indexOf(
                "ERROR:422",
              ) >= 0
            ) {
              logAnalysisInfo.failure422Count++;
            }
            if (
              x.priceUpdateResponse &&
              x.priceUpdateResponse.message &&
              x.priceUpdateResponse.message.statusCode &&
              x.priceUpdateResponse.message.statusCode != 200
            ) {
              logAnalysisInfo.failureOtherCount++;
            }
          }
        }
      }
    }
  } catch (ex) {
    console.log(ex);
  }
  return logAnalysisInfo;
}

const getCustomCronDetails = asyncHandler(async (req, res) => {
  const requestedPayload = req.body;
  let logViewModel = [];
  let pgNo = 0;
  let cronId = "";
  let totalRecords = requestedPayload.totalRecords
    ? parseInt(requestedPayload.totalRecords)
    : 25;
  let date = {
    fromDate: new Date(requestedPayload.startDate),
    toDate: new Date(requestedPayload.endDate),
  };
  pgNo = requestedPayload.pgno - 1 || 0;
  if (pgNo < 0) {
    pgNo = 0;
  }
  const type = requestedPayload.cronType;
  if (requestedPayload.cronId != "" && requestedPayload.cronId != "ALL") {
    cronId = requestedPayload.cronId;
  }
  let cronLogs = await mongoMiddleware.GetCronLogsV2(
    pgNo,
    type,
    cronId,
    date,
    totalRecords,
  );
  let logsList = cronLogs.mongoResult.sort(
    (a, b) => new Date(a.time) - new Date(b.time),
  );
  let cronSettings = await mongoMiddleware.GetCronSettingsList();
  const slowCronSettings = await mongoMiddleware.GetSlowCronDetails();
  cronSettings = _.concat(cronSettings, slowCronSettings);
  if (logsList && logsList.length > 0) {
    let idx = 0;
    for (let log of logsList) {
      const existingModel = _.find(logViewModel, (existing) => {
        if (existing.logData._id.toString() == log._id.toString()) {
          return true;
        }
      });
      if (!existingModel) {
        try {
          let _$cronLog = new CronLogs(log, idx++);
          const logAnalysisInfo = await getLogAnalysis(log);
          _$cronLog.repricedProductCount = await getRepricerCount(log);
          _$cronLog.successScrapeCount = logAnalysisInfo.successCount;
          _$cronLog.failureScrapeCount = logAnalysisInfo.failureCount;
          _$cronLog.repriceFailure422Count = logAnalysisInfo.failure422Count;
          _$cronLog.repriceFailureOtherCount =
            logAnalysisInfo.failureOtherCount;
          _$cronLog.cronName = cronSettings.find(
            (t) => t.CronId == log.cronId,
          ).CronName;
          logViewModel.unshift(_$cronLog);
        } catch (ex) {
          console.log(
            `Error while Mapping cron log ${log._id.toString()} with error ${ex.message}`,
          );
        }
      }
    }
  }
  return res.json({
    status: true,
    message: logViewModel,
  });
});

module.exports = {
  getCronLogs,
  getRawJson,
  downloadLog,
  getLogsDetails,
  exportData,
  exportBulkData,
  exportBulkDataCRON,
  listDownloads,
  downloadFile,
  deleteFile,
  updatePrice,
  updateAll,
  updatePriceExternal,
  exportDataV2,
  getFilterCronLogsByLimit,
  getCurrentTasks,
  getCronHistoryLogs,
  getCustomCronDetails,
};
