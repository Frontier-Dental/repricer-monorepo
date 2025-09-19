import _ from "lodash";
import cron from "node-cron";
import express from "express";
import _codes from "http-status-codes";
import moment from "moment";
import shell from "shelljs";
import { fetchHddInfo } from "hdd-space";
import fs from "fs";
import path from "path";
import { lstatSync, readdirSync } from "fs";
import { Request, Response } from "express";
import { applicationConfig } from "../utility/config";
import {
  TriggerEmail,
  TriggerEmailForStorage,
} from "../middleware/storage-sense-helpers/email-helper";

export const storageSenseController = express.Router();

/************* PUBLIC APIS *************/
storageSenseController.get(
  "/schedule/storage-sense",
  async (req: Request, res: Response) => {
    var storageSenseCron = cron.schedule(
      applicationConfig.STORAGE_SENSE_CRON_SCHEDULE,
      async () => {
        console.log(
          `STORAGE-SENSE : Sensing Storage for server at ${new Date()}`,
        );
        await senseAndClean();
      },
      { scheduled: true },
    );
    if (storageSenseCron) {
      return res
        .status(_codes.OK)
        .send(`Successfully Started Storage-Sense at ${new Date()}`);
    } else {
      return res
        .status(_codes.BAD_REQUEST)
        .send(
          `Some error occurred while starting Storage-Sense Cron at ${new Date()}`,
        );
    }
  },
);

storageSenseController.get("/schedule/history-purger", async (req, res) => {
  var historyPurgerCron = cron.schedule(
    applicationConfig.HISTORY_PURGE_CRON_SCHEDULE,
    async () => {
      console.log(`HISTORY-PURGER : Purging History at ${new Date()}`);
      await purgeHistory();
    },
    { scheduled: true },
  );
  if (historyPurgerCron) {
    return res
      .status(_codes.OK)
      .send(`Successfully Started History-Purger at ${new Date()}`);
  } else {
    return res
      .status(_codes.BAD_REQUEST)
      .send(
        `Some error occurred while starting History-Purger Cron at ${new Date()}`,
      );
  }
});

storageSenseController.get("/manual/history-purger", async (req, res) => {
  console.log(`HISTORY-PURGER : Purging History at ${new Date()}`);
  await purgeHistory();
  return res
    .status(_codes.OK)
    .send(`Successfully Started History-Purger at ${new Date()}`);
});

async function senseAndClean() {
  const diskDetails = await fetchHddInfo();
  //console.log(diskDetails);
  if (diskDetails.parts && diskDetails.parts.length > 0) {
    const totalDiskSpace = await getTotalSpaceCalculation(diskDetails.parts, 0);
    const totalFreeSpace = await getTotalSpaceCalculation(diskDetails.parts, 1);
    const freePercentage = (totalFreeSpace / totalDiskSpace) * 100;
    console.log(
      `STORAGE-SENSE : ${new Date().toISOString()} : FREE SPACE : ${freePercentage} %`,
    );
    if (freePercentage <= applicationConfig.FREE_THRESHOLD) {
      console.log(`Cleaning Mongo Log at ${new Date()}`);
      const dateTimeStr = moment(new Date()).format("DD-MM-YY HH:mm:ss");
      await TriggerEmailForStorage(freePercentage, dateTimeStr);
      const shellPath = applicationConfig.STORAGE_SENSE_SHELL_PATH;
      console.log(`STORAGE-SENSE : Running Cleaning Script at ${shellPath}`);
      if (applicationConfig.IS_DEBUG == false) {
        shell.exec(shellPath);
      }
    }
  }
}
async function getTotalSpaceCalculation(parts: any, type: any) {
  let calculatedValue = 0;
  _.forEach(parts, ($) => {
    if (type == 0) {
      //Total
      calculatedValue += $.size;
    } else if (type == 1) {
      //Free
      calculatedValue += $.free;
    }
  });
  return calculatedValue;
}

async function purgeHistory() {
  const rootPath = applicationConfig.HISTORY_ROOT_PATH;
  const historyBasePath = path.join(
    rootPath,
    applicationConfig.HISTORY_BASE_PATH,
  );
  const listOfSubDirectories = getDirectories(historyBasePath);
  const listOfDatesToKeep = await getDatesToKeep();
  if (listOfSubDirectories) {
    for (const subDir of listOfSubDirectories) {
      console.log(`Trying to Purge History from ${subDir}`);
      const listOfDir = getDirectories(subDir);
      if (listOfDir && listOfDir.length > 0) {
        var directoriesToRemove = _.remove(listOfDir, ($) => {
          return !listOfDatesToKeep.includes(
            $.substring(
              $.lastIndexOf(applicationConfig.STORAGE_SENSE_FILE_DELIMITER),
              $.length,
            )
              .replace(applicationConfig.STORAGE_SENSE_FILE_DELIMITER, "")
              .trim(),
          );
        });
        if (directoriesToRemove && directoriesToRemove.length > 0) {
          _.forEach(directoriesToRemove, (dir) => {
            fs.rmSync(dir, { recursive: true, force: true });
            console.log(`Successfully Purged directory ${dir}`);
          });
        }
      }
    }
  }
  const emailSubject = `HISTORY-PURGER : ${applicationConfig.ENV_NAME} | Successfully purged history`;
  const emailBody = await getEmailBodyForHistoryPurge(
    _.last(listOfDatesToKeep),
  );
  await TriggerEmail(
    emailBody,
    emailSubject,
    applicationConfig.HISTORY_PURGER_EMAIL_ID,
  );
}

const getDirectories = (source: any) =>
  readdirSync(source)
    .map((name) => path.join(source, name))
    .filter(isDirectory);
const isDirectory = (source: any) => lstatSync(source).isDirectory();
const getPreviousDate = (date: any, noOfDays: any) =>
  date.setDate(date.getDate() - noOfDays);

async function getDatesToKeep() {
  let arrayOfDate = [];
  const noOfDaysToKeep = applicationConfig.DAYS_TO_KEEP;
  for (let count = 0; count <= noOfDaysToKeep; count++) {
    const contextDate = getPreviousDate(new Date(), count);
    arrayOfDate.push(moment(contextDate).format("YYYY-MM-DD"));
  }
  return arrayOfDate;
}

async function getEmailBodyForHistoryPurge(lastDate: any) {
  let str =
    "<h2>Hi, We have purged all History records for all the products.</h2><br/>";
  str +=
    '<span style="color:blue">All records on or before the date <b>' +
    lastDate +
    '</b> have been purged.</span><br/><br/>Please restart the server bearing IP : <span style="color:green"><b>' +
    applicationConfig.ENV_IP +
    "</b></span>";
  return str;
}
