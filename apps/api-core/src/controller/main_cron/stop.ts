import { Request, Response } from "express";
import { getMainCronNameFromJobName, stop422Cron, stopCron } from "./shared";
import * as _codes from "http-status-codes";
import { CacheKeyName } from "../../resources/cacheKeyName";
import * as cacheHelper from "../../utility/cacheHelper";
import { BadRequest } from "http-errors";

export async function stopCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const { jobName } = req.body;
  if (jobName === "Cron-422") {
    stop422Cron();
  } else {
    const cronName = getMainCronNameFromJobName(jobName);
    if (!cronName) {
      throw BadRequest(`Invalid Job Name: ${jobName}`);
    }
    stopCron(cronName);
  }
  cacheHelper.DeleteCacheByKey(CacheKeyName.CRON_SETTINGS_LIST);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Cron job stopped successfully for jobName : ${jobName}`);
}
