import _ from "lodash";
import cron from "node-cron";
import express from "express";
import _codes from "http-status-codes";
import moment from "moment";
import { Request, Response } from "express";
import { TriggerEmail } from "../middleware/storage-sense-helpers/email-helper";
import { applicationConfig } from "../utility/config";
import {
  getData,
  postDataForExcel,
} from "../middleware/storage-sense-helpers/axios-helper";
import { Client } from "basic-ftp";
import path from "path";
import fs from "fs";

export const monitorSenseController = express.Router();

/************* PUBLIC SCHEDULED APIS *************/
monitorSenseController.get(
  "/schedule/monitor-sense/cron",
  async (req: Request, res: Response) => {
    if (applicationConfig.START_CRON_PROGRESS_SCHEDULE === false) {
      return res
        .status(_codes.OK)
        .send(
          `Monitor Sense Cron for IN-PROGRESS CRONS not started as per settings at ${new Date()}`,
        );
    }
    var inProgressCron = cron.schedule(
      applicationConfig.CRON_PROGRESS_SCHEDULE,
      async () => {
        console.log(
          `MONITOR-SENSE : CRON : IN-PROGRESS CRONS at ${new Date()}`,
        );
        await ValidateCronDetails();
      },
      { scheduled: true },
    );
    if (inProgressCron) {
      return res
        .status(_codes.OK)
        .send(`Successfully Started IN-PROGRESS CRONS Check at ${new Date()}`);
    } else {
      return res
        .status(_codes.BAD_REQUEST)
        .send(
          `Some error occurred while starting IN-PROGRESS CRONS check at ${new Date()}`,
        );
    }
  },
);

monitorSenseController.get(
  "/schedule/monitor-sense/422Error",
  async (req, res) => {
    if (applicationConfig.START_422_ERROR_CRON_SCHEDULE === false) {
      return res
        .status(_codes.OK)
        .send(
          `Monitor Sense Cron for 422 Product Count Validation Check not started as per settings at ${new Date()}`,
        );
    }
    var _422ErrorValidationCron = cron.schedule(
      applicationConfig._422_ERROR_CRON_SCHEDULE,
      async () => {
        console.log(
          `MONITOR-SENSE : 422ERROR : VALIDATION CHECK at ${new Date()}`,
        );
        await Validate422ErrorProductDetails();
      },
      { scheduled: true },
    );
    if (_422ErrorValidationCron) {
      return res
        .status(_codes.OK)
        .send(
          `Successfully Started Cron for 422 Product Count Validation Check at ${new Date()}`,
        );
    } else {
      return res
        .status(_codes.BAD_REQUEST)
        .send(
          `Some error occurred while starting Cron for 422 Product Count Validation Check at ${new Date()}`,
        );
    }
  },
);

monitorSenseController.get(
  "/schedule/monitor-sense/export_save",
  async (req, res) => {
    console.log(
      `Starting Export & Save Cron with Details : ${applicationConfig.EXPORT_SAVE_CRON_SCHEDULE}`,
    );
    var _exportAndSaveCron = cron.schedule(
      applicationConfig.EXPORT_SAVE_CRON_SCHEDULE,
      async () => {
        console.log(`MONITOR-SENSE : EXPORT_SAVE : Running at ${new Date()}`);
        await StartExportAndSave();
      },
      { scheduled: true },
    );
    if (_exportAndSaveCron) {
      return res
        .status(_codes.OK)
        .send(`Successfully Started Cron for Export And Save at ${new Date()}`);
    } else {
      return res
        .status(_codes.BAD_REQUEST)
        .send(
          `Some error occurred while starting Cron for Export And Save at ${new Date()}`,
        );
    }
  },
);

/************* PUBLIC DEBUG APIS *************/
monitorSenseController.get("/debug/monitor-sense/cron", async (req, res) => {
  await ValidateCronDetails();
  return res
    .status(_codes.OK)
    .send(`Successfully Started IN-PROGRESS CRONS Check at ${new Date()}`);
});

monitorSenseController.get(
  "/debug/monitor-sense/422Error",
  async (req, res) => {
    await Validate422ErrorProductDetails();
    return res
      .status(_codes.OK)
      .send(
        `Successfully Started Cron for 422 Product Count Validation Check at ${new Date()}`,
      );
  },
);

monitorSenseController.get(
  "/debug/monitor-sense/exportAndSave",
  async (req, res) => {
    await StartExportAndSave();
    return res
      .status(_codes.OK)
      .send(`Successfully Saved Product Data at ${new Date()}`);
  },
);

/************* PRIVATE FUNCTIONS *************/
async function ValidateCronDetails() {
  const inProgressCronDetails = await getData(
    applicationConfig.CRON_PROGRESS_EXTERNAL_ENDPOINT,
  );
  const maxCount = applicationConfig.CRON_PROGRESS_MAX_COUNT;
  if (
    inProgressCronDetails &&
    inProgressCronDetails.data &&
    inProgressCronDetails.data.status == true &&
    inProgressCronDetails.data.data &&
    inProgressCronDetails.data.data.length > maxCount
  ) {
    const emailBody = await getEmailBodyForInProgressCron(
      inProgressCronDetails.data.data,
      maxCount,
    );
    const emailSubject = `MONITOR | Attention Needed : In-Progress Cron Count Reached Maximum Limit`;
    await TriggerEmail(
      emailBody,
      emailSubject,
      applicationConfig.MONITOR_EMAIL_ID,
    );
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
  const _422ProductDetails = await getData(
    applicationConfig._422_ERROR_CRON_EXTERNAL_ENDPOINT,
  );
  const maxCountFor422Count = applicationConfig._422_ERROR_MAX_COUNT;
  const maxCountForEligibleCount =
    applicationConfig._422_ERROR_ELIGIBLE_MAX_COUNT;
  if (
    _422ProductDetails &&
    _422ProductDetails.data &&
    _422ProductDetails.data.status == true &&
    _422ProductDetails.data.data
  ) {
    if (
      _422ProductDetails.data.data.eligibleProducts > maxCountForEligibleCount
    ) {
      const emailBody = await getEmailBodyFor422ErrorProduct(
        _422ProductDetails.data.data.eligibleProducts,
        maxCountForEligibleCount,
        _422ProductDetails.data.data.time,
        "422ELIGIBLE",
      );
      const emailSubject = `EXPRESS CRON | Eligible Products Count Reached Maximum Limit`;
      await TriggerEmail(
        emailBody,
        emailSubject,
        applicationConfig.MONITOR_EMAIL_ID,
      );
    }
    if (_422ProductDetails.data.data.products422Error > maxCountFor422Count) {
      const emailBody = await getEmailBodyFor422ErrorProduct(
        _422ProductDetails.data.data.products422Error,
        maxCountFor422Count,
        _422ProductDetails.data.data.time,
        "422ERROR",
      );
      const emailSubject = `EXPRESS CRON | 422 Error Count Reached Maximum Limit`;
      await TriggerEmail(
        emailBody,
        emailSubject,
        applicationConfig.MONITOR_EMAIL_ID,
      );
    }
    console.log(
      `MONITOR-SENSE : 422ERROR : VALIDATION CHECK ran at ${new Date()}`,
    );
  }
}

async function getEmailBodyFor422ErrorProduct(
  actualCount: any,
  maxCount: any,
  time: any,
  type: any,
) {
  const typeMessage =
    type == "422ELIGIBLE"
      ? "Eligible Product Count in 422 Error List"
      : "Product count which failed due to 422 Error while repricing,";
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
    const fileName =
      index == 0
        ? `ScrapeList_${moment(new Date()).format("YYYYMMDD_HHmmss")}.xlsx`
        : `ItemList_${moment(new Date()).format("YYYYMMDD_HHmmss")}.xlsx`;
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
    host: "165.22.229.139",
    user: "voyantcs",
    password: ">mL3.rEtJtsP@43",
    secure: false,
  });
  console.log("Connected to FTP server");
  // Upload a local file to the server
  await client.uploadFrom(localFilePath, `REPRICER/${fileName}`);
  console.log("File uploaded successfully");
  client.close();
}
