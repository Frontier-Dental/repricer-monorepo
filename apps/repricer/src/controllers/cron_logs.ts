import dayJs from "dayjs";
import excelJs from "exceljs";
import fs from "fs";
import _ from "lodash";
import moment from "moment";
import path from "path";
import * as cronMiddleware from "../services/cron";
import * as httpMiddleware from "../utility/http-wrappers";
import * as mongoMiddleware from "../services/mongo";
import CronLogs from "../models/cron-logs";
import EnvSettings from "../models/env-settings";
import Exports from "../models/exports";
import UpdateRequest from "../models/update-request";
import { Request, Response } from "express";
import * as ftpMiddleware from "../services/ftp";
import * as scrapeOnlyMiddleware from "../middleware/scrape-only";
import { applicationConfig } from "../utility/config";

let _contextLog: any = null;

/**
 * Formats a date to EDT timezone in the format:
 * "Fri Oct 10 2025 18:03:31 GMT-0400 (Eastern Daylight Time)"
 */
function formatDateToEDT(date: Date): string {
  // Get date parts in EDT timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      partMap[part.type] = part.value;
    }
  });

  // Get timezone name (long format)
  const tzFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "long",
  });
  const tzParts = tzFormatter.formatToParts(date);
  const tzName =
    tzParts.find((p) => p.type === "timeZoneName")?.value ||
    "Eastern Daylight Time";

  // Determine offset based on whether it's DST or not
  // EDT is -4, EST is -5
  const isDST = tzName.includes("Daylight");
  const offset = isDST ? "-0400" : "-0500";

  // Pad hour to 2 digits
  const hour = partMap.hour.padStart(2, "0");

  return `${partMap.weekday} ${partMap.month} ${partMap.day} ${partMap.year} ${hour}:${partMap.minute}:${partMap.second} GMT${offset} (${tzName})`;
}

export async function getCronLogs(req: Request, res: Response) {
  let logViewModel: any[] = [];
  let pgNo = 0;
  let date: any = {
    fromDate: "",
    toDate: "",
  };

  if (req.query.pgno) {
    pgNo = (req.query.pgno as any) - 1;
  }
  if (req.query.fromDate && req.query.toDate) {
    date.fromDate = req.query.fromDate;
    date.toDate = req.query.toDate;
  }
  const type = req.query.type ? req.query.type : "";

  let group = "";
  let cronId = "";
  let cronSettings = await mongoMiddleware.GetCronSettingsList();
  const slowCronSettings = await mongoMiddleware.GetSlowCronDetails();
  cronSettings = _.concat(cronSettings, slowCronSettings);
  if (req.query.group) {
    if (req.query.group != "") {
      group = req.query.group as string;
      cronId = cronSettings.find((x: any) => x.CronName == group)?.CronId;
    }
  }

  let cronLogs = await mongoMiddleware.GetCronLogs(
    pgNo,
    type as any,
    cronId,
    date,
  );
  const logsList: any = cronLogs.mongoResult.sort(
    (a: any, b: any) =>
      (new Date(a.time as any) as any) - (new Date(b.time as any) as any),
  );
  if (logsList && logsList.length > 0) {
    let idx = 0;
    for (let log of logsList) {
      const existingModel = _.find(logViewModel, (existing: any) => {
        if (existing.logData._id.toString() == log._id.toString()) {
          return true;
        }
      });
      if (!existingModel) {
        let _$cronLog: any = new CronLogs(log, idx++);
        _$cronLog.repricedProductCount = getRepricerCount(log);
        _$cronLog.successScrapeCount = getScrapeCountByFlag(log, 1); // SUCCESS:1
        _$cronLog.failureScrapeCount = getScrapeCountByFlag(log, 0); // FAILURE:0
        _$cronLog.repriceFailure422Count = getRepriceFailureByType(log, 1); //422-Error:1
        _$cronLog.repriceFailureOtherCount = getRepriceFailureByType(log, 0); //Any Other Error:0
        _$cronLog.cronName = cronSettings.find(
          (t: any) => t.CronId == log.cronId,
        )?.CronName;
        logViewModel.unshift(_$cronLog);
      }
    }
  }
  let cronStatus = await mongoMiddleware.GetLatestCronStatus();
  if (cronStatus && cronStatus.length > 0) {
    cronStatus.forEach((x: any) => {
      if (x.cronId) {
        try {
          x.cronName = cronSettings.find(
            (t: any) => t.CronId == x.cronId,
          )?.CronName;
        } catch (ex) {
          x.cronName = x.cronId;
        }
      }
    });
  }
  let filterCronLogs = await mongoMiddleware.GetFilterCronLogsByLimit(
    applicationConfig.FILTER_CRON_LOGS_LIMIT,
  );
  const filterCronDetails = await mongoMiddleware.GetFilteredCrons();
  _.forEach(filterCronLogs, (x: any) => {
    x.filterDate = moment(x.filterDate).format("DD-MM-YY HH:mm:ss");
    x.startTime = moment(x.startTime).format("DD-MM-YY HH:mm:ss");
    x.endTime = moment(x.endTime).format("DD-MM-YY HH:mm:ss");
    x.cronName = filterCronDetails.find(
      (c: any) => c.cronId == x.contextCronId,
    )?.cronName;
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
    userRole: (req as any).session.users_id.userRole,
  };
  res.render("pages/dashboard/list", params);
}

export async function getLogsDetails(req: Request, res: Response) {
  const idx = req.params.id;
  let cronObject = await getCustomLogsDetailsById(idx as any);
  res.render("pages/dashboard/logViewer", {
    items: cronObject,
    groupName: "dashboard",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function getRawJson(req: Request, res: Response) {
  _contextLog = null;
  const mpid = req.params.mpId;
  const idx = req.params.idx;
  const vendor = req.params.vendor;
  let cronObject = await getCustomLogsDetailsById(idx);
  if (cronObject) {
    _.forEach(cronObject.logData.logs, ($log) => {
      if ((_.first($log as any) as any).productId == mpid) {
        _contextLog = $log.find((x: any) => x.vendor == vendor);
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
      userRole: (req as any).session.users_id.userRole,
    });
  }
}

export async function downloadLog(req: Request, res: Response) {
  let today = dayJs();
  const fileName = `log_${_contextLog.productId}_${today.format("YYYY_MM_DD_h_mm_ss")}.json`;
  fs.writeFileSync(fileName, _contextLog.serializedData);
  res.download(fileName, (err) => {
    if (err) {
      console.log(err);
    }
    fs.unlinkSync(fileName);
  });
}

export async function exportData(req: Request, res: Response) {
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
}

export async function exportBulkData(req: Request, res: Response) {
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
      userRole: (req as any).session.users_id.userRole,
    });
  }
}

export async function exportBulkDataCRON() {
  let cronLogs: any = [];
  let date: any = {
    fromDate: "",
    toDate: "",
  };
  let inProgressExport = await mongoMiddleware.CheckInProgressExport();
  console.log(inProgressExport);
  let queuedExport: any = null;
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
      if (updateExportStatus?.lastErrorObject?.updatedExisting) {
        date.fromDate = new Date(queuedExport.fromDate);
        date.toDate = new Date(queuedExport.toDate);
        console.log(date);

        try {
          console.log("CRON Log: Export batch started...");

          // creating cron object
          let exportStartedOn = new Date();
          cronLogs = (await mongoMiddleware.GetCronLogs(
            undefined as any,
            "",
            "",
            date,
          )) as any;
          let logVM: any[] = [];
          let logsList = cronLogs.mongoResult.sort(
            (a: any, b: any) =>
              (new Date(a.time as any) as any) -
              (new Date(b.time as any) as any),
          );
          if (logsList && logsList.length > 0) {
            let idx = 0;
            logsList.forEach((log: any) => {
              const existingModel = _.find(logVM, (existing: any) => {
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

            var itemCollection: any[] = [],
              rowCount = 0,
              errorRowCount = 0,
              dates = cronObj.length;
            let cObj = startIndex;
            for (var obj of cronObj) {
              let collection = await getExcelItemCollection(obj, errorRowCount);
              itemCollection.push(collection as never);
              console.log("Fetched item collection " + ++cObj);
            }
            console.log("itemCollection created...");
            const bulkItemCollection: any[] = [].concat.apply(
              [],
              itemCollection,
            );
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
              batchedItemCollection: any[] = [],
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
              let parsedData = JSON.parse(file as any);
              batchedItemCollection.push(parsedData as never);
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
            const mergedItemCollection: any[] = [].concat.apply(
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

async function getExcelItemCollection(cronObject: any, errorRows = 0) {
  let collection: any[] = [];
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
        let _contextRow: any = _.cloneDeep(_.first(itemDetails));
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
        _contextRow.isPriceUpdated = row.priceUpdated
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

export async function listDownloads(req: Request, res: Response) {
  let fileNames: any = await ftpMiddleware.GetAllFileDetails();
  let exportsList: any[] = [];
  if (fileNames && fileNames.length > 0) {
    for (const fileName of fileNames) {
      const fileDetailsInDb = await mongoMiddleware.GetExportFileStatus(
        fileName.name as any,
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
        exportsList.push(obj as never);
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
      exportsList.push(obj as never);
    });
  }
  exportsList = _.sortBy(exportsList, ["createdOn"]);
  let params = {
    files: exportsList,
    groupName: "downloads",
    userRole: (req as any).session.users_id.userRole,
  };
  res.render("pages/downloads/exports", params);
}

export async function downloadFile(req: Request, res: Response) {
  const filename = req.params.file;
  var directoryPath = path.join(__dirname, "../exports/");

  res.download(directoryPath + filename + ".xlsx", (err) => {
    if (err) {
      console.log(err);
    }
  });
}

export async function deleteFile(req: Request, res: Response) {
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
}

export async function updatePrice(req: Request, res: Response) {
  _contextLog = null;
  const mpid = req.params.mpId;
  const idx = req.params.idx;
  const envInfo: any = await EnvSettings.findOne();
  const cronObject = await getCustomLogsDetailsById(idx);
  if (cronObject) {
    _contextLog = cronObject.logData.logs.find((x: any) => x.productId == mpid);
    const ownLog = _contextLog.logs.sourceResult.find(
      (x: any) => x.vendorId == envInfo.ownVendorId,
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
}

export async function updateAll(req: Request, res: Response) {
  const idx = req.params.idx;
  const cronObject = await getCustomLogsDetailsById(idx);
  const envInfo: any = await EnvSettings.findOne();
  let listOfProducts: any[] = [];
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
          (x: any) => x.vendorId == envInfo.ownVendorId,
        );
        const request = new UpdateRequest(
          product.productId,
          product.logs.repriceData.vendorProductCode,
          product.logs.repriceData.repriceDetails.newPrice,
          ownLog.inventory,
        );
        listOfProducts.push(request as never);
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
}

export async function updatePriceExternal(req: Request, res: Response) {
  const updatedRequest = req.body;
  const updatedResponse = await httpMiddleware.updatePrice(updatedRequest);
  console.log(
    `${updatedRequest.payload.cronName} : PRICE_UPDATE_SUCCESS : ${JSON.stringify(updatedResponse)}`,
  );
  return res.json({
    status: true,
    message: updatedResponse,
  });
}

function getMultiPriceOldPrice(listOfRepriceDetails: any[]) {
  if (listOfRepriceDetails) {
    let newPriceDetails: any[] = [];
    listOfRepriceDetails.forEach((price) => {
      newPriceDetails.push(`${price.minQty}@${price.oldPrice}` as never);
    });
    return newPriceDetails.join(",");
  }
  return "";
}

function getMultiPriceNewPrice(listOfRepriceDetails: any[]) {
  if (listOfRepriceDetails) {
    let newPriceDetails: any[] = [];
    listOfRepriceDetails.forEach((price) => {
      newPriceDetails.push(`${price.minQty}@${price.newPrice}` as never);
    });
    return newPriceDetails.join(",");
  }
  return "";
}

function getMultiPriceComments(listOfRepriceDetails: any[]) {
  if (listOfRepriceDetails) {
    let newPriceComments: any[] = [];
    listOfRepriceDetails.forEach((price) => {
      newPriceComments.push(`${price.minQty}@${price.explained}` as never);
    });
    return newPriceComments.join(",");
  }
  return "";
}

async function getCustomLogsDetailsById(logId: any) {
  const logResponse = await mongoMiddleware.GetLogsById(logId);
  return new CronLogs(_.first(logResponse), 0);
}

function getRepricerCount(logList: any) {
  if (logList) {
    if (logList.RepricedProductCount)
      return logList.RepricedProductCount.toString();
    let repricedProductList = 0;
    _.forEach(logList.logs, (vendorLog: any) => {
      if (vendorLog.length > 0) {
        _.forEach(vendorLog, (x: any) => {
          if (x.priceUpdated) {
            repricedProductList++;
          }
        });
      }
    });
    return repricedProductList.toString();
  }
  return "N/A";
}

function getScrapeCountByFlag(logList: any, flag: any) {
  let uniqueProductArray: any[] = [];
  if (logList) {
    _.forEach(logList.logs, (vendorLogs: any) => {
      if (vendorLogs.length > 0) {
        _.forEach(vendorLogs, (x: any) => {
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
  return uniqueProductArray.length;
}

function getRepriceFailureByType(logList: any, flag: any) {
  let resultantCount = 0;
  if (logList) {
    _.forEach(logList.logs, (vendorLogs: any) => {
      if (vendorLogs.length > 0) {
        _.forEach(vendorLogs, (x: any) => {
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
  return resultantCount;
}

export async function exportDataV2(req: Request, res: Response) {
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
}

async function getExcelItemCollectionV2(cronObject: any, errorRows = 0) {
  let collection: any[] = [];
  if (cronObject && cronObject.logData && cronObject.logData.logs) {
    let cRow = 0;
    for (const row of cronObject.logData.logs) {
      ++cRow;
      try {
        if (row.length > 0) {
          for (const vRow of row) {
            let _contextRow: any = {};
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
            _contextRow.isPriceUpdated = vRow.priceUpdated
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

export async function getFilterCronLogsByLimit(req: Request, res: Response) {
  const logsLimit = parseInt(req.params.noOfLogs);
  let filterCronLogsResult =
    await mongoMiddleware.GetFilterCronLogsByLimit(logsLimit);
  if (filterCronLogsResult && filterCronLogsResult.length > 0) {
    const filterCronDetails = await mongoMiddleware.GetFilteredCrons();
    _.forEach(filterCronLogsResult, (x: any) => {
      x.filterDate = moment(x.filterDate).format("DD-MM-YY HH:mm:ss");
      x.startTime = moment(x.startTime).format("DD-MM-YY HH:mm:ss");
      x.endTime = moment(x.endTime).format("DD-MM-YY HH:mm:ss");
      x.cronName = filterCronDetails.find(
        (c: any) => c.cronId == x.contextCronId,
      ).cronName;
    });
  }
  return res.json({
    status: true,
    cronLogs: filterCronLogsResult,
  });
}

async function getInProgressRegularSecondaryAndExpressCrons() {
  let cronSettings = await mongoMiddleware.GetCronSettingsList();
  const slowCronSettings = await mongoMiddleware.GetSlowCronDetails();
  cronSettings = _.concat(cronSettings, slowCronSettings);
  let cronStatus = await mongoMiddleware.GetLatestCronStatus();

  if (cronStatus && cronStatus.length > 0) {
    cronStatus.forEach((x: any) => {
      if (x.cronId) {
        try {
          x.cronName = cronSettings.find(
            (t: any) => t.CronId == x.cronId,
          )?.CronName;
        } catch (ex) {
          x.cronName = x.cronId;
        }
      }
      // Format cronTime to Eastern Time with full format
      if (x.cronTime) {
        x.cronTime = formatDateToEDT(new Date(x.cronTime));
      }
    });
  }

  return cronStatus;
}

export async function getInProgressRegularCrons(req: Request, res: Response) {
  try {
    const cronStatus = await getInProgressRegularSecondaryAndExpressCrons();

    return res.json({
      status: true,
      cronStatus: cronStatus || [],
    });
  } catch (error) {
    console.error("Error getting in-progress regular crons:", error);
    return res.json({
      status: false,
      cronStatus: [],
      error: error,
    });
  }
}

export async function getCurrentTasks(req: Request, res: Response) {
  let params = {
    cronStatus: await getInProgressRegularSecondaryAndExpressCrons(),
    groupName: "tasks",
    userRole: (req as any).session.users_id.userRole,
  };
  res.render("pages/dashboard/currentTasks", params);
}

export async function getInProgressScrapeCrons(req: Request, res: Response) {
  try {
    const scrapeCronStatus =
      await scrapeOnlyMiddleware.GetRecentInProgressScrapeRuns();

    const enrichedCronStatus = scrapeCronStatus.map((item: any) => {
      return {
        cronTime: item.CronStartTime
          ? formatDateToEDT(new Date(item.CronStartTime))
          : "-",
        keyGenId: item.KeyGenId,
        cronName: item.CronName,
        eligibleCount: item.EligibleCount || 0,
        productsCompleted: item.CompletedProductCount || 0,
        status: item.Status,
      };
    });

    return res.json({
      status: true,
      scrapeCronStatus: enrichedCronStatus || [],
    });
  } catch (error) {
    console.error("Error getting in-progress scrape crons:", error);
    return res.json({
      status: false,
      scrapeCronStatus: [],
      error: error,
    });
  }
}

export async function getCronHistoryLogs(req: Request, res: Response) {
  console.log("getCronHistoryLogs");
  let logViewModel: any = [];
  let pgNo = 0;
  let pgLimit = 10; // item per page - default
  let totalRecords = 25; // used for limit in db Query - default

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0); // Set to 00:00:00.000

  // Get today's end date
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 0, 0); // Set to 23:59:59.999

  let date: any = {
    fromDate: "",
    toDate: "",
  };

  if (req.query.fromDate && req.query.toDate) {
    date.fromDate = new Date(req.query.fromDate as any);
    date.toDate = new Date(req.query.toDate as any);
  } else {
    date.fromDate = startOfToday;
    date.toDate = endOfToday;
  }

  if (req.query.pgno) {
    pgNo = (req.query.pgno as any) - 1 || 0;
    if (pgNo < 0) {
      pgNo = 0;
    }
  }

  if (req.query.pageSize) {
    pgLimit = (req.query.pageSize as any) || 25;
  }

  // total records - query from DB
  if (req.query.totalRecords) {
    totalRecords = (req.query.totalRecords as any) || 25;
    pgLimit = totalRecords; //temp
  }

  const type = req.query.cronType
    ? (req.query.cronType as any)
    : "ALL_EXCEPT_422";

  let group = "";
  let cronId = "";

  // Parallelize database queries for better performance
  const [
    cronSettingsBase,
    slowCronSettings,
    scrapeOnlyCronSettings,
    cronStatus,
  ] = await Promise.all([
    mongoMiddleware.GetCronSettingsList(),
    mongoMiddleware.GetSlowCronDetails(),
    mongoMiddleware.GetScrapeCrons(),
    mongoMiddleware.GetLatestCronStatus(),
  ]);

  // Combine all cron settings
  let cronSettings = _.concat(
    cronSettingsBase,
    slowCronSettings,
    scrapeOnlyCronSettings,
  );

  // Create a map for O(1) lookup instead of using find() repeatedly
  const cronSettingsMap = new Map();
  cronSettings.forEach((cron: any) => {
    const id = cron.CronId || cron.cronId;
    const name = cron.CronName || cron.cronName;
    if (id) cronSettingsMap.set(id, name);
  });

  if (cronStatus && cronStatus.length > 0) {
    cronStatus.forEach((x: any) => {
      if (x.cronId) {
        x.cronName = cronSettingsMap.get(x.cronId) || x.cronId;
      }
    });
  }

  if (req.query.cronId) {
    if (req.query.cronId != "" && req.query.cronId != "ALL") {
      cronId = req.query.cronId as any;
    }
  }

  let cronLogs: any = null;
  if (type == "SCRAPE_ONLY") {
    // Use the stored procedure for scrape only cron runs
    const scrapeRuns =
      await scrapeOnlyMiddleware.GetRecentInProgressScrapeRuns();
    cronLogs = {
      mongoResult: [],
      pageSize: pgLimit,
      pageNumber: pgNo,
      totalDocs: scrapeRuns.length,
      totalPages: Math.ceil(scrapeRuns.length / pgLimit),
    };
    // Assign the scrape runs directly for processing
    logViewModel = scrapeRuns;
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
      (a: any, b: any) =>
        (new Date(a.time as any) as any) - (new Date(b.time as any) as any),
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
          let _$cronLog: any = new CronLogs(log, idx++);
          const logAnalysisInfo = getLogAnalysis(log);
          _$cronLog.repricedProductCount = getRepricerCount(log);
          _$cronLog.successScrapeCount = logAnalysisInfo.successCount;
          _$cronLog.failureScrapeCount = logAnalysisInfo.failureCount;
          _$cronLog.repriceFailure422Count = logAnalysisInfo.failure422Count;
          _$cronLog.repriceFailureOtherCount =
            logAnalysisInfo.failureOtherCount;
          _$cronLog.cronName = cronSettings.find(
            (t: any) => t.CronId == log.cronId,
          )?.CronName;
          logViewModel.unshift(_$cronLog);
        }
      }
    }
  } else if (type == "SCRAPE_ONLY") {
    // logViewModel already assigned above when fetching scrape runs
  }
  // filterCronLogs
  let filterCronLogs = await mongoMiddleware.GetFilterCronLogsByLimit(
    applicationConfig.FILTER_CRON_LOGS_LIMIT,
  );
  const filterCronDetails = await mongoMiddleware.GetFilteredCrons();
  _.forEach(filterCronLogs, (x: any) => {
    x.filterDate = moment(x.filterDate).format("DD-MM-YY HH:mm:ss");
    x.startTime = moment(x.startTime).format("DD-MM-YY HH:mm:ss");
    x.endTime = moment(x.endTime).format("DD-MM-YY HH:mm:ss");
    x.cronName = filterCronDetails.find(
      (c: any) => c.cronId == x.contextCronId,
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
    cronSettings: cronSettings,
    cronTypes: cronTypes,
    date,
    type,
    pageSize: cronLogs.pageSize,
    pageNumber: cronLogs.pageNumber,
    totalDocs: cronLogs.totalDocs,
    totalPages: cronLogs.totalPages,
    userRole: (req as any).session.users_id.userRole,
  });
}

function getLogAnalysis(logList: any) {
  let uniqueSuccessProductArray: any[] = [];
  let uniqueFailureProductArray: any[] = [];
  let logAnalysisInfo: any = {
    successCount: 0,
    failureCount: 0,
    failure422Count: 0,
    failureOtherCount: 0,
  };
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
  return logAnalysisInfo;
}

export async function getCustomCronDetails(req: Request, res: Response) {
  const requestedPayload = req.body;
  let logViewModel: any[] = [];
  let pgNo = 0;
  let cronId = "";
  let totalRecords = requestedPayload.totalRecords
    ? parseInt(requestedPayload.totalRecords)
    : 25;
  let date: any = {
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
    (a: any, b: any) =>
      (new Date(a.time as any) as any) - (new Date(b.time as any) as any),
  );
  let cronSettings = await mongoMiddleware.GetCronSettingsList();
  const slowCronSettings = await mongoMiddleware.GetSlowCronDetails();
  cronSettings = _.concat(cronSettings, slowCronSettings);
  if (logsList && logsList.length > 0) {
    let idx = 0;
    for (let log of logsList) {
      const existingModel = _.find(logViewModel, (existing: any) => {
        if (existing.logData._id.toString() == log._id.toString()) {
          return true;
        }
      });
      if (!existingModel) {
        let _$cronLog: any = new CronLogs(log, idx++);
        const logAnalysisInfo = await getLogAnalysis(log);
        _$cronLog.repricedProductCount = await getRepricerCount(log);
        _$cronLog.successScrapeCount = logAnalysisInfo.successCount;
        _$cronLog.failureScrapeCount = logAnalysisInfo.failureCount;
        _$cronLog.repriceFailure422Count = logAnalysisInfo.failure422Count;
        _$cronLog.repriceFailureOtherCount = logAnalysisInfo.failureOtherCount;
        _$cronLog.cronName = cronSettings.find(
          (t: any) => t.CronId == log.cronId,
        )?.CronName;
        logViewModel.unshift(_$cronLog);
      }
    }
  }
  return res.json({
    status: true,
    message: logViewModel,
  });
}
