import { Request, Response } from "express";
import cron from "node-cron";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as responseUtility from "../../utility/response-utility";
import { scrapeCrons, scrapeProductList } from "./shared";
import * as _codes from "http-status-codes";

export async function startScrapeCron(
  req: Request,
  res: Response,
): Promise<any> {
  await startScrapeCronLogic();
  return res.status(_codes.StatusCodes.OK).send(`Cron started successfully`);
}

export async function startScrapeCronLogic() {
  const scrapeCronDetails = await dbHelper.GetScrapeCronDetails();
  if (scrapeCronDetails && scrapeCronDetails.length > 0) {
    for (var i = 0; i < scrapeCronDetails.length; i++) {}
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
      if (JSON.parse(scrapeCronDetails[i].status)) {
        console.log(`Started ${scrapeCronDetails[i].CronName}`);
      }
    }
  }
}
