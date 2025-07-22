import { CacheKeyName } from "../../resources/cacheKeyName";
import { Request, Response } from "express";
import * as cacheHelper from "../../utility/cacheHelper";
import * as _codes from "http-status-codes";
import { stopAllMainCrons } from "./shared";

export async function stopAllCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  stopAllMainCrons();
  cacheHelper.DeleteCacheByKey(CacheKeyName.CRON_SETTINGS_LIST);
  return res
    .status(_codes.StatusCodes.OK)
    .send("All Cron job stopped as requested");
}
