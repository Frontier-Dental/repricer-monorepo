import excelJs from "exceljs";
import { Request, Response } from "express";
import fs from "fs";
import _ from "lodash";
import moment from "moment";
import path from "path";
import { v4 } from "uuid";
import * as ftpMiddleware from "../services/ftp";
import * as historyExportMiddleware from "../utility/history-export";
import * as mongoMiddleware from "../services/mongo";
import ExportModel from "../models/export-model";
import * as SessionHelper from "../utility/session-helper";
import { applicationConfig } from "../utility/config";
import { InitExportStatus } from "../services/mysql-v2";

export async function getHistory(req: Request, res: Response) {
  const maxProductsCount = 65; //await Item.countDocuments({ activated: true });
  let viewObject: any = {};
  viewObject.maxCount = Math.ceil(maxProductsCount / applicationConfig.HISTORY_LIMIT);
  viewObject.batchLimit = applicationConfig.HISTORY_LIMIT;
  viewObject.totalCount = maxProductsCount;
  res.render("pages/history/index", {
    model: viewObject,
    groupName: "history",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function exportHistory(req: Request, res: Response) {
  const { searchBy, param1, param2, param3, counter } = req.query;
  let excelOutput = [];
  if (_.isEqual(searchBy, "srchMpId")) {
    let mongoResponse: any = null;
    if (param2 && param3) {
      const startDate = new Date(param2 as string).setHours(0, 0, 0, 0);
      const endDate = new Date(param3 as string).setHours(23, 59, 59, 59);
      mongoResponse = await mongoMiddleware.GetHistoryDetailsForIdByDate(parseInt(param1 as string), startDate, endDate);
    } else {
      mongoResponse = await mongoMiddleware.GetHistoryDetailsForId(parseInt(param1 as string));
    }
    if (mongoResponse && mongoResponse.historicalLogs && mongoResponse.historicalLogs.length > 0) {
      for (const h of mongoResponse.historicalLogs) {
        excelOutput = await flattenObject(h, mongoResponse.mpId, excelOutput);
      }
    }
  } else if (_.isEqual(searchBy, "srchDate")) {
    const startDate = new Date(param1 as string).setHours(0, 0, 0, 0);
    const endDate = new Date(param2 as string).setHours(23, 59, 59, 59);
    const mongoResponse = await mongoMiddleware.GetHistoryDetailsForDateRange(startDate, endDate, counter);
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
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=" + `history_batch_${counter}.xlsx`);

    return workbook.xlsx.write(res).then(function () {
      res.status(200).end();
    });
  }
}

export async function getAllHistory(req: Request, res: Response) {
  const { param1, param2 } = req.body;
  const uniqueKey = _.last(v4().toString().split("-"))!.trim();
  const historyFileName = `history-${uniqueKey}-${param1}-TO-${param2}.csv`;
  const startDate = new Date(param1 as string).setHours(0, 0, 0, 0);
  const endDate = new Date(param2 as string).setHours(23, 59, 59, 59);
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  const initPayload = new ExportModel("IN-PROGRESS", historyFileName, new Date(), new Date(), auditInfo.UpdatedBy);
  await InitExportStatus(initPayload);
  historyExportMiddleware.ExportAndSaveV2(startDate, endDate, historyFileName, auditInfo);
  return res.json({
    status: true,
    message: `The export request is being worked upon. Kindly download the same once ready from Downloads. FileName : ${historyFileName}`,
  });
}

export async function getHistoryById(req: Request, res: Response) {
  const { param1, param2, param3 } = req.body;
  const uniqueKey = _.last(v4().toString().split("-"))!.trim();
  const historyFileName = `history-${uniqueKey}-${param1}-${param2}-TO-${param3}.csv`;
  const mpid = param1.trim();
  const startDate = new Date(param2).setHours(0, 0, 0, 0);
  const endDate = new Date(param3).setHours(23, 59, 59, 59);
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  const initPayload = new ExportModel("IN-PROGRESS", historyFileName, new Date(), new Date(), auditInfo.UpdatedBy);
  await InitExportStatus(initPayload);
  historyExportMiddleware.ExportAndSaveByIdV2(mpid, startDate, endDate, historyFileName, auditInfo);
  return res.json({
    status: true,
    message: `The export request is being worked upon. Kindly download the same once ready from Downloads. FileName : ${historyFileName}`,
  });
}

export async function downloadFile(req: Request, res: Response) {
  const filename = req.params.file;
  const remotePath = applicationConfig.IS_DEV ? `/REPRICER/DEV_HISTORY/${filename}` : `/REPRICER/HISTORY/${filename}`;
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
}

async function flattenObject(history: any, mpid: any, output: any) {
  if (history && history.historicalPrice && history.historicalPrice.length > 0) {
    for (const p of history.historicalPrice) {
      let flat = _.cloneDeep(p);
      flat.mpId = mpid;
      flat.refTime = moment(history.refTime).format("LLL");
      flat.api_response = p.apiResponse ? JSON.stringify(p.apiResponse) : "N/A";
      output.push(flat);
    }
  }
  return output;
}
