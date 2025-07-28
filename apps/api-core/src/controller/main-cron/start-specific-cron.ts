import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as _ from "lodash";
import * as keyGenHelper from "../../utility/key-gen-helper";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as repriceBase from "../../utility/reprice-algo/reprice-base";
import {
  getCronEligibleProductsV3,
  IsChunkNeeded,
  logBlankCronDetailsV3,
  runCoreCronLogicFor422,
} from "./shared";
import { applicationConfig } from "../../utility/config";
import { runCoreCronLogic } from "./shared";

export async function startSpecificCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const cronName = req.params.key;
  const cronDetails: any[] =
    await dbHelper.GetCronSettingsDetailsByName(cronName);
  console.log(`Starting Manually the cron ${cronName} at ${new Date()}`);
  if (cronDetails && _.first(cronDetails).IsHidden == true) {
    await runCoreCronLogicFor422();
  } else {
    await runCoreCronLogic(_.first(cronDetails));
  }
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Executed ${cronName} at ${new Date()}.`);
}
