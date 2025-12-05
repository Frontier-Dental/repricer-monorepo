import { Request, Response } from "express";
import cron from "node-cron";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as responseUtility from "../../utility/response-utility";
import { scrapeCrons, scrapeProductList } from "./shared";
import * as _codes from "http-status-codes";
import { GetScrapeCronDetails } from "../../utility/mysql/mysql-v2";

export async function startScrapeCron(
  req: Request,
  res: Response,
): Promise<any> {
  await startScrapeCronLogic();
  return res.status(_codes.StatusCodes.OK).send(`Cron started successfully`);
}

export async function startScrapeCronLogic() {
  const scrapeCronDetails = await GetScrapeCronDetails();
  if (scrapeCronDetails && scrapeCronDetails.length > 0) {
    for (var i = 0; i < scrapeCronDetails.length; i++) {
      if (scrapeCronDetails[i]) {
        const cronDetail = scrapeCronDetails[i];
        scrapeCrons[cronDetail.CronName] = cron.schedule(
          responseUtility.GetCronGeneric(
            cronDetail.CronTimeUnit,
            cronDetail.CronTime,
            parseInt(cronDetail.Offset),
          ),
          async () => {
            try {
              await scrapeProductList(cronDetail);
            } catch (error) {
              console.error(`Error running ${cronDetail.CronName}:`, error);
            }
          },
          { scheduled: JSON.parse(cronDetail.CronStatus) },
        );
        if (JSON.parse(cronDetail.CronStatus)) {
          console.log(`Started ${cronDetail.CronName}`);
        }
      }
    }
  }
}
