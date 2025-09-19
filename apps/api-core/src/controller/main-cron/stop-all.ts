import { CacheKeyName } from "../../resources/cache-key-name";
import { Request, Response } from "express";
import * as cacheHelper from "../../utility/cache-helper";
import * as _codes from "http-status-codes";
import { stopAllMainCrons } from "./shared";

export async function stopAllCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  stopAllMainCrons();
  return res
    .status(_codes.StatusCodes.OK)
    .send("All Cron job stopped as requested");
}
