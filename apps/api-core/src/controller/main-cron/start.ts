import { Request, Response } from "express";
import {
  getMainCronNameFromJobName,
  setCronAndStart,
  startCron,
  startError422Cron,
} from "./shared";
import { CacheKeyName } from "../../resources/cache-key-name";
import * as cacheHelper from "../../utility/cache-helper";
import * as _codes from "http-status-codes";
import * as mongoHelper from "../../utility/mongo/mongo-helper";
import { BadRequest } from "http-errors";

export async function startCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const { jobName, cronId } = req.body;
  if (jobName === "Cron-422") {
    startError422Cron();
    cacheHelper.DeleteCacheByKey(CacheKeyName.CRON_SETTINGS_LIST);
    return res
      .status(_codes.StatusCodes.OK)
      .send(`Cron job started successfully for jobName : ${jobName}`);
  }
  const cronName = getMainCronNameFromJobName(jobName);
  if (!cronName) {
    throw BadRequest(`Invalid Job Name: ${jobName}`);
  }
  const settings = await mongoHelper.GetCronSettingsDetailsByName(cronName);
  setCronAndStart(cronName, settings);
  await mongoHelper.UpdateCronSettings(cronId);
  cacheHelper.DeleteCacheByKey(CacheKeyName.CRON_SETTINGS_LIST);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Cron job started successfully for jobName : ${jobName}`);
}
