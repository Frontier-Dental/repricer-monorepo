import { Request, Response } from "express";
import cron from "node-cron";
import * as dbHelper from "../../utility/mongo/dbHelper";
import * as responseUtility from "../../utility/responseUtility";
import { scrapeCrons, scrapeProductList } from "./shared";

export async function startScrapeCron(
  req: Request,
  res: Response,
): Promise<any> {
  const scrapeCronDetails = await dbHelper.GetScrapeCronDetails();
  if (scrapeCronDetails && scrapeCronDetails.length > 0) {
    for (var i = 0; i < scrapeCronDetails.length; i++) {
      const cronExpression = responseUtility.GetCronGeneric(
        scrapeCronDetails[i].CronTimeUnit,
        scrapeCronDetails[i].CronTime,
        parseInt(scrapeCronDetails[i].Offset),
      );
      console.log(
        `Initializing ${scrapeCronDetails[i].CronName} with Expression ${cronExpression} at ${new Date()}`,
      );
    }
    if (scrapeCronDetails[i]) {
      scrapeCrons[scrapeCronDetails[i].CronName] = cron.schedule(
        responseUtility.GetCronGeneric(
          scrapeCronDetails[i].CronTimeUnit,
          scrapeCronDetails[i].CronTime,
          parseInt(scrapeCronDetails[i].Offset),
        ),
        async () => {
          await scrapeProductList(scrapeCronDetails[i]);
        },
        { scheduled: JSON.parse(scrapeCronDetails[i].status) },
      );
    }
  }
}
