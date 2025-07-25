import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import { CacheKeyName } from "../../resources/cache-key-name";
import * as cacheHelper from "../../utility/cache-helper";
import * as dbHelper from "../../utility/mongo/mongo-helper";
import { setCronAndStart, stopAllMainCrons } from "./shared";
import { BadRequest } from "http-errors";

export async function startAllCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  await dbHelper.ResetPendingCronLogs();
  stopAllMainCrons();

  cacheHelper.DeleteCacheByKey(CacheKeyName.CRON_SETTINGS_LIST);
  const cronSettingsResponseTotal = await dbHelper.GetCronSettingsListFresh();
  const cronSettingsResponse = cronSettingsResponseTotal.filter(
    (x) => x.IsHidden !== true,
  );
  if (cronSettingsResponseTotal.length === 0) {
    throw BadRequest("No cron settings found");
  }
  for (const cronSetting of cronSettingsResponse) {
    const cronName = cronSetting.CronName;
    setCronAndStart(cronName, cronSetting);
  }
  return res.status(_codes.StatusCodes.OK).send("Cron started.");
}
