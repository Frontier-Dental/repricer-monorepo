import { Request, Response } from "express";
import * as dbHelper from "../../utility/mongo/dbHelper";
import {
  getScrapeCronNameFromJobName,
  scrapeCrons,
  scrapeProductList,
  toggleCronStatus,
} from "./shared";
import { schedule } from "node-cron";
import * as responseUtility from "../../utility/responseUtility";

export async function recreateScrapeCron(
  req: Request,
  res: Response,
): Promise<any> {
  const { jobName } = req.body;
  const scrapeCronDetails = await dbHelper.GetScrapeCronDetails(true);
  const details = scrapeCronDetails.find(
    (x) => x.CronName === getScrapeCronNameFromJobName(jobName),
  );
  if (!details) {
    throw new Error(`Cron ${jobName} not found`);
  }
  toggleCronStatus(scrapeCrons[details.CronName], 0, jobName);
  let cronExpression = responseUtility.GetCronGeneric(
    details.CronTimeUnit,
    details.CronTime,
    parseInt(details.Offset),
  );
  scrapeCrons[details.CronName] = schedule(
    cronExpression,
    async () => {
      await scrapeProductList(details);
    },
    { scheduled: JSON.parse(details.status) },
  );
  console.log(`Re-created ${jobName} with new details at ${new Date()}`);
}
