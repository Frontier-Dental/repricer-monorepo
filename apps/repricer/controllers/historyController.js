const _ = require("lodash");
const uuid = require("uuid");
const asyncHandler = require("express-async-handler");
const mongoMiddleware = require("../middleware/mongoMiddleware");
const excelJs = require("exceljs");
var path = require("path");
const fs = require("fs");
const moment = require("moment");
const Item = require("../models/item");
const historyExportMiddleware = require("../middleware/historyExportMiddleware");
const ExportModel = require("../models/exportModel");
const SessionHelper = require("../Utility/SessionHelper");
const ftpMiddleware = require("../middleware/ftpMiddleware");

const getHistory = asyncHandler(async (req, res) => {
  const maxProductsCount = 65; //await Item.countDocuments({ activated: true });
  let viewObject = {};
  viewObject.maxCount = Math.ceil(
    maxProductsCount / parseInt(process.env.HISTORY_LIMIT),
  );
  viewObject.batchLimit = process.env.HISTORY_LIMIT;
  viewObject.totalCount = maxProductsCount;
  res.render("pages/history/index", {
    model: viewObject,
    groupName: "history",
    userRole: req.session.users_id.userRole,
  });
});

const exportHistory = asyncHandler(async (req, res) => {
  const { searchBy, param1, param2, param3, counter } = req.query;
  let excelOutput = [];
  if (_.isEqual(searchBy, "srchMpId")) {
    let mongoResponse = null;
    if (param2 && param3) {
      const startDate = new Date(param2).setHours(0, 0, 0, 0);
      const endDate = new Date(param3).setHours(23, 59, 59, 59);
      mongoResponse = await mongoMiddleware.GetHistoryDetailsForIdByDate(
        parseInt(param1),
        startDate,
        endDate,
      );
    } else {
      mongoResponse = await mongoMiddleware.GetHistoryDetailsForId(
        parseInt(param1),
      );
    }
    if (
      mongoResponse &&
      mongoResponse.historicalLogs &&
      mongoResponse.historicalLogs.length > 0
    ) {
      for (const h of mongoResponse.historicalLogs) {
        excelOutput = await flattenObject(h, mongoResponse.mpId, excelOutput);
      }
    }
  } else if (_.isEqual(searchBy, "srchDate")) {
    const startDate = new Date(param1).setHours(0, 0, 0, 0);
    const endDate = new Date(param2).setHours(23, 59, 59, 59);
    const mongoResponse = await mongoMiddleware.GetHistoryDetailsForDateRange(
      startDate,
      endDate,
      counter,
    );
    if (mongoResponse && mongoResponse.length > 0) {
      for (const mr of mongoResponse) {
        if (mr.historicalLogs.length > 0) {
          for (const h of mr.historicalLogs) {
            excelOutput = await flattenObject(h, mr.mpId, excelOutput);
          }
        }
      }
    }
  }
  if (true) {
    const workbook = new excelJs.Workbook();
    const worksheet = workbook.addWorksheet("HistoryList");

    worksheet.columns = [
      { header: "MPID", key: "mpId", width: 20 },
      { header: "ScrapeTime", key: "refTime", width: 20 },
      { header: "Existing Price", key: "existingPrice", width: 20 },
      { header: "Min Quantity", key: "minQty", width: 20 },
      { header: "Rank as per Response", key: "rank", width: 20 },
      { header: "Lowest Vendor Name", key: "lowestVendor", width: 20 },
      { header: "Lowest Vendor Price", key: "lowestPrice", width: 20 },
      { header: "Max Vendor Name", key: "maxVendor", width: 20 },
      { header: "Max Vendor Price", key: "maxVendorPrice", width: 20 },
      { header: "Suggested Price", key: "suggestedPrice", width: 20 },
      { header: "Comment", key: "repriceComment", width: 20 },
      { header: "Other Vendors", key: "otherVendorList", width: 100 },
      { header: "Net32 API Response", key: "api_response", width: 100 },
    ];
    worksheet.addRows(excelOutput);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + `history_batch_${counter}.xlsx`,
    );

    return workbook.xlsx.write(res).then(function () {
      res.status(200).end();
    });
  }
});

const getAllHistory = asyncHandler(async (req, res) => {
  const { param1, param2 } = req.body;
  const uniqueKey = _.last(uuid.v4().toString().split("-")).trim();
  const historyFileName = `history-${uniqueKey}-${param1}-TO-${param2}.csv`;
  try {
    const startDate = new Date(param1).setHours(0, 0, 0, 0);
    const endDate = new Date(param2).setHours(23, 59, 59, 59);
    const auditInfo = await SessionHelper.GetAuditInfo(req);
    const initPayload = new ExportModel(
      "IN-PROGRESS",
      historyFileName,
      new Date(),
      new Date(),
      auditInfo.UpdatedBy,
    );
    await mongoMiddleware.InitExportStatus(initPayload);
    historyExportMiddleware.ExportAndSaveV2(
      startDate,
      endDate,
      historyFileName,
      auditInfo,
    );
  } catch (exception) {
    console.log(`Exception in getAllHistory with Error : ${exception}`);
  }
  return res.json({
    status: true,
    message: `The export request is being worked upon. Kindly download the same once ready from Downloads. FileName : ${historyFileName}`,
  });
});

const getHistoryById = asyncHandler(async (req, res) => {
  const { param1, param2, param3 } = req.body;
  const uniqueKey = _.last(uuid.v4().toString().split("-")).trim();
  const historyFileName = `history-${uniqueKey}-${param1}-${param2}-TO-${param3}.csv`;
  try {
    const mpid = param1.trim();
    const startDate = new Date(param2).setHours(0, 0, 0, 0);
    const endDate = new Date(param3).setHours(23, 59, 59, 59);
    const auditInfo = await SessionHelper.GetAuditInfo(req);
    const initPayload = new ExportModel(
      "IN-PROGRESS",
      historyFileName,
      new Date(),
      new Date(),
      auditInfo.UpdatedBy,
    );
    await mongoMiddleware.InitExportStatus(initPayload);
    historyExportMiddleware.ExportAndSaveByIdV2(
      mpid,
      startDate,
      endDate,
      historyFileName,
      auditInfo,
    );
  } catch (exception) {
    console.log(`Exception in getAllHistory with Error : ${exception}`);
  }
  return res.json({
    status: true,
    message: `The export request is being worked upon. Kindly download the same once ready from Downloads. FileName : ${historyFileName}`,
  });
});

const downloadFile = asyncHandler(async (req, res) => {
  const filename = req.params.file;
  const remotePath = `/REPRICER/DEV_HISTORY/${filename}`;
  const localPath = path.join(__dirname, `${filename}`);
  await ftpMiddleware.DownloadFile(remotePath, localPath);
  res.download(localPath, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error downloading file");
    } else {
      // Optionally delete the file after sending
      fs.unlink(localPath, (err) => {
        if (err) {
          console.error(err);
        }
      });
    }
  });
});

async function flattenObject(history, mpid, output) {
  try {
    if (
      history &&
      history.historicalPrice &&
      history.historicalPrice.length > 0
    ) {
      for (const p of history.historicalPrice) {
        let flat = _.cloneDeep(p);
        flat.mpId = mpid;
        flat.refTime = moment(history.refTime).format("LLL");
        flat.api_response = p.apiResponse
          ? JSON.stringify(p.apiResponse)
          : "N/A";
        output.push(flat);
      }
    }
  } catch (exception) {
    console.log(
      `Exception in flattenObject for ${mpid} || Error : ${exception}`,
    );
  }
  return output;
}

module.exports = {
  getHistory,
  exportHistory,
  getAllHistory,
  downloadFile,
  getHistoryById,
};
