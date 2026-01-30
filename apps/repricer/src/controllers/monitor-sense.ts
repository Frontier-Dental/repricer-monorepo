import _ from "lodash";
import { ScheduledTask, schedule } from "node-cron";
import cron from "node-cron";
import express from "express";
import _codes from "http-status-codes";
import moment from "moment";
import { TriggerEmail } from "../middleware/storage-sense-helpers/email-helper";
import { applicationConfig } from "../utility/config";
import { postDataForExcel } from "../middleware/storage-sense-helpers/axios-helper";
import { Client } from "basic-ftp";
import path from "path";
import fs from "fs";
import * as mongoHelper from "../services/mongo";
import { GetCronSettingsList, GetSlowCronDetails } from "../services/mysql-v2";
import * as mySqlMiddleware from "../services/mysql";

export const monitorSenseController = express.Router();
var monitorCrons: Record<string, ScheduledTask> = {};
/************* PUBLIC SCHEDULED APIS *************/
export async function startAllMonitorCrons() {
  if (applicationConfig.IS_DEV) return;
  console.info(`Scheduling All Monitor CRONS on startup at ${new Date()}`);
  await startInProgressCronCheck();
  await startExpressCronValidationCheck();
  await startHistoryDeletionCron();
  await startCronLogsDeletionCron();
  console.info(`Successfully Started All Monitor CRONS Check at ${new Date()}`);
}

monitorSenseController.get("/schedule/monitor-sense/export_save", async (req, res) => {
  console.log(`Starting Export & Save Cron with Details : ${applicationConfig.EXPORT_SAVE_CRON_SCHEDULE}`);
  var _exportAndSaveCron = cron.schedule(
    applicationConfig.EXPORT_SAVE_CRON_SCHEDULE,
    async () => {
      console.log(`MONITOR-SENSE : EXPORT_SAVE : Running at ${new Date()}`);
      await StartExportAndSave();
    },
    { scheduled: true }
  );
  if (_exportAndSaveCron) {
    return res.status(_codes.OK).send(`Successfully Started Cron for Export And Save at ${new Date()}`);
  } else {
    return res.status(_codes.BAD_REQUEST).send(`Some error occurred while starting Cron for Export And Save at ${new Date()}`);
  }
});

/************* PUBLIC DEBUG APIS *************/
monitorSenseController.get("/debug/monitor-sense/cron", async (req, res) => {
  await ValidateCronDetails();
  return res.status(_codes.OK).send(`Successfully Started IN-PROGRESS CRONS Check at ${new Date()}`);
});

monitorSenseController.get("/debug/monitor-sense/422Error", async (req, res) => {
  await Validate422ErrorProductDetails();
  return res.status(_codes.OK).send(`Successfully Started Cron for 422 Product Count Validation Check at ${new Date()}`);
});

monitorSenseController.get("/debug/monitor-sense/exportAndSave", async (req, res) => {
  await StartExportAndSave();
  return res.status(_codes.OK).send(`Successfully Saved Product Data at ${new Date()}`);
});

/************* PRIVATE FUNCTIONS *************/
async function ValidateCronDetails() {
  console.info(`Running IN-PROGRESS Cron Validation Check at ${new Date()}`);
  const inProgressCronDetails = await mongoHelper.GetLatestCronStatus();
  const maxCount = applicationConfig.CRON_PROGRESS_MAX_COUNT;
  if (inProgressCronDetails && inProgressCronDetails.length > maxCount) {
    const regularCronDetails = await GetCronSettingsList();
    const slowCronDetails = await GetSlowCronDetails();
    const cronSettingsResponse = _.concat(regularCronDetails, slowCronDetails);
    inProgressCronDetails.forEach((cronDetail: any) => {
      const linkedCronDetails = cronSettingsResponse.find((x) => x.CronId === cronDetail.cronId);
      cronDetail.cronName = linkedCronDetails ? linkedCronDetails.CronName : "N/A";
      if (cronDetail.productsCount == 0 && Math.round((new Date().getTime() - cronDetail.cronTime.getTime()) / 1000) > 120) {
        //If Cron is more than 120 seconds & still Product Count is 0 -> IGNORE the CRON STATUS LOG
        mongoHelper.IgnoreCronStatusLog(cronDetail.cronId, cronDetail.keyGenId);
      }
    });
    const emailBody = await getEmailBodyForInProgressCron(inProgressCronDetails, maxCount);
    const emailSubject = `MONITOR | Attention Needed : In-Progress Cron Count Reached Maximum Limit`;
    await TriggerEmail(emailBody, emailSubject, applicationConfig.MONITOR_EMAIL_ID);
  }
}

async function getEmailBodyForInProgressCron(cronDetails: any, maxCount: any) {
  let str = `<h2>Hi, <br>Please find the In-Progress Cron Details as of now below. It has crossed the Maximum Set Limit of : <span style="color:red">${maxCount}</span></h2><br/><table border="1"><thead><tr><th scope="col">#</th><th scope="col">Cron Name</th><th scope="col">Cron Start Time</th><th scope="col">Maximum Product Count</th></tr></thead><tbody>`;
  let counter = 1;
  for (const cron of cronDetails) {
    str += "<tr><th>" + counter + "</th><td>";
    str += cron.cronName + "</td><td>";
    str += cron.cronTime + "</td><td>";
    str += cron.maximumProductCount + "</td></tr>";
    counter++;
  }
  str += "</tbody></table>";
  return str;
}

async function Validate422ErrorProductDetails() {
  console.info(`Running 422 ERROR Product Validation Check at ${new Date()}`);
  const _422ProductDetails = await get422ProductDetails();
  const maxCountFor422Count = applicationConfig._422_ERROR_MAX_COUNT;
  const maxCountForEligibleCount = applicationConfig._422_ERROR_ELIGIBLE_MAX_COUNT;
  if (_422ProductDetails) {
    if (_422ProductDetails.eligibleProducts > maxCountForEligibleCount) {
      const emailBody = await getEmailBodyFor422ErrorProduct(_422ProductDetails.eligibleProducts, maxCountForEligibleCount, _422ProductDetails.time, "422ELIGIBLE");
      const emailSubject = `EXPRESS CRON | Eligible Products Count Reached Maximum Limit`;
      await TriggerEmail(emailBody, emailSubject, applicationConfig.MONITOR_EMAIL_ID);
    }
    if (_422ProductDetails.products422Error > maxCountFor422Count) {
      const emailBody = await getEmailBodyFor422ErrorProduct(_422ProductDetails.products422Error, maxCountFor422Count, _422ProductDetails.time, "422ERROR");
      const emailSubject = `EXPRESS CRON | 422 Error Count Reached Maximum Limit`;
      await TriggerEmail(emailBody, emailSubject, applicationConfig.MONITOR_EMAIL_ID);
    }
    console.log(`MONITOR-SENSE : 422ERROR : VALIDATION CHECK ran at ${new Date()}`);
  }
}

async function getEmailBodyFor422ErrorProduct(actualCount: any, maxCount: any, time: any, type: any) {
  const typeMessage = type == "422ELIGIBLE" ? "Eligible Product Count in 422 Error List" : "Product count which failed due to 422 Error while repricing,";
  let str = `<h2>Hi, <br>${typeMessage} has crossed the Maximum Set Limit of : <span style="color:red">${maxCount}</span></h2><br/><table border="1"><thead><tr><th scope="col">#</th><th scope="col">Actual Count</th><th scope="col">Maximum Count</th><th scope="col">TimeStamp</th></tr></thead><tbody>`;
  str += "<tr><th>" + 1 + "</th><td>";
  str += actualCount + "</td><td>";
  str += maxCount + "</td><td>";
  str += time + "</td></tr>";
  str += "</tbody></table>";
  return str;
}

async function StartExportAndSave() {
  const urlToCall = ["http://localhost:3000/productV2/save/download_excel"];

  for (const [index, _url] of urlToCall.entries()) {
    const fileName = index == 0 ? `ScrapeList_${moment(new Date()).format("YYYYMMDD_HHmmss")}.xlsx` : `ItemList_${moment(new Date()).format("YYYYMMDD_HHmmss")}.xlsx`;
    const rootPath = applicationConfig.HISTORY_ROOT_PATH;
    const pathToSave = path.join(rootPath, "Archive", fileName);
    await exportAndSaveInExcel(_url, pathToSave);
    await uploadToFTP(pathToSave, fileName);
    console.log(`Saved file at ${pathToSave}`);
  }
}

async function exportAndSaveInExcel(url: any, pathToSave: any) {
  const response = await postDataForExcel(url, {});
  fs.writeFileSync(pathToSave, response.data);
}

async function uploadToFTP(localFilePath: any, fileName: any) {
  const client = new Client();
  client.ftp.verbose = true;
  await client.access({
    host: applicationConfig.FTP_HOST,
    user: applicationConfig.FTP_USER,
    password: applicationConfig.FTP_PASSWORD,
    secure: false,
  });
  console.log("Connected to FTP server");
  // Upload a local file to the server
  await client.uploadFrom(localFilePath, `REPRICER/${fileName}`);
  console.log("File uploaded successfully");
  client.close();
}

async function startInProgressCronCheck() {
  console.info(`Starting IN-PROGRESS CRONS Check at ${new Date()} with expression : ${applicationConfig.CRON_PROGRESS_SCHEDULE}`);
  monitorCrons["InProgressCheckCron"] = schedule(
    applicationConfig.CRON_PROGRESS_SCHEDULE,
    async () => {
      try {
        await ValidateCronDetails();
      } catch (error) {
        console.error(`Error running InProgressCheckCron:`, error);
      }
    },
    {
      scheduled: true,
      runOnInit: true,
    }
  );
}

async function startExpressCronValidationCheck() {
  console.info(`Starting EXPRESS CRONS Validation Check at ${new Date()} with expression : ${applicationConfig._422_ERROR_CRON_SCHEDULE}`);
  monitorCrons["ExpressCheckCron"] = schedule(
    applicationConfig._422_ERROR_CRON_SCHEDULE,
    async () => {
      try {
        await Validate422ErrorProductDetails();
      } catch (error) {
        console.error(`Error running ExpressCheckCron:`, error);
      }
    },
    {
      scheduled: true,
      runOnInit: true,
    }
  );
}

async function get422ProductDetails() {
  let productsCount: any = {};
  productsCount.products422Error = await mongoHelper.Get422ProductCountByType("422_ERROR");
  productsCount.priceUpdateProducts = await mongoHelper.Get422ProductCountByType("PRICE_UPDATE");
  productsCount.eligibleProducts = await mongoHelper.GetContextErrorItemsCount(true);
  productsCount.time = moment(new Date()).format("DD-MM-YYYY HH:mm:ss");
  return productsCount;
}

async function startHistoryDeletionCron() {
  console.info(`HISTORY_DELETION_CRON : Starting History Deletion Cron at ${new Date()} with expression : ${applicationConfig.HISTORY_DELETION_CRON_SCHEDULE}`);
  monitorCrons["HistoryDeletionCron"] = schedule(
    applicationConfig.HISTORY_DELETION_CRON_SCHEDULE,
    async () => {
      try {
        await DeleteHistory();
      } catch (error) {
        console.error(`HISTORY_DELETION_CRON : Error running HistoryDeletionCron:`, error);
      }
    },
    {
      scheduled: true,
      runOnInit: true,
    }
  );
}

async function startCronLogsDeletionCron() {
  console.log(`CRON_LOGS_DELETION_CRON : Starting Cron Logs Deletion Cron at ${new Date()} with expression : ${applicationConfig.CRON_LOGS_DELETION_CRON_SCHEDULE}`);
  monitorCrons["CronLogsDeletionCron"] = schedule(
    applicationConfig.CRON_LOGS_DELETION_CRON_SCHEDULE,
    async () => {
      try {
        await DeleteCronLogs();
      } catch (error) {
        console.error(`CRON_LOGS_DELETION_CRON : Error running CronLogsDeletionCron:`, error);
      }
    },
    {
      scheduled: true,
      runOnInit: true,
    }
  );
}
async function DeleteHistory() {
  // Get today's date
  const today = new Date();
  // Subtract 15 days
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 15);
  pastDate.setHours(0, 0, 0, 0);
  const apiResponseQuery = `delete from table_history_apiResponse where RefTime < ?`;
  const historyQuery = `delete from table_history where RefTime < ?`;
  const apiResponseUpdated = await mySqlMiddleware.ExecuteQuery(apiResponseQuery, [pastDate]);
  const historyUpdated = await mySqlMiddleware.ExecuteQuery(historyQuery, [pastDate]);
  console.log(`HISTORY_DELETION_CRON : EFFECTIVE DATE : ${pastDate} || ${JSON.stringify(apiResponseUpdated)} || ${JSON.stringify(historyUpdated)}`);
}

async function DeleteCronLogs() {
  const deletionResults = await mongoHelper.DeleteCronLogsPast15Days();
  console.log(`CRON_LOGS_DELETION_CRON : Deleted Cron Logs Results : ${JSON.stringify(deletionResults)} `);
}
