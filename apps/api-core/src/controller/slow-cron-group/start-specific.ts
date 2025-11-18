import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import { runCoreCronLogic } from "../main-cron/shared";
import { GetSlowCronDetails } from "../../utility/mysql/mysql-v2";
export async function startSpecificSlowCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const cronName = req.params.key;
  const slowCronDetails = await GetSlowCronDetails();
  console.log(`Executing Manually the cron ${cronName} at ${new Date()}`);

  const cronDetail = slowCronDetails.find((x: any) => x.CronName == cronName);
  if (!cronDetail) {
    return res
      .status(_codes.StatusCodes.NOT_FOUND)
      .send(`Cron not found: ${cronName}`);
  }

  await runCoreCronLogic(cronDetail, true);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Executed ${cronName} at ${new Date()}.`);
}
