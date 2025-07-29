import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import cron from "node-cron";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as responseUtility from "../../utility/response-utility";
import { runCoreCronLogic } from "../main-cron/shared";
import { getCronNameByJobName, slowCrons } from "./shared";

export async function recreateSlowCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const { jobName } = req.body;
  const slowCronDetails = await dbHelper.GetSlowCronDetails(true);
  const cronName = getCronNameByJobName(jobName);
  const details = slowCronDetails.find((x) => x.CronName == cronName);
  if (!details) {
    return res
      .status(_codes.StatusCodes.NOT_FOUND)
      .send(`Cron not found: ${jobName}`);
  }
  slowCrons[cronName].stop();
  delete slowCrons[details.CronName];

  const cronExpression = responseUtility.GetCronGeneric(
    details.CronTimeUnit,
    details.CronTime,
    details.Offset,
  );

  slowCrons[cronName] = cron.schedule(
    cronExpression,
    async () => {
      try {
        await runCoreCronLogic(details);
      } catch (error) {
        console.error(`Error running ${details.CronName}:`, error);
      }
    },
    { scheduled: JSON.parse(details.CronStatus) },
  );

  return res
    .status(_codes.StatusCodes.OK)
    .send(`Cron re-started successfully for jobName : ${jobName}`);
}
