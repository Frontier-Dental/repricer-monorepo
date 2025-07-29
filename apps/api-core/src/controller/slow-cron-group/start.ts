import { Request, Response } from "express";
import cron from "node-cron";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as responseUtility from "../../utility/response-utility";
import * as _codes from "http-status-codes";
import { runCoreCronLogic } from "../main-cron/shared";
import { slowCrons, getCronNameByJobName } from "./shared";

export async function startAllSlowCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  await startSlowCronLogic();
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Slow cron started successfully`);
}

export async function startSlowCronLogic() {
  const slowCronDetails = await dbHelper.GetSlowCronDetails();
  if (slowCronDetails && slowCronDetails.length > 0) {
    for (let i = 0; i < slowCronDetails.length; i++) {
      const cronDetail = slowCronDetails[i];
      if (cronDetail) {
        const jobName = `_SCG${i + 1}Cron`;
        const cronName = getCronNameByJobName(jobName);

        const cronExpression = responseUtility.GetCronGeneric(
          cronDetail.CronTimeUnit,
          cronDetail.CronTime,
          cronDetail.Offset,
        );

        slowCrons[cronName] = cron.schedule(
          cronExpression,
          async () => {
            try {
              await runCoreCronLogic(cronDetail);
            } catch (error) {
              console.error(`Error running ${cronDetail.CronName}:`, error);
            }
          },
          { scheduled: JSON.parse(cronDetail.CronStatus) },
        );
        if (JSON.parse(cronDetail.CronStatus)) {
          console.log(
            `Started ${cronDetail.CronName} at ${new Date()} with expression ${cronExpression}`,
          );
        }
      }
    }
  }
}
