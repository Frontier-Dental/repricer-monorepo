import { Request, Response } from "express";
import {
  getMainCronNameFromJobName,
  startCron,
  startError422Cron,
} from "./shared";
import { CacheKeyName } from "../../resources/cacheKeyName";
import * as cacheHelper from "../../utility/cacheHelper";
import * as _codes from "http-status-codes";
import * as mongoHelper from "../../utility/mongo/mongoHelper";
import { BadRequest } from "http-errors";

export async function startCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const { jobName } = req.body;
  const { cronId } = req.body;
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
  startCron(cronName);
  await mongoHelper.UpdateCronSettings(cronId);
  cacheHelper.DeleteCacheByKey(CacheKeyName.CRON_SETTINGS_LIST);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Cron job started successfully for jobName : ${jobName}`);
}
