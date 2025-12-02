import { Request, Response } from "express";
import * as dbHelper from "../../utility/mongo/db-helper";
import {
  getScrapeCronNameFromJobName,
  scrapeCrons,
  scrapeProductList,
  toggleCronStatus,
} from "./shared";
import { schedule } from "node-cron";
import * as responseUtility from "../../utility/response-utility";
import { GetScrapeCronDetails } from "../../utility/mysql/mysql-v2";

export async function recreateScrapeCron(
  req: Request,
  res: Response,
): Promise<any> {
  try {
    const { jobName } = req.body;
    const scrapeCronDetails = await GetScrapeCronDetails(true);
    const details = scrapeCronDetails.find(
      (x: any) => x.CronName === getScrapeCronNameFromJobName(jobName),
    );
    if (!details) {
      return res.status(404).json({
        status: false,
        message: `Cron ${jobName} not found`,
      });
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
        try {
          await scrapeProductList(details);
        } catch (error) {
          console.error(`Error running ${details.CronName}:`, error);
        }
      },
      { scheduled: JSON.parse(details.CronStatus) },
    );
    console.info(`Re-created ${jobName} with new details at ${new Date()}`);

    return res.json({
      status: true,
      message: `Successfully recreated cron ${jobName}`,
    });
  } catch (error) {
    console.error("Error recreating scrape cron:", error);
    return res.status(500).json({
      status: false,
      message: `Failed to recreate cron: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
