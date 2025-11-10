import { Request, Response } from "express";
import { BadRequest } from "http-errors";
import * as _codes from "http-status-codes";
import * as dbHelper from "../../utility/mongo/db-helper";
import {
  getMainCronNameFromJobName,
  setCronAndStart,
  setError422CronAndStart,
  setOpportunityCronAndStart,
  stopCron,
} from "./shared";

export async function recreateCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const jobNames = req.body;
  const cronDetails = await dbHelper.GetCronSettings();
  for (const jobName of jobNames) {
    if (jobName === "_Error422Cron") {
      setError422CronAndStart(cronDetails);
      continue;
    }
    if (jobName === "Opportunity-Cron") {
      setOpportunityCronAndStart(cronDetails);
      continue;
    }
    const cronName = getMainCronNameFromJobName(jobName);
    if (!cronName) {
      throw BadRequest(`Cron name corresponding to ${jobName} not found`);
    }
    const settings = cronDetails.find((x) => x.CronName === cronName);
    if (!settings) {
      throw BadRequest(`Cron settings not found for ${cronName}`);
    }
    stopCron(cronName);
    setCronAndStart(cronName, settings);
  }
  return res
    .status(_codes.StatusCodes.OK)
    .send(
      `Cron job updated successfully for jobName : ${JSON.stringify(jobNames)}`,
    );
}
