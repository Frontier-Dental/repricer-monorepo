import { Request, Response } from "express";
import { BadRequest } from "http-errors";
import * as _codes from "http-status-codes";
import * as _ from "lodash";
import { CacheKeyName } from "../../resources/cacheKeyName";
import * as cacheHelper from "../../utility/cacheHelper";
import * as dbHelper from "../../utility/mongo/dbHelper";
import {
  getMainCronNameFromJobName,
  setCronAndStart,
  setError422CronAndStart,
  stopCron,
} from "./shared";

export async function recreateCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const jobNames = req.body;
  cacheHelper.DeleteCacheByKey(CacheKeyName.CRON_SETTINGS_LIST);
  const cronDetails = await dbHelper.GetCronSettingsListFresh();
  const cronSettingsResponse = _.filter(cronDetails, (x) => x.IsHidden != true);
  for (const jobName of jobNames) {
    if (jobName === "Cron-422") {
      setError422CronAndStart(cronSettingsResponse);
      continue;
    }
    const cronName = getMainCronNameFromJobName(jobName);
    if (!cronName) {
      throw BadRequest(`Cron name corresonding to ${jobName} not found`);
    }
    const settings = cronSettingsResponse.find((x) => x.CronName === cronName);
    if (!settings) {
      throw BadRequest(`Cron settings not found for ${cronName}`);
    }
    stopCron(cronName);
    setCronAndStart(cronName, settings);
  }
  return res
    .status(_codes.StatusCodes.OK)
    .send(
      `Cron job updated successfully for jobName : ${JSON.stringify(jobNames)}`,
    );
}
