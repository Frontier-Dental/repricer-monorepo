import { Request, Response } from "express";
import {
  getMainCronNameFromJobName,
  setCronAndStart,
  startCron,
  startError422Cron,
  setOpportunityCronAndStart,
} from "./shared";
import { CacheKeyName } from "../../resources/cache-key-name";
import * as cacheHelper from "../../utility/cache-helper";
import * as _codes from "http-status-codes";
import * as dbHelper from "../../utility/mongo/db-helper";
import { BadRequest } from "http-errors";

export async function startCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const { jobName, cronId } = req.body;
  if (jobName === "Cron-422") {
    startError422Cron();
    return res
      .status(_codes.StatusCodes.OK)
      .send(`Cron job started successfully for jobName : ${jobName}`);
  }
  if (jobName === "Cron-Opportunity") {
    const cronSettings = await dbHelper.GetCronSettingsList();
    setOpportunityCronAndStart(cronSettings);
    return res
      .status(_codes.StatusCodes.OK)
      .send(`Cron job started successfully for jobName : ${jobName}`);
  }
  const cronName = getMainCronNameFromJobName(jobName);
  if (!cronName) {
    throw BadRequest(`Invalid Job Name: ${jobName}`);
  }
  const settings = await dbHelper.GetCronSettingsDetailsByName(cronName);
  if (!settings) {
    throw BadRequest(`Cron settings not found for ${cronName}`);
  }
  setCronAndStart(cronName, settings);
  await dbHelper.UpdateCronSettings(cronId);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Cron job started successfully for jobName : ${jobName}`);
}
