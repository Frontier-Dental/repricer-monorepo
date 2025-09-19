import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as _ from "lodash";
import * as dbHelper from "../../utility/mongo/db-helper";
import { runCoreCronLogic, runCoreCronLogicFor422 } from "./shared";
import { BadRequest } from "http-errors";

export async function startSpecificCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const cronName = req.params.key;
  const cronDetails = await dbHelper.GetCronSettingsDetailsByName(cronName);
  if (!cronDetails) {
    throw BadRequest(`Cron settings not found for ${cronName}`);
  }
  if (!cronDetails.CronStatus) {
    throw BadRequest(`Cron ${cronName} is not active`);
  }
  console.log(`Starting Manually the cron ${cronName} at ${new Date()}`);
  if (cronDetails && cronDetails.IsHidden == true) {
    await runCoreCronLogicFor422();
  } else {
    await runCoreCronLogic(cronDetails, false);
  }
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Executed ${cronName} at ${new Date()}.`);
}
